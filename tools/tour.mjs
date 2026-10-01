// Visual tour: screenshots of areas at different times of day / weather.
//   node tools/tour.mjs [outDir]   (needs `npx vite preview --port 4173` running)
import { chromium } from 'playwright';
import fs from 'node:fs';

const OUT = process.argv[2] ?? 'tools/_tour';
fs.mkdirSync(OUT, { recursive: true });
const b = await chromium.launch({ executablePath: process.env.CHROME ?? undefined });
const p = await b.newPage({ viewport: { width: 960, height: 640 } });
const errors = [];
p.on('pageerror', (e) => errors.push(e.message));
p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await p.goto(process.env.URL ?? 'http://localhost:4173/');
await p.waitForFunction(() => window.__game?.scene.isActive('Title'));
await p.waitForTimeout(1500);
await p.screenshot({ path: `${OUT}/00_title.png` });
await p.evaluate(() => { localStorage.clear(); window.__game.scene.getScene('Title').scene.start('Wallet', { name: 'KAI', gender: 'girl', starter: 'emby' }); });
await p.waitForFunction(() => window.__game.scene.isActive('Wallet'));
await p.waitForTimeout(700);
await p.screenshot({ path: `${OUT}/01_wallet.png` });
await p.keyboard.type('So11111111111111111111111111111111111111112');
await p.keyboard.press('Enter');
await p.waitForFunction(() => window.__game.scene.isActive('Overworld'));
await p.waitForTimeout(1500);

const shots = [
  ['02_town_noon', 22, 121, 300000],
  ['03_market_row', 50, 121, 330000],
  ['04_market_square', 53, 111, 360000],
  ['05_pond', 56, 93, 390000],
  ['06_orchard', 54, 38, 420000],
  ['07_hall_plaza', 22, 15, 450000],
  ['08_town_dusk', 22, 121, 630000],
  ['09_town_night', 22, 121, 840000],
  ['10_market_night', 53, 116, 870000],
  ['11_route_rain', 22, 106, 3150000],
  ['12_route_storm', 30, 118, 3330000],
];
for (const [name, x, y, ms] of shots) {
  await p.evaluate(([x, y, ms]) => {
    const o = window.__game.scene.getScene('Overworld');
    o.save.stats.playMs = ms;
    o.pos = { x, y };
    o.syncPlayer();
    o.checkZone();
  }, [x, y, ms]);
  await p.waitForTimeout(1600);
  await p.screenshot({ path: `${OUT}/${name}.png` });
}
// night wild battle
await p.evaluate(() => { const o = window.__game.scene.getScene('Overworld'); o.save.stats.playMs = 840000; o.startWild(); });
await p.waitForFunction(() => window.__game.scene.isActive('Battle'));
await p.waitForTimeout(3200);
await p.screenshot({ path: `${OUT}/13_battle_night.png` });
for (let i = 0; i < 6; i++) { await p.keyboard.press('Enter'); await p.waitForTimeout(250); }
await p.waitForTimeout(600);
await p.screenshot({ path: `${OUT}/14_battle_commands.png` });
await p.keyboard.press('Enter');
await p.waitForTimeout(500);
await p.screenshot({ path: `${OUT}/15_battle_moves.png` });
console.log(errors.length ? `ERRORS:\n${errors.join('\n')}` : 'no page errors');
await b.close();
