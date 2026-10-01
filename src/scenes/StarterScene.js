// Starter choice: three partners side by side, single selection, no take-backs.
import Phaser from 'phaser';
import { GAME_W, GAME_H, HD } from '../config.js';
import { SPECIES, STARTERS } from '../data/creatures.js';
import { STARTER_PROMPT } from '../data/dialogue.js';
import { TYPE_COLORS } from '../data/types.js';
import { pushFocus } from '../systems/controls.js';
import { sfx } from '../systems/audio.js';
import { DialogBox } from '../ui/DialogBox.js';
import { text, hex } from '../ui/theme.js';
import { panelTexture } from '../ui/skin.js';
import { fadeTo, yesNo } from '../ui/helpers.js';
import { backdrop } from '../ui/backdrop.js';

export class StarterScene extends Phaser.Scene {
  constructor() { super('Starter'); }

  init(data) { this.info = data; }

  create() {
    this.cameras.main.fadeIn(500);
    backdrop(this, { top: 0x1c2458, bottom: 0x10303a });
    text(this, GAME_W / 2, 36, STARTER_PROMPT, 32, '#fff7e6', { fontStyle: 'bold' }).setOrigin(0.5);

    this.cards = STARTERS.map((id, i) => {
      const cx = GAME_W / 2 + (i - 1) * 290;
      const sp = SPECIES[id];
      const tcol = hex(TYPE_COLORS[sp.types[0]]);
      const card = this.add.image(cx - 125 - 18, 76 - 18, panelTexture(this, 'card', 250, 350, { accent: tcol })).setOrigin(0);
      const glow = this.add.image(cx, 230, 'glow').setScale(3.2).setAlpha(0).setTint(TYPE_COLORS[sp.types[0]]).setBlendMode(Phaser.BlendModes.ADD);
      const sh = this.add.ellipse(cx, 300, 140, 26, 0x12163a, 0.25);
      const img = this.add.image(cx, 296, sp.front).setScale(2 / HD.front).setOrigin(0.5, 1);
      const name = text(this, cx, 318, sp.name.toUpperCase(), 30, '#12163a', { fontStyle: 'bold' }).setOrigin(0.5, 0);
      const badge = this.add.graphics();
      badge.fillStyle(0x000000, 0.25).fillRoundedRect(cx - 48, 364, 100, 26, 9);
      badge.fillStyle(TYPE_COLORS[sp.types[0]], 1).fillRoundedRect(cx - 50, 362, 100, 26, 9);
      const bt = text(this, cx, 363, sp.types[0].toUpperCase(), 18, '#ffffff').setOrigin(0.5, 0);
      // the whole card: hover highlights it, click picks it
      for (const t of [card, img]) {
        t.setInteractive({ useHandCursor: true })
          .on('pointerover', () => { if (this.busy || this.index === i) return; this.index = i; sfx('cursor'); this.draw(); })
          .on('pointerdown', () => { if (this.busy) return; this.index = i; this.draw(); this.confirm(); });
      }
      return { id, cx, card, glow, img, name, badge, bt };
    });
    this.index = 0;
    this.box = new DialogBox(this, { x: 30, y: 470, w: GAME_W - 60, h: 146, size: 26 });
    this.draw();
    this.release = pushFocus((a) => this.onAction(a), this);
  }

  onAction(a) {
    if (a === 'left') { this.index = (this.index + 2) % 3; sfx('cursor'); this.draw(); }
    if (a === 'right') { this.index = (this.index + 1) % 3; sfx('cursor'); this.draw(); }
    if (a === 'confirm') this.confirm();
  }

  draw() {
    this.cards.forEach((c, i) => {
      const on = i === this.index;
      c.card.setAlpha(on ? 1 : 0.55);
      c.img.setAlpha(on ? 1 : 0.55);
      c.name.setAlpha(on ? 1 : 0.6);
      this.tweens.killTweensOf([c.img, c.glow, c.card]);
      this.tweens.add({ targets: c.img, y: on ? 286 : 296, scale: (on ? 2.15 : 2) / HD.front, duration: 220, ease: 'Back.easeOut' });
      this.tweens.add({ targets: c.glow, alpha: on ? 0.3 : 0, duration: 220 });
      this.tweens.add({ targets: c.card, y: on ? 76 - 18 - 8 : 76 - 18, duration: 220, ease: 'Back.easeOut' });
    });
    const sp = SPECIES[this.cards[this.index].id];
    this.box.say(sp.desc, { wait: false });
  }

  async confirm() {
    if (this.busy) return;
    this.busy = true;
    this.release();
    sfx('confirm');
    const sp = SPECIES[this.cards[this.index].id];
    this.box.say(`So you want ${sp.name.toUpperCase()}, the ${sp.types[0]}-type? You can't change this later.`, { wait: false });
    const ok = await yesNo(this, { x: GAME_W - 230, y: 290 });
    if (!ok) {
      this.busy = false;
      this.draw();
      this.release = pushFocus((a) => this.onAction(a), this);
      return;
    }
    const c = this.cards[this.index];
    this.tweens.add({ targets: c.img, scale: 2.6 / HD.front, duration: 200, yoyo: true });
    this.cameras.main.flash(300, 255, 255, 255);
    sfx('levelup');
    await this.box.say(`${sp.name.toUpperCase()} is now your partner!`);
    fadeTo(this, 'Wallet', { ...this.info, starter: c.id });
  }
}
