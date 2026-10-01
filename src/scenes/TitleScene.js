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
import { openSettings } from '../ui/Settings.js';
import { communityStrip, openCommunity } from '../ui/Community.js';

const VIDEO = `${import.meta.env.BASE_URL}assets/title/drone`;

export class TitleScene extends Phaser.Scene {
  constructor() { super('Title'); }

  create() {
    this.cameras.main.fadeIn(900);

    // --- the world: poster frame now, the drone flight as soon as it streams in
    this.add.image(GAME_W / 2, GAME_H / 2, 'title_poster');
    this.flight = this.add.video(GAME_W / 2, GAME_H / 2).setAlpha(0);
    // H.264 for Safari / iOS, VP9 for browsers without H.264; muted so it autoplays everywhere
    this.flight.loadURL([`${VIDEO}.mp4`, `${VIDEO}.webm`], true);
    this.flight.play(true);
    // fade in once frames are actually advancing (a cached video can start
    // before Phaser's own 'playing' listener is attached, so don't wait on it)
    const fadeIn = this.time.addEvent({
      delay: 100, loop: true,
      callback: () => {
        const el = this.flight.video;
        if (!el || el.paused || el.currentTime <= 0) return;
        fadeIn.remove();
        this.tweens.add({ targets: this.flight, alpha: 1, duration: 700 });
      },
    });
    this.events.once('shutdown', () => this.flight?.stop());
    // the theme is written to the footage (one 44.8 s loop each): lock the
    // music to the video's clock while it plays
    music('title', {
      sync: () => {
        const el = this.flight?.video;
        return el && !el.paused && el.currentTime > 0 ? el.currentTime : null;
      },
    });

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
    const touch = window.matchMedia?.('(pointer: coarse)').matches;
    const prompt = touch ? 'TAP TO START' : 'CLICK OR PRESS ENTER';
    const pw = touch ? 260 : 340;
    this.promptChip.add(panel(this, GAME_W / 2 - pw / 2, 560, pw, 38, 'glass'));
    this.promptChip.add(text(this, GAME_W / 2, 565, prompt, 24, '#2ef2a8', { fontStyle: 'bold' }).setOrigin(0.5, 0));
    this.tweens.add({ targets: this.promptChip, alpha: 1, duration: 500, delay: 900, onComplete: () => {
      this.tweens.add({ targets: this.promptChip, alpha: 0.45, duration: 700, yoyo: true, repeat: -1 });
    } });
    text(this, GAME_W - 16, GAME_H - 22, 'N: sound on/off', 14, '#fff7e6').setOrigin(1, 0).setAlpha(0.6);
    // X and the contract address, always one click away
    this.strip = communityStrip(this);

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
    const items = [
      ...(saved ? [{ label: 'CONTINUE' }] : []),
      { label: 'NEW GAME' }, { label: 'LEADERBOARD' }, { label: 'EARNINGS' }, { label: 'COMMUNITY' }, { label: 'SETTINGS' },
    ];
    const h = 40 + items.length * 44;
    const i = await chooseFrom(this, {
      x: GAME_W / 2 - 160, y: GAME_H - 64 - h, w: 320, h, items, cancelable: false, size: 24, start: this.menuIndex ?? 0,
    });
    const choice = items[i].label;
    this.menuIndex = i;
    if (choice === 'SETTINGS') { await openSettings(this); this.openMenu(); return; }
    if (choice === 'COMMUNITY') { await openCommunity(this); this.openMenu(); return; }
    this.strip.setLinksActive(false);   // nothing else on the title should take clicks now
    if (choice === 'LEADERBOARD' || choice === 'EARNINGS') {
      // the boards open over the title (the footage keeps playing behind)
      const key = choice === 'LEADERBOARD' ? 'Leaderboard' : 'Earnings';
      this.input.enabled = false;
      this.scene.launch(key, { from: 'Title' });
      this.scene.get(key).events.once('shutdown', () => {
        this.input.enabled = true;
        this.strip.setLinksActive(true);
        this.openMenu();
      });
      return;
    }
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
