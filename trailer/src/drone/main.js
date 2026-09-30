// Drone flight over the SolQuest overworld for the title screen: the game's own
// map, tiles and prop models as a 3D world. Deterministic: renderAt(t) draws the
// frame at time t of a seamless LOOP-second loop (one full day passes on the
// way round). Renders at the game's 960x640 with 4x multisampling; textures keep
// the game art's crisp texels (nearest up close, mipmapped in the distance).
import * as THREE from 'three';
import { buildWorld, U } from './world.js';
import { OUTDOOR_W, MAP_H } from '@game/data/map.js';

THREE.ColorManagement.enabled = false;
export const LOOP = 48;
export const OUT = { w: 960, h: 640 };

// ------------------------------------------------------------ time of day
// The loop runs from mid-morning through the day, golden hour, night and dawn
// back to mid-morning. hourAt(u): u in [0,1) -> hour of day (0..24).
const HOUR_KEYS = [[0, 9], [0.38, 15.8], [0.52, 18.4], [0.6, 20.0], [0.71, 27.2], [0.81, 30.0], [1, 33]];
function hourAt(u) {
  let i = 0;
  while (i < HOUR_KEYS.length - 2 && HOUR_KEYS[i + 1][0] <= u) i++;
  const [u0, h0] = HOUR_KEYS[i];
  const [u1, h1] = HOUR_KEYS[i + 1];
  return (h0 + (h1 - h0) * ((u - u0) / (u1 - u0))) % 24;
}
// palette per hour: sky top, horizon, sun colour, sun strength, ambient sky, ambient ground, ambient strength
const SKY = [
  [0, '#0a1030', '#223064', '#9aaae8', 0.55, '#5a68b8', '#1c2034', 0.9],
  [4.8, '#0a1030', '#223064', '#9aaae8', 0.55, '#5a68b8', '#1c2034', 0.9],
  [6.0, '#2c2a6c', '#f0a39a', '#ffb08a', 0.75, '#8a7aa8', '#3a3040', 0.7],
  [7.5, '#3b78d6', '#cfe6ff', '#fff2dc', 1.15, '#a8c8f0', '#4a6a3a', 0.85],
  [12, '#3a82e6', '#d6ecff', '#ffffff', 1.25, '#b0d0f4', '#50703c', 0.9],
  [16.5, '#4a7cd2', '#ffe6b8', '#ffe8c0', 1.15, '#b8c8e8', '#5a6a3c', 0.85],
  [18.2, '#5a58b0', '#ff9e62', '#ffa258', 1.0, '#c89a8a', '#4a3a3a', 0.78],
  [19.6, '#2a2672', '#d8687e', '#ff7a66', 0.5, '#6a5a98', '#262036', 0.66],
  [21, '#0a1030', '#223064', '#9aaae8', 0.55, '#5a68b8', '#1c2034', 0.9],
  [24, '#0a1030', '#223064', '#9aaae8', 0.55, '#5a68b8', '#1c2034', 0.9],
];
const col = (h) => new THREE.Color(h);
function skyAt(hour) {
  let i = 0;
  while (i < SKY.length - 2 && SKY[i + 1][0] <= hour) i++;
  const a = SKY[i];
  const b = SKY[i + 1];
  const k = (hour - a[0]) / (b[0] - a[0]);
  const mix = (j) => col(a[j]).lerp(col(b[j]), k);
  const num = (j) => a[j] + (b[j] - a[j]) * k;
  return { top: mix(1), horizon: mix(2), sun: mix(3), sunK: num(4), skyAmb: mix(5), groundAmb: mix(6), ambK: num(7) };
}
const nightAt = (h) => {
  if (h >= 20 || h < 5) return 1;
  if (h >= 18.4) return (h - 18.4) / 1.6;
  if (h < 6.4) return 1 - (h - 5) / 1.4;
  return 0;
};

// ------------------------------------------------------------ the flight
// A closed loop (tile coordinates, height in tiles): up the main road past the
// town and the Solace, east over the market and the pond, past the windmill,
// through the orchard to a sweep around the Elite Hall, then back south down
// the western woods.
const PATH = [
  [22, 138, 12], [24, 121, 8.5], [37, 113, 8.5], [48, 113, 8.5], [58, 98, 8], [59, 82, 7.5],
  [55, 68, 9.5], [44, 54, 9], [49, 41, 8.5], [39, 26, 9.5], [23, 23, 8.5], [9, 15, 9],
  [9, 31, 10], [8, 60, 10], [9, 84, 9.5], [12, 104, 10], [14, 128, 12],
].map(([x, z, y]) => new THREE.Vector3(x, y, z));
const curve = new THREE.CatmullRomCurve3(PATH, true, 'centripetal', 0.5);
// landmarks the camera turns towards as it passes (x, z, radius of influence)
const SIGHTS = [[53, 107, 13], [57, 84, 12], [46, 66, 12], [22, 8, 30], [27, 66, 8], [24, 116, 30]];
// constant ground speed: sample by arc length
const pointAt = (u) => curve.getPointAt(((u % 1) + 1) % 1);

// ------------------------------------------------------------ renderer
export class Drone {
  constructor(canvas) { this.canvas = canvas; }

  async init() {
    const r = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: false, preserveDrawingBuffer: true });
    r.setPixelRatio(1);
    r.setSize(OUT.w, OUT.h, false);
    r.outputColorSpace = THREE.LinearSRGBColorSpace;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFShadowMap;
    this.renderer = r;

    const scene = new THREE.Scene();
    this.scene = scene;
    this.camera = new THREE.PerspectiveCamera(56, OUT.w / OUT.h, 0.3, 420);
    scene.fog = new THREE.Fog(0xcfe6ff, 40, 150);

    // sky dome: vertical gradient, sun/moon disc, stars
    this.skyU = { top: { value: new THREE.Color() }, horizon: { value: new THREE.Color() }, sunDir: { value: new THREE.Vector3() },
      sunCol: { value: new THREE.Color() }, night: { value: 0 } };
    const sky = new THREE.Mesh(new THREE.SphereGeometry(400, 64, 32), new THREE.ShaderMaterial({
      uniforms: this.skyU, side: THREE.BackSide, depthWrite: false, fog: false,
      vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * p; }',
      fragmentShader: `
        uniform vec3 top, horizon, sunCol, sunDir; uniform float night; varying vec3 vDir;
        float h(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,37.719))) * 43758.5453); }
        void main(){
          vec3 dir = normalize(vDir);
          float y = clamp(dir.y, -0.2, 1.0);
          vec3 c = mix(horizon, top, smoothstep(-0.02, 0.55, y));
          float d = max(dot(dir, normalize(sunDir)), 0.0);
          c += sunCol * (smoothstep(0.9975, 0.999, d) * 1.2 + pow(d, 40.0) * 0.35);
          // stars
          vec3 q = floor(dir * 180.0);
          float s = step(0.9975, h(q)) * night * smoothstep(0.05, 0.3, y);
          c += vec3(s);
          gl_FragColor = vec4(c, 1.0);
        }`,
    }));
    sky.renderOrder = -1;
    scene.add(sky);
    this.sky = sky;

    this.hemi = new THREE.HemisphereLight(0xffffff, 0x445533, 0.8);
    scene.add(this.hemi);
    const sun = new THREE.DirectionalLight(0xffffff, 1.2);
    sun.castShadow = true;
    sun.shadow.mapSize.set(4096, 4096);
    const sc = sun.shadow.camera;
    sc.left = -40; sc.right = 40; sc.top = 40; sc.bottom = -40; sc.near = 1; sc.far = 260;
    sun.shadow.bias = -0.0008;
    sun.shadow.normalBias = 0.02;
    scene.add(sun, sun.target);
    this.sun = sun;

    // clouds: flattened low-poly puffs drifting over (they shade the ground)
    const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true });
    this.clouds = new THREE.Group();
    for (let i = 0; i < 18; i++) {
      const g = new THREE.Group();
      for (let k = 0; k < 4; k++) {
        const b = new THREE.Mesh(new THREE.IcosahedronGeometry(2.2 + ((i * 7 + k * 3) % 5) * 0.6, 0), cloudMat);
        b.position.set(k * 2.4 - 3.6, ((i + k) % 3) * 0.4, ((k * 5 + i) % 3) - 1);
        b.scale.set(1.3, 0.55, 1);
        b.castShadow = true;
        g.add(b);
      }
      g.userData = { x: ((i * 37) % 110) - 20, z: ((i * 53) % 190) - 30, y: 21 + (i % 4) * 1.5 };
      this.clouds.add(g);
    }
    scene.add(this.clouds);

    this.world = await buildWorld(scene);

    // multisampled target + a light output pass (vignette)
    this.rt = new THREE.WebGLRenderTarget(OUT.w, OUT.h, { samples: 4, depthBuffer: true });
    this.post = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
      uniforms: { tDiffuse: { value: this.rt.texture } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: `
        uniform sampler2D tDiffuse; varying vec2 vUv;
        void main(){
          vec3 c = texture2D(tDiffuse, vUv).rgb;
          vec2 q = vUv - 0.5;
          c *= 1.0 - dot(q, q) * 0.45;
          gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
        }`,
      depthTest: false, depthWrite: false,
    }));
    this.postScene = new THREE.Scene();
    this.postScene.add(this.post);
    this.postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    return true;
  }

  renderAt(t) {
    const u = (((t / LOOP) % 1) + 1) % 1;
    const hour = hourAt(u);
    const S = skyAt(hour);
    const night = nightAt(hour);
    U.uTime.value = t;
    U.uNight.value = night;

    // the drone: position on the loop, looking ahead and down the path
    const cam = this.camera;
    const p = pointAt(u);
    const ahead = pointAt(u + 0.018);
    const dir = new THREE.Vector3().subVectors(ahead, p).setY(0).normalize();
    // heading: along the path, turned towards landmarks nearby (yaw only, so
    // the tilt stays the same and the horizon stays in frame)
    const head = dir.clone();
    for (const [sx, sz, r] of SIGHTS) {
      const d = Math.hypot(sx - p.x, sz - p.z);
      const w = Math.min(0.8, Math.max(0, 1 - d / r) * 1.1);
      if (w <= 0 || d < 0.5) continue;
      const to = new THREE.Vector3(sx - p.x, 0, sz - p.z).normalize();
      head.lerp(to, w).normalize();
    }
    const look = new THREE.Vector3().copy(p).addScaledVector(head, p.y * 2.3).setY(0);
    cam.position.copy(p);
    cam.up.set(0, 1, 0);
    cam.lookAt(look);
    // bank into the turns
    const a2 = pointAt(u + 0.036);
    const d2 = new THREE.Vector3().subVectors(a2, ahead).setY(0).normalize();
    const turn = dir.x * d2.z - dir.z * d2.x;
    cam.rotateZ(THREE.MathUtils.clamp(-turn * 0.9, -0.12, 0.12));

    // sun (or moon) across the sky
    const ang = ((hour - 6) / 12) * Math.PI;                  // 6h rise in the east, 18h set in the west
    let sd = new THREE.Vector3(Math.cos(ang) * 0.9, Math.sin(ang), -0.35 + 0.2 * Math.cos(ang));
    if (sd.y < 0.08) sd = new THREE.Vector3(-Math.cos(ang) * 0.6, 0.55, -0.4);   // moonlight
    sd.normalize();
    this.sun.position.copy(look).addScaledVector(sd, 120);
    this.sun.target.position.copy(look);
    this.sun.color.copy(S.sun);
    this.sun.intensity = S.sunK * Math.PI * 0.55;    // (physically based lights: x pi, then tuned so noon ~ 1)
    this.hemi.color.copy(S.skyAmb);
    this.hemi.groundColor.copy(S.groundAmb);
    this.hemi.intensity = S.ambK * Math.PI * 0.5;
    this.scene.fog.color.copy(S.horizon);
    this.skyU.top.value.copy(S.top);
    this.skyU.horizon.value.copy(S.horizon);
    this.skyU.sunDir.value.copy(sd);
    this.skyU.sunCol.value.copy(S.sun);
    this.skyU.night.value = night;
    this.sky.position.copy(cam.position);

    // clouds drift east, wrapping around the map (whiter by day, dim at night)
    for (const c of this.clouds.children) {
      const d = c.userData;
      const x = ((d.x + t * 0.9) % 130) - 30;
      c.position.set(x, d.y, d.z);
    }
    this.clouds.children[0].children[0].material.color.setRGB(0.95, 0.95, 1).multiplyScalar(0.45 + 0.55 * (1 - night));

    // water drifts, lamps glow after dark
    this.world.wtex.offset.set((t * 0.05) % 1, (t * 0.03) % 1);
    for (const g of this.world.glows) g.material.opacity = night * 0.9;

    const r = this.renderer;
    r.setRenderTarget(this.rt);
    r.render(this.scene, cam);
    r.setRenderTarget(null);
    r.render(this.postScene, this.postCam);
    return { hour: +hour.toFixed(2), night: +night.toFixed(2), pos: [p.x, p.y, p.z].map((v) => +v.toFixed(1)) };
  }
}

export { OUTDOOR_W, MAP_H };
