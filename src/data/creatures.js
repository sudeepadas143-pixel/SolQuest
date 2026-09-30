// Creature species. Sprites are produced by tools/process_assets.py.
//
// tier: 'starter' | 'mid' | 'trainer' | 'boss'   (see README "Creature roster")
// starterOnly: starter families belong only to the player - they never appear
//   wild or on trainer teams (design decision from the asset review).
// base: base stats { hp, atk, def, spa, spd, spe }
// xpYield: base XP when this species is defeated
// learnset: [level, moveId] - a creature knows the last 4 moves learnable at its level.
// evolvesTo / evolveLevel: evolution milestone.
// front/back: sprite keys ('' = art missing; see ASSET_MANIFEST.md)

export const SPECIES = {
  // ---- Fire family (starter) ----------------------------------------------
  emby: {
    name: 'Emby', family: 'fire', stage: 1, tier: 'starter', starterOnly: true,
    types: ['fire'],
    base: { hp: 39, atk: 52, def: 43, spa: 60, spd: 50, spe: 65 },
    xpYield: 62,
    evolvesTo: 'embrute', evolveLevel: 14,
    front: 'emby_front', back: 'emby_back',
    desc: 'A bold little ferret with ember-tipped ears. Hits fast, burns hot.',
    learnset: [[1, 'bump'], [1, 'snarl'], [5, 'spark'], [8, 'pawsmash'], [11, 'quickjab'],
      [13, 'snapbite'], [16, 'flamefang'], [19, 'focus'], [21, 'blazerush'], [24, 'hammerfist'], [27, 'infernoroar']],
  },
  // Emby's line: the upright biped Embrute first, the fox Emberfox as the final form.
  embrute: {
    name: 'Embrute', family: 'fire', stage: 2, tier: 'mid', starterOnly: true,
    types: ['fire'],
    base: { hp: 58, atk: 64, def: 58, spa: 80, spd: 65, spe: 80 },
    xpYield: 142,
    evolvesTo: 'emberfox', evolveLevel: 22,
    front: 'embrute_front', back: 'embrute_back',
    learnset: null, // shares the family learnset (emby)
  },
  emberfox: {
    name: 'Emberfox', family: 'fire', stage: 3, tier: 'trainer', starterOnly: true,
    types: ['fire'],
    base: { hp: 78, atk: 104, def: 78, spa: 109, spd: 85, spe: 100 },
    xpYield: 240,
    front: 'emberfox_front', back: 'emberfox_back',
    learnset: null,
  },

  // ---- Water family (starter) ---------------------------------------------
  sharkpup: {
    name: 'Sharkpup', family: 'water', stage: 1, tier: 'starter', starterOnly: true,
    types: ['water'],
    base: { hp: 45, atk: 55, def: 55, spa: 48, spd: 50, spe: 52 },
    xpYield: 63,
    evolvesTo: 'sharkjaw', evolveLevel: 14,
    front: 'sharkpup_front', back: 'sharkpup_back',
    desc: 'A cheerful shark pup with a sturdy build. Steady, tough, reliable.',
    learnset: [[1, 'bump'], [1, 'snarl'], [5, 'watergun'], [8, 'quickjab'], [11, 'snapbite'],
      [15, 'tidefang'], [18, 'harden'], [21, 'surge'], [23, 'wyrmclaw'], [27, 'maelstrom']],
  },
  sharkjaw: {
    name: 'Sharkjaw', family: 'water', stage: 2, tier: 'mid', starterOnly: true,
    types: ['water'],
    base: { hp: 60, atk: 75, def: 70, spa: 62, spd: 65, spe: 65 },
    xpYield: 142,
    evolvesTo: 'sharkrex', evolveLevel: 22,
    front: 'sharkjaw_front', back: 'sharkjaw_back',
    learnset: null,
  },
  sharkrex: {
    name: 'Sharkrex', family: 'water', stage: 3, tier: 'trainer', starterOnly: true,
    types: ['water', 'dragon'],
    base: { hp: 80, atk: 110, def: 90, spa: 85, spd: 85, spe: 80 },
    xpYield: 239,
    front: 'sharkrex_front', back: 'sharkrex_back',
    learnset: null,
  },

  // ---- Grass family (starter) ---------------------------------------------
  fernie: {
    name: 'Fernie', family: 'grass', stage: 1, tier: 'starter', starterOnly: true,
    types: ['grass'],
    base: { hp: 50, atk: 50, def: 56, spa: 60, spd: 60, spe: 50 },
    xpYield: 64,
    evolvesTo: 'fernbloom', evolveLevel: 14,
    front: 'fernie_front', back: 'fernie_back',
    desc: 'A calm otter wrapped in leaves. Outlasts foes and drains their strength.',
    // Grass is resisted by most Elite creatures, so Fernie picks up coverage
    // early (Paw Smash, Solar Flare) to keep the three starters on par.
    learnset: [[1, 'bump'], [1, 'snarl'], [5, 'leafflick'], [8, 'vinelash'], [11, 'pawsmash'],
      [13, 'solarflare'], [15, 'sapdrain'], [17, 'snapbite'], [19, 'petalstorm'], [21, 'nightfang'], [22, 'dawnblaze'], [26, 'sunbloom']],
  },
  fernbloom: {
    name: 'Fernbloom', family: 'grass', stage: 2, tier: 'mid', starterOnly: true,
    types: ['grass'],
    base: { hp: 72, atk: 68, def: 78, spa: 88, spd: 88, spe: 66 },
    xpYield: 142,
    evolvesTo: 'fernking', evolveLevel: 22,
    front: 'fernbloom_front', back: 'fernbloom_back',
    learnset: null,
  },
  fernking: {
    name: 'Fernking', family: 'grass', stage: 3, tier: 'trainer', starterOnly: true,
    types: ['grass', 'steel'],
    base: { hp: 90, atk: 90, def: 95, spa: 110, spd: 100, spe: 72 },
    xpYield: 236,
    front: 'fernking_front', back: 'fernking_back',
    learnset: null,
  },

  // ---- Wild / trainer creatures (front art only) --------------------------
  boxbun: {
    name: 'Boxbun', tier: 'trainer', types: ['fighting'],
    base: { hp: 60, atk: 80, def: 55, spa: 40, spd: 55, spe: 85 },
    xpYield: 110,
    front: 'boxbun_front', back: '',
    learnset: [[1, 'bump'], [4, 'quickjab'], [8, 'pawsmash'], [13, 'focus'], [19, 'snapbite'],
      [25, 'hammerfist'], [31, 'headcrash'], [37, 'rushkick']],
  },
  rubyclaw: {
    name: 'Rubyclaw', tier: 'trainer', types: ['dragon', 'rock'],
    base: { hp: 70, atk: 90, def: 85, spa: 55, spd: 60, spe: 50 },
    xpYield: 130,
    front: 'rubyclaw_front', back: '',
    learnset: [[1, 'bump'], [4, 'pebbleshot'], [9, 'snarl'], [12, 'snapbite'], [18, 'wyrmclaw'],
      [25, 'crystalspike'], [33, 'drakepulse']],
  },
  mantek: {
    name: 'Mantek', tier: 'boss', types: ['bug', 'steel'],
    base: { hp: 70, atk: 110, def: 95, spa: 55, spd: 75, spe: 70 },
    xpYield: 170,
    front: 'mantek_front', back: '',
    learnset: [[1, 'bump'], [4, 'chitinbite'], [10, 'harden'], [16, 'ironedge'], [22, 'snapbite'],
      [28, 'twinscythe'], [35, 'steelguard']],
  },
  scorpix: {
    name: 'Scorpix', tier: 'boss', types: ['poison', 'dark'],
    base: { hp: 70, atk: 95, def: 70, spa: 95, spd: 70, spe: 100 },
    xpYield: 185,
    front: 'scorpix_front', back: '',
    learnset: [[1, 'bump'], [4, 'venomsting'], [9, 'snarl'], [15, 'snapbite'], [21, 'toxicspray'],
      [27, 'nightfang'], [33, 'wisphex']],
  },
  glowblade: {
    name: 'Glowblade', tier: 'boss', types: ['ghost', 'steel'],
    base: { hp: 70, atk: 115, def: 90, spa: 95, spd: 90, spe: 85 },
    xpYield: 200,
    front: 'glowblade_front', back: '',
    learnset: [[1, 'bump'], [4, 'wisphex'], [10, 'harden'], [16, 'ironedge'], [22, 'phantomslash'],
      [29, 'focus'], [35, 'steelguard']],
  },
};

export const STARTERS = ['emby', 'sharkpup', 'fernie'];

// Species that can appear wild / on trainer teams.
export const NON_STARTERS = Object.keys(SPECIES).filter((id) => !SPECIES[id].starterOnly);

/** Learnset for a species (evolved forms share their family's base learnset). */
export function learnsetOf(id) {
  const sp = SPECIES[id];
  if (sp.learnset) return sp.learnset;
  const root = Object.keys(SPECIES).find((k) => SPECIES[k].family === sp.family && SPECIES[k].stage === 1);
  return SPECIES[root].learnset;
}

/** Sprite key used when the player-facing view is wanted but may be missing. */
export function displaySprite(id, prefer = 'front') {
  const sp = SPECIES[id];
  return sp[prefer] || sp.front || sp.back;
}

/** Texel density of a creature texture (fronts 2x, backs 3x - see config HD). */
export function spriteDensity(key) {
  return key.endsWith('_back') ? 3 : 2;
}
