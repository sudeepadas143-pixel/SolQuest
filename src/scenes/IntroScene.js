// Professor Satoshi's intro: pure black screen, white text, no portrait.
import Phaser from 'phaser';
import { GAME_W, GAME_H } from '../config.js';
import { INTRO_SCRIPT, INTRO_SPEAKER } from '../data/dialogue.js';
import { DialogBox } from '../ui/DialogBox.js';
import { text } from '../ui/theme.js';
import { domInput, fadeTo, wait, tapButton } from '../ui/helpers.js';
import { pushFocus } from '../systems/controls.js';
import { sfx } from '../systems/audio.js';



export class IntroScene extends Phaser.Scene {
  constructor() { super('Intro'); }

  async create() {
    this.cameras.main.setBackgroundColor('#000000');
    this.cameras.main.fadeIn(600);
    this.speaker = text(this, 110, 250, `${INTRO_SPEAKER}:`, 24, '#9a9aa6').setAlpha(0);
    this.box = new DialogBox(this, { x: 80, y: 280, w: GAME_W - 160, h: 200, style: null, size: 32, color: '#ffffff' });
    this.box.speed = 22;

    await wait(this, 700);
    let name = '';
    for (const line of INTRO_SCRIPT) {
      if (typeof line === 'object' && line.input === 'name') {
        name = await this.askName();
        continue;
      }
      this.speaker.setAlpha(1);
      const str = line.replace('{PLAYER_NAME}', name);
      if (str === '...') this.box.speed = 260;
      await this.box.say(str);
      this.box.speed = 22;
    }
    this.box.clear();
    this.speaker.setAlpha(0);
    await wait(this, 400);
    fadeTo(this, 'Look', { name }, 700);
  }

  askName() {
    return new Promise((resolve) => {
      this.box.setVisible(false);
      this.speaker.setAlpha(0);
      const hint = text(this, GAME_W / 2, 250, 'YOUR NAME', 24, '#9a9aa6').setOrigin(0.5);
      const note = text(this, GAME_W / 2, 470, 'Up to 10 characters  ·  tap OK, press A or ENTER', 20, '#6b6b78').setOrigin(0.5);
      const input = domInput(this, GAME_W / 2, 320, { width: 420, maxLength: 10, placeholder: '' });
      let release = () => {};
      let ok = null;
      const submit = () => {
        const v = input.value().replace(/[^\p{L}\p{N} _.-]/gu, '').trim().slice(0, 10);
        if (!v) {
          sfx('bump');
          this.tweens.add({ targets: input.dom, x: GAME_W / 2 + 8, duration: 50, yoyo: true, repeat: 3 });
          return;
        }
        sfx('confirm');
        release();
        input.destroy(); hint.destroy(); note.destroy(); ok.destroy();
        this.box.setVisible(true);
        resolve(v.toUpperCase());
      };
      // phones: an on-screen OK button, and the touch pad's A button, both submit
      ok = tapButton(this, GAME_W / 2, 405, 'OK', submit, { w: 200, h: 54 });
      release = pushFocus((a) => { if (a === 'confirm') submit(); }, this);
      input.el.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } });
    });
  }
}
