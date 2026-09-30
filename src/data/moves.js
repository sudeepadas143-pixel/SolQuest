// Move list. category: 'physical' | 'special' | 'status'.
// Status moves use `effect: { target: 'self'|'foe', stat, stages }`.
// `priority` > 0 moves first. `drain` heals the user for that fraction of damage dealt.
export const MOVES = {
  bump:         { name: 'Bump',          type: 'normal',   category: 'physical', power: 40,  acc: 100, pp: 35 },
  quickjab:     { name: 'Quick Jab',     type: 'normal',   category: 'physical', power: 40,  acc: 100, pp: 30, priority: 1 },
  headcrash:    { name: 'Head Crash',    type: 'normal',   category: 'physical', power: 85,  acc: 90,  pp: 15 },
  snarl:        { name: 'Snarl',         type: 'normal',   category: 'status',   acc: 100, pp: 30, effect: { target: 'foe', stat: 'atk', stages: -1 } },
  stare:        { name: 'Stare Down',    type: 'normal',   category: 'status',   acc: 100, pp: 30, effect: { target: 'foe', stat: 'def', stages: -1 } },
  focus:        { name: 'Focus Up',      type: 'normal',   category: 'status',   acc: 100, pp: 20, effect: { target: 'self', stat: 'atk', stages: 1 } },
  harden:       { name: 'Harden',        type: 'normal',   category: 'status',   acc: 100, pp: 25, effect: { target: 'self', stat: 'def', stages: 1 } },

  spark:        { name: 'Spark Spit',    type: 'fire',     category: 'special',  power: 40,  acc: 100, pp: 25 },
  flamefang:    { name: 'Flame Fang',    type: 'fire',     category: 'physical', power: 65,  acc: 95,  pp: 15 },
  blazerush:    { name: 'Blaze Rush',    type: 'fire',     category: 'physical', power: 90,  acc: 100, pp: 15 },
  infernoroar:  { name: 'Inferno Roar',  type: 'fire',     category: 'special',  power: 110, acc: 85,  pp: 5 },

  watergun:     { name: 'Water Jet',     type: 'water',    category: 'special',  power: 40,  acc: 100, pp: 25 },
  tidefang:     { name: 'Tide Fang',     type: 'water',    category: 'physical', power: 65,  acc: 95,  pp: 15 },
  surge:        { name: 'Surge Wave',    type: 'water',    category: 'special',  power: 90,  acc: 100, pp: 15 },
  maelstrom:    { name: 'Maelstrom',     type: 'water',    category: 'special',  power: 110, acc: 85,  pp: 5 },

  leafflick:    { name: 'Leaf Flick',    type: 'grass',    category: 'special',  power: 40,  acc: 100, pp: 25 },
  vinelash:     { name: 'Vine Lash',     type: 'grass',    category: 'physical', power: 60,  acc: 100, pp: 20 },
  sapdrain:     { name: 'Sap Drain',     type: 'grass',    category: 'special',  power: 60,  acc: 100, pp: 15, drain: 0.5 },
  petalstorm:   { name: 'Petal Storm',   type: 'grass',    category: 'special',  power: 95,  acc: 100, pp: 10 },
  solarflare:   { name: 'Solar Flare',   type: 'fire',     category: 'special',  power: 80,  acc: 100, pp: 10 },
  sunbloom:     { name: 'Sun Bloom',     type: 'grass',    category: 'special',  power: 110, acc: 85,  pp: 5 },
  dawnblaze:    { name: 'Dawn Blaze',    type: 'fire',     category: 'special',  power: 95,  acc: 100, pp: 10 },

  pawsmash:     { name: 'Paw Smash',     type: 'fighting', category: 'physical', power: 60,  acc: 100, pp: 20 },
  hammerfist:   { name: 'Hammer Fist',   type: 'fighting', category: 'physical', power: 85,  acc: 95,  pp: 15 },
  rushkick:     { name: 'Rush Kick',     type: 'fighting', category: 'physical', power: 110, acc: 85,  pp: 5 },

  wyrmclaw:     { name: 'Wyrm Claw',     type: 'dragon',   category: 'physical', power: 80,  acc: 100, pp: 15 },
  drakepulse:   { name: 'Drake Pulse',   type: 'dragon',   category: 'special',  power: 90,  acc: 100, pp: 10 },

  pebbleshot:   { name: 'Pebble Shot',   type: 'rock',     category: 'physical', power: 50,  acc: 95,  pp: 20 },
  crystalspike: { name: 'Crystal Spike', type: 'rock',     category: 'physical', power: 85,  acc: 90,  pp: 10 },

  wisphex:      { name: 'Wisp Hex',      type: 'ghost',    category: 'special',  power: 65,  acc: 100, pp: 15 },
  phantomslash: { name: 'Phantom Slash', type: 'ghost',    category: 'physical', power: 90,  acc: 100, pp: 10 },

  ironedge:     { name: 'Iron Edge',     type: 'steel',    category: 'physical', power: 80,  acc: 100, pp: 15 },
  steelguard:   { name: 'Steel Guard',   type: 'steel',    category: 'status',   acc: 100, pp: 15, effect: { target: 'self', stat: 'def', stages: 2 } },

  venomsting:   { name: 'Venom Sting',   type: 'poison',   category: 'physical', power: 60,  acc: 100, pp: 20 },
  toxicspray:   { name: 'Toxic Spray',   type: 'poison',   category: 'special',  power: 90,  acc: 100, pp: 10 },

  snapbite:     { name: 'Snap Bite',     type: 'dark',     category: 'physical', power: 60,  acc: 100, pp: 25 },
  nightfang:    { name: 'Night Fang',    type: 'dark',     category: 'physical', power: 85,  acc: 95,  pp: 15 },

  chitinbite:   { name: 'Chitin Bite',   type: 'bug',      category: 'physical', power: 60,  acc: 100, pp: 20 },
  twinscythe:   { name: 'Twin Scythe',   type: 'bug',      category: 'physical', power: 90,  acc: 100, pp: 10 },
};
