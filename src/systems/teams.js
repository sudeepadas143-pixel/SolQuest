// Seeded trainer-team generation.
//
// FAIRNESS NOTE (do not "optimize" away - see BUILD_NOTES.md):
// Teams are rolled ONCE when a save is created, from a seed stored in that
// save, and the rolled teams are persisted. Retrying a trainer, reloading the
// page, or losing never re-rolls. Because beating trainers feeds a scored
// airdrop, a team that could be re-rolled on retry would let players fish for
// an easy matchup. When a wallet is supplied the seed is derived from it, so a
// player also can't re-roll by simply starting a new game with the same wallet.
import { TRAINERS, TRAINER_ORDER, TRAINER_DESIGNS, DESIGN_NAMES } from '../data/trainers.js';
import { SPECIES } from '../data/creatures.js';
import { createCreature } from './creature.js';
import { Rng, hashString, randomSeed } from './rng.js';
import { SEASON_SALT } from '../config.js';

export function normalizeWallet(addr) {
  return (addr ?? '').trim();
}

/** Seed for a new save: wallet-derived when a wallet is given, otherwise random. */
export function makeSeed(wallet) {
  const w = normalizeWallet(wallet);
  if (w) return { seed: hashString(`${SEASON_SALT}|${w.toLowerCase()}`), seedSource: 'wallet' };
  return { seed: randomSeed(), seedSource: 'random' };
}

/**
 * Which character art each slot wears. Artwork only - never affects creatures.
 *  - slots with `design` pinned in data/trainers.js keep it (Cooker = D)
 *  - the Elites get a seeded shuffle of the remaining designs
 *  - each design appears once (4 route Elites <- A, B, C, E in seeded order)
 */
export function assignDesigns(seed) {
  const rng = new Rng(hashString(`${seed}|designs`));
  const out = {};
  for (const id of TRAINER_ORDER) if (TRAINERS[id].design) out[id] = TRAINERS[id].design;
  if (!out.cooker) out.cooker = rng.pick(cookerDesigns());
  const taken = new Set(Object.values(out));
  const pool = rng.shuffle(TRAINER_DESIGNS.filter((d) => !taken.has(d)));
  const reusable = pool.filter((d) => !DESIGN_NAMES[d]);
  let i = 0;
  for (const id of TRAINER_ORDER) {
    if (out[id]) continue;
    // one design per slot; only if content adds more slots than designs does
    // an unnamed design get reused (never a real person twice)
    out[id] = i < pool.length ? pool[i] : rng.pick(reusable.length ? reusable : pool);
    i++;
  }
  return out;
}

export function generateTeams(seed) {
  const teams = {};
  const designs = assignDesigns(seed);
  for (const id of TRAINER_ORDER) {
    const def = TRAINERS[id];
    const rng = new Rng(hashString(`${seed}|team|${id}`));
    const pool = def.pool.filter((s) => SPECIES[s] && !SPECIES[s].starterOnly);
    const picks = rng.shuffle(pool);
    const creatures = [];
    for (let i = 0; i < def.teamSize; i++) {
      const species = picks[i % picks.length];
      const level = rng.int(def.levels[0], def.levels[1]);
      creatures.push(createCreature(species, level, rng, { ivFloor: def.boss ? 18 : 10 }));
    }
    // strongest last, like the main series
    creatures.sort((a, b) => a.level - b.level);
    teams[id] = { design: designs[id], creatures };
  }
  return teams;
}

/** Designs Cooker may wear: never one that is someone else's likeness. */
export function cookerDesigns() {
  const pinned = TRAINERS.cooker.design;
  if (pinned) return [pinned];
  const free = TRAINER_DESIGNS.filter((d) => !DESIGN_NAMES[d] || DESIGN_NAMES[d] === 'Cooker');
  return free.length ? free : TRAINER_DESIGNS;
}

/** Display name for a trainer slot in this save (design name wins, Cooker is always Cooker). */
export function trainerName(teams, id) {
  if (id === 'cooker') return TRAINERS.cooker.name;
  const design = teams?.[id]?.design;
  return (design && DESIGN_NAMES[design]) || TRAINERS[id].name;
}

/**
 * Keep saved artwork in line with the current who's-who mapping (e.g. after a
 * design is identified or pinned). Re-derives every slot's design from the
 * save's seed. Artwork only: creatures - and the fairness guarantees - are
 * untouched.
 */
export function fixDesigns(save) {
  if (!save?.teams) return false;
  const want = assignDesigns(save.seed);
  let changed = false;
  for (const [id, d] of Object.entries(want)) {
    if (save.teams[id] && save.teams[id].design !== d) { save.teams[id].design = d; changed = true; }
  }
  return changed;
}

/**
 * Saves made while the route had a fifth trainer ('t5') are brought in line:
 * that slot is dropped, and any points it awarded are removed from the score.
 */
export function migrateRoster(save) {
  let changed = false;
  for (const id of Object.keys(save.teams ?? {})) {
    if (!TRAINER_ORDER.includes(id)) { delete save.teams[id]; changed = true; }
  }
  for (const id of Object.keys(save.defeated ?? {})) {
    if (!TRAINER_ORDER.includes(id)) { delete save.defeated[id]; changed = true; }
  }
  const stale = (save.scoreLog ?? []).filter((e) => !TRAINER_ORDER.includes(e.trainer));
  if (stale.length) {
    save.score -= stale.reduce((n, e) => n + e.points, 0);
    save.scoreLog = save.scoreLog.filter((e) => TRAINER_ORDER.includes(e.trainer));
    changed = true;
  }
  return changed;
}
