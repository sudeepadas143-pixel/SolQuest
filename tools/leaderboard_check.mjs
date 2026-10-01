// Main menu (Community, Leaderboard, Earnings) against the local API.
// Seeds a board through /api, clears a run in this browser, then checks the
// screens and the Earnings lookups. Screenshots to OUT.
//   node tools/leaderboard_check.mjs [outDir]   (needs a VITE_DEBUG=1 build: vite preview on :4173 or URL=...)
import { chromium } from 'playwright';
import fs from 'node:fs';

const OUT = process.argv[2] ?? 'tools/_board';
fs.mkdirSync(OUT, { recursive: true });
const b = await chromium.launch({ executablePath: process.env.CHROME ?? undefined });
const p = await b.newPage({ viewport: { width: 960, height: 640 } });
const errors = [];
const fails = [];
p.on('pageerror', (e) => errors.push(e.message));
const sleep = (ms) => p.waitForTimeout(ms);
const ow = (fn, arg) => p.evaluate(fn, arg);
const shot = (n) => p.screenshot({ path: `${OUT}/${n}.png` });
const check = (ok, msg) => { console.log(`${ok ? '  ok ' : 'FAIL '} ${msg}`); if (!ok) fails.push(msg); };
const at = async (x, y) => ow(([x, y]) => { const r = window.__game.canvas.getBoundingClientRect(); return [r.left + (x * r.width) / 960, r.top + (y * r.height) / 640]; }, [x, y]);
const api = (path, body) => ow(async ([path, body]) => {
  const r = await fetch(`/api/${path}`, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {});
  return { status: r.status, body: await r.json() };
}, [path, body]);
const sceneTexts = (key) => ow((key) => window.__game.scene.getScene(key).children.list
  .flatMap((o) => (o.list ? o.list : [o])).filter((o) => o.type === 'Text' && o.visible).map((o) => o.text.replace(/\u200c/g, '')).join(' | '), key);

const ME = '5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1';
const OTHERS = ['7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU', '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM', 'DRpbCBMxVnDK7maPM5tGv6MvB3v1sRMC86PZ8okm21hy', 'HN7cABqLq46Es1jh92dQQisAq662SmxELLLsHHe4YWrH'];
const NAMES = ['NOVA', 'RIKU', 'MAPLE', 'JUNO'];

await p.goto(process.env.URL ?? 'http://localhost:4173/');
await p.waitForFunction(() => window.__game?.scene.isActive('Title'));
await ow(() => localStorage.clear());

// ---- seed the board: four other trainers, a 10 SOL pool split over the top 3
const cfg = await api('admin', { key: 'local-admin', action: 'setConfig', config: { season: `t${Date.now().toString(36)}`, seasonName: 'Season 1', poolSol: 10, splits: [50, 30, 20] } });
check(cfg.status === 200, 'admin sets the season and pool');
const now = Date.now();
for (const [i, w] of OTHERS.entries()) {
  const ms = (24 + i * 7) * 60e3;
  const r = await api('runs', { wallet: w, name: NAMES[i], starter: ['sharkpup', 'emby', 'fernie', 'sharkpup'][i], run: { clearMs: ms, startedAt: new Date(now - ms - 120e3).toISOString(), clearedAt: new Date(now - 60e3).toISOString() } });
  check(r.status === 200, `seeded ${NAMES[i]} (#${r.body.rank})`);
}
await api('admin', { key: 'local-admin', action: 'verify', wallet: OTHERS[0] });

// ---- a cleared run of our own in this browser (27:30 - 2nd place)
await ow((w) => window.__game.scene.getScene('Title').scene.start('Wallet', { name: 'KAI', gender: 'boy', starter: 'sharkpup' }), ME);
await p.waitForFunction(() => window.__game.scene.isActive('Wallet'));
await p.keyboard.type(ME);
await p.keyboard.press('Enter');
await p.waitForFunction(() => window.__game.scene.isActive('Overworld'));
await sleep(800);
await ow(() => {
  const o = window.__game.scene.getScene('Overworld');
  const s = o.save;
  const ms = 27.5 * 60e3;
  s.run.ms = ms; s.run.clearMs = ms; s.run.startedAt = new Date(Date.now() - ms - 300e3).toISOString(); s.run.clearedAt = new Date().toISOString();
  s.defeated.cooker = true;
  localStorage.setItem('eliteRoute.save.v1', JSON.stringify(s));
  window.__game.scene.getScene('Overworld').scene.start('Title');
});
await p.waitForFunction(() => window.__game.scene.isActive('Title'));
await sleep(1500);
await p.mouse.click(...(await at(480, 400)));
await sleep(800);
await shot('01_menu');
const labels = await ow(() => window.__game.scene.getScene('Title').children.list.filter((o) => o.list).flatMap((c) => c.list).filter((o) => o.type === 'Text').map((o) => o.text));
for (const want of ['CONTINUE', 'NEW GAME', 'LEADERBOARD', 'EARNINGS', 'COMMUNITY', 'SETTINGS']) check(labels.includes(want), `menu has ${want}`);
const strip = await sceneTexts('Title');
check(/X {2}(FOLLOW|SOON)/.test(strip) && /CA/.test(strip), 'title shows the X / CA strip');

// menu rows: 6 items, 44 px each, menu at y = 640 - 64 - (40 + 6*44)
const rowY = (i) => 640 - 64 - (40 + 6 * 44) + 20 + 22 + i * 44;
// ---- community
await p.mouse.click(...(await at(480, rowY(4))));
await sleep(600);
await shot('02_community');
check((await sceneTexts('Title')).includes('COMMUNITY'), 'community panel opens');
await p.keyboard.press('Escape');
await sleep(500);

// ---- leaderboard
await p.mouse.click(...(await at(480, rowY(2))));
await p.waitForFunction(() => window.__game.scene.isActive('Leaderboard'));
await p.waitForFunction(() => !window.__game.scene.getScene('Leaderboard').msg.visible || /No clears|offline/.test(window.__game.scene.getScene('Leaderboard').msg.text), null, { timeout: 10000 });
await sleep(400);
await shot('03_leaderboard');
const lb = await sceneTexts('Leaderboard');
check(/NOVA/.test(lb) && /KAI/.test(lb), 'board lists the seeded trainers and our run');
check(/5 SOL/.test(lb) && /3 SOL/.test(lb) && /2 SOL/.test(lb), 'paid places show their share');
check(/VERIFIED/.test(lb) && /PENDING/.test(lb), 'statuses shown');
const mine = await ow(() => JSON.parse(localStorage.getItem('eliteRoute.save.v1')).run.submitted);
check(mine?.rank === 2, `our clear was submitted on opening the board (rank ${mine?.rank})`);
await p.keyboard.press('Escape');
await p.waitForFunction(() => !window.__game.scene.isActive('Leaderboard'));
await sleep(500);

// ---- earnings: verified + a recorded payout
await api('admin', { key: 'local-admin', action: 'verify', wallet: ME });
await api('admin', { key: 'local-admin', action: 'pay', wallet: ME, amountSol: 1.25, rank: 2, tx: '4'.repeat(88), note: 'test' });
await p.mouse.click(...(await at(480, rowY(3))));
await p.waitForFunction(() => window.__game.scene.isActive('Earnings'));
await sleep(2000);
await shot('04_earnings');
const er = await sceneTexts('Earnings');
check(/#2/.test(er), 'earnings: rank #2');
check(/27:30/.test(er), 'earnings: best time');
check(/3 SOL/.test(er), 'earnings: this season 3 SOL (2nd of 10 SOL at 30%)');
check(/1\.25 SOL/.test(er), 'earnings: total earned and the payout row');
check(/Verified/.test(er), 'earnings: verified message');

// ---- check another wallet (outside the paid places)
const other = await ow(() => { const s = window.__game.scene.getScene('Earnings'); return [s.other.x, s.other.y]; });
await p.mouse.click(...(await at(...other)));
await sleep(400);
await p.fill('input.er-input', OTHERS[3]);
await p.keyboard.press('Enter');
await sleep(1800);
await shot('05_earnings_other');
const er2 = await sceneTexts('Earnings');
check(/#5/.test(er2) && /Beat/.test(er2), 'another wallet: rank #5 and the time to beat');
await p.keyboard.press('Escape');
await sleep(600);
check(await ow(() => window.__game.scene.isActive('Title') && !window.__game.scene.isActive('Earnings')), 'back to the title');

console.log(errors.length ? `page errors:\n${errors.join('\n')}` : 'no page errors');
await b.close();
process.exit(fails.length || errors.length ? 1 : 0);
