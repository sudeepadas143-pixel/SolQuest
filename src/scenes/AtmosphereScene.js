// Screen-space atmosphere drawn between the world and the HUD:
//   * day/night + weather colour grade (MULTIPLY overlay)
//   * night lights: lit windows, lamps, torches (ADD glows from prop metadata)
//   * rain, splashes, storm lightning
//   * drifting cloud shadows on fair days
// Everything is driven by systems/world.js (deterministic from play time).
import Phaser from 'phaser';
import { GAME_W, GAME_H } from '../config.js';
import { getSave } from '../systems/save.js';
import { atmosphere } from '../systems/world.js';
import { sfx, rainAmbience } from '../systems/audio.js';

const POOL = 90;

export class AtmosphereScene extends Phaser.Scene {
  constructor() { super('Atmosphere'); }

  create() {
    this.world = this.scene.get('Overworld');

    // cloud shadows (world-anchored, drawn under the colour grade)
    this.clouds = Array.from({ length: 5 }, (_, i) => ({
      img: this.add.image(0, 0, 'cloudshadow').setAlpha(0).setScale(1.4 + (i % 3) * 0.35),
      wx: i * 520 + 80, wy: (i * 977) % 3000, speed: 5 + (i % 3) * 2,
    }));

    this.grade = this.add.rectangle(0, 0, GAME_W, GAME_H, 0xffffff).setOrigin(0).setBlendMode(Phaser.BlendModes.MULTIPLY);

    this.glows = Array.from({ length: POOL }, () => this.add.image(0, 0, 'glow').setBlendMode(Phaser.BlendModes.ADD).setVisible(false));

    // rain: long thin streaks + splash rings
    this.rain = this.add.particles(0, 0, 'raindrop', {
      x: { min: -120, max: GAME_W + 60 }, y: -30,
      speedY: { min: 980, max: 1180 }, speedX: { min: 180, max: 240 },
      lifespan: 760, scaleY: { min: 0.8, max: 1.3 }, alpha: { start: 0.55, end: 0.25 },
      quantity: 0, frequency: 16, rotate: -11,
    });
    this.splash = this.add.particles(0, 0, 'ripple', {
      x: { min: 0, max: GAME_W }, y: { min: 60, max: GAME_H },
      lifespan: 360, scale: { start: 0.25, end: 1 }, alpha: { start: 0.55, end: 0 },
      quantity: 0, frequency: 30,
    });
    this.flash = this.add.rectangle(0, 0, GAME_W, GAME_H, 0xf4f8ff).setOrigin(0).setAlpha(0);
    this.nextBolt = 0;
    this.lastKind = null;
  }

  update(time, delta) {
    const save = getSave();
    if (!save || !this.world?.cameras?.main) return;
    const cam = this.world.cameras.main;
    const view = cam.worldView;
    const z = cam.zoom;
    const toScreen = (wx, wy) => [(wx - view.x) * z, (wy - view.y) * z];
    // indoors (the Elite Hall): steady warm-violet light, braziers burning,
    // no sky, clouds or rain
    // (before Cooker falls it starts dark and brightens as the aisle braziers catch)
    const atm = this.world.indoors
      ? { color: hallGrade(this.world.hallLight ?? 1), light: 0.62 + 0.3 * (1 - (this.world.hallLight ?? 1)), weather: { kind: 'clear', intensity: 0 } }
      : atmosphere(save.stats.playMs);
    const w = atm.weather;

    // colour grade
    this.grade.setFillStyle(atm.color).setVisible(atm.color !== 0xffffff);

    // cloud shadows: only when it's bright and not raining
    const cloudA = this.world.indoors ? 0 : w.kind === 'clear' ? 0.12 * (1 - atm.light) : w.kind === 'cloudy' ? 0.16 * (1 - atm.light) * w.intensity : 0;
    // world-anchored, tiled around the view so they drift past as you walk
    const spanX = view.width + 1400;
    const spanY = view.height + 900;
    for (const c of this.clouds) {
      c.wx += (c.speed * delta) / 1000;
      const x = view.x - 700 + ((((c.wx - (view.x - 700)) % spanX) + spanX) % spanX);
      const y = view.y - 450 + ((((c.wy - (view.y - 450)) % spanY) + spanY) % spanY);
      const [sx, sy] = toScreen(x, y);
      c.img.setPosition(sx, sy).setAlpha(cloudA);
    }

    // lights (pool the nearest visible ones)
    const L = atm.light;
    let used = 0;
    if (L > 0.02) {
      const pad = 60;
      for (const l of this.world.lights) {
        if (used >= POOL) break;
        if (l.off) continue;
        if (l.x < view.x - pad || l.x > view.right + pad || l.y < view.y - pad || l.y > view.bottom + pad) continue;
        const [sx, sy] = toScreen(l.x, l.y);
        const flick = 0.92 + 0.08 * Math.sin(time / 170 + l.x * 0.13);
        this.glows[used].setVisible(true).setPosition(sx, sy).setTint(l.color)
          .setScale((l.r * z) / 64).setAlpha(Math.min(0.6, L * 0.6) * flick * (l.a ?? 1));
        used++;
      }
    }
    for (let i = used; i < POOL; i++) this.glows[i].setVisible(false);

    // rain + storm
    const wet = w.kind === 'rain' || w.kind === 'storm' ? w.intensity : 0;
    this.rain.quantity = Math.round(wet * (w.kind === 'storm' ? 7 : 4));
    this.splash.quantity = Math.round(wet * (w.kind === 'storm' ? 3 : 2));
    rainAmbience(wet * (w.kind === 'storm' ? 1 : 0.6));
    if (w.kind === 'storm' && w.intensity > 0.6 && time > this.nextBolt) {
      this.nextBolt = time + 6000 + Math.random() * 9000;
      this.tweens.chain({
        targets: this.flash,
        tweens: [
          { alpha: 0.75, duration: 60 }, { alpha: 0.1, duration: 90 },
          { alpha: 0.55, duration: 50 }, { alpha: 0, duration: 420 },
        ],
      });
      this.time.delayedCall(500 + Math.random() * 900, () => sfx('thunder'));
    }
    if (w.kind !== this.lastKind) {
      this.lastKind = w.kind;
      this.events.emit('weather', w.kind);
    }
  }
}

/** Colour grade of the Hall: deep violet dark (0) to its normal warm light (1). */
function hallGrade(t) {
  const a = [0x2a, 0x20, 0x44];
  const b = [0xe6, 0xdc, 0xf4];
  const k = Math.max(0, Math.min(1, t));
  const [r, g, bl] = a.map((v, i) => Math.round(v + (b[i] - v) * k));
  return (r << 16) | (g << 8) | bl;
}
