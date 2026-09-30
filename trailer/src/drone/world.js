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
  uSnap: { value: new THREE.Vector2(240, 160) },
  uNight: { value: 0 },
  uTime: { value: 0 },
};

/** Lambert + the retro bits: vertex snapping, baked-emissive faces that glow
 *  at night, optional wind sway, optional affine (PS1-style) texture mapping. */
export function retroMaterial({ map = null, sway = false, affine = false, tint = null } = {}) {
  const m = new THREE.MeshLambertMaterial({ vertexColors: !map && !tint, flatShading: !map, map, side: THREE.DoubleSide });
  if (tint) m.color = new THREE.Color(tint);
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
        attribute float emit;
        varying float vEmit;
        uniform vec2 uSnap;
        uniform float uTime;
        ${affine ? 'varying vec3 vAff;' : ''}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        ${sway ? `{
          vec4 wp0 = modelMatrix * vec4(position, 1.0);
          float h = max(position.y, 0.0);
          float g = 0.55 + 0.45 * sin(uTime * 0.37 + wp0.x * 0.05);
          transformed.x += sin(wp0.x * 0.55 - wp0.z * 0.22 - uTime * 2.4) * h * 0.22 * g;
        }` : ''}`)
      .replace('#include <project_vertex>', `#include <project_vertex>
        vEmit = emit;
        // snap to the low-res pixel grid: the wobble of the old consoles
        // (only in front of the camera: snapping vertices behind it would break clipping)
        if (gl_Position.w > 0.5) gl_Position.xy = floor(gl_Position.xy / gl_Position.w * uSnap + 0.5) / uSnap * gl_Position.w;
        ${affine ? 'vAff = vec3(vMapUv * gl_Position.w, gl_Position.w);' : ''}`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying float vEmit;
        uniform float uNight;
        ${affine ? 'varying vec3 vAff;' : ''}`)
      .replace('#include <opaque_fragment>', `
        outgoingLight = mix(outgoingLight, diffuseColor.rgb * (0.8 + 1.1 * uNight), vEmit);
        #include <opaque_fragment>`);
    if (affine) {
      sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>',
        'vec4 sampledDiffuseColor = texture2D( map, vAff.xy / vAff.z ); diffuseColor *= sampledDiffuseColor;');
    }
  };
  return m;
}

// ------------------------------------------------------------------ models
const MODEL_CACHE = new Map();
async function loadModel(name, index) {
  if (MODEL_CACHE.has(name)) return MODEL_CACHE.get(name);
  const info = index[name];
  const buf = await (await fetch(`/drone/assets/props/${name}.bin`)).arrayBuffer();
  const n = info.tris;
  const P = new Float32Array(buf, 0, n * 9);
  const C = new Uint8Array(buf, n * 36, n * 3);
  const E = new Uint8Array(buf, n * 39, n);
  const pos = new Float32Array(n * 9);
  const col = new Uint8Array(n * 9);
  const emit = new Float32Array(n * 3);
  for (let i = 0; i < n * 3; i++) {
    // model (x east, y south, z up; 16 per tile) -> scene (x, y up, z south; 1 per tile)
    pos[i * 3] = P[i * 3] / 16;
    pos[i * 3 + 1] = P[i * 3 + 2] / 16;
    pos[i * 3 + 2] = P[i * 3 + 1] / 16;
    const t = Math.floor(i / 3);
    col[i * 3] = C[t * 3]; col[i * 3 + 1] = C[t * 3 + 1]; col[i * 3 + 2] = C[t * 3 + 2];
    emit[i] = E[t];
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3, true));
  g.setAttribute('emit', new THREE.BufferAttribute(emit, 1));
  MODEL_CACHE.set(name, g);
  return g;
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

  // ---- ground: one quad per outdoor tile, UVs into the game's tileset
  const tex = await new THREE.TextureLoader().loadAsync('/assets/tiles/tileset.png');
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.NoColorSpace;
  const atlasW = tex.image.width;
  const nT = atlasW / tw;
  const gpos = [];
  const guv = [];
  const wpos = [];
  const wuv = [];
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < OUTDOOR_W; x++) {
      const tile = map.ground[y][x];
      const i = map.indices[y][x];
      const water = tile === 'water';
      const u0 = (i + 0.5 / tw) / nT;
      const u1 = (i + 1 - 0.5 / tw) / nT;
      const v0 = 0.5 / th;
      const v1 = 1 - 0.5 / th;
      const P = water ? wpos : gpos;
      const UV = water ? wuv : guv;
      const yy = water ? -0.03 : 0;
      // two triangles (x east, z south); texture top = north
      P.push(x, yy, y, x, yy, y + 1, x + 1, yy, y + 1, x, yy, y, x + 1, yy, y + 1, x + 1, yy, y);
      if (water) UV.push(x, y, x, y + 1, x + 1, y + 1, x, y, x + 1, y + 1, x + 1, y);
      else UV.push(u0, v1, u0, v0, u1, v0, u0, v1, u1, v0, u1, v1);
    }
  }
  const quadGeo = (P, UV) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2));
    g.setAttribute('emit', new THREE.Float32BufferAttribute(new Float32Array(P.length / 3), 1));
    g.computeVertexNormals();
    return g;
  };
  const ground = new THREE.Mesh(quadGeo(gpos, guv), retroMaterial({ map: tex, affine: true }));
  ground.receiveShadow = true;
  scene.add(ground);

  // water: the game's water tile, repeating and drifting
  const wc = document.createElement('canvas');
  wc.width = tw; wc.height = th;
  const wi = tilesMeta.tiles.water.index;
  wc.getContext('2d').drawImage(tex.image, wi * tw, 0, tw, th, 0, 0, tw, th);
  const wtex = new THREE.CanvasTexture(wc);
  wtex.wrapS = wtex.wrapT = THREE.RepeatWrapping;
  wtex.magFilter = wtex.minFilter = THREE.NearestFilter;
  wtex.generateMipmaps = false;
  wtex.colorSpace = THREE.NoColorSpace;
  const water = new THREE.Mesh(quadGeo(wpos, wuv), retroMaterial({ map: wtex }));
  water.receiveShadow = true;
  scene.add(water);

  // ---- props, merged into chunks (so off-screen chunks are culled)
  const CH = 12;
  const chunks = new Map();
  const add = (g, cx, cz) => {
    const k = `${Math.floor(cx / CH)},${Math.floor(cz / CH)}`;
    if (!chunks.has(k)) chunks.set(k, []);
    chunks.get(k).push(g);
  };
  for (const p of map.props) {
    if (p.x >= OUTDOOR_W - 1 && !p.border) continue;                   // the Hall's interior sits east of the route
    if (p.type === 'floor_emblem' || p.type === 'pillar' || p.type === 'brazier') continue;
    if (!index[p.type]) continue;
    const g = await loadModel(p.type, index);
    add(placed(g, p.x, p.y), p.x, p.y);
  }
  // tall grass (back + front halves) on every encounter tile, clumps on open grass
  const grass = [];
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < OUTDOOR_W; x++) {
      const h = hash(x, y);
      if (map.isEncounter(x, y)) {
        const v = h % 4;
        grass.push(placed(await loadModel(`tall_back${v}`, index), x, y));
        grass.push(placed(await loadModel(`tall_front${v}`, index), x, y));
      } else if (map.ground[y][x] === 'grass' && !map.blocked[y][x] && h % 100 < 9) {
        grass.push(placed(await loadModel(`clump${h % 3}`, index), x, y));
      }
    }
  }
  const grassMesh = new THREE.Mesh(mergeGeometries(grass), retroMaterial({ sway: true }));
  grassMesh.castShadow = false;
  grassMesh.receiveShadow = true;
  scene.add(grassMesh);

  // ---- beyond the route: rolling meadow, a deep forest, far hills
  const outerGeo = new THREE.PlaneGeometry(900, 900, 90, 90).rotateX(-Math.PI / 2);
  outerGeo.setAttribute('emit', new THREE.Float32BufferAttribute(new Float32Array(outerGeo.attributes.position.count), 1));
  const outer = new THREE.Mesh(outerGeo, retroMaterial({ tint: '#4f8f3e' }));
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
      const g = await loadModel(k, index);
      const jx = x + rnd(x, z, 2) * 1.2 - 0.6;
      const jz = z + rnd(x, z, 3) * 1.2 - 0.6;
      add(placed(g, jx, jz, 0, 0.9 + rnd(x, z, 4) * 0.5), jx, jz);
    }
  }
  const propMat = retroMaterial();
  for (const list of chunks.values()) {
    const m = new THREE.Mesh(mergeGeometries(list), propMat);
    m.castShadow = true;
    m.receiveShadow = true;
    scene.add(m);
  }
  // far hills ringing the valley (low-poly, lost in the fog)
  const hillMat = retroMaterial({ tint: '#3f7a4a' });
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2;
    const r = 150 + rnd(i, 3) * 60;
    const geo = new THREE.ConeGeometry(30 + rnd(i, 5) * 40, 20 + rnd(i, 7) * 45, 7, 1).toNonIndexed();
    geo.setAttribute('emit', new THREE.Float32BufferAttribute(new Float32Array(geo.attributes.position.count), 1));
    const hill = new THREE.Mesh(geo, hillMat);
    hill.position.set(OUTDOOR_W / 2 + Math.cos(a) * r, 0, MAP_H / 2 + Math.sin(a) * r * 1.2);
    hill.rotation.y = rnd(i, 9) * 3;
    scene.add(hill);
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

  return { map, water, wtex, glows, grassMesh };
}
