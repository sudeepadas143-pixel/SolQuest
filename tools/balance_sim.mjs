// Headless difficulty check using the real battle engine.
//
// For every trainer and every starter it estimates:
//   * "rush level"  - the level a player would have if they walked the main road
//                     straight there (no grass, only XP from mandatory trainers)
//   * win rate at that rush level (should be LOW - rushing shouldn't work)
//   * the level needed for a >= 70% win rate (the grind target)
//   * roughly how many wild wins in the local zone that grind takes
//
// Run: npm run sim
import { BattleEngine } from '../src/systems/battle.js';
import { createCreature, defaultMoves, xpForLevel, xpReward, calcStats } from '../src/systems/creature.js';
import { generateTeams } from '../src/systems/teams.js';
import { Rng } from '../src/systems/rng.js';
import { SPECIES, STARTERS } from '../src/data/creatures.js';
import { TRAINERS, TRAINER_ORDER } from '../src/data/trainers.js';
import { ZONES } from '../src/data/encounters.js';

const TRIALS = 160;
// Items a player plausibly holds when arriving (starting bag + earlier rewards).
const BAG_AT = {
  t1: { potion: 3 },
  t2: { potion: 3, superpotion: 2 },
  t3: { potion: 3, superpotion: 2 },
  t4: { potion: 3, superpotion: 4 },
  cooker: { potion: 3, superpotion: 4, hyperpotion: 5, fullheal: 1 },
};
const ZONE_FOR = { t1: 'zone1', t2: 'zone2', t3: 'zone2', t4: 'zone2', cooker: 'zone4' };

function speciesAt(root, level) {
  let id = root;
  while (SPECIES[id].evolvesTo && level >= SPECIES[id].evolveLevel) id = SPECIES[id].evolvesTo;
  return id;
}

function makePlayer(root, level, rng) {
  const sp = speciesAt(root, level);
  const c = createCreature(sp, level, rng, { ivFloor: 16 });
  c.moves = defaultMoves(sp, level);
  return c;
}

function autoAction(eng, bag) {
  const p = eng.player;
  const max = calcStats(p).hp;
  if (p.hp < max * 0.33) {
    for (const it of ['fullheal', 'hyperpotion', 'superpotion', 'potion']) {
      if (bag[it] > 0) return { type: 'item', item: it };
    }
  }
  let best = 0;
  let bestScore = -1;
  p.moves.forEach((m, i) => {
    if (m.pp <= 0) return;
    const s = eng.estimate('player', { ...eng.moveData('player', i) });
    if (s > bestScore) { bestScore = s; best = i; }
  });
  return { type: 'move', index: best };
}

function winRate(root, level, tid) {
  let wins = 0;
  for (let t = 0; t < TRIALS; t++) {
    const rng = new Rng(1000 + t * 7919);
    const teams = generateTeams(0xabc00 + t);
    const foes = structuredClone(teams[tid].creatures);
    const bag = structuredClone(BAG_AT[tid]);
    const player = makePlayer(root, level, rng);
    const eng = new BattleEngine({ player, foes, kind: 'trainer', ai: TRAINERS[tid].boss ? 'boss' : 'trainer', bag, rng, trainerName: 'x' });
    let guard = 0;
    while (!eng.over && guard++ < 200) eng.turn(autoAction(eng, bag));
    if (eng.result === 'win') wins++;
  }
  return wins / TRIALS;
}

function avgTeamXp(tid) {
  const teams = generateTeams(0x5eed);
  return teams[tid].creatures.reduce((s, c) => s + xpReward(c, { trainer: true }), 0);
}

function levelFromXp(xp) {
  let l = 1;
  while (xpForLevel(l + 1) <= xp) l++;
  return l;
}

function wildWinsNeeded(fromLevel, toLevel, zoneId) {
  if (toLevel <= fromLevel) return 0;
  const z = ZONES.find((zz) => zz.id === zoneId);
  const total = z.pool.reduce((s, [, w]) => s + w, 0);
  const avgLv = (z.levels[0] + z.levels[1]) / 2;
  const avgXp = z.pool.reduce((s, [sp, w]) => s + (w / total) * xpReward({ species: sp, level: avgLv }), 0);
  return Math.ceil((xpForLevel(toLevel) - xpForLevel(fromLevel)) / avgXp);
}

// Rush path: every Elite in order (the Hall requires all four), no grass.
const MAIN = ['t1', 't2', 't3', 't4', 'cooker'];   // the Hall needs all four route Elites
const rows = [];
for (const root of STARTERS) {
  let rushXp = xpForLevel(5);
  for (const tid of TRAINER_ORDER) {
    const rushLv = levelFromXp(rushXp);
    const rushWin = winRate(root, rushLv, tid);
    let need = null;
    for (let L = Math.max(3, rushLv); L <= 55; L++) {
      if (winRate(root, L, tid) >= 0.7) { need = L; break; }
    }
    rows.push({
      starter: SPECIES[root].name, trainer: tid,
      trainerLv: `${TRAINERS[tid].levels[0]}-${TRAINERS[tid].levels[1]}`,
      rushLv, rushWin: `${Math.round(rushWin * 100)}%`,
      need70: need, grindWins: need ? wildWinsNeeded(rushLv, need, ZONE_FOR[tid]) : '?',
    });
    if (MAIN.includes(tid)) rushXp += avgTeamXp(tid); // assume they somehow won, to be generous
  }
}
console.table(rows);
