// Title: drone footage of the SolQuest overworld. The footage is the game's
// own map, tiles and prop models rendered as a 3D world (trailer/src/drone, see
// trailer/render/drone.mjs) - an edited, seamless loop of shots through one day at the
// game's 960x640, streamed as a muted video. The first frame is shown instantly
// and stays as the backdrop if the video can't play.
import Phaser from 'phaser';
import { GAME_W, GAME_H, GAME_TITLE } from '../config.js';
import { hasSave, loadSave, deleteSave } from '../systems/save.js';
import { pushFocus } from '../systems/controls.js';
import { music, sfx } from '../systems/audio.js';
import { chooseFrom } from '../ui/Menu.js';
import { DialogBox } from '../ui/DialogBox.js';
import { panel, text } from '../ui/theme.js';
import { fadeTo, yesNo } from '../ui/helpers.js';

const VIDEO = `${import.meta.env.BASE_URL}assets/title/drone`;

export class TitleScene extends Phaser.Scene {
  constructor() { super('Title'); }

  create() {
    this.cameras.main.fadeIn(900);
    music('title');

    // --- the world: poster frame now, the drone flight as soon as it streams in
    this.add.image(GAME_W / 2, GAME_H / 2, 'title_poster');
    this.flight = this.add.video(GAME_W / 2, GAME_H / 2).setAlpha(0);
    // H.264 for Safari / iOS, VP9 for browsers without H.264; muted so it autoplays everywhere
    this.flight.loadURL([`${VIDEO}.mp4`, `${VIDEO}.webm`], true);
    this.flight.play(true);
    this.flight.once('playing', () => this.tweens.add({ targets: this.flight, alpha: 1, duration: 700 }));
    this.events.once('shutdown', () => this.flight?.stop());

    // --- screen dressing: shade behind the logo and the prompt, a faint CRT
    const shade = this.add.graphics();
    shade.fillGradientStyle(0x0b0620, 0x0b0620, 0x0b0620, 0x0b0620, 0.78, 0.78, 0, 0).fillRect(0, 0, GAME_W, 250);
    shade.fillGradientStyle(0x0b0620, 0x0b0620, 0x0b0620, 0x0b0620, 0, 0, 0.72, 0.72).fillRect(0, GAME_H - 230, GAME_W, 230);
    const scan = this.add.graphics().setAlpha(0.09);
    for (let y = 0; y < GAME_H; y += 3) scan.fillStyle(0x000000, 1).fillRect(0, y, GAME_W, 1);

    // --- logo
    const logo = text(this, GAME_W / 2, 112, GAME_TITLE, 120, '#ffffff', { fontStyle: 'bold', stroke: '#0e0726', strokeThickness: 16 }).setOrigin(0.5);
    const grd = logo.context.createLinearGradient(0, 0, logo.width, 0);
    grd.addColorStop(0, '#b77bff');
    grd.addColorStop(0.5, '#e9dcff');
    grd.addColorStop(1, '#3df2b4');
    logo.setFill(grd);
    logo.setShadow(0, 10, '#9945ff', 0, true, true);
    logo.setScale(0.9).setAlpha(0);
    this.tweens.add({ targets: logo, scale: 1, alpha: 1, duration: 900, ease: 'Back.easeOut', delay: 250 });
    this.tweens.add({ targets: logo, y: 120, duration: 2400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: 1150 });
    const glint = this.add.image(-200, 112, 'glow').setBlendMode(Phaser.BlendModes.ADD).setScale(1.2, 3.4).setAlpha(0.5).setAngle(18);
    this.time.addEvent({
      delay: 4200, loop: true,
      callback: () => { glint.x = GAME_W / 2 - 340; this.tweens.add({ targets: glint, x: GAME_W / 2 + 340, duration: 900, ease: 'Sine.easeInOut' }); },
    });

    // --- prompt
    this.promptChip = this.add.container(0, 0).setAlpha(0);
    this.promptChip.add(panel(this, GAME_W / 2 - 130, 560, 260, 38, 'glass'));
    this.promptChip.add(text(this, GAME_W / 2, 565, 'PRESS ENTER', 24, '#2ef2a8', { fontStyle: 'bold' }).setOrigin(0.5, 0));
    this.tweens.add({ targets: this.promptChip, alpha: 1, duration: 500, delay: 900, onComplete: () => {
      this.tweens.add({ targets: this.promptChip, alpha: 0.45, duration: 700, yoyo: true, repeat: -1 });
    } });
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

  async openMenu() {
    const saved = hasSave();
    const items = saved ? [{ label: 'CONTINUE' }, { label: 'NEW GAME' }] : [{ label: 'NEW GAME' }];
    const h = saved ? 140 : 90;
    const i = await chooseFrom(this, {
      x: GAME_W / 2 - 160, y: GAME_H - 64 - h, w: 320, h, items, cancelable: false,
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
