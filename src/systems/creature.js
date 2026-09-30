// Creature instances: stats, XP curve, level-ups, move learning, evolution.
import { SPECIES, learnsetOf } from '../data/creatures.js';
import { MOVES } from '../data/moves.js';
import { MAX_LEVEL, XP_MULT, TRAINER_XP_BONUS } from '../config.js';

export const STAT_KEYS = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];
export const STAT_LABELS = { hp: 'HP', atk: 'Attack', def: 'Defense', spa: 'Sp. Atk', spd: 'Sp. Def', spe: 'Speed' };

/** Total XP needed to *reach* a level: a smooth cubic ("medium") curve. */
export function xpForLevel(level) {
  return level <= 1 ? 0 : Math.floor(level ** 3);
}

export function calcStats(c) {
  const sp = SPECIES[c.species];
  const out = {};
  for (const k of STAT_KEYS) {
    const core = Math.floor(((2 * sp.base[k] + c.ivs[k]) * c.level) / 100);
    out[k] = k === 'hp' ? core + c.level + 10 : core + 5;
  }
  return out;
}

/** The last 4 moves learnable at or below `level`. */
export function defaultMoves(speciesId, level) {
  const ids = [];
  for (const [lv, id] of learnsetOf(speciesId)) {
    if (lv <= level && !ids.includes(id)) ids.push(id);
  }
  return ids.slice(-4).map((id) => ({ id, pp: MOVES[id].pp }));
}

let uidCounter = 0;
export function createCreature(speciesId, level, rng, { ivFloor = 0 } = {}) {
  const ivs = {};
  for (const k of STAT_KEYS) ivs[k] = rng.int(ivFloor, 31);
  const c = {
    uid: `${speciesId}-${Date.now().toString(36)}-${(uidCounter++).toString(36)}`,
    species: speciesId,
    level,
    xp: xpForLevel(level),
    ivs,
    moves: defaultMoves(speciesId, level),
    hp: 0,
  };
  c.hp = calcStats(c).hp;
  return c;
}

export function maxHp(c) { return calcStats(c).hp; }

export function heal(c, amount = Infinity) {
  const before = c.hp;
  c.hp = Math.min(maxHp(c), c.hp + amount);
  return c.hp - before;
}

export function fullRestore(c) {
  c.hp = maxHp(c);
  for (const m of c.moves) m.pp = MOVES[m.id].pp;
}

/** XP awarded for defeating `foe`. */
export function xpReward(foe, { trainer = false } = {}) {
  const base = SPECIES[foe.species].xpYield;
  return Math.max(1, Math.floor(((base * foe.level) / 7) * XP_MULT * (trainer ? TRAINER_XP_BONUS : 1)));
}

/**
 * Add XP. Returns an array of level-up records:
 *   { level, delta: {stat: +n}, newMoves: [moveId] }
 * HP rises by the same amount max HP rises (like the main series).
 */
export function gainXp(c, amount) {
  const ups = [];
  c.xp += amount;
  while (c.level < MAX_LEVEL && c.xp >= xpForLevel(c.level + 1)) {
    const before = calcStats(c);
    c.level += 1;
    const after = calcStats(c);
    const delta = {};
    for (const k of STAT_KEYS) delta[k] = after[k] - before[k];
    // SolQuest rule: every level-up fully heals the creature
    const hpBefore = Math.min(after.hp, c.hp + delta.hp);
    c.hp = after.hp;
    const newMoves = learnsetOf(c.species).filter(([lv]) => lv === c.level).map(([, id]) => id)
      .filter((id) => !c.moves.some((m) => m.id === id));
    ups.push({ level: c.level, delta, stats: after, newMoves, hpBefore, healed: hpBefore < after.hp });
  }
  if (c.level >= MAX_LEVEL) c.xp = Math.min(c.xp, xpForLevel(MAX_LEVEL));
  return ups;
}

/** Species this creature should evolve into right now, or null. */
export function pendingEvolution(c) {
  const sp = SPECIES[c.species];
  if (sp.evolvesTo && c.level >= sp.evolveLevel) return sp.evolvesTo;
  return null;
}

export function evolve(c) {
  const target = pendingEvolution(c);
  if (!target) return null;
  const oldMax = maxHp(c);
  c.species = target;
  const newMax = maxHp(c);
  c.hp = Math.min(newMax, c.hp + (newMax - oldMax));
  return target;
}

/** Learn a move: auto if there's room; otherwise caller must pass the slot to replace. */
export function learnMove(c, moveId, replaceIndex = null) {
  const entry = { id: moveId, pp: MOVES[moveId].pp };
  if (c.moves.length < 4) { c.moves.push(entry); return true; }
  if (replaceIndex == null || replaceIndex < 0) return false;
  c.moves[replaceIndex] = entry;
  return true;
}

export function displayName(c) { return SPECIES[c.species].name; }
