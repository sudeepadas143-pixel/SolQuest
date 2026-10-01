// Mouse only: title -> intro (Professor Mia) -> name -> look -> starter ->
// wallet -> overworld, then click-to-walk and click-to-use. No keyboard
// except typing the name and the wallet address. Screenshots to OUT.
//   node tools/mouse_check.mjs [outDir]    (dev server on :5173, or URL=...)
import { chromium } from 'playwright';
import fs from 'node:fs';

const OUT = process.argv[2] ?? 'tools/_mouse';
fs.mkdirSync(OUT, { recursive: true });
const b = await chromium.launch({ executablePath: process.env.CHROME ?? undefined, args: ['--autoplay-policy=no-user-gesture-required'] });
const p = await b.newPage({ viewport: { width: 960, height: 640 } });
const errors = [];
p.on('pageerror', (e) => errors.push(e.message));
const sleep = (ms) => p.waitForTimeout(ms);
const active = (k) => p.evaluate((k) => window.__game.scene.isActive(k), k);
const until = async (k, click = null, ms = 30000) => {
  const t0 = Date.now();
  while (!(await active(k))) {
    if (Date.now() - t0 > ms) throw new Error(`timed out waiting for ${k}`);
    if (click) await p.mouse.click(...click);
    await sleep(350);
  }
};
const shot = (n) => p.screenshot({ path: `${OUT}/${n}.png` });
// a game point (960x640 canvas coords) -> page point
const at = async (x, y) => p.evaluate(([x, y]) => {
  const r = window.__game.canvas.getBoundingClientRect();
  return [r.left + (x * r.width) / 960, r.top + (y * r.height) / 640];
}, [x, y]);

await p.goto(process.env.URL ?? 'http://127.0.0.1:5173/');
await p.evaluate(() => localStorage.clear());
await p.reload();
await p.waitForFunction(() => window.__game?.scene.isActive('Title'));
await sleep(1200);
await shot('01_title');
await p.mouse.click(...(await at(480, 400)));                // start
await sleep(700);
await shot('02_menu');
await p.mouse.click(...(await at(480, 360)));                // NEW GAME (first of NEW GAME / LEADERBOARD / EARNINGS / COMMUNITY / SETTINGS)
await until('Intro', await at(480, 360));
await sleep(1500);
await shot('03_intro_mia');
// click through until the name box appears
for (let i = 0; i < 40 && !(await p.$('input.er-input')); i++) { await p.mouse.click(...(await at(300, 300))); await sleep(400); }
await shot('04_name');
await p.fill('input.er-input', 'Kai');
await p.mouse.click(...(await at(370, 350)));                // OK
await sleep(600);
await until('Look', await at(300, 300));
await sleep(900);
await shot('05_look');
await p.mouse.move(...(await at(650, 300)));                 // hover the girl card
await sleep(400);
await p.mouse.click(...(await at(310, 300)));                // pick the boy
await sleep(900);
await shot('06_look_confirm');
// the first option (YES) of the open yes/no menu: its zone, wherever it is nested
const yes = async () => p.evaluate(() => {
  for (const k of ['Look', 'Starter']) {
    if (!window.__game.scene.isActive(k)) continue;
    const zones = [];
    const walk = (list) => list.forEach((o) => { if (o.list) walk(o.list); else if (o.type === 'Zone' && o.input?.enabled) zones.push(o); });
    walk(window.__game.scene.getScene(k).children.list);
    if (zones.length) { const z = zones[0]; return [z.x + z.width / 2, z.y + z.height / 2]; }
  }
  return null;
});
let pt = await yes();
if (pt) await p.mouse.click(...(await at(...pt)));
await until('Starter', null, 15000);
await sleep(1000);
await p.mouse.click(...(await at(480, 230)));                // middle starter
await sleep(800);
pt = await yes();
if (pt) await p.mouse.click(...(await at(...pt)));
await until('Wallet', await at(480, 520), 20000);
await sleep(700);
await shot('07_wallet');
await p.mouse.click(...(await at(480, 588)));                // CONFIRM with nothing typed -> required
await sleep(500);
await shot('08_wallet_required');
await p.fill('input.er-input', '4Nd1mBQtrMJVYVfKf2PJy9NZUZdTAsp7D4xWLs4gDB4T');
await p.mouse.click(...(await at(480, 588)));
await until('Overworld', null, 15000);
await sleep(1800);
await shot('09_overworld');
// click a few tiles ahead (up the road) and wait for the walk
const pos = () => p.evaluate(() => { const o = window.__game.scene.getScene('Overworld'); return { ...o.pos, path: !!o.path, locked: o.locked }; });
const before = await pos();
await p.mouse.click(...(await at(480, 180)));
for (let i = 0; i < 30 && (await pos()).path; i++) await sleep(200);
await sleep(300);
const after = await pos();
await shot('10_click_walk');
console.log('click-walk', JSON.stringify(before), '->', JSON.stringify(after));
// open the menu with the HUD button
await p.mouse.click(...(await at(72, 605)));
await sleep(600);
await shot('11_menu_button');
const menuOpen = await p.evaluate(() => window.__game.scene.getScene('Overworld').locked);
console.log('menu opened by button:', menuOpen);
console.log(errors.length ? `page errors: ${errors.join(' | ')}` : 'no page errors');
await b.close();
