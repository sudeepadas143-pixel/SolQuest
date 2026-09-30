// Screenshots of the SolQuest feature set (throne arena, wild transition, grass).
//   node tools/feature_shots.mjs [outDir]   (needs a VITE_DEBUG=1 build on :4173)
import { chromium } from 'playwright';
import fs from 'node:fs';

const OUT = process.argv[2] ?? 'tools/_shots';
fs.mkdirSync(OUT, { recursive: true });
const b = await chromium.launch({ executablePath: process.env.CHROME ?? undefined });
const p = await b.newPage({ viewport: { width: 960, height: 640 } });
const errors = [];
p.on('pageerror', (e) => errors.push(e.message));
await p.goto(process.env.URL ?? 'http://localhost:4173/');
await p.waitForFunction(() => window.__game?.scene.isActive('Title'));
await p.evaluate(() => { localStorage.clear(); window.__game.scene.getScene('Title').scene.start('Wallet', { name: 'KAI', gender: 'boy', starter: 'emby' }); });
await p.waitForFunction(() => window.__game.scene.isActive('Wallet'));
await p.keyboard.type('shotwallet123');
await p.keyboard.press('Enter');
await p.waitForFunction(() => window.__game.scene.isActive('Overworld'));
await p.waitForTimeout(1500);
const ow = (fn, arg) => p.evaluate(fn, arg);

// dangerous grass at dusk and at night
for (const [name, ms] of [['grass_day', 360000], ['grass_night', 840000]]) {
  await ow(([ms]) => { const o = window.__game.scene.getScene('Overworld'); o.save.stats.playMs = ms; o.pos = { x: 22, y: 106 }; o.syncPlayer(); o.checkZone(); }, [ms]);
  await p.waitForTimeout(2200);
  await p.screenshot({ path: `${OUT}/${name}.png` });
}
// wild transition, mid-wipe
await ow(() => { const o = window.__game.scene.getScene('Overworld'); o.save.stats.playMs = 360000; o.startWild(); });
for (const t of [450, 350, 350]) { await p.waitForTimeout(t); await p.screenshot({ path: `${OUT}/wild_wipe_${t}_${Date.now() % 1000}.png` }); }
await p.waitForFunction(() => window.__game.scene.isActive('Battle'));
await p.waitForTimeout(2600);
await p.screenshot({ path: `${OUT}/wild_battle.png` });
await ow(() => { const g = window.__game; g.scene.stop('Battle'); const o = g.scene.getScene('Overworld'); o.scene.resume(); o.scene.wake('OverworldUI'); o.scene.wake('Atmosphere'); o.locked = false; o.cameras.main.setZoom(2); });
await p.waitForTimeout(500);
// throne arena
await ow(() => { const o = window.__game.scene.getScene('Overworld'); o.startBattle({ kind: 'trainer', trainerId: 'cooker' }); });
await p.waitForFunction(() => window.__game.scene.isActive('Battle'));
await p.waitForTimeout(5200);
for (let i = 0; i < 8; i++) { await p.keyboard.press('Enter'); await p.waitForTimeout(700); }
await p.waitForTimeout(1500);
await p.screenshot({ path: `${OUT}/throne_arena.png` });
console.log(errors.length ? `ERRORS:\n${errors.join('\n')}` : 'no page errors');
await b.close();
