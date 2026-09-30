import Phaser from 'phaser';
import { GAME_W, GAME_H, HD } from '../config.js';
import { LOOK_PROMPT } from '../data/dialogue.js';
import { pushFocus } from '../systems/controls.js';
import { sfx } from '../systems/audio.js';
import { DialogBox } from '../ui/DialogBox.js';
import { text } from '../ui/theme.js';
import { panelTexture } from '../ui/skin.js';
import { fadeTo, yesNo, tween, wait } from '../ui/helpers.js';
import { backdrop } from '../ui/backdrop.js';

export class LookScene extends Phaser.Scene {
  constructor() { super('Look'); }

  init(data) { this.playerName = data.name; }

  create() {
    this.cameras.main.fadeIn(500);
    backdrop(this);
    text(this, GAME_W / 2, 40, LOOK_PROMPT, 36, '#fff7e6', { fontStyle: 'bold' }).setOrigin(0.5);

    this.options = ['boy', 'girl'].map((gender, i) => {
      const cx = GAME_W / 2 + (i === 0 ? -170 : 170);
      const card = this.add.image(cx - 120 - 18, 90 - 18, panelTexture(this, 'glass', 240, 350)).setOrigin(0);
      const glow = this.add.image(cx, 300, 'glow').setScale(3).setAlpha(0).setTint(0x2ef2a8).setBlendMode(Phaser.BlendModes.ADD);
      const sh = this.add.ellipse(cx, 424, 120, 20, 0x000000, 0.3);
      const img = this.add.image(cx, 420, `player_${gender}_full`).setScale(2 / HD.full).setOrigin(0.5, 1);
      return { gender, cx, card, glow, sh, img };
    });
    this.index = 0;
    this.draw();
    this.box = new DialogBox(this, { x: 30, y: 470, w: GAME_W - 60, h: 140 });
    this.box.say('Use LEFT / RIGHT to choose, ENTER to confirm.', { wait: false });

    this.options.forEach((o, i) => {
      o.img.setInteractive({ useHandCursor: true }).on('pointerdown', () => { this.index = i; this.draw(); this.confirm(); });
    });
    this.release = pushFocus((a) => this.onAction(a), this);
  }

  onAction(a) {
    if (a === 'left' || a === 'right') { this.index = 1 - this.index; sfx('cursor'); this.draw(); }
    if (a === 'confirm') this.confirm();
  }

  draw() {
    this.options.forEach((o, i) => {
      const on = i === this.index;
      o.card.setTexture(panelTexture(this, on ? 'gold' : 'glass', 240, 350));
      o.card.setAlpha(on ? 1 : 0.7);
      o.img.setAlpha(on ? 1 : 0.5);
      this.tweens.killTweensOf([o.img, o.glow]);
      this.tweens.add({ targets: o.img, y: on ? 410 : 420, duration: 200, ease: 'Back.easeOut' });
      this.tweens.add({ targets: o.glow, alpha: on ? 0.35 : 0, duration: 200 });
    });
  }

  async confirm() {
    if (this.busy) return;
    this.busy = true;
    this.release();
    sfx('confirm');
    this.box.say('Is this you?', { wait: false });
    const ok = await yesNo(this, { x: GAME_W - 230, y: 300 });
    if (!ok) {
      this.busy = false;
      this.box.say('Use LEFT / RIGHT to choose, ENTER to confirm.', { wait: false });
      this.release = pushFocus((a) => this.onAction(a), this);
      return;
    }
    await this.shrinkIntoSprite(this.options[this.index]);
    fadeTo(this, 'Starter', { name: this.playerName, gender: this.options[this.index].gender });
  }

  /** The chosen portrait flashes white and shrinks into the in-game sprite,
   *  which pops out, spins through its four facings and settles. */
  async shrinkIntoSprite(o) {
    const other = this.options.find((x) => x !== o);
    const fadeOut = [other.card, other.img, other.sh, other.glow, o.card, o.sh, o.glow, this.box.container];
    this.children.list.filter((c) => c.type === 'Text').forEach((t) => fadeOut.push(t));
    this.tweens.add({ targets: fadeOut, alpha: 0, duration: 300 });
    const cx = GAME_W / 2;
    const floorY = 420;
    await tween(this, { targets: o.img, x: cx, y: floorY, duration: 380, ease: 'Sine.easeInOut' });
    const shadow = this.add.ellipse(cx, floorY + 2, 60, 12, 0x000000, 0.3).setAlpha(0);
    // gather: white flashes speeding up while it shrinks
    sfx('status');
    const endScale = (96 / o.img.height) * 1.2;
    const shrink = tween(this, { targets: o.img, scale: endScale, duration: 900, ease: 'Cubic.easeIn' });
    let d = 180;
    for (let i = 0; i < 7; i++) {
      if (i % 2 === 0) o.img.setTintFill(0xffffff); else o.img.clearTint();
      await wait(this, d);
      d = Math.max(40, d * 0.7);
    }
    await shrink;
    o.img.setTintFill(0xffffff);
    // pop into the overworld sprite
    const frames = this.registry.get('playerFrames') ?? 7;
    const sprite = this.add.sprite(cx, floorY, `player_${o.gender}`, 0).setOrigin(0.5, 1).setScale(1.25).setTintFill(0xffffff);
    const burst = this.add.image(cx, floorY - 48, 'glow').setBlendMode(Phaser.BlendModes.ADD).setScale(0.3).setAlpha(0.9).setTint(0x2ef2a8);
    this.tweens.add({ targets: burst, scale: 4, alpha: 0, duration: 520, onComplete: () => burst.destroy() });
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const sp = this.add.image(cx, floorY - 48, 'spark').setScale(0.3).setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({ targets: sp, x: cx + Math.cos(a) * 110, y: floorY - 48 + Math.sin(a) * 80, alpha: 0, scale: 0.1, duration: 520, onComplete: () => sp.destroy() });
    }
    o.img.destroy();
    sfx('sendout');
    this.tweens.add({ targets: shadow, alpha: 1, duration: 200 });
    await tween(this, { targets: sprite, scale: 1, duration: 260, ease: 'Back.easeOut' });
    await wait(this, 120);
    sprite.clearTint();
    // spin: down, left, up, right, down (twice, slowing)
    const rows = { down: 0, left: 1, right: 2, up: 3 };
    let t = 70;
    for (let k = 0; k < 2; k++) {
      for (const dir of ['left', 'up', 'right', 'down']) {
        sprite.setFrame(rows[dir] * frames);
        sfx('tick');
        await wait(this, t);
      }
      t += 40;
    }
    // a little hop, then a beat to look at them
    sfx('confirm');
    await tween(this, { targets: sprite, y: floorY - 14, duration: 140, yoyo: true, ease: 'Sine.easeOut' });
    await wait(this, 500);
  }
}
