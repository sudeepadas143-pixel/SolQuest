// Storage for the leaderboard, one of:
//  - Upstash Redis over its REST API, when KV_REST_API_URL / KV_REST_API_TOKEN
//    (or UPSTASH_REDIS_REST_URL / _TOKEN) are set;
//  - Vercel Blob, when BLOB_READ_WRITE_TOKEN is set: the whole board is one
//    private JSON file. Each request loads it once, runs its commands on that
//    copy, and saves it with an ETag check - if another request saved in
//    between, the request runs again on the fresh copy, so nothing is lost;
//  - in local dev and tests, the same command emulation in memory.
// In production with none of these the API answers 503 - never a silent
// in-memory board.
import { AsyncLocalStorage } from 'node:async_hooks';

const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const DB_PATH = 'leaderboard/db.json';

export const storeConfigured = () => !!(URL_ && TOKEN);
export const blobConfigured = () => !!process.env.BLOB_READ_WRITE_TOKEN;
const allowMemory = () => process.env.LEADERBOARD_MEMORY === '1' || process.env.NODE_ENV !== 'production';

// the keyspace the emulated commands work on: per request with Blob, shared in memory
const local = { mem: new Map(), expiry: new Map(), dirty: false };
const als = new AsyncLocalStorage();
const S = () => als.getStore() ?? local;
const WRITES = new Set(['SET', 'DEL', 'INCR', 'EXPIRE', 'HSET', 'HDEL', 'ZADD', 'ZREM', 'LPUSH', 'LREM']);

/** Run one Redis command, e.g. cmd('ZADD', 'lb:s1', 123, 'wallet'). */
export async function cmd(...args) {
  if (storeConfigured()) {
    const r = await fetch(URL_, {
      method: 'POST',
      headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(args.map(String)),
    });
    const j = await r.json();
    if (j.error) throw new Error(`redis: ${j.error}`);
    return j.result;
  }
  if (!als.getStore() && !allowMemory()) {
    const e = new Error('Leaderboard storage is not configured');
    e.status = 503;
    throw e;
  }
  const a = args.map(String);
  if (WRITES.has(a[0].toUpperCase())) S().dirty = true;
  return memory(a);
}

// ---------------------------------------------------------------- blob store --
function serialize({ mem, expiry }) {
  const out = {};
  for (const [k, v] of mem) {
    const e = expiry.get(k) ?? null;
    if (e && e < Date.now()) continue;
    if (typeof v === 'string') out[k] = { t: 's', v, e };
    else if (Array.isArray(v)) out[k] = { t: 'l', v, e };
    else out[k] = { t: v.zset ? 'z' : 'h', v: [...v], e };
  }
  return out;
}

function deserialize(data) {
  const mem = new Map();
  const expiry = new Map();
  for (const [k, { t, v, e }] of Object.entries(data ?? {})) {
    if (t === 's' || t === 'l') mem.set(k, v);
    else { const m = new Map(v); if (t === 'z') m.zset = true; mem.set(k, m); }
    if (e) expiry.set(k, e);
  }
  return { mem, expiry, dirty: false };
}

/** Run a request's handler against the store. With Blob, that's one
 *  load / run / conditional save, retried when another request got there first. */
let blobSdk = null;
/** Tests swap in a stand-in for @vercel/blob. */
export function useBlobSdk(sdk) { blobSdk = sdk; }

export async function transaction(fn) {
  if (storeConfigured() || !blobConfigured()) return fn();
  const { get, put, BlobPreconditionFailedError, BlobNotFoundError } = blobSdk ?? await import('@vercel/blob');
  for (let attempt = 0; attempt < 8; attempt++) {
    let cur = null;
    try { cur = await get(DB_PATH, { access: 'private', useCache: false }); } catch (e) { if (!(e instanceof BlobNotFoundError)) throw e; }
    const etag = cur?.blob?.etag ?? null;
    const data = cur?.stream ? JSON.parse(await new Response(cur.stream).text()) : {};
    const state = deserialize(data);
    const out = await als.run(state, fn);
    if (!state.dirty) return out;
    try {
      // an update only lands on the version we read (ifMatch); the very first
      // save is create-only (no overwrite), so two first writers can't both win
      await put(DB_PATH, JSON.stringify(serialize(state)), {
        access: 'private', contentType: 'application/json', addRandomSuffix: false,
        ...(etag ? { ifMatch: etag, allowOverwrite: true } : { allowOverwrite: false }),
      });
      return out;
    } catch (e) {
      // lost the race: someone saved since we read. (A failed create reports a
      // generic error, so check whether the file appeared meanwhile.)
      const raced = e instanceof BlobPreconditionFailedError
        || (!etag && await get(DB_PATH, { access: 'private', useCache: false }).then((r) => !!r, () => false));
      if (!raced) throw e;
      await new Promise((r) => setTimeout(r, 40 + Math.random() * 120 * (attempt + 1)));
    }
  }
  const e = new Error('The leaderboard is busy. Try again in a moment.');
  e.status = 503;
  throw e;
}

// ------------------------------------------------------------------ memory --
function live(k) {
  const { mem, expiry } = S();
  const t = expiry.get(k);
  if (t && t < Date.now()) { mem.delete(k); expiry.delete(k); }
  return mem.get(k);
}

export function resetMemory() { local.mem.clear(); local.expiry.clear(); }

function memory([c, ...a]) {
  const C = c.toUpperCase();
  const { mem, expiry } = S();
  switch (C) {
    case 'GET': { const v = live(a[0]); return typeof v === 'string' ? v : null; }
    case 'SET': {
      const [k, v, ...opt] = a;
      const o = opt.map((x) => x.toUpperCase());
      if (o.includes('NX') && live(k) !== undefined) return null;
      mem.set(k, v);
      const ex = o.indexOf('EX');
      if (ex >= 0) expiry.set(k, Date.now() + Number(opt[ex + 1]) * 1000);
      return 'OK';
    }
    case 'DEL': { let n = 0; for (const k of a) if (mem.delete(k)) n++; return n; }
    case 'INCR': { const v = Number(live(a[0]) ?? 0) + 1; mem.set(a[0], String(v)); return v; }
    case 'EXPIRE': { if (live(a[0]) === undefined) return 0; expiry.set(a[0], Date.now() + Number(a[1]) * 1000); return 1; }
    case 'HSET': { const h = live(a[0]) ?? new Map(); mem.set(a[0], h); let n = 0; for (let i = 1; i < a.length; i += 2) { if (!h.has(a[i])) n++; h.set(a[i], a[i + 1]); } return n; }
    case 'HGET': return live(a[0])?.get(a[1]) ?? null;
    case 'HDEL': { const h = live(a[0]); let n = 0; if (h) for (const f of a.slice(1)) if (h.delete(f)) n++; return n; }
    case 'HGETALL': { const h = live(a[0]); return h ? [...h].flat() : []; }
    case 'ZADD': {
      const z = live(a[0]) ?? new Map(); z.zset = true; mem.set(a[0], z);
      let i = 1; const flags = new Set();
      while (['LT', 'GT', 'NX', 'XX', 'CH'].includes(a[i]?.toUpperCase())) flags.add(a[i++].toUpperCase());
      let n = 0;
      for (; i < a.length; i += 2) {
        const s = Number(a[i]); const m = a[i + 1]; const had = z.has(m);
        if (flags.has('NX') && had) continue;
        if (flags.has('XX') && !had) continue;
        if (had && flags.has('LT') && !(s < z.get(m))) continue;
        if (had && flags.has('GT') && !(s > z.get(m))) continue;
        if (!had) n++;
        z.set(m, s);
      }
      return n;
    }
    case 'ZREM': { const z = live(a[0]); let n = 0; if (z) for (const m of a.slice(1)) if (z.delete(m)) n++; return n; }
    case 'ZSCORE': { const v = live(a[0])?.get(a[1]); return v === undefined ? null : String(v); }
    case 'ZCARD': return live(a[0])?.size ?? 0;
    case 'ZRANK': {
      const z = live(a[0]); if (!z?.has(a[1])) return null;
      return sorted(z).findIndex(([m]) => m === a[1]);
    }
    case 'ZRANGE': {
      const z = live(a[0]); if (!z) return [];
      const all = sorted(z);
      let s = Number(a[1]); let e = Number(a[2]);
      if (s < 0) s += all.length; if (e < 0) e += all.length;
      const part = all.slice(s, e + 1);
      return a.map((x) => x.toUpperCase()).includes('WITHSCORES') ? part.flatMap(([m, v]) => [m, String(v)]) : part.map(([m]) => m);
    }
    case 'LPUSH': { const l = live(a[0]) ?? []; mem.set(a[0], l); l.unshift(...a.slice(1).reverse()); return l.length; }
    case 'LRANGE': { const l = live(a[0]) ?? []; const e = Number(a[2]); return l.slice(Number(a[1]), e < 0 ? l.length + e + 1 : e + 1); }
    case 'LREM': { const l = live(a[0]) ?? []; const before = l.length; mem.set(a[0], l.filter((x) => x !== a[2])); return before - mem.get(a[0]).length; }
    case 'SCAN': return ['0', [...mem.keys()].filter((k) => globMatch(a[a.indexOf('MATCH') + 1] ?? '*', k))];
    default: throw new Error(`memory store: ${C} not supported`);
  }
}

// as in Redis: by score, then by member
const sorted = (z) => [...z].sort((x, y) => x[1] - y[1] || (x[0] < y[0] ? -1 : x[0] > y[0] ? 1 : 0));
const globMatch = (g, k) => new RegExp(`^${g.split('*').map((p) => p.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*')}$`).test(k);
