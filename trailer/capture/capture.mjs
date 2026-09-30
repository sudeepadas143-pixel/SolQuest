// Capture the trailer's "plates": real SolQuest frames, rendered by the game's
// own scenes at native 960x640, one PNG per game frame.
//
//   1. in the project root:  npx vite --port 5173      (dev build: the page can
//      import the same live game modules the scenes use)
//   2. node capture/capture.mjs [plateName ...]
//
// Nothing in the game is modified: states are staged the way the game's own test
// scripts do (starting scenes with data, editing the save), plus a few runtime
// hooks (see lib.mjs) that hide dialog text and script battle outcomes.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { installHarness, stepState, Plate } from './lib.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const OUT = path.join(ROOT, 'plates');
const GAME = process.env.GAME_URL ?? 'http://127.0.0.1:5173/';
const CHROME = process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const F30 = 1000 / 30;
const F120 = 1000 / 120;

fs.mkdirSync(OUT, { recursive: true });
const manifestPath = path.join(OUT, 'manifest.json');
const manifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : { size: [960, 640], plates: {} };

const browser = await chromium.launch({ executablePath: CHROME });
const page = await browser.newPage({ viewport: { width: 960, height: 640 }, deviceScaleFactor: 1 });
page.on('pageerror', (e) => console.log('PAGEERR', e.message));
await page.goto(GAME);
await page.waitForFunction(() => window.__game?.scene.isActive('Title') && window.__audio, null, { timeout: 60000 });
await installHarness(page);

const ev = (fn, arg) => page.evaluate(fn, arg);
const key = (k) => page.keyboard.press(k);
let state = null;

/** Step one frame (optionally into a plate), return the settled state. */
async function frame(plate, ms = F30) {
  state = await stepState(page, ms);
  if (plate) await plate.shoot(page, state.gt);
  return state;
}
async function frames(n, plate, ms = F30, each = null) {
  for (let i = 0; i < n; i++) {
    if (each) await each(i);
    await frame(plate, ms);
  }
}
async function until(cond, { max = 900, plate = null, ms = F30, each = null } = {}) {
  for (let i = 0; i < max; i++) {
    if (await ev(cond)) return true;
    if (each) await each(i);
    await frame(plate, ms);
  }
  throw new Error(`until() timed out: ${cond}`);
}
function save(plate, extra = {}) {
  const events = extra.events ?? [];
  manifest.plates[plate.name] = { frames: plate.frames, events, ...extra, events };
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 1));
  console.log(`  plate ${plate.name}: ${plate.frames.length} frames`);
}
async function eventsSince(gt0) {
  const all = await ev(() => window.__cap.events);
  return all.filter((e) => e.gt >= gt0).map((e) => ({ ...e, gt: +(e.gt - gt0).toFixed(3) }));
}

/** Battle autopilot: menus held for a beat, dialog text skipped (it's hidden). */
function pilot(opts) {
  const o = { cmdHold: 10, moveHold: 12, confHold: [36, 18], moveKeys: [], textEvery: 2, ...opts };
  let wait = 0;
  let last = null;
  let conf = 0;
  let n = 0;
  return async () => {
    const m = state?.menu ?? null;
    const tag = `${m}:${state?.menuSeq}`;
    if (tag !== last) { wait = 0; last = tag; } else wait++;
    n++;
    if (m === 'cmd' && wait >= o.cmdHold) { await key('Enter'); wait = -999; }
    else if (m === 'move' && wait >= o.moveHold) {
      for (const k of o.moveKeys.shift() ?? []) await key(k);
      await key('Enter');
      o.onMove?.();
      wait = -999;
    } else if (m === 'confirm' && wait >= o.confHold[conf % 2]) { await key('Enter'); conf++; wait = -999; }
    else if (!m && o.text !== false && n % o.textEvery === 0) await key('Enter');
  };
}

const want = new Set(process.argv.slice(2));
const on = (name) => !want.size || want.has(name);

// ---------------------------------------------------------------- name entry
console.log('name entry');
await ev(() => window.__game.scene.getScene('Title').scene.start('Intro'));
await until(() => !!document.querySelector('input.er-input'), { max: 2000, each: async (i) => { if (i % 2 === 0) await key('Enter'); } });
await frames(8);
if (on('name_entry')) {
  const p = new Plate(OUT, 'name_entry');
  await frames(44, p, F30, async (i) => {
    const typed = { 8: 'K', 14: 'A', 20: 'I' }[i];
    if (typed) await page.keyboard.type(typed);
  });
  save(p);
}

// ----------------------------------------------------------- starter choice
console.log('starter');
await ev(() => { const g = window.__game; g.scene.getScene('Intro').scene.start('Starter', { name: 'KAI', gender: 'boy' }); });
await frames(3);
{
  // the description box is hidden in the plate; make it inert so it never
  // swallows the cursor / confirm presses while it would be typing
  await ev(() => { window.__cap.hide.starterText = true; window.__game.scene.getScene('Starter').box.say = () => Promise.resolve(); });
  const p = on('starter_pick') ? new Plate(OUT, 'starter_pick') : null;
  const gt0 = state.gt;
  // browse right, right, then back left to Emby and choose it
  const plan = { 24: 'ArrowRight', 36: 'ArrowRight', 48: 'ArrowLeft', 60: 'ArrowLeft', 72: 'Enter', 84: 'Enter' };
  await frames(112, p, F30, async (i) => { if (plan[i]) await key(plan[i]); });
  if (p) save(p, { events: await eventsSince(gt0), notes: 'cursor 24/36/48/60, confirm 72, YES 84 -> flash + levelup, fade to profile' });
  await ev(() => { window.__cap.hide.starterText = false; });
}
await until(() => window.__game.scene.isActive('Wallet'), { max: 400, each: async (i) => { if (i % 3 === 0) await key('Enter'); } });

// ------------------------------------------------------------ wallet paste
console.log('wallet');
await frames(4);
{
  // a random, well-formed base58 string: not anyone's wallet, not a contract
  const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  let s = 0x5eed;
  const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  const addr = Array.from({ length: 44 }, () => B58[Math.floor(rnd() * 58)]).join('');
  const p = on('wallet_paste') ? new Plate(OUT, 'wallet_paste') : null;
  await frames(54, p, F30, async (i) => {
    if (i === 14) {
      await ev((a) => {
        const el = document.querySelector('input.er-input');
        el.focus();
        el.value = a;
        el.dispatchEvent(new Event('input', { bubbles: true }));
      }, addr);
    }
    if (i === 36) await key('Enter');
  });
  if (p) save(p, { notes: 'paste at 14, submit at 36 (fade to overworld)' });
}
await until(() => window.__game.scene.isActive('Overworld') && window.__game.scene.getScene('Overworld').save, { max: 300 });
await frames(20);
await until(() => window.__game.scene.getScene('Overworld').locked === false, { max: 600, each: async (i) => { if (i % 2 === 0) await key('Enter'); } });

// ----------------------------------------------------------- overworld setup
console.log('overworld setup');
await ev(async () => {
  const g = window.__game;
  const o = g.scene.getScene('Overworld');
  const s = o.save;
  const { TRAINER_SPOTS } = await import('/src/data/map.js');
  const slotB = Object.entries(s.teams).find(([, t]) => t.design === 'B')[0];
  window.__slotB = slotB;
  for (const id of ['t1', 't2', 't3']) s.defeated[id] = true;
  for (const id of ['t1', 't2', 't3', 't4']) o.placeTrainer(id, TRAINER_SPOTS[id]);
  // only our own sprites on screen: every Elite's overworld sprite stays hidden
  window.__cap.hideTrainers = ['t1', 't2', 't3', 't4', 'cooker'];
  window.__cap.hide.hud = true;
  // no random grass encounters while staging walks; the game's own startWild()
  // is called explicitly when a plate wants one
  o.__startWild = o.startWild;
  o.startWild = () => {};
});

async function place(x, y, facing, playMs) {
  await ev(([x, y, facing, playMs]) => {
    const o = window.__game.scene.getScene('Overworld');
    o.save.stats.playMs = playMs;
    o.pos = { x, y };
    o.face(facing);
    o.syncPlayer();
    o.checkZone();
    o.cameras.main.setZoom(2);
  }, [x, y, facing, playMs]);
  await frames(12);   // settle camera, atmosphere and grass
}

// town: walk east along the main street
if (on('town')) {
  console.log('town');
  await place(10, 121, 'right', 89000);
  const p = new Plate(OUT, 'town');
  await page.keyboard.down('ArrowRight');
  await frames(54, p);
  await page.keyboard.up('ArrowRight');
  await frames(6);
  save(p, { notes: 'walking east through the start town, 9:30am' });
}

// road: run north up the route
if (on('road')) {
  console.log('road');
  await place(22, 98, 'up', 119000);
  const p = new Plate(OUT, 'road');
  await page.keyboard.down('ShiftLeft');
  await page.keyboard.down('ArrowUp');
  await frames(50, p);
  await page.keyboard.up('ArrowUp');
  await page.keyboard.up('ShiftLeft');
  await frames(6);
  save(p, { notes: 'running north up Route 1, 10am' });
}

// tall grass at dusk: slow walk into a big patch, eyes blinking in the grass
if (on('grass_dusk')) {
  console.log('grass dusk');
  await place(31, 114, 'up', 5010000);
  const p = new Plate(OUT, 'grass_dusk');
  await frames(90, p, F30, async (i) => {
    if (i === 8) await page.keyboard.down('ArrowUp');
    if (i === 13) await page.keyboard.up('ArrowUp');
    // the game's own lurk(): grass rustles and, after dark, eyes blink in it
    if (i % 3 === 0) await ev(() => window.__game.scene.getScene('Overworld').lurk());
  });
  save(p, { notes: 'clear dusk 19:30 (day 4), one step into the grass at frame 8, lurk() every 3 frames' });
}

// ------------------------------------------------ encounter + wild battle
console.log('encounter');
await ev(async () => {
  const o = window.__game.scene.getScene('Overworld');
  const { createCreature, xpForLevel, xpReward } = await import('/src/systems/creature.js');
  const { looseRng } = await import('/src/systems/rng.js');
  // our partner mid-journey: Embrute, one level short of its final form
  const me = createCreature('embrute', 21, looseRng, { ivFloor: 20 });
  me.moves = ['blazerush', 'flamefang', 'snapbite', 'hammerfist'].map((id) => ({ id, pp: 15 }));
  const foe = createCreature('mantek', 16, looseRng);
  foe.moves = [{ id: 'twinscythe', pp: 10 }];
  const gain = xpReward(foe);
  me.xp = Math.max(xpForLevel(21), xpForLevel(22) - Math.max(1, Math.floor(gain / 2)));
  o.save.party[0] = me;
  window.__wildFoe = foe;
  window.__cap.dmgQueue = [{ to: 0.34 }, { to: 0.58 }, { to: 'ko' }];
  const { MOVES } = await import('/src/data/moves.js');
  MOVES.flamefang.acc = 100;          // no misses in the staged fight
});
await place(34, 110, 'up', 119000);
if (on('encounter') || on('battle_wild') || on('evolution')) {
  const p = new Plate(OUT, 'encounter');
  const gt0 = state.gt;
  await page.keyboard.down('ArrowUp');
  await frames(5, p);
  await page.keyboard.up('ArrowUp');
  await frames(4, p);
  await ev(() => {
    const o = window.__game.scene.getScene('Overworld');
    const orig = o.startBattle;
    o.startBattle = function forced(cfg) { o.startBattle = orig; return orig.call(this, { ...cfg, foes: [window.__wildFoe] }); };
    o.__startWild();
  });
  await ev(() => { window.__cap.hide.battleText = true; });
  const auto = pilot({ text: true });
  await until(() => window.__cap.menu === 'cmd', { max: 400, plate: p, each: auto });
  await frames(6, p);
  save(p, { events: await eventsSince(gt0), notes: 'step into grass, burst + zoom, pinwheel wipe, curtain, wild MANTEK, our EMBRUTE pops in' });

  // the fight: FIGHT -> FLAME FANG (4x), foe hits back, FIGHT -> BLAZE RUSH KO,
  // EXP bar, level up flash + LEVEL UP! panel, then the evolution scene
  const b = new Plate(OUT, 'battle_wild');
  const gb = state.gt;
  const auto2 = pilot({ moveKeys: [['ArrowRight'], ['ArrowLeft']] });
  await until(() => window.__game.scene.isActive('Evolution'), { max: 1500, plate: b, each: auto2 });
  save(b, { events: await eventsSince(gb), notes: 'turn1 flamefang->foe 34%, foe twinscythe->us 58%, turn2 blazerush KO, xp, levelup 22, stat panel' });

  await ev(() => { window.__cap.hide.evoText = true; });
  const e = new Plate(OUT, 'evolution');
  const ge = state.gt;
  const auto3 = pilot({ textEvery: 3 });
  await until(() => !window.__game.scene.isActive('Evolution'), { max: 900, plate: e, each: auto3 });
  save(e, { events: await eventsSince(ge), notes: 'EMBRUTE evolving into EMBERFOX (the fox, final form)' });
}
// finish the battle and the win messages on the map
await until(() => window.__game.scene.isActive('Overworld') && !window.__game.scene.isActive('Battle') && window.__game.scene.getScene('Overworld').locked === false,
  { max: 1200, each: async (i) => { if (i % 2 === 0) await key('Enter'); } });
await frames(10);

// ---------------------------------------------------------------- Ansem
console.log('ansem');
await ev(async () => {
  const o = window.__game.scene.getScene('Overworld');
  const s = o.save;
  const { createCreature } = await import('/src/systems/creature.js');
  const { looseRng } = await import('/src/systems/rng.js');
  const { MOVES } = await import('/src/data/moves.js');
  MOVES.infernoroar.acc = 100;
  const me = createCreature('emberfox', 24, looseRng, { ivFloor: 24 });
  me.moves = ['infernoroar', 'blazerush', 'flamefang', 'hammerfist'].map((id) => ({ id, pp: 10 }));
  s.party[0] = me;
  const foe = createCreature('glowblade', 22, looseRng, { ivFloor: 20 });
  foe.moves = [{ id: 'phantomslash', pp: 10 }];
  s.teams[window.__slotB].creatures = [foe];
  s.defeated[window.__slotB] = false;
  window.__cap.dmgQueue = [{ to: 0.38 }, { to: 0.52 }, { to: 'ko' }];
});
await place(22, 70, 'up', 119000);
if (on('ansem')) {
  const w = new Plate(OUT, 'ansem_wipe');
  const gw = state.gt;
  await ev(() => { window.__game.scene.getScene('Overworld').startBattle({ kind: 'trainer', trainerId: window.__slotB }); });
  await until(() => window.__game.scene.isActive('Battle'), { max: 200, plate: w });
  save(w, { events: await eventsSince(gw) });

  const a = new Plate(OUT, 'ansem_battle');
  const ga = state.gt;
  let moveMenus = 0;
  const auto = pilot({ onMove: () => { moveMenus++; } });
  // VS splash, intro, turn 1 (the big hit), foe's hit; stop as the KO move is chosen
  await until(() => false, {
    max: 1500, plate: a,
    each: async () => {
      if (moveMenus >= 2) throw Object.assign(new Error('turn2'), { turn2: true });
      await auto();
    },
  }).catch((e) => { if (!e.turn2) throw e; });
  save(a, { events: await eventsSince(ga), notes: 'VS splash (ANSEM), sent out GLOWBLADE, our EMBERFOX, turn1 INFERNO ROAR super effective -> 38%, PHANTOM SLASH -> us 52%' });

  // the knockout at 120 fps, for the slow-motion speed ramp
  const k = new Plate(OUT, 'ansem_ko');
  const gk = state.gt;
  let faintAt = null;
  for (let i = 0; i < 480; i++) {
    await frame(k, F120);
    if (faintAt === null) {
      const f = (await ev(() => window.__cap.events)).find((e2) => e2.type === 'faint' && e2.gt >= gk);
      if (f) faintAt = state.gt;
    } else if (state.gt - faintAt > 900) break;
    if (!state.menu && i % 8 === 0) await key('Enter');
  }
  save(k, { events: await eventsSince(gk), fps: 120, notes: 'turn2 INFERNO ROAR KO at 120fps, faint' });

  const out = new Plate(OUT, 'ansem_outro');
  const go = state.gt;
  await frames(60, out, F30, async (i) => { if (i % 3 === 0) await key('Enter'); });
  save(out, { events: await eventsSince(go), notes: 'Ansem slides back in after the KO (his line hidden)' });
}
await until(() => window.__game.scene.isActive('Overworld') && !window.__game.scene.isActive('Battle') && window.__game.scene.getScene('Overworld').locked === false,
  { max: 1500, each: async (i) => { if (i % 2 === 0) await key('Enter'); } });
await frames(10);

// -------------------------------------------------------- the "new map"
if (on('newmap')) {
  console.log('new map');
  await place(57, 93, 'up', 920000);
  const p = new Plate(OUT, 'newmap_pond');
  await frames(66, p, F30, async (i) => {
    if (i === 20) await page.keyboard.down('ArrowUp');
    if (i === 26) await page.keyboard.up('ArrowUp');
  });
  save(p, { notes: 'Willow Pond at 23:20, rain' });
  await place(56, 49, 'up', 930000);
  const q = new Plate(OUT, 'newmap_orchard');
  await frames(66, q);
  save(q, { notes: 'Orchard Overlook at 23:30, rain' });
}

// ------------------------------------------------ the menu-screen backdrop
// (ui/backdrop.js, used on the profile / starter screens), for the leaderboard
if (on('backdrop')) {
  console.log('backdrop');
  await ev(() => window.__game.scene.getScene('Overworld').scene.start('Wallet', { name: 'KAI', gender: 'boy', starter: 'emby' }));
  await frames(30);
  await ev(() => {
    const w = window.__game.scene.getScene('Wallet');
    w.children.list.forEach((o, i) => { if (i > 1) o.setVisible(false); });   // keep backdrop(): gradient/stripes + glow
    document.querySelectorAll('input.er-input').forEach((el) => { el.style.visibility = 'hidden'; });
  });
  await frames(2);
  const bd = new Plate(OUT, 'backdrop');
  await frames(2, bd);
  save(bd, { notes: 'ui/backdrop.js from the profile screen, everything else hidden' });
}

// --------------------------------------------------------------- the logo
if (on('logo')) {
  console.log('logo');
  await ev(() => { const g = window.__game; const k = g.scene.isActive('Wallet') ? 'Wallet' : 'Overworld'; g.scene.getScene(k).scene.start('Title'); });
  await frames(60);
  const full = new Plate(OUT, 'title');
  await frames(30, full);
  save(full);
  await ev(() => {
    const t = window.__game.scene.getScene('Title');
    const logo = t.children.list.find((o) => o.type === 'Text' && o.text === 'SolQuest');
    for (const o of t.children.list) if (o !== logo) o.setVisible(false);
    t.cameras.main.setBackgroundColor('#000000');
    window.__cap.logoBox = logo.getBounds();
  });
  const l = new Plate(OUT, 'logo');
  await frames(2, l);
  save(l, { box: await ev(() => { const b = window.__cap.logoBox; return { x: b.x, y: b.y, w: b.width, h: b.height }; }) });
}

console.log('done');
await browser.close();
