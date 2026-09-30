// Teaser plates: the world, the character, the bosses. Same harness and rules
// as capture.mjs (real game frames at native 960x640, nothing in the game
// modified), plus a few extra hide rules:
//   * a boss's name never reaches the frame (the VS splash tag stays: ELITE
//     TRAINER / FINAL ELITE) - only Ansem is named, in the older plates
//   * the camera's full-screen white/orange flashes are skipped (the shake stays)
//
//   1. in the project root:  npx vite --port 5173
//   2. node capture/teaser.mjs [plateName ...]
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { installHarness, stepState, Plate } from './lib.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const OUT = path.join(ROOT, 'plates');
const GAME = process.env.GAME_URL ?? 'http://127.0.0.1:5173/';
const CHROME = process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const F30 = 1000 / 30;

const manifestPath = path.join(OUT, 'manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

const browser = await chromium.launch({ executablePath: CHROME });
const page = await browser.newPage({ viewport: { width: 960, height: 640 }, deviceScaleFactor: 1 });
page.on('pageerror', (e) => console.log('PAGEERR', e.message));
await page.goto(GAME);
await page.waitForFunction(() => window.__game?.scene.isActive('Title') && window.__audio, null, { timeout: 60000 });
await installHarness(page);

const ev = (fn, arg) => page.evaluate(fn, arg);
const key = (k) => page.keyboard.press(k);
let state = null;
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
  manifest.plates[plate.name] = { frames: plate.frames, events: [], ...extra };
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 1));
  console.log(`  plate ${plate.name}: ${plate.frames.length} frames`);
}
const want = new Set(process.argv.slice(2));
const on = (name) => !want.size || want.has(name);

// extra hide rules for the teaser
await ev(() => {
  const g = window.__game;
  const cap = window.__cap;
  const walk = (o, fn) => { fn(o); (o.list ?? []).forEach((c) => walk(c, fn)); };
  g.events.on('prerender', () => {
    const h = cap.hide;
    const ow = g.scene.getScene('Overworld');
    if (ow?.player) { ow.player.setVisible(!h.player); ow.shadow?.setVisible(!h.player); }
    const ui = g.scene.getScene('OverworldUI');
    if (h.owText && ui?.box) { ui.box.setVisible(false); ui.children.list.forEach((c) => { if (c.depth >= 1100) c.setVisible(false); }); }
    const look = g.scene.getScene('Look');
    if (h.look && g.scene.isActive('Look')) {
      look.box?.setVisible(false);
      look.children.list.forEach((c) => { if (c.depth >= 1100 || (c.type === 'Text' && c.y < 80)) c.setVisible(false); });
    }
    // no boss names: the VS splash keeps its tag, loses the name
    const bs = g.scene.getScene('Battle');
    if (g.scene.isActive('Battle') && bs.tName && !cap.showName) {
      const n = bs.tName.toUpperCase();
      bs.children.list.forEach((c) => walk(c, (o) => { if (o.type === 'Text' && o.text === n) o.setVisible(false); }));
    }
  });
});

// ---------------------------------------------------------------- name entry
console.log('name entry');
await ev(() => window.__game.scene.getScene('Title').scene.start('Intro'));
await until(() => !!document.querySelector('input.er-input'), { max: 2000, each: async (i) => { if (i % 2 === 0) await key('Enter'); } });
await frames(8);
await page.keyboard.type('KAI');
await frames(4);

// --------------------------------------------- the look: portrait -> sprite
console.log('look');
await ev(() => { document.querySelectorAll('input.er-input').forEach((el) => el.remove()); window.__game.scene.getScene('Intro').scene.start('Look', { name: 'KAI' }); });
await frames(24);
await ev(() => { window.__cap.hide.look = true; });
{
  const p = on('look_shrink') ? new Plate(OUT, 'look_shrink') : null;
  // hold on the two portraits, pick the boy, YES, then the shrink into the sprite
  await frames(20, p);
  await key('Enter');
  await frames(3, p);
  await key('Enter');
  await until(() => !window.__game.scene.isActive('Look') || window.__game.scene.getScene('Look').cameras.main.fadeEffect.isRunning, { max: 300, plate: p });
  if (p) save(p, { notes: 'two portraits, pick at 20, YES at 23, flash-shrink into the overworld sprite, spin, hop' });
  await ev(() => { window.__cap.hide.look = false; });
}

// ------------------------------------------- starter + wallet (not filmed)
console.log('starter + wallet');
await until(() => window.__game.scene.isActive('Starter'), { max: 400 });
await ev(() => { window.__game.scene.getScene('Starter').box.say = () => Promise.resolve(); });
await frames(30, null, F30, async (i) => { if (i === 10 || i === 20) await key('Enter'); });
await until(() => window.__game.scene.isActive('Wallet'), { max: 600, each: async (i) => { if (i % 3 === 0) await key('Enter'); } });
await frames(6);
await ev(() => {           // any well-formed placeholder (never filmed here)
  const el = document.querySelector('input.er-input');
  el.focus();
  el.value = 'RSMKgaJXnTLS4avmAL1kmGsi8WCzwWiJJwNyzo83Sx7V';
  el.dispatchEvent(new Event('input', { bubbles: true }));
});
await frames(4);
await key('Enter');
await until(() => window.__game.scene.isActive('Overworld') && window.__game.scene.getScene('Overworld').save, { max: 400, each: async (i) => { if (i % 6 === 0) await key('Enter'); } });
await frames(20);
await until(() => window.__game.scene.getScene('Overworld').locked === false, { max: 600, each: async (i) => { if (i % 2 === 0) await key('Enter'); } });

// ----------------------------------------------------------- overworld setup
console.log('overworld setup');
await ev(async () => {
  const o = window.__game.scene.getScene('Overworld');
  const s = o.save;
  const { createCreature } = await import('/src/systems/creature.js');
  const { looseRng } = await import('/src/systems/rng.js');
  const me = createCreature('emberfox', 24, looseRng, { ivFloor: 24 });
  me.moves = ['infernoroar', 'blazerush', 'flamefang', 'hammerfist'].map((id) => ({ id, pp: 10 }));
  s.party[0] = me;
  window.__cap.hide.hud = true;
  o.__startWild = o.startWild;
  o.startWild = () => {};
  // no full-screen camera flashes in the teaser (the shake stays)
  o.cameras.main.flash = function noFlash() { return this; };
  // no item pickups mid-shot (their message box would lock the player), and
  // no overworld text in any frame
  o.itemAt.clear();
  window.__cap.hide.owText = true;
  window.__cap.hide.player = false;
});
/** A play time (ms) at `hour` on some day whose weather is `kind` (full intensity). */
const timeAt = (hour, kind) => ev(async ([hour, kind]) => {
  const { weather } = await import('/src/systems/world.js');
  for (let d = 0; d < 60; d++) {
    const ms = ((d * 24 + hour - 8) * 60) * 1000;
    if (ms < 0) continue;
    const w = weather(ms);
    if (w.kind === kind && (kind === 'clear' || w.intensity === 1)) return ms;
  }
  throw new Error(`no ${kind} at ${hour}`);
}, [hour, kind]);

async function place(x, y, facing, playMs, { hidePlayer = false } = {}) {
  await ev(([x, y, facing, playMs, hidePlayer]) => {
    const o = window.__game.scene.getScene('Overworld');
    o.save.stats.playMs = playMs;
    o.pos = { x, y };
    o.face(facing);
    o.syncPlayer();
    o.applyArea();
    o.checkZone();
    const cam = o.cameras.main;
    cam.setZoom(2);
    cam.startFollow(o.player, true, 1, 1, 0, 12);
    window.__cap.hide.player = hidePlayer;
  }, [x, y, facing, playMs, hidePlayer]);
  await frames(12);
}
/** Free camera (a drone): centre on tile (tx, ty) at zoom z; the clock can run. */
const drone = (tx, ty, z, playMs = null) => ev(([tx, ty, z, playMs]) => {
  const o = window.__game.scene.getScene('Overworld');
  const cam = o.cameras.main;
  cam.stopFollow();
  cam.setZoom(z);
  cam.centerOn(tx * 32 + 16, ty * 24 + 12);
  if (playMs !== null) o.save.stats.playMs = playMs;
}, [tx, ty, z, playMs]);
const ease = (k) => 0.5 - 0.5 * Math.cos(Math.PI * Math.min(1, Math.max(0, k)));
async function droneShot(name, n, from, to, { t0 = null, t1 = null, each = null, notes = '' } = {}) {
  if (!on(name)) return;
  console.log(name);
  const p = new Plate(OUT, name);
  await frames(n, p, F30, async (i) => {
    const k = ease(i / (n - 1));
    const lerp = (a, b) => a + (b - a) * k;
    const ms = t0 === null ? null : Math.round(t0 + (t1 - t0) * (i / (n - 1)));
    await drone(lerp(from[0], to[0]), lerp(from[1], to[1]), lerp(from[2], to[2]), ms);
    if (each) await each(i);
  });
  save(p, { notes });
}

// ------------------------------------------------------------ the world
// 1. the flyover: town -> route -> the fork -> Solace -> the Elite Hall, while
//    the clock runs from morning to night (a time-lapse)
{
  const t0 = await timeAt(9, 'clear');
  await place(22, 118, 'up', t0, { hidePlayer: true });
  await droneShot('fly_world', 150, [22, 121, 1.15], [22, 16, 0.72], {
    t0, t1: t0 + 12 * 3600 * 1000 / 60,
    notes: 'drone flyover south -> north, zoom 1.15 -> 0.72, time-lapse 9:00 -> 21:00',
  });
}
// 2. the places
{
  const t = await timeAt(18.6, 'clear');
  await place(56, 91, 'up', t);
  await page.keyboard.down('ArrowUp');
  await droneShot('env_pond', 60, [55, 84, 1.45], [55, 81, 1.55], { t0: t, t1: t + 60000, notes: 'Willow Pond at golden hour, walking up the pier' });
  await page.keyboard.up('ArrowUp');
}
{
  const t = await timeAt(6.3, 'clear');
  await place(47, 70, 'up', t, { hidePlayer: true });
  await droneShot('env_windmill', 60, [45, 68, 1.5], [47, 67, 1.6], { t0: t, t1: t + 60000, notes: 'the windmill above Willow Pond at dawn' });
}
{
  const t = await timeAt(11, 'clear');
  await place(49, 110, 'right', t);
  await page.keyboard.down('ArrowRight');
  await droneShot('env_market', 60, [51, 108, 1.5], [54, 108, 1.6], { t0: t, t1: t + 60000, notes: 'Market Square fountain, midday' });
  await page.keyboard.up('ArrowRight');
}
{
  const t = await timeAt(22, 'rain');
  await place(22, 92, 'up', t);
  await page.keyboard.down('ArrowUp');
  await droneShot('env_rain', 60, [22, 90, 1.5], [22, 86, 1.6], { t0: t, t1: t + 60000, notes: 'the route at night in the rain, lamps lit' });
  await page.keyboard.up('ArrowUp');
}
{
  const t = await timeAt(22.5, 'clear');
  await place(22, 18, 'up', t);
  await droneShot('hall_ext', 75, [22, 17, 1.7], [22, 11, 1.45], { t0: t, t1: t + 30000, notes: 'the Elite Hall at night, tilting up to the doors' });
}

// ------------------------------------------------------------ the bosses
// Each route Elite's VS splash (name hidden) and a moment on the field.
const slots = await ev(() => {
  const s = window.__game.scene.getScene('Overworld').save;
  const out = {};
  for (const [id, t] of Object.entries(s.teams)) out[t.design] = id;
  return out;
});
async function versus(name, slot, hour, notes) {
  const t = await timeAt(hour, 'clear');
  await place(22, 70, 'up', t, { hidePlayer: false });
  await ev(([slot]) => {
    const o = window.__game.scene.getScene('Overworld');
    const team = o.save.teams[slot];
    team.creatures = team.creatures.slice(0, 1);
    o.save.defeated[slot] = false;
    window.__cap.dmgQueue = [{ to: 'ko' }];
    window.__cap.hide.battleText = true;
  }, [slot]);
  const p = on(name) ? new Plate(OUT, name) : null;
  if (p) console.log(name);
  await ev(([slot]) => { window.__game.scene.getScene('Overworld').startBattle({ kind: 'trainer', trainerId: slot }); }, [slot]);
  // the transition, the VS splash, the Elite on the field (hold before the text moves on)
  await frames(150, p);
  if (p) save(p, { notes });
  // win it off camera
  let n = 0;
  await until(() => window.__game.scene.isActive('Overworld') && !window.__game.scene.isActive('Battle') && window.__game.scene.getScene('Overworld').locked === false,
    { max: 3000, each: async () => { n++; if (n % 2 === 0) await key('Enter'); } });
  await frames(6);
}
await versus('vs_a', slots.A, 10.5, 'design A: VS splash (name hidden), on the field, day');
await versus('vs_c', slots.C, 18.7, 'design C: VS splash (name hidden), on the field, dusk');
await versus('vs_e', slots.E, 22, 'design E: VS splash (name hidden), on the field, night');

// ---------------------------------------------- the Hall and the final Elite
console.log('hall');
await ev(() => {
  const o = window.__game.scene.getScene('Overworld');
  for (const id of ['t1', 't2', 't3', 't4']) o.save.defeated[id] = true;
  o.save.defeated.cooker = false;
  o.save.teams.cooker.creatures = o.save.teams.cooker.creatures.slice(0, 1);
});
await place(22, 14, 'up', await timeAt(22.5, 'clear'));
await until(() => window.__game.scene.getScene('Overworld').locked === false, { max: 300, each: async (i) => { if (i % 2 === 0) await key('Enter'); } });
await ev(() => { const o = window.__game.scene.getScene('Overworld'); o.runLocked(() => o.enterDoor({ kind: 'hall' })); });
await until(() => window.__game.scene.getScene('Overworld').indoors && window.__game.scene.getScene('Overworld').locked === false, { max: 200 });
await frames(10);
{
  const p = on('hall_walk') ? new Plate(OUT, 'hall_walk') : null;
  if (p) console.log('hall_walk');
  // the walk up the carpet: the braziers catch pair by pair, then he shows himself
  await page.keyboard.down('ArrowUp');
  await until(() => window.__game.scene.getScene('Overworld').cookerMet, { max: 600, plate: p });
  await page.keyboard.up('ArrowUp');
  // the pan to the dais, every flame flares, he steps down (stop when he speaks)
  await until(() => window.__game.scene.getScene('OverworldUI').box.container.visible || window.__game.scene.isActive('Battle'), { max: 400, plate: p });
  if (p) save(p, { notes: 'Hall walk: braziers ignite at rows 22/18/14, pan to the dais, flare, Cooker steps down' });
}
{
  const p = on('vs_cooker') ? new Plate(OUT, 'vs_cooker') : null;
  await until(() => window.__game.scene.isActive('Battle'), { max: 600, each: async (i) => { if (i % 2 === 0) await key('Enter'); } });
  if (p) console.log('vs_cooker');
  await frames(150, p);
  if (p) save(p, { notes: 'the final Elite: gold FINAL ELITE VS splash (name hidden), the throne room' });
}

console.log('done');
await browser.close();
