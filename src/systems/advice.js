// Player assistance: the Elites tell you, in their own voice, whether you're
// ready, where to train and what to do next. Pure functions over the save so
// they're easy to test (tools/logic_tests.mjs).
import { SPECIES } from '../data/creatures.js';
import { TRAINERS } from '../data/trainers.js';
import { personality } from '../data/personalities.js';
import { trainerName } from './teams.js';

/** Level at which `c` next evolves, or null when it's in its final form. */
export function nextEvolveLevel(c) {
  return SPECIES[c.species].evolveLevel ?? null;
}

/** How ready the lead creature is for Elite `id`. */
export function readiness(save, id) {
  const c = save.party[0];
  const t = TRAINERS[id];
  const evo = nextEvolveLevel(c);
  const rec = t.rec ?? t.levels[1];
  return {
    level: c.level,
    rec,
    under: c.level < rec - 1,
    // the form this fight is balanced around: you'd evolve on the way to `rec`
    needsForm: evo != null && evo <= rec,
    evo,
  };
}

function fill(lines, vars) {
  const arr = Array.isArray(lines) ? lines : [lines];
  return arr.map((l) => l.replace(/\{(\w+)\}/g, (m, k) => (vars[k] ?? m)));
}

function vars(save, id) {
  const c = save.party[0];
  const t = TRAINERS[id];
  const r = readiness(save, id);
  return {
    MON: SPECIES[c.species].name.toUpperCase(),
    LV: c.level,
    THEIR: t.levels[0] === t.levels[1] ? `${t.levels[0]}` : `${t.levels[0]}-${t.levels[1]}`,
    REC: r.rec,
    WHERE: t.train ?? 'the tall grass',
    EVO: r.evo ?? '',
  };
}

/** Pre-battle warning lines (empty when you're ready). */
export function warning(save, id, design) {
  const r = readiness(save, id);
  const v = personality(design);
  const lines = [];
  if (r.under) lines.push(...fill(v.warn, vars(save, id)));
  if (r.needsForm && (r.under || id === 'cooker')) lines.push(...fill(v.form, vars(save, id)));
  return lines;
}

/** What the Elite tells you after beating you. */
export function coaching(save, id, design) {
  const r = readiness(save, id);
  const v = personality(design);
  return fill(r.level < r.rec || r.needsForm ? v.coach : v.lucky, vars(save, id));
}

/** The player's next goal, as one or two plain sentences. */
export function objective(save) {
  const d = save.defeated;
  const name = (id) => trainerName(save.teams, id);
  if (!d.t1) return [`${name('t1')} is blocking the road north of town. Win there first.`];
  const side = ['t2', 't3'].filter((id) => !d[id]);
  if (side.length === 2) return [`${name('t2')} waits down the west path at the fork, and ${name('t3')} down the east path. The road north opens once both are beaten.`];
  if (side.length === 1) return [`${name(side[0])} is still waiting down the ${side[0] === 't2' ? 'west' : 'east'} path at the fork.`];
  if (!d.t4) return [`${name('t4')} is guarding the gap in the hedge up north, and will battle you now.`];
  if (!d.cooker) {
    const c = save.party[0];
    const evo = nextEvolveLevel(c);
    const out = ['The Elite Hall is at the top of the road. All four crests glow for you now.'];
    if (evo != null) out.push(`Get your ${SPECIES[c.species].name.toUpperCase()} to its final form first. It evolves at Lv ${evo}. The grass on the Elite Approach is the place for it.`);
    return out;
  }
  return ['You beat the Hall. The only thing left to beat is your own time.'];
}
