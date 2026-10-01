// The final walk up the Elite Hall, step by step, with screenshots; then the
// "not ready" path (Cooker's warning -> NOT YET -> thrown out, Hall reset).
//   node tools/hall_walk.mjs [outDir]   (needs a VITE_DEBUG=1 build on :4173)
import { chromium } from 'playwright';
import fs from 'node:fs';

const OUT = process.argv[2] ?? 'tools/_hall';
fs.mkdirSync(OUT, { recursive: true });
const b = await chromium.launch({ executablePath: process.env.CHROME ?? undefined });
const p = await b.newPage({ viewport: { width: 960, height: 640 } });
const errors = [];
p.on('pageerror', (e) => errors.push(e.message));
const sleep = (ms) => p.waitForTimeout(ms);
const ow = (fn, arg) => p.evaluate(fn, arg);
const shot = (n) => p.screenshot({ path: `${OUT}/${n}.png` });
const state = () => ow(() => { const o = window.__game.scene.getScene('Overworld'); return { y: o.pos.y, locked: o.locked, moving: o.moving, met: !!o.cookerMet, indoors: o.indoors, stage: o.hallStage, light: +o.hallLight.toFixed(2), battle: window.__game.scene.isActive('Battle') }; });

await p.goto(process.env.URL ?? 'http://localhost:4173/');
await p.waitForFunction(() => window.__game?.scene.isActive('Title'));
await ow(() => { localStorage.clear(); window.__game.scene.getScene('Title').scene.start('Wallet', { name: 'KAI', gender: 'boy', starter: 'sharkpup' }); });
await p.waitForFunction(() => window.__game.scene.isActive('Wallet'));
await p.keyboard.type('hallwalk123');
await p.keyboard.press('Enter');
await p.waitForFunction(() => window.__game.scene.isActive('Overworld'));
await sleep(1200);

async function setup(species, level) {
  await ow(([species, level]) => {
    const o = window.__game.scene.getScene('Overworld');
    for (const id of ['t1', 't2', 't3', 't4']) o.save.defeated[id] = true;
    const c = o.save.party[0];
    c.species = species; c.level = level; c.xp = level ** 3; c.hp = 999;
    o.pos = { x: 22, y: 13 }; o.face('up'); o.syncPlayer();
  }, [species, level]);
  await sleep(400);
  await p.keyboard.down('ArrowUp'); await sleep(200); await p.keyboard.up('ArrowUp');
  await p.waitForFunction(() => window.__game.scene.getScene('Overworld').indoors === true, null, { timeout: 8000 });
}
async function clear() { for (let i = 0; i < 12 && (await state()).locked; i++) { await p.keyboard.press('Enter'); await sleep(350); } }
async function step() {
  await p.keyboard.down('ArrowUp'); await sleep(120); await p.keyboard.up('ArrowUp');
  await p.waitForFunction(() => !window.__game.scene.getScene('Overworld').moving, null, { timeout: 4000 });
  await sleep(120);
}

// ---- 1: under-levelled Sharkjaw -> warned, NOT YET ----
await setup('sharkjaw', 19);
await sleep(1600);
await shot('01_doors_slam');
await clear();
await shot('02_dark_hall');
const seen = [];
for (let i = 0; i < 26; i++) {
  const st = await state();
  if (st.met) break;
  if (st.locked) { await sleep(700); await shot(`03_voice_y${st.y}`); await clear(); continue; }
  await step();
  const s2 = await state();
  seen.push(`${s2.y}:${s2.stage}/${s2.light}${s2.locked ? 'L' : ''}`);
  if ([22, 17, 12].includes(s2.y)) { await sleep(700); await shot(`04_ignite_y${s2.y}`); }
  if ([18, 16, 15, 14].includes(s2.y)) await shot(`04b_stairs_y${s2.y}`);
}
console.log('walk', seen.join(' '));
// the gate opens and Cooker walks out
await sleep(1900); await shot('05a_gate');
await sleep(1300); await shot('05b_gate_open');
await sleep(1200); await shot('05c_cooker_out');
await sleep(1500);
await shot('05_reveal');
await p.waitForFunction(() => window.__game.scene.getScene('OverworldUI').box.container.visible, null, { timeout: 15000 });
await sleep(1500);
await shot('06_cooker_talk');
// through intro + warning to the question
const texts = [];
for (let i = 0; i < 14; i++) {
  const t = await ow(() => window.__game.scene.getScene('OverworldUI').box.text?.text ?? '');
  texts.push(t);
  if (/still want this/.test(t)) break;
  await p.keyboard.press('Enter'); await sleep(600);
}
console.log('dialogue:\n  ' + texts.filter(Boolean).join('\n  '));
await sleep(500);
await shot('07_ask');
await p.keyboard.press('ArrowDown'); await sleep(200); await p.keyboard.press('Enter'); await sleep(800);
await shot('08_not_yet');
await clear();
await sleep(1200);
console.log('after NOT YET', JSON.stringify(await state()));

// ---- 2: ready (Sharkrex Lv 24): straight to battle, no voice lines this time ----
await setup('sharkrex', 24);
await sleep(1200); await clear();
for (let i = 0; i < 26 && !(await state()).met; i++) { if ((await state()).locked) await clear(); else await step(); }
for (let i = 0; i < 30 && !(await state()).battle; i++) { await p.keyboard.press('Enter'); await sleep(400); }
console.log('battle started:', (await state()).battle);
await sleep(2500);
await shot('09_battle');
// ---- 3: under-levelled, BATTLE anyway, lose -> Cooker coaches you ----
await ow(() => { const g = window.__game; g.scene.stop('Battle'); const o = g.scene.getScene('Overworld'); o.scene.resume(); o.scene.wake('OverworldUI'); o.scene.wake('Atmosphere'); o.locked = false; o.pendingBattle = null; o.cookerMet = false; o.placeTrainer('cooker', { x: 84, y: 6 }); o.hallReset(); o.cameras.main.startFollow(o.player, true, 1, 1, 0, 12); });
await sleep(500);
await ow(() => { const o = window.__game.scene.getScene('Overworld'); o.pos = { x: 84, y: 12 }; o.syncPlayer(); const c = o.save.party[0]; c.species = 'sharkpup'; c.level = 12; c.xp = 12 ** 3; c.hp = 30; c.moves = [{ id: 'bump', pp: 30 }]; });
await p.keyboard.down('ArrowUp'); await sleep(150); await p.keyboard.up('ArrowUp');
let coach = '';
for (let i = 0; i < 400; i++) {
  const t = await ow(() => { const g = window.__game; const b = g.scene.getScene('Battle'); return g.scene.isActive('Battle') ? (b.dialog?.text?.text ?? '') : (g.scene.getScene('OverworldUI').box?.text?.text ?? ''); });
  if (/free tip/i.test(t) && /Final form/.test(t)) { coach = t; await sleep(900); await shot('10_coach_after_loss'); break; }
  await p.keyboard.press('Enter'); await sleep(160);
}
console.log('coach line:', coach || '(not seen)');
console.log(errors.length ? `ERRORS:\n${errors.join('\n')}` : 'no page errors');
await b.close();
