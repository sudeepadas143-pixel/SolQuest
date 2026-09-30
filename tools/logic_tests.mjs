import fs from 'node:fs';
// Headless sanity tests for game logic + content data.  Run: npm test
import assert from 'node:assert/strict';
import { generateTeams, makeSeed, trainerName, fixDesigns, migrateRoster } from '../src/systems/teams.js';
import { DESIGN_NAMES } from '../src/data/trainers.js';
import { TRACKS } from '../src/data/music.js';
import { personality, PERSONALITY } from '../src/data/personalities.js';
import { createCreature, gainXp, xpForLevel, pendingEvolution, evolve, calcStats } from '../src/systems/creature.js';
import { BattleEngine } from '../src/systems/battle.js';
import { Rng } from '../src/systems/rng.js';
import { buildMap } from '../src/systems/mapBuilder.js';
import { HALL } from '../src/data/map.js';
import { SPECIES, STARTERS, learnsetOf } from '../src/data/creatures.js';
import { MOVES } from '../src/data/moves.js';
import { ZONES, zoneAt } from '../src/data/encounters.js';
import { TRAINERS, TRAINER_ORDER } from '../src/data/trainers.js';
import { PLAYER_START, TRAINER_SPOTS, MAP_ITEMS } from '../src/data/map.js';
import { ITEMS } from '../src/data/items.js';
import { warning, coaching, objective, readiness } from '../src/systems/advice.js';
import { TYPE_COLORS } from '../src/data/types.js';
import { unlockCheckpoints, nearestCheckpoint } from '../src/systems/checkpoints.js';
import { CHECKPOINTS } from '../src/data/map.js';
import manifest from '../src/data/spriteManifest.json' with { type: 'json' };

let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log(`  ✓ ${name}`); };

console.log('teams');
test('same seed -> identical teams (no re-roll on retry/reload)', () => {
  assert.deepEqual(strip(generateTeams(12345)), strip(generateTeams(12345)));
});
test('different seeds -> teams differ across players', () => {
  const sigs = new Set();
  for (let s = 0; s < 40; s++) sigs.add(JSON.stringify(strip(generateTeams(s))));
  assert.ok(sigs.size > 30, `only ${sigs.size} distinct team sets`);
});
test('wallet-derived seed is stable and case-insensitive', () => {
  assert.equal(makeSeed('AbC123xyz').seed, makeSeed('  abc123XYZ ').seed);
  assert.equal(makeSeed('AbC123xyz').seedSource, 'wallet');
  assert.equal(makeSeed('').seedSource, 'random');
});
test('trainer teams only use their pool, never starters, sizes/levels in range', () => {
  for (let s = 0; s < 50; s++) {
    const teams = generateTeams(s * 99991);
    for (const id of TRAINER_ORDER) {
      const def = TRAINERS[id];
      const t = teams[id];
      assert.equal(t.creatures.length, def.teamSize);
      assert.ok(['A', 'B', 'C', 'D', 'E'].includes(t.design));
      for (const c of t.creatures) {
        assert.ok(def.pool.includes(c.species), `${id} got ${c.species}`);
        assert.ok(!SPECIES[c.species].starterOnly);
        assert.ok(c.level >= def.levels[0] && c.level <= def.levels[1]);
        assert.ok(c.moves.length >= 1 && c.moves.length <= 4);
      }
    }
  }
});

test('named designs show their name; Cooker never wears someone else\'s design', () => {
  for (let seed = 0; seed < 200; seed++) {
    const teams = generateTeams(seed * 7 + 1);
    const cd = teams.cooker.design;
    assert.ok(!DESIGN_NAMES[cd] || DESIGN_NAMES[cd] === 'Cooker', `cooker got ${cd}`);
    assert.equal(trainerName(teams, 'cooker'), 'Cooker');
    for (const id of ['t1', 't2', 't3', 't4']) {
      const want = DESIGN_NAMES[teams[id].design] ?? TRAINERS[id].name;
      assert.equal(trainerName(teams, id), want);
    }
  }
  assert.ok(Object.values(generateTeams(5)).some((t) => t.design === 'B'), 'B (Ansem) is in the Elite rotation');
  assert.equal(Object.keys(generateTeams(5)).length, 5, 'five Elites: t1-t4 + Cooker');
});
test('Cooker always wears design D; each named person appears at most once', () => {
  for (let seed = 0; seed < 300; seed++) {
    const teams = generateTeams(seed * 13 + 5);
    assert.equal(teams.cooker.design, 'D');
    const elites = ['t1', 't2', 't3', 't4'].map((id) => teams[id].design);
    assert.ok(!elites.includes('D'), 'Cooker art on an Elite');
    for (const [d, name] of Object.entries(DESIGN_NAMES)) {
      if (name) assert.ok(Object.values(teams).filter((t) => t.design === d).length <= 1, `${name} twice`);
    }
    // five characters, five Elites: each route character exactly once, no extras
    assert.deepEqual([...elites].sort(), ['A', 'B', 'C', 'E']);
  }
});
test('old saves are re-skinned to the current mapping without touching creatures', () => {
  const save = { seed: 42, teams: generateTeams(42) };
  save.teams.cooker.design = 'B';
  save.teams.t1.design = 'D';
  const before = JSON.stringify(save.teams.cooker.creatures);
  assert.ok(fixDesigns(save));
  assert.equal(save.teams.cooker.design, 'D');
  assert.notEqual(save.teams.t1.design, 'D');
  assert.equal(JSON.stringify(save.teams.cooker.creatures), before);
});

test('saves from the old 5-route-trainer layout drop t5 and its points', () => {
  const save = { seed: 9, teams: { ...generateTeams(9), t5: { design: 'A', creatures: [] } }, defeated: { t1: true, t5: true },
    score: 900, scoreLog: [{ trainer: 't1', points: 100 }, { trainer: 't5', points: 800 }] };
  assert.ok(migrateRoster(save));
  assert.equal(save.score, 100);
  assert.ok(!('t5' in save.teams) && !('t5' in save.defeated));
});

console.log('content');
test('wild zones never contain starter families', () => {
  for (const z of ZONES) for (const [sp] of z.pool) assert.ok(!SPECIES[sp].starterOnly, `${z.id}: ${sp}`);
});
test('every learnset move exists', () => {
  for (const id of Object.keys(SPECIES)) for (const [, m] of learnsetOf(id)) assert.ok(MOVES[m], `${id}: ${m}`);
});
test('every referenced sprite exists in the processed manifest', () => {
  for (const [id, sp] of Object.entries(SPECIES)) {
    for (const view of ['front', 'back']) {
      if (!sp[view]) continue;
      assert.ok(manifest.creatures[id]?.[view], `${id} ${view} missing`);
    }
    assert.ok(sp.front || sp.back);
    if (sp.starterOnly) assert.ok(sp.back, `${id} needs a back sprite (player-side)`);
    else assert.ok(sp.front, `${id} needs a front sprite (opponent-side)`);
  }
});
test('names are short enough for the battle UI', () => {
  for (const sp of Object.values(SPECIES)) assert.ok(sp.name.length <= 10, sp.name);
});

console.log('creatures');
test('XP curve increases smoothly', () => {
  for (let l = 2; l < 60; l++) assert.ok(xpForLevel(l + 1) - xpForLevel(l) > xpForLevel(l) - xpForLevel(l - 1));
});
test('levelling raises stats; Emby -> Embrute -> Emberfox (the fox is final)', () => {
  const rng = new Rng(1);
  const c = createCreature('emby', 5, rng);
  const before = calcStats(c);
  gainXp(c, xpForLevel(16) - c.xp);
  assert.equal(c.level, 16);
  assert.ok(calcStats(c).atk > before.atk);
  assert.equal(pendingEvolution(c), 'embrute');
  evolve(c);
  assert.equal(c.species, 'embrute');
  gainXp(c, xpForLevel(32) - c.xp);
  assert.equal(evolve(c), 'emberfox');
});

console.log('battle');
test('engine finishes a battle and awards XP on win', () => {
  const rng = new Rng(7);
  const me = createCreature('sharkpup', 30, rng);
  const foe = createCreature('boxbun', 5, rng);
  const xp0 = me.xp;
  const e = new BattleEngine({ player: me, foes: [foe], kind: 'wild', rng, bag: {} });
  let guard = 0;
  while (!e.over && guard++ < 50) e.turn({ type: 'move', index: me.moves.findIndex((m) => MOVES[m.id].power) });
  assert.equal(e.result, 'win');
  assert.ok(me.xp > xp0);
});
test('cannot run from trainer battles', () => {
  const rng = new Rng(3);
  const e = new BattleEngine({ player: createCreature('fernie', 50, rng), foes: [createCreature('boxbun', 2, rng)], kind: 'trainer', rng, bag: {}, trainerName: 'T' });
  const ev = e.turn({ type: 'run' });
  assert.ok(ev.some((x) => x.t === 'text' && /no running/i.test(x.text)));
  assert.notEqual(e.result, 'run');
});

console.log('map');
const map = buildMap();
const spots = Object.fromEntries(Object.entries(TRAINER_SPOTS).map(([id, s]) => [id, s]));
function reach(passable) {
  const seen = new Set([`${PLAYER_START.x},${PLAYER_START.y}`]);
  const q = [[PLAYER_START.x, PLAYER_START.y]];
  while (q.length) {
    const [x, y] = q.shift();
    // the Elite Hall doors warp inside (and the doormat back out)
    if (x === HALL.out.x && y === HALL.out.y && !seen.has(`${HALL.entry.x},${HALL.entry.y}`)) {
      seen.add(`${HALL.entry.x},${HALL.entry.y}`); q.push([HALL.entry.x, HALL.entry.y]);
    }
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx; const ny = y + dy; const k = `${nx},${ny}`;
      if (seen.has(k) || nx < 0 || ny < 0 || nx >= map.w || ny >= map.h) continue;
      if (map.blocked[ny][nx] || !passable(nx, ny)) continue;
      seen.add(k); q.push([nx, ny]);
    }
  }
  return seen;
}
const at = (id, useMoved) => (useMoved && spots[id].moved ? spots[id].moved : spots[id]);
const blockers = (beaten) => (x, y) => !Object.keys(spots).some((id) => {
  const p = at(id, beaten.includes(id));
  return p.x === x && p.y === y;
});
test('player start is walkable', () => assert.ok(!map.blocked[PLAYER_START.y][PLAYER_START.x]));
test('Trainer 1 is mandatory (blocks everything north of the first wall)', () => {
  const r = reach(blockers([]));
  assert.ok(r.has('22,101'));
  assert.ok(![...r].some((k) => +k.split(',')[1] < 100));
});
test('after T1: both branches (T2, T3) reachable, but T4 blocks the north', () => {
  const r = reach(blockers(['t1']));
  assert.ok(r.has('6,84') || r.has('6,82'));
  assert.ok(r.has('38,84') || r.has('38,82'));
  assert.ok(r.has('22,63'));
  assert.ok(![...r].some((k) => +k.split(',')[1] < 62));
});
test('main path does not require T2/T3 (optional); after T4 the Elite Hall door is reachable', () => {
  const r = reach(blockers(['t1', 't4']));
  const hall = [...map.doors.values()].find((d) => d.kind === 'hall');
  assert.ok(r.has(`${hall.x},${hall.y + 1}`));
});
test('every door and trainer can be walked up to', () => {
  const r = reach(blockers(['t1', 't4']));
  for (const d of map.doors.values()) assert.ok(r.has(`${d.x},${d.y + 1}`), `door ${d.x},${d.y}`);
  for (const [id, s] of Object.entries(spots)) {
    const near = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => r.has(`${s.x + dx},${s.y + dy}`));
    assert.ok(near, id);
  }
});
test('every encounter zone has reachable tall grass', () => {
  const r = reach(blockers(['t1', 't4']));
  for (const z of ZONES) {
    if (z.id === 'hall') continue;              // indoors: no grass by design
    const ok = [...r].some((k) => { const [x, y] = k.split(',').map(Number); return map.isEncounter(x, y) && zoneAt(y, x).id === z.id; });
    assert.ok(ok, z.id);
  }
});
test('Elite Hall: the doors lead inside, up the carpet to Cooker; the gate opens once Cooker steps aside', () => {
  const r = reach(blockers(['t1', 't4']));
  assert.ok(r.has(`${HALL.entry.x},${HALL.entry.y}`), 'inside the hall');
  assert.ok(r.has(`${spots.cooker.x},${spots.cooker.y + 1}`), 'in front of Cooker');
  assert.ok(!map.blocked[HALL.exit.y][HALL.exit.x], 'doormat is walkable');
  const after = reach(blockers(['t1', 't4', 'cooker']));
  assert.ok(after.has(`${HALL.gate.x},${HALL.gate.y + 1}`), 'gate reachable after Cooker moves');
  // the interior is sealed off from the outdoors except through the doors
  const walled = reach(() => true);
  const inside = [...walled].filter((k) => +k.split(',')[0] >= 72);
  assert.ok(inside.length > 0);
});
test('every map item sits on open ground and can be reached', () => {
  const r = reach(blockers(['t1', 't4']));
  const seen = new Set();
  for (const it of MAP_ITEMS) {
    assert.ok(!seen.has(it.id), `duplicate id ${it.id}`); seen.add(it.id);
    assert.ok(ITEMS[it.item], `unknown item ${it.item}`);
    assert.ok(!map.blocked[it.y][it.x], `${it.id} placed on a blocked tile`);
    const near = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => r.has(`${it.x + dx},${it.y + dy}`));
    assert.ok(near, `${it.id} unreachable`);
  }
});
test('side areas are gated like the main route (pond after T1, orchard after T4)', () => {
  const before = reach(blockers([]));
  assert.ok(before.has('47,110'), 'market square open from the start');
  assert.ok(!before.has('52,93'), 'pond must be behind Trainer 1');
  const afterT1 = reach(blockers(['t1']));
  assert.ok(afterT1.has('52,93') && !afterT1.has('50,50'), 'orchard must be behind Trainer 4');
});

test('main road from start to T1 has no forced tall grass', () => {
  for (let y = PLAYER_START.y; y > 100; y--) assert.ok(!map.isEncounter(22, y));
});

test('the road-block Elite requires both side-path Elites, with lines for it', () => {
  assert.deepEqual(TRAINERS.t4.requires, ['t2', 't3']);
  // any route Elite can land in the road-block slot, so each needs blocked lines in their own voice
  for (const d of ['A', 'B', 'C', 'E']) {
    const p = personality(d);
    assert.ok(p.blocked.length >= 2 && p.blocked.some((l) => l.includes('{LIST}')), d);
    for (const k of ['intro', 'rematch', 'defeat', 'victory', 'after']) assert.ok(p[k]?.length, `${d}.${k}`);
    assert.ok(p.lastMon, `${d}.lastMon`);
  }
  assert.ok(personality('D').intro.length && personality('D').victory.length);
  assert.equal(new Set(['A', 'B', 'C', 'D', 'E'].map((d) => PERSONALITY[d].trait)).size, 5, 'five distinct personalities');
  for (const id of ['t1', 't2', 't3']) assert.ok(!TRAINERS[id].requires, `${id} must not be gated`);
});
test('every music track has aligned 16-step bars; boss themes exist', () => {
  for (const k of ['eliteEncounter', 'cookerEncounter', 'eliteBattle', 'boss', 'lose']) assert.ok(TRACKS[k], k);
  // every route Elite character has their own encounter + battle theme, all distinct
  const seen = new Set();
  for (const d of ['A', 'B', 'C', 'E']) {
    for (const kind of ['encounter', 'battle']) {
      const t = TRACKS[`${kind}_${d}`];
      assert.ok(t, `${kind}_${d}`);
      assert.ok(!seen.has(t.lead_), `${kind}_${d} must not reuse another theme`);
      seen.add(t.lead_);
    }
  }
  for (const [k, t] of Object.entries(TRACKS)) {
    const lens = ['lead_', 'harm', 'pad', 'bass', 'drums'].filter((f) => t[f]).map((f) => t[f].split(/\s+/).filter(Boolean).length);
    assert.ok(lens.every((n) => n % 16 === 0 && n === lens[0]), `${k}: ${lens}`);
  }
});
test('starters reach their final form before the Cooker fight', () => {
  for (const root of STARTERS) {
    let id = root; let lv = 0;
    while (SPECIES[id].evolvesTo) { lv = SPECIES[id].evolveLevel; id = SPECIES[id].evolvesTo; }
    assert.ok(lv <= TRAINERS.cooker.rec - 1 && lv <= TRAINERS.cooker.levels[0], `${root} final form at ${lv}`);
    assert.ok(lv <= ZONES.find((z) => z.id === 'zone4').levels[1], 'reachable in the Elite Approach grass');
  }
});
test('Elites give directions: warnings, coaching and next objective', () => {
  const save = { teams: generateTeams(makeSeed('advice')), defeated: {}, party: [createCreature('emby', 5, new Rng(1))] };
  const d = save.teams.t1.design;
  // Lv 5 at T1 (rec 7): warned, told where to train, no unfilled tokens
  const w = warning(save, 't1', d);
  assert.ok(w.length >= 2 && w.join(' ').includes('Route 1 - South') && !/\{\w+\}/.test(w.join(' ')), w.join(' | '));
  assert.ok(coaching(save, 't1', d).join(' ').includes('Lv 7'));
  save.party[0] = createCreature('emby', 8, new Rng(1));
  assert.equal(warning(save, 't1', d).length, 0, 'no nagging when ready');
  // Cooker always mentions a missing final form
  save.party[0] = createCreature('embrute', 21, new Rng(1));
  assert.ok(warning(save, 'cooker', 'D').join(' ').includes('Lv 22'));
  save.party[0] = createCreature('emberfox', 23, new Rng(1));
  assert.equal(warning(save, 'cooker', 'D').length, 0);
  assert.ok(!readiness(save, 'cooker').needsForm);
  // the next goal follows progress
  save.defeated = { t1: true };
  assert.ok(/west.*east/.test(objective(save).join(' ')));
  save.defeated = { t1: true, t2: true };
  assert.ok(objective(save).join(' ').includes('east'));
  save.defeated = { t1: true, t2: true, t3: true };
  assert.ok(objective(save).join(' ').includes(trainerName(save.teams, 't4')));
  save.defeated = { t1: true, t2: true, t3: true, t4: true };
  save.party[0] = createCreature('embrute', 18, new Rng(1));
  assert.ok(/Elite Hall.*final form/.test(objective(save).join(' ')));
  for (const k of ['warn', 'form', 'ask', 'wait', 'coach', 'lucky']) for (const x of ['A', 'B', 'C', 'D', 'E']) assert.ok(PERSONALITY[x][k], `${x}.${k}`);
});
test('every type in play has a colour (and a symbol in src/ui/typeIcons.js)', () => {
  const src = fs.readFileSync(new URL('../src/ui/typeIcons.js', import.meta.url), 'utf8');
  for (const t of new Set([...Object.values(SPECIES).flatMap((sp) => sp.types), ...Object.values(MOVES).map((mv) => mv.type)])) {
    assert.ok(TYPE_COLORS[t] != null, `${t} colour`);
    assert.ok(new RegExp(`\\n  ${t}: \\(\\)`).test(src), `${t} symbol`);
  }
});
test('blackout returns you to the nearest unlocked checkpoint, saved or not', () => {
  const map = buildMap();
  for (const c of CHECKPOINTS) assert.ok(!map.blocked[c.y][c.x], `${c.id} walkable`);
  const save = { defeated: {}, checkpoints: undefined };
  // fresh game: only town
  assert.deepEqual(unlockCheckpoints(save, { x: 22, y: 110 }), ['start']);
  assert.equal(nearestCheckpoint(map, save.checkpoints, { x: 22, y: 90 }).id, 'start');
  // beat T1, walk on to the fork and fall there: back at the first gate, not town
  save.defeated.t1 = true;
  unlockCheckpoints(save, { x: 22, y: 95 });
  assert.equal(nearestCheckpoint(map, save.checkpoints, { x: 20, y: 88 }).id, 't1');
  // after T4, falling up north (or in the Hall) returns you to the north side
  Object.assign(save.defeated, { t2: true, t3: true, t4: true });
  unlockCheckpoints(save, { x: 22, y: 50 });
  assert.equal(nearestCheckpoint(map, save.checkpoints, { x: 22, y: 50 }).id, 't4');
  unlockCheckpoints(save, { x: 16, y: 41 });           // walked past the northern Solace
  assert.ok(save.checkpoints.includes('rest3'));
  assert.equal(nearestCheckpoint(map, save.checkpoints, HALL.out).id, 'rest3');
});
console.log(`\n${passed} tests passed`);

function strip(teams) {
  const o = {};
  for (const [k, v] of Object.entries(teams)) o[k] = { design: v.design, c: v.creatures.map((c) => [c.species, c.level, c.ivs, c.moves]) };
  return o;
}
