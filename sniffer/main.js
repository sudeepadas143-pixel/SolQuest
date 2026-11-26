// SNIFFER: a gas-powered skateboard chase through a dusk city, chased by the cops and a helicopter.
// Models: sniffer.glb + board.glb (built in Blender, tools/), murphy.glb + urban.glb (CC-BY, see assets/models/CREDITS.md).
// Look: HOSS-style retro pipeline (post.js), toon gas (gas.js), endless scrolling street.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createPost } from './post.js';
import { createGas } from './gas.js';

/* ================================================================== config */
const SITE = { ticker: '$SNIFF', ca: '', x: '', telegram: '', buy: '', chart: '' };
const MEMES = [ // drop files into memes/ and list them; a missing file shows a placeholder card
  { src: 'assets/sniffer-ref.jpg', name: 'The Suspect', ask: 'Is that a gas mask or a lifestyle?' },
  { src: 'memes/01.webp', name: 'Rush Hour', ask: 'Who opened a window?' },
  { src: 'memes/02.webp', name: 'Drive-Thru', ask: 'Extra beans?' },
  { src: 'memes/03.webp', name: 'Crime Scene', ask: 'Smells like a cover-up?' },
  { src: 'memes/04.webp', name: 'Ollie North', ask: 'Did he just fart mid-air?' },
  { src: 'memes/05.webp', name: 'Green Line', ask: 'Next stop: everywhere?' },
];

/* ================================================================== flags + helpers */
const Q = new URLSearchParams(location.search), $ = id => document.getElementById(id);
const MOBILE = matchMedia('(max-width:820px),(pointer:coarse)').matches;
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const RAW = Q.has('raw'), HOLD = Q.has('hold');
const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const lerp = (a, b, k) => a + (b - a) * k, clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const ease = k => k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
const damp = (dt, r) => dt > 0 ? 1 - Math.exp(-dt * r) : 1;
let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const R01 = Math.random;

/* ================================================================== renderer, sky, fog */
const cvs = $('gl');
const R = new THREE.WebGLRenderer({ canvas: cvs, antialias: RAW, powerPreference: 'high-performance', preserveDrawingBuffer: Q.has('shot') || Q.has('intro') });
R.outputColorSpace = THREE.SRGBColorSpace; R.shadowMap.enabled = true; R.shadowMap.type = THREE.PCFSoftShadowMap;
const post = createPost(R, { mobile: MOBILE });
const scene = new THREE.Scene();
const SUN = V3(.86, .12, -.5).normalize();
// dusk palette; the fog is computed with the same sky function as the dome, so anything fogged melts exactly into the sky
const SKY = { hor: new THREE.Color(0xf0a07a), mid: new THREE.Color(0x9a5d8c), top: new THREE.Color(0x2a2150) };
const SKY_G = { hor: new THREE.Color(0xf2a6bd), mid: new THREE.Color(0x8a62b8), top: new THREE.Color(0x26246a) }; // gallery
const skyU = { uHor: { value: SKY.hor.clone() }, uMid: { value: SKY.mid.clone() }, uTop: { value: SKY.top.clone() }, uSun: { value: SUN } };
const SKY_GLSL = `uniform vec3 uHor,uMid,uTop,uSun;
vec3 skyCol(vec3 d){float y=d.y;vec3 c=mix(uHor,uMid,smoothstep(.0,.28,y));c=mix(c,uTop,smoothstep(.28,.85,y));c=mix(c,uHor*.85,smoothstep(0.,-.25,y));
  float s=max(dot(d,uSun),0.);return c+vec3(1.,.55,.3)*pow(s,7.)*.45+vec3(1.,.8,.55)*pow(s,60.)*.7;}`;
{ // patch three's fog: fade to the sky colour in the view direction
  const C = THREE.ShaderChunk;
  C.fog_pars_vertex += '\n#ifdef USE_FOG\nvarying vec3 vFogDir;\n#endif';
  C.fog_vertex = '#ifdef USE_FOG\nvFogDepth = - mvPosition.z; vFogDir = (modelMatrix * vec4(transformed, 1.)).xyz - cameraPosition;\n#endif';
  C.fog_pars_fragment += `\n#ifdef USE_FOG\nvarying vec3 vFogDir;\n${SKY_GLSL}\n#endif`;
  C.fog_fragment = '#ifdef USE_FOG\ngl_FragColor.rgb = mix(gl_FragColor.rgb, skyCol(normalize(vFogDir)), smoothstep(fogNear, fogFar, vFogDepth));\n#endif';
}
scene.fog = new THREE.Fog(SKY.hor.clone(), 34, 130); scene.background = SKY.hor.clone();
const pm = new THREE.PMREMGenerator(R);
scene.environment = pm.fromScene(new RoomEnvironment(), .04).texture; scene.environmentIntensity = .4;
const cam = new THREE.PerspectiveCamera(32, 1, .1, 420);
scene.add(new THREE.HemisphereLight(0xb9a6d6, 0x4a3030, 1.1));
const sunL = new THREE.DirectionalLight(0xffb98a, 3.0);
sunL.position.set(26, 20, -14); sunL.castShadow = true;
sunL.shadow.mapSize.set(MOBILE ? 1024 : 2048, MOBILE ? 1024 : 2048);
Object.assign(sunL.shadow.camera, { left: -14, right: 14, top: 10, bottom: -10, near: 1, far: 80 });
sunL.shadow.bias = -.0005; sunL.shadow.normalBias = .03; scene.add(sunL, sunL.target);
const fill = new THREE.DirectionalLight(0xc8b8ff, .6); fill.position.set(-10, 6, 14); scene.add(fill);
const sky = new THREE.Mesh(new THREE.SphereGeometry(400, 32, 16), new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false, uniforms: { ...skyU, uT: { value: 0 } },
  vertexShader: 'varying vec3 vP;void main(){vP=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader: `${SKY_GLSL}uniform float uT;varying vec3 vP;float h(vec2 p){return fract(sin(dot(p,vec2(41.3,289.1)))*45758.5);}
    void main(){vec3 d=normalize(vP);vec3 c=skyCol(d);float s=max(dot(d,uSun),0.);c+=vec3(3.,2.,1.2)*smoothstep(.9990,.9995,s);
      float band=smoothstep(.035,.0,abs(d.y-.13-.03*sin(d.x*9.+d.z*5.)))*(.5+.5*sin(d.x*23.+d.z*17.));c=mix(c,vec3(1.,.66,.64),band*.3);
      vec2 g=floor(vec2(atan(d.z,d.x)*180.,d.y*180.));c+=vec3(step(.9967,h(g))*smoothstep(.35,.75,d.y)*(.55+.45*sin(uT*3.+h(g+7.)*40.)));
      gl_FragColor=vec4(c,1.);}`,
})); sky.renderOrder = -1; scene.add(sky);

/* ================================================================== tiny nearest-filtered canvas textures */
function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestMipmapLinearFilter;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); } return t;
}
const specks = (x, w, h, n, f) => { for (let i = 0; i < n; i++) { x.fillStyle = f(); x.fillRect(rnd() * w | 0, rnd() * h | 0, 1, 1); } };
const RZ = 7, PERIOD = 16;
const roadTex = canvasTex(64, 56, (x, w, h) => {
  x.fillStyle = '#46424a'; x.fillRect(0, 0, w, h);
  specks(x, w, h, 1500, () => { const v = 58 + rnd() * 20 | 0; return `rgb(${v},${v - 4},${v + 3})`; });
  const row = z => Math.round((z + RZ) / .25);
  x.fillStyle = 'rgba(25,20,28,.3)'; for (let i = 0; i < 6; i++) x.fillRect(rnd() * w | 0, rnd() * h | 0, 6 + rnd() * 10 | 0, 1);
  for (const c of [-5.25, -1.75, 1.75, 5.25]) for (const o of [-.8, .8]) { x.fillStyle = 'rgba(28,24,30,.22)'; x.fillRect(0, row(c + o), w, 2); } // tyre wear
  x.fillStyle = '#2f2b33'; x.fillRect(40, row(3.2), 6, 6); x.fillStyle = '#56515c'; x.fillRect(41, row(3.2) + 1, 4, 4);
  x.fillStyle = '#e8b84e'; x.fillRect(0, row(-.2), w, 1); x.fillRect(0, row(.15), w, 1);
  x.fillStyle = '#e2ddd2'; for (const z of [-6.7, 6.6]) x.fillRect(0, row(z), w, 1);
  for (const z of [-3.5, 3.5]) { x.fillRect(0, row(z), 12, 1); x.fillRect(32, row(z), 12, 1); }
}, [400 / PERIOD, 1]);
const walkTex = canvasTex(24, 16, (x, w, h) => {
  x.fillStyle = '#9a9296'; x.fillRect(0, 0, w, h); specks(x, w, h, 160, () => { const v = 128 + rnd() * 25 | 0; return `rgb(${v},${v - 6},${v})`; });
  x.fillStyle = '#76707a'; for (let i = 0; i < w; i += 6) x.fillRect(i, 0, 1, h); for (let j = 0; j < h; j += 6) x.fillRect(0, j, w, 1);
}, [400 / 6, 1]);
const facadeTex = canvasTex(16, 32, (x, w, h) => {
  x.fillStyle = '#fff'; x.fillRect(0, 0, w, h);
  for (let f = 0; f < 4; f++) for (let c = 0; c < 4; c++) { x.fillStyle = '#3e4458'; x.fillRect(c * 4 + 1, f * 8 + 2, 2, 3); }
  x.fillStyle = '#d8d2d6'; for (let f = 0; f < 4; f++) x.fillRect(0, f * 8 + 6, w, 1);
}); facadeTex.wrapS = facadeTex.wrapT = THREE.RepeatWrapping;
const windowTex = canvasTex(16, 32, (x, w, h) => {
  x.fillStyle = '#000'; x.fillRect(0, 0, w, h);
  for (let f = 0; f < 4; f++) for (let c = 0; c < 4; c++) { const r = rnd(); if (r < .36) { x.fillStyle = r < .05 ? '#7ad7ff' : r < .08 ? '#ff8fd0' : '#ffc070'; x.fillRect(c * 4 + 1, f * 8 + 2, 2, 3); } }
}); windowTex.wrapS = windowTex.wrapT = THREE.RepeatWrapping;
const leafTex = canvasTex(16, 16, (x, w, h) => { x.fillStyle = '#34502a'; x.fillRect(0, 0, w, h); specks(x, w, h, 120, () => rnd() < .5 ? '#4c7232' : '#28401d'); });
const NEON_WORDS = ['NOODLES', 'PHARMACY', 'LAUNDRO', 'ODOR-EATERS', '24 HR', 'PAWN', 'KARAOKE', 'BEANS', 'LIQUOR', 'NO SMELL', 'GAS', 'TACOS'];
const NEON_COLS = ['#ff5fb4', '#5ff0ff', '#b8ff6a', '#ffcf4a', '#ff7a5a', '#c58aff'];
const neonTex = (word, col) => canvasTex(96, 24, (x, w, h) => { x.fillStyle = '#140c1a'; x.fillRect(0, 0, w, h); x.strokeStyle = col; x.lineWidth = 2; x.strokeRect(2, 2, w - 4, h - 4); x.fillStyle = col; x.font = 'bold 13px monospace'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(word, w / 2, h / 2 + 1); });
const BILLBOARDS = [['SMELL YA LATER', '#d8ff9c', '#1d3a12'], ['HOLD YOUR BREATH', '#ffffff', '#8e1530'], ['$SNIFF', '#1d3a12', '#c3e88a'], ['WANTED: SNIFFER', '#2b1a0e', '#ead39f']];
const billboardTex = ([t, fg, bg]) => canvasTex(128, 48, (x, w, h) => { x.fillStyle = bg; x.fillRect(0, 0, w, h); x.fillStyle = fg; x.font = 'bold 15px monospace'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(t, w / 2, h / 2); x.fillStyle = 'rgba(0,0,0,.25)'; x.fillRect(0, h - 4, w, 4); });

/* ================================================================== merged procedural geometry (vertex colours, 1 draw per material) */
const MAT = {
  flat: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .85, flatShading: true }),
  glow: new THREE.MeshBasicMaterial({ vertexColors: true }),
  bld: new THREE.MeshStandardMaterial({ vertexColors: true, map: facadeTex, emissiveMap: windowTex, emissive: 0xffffff, emissiveIntensity: 1.3, roughness: .92 }),
  leaf: new THREE.MeshStandardMaterial({ vertexColors: true, map: leafTex, roughness: 1, flatShading: true }),
};
const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = V3(), _p = V3();
const T = (x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => _m4.clone().compose(_p.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _s.set(sx, sy, sz));
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d), cyl = (a, b, h, n = 8) => new THREE.CylinderGeometry(a, b, h, n);
function mergeGeos(list) {
  let n = 0; for (const g of list) n += g.attributes.position.count;
  const A = { position: new Float32Array(n * 3), normal: new Float32Array(n * 3), uv: new Float32Array(n * 2), color: new Float32Array(n * 3) };
  let o = 0; for (const g of list) { const c = g.attributes.position.count; for (const k in A) A[k].set(g.attributes[k].array, o * (k === 'uv' ? 2 : 3)); o += c; }
  const m = new THREE.BufferGeometry(); for (const k in A) m.setAttribute(k, new THREE.BufferAttribute(A[k], k === 'uv' ? 2 : 3)); m.computeBoundingSphere(); return m;
}
function bag() {
  const L = new Map();
  return {
    extra: [],
    add(geo, mat, color = 0xffffff, m = null, k = 1) {
      const g = geo.index ? geo.toNonIndexed() : geo.clone();
      if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
      const c = new THREE.Color(color).multiplyScalar(k), a = new Float32Array(g.attributes.position.count * 3);
      for (let i = 0; i < a.length; i += 3) { a[i] = c.r; a[i + 1] = c.g; a[i + 2] = c.b; }
      g.setAttribute('color', new THREE.BufferAttribute(a, 3)); if (m) g.applyMatrix4(m);
      if (!L.has(mat)) L.set(mat, []); L.get(mat).push(g);
    },
    build(shadow = true) { const grp = new THREE.Group(); for (const [mat, list] of L) { const m = new THREE.Mesh(mergeGeos(list), mat); m.castShadow = shadow && mat !== MAT.glow; m.receiveShadow = true; grp.add(m); } for (const e of this.extra) grp.add(e); return grp; },
  };
}

/* ================================================================== the street: static planes, scrolling textures, wrapped tiles */
const SPEED = 22; let dist = 0; const LANE = 1.75;
const road = new THREE.Mesh(new THREE.PlaneGeometry(400, RZ * 2).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: roadTex, roughness: .88 }));
road.receiveShadow = true; scene.add(road);
const walks = [1, -1].map(s => { const m = new THREE.Mesh(new THREE.PlaneGeometry(400, 4).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: walkTex, roughness: .95 })); m.position.set(0, .15, s * 9); m.receiveShadow = true; scene.add(m); return m; });
const curbs = (() => { const B = bag(); for (const s of [1, -1]) B.add(box(400, .15, .25), MAT.flat, 0xa8a0a4, T(0, .075, s * 7.05)); return B.build(); })(); scene.add(curbs);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x302832, roughness: 1 }));
ground.position.y = -.02; scene.add(ground);
const TL = 50, NT = 7, LOOP = TL * NT, HB = 170;
const wrapX = x => ((x + HB) % LOOP + LOOP) % LOOP - HB;
const WALL = [0xcbb6aa, 0xb89c9c, 0xa3a7bb, 0xd4c4a4, 0x938da2, 0xbba9c6, 0xa6b39d];
function building(B, x, z, w, h, d, col) {
  const g = box(w, h, d), uv = g.attributes.uv, S = [[d, h], [d, h], [0, 0], [0, 0], [w, h], [w, h]];
  const ou = (rnd() * 4 | 0) / 4, ov = (rnd() * 4 | 0) / 4;
  for (let f = 0; f < 6; f++) for (let v = 0; v < 4; v++) { const j = f * 4 + v; uv.setXY(j, S[f][0] ? uv.getX(j) * S[f][0] / 8 + ou : 0, S[f][1] ? uv.getY(j) * S[f][1] / 12 + ov : 0); }
  B.add(g, MAT.bld, col, T(x, h / 2, z)); const s = Math.sign(z);
  if (rnd() < .45) { const tx = x + (rnd() - .5) * w * .4, tz = z + (rnd() - .5) * d * .3;
    for (const [a, b] of [[-.6, -.6], [.6, -.6], [-.6, .6], [.6, .6]]) B.add(box(.12, 1.6, .12), MAT.flat, 0x3a2e2a, T(tx + a, h + .8, tz + b));
    B.add(cyl(1, 1, 1.8, 10), MAT.flat, 0x6b4a36, T(tx, h + 2.5, tz)); B.add(new THREE.ConeGeometry(1.1, .8, 10), MAT.flat, 0x4a3a32, T(tx, h + 3.8, tz));
  } else if (rnd() < .6) B.add(box(2 + rnd() * 2, 1, 1.5 + rnd()), MAT.flat, 0x7a7484, T(x + (rnd() - .5) * w * .5, h + .5, z));
  if (h < 16 && rnd() < .3) { const bb = new THREE.Mesh(new THREE.PlaneGeometry(9, 3.4), new THREE.MeshBasicMaterial({ map: billboardTex(BILLBOARDS[rnd() * BILLBOARDS.length | 0]) }));
    bb.position.set(x, h + 3.6, z - s * (d / 2 - 1)); if (s > 0) bb.rotation.y = Math.PI; B.extra.push(bb);
    for (const dx of [-3, 3]) B.add(box(.2, 2, .2), MAT.flat, 0x2a2a30, T(x + dx, h + 1, z - s * (d / 2 - 1))); }
  if (rnd() < .55) { const nm = new THREE.Mesh(new THREE.PlaneGeometry(3.6, .9), new THREE.MeshBasicMaterial({ map: neonTex(NEON_WORDS[rnd() * NEON_WORDS.length | 0], NEON_COLS[rnd() * NEON_COLS.length | 0]) }));
    nm.material.color.setScalar(2.2); nm.position.set(x + (rnd() - .5) * (w - 4), 3.4, z - s * (d / 2 + .05)); if (s > 0) nm.rotation.y = Math.PI; B.extra.push(nm); }
  B.add(box(w * .9, .15, 1.2), MAT.flat, 0x3a2a3a, T(x, 2.9, z - s * (d / 2 + .6)));
}
function lamp(B, x, s) { const z = s * 7.6; B.add(cyl(.07, .1, 6.2, 6), MAT.flat, 0x4a4652, T(x, 3.1, z)); B.add(box(.08, .08, 1.6), MAT.flat, 0x4a4652, T(x, 6.15, z - s * .8)); B.add(box(.5, .14, .3), MAT.flat, 0x2e2b33, T(x, 6.05, z - s * 1.55)); B.add(box(.36, .05, .2), MAT.glow, 0xffd59a, T(x, 5.96, z - s * 1.55), 3); }
function tree(B, x, s) { const z = s * (8.4 + rnd() * .6), h = 2.4 + rnd() * 1.2; B.add(box(1.2, .35, 1.2), MAT.flat, 0x5a5560, T(x, .32, z)); B.add(cyl(.07, .11, h, 5), MAT.flat, 0x4a3628, T(x, h / 2 + .3, z)); for (let k = 0; k < 3; k++) { const r = .8 + rnd() * .5; B.add(new THREE.IcosahedronGeometry(r, 0), MAT.leaf, 0xffffff, T(x + (rnd() - .5) * .8, h + .2 + k * .45, z + (rnd() - .5) * .8, rnd(), rnd(), 0)); } }
function trafficLight(B, x, s) { const z = s * 7.4; B.add(cyl(.08, .1, 5, 6), MAT.flat, 0x2f3336, T(x, 2.5, z)); B.add(box(.1, .1, 3.2), MAT.flat, 0x2f3336, T(x, 4.9, z - s * 1.6)); B.add(box(.35, 1, .3), MAT.flat, 0x1a1a1c, T(x, 4.4, z - s * 3)); for (const [y, c, k] of [[4.72, 0x3a0d0d, 1], [4.42, 0x3a2e0d, 1], [4.12, 0x5bff8a, 3]]) B.add(box(.05, .2, .2), MAT.glow, c, T(x - .19, y, z - s * 3), k); }
function streetStuff(B, x, s) { const r = rnd(), z = s * (8.1 + rnd() * .3);
  if (r < .25) { B.add(cyl(.14, .16, .55, 7), MAT.flat, 0xc23a2a, T(x, .45, z)); B.add(new THREE.SphereGeometry(.15, 7, 4), MAT.flat, 0xc23a2a, T(x, .73, z)); }
  else if (r < .5) B.add(cyl(.26, .22, .9, 8), MAT.flat, 0x3d4a3a, T(x, .6, z)); else if (r < .7) B.add(box(.5, 1.1, .45), MAT.flat, 0x2a4a8a, T(x, .7, z));
  else { B.add(box(1.8, .08, .5), MAT.flat, 0x5a3e2c, T(x, .6, s * 10.3)); B.add(box(1.8, .5, .08), MAT.flat, 0x5a3e2c, T(x, .9, s * 10.55)); } }
function buildTile(i) {
  const B = bag(); seed = 300 + i * 53; const cross = i % 2 === 0;
  if (cross) { for (let k = 0; k < 7; k++) B.add(box(.5, .02, 12.6), MAT.flat, 0xdcd6ca, T(2 + k, .012, 0)); for (const s of [1, -1]) { trafficLight(B, 9.5, s); B.add(box(9, .02, 12), MAT.flat, 0x38333c, T(4.5, .01, s * 15)); } }
  for (const s of [1, -1]) {
    for (const lx of [5, 30]) lamp(B, lx, s);
    for (let x = cross ? 12 : 3; x < TL - 2; x += 9 + rnd() * 7) tree(B, x, s);
    for (let k = 0; k < 3; k++) streetStuff(B, (cross ? 12 : 2) + rnd() * (TL - 14), s);
    let x = cross ? 10 : rnd() * 3;
    for (;;) { const w = 8 + rnd() * 10; if (x + w > TL - .5) break; const d = 9 + rnd() * 6, h = 6 + rnd() * rnd() * 30;
      building(B, x + w / 2, s * (11.6 + d / 2 + rnd() * 1.5), w, h, d, WALL[rnd() * WALL.length | 0]); x += w + .4 + (rnd() < .2 ? 4 : 0); }
  }
  const g = B.build(); g.userData.x0 = i * TL; scene.add(g); return g;
}
const tiles = Array.from({ length: NT }, (_, i) => buildTile(i));

/* ================================================================== loading the models */
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const prog = { sn: 0, bd: 0, cop: 0, urb: 0, font: 0 };
const showProg = () => { const p = Math.round((prog.sn * 35 + prog.bd * 5 + prog.cop * 20 + prog.urb * 25 + prog.font * 15)); $('prog').textContent = p < 100 ? `loading ${p}%` : 'ready'; $('bar').style.width = p + '%'; };
const load = (url, key) => new Promise((res, rej) => loader.load(url, g => { prog[key] = 1; showProg(); res(g); }, e => { if (e.total) { prog[key] = e.loaded / e.total * .95; showProg(); } }, rej));
document.fonts.ready.then(() => { prog.font = 1; showProg(); });
function retro(root, { shadows = true } = {}) { // nearest-filtered textures everywhere (the PS2 look) + shadows
  root.traverse(o => {
    if (!o.isMesh) return; o.castShadow = shadows && !(o.material && o.material.transparent); o.receiveShadow = true; o.frustumCulled = false;
    for (const m of [].concat(o.material)) for (const k of ['map', 'emissiveMap', 'normalMap', 'roughnessMap', 'metalnessMap']) if (m[k]) { m[k].magFilter = THREE.NearestFilter; m[k].minFilter = THREE.NearestMipmapLinearFilter; m[k].needsUpdate = true; }
  });
}
const SPIN = []; // [node, rest quaternion, axle (parent space), radius, owner with userData.d]
function addSpin(o, owner) {
  o.parent.updateWorldMatrix(true, false); const b = new THREE.Box3().setFromObject(o);
  SPIN.push([o, o.quaternion.clone(), V3(0, 0, -1).applyQuaternion(o.parent.getWorldQuaternion(new THREE.Quaternion()).invert()).normalize(), Math.max(.03, (b.max.y - b.min.y) / 2), owner]);
}
function spinWheels(root, re, owner) { root.traverse(o => { if (!re.test(o.name)) return; for (let p = o.parent; p; p = p.parent) if (re.test(p.name)) return; addSpin(o, owner); }); }

/* ================================================================== SNIFFER on his board */
const skater = new THREE.Group(); skater.rotation.order = 'YXZ'; skater.position.set(0, 0, LANE); scene.add(skater);
const boardG = new THREE.Group(), charG = new THREE.Group(); skater.add(boardG, charG);
const DECK = .1, CS = .78; charG.position.y = DECK; charG.scale.setScalar(CS); // CS: Meshy model scale on the board
const butt = new THREE.Object3D(); butt.position.set(0, .26, -.38); charG.add(butt);
const headTop = new THREE.Object3D(); headTop.position.set(0, .7, 0); charG.add(headTop);
const BONES = {}, REST = {};
const sniffReady = load('assets/models/sniffer.glb', 'sn').then(g => {
  retro(g.scene); charG.add(g.scene);
  g.scene.traverse(o => {
    if (o.isBone) { BONES[o.name] = o; REST[o.name] = { q: o.quaternion.clone(), s: o.scale.clone() }; }
    if (o.isMesh) for (const m of [].concat(o.material)) { m.envMapIntensity = .9; if (/Lens|Eye|Face|Snout|Shoe/i.test(m.name)) m.envMapIntensity = 1.6; }
  });
  if (BONES.head) { headTop.removeFromParent(); BONES.head.add(headTop); headTop.position.set(0, .05, 0); }
});
const boardReady = load('assets/models/board.glb', 'bd').then(g => { retro(g.scene); boardG.add(g.scene); g.scene.traverse(o => { if (/^Wheel_/.test(o.name) && o.isMesh) addSpin(o, skater); }); });

/* ================================================================== traffic (opposite carriageway) and the cops */
const traffic = [];
const urbReady = load('assets/models/urban.glb', 'urb').then(g => {
  retro(g.scene); g.scene.updateMatrixWorld(true);
  const kinds = g.scene.getObjectByName('car_low_poly').children.map(o => {
    const t = new THREE.Group(), m = o.clone(); m.applyMatrix4(o.parent.matrixWorld); t.add(m); t.updateMatrixWorld(true);
    const b = new THREE.Box3().setFromObject(m), c = b.getCenter(V3()); m.position.sub(V3(c.x, b.min.y, c.z)); t.rotation.y = Math.PI / 2; t.scale.setScalar(.49); return t;
  });
  let k = 0;
  for (const [z, v, n] of [[-1.75, -16, 4], [-5.25, -12, 4]]) for (let i = 0; i < n; i++) {
    const c = new THREE.Group(); c.add(kinds[(k * 7) % kinds.length].clone()); c.rotation.y = Math.PI; c.position.z = z; c.userData = { x: i * LOOP / n + k * 23, v }; k++;
    scene.add(c); traffic.push(c); spinWheels(c, /^wheel_\d/, c);
  }
});
const cops = [];
const copReady = load('assets/models/murphy.glb', 'cop').then(g => {
  retro(g.scene); g.scene.position.z = 12; g.scene.updateMatrixWorld(true);
  const lb = g.scene.getObjectByName('Murphy92_Lightbar001'), lbBox = lb ? new THREE.Box3().setFromObject(lb) : new THREE.Box3(V3(-.6, 1.5, -.6), V3(.2, 1.6, .6));
  for (const [x0, z0, ph] of [[-8.5, LANE, 0], [-15, 5.0, 2.1]]) {
    const c = new THREE.Group(), body = g.scene.clone(true); c.add(body);
    let ws = null; body.traverse(o => { if (o.isMesh && /Windshield/.test(o.name)) { o.material = o.material.clone(); ws = o; } });
    const top = lbBox.max.y + .02, cx = (lbBox.min.x + lbBox.max.x) / 2, w = (lbBox.max.z - lbBox.min.z) / 2;
    const bars = [0xff2030, 0x2050ff].map((col, i) => { const m = new THREE.Mesh(box(.3, .1, w * .9), new THREE.MeshBasicMaterial({ color: new THREE.Color(col).multiplyScalar(3) })); m.position.set(cx, top - .04, (i ? 1 : -1) * w * .5); c.add(m); return m; });
    const light = new THREE.PointLight(0xff2030, 0, 16, 1.5); light.position.set(cx, top + .6, 0); c.add(light);
    c.userData = { x0, z0, ph, gas: 0, ws, bars, light, d: 0 }; scene.add(c); cops.push(c); spinWheels(body, /^Murphy97_WheelStamp_/, c);
  }
});
// police helicopter (procedural, mostly a silhouette up in the haze) + its searchlight
const heli = new THREE.Group(); scene.add(heli);
{ const B = bag();
  B.add(new THREE.SphereGeometry(1, 12, 8), MAT.flat, 0x1b2440, T(0, 0, 0, 0, 0, 0, 1.7, .95, 1)); B.add(new THREE.SphereGeometry(.8, 10, 6), MAT.flat, 0x8fc4ff, T(.95, .05, 0, 0, 0, 0, .9, .7, .85), .5);
  B.add(cyl(.18, .3, 3.4, 6), MAT.flat, 0x1b2440, T(-2.3, .2, 0, 0, 0, Math.PI / 2 - .08)); B.add(box(.7, 1, .08), MAT.flat, 0xe8e8e8, T(-3.9, .7, 0));
  for (const s of [-1, 1]) B.add(box(2.6, .08, .08), MAT.flat, 0x222222, T(.1, -1.15, s * .7)); B.add(box(.12, .1, .12), MAT.glow, 0xff3040, T(-4, 1.2, 0), 3);
  heli.add(B.build(false)); const rotor = new THREE.Mesh(box(7, .05, .25), new THREE.MeshBasicMaterial({ color: 0x111111 })); const r2 = rotor.clone(); r2.rotation.y = Math.PI / 2; rotor.add(r2); rotor.position.y = 1.05; heli.add(rotor); heli.userData.rotor = rotor; }
const beam = new THREE.Mesh(new THREE.ConeGeometry(1, 1, 24, 1, true).translate(0, -.5, 0).rotateX(-Math.PI / 2),
  new THREE.MeshBasicMaterial({ color: 0xfff0c8, transparent: true, opacity: .03, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
scene.add(beam);
const spot = new THREE.Mesh(new THREE.CircleGeometry(1.15, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xfff0c8, transparent: true, opacity: .06, blending: THREE.AdditiveBlending, depthWrite: false }));
spot.position.y = .03; scene.add(spot);

/* ================================================================== gas */
const GAS = createGas(scene, { max: MOBILE ? 180 : 260 });
GAS.air.set(-SPEED, 0, 0); GAS.setFog(SKY.hor, 40, 130);
const _bp = V3(), _bd = V3(), _cq = new THREE.Quaternion();
function buttWorld() { butt.getWorldPosition(_bp); _bd.set(0, 0, -1).applyQuaternion(charG.getWorldQuaternion(_cq)); return _bp; }
function fartBurst(n = 30, power = 1) { buttWorld(); GAS.burst(_bp, _bd, n, power); RIG.squish = 1; fartSound(power, .35 + power * .35 + R01() * .3); }

/* ================================================================== the rider: procedural pose on the skeleton */
const RIG = { squish: 0, lean: 0, crouch: 0, armsUp: 0, sniff: -1, headYaw: null, ollie: -1, nextOllie: 5, nextFart: 2.5, lastZ: LANE, lastVz: 0, trail: 0, tip: { x: 0, v: 0, py: 0, pv: 0 } };
const HOVER = { k: 0, was: false };
const ptr = { x: 0, y: 0, cx: 0, cy: 0, seen: false };
const _pq = new THREE.Quaternion(), _rq = new THREE.Quaternion(), _ax = V3();
function rotW(b, axis, ang) { if (!b || !ang) return; b.parent.getWorldQuaternion(_pq); _rq.setFromAxisAngle(axis, ang); b.quaternion.premultiply(_pq.clone().invert().multiply(_rq).multiply(_pq)); b.updateMatrixWorld(true); }
let clock = 0, started = false;
function charAxis(x, y, z) { return _ax.set(x, y, z).applyQuaternion(charG.getWorldQuaternion(_cq)).clone(); }
function poseRider(dt, mode) {
  if (!BONES.body) return;
  for (const k in BONES) { BONES[k].quaternion.copy(REST[k].q); BONES[k].scale.copy(REST[k].s); }
  const t = clock, b = REDUCED ? .3 : 1;
  RIG.squish = Math.max(0, RIG.squish - dt * 3.5); const sq = Math.sin(RIG.squish * Math.PI) * .1;
  charG.scale.set(CS * (1 + sq * .5), CS * (1 - sq - RIG.crouch * .08), CS * (1 + sq * .5));
  charG.rotation.x = RIG.lean * .3 + RIG.crouch * .1 - .04 + Math.sin(t * 2.2) * .012 * b; // lean the whole toy, not the robe
  if (mode !== 'alley' || INTRO.ph === 'charge' || INTRO.ph === 'blast') charG.position.y = DECK + Math.sin(t * 9) * .004 * b;
  charG.updateMatrixWorld(true);
  const X = charAxis(1, 0, 0), Y = charAxis(0, 1, 0), Z = charAxis(0, 0, 1);
  let yaw = mode === 'alley' ? (RIG.headYaw ?? 0) : .32, pitch = 0;
  if (mode !== 'alley' && ptr.seen) { yaw += ptr.cx * .22; pitch += ptr.cy * .08; }
  yaw = clamp(yaw, -.45, .45);
  yaw = lerp(yaw, 0, HOVER.k);
  if (RIG.sniff >= 0) yaw = lerp(yaw, -.3, Math.sin(Math.min(1, RIG.sniff / 1.3) * Math.PI));
  RIG.yaw = lerp(RIG.yaw ?? yaw, yaw, damp(dt, 6)); RIG.pitch = lerp(RIG.pitch ?? 0, pitch, damp(dt, 6));
  rotW(BONES.head, Y, RIG.yaw); rotW(BONES.head, X, -RIG.pitch + Math.sin(t * 2.1) * .02 * b); rotW(BONES.head, Z, -RIG.lean * .25);
  headTop.getWorldPosition(_p); const T_ = RIG.tip, vy = dt > 0 ? (_p.y - T_.py) / dt : 0, ay = dt > 0 ? (vy - T_.pv) / dt : 0; T_.py = _p.y; T_.pv = vy;
  for (let i = 0; i < 3; i++) { const h = dt / 3; T_.v += (-110 * T_.x - 5 * T_.v - clamp(ay, -60, 60) * .8) * h; T_.x += T_.v * h; }
  const sw = clamp(T_.x, -.6, .6), flut = mode === 'alley' ? .01 : .05;
  for (const [n, k] of [['tip1', .4], ['tip2', .7], ['tip3', 1]]) { rotW(BONES[n], X, sw * k * .7 + Math.sin(t * 9 + k * 2) * flut * k * b); rotW(BONES[n], Z, Math.sin(t * 6.5 + k) * flut * k * b); }
  const up = .04 + RIG.armsUp * .25 + Math.sin(t * 2.3) * .025 * b; // the Meshy arms are part of the robe: tiny swings only
  rotW(BONES.arm_L, Z, up + RIG.lean * .15); rotW(BONES.arm_R, Z, -(up - RIG.lean * .15));
  const pump = RIG.sniff >= 0 ? Math.max(0, Math.sin(RIG.sniff * 18)) : (RIG.sniffIdle || 0);
  if (BONES.snout) BONES.snout.scale.set(1 + pump * .05, 1 + pump * .12, 1 + pump * .05);
}

/* ================================================================== the ride */
function stepStreet(dt) {
  dist += SPEED * dt; const t = clock, b = REDUCED ? .3 : 1;
  roadTex.offset.x = (dist / PERIOD) % 1; for (const w of walks) w.material.map.offset.x = (dist / 6) % 1;
  for (const g of tiles) g.position.x = wrapX(g.userData.x0 - dist);
  for (const c of traffic) { c.userData.x += (c.userData.v - SPEED) * dt; c.userData.d = (c.userData.d || 0) - c.userData.v * dt; c.position.x = wrapX(c.userData.x); }
  const z = LANE + (.55 * Math.sin(t * .8) + .2 * Math.sin(t * 1.9 + 1)) * b, vz = dt > 0 ? (z - RIG.lastZ) / dt : 0, az = dt > 0 ? (vz - RIG.lastVz) / dt : 0;
  RIG.lastZ = z; RIG.lastVz = vz; RIG.lean = lerp(RIG.lean, clamp(az * .05, -.28, .28), damp(dt, 4));
  skater.position.z = z; skater.rotation.y = -Math.atan2(vz, SPEED); skater.rotation.x = RIG.lean * .6;
  RIG.nextOllie -= dt;
  if (RIG.ollie < 0 && RIG.nextOllie < 0 && !GAL.on && HOVER.k < .1 && !REDUCED) { RIG.ollie = 0; RIG.nextOllie = 5 + R01() * 5; clack(.7); }
  if (RIG.ollie >= 0) {
    RIG.ollie += dt; const u = RIG.ollie / .62;
    skater.position.y = .55 * 4 * u * (1 - u); boardG.rotation.z = u < .3 ? Math.sin(u / .3 * Math.PI) * .4 : 0; RIG.armsUp = Math.sin(u * Math.PI) * .5; RIG.crouch = u < .15 ? 1 - u / .15 : 0;
    if (u >= 1) { RIG.ollie = -1; skater.position.y = 0; boardG.rotation.z = 0; RIG.armsUp = 0; clack(1); RIG.squish = .6; }
  } else skater.position.y = Math.abs(Math.sin(t * 13)) * .006 * b;
  skater.userData.d = dist;
  if (!GAL.sky) { RIG.trail += dt * (MOBILE ? 18 : 30); buttWorld(); for (; RIG.trail >= 1; RIG.trail--) { const k = R01(); GAS.emit(_bp.x + (R01() - .5) * .12, _bp.y + (R01() - .5) * .14, _bp.z + (R01() - .5) * .1, { vx: -R01() * 6, vy: .05 + R01() * .45, vz: _bd.z * (.4 + R01()) + (R01() - .5) * 1.2, life: .7 + R01() * .9, s0: .03, s1: .06 + k * k * .26, heat: .5 + R01() * .4 }); } }
  RIG.nextFart -= dt;
  if (RIG.nextFart < 0 && !GAL.on) { RIG.nextFart = 2.6 + R01() * 3.4; fartBurst(26 + R01() * 16 | 0, .85 + R01() * .45); if (R01() < .5) { RIG.sniff = 0; RIG.sniffed = false; } }
  if (RIG.sniff >= 0) { RIG.sniff += dt; if (RIG.sniff > .45 && !RIG.sniffed) { RIG.sniffed = true; sniffSound(); } if (RIG.sniff > 1.3) RIG.sniff = -1; }
  HOVER.k = lerp(HOVER.k, hoverOn() ? 1 : 0, damp(dt, 6)); const hov = HOVER.k > .5; if (hov && !HOVER.was) fartBurst(16, .6); HOVER.was = hov;
  cops.forEach((c, i) => {
    const u = c.userData, ph = u.ph, exp = GAS.near(c.position.x + 1.8, 1.1, c.position.z, 2.6);
    u.gas = lerp(u.gas, clamp(exp / 7, 0, 1), damp(dt, exp > 1 ? 3 : .45)); const g = u.gas;
    c.position.x = u.x0 + Math.sin(t * .23 + ph) * 1.6 + Math.sin(t * .71 + ph) * .5 - g * 6;
    const cz = u.z0 + Math.sin(t * .47 + ph) * .7 + Math.sin(t * 7.3 + ph) * g * .9, cvz = dt > 0 ? (cz - c.position.z) / dt : 0; c.position.z = cz;
    c.rotation.y = -Math.atan2(cvz, SPEED) + Math.sin(t * 9 + ph) * g * .05;
    if (u.ws) { u.ws.material.color.setRGB(lerp(1, .55, g), 1, lerp(1, .35, g)); if (u.ws.material.emissive) u.ws.material.emissive.setRGB(g * .12, g * .35, 0); }
    const f = (t * 2.4 + i * .3) % 1, red = f < .5 && f % .25 < .16, blue = f >= .5 && f % .25 < .16;
    u.bars[0].visible = red; u.bars[1].visible = blue; u.light.color.set(red ? 0xff2030 : 0x2050ff); u.light.intensity = red || blue ? 9 : 0; u.d = dist;
  });
  heli.position.set(-5 + Math.sin(t * .17) * 3, 14 + Math.sin(t * .5) * .6, -4 + Math.sin(t * .13) * 2); heli.rotation.set(Math.sin(t * .4) * .05, Math.sin(t * .2) * .2, -.12); heli.userData.rotor.rotation.y += dt * 30;
  const tx = skater.position.x + Math.sin(t * 1.3) * .5, tz = skater.position.z + Math.sin(t * 1.1) * .4;
  beam.position.copy(heli.position).add(_p.set(.6, -.9, 0)); beam.lookAt(tx, 0, tz); beam.scale.set(1.1, 1.1, beam.position.distanceTo(_s.set(tx, 0, tz))); spot.position.x = tx; spot.position.z = tz;
  for (const [n, q0, ax, r, o] of SPIN) n.quaternion.setFromAxisAngle(ax, (o.userData.d || 0) / r).multiply(q0);
  sky.position.copy(cam.position);
  sunL.target.position.set(skater.position.x, 0, skater.position.z); sunL.position.copy(sunL.target.position).add(_p.set(26, 20, -14));
}

/* ================================================================== camera stations */
const STATIONS = [
  { name: 'Home', pos: V3(5.4, 1.55, 6.8), look: V3(-1.3, .72, 1.4), fov: 30, ap: .35, par: .5 },
  { name: 'About', pos: V3(2.05, 1.0, 4.6), look: V3(.05, .62, 1.8), lw: V3(.9, .66, 1.8), pl: V3(.05, .52, 1.8), fov: 34, ap: .7, par: .25 },
  { name: 'Memes', pos: V3(-4.6, 1.25, 5.2), look: V3(1.6, .85, 1.7), fov: 42, ap: .15, par: .3 },
];
const ST_ABOUT = 1, ST_MEMES = 2;
let station = clamp(parseInt(Q.get('shot') ?? '0', 10) || 0, 0, 2);
const lookOf = S => innerWidth < innerHeight && S.pl ? S.pl : S.lw ? S.look.clone().lerp(S.lw, clamp((innerWidth / innerHeight - 1.1) / .5, 0, 1)) : S.look;
const camState = { pos: STATIONS[station].pos.clone(), look: lookOf(STATIONS[station]).clone(), fov: STATIONS[station].fov, roll: 0, par: .5, ap: STATIONS[station].ap };
let travel = null, lockUntil = 0;
function go(i, instant = REDUCED) {
  i = clamp(i, 0, STATIONS.length - 1); if (i === station && !instant) return;
  const now = performance.now(); if (now < lockUntil) return; lockUntil = now + 900;
  station = i; const S = STATIONS[i];
  document.querySelectorAll('nav .btn').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.s === i))); $('live').textContent = S.name;
  const ab = $('about'), on = i === ST_ABOUT; ab.classList.toggle('on', on); ab.setAttribute('aria-hidden', String(!on)); ab.toggleAttribute('inert', !on);
  if (GAL.on && i !== ST_MEMES) { endGallery(); instant = true; }
  if (i === ST_MEMES) startGallery();
  if (!instant) $('ui').classList.add('nav-used');
  if (instant) { Object.assign(camState, { pos: S.pos.clone(), look: lookOf(S).clone(), fov: S.fov, par: S.par, ap: S.ap }); travel = null; return; }
  const from = { pos: camState.pos.clone(), look: camState.look.clone(), fov: camState.fov, par: camState.par, ap: camState.ap };
  const mid = from.pos.clone().lerp(S.pos, .5); mid.y += from.pos.distanceTo(S.pos) * .25;
  travel = { from, to: S, mid, t: 0, dur: i === ST_MEMES ? .8 : 2.4 }; whoosh(.6);
}
function stepTravel(dt) {
  if (!travel) return; travel.t = Math.min(1, travel.t + dt / travel.dur);
  const k = ease(travel.t), u = 1 - k, { from, to, mid } = travel;
  camState.pos.set(0, 0, 0).addScaledVector(from.pos, u * u).addScaledVector(mid, 2 * u * k).addScaledVector(to.pos, k * k);
  camState.look.lerpVectors(from.look, lookOf(to), k); camState.fov = lerp(from.fov, to.fov, k) + Math.sin(k * Math.PI) * 7; camState.roll = Math.sin(k * Math.PI) * .06;
  camState.par = lerp(from.par, to.par, k); camState.ap = lerp(from.ap, to.ap, k);
  if (travel.t >= 1) { travel = null; camState.roll = 0; }
}

/* ================================================================== MEMES: mega fart → launch → sky with toon clouds → card carousel */
const GAL = { on: false, t: 0, sky: false, idx: 0, side: 0, yaw: 0, yaw0: 0, slide: 1, ui: 0, hov: 0, fly: 0 };
const STREET = [road, ground, curbs, ...walks, ...tiles, heli, beam, spot];
const CLOUDS = createGas(scene, { max: 220, palette: { lit: 0xfff6fb, mid: 0xf6d6ea, shade: 0xc9a6d6, deep: 0x9a7ab8, line: 0x5a4380 } });
CLOUDS.mesh.visible = CLOUDS.hull.visible = false; CLOUDS.uniforms.uOutline.value = .035; CLOUDS.setFog(SKY_G.hor, 110, 320); CLOUDS.uniforms.uL.value.set(-.5, .8, .4);
{ seed = 909; for (let i = 0; i < 34; i++) {
  const side = rnd() < .5 ? -1 : 1, z = side * (6 + Math.pow(rnd(), .7) * 50); let y = -14 + rnd() * 24; if (Math.abs(z) < 14 && y > -5 && y < 6) y = rnd() < .5 ? -5 - rnd() * 6 : 6 + rnd() * 5;
  const cx = (rnd() - .5) * 200, w = 2.4 + Math.abs(z) / 60 * 6 + rnd() * 2;
  for (let k = 0, n = 4 + (rnd() * 4 | 0); k < n; k++) { const u = rnd() * 2 - 1, h = rnd(); CLOUDS.P.push({ bx: cx + u * w, x: 0, y: y + h * w * .35 * (1 - u * u * .6), z: z + (rnd() - .5) * w * .5, vx: 0, vy: 0, vz: 0, age: .2, life: 1e9, s0: 1, s1: w * (.45 + rnd() * .3) * (1 - Math.abs(u) * .3), drag: 0, seed: rnd(), rx: rnd() * 6, ry: rnd() * 6, heat: 0, squash: .7 + rnd() * .2, buoy: 0, by: 0 }); }
} for (const p of CLOUDS.P) p.by = p.y; }
function stepClouds(shift, lift) { for (const p of CLOUDS.P) { p.x = ((p.bx - shift + 100) % 200 + 200) % 200 - 100; p.y = p.by + lift; p.vx = p.vy = p.vz = 0; } CLOUDS.air.set(0, 0, 0); CLOUDS.step(0, clock); }
const texLoader = new THREE.TextureLoader(), memeTex = [], memeURL = [];
function placeholder(i) { const c = document.createElement('canvas'); c.width = c.height = 512; const x = c.getContext('2d'); const g = x.createRadialGradient(256, 230, 20, 256, 256, 360); g.addColorStop(0, '#c3e88a'); g.addColorStop(1, '#2a4a1a'); x.fillStyle = g; x.fillRect(0, 0, 512, 512); x.fillStyle = '#16300c'; x.font = 'bold 220px monospace'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('?', 256, 230); x.fillStyle = '#f2ffe0'; x.font = 'bold 30px monospace'; x.fillText('MEME #' + (i + 1), 256, 400); x.font = '20px monospace'; x.fillText('drop it in memes/', 256, 440); return c; }
function memeMap(i) { for (const j of [i, (i + 1) % MEMES.length, (i + MEMES.length - 1) % MEMES.length]) if (!memeTex[j]) { memeURL[j] = MEMES[j].src; const t = memeTex[j] = texLoader.load(MEMES[j].src, undefined, undefined, () => { const c = placeholder(j); t.image = c; t.needsUpdate = true; memeURL[j] = c.toDataURL(); }); t.colorSpace = THREE.SRGBColorSpace; } return memeTex[i]; }
const CARD = 1.15;
const card = (() => { const back = new THREE.MeshStandardMaterial({ color: 0x1d3a12, roughness: .5, metalness: .2 }), faces = [0, 1].map(() => new THREE.MeshBasicMaterial({ fog: false })), m = new THREE.Mesh(box(CARD, CARD, .05), [back, back, back, back, ...faces]); m.visible = false; m.userData.faces = faces; scene.add(m); return m; })();
const SKY_CAM = { pos: V3(-5.8, 2.4, 3.6), look: V3(2, .5, 0), fov: 44 };
const _gx = V3(), _gy = V3(), _gz = V3(), _gp = V3(), _gq = new THREE.Quaternion(), _ge = new THREE.Euler();
const galFlash = () => { const f = $('flash'); f.classList.remove('go'); void f.offsetWidth; f.classList.add('go'); };
function setGalUI(on) { const g = $('gal'); g.classList.toggle('on', on); g.setAttribute('aria-hidden', String(!on)); g.toggleAttribute('inert', !on); }
function galCaption() { const m = MEMES[GAL.idx], cap = $('galCap'), b = document.createElement('b'); b.textContent = m.name; cap.replaceChildren(`${GAL.idx + 1}/${MEMES.length} · It's `, b, `. ${m.ask}`); }
function startGallery() { Object.assign(GAL, { on: true, t: 0, sky: false, ui: 0, fly: 0, launched: false }); galCaption(); }
function setSky(on) { SUN.set(on ? -.55 : .86, on ? .3 : .12, on ? .78 : -.5).normalize(); const P = on ? SKY_G : SKY; skyU.uHor.value.copy(P.hor); skyU.uMid.value.copy(P.mid); skyU.uTop.value.copy(P.top); scene.fog.far = on ? 400 : 130; GAS.setFog(P.hor, on ? 60 : 40, on ? 300 : 130); fill.intensity = on ? 1.6 : .6; }
function endGallery() {
  $('galImg').classList.remove('on'); GAL.hov = 0; if (!GAL.on) return; const wasSky = GAL.sky; Object.assign(GAL, { on: false, sky: false, ui: 0 });
  if (wasSky) galFlash(); for (const o of [...STREET, ...traffic, ...cops]) o.visible = true; CLOUDS.mesh.visible = CLOUDS.hull.visible = false; setSky(false);
  GAS.air.set(-SPEED, 0, 0); GAS.clear(); skater.position.set(0, 0, LANE); skater.rotation.set(0, 0, 0); RIG.crouch = RIG.armsUp = 0; charG.position.x = 0;
  card.visible = false; setGalUI(false); cvs.style.cursor = '';
}
function showMeme(dir) { if (!GAL.sky || GAL.slide < 1) return; GAL.idx = (GAL.idx + dir + MEMES.length) % MEMES.length; GAL.slide = 0; GAL.side ^= 1; const f = card.userData.faces[GAL.side]; f.map = memeMap(GAL.idx); f.needsUpdate = true; GAL.yaw0 = GAL.yaw; GAL.yaw += dir * Math.PI; galCaption(); pfft(); }
function stepGallery(dt) {
  if (!GAL.on) return; GAL.t += dt; const t = GAL.t;
  if (!GAL.sky) {
    RIG.crouch = clamp(t / .6, 0, 1); charG.position.x = t < .7 ? Math.sin(clock * 70) * .012 : 0;
    if (t > .7 && !GAL.launched) { GAL.launched = true; fartBurst(70, 2.2); megaFart(); for (const c of cops) c.userData.gas = 1; }
    if (t > .7) { const b = clamp((t - .7) / 1.4, 0, 1); RIG.crouch = 0; RIG.armsUp = .9; skater.position.y = 28 * Math.pow(b, 2.2); skater.position.x = 6 * b; skater.rotation.z = .3 * b;
      buttWorld(); for (let i = 0; i < 3; i++) GAS.emit(_bp.x, _bp.y - .1, _bp.z, { vx: (R01() - .5) * 3, vy: -7 - R01() * 5, vz: (R01() - .5) * 3, life: 2, s0: .3, s1: 1.2, drag: 1.1, heat: 1 }); }
    if (t >= 2.1) { GAL.sky = true; galFlash(); travel = null; GAS.air.set(-12, 0, 0); for (const o of [...STREET, ...traffic, ...cops]) o.visible = false; CLOUDS.mesh.visible = CLOUDS.hull.visible = true; setSky(true); GAS.clear();
      Object.assign(camState, { pos: SKY_CAM.pos.clone(), look: SKY_CAM.look.clone(), fov: SKY_CAM.fov, par: .25, roll: 0, ap: .2 }); }
    return;
  }
  const st = t - 2.1, rise = 1 - Math.pow(1 - clamp(st / 1.5, 0, 1), 3), side = ease(clamp((st - 2) / .8, 0, 1));
  cam.updateMatrixWorld(); _gx.setFromMatrixColumn(cam.matrixWorld, 0); _gy.setFromMatrixColumn(cam.matrixWorld, 1); _gz.setFromMatrixColumn(cam.matrixWorld, 2).negate();
  const portrait = cam.aspect < 1, dC = SKY_CAM.pos.distanceTo(SKY_CAM.look), hh = dC * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)), hw = hh * cam.aspect;
  _gp.copy(SKY_CAM.look).addScaledVector(portrait ? _gy : _gx, side * (portrait ? -hh * .35 : hw * .42));
  skater.position.copy(_gp).addScaledVector(_gy, (1 - rise) * -12); skater.position.y += Math.sin(clock * 1.5) * .15 * rise;
  skater.rotation.set(Math.sin(clock * 1.2) * .08, -.6 + Math.sin(clock * .7) * .1, .25 * (1 - rise) + Math.sin(clock * 1.4) * .05); RIG.armsUp = .45 + Math.sin(clock * 3) * .1;
  buttWorld(); for (let i = 0; i < 2; i++) GAS.emit(_bp.x, _bp.y - .1, _bp.z, { vx: -3 - R01() * 3, vy: -2 - R01() * 2, vz: (R01() - .5) * 1.5, life: 1.4, s0: .14, s1: .5, drag: 1.4, heat: .8 });
  GAL.fly += 28 * dt; stepClouds(GAL.fly, 18 * (1 - rise));
  GAL.ui = clamp((st - 2.2) / .5, 0, 1); if (GAL.ui > 0 && !$('gal').classList.contains('on')) setGalUI(true);
  const D = 3.2, hH = D * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)), hW = hH * cam.aspect, sc = (portrait ? hH * .55 : hH * .82) / CARD;
  const cx = portrait ? 0 : -hW * .42 - (1 - ease(GAL.ui)) * hW, cy = portrait ? hH * .18 : hH * .02;
  GAL.slide = Math.min(1, GAL.slide + dt / .55); const sk = ease(GAL.slide), pop = Math.sin(GAL.slide * Math.PI);
  card.visible = GAL.ui > 0;
  if (card.visible) { const f0 = card.userData.faces[GAL.side]; if (!f0.map) { f0.map = memeMap(GAL.idx); f0.needsUpdate = true; }
    card.position.copy(cam.position).addScaledVector(_gz, D).addScaledVector(_gx, cx).addScaledVector(_gy, cy + pop * .06 * sc); const calm = 1 - GAL.hov;
    card.quaternion.copy(cam.quaternion).multiply(_gq.setFromEuler(_ge.set(Math.sin(clock * .7) * .08 * calm, lerp(GAL.yaw0, GAL.yaw, sk) + Math.sin(clock * .9) * .4 * (1 - pop) * calm, Math.sin(clock * .6) * .06 * calm)));
    card.scale.setScalar(sc * (1 - .08 * pop)); }
  const c = _gp.copy(cam.position).addScaledVector(_gz, D).addScaledVector(_gx, cx).addScaledVector(_gy, cy).project(cam), w = CARD * sc / (2 * hW), h = CARD * sc / (2 * hH);
  const over = card.visible && ptr.seen && GAL.slide >= 1 && Math.abs(ptr.x - c.x) < w && Math.abs(-ptr.y - c.y) < h; GAL.hov = lerp(GAL.hov, over ? 1 : 0, damp(dt, 10));
  const img = $('galImg'); if (img.dataset.i !== String(GAL.idx) && memeURL[GAL.idx]) { img.src = memeURL[GAL.idx]; img.alt = MEMES[GAL.idx].name; img.dataset.i = GAL.idx; }
  Object.assign(img.style, { left: `${(c.x - w + 1) / 2 * 100}%`, top: `${(1 - c.y - h) / 2 * 100}%`, width: `${w * 100}%`, height: `${h * 100}%` }); img.classList.toggle('on', GAL.hov > .6); cvs.style.cursor = over ? 'zoom-in' : '';
  for (const [id, s] of [['galPrev', -1], ['galNext', 1]]) { const p = _gp.copy(cam.position).addScaledVector(_gz, D).addScaledVector(_gx, cx + s * (CARD * sc * .5 + .3 * sc)).addScaledVector(_gy, cy).project(cam); Object.assign($(id).style, { left: `${(p.x + 1) / 2 * 100}%`, top: `${(1 - p.y) / 2 * 100}%` }); }
}

/* ================================================================== INTRO: a back alley. Manhole steam → pull back → RIDE → hop on, charge, gas the screen */
const alley = new THREE.Scene(); alley.background = new THREE.Color(0x0b0714); alley.fog = new THREE.Fog(0x0b0714, 4, 15); alley.environment = scene.environment; alley.environmentIntensity = .25;
const brickTex = canvasTex(32, 32, (x, w, h) => { x.fillStyle = '#4a2a2e'; x.fillRect(0, 0, w, h); for (let r = 0; r < 8; r++) for (let c = 0; c < 4; c++) { const v = 80 + rnd() * 40 | 0; x.fillStyle = `rgb(${v + 30},${v - 20},${v - 25})`; x.fillRect(c * 8 + (r % 2) * 4, r * 4, 7, 3); } }, [6, 2]);
const wetTex = canvasTex(32, 64, (x, w, h) => { x.fillStyle = '#1c1820'; x.fillRect(0, 0, w, h); specks(x, w, h, 500, () => { const v = 30 + rnd() * 25 | 0; return `rgb(${v},${v - 3},${v + 6})`; }); }, [3, 6]);
const graffitiTex = canvasTex(128, 64, (x, w, h) => { x.font = 'bold 40px Impact, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineWidth = 6; x.strokeStyle = '#10240a'; x.strokeText('SNIFF', w / 2, h / 2); x.fillStyle = '#b8e07a'; x.fillText('SNIFF', w / 2, h / 2); for (let i = 0; i < 9; i++) x.fillRect(20 + rnd() * 88, h / 2 + 12, 2, 6 + rnd() * 18); });
const noFartTex = canvasTex(32, 32, (x) => { x.fillStyle = '#f2f2ee'; x.fillRect(0, 0, 32, 32); x.strokeStyle = '#c21f2f'; x.lineWidth = 3; x.beginPath(); x.arc(16, 16, 12, 0, 7); x.stroke(); x.fillStyle = '#5a7a3a'; x.beginPath(); x.arc(16, 17, 6, 0, 7); x.fill(); x.beginPath(); x.moveTo(7, 7); x.lineTo(25, 25); x.stroke(); });
{ const add = (geo, mat, x, y, z, ry = 0, rx = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, 0); m.receiveShadow = true; alley.add(m); return m; };
  add(new THREE.PlaneGeometry(5, 16), new THREE.MeshStandardMaterial({ map: wetTex, roughness: .3, metalness: .15 }), 0, 0, -3, 0, -Math.PI / 2);
  const brick = new THREE.MeshStandardMaterial({ map: brickTex, roughness: .95 });
  add(new THREE.PlaneGeometry(16, 6), brick, -2.3, 3, -3, Math.PI / 2); add(new THREE.PlaneGeometry(16, 6), brick, 2.3, 3, -3, -Math.PI / 2); add(new THREE.PlaneGeometry(5, 6), brick, 0, 3, -10);
  add(new THREE.PlaneGeometry(2.4, 1.2), new THREE.MeshBasicMaterial({ map: graffitiTex, transparent: true, color: new THREE.Color(.6, .6, .6) }), -2.28, 1.5, -.8, Math.PI / 2);
  add(new THREE.PlaneGeometry(.5, .5), new THREE.MeshStandardMaterial({ map: noFartTex, roughness: .7 }), 2.28, 1.7, -1.6, -Math.PI / 2);
  add(box(1.2, 2.1, .1), new THREE.MeshStandardMaterial({ color: 0x2a2f35, roughness: .7 }), 0, 1.05, -9.94); add(box(.5, .18, .05), new THREE.MeshBasicMaterial({ color: new THREE.Color(0x6bff7a).multiplyScalar(2) }), 0, 2.4, -9.9);
  const B = bag(); B.add(box(1.7, 1.15, 1), MAT.flat, 0x2f5a5a, T(-1.55, .58, -2.2)); B.add(box(1.75, .1, 1.05), MAT.flat, 0x244848, T(-1.55, 1.2, -2.25, -.2));
  seed = 515; for (let i = 0; i < 5; i++) { const s = .35 + rnd() * .2; B.add(new THREE.IcosahedronGeometry(s, 1), MAT.flat, 0x141418, T(1.7 + (rnd() - .5) * .6, s * .7, -3 + (rnd() - .5) * 1.4, rnd(), rnd(), 0, 1, .75, 1)); }
  for (const y of [2.6, 2.9]) B.add(cyl(.06, .06, 12, 6), MAT.flat, 0x5a5a62, T(2.18, y, -4, Math.PI / 2)); B.add(cyl(.06, .06, 3.2, 6), MAT.flat, 0x5a5a62, T(2.18, 1.3, -.9));
  B.add(cyl(.42, .42, .02, 18), MAT.flat, 0x2a2a30, T(.55, .01, .9)); for (let k = 0; k < 4; k++) B.add(box(.5, .022, .05), MAT.glow, 0x7dff5a, T(.55, .012, .72 + k * .12), 2.5);
  alley.add(B.build()); }
alley.add(new THREE.HemisphereLight(0x5a4a8a, 0x1a1218, .8));
const doorLamp = new THREE.PointLight(0xffb36b, 7, 7, 1.6); doorLamp.position.set(0, 2.9, -9.2); alley.add(doorLamp);
const holeLight = new THREE.PointLight(0x9dff6a, 3.5, 3.5, 1.5); holeLight.position.set(.55, .35, .9); alley.add(holeLight);
const keyA = new THREE.SpotLight(0xffe2c8, 14, 9, .6, .6, 1.4); keyA.position.set(1.6, 3.2, 2.6); keyA.target.position.set(0, .5, 0); keyA.castShadow = true; alley.add(keyA, keyA.target);
const copL = [0xff2030, 0x2050ff].map((c, i) => { const l = new THREE.PointLight(c, 0, 12, 1.4); l.position.set(i ? 1.3 : -1.3, 1.7, 5.5); alley.add(l); return l; });
const AK = { hole: { pos: V3(.55, .55, 1.65), look: V3(.55, 0, .85), fov: 40 }, wide: { pos: V3(.25, 1.05, 3.4), look: V3(.1, .6, 0), fov: 40 }, low: { pos: V3(.8, .55, 2.6), look: V3(0, .5, -2), fov: 46 } };
const INTRO = { on: false, ph: 'off', t: 0, a: null, b: null, bt: 0, dur: 1 };
function camKey(k, dur) { INTRO.a = { pos: camState.pos.clone(), look: camState.look.clone(), fov: camState.fov }; INTRO.b = AK[k]; INTRO.bt = 0; INTRO.dur = dur; }
function stepCamKey(dt) { if (!INTRO.b) return; INTRO.bt = Math.min(1, INTRO.bt + dt / INTRO.dur); const k = ease(INTRO.bt); camState.pos.lerpVectors(INTRO.a.pos, INTRO.b.pos, k); camState.look.lerpVectors(INTRO.a.look, INTRO.b.look, k); camState.fov = lerp(INTRO.a.fov, INTRO.b.fov, k); }
function startIntro() {
  INTRO.on = true; INTRO.ph = 'pull'; INTRO.t = 0; alley.add(skater); GAS.attach(alley); GAS.air.set(0, 0, 0); GAS.clear(); GAS.setFog(new THREE.Color(0x0b0714), 4, 15); GAS.uniforms.uAmb.value.setRGB(.42, .62, .4);
  skater.position.set(0, 0, 0); skater.rotation.set(0, Math.PI / 2, 0); boardG.position.set(-.15, 0, .55); boardG.rotation.set(0, .35, 0);
  charG.position.set(0, 0, -.25); charG.rotation.y = -Math.PI / 2;
  Object.assign(camState, { pos: AK.hole.pos.clone(), look: AK.hole.look.clone(), fov: AK.hole.fov, par: 0, roll: 0, ap: .8 }); camKey('wide', 4.5); sirenFar();
}
function rideClick() { if (INTRO.ph !== 'wait') return; $('ride').classList.remove('on'); INTRO.ph = 'hop'; INTRO.t = 0; camKey('low', .9); clack(.6); }
function stepIntro(dt) {
  INTRO.t += dt; const t = INTRO.t; stepCamKey(dt);
  const f = (clock * 1.6) % 1; copL[0].intensity = f < .5 && f % .25 < .15 ? 10 : 0; copL[1].intensity = f >= .5 && f % .25 < .15 ? 10 : 0; doorLamp.intensity = 7 * (R01() < .03 ? .2 : 1);
  if (R01() < dt * 5) GAS.emit(.55 + (R01() - .5) * .5, .05, .9 + (R01() - .5) * .5, { vx: (R01() - .5) * .2, vy: .45 + R01() * .3, vz: (R01() - .5) * .2, life: 2.2, s0: .04, s1: .17, drag: .6, heat: .2, buoy: .45 });
  if (INTRO.ph === 'pull' || INTRO.ph === 'wait') {
    RIG.headYaw = Math.sin(clock * .7) * .55 + (copL[0].intensity > 0 ? -.25 : copL[1].intensity > 0 ? .25 : 0);
    RIG.sniffIdle = Math.max(0, Math.sin(clock * 9)) * (Math.sin(clock * .9) > .3 ? 1 : 0);
    if (INTRO.ph === 'pull' && t > 4.6) { INTRO.ph = 'wait'; $('ride').classList.add('on'); $('ride').focus({ preventScroll: true }); }
  }
  if (INTRO.ph === 'hop') { RIG.sniffIdle = 0; const k = clamp(t / .45, 0, 1);
    boardG.rotation.y = lerp(.35, 0, k); boardG.position.set(lerp(-.15, 0, k), 0, lerp(.55, 0, k));
    charG.position.set(0, DECK * k + Math.sin(k * Math.PI) * .35, lerp(-.25, 0, k)); charG.rotation.y = lerp(-Math.PI / 2, 0, k); RIG.headYaw = lerp(RIG.headYaw ?? 0, 1.2, k * .3);
    if (k >= 1) { INTRO.ph = 'charge'; INTRO.t = 0; clack(1); chargeSound(); } }
  if (INTRO.ph === 'charge') { RIG.crouch = clamp(t / .5, 0, 1); charG.position.x = Math.sin(clock * 80) * .012; RIG.headYaw = 1.2;
    if (R01() < dt * 18) { buttWorld(); GAS.emit(_bp.x, _bp.y, _bp.z, { vx: 0, vy: .3, vz: .4, life: 1, s0: .05, s1: .2, heat: 1 }); }
    if (t > .95) { INTRO.ph = 'blast'; INTRO.t = 0; RIG.crouch = 0; fartBurst(80, 2.4); megaFart(); } }
  if (INTRO.ph === 'blast') { skater.position.z = -Math.pow(t, 2) * 9; charG.position.x = 0; RIG.armsUp = .7;
    buttWorld(); for (let i = 0; i < 3; i++) GAS.emit(_bp.x, _bp.y, _bp.z, { vx: (R01() - .5) * 4, vy: R01() * 1.5, vz: 6 + R01() * 5, life: 2.2, s0: .2, s1: 1.1, drag: .5, heat: 1 });
    camState.pos.x += Math.sin(clock * 60) * .01; camState.pos.y += Math.sin(clock * 47) * .01;
    post.comp.uniforms.uGas.value = clamp((t - .5) / .7, 0, 1); if (t > 1.3) endIntro(); }
}
const GASOUT = { t: -1 };
function endIntro() {
  if (!INTRO.on) return; INTRO.on = false; INTRO.ph = 'off'; $('ride').classList.remove('on');
  scene.add(skater); GAS.attach(scene); GAS.clear(); GAS.air.set(-SPEED, 0, 0); GAS.setFog(SKY.hor, 40, 130); GAS.uniforms.uAmb.value.setRGB(1, 1, 1);
  skater.position.set(0, 0, LANE); skater.rotation.set(0, 0, 0); boardG.position.set(0, 0, 0); boardG.rotation.set(0, 0, 0); charG.position.set(0, DECK, 0); charG.rotation.y = 0;
  RIG.crouch = RIG.armsUp = 0; RIG.headYaw = null; RIG.sniffIdle = 0;
  station = -1; lockUntil = 0; go(0, true); $('ui').classList.add('on'); startChaseAudio();
  post.comp.uniforms.uGlitch.value = 1; post.comp.uniforms.uGas.value = 1; GASOUT.t = 0;
}

/* ================================================================== sound: all synthesized */
const SND = { ctx: null, on: true, out: null, nz: null };
function audioInit() { if (SND.ctx) { SND.ctx.resume(); return; } const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return; const c = SND.ctx = new AC(); SND.out = c.createGain(); SND.out.gain.value = SND.on ? .8 : 0; const k = c.createDynamicsCompressor(); k.threshold.value = -14; SND.out.connect(k).connect(c.destination); }
const out = () => (SND.ctx && SND.ctx.state === 'running' && SND.on) ? SND.ctx : null;
function noise(c) { if (SND.nz) return SND.nz; const b = c.createBuffer(1, c.sampleRate * 2, c.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return SND.nz = b; }
function fartSound(power = 1, dur = .6) {
  const c = out(); if (!c) return; const t0 = c.currentTime, o = c.createOscillator(), lp = c.createBiquadFilter(), g = c.createGain();
  o.type = 'sawtooth'; const f0 = (95 - power * 18) * (.85 + Math.random() * .35), curve = new Float32Array(24); let f = f0;
  for (let i = 0; i < 24; i++) { f = clamp(f + (Math.random() - .55) * 18, 38, 190); curve[i] = f * (1 - i / 24 * .3); }
  o.frequency.setValueCurveAtTime(curve, t0, dur); lp.type = 'lowpass'; lp.frequency.value = 520 + power * 200; lp.Q.value = 4;
  const am = c.createOscillator(), ag = c.createGain(); am.type = 'square'; am.frequency.value = 22 + Math.random() * 20; ag.gain.value = .35; am.connect(ag).connect(g.gain);
  const pk = .3 * Math.min(1.4, power); g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(pk, t0 + .03); g.gain.setValueAtTime(pk, t0 + dur * .75); g.gain.linearRampToValueAtTime(0, t0 + dur);
  o.connect(lp).connect(g).connect(SND.out); o.start(t0); am.start(t0); o.stop(t0 + dur + .05); am.stop(t0 + dur + .05);
  const s = c.createBufferSource(), bp = c.createBiquadFilter(), ng = c.createGain(); s.buffer = noise(c); bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = .8;
  ng.gain.setValueAtTime(0, t0 + dur * .5); ng.gain.linearRampToValueAtTime(.18 * power, t0 + dur * .7); ng.gain.exponentialRampToValueAtTime(.001, t0 + dur + .25); s.connect(bp).connect(ng).connect(SND.out); s.start(t0, Math.random(), dur + .3);
}
const pfft = () => fartSound(.4, .18);
function megaFart() { fartSound(2, 1.6); setTimeout(() => fartSound(1.4, .5), 1500); whoosh(1.4); }
function sniffSound() { const c = out(); if (!c) return; for (let i = 0; i < 3; i++) { const t0 = c.currentTime + i * .17, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(); s.buffer = noise(c); f.type = 'highpass'; f.frequency.value = 2500; g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(.12, t0 + .05); g.gain.exponentialRampToValueAtTime(.001, t0 + .14); s.connect(f).connect(g).connect(SND.out); s.start(t0, Math.random(), .16); } }
function clack(v = 1) { const c = out(); if (!c) return; const t0 = c.currentTime, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(); s.buffer = noise(c); f.type = 'bandpass'; f.frequency.value = 1800; f.Q.value = 2; g.gain.setValueAtTime(.5 * v, t0); g.gain.exponentialRampToValueAtTime(.001, t0 + .08); s.connect(f).connect(g).connect(SND.out); s.start(t0, Math.random(), .1); const o = c.createOscillator(), og = c.createGain(); o.frequency.setValueAtTime(160, t0); o.frequency.exponentialRampToValueAtTime(60, t0 + .1); og.gain.setValueAtTime(.4 * v, t0); og.gain.exponentialRampToValueAtTime(.001, t0 + .12); o.connect(og).connect(SND.out); o.start(t0); o.stop(t0 + .13); }
function whoosh(len = .8) { const c = out(); if (!c) return; const t0 = c.currentTime, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(); s.buffer = noise(c); s.loop = true; f.type = 'bandpass'; f.Q.value = 1.2; f.frequency.setValueAtTime(300, t0); f.frequency.exponentialRampToValueAtTime(2800, t0 + len * .8); g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(.35, t0 + len * .4); g.gain.exponentialRampToValueAtTime(.001, t0 + len); s.connect(f).connect(g).connect(SND.out); s.start(t0); s.stop(t0 + len + .05); }
function chargeSound() { const c = out(); if (!c) return; const t0 = c.currentTime, o = c.createOscillator(), g = c.createGain(), lp = c.createBiquadFilter(); o.type = 'sawtooth'; o.frequency.setValueAtTime(40, t0); o.frequency.linearRampToValueAtTime(70, t0 + .9); lp.type = 'lowpass'; lp.frequency.value = 300; g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(.25, t0 + .8); g.gain.linearRampToValueAtTime(0, t0 + 1); o.connect(lp).connect(g).connect(SND.out); o.start(t0); o.stop(t0 + 1.05); }
function siren(gainV, rate = .32, center = 900, depth = 320) { const c = SND.ctx, o = c.createOscillator(), lfo = c.createOscillator(), lg = c.createGain(), g = c.createGain(), lp = c.createBiquadFilter(); o.type = 'square'; o.frequency.value = center; lfo.type = 'triangle'; lfo.frequency.value = rate; lg.gain.value = depth; lfo.connect(lg).connect(o.frequency); lp.type = 'lowpass'; lp.frequency.value = 1400; g.gain.value = gainV; o.connect(lp).connect(g).connect(SND.out); o.start(); lfo.start(); return { g, lp, o }; }
function sirenFar() { const c = SND.ctx; if (!c || SND.far) return; SND.far = siren(0, .3); SND.far.lp.frequency.value = 600; SND.far.g.gain.linearRampToValueAtTime(.05, c.currentTime + 3); }
function startChaseAudio() {
  const c = SND.ctx; if (!c || SND.chase) return; SND.chase = true; if (SND.far) SND.far.g.gain.setTargetAtTime(0, c.currentTime, .3);
  SND.s1 = siren(.05, .34, 950, 330); SND.s2 = siren(.03, 3.2, 1100, 250);
  const b = c.createBuffer(1, c.sampleRate * 2, c.sampleRate), d = b.getChannelData(0); for (let i = 0, l = 0; i < d.length; i++) { l = (l + .02 * (Math.random() * 2 - 1)) / 1.02; d[i] = l * 3.5; }
  const roll = c.createBufferSource(), rf = c.createBiquadFilter(), rg = c.createGain(); roll.buffer = b; roll.loop = true; rf.type = 'lowpass'; rf.frequency.value = 520; rg.gain.value = .3; roll.connect(rf).connect(rg).connect(SND.out); roll.start(); SND.roll = rg;
  const hn = c.createBufferSource(), hf = c.createBiquadFilter(), hg = c.createGain(), am = c.createOscillator(), ag = c.createGain(); hn.buffer = noise(c); hn.loop = true; hf.type = 'lowpass'; hf.frequency.value = 260; hg.gain.value = 0; am.type = 'square'; am.frequency.value = 13; ag.gain.value = .06; am.connect(ag).connect(hg.gain); hn.connect(hf).connect(hg).connect(SND.out); hn.start(); am.start();
}
let seamAcc = 0;
function stepAudio(dt) { const c = out(); if (!c || !SND.chase) return; const sk = GAL.sky; seamAcc += SPEED * dt; if (!sk && seamAcc > 8) { seamAcc = 0; clack(.22); }
  SND.roll.gain.setTargetAtTime(sk ? 0 : .3, c.currentTime, .2); const g = cops.length ? cops.reduce((a, cp) => a + cp.userData.gas, 0) / cops.length : 0;
  SND.s1.g.gain.setTargetAtTime(sk ? 0 : .05 * (1 - g * .6), c.currentTime, .2); SND.s2.g.gain.setTargetAtTime(sk ? 0 : .03 * (1 - g * .6), c.currentTime, .2); SND.s1.o.detune.setTargetAtTime(-g * 400 + Math.sin(clock * 30) * g * 150, c.currentTime, .05); }

/* ================================================================== camera, hover, render loop */
const _look = V3(), _f = V3(), _hn = V3();
function updateCamera(dt) {
  const k = damp(dt, 5); if (!REDUCED) { ptr.cx = lerp(ptr.cx, ptr.seen ? ptr.x : 0, k); ptr.cy = lerp(ptr.cy, ptr.seen ? ptr.y : 0, k); }
  cam.position.copy(camState.pos); cam.position.x += ptr.cx * .35 * camState.par; cam.position.y += -ptr.cy * .15 * camState.par;
  const wob = REDUCED ? 0 : .004; cam.position.x += Math.sin(clock * .9) * wob; cam.position.y += Math.sin(clock * 1.3 + 1) * wob + (GAL.sky || INTRO.on ? 0 : skater.position.y * .4);
  _look.copy(camState.look); cam.lookAt(_look); cam.rotateZ(camState.roll);
  cam.fov = camState.fov * (cam.aspect < 1 ? 1.45 : 1); cam.updateProjectionMatrix();
  if (cam.aspect < 1) { _f.subVectors(cam.position, _look).multiplyScalar(.15); cam.position.add(_f); }
}
function hoverOn() { if (!started || !ptr.seen || travel || GAL.on || INTRO.on) return false; headTop.getWorldPosition(_hn); _hn.project(cam); const over = _hn.z < 1 && Math.hypot((_hn.x - ptr.x) * cam.aspect, _hn.y + ptr.y) < .16; cvs.style.cursor = over ? 'pointer' : ''; return over; }
function resize() { post.resize(innerWidth, innerHeight); cam.aspect = innerWidth / innerHeight; cam.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();
let focus = 4, last = performance.now(), raf = 0;
function frame(now) { raf = requestAnimationFrame(frame); let dt = Math.min(.05, (now - last) / 1000); last = now; if (HOLD && started) dt = 0; tick(dt); }
function tick(dt) {
  clock += dt; sky.material.uniforms.uT.value = clock;
  const cu = post.comp.uniforms; if (cu.uGlitch.value > 0) cu.uGlitch.value = Math.max(0, cu.uGlitch.value - dt * .8); cu.uT.value = clock;
  if (GASOUT.t >= 0) { GASOUT.t += dt; cu.uGas.value = Math.max(0, 1 - GASOUT.t / 1.4); if (GASOUT.t > 1.4) GASOUT.t = -1; }
  cu.uZoom.value = lerp(cu.uZoom.value, GAL.sky ? .8 : GAL.on && GAL.t > .7 ? .9 : 0, damp(dt, 3));
  if (INTRO.on) { stepIntro(dt); poseRider(dt, 'alley'); } else { stepTravel(dt); stepStreet(dt); stepGallery(dt); poseRider(dt, GAL.sky ? 'sky' : 'street'); stepAudio(dt); }
  GAS.step(dt, clock);
  updateCamera(dt);
  headTop.getWorldPosition(_hn); focus = lerp(focus, cam.position.distanceTo(_hn), damp(dt, 6));
  post.render(INTRO.on ? alley : scene, cam, { focus, aperture: camState.ap ?? .4, bloom: 1, raw: RAW });
}
document.addEventListener('visibilitychange', () => { if (document.hidden) { cancelAnimationFrame(raf); SND.ctx?.suspend(); } else { last = performance.now(); raf = requestAnimationFrame(frame); SND.ctx?.resume(); } });

/* ================================================================== gate, links, input */
const setWord = w => { $('gword').innerHTML = [...w].map((c, i) => `<span style="--i:${i}" aria-hidden="true">${c}</span>`).join(''); $('enter').setAttribute('aria-label', w === 'ENTER' ? 'Enter' : 'Loading'); };
setWord('LOADING');
{ const b = $('bubbles'); for (let i = 0; i < 18; i++) { const e = document.createElement('b'); e.style.cssText = `--s:${10 + Math.random() * 40}px;--d:${6 + Math.random() * 8}s;--dl:${-Math.random() * 10}s;--x:${Math.random() * 100}%;--w:${(Math.random() - .5) * 120}px`; b.append(e); } }
{ const c = document.createElement('canvas'); c.width = c.height = 160; const x = c.getContext('2d'), d = x.createImageData(160, 160); for (let i = 0; i < d.data.length; i += 4) { const v = Math.random() * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; } x.putImageData(d, 0, 0); $('grain').style.background = `url(${c.toDataURL()})`; }
const t0 = performance.now();
Promise.all([sniffReady, boardReady, copReady, urbReady]).catch(e => { console.error(e); $('prog').textContent = 'a model failed to load'; }).then(() => {
  try { R.compile(scene, cam); R.compile(alley, cam); } catch (e) { console.error(e); }
  for (const k in prog) prog[k] = 1; showProg();
  setTimeout(() => { setWord('ENTER'); $('enter').disabled = false; $('enter').focus({ preventScroll: true }); if (Q.has('shot') || Q.has('intro')) begin(true); }, Q.has('shot') || Q.has('intro') ? 0 : Math.max(0, 1800 - (performance.now() - t0)));
});
function begin(debug) {
  if (started) return; started = true; $('gate').classList.add('off'); if (debug) $('gate').style.display = 'none';
  if (Q.has('intro')) { startIntro(); const T_ = +Q.get('intro'); if (T_ > 0) { INTRO.ph = 'wait'; rideClick(); for (let i = 0; i < T_ * 30; i++) tick(1 / 30); } return; }
  if (debug || REDUCED) { go(station, true); $('ui').classList.add('on'); return; }
  startIntro();
}
$('enter').addEventListener('click', () => { audioInit(); begin(false); });
$('ride').addEventListener('click', () => { audioInit(); rideClick(); });
$('snd').addEventListener('click', () => { audioInit(); SND.on = !SND.on; if (SND.out) SND.out.gain.value = SND.on ? .8 : 0; $('snd').setAttribute('aria-pressed', String(SND.on)); $('snd').setAttribute('aria-label', SND.on ? 'Sound on' : 'Sound off'); });
document.querySelectorAll('nav .btn').forEach(b => b.addEventListener('click', () => { lockUntil = 0; go(+b.dataset.s); }));
$('galPrev').addEventListener('click', () => showMeme(-1)); $('galNext').addEventListener('click', () => showMeme(1));
addEventListener('keydown', e => { if (!started || INTRO.on) return; if (GAL.sky && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) return showMeme(e.key === 'ArrowRight' ? 1 : -1);
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') go(station + 1); if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') go(station - 1); if ('123'.includes(e.key)) { lockUntil = 0; go(+e.key - 1); } if (e.key === 'f' || e.key === 'F') fartBurst(30, 1); });
addEventListener('wheel', e => { if (started && !INTRO.on && Math.abs(e.deltaY) > 8) go(station + Math.sign(e.deltaY)); }, { passive: true });
let ty0 = null, tx0 = 0;
addEventListener('touchstart', e => { ty0 = e.touches[0].clientY; tx0 = e.touches[0].clientX; }, { passive: true });
addEventListener('touchend', e => { if (ty0 === null || !started || INTRO.on) return; const d = ty0 - e.changedTouches[0].clientY, dx = tx0 - e.changedTouches[0].clientX; ty0 = null; if (GAL.sky && Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(d)) return showMeme(Math.sign(dx)); if (Math.abs(d) > 70) go(station + Math.sign(d)); }, { passive: true });
for (const ev of ['pointermove', 'pointerdown']) addEventListener(ev, e => { ptr.x = e.clientX / innerWidth * 2 - 1; ptr.y = e.clientY / innerHeight * 2 - 1; ptr.seen = true; });
document.addEventListener('pointerleave', () => { ptr.seen = false; });
cvs.addEventListener('click', () => { if (HOVER.k > .5) { audioInit(); fartBurst(40, 1.3); RIG.sniff = 0; RIG.sniffed = false; } });
for (const [k, label] of [['x', 'X'], ['telegram', 'TG'], ['chart', 'Chart'], ['buy', 'Buy']]) { const a = document.createElement(SITE[k] ? 'a' : 'span'); a.className = 'btn'; a.textContent = label; if (SITE[k]) { a.href = SITE[k]; a.target = '_blank'; a.rel = 'noopener noreferrer'; } else { a.setAttribute('aria-disabled', 'true'); a.title = 'Coming soon'; } $('links').append(a); }
$('tick').textContent = SITE.ticker;
if (SITE.ca) { const code = document.createElement('code'); code.textContent = SITE.ca; const b = document.createElement('button'); b.className = 'ca-copy'; b.type = 'button'; b.textContent = 'Copy'; b.onclick = async () => { try { await navigator.clipboard.writeText(SITE.ca); b.textContent = 'Copied'; } catch { b.textContent = 'Ctrl+C'; } setTimeout(() => { b.textContent = 'Copy'; }, 1500); }; $('ca').replaceChildren(code, b); }

window.__sn = { RIG, THREE, R, scene, alley, cam, camState, BONES, skater, charG, boardG, cops, traffic, GAS, CLOUDS, GAL, INTRO, STATIONS, go, tick, fartBurst, post, get station() { return station; } };
updateCamera(0); if (!Q.has('still')) raf = requestAnimationFrame(frame); // ?still: no loop (headless tests drive tick())
