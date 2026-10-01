// The SolQuest overworld as a 3D scene, built from the game's own data:
//   * ground: src/data/map.js through the game's buildMap(), textured with the
//     game's tileset (one quad per tile)
//   * props: the game's prop models (tools/props3d.py) exported as meshes by
//     drone/export_props.py, placed where the game places them
//   * tall grass / clumps / hedges / fences: the same models, per tile
// Units: 1 = one tile. X = east, Z = south, Y = up (model units are 16 per tile).
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { buildMap } from '@game/systems/mapBuilder.js';
import { OUTDOOR_W, MAP_H } from '@game/data/map.js';
import tilesMeta from '@game/data/tiles.json';

export const U = {                  // shared uniforms (set every frame by the flight)
  uNight: { value: 0 },
  uTime: { value: 0 },
};

/** Lambert on the baked atlas: alpha < 1 marks emissive texels (windows,
 *  lamps) that glow at night; optional wind sway for the grass. */
export function modelMaterial(map, { sway = false } = {}) {
  const m = new THREE.MeshLambertMaterial({ map, flatShading: true, side: THREE.DoubleSide });
  // Three caches programs by onBeforeCompile's source text, which is the same
  // for both variants: without its own key, a rigid prop (house, lamp, the
  // Hall) can be handed the grass's swaying program and wobble in the wind.
  m.customProgramCacheKey = () => (sway ? 'model-sway' : 'model-rigid');
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        ${sway ? `{
          vec4 wp0 = modelMatrix * vec4(position, 1.0);
          float h = max(position.y, 0.0);
          float g = 0.55 + 0.45 * sin(uTime * 0.37 + wp0.x * 0.05);
          transformed.x += sin(wp0.x * 0.55 - wp0.z * 0.22 - uTime * 2.4) * h * 0.22 * g;
        }` : ''}`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uNight;\nfloat vEm = 0.0;')
      .replace('#include <map_fragment>', `#include <map_fragment>
        vEm = step(sampledDiffuseColor.a, 0.75);
        diffuseColor.a = 1.0;`)
      .replace('#include <opaque_fragment>', `
        outgoingLight = mix(outgoingLight, diffuseColor.rgb * (0.85 + 1.25 * uNight), vEm);
        #include <opaque_fragment>`);
  };
  return m;
}

/** Plain lit material (ground, meadow, hills). */
export function groundMaterial({ map = null, color = null } = {}) {
  const m = new THREE.MeshLambertMaterial({ map, color: color ? new THREE.Color(color) : 0xffffff });
  return m;
}

const crispTexture = (t, repeat = false) => {
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.anisotropy = 8;
  t.colorSpace = THREE.NoColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.needsUpdate = true;
  return t;
};

// ------------------------------------------------------------------ models
const MODEL_CACHE = new Map();
const loader = new THREE.TextureLoader();
async function loadModel(name, index) {
  if (MODEL_CACHE.has(name)) return MODEL_CACHE.get(name);
  const info = index[name];
  const buf = await (await fetch(`/drone/assets/props/${name}.bin`)).arrayBuffer();
  const F = new Float32Array(buf);
  const n = info.verts;
  const pos = new Float32Array(n * 3);
  const uv = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) {
    // model (x east, y south, z up; 16 per tile) -> scene (x, y up, z south; 1 per tile)
    pos[i * 3] = F[i * 5] / 16;
    pos[i * 3 + 1] = F[i * 5 + 2] / 16;
    pos[i * 3 + 2] = F[i * 5 + 1] / 16;
    uv[i * 2] = F[i * 5 + 3];
    uv[i * 2 + 1] = F[i * 5 + 4];
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  const tex = crispTexture(await loader.loadAsync(`/drone/assets/props/${name}.png`));
  const entry = { g, tex };
  MODEL_CACHE.set(name, entry);
  return entry;
}

const placed = (g, x, z, rotY = 0, s = 1) => {
  const c = g.clone();
  const m = new THREE.Matrix4().makeRotationY(rotY).premultiply(new THREE.Matrix4().makeScale(s, s, s));
  m.setPosition(x, 0, z);
  c.applyMatrix4(m);
  return c;
};

// small deterministic hash
const hash = (x, y) => (((x * 73856093) ^ (y * 19349663)) >>> 0);
const rnd = (x, y, k = 0) => (hash(x * 7 + k * 131, y * 13 + k * 17) % 10007) / 10007;

// -------------------------------------------------------------- the world
export async function buildWorld(scene) {
  const index = await (await fetch('/drone/assets/props/index.json')).json();
  const map = buildMap();
  const tw = tilesMeta.tileWidth;
  const th = tilesMeta.tileHeight;

  // ---- ground: the whole route painted into one texture from the game's
  // tileset (one 64x48 tile per map tile), so it mipmaps cleanly
  const tileset = await loader.loadAsync('/assets/tiles/tileset.png');
  const cv = document.createElement('canvas');
  cv.width = OUTDOOR_W * tw;
  cv.height = MAP_H * th;
  const cx = cv.getContext('2d');
  cx.imageSmoothingEnabled = false;
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < OUTDOOR_W; x++) {
      cx.drawImage(tileset.image, map.indices[y][x] * tw, 0, tw, th, x * tw, y * th, tw, th);
    }
  }
  const gtex = crispTexture(new THREE.CanvasTexture(cv));
  const groundGeo = new THREE.PlaneGeometry(OUTDOOR_W, MAP_H, OUTDOOR_W, MAP_H).rotateX(-Math.PI / 2);
  const ground = new THREE.Mesh(groundGeo, groundMaterial({ map: gtex }));
  ground.position.set(OUTDOOR_W / 2, 0, MAP_H / 2);
  ground.receiveShadow = true;
  scene.add(ground);

  // water: the game's water tile, repeating and drifting over the pond tiles
  const tileCanvas = (name) => {
    const c = document.createElement('canvas');
    c.width = tw; c.height = th;
    c.getContext('2d').drawImage(tileset.image, tilesMeta.tiles[name].index * tw, 0, tw, th, 0, 0, tw, th);
    return c;
  };
  const wtex = crispTexture(new THREE.CanvasTexture(tileCanvas('water')), true);
  const wpos = [];
  const wuv = [];
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < OUTDOOR_W; x++) {
      if (map.ground[y][x] !== 'water') continue;
      wpos.push(x, 0.01, y, x, 0.01, y + 1, x + 1, 0.01, y + 1, x, 0.01, y, x + 1, 0.01, y + 1, x + 1, 0.01, y);
      wuv.push(x, -y, x, -y - 1, x + 1, -y - 1, x, -y, x + 1, -y - 1, x + 1, -y);
    }
  }
  const wgeo = new THREE.BufferGeometry();
  wgeo.setAttribute('position', new THREE.Float32BufferAttribute(wpos, 3));
  wgeo.setAttribute('uv', new THREE.Float32BufferAttribute(wuv, 2));
  wgeo.computeVertexNormals();
  const water = new THREE.Mesh(wgeo, groundMaterial({ map: wtex }));
  water.receiveShadow = true;
  scene.add(water);

  // ---- props: every placement of a model merged into one mesh (one atlas)
  const byModel = new Map();
  const add = (name, g) => {
    if (!byModel.has(name)) byModel.set(name, []);
    byModel.get(name).push(g);
  };
  for (const p of map.props) {
    if (p.x >= OUTDOOR_W - 1 && !p.border) continue;                   // the Hall's interior sits east of the route
    if (!index[p.type]) continue;
    const { g } = await loadModel(p.type, index);
    add(p.type, placed(g, p.x, p.y));
  }
  // tall grass (back + front halves) on every encounter tile, clumps on open grass
  const grassSets = new Map();
  const addGrass = (name, g) => { if (!grassSets.has(name)) grassSets.set(name, []); grassSets.get(name).push(g); };
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < OUTDOOR_W; x++) {
      const h = hash(x, y);
      if (map.isEncounter(x, y)) {
        const v = h % 4;
        for (const layer of ['back', 'front']) addGrass(`tall_${layer}${v}`, placed((await loadModel(`tall_${layer}${v}`, index)).g, x, y));
      } else if (map.ground[y][x] === 'grass' && !map.blocked[y][x] && h % 100 < 9) {
        addGrass(`clump${h % 3}`, placed((await loadModel(`clump${h % 3}`, index)).g, x, y));
      }
    }
  }
  for (const [name, list] of grassSets) {
    const mesh = new THREE.Mesh(mergeGeometries(list), modelMaterial(MODEL_CACHE.get(name).tex, { sway: true }));
    mesh.receiveShadow = true;
    scene.add(mesh);
  }

  // ---- beyond the route: rolling meadow, a deep forest, far hills
  const mtex = crispTexture(new THREE.CanvasTexture(tileCanvas('grass')), true);
  const outerGeo = new THREE.PlaneGeometry(900, 900, 90, 90).rotateX(-Math.PI / 2);
  const ouv = outerGeo.attributes.uv;
  for (let i = 0; i < ouv.count; i++) ouv.setXY(i, ouv.getX(i) * 900, ouv.getY(i) * 900);
  const outer = new THREE.Mesh(outerGeo, groundMaterial({ map: mtex, color: '#b8c8a8' }));
  outer.position.set(OUTDOOR_W / 2, -0.12, MAP_H / 2);
  outer.receiveShadow = true;
  scene.add(outer);
  const kinds = ['tree', 'tree2', 'tree', 'tree3', 'tree2', 'tree'];
  for (let z = -40; z < MAP_H + 40; z += 2) {
    for (let x = -40; x < OUTDOOR_W + 40; x += 2) {
      const inside = x >= -1 && x < OUTDOOR_W + 1 && z >= -1 && z < MAP_H + 1;
      if (inside) continue;
      const d = Math.max(-x, x - OUTDOOR_W, -z, z - MAP_H);          // distance out from the route
      if (rnd(x, z, 1) > 0.9 - Math.min(0.5, d * 0.02)) continue;
      const k = kinds[hash(x, z) % kinds.length];
      const { g } = await loadModel(k, index);
      const jx = x + rnd(x, z, 2) * 1.2 - 0.6;
      const jz = z + rnd(x, z, 3) * 1.2 - 0.6;
      add(k, placed(g, jx, jz, 0, 0.9 + rnd(x, z, 4) * 0.5));
    }
  }
  for (const [name, list] of byModel) {
    const m = new THREE.Mesh(mergeGeometries(list), modelMaterial(MODEL_CACHE.get(name).tex));
    m.castShadow = true;
    m.receiveShadow = true;
    scene.add(m);
  }
  // ---- lamps: warm glow sprites at night
  const glowTex = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const x = c.getContext('2d');
    const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,236,170,1)');
    g.addColorStop(0.35, 'rgba(255,200,110,0.45)');
    g.addColorStop(1, 'rgba(255,180,90,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, 64, 64);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.NoColorSpace;
    return t;
  })();
  const glows = [];
  for (const p of map.props) {
    if (p.type !== 'lamp' || p.x >= OUTDOOR_W) continue;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    s.position.set(p.x + 0.5, 2.1, p.y + 0.85);
    s.scale.set(3, 3, 1);
    scene.add(s);
    glows.push(s);
  }

  return { map, water, wtex, glows };
}
