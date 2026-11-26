// SNIFFER: a gas-powered skateboard chase through a dusk city.
// Everything 3D is built in code (no model files): the city, Sniffer, his board, the cops, the helicopter.
import * as THREE from 'three';

/* ================================================================== config */
const SITE = { // edit these when the token launches
  ticker: '$SNIFF', ca: '',
  x: '', telegram: '', buy: '', chart: '',
};
// Memes for the gallery: drop files into memes/ and list them here. A missing file shows a placeholder card.
const MEMES = [
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

/* ================================================================== renderer + street scene */
const cvs = $('gl');
const R = new THREE.WebGLRenderer({ canvas: cvs, antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: Q.has('shot') });
R.outputColorSpace = THREE.SRGBColorSpace;
R.shadowMap.enabled = true; R.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
// dusk palette: the fog IS the horizon colour, so anything far away melts into the sky (no pop-in when tiles wrap)
const HOR = new THREE.Color(0xe7896f), MID = new THREE.Color(0x8a4f86), TOP = new THREE.Color(0x231a4a);
const SKY_HOR = new THREE.Color(0xe07fa8), SKY_MID = new THREE.Color(0x7a4fa8), SKY_TOP = new THREE.Color(0x221c5c); // gallery sky
scene.background = HOR.clone(); scene.fog = new THREE.Fog(HOR.clone(), 32, 128);
const cam = new THREE.PerspectiveCamera(34, 1, .1, 500);
const SUN = V3(.86, .1, -.5).normalize();

scene.add(new THREE.HemisphereLight(0x9a86c8, 0x3a2626, 1.15));
const sunL = new THREE.DirectionalLight(0xffb27c, 2.6);
sunL.position.set(30, 22, -16); sunL.castShadow = true;
sunL.shadow.mapSize.set(MOBILE ? 1024 : 2048, MOBILE ? 1024 : 2048);
Object.assign(sunL.shadow.camera, { left: -16, right: 16, top: 12, bottom: -12, near: 1, far: 90 });
sunL.shadow.bias = -.0006; sunL.shadow.normalBias = .03;
scene.add(sunL, sunL.target);
const fill = new THREE.DirectionalLight(0xffe2f0, 0); fill.position.set(-6, 3, 4); scene.add(fill);

const sky = new THREE.Mesh(new THREE.SphereGeometry(400, 32, 16), new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false,
  uniforms: { uSun: { value: SUN }, uHor: { value: HOR.clone() }, uMid: { value: MID.clone() }, uTop: { value: TOP.clone() }, uT: { value: 0 } },
  vertexShader: `varying vec3 vP;void main(){vP=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
  fragmentShader: `uniform vec3 uSun,uHor,uMid,uTop;uniform float uT;varying vec3 vP;
    float h(vec2 p){return fract(sin(dot(p,vec2(41.3,289.1)))*45758.5);}
    void main(){vec3 d=normalize(vP);float y=d.y;
      vec3 c=mix(uHor,uMid,smoothstep(.0,.28,y));c=mix(c,uTop,smoothstep(.28,.85,y));
      c=mix(c,uHor*.8,smoothstep(0.,-.2,y));
      float s=max(dot(d,uSun),0.);c+=vec3(1.,.55,.3)*pow(s,7.)*.45+vec3(1.,.8,.55)*pow(s,60.)*.8;
      c+=vec3(3.,2.,1.2)*smoothstep(.9990,.9995,s);
      float band=smoothstep(.04,.0,abs(y-.12-.03*sin(d.x*9.+d.z*5.)))*(.5+.5*sin(d.x*23.+d.z*17.));c=mix(c,vec3(1.,.62,.62),band*.35); // thin pink cloud streaks
      vec2 g=floor(vec2(atan(d.z,d.x)*180.,y*180.));float st=step(.9965,h(g))*smoothstep(.3,.7,y)*(.6+.4*sin(uT*3.+h(g+7.)*40.));c+=vec3(st);
      gl_FragColor=vec4(c,1.);}`,
})); sky.renderOrder = -1; scene.add(sky);

/* ================================================================== tiny canvas textures (nearest-filtered = PS2 look) */
function canvasTex(w, h, draw, repeat, srgb = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestMipmapLinearFilter;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); }
  t.userData.canvas = c; return t;
}
const specks = (x, w, h, n, f) => { for (let i = 0; i < n; i++) { x.fillStyle = f(); x.fillRect(rnd() * w | 0, rnd() * h | 0, 1, 1); } };
// road: canvas x = 16 m along the street (.25 m/px), canvas y = 14 m across (z −7 → +7)
const RZ = 7, PERIOD = 16;
const roadTex = canvasTex(64, 56, (x, w, h) => {
  x.fillStyle = '#3b3640'; x.fillRect(0, 0, w, h);
  specks(x, w, h, 1500, () => { const v = 48 + rnd() * 22 | 0; return `rgb(${v},${v - 5},${v + 4})`; });
  const row = z => Math.round((z + RZ) / .25);
  x.fillStyle = 'rgba(20,16,24,.35)'; for (let i = 0; i < 5; i++) { x.fillRect(rnd() * w | 0, rnd() * h | 0, 6 + rnd() * 10 | 0, 1); } // tar seams
  x.fillStyle = '#2b2730'; x.fillRect(40, row(3.2), 6, 6); x.fillStyle = '#4a4550'; x.fillRect(41, row(3.2) + 1, 4, 4); // manhole
  x.fillStyle = '#e3b54a'; x.fillRect(0, row(-.2), w, 1); x.fillRect(0, row(.15), w, 1); // double yellow
  x.fillStyle = '#dcd6cc'; for (const z of [-6.7, 6.6]) x.fillRect(0, row(z), w, 1);
  for (const z of [-3.5, 3.5]) { x.fillRect(0, row(z), 12, 1); x.fillRect(32, row(z), 12, 1); } // 3 m dash, 5 m gap
}, [400 / PERIOD, 1]);
const walkTex = canvasTex(24, 16, (x, w, h) => { // 6 m × 4 m of sidewalk slabs
  x.fillStyle = '#8d8590'; x.fillRect(0, 0, w, h);
  specks(x, w, h, 160, () => { const v = 120 + rnd() * 25 | 0; return `rgb(${v},${v - 6},${v + 2})`; });
  x.fillStyle = '#6c6570'; for (let i = 0; i < w; i += 6) x.fillRect(i, 0, 1, h); for (let j = 0; j < h; j += 6) x.fillRect(0, j, w, 1);
}, [400 / 6, 1]);
// building facade (8 m × 12 m: 4 × 4 windows) + a matching emissive map with some windows lit
const facadeTex = canvasTex(16, 32, (x, w, h) => {
  x.fillStyle = '#ffffff'; x.fillRect(0, 0, w, h);
  for (let f = 0; f < 4; f++) for (let c = 0; c < 4; c++) { x.fillStyle = '#3a4058'; x.fillRect(c * 4 + 1, f * 8 + 2, 2, 3); }
  x.fillStyle = '#d6cfd8'; for (let f = 0; f < 4; f++) x.fillRect(0, f * 8 + 6, w, 1);
});
facadeTex.wrapS = facadeTex.wrapT = THREE.RepeatWrapping;
const windowTex = canvasTex(16, 32, (x, w, h) => {
  x.fillStyle = '#000'; x.fillRect(0, 0, w, h);
  for (let f = 0; f < 4; f++) for (let c = 0; c < 4; c++) { const r = rnd(); if (r < .38) { x.fillStyle = r < .05 ? '#7ad7ff' : r < .08 ? '#ff8fd0' : '#ffbf66'; x.fillRect(c * 4 + 1, f * 8 + 2, 2, 3); } }
});
windowTex.wrapS = windowTex.wrapT = THREE.RepeatWrapping;
const leafTex = canvasTex(16, 16, (x, w, h) => { x.fillStyle = '#2f4a22'; x.fillRect(0, 0, w, h); specks(x, w, h, 120, () => rnd() < .5 ? '#466b2c' : '#253b1a'); });
const NEON_WORDS = ['NOODLES', 'PHARMACY', 'LAUNDRO', 'ODOR-EATERS', '24 HR', 'PAWN', 'KARAOKE', 'BEANS', 'LIQUOR', 'NO SMELL', 'GAS', 'TACOS'];
const NEON_COLS = ['#ff5fb4', '#5ff0ff', '#b8ff6a', '#ffcf4a', '#ff7a5a', '#c58aff'];
function neonTex(word, col) {
  return canvasTex(96, 24, (x, w, h) => {
    x.fillStyle = '#120a18'; x.fillRect(0, 0, w, h); x.strokeStyle = col; x.lineWidth = 2; x.strokeRect(2, 2, w - 4, h - 4);
    x.fillStyle = col; x.font = 'bold 13px monospace'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(word, w / 2, h / 2 + 1);
  });
}
const BILLBOARDS = [['SMELL YA LATER', '#b8ff6a', '#1d3a12'], ['HOLD YOUR BREATH', '#ffffff', '#8e1530'], ['$SNIFF', '#1d3a12', '#b8ff6a'], ['WANTED: SNIFFER', '#2b1a0e', '#ead39f']];
function billboardTex([txt, fg, bg]) {
  return canvasTex(128, 48, (x, w, h) => {
    x.fillStyle = bg; x.fillRect(0, 0, w, h); x.fillStyle = fg; x.font = 'bold 15px monospace'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(txt, w / 2, h / 2); x.fillStyle = 'rgba(0,0,0,.25)'; x.fillRect(0, h - 4, w, 4);
  });
}
const policeTex = canvasTex(64, 16, (x, w, h) => { x.fillStyle = '#f2f2f2'; x.fillRect(0, 0, w, h); x.fillStyle = '#10204a'; x.font = 'bold 11px monospace'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('POLICE', w / 2, h / 2 + 1); });

/* ================================================================== merged geometry: collect parts, bake colour into vertices, 1 draw per material */
const MAT = {
  flat: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .85, flatShading: true }),
  glow: new THREE.MeshBasicMaterial({ vertexColors: true, fog: true }),
  bld: new THREE.MeshStandardMaterial({ vertexColors: true, map: facadeTex, emissiveMap: windowTex, emissive: 0xffffff, emissiveIntensity: 1.25, roughness: .92 }),
  leaf: new THREE.MeshStandardMaterial({ vertexColors: true, map: leafTex, roughness: 1, flatShading: true }),
};
const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = V3(), _p = V3();
const T = (x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => _m4.clone().compose(_p.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _s.set(sx, sy, sz));
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d), cyl = (a, b, h, n = 8) => new THREE.CylinderGeometry(a, b, h, n);
function mergeGeos(list) {
  let n = 0; for (const g of list) n += g.attributes.position.count;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2), col = new Float32Array(n * 3);
  let o = 0;
  for (const g of list) {
    const c = g.attributes.position.count;
    pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3);
    uv.set(g.attributes.uv.array, o * 2); col.set(g.attributes.color.array, o * 3); o += c;
  }
  const m = new THREE.BufferGeometry();
  m.setAttribute('position', new THREE.BufferAttribute(pos, 3)); m.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  m.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); m.setAttribute('color', new THREE.BufferAttribute(col, 3));
  m.computeBoundingSphere(); return m;
}
function bag() {
  const L = new Map();
  return {
    add(geo, mat, color = 0xffffff, m = null, k = 1) {
      const g = geo.index ? geo.toNonIndexed() : geo.clone();
      if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
      if (!g.attributes.normal) g.computeVertexNormals();
      const c = new THREE.Color(color).multiplyScalar(k), a = new Float32Array(g.attributes.position.count * 3);
      for (let i = 0; i < a.length; i += 3) { a[i] = c.r; a[i + 1] = c.g; a[i + 2] = c.b; }
      g.setAttribute('color', new THREE.BufferAttribute(a, 3));
      if (m) g.applyMatrix4(m);
      if (!L.has(mat)) L.set(mat, []); L.get(mat).push(g);
    },
    build(shadow = true) {
      const grp = new THREE.Group();
      for (const [mat, list] of L) { const m = new THREE.Mesh(mergeGeos(list), mat); m.castShadow = shadow && mat !== MAT.glow; m.receiveShadow = true; grp.add(m); }
      return grp;
    },
  };
}

/* ================================================================== the street: static planes with scrolling textures */
const SPEED = 22; // m/s ≈ 80 km/h on a skateboard
let dist = 0;
const LANE = 1.75; // Sniffer's lane (near side)
const road = new THREE.Mesh(new THREE.PlaneGeometry(400, RZ * 2).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: roadTex, roughness: .9 }));
road.receiveShadow = true; scene.add(road);
const walks = [1, -1].map(s => {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(400, 4).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: walkTex, roughness: .95 }));
  m.position.set(0, .15, s * 9); m.receiveShadow = true; scene.add(m); return m;
});
const curbs = new THREE.Mesh(mergeGeos([1, -1].map(s => { const g = box(400, .15, .25).toNonIndexed(); g.translate(0, .075, s * 7.05); const a = new Float32Array(g.attributes.position.count * 3).fill(.62); g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; })), MAT.flat);
curbs.receiveShadow = true; scene.add(curbs);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x2a2430, roughness: 1 }));
ground.position.y = -.02; scene.add(ground);

/* ================================================================== roadside tiles (7 × 50 m, wrapped behind the fog) */
const TL = 50, NT = 7, LOOP = TL * NT, HB = 170;
const wrapX = x => ((x + HB) % LOOP + LOOP) % LOOP - HB;
const WALL = [0xc9b3a8, 0xb59a9a, 0x9fa3b8, 0xd2c2a2, 0x8f8a9e, 0xb7a6c4, 0xa3b09a];
function building(B, x, z, w, h, d, col) {
  const g = box(w, h, d), uv = g.attributes.uv, S = [[d, h], [d, h], [0, 0], [0, 0], [w, h], [w, h]];
  const ou = (rnd() * 4 | 0) / 4, ov = (rnd() * 4 | 0) / 4; // shift the window pattern so buildings differ
  for (let f = 0; f < 6; f++) for (let v = 0; v < 4; v++) { const j = f * 4 + v; uv.setXY(j, S[f][0] ? uv.getX(j) * S[f][0] / 8 + ou : 0, S[f][1] ? uv.getY(j) * S[f][1] / 12 + ov : 0); }
  B.add(g, MAT.bld, col, T(x, h / 2, z));
  const top = h, s = Math.sign(z);
  if (rnd() < .45) { // water tower
    const tx = x + (rnd() - .5) * w * .4, tz = z + (rnd() - .5) * d * .3;
    for (const [a, b] of [[-.6, -.6], [.6, -.6], [-.6, .6], [.6, .6]]) B.add(box(.12, 1.6, .12), MAT.flat, 0x3a2e2a, T(tx + a, top + .8, tz + b));
    B.add(cyl(1, 1, 1.8, 10), MAT.flat, 0x6b4a36, T(tx, top + 2.5, tz)); B.add(new THREE.ConeGeometry(1.1, .8, 10), MAT.flat, 0x4a3a32, T(tx, top + 3.8, tz));
  } else if (rnd() < .6) B.add(box(2 + rnd() * 2, 1, 1.5 + rnd()), MAT.flat, 0x777080, T(x + (rnd() - .5) * w * .5, top + .5, z));
  if (h < 16 && rnd() < .3) { // rooftop billboard facing the street
    const bt = new THREE.MeshBasicMaterial({ map: billboardTex(BILLBOARDS[rnd() * BILLBOARDS.length | 0]), fog: true });
    const bb = new THREE.Mesh(new THREE.PlaneGeometry(9, 3.4), bt); bb.position.set(x, top + 3.6, z - s * (d / 2 - 1)); if (s > 0) bb.rotation.y = Math.PI;
    B.extra.push(bb); for (const dx of [-3, 3]) B.add(box(.2, 2, .2), MAT.flat, 0x2a2a30, T(x + dx, top + 1, z - s * (d / 2 - 1)));
  }
  if (rnd() < .55) { // neon sign over the shop front
    const wd = NEON_WORDS[rnd() * NEON_WORDS.length | 0], nc = NEON_COLS[rnd() * NEON_COLS.length | 0];
    const nm = new THREE.Mesh(new THREE.PlaneGeometry(3.6, .9), new THREE.MeshBasicMaterial({ map: neonTex(wd, nc), fog: true }));
    nm.material.color.setScalar(1.6); // over 1 so the bloom catches it
    nm.position.set(x + (rnd() - .5) * (w - 4), 3.4, z - s * (d / 2 + .05)); if (s > 0) nm.rotation.y = Math.PI; B.extra.push(nm);
  }
  B.add(box(w * .9, .15, 1.2), MAT.flat, 0x3a2a3a, T(x, 2.9, z - s * (d / 2 + .6))); // awning
}
function lamp(B, x, s) {
  const z = s * 7.6;
  B.add(cyl(.07, .1, 6.2, 6), MAT.flat, 0x4a4652, T(x, 3.1, z));
  B.add(box(.08, .08, 1.6), MAT.flat, 0x4a4652, T(x, 6.15, z - s * .8));
  B.add(box(.5, .14, .3), MAT.flat, 0x2e2b33, T(x, 6.05, z - s * 1.55));
  B.add(box(.36, .05, .2), MAT.glow, 0xffd59a, T(x, 5.96, z - s * 1.55), 2.2);
}
function tree(B, x, s) {
  const z = s * (8.4 + rnd() * .6), h = 2.4 + rnd() * 1.2;
  B.add(box(1.2, .35, 1.2), MAT.flat, 0x5a5560, T(x, .32, z));
  B.add(cyl(.07, .11, h, 5), MAT.flat, 0x4a3628, T(x, h / 2 + .3, z));
  for (let k = 0; k < 3; k++) { const r = .8 + rnd() * .5; B.add(new THREE.IcosahedronGeometry(r, 0), MAT.leaf, 0xffffff, T(x + (rnd() - .5) * .8, h + .2 + k * .45, z + (rnd() - .5) * .8, rnd(), rnd(), 0)); }
}
function trafficLight(B, x, s) {
  const z = s * 7.4;
  B.add(cyl(.08, .1, 5, 6), MAT.flat, 0x2f3336, T(x, 2.5, z)); B.add(box(.1, .1, 3.2), MAT.flat, 0x2f3336, T(x, 4.9, z - s * 1.6));
  B.add(box(.35, 1, .3), MAT.flat, 0x1a1a1c, T(x, 4.4, z - s * 3));
  for (const [y, c, k] of [[4.72, 0x3a0d0d, 1], [4.42, 0x3a2e0d, 1], [4.12, 0x5bff8a, 2.4]]) B.add(box(.05, .2, .2), MAT.glow, c, T(x - .19, y, z - s * 3), k);
}
function streetStuff(B, x, s) {
  const r = rnd(), z = s * (8.1 + rnd() * .3);
  if (r < .25) { B.add(cyl(.14, .16, .55, 7), MAT.flat, 0xc23a2a, T(x, .45, z)); B.add(new THREE.SphereGeometry(.15, 7, 4), MAT.flat, 0xc23a2a, T(x, .73, z)); } // hydrant
  else if (r < .5) B.add(cyl(.26, .22, .9, 8), MAT.flat, 0x3d4a3a, T(x, .6, z)); // trash can
  else if (r < .7) { B.add(box(.5, 1.1, .45), MAT.flat, 0x2a4a8a, T(x, .7, z)); } // mailbox
  else { B.add(box(1.8, .08, .5), MAT.flat, 0x5a3e2c, T(x, .6, s * 10.3)); B.add(box(1.8, .5, .08), MAT.flat, 0x5a3e2c, T(x, .9, s * 10.55)); } // bench
}
function buildTile(i) {
  const B = bag(); B.extra = []; seed = 300 + i * 53;
  const cross = i % 2 === 0; // every other tile starts with an intersection
  if (cross) {
    for (let k = 0; k < 7; k++) B.add(box(.5, .02, 12.6), MAT.flat, 0xd8d2c6, T(2 + k * 1, .012, 0)); // zebra crossing
    for (const s of [1, -1]) { trafficLight(B, 9.5, s); B.add(box(9, .02, 12), MAT.flat, 0x332e38, T(4.5, .01, s * 15)); } // side street
  }
  for (const s of [1, -1]) {
    for (const lx of [5, 30]) lamp(B, lx, s);
    for (let x = cross ? 12 : 3; x < TL - 2; x += 9 + rnd() * 7) tree(B, x, s);
    for (let k = 0; k < 3; k++) streetStuff(B, (cross ? 12 : 2) + rnd() * (TL - 14), s);
    let x = cross ? 10 : rnd() * 3;
    for (;;) {
      const w = 8 + rnd() * 10; if (x + w > TL - .5) break;
      const d = 9 + rnd() * 6, h = 6 + rnd() * rnd() * 30;
      building(B, x + w / 2, s * (11.6 + d / 2 + rnd() * 1.5), w, h, d, WALL[rnd() * WALL.length | 0]);
      x += w + .4 + (rnd() < .2 ? 4 : 0);
    }
  }
  const g = B.build(); for (const e of B.extra) g.add(e);
  g.userData.x0 = i * TL; scene.add(g); return g;
}
const tiles = Array.from({ length: NT }, (_, i) => buildTile(i));

/* ================================================================== vehicles (all faces +X, ground y = 0) */
const wheelGeo = cyl(.34, .34, .26, 12).rotateX(Math.PI / 2);
const SPIN = []; // [mesh, radius, owner with userData.d]
function wheels(g, xs, z, r, color = 0x151515, owner) {
  for (const x of xs) for (const s of [-1, 1]) {
    const w = new THREE.Mesh(wheelGeo, new THREE.MeshStandardMaterial({ color, roughness: .8, flatShading: true }));
    w.scale.setScalar(r / .34); w.position.set(x, r, s * z); w.castShadow = true; g.add(w); SPIN.push([w, r, owner || g]);
  }
}
function trafficCar(color) {
  const g = new THREE.Group(), B = bag();
  B.add(box(4.2, .55, 1.8), MAT.flat, color, T(0, .62, 0));
  B.add(box(2.1, .52, 1.6), MAT.flat, color, T(-.25, 1.15, 0));
  B.add(box(2.15, .4, 1.62), MAT.flat, 0x1c2230, T(-.25, 1.17, 0)); // glass band
  for (const s of [-1, 1]) { B.add(box(.05, .14, .32), MAT.glow, 0xfff1c8, T(2.11, .7, s * .62), 2.2); B.add(box(.05, .14, .36), MAT.glow, 0xff2a2a, T(-2.11, .74, s * .6), 1.6); }
  g.add(B.build()); wheels(g, [1.35, -1.35], .82, .33); return g;
}
const traffic = [];
const TRAFFIC = [[-1.75, -15, 3], [-5.25, -12, 3]]; // opposite carriageway: lane z, ground speed (m/s), cars
{
  const cols = [0x8a2b2b, 0x2b4a8a, 0xd8d0c0, 0x2a2a2e, 0x6b8a3a, 0xc28a2a, 0x5a3a7a];
  let k = 0; seed = 77;
  for (const [z, v, n] of TRAFFIC) for (let i = 0; i < n; i++) {
    const c = trafficCar(cols[k % cols.length]); c.rotation.y = Math.PI; c.position.z = z; c.userData = { x: i * LOOP / n + k * 31, v }; k++;
    scene.add(c); traffic.push(c);
  }
}
// the cops: black-and-white cruisers with a red/blue bar; their windshields fog up green when they drive into the gas
function copCar() {
  const g = new THREE.Group(), B = bag();
  B.add(box(4.6, .6, 1.9), MAT.flat, 0x15171c, T(0, .62, 0));
  B.add(box(2.4, .56, 1.7), MAT.flat, 0x15171c, T(-.3, 1.18, 0));
  B.add(box(2.45, .4, 1.72), MAT.flat, 0x1c2633, T(-.3, 1.2, 0));
  B.add(box(.5, .3, 1.95), MAT.flat, 0x0c0c0e, T(2.35, .5, 0)); // push bar
  for (const s of [-1, 1]) { B.add(box(.05, .14, .34), MAT.glow, 0xfff1c8, T(2.31, .72, s * .66), 2.4); B.add(box(.05, .14, .36), MAT.glow, 0xff2a2a, T(-2.31, .76, s * .62), 1.6); }
  g.add(B.build());
  const door = new THREE.MeshStandardMaterial({ map: policeTex, roughness: .6 });
  for (const s of [-1, 1]) { const d = new THREE.Mesh(new THREE.PlaneGeometry(2.1, .5), door); d.position.set(.1, .66, s * .956); if (s < 0) d.rotation.y = Math.PI; g.add(d); }
  const ws = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 1.62), new THREE.MeshStandardMaterial({ color: 0x223040, roughness: .15, metalness: .3, emissive: 0x000000 }));
  ws.position.set(.93, 1.17, 0); ws.rotation.set(0, Math.PI / 2, 0); ws.rotateX(-.9); g.add(ws);
  const bars = [0xff2030, 0x2050ff].map((c, i) => { const m = new THREE.Mesh(box(.34, .12, .62), new THREE.MeshBasicMaterial({ color: c })); m.position.set(-.1, 1.53, i ? .33 : -.33); g.add(m); return m; });
  const light = new THREE.PointLight(0xff2030, 0, 14, 1.6); light.position.set(-.1, 2.2, 0); g.add(light);
  wheels(g, [1.45, -1.45], .86, .34, 0x111111);
  g.userData = { ws, bars, light, gas: 0, d: 0 };
  return g;
}
const cops = [{ x0: -8.5, z0: LANE, ph: 0 }, { x0: -14.5, z0: 5.2, ph: 2.1 }].map(c => { const g = copCar(); Object.assign(g.userData, c); scene.add(g); return g; });
// the police helicopter, its searchlight pinned on Sniffer
const heli = new THREE.Group(); scene.add(heli);
{
  const B = bag();
  B.add(new THREE.SphereGeometry(1, 10, 7), MAT.flat, 0x1b2440, T(0, 0, 0, 0, 0, 0, 1.7, .95, 1));
  B.add(new THREE.SphereGeometry(.8, 8, 6), MAT.flat, 0x8fc4ff, T(.95, .05, 0, 0, 0, 0, .9, .7, .85), .5);
  B.add(cyl(.18, .3, 3.4, 6), MAT.flat, 0x1b2440, T(-2.3, .2, 0, 0, 0, Math.PI / 2 - .08));
  B.add(box(.7, 1, .08), MAT.flat, 0xe8e8e8, T(-3.9, .7, 0));
  for (const s of [-1, 1]) B.add(box(2.6, .08, .08), MAT.flat, 0x222222, T(.1, -1.15, s * .7));
  B.add(box(.12, .1, .12), MAT.glow, 0xff3040, T(-4, 1.2, 0), 3);
  heli.add(B.build(false));
  const rotor = new THREE.Mesh(mergeGeos([box(7, .05, .25), box(.25, .05, 7)].map(g => { g = g.toNonIndexed(); g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 3).fill(.08), 3)); return g; })), MAT.flat);
  rotor.position.y = 1.05; heli.add(rotor); heli.userData.rotor = rotor;
}
const beam = new THREE.Mesh(new THREE.ConeGeometry(1.05, 1, 20, 1, true).translate(0, -.5, 0).rotateX(-Math.PI / 2),
  new THREE.MeshBasicMaterial({ color: 0xfff0c8, transparent: true, opacity: .035, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
scene.add(beam);
const spot = new THREE.Mesh(new THREE.CircleGeometry(1.15, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xfff0c8, transparent: true, opacity: .07, blending: THREE.AdditiveBlending, depthWrite: false }));
spot.position.y = .03; scene.add(spot);

/* ================================================================== SNIFFER (built to match the reference: green hood with a floppy tip,
   black face, big white goggle eyes, round respirator snout, green robe, belt with a brass buckle, black feet) */
const GREEN = 0x56733a, GREEN_DK = 0x3f5a2b;
function std(color, rough = .8, extra = {}) { return new THREE.MeshStandardMaterial({ color, roughness: rough, ...extra }); }
function buildSniffer() {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const add = (p, geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; p.add(m); return m; };
  const robeM = std(GREEN, .82), black = std(0x0c0c0e, .45), white = std(0xf4f4f0, .3, { emissive: 0xffffff, emissiveIntensity: .45 });
  for (const s of [-1, 1]) add(body, new THREE.SphereGeometry(.1, 12, 8), std(0x101012, .4), s * .13, .045, .05).scale.set(1, .6, 1.5); // feet
  add(body, new THREE.LatheGeometry([[.0, .1], [.29, .1], [.31, .14], [.3, .26], [.27, .4], [.23, .52], [.18, .6], [.0, .63]].map(([r, y]) => new THREE.Vector2(r, y)), 28), robeM);
  add(body, new THREE.CylinderGeometry(.262, .27, .055, 28, 1, true), std(0x2a2620, .6), 0, .42, 0);
  add(body, box(.075, .055, .025), std(0xd2b45a, .35, { metalness: .6 }), 0, .42, .272);
  const arms = [-1, 1].map(s => {
    const pv = new THREE.Group(); pv.position.set(s * .2, .5, .02); body.add(pv);
    add(pv, new THREE.CapsuleGeometry(.055, .13, 4, 8), robeM, 0, -.1, 0);
    add(pv, new THREE.SphereGeometry(.065, 10, 8), std(GREEN_DK, .85), 0, -.21, .01);
    return pv;
  });
  const head = new THREE.Group(); head.position.y = .58; body.add(head);
  add(head, new THREE.SphereGeometry(.3, 24, 18), robeM, 0, .27, 0).scale.y = 1.05; // hood
  add(head, new THREE.SphereGeometry(.255, 24, 18), black, 0, .26, .09); // face (pokes out of the hood opening)
  const tip = new THREE.Group(); tip.position.set(0, .55, -.03); head.add(tip);
  const t1 = add(tip, new THREE.ConeGeometry(.15, .24, 14).translate(0, .12, 0), robeM); t1.rotation.x = -.55;
  const t2g = new THREE.Group(); t2g.position.set(0, .2, 0); t1.add(t2g);
  add(t2g, new THREE.ConeGeometry(.08, .17, 12).translate(0, .085, 0), robeM).rotation.x = -.75;
  const pupils = [];
  for (const s of [-1, 1]) {
    const eye = new THREE.Group(); eye.position.set(s * .115, .31, .33); eye.rotation.y = s * .25; head.add(eye);
    add(eye, new THREE.TorusGeometry(.1, .03, 10, 30), std(0xeeeeea, .35, { emissive: 0xffffff, emissiveIntensity: .25 }));
    add(eye, new THREE.CircleGeometry(.101, 30), white, 0, 0, -.004);
    pupils.push(add(eye, new THREE.SphereGeometry(.05, 14, 10), std(0x050505, .2), 0, 0, .012));
  }
  const snout = new THREE.Group(); snout.position.set(0, .15, .37); head.add(snout);
  add(snout, new THREE.CylinderGeometry(.07, .082, .13, 22).rotateX(Math.PI / 2), black);
  add(snout, new THREE.TorusGeometry(.068, .018, 8, 24), std(0x9a9a9a, .4, { metalness: .4 }), 0, 0, .066);
  add(snout, new THREE.CircleGeometry(.055, 20), std(0x050505, .9), 0, 0, .068);
  const butt = new THREE.Object3D(); butt.position.set(0, .22, -.3); body.add(butt);
  return { root, body, head, tip, t1, t2g, pupils, arms, snout, butt };
}
function buildBoard() {
  const g = new THREE.Group(), sh = new THREE.Shape(), L = .42, W = .115, r = .1;
  sh.moveTo(-L + r, -W); sh.lineTo(L - r, -W); sh.quadraticCurveTo(L, -W, L, -W + r * .9); sh.lineTo(L, W - r * .9); sh.quadraticCurveTo(L, W, L - r, W);
  sh.lineTo(-L + r, W); sh.quadraticCurveTo(-L, W, -L, W - r * .9); sh.lineTo(-L, -W + r * .9); sh.quadraticCurveTo(-L, -W, -L + r, -W);
  const deck = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: .02, bevelEnabled: true, bevelThickness: .004, bevelSize: .004, bevelSegments: 1, curveSegments: 6 }).rotateX(-Math.PI / 2),
    [std(0x161616, .95), std(0x7ad94a, .5)]);
  deck.position.y = .1; deck.castShadow = deck.receiveShadow = true; g.add(deck);
  const metal = std(0xb8bcc4, .35, { metalness: .8 }), wheelM = new THREE.MeshStandardMaterial({ color: 0x9bff6a, emissive: 0x5bd13a, emissiveIntensity: 1.6, roughness: .4 });
  const wg = cyl(.034, .034, .032, 14).rotateX(Math.PI / 2), ws = [];
  for (const x of [-.29, .29]) {
    const tr = new THREE.Mesh(box(.05, .035, .2), metal); tr.position.set(x, .075, 0); tr.castShadow = true; g.add(tr);
    for (const z of [-.11, .11]) { const w = new THREE.Mesh(wg, wheelM); w.position.set(x, .034, z); g.add(w); ws.push(w); }
  }
  const glow = new THREE.PointLight(0x8dff5a, 1.2, 2.4, 2); glow.position.set(0, .05, 0); g.add(glow);
  return { g, ws, glow };
}
const SN = buildSniffer(), BOARD = buildBoard();
const skater = new THREE.Group(); skater.rotation.order = 'YXZ'; skater.add(BOARD.g); skater.add(SN.root);
SN.root.position.y = .124; SN.root.scale.setScalar(1.15); skater.position.set(0, 0, LANE); scene.add(skater);
for (const w of BOARD.ws) SPIN.push([w, .034, skater]);

/* ================================================================== billboard particles (gas + clouds): one instanced draw, sorted far → near */
function puffTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'); seed = 4242;
  for (let i = 0; i < 11; i++) {
    const px = 64 + (rnd() - .5) * 46, py = 66 + (rnd() - .5) * 34, r = 22 + rnd() * 30, g = x.createRadialGradient(px, py, 0, px, py, r);
    g.addColorStop(0, 'rgba(255,255,255,.55)'); g.addColorStop(.6, 'rgba(255,255,255,.22)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  }
  return new THREE.CanvasTexture(c);
}
const PUFF = puffTexture();
function Billboards(n) {
  const g = new THREE.InstancedBufferGeometry(); g.copy(new THREE.PlaneGeometry(1, 1)); g.instanceCount = 0;
  const pos = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3), sr = new THREE.InstancedBufferAttribute(new Float32Array(n * 2), 2), col = new THREE.InstancedBufferAttribute(new Float32Array(n * 4), 4);
  for (const a of [pos, sr, col]) a.setUsage(THREE.DynamicDrawUsage);
  g.setAttribute('iPos', pos); g.setAttribute('iSR', sr); g.setAttribute('iCol', col);
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { map: { value: PUFF }, uFog: { value: HOR.clone() }, uNear: { value: 30 }, uFar: { value: 130 } },
    vertexShader: `attribute vec3 iPos;attribute vec2 iSR;attribute vec4 iCol;varying vec2 vUv;varying vec4 vCol;varying float vD;
      void main(){vUv=uv;vCol=iCol;vec4 mv=modelViewMatrix*vec4(iPos,1.);float c=cos(iSR.y),s=sin(iSR.y);mv.xy+=mat2(c,s,-s,c)*position.xy*iSR.x;vD=-mv.z;gl_Position=projectionMatrix*mv;}`,
    fragmentShader: `uniform sampler2D map;uniform vec3 uFog;uniform float uNear,uFar;varying vec2 vUv;varying vec4 vCol;varying float vD;
      void main(){float a=texture2D(map,vUv).a*vCol.a;if(a<.005)discard;vec3 c=vCol.rgb*(.78+.4*vUv.y);float f=smoothstep(uNear,uFar,vD);gl_FragColor=vec4(mix(c,uFog,f),a*(1.-f*.7));}`,
  });
  const mesh = new THREE.Mesh(g, mat); mesh.frustumCulled = false; mesh.renderOrder = 3;
  const order = [], depth = new Float32Array(n), _f = V3();
  return {
    mesh, n, P: [],
    commit(cols) { // cols(p) → [r,g,b,a]; sorts by camera depth
      const P = this.P; cam.getWorldDirection(_f);
      order.length = P.length; for (let i = 0; i < P.length; i++) { order[i] = i; const p = P[i]; depth[i] = (p.x - cam.position.x) * _f.x + (p.y - cam.position.y) * _f.y + (p.z - cam.position.z) * _f.z; }
      order.sort((a, b) => depth[b] - depth[a]);
      for (let k = 0; k < order.length; k++) { const p = P[order[k]], c = cols(p); pos.setXYZ(k, p.x, p.y, p.z); sr.setXY(k, p.size, p.rot); col.setXYZW(k, c[0], c[1], c[2], c[3]); }
      g.instanceCount = P.length; pos.needsUpdate = sr.needsUpdate = col.needsUpdate = true;
    },
  };
}
const GAS = Billboards(520); scene.add(GAS.mesh);
let air = -SPEED; // the air's x-velocity in the current frame of reference (street: the world scrolls past)
function puff(x, y, z, o = {}) {
  if (GAS.P.length >= GAS.n) GAS.P.shift();
  GAS.P.push({ x, y, z, vx: o.vx ?? 0, vy: o.vy ?? .3, vz: o.vz ?? 0, age: 0, life: o.life ?? 1.6, s0: o.s0 ?? .25, s1: o.s1 ?? 1.4, size: 0, rot: R01() * 6.28, vr: (R01() - .5) * 1.2, drag: o.drag ?? 2.2, glow: o.glow ?? 1 });
}
const _bp = V3(), _bd = V3();
function fartBurst(n = 40, power = 1) {
  SN.butt.getWorldPosition(_bp); _bd.set(0, 0, -1).transformDirection(SN.body.matrixWorld);
  for (let i = 0; i < n; i++) {
    const sp = (2 + R01() * 4) * power;
    puff(_bp.x + (R01() - .5) * .2, _bp.y + (R01() - .3) * .2, _bp.z + (R01() - .5) * .2,
      { vx: _bd.x * sp + (R01() - .5) * 2.5 * power, vy: .2 + R01() * 1.4 * power, vz: _bd.z * sp + (R01() - .5) * 2.5 * power, life: 1.8 + R01() * 1.4, s0: .35 * power, s1: (1.6 + R01() * 1.8) * power, drag: 1.6, glow: 1.4 });
  }
  SN.squish = 1; fartSound(power, .35 + power * .35 + R01() * .3);
}
function stepGas(dt) {
  const P = GAS.P;
  for (let i = P.length - 1; i >= 0; i--) {
    const p = P[i]; p.age += dt; if (p.age >= p.life) { P.splice(i, 1); continue; }
    const k = Math.min(1, dt * p.drag);
    p.vx += (air - p.vx) * k; p.vz *= 1 - k * .6; p.vy += (.35 - p.vy) * k * .5;
    p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.rot += p.vr * dt;
    const u = p.age / p.life; p.size = p.s0 + (p.s1 - p.s0) * Math.pow(u, .45);
  }
  GAS.commit(p => { const u = p.age / p.life, a = Math.min(1, u * 12) * Math.pow(1 - u, 1.4) * .82, hot = Math.max(0, 1 - u * 3) * .5;
    return [(.52 + hot * .6) * p.glow, (.86 + hot * .3) * p.glow, (.28 + hot * .2) * p.glow, a]; });
}
function gasNear(x, y, z, r) { let n = 0; const r2 = r * r; for (const p of GAS.P) { const dx = p.x - x, dy = p.y - y, dz = p.z - z; if (dx * dx + dy * dy + dz * dz < r2) n += 1 - p.age / p.life; } return n; }

/* ================================================================== the ride: carve, ollie, wobble, look, sniff */
const RIDE = { t: 0, ollie: -1, nextOllie: 5, nextFart: 2.5, sniff: -1, lastZ: LANE, lastVz: 0 };
SN.squish = 0;
const TIP = { x: 0, v: 0, prevY: 0, prevV: 0 }; // the hood tip is a damped spring driven by vertical acceleration
const ptr = { x: 0, y: 0, cx: 0, cy: 0, seen: false };
const HOVER = { k: 0, was: false, puffT: 0 };
let clock = 0, started = false;
const _hp = V3(), _to = V3(), _iq = new THREE.Quaternion();
function stepRider(dt, mode) { // mode: 'street' | 'sky' | 'alley'
  const t = clock, b = REDUCED ? .3 : 1;
  // pose layers
  const crouch = (RIDE.crouch || 0);
  SN.body.position.y = -crouch * .06 + Math.sin(t * 9) * .006 * b;
  SN.squish = Math.max(0, SN.squish - dt * 3.5);
  const sq = Math.sin(SN.squish * Math.PI) * .12;
  SN.body.scale.set(1 + sq * .6, 1 - sq - crouch * .07, 1 + sq * .6);
  // arms: out for balance, swaying with the carve
  const lean = RIDE.lean || 0, armUp = .55 + Math.sin(t * 2.3) * .12 * b + Math.abs(lean) * 1.5 + (RIDE.armsUp || 0);
  SN.arms[0].rotation.set(Math.sin(t * 1.7) * .2, 0, -(armUp - lean * 1.2));
  SN.arms[1].rotation.set(-Math.sin(t * 1.9) * .2, 0, armUp + lean * 1.2);
  // head: look ahead, at the pointer when hovered, back at the cloud when sniffing it
  let yaw = mode === 'alley' ? (RIDE.headYaw ?? 0) : .75, pitch = 0;
  if (mode !== 'alley' && ptr.seen) { yaw += ptr.cx * .35; pitch += ptr.cy * .15; }
  yaw = lerp(yaw, .05, HOVER.k);
  if (RIDE.sniff >= 0) { const u = RIDE.sniff; yaw = lerp(yaw, -1.3, Math.sin(Math.min(1, u / 1.3) * Math.PI)); }
  SN.head.rotation.y = lerp(SN.head.rotation.y, yaw, damp(dt, 6));
  SN.head.rotation.x = lerp(SN.head.rotation.x, pitch + Math.sin(t * 2.1) * .03 * b, damp(dt, 6));
  SN.head.rotation.z = -lean * .6;
  // snout: sniff-sniff pumps
  const pump = RIDE.sniff >= 0 ? Math.max(0, Math.sin(RIDE.sniff * 18)) : (RIDE.sniffIdle || 0);
  SN.snout.scale.z = 1 + pump * .35; SN.snout.position.z = .37 + pump * .02;
  // pupils: wander, centre on the viewer when hovered
  RIDE.saccT = (RIDE.saccT ?? 0) - dt;
  if (RIDE.saccT < 0) { RIDE.saccT = .6 + R01() * 1.8; RIDE.sacc = [(R01() - .5) * .05, (R01() - .5) * .035]; }
  const [sx, sy] = HOVER.k > .5 ? [0, -.005] : RIDE.sacc || [0, 0];
  for (const p of SN.pupils) { p.position.x = lerp(p.position.x, sx, damp(dt, 14)); p.position.y = lerp(p.position.y, sy, damp(dt, 14)); }
  // hood tip spring
  SN.tip.updateWorldMatrix(true, false); const y = SN.tip.matrixWorld.elements[13];
  const vy = dt > 0 ? (y - TIP.prevY) / dt : 0, ay = dt > 0 ? (vy - TIP.prevV) / dt : 0; TIP.prevY = y; TIP.prevV = vy;
  for (let i = 0; i < 3; i++) { const h = dt / 3; TIP.v += (-120 * TIP.x - 5 * TIP.v - clamp(ay, -60, 60) * .9) * h; TIP.x += TIP.v * h; }
  SN.t1.rotation.x = -.55 + clamp(TIP.x, -.6, .6) * .8 + Math.sin(t * 7) * .02 * b; SN.t2g.rotation.z = clamp(TIP.x, -.6, .6) * .4;
}
function stepStreet(dt) {
  dist += SPEED * dt; RIDE.t += dt; const t = clock, b = REDUCED ? .3 : 1;
  roadTex.offset.x = (dist / PERIOD) % 1; for (const w of walks) w.material.map.offset.x = (dist / 6) % 1;
  for (const g of tiles) g.position.x = wrapX(g.userData.x0 - dist);
  for (const c of traffic) { c.userData.x += (c.userData.v - SPEED) * dt; c.userData.d = (c.userData.d || 0) - c.userData.v * dt; c.position.x = wrapX(c.userData.x); }
  // carve: lane weave, heading follows the weave, lean into the turn
  const z = LANE + (.55 * Math.sin(t * .8) + .2 * Math.sin(t * 1.9 + 1)) * b, vz = dt > 0 ? (z - RIDE.lastZ) / dt : 0, az = dt > 0 ? (vz - RIDE.lastVz) / dt : 0;
  RIDE.lastZ = z; RIDE.lastVz = vz;
  RIDE.lean = lerp(RIDE.lean || 0, clamp(az * .05, -.3, .3), damp(dt, 4));
  skater.position.z = z; skater.rotation.y = -Math.atan2(vz, SPEED); skater.rotation.x = RIDE.lean;
  // ollie every few seconds
  RIDE.nextOllie -= dt;
  if (RIDE.ollie < 0 && RIDE.nextOllie < 0 && !GAL.on && HOVER.k < .1 && !REDUCED) { RIDE.ollie = 0; RIDE.nextOllie = 5 + R01() * 5; clack(.7); }
  if (RIDE.ollie >= 0) {
    RIDE.ollie += dt; const u = RIDE.ollie / .62;
    skater.position.y = .5 * 4 * u * (1 - u); BOARD.g.rotation.z = u < .3 ? Math.sin(u / .3 * Math.PI) * .45 : 0; RIDE.armsUp = Math.sin(u * Math.PI) * .6;
    if (u >= 1) { RIDE.ollie = -1; skater.position.y = 0; BOARD.g.rotation.z = 0; RIDE.armsUp = 0; clack(1); }
  } else skater.position.y = Math.abs(Math.sin(t * 13)) * .008 * b; // road buzz
  skater.userData.d = dist;
  // gas: a constant wisp + a proper fart every few seconds (then he turns round and sniffs it)
  RIDE.trail = (RIDE.trail || 0) + dt * 40;
  SN.butt.getWorldPosition(_bp);
  for (; RIDE.trail >= 1; RIDE.trail--) puff(_bp.x + (R01() - .5) * .1, _bp.y + (R01() - .5) * .1, _bp.z, { vx: -R01() * 4, vy: .1 + R01() * .4, vz: -.5 + (R01() - .5) * 1.6, life: .9 + R01() * .6, s0: .1, s1: .55 + R01() * .55 });
  RIDE.nextFart -= dt;
  if (RIDE.nextFart < 0 && !GAL.on) { RIDE.nextFart = 2.5 + R01() * 3.5; fartBurst(34 + R01() * 20 | 0, .8 + R01() * .5); RIDE.sniff = 0; }
  if (RIDE.sniff >= 0) { RIDE.sniff += dt; if (RIDE.sniff > 1.3) RIDE.sniff = -1; if (RIDE.sniff > .45 && !RIDE.sniffed) { RIDE.sniffed = true; sniffSound(); } } else RIDE.sniffed = false;
  // hover: he turns to you and lets one go
  HOVER.k = lerp(HOVER.k, hoverOn() ? 1 : 0, damp(dt, 6));
  const hov = HOVER.k > .5; if (hov && !HOVER.was) { fartBurst(18, .6); } HOVER.was = hov;
  // cops: tail him, weave; drive into the gas and the windshield goes green, they swerve and drop back
  cops.forEach((c, i) => {
    const u = c.userData, ph = u.ph;
    const exp = gasNear(c.position.x + 1.6, 1.1, c.position.z, 2.4);
    u.gas = lerp(u.gas, clamp(exp / 9, 0, 1), damp(dt, exp > 1 ? 3 : .5));
    const g = u.gas;
    c.position.x = u.x0 + Math.sin(t * .23 + ph) * 1.6 + Math.sin(t * .71 + ph) * .5 - g * 6;
    const cz = u.z0 + Math.sin(t * .47 + ph) * .7 + Math.sin(t * 7.3 + ph) * g * .9;
    const cvz = dt > 0 ? (cz - c.position.z) / dt : 0; c.position.z = cz;
    c.rotation.y = -Math.atan2(cvz, SPEED) + Math.sin(t * 9 + ph) * g * .06;
    u.ws.material.color.setRGB(lerp(.13, .35, g), lerp(.19, .75, g), lerp(.25, .18, g)); u.ws.material.emissive.setRGB(g * .15, g * .4, 0);
    const f = (t * 2.4 + i * .3) % 1, red = f < .5 && f % .25 < .16, blue = f >= .5 && f % .25 < .16;
    u.bars[0].visible = red; u.bars[1].visible = blue; u.light.color.set(red ? 0xff2030 : 0x2050ff); u.light.intensity = red || blue ? 7 : 0;
    u.d = dist;
  });
  // helicopter + searchlight
  heli.position.set(-5 + Math.sin(t * .17) * 3, 13 + Math.sin(t * .5) * .6, -4 + Math.sin(t * .13) * 2);
  heli.rotation.set(Math.sin(t * .4) * .05, Math.sin(t * .2) * .2, -.12);
  heli.userData.rotor.rotation.y += dt * 30;
  const tx = skater.position.x + Math.sin(t * 1.3) * .5, tz = skater.position.z + Math.sin(t * 1.1) * .4;
  beam.position.copy(heli.position).add(_to.set(.6, -.9, 0)); beam.lookAt(tx, 0, tz); beam.scale.z = beam.position.distanceTo(_hp.set(tx, 0, tz));
  spot.position.x = tx; spot.position.z = tz;
  for (const [w, r, o] of SPIN) w.rotation.z = -(o.userData.d || 0) / r;
  BOARD.glow.intensity = 1 + Math.sin(t * 20) * .2;
  sky.position.copy(cam.position);
}

/* ================================================================== camera stations */
const STATIONS = [
  { name: 'Home', pos: V3(5.2, 1.75, 7), look: V3(-1.6, .8, 1.3), fov: 34, par: .5 },
  { name: 'About', pos: V3(2.3, 1.15, 4.7), look: V3(.1, .85, 1.8), lw: V3(.95, .88, 1.8), pl: V3(.1, .62, 1.8), fov: 36, par: .25 },
  { name: 'Memes', pos: V3(-4.6, 1.3, 5.3), look: V3(1.6, .9, 1.7), fov: 44, par: .3 },
];
const ST_ABOUT = 1, ST_MEMES = 2;
let station = clamp(parseInt(Q.get('shot') ?? '0', 10) || 0, 0, 2);
const lookOf = S => innerWidth < innerHeight && S.pl ? S.pl : S.lw ? S.look.clone().lerp(S.lw, clamp((innerWidth / innerHeight - 1.1) / .5, 0, 1)) : S.look;
const camState = { pos: STATIONS[station].pos.clone(), look: lookOf(STATIONS[station]).clone(), fov: STATIONS[station].fov, roll: 0, par: .5 };
let travel = null, lockUntil = 0;
function go(i, instant = REDUCED) {
  i = clamp(i, 0, STATIONS.length - 1); if (i === station && !instant) return;
  const now = performance.now(); if (now < lockUntil) return; lockUntil = now + 900;
  station = i; const S = STATIONS[i];
  document.querySelectorAll('nav .btn').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.s === i)));
  $('live').textContent = S.name;
  const ab = $('about'), on = i === ST_ABOUT; ab.classList.toggle('on', on); ab.setAttribute('aria-hidden', String(!on)); ab.toggleAttribute('inert', !on);
  if (GAL.on && i !== ST_MEMES) { endGallery(); instant = true; }
  if (i === ST_MEMES) startGallery();
  if (!instant) $('ui').classList.add('nav-used');
  if (instant) { Object.assign(camState, { pos: S.pos.clone(), look: lookOf(S).clone(), fov: S.fov, par: S.par }); travel = null; return; }
  const from = { pos: camState.pos.clone(), look: camState.look.clone(), fov: camState.fov, par: camState.par };
  const mid = from.pos.clone().lerp(S.pos, .5); mid.y += from.pos.distanceTo(S.pos) * .25;
  travel = { from, to: S, mid, t: 0, dur: i === ST_MEMES ? .8 : 2.4 }; whoosh(.6);
}
function stepTravel(dt) {
  if (!travel) return;
  travel.t = Math.min(1, travel.t + dt / travel.dur);
  const k = ease(travel.t), u = 1 - k, { from, to, mid } = travel;
  camState.pos.set(0, 0, 0).addScaledVector(from.pos, u * u).addScaledVector(mid, 2 * u * k).addScaledVector(to.pos, k * k);
  camState.look.lerpVectors(from.look, lookOf(to), k);
  camState.fov = lerp(from.fov, to.fov, k) + Math.sin(k * Math.PI) * 7; camState.roll = Math.sin(k * Math.PI) * .06; camState.par = lerp(from.par, to.par, k);
  if (travel.t >= 1) { travel = null; camState.roll = 0; }
}

/* ================================================================== MEMES: mega fart → launch into the sky → card carousel */
const GAL = { on: false, t: 0, sky: false, idx: 0, side: 0, yaw: 0, yaw0: 0, slide: 1, ui: 0, hov: 0, fly: 0 };
const STREET = [road, ground, curbs, ...walks, ...tiles, ...traffic, ...cops, heli, beam, spot];
const CLOUDS = Billboards(420); CLOUDS.mesh.visible = false; scene.add(CLOUDS.mesh);
CLOUDS.mesh.material.uniforms.uNear.value = 150; CLOUDS.mesh.material.uniforms.uFar.value = 400; CLOUDS.mesh.renderOrder = 1;
{ seed = 909; const P = CLOUDS.P;
  for (let i = 0; i < 42; i++) {
    const side = rnd() < .5 ? -1 : 1, z = side * (6 + Math.pow(rnd(), .7) * 55); let y = -14 + rnd() * 26;
    if (Math.abs(z) < 14 && y > -5 && y < 6) y = rnd() < .5 ? -5 - rnd() * 6 : 6 + rnd() * 5;
    const cx = (rnd() - .5) * 220, w = 3 + Math.abs(z) / 60 * 8 + rnd() * 3;
    for (let k = 0, n = 8 + (rnd() * 7 | 0); k < n; k++) { const u = rnd() * 2 - 1, h = rnd(); P.push({ bx: cx + u * w, y: y + h * w * .4 * (1 - u * u * .6), z: z + (rnd() - .5) * w * .5, size: w * (.5 + rnd() * .35) * (1 - Math.abs(u) * .3), rot: rnd() * 6, b: .65 + .35 * h, x: 0 }); }
  } }
function stepClouds(shift, lift) {
  for (const p of CLOUDS.P) { p.x = ((p.bx - shift + 110) % 220 + 220) % 220 - 110; p.yy = p.y + lift; }
  const P = CLOUDS.P, save = P.map(p => p.y); P.forEach(p => { p.y = p.yy; });
  CLOUDS.commit(p => { const e = Math.min(1, (110 - Math.abs(p.x)) / 18); return [lerp(.62, 1.05, p.b), lerp(.5, .86, p.b), lerp(.72, .95, p.b), .9 * Math.max(0, e)]; });
  P.forEach((p, i) => { p.y = save[i]; });
}
const texLoader = new THREE.TextureLoader(), memeTex = [], memeURL = [];
function placeholder(i) {
  const c = document.createElement('canvas'); c.width = c.height = 512; const x = c.getContext('2d');
  const g = x.createRadialGradient(256, 230, 20, 256, 256, 360); g.addColorStop(0, '#9be35a'); g.addColorStop(1, '#1d3a12'); x.fillStyle = g; x.fillRect(0, 0, 512, 512);
  x.fillStyle = '#10240a'; x.font = 'bold 220px monospace'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('?', 256, 230);
  x.fillStyle = '#eaffd8'; x.font = 'bold 30px monospace'; x.fillText('MEME #' + (i + 1), 256, 400); x.font = '20px monospace'; x.fillText('drop it in memes/', 256, 440);
  return c;
}
function memeMap(i) {
  for (const j of [i, (i + 1) % MEMES.length, (i + MEMES.length - 1) % MEMES.length]) if (!memeTex[j]) {
    const fallback = () => { const c = placeholder(j); memeTex[j].image = c; memeTex[j].needsUpdate = true; memeURL[j] = c.toDataURL(); };
    memeURL[j] = MEMES[j].src;
    const t = memeTex[j] = texLoader.load(MEMES[j].src, undefined, undefined, fallback); t.colorSpace = THREE.SRGBColorSpace;
  }
  return memeTex[i];
}
const CARD = 1.15, cardBack = std(0x1d3a12, .6, { metalness: .2 });
const card = (() => { const faces = [0, 1].map(() => new THREE.MeshBasicMaterial({ fog: false })), m = new THREE.Mesh(box(CARD, CARD, .05), [cardBack, cardBack, cardBack, cardBack, ...faces]); m.visible = false; m.userData.faces = faces; scene.add(m); return m; })();
const SKY_CAM = { pos: V3(-5.8, 2.5, 3.4), look: V3(2, .5, 0), fov: 44 };
const _gx = V3(), _gy = V3(), _gz = V3(), _gp = V3(), _ge = new THREE.Euler(), _gq = new THREE.Quaternion();
function galFlash() { const f = $('flash'); f.classList.remove('go'); void f.offsetWidth; f.classList.add('go'); }
function setGalUI(on) { const g = $('gal'); g.classList.toggle('on', on); g.setAttribute('aria-hidden', String(!on)); g.toggleAttribute('inert', !on); }
function galCaption() { const m = MEMES[GAL.idx]; $('galCap').innerHTML = ''; const b = document.createElement('b'); b.textContent = m.name; $('galCap').append(`${GAL.idx + 1}/${MEMES.length} · It's `, b, `. ${m.ask}`); }
function startGallery() { Object.assign(GAL, { on: true, t: 0, sky: false, ui: 0, fly: 0, launched: false }); galCaption(); RIDE.crouch = 0; }
function endGallery() {
  $('galImg').classList.remove('on'); GAL.hov = 0;
  if (!GAL.on) return; const wasSky = GAL.sky; Object.assign(GAL, { on: false, sky: false, ui: 0 });
  if (wasSky) galFlash();
  for (const o of STREET) o.visible = true; CLOUDS.mesh.visible = false; setSky(false); air = -SPEED;
  skater.position.set(0, 0, LANE); skater.rotation.set(0, 0, 0); RIDE.crouch = 0; RIDE.armsUp = 0; GAS.P.length = 0;
  card.visible = false; setGalUI(false); cvs.style.cursor = '';
}
function setSky(on) {
  const u = sky.material.uniforms; u.uHor.value.copy(on ? SKY_HOR : HOR); u.uMid.value.copy(on ? SKY_MID : MID); u.uTop.value.copy(on ? SKY_TOP : TOP);
  scene.fog.color.copy(on ? SKY_HOR : HOR); GAS.mesh.material.uniforms.uFog.value.copy(scene.fog.color);
  fill.intensity = on ? 2.2 : 0; scene.fog.far = on ? 400 : 128; GAS.mesh.material.uniforms.uFar.value = on ? 400 : 130;
}
function showMeme(dir) {
  if (!GAL.sky || GAL.slide < 1) return;
  GAL.idx = (GAL.idx + dir + MEMES.length) % MEMES.length; GAL.slide = 0;
  GAL.side ^= 1; const f = card.userData.faces[GAL.side]; f.map = memeMap(GAL.idx); f.needsUpdate = true;
  GAL.yaw0 = GAL.yaw; GAL.yaw += dir * Math.PI; galCaption(); pfft();
}
function stepGallery(dt) {
  if (!GAL.on) return;
  GAL.t += dt; const t = GAL.t;
  if (!GAL.sky) { // 0–.7 crouch and tremble · .7 MEGA FART · .7–2.1 he rockets up out of frame on the gas
    RIDE.crouch = clamp(t / .6, 0, 1); SN.root.position.x = t < .7 ? Math.sin(clock * 70) * .015 : 0;
    if (t > .7 && !GAL.launched) { GAL.launched = true; fartBurst(120, 2.2); megaFart(); for (const c of cops) c.userData.gas = 1; }
    if (t > .7) {
      const b = clamp((t - .7) / 1.4, 0, 1); RIDE.crouch = 0; RIDE.armsUp = .8;
      skater.position.y = 30 * Math.pow(b, 2.2); skater.position.x = 6 * b; skater.rotation.z = .3 * b;
      SN.butt.getWorldPosition(_bp); for (let i = 0; i < 6; i++) puff(_bp.x, _bp.y - .1, _bp.z, { vx: (R01() - .5) * 3, vy: -6 - R01() * 6, vz: (R01() - .5) * 3, life: 2, s0: .5, s1: 2.6, drag: 1.2, glow: 1.5 });
    }
    if (t >= 2.1) { // whoosh → sky
      GAL.sky = true; galFlash(); travel = null; air = -14;
      for (const o of STREET) o.visible = false; CLOUDS.mesh.visible = true; setSky(true); GAS.P.length = 0;
      Object.assign(camState, { pos: SKY_CAM.pos.clone(), look: SKY_CAM.look.clone(), fov: SKY_CAM.fov, par: .25, roll: 0 });
    }
    return;
  }
  const st = t - 2.1, rise = 1 - Math.pow(1 - clamp(st / 1.5, 0, 1), 3), side = ease(clamp((st - 2) / .8, 0, 1));
  cam.updateMatrixWorld(); _gx.setFromMatrixColumn(cam.matrixWorld, 0); _gy.setFromMatrixColumn(cam.matrixWorld, 1); _gz.setFromMatrixColumn(cam.matrixWorld, 2).negate();
  const portrait = cam.aspect < 1, dC = SKY_CAM.pos.distanceTo(SKY_CAM.look), hh = dC * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)), hw = hh * cam.aspect;
  _gp.copy(SKY_CAM.look).addScaledVector(portrait ? _gy : _gx, side * (portrait ? -hh * .35 : hw * .42));
  skater.position.copy(_gp).addScaledVector(_gy, (1 - rise) * -12); skater.position.y += Math.sin(clock * 1.5) * .15 * rise;
  skater.rotation.set(Math.sin(clock * 1.2) * .08, -.7 + Math.sin(clock * .7) * .1, .25 * (1 - rise) + Math.sin(clock * 1.4) * .05);
  RIDE.armsUp = .5 + Math.sin(clock * 3) * .1;
  SN.butt.getWorldPosition(_bp); // the gas jet that keeps him up
  for (let i = 0; i < 3; i++) puff(_bp.x, _bp.y - .1, _bp.z, { vx: -3 - R01() * 3, vy: -2 - R01() * 2, vz: (R01() - .5) * 1.5, life: 1.4, s0: .3, s1: 1.5, drag: 1.5 });
  GAL.fly += 30 * dt; stepClouds(GAL.fly, 20 * (1 - rise));
  GAL.ui = clamp((st - 2.2) / .5, 0, 1); if (GAL.ui > 0 && !$('gal').classList.contains('on')) setGalUI(true);
  const D = 3.2, hH = D * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)), hW = hH * cam.aspect, sc = (portrait ? hH * .55 : hH * .82) / CARD;
  const cx = portrait ? 0 : -hW * .42 - (1 - ease(GAL.ui)) * hW, cy = portrait ? hH * .18 : hH * .02;
  GAL.slide = Math.min(1, GAL.slide + dt / .55); const sk = ease(GAL.slide), pop = Math.sin(GAL.slide * Math.PI);
  card.visible = GAL.ui > 0;
  if (card.visible) {
    const f0 = card.userData.faces[GAL.side]; if (!f0.map) { f0.map = memeMap(GAL.idx); f0.needsUpdate = true; }
    card.position.copy(cam.position).addScaledVector(_gz, D).addScaledVector(_gx, cx).addScaledVector(_gy, cy + pop * .06 * sc);
    const calm = 1 - GAL.hov;
    card.quaternion.copy(cam.quaternion).multiply(_gq.setFromEuler(_ge.set(Math.sin(clock * .7) * .08 * calm, lerp(GAL.yaw0, GAL.yaw, sk) + Math.sin(clock * .9) * .4 * (1 - pop) * calm, Math.sin(clock * .6) * .06 * calm)));
    card.scale.setScalar(sc * (1 - .08 * pop));
  }
  const c = _gp.copy(cam.position).addScaledVector(_gz, D).addScaledVector(_gx, cx).addScaledVector(_gy, cy).project(cam);
  const w = CARD * sc / (2 * hW), h = CARD * sc / (2 * hH);
  const over = card.visible && ptr.seen && GAL.slide >= 1 && Math.abs(ptr.x - c.x) < w && Math.abs(-ptr.y - c.y) < h;
  GAL.hov = lerp(GAL.hov, over ? 1 : 0, damp(dt, 10));
  const img = $('galImg'); if (img.dataset.i !== String(GAL.idx) && memeURL[GAL.idx]) { img.src = memeURL[GAL.idx]; img.alt = MEMES[GAL.idx].name; img.dataset.i = GAL.idx; }
  Object.assign(img.style, { left: `${(c.x - w + 1) / 2 * 100}%`, top: `${(1 - c.y - h) / 2 * 100}%`, width: `${w * 100}%`, height: `${h * 100}%` });
  img.classList.toggle('on', GAL.hov > .6); cvs.style.cursor = over ? 'zoom-in' : '';
  for (const [id, s] of [['galPrev', -1], ['galNext', 1]]) {
    const p = _gp.copy(cam.position).addScaledVector(_gz, D).addScaledVector(_gx, cx + s * (CARD * sc * .5 + .3 * sc)).addScaledVector(_gy, cy).project(cam);
    Object.assign($(id).style, { left: `${(p.x + 1) / 2 * 100}%`, top: `${(1 - p.y) / 2 * 100}%` });
  }
}

/* ================================================================== INTRO: a back alley. Manhole steam → pull back → RIDE → he hops on, charges, and gasses the screen */
const alley = new THREE.Scene();
alley.background = new THREE.Color(0x0b0714); alley.fog = new THREE.Fog(0x0b0714, 4, 15);
const brickTex = canvasTex(32, 32, (x, w, h) => {
  x.fillStyle = '#4a2a2e'; x.fillRect(0, 0, w, h);
  for (let r = 0; r < 8; r++) for (let c = 0; c < 4; c++) { const v = 80 + rnd() * 40 | 0; x.fillStyle = `rgb(${v + 30},${v - 20},${v - 25})`; x.fillRect(c * 8 + (r % 2) * 4, r * 4, 7, 3); }
}, [6, 2]);
const wetTex = canvasTex(32, 64, (x, w, h) => { x.fillStyle = '#1c1820'; x.fillRect(0, 0, w, h); specks(x, w, h, 500, () => { const v = 30 + rnd() * 25 | 0; return `rgb(${v},${v - 3},${v + 6})`; }); }, [3, 6]);
function graffiti() {
  return canvasTex(128, 64, (x, w, h) => {
    x.clearRect(0, 0, w, h); x.font = 'bold 40px Impact, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.lineWidth = 6; x.strokeStyle = '#10240a'; x.strokeText('SNIFF', w / 2, h / 2); x.fillStyle = '#9be35a'; x.fillText('SNIFF', w / 2, h / 2);
    x.fillStyle = '#9be35a'; for (let i = 0; i < 9; i++) { const px = 20 + rnd() * 88; x.fillRect(px, h / 2 + 12, 2, 6 + rnd() * 18); } // drips
  });
}
const noFartTex = canvasTex(32, 32, (x, w, h) => { x.fillStyle = '#f2f2ee'; x.fillRect(0, 0, w, h); x.strokeStyle = '#c21f2f'; x.lineWidth = 3; x.beginPath(); x.arc(16, 16, 12, 0, 7); x.stroke(); x.fillStyle = '#5a7a3a'; x.beginPath(); x.arc(16, 17, 6, 0, 7); x.fill(); x.beginPath(); x.moveTo(7, 7); x.lineTo(25, 25); x.stroke(); });
{
  const add = (geo, mat, x, y, z, ry = 0, rx = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, 0); m.receiveShadow = true; alley.add(m); return m; };
  add(new THREE.PlaneGeometry(5, 16), new THREE.MeshStandardMaterial({ map: wetTex, roughness: .32, metalness: .15 }), 0, 0, -3, 0, -Math.PI / 2);
  const brick = new THREE.MeshStandardMaterial({ map: brickTex, roughness: .95 });
  add(new THREE.PlaneGeometry(16, 6), brick, -2.3, 3, -3, Math.PI / 2); add(new THREE.PlaneGeometry(16, 6), brick, 2.3, 3, -3, -Math.PI / 2);
  add(new THREE.PlaneGeometry(5, 6), brick, 0, 3, -10);
  add(new THREE.PlaneGeometry(2.4, 1.2), new THREE.MeshBasicMaterial({ map: graffiti(), transparent: true, color: new THREE.Color(.55, .55, .55) }), -2.28, 1.5, -.8, Math.PI / 2);
  add(new THREE.PlaneGeometry(.5, .5), new THREE.MeshStandardMaterial({ map: noFartTex, roughness: .7 }), 2.28, 1.7, -1.6, -Math.PI / 2);
  add(box(1.2, 2.1, .1), std(0x2a2f35, .7), 0, 1.05, -9.94); // back door
  const exitM = new THREE.MeshBasicMaterial({ color: new THREE.Color(0x6bff7a).multiplyScalar(2) }); add(box(.5, .18, .05), exitM, 0, 2.4, -9.9);
  const B = bag();
  B.add(box(1.7, 1.15, 1), MAT.flat, 0x2f5a5a, T(-1.55, .58, -2.2)); B.add(box(1.75, .1, 1.05), MAT.flat, 0x244848, T(-1.55, 1.2, -2.25, -.2));
  seed = 515; for (let i = 0; i < 5; i++) { const s = .35 + rnd() * .2; B.add(new THREE.IcosahedronGeometry(s, 1), MAT.flat, 0x141418, T(1.7 + (rnd() - .5) * .6, s * .7, -3 + (rnd() - .5) * 1.4, rnd(), rnd(), 0, 1, .75, 1)); }
  for (const y of [2.6, 2.9]) B.add(cyl(.06, .06, 12, 6), MAT.flat, 0x5a5a62, T(2.18, y, -4, Math.PI / 2));
  B.add(cyl(.06, .06, 3.2, 6), MAT.flat, 0x5a5a62, T(2.18, 1.3, -.9));
  B.add(cyl(.42, .42, .02, 18), MAT.flat, 0x2a2a30, T(.55, .01, .9));
  for (let k = 0; k < 4; k++) B.add(box(.5, .022, .05), MAT.glow, 0x7dff5a, T(.55, .012, .9 - .18 + k * .12), 2.2); // glowing manhole slits
  const g = B.build(); alley.add(g);
}
alley.add(new THREE.HemisphereLight(0x5a4a8a, 0x1a1218, .7));
const doorLamp = new THREE.PointLight(0xffb36b, 6, 7, 1.6); doorLamp.position.set(0, 2.9, -9.2); alley.add(doorLamp);
const holeLight = new THREE.PointLight(0x7dff5a, 3, 3.5, 1.5); holeLight.position.set(.55, .35, .9); alley.add(holeLight);
const copL = [0xff2030, 0x2050ff].map((c, i) => { const l = new THREE.PointLight(c, 0, 12, 1.4); l.position.set(i ? 1.3 : -1.3, 1.7, 5.5); alley.add(l); return l; });
const AK = { // camera keys
  hole: { pos: V3(.55, .55, 1.65), look: V3(.55, 0, .85), fov: 40 },
  wide: { pos: V3(.2, 1.1, 3.6), look: V3(.1, .62, 0), fov: 42 },
  low: { pos: V3(.75, .6, 2.7), look: V3(0, .5, -2), fov: 48 },
};
const INTRO = { on: false, ph: 'off', t: 0, a: null, b: null, bt: 0, dur: 1 };
function camKey(k, dur) { INTRO.a = { pos: camState.pos.clone(), look: camState.look.clone(), fov: camState.fov }; INTRO.b = AK[k]; INTRO.bt = 0; INTRO.dur = dur; }
function stepCamKey(dt) { if (!INTRO.b) return; INTRO.bt = Math.min(1, INTRO.bt + dt / INTRO.dur); const k = ease(INTRO.bt); camState.pos.lerpVectors(INTRO.a.pos, INTRO.b.pos, k); camState.look.lerpVectors(INTRO.a.look, INTRO.b.look, k); camState.fov = lerp(INTRO.a.fov, INTRO.b.fov, k); }
function startIntro() {
  INTRO.on = true; INTRO.ph = 'pull'; INTRO.t = 0;
  alley.add(skater); alley.add(GAS.mesh); air = 0; GAS.P.length = 0;
  skater.position.set(0, 0, 0); skater.rotation.set(0, Math.PI / 2, 0); // board heads down the alley (−Z)
  BOARD.g.position.set(-.15, 0, .5); BOARD.g.rotation.set(0, .35, 0); // board lying beside him
  SN.root.position.set(0, 0, -.25); SN.root.rotation.y = -Math.PI / 2; // standing, facing the camera
  Object.assign(camState, { ...AK.hole, pos: AK.hole.pos.clone(), look: AK.hole.look.clone(), par: 0, roll: 0 });
  camKey('wide', 4.5); sirenFar();
  GAS.mesh.material.uniforms.uFog.value.set(0x0b0714); GAS.mesh.material.uniforms.uNear.value = 4; GAS.mesh.material.uniforms.uFar.value = 15;
}
function rideClick() { if (INTRO.ph !== 'wait') return; $('ride').classList.remove('on'); INTRO.ph = 'hop'; INTRO.t = 0; camKey('low', .9); clack(.6); }
function stepIntro(dt) {
  INTRO.t += dt; const t = INTRO.t; stepCamKey(dt);
  const f = (clock * 1.6) % 1; copL[0].intensity = f < .5 && f % .25 < .15 ? 9 : 0; copL[1].intensity = f >= .5 && f % .25 < .15 ? 9 : 0;
  doorLamp.intensity = 6 * (R01() < .03 ? .2 : 1);
  if (R01() < dt * 5) puff(.55 + (R01() - .5) * .5, .05, .9 + (R01() - .5) * .5, { vx: (R01() - .5) * .2, vy: .5 + R01() * .4, vz: (R01() - .5) * .2, life: 2.2, s0: .15, s1: .7, drag: .8, glow: .9 }); // manhole steam
  if (INTRO.ph === 'pull' || INTRO.ph === 'wait') { // idle: sniffing around, glancing at the police lights
    RIDE.headYaw = Math.sin(clock * .7) * .6 + (copL[0].intensity > 0 ? -.25 : copL[1].intensity > 0 ? .25 : 0);
    RIDE.sniffIdle = Math.max(0, Math.sin(clock * 9)) * (Math.sin(clock * .9) > .3 ? 1 : 0);
    if (INTRO.ph === 'pull' && t > 4.6) { INTRO.ph = 'wait'; $('ride').classList.add('on'); $('ride').focus({ preventScroll: true }); }
  }
  if (INTRO.ph === 'hop') { // hops onto the board
    RIDE.sniffIdle = 0; const k = clamp(t / .45, 0, 1);
    BOARD.g.rotation.y = lerp(.35, 0, k); BOARD.g.position.set(lerp(-.15, 0, k), 0, lerp(.5, 0, k));
    SN.root.position.set(0, .124 * k + Math.sin(k * Math.PI) * .35, lerp(-.25, 0, k)); SN.root.rotation.y = lerp(-Math.PI / 2, 0, k); RIDE.headYaw = lerp(RIDE.headYaw, 1.2, k * .3);
    if (k >= 1) { INTRO.ph = 'charge'; INTRO.t = 0; clack(1); chargeSound(); }
  }
  if (INTRO.ph === 'charge') { // crouch, tremble, hood tip shaking
    RIDE.crouch = clamp(t / .5, 0, 1); SN.root.position.x = Math.sin(clock * 80) * .012; RIDE.headYaw = 1.2;
    if (R01() < dt * 20) { SN.butt.getWorldPosition(_bp); puff(_bp.x, _bp.y, _bp.z, { vx: 0, vy: .3, vz: -.5, life: 1, s0: .1, s1: .5 }); }
    if (t > .95) { INTRO.ph = 'blast'; INTRO.t = 0; RIDE.crouch = 0; fartBurst(140, 2.4); megaFart(); }
  }
  if (INTRO.ph === 'blast') { // he blasts off down the alley; the cloud rolls over the camera
    const k = t; skater.position.z = -Math.pow(k, 2) * 9; SN.root.position.x = 0; RIDE.armsUp = .7;
    SN.butt.getWorldPosition(_bp); for (let i = 0; i < 5; i++) puff(_bp.x, _bp.y, _bp.z, { vx: (R01() - .5) * 4, vy: R01() * 1.5, vz: 6 + R01() * 6, life: 2.2, s0: .5, s1: 3.2, drag: .5, glow: 1.3 });
    camState.pos.x += Math.sin(clock * 60) * .01; camState.pos.y += Math.sin(clock * 47) * .01; // shake
    comp.uniforms.uGas.value = clamp((t - .5) / .7, 0, 1);
    if (t > 1.3) endIntro();
  }
}
function endIntro() {
  if (!INTRO.on) return; INTRO.on = false; INTRO.ph = 'off'; $('ride').classList.remove('on');
  scene.add(skater); scene.add(GAS.mesh); GAS.P.length = 0; air = -SPEED;
  GAS.mesh.material.uniforms.uFog.value.copy(HOR); GAS.mesh.material.uniforms.uNear.value = 30; GAS.mesh.material.uniforms.uFar.value = 130;
  skater.position.set(0, 0, LANE); skater.rotation.set(0, 0, 0); BOARD.g.position.set(0, 0, 0); BOARD.g.rotation.set(0, 0, 0);
  SN.root.position.set(0, .124, 0); SN.root.rotation.y = 0; RIDE.crouch = 0; RIDE.armsUp = 0; RIDE.headYaw = undefined; RIDE.sniffIdle = 0;
  station = -1; lockUntil = 0; go(0, true); $('ui').classList.add('on'); startChaseAudio();
  comp.uniforms.uGlitch.value = 1; comp.uniforms.uGas.value = 1; GASOUT.t = 0; // the cloud clears to reveal the street
}
const GASOUT = { t: -1 };

/* ================================================================== sound: all synthesized */
const SND = { ctx: null, on: true, out: null, nz: null };
function audioInit() {
  if (SND.ctx) { SND.ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
  const c = SND.ctx = new AC(); SND.out = c.createGain(); SND.out.gain.value = SND.on ? .8 : 0;
  const comp = c.createDynamicsCompressor(); comp.threshold.value = -14; SND.out.connect(comp).connect(c.destination);
}
const out = () => (SND.ctx && SND.ctx.state === 'running' && SND.on) ? SND.ctx : null;
function noise(c) { if (SND.nz) return SND.nz; const b = c.createBuffer(1, c.sampleRate * 2, c.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return SND.nz = b; }
function fartSound(power = 1, dur = .6) { // buzzy low oscillator, random-walk pitch, lip-flutter AM, a "pfff" of noise at the end
  const c = out(); if (!c) return; const t0 = c.currentTime, o = c.createOscillator(), lp = c.createBiquadFilter(), g = c.createGain();
  o.type = 'sawtooth'; const f0 = (95 - power * 18) * (.85 + Math.random() * .35), curve = new Float32Array(24); let f = f0;
  for (let i = 0; i < 24; i++) { f = clamp(f + (Math.random() - .55) * 18, 38, 190); curve[i] = f * (1 - i / 24 * .3); }
  o.frequency.setValueCurveAtTime(curve, t0, dur);
  lp.type = 'lowpass'; lp.frequency.value = 520 + power * 200; lp.Q.value = 4;
  const am = c.createOscillator(), ag = c.createGain(); am.type = 'square'; am.frequency.value = 22 + Math.random() * 20; ag.gain.value = .35; am.connect(ag).connect(g.gain);
  g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(.32 * Math.min(1.4, power), t0 + .03); g.gain.setValueAtTime(.32 * Math.min(1.4, power), t0 + dur * .75); g.gain.linearRampToValueAtTime(0, t0 + dur);
  o.connect(lp).connect(g).connect(SND.out); o.start(t0); am.start(t0); o.stop(t0 + dur + .05); am.stop(t0 + dur + .05);
  const s = c.createBufferSource(), bp = c.createBiquadFilter(), ng = c.createGain(); s.buffer = noise(c); bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = .8;
  ng.gain.setValueAtTime(0, t0 + dur * .5); ng.gain.linearRampToValueAtTime(.18 * power, t0 + dur * .7); ng.gain.exponentialRampToValueAtTime(.001, t0 + dur + .25);
  s.connect(bp).connect(ng).connect(SND.out); s.start(t0, Math.random(), dur + .3);
}
function pfft() { fartSound(.4, .18); }
function megaFart() { fartSound(2, 1.6); setTimeout(() => fartSound(1.4, .5), 1500); whoosh(1.4); }
function sniffSound() { const c = out(); if (!c) return; for (let i = 0; i < 3; i++) { const t0 = c.currentTime + i * .17, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(); s.buffer = noise(c); f.type = 'highpass'; f.frequency.value = 2500; g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(.12, t0 + .05); g.gain.exponentialRampToValueAtTime(.001, t0 + .14); s.connect(f).connect(g).connect(SND.out); s.start(t0, Math.random(), .16); } }
function clack(v = 1) { const c = out(); if (!c) return; const t0 = c.currentTime, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(); s.buffer = noise(c); f.type = 'bandpass'; f.frequency.value = 1800; f.Q.value = 2; g.gain.setValueAtTime(.5 * v, t0); g.gain.exponentialRampToValueAtTime(.001, t0 + .08); s.connect(f).connect(g).connect(SND.out); s.start(t0, Math.random(), .1); const o = c.createOscillator(), og = c.createGain(); o.frequency.setValueAtTime(160, t0); o.frequency.exponentialRampToValueAtTime(60, t0 + .1); og.gain.setValueAtTime(.4 * v, t0); og.gain.exponentialRampToValueAtTime(.001, t0 + .12); o.connect(og).connect(SND.out); o.start(t0); o.stop(t0 + .13); }
function whoosh(len = .8) { const c = out(); if (!c) return; const t0 = c.currentTime, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(); s.buffer = noise(c); s.loop = true; f.type = 'bandpass'; f.Q.value = 1.2; f.frequency.setValueAtTime(300, t0); f.frequency.exponentialRampToValueAtTime(2800, t0 + len * .8); g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(.35, t0 + len * .4); g.gain.exponentialRampToValueAtTime(.001, t0 + len); s.connect(f).connect(g).connect(SND.out); s.start(t0); s.stop(t0 + len + .05); }
function chargeSound() { const c = out(); if (!c) return; const t0 = c.currentTime, o = c.createOscillator(), g = c.createGain(), lp = c.createBiquadFilter(); o.type = 'sawtooth'; o.frequency.setValueAtTime(40, t0); o.frequency.linearRampToValueAtTime(70, t0 + .9); lp.type = 'lowpass'; lp.frequency.value = 300; g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(.25, t0 + .8); g.gain.linearRampToValueAtTime(0, t0 + 1); o.connect(lp).connect(g).connect(SND.out); o.start(t0); o.stop(t0 + 1.05); }
function siren(gainV, rate = .32, center = 900, depth = 320) { // classic wail: a sine whose pitch sweeps up and down
  const c = SND.ctx, o = c.createOscillator(), lfo = c.createOscillator(), lg = c.createGain(), g = c.createGain(), lp = c.createBiquadFilter();
  o.type = 'square'; o.frequency.value = center; lfo.type = 'triangle'; lfo.frequency.value = rate; lg.gain.value = depth; lfo.connect(lg).connect(o.frequency);
  lp.type = 'lowpass'; lp.frequency.value = 1400; g.gain.value = gainV; o.connect(lp).connect(g).connect(SND.out); o.start(); lfo.start(); return { g, lp, o };
}
function sirenFar() { const c = SND.ctx; if (!c || SND.far) return; SND.far = siren(.0, .3); SND.far.lp.frequency.value = 600; SND.far.g.gain.linearRampToValueAtTime(.05, c.currentTime + 3); }
function startChaseAudio() {
  const c = SND.ctx; if (!c || SND.chase) return; SND.chase = true;
  if (SND.far) { SND.far.g.gain.setTargetAtTime(0, c.currentTime, .3); }
  SND.s1 = siren(.05, .34, 950, 330); SND.s2 = siren(.03, 3.2, 1100, 250); // a wail and a yelp
  const b = c.createBuffer(1, c.sampleRate * 2, c.sampleRate), d = b.getChannelData(0); for (let i = 0, l = 0; i < d.length; i++) { l = (l + .02 * (Math.random() * 2 - 1)) / 1.02; d[i] = l * 3.5; }
  const roll = c.createBufferSource(), rf = c.createBiquadFilter(), rg = c.createGain(); roll.buffer = b; roll.loop = true; rf.type = 'lowpass'; rf.frequency.value = 520; rg.gain.value = .3; roll.connect(rf).connect(rg).connect(SND.out); roll.start(); // wheel roar
  const hn = c.createBufferSource(), hf = c.createBiquadFilter(), hg = c.createGain(), am = c.createOscillator(), ag = c.createGain(); hn.buffer = noise(c); hn.loop = true; hf.type = 'lowpass'; hf.frequency.value = 260; hg.gain.value = .0;
  am.type = 'square'; am.frequency.value = 13; ag.gain.value = .07; am.connect(ag).connect(hg.gain); hn.connect(hf).connect(hg).connect(SND.out); hn.start(); am.start(); SND.heli = hg; // chopper thump
  SND.roll = rg;
}
let seamAcc = 0;
function stepAudio(dt) {
  const c = out(); if (!c || !SND.chase) return;
  const sky = GAL.sky; seamAcc += SPEED * dt;
  if (!sky && seamAcc > 6) { seamAcc = 0; clack(.25); } // wheels over the sidewalk-slab seams… road seams
  SND.roll.gain.setTargetAtTime(sky ? 0 : .3, c.currentTime, .2);
  const g = cops.reduce((a, cp) => a + cp.userData.gas, 0) / cops.length;
  SND.s1.g.gain.setTargetAtTime(sky ? 0 : .05 * (1 - g * .6), c.currentTime, .2); SND.s2.g.gain.setTargetAtTime(sky ? 0 : .03 * (1 - g * .6), c.currentTime, .2);
  SND.s1.o.detune.setTargetAtTime(-g * 400 + Math.sin(clock * 30) * g * 150, c.currentTime, .05); // gassed cops: the siren chokes
}

/* ================================================================== post: low-res render → bloom → composite (grade, CRT glitch, gas wipe) */
const rtOpt = { type: THREE.HalfFloatType, colorSpace: THREE.LinearSRGBColorSpace };
const rt = new THREE.WebGLRenderTarget(4, 4, rtOpt), bA = new THREE.WebGLRenderTarget(4, 4, rtOpt), bB = new THREE.WebGLRenderTarget(4, 4, rtOpt);
const QV = `varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`;
const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2)); quad.frustumCulled = false;
const pScene = new THREE.Scene(); pScene.add(quad); const pCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const bright = new THREE.ShaderMaterial({ uniforms: { tD: { value: rt.texture } }, vertexShader: QV, depthTest: false, depthWrite: false,
  fragmentShader: `uniform sampler2D tD;varying vec2 vUv;void main(){vec3 c=texture2D(tD,vUv).rgb;float l=dot(c,vec3(.2126,.7152,.0722));gl_FragColor=vec4(c*smoothstep(.75,1.9,l)+c*.03,1.);}` });
const blur = new THREE.ShaderMaterial({ uniforms: { tD: { value: null }, uDir: { value: new THREE.Vector2() } }, vertexShader: QV, depthTest: false, depthWrite: false,
  fragmentShader: `uniform sampler2D tD;uniform vec2 uDir;varying vec2 vUv;void main(){vec3 c=texture2D(tD,vUv).rgb*.227;c+=(texture2D(tD,vUv+uDir*1.385).rgb+texture2D(tD,vUv-uDir*1.385).rgb)*.316;c+=(texture2D(tD,vUv+uDir*3.231).rgb+texture2D(tD,vUv-uDir*3.231).rgb)*.07;gl_FragColor=vec4(c,1.);}` });
const comp = new THREE.ShaderMaterial({
  uniforms: { tD: { value: rt.texture }, tB: { value: bA.texture }, uBloom: { value: .55 }, uT: { value: 0 }, uGlitch: { value: 0 }, uGas: { value: 0 }, uZoom: { value: 0 } },
  vertexShader: QV, depthTest: false, depthWrite: false,
  fragmentShader: `uniform sampler2D tD,tB;uniform float uBloom,uT,uGlitch,uGas,uZoom;varying vec2 vUv;
    float h(float n){return fract(sin(n*91.345)*47453.5);}
    float n2(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);float a=h(i.x+i.y*57.),b=h(i.x+1.+i.y*57.),c=h(i.x+(i.y+1.)*57.),d=h(i.x+1.+(i.y+1.)*57.);return mix(mix(a,b,f.x),mix(c,d,f.x),f.y);}
    vec3 aces(vec3 x){return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),0.,1.);}
    void main(){
      vec2 d=vUv-.5;float e=length(d)*2.,g=uGlitch;vec2 uv=vUv;
      float row=floor(vUv.y*64.);uv.x+=(h(row+floor(uT*24.))-.5)*.09*g*g*step(.5,h(row*1.7+floor(uT*12.))); // tearing rows
      float ca=.0015*e+.03*g*g;
      vec3 c=vec3(texture2D(tD,uv+d*ca).r,texture2D(tD,uv).g,texture2D(tD,uv-d*ca).b);
      if(uZoom>.001){vec2 z=d*uZoom*.06*smoothstep(.3,1.2,e);vec3 s=vec3(0.);for(int i=1;i<=6;i++){float k=float(i)/6.;s+=vec3(texture2D(tD,uv-z*k*1.2).r,texture2D(tD,uv-z*k).g,texture2D(tD,uv-z*k*.8).b);}c=mix(c,s/6.,smoothstep(.4,1.,e));}
      c+=texture2D(tB,vUv).rgb*uBloom;
      c=aces(c*1.05);
      float l=dot(c,vec3(.2126,.7152,.0722));
      c=mix(vec3(l),c,1.08);                                       // a touch more saturation
      c+=vec3(.025,-.01,.045)*(1.-smoothstep(0.,.45,l));          // purple shadows
      c+=vec3(.03,.012,-.02)*smoothstep(.55,1.,l);                // warm highlights
      if(uGas>.001){float n=n2(vUv*6.+vec2(uT*.4,-uT*.25))*.6+n2(vUv*14.-uT*.6)*.4;float m=smoothstep(.15,.85,uGas+n*.5-.25);
        c=mix(c,mix(vec3(.18,.36,.08),vec3(.72,.95,.42),n),m);}  // the gas cloud wipe
      c*=mix(1.,smoothstep(1.1,.25,length(d*vec2(1.,.9))),.55);  // vignette
      c+=vec3(.85,1.,.8)*g*g*g*.7;c*=1.-.25*g*step(.5,fract(vUv.y*240.));
      gl_FragColor=vec4(clamp(c,0.,1.),1.);
      #include <colorspace_fragment>
    }`,
});
function resize() {
  const w = innerWidth, h = innerHeight;
  const pr = Math.min(devicePixelRatio, 470 / Math.min(w, h), Math.sqrt(2e6 / (w * h)));
  R.setPixelRatio(pr); R.setSize(w, h, false);
  const W = Math.max(4, Math.floor(w * pr)), H = Math.max(4, Math.floor(h * pr));
  rt.setSize(W, H); bA.setSize(W >> 2, H >> 2); bB.setSize(W >> 2, H >> 2);
  cam.aspect = w / h; cam.updateProjectionMatrix();
}
addEventListener('resize', resize); resize();

/* ================================================================== camera + render */
const _look = V3(), _f = V3();
function updateCamera(dt) {
  const k = damp(dt, 5); if (!REDUCED) { ptr.cx = lerp(ptr.cx, ptr.seen ? ptr.x : 0, k); ptr.cy = lerp(ptr.cy, ptr.seen ? ptr.y : 0, k); }
  cam.position.copy(camState.pos);
  cam.position.x += ptr.cx * .35 * camState.par; cam.position.y += -ptr.cy * .15 * camState.par;
  const wob = REDUCED ? 0 : .005; cam.position.x += Math.sin(clock * .9) * wob; cam.position.y += Math.sin(clock * 1.3 + 1) * wob;
  _look.copy(camState.look); cam.lookAt(_look); cam.rotateZ(camState.roll);
  cam.fov = camState.fov * (cam.aspect < 1 ? 1.45 : 1); cam.updateProjectionMatrix();
  if (cam.aspect < 1) { _f.subVectors(cam.position, _look).multiplyScalar(.15); cam.position.add(_f); }
}
function renderFrame() {
  const sc = INTRO.on ? alley : scene;
  if (RAW) { R.setRenderTarget(null); R.render(sc, cam); return; }
  comp.uniforms.uT.value = clock;
  R.setRenderTarget(rt); R.render(sc, cam);
  quad.material = bright; R.setRenderTarget(bA); R.render(pScene, pCam);
  const w = bA.width, h = bA.height;
  for (const [x, y, src, dst] of [[1.2, 0, bA, bB], [0, 1.2, bB, bA], [2.6, 0, bA, bB], [0, 2.6, bB, bA]]) { blur.uniforms.tD.value = src.texture; blur.uniforms.uDir.value.set(x / w, y / h); quad.material = blur; R.setRenderTarget(dst); R.render(pScene, pCam); }
  quad.material = comp; R.setRenderTarget(null); R.render(pScene, pCam);
}
const _hn = V3();
function hoverOn() {
  if (!started || !ptr.seen || travel || GAL.on || INTRO.on) return false;
  SN.head.getWorldPosition(_hn); _hn.y += .2; _hn.project(cam);
  const over = _hn.z < 1 && Math.hypot((_hn.x - ptr.x) * cam.aspect, _hn.y + ptr.y) < .16;
  cvs.style.cursor = over ? 'pointer' : ''; return over;
}

/* ================================================================== loop */
let last = performance.now(), raf = 0;
function frame(now) { raf = requestAnimationFrame(frame); let dt = Math.min(.05, (now - last) / 1000); last = now; if (HOLD && started) dt = 0; tick(dt); }
function tick(dt) {
  clock += dt; sky.material.uniforms.uT.value = clock;
  const cg = comp.uniforms.uGlitch; if (cg.value > 0) cg.value = Math.max(0, cg.value - dt * .8);
  if (GASOUT.t >= 0) { GASOUT.t += dt; comp.uniforms.uGas.value = Math.max(0, 1 - GASOUT.t / 1.4); if (GASOUT.t > 1.4) GASOUT.t = -1; }
  comp.uniforms.uZoom.value = lerp(comp.uniforms.uZoom.value, GAL.sky ? .9 : GAL.on && GAL.t > .7 ? 1 : 0, damp(dt, 3));
  if (INTRO.on) { stepIntro(dt); stepRider(dt, 'alley'); }
  else { stepTravel(dt); stepStreet(dt); stepGallery(dt); stepRider(dt, GAL.sky ? 'sky' : 'street'); stepAudio(dt); }
  stepGas(dt);
  updateCamera(dt); renderFrame();
}
document.addEventListener('visibilitychange', () => { if (document.hidden) { cancelAnimationFrame(raf); SND.ctx?.suspend(); } else { last = performance.now(); raf = requestAnimationFrame(frame); SND.ctx?.resume(); } });

/* ================================================================== gate, links, input */
const setWord = w => { $('gword').innerHTML = [...w].map((c, i) => `<span style="--i:${i}" aria-hidden="true">${c}</span>`).join(''); $('enter').setAttribute('aria-label', w === 'ENTER' ? 'Enter' : 'Loading'); };
setWord('LOADING');
{ const b = $('bubbles'); for (let i = 0; i < 18; i++) { const e = document.createElement('b'); e.style.cssText = `--s:${10 + Math.random() * 40}px;--d:${6 + Math.random() * 8}s;--dl:${-Math.random() * 10}s;--x:${Math.random() * 100}%;--w:${(Math.random() - .5) * 120}px`; b.append(e); } }
{ const c = document.createElement('canvas'); c.width = c.height = 160; const x = c.getContext('2d'), d = x.createImageData(160, 160);
  for (let i = 0; i < d.data.length; i += 4) { const v = Math.random() * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; } x.putImageData(d, 0, 0); $('grain').style.background = `url(${c.toDataURL()})`; }
const prog = { f: 0, c: 0 }, t0 = performance.now();
const showProg = () => { const p = Math.round(prog.f * 30 + prog.c * 70); $('prog').textContent = p < 100 ? `loading ${p}%` : 'ready'; $('bar').style.width = p + '%'; return p; };
document.fonts.ready.then(() => { prog.f = 1; showProg(); });
setTimeout(() => { try { R.compile(scene, cam); R.compile(alley, cam); } catch (e) { console.error(e); } prog.c = 1; prog.f = 1; showProg();
  setTimeout(() => { setWord('ENTER'); $('enter').disabled = false; $('enter').focus({ preventScroll: true }); if (Q.has('shot') || Q.has('intro')) begin(true); }, Q.has('shot') || Q.has('intro') ? 0 : Math.max(0, 1800 - (performance.now() - t0)));
}, 60);
function begin(debug) {
  if (started) return; started = true;
  $('gate').classList.add('off'); if (debug) $('gate').style.display = 'none';
  if (Q.has('intro')) { startIntro(); const T = +Q.get('intro'); if (T > 0) { INTRO.ph = 'wait'; rideClick(); for (let i = 0; i < T * 30; i++) tick(1 / 30); } return; }
  if (debug || REDUCED) { go(station, true); $('ui').classList.add('on'); comp.uniforms.uGas.value = 0; return; }
  startIntro();
}
$('enter').addEventListener('click', () => { audioInit(); begin(false); });
$('ride').addEventListener('click', () => { audioInit(); rideClick(); });
$('snd').addEventListener('click', () => { audioInit(); SND.on = !SND.on; if (SND.out) SND.out.gain.value = SND.on ? .8 : 0; $('snd').setAttribute('aria-pressed', String(SND.on)); $('snd').setAttribute('aria-label', SND.on ? 'Sound on' : 'Sound off'); });
document.querySelectorAll('nav .btn').forEach(b => b.addEventListener('click', () => { lockUntil = 0; go(+b.dataset.s); }));
$('galPrev').addEventListener('click', () => showMeme(-1)); $('galNext').addEventListener('click', () => showMeme(1));
addEventListener('keydown', e => {
  if (!started || INTRO.on) return;
  if (GAL.sky && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) return showMeme(e.key === 'ArrowRight' ? 1 : -1);
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') go(station + 1);
  if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') go(station - 1);
  if ('123'.includes(e.key)) { lockUntil = 0; go(+e.key - 1); }
  if (e.key === 'f' || e.key === 'F') fartBurst(40, 1);
});
addEventListener('wheel', e => { if (started && !INTRO.on && Math.abs(e.deltaY) > 8) go(station + Math.sign(e.deltaY)); }, { passive: true });
let ty0 = null, tx0 = 0;
addEventListener('touchstart', e => { ty0 = e.touches[0].clientY; tx0 = e.touches[0].clientX; }, { passive: true });
addEventListener('touchend', e => {
  if (ty0 === null || !started || INTRO.on) return; const d = ty0 - e.changedTouches[0].clientY, dx = tx0 - e.changedTouches[0].clientX; ty0 = null;
  if (GAL.sky && Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(d)) return showMeme(Math.sign(dx));
  if (Math.abs(d) > 70) go(station + Math.sign(d));
}, { passive: true });
for (const ev of ['pointermove', 'pointerdown']) addEventListener(ev, e => { ptr.x = e.clientX / innerWidth * 2 - 1; ptr.y = e.clientY / innerHeight * 2 - 1; ptr.seen = true; });
document.addEventListener('pointerleave', () => { ptr.seen = false; });
cvs.addEventListener('click', () => { if (HOVER.k > .5) { audioInit(); fartBurst(50, 1.3); RIDE.sniff = 0; } });
// project links: disabled "soon" buttons until filled in SITE
for (const [k, label] of [['x', 'X'], ['telegram', 'TG'], ['chart', 'Chart'], ['buy', 'Buy']]) {
  const a = document.createElement(SITE[k] ? 'a' : 'span'); a.className = 'btn'; a.textContent = label;
  if (SITE[k]) { a.href = SITE[k]; a.target = '_blank'; a.rel = 'noopener noreferrer'; } else { a.setAttribute('aria-disabled', 'true'); a.title = 'Coming soon'; }
  $('links').append(a);
}
$('tick').textContent = SITE.ticker;
if (SITE.ca) { const code = document.createElement('code'); code.textContent = SITE.ca; const b = document.createElement('button'); b.className = 'ca-copy'; b.type = 'button'; b.textContent = 'Copy';
  b.onclick = async () => { try { await navigator.clipboard.writeText(SITE.ca); b.textContent = 'Copied'; } catch { b.textContent = 'Ctrl+C'; } setTimeout(() => { b.textContent = 'Copy'; }, 1500); }; $('ca').replaceChildren(code, b); }

window.__sn = { THREE, R, scene, alley, cam, camState, SN, BOARD, skater, cops, GAS, GAL, INTRO, STATIONS, go, tick, fartBurst, comp, get station() { return station; } };
updateCamera(0);
raf = requestAnimationFrame(frame);
