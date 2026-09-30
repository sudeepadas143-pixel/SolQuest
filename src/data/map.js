// Overworld layout, described as drawing operations so it is easy to tweak.
// Coordinates are in tiles; (0,0) is the top-left. The route runs south -> north,
// with side areas to the east for exploring:
//
//   y 116-125  Start town + MARKET ROW to the east (shop, townhouses)  - zone 1 grass
//   y 102-114  Route 1 south + MARKET SQUARE (fountain, gazebo)
//   y 100      Hedge wall; Trainer 1 blocks the only gap          (mandatory)
//   y 71-96    Fork: optional west/east loops with Trainer 2 / 3  - zone 2 grass
//              WILLOW POND to the east (pier, windmill, cabin)    - pond grass
//   y 64-68    Branches reconverge; Solace
//   y 62       Hedge wall; Trainer 4 blocks the gap               (mandatory)
//   y 43-60    Houses + grass                                     - zone 3 grass
//   y 18-41    Final stretch, Solace (grind here for Cooker)  - zone 4 grass
//              ORCHARD OVERLOOK to the east (blossom rows, ridge) - orchard grass
//   y 5-12     Elite Hall - walk into its door to face Cooker
//
// Tile names come from src/data/tiles.json. 'hedge' and 'fence' tiles get a 3D
// segment prop placed on them automatically (see systems/mapBuilder.js).

// The outdoor route is OUTDOOR_W wide; east of it, cut off by void, sits the
// Elite Hall's interior (reached only through the Hall doors - see HALL).
export const OUTDOOR_W = 72;
export const MAP_W = 96;
export const MAP_H = 128;

// Elite Hall interior (tiles, inclusive). entry = where you appear inside,
// exit = the doormat that takes you back out to `out` (in front of the doors).
export const HALL = {
  x0: 76, y0: 2, x1: 92, y1: 24,
  entry: { x: 84, y: 23, facing: 'up' },
  exit: { x: 84, y: 24 },
  out: { x: 22, y: 13, facing: 'down' },
  gate: { x: 84, y: 4 },                 // the Hall of Fame gate behind the dais
  spotRow: 11,                           // Cooker notices you once you pass this row
  // The walk up the carpet (see OverworldScene.hallStep): the aisle braziers
  // are cold until you come; pair n catches fire when you reach igniteRows[n].
  // Pair 3 is the two on the dais, which flare when Cooker shows himself.
  igniteRows: [22, 18, 14],
};

export const PLAYER_START = { x: 22, y: 123, facing: 'up' };

// Blackout return points. You wake at the nearest *unlocked* one (by walking
// distance from where you fell), whether or not you saved. Elite checkpoints
// unlock when that Elite is beaten; Solace checkpoints when you come within
// `near` tiles of the door (or rest there).
export const CHECKPOINTS = [
  { id: 'start', x: 22, y: 123, facing: 'up', label: 'town' },
  { id: 'rest1', x: 29, y: 121, facing: 'down', label: 'the Solace', near: 4 },
  { id: 't1', x: 22, y: 99, facing: 'up', label: 'the first gate', after: 't1' },
  { id: 't2', x: 7, y: 83, facing: 'up', label: 'the west path', after: 't2' },
  { id: 't3', x: 37, y: 83, facing: 'up', label: 'the east path', after: 't3' },
  { id: 'rest2', x: 27, y: 68, facing: 'down', label: 'the Solace', near: 4 },
  { id: 't4', x: 22, y: 61, facing: 'up', label: 'the north gate', after: 't4' },
  { id: 'rest3', x: 16, y: 39, facing: 'down', label: 'the Solace', near: 4 },
];

// [tile, x0, y0, x1, y1] inclusive rectangles, applied in order.
export const GROUND = [
  ['grass', 0, 0, OUTDOOR_W - 1, MAP_H - 1],
  ['void', OUTDOOR_W, 0, MAP_W - 1, MAP_H - 1],
  // ---- Elite Hall interior ----
  ['hall_top', 76, 2, 92, 2], ['hall_wall', 77, 3, 91, 4],
  ['hall_side_l', 76, 3, 76, 23], ['hall_side_r', 92, 3, 92, 23],
  ['hall_floor', 77, 5, 91, 23],
  ['dais', 79, 5, 89, 6], ['dais_edge', 79, 7, 89, 7],
  ['carpet_l', 83, 8, 83, 23], ['carpet_m', 84, 8, 84, 23], ['carpet_r', 85, 8, 85, 23],
  ['hall_bottom', 76, 24, 92, 24], ['hall_mat', 84, 24, 84, 24],

  // ---- tall grass (encounter) patches ----
  ['tall', 4, 103, 16, 114], ['tall', 28, 103, 40, 114],          // zone 1
  ['tall', 9, 75, 17, 91], ['tall', 27, 75, 35, 91],              // zone 2 (inside loops)
  ['tall', 2, 76, 3, 92], ['tall', 41, 76, 41, 82],
  ['tall', 3, 44, 12, 59], ['tall', 32, 44, 40, 59],              // zone 3
  ['tall', 14, 52, 18, 59], ['tall', 26, 44, 30, 49],
  ['tall', 4, 20, 17, 32], ['tall', 27, 20, 40, 38],              // zone 4
  ['tall', 4, 34, 11, 40],
  ['tall', 43, 71, 47, 81], ['tall', 65, 73, 68, 95],             // pond grass
  ['tall', 50, 93, 63, 97],
  ['tall', 43, 52, 68, 59], ['tall', 62, 20, 68, 32],             // orchard grass
  ['tall', 65, 110, 68, 114],                                     // market square meadow

  // ---- flowers for colour ----
  ['flowers', 18, 118, 19, 119], ['flowers', 25, 102, 26, 103], ['flowers', 13, 64, 16, 65],
  ['flowers', 18, 20, 19, 22], ['flowers', 25, 20, 26, 22],
  ['flowers', 44, 103, 45, 113], ['flowers', 61, 103, 62, 104], ['flowers', 49, 64, 52, 65],
  ['flowers', 44, 36, 58, 37],

  // ---- main road (x 20-24: sidewalk | 3 lanes | sidewalk) ----
  ['walk', 20, 14, 20, 125], ['walk', 24, 14, 24, 125],
  ['road', 21, 14, 23, 125], ['road_v', 22, 14, 22, 125],

  // ---- start town street, continuing east into Market Row ----
  ['walk', 3, 121, 68, 121],
  ['road', 3, 122, 68, 124], ['road_h', 3, 123, 68, 123],
  ['road', 21, 122, 23, 124],

  // ---- Market Square (park north of Market Row) ----
  ['plaza', 46, 103, 60, 114],
  ['walk', 42, 115, 44, 120], ['walk', 52, 115, 54, 120],

  // ---- west branch loop ----
  ['road', 6, 94, 19, 96], ['road_h', 6, 95, 19, 95],
  ['road', 5, 71, 7, 96], ['road_v', 6, 71, 6, 96],
  ['road', 5, 71, 19, 73], ['road_h', 8, 72, 19, 72],
  // ---- east branch loop ----
  ['road', 25, 94, 38, 96], ['road_h', 25, 95, 38, 95],
  ['road', 37, 71, 39, 96], ['road_v', 38, 71, 38, 96],
  ['road', 25, 71, 39, 73], ['road_h', 25, 72, 36, 72],

  // ---- Willow Pond ----
  ['dirt', 40, 84, 49, 85],
  ['sand', 49, 74, 64, 92],
  ['water', 50, 75, 63, 90],
  ['bridge', 56, 84, 57, 91],                                     // fishing pier
  ['dirt', 58, 92, 64, 92], ['dirt', 64, 70, 64, 92], ['dirt', 44, 70, 64, 70],

  // ---- Orchard Overlook ----
  ['dirt', 41, 50, 46, 51], ['dirt', 45, 20, 46, 51], ['dirt', 45, 39, 62, 40],
  ['dirt', 61, 12, 62, 40],

  // ---- plaza in front of the Elite Hall ----
  ['plaza', 14, 13, 30, 17],

  // ---- side paths to doors ----
  ['walk', 15, 39, 19, 39],
  ['walk', 25, 68, 29, 68],
  ['walk', 15, 50, 19, 50],

  // ---- hedge walls with a single gap (the trainer stands in it) ----
  ['hedge', 2, 100, 21, 100], ['hedge', 23, 100, 69, 100],
  ['hedge', 2, 62, 21, 62], ['hedge', 23, 62, 69, 62],

  // ---- fences framing the town / hall / pond ----
  ['fence', 2, 116, 17, 116], ['fence', 27, 116, 41, 116],
  ['fence', 2, 17, 13, 17], ['fence', 31, 17, 41, 17],
  ['fence', 49, 98, 64, 98],
];

// Props. x,y = top-left of the footprint (tiles). See PROP_FOOTPRINTS.
export const PROPS = [
  // ---- start town (varied houses) ----
  { type: 'house_red', x: 5, y: 117 },
  { type: 'house_town', x: 11, y: 117 },
  { type: 'rest_house', x: 27, y: 117, rest: 'rest1' },
  { type: 'house_hip', x: 34, y: 117 },
  { type: 'car_blue', x: 7, y: 124 }, { type: 'car_yellow', x: 11, y: 122 },
  { type: 'car_red', x: 33, y: 124 }, { type: 'car_white', x: 37, y: 122 },
  { type: 'lamp', x: 19, y: 120 }, { type: 'lamp', x: 25, y: 120 },
  { type: 'flowerpot', x: 16, y: 120 }, { type: 'flowerpot', x: 40, y: 120 },

  // ---- Market Row ----
  { type: 'shop', x: 45, y: 117 },
  { type: 'house_town2', x: 55, y: 117 },
  { type: 'house_L', x: 62, y: 116 },
  { type: 'lamp', x: 50, y: 120 }, { type: 'lamp', x: 60, y: 120 },
  { type: 'crates', x: 50, y: 118 }, { type: 'barrel', x: 51, y: 118 },
  { type: 'car_red_v', x: 69, y: 118 }, { type: 'car_white', x: 57, y: 124 },

  // ---- Market Square ----
  { type: 'fountain', x: 52, y: 107 },
  { type: 'gazebo', x: 57, y: 104 },
  { type: 'bench', x: 47, y: 105 }, { type: 'bench', x: 47, y: 111 }, { type: 'bench', x: 56, y: 112 },
  { type: 'flowerpot', x: 46, y: 103 }, { type: 'flowerpot', x: 60, y: 103 },
  { type: 'flowerpot', x: 46, y: 114 }, { type: 'flowerpot', x: 60, y: 114 },
  { type: 'lamp', x: 51, y: 103 }, { type: 'lamp', x: 55, y: 111 },
  { type: 'tree3', x: 63, y: 103 }, { type: 'tree3', x: 66, y: 107 }, { type: 'tree', x: 63, y: 111 },

  // ---- route 1 decoration ----
  { type: 'lamp', x: 19, y: 108 }, { type: 'lamp', x: 25, y: 108 },
  { type: 'tree3', x: 17, y: 104 }, { type: 'tree', x: 26, y: 111 },
  { type: 'bush', x: 18, y: 115 }, { type: 'bush', x: 25, y: 115 }, { type: 'bush', x: 3, y: 119 },
  { type: 'bush', x: 41, y: 119 },

  // ---- fork / branches ----
  { type: 'car_red_v', x: 4, y: 84 }, { type: 'car_blue_v', x: 40, y: 78 },
  { type: 'car_white', x: 10, y: 70 }, { type: 'car_yellow', x: 31, y: 70 },
  { type: 'tree2', x: 11, y: 97 }, { type: 'tree3', x: 30, y: 97 },
  { type: 'tree2', x: 2, y: 94 }, { type: 'tree2', x: 40, y: 94 },
  { type: 'bush', x: 20, y: 99 }, { type: 'bush', x: 24, y: 99 },
  { type: 'house_cabin', x: 9, y: 65 },
  { type: 'rest_house', x: 25, y: 64, rest: 'rest2' },
  { type: 'lamp', x: 19, y: 88 }, { type: 'lamp', x: 25, y: 88 },
  { type: 'stump', x: 14, y: 93 }, { type: 'rock', x: 34, y: 93 },

  // ---- Willow Pond ----
  { type: 'windmill', x: 44, y: 64 },
  { type: 'house_cabin', x: 65, y: 64 },
  { type: 'well', x: 61, y: 67 },
  { type: 'bench', x: 52, y: 92 }, { type: 'barrel', x: 58, y: 91 },
  { type: 'tree2', x: 48, y: 72 }, { type: 'tree', x: 66, y: 97 }, { type: 'tree2', x: 43, y: 90 },
  { type: 'tree3', x: 45, y: 94 }, { type: 'boulder', x: 42, y: 86 },
  { type: 'rock', x: 49, y: 91 }, { type: 'rock', x: 63, y: 74 }, { type: 'stump', x: 47, y: 83 },

  // ---- zone 3 ----
  { type: 'house_town2', x: 14, y: 46 },
  { type: 'house_hip2', x: 26, y: 52 },
  { type: 'car_blue', x: 15, y: 51 }, { type: 'car_red', x: 27, y: 57 },
  { type: 'lamp', x: 19, y: 55 }, { type: 'lamp', x: 25, y: 47 },

  // ---- Orchard Overlook ----
  { type: 'house_L', x: 48, y: 42 },
  { type: 'gazebo', x: 57, y: 43 },
  { type: 'bench', x: 55, y: 48 },
  { type: 'tree3', x: 48, y: 21 }, { type: 'tree3', x: 52, y: 21 }, { type: 'tree3', x: 56, y: 21 },
  { type: 'tree3', x: 48, y: 25 }, { type: 'tree3', x: 52, y: 25 }, { type: 'tree3', x: 56, y: 25 },
  { type: 'tree3', x: 48, y: 29 }, { type: 'tree3', x: 52, y: 29 }, { type: 'tree3', x: 56, y: 29 },
  { type: 'tree3', x: 48, y: 33 }, { type: 'tree3', x: 52, y: 33 }, { type: 'tree3', x: 56, y: 33 },
  { type: 'crates', x: 59, y: 36 }, { type: 'barrel', x: 60, y: 36 },
  { type: 'boulder', x: 63, y: 8 }, { type: 'boulder', x: 66, y: 10 }, { type: 'boulder', x: 64, y: 14 },
  { type: 'rock', x: 68, y: 13 }, { type: 'rock', x: 63, y: 17 },
  { type: 'well', x: 42, y: 44 },

  // ---- zone 4 ----
  { type: 'rest_house', x: 14, y: 35, rest: 'rest3' },
  { type: 'tree3', x: 18, y: 26 }, { type: 'tree2', x: 25, y: 30 },
  { type: 'bush', x: 13, y: 16 }, { type: 'bush', x: 31, y: 16 },
  { type: 'lamp', x: 19, y: 34 }, { type: 'lamp', x: 25, y: 34 },

  // ---- Elite Hall + plaza ----
  { type: 'hall', x: 17, y: 5, hall: true },
  // Elite Hall interior: a colonnade up the carpet, braziers on the dais, banners on the wall
  { type: 'pillar', x: 79, y: 10 }, { type: 'pillar', x: 89, y: 10 },
  { type: 'pillar', x: 79, y: 14 }, { type: 'pillar', x: 89, y: 14 },
  { type: 'pillar', x: 79, y: 18 }, { type: 'pillar', x: 89, y: 18 },
  { type: 'pillar', x: 79, y: 22 }, { type: 'pillar', x: 89, y: 22 },
  { type: 'brazier', x: 80, y: 6, aisle: 3 }, { type: 'brazier', x: 88, y: 6, aisle: 3 },
  { type: 'brazier', x: 82, y: 20, aisle: 0 }, { type: 'brazier', x: 86, y: 20, aisle: 0 },
  { type: 'brazier', x: 82, y: 16, aisle: 1 }, { type: 'brazier', x: 86, y: 16, aisle: 1 },
  { type: 'brazier', x: 82, y: 12, aisle: 2 }, { type: 'brazier', x: 86, y: 12, aisle: 2 },
  { type: 'floor_emblem', x: 81, y: 8, deco: true },           // inlaid in the floor - walkable
  { type: 'banner', x: 81, y: 4 }, { type: 'banner', x: 87, y: 4 },
  { type: 'banner', x: 15, y: 11 }, { type: 'banner', x: 29, y: 11 },
  { type: 'lamp', x: 15, y: 15 }, { type: 'lamp', x: 29, y: 15 },
];

// Sign posts: walk into / face + confirm to read.
export const SIGNS = [
  { x: 19, y: 118, text: 'ROUTE 1\nNorth: the Elite Route. Four Elites guard the road - the fifth, COOKER, waits in the Elite Hall.' },
  { x: 42, y: 114, text: 'MARKET ROW\nShops, snacks and the best people-watching on the route.' },
  { x: 25, y: 98, text: 'FORK AHEAD\nWest and East branches loop back to the main road.\nRumor says an Elite waits on each.' },
  { x: 40, y: 86, text: 'WILLOW POND  ->\nMind the pier. Things wash up at the end of it.' },
  { x: 19, y: 69, text: 'The branches meet here.\nThe Solace to the east - free healing.' },
  { x: 25, y: 44, text: 'Tall grass is thicker up north.\nStronger wild creatures ahead.' },
  { x: 43, y: 49, text: 'ORCHARD OVERLOOK\nBlossom rows and a ridge with a view. Explorers welcome.' },
  { x: 19, y: 17, text: 'ELITE HALL\nHome of COOKER.\nEnter only if you are ready.' },
];

// Landmarks you can inspect (face them and press confirm). Keyed by any tile of the prop.
export const LORE = {
  windmill: 'The old windmill still turns on windy nights. Someone oils it, but nobody has seen who.',
  fountain: 'A coin glints at the bottom of the fountain. The water is surprisingly warm.',
  well: 'You peer down the well. Something far below peers back... it was your reflection.',
  gazebo: 'A carved plaque reads: "For everyone who climbed the route."',
  house_cabin: "The cabin smells of pine and pond water. Nobody answers.",
  shop: 'A note on the door: "Back after the Elite battles. Good luck out there!"',
  boulder: 'A mossy boulder. Scratched into it: "TJR was here".',
};

// Items on the map. visible: a capsule you can see; hidden: face the spot and
// press confirm (a faint sparkle gives it away now and then).
export const MAP_ITEMS = [
  { id: 'town_potion', x: 41, y: 118, item: 'potion', hidden: false },
  { id: 'market_hidden', x: 49, y: 113, item: 'superpotion', hidden: true },
  { id: 'square_gem', x: 59, y: 108, item: 'levelgem', hidden: true },
  { id: 'westloop_hidden', x: 8, y: 89, item: 'superpotion', hidden: true },
  { id: 'pier_end', x: 56, y: 84, item: 'levelgem', hidden: false },
  { id: 'windmill_super', x: 48, y: 68, item: 'superpotion', hidden: false },
  { id: 'pond_hidden', x: 67, y: 91, item: 'levelgem', hidden: true },
  { id: 'zone3_hidden', x: 5, y: 45, item: 'hyperpotion', hidden: true },
  { id: 'orchard_hyper', x: 54, y: 31, item: 'hyperpotion', hidden: false },
  { id: 'orchard_hidden', x: 58, y: 27, item: 'levelgem', hidden: true },
  { id: 'overlook_full', x: 66, y: 16, item: 'fullheal', hidden: false },
  { id: 'overlook_gem', x: 68, y: 8, item: 'levelgem', hidden: false },
];

// Trainers stand in the wall gaps (t1, t4 are mandatory) or on the
// branch loops (t2, t3 are optional). After losing they step aside to `moved`.
export const TRAINER_SPOTS = {
  t1: { x: 22, y: 100, facing: 'down', moved: { x: 21, y: 99 } },
  t2: { x: 6, y: 83, facing: 'right' },
  t3: { x: 38, y: 83, facing: 'left' },
  t4: { x: 22, y: 62, facing: 'down', moved: { x: 21, y: 61 } },
  // Cooker waits on the dais inside the Elite Hall; once beaten, steps aside from the gate
  cooker: { x: 84, y: 6, facing: 'down', moved: { x: 86, y: 6 } },
};

// Footprint in tiles (w, h) and where the door is (relative, bottom row).
export const PROP_FOOTPRINTS = {
  tree: { w: 2, h: 2 }, tree2: { w: 2, h: 2 }, tree3: { w: 2, h: 2 },
  bush: { w: 1, h: 1 },
  house_red: { w: 5, h: 4, door: { x: 2, y: 3 } },
  house_blue: { w: 5, h: 4, door: { x: 2, y: 3 } },
  house_green: { w: 5, h: 4, door: { x: 2, y: 3 } },
  house_hip: { w: 5, h: 4, door: { x: 2, y: 3 } },
  house_hip2: { w: 5, h: 4, door: { x: 2, y: 3 } },
  house_town: { w: 4, h: 4, door: { x: 1, y: 3 } },
  house_town2: { w: 4, h: 4, door: { x: 1, y: 3 } },
  house_cabin: { w: 4, h: 4, door: { x: 2, y: 3 } },
  house_L: { w: 6, h: 5, door: { x: 2, y: 4 } },
  shop: { w: 5, h: 4, door: { x: 2, y: 3 } },
  rest_house: { w: 5, h: 4, door: { x: 2, y: 3 } },
  hall: { w: 11, h: 8, door: { x: 5, y: 7 } },
  windmill: { w: 4, h: 4 },
  gazebo: { w: 3, h: 3 },
  fountain: { w: 3, h: 3 },
  well: { w: 2, h: 2 },
  bench: { w: 2, h: 1 },
  rock: { w: 1, h: 1 }, boulder: { w: 2, h: 2 }, stump: { w: 1, h: 1 },
  crates: { w: 1, h: 1 }, barrel: { w: 1, h: 1 }, flowerpot: { w: 1, h: 1 },
  item_ball: { w: 1, h: 1 },
  hedge_seg: { w: 1, h: 1 }, fence_seg: { w: 1, h: 1 },
  car_blue: { w: 2, h: 1 }, car_red: { w: 2, h: 1 }, car_yellow: { w: 2, h: 1 }, car_white: { w: 2, h: 1 },
  car_blue_v: { w: 1, h: 2 }, car_red_v: { w: 1, h: 2 },
  sign: { w: 1, h: 1 },
  lamp: { w: 1, h: 1 },
  banner: { w: 1, h: 1 },
  pillar: { w: 1, h: 1 },
  brazier: { w: 1, h: 1 },
  floor_emblem: { w: 7, h: 3 },
};

// Border of trees around the whole map.
export const BORDER_TREES = true;
