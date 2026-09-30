// The five Elites: four route trainers + Cooker (final boss, fifth Elite).
//
// Teams are NOT fixed: each trainer has a `pool` of eligible species, and the
// actual team is drawn once per player from a seeded RNG (src/systems/teams.js)
// and stored in the save file. See BUILD_NOTES.md "Seeded teams" for why this
// must stay seeded rather than re-rolled per attempt.
//
// design: which character art the trainer uses ('A'..'E', see ASSET_MANIFEST.md).
//   null = picked by the same seeded RNG (current placeholder until the
//   "who's who" mapping is confirmed - then pin each one here).
// levels: [min, max] per creature. teamSize: creatures in the team.
// points: score for the first win, scaled by difficulty order.
// rec: the lead creature's level where the fight becomes comfortable (~70% win
//   rate in `npm run sim`); below rec - 1 the Elite warns you and offers a way
//   out. train: where to grind for it (said in the Elite's advice lines).

export const TRAINER_DESIGNS = ['A', 'B', 'C', 'D', 'E'];

// Who each character design is (from the owner's "who's who" posts).
// A named design shows that name wherever its trainer appears; unnamed
// designs fall back to the slot name ("Elite Trainer N"). Cooker's slot never
// draws a design that belongs to someone else.
export const DESIGN_NAMES = {
  A: 'TJR',
  B: 'Ansem',
  C: 'Orangie',
  D: 'Cooker',   // updated art supplied (no brand logo); pinned to the Cooker slot below
  E: 'Cented',
};

// Five characters, five Elites: A, B, C and E are the four route Elites (seeded
// order per player); D is Cooker, the fifth, in the Elite Hall.

export const TRAINERS = {
  t1: {
    name: 'Elite Trainer 1', order: 1, design: null,
    pool: ['boxbun', 'rubyclaw'],
    teamSize: 1, levels: [6, 7],
    points: 100,
    reward: { superpotion: 2 },
    rec: 7, train: 'the tall grass on Route 1 - South',
  },
  t2: {
    name: 'Elite Trainer 2', order: 2, design: null,
    pool: ['boxbun', 'rubyclaw', 'mantek'],
    teamSize: 2, levels: [9, 10],
    points: 250,
    reward: { superpotion: 2 },
    rec: 12, train: 'the grass at The Fork, or around Willow Pond',
  },
  t3: {
    name: 'Elite Trainer 3', order: 3, design: null,
    pool: ['boxbun', 'rubyclaw', 'scorpix'],
    teamSize: 2, levels: [9, 10],
    points: 250,
    reward: { superpotion: 2 },
    rec: 12, train: 'the grass at The Fork, or around Willow Pond',
  },
  t4: {
    name: 'Elite Trainer 4', order: 4, design: null,
    pool: ['boxbun', 'rubyclaw', 'mantek', 'scorpix', 'glowblade'],
    teamSize: 2, levels: [14, 16],
    points: 600,
    // blocks the road north: won't fight until both side-path Elites are beaten
    requires: ['t2', 't3'],
    reward: { hyperpotion: 3, fullheal: 1 },
    rec: 16, train: 'the grass around Willow Pond',
  },
  cooker: {
    name: 'Cooker', order: 5, design: 'D', boss: true,
    pool: ['mantek', 'scorpix', 'glowblade'],
    teamSize: 3, levels: [23, 25],
    points: 1500,
    reward: {},
    rec: 23, train: 'the tall grass on the Elite Approach, or up at the Orchard Overlook',
  },
};

export const TRAINER_ORDER = ['t1', 't2', 't3', 't4', 'cooker'];
// The five Elites of the intro: four on the route + Cooker in the Elite Hall.
export const ELITE_IDS = ['t1', 't2', 't3', 't4', 'cooker'];
