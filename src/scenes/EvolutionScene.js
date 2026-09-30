// Evolution: a full-screen sequence of its own (after a battle, or from a
// Level Gem). Cosmic backdrop with rotating light rays, motes spiralling in,
// the silhouette flickering between forms faster and faster, a white-out
// burst and shockwave, then the new form - with its own build-up theme and
// fanfare. Use runEvolution(scene, creature) from any scene.
import Phaser from 'phaser';
import { GAME_W, GAME_H } from '../config.js';
import { displaySprite, spriteDensity } from '../data/creatures.js';
import { displayName, evolve, pendingEvolution } from '../systems/creature.js';
import { music, sfx } from '../systems/audio.js';
import { DialogBox } from '../ui/DialogBox.js';
import { tween, wait } from '../ui/helpers.js';

export function runEvolution(caller, creature) {
  return new Promise((resolve) => {
    caller.scene.launch('Evolution', { creature, onDone: resolve });
    caller.scene.bringToTop('Evolution');
  });
}

const CX = GAME_W / 2;
const CY = 270;

export class EvolutionScene extends Phaser.Scene {
  constructor() { super('Evolution'); }

  init(data) {
    this.creature = data.creature;
    this.onDone = data.onDone ?? (() => {});
  }

  async create() {
    const c = this.creature;
    const target = pendingEvolution(c);
    if (!target) { this.finish(); return; }
    const oldName = displayName(c).toUpperCase();
    const oldKey = displaySprite(c.species, 'front');
    const newKey = displaySprite(target, 'front');
    const size = (key) => 2.6 / spriteDensity(key);

    this.cameras.main.fadeIn(450, 0, 0, 0);
    // backdrop: deep gradient + twinkling stars
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x05060f, 0x05060f, 0x1b0f3a, 0x1b0f3a, 1).fillRect(0, 0, GAME_W, GAME_H);
    for (let i = 0; i < 130; i++) {
      const st = this.add.rectangle(Phaser.Math.Between(0, GAME_W), Phaser.Math.Between(0, GAME_H), 2, 2, 0xffffff, Phaser.Math.FloatBetween(0.2, 0.9));
      this.tweens.add({ targets: st, alpha: 0.1, duration: Phaser.Math.Between(600, 1800), yoyo: true, repeat: -1, delay: Phaser.Math.Between(0, 1500) });
    }
    // light rays (additive wedges) turning around the creature
    this.rays = this.add.container(CX, CY).setAlpha(0.0);
    for (let i = 0; i < 18; i++) {
      const g = this.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
      const a = (i / 18) * Math.PI * 2;
      g.fillStyle(i % 2 ? 0x8b5cff : 0x2ef2a8, 0.16);
      g.fillTriangle(0, 0, Math.cos(a - 0.07) * 700, Math.sin(a - 0.07) * 700, Math.cos(a + 0.07) * 700, Math.sin(a + 0.07) * 700);
      this.rays.add(g);
    }
    this.rayTween = this.tweens.add({ targets: this.rays, angle: 360, duration: 16000, repeat: -1 });
    this.glow = this.add.image(CX, CY, 'glow').setBlendMode(Phaser.BlendModes.ADD).setScale(2.5).setAlpha(0.35).setTint(0xb89cff);
    this.tweens.add({ targets: this.glow, scale: 3, alpha: 0.5, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    this.mon = this.add.image(CX, CY, oldKey).setScale(size(oldKey));
    this.tweens.add({ targets: this.mon, y: CY - 6, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.box = new DialogBox(this, { x: 16, y: GAME_H - 158, w: GAME_W - 32, h: 142, size: 30 });

    await wait(this, 500);
    await this.box.say(`What? ${oldName} is evolving!`);
    this.box.setVisible(false);
    music('evolve');

    // gather: motes spiral in, rings pulse out, rays fade up
    this.tweens.add({ targets: this.rays, alpha: 1, duration: 1400 });
    const motes = this.time.addEvent({ delay: 45, loop: true, callback: () => this.mote() });
    const rings = this.time.addEvent({ delay: 700, loop: true, callback: () => this.ring(0x8b5cff) });
    await wait(this, 1300);
    await tween(this, { targets: this.mon, alpha: 1, duration: 10 });
    this.mon.setTintFill(0xffffff);
    await wait(this, 500);

    // the flicker: old / new silhouettes, accelerating
    let d = 460;
    for (let i = 0; i < 22; i++) {
      const next = i % 2 ? oldKey : newKey;
      this.mon.setTexture(next).setScale(size(next) * (i % 2 ? 1 : 1.06));
      sfx('tick');
      this.rayTween.timeScale = 1 + i * 0.35;
      this.glow.setScale(2.5 + i * 0.09);
      await wait(this, d);
      d = Math.max(45, d * 0.84);
    }
    motes.remove();
    rings.remove();

    // burst
    sfx('evolveBurst');
    const white = this.add.rectangle(0, 0, GAME_W, GAME_H, 0xffffff).setOrigin(0).setAlpha(0).setDepth(50);
    await tween(this, { targets: white, alpha: 1, duration: 180 });
    evolve(c);
    const newName = displayName(c).toUpperCase();
    this.mon.setTexture(newKey).setScale(size(newKey)).clearTint();
    this.rayTween.timeScale = 0.6;
    this.cameras.main.shake(300, 0.008);
    music('evolved');
    this.tweens.add({ targets: white, alpha: 0, duration: 900, ease: 'Sine.easeOut' });
    for (let i = 0; i < 3; i++) this.time.delayedCall(i * 160, () => this.ring(i ? 0x2ef2a8 : 0xffc94a, 900));
    for (let i = 0; i < 40; i++) {
      const a = (i / 40) * Math.PI * 2;
      const sp = this.add.image(CX, CY, 'spark').setBlendMode(Phaser.BlendModes.ADD).setScale(0.5)
        .setTint(Phaser.Math.RND.pick([0xffffff, 0x2ef2a8, 0xffc94a, 0xb89cff])).setDepth(40);
      this.tweens.add({ targets: sp, x: CX + Math.cos(a) * Phaser.Math.Between(160, 420), y: CY + Math.sin(a) * Phaser.Math.Between(120, 300), alpha: 0, scale: 0.1, angle: 180, duration: 1100, ease: 'Cubic.easeOut', onComplete: () => sp.destroy() });
    }
    this.mon.setScale(size(newKey) * 0.6);
    await tween(this, { targets: this.mon, scale: size(newKey), duration: 600, ease: 'Back.easeOut' });
    await wait(this, 500);
    this.box.setVisible(true);
    sfx('fanfare');
    await this.box.say(`Congratulations! Your ${oldName} evolved into ${newName}!`);
    this.cameras.main.fadeOut(450, 0, 0, 0);
    await wait(this, 480);
    this.finish();
  }

  mote() {
    const a = Math.random() * Math.PI * 2;
    const r = Phaser.Math.Between(260, 520);
    const sp = this.add.image(CX + Math.cos(a) * r, CY + Math.sin(a) * r * 0.75, 'spark')
      .setBlendMode(Phaser.BlendModes.ADD).setScale(Phaser.Math.FloatBetween(0.15, 0.35))
      .setTint(Math.random() < 0.5 ? 0x2ef2a8 : 0xb89cff).setAlpha(0);
    // spiral in: rotate the approach angle as it closes
    const o = { t: 0 };
    this.tweens.add({
      targets: o, t: 1, duration: Phaser.Math.Between(900, 1400), ease: 'Cubic.easeIn',
      onUpdate: () => {
        const rr = r * (1 - o.t);
        const aa = a + o.t * 1.8;
        sp.setPosition(CX + Math.cos(aa) * rr, CY + Math.sin(aa) * rr * 0.75).setAlpha(Math.min(1, o.t * 3));
      },
      onComplete: () => sp.destroy(),
    });
  }

  ring(color, duration = 1200) {
    const g = this.add.graphics().setBlendMode(Phaser.BlendModes.ADD).setDepth(45);
    const o = { r: 20, a: 0.9 };
    this.tweens.add({
      targets: o, r: 520, a: 0, duration, ease: 'Cubic.easeOut',
      onUpdate: () => { g.clear().lineStyle(4, color, o.a).strokeEllipse(CX, CY, o.r * 2, o.r * 1.5); },
      onComplete: () => g.destroy(),
    });
  }

  finish() {
    const done = this.onDone;
    this.scene.stop();
    done();
  }
}
