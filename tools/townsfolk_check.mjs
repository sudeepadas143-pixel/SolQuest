// Townspeople: each one is on the map, talks by key (face + ENTER) and by
// click, wanders only inside its patch, and never shares a tile with the
// player (who walks about among them).
//   node tools/townsfolk_check.mjs [outDir]   (needs a VITE_DEBUG=1 build on :4173)
import { chromium } from 'playwright';
import fs from 'node:fs';
import { TOWNSFOLK } from '../src/data/townsfolk.js';

const OUT = process.argv[2] ?? 'tools/_towns';
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

await p.goto(process.env.URL ?? 'http://localhost:4173/');
await p.waitForFunction(() => window.__game?.scene.isActive('Title'));
await ow(() => { localStorage.clear(); window.__game.scene.getScene('Title').scene.start('Wallet', { name: 'KAI', gender: 'boy', starter: 'sharkpup' }); });
await p.waitForFunction(() => window.__game.scene.isActive('Wallet'));
await p.keyboard.type('townsfolk123');
await p.keyboard.press('Enter');
await p.waitForFunction(() => window.__game.scene.isActive('Overworld'));
await sleep(1500);

const ids = await ow(() => window.__game.scene.getScene('Overworld').townsfolk.people.map((q) => q.def.id));
check(ids.length === TOWNSFOLK.length, `${ids.length} of ${TOWNSFOLK.length} townspeople on the map`);

const locked = () => ow(() => window.__game.scene.getScene('Overworld').locked);
const speaker = () => ow(() => { const u = window.__game.scene.getScene('OverworldUI'); return u.box.tabText.visible ? u.box.tabText.text : null; });
async function clear() { for (let i = 0; i < 12 && (await locked()); i++) { await p.keyboard.press('Enter'); await sleep(300); } }

// put the player on a free tile next to person i (they hold still), facing them
async function besides(i, dist = 1) {
  // freeze them first, then let any step already under way land
  await ow((i) => { const o = window.__game.scene.getScene('Overworld'); o.townsfolk.people[i].next = o.time.now + 60000; }, i);
  await p.waitForFunction((i) => !window.__game.scene.getScene('Overworld').townsfolk.people[i].moving, i);
  await sleep(80);
  return ow(([i, dist]) => {
    const o = window.__game.scene.getScene('Overworld');
    const q = o.townsfolk.people[i];
    q.next = o.time.now + 60000;
    for (const [dx, dy, dir] of [[0, 1, 'up'], [0, -1, 'down'], [1, 0, 'left'], [-1, 0, 'right']]) {
      const x = q.x + dx * dist;
      const y = q.y + dy * dist;
      if (!o.walkable(x, y) || o.map.isEncounter(x, y)) continue;
      // reachable from there (not across a hedge wall)
      const was = o.pos;
      o.pos = { x, y };
      const goals = [[0, 1], [0, -1], [-1, 0], [1, 0]].map(([gx, gy]) => ({ x: q.x + gx, y: q.y + gy }));
      if (!o.findPath(goals)) { o.pos = was; continue; }
      o.face(dir); o.syncPlayer();
      return { x, y, dir, name: q.def.name };
    }
    return null;
  }, [i, dist]);
}

for (let i = 0; i < ids.length; i++) {
  // ---- by key ----
  await p.waitForFunction((i) => !window.__game.scene.getScene('Overworld').townsfolk.people[i].moving, i);
  const spot = await besides(i, 1);
  check(!!spot, `${ids[i]}: a free tile beside them`);
  if (!spot) continue;
  await sleep(250);
  await p.keyboard.press('Enter');
  await sleep(900);
  check((await speaker()) === spot.name, `${ids[i]}: ENTER talks (${await speaker()})`);
  await p.waitForFunction(() => window.__game.scene.getScene('OverworldUI').box.arrow.visible, null, { timeout: 8000 });
  const said = await ow(() => window.__game.scene.getScene('OverworldUI').box.text.text);
  check(said.length > 10 && !said.includes('{'), `${ids[i]}: says "${said.slice(0, 48)}..."`);
  await shot(`talk_${String(i + 1).padStart(2, '0')}_${ids[i]}`);
  await clear();
  check(!(await locked()), `${ids[i]}: conversation closes`);

  // ---- by click: from a few tiles away ----
  const far = await besides(i, 3);
  if (far) {
    await sleep(300);
    const pt = await ow((i) => {
      const o = window.__game.scene.getScene('Overworld');
      const s = o.townsfolk.people[i].sprite;
      const cam = o.cameras.main;
      const r = window.__game.canvas.getBoundingClientRect();
      const sx = (s.x - cam.worldView.x) * cam.zoom;
      const sy = (s.y - s.displayHeight * 0.45 - cam.worldView.y) * cam.zoom;
      return [r.left + (sx * r.width) / 960, r.top + (sy * r.height) / 640];
    }, i);
    await p.mouse.click(...pt);
    let talked = false;
    for (let k = 0; k < 30 && !talked; k++) { await sleep(150); talked = (await speaker()) === far.name; }
    check(talked, `${ids[i]}: clicking them walks over and talks`);
    await clear();
  }
}

// ---- the moment comes first: after COOKER (with your name), then night, then their usual talk ----
{
  const gi = ids.indexOf('girl');
  await ow(() => { const o = window.__game.scene.getScene('Overworld'); o.save.defeated.cooker = true; o.save.stats.playMs = 690000; });   // a clear night
  const firsts = [];
  for (let k = 0; k < 3; k++) {
    await besides(gi, 1);
    await sleep(250);
    await p.keyboard.press('Enter');
    await p.waitForFunction(() => window.__game.scene.getScene('OverworldUI').box.arrow.visible, null, { timeout: 8000 });
    firsts.push(await ow(() => window.__game.scene.getScene('OverworldUI').box.text.text));
    await clear();
  }
  check(firsts[0].includes('KAI'), `after Cooker, with the name: "${firsts[0]}"`);
  check(firsts[1].includes('The fountain makes a'), `then the night line: "${firsts[1].slice(0, 50)}..."`);
  const usual = TOWNSFOLK.find((t) => t.id === 'girl').lines.map((l) => l[0].replace(/ff/g, ''));
  check(usual.includes(firsts[2].replace(/\u200c/g, '').replace(/ff/g, '')), `then the usual talk: "${firsts[2].slice(0, 50)}..."`);
  await ow(() => { const o = window.__game.scene.getScene('Overworld'); o.save.defeated.cooker = false; o.save.stats.playMs = 0; });
}

// ---- wandering: let them roam, walking the player about among them ----
const areas = await ow(() => window.__game.scene.getScene('Overworld').townsfolk.people.map((q) => q.def.area));
await ow(() => { for (const q of window.__game.scene.getScene('Overworld').townsfolk.people) q.next = 0; });
const visited = ids.map(() => new Set());
let overlap = 0;
let outside = 0;
let onAvoid = 0;
for (const [i] of ids.entries()) {
  // start in the middle of their patch
  await ow((i) => {
    const o = window.__game.scene.getScene('Overworld');
    const q = o.townsfolk.people[i];
    const [x0, y0, x1, y1] = q.def.area;
    for (let r = 0; r < 6; r++) {
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        if (Math.abs(x - q.x) + Math.abs(y - q.y) === 2 + r && o.walkable(x, y)) { o.pos = { x, y }; o.syncPlayer(); return; }
      }
    }
  }, i);
  const keys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'];
  for (let t = 0; t < 25; t++) {
    const k = keys[(t * 7 + i) % 4];
    await p.keyboard.down(k); await sleep(140 + (t % 3) * 60); await p.keyboard.up(k);
    await clear();
    const st = await ow(() => {
      const o = window.__game.scene.getScene('Overworld');
      const tf = o.townsfolk;
      return { pos: o.pos, people: tf.people.map((q) => ({ x: q.x, y: q.y, avoid: tf.avoid.has(o.map.key(q.x, q.y)) })) };
    });
    st.people.forEach((q, j) => {
      visited[j].add(`${q.x},${q.y}`);
      const [x0, y0, x1, y1] = areas[j];
      if (q.x < x0 || q.x > x1 || q.y < y0 || q.y > y1) outside += 1;
      if (q.avoid) onAvoid += 1;
      if (q.x === st.pos.x && q.y === st.pos.y) overlap += 1;
    });
  }
  if (i === 1) await shot('wander_market');
}
check(overlap === 0, `never on the player's tile (${overlap})`);
check(outside === 0, `always inside their patch (${outside})`);
check(onAvoid === 0, `never on a doorstep or checkpoint (${onAvoid})`);
visited.forEach((v, j) => check(v.size >= 2, `${ids[j]} wandered over ${v.size} tiles`));

console.log(errors.length ? `page errors:\n${errors.join('\n')}` : 'no page errors');
await b.close();
process.exit(fails.length || errors.length ? 1 : 0);
