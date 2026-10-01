// The Blob-backed store (api/_lib/redis.js transaction) against a stand-in
// for @vercel/blob with real ETag semantics: a write with a stale ETag fails.
//   node tools/blob_store_tests.mjs
process.env.BLOB_READ_WRITE_TOKEN = 'test';
process.env.ADMIN_KEY = 'k';
process.env.NODE_ENV = 'production';                   // no silent memory fallback
const { transaction, useBlobSdk } = await import('../api/_lib/redis.js');
const { submitRun, leaderboard, player, admin } = await import('../api/_lib/core.js');

class BlobPreconditionFailedError extends Error {}
class BlobNotFoundError extends Error {}
let file = null;          // { body, etag }
let n = 0;
let puts = 0;
let conflicts = 0;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
useBlobSdk({
  BlobPreconditionFailedError, BlobNotFoundError,
  async get(path, opts) {
    if (opts.access !== 'private' || opts.useCache !== false) throw new Error('expected an uncached private read');
    await sleep(5);
    if (!file) return null;
    return { statusCode: 200, stream: new Response(file.body).body, blob: { etag: file.etag } };
  },
  async put(path, body, opts) {
    await sleep(5);
    if (opts.ifMatch && (!file || file.etag !== opts.ifMatch)) { conflicts++; throw new BlobPreconditionFailedError(); }
    if (!opts.ifMatch && file && !opts.allowOverwrite) { conflicts++; throw new Error('Vercel Blob: This blob already exists, use `allowOverwrite: true` if you want to overwrite it.'); }
    file = { body, etag: `e${++n}` };
    puts++;
    return {};
  },
});

let pass = 0; const fails = [];
const ok = (v, m) => { console.log(`${v ? '  ✓' : '  ✗'} ${m}`); v ? pass++ : fails.push(m); };
const W = ['7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU', '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM', 'DRpbCBMxVnDK7maPM5tGv6MvB3v1sRMC86PZ8okm21hy', 'HN7cABqLq46Es1jh92dQQisAq662SmxELLLsHHe4YWrH', '5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1', '4Nd1mBQtrMJVYVfKf2PJy9NZUZdTAsp7D4xWLs4gDB4T'];
const now = Date.now();
const run = (w, min, ip) => ({ ip, body: { wallet: w, name: `P${min}`, run: { clearMs: min * 60e3, startedAt: new Date(now - min * 60e3 - 60e3).toISOString(), clearedAt: new Date(now).toISOString() } } });

// a read before anything exists: empty board, no write
const empty = await transaction(() => leaderboard({ query: {} }));
ok(empty.body.total === 0 && puts === 0, 'empty store reads as an empty board, without writing');

// six players finish at the same moment: every run must land
const res = await Promise.all(W.map((w, i) => transaction(() => submitRun(run(w, 20 + i, `ip${i}`)))));
ok(res.every((r) => r.status === 200), 'six simultaneous submissions all accepted');
ok(conflicts > 0, `the stand-in really raced (${conflicts} stale writes retried)`);
const lb = await transaction(() => leaderboard({ query: {} }));
ok(lb.body.total === 6, `all six are on the board (${lb.body.total})`);
ok(JSON.stringify(lb.body.entries.map((e) => e.clearMs / 60e3)) === JSON.stringify([20, 21, 22, 23, 24, 25]), 'ranked by time');

// admin writes and payouts survive the round trip through the file
await transaction(() => admin({ body: { key: 'k', action: 'setConfig', config: { poolSol: 6, splits: [50, 50] } } }));
await transaction(() => admin({ body: { key: 'k', action: 'verify', wallet: W[0] } }));
await transaction(() => admin({ body: { key: 'k', action: 'pay', wallet: W[0], amountSol: 1.5 } }));
const p = await transaction(() => player({ query: { wallet: W[0] } }));
ok(p.body.rank === 1 && p.body.run.status === 'verified' && p.body.projectedSol === 3 && p.body.totalPaidSol === 1.5, 'verify, pool and payout persisted');

// the rate-limit counter persists too (expiring key)
let last;
for (let i = 0; i < 11; i++) last = await transaction(() => submitRun(run(W[1], 30 + i, 'same-ip')));
ok(last.status === 429, 'rate limit counts across requests');

// a read-only request never writes
const before = puts;
await transaction(() => leaderboard({ query: {} }));
await transaction(() => player({ query: { wallet: W[2] } }));
ok(puts === before, 'reads do not write');

console.log(`\n${pass} passed${fails.length ? `, ${fails.length} failed` : ''}`);
process.exit(fails.length ? 1 : 0);
