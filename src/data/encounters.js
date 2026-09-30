// Wild encounter zones. Rect zones (side areas) are checked first, then the
// north-south bands of the main route. Starter families never appear wild.
// Levels climb as the route approaches the Elite Hall.
//
// nightBoost: at night these species' weights are multiplied (ghost/dark
// creatures come out after dark). Same rule for every player, driven by the
// in-game clock, so it doesn't make runs unequal.
export const ZONES = [
  {
    id: 'hall', name: 'Elite Hall', rect: [72, 0, 95, 127],
    levels: [20, 22],
    pool: [['mantek', 1]],               // indoors - no grass, never rolled
  },
  {
    id: 'market', name: 'Market Row', rect: [42, 101, 71, 127],
    levels: [3, 6],
    pool: [['boxbun', 60], ['rubyclaw', 40]],
  },
  {
    id: 'pond', name: 'Willow Pond', rect: [40, 63, 71, 99],
    levels: [8, 12],
    pool: [['boxbun', 30], ['rubyclaw', 30], ['mantek', 20], ['scorpix', 14], ['glowblade', 6]],
  },
  {
    id: 'orchard', name: 'Orchard Overlook', rect: [41, 0, 71, 61],
    levels: [16, 22],
    pool: [['rubyclaw', 20], ['mantek', 28], ['scorpix', 26], ['glowblade', 26]],
  },
  {
    id: 'zone1', name: 'Route 1 - South', yMin: 101, yMax: 127,
    levels: [3, 6],
    pool: [['boxbun', 60], ['rubyclaw', 40]],
  },
  {
    id: 'zone2', name: 'The Fork', yMin: 63, yMax: 100,
    levels: [7, 11],
    pool: [['boxbun', 45], ['rubyclaw', 45], ['mantek', 10]],
  },
  {
    id: 'zone3', name: 'Route 1 - North', yMin: 43, yMax: 62,
    levels: [12, 17],
    pool: [['boxbun', 25], ['rubyclaw', 30], ['mantek', 20], ['scorpix', 20], ['glowblade', 5]],
  },
  {
    id: 'zone4', name: 'Elite Approach', yMin: 0, yMax: 42,
    levels: [18, 24],
    pool: [['rubyclaw', 15], ['mantek', 30], ['scorpix', 30], ['glowblade', 25]],
  },
];

export const NIGHT_BOOST = { scorpix: 2, glowblade: 2 };

export function zoneAt(y, x = 22) {
  const r = ZONES.find((z) => z.rect && x >= z.rect[0] && x <= z.rect[2] && y >= z.rect[1] && y <= z.rect[3]);
  if (r) return r;
  return ZONES.find((z) => !z.rect && y >= z.yMin && y <= z.yMax) ?? ZONES.find((z) => z.id === 'zone1');
}

/** Encounter pool for a zone, adjusted for night. */
export function poolFor(zone, night) {
  if (!night) return zone.pool;
  return zone.pool.map(([sp, w]) => [sp, w * (NIGHT_BOOST[sp] ?? 1)]);
}
