// Professor Mia's intro: a few short lines, then your name. She steps in from
// the right over the route backdrop; the dialogue box sits over her feet,
// visual-novel style. Click / tap or press ENTER to advance.
import Phaser from 'phaser';
import { GAME_W, GAME_H } from '../config.js';
import { INTRO_SCRIPT, INTRO_SPEAKER } from '../data/dialogue.js';
import { DialogBox } from '../ui/DialogBox.js';
import { text } from '../ui/theme.js';
import { backdrop } from '../ui/backdrop.js';
import { domInput, fadeTo, wait, tapButton, tween } from '../ui/helpers.js';
import { pushFocus } from '../systems/controls.js';
import { sfx } from '../systems/audio.js';

const MIA_X = 720;

export class IntroScene extends Phaser.Scene {
  constructor() { super('Intro'); }

  async create() {
    this.cameras.main.fadeIn(500);
    backdrop(this, { top: 0x1c2152, bottom: 0x10313a });
    // a soft light behind her, and her shadow on the floor
    this.halo = this.add.image(MIA_X, 300, 'glow').setScale(6).setTint(0xc8a8ff).setAlpha(0).setBlendMode(Phaser.BlendModes.ADD);
    this.floor = this.add.ellipse(MIA_X, GAME_H - 26, 190, 26, 0x05060f, 0).setDepth(1);
    this.mia = this.add.image(MIA_X + 120, GAME_H - 30, 'mia_full').setOrigin(0.5, 1).setAlpha(0).setDepth(2);

    this.box = new DialogBox(this, { x: 30, y: GAME_H - 170, w: GAME_W - 60, h: 150, size: 27 });
    this.box.speed = 15;
    this.box.setVisible(false);

    // she steps in
    await wait(this, 250);
    sfx('open');
    this.tweens.add({ targets: this.halo, alpha: 0.16, duration: 900 });
    this.tweens.add({ targets: this.floor, fillAlpha: 0.35, duration: 600 });
    await tween(this, { targets: this.mia, x: MIA_X, alpha: 1, duration: 520, ease: 'Cubic.easeOut' });
    // ...and breathes (a slow, slight rise of the shoulders)
    this.tweens.add({ targets: this.mia, scaleY: 1.006, duration: 1700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    let name = '';
    for (const line of INTRO_SCRIPT) {
      if (typeof line === 'object' && line.input === 'name') {
        name = await this.askName();
        continue;
      }
      await this.box.say(line.replace('{PLAYER_NAME}', name), { speaker: INTRO_SPEAKER });
    }
    this.box.setVisible(false);
    this.tweens.add({ targets: this.mia, x: MIA_X + 60, alpha: 0, duration: 380, ease: 'Cubic.easeIn' });
    await wait(this, 300);
    fadeTo(this, 'Look', { name }, 500);
  }

  askName() {
    return new Promise((resolve) => {
      this.box.setVisible(false);
      // Mia steps aside so the name card has the stage
      this.tweens.add({ targets: [this.mia, this.halo, this.floor], x: '+=110', duration: 320, ease: 'Sine.easeInOut' });
      const cx = GAME_W / 2 - 110;
      const hint = text(this, cx, 220, 'YOUR NAME', 26, '#c9c2ff', { fontStyle: 'bold' }).setOrigin(0.5);
      const note = text(this, cx, 392, 'Up to 10 characters', 18, '#8f93c4').setOrigin(0.5);
      const input = domInput(this, cx, 290, { width: 420, maxLength: 10, placeholder: '' });
      let release = () => {};
      let ok = null;
      const submit = () => {
        const v = input.value().replace(/[^\p{L}\p{N} _.-]/gu, '').trim().slice(0, 10);
        if (!v) {
          sfx('bump');
          this.tweens.add({ targets: input.dom, x: cx + 8, duration: 50, yoyo: true, repeat: 3, onComplete: () => input.dom.setX(cx) });
          input.el.focus();
          return;
        }
        sfx('confirm');
        release();
        input.destroy(); hint.destroy(); note.destroy(); ok.destroy();
        this.tweens.add({ targets: [this.mia, this.halo, this.floor], x: '-=110', duration: 320, ease: 'Sine.easeInOut' });
        resolve(v.toUpperCase());
      };
      // click OK, press ENTER, or the touch pad's A button
      ok = tapButton(this, cx, 350, 'OK', submit, { w: 180, h: 50, size: 26 });
      release = pushFocus((a) => { if (a === 'confirm') submit(); }, this);
      input.el.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } });
    });
  }
}
