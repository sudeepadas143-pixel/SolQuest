// Title: a SolQuest sunrise. From a grassy cliff, the player (both looks)
// and the three starters look out over drifting mountain ridges under a
// violet-to-teal dawn with a rising sun.
import Phaser from 'phaser';
import { GAME_W, GAME_H, GAME_TITLE } from '../config.js';
import { hasSave, loadSave, deleteSave } from '../systems/save.js';
import { pushFocus } from '../systems/controls.js';
import { music, sfx } from '../systems/audio.js';
import { chooseFrom } from '../ui/Menu.js';
import { DialogBox } from '../ui/DialogBox.js';
import { panel, text } from '../ui/theme.js';
import { fadeTo, yesNo } from '../ui/helpers.js';

const HORIZON = 372;

/** A ridge line that repeats every `period` px (so it can scroll forever). */
function ridge(g, color, baseY, amp, period, seed, width) {
  const pts = [{ x: 0, y: GAME_H }];
  for (let x = 0; x <= width; x += 6) {
    const t = (x / period) * Math.PI * 2;
    const y = baseY - amp * (0.55 * Math.sin(t + seed) + 0.3 * Math.sin(2 * t + seed * 2.1) + 0.15 * Math.sin(5 * t + seed * 0.7));
    pts.push({ x, y });
  }
  pts.push({ x: width, y: GAME_H });
  g.fillStyle(color, 1).fillPoints(pts, true);
}

export class TitleScene extends Phaser.Scene {
  constructor() { super('Title'); }

  create() {
    this.cameras.main.fadeIn(700);
    music('title');
    this.t = 0;

    // --- sky: deep violet above, Sol purple, a teal glow on the horizon
    const sky = this.add.graphics();
    sky.fillGradientStyle(0x0b0620, 0x0b0620, 0x3a1a82, 0x3a1a82, 1).fillRect(0, 0, GAME_W, 230);
    sky.fillGradientStyle(0x3a1a82, 0x3a1a82, 0x9945ff, 0x9945ff, 1).fillRect(0, 230, GAME_W, 90);
    sky.fillGradientStyle(0x9945ff, 0x9945ff, 0x35e6b4, 0x35e6b4, 1).fillRect(0, 320, GAME_W, HORIZON - 320 + 40);
    this.stars = this.add.graphics();
    for (let i = 0; i < 90; i++) this.stars.fillStyle(0xffffff, Phaser.Math.FloatBetween(0.2, 0.9)).fillRect(Phaser.Math.Between(0, GAME_W), Phaser.Math.Between(0, 200), 2, 2);
    this.tweens.add({ targets: this.stars, alpha: 0.35, duration: 3000, yoyo: true, repeat: -1 });

    // --- the sun, rising, with slowly turning rays
    this.rays = this.add.container(GAME_W / 2, HORIZON + 10);
    for (let i = 0; i < 24; i++) {
      const g = this.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
      const a = (i / 24) * Math.PI * 2;
      g.fillStyle(i % 2 ? 0xfff0b8 : 0xb8ffe8, 0.08);
      g.fillTriangle(0, 0, Math.cos(a - 0.05) * 800, Math.sin(a - 0.05) * 800, Math.cos(a + 0.05) * 800, Math.sin(a + 0.05) * 800);
      this.rays.add(g);
    }
    this.tweens.add({ targets: this.rays, angle: 360, duration: 90000, repeat: -1 });
    const sun = this.add.container(GAME_W / 2, HORIZON + 30);
    sun.add(this.add.image(0, 0, 'glow').setBlendMode(Phaser.BlendModes.ADD).setScale(7).setTint(0xffd98a).setAlpha(0.55));
    const disc = this.add.graphics();
    disc.fillStyle(0xffc46a, 1).fillCircle(0, 0, 92);
    disc.fillStyle(0xffe19a, 1).fillCircle(0, -6, 78);
    disc.fillStyle(0xfff4d0, 1).fillCircle(0, -12, 58);
    sun.add(disc);
    this.tweens.add({ targets: sun, y: HORIZON - 4, duration: 14000, ease: 'Sine.easeOut' });

    // --- mountain ridges (parallax)
    this.layers = [];
    const mk = (color, baseY, amp, period, seed, speed) => {
      const g = this.add.graphics();
      ridge(g, color, baseY, amp, period, seed, GAME_W * 2 + 12);
      this.layers.push({ g, speed });
      return g;
    };
    mk(0x5a36a8, HORIZON - 6, 56, 480, 0.4, 0);          // far ridge holds still
    mk(0x3a2272, HORIZON + 40, 38, 320, 1.7, 9);
    mk(0x241450, HORIZON + 92, 30, 240, 2.9, 16);
    // mist in the valley
    const mist = this.add.image(GAME_W / 2, HORIZON + 70, 'glow').setScale(14, 1.6).setAlpha(0.18).setTint(0xb8ffe8);
    this.tweens.add({ targets: mist, alpha: 0.28, duration: 4000, yoyo: true, repeat: -1 });

    // --- the cliff we stand on, fringed with swaying tall grass
    const cliff = this.add.graphics();
    const cpts = [{ x: 0, y: GAME_H }, { x: 0, y: 560 }];
    for (let x = 0; x <= GAME_W; x += 20) cpts.push({ x, y: 548 + Math.sin(x / 90) * 8 + Math.sin(x / 31) * 3 });
    cpts.push({ x: GAME_W, y: GAME_H });
    cliff.fillStyle(0x12301f, 1).fillPoints(cpts, true);
    cliff.lineStyle(3, 0x35e6b4, 0.55).beginPath();
    cpts.slice(1, -1).forEach((p, i) => (i ? cliff.lineTo(p.x, p.y) : cliff.moveTo(p.x, p.y)));
    cliff.strokePath();
    this.grass = [];
    for (let x = -20, i = 0; x < GAME_W + 40; x += 46, i++) {
      if (x > 250 && x < 720) continue;                    // leave room for the party
      const v = i % 4;
      const img = this.add.image(x, 572 + (i % 3) * 6, `tall_front${v}_1`).setOrigin(0.5, 1).setScale(1.2).setTint(0x8fb8a0);
      this.grass.push({ img, v, x });
    }

    // --- the party, seen from behind, watching the sunrise
    const frames = this.registry.get('playerFrames') ?? 7;
    const up = 3 * frames;
    const party = [
      ['emby_back', 318, 0.36], ['player_boy', 420, 1], ['player_girl', 520, 1], ['sharkpup_back', 612, 0.36], ['fernie_back', 700, 0.36],
    ];
    party.forEach(([key, x, sc], i) => {
      const img = key.startsWith('player_') ? this.add.image(x, 596, key, up) : this.add.image(x, 596, key);
      img.setOrigin(0.5, 1).setScale(sc).setTint(0xe6dcff);
      this.add.ellipse(x, 594, 70 * Math.max(0.7, sc), 12, 0x000000, 0.35).setDepth(-1);
      this.tweens.add({ targets: img, y: 592, duration: 1400 + i * 170, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    });
    // rim light from the sun on the party
    this.add.image(GAME_W / 2, 520, 'glow').setBlendMode(Phaser.BlendModes.ADD).setScale(6, 2).setAlpha(0.15).setTint(0xffd98a);

    // --- life: birds and floating motes
    this.time.addEvent({ delay: 3800, loop: true, callback: () => this.birds() });
    this.add.particles(0, 0, 'spark', {
      x: { min: 0, max: GAME_W }, y: { min: 250, max: 560 }, speedY: { min: -14, max: -4 }, speedX: { min: -6, max: 6 },
      lifespan: 5000, scale: { start: 0.05, end: 0.1 }, alpha: { start: 0, end: 0.7, ease: 'Sine.easeInOut' },
      tint: [0xfff0b8, 0xb8ffe8, 0xd4b8ff], blendMode: 'ADD', frequency: 260,
    });

    // --- logo
    const logo = text(this, GAME_W / 2, 118, GAME_TITLE, 118, '#ffffff', { fontStyle: 'bold', stroke: '#0e0726', strokeThickness: 16 }).setOrigin(0.5);
    const grd = logo.context.createLinearGradient(0, 0, logo.width, 0);
    grd.addColorStop(0, '#b77bff');
    grd.addColorStop(0.5, '#e9dcff');
    grd.addColorStop(1, '#3df2b4');
    logo.setFill(grd);
    logo.setShadow(0, 10, '#9945ff', 0, true, true);
    this.tweens.add({ targets: logo, y: 126, duration: 2200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    const glint = this.add.image(-200, 118, 'glow').setBlendMode(Phaser.BlendModes.ADD).setScale(1.2, 3.4).setAlpha(0.5).setAngle(18);
    this.time.addEvent({ delay: 4200, loop: true, callback: () => { glint.x = GAME_W / 2 - 330; this.tweens.add({ targets: glint, x: GAME_W / 2 + 330, duration: 900, ease: 'Sine.easeInOut' }); } });

    this.promptChip = this.add.container(0, 0);
    this.promptChip.add(panel(this, GAME_W / 2 - 130, 596, 260, 38, 'glass'));
    this.promptChip.add(text(this, GAME_W / 2, 601, 'PRESS ENTER', 24, '#2ef2a8', { fontStyle: 'bold' }).setOrigin(0.5, 0));
    this.tweens.add({ targets: this.promptChip, alpha: 0.45, duration: 700, yoyo: true, repeat: -1 });
    text(this, GAME_W - 16, GAME_H - 22, 'N: sound on/off', 14, '#fff7e6').setOrigin(1, 0).setAlpha(0.6);

    let started = false;
    const go = () => {
      if (started) return;
      started = true;
      release();
      sfx('confirm');
      this.promptChip.destroy();
      this.openMenu();
    };
    const release = pushFocus((a) => { if (a === 'confirm') go(); }, this);
    this.input.once('pointerdown', go);
  }

  birds() {
    const y = Phaser.Math.Between(150, 280);
    const flock = this.add.container(-40, y);
    for (let i = 0; i < Phaser.Math.Between(3, 6); i++) {
      const b = this.add.graphics();
      b.lineStyle(2, 0x1a0f36, 0.9).beginPath().moveTo(-5, -2).lineTo(0, 1).lineTo(5, -2).strokePath();
      b.setPosition(i * 14 + Phaser.Math.Between(-4, 4), (i % 2) * 8 + Phaser.Math.Between(-3, 3));
      this.tweens.add({ targets: b, scaleY: -0.6, duration: 260, yoyo: true, repeat: -1, delay: i * 60 });
      flock.add(b);
    }
    this.tweens.add({ targets: flock, x: GAME_W + 120, y: y - 40, duration: 16000, onComplete: () => flock.destroy() });
  }

  update(_time, delta) {
    this.t += delta / 1000;
    for (const l of this.layers) {
      l.g.x -= (l.speed * delta) / 1000;
      if (l.g.x <= -GAME_W) l.g.x += GAME_W;
    }
    // wind through the grass
    for (const g of this.grass) {
      const w = Math.sin(g.x * 0.02 - this.t * 2.2);
      const f = w > 0.4 ? 2 : w < -0.5 ? 0 : 1;
      if (g.f !== f) {
        g.f = f;
        const key = `tall_front${g.v}_${f}`;
        g.img.setTexture(key);
      }
    }
  }

  async openMenu() {
    const saved = hasSave();
    const items = saved ? [{ label: 'CONTINUE' }, { label: 'NEW GAME' }] : [{ label: 'NEW GAME' }];
    const i = await chooseFrom(this, {
      x: GAME_W / 2 - 160, y: 392, w: 320, h: saved ? 140 : 90, items, cancelable: false,
    });
    const choice = items[i].label;
    if (choice === 'CONTINUE') {
      const s = loadSave();
      if (s) { fadeTo(this, 'Overworld'); return; }
      const box = new DialogBox(this, { x: 40, y: 480, w: GAME_W - 80, h: 130 });
      await box.say('That save file could not be read. Starting a new game.');
      box.destroy();
    } else if (saved) {
      const box = new DialogBox(this, { x: 40, y: 480, w: GAME_W - 80, h: 140, size: 24 });
      box.say('Start a new game? This erases your current save in this browser.', { wait: false });
      const ok = await yesNo(this, { x: GAME_W - 240, y: 300 });
      box.destroy();
      if (!ok) { this.openMenu(); return; }
      deleteSave();
    }
    music(null);
    fadeTo(this, 'Intro');
  }
}
