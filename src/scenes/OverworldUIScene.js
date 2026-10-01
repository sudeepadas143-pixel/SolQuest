// Screen-space UI for the overworld: HUD (location, clock/weather, run timer,
// Elite badges, score), dialog, banners, pause menu, battle-entry wipes.
import Phaser from 'phaser';
import { GAME_W, GAME_H, MAX_LEVEL } from '../config.js';
import { ITEMS } from '../data/items.js';
import { TRAINERS, TRAINER_ORDER } from '../data/trainers.js';
import { MOVES } from '../data/moves.js';
import { getSave, writeSave, onSaved } from '../systems/save.js';
import { heal, maxHp, displayName, gainXp, xpForLevel, learnMove, pendingEvolution } from '../systems/creature.js';
import { trainerName } from '../systems/teams.js';
import { clock, formatClock, formatRun, weather, WEATHER_LABEL, isNight } from '../systems/world.js';
import { sfx, setMuted, isMuted } from '../systems/audio.js';
import { DialogBox } from '../ui/DialogBox.js';
import { chooseFrom } from '../ui/Menu.js';
import { showSummary } from '../ui/Summary.js';
import { panel, text } from '../ui/theme.js';
import { iconTexture, badgeTexture, C } from '../ui/skin.js';
import { domInput, yesNo, tapButton } from '../ui/helpers.js';
import { pushFocus, press } from '../systems/controls.js';
import { HINT_IDS, isLearned, allLearned, onLearned, learnAll } from '../systems/hints.js';

// phones / tablets have the on-screen pad (with its own MENU button)
const TOUCH = window.matchMedia?.('(pointer: coarse)').matches || 'ontouchstart' in window;
// the PC controls legend: [key, what it does]
const LEGEND = {
  move: ['WASD', 'Move'],
  run: ['SHIFT', 'Run (hold)'],
  use: ['ENTER', 'Talk / use'],
  menu: ['M', 'Menu'],
  click: ['CLICK', 'Walk there / use it'],
};
import { runEvolution } from './EvolutionScene.js';
import { openSettings } from '../ui/Settings.js';
import { validWallet } from './WalletScene.js';
import { WALLET_PROMPT } from '../data/dialogue.js';

export class OverworldUIScene extends Phaser.Scene {
  constructor() { super('OverworldUI'); }

  create() {
    this.box = new DialogBox(this, { x: 24, y: GAME_H - 164, w: GAME_W - 48, h: 144, size: 28 }).setVisible(false);

    // --- left: location + clock/weather chips
    this.locChip = this.add.container(0, 0).setDepth(900);
    this.locChip.add(panel(this, 16, 14, 330, 44, 'chip'));
    this.locChip.add(this.add.image(38, 36, iconTexture(this, 'pin', 22, C.coral)));
    this.locText = text(this, 58, 22, '', 22, '#fff7e6');
    this.locChip.add(this.locText);

    this.timeChip = this.add.container(0, 0).setDepth(900);
    this.timeChip.add(panel(this, 16, 66, 330, 40, 'chip'));
    this.dayIcon = this.add.image(38, 86, iconTexture(this, 'sun', 22, C.gold));
    this.clockText = text(this, 58, 74, '', 20, '#fff7e6');
    this.wxIcon = this.add.image(236, 86, iconTexture(this, 'sun', 22, C.gold));
    this.wxText = text(this, 254, 74, '', 18, '#a8acd6');
    this.timeChip.add([this.dayIcon, this.clockText, this.wxIcon, this.wxText]);

    // --- right: run timer, elite badges, score
    const rx = GAME_W - 266;
    this.runChip = this.add.container(0, 0).setDepth(900);
    this.runChip.add(panel(this, rx, 14, 250, 44, 'chip'));
    this.runChip.add(this.add.image(rx + 24, 36, iconTexture(this, 'clock', 22, C.mint)));
    this.runLabel = text(this, rx + 44, 23, 'RUN', 16, '#a8acd6');
    this.runText = text(this, rx + 236, 20, '0:00:00.0', 24, '#2ef2a8').setOrigin(1, 0);
    this.runChip.add([this.runLabel, this.runText]);

    this.badgeChip = this.add.container(0, 0).setDepth(900);
    this.badgeChip.add(panel(this, rx, 66, 250, 62, 'chip'));
    this.badges = [];
    this.scoreText = text(this, rx + 236, 134, '', 18, '#ffc94a').setOrigin(1, 0).setDepth(900);

    this.buildLegend();
    this.buildMenuButton();
    // a small "Saved" mark whenever the game saves (autosaves included)
    const offSaved = onSaved(() => this.savedMark());
    this.events.once('shutdown', offSaved);

    this.banner = this.add.container(0, -90).setDepth(1500);
    this.toast = this.add.container(0, 0).setDepth(1500);
    this.wipe = null;
    this.refreshHud();

    this.input.keyboard.on('keydown-N', () => {
      if (document.activeElement?.tagName === 'INPUT') return;
      this.toggleSound();
    });
  }

  update() {
    const s = getSave();
    if (!s) return;
    // ten minutes in, the controls are known either way
    if (this.legend && s.stats.playMs > 10 * 60 * 1000 && !allLearned()) learnAll();
    const ck = clock(s.stats.playMs);
    this.clockText.setText(`${formatClock(s.stats.playMs)}  ·  Day ${ck.day}`);
    const night = isNight(s.stats.playMs);
    this.dayIcon.setTexture(iconTexture(this, night ? 'moon' : 'sun', 22, night ? C.sky : C.gold));
    const w = weather(s.stats.playMs);
    const kind = w.kind === 'clear' ? (night ? 'moon' : 'sun') : w.kind;
    this.wxIcon.setTexture(iconTexture(this, kind, 22, w.kind === 'clear' ? (night ? C.sky : C.gold) : C.cream));
    this.wxText.setText(WEATHER_LABEL[w.kind]);
    const ms = s.run?.clearMs ?? s.run?.ms ?? 0;
    this.runText.setText(formatRun(ms)).setColor(s.run?.clearMs ? '#ffc94a' : '#2ef2a8');
    this.runLabel.setText(s.run?.clearMs ? 'CLEAR' : 'RUN');
  }

  toggleSound() {
    setMuted(!isMuted());
    this.showToast(isMuted() ? 'Sound off' : 'Sound on');
  }

  refreshHud() {
    const s = getSave();
    if (!s) return;
    this.badges.forEach((b) => b.destroy());
    const rx = GAME_W - 266;
    this.badges = TRAINER_ORDER.map((id, i) => {
      const design = s.teams[id]?.design;
      const boss = id === 'cooker';
      const key = badgeTexture(this, `trainer_${design}_battle`, 40, boss ? C.gold : C.mint, !!s.defeated[id]);
      const img = this.add.image(rx + 34 + i * 46, 97, key).setDepth(901);
      img.setInteractive().on('pointerover', () => this.showToast(`${trainerName(s.teams, id)}${s.defeated[id] ? ' - beaten' : ''}`));
      return img;
    });
    this.scoreText.setText(`SCORE ${s.score}`);
  }

  async say(lines, { speaker = null, banner = null, portrait = null } = {}) {
    const arr = Array.isArray(lines) ? lines : [lines];
    if (banner) this.showToast(banner, true);
    this.chrome(false);
    for (const l of arr) await this.box.say(l, { speaker, portrait });
    this.box.setVisible(false);
    this.box.clear();
    this.chrome(true);
  }

  savedMark() {
    if (!this.sys.isActive() || this.savedT?.isPlaying?.()) return;
    if (!this.saved) {
      const c = this.add.container(16, GAME_H - (TOUCH ? 34 : 92)).setDepth(890).setAlpha(0);
      const g = this.add.graphics();
      g.fillStyle(0x0b0d22, 0.55).fillRoundedRect(0, -13, 96, 26, 13);
      // a little floppy disk
      g.fillStyle(0x2ef2a8, 1).fillRoundedRect(10, -7, 14, 14, 2);
      g.fillStyle(0x0b0d22, 1).fillRect(13, -7, 8, 5);
      g.fillStyle(0xfff7e6, 1).fillRect(13, 2, 8, 4);
      c.add([g, text(this, 32, -10, 'Saved', 16, '#e9e4ff')]);
      this.saved = c;
    }
    this.tweens.killTweensOf(this.saved);
    this.saved.setAlpha(0);
    this.savedT = this.tweens.chain({ targets: this.saved, tweens: [{ alpha: 1, duration: 200 }, { alpha: 1, duration: 1000 }, { alpha: 0, duration: 400 }] });
  }

  /** The HUD chips fade away for cutscenes (the gate opening in the Hall). */
  hud(on) {
    const targets = [this.locChip, this.timeChip, this.runChip, this.badgeChip, this.scoreText, ...this.badges, this.legend, this.menuBtn].filter(Boolean);
    this.tweens.killTweensOf(targets);
    this.tweens.add({ targets, alpha: on ? 1 : 0, duration: on ? 400 : 300 });
  }

  /** The bottom-corner bits (legend, MENU button) step aside for the dialogue box. */
  chrome(on) {
    const targets = [this.legend, this.menuBtn].filter(Boolean);
    this.tweens.killTweensOf(targets);
    this.tweens.add({ targets, alpha: on ? 1 : 0, duration: on ? 260 : 120 });
  }

  /** PC only: a small key legend in the bottom-right corner. Each row leaves
   *  once the player has used that control a few times; the legend is gone
   *  when they know them all (remembered per browser, see systems/hints.js). */
  buildLegend() {
    if (TOUCH || allLearned()) return;
    this.legend = this.add.container(0, 0).setDepth(880);
    this.legendRows = {};
    for (const id of HINT_IDS) {
      if (isLearned(id)) continue;
      const [key, what] = LEGEND[id];
      const row = this.add.container(GAME_W - 16, 0);
      const label = text(this, 0, 0, what, 15, '#e9e4ff').setOrigin(1, 0.5).setAlpha(0.9);
      const cap = text(this, 0, 0, key, 13, '#fff7e6', { fontStyle: 'bold' }).setOrigin(0.5);
      const cw = Math.max(26, cap.width + 14);
      const capX = -label.width - 10 - cw / 2;
      cap.setX(capX);
      const g = this.add.graphics();
      // a soft dark pill behind the row keeps it readable on bright ground
      g.fillStyle(0x0b0d22, 0.42).fillRoundedRect(capX - cw / 2 - 6, -12, cw + label.width + 22, 24, 12);
      g.fillStyle(0x0b0d22, 0.62).fillRoundedRect(capX - cw / 2, -10, cw, 20, 5);
      g.lineStyle(1, 0xc9c2ff, 0.55).strokeRoundedRect(capX - cw / 2, -10, cw, 20, 5);
      g.fillStyle(0xc9c2ff, 0.35).fillRect(capX - cw / 2 + 3, 8, cw - 6, 1);      // the key's lip
      row.add([g, cap, label]);
      this.legend.add(row);
      this.legendRows[id] = row;
    }
    this.layoutLegend(false);
    this.legend.setAlpha(0);
    this.tweens.add({ targets: this.legend, alpha: 1, duration: 600, delay: 1200 });
    const off = onLearned((id) => {
      const row = this.legendRows?.[id];
      if (!row) return;
      delete this.legendRows[id];
      this.tweens.add({ targets: row, alpha: 0, x: row.x + 18, duration: 320, ease: 'Sine.easeIn', onComplete: () => row.destroy() });
      this.time.delayedCall(200, () => this.layoutLegend(true));
      if (!Object.keys(this.legendRows).length) this.time.delayedCall(400, () => { this.legend?.destroy(); this.legend = null; });
    });
    this.events.once('shutdown', off);
  }

  layoutLegend(animate) {
    const rows = HINT_IDS.map((id) => this.legendRows[id]).filter(Boolean);
    rows.forEach((row, i) => {
      const y = GAME_H - 24 - (rows.length - 1 - i) * 26;
      if (animate) this.tweens.add({ targets: row, y, duration: 260, ease: 'Sine.easeOut' });
      else row.setY(y);
    });
  }

  /** PC: a clickable MENU chip in the bottom-left corner (same as pressing M). */
  buildMenuButton() {
    if (TOUCH) return;
    const c = this.add.container(16, GAME_H - 54).setDepth(880);
    const bg = panel(this, 0, 0, 112, 38, 'chip');
    const g = this.add.graphics();
    g.fillStyle(0xfff7e6, 0.9);
    for (let i = 0; i < 3; i++) g.fillRoundedRect(16, 12 + i * 6, 16, 2.5, 1);       // the "hamburger"
    const t = text(this, 42, 7, 'MENU', 20, '#fff7e6', { fontStyle: 'bold' });
    const zone = this.add.zone(0, 0, 112, 38).setOrigin(0).setInteractive({ useHandCursor: true });
    zone.on('pointerover', () => bg.setTint(0xd8f8ec));
    zone.on('pointerout', () => bg.clearTint());
    zone.on('pointerdown', () => {
      this.tweens.add({ targets: c, scale: 0.95, duration: 60, yoyo: true });
      press('menu');
    });
    c.add([bg, g, t, zone]);
    this.menuBtn = c;
  }

  /** Cinematic framing for the Elite Hall walk: letterbox bars and a vignette. */
  cinema(on) {
    if (!this.bars) {
      if (!this.textures.exists('vignette')) {
        const t = this.textures.createCanvas('vignette', GAME_W, GAME_H);
        const ctx = t.getContext();
        const g = ctx.createRadialGradient(GAME_W / 2, GAME_H * 0.55, GAME_H * 0.28, GAME_W / 2, GAME_H * 0.55, GAME_W * 0.62);
        g.addColorStop(0, 'rgba(6,4,14,0)');
        g.addColorStop(0.6, 'rgba(6,4,14,0.45)');
        g.addColorStop(1, 'rgba(6,4,14,0.92)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, GAME_W, GAME_H);
        t.refresh();
      }
      this.vignette = this.add.image(0, 0, 'vignette').setOrigin(0).setDepth(840).setAlpha(0);
      this.bars = [
        this.add.rectangle(0, 0, GAME_W, 54, 0x05040a).setOrigin(0, 1).setDepth(850),
        this.add.rectangle(0, GAME_H, GAME_W, 54, 0x05040a).setOrigin(0, 0).setDepth(850),
      ];
      this.cinemaOn = false;
    }
    if (on === this.cinemaOn) return;
    this.cinemaOn = on;
    const [top, bottom] = this.bars;
    this.tweens.killTweensOf([top, bottom, this.vignette]);
    this.tweens.add({ targets: top, y: on ? 54 : 0, duration: 700, ease: 'Cubic.easeInOut' });
    this.tweens.add({ targets: bottom, y: on ? GAME_H - 54 : GAME_H, duration: 700, ease: 'Cubic.easeInOut' });
    this.tweens.add({ targets: this.vignette, alpha: on ? 1 : 0, duration: 900 });
  }

  /** Ask a question in the dialog box and pick an answer. Returns the index (-1 = cancelled). */
  async ask(question, options, { speaker = null, portrait = null } = {}) {
    this.box.say(question, { wait: false, speaker, portrait });
    const i = await chooseFrom(this, {
      x: GAME_W - 250, y: 290, w: 230, h: 40 + options.length * 45, items: options.map((label) => ({ label })), cancelable: true,
    });
    this.box.setVisible(false);
    this.box.clear();
    return i;
  }

  showToast(msg, star = false) {
    this.toast.removeAll(true);
    const w = Math.max(200, msg.length * 13 + 70);
    const x = (GAME_W - w) / 2;
    this.toast.add(panel(this, x, 150, w, 46, 'menu'));
    if (star) this.toast.add(this.add.image(x + 28, 173, iconTexture(this, 'star', 22, C.gold)));
    this.toast.add(text(this, x + (star ? 48 : 20), 161, msg, 22, '#fff7e6'));
    this.toast.setAlpha(0).y = -10;
    this.tweens.killTweensOf(this.toast);
    this.tweens.add({ targets: this.toast, alpha: 1, y: 0, duration: 200, ease: 'Back.easeOut', hold: 1400, yoyo: true });
  }

  showZone(name) {
    this.locText.setText(name);
    this.banner.removeAll(true);
    const w = Math.max(320, name.length * 18 + 90);
    const x = (GAME_W - w) / 2;
    this.banner.add(panel(this, x, 0, w, 64, 'glass'));
    this.banner.add(text(this, GAME_W / 2, 16, name.toUpperCase(), 28, '#fff7e6', { fontStyle: 'bold' }).setOrigin(0.5, 0));
    this.tweens.killTweensOf(this.banner);
    this.banner.y = -90;
    this.tweens.add({ targets: this.banner, y: 124, duration: 360, ease: 'Back.easeOut', hold: 1700, yoyo: true });
  }

  // ------------------------------------------------------------ battle wipes
  battleWipe(kind, done) {
    this.clearWipe();
    const g = this.add.graphics().setDepth(5000);
    this.wipe = g;
    sfx(kind === 'trainer' ? 'encounterTrainer' : 'encounter');
    const cols = [0x8b5cff, 0x2ef2a8, 0x12163a, 0xffc94a];
    const state = { t: 0, flash: 0 };
    const draw = () => {
      g.clear();
      if (state.flash > 0) g.fillStyle(0xffffff, state.flash).fillRect(0, 0, GAME_W, GAME_H);
      if (kind === 'trainer') {
        // two chevron walls closing from both sides
        const n = 7;
        for (let i = 0; i < n; i++) {
          const bw = GAME_W / 2 + 140;
          const off = (1 - Math.min(1, state.t * 1.2 - i * 0.03)) * (bw + 60);
          const y0 = (i * GAME_H) / n;
          const y1 = ((i + 1) * GAME_H) / n + 1;
          g.fillStyle(cols[i % 3], 1);
          g.fillPoints([{ x: -60 - off, y: y0 }, { x: bw - 60 - off, y: y0 }, { x: bw - 20 - off, y: (y0 + y1) / 2 }, { x: bw - 60 - off, y: y1 }, { x: -60 - off, y: y1 }], true);
          g.fillStyle(cols[(i + 1) % 3], 1);
          g.fillPoints([{ x: GAME_W + 60 + off, y: y0 }, { x: GAME_W - bw + 60 + off, y: y0 }, { x: GAME_W - bw + 20 + off, y: (y0 + y1) / 2 }, { x: GAME_W - bw + 60 + off, y: y1 }, { x: GAME_W + 60 + off, y: y1 }], true);
        }
      } else {
        // wild: a rotating pinwheel closes over the screen - twelve blades
        // widen while the whole wheel turns, leading edges lit in mint
        const cx = GAME_W / 2;
        const cy = GAME_H / 2;
        const R = Math.hypot(GAME_W, GAME_H) / 2 + 20;
        const n = 12;
        const span = (Math.PI * 2) / n;
        const rot = state.t * Math.PI * 1.1 - 0.4;
        const w = Math.min(1, state.t * 1.08) * span;
        for (let i = 0; i < n; i++) {
          const a0 = rot + i * span;
          g.fillStyle(i % 2 ? 0x12163a : 0x2a1c5a, 1);
          g.beginPath();
          g.moveTo(cx, cy);
          const steps = 6;
          for (let k = 0; k <= steps; k++) {
            const a = a0 + ((w + 0.004) * k) / steps;
            g.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
          }
          g.closePath();
          g.fillPath();
          if (w < span * 0.98) {
            g.lineStyle(3, 0x2ef2a8, 0.9);
            g.beginPath();
            g.moveTo(cx, cy);
            g.lineTo(cx + Math.cos(a0 + w) * R, cy + Math.sin(a0 + w) * R);
            g.strokePath();
          }
        }
        // a glowing core that swallows the centre last
        const core = Math.max(0, state.t - 0.55) / 0.45;
        if (core > 0) {
          g.fillStyle(0x0b0d17, 1).fillCircle(cx, cy, core * R);
          g.lineStyle(4, 0x8b5cff, 0.9 * (1 - core)).strokeCircle(cx, cy, core * R);
        }
      }
    };
    const out = kind === 'trainer'
      ? { t: 1, duration: 520, ease: 'Cubic.easeIn' }
      : { t: 1, duration: 720, ease: 'Sine.easeIn' };
    this.tweens.chain({
      targets: state,
      tweens: [
        { flash: 0.8, duration: 80, ease: 'Sine.easeOut', onUpdate: draw }, { flash: 0, duration: 120, ease: 'Sine.easeIn', onUpdate: draw },
        { flash: 0.8, duration: 80, ease: 'Sine.easeOut', onUpdate: draw }, { flash: 0, duration: 120, ease: 'Sine.easeIn', onUpdate: draw },
        { ...out, onUpdate: draw, onComplete: () => { draw(); this.time.delayedCall(120, done); } },
      ],
    });
  }

  clearWipe() {
    this.wipe?.destroy();
    this.wipe = null;
  }

  // -------------------------------------------------------------- pause menu
  async pauseMenu() {
    const s = getSave();
    let last = 0;
    for (;;) {
      const i = await chooseFrom(this, {
        x: GAME_W - 280, y: 150, w: 260, h: 380, start: last,
        items: [{ label: 'TEAM' }, { label: 'BAG' }, { label: 'PROFILE' }, { label: 'SETTINGS' }, { label: 'SAVE' }, { label: 'CLOSE' }],
      });
      if (i >= 0) last = i;
      if (i === 0) await showSummary(this, s.party[0]);
      else if (i === 1) await this.bagMenu();
      else if (i === 2) await this.profile();
      else if (i === 3) await openSettings(this);
      else if (i === 4) { writeSave(); sfx('save'); await this.say('Your progress was saved.'); }
      else return;
    }
  }

  async bagMenu() {
    const s = getSave();
    const ids = Object.keys(ITEMS).filter((k) => s.bag[k] > 0);
    if (!ids.length) { await this.say('Your bag is empty.'); return; }
    const i = await chooseFrom(this, {
      x: 60, y: 150, w: 580, h: 50 + ids.length * 70, rowH: 70,
      items: ids.map((k) => ({ label: `${ITEMS[k].name}  x${s.bag[k]}`, detail: ITEMS[k].desc })),
    });
    if (i < 0) return;
    const id = ids[i];
    const c = s.party[0];
    if (ITEMS[id].levelUp) { await this.useLevelGem(id); return; }
    if (c.hp >= maxHp(c)) { await this.say("It won't have any effect."); return; }
    s.bag[id] -= 1;
    const healed = heal(c, ITEMS[id].heal);
    writeSave();
    sfx('heal');
    await this.say(`${displayName(c).toUpperCase()} recovered ${healed} HP!`);
  }

  async useLevelGem(id) {
    const s = getSave();
    const c = s.party[0];
    if (c.level >= MAX_LEVEL) { await this.say("It won't have any effect."); return; }
    s.bag[id] -= 1;
    const name = () => displayName(c).toUpperCase();
    const ups = gainXp(c, xpForLevel(c.level + 1) - c.xp);
    sfx('levelup');
    for (const up of ups) {
      await this.say(`${name()} grew to Lv. ${up.level}!`, { banner: `Lv. ${up.level}` });
      if (up.healed) { sfx('heal'); await this.say(`${name()} was fully healed!`); }
      for (const mv of up.newMoves) await this.learn(c, mv);
    }
    if (pendingEvolution(c)) {
      await runEvolution(this, c);
      this.scene.get('Overworld').updateMusic?.(true);
    }
    writeSave();
    this.refreshHud();
  }

  async learn(c, moveId) {
    const n = displayName(c).toUpperCase();
    const mv = MOVES[moveId].name.toUpperCase();
    if (c.moves.length < 4) { learnMove(c, moveId); sfx('item'); await this.say(`${n} learned ${mv}!`); return; }
    await this.say(`${n} wants to learn ${mv}, but already knows four moves.`);
    this.box.say('Forget a move to make room?', { wait: false });
    if (await yesNo(this, { x: GAME_W - 220, y: 300 })) {
      const i = await chooseFrom(this, { x: 200, y: 150, w: 560, h: 300, items: c.moves.map((m) => ({ label: MOVES[m.id].name })) });
      if (i >= 0) {
        const old = MOVES[c.moves[i].id].name.toUpperCase();
        learnMove(c, moveId, i);
        await this.say(`${n} forgot ${old} and learned ${mv}!`);
        return;
      }
    }
    await this.say(`${n} did not learn ${mv}.`);
  }

  async profile() {
    const s = getSave();
    const objs = [];
    const add = (o) => { o.setDepth(1401); objs.push(o); return o; };
    add(panel(this, 40, 30, 880, 580, 'gold'));
    const t = (x, y, str, size = 24, color = '#fff7e6', extra = {}) => add(text(this, x, y, str, size, color, extra));
    t(80, 60, 'TRAINER PROFILE', 32, '#ffc94a', { fontStyle: 'bold' });
    t(80, 110, `Name: ${s.player.name}`);
    t(520, 110, `Run: ${formatRun(s.run.clearMs ?? s.run.ms)}${s.run.clearMs ? '  (CLEARED)' : ''}`, 24, s.run.clearMs ? '#ffc94a' : '#2ef2a8');
    t(80, 150, 'Payout wallet:', 20, '#a8acd6');
    t(80, 176, s.player.wallet || '(none - add one with EDIT WALLET)', 20, s.player.wallet ? '#2ef2a8' : '#ff6b7a', { wordWrap: { width: 800, useAdvancedWrap: true } });
    t(80, 240, `SCORE: ${s.score}`, 28, '#ffc94a');
    TRAINER_ORDER.forEach((id, i) => {
      const d = s.defeated[id];
      t(80 + (i % 2) * 420, 290 + Math.floor(i / 2) * 40, `${d ? '✔' : '·'} ${trainerName(s.teams, id)}  ${d ? `+${TRAINERS[id].points}` : ''}`, 24, d ? '#fff7e6' : '#6b6f90');
    });
    t(80, 420, `Wild wins: ${s.stats.wildWins}   Battles: ${s.stats.battles}   Items found: ${s.pickedItems.length}`, 20, '#a8acd6');
    const i = await chooseFrom(this, {
      x: 520, y: 480, w: 380, h: 110, columns: 2, items: [{ label: 'EDIT WALLET' }, { label: 'BACK' }], size: 22, depth: 1402,
    });
    objs.forEach((o) => o.destroy());
    if (i === 0) await this.editWallet();
  }

  /** Edit the payout wallet. required: no CANCEL (a save from before wallets
   *  were mandatory has to add one before playing on). */
  editWallet({ required = false } = {}) {
    const s = getSave();
    return new Promise((resolve) => {
      const bg = panel(this, 60, 150, 840, 300, 'gold').setDepth(1400);
      const lbl = text(this, GAME_W / 2, 180, WALLET_PROMPT, 22, '#fff7e6', { wordWrap: { width: 760 }, align: 'center' }).setOrigin(0.5, 0).setDepth(1401);
      const err = text(this, GAME_W / 2, 350, '', 18, '#a8acd6').setOrigin(0.5).setDepth(1401);
      const inp = domInput(this, GAME_W / 2, 290, { width: 720, maxLength: 128 });
      inp.el.value = s.player.wallet;
      inp.el.style.fontSize = '22px';
      let release = () => {};
      const btns = [];
      const close = () => { release(); inp.destroy(); bg.destroy(); lbl.destroy(); err.destroy(); btns.forEach((b) => b.destroy()); resolve(); };
      const save = () => {
        const v = inp.value().trim();
        if (!validWallet(v)) { sfx('bump'); err.setText(v ? 'That address looks invalid (no spaces, 4-128 characters).' : 'A wallet address is required.').setColor('#ff6b7a'); return; }
        s.player.wallet = v;
        writeSave();
        close();
      };
      // tappable buttons + the touch pad's A/B for phones
      const cancel = () => { if (!required) close(); };
      if (required) {
        btns.push(tapButton(this, GAME_W / 2, 405, 'SAVE', save, { w: 240, h: 50, depth: 1402 }));
        err.setText('A wallet address is required to keep playing.');
      } else {
        btns.push(tapButton(this, GAME_W / 2 - 120, 405, 'SAVE', save, { w: 200, h: 50, depth: 1402 }));
        btns.push(tapButton(this, GAME_W / 2 + 120, 405, 'CANCEL', close, { w: 200, h: 50, depth: 1402, style: 'chip', color: '#fff7e6' }));
      }
      release = pushFocus((a) => { if (a === 'confirm') save(); if (a === 'cancel') cancel(); }, this);
      inp.el.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') { e.preventDefault(); cancel(); }
        if (e.key === 'Enter') { e.preventDefault(); save(); }
      });
    });
  }
}
