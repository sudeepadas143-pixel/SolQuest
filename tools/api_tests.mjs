// Leaderboard / earnings API logic against the in-memory store.
//   node tools/api_tests.mjs
process.env.LEADERBOARD_MEMORY = '1';
process.env.ADMIN_KEY = 'test-key';
const { leaderboard, player, submitRun, admin } = await import('../api/_lib/core.js');
const { resetMemory } = await import('../api/_lib/redis.js');

let pass = 0;
const fails = [];
async function test(name, fn) {
  resetMemory();
  try { await fn(); pass++; console.log(`  ✓ ${name}`); } catch (e) { fails.push(name); console.log(`  ✗ ${name}\n    ${e.message}`); }
}
const eq = (a, b, m = '') => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${m} expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); };
const ok = (v, m) => { if (!v) throw new Error(m); };

const W = ['7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU', '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM', 'DRpbCBMxVnDK7maPM5tGv6MvB3v1sRMC86PZ8okm21hy', 'HN7cABqLq46Es1jh92dQQisAq662SmxELLLsHHe4YWrH'];
const NOW = Date.parse('2026-10-01T12:00:00Z');
const run = (clearMs, wallet = W[0], extra = {}) => ({
  ip: `ip-${Math.random()}`, now: NOW,
  body: { wallet, name: 'kai', starter: 'sharkpup', run: { clearMs, startedAt: new Date(NOW - clearMs - 60e3).toISOString(), clearedAt: new Date(NOW - 1000).toISOString() }, ...extra },
});
const A = (action, more = {}) => admin({ body: { key: 'test-key', action, ...more }, now: NOW });

await test('a valid run is accepted, pending, ranked 1st', async () => {
  const r = await submitRun(run(40 * 60e3));
  eq(r.status, 200); eq(r.body.rank, 1); eq(r.body.status, 'pending'); eq(r.body.best, true);
  const lb = await leaderboard({ query: {} });
  eq(lb.body.total, 1); eq(lb.body.entries[0].name, 'KAI'); eq(lb.body.entries[0].wallet, '7xKX…gAsU');
});

await test('keeps only the best time per wallet', async () => {
  await submitRun(run(40 * 60e3));
  const slower = await submitRun(run(50 * 60e3));
  eq(slower.body.best, false); eq(slower.body.clearMs, 40 * 60e3);
  const faster = await submitRun(run(30 * 60e3));
  eq(faster.body.best, true);
  const lb = await leaderboard({ query: {} });
  eq(lb.body.total, 1); eq(lb.body.entries[0].clearMs, 30 * 60e3);
});

await test('ranks by time across wallets', async () => {
  await submitRun(run(40 * 60e3, W[0]));
  await submitRun(run(20 * 60e3, W[1]));
  await submitRun(run(30 * 60e3, W[2]));
  const lb = await leaderboard({ query: {} });
  eq(lb.body.entries.map((e) => e.clearMs / 60e3), [20, 30, 40]);
  eq(lb.body.entries.map((e) => e.rank), [1, 2, 3]);
});

await test('rejects bad wallets, impossible and inconsistent times', async () => {
  eq((await submitRun(run(40 * 60e3, 'hallwalk123'))).status, 400);
  eq((await submitRun(run(60e3))).status, 400, 'under the minimum');
  const bad = run(40 * 60e3);
  bad.body.run.startedAt = new Date(NOW - 10 * 60e3).toISOString();      // only 10 min of wall time for a 40 min run
  eq((await submitRun(bad)).status, 400, 'timer exceeds wall time');
  const future = run(40 * 60e3);
  future.body.run.clearedAt = new Date(NOW + 3600e3).toISOString();
  eq((await submitRun(future)).status, 400, 'finishes in the future');
  eq((await leaderboard({ query: {} })).body.total, 0);
});

await test('rate limit per address', async () => {
  let last;
  for (let i = 0; i < 11; i++) last = await submitRun({ ...run(40 * 60e3 - i), ip: 'same' });
  eq(last.status, 429);
});

await test('projected payouts follow the pool and split', async () => {
  await A('setConfig', { config: { poolSol: 10, splits: [50, 30, 20] } });
  await submitRun(run(20 * 60e3, W[0]));
  await submitRun(run(25 * 60e3, W[1]));
  await submitRun(run(30 * 60e3, W[2]));
  await submitRun(run(35 * 60e3, W[3]));
  const lb = await leaderboard({ query: {} });
  eq(lb.body.entries.map((e) => e.payoutSol), [5, 3, 2, 0]);
  const p = await player({ query: { wallet: W[1] } });
  eq(p.body.rank, 2); eq(p.body.inPaidPlaces, true); eq(p.body.projectedSol, 3);
  const p4 = await player({ query: { wallet: W[3] } });
  eq(p4.body.inPaidPlaces, false); eq(p4.body.projectedSol, 0);
  eq(p4.body.cutoffMs, 30 * 60e3, 'time to beat for the last paid place');
});

await test('splits over 100% are refused', async () => {
  eq((await A('setConfig', { config: { splits: [60, 50] } })).status, 400);
});

await test('admin needs the key', async () => {
  eq((await admin({ body: { key: 'nope', action: 'config' } })).status, 401);
  eq((await admin({ body: { action: 'config' } })).status, 401);
});

await test('verify, reject (off the board), resubmit after rejection', async () => {
  await submitRun(run(20 * 60e3, W[0]));
  await submitRun(run(25 * 60e3, W[1]));
  eq((await A('verify', { wallet: W[1] })).body.run.status, 'verified');
  await A('reject', { wallet: W[0], note: 'spliced save' });
  const lb = await leaderboard({ query: {} });
  eq(lb.body.entries.map((e) => [e.rank, e.status]), [[1, 'verified']]);
  const p = await player({ query: { wallet: W[0] } });
  eq(p.body.rank, null); eq(p.body.run.status, 'rejected'); eq(p.body.run.note, 'spliced save');
  const again = await submitRun(run(22 * 60e3, W[0]));
  eq(again.body.status, 'pending'); eq(again.body.rank, 1);
});

await test('a better time needs review again', async () => {
  await submitRun(run(30 * 60e3, W[0]));
  await A('verify', { wallet: W[0] });
  await submitRun(run(28 * 60e3, W[0]));
  eq((await player({ query: { wallet: W[0] } })).body.run.status, 'pending');
});

await test('banned wallets cannot enter', async () => {
  await submitRun(run(20 * 60e3, W[0]));
  await A('ban', { wallet: W[0] });
  eq((await leaderboard({ query: {} })).body.total, 0);
  eq((await submitRun(run(21 * 60e3, W[0]))).status, 403);
  await A('unban', { wallet: W[0] });
  eq((await submitRun(run(21 * 60e3, W[0]))).status, 200);
});

await test('payouts are recorded, totalled and removable', async () => {
  const tx = '5'.repeat(88);
  const a = await A('pay', { wallet: W[0], amountSol: 1.5, tx, rank: 1, note: 'S1 1st' });
  await A('pay', { wallet: W[0], amountSol: 0.25 });
  let p = await player({ query: { wallet: W[0] } });
  eq(p.body.payouts.length, 2); eq(p.body.totalPaidSol, 1.75); eq(p.body.seasonPaidSol, 1.75);
  eq(p.body.payouts[1].tx, tx);
  await A('unpay', { wallet: W[0], id: a.body.payout.id });
  p = await player({ query: { wallet: W[0] } });
  eq(p.body.totalPaidSol, 0.25);
  eq((await A('pay', { wallet: W[0], amountSol: 0 })).status, 400);
  eq((await A('pay', { wallet: W[0], amountSol: 1, tx: 'abc' })).status, 400);
});

await test('closed and ended seasons refuse runs', async () => {
  await A('setConfig', { config: { open: false } });
  eq((await submitRun(run(30 * 60e3))).status, 403);
  await A('setConfig', { config: { open: true, endsAt: new Date(NOW - 3600e3).toISOString() } });
  eq((await submitRun(run(30 * 60e3))).status, 403);
  eq((await leaderboard({ query: {}, now: NOW })).body.open, false);
});

await test('a new season starts an empty board; history stays with the wallet', async () => {
  await submitRun(run(30 * 60e3));
  await A('pay', { wallet: W[0], amountSol: 2 });
  await A('setConfig', { config: { season: 's2', seasonName: 'Season 2' } });
  const lb = await leaderboard({ query: {} });
  eq(lb.body.season, 's2'); eq(lb.body.total, 0);
  const p = await player({ query: { wallet: W[0] } });
  eq(p.body.rank, null); eq(p.body.totalPaidSol, 2); eq(p.body.seasonPaidSol, 0);
});

await test('player lookup wants a real address', async () => {
  eq((await player({ query: { wallet: 'x' } })).status, 400);
});

await test('names are cleaned', async () => {
  await submitRun(run(30 * 60e3, W[0], { name: '<b>evil</b>name!!' }));
  const n = (await leaderboard({ query: {} })).body.entries[0].name;
  ok(/^[A-Z0-9 _.-]{1,10}$/u.test(n), `name ${n}`);
});

console.log(`\n${pass} passed${fails.length ? `, ${fails.length} failed` : ''}`);
process.exit(fails.length ? 1 : 0);
