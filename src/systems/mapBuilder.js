// Compiles data/map.js into grids the OverworldScene can render and collide against.
import tilesMeta from '../data/tiles.json' with { type: 'json' };
import {
  MAP_W, MAP_H, OUTDOOR_W, GROUND, PROPS, SIGNS, LORE, PROP_FOOTPRINTS, BORDER_TREES, HALL,
} from '../data/map.js';

// Ground tiles that also get a 3D segment prop standing on them.
const SEGMENT_PROPS = { hedge: 'hedge_seg', fence: 'fence_seg' };

export function buildMap() {
  const ground = Array.from({ length: MAP_H }, () => Array(MAP_W).fill('grass'));
  for (const [tile, x0, y0, x1, y1] of GROUND) {
    for (let y = Math.max(0, y0); y <= Math.min(MAP_H - 1, y1); y++) {
      for (let x = Math.max(0, x0); x <= Math.min(MAP_W - 1, x1); x++) ground[y][x] = tile;
    }
  }

  const props = PROPS.map((p) => ({ ...p }));
  if (BORDER_TREES) {
    // mix of tree models so the forest edge doesn't look stamped
    const kind = (x, y) => ['tree', 'tree', 'tree2', 'tree', 'tree3', 'tree2'][(x * 7 + y * 3) % 6];
    for (let y = 0; y < MAP_H; y += 2) {
      props.push({ type: kind(0, y), x: 0, y, border: true });
      props.push({ type: kind(OUTDOOR_W - 2, y), x: OUTDOOR_W - 2, y, border: true });
    }
    for (let x = 2; x < OUTDOOR_W - 2; x += 2) {
      props.push({ type: kind(x, 0), x, y: 0, border: true });
      props.push({ type: kind(x, MAP_H - 2), x, y: MAP_H - 2, border: true });
    }
  }
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      const seg = SEGMENT_PROPS[ground[y][x]];
      if (seg) props.push({ type: seg, x, y, segment: true });
    }
  }
  for (const s of SIGNS) props.push({ type: 'sign', x: s.x, y: s.y, sign: s.text });

  const blocked = ground.map((row) => row.map((t) => !tilesMeta.tiles[t].walkable));
  const doors = new Map();
  const signs = new Map();
  const lore = new Map();
  const key = (x, y) => `${x},${y}`;

  for (const p of props) {
    const fp = PROP_FOOTPRINTS[p.type];
    p.w = fp.w;
    p.h = fp.h;
    for (let dy = 0; dy < fp.h; dy++) {
      for (let dx = 0; dx < fp.w; dx++) {
        const x = p.x + dx;
        const y = p.y + dy;
        if (x >= 0 && y >= 0 && x < MAP_W && y < MAP_H) {
          if (!p.deco) blocked[y][x] = true;           // deco props (floor inlays) stay walkable
          if (LORE[p.type] && !p.border) lore.set(key(x, y), LORE[p.type]);
        }
      }
    }
    if (fp.door) {
      const dx = p.x + fp.door.x;
      const dy = p.y + fp.door.y;
      const kind = p.hall ? 'hall' : p.rest ? 'rest' : 'house';
      doors.set(key(dx, dy), { kind, id: p.rest ?? null, x: dx, y: dy, prop: p.type });
    }
    if (p.sign) signs.set(key(p.x, p.y), p.sign);
  }

  // the Hall's raised dais and staircase: heights (model units) per tile, and
  // the balustrades block. Movement only steps between tiles of similar
  // height (see canStep), so the dais is reached by the stairs alone.
  const elev = Array.from({ length: MAP_H }, () => new Float32Array(MAP_W));
  const st = HALL.stage;
  if (st) {
    for (let y = st.daisY0; y <= st.daisY1; y++) for (let x = st.x0; x <= st.x1; x++) elev[y][x] = st.height;
    const s = st.stairs;
    const rows = s.y1 - s.y0 + 1;
    for (let y = s.y0; y <= s.y1; y++) {
      for (let x = s.x0; x <= s.x1; x++) elev[y][x] = (st.height * (s.y1 + 1 - (y + 0.5))) / rows;
    }
    for (const x of st.rails) for (let y = s.y0; y <= s.y1; y++) blocked[y][x] = true;
  }
  const canStep = (x0, y0, x1, y1) => Math.abs(elev[y1][x1] - elev[y0][x0]) <= 6;

  // grass variety
  const indices = ground.map((row, y) => row.map((t, x) => {
    if (t === 'grass' && (x * 7 + y * 13) % 5 === 0) return tilesMeta.tiles.grass2.index;
    return tilesMeta.tiles[t].index;
  }));

  return {
    w: MAP_W, h: MAP_H, ground, indices, blocked, props, doors, signs, lore, elev, canStep,
    isEncounter: (x, y) => !!tilesMeta.tiles[ground[y]?.[x]]?.encounter,
    key,
  };
}
