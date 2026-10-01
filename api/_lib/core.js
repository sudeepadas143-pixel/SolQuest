// Leaderboard + earnings logic, independent of the HTTP layer (api/*.js wrap
// these; tools/api_tests.mjs calls them directly).
//
// A season's board ranks the best clear time per wallet. Runs arrive from the
// player's browser, so they are checked for plausibility here and held as
// "pending" until the admin verifies them (BUILD_NOTES.md §3b: client times
// can be forged). Projected payouts follow the season's prize pool and split;
// actual payouts are recorded by the admin with their transaction signature.
import { cmd } from './redis.js';

export const DEFAULT_CONFIG = {
  season: 's1',
  seasonName: 'Season 1',
  poolSol: 0,                                   // prize pool for this season, in SOL
  splits: [30, 20, 12, 9, 7, 6, 5, 4, 4, 3],    // % of the pool for 1st, 2nd, ... (paid places)
  endsAt: null,                                  // ISO time the season closes, or null (open-ended)
  open: true,                                    // accepting runs
  minClearMs: 5 * 60 * 1000,                     // faster than this is rejected outright
};

const SOL_ADDR = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
export const validSolAddress = (w) => typeof w === 'string' && SOL_ADDR.test(w);
const short = (w) => `${w.slice(0, 4)}…${w.slice(-4)}`;
const cleanName = (n) => String(n ?? '').replace(/[^\p{L}\p{N} _.-]/gu, '').trim().slice(0, 10).toUpperCase() || 'TRAINER';
const k = {
  cfg: 'cfg',
  board: (s) => `lb:${s}`,
  runs: (s) => `run:${s}`,
  bans: (s) => `ban:${s}`,
  pays: (w) => `pay:${w}`,
  rate: (ip) => `rl:${ip}`,
};
const json = (status, body) => ({ status, body });
const round9 = (x) => Math.round(x * 1e9) / 1e9;

export async function getConfig() {
  const raw = await cmd('GET', k.cfg);
  let c = {};
  try { c = raw ? JSON.parse(raw) : {}; } catch { c = {}; }
  return { ...DEFAULT_CONFIG, ...c };
}

const seasonOpen = (c, now = Date.now()) => c.open && (!c.endsAt || Date.parse(c.endsAt) > now);
const payoutFor = (c, rank) => (rank >= 1 && rank <= c.splits.length ? round9((c.poolSol * c.splits[rank - 1]) / 100) : 0);
const publicConfig = (c, now) => ({
  season: c.season, seasonName: c.seasonName, poolSol: c.poolSol, splits: c.splits,
  endsAt: c.endsAt, open: seasonOpen(c, now), paidPlaces: c.splits.length,
});

async function runOf(season, wallet) {
  const raw = await cmd('HGET', k.runs(season), wallet);
  return raw ? JSON.parse(raw) : null;
}

/** GET /api/leaderboard?limit=&offset= */
export async function leaderboard({ query = {}, now = Date.now() }) {
  const c = await getConfig();
  const limit = Math.max(1, Math.min(100, Number(query.limit) || 50));
  const offset = Math.max(0, Number(query.offset) || 0);
  const total = await cmd('ZCARD', k.board(c.season));
  const flat = await cmd('ZRANGE', k.board(c.season), offset, offset + limit - 1, 'WITHSCORES');
  const entries = [];
  for (let i = 0; i < flat.length; i += 2) {
    const wallet = flat[i];
    const r = (await runOf(c.season, wallet)) ?? {};
    const rank = offset + i / 2 + 1;
    entries.push({
      rank, name: r.name ?? 'TRAINER', wallet: short(wallet), clearMs: Number(flat[i + 1]),
      starter: r.starter ?? null, status: r.status ?? 'pending', payoutSol: payoutFor(c, rank),
    });
  }
  return json(200, { ...publicConfig(c, now), total, offset, entries });
}

/** GET /api/player?wallet= : rank, best run, projected payout and payout history. */
export async function player({ query = {}, now = Date.now() }) {
  const wallet = String(query.wallet ?? '').trim();
  if (!validSolAddress(wallet)) return json(400, { error: 'That is not a valid Solana wallet address.' });
  const c = await getConfig();
  const [run, rank0, total, banned, paysRaw] = await Promise.all([
    runOf(c.season, wallet),
    cmd('ZRANK', k.board(c.season), wallet),
    cmd('ZCARD', k.board(c.season)),
    cmd('HGET', k.bans(c.season), wallet),
    cmd('LRANGE', k.pays(wallet), 0, -1),
  ]);
  const rank = rank0 === null || rank0 === undefined ? null : Number(rank0) + 1;
  // the time held at the last paid place: what it takes to get paid right now
  const cut = c.splits.length ? await cmd('ZRANGE', k.board(c.season), c.splits.length - 1, c.splits.length - 1, 'WITHSCORES') : [];
  const payouts = paysRaw.map((p) => JSON.parse(p));
  const totalPaidSol = round9(payouts.reduce((a, p) => a + Number(p.amountSol || 0), 0));
  const projectedSol = rank ? payoutFor(c, rank) : 0;
  return json(200, {
    ...publicConfig(c, now),
    wallet: short(wallet),
    total,
    rank,
    run: run && { name: run.name, clearMs: run.clearMs, clearedAt: run.clearedAt, starter: run.starter, status: run.status, note: run.status === 'rejected' ? run.note ?? '' : '' },
    banned: !!banned,
    inPaidPlaces: !!rank && rank <= c.splits.length,
    cutoffMs: cut.length ? Number(cut[1]) : null,
    projectedSol,
    payouts,
    totalPaidSol,
    seasonPaidSol: round9(payouts.filter((p) => p.season === c.season).reduce((a, p) => a + Number(p.amountSol || 0), 0)),
  });
}

/** POST /api/runs : a finished run from the game. Keeps each wallet's best. */
export async function submitRun({ body = {}, ip = 'local', now = Date.now() }) {
  // a few submissions a minute per address is plenty (one per clear, plus retries)
  const rl = await cmd('INCR', k.rate(ip));
  if (Number(rl) === 1) await cmd('EXPIRE', k.rate(ip), 60);
  if (Number(rl) > 10) return json(429, { error: 'Too many submissions. Try again in a minute.' });

  const c = await getConfig();
  if (!seasonOpen(c)) return json(403, { error: `${c.seasonName} is closed to new runs.` });
  const wallet = String(body.wallet ?? '').trim();
  if (!validSolAddress(wallet)) return json(400, { error: 'Your wallet must be a Solana address to join the leaderboard. Change it in MENU > PROFILE.' });
  if (await cmd('HGET', k.bans(c.season), wallet)) return json(403, { error: 'This wallet cannot enter this season.' });

  const run = body.run ?? {};
  const clearMs = Math.round(Number(run.clearMs));
  const started = Date.parse(run.startedAt);
  const cleared = Date.parse(run.clearedAt);
  if (!Number.isFinite(clearMs) || clearMs <= 0) return json(400, { error: 'No finished run to submit.' });
  if (clearMs < c.minClearMs) return json(400, { error: 'That clear time is not possible.' });
  if (clearMs > 7 * 24 * 3600e3) return json(400, { error: 'That clear time is too long to rank.' });
  if (!Number.isFinite(started) || !Number.isFinite(cleared)) return json(400, { error: 'The run is missing its start or finish time.' });
  if (cleared > now + 5 * 60e3) return json(400, { error: 'The run finishes in the future.' });
  // in-game time can't exceed the wall-clock time between start and finish
  if (clearMs > cleared - started + 5000) return json(400, { error: 'The run timer does not add up.' });
  if (c.endsAt && cleared > Date.parse(c.endsAt)) return json(403, { error: `${c.seasonName} had already closed when this run finished.` });

  const prev = await runOf(c.season, wallet);
  if (prev && prev.status !== 'rejected' && prev.clearMs <= clearMs) {
    const rank = Number(await cmd('ZRANK', k.board(c.season), wallet)) + 1;
    return json(200, { ok: true, best: false, rank, clearMs: prev.clearMs, status: prev.status });
  }
  const rec = {
    name: cleanName(body.name), clearMs, startedAt: new Date(started).toISOString(), clearedAt: new Date(cleared).toISOString(),
    submittedAt: new Date(now).toISOString(), starter: String(body.starter ?? '').slice(0, 20) || null,
    species: String(body.species ?? '').slice(0, 20) || null, level: Number(body.level) || null,
    score: Number(body.score) || 0, seedSource: String(body.seedSource ?? '').slice(0, 12), version: String(body.version ?? '').slice(0, 16),
    status: 'pending', submissions: (prev?.submissions ?? 0) + 1,
  };
  await cmd('HSET', k.runs(c.season), wallet, JSON.stringify(rec));
  await cmd('ZADD', k.board(c.season), clearMs, wallet);
  const rank = Number(await cmd('ZRANK', k.board(c.season), wallet)) + 1;
  return json(200, { ok: true, best: true, rank, clearMs, status: 'pending', projectedSol: payoutFor(c, rank) });
}

// ------------------------------------------------------------------- admin --
function adminOk(key) {
  const want = process.env.ADMIN_KEY ?? '';
  if (!want || typeof key !== 'string' || key.length !== want.length) return false;
  let d = 0;
  for (let i = 0; i < want.length; i++) d |= want.charCodeAt(i) ^ key.charCodeAt(i);
  return d === 0;
}

/** POST /api/admin {key, action, ...} */
export async function admin({ body = {}, now = Date.now() }) {
  if (!process.env.ADMIN_KEY) return json(403, { error: 'Admin is disabled: set ADMIN_KEY in the project environment.' });
  if (!adminOk(body.key)) return json(401, { error: 'Wrong admin key.' });
  const c = await getConfig();
  const season = body.season || c.season;
  const wallet = String(body.wallet ?? '').trim();
  const needWallet = () => (validSolAddress(wallet) ? null : json(400, { error: 'Give a full Solana wallet address.' }));

  switch (body.action) {
    case 'config': return json(200, { config: c });
    case 'setConfig': {
      const p = body.config ?? {};
      const next = { ...c };
      if (p.season !== undefined) next.season = String(p.season).replace(/[^\w-]/g, '').slice(0, 24) || c.season;
      if (p.seasonName !== undefined) next.seasonName = String(p.seasonName).slice(0, 40);
      if (p.poolSol !== undefined) next.poolSol = Math.max(0, Number(p.poolSol) || 0);
      if (p.splits !== undefined) {
        const sp = (Array.isArray(p.splits) ? p.splits : String(p.splits).split(',')).map(Number).filter((x) => x > 0);
        if (sp.reduce((a, x) => a + x, 0) > 100.0001) return json(400, { error: 'Splits add up to more than 100%.' });
        next.splits = sp;
      }
      if (p.endsAt !== undefined) next.endsAt = p.endsAt ? new Date(p.endsAt).toISOString() : null;
      if (p.open !== undefined) next.open = !!p.open;
      if (p.minClearMs !== undefined) next.minClearMs = Math.max(0, Number(p.minClearMs) || 0);
      await cmd('SET', k.cfg, JSON.stringify(next));
      return json(200, { config: next });
    }
    case 'runs': {
      // everything for the season, full wallets, rejected included
      const all = await cmd('HGETALL', k.runs(season));
      const order = await cmd('ZRANGE', k.board(season), 0, -1);
      const runs = [];
      for (let i = 0; i < all.length; i += 2) {
        const r = JSON.parse(all[i + 1]);
        const idx = order.indexOf(all[i]);
        runs.push({ wallet: all[i], rank: idx >= 0 ? idx + 1 : null, ...r });
      }
      runs.sort((a, b) => (a.rank ?? 1e9) - (b.rank ?? 1e9) || a.clearMs - b.clearMs);
      return json(200, { season, runs, bans: await cmd('HGETALL', k.bans(season)) });
    }
    case 'verify':
    case 'reject': {
      const bad = needWallet(); if (bad) return bad;
      const r = await runOf(season, wallet);
      if (!r) return json(404, { error: 'No run for that wallet this season.' });
      r.status = body.action === 'verify' ? 'verified' : 'rejected';
      r.note = String(body.note ?? '').slice(0, 140);
      r.reviewedAt = new Date(now).toISOString();
      await cmd('HSET', k.runs(season), wallet, JSON.stringify(r));
      if (r.status === 'rejected') await cmd('ZREM', k.board(season), wallet);
      else await cmd('ZADD', k.board(season), r.clearMs, wallet);
      return json(200, { ok: true, run: r });
    }
    case 'ban':
    case 'unban': {
      const bad = needWallet(); if (bad) return bad;
      if (body.action === 'ban') {
        await cmd('HSET', k.bans(season), wallet, String(body.note ?? 'banned').slice(0, 140));
        await cmd('ZREM', k.board(season), wallet);
      } else await cmd('HDEL', k.bans(season), wallet);
      return json(200, { ok: true });
    }
    case 'pay': {
      const bad = needWallet(); if (bad) return bad;
      const amountSol = Number(body.amountSol);
      if (!(amountSol > 0)) return json(400, { error: 'Amount must be more than 0 SOL.' });
      const tx = String(body.tx ?? '').trim();
      if (tx && !/^[1-9A-HJ-NP-Za-km-z]{60,100}$/.test(tx)) return json(400, { error: 'That does not look like a Solana transaction signature.' });
      const rank = Number(body.rank) || null;
      const p = { id: `${now.toString(36)}${Math.random().toString(36).slice(2, 6)}`, season, rank, amountSol: round9(amountSol), tx: tx || null, note: String(body.note ?? '').slice(0, 140), at: new Date(now).toISOString() };
      await cmd('LPUSH', k.pays(wallet), JSON.stringify(p));
      return json(200, { ok: true, payout: p });
    }
    case 'unpay': {
      const bad = needWallet(); if (bad) return bad;
      const list = await cmd('LRANGE', k.pays(wallet), 0, -1);
      const hit = list.find((x) => JSON.parse(x).id === body.id);
      if (!hit) return json(404, { error: 'No such payout.' });
      await cmd('LREM', k.pays(wallet), 1, hit);
      return json(200, { ok: true });
    }
    default: return json(400, { error: 'Unknown action.' });
  }
}
