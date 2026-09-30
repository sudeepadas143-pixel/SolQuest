// The compositor: renders any moment of the trailer from a single time value.
//
//   game plates (real frames, native 960x640) -> pixel-sharp upscale through a
//   pixel-snapped camera -> overlays (board / silhouettes / HUD
//   inserts / logo / UI) -> EffectComposer: glitch wipe, gold-only bloom, and
//   a final pass with RGB split, glitch, light CRT scanlines, shake and flash.
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { W, H, FPS } from './grid.js';
import * as TL from './timeline.js';
import { PlateBank } from './plates.js';
import * as SH from './shaders.js';
import { drawBoard, drawDamage, drawCaption, drawHandle, drawSparkles, loadOverlayAssets } from './scenes/overlay.js';
import { fontsReady, loadImage, trainerUrl, creatureUrl } from './gameui.js';
import { noise1, prng } from './remap.js';

THREE.ColorManagement.enabled = false;

const LOGO_SRC = [188, 40, 584, 184];          // the SolQuest logo on the title screen, game px
const BOSS_DESIGNS = ['A', 'C', 'E', 'D'];      // every Elite but Ansem: silhouettes only
const NEW_CREATURES = ['scorpix', 'rubyclaw', 'boxbun'];
const WIPE_LEN = 0.16;
const SHATTER_LEN = 0.62;
const PW = 480;                                  // the pixel layer: the game's native 480x270, upscaled 4x
const PH = 270;

function canvasTexture(canvas, nearest) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.NoColorSpace;
  t.generateMipmaps = false;
  t.minFilter = t.magFilter = nearest ? THREE.NearestFilter : THREE.LinearFilter;
  return t;
}

export class Trailer {
  constructor(canvas) { this.canvas = canvas; }

  async init() {
    const r = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: false, preserveDrawingBuffer: true, alpha: false });
    r.setPixelRatio(1);
    r.setSize(W, H, false);
    r.outputColorSpace = THREE.LinearSRGBColorSpace;
    this.renderer = r;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x000000);
    this.camera = new THREE.OrthographicCamera(0, W, H, 0, -10, 10);

    this.plates = new PlateBank();
    await Promise.all([this.plates.init(), fontsReady(), loadOverlayAssets()]);
    this.evaluate = TL.makeEvaluator();

    const geo = new THREE.PlaneGeometry(1, 1);
    const quad = (material, order) => {
      const m = new THREE.Mesh(geo, material);
      m.renderOrder = order;
      m.frustumCulled = false;
      m.visible = false;
      this.scene.add(m);
      return m;
    };
    const gradeU = () => ({ uDuo: { value: 0 }, uInvert: { value: 0 }, uBright: { value: 1 } });
    const plateCam = () => new THREE.ShaderMaterial({
      uniforms: {
        uTex: { value: null }, uSize: { value: new THREE.Vector2(960, 640) }, uCenter: { value: new THREE.Vector2(480, 320) },
        uZoom: { value: 2 }, uOffset: { value: new THREE.Vector2() }, uBlur: { value: new THREE.Vector2() },
        uRes: { value: new THREE.Vector2(W, H) }, ...gradeU(),
      },
      vertexShader: SH.plateVert, fragmentShader: SH.plateCamFrag, depthTest: false, depthWrite: false,
    });
    const plateRect = () => new THREE.ShaderMaterial({
      uniforms: { uTex: { value: null }, uSize: { value: new THREE.Vector2(960, 640) }, uSrc: { value: new THREE.Vector4() }, uAlpha: { value: 1 }, ...gradeU() },
      vertexShader: SH.plateVert, fragmentShader: SH.plateRectFrag, depthTest: false, depthWrite: false, transparent: true,
    });
    this.main = quad(plateCam(), 0);
    this.fitScreen(this.main);

    // low-res pixel layer (sparkles), upscaled nearest-neighbour
    this.pixCanvas = Object.assign(document.createElement('canvas'), { width: PW, height: PH });
    this.pixCtx = this.pixCanvas.getContext('2d');
    this.pixTex = canvasTexture(this.pixCanvas, true);
    this.pix = quad(new THREE.MeshBasicMaterial({ map: this.pixTex, transparent: true, depthTest: false }), 2);
    this.fitScreen(this.pix);

    // silhouettes: unannounced bosses and creatures, from their real sprites
    const silMat = (img, step) => {
      const tex = new THREE.Texture(img);
      tex.minFilter = tex.magFilter = THREE.NearestFilter;
      tex.generateMipmaps = false;
      tex.colorSpace = THREE.NoColorSpace;
      tex.needsUpdate = true;
      return new THREE.ShaderMaterial({
        uniforms: {
          uTex: { value: tex }, uSize: { value: new THREE.Vector2(img.width, img.height) }, uAlpha: { value: 1 },
          uBody: { value: new THREE.Color(0x07060d) }, uRim: { value: new THREE.Color(0x8b5cff) }, uStep: { value: step },
        },
        vertexShader: SH.plateVert, fragmentShader: SH.silhouetteFrag, transparent: true, depthTest: false, depthWrite: false,
      });
    };
    this.bosses = [];
    for (const [i, d] of BOSS_DESIGNS.entries()) {
      const img = await loadImage(trainerUrl(d));
      const m = quad(silMat(img, 3), 3);
      const h = 470;
      const w = (img.width / img.height) * h;
      this.setRect(m, [300, 720, 1200, 1620][i] - w / 2, 985 - h, w, h);
      this.bosses.push(m);
    }
    this.creatures = [];
    for (const [i, id] of NEW_CREATURES.entries()) {
      const img = await loadImage(creatureUrl(id));
      const m = quad(silMat(img, 2), 3);
      const h = 250;
      const w = (img.width / img.height) * h;
      this.setRect(m, [510, 960, 1410][i] - w / 2, 1035 - h, w, h);
      this.creatures.push(m);
    }

    // HUD insert (the game's own HP plate as a big graphic) and the logo
    this.inset = quad(plateRect(), 4);
    this.logo = quad(plateRect(), 4);

    // UI canvases: the board below the shatter shards, captions on top of all
    const uiCanvas = () => Object.assign(document.createElement('canvas'), { width: W, height: H });
    this.uiBoardCanvas = uiCanvas();
    this.uiBoardCtx = this.uiBoardCanvas.getContext('2d');
    this.uiBoardTex = canvasTexture(this.uiBoardCanvas, false);
    this.uiBoard = quad(new THREE.MeshBasicMaterial({ map: this.uiBoardTex, transparent: true, depthTest: false }), 5);
    this.fitScreen(this.uiBoard);
    this.uiTopCanvas = uiCanvas();
    this.uiTopCtx = this.uiTopCanvas.getContext('2d');
    this.uiTopTex = canvasTexture(this.uiTopCanvas, false);
    this.uiTop = quad(new THREE.MeshBasicMaterial({ map: this.uiTopTex, transparent: true, depthTest: false }), 7);
    this.fitScreen(this.uiTop);

    // shatter: the knockout frame breaks into glass shards
    this.rtFrozen = new THREE.WebGLRenderTarget(W, H, { depthBuffer: false });
    this.rtPrev = new THREE.WebGLRenderTarget(W, H, { depthBuffer: false });
    this.buildShards();

    // post
    const composer = new EffectComposer(r, new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, depthBuffer: false }));
    composer.setPixelRatio(1);
    composer.setSize(W, H);
    composer.addPass(new RenderPass(this.scene, this.camera));
    this.wipe = new ShaderPass({ uniforms: { tDiffuse: { value: null }, tPrev: { value: null }, uP: { value: 1 }, uSeed: { value: 0 } }, vertexShader: SH.plateVert, fragmentShader: SH.wipeFrag });
    this.wipe.enabled = false;
    composer.addPass(this.wipe);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(W, H), 0.6, 0.45, 0.6);
    const bloomSetSize = this.bloom.setSize.bind(this.bloom);
    this.bloom.setSize = (w, h) => bloomSetSize(Math.round(w / 2), Math.round(h / 2));   // half-res mips
    this.bloom.setSize(W, H);
    this.bloom.highPassUniforms.uAll = { value: 0 };
    this.bloom.materialHighPassFilter.fragmentShader = SH.goldHighPassFrag;
    this.bloom.materialHighPassFilter.needsUpdate = true;
    composer.addPass(this.bloom);
    this.fx = new ShaderPass({
      uniforms: {
        tDiffuse: { value: null }, uRes: { value: new THREE.Vector2(W, H) }, uShake: { value: new THREE.Vector2() }, uZoomPad: { value: 1 },
        uRGB: { value: 0 }, uGlitch: { value: 0 }, uFrame: { value: 0 }, uFlash: { value: 0 }, uFade: { value: 0 }, uScan: { value: 0.07 },
      },
      vertexShader: SH.plateVert, fragmentShader: SH.fxFrag,
    });
    composer.addPass(this.fx);
    this.composer = composer;
    this.logoTexReady = this.plates.pin('logo', 0);
    this.backdropReady = this.plates.pin('backdrop', 0);
    await Promise.all([this.logoTexReady, this.backdropReady]);
  }

  // ------------------------------------------------------------ helpers
  fitScreen(m) { m.position.set(W / 2, H / 2, 0); m.scale.set(W, H, 1); }
  setRect(m, x, y, w, h) { m.position.set(x + w / 2, H - (y + h / 2), 0); m.scale.set(w, h, 1); }

  buildShards() {
    const cols = 11;
    const rows = 7;
    const rnd = prng(4242);
    const pts = [];
    for (let j = 0; j <= rows; j++) {
      for (let i = 0; i <= cols; i++) {
        const edge = i === 0 || j === 0 || i === cols || j === rows;
        pts.push([
          (i / cols) * W + (edge ? 0 : (rnd() - 0.5) * (W / cols) * 0.8),
          (j / rows) * H + (edge ? 0 : (rnd() - 0.5) * (H / rows) * 0.8),
        ]);
      }
    }
    const P = (i, j) => pts[j * (cols + 1) + i];
    this.shards = [];
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const tris = rnd() < 0.5
          ? [[P(i, j), P(i + 1, j), P(i + 1, j + 1)], [P(i, j), P(i + 1, j + 1), P(i, j + 1)]]
          : [[P(i, j), P(i + 1, j), P(i, j + 1)], [P(i + 1, j), P(i + 1, j + 1), P(i, j + 1)]];
        for (const tri of tris) {
          const c = [(tri[0][0] + tri[1][0] + tri[2][0]) / 3, (tri[0][1] + tri[1][1] + tri[2][1]) / 3];
          const dx = c[0] - W * 0.62;
          const dy = c[1] - H * 0.4;
          const len = Math.hypot(dx, dy) + 1;
          const sp = 900 + rnd() * 1500;
          this.shards.push({ tri, c, v: [(dx / len) * sp, (dy / len) * sp - 300], w: (rnd() - 0.5) * 9 });
        }
      }
    }
    const n = this.shards.length * 3;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    const uv = new Float32Array(n * 2);
    this.shards.forEach((s, k) => s.tri.forEach(([x, y], v) => { uv[(k * 3 + v) * 2] = x / W; uv[(k * 3 + v) * 2 + 1] = 1 - y / H; }));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    this.shardMesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: this.rtFrozen.texture, transparent: true, depthTest: false, side: THREE.DoubleSide }));
    this.shardMesh.renderOrder = 6;
    this.shardMesh.frustumCulled = false;
    this.shardMesh.visible = false;
    this.scene.add(this.shardMesh);
  }

  layoutShards(lt) {
    const pos = this.shardMesh.geometry.attributes.position;
    const k0 = Math.min(1, lt / 0.04);                     // the crack, then they fly
    this.shards.forEach((s, k) => {
      const th = s.w * lt;
      const cs = Math.cos(th);
      const sn = Math.sin(th);
      const sc = 1 + lt * 0.5;
      const ox = s.v[0] * lt * k0;
      const oy = s.v[1] * lt * k0 + 2600 * lt * lt;
      s.tri.forEach(([x, y], v) => {
        const rx = (x - s.c[0]) * sc;
        const ry = (y - s.c[1]) * sc;
        const X = s.c[0] + rx * cs - ry * sn + ox;
        const Y = s.c[1] + rx * sn + ry * cs + oy;
        pos.setXYZ(k * 3 + v, X, H - Y, 0);
      });
    });
    pos.needsUpdate = true;
    this.shardMesh.material.opacity = 1 - Math.max(0, (lt - 0.34) / (SHATTER_LEN - 0.34));
  }

  hideAll() {
    for (const o of this.scene.children) o.visible = false;
  }

  /** Camera for a plate shot: pixel-snapped, clamped to the plate. */
  camFor(camState, plateW = 960, plateH = 640) {
    const z = camState.z;
    const hw = W / 2 / z;
    const hh = H / 2 / z;
    let x = 2 * hw >= plateW ? plateW / 2 : Math.max(hw, Math.min(plateW - hw, camState.x));
    let y = 2 * hh >= plateH ? plateH / 2 : Math.max(hh, Math.min(plateH - hh, camState.y));
    // snap: the plate's origin lands on a whole screen pixel
    x = (W / 2 - Math.round(W / 2 - x * z)) / z;
    y = (H / 2 - Math.round(H / 2 - y * z)) / z;
    return { z, x, y };
  }

  toScreen(c, px, py, off = [0, 0]) {
    return [(px - c.x) * c.z + W / 2 + off[0], (py - c.y) * c.z + H / 2 + off[1]];
  }

  /** Plate frames a moment needs (so the renderer can await them). */
  needs(t) {
    const out = [];
    const sh = TL.shotAt(t);
    if (sh.kind === 'plate') out.push([sh.plate, this.plates.index(sh.plate, sh.remap(t - sh.t0))]);
    if (sh.kind === 'board' && t - sh.t0 < SHATTER_LEN) {
      const ko = TL.shotById('ko');
      out.push(['ansem_ko', this.plates.index('ansem_ko', ko.remap(ko.t1 - ko.t0 - 1e-4))]);
    }
    return out;
  }

  tex(plate, i, wait) {
    const k = this.plates.key(plate, i);
    return wait ? this.plates.ready.get(k) : this.plates.peek(plate, i);
  }

  // ----------------------------------------------------------- one shot
  /** Set the scene up for a shot at local time lt. Returns the camera used. */
  setupShot(sh, lt, S, wait, frozenCam = null) {
    if (sh.kind === 'plate') {
      const src = sh.remap(lt);
      const i = this.plates.index(sh.plate, src);
      const tex = this.tex(sh.plate, i, wait);
      const c = this.camFor(frozenCam ?? S.cam);
      const u = this.main.material.uniforms;
      if (tex) u.uTex.value = tex;
      u.uCenter.value.set(c.x, c.y);
      u.uZoom.value = c.z;
      const wx = frozenCam ? 0 : Math.round(S.cam.wx / 2) * 2;
      const wy = frozenCam ? 0 : Math.round(S.cam.wy / 2) * 2;
      u.uOffset.value.set(wx, wy);
      const bl = frozenCam ? 0 : S.cam.blur;
      const dir = sh.enter?.type === 'whip' ? [sh.enter.dx, sh.enter.dy] : [0, 0];
      u.uBlur.value.set(dir[0] * bl * 140, dir[1] * bl * 140);
      u.uDuo.value = sh.grade?.duo === 'violet' ? 1 : sh.grade?.duo === 'mint' ? 2 : 0;
      u.uInvert.value = sh.grade?.invert ?? 0;
      u.uBright.value = 1;
      this.main.visible = !!u.uTex.value;
      // the HUD insert on the knockout: the game's HP plate, lifted out big
      if (sh.inset && lt >= sh.inset.t0) {
        const k = Math.min(1, (lt - sh.inset.t0) / 0.14);
        const [sx, sy, sw, shh] = sh.inset.src;
        const [dx, dy, dw, dh] = sh.inset.dst;
        const iu = this.inset.material.uniforms;
        iu.uTex.value = u.uTex.value;
        iu.uSrc.value.set(sx, sy, sw, shh);
        iu.uAlpha.value = 1;
        this.setRect(this.inset, Math.round(dx - (1 - k) ** 3 * (dw + 140)), dy, dw, dh);   // slides in from the left
        this.inset.visible = true;
      }
      if (sh.silhouettes) {
        const b = S.sil.boss;
        const cr = S.sil.creature;
        this.bosses.forEach((m) => { m.material.uniforms.uAlpha.value = b; m.visible = b > 0.01; });
        this.creatures.forEach((m) => { m.material.uniforms.uAlpha.value = cr; m.visible = cr > 0.01; });
      }
      return c;
    }
    if (sh.kind === 'board') {
      const B = S.board;
      const u = this.main.material.uniforms;
      u.uTex.value = this.plates.ready.get(this.plates.key('backdrop', 0));
      const bz = 2 * (1 + (B.z - 1) * 0.4);
      const c = this.camFor({ z: bz, x: 480 + (B.x - 960) * 0.1, y: 320 + (B.y - 540) * 0.1 });
      u.uCenter.value.set(c.x, c.y);
      u.uZoom.value = c.z;
      u.uOffset.value.set(0, 0);
      u.uBlur.value.set(0, 0);
      u.uDuo.value = 0;
      u.uInvert.value = 0;
      u.uBright.value = 1;
      this.main.visible = true;
      return null;
    }
    if (sh.kind === 'end') {
      const lu = this.logo.material.uniforms;
      lu.uTex.value = this.plates.ready.get(this.plates.key('logo', 0));
      lu.uSrc.value.set(...LOGO_SRC);
      lu.uAlpha.value = S.end.logo;
      lu.uDuo.value = 0;
      lu.uInvert.value = 0;
      lu.uBright.value = 1;
      const k = 2.4 * S.end.logoScale;
      const w = LOGO_SRC[2] * k;
      const h = LOGO_SRC[3] * k;
      this.setRect(this.logo, Math.round(W / 2 - w / 2), Math.round(430 - h / 2), Math.round(w), Math.round(h));
      this.logo.visible = S.end.logo > 0;
      drawSparkles(this.pixCtx, lt, S.end.logo);
      this.pixTex.needsUpdate = true;
      this.pix.visible = true;
      return null;
    }
    return null;
  }

  // -------------------------------------------------------------- render
  async renderAt(t, { wait = true } = {}) {
    const S = this.evaluate(t);
    if (wait) await Promise.all(this.needs(t).map(([p, i]) => this.plates.load(p, i)));
    const r = this.renderer;
    const sh = TL.shotAt(t);
    const lt = t - sh.t0;

    // transitions that need the previous shot rendered first
    this.wipe.enabled = false;
    let frozen = false;
    if (sh.kind === 'board' && lt < SHATTER_LEN && sh.enter?.type === 'shatter') {
      const ko = TL.shotById('ko');
      this.hideAll();
      this.setupShot(ko, ko.t1 - ko.t0 - 1e-4, S, wait, ko.cam.to);
      this.setupInsetFinal(ko);
      r.setRenderTarget(this.rtFrozen);
      r.render(this.scene, this.camera);
      r.setRenderTarget(null);
      frozen = true;
    }
    if (sh.enter?.type === 'glitch' && lt < WIPE_LEN) {
      this.hideAll();
      const prev = TL.shotById(sh.enter.from);
      this.setupShot(prev, prev.t1 - prev.t0 - 1e-4, S, wait);
      this.drawBoardUI(prev.t1 - 1e-4, S, true);
      r.setRenderTarget(this.rtPrev);
      r.render(this.scene, this.camera);
      r.setRenderTarget(null);
      this.wipe.enabled = true;
      this.wipe.uniforms.tPrev.value = this.rtPrev.texture;
      this.wipe.uniforms.uP.value = 0.45 + 0.55 * (lt / WIPE_LEN);
      this.wipe.uniforms.uSeed.value = Math.floor(t * FPS) * 1.37;
    }

    this.hideAll();
    const cam = this.setupShot(sh, lt, S, wait);
    this.drawBoardUI(t, S, sh.kind === 'board');
    if (frozen) {
      this.layoutShards(lt);
      this.shardMesh.visible = true;
    }
    this.drawTopUI(t, S, sh, cam);

    // effects
    const f = S.fx;
    const amp = f.shake;
    const sx = Math.round((noise1(t * 31) * amp) / 2) * 2;
    const sy = Math.round((noise1(t * 37 + 9) * amp * 0.8) / 2) * 2;
    const fu = this.fx.uniforms;
    fu.uShake.value.set(sx, sy);
    fu.uZoomPad.value = 1 + (2 * Math.abs(amp) + 6) / W;
    fu.uRGB.value = f.rgb;
    fu.uGlitch.value = Math.min(1, f.glitch);
    fu.uFrame.value = Math.floor(t * FPS);
    fu.uFlash.value = f.flash;
    fu.uFade.value = f.fade;
    const endGlow = sh.kind === 'end' ? S.end.glow : 0;
    this.bloom.strength = 0.55 + 0.6 * f.bloom + 0.9 * endGlow;
    this.bloom.highPassUniforms.uAll.value = endGlow * 0.9;
    this.composer.render();
    return sh.id;
  }

  setupInsetFinal(ko) {
    if (!ko.inset) return;
    const [sx, sy, sw, shh] = ko.inset.src;
    const [dx, dy, dw, dh] = ko.inset.dst;
    const iu = this.inset.material.uniforms;
    iu.uTex.value = this.main.material.uniforms.uTex.value;
    iu.uSrc.value.set(sx, sy, sw, shh);
    iu.uAlpha.value = 1;
    this.setRect(this.inset, dx, dy, dw, dh);
    this.inset.visible = true;
  }

  drawBoardUI(t, S, on) {
    const ctx = this.uiBoardCtx;
    ctx.clearRect(0, 0, W, H);
    if (on) drawBoard(ctx, t, S);
    this.uiBoardTex.needsUpdate = true;
    this.uiBoard.visible = on;
  }

  drawTopUI(t, S, sh, cam) {
    const ctx = this.uiTopCtx;
    ctx.clearRect(0, 0, W, H);
    if (cam && sh.kind === 'plate') {
      const off = [Math.round(S.cam.wx / 2) * 2, Math.round(S.cam.wy / 2) * 2];
      drawDamage(ctx, t, TL.damage.filter((d) => d.plate === sh.plate), (x, y) => this.toScreen(cam, x, y, off));
    }
    drawCaption(ctx, S);
    drawHandle(ctx, S);
    this.uiTopTex.needsUpdate = true;
    this.uiTop.visible = true;
  }
}
