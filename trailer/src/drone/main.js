// The SolQuest overworld as a 3D world for the title screen: the game's own
// map, tiles and prop models, filmed as an edited sequence of drone shots
// through one day (edit.js). Deterministic: renderAt(t) draws the frame at time
// t of a seamless LOOP-second loop. Renders at the game's 960x640 with 4x
// multisampling; textures keep the game art's crisp texels (nearest up close,
// mipmapped in the distance). A final pass does the transitions, the camera
// blurs (whip pans, focus racks, a light tilt-shift) and the grade.
import * as THREE from 'three';
import { buildWorld, U } from './world.js';
import { LOOP, frameAt } from './edit.js';
import { OUTDOOR_W, MAP_H } from '@game/data/map.js';

THREE.ColorManagement.enabled = false;
export { LOOP };
export const OUT = { w: 960, h: 640 };
const FOV = 46;
const SHIFT = -0.18;                          // fixed vertical lens shift (NDC), the same for every shot

// ------------------------------------------------------------ time of day
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
    this.camera = new THREE.PerspectiveCamera(46, OUT.w / OUT.h, 0.3, 420);
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
    const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true, emissive: 0x000000 });
    this.cloudMat = cloudMat;
    this.clouds = new THREE.Group();
    for (let i = 0; i < 18; i++) {
      const g = new THREE.Group();
      for (let k = 0; k < 4; k++) {
        const b = new THREE.Mesh(new THREE.IcosahedronGeometry(2.2 + ((i * 7 + k * 3) % 5) * 0.6, 1), cloudMat);
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

    // two multisampled targets (a transition draws both shots) + the final pass
    const rt = () => new THREE.WebGLRenderTarget(OUT.w, OUT.h, { samples: 4, depthBuffer: true });
    this.rtA = rt();
    this.rtB = rt();
    this.postU = {
      tA: { value: this.rtA.texture }, tB: { value: this.rtB.texture }, res: { value: new THREE.Vector2(OUT.w, OUT.h) },
      mode: { value: 0 }, p: { value: 0 }, haze: { value: 0 },
      blurA: { value: new THREE.Vector2() }, defA: { value: 0 }, tiltA: { value: 0 },
      blurB: { value: new THREE.Vector2() }, defB: { value: 0 }, tiltB: { value: 0 },
    };
    this.post = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
      uniforms: this.postU,
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: POST,
      depthTest: false, depthWrite: false,
    }));
    this.postScene = new THREE.Scene();
    this.postScene.add(this.post);
    this.postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    return true;
  }

  /** Set up the world for one view (camera, light, sky, clouds, water) and draw it into rt. */
  drawView(V, rt) {
    const S = skyAt(V.hour);
    const night = nightAt(V.hour);
    U.uTime.value = V.clock;
    U.uNight.value = night;

    // Camera: yaw and a gentle pitch towards the target, never roll, and a
    // small fixed lens shift. Most of the downward look is real pitch (kept
    // under ~25 degrees, so walls and columns stay visually upright); a lens
    // shift that varies, or a big one, stretches whatever nears the bottom of
    // the frame and makes the world look like it floats.
    const cam = this.camera;
    const dist = Math.max(0.5, Math.hypot(V.target.x - V.pos.x, V.target.z - V.pos.z));
    const yaw = Math.atan2(V.target.x - V.pos.x, V.target.z - V.pos.z) + V.yaw;
    cam.fov = FOV;
    cam.updateProjectionMatrix();
    const f = cam.projectionMatrix.elements[5];
    const toTarget = Math.atan2(V.target.y - V.pos.y, dist);
    const pitch = toTarget - Math.atan((V.ty + SHIFT) / f);
    cam.position.copy(V.pos);
    cam.up.set(0, 1, 0);
    cam.lookAt(V.pos.x + Math.sin(yaw) * Math.cos(pitch), V.pos.y + Math.sin(pitch), V.pos.z + Math.cos(yaw) * Math.cos(pitch));
    cam.projectionMatrix.elements[9] = SHIFT;
    cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();

    // sun (or moon) across the sky; the shadow map covers the ground between
    // the camera and what it looks at
    const ang = ((V.hour - 6) / 12) * Math.PI;                  // 6h rise in the east, 18h set in the west
    let sd = new THREE.Vector3(Math.cos(ang) * 0.9, Math.sin(ang), -0.35 + 0.2 * Math.cos(ang));
    if (sd.y < 0.08) sd = new THREE.Vector3(-Math.cos(ang) * 0.6, 0.55, -0.4);   // moonlight
    sd.normalize();
    const focus = new THREE.Vector3(V.pos.x, 0, V.pos.z).lerp(new THREE.Vector3(V.target.x, 0, V.target.z), 0.55);
    const half = Math.min(60, Math.max(26, dist * 0.8 + 14));
    const sc = this.sun.shadow.camera;
    if (sc.right !== half) { sc.left = -half; sc.right = half; sc.top = half; sc.bottom = -half; sc.updateProjectionMatrix(); }
    this.sun.position.copy(focus).addScaledVector(sd, 120);
    this.sun.target.position.copy(focus);
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
      const u = c.userData;
      c.position.set(((u.x + V.clock * 0.9) % 130) - 30, u.y, u.z);
    }
    // clouds pick up the sky: lit by the sun, filled with the horizon colour
    this.cloudMat.emissive.copy(S.horizon).multiplyScalar(0.55);
    this.cloudMat.color.setRGB(1, 1, 1).multiplyScalar(0.5 + 0.5 * (1 - night));

    // water drifts, lamps glow after dark
    this.world.wtex.offset.set((V.clock * 0.05) % 1, (V.clock * 0.03) % 1);
    for (const g of this.world.glows) g.material.opacity = night * 0.9;

    this.renderer.setRenderTarget(rt);
    this.renderer.render(this.scene, cam);
  }

  renderAt(t) {
    const { A, B, mix } = frameAt(t);
    const P = this.postU;
    this.drawView(A, this.rtA);
    if (B) this.drawView(B, this.rtB);
    P.mode.value = { none: 0, dissolve: 1, mist: 2, leak: 3, focus: 4, dip: 5 }[mix.type];
    P.p.value = mix.p ?? 0;
    P.haze.value = mix.haze ?? 0;
    P.blurA.value.set(...A.blur); P.defA.value = A.defocus; P.tiltA.value = A.tilt;
    if (B) { P.blurB.value.set(...B.blur); P.defB.value = B.defocus; P.tiltB.value = B.tilt; }
    this.renderer.setRenderTarget(null);
    this.renderer.render(this.postScene, this.postCam);
    return { shot: A.shot, to: B?.shot, mix: mix.type, p: +(mix.p ?? 0).toFixed(2), hour: +A.hour.toFixed(2) };
  }
}

// ------------------------------------------------------------ final pass
// Per shot: camera blur (whip-pan streak, focus rack, a light tilt-shift that
// keeps a band through the middle sharp). Then the transition, then the grade.
const POST = `
  uniform sampler2D tA, tB; uniform vec2 res;
  uniform int mode; uniform float p, haze;
  uniform vec2 blurA, blurB; uniform float defA, defB, tiltA, tiltB;
  varying vec2 vUv;

  vec3 shot(sampler2D tex, vec2 uv, vec2 streak, float defocus, float tilt) {
    float rad = defocus + tilt * smoothstep(0.1, 0.42, abs(uv.y - 0.44));
    if (rad < 0.05 && dot(streak, streak) < 0.01) return texture2D(tex, uv).rgb;
    vec3 acc = vec3(0.0);
    for (int i = 0; i < 24; i++) {
      float f = (float(i) + 0.5) / 24.0;
      float a = float(i) * 2.39996;
      vec2 o = streak * (f - 0.5) + vec2(cos(a), sin(a)) * sqrt(f) * rad;
      acc += texture2D(tex, uv + o / res).rgb;
    }
    return acc / 24.0;
  }
  float hash(vec2 q) { return fract(sin(dot(q, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 q) {
    vec2 i = floor(q), f = fract(q); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
  }
  float fbm(vec2 q) { return noise(q) * 0.55 + noise(q * 2.1 + 3.7) * 0.3 + noise(q * 4.3 + 9.1) * 0.15; }

  void main() {
    vec3 a = shot(tA, vUv, blurA, defA, tiltA);
    vec3 c = a;
    if (mode > 0) {
      vec3 b = shot(tB, vUv, blurB, defB, tiltB);
      float s = sin(3.14159 * p);
      if (mode == 1) {                                   // dissolve
        c = mix(a, b, smoothstep(0.0, 1.0, p));
      } else if (mode == 2) {                            // mist: noise-edged, through haze
        vec2 q = vUv * vec2(3.0, 2.0) + vec2(p * 0.8, p * 0.2);
        float n = fbm(q);
        float e = p * 1.5 - 0.25;
        c = mix(a, b, smoothstep(n - 0.25, n + 0.25, e));
        float h = haze * s * (0.65 + 0.35 * fbm(q * 1.7 + 5.0));
        c = mix(c, vec3(0.88, 0.89, 0.92), h);
      } else if (mode == 3) {                            // warm light leak sweeping across
        c = mix(a, b, smoothstep(0.2, 0.8, p));
        vec2 lc = vec2(mix(-0.25, 1.25, p), 0.62);
        vec2 dq = (vUv - lc) * vec2(1.5, 1.0);
        float g = exp(-dot(dq, dq) * 3.0) * s * 0.3;
        vec3 L = vec3(1.0, 0.62, 0.3) * g + vec3(0.06, 0.03, 0.0) * s;
        c = 1.0 - (1.0 - c) * (1.0 - L);
      } else if (mode == 4) {                            // focus rack
        c = mix(a, b, smoothstep(0.35, 0.65, p));
      } else if (mode == 5) {                            // dip to night
        c = mix(a, b, smoothstep(0.42, 0.58, p));
        c = mix(c, vec3(0.025, 0.03, 0.075), pow(s, 0.8) * 0.82);
      }
    }
    // grade: cool lifted shadows, a gentle S-curve, warm highlights, a touch of colour
    c += vec3(0.018, 0.022, 0.04) * (1.0 - c);
    c = mix(c, c * c * (3.0 - 2.0 * c), 0.22);
    float l = dot(c, vec3(0.299, 0.587, 0.114));
    c *= mix(vec3(1.0), vec3(1.035, 1.0, 0.95), smoothstep(0.45, 1.0, l));
    c = mix(vec3(l), c, 1.08);
    vec2 v = vUv - 0.5;
    c *= 1.0 - dot(v, v) * 0.5;
    gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
  }`;

export { OUTDOOR_W, MAP_H };
