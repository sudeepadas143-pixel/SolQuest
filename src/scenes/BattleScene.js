// Battle screen. All rules live in systems/battle.js; this scene renders the
// events it returns, in the SolQuest house style:
//
//   opponent plate (top-left)             opponent on platform (top-right, front, 2x)
//   player creature on platform (bottom-left, back view, 3x - forced perspective)
//                                          player plate (right): name, Lv, HP, XX/YY, EXP
//   [ narration box ........................ ][ FIGHT / BAG / TEAM / RUN ]
//
// Backdrops follow the overworld clock (dawn/day/dusk/night) and weather.
import Phaser from 'phaser';
import { GAME_W, GAME_H, HD, ART_SCALE, TILE_W, TILE_H } from '../config.js';

// Creature sprite display scales (fronts are 2x-density art, backs 3x): the
// on-screen sizes match the classic 2x front / 3x back layout at 1 texel = 1px.
const FOE_S = 2 / HD.front;
const ME_S = 3 / HD.back;
import { SPECIES } from '../data/creatures.js';
import { MOVES } from '../data/moves.js';
import { ITEMS } from '../data/items.js';
import { TRAINERS } from '../data/trainers.js';
import { TYPE_COLORS } from '../data/types.js';
import { typeIcon } from '../ui/typeIcons.js';
import tilesMeta from '../data/tiles.json' with { type: 'json' };
import { BattleEngine } from '../systems/battle.js';
import { calcStats, displayName, xpForLevel, pendingEvolution, learnMove, STAT_KEYS, STAT_LABELS } from '../systems/creature.js';
import { getSave, writeSave } from '../systems/save.js';
import { trainerName } from '../systems/teams.js';
import { clock, weather } from '../systems/world.js';
import { sfx, music } from '../systems/audio.js';
import { trainerArt } from '../ui/trainerArt.js';
import { personality } from '../data/personalities.js';
import { coaching } from '../systems/advice.js';
import { runEvolution } from './EvolutionScene.js';
import { looseRng } from '../systems/rng.js';
import { pushFocus } from '../systems/controls.js';
import { DialogBox } from '../ui/DialogBox.js';
import { chooseFrom } from '../ui/Menu.js';
import { HpBar } from '../ui/HpBar.js';
import { showSummary } from '../ui/Summary.js';
import { panel, text, COLORS, hex } from '../ui/theme.js';
import { buttonTexture, panelTexture, C } from '../ui/skin.js';
import { wait, tween, yesNo } from '../ui/helpers.js';

const FOE_PLAT = { x: 715, y: 262 };
const ME_PLAT = { x: 235, y: 462 };
const BOTTOM_Y = 468;
const SKY = {
  dawn: [0xf7b7a3, 0xfde6c8], day: [0x86cdf3, 0xe9f7f5], dusk: [0xf08a6a, 0x6d5aa8], night: [0x0c1434, 0x2b3066],
};
const GROUND = {
  dawn: [0xb9d88c, 0x7fae62], day: [0xb4e08a, 0x7fbf60], dusk: [0x9fae7a, 0x5f7a58], night: [0x3e5a52, 0x223a3a],
};
const COMMANDS = [
  { label: 'FIGHT', color: C.coral, icon: 'fight' },
  { label: 'BAG', color: C.gold, icon: 'bag' },
  { label: 'TEAM', color: C.mint, icon: 'team' },
  { label: 'RUN', color: C.sky, icon: 'run' },
];

export class BattleScene extends Phaser.Scene {
  constructor() { super('Battle'); }

  init(cfg) { this.cfg = cfg; }

  async create() {
    const cfg = this.cfg;
    this.save = getSave();
    this.me = this.save.party[0];
    this.foes = cfg.foes;
    this.trainerDef = cfg.kind === 'trainer' ? TRAINERS[cfg.trainerId] : null;
    this.boss = !!this.trainerDef?.boss;
    this.tName = this.trainerDef ? trainerName(this.save.teams, cfg.trainerId) : '';
    this.design = this.trainerDef ? this.save.teams[cfg.trainerId].design : null;
    this.voice = this.trainerDef ? personality(this.design) : null;
    this.engine = new BattleEngine({
      player: this.me, foes: this.foes, kind: cfg.kind,
      ai: this.boss ? 'boss' : cfg.kind === 'trainer' ? 'trainer' : 'wild',
      bag: this.save.bag, rng: looseRng, trainerName: this.tName,
    });
    const ck = clock(this.save.stats.playMs);
    this.phase = ck.phase;
    this.wx = weather(this.save.stats.playMs);

    this.cameras.main.fadeIn(250);
    this.drawBackground();
    this.buildStage();
    this.buildInfoBoxes();
    this.dialog = new DialogBox(this, { x: 16, y: BOTTOM_Y, w: GAME_W - 32, h: 158, size: 30 });
    this.dialog.clear();
    this.prompt = new DialogBox(this, { x: 16, y: BOTTOM_Y, w: GAME_W - 350, h: 158, size: 30 }).setVisible(false);

    // curtain: the screen opens from the middle
    if (!this.trainerDef) {
      this.foeGroup.x = -300;
      this.meGroup.x = GAME_W + 300;
      this.foeSprite.setTintFill(0x1c2030);
      const top = this.add.rectangle(0, 0, GAME_W, GAME_H / 2, 0x0b0d17).setOrigin(0).setDepth(7000);
      const bot = this.add.rectangle(0, GAME_H / 2, GAME_W, GAME_H / 2, 0x0b0d17).setOrigin(0).setDepth(7000);
      const seam = this.add.rectangle(0, GAME_H / 2 - 2, GAME_W, 4, 0x2ef2a8).setOrigin(0).setDepth(7001);
      this.tweens.add({ targets: seam, scaleX: { from: 0, to: 1 }, duration: 160 });
      await wait(this, 170);
      this.tweens.add({ targets: seam, alpha: 0, duration: 200 });
      await Promise.all([
        tween(this, { targets: top, y: -GAME_H / 2, duration: 420, ease: 'Cubic.easeInOut' }),
        tween(this, { targets: bot, y: GAME_H, duration: 420, ease: 'Cubic.easeInOut' }),
      ]);
      top.destroy(); bot.destroy(); seam.destroy();
    }
    if (this.trainerDef) await this.vsSplash();
    await this.intro();
    while (!this.engine.over) {
      const action = await this.chooseAction();
      const events = this.engine.turn(action);
      await this.play(events);
    }
    await this.outro();
  }

  // ---------------------------------------------------------------- building
  drawBackground() {
    const g = this.add.graphics().setDepth(0);
    g.fillStyle(0x0c1024, 1).fillRect(0, BOTTOM_Y - 20, GAME_W, GAME_H - BOTTOM_Y + 20);   // nothing shows through under the dialog
    if (this.boss) {
      this.drawThroneRoom(g);
      return;
    }
    const sky = SKY[this.phase];
    const gr = GROUND[this.phase];
    g.fillGradientStyle(sky[0], sky[0], sky[1], sky[1], 1).fillRect(0, 0, GAME_W, 300);
    if (this.phase === 'night') {
      for (let i = 0; i < 70; i++) g.fillStyle(0xffffff, Phaser.Math.FloatBetween(0.3, 0.9)).fillRect(Phaser.Math.Between(0, GAME_W), Phaser.Math.Between(0, 240), 2, 2);
      g.fillStyle(0xfff4d6, 1).fillCircle(820, 70, 26);
      g.fillStyle(sky[0], 1).fillCircle(832, 62, 22);
    } else {
      const sun = this.phase === 'day' ? 0xfff6c8 : 0xffd08a;
      g.fillStyle(sun, 0.35).fillCircle(820, 80, 60);
      g.fillStyle(sun, 1).fillCircle(820, 80, 30);
      g.fillStyle(0xffffff, this.phase === 'day' ? 0.85 : 0.5).fillEllipse(150, 70, 150, 34).fillEllipse(212, 60, 116, 30).fillEllipse(640, 110, 160, 32);
    }
    // distant hills
    g.fillStyle(shadeInt(gr[0], -0.18), 1).fillEllipse(180, 300, 560, 130).fillEllipse(700, 296, 700, 120);
    g.fillGradientStyle(gr[0], gr[0], gr[1], gr[1], 1).fillRect(0, 300, GAME_W, BOTTOM_Y - 300);
    // a line of the same 3D trees as the overworld, hazed by distance
    const haze = { day: 0xc4dcc8, dawn: 0xe0c8c0, dusk: 0xd8b0a0, night: 0x6a78a0 }[this.phase] ?? 0xc4dcc8;
    const near = { day: 0xffffff, dawn: 0xf4e0d8, dusk: 0xf0c8b0, night: 0x8a96c8 }[this.phase] ?? 0xffffff;
    const kinds = ['tree', 'tree2', 'tree', 'tree2', 'tree'];
    for (let i = 0, x = -30; x < GAME_W + 40; i++, x += 38 + ((i * 17) % 14)) {
      this.add.image(x, 304 + ((i * 7) % 5), kinds[i % 5]).setOrigin(0.5, 1).setScale(0.36 + ((i * 13) % 5) * 0.02)
        .setTint(haze).setDepth(0.2);
    }
    for (let i = 0, x = -10; x < GAME_W + 40; i++, x += 64 + ((i * 29) % 40)) {
      this.add.image(x, 318, i % 3 ? 'bush' : kinds[(i + 2) % 5]).setOrigin(0.5, 1).setScale(i % 3 ? 0.55 : 0.5)
        .setTint(shadeInt(near, -0.08)).setDepth(0.25);
    }
    // the field: real grass texture (same tile as the overworld), then tufts
    if (!this.textures.exists('battle_grass')) {
      const src = this.textures.get('tileset').getSourceImage();
      const tw = TILE_W * ART_SCALE;
      const th = TILE_H * ART_SCALE;
      const cv = this.textures.createCanvas('battle_grass', tw, th);
      cv.context.drawImage(src, tilesMeta.tiles.grass.index * tw, 0, tw, th, 0, 0, tw, th);
      cv.refresh();
    }
    this.add.tileSprite(0, 312, GAME_W, BOTTOM_Y - 312, 'battle_grass').setOrigin(0).setTint(near).setDepth(0.3);
    const fade = this.add.graphics().setDepth(0.31);
    const fa = this.phase === 'night' ? 0.25 : 0.45;
    fade.fillGradientStyle(haze, haze, haze, haze, fa, fa, 0, 0).fillRect(0, 312, GAME_W, 60);
    for (let i = 0; i < 22; i++) {
      const x = (i * 211) % GAME_W;
      const y = 340 + ((i * 97) % (BOTTOM_Y - 350));
      this.add.image(x, y, `clump${i % 3}`).setOrigin(0.5, 1).setScale(0.8 + (y - 340) / 300).setTint(near).setDepth(0.35);
    }
    // weather
    const wet = this.wx.kind === 'rain' || this.wx.kind === 'storm' ? this.wx.intensity : 0;
    if (this.wx.kind !== 'clear') {
      g.fillStyle(0x3a4460, 0.18 * this.wx.intensity + (this.wx.kind === 'storm' ? 0.14 : 0)).fillRect(0, 0, GAME_W, BOTTOM_Y);
    }
    if (wet > 0.05) {
      this.add.particles(0, 0, 'raindrop', {
        x: { min: -100, max: GAME_W + 40 }, y: -20, speedY: { min: 1000, max: 1200 }, speedX: 200,
        lifespan: 600, rotate: -11, alpha: { start: 0.6, end: 0.2 }, quantity: Math.round(wet * 4), frequency: 16,
      }).setDepth(4.5);
      if (this.wx.kind === 'storm') {
        const f = this.add.rectangle(0, 0, GAME_W, GAME_H, 0xf4f8ff).setOrigin(0).setAlpha(0).setDepth(4.6);
        this.time.addEvent({
          delay: 4200, loop: true, callback: () => {
            this.tweens.chain({ targets: f, tweens: [{ alpha: 0.6, duration: 50 }, { alpha: 0, duration: 380 }] });
            this.time.delayedCall(400, () => sfx('thunder'));
          },
        });
      }
    }
  }

  /** Cooker's arena: the Elite Hall itself - a violet-and-gold throne room
   *  with an arched window of Sol light, shafts falling across a perspective
   *  marble floor, a colonnade, banners and burning braziers. */
  drawThroneRoom(g) {
    const H0 = 250;                                   // where the back wall meets the floor
    const VX = GAME_W / 2;
    const VY = 110;                                   // vanishing point
    // back wall
    g.fillGradientStyle(0x160c30, 0x160c30, 0x2e1a5c, 0x2e1a5c, 1).fillRect(0, 0, GAME_W, H0);
    for (let x = 0; x < GAME_W; x += 120) {
      g.fillStyle(0x221447, 1).fillRect(x + 8, 46, 104, H0 - 70);
      g.lineStyle(2, 0xecbc48, 0.5).strokeRect(x + 8, 46, 104, H0 - 70);
    }
    g.fillStyle(0xecbc48, 1).fillRect(0, 30, GAME_W, 6);
    g.fillStyle(0x0e0822, 1).fillRect(0, 0, GAME_W, 30);
    g.fillStyle(0x1a1036, 1).fillRect(0, H0 - 22, GAME_W, 22);
    g.fillStyle(0xecbc48, 1).fillRect(0, H0 - 24, GAME_W, 3);
    // arched window of Sol light
    const wx = VX;
    const ww = 180;
    const wt = 50;
    const wb = H0 - 30;
    const win = this.add.graphics().setDepth(0.05);
    win.fillStyle(0xecbc48, 1).fillRoundedRect(wx - ww / 2 - 8, wt - 8, ww + 16, wb - wt + 16, { tl: ww / 2 + 8, tr: ww / 2 + 8, bl: 4, br: 4 });
    win.fillGradientStyle(0x9945ff, 0x9945ff, 0x14f195, 0x14f195, 1);
    win.fillRoundedRect(wx - ww / 2, wt, ww, wb - wt, { tl: ww / 2, tr: ww / 2, bl: 2, br: 2 });
    win.lineStyle(3, 0x2a1c5a, 0.9);
    for (let k = 1; k < 4; k++) win.lineBetween(wx - ww / 2 + (ww * k) / 4, wt + 30, wx - ww / 2 + (ww * k) / 4, wb);
    for (let k = 1; k < 5; k++) win.lineBetween(wx - ww / 2, wt + ((wb - wt) * k) / 5, wx + ww / 2, wt + ((wb - wt) * k) / 5);
    for (const k of [-22, 0, 22]) {
      win.fillStyle(0xfdfbff, 0.95).fillPoints([{ x: wx - 44, y: 140 + k + 7 }, { x: wx + 30, y: 140 + k + 7 }, { x: wx + 44, y: 140 + k - 7 }, { x: wx - 30, y: 140 + k - 7 }], true);
    }
    const halo = this.add.image(wx, 140, 'glow').setBlendMode(Phaser.BlendModes.ADD).setScale(4.5).setAlpha(0.35).setTint(0xb89cff).setDepth(0.06);
    this.tweens.add({ targets: halo, alpha: 0.5, duration: 2200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    // perspective marble floor
    const floor = this.add.graphics().setDepth(0.1);
    const rows = [];
    for (let y = H0, h = 10; y < GAME_H; y += h, h *= 1.28) rows.push([y, Math.min(GAME_H, y + h)]);
    const xs = [];
    for (let x = -1400; x <= GAME_W + 1400; x += 150) xs.push(x);
    const at = (xb, y) => VX + (xb - VX) * ((y - VY) / (GAME_H - VY));
    rows.forEach(([y0, y1], r) => {
      const fog = 1 - (1 - r / rows.length) * 0.45;
      for (let i = 0; i < xs.length - 1; i++) {
        const light = (i + r) % 2 === 0;
        const col = light ? 0xd8d0ea : 0xaea2cc;
        floor.fillStyle(shadeInt(col, -(1 - fog) * 0.6), 1);
        floor.fillPoints([{ x: at(xs[i], y0), y: y0 }, { x: at(xs[i + 1], y0), y: y0 }, { x: at(xs[i + 1], y1), y: y1 }, { x: at(xs[i], y1), y: y1 }], true);
      }
    });
    // the carpet down the middle, gold-edged
    const cx0 = VX - 60;
    const cx1 = VX + 60;
    floor.fillStyle(0xecbc48, 1).fillPoints([{ x: at(cx0 - 12, H0), y: H0 }, { x: at(cx1 + 12, H0), y: H0 }, { x: at(cx1 + 12, GAME_H), y: GAME_H }, { x: at(cx0 - 12, GAME_H), y: GAME_H }], true);
    floor.fillStyle(0xa8223a, 1).fillPoints([{ x: at(cx0, H0), y: H0 }, { x: at(cx1, H0), y: H0 }, { x: at(cx1, GAME_H), y: GAME_H }, { x: at(cx0, GAME_H), y: GAME_H }], true);
    // light shafts from the window, and its reflection on the marble
    const shafts = this.add.graphics().setBlendMode(Phaser.BlendModes.ADD).setDepth(0.2);
    shafts.fillStyle(0xb89cff, 0.07).fillPoints([{ x: wx - 70, y: wt + 40 }, { x: wx + 10, y: wt + 40 }, { x: wx - 60, y: GAME_H }, { x: wx - 330, y: GAME_H }], true);
    shafts.fillStyle(0x7dffd0, 0.06).fillPoints([{ x: wx + 10, y: wt + 40 }, { x: wx + 80, y: wt + 40 }, { x: wx + 330, y: GAME_H }, { x: wx + 60, y: GAME_H }], true);
    this.tweens.add({ targets: shafts, alpha: 0.6, duration: 2600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    const refl = this.add.image(wx, H0 + 40, 'glow').setBlendMode(Phaser.BlendModes.ADD).setScale(3.2, 1.1).setAlpha(0.3).setTint(0x9dffd8).setDepth(0.15);
    this.tweens.add({ targets: refl, alpha: 0.18, duration: 2200, yoyo: true, repeat: -1 });
    // colonnade: back pair against the wall, big front pair framing the view
    for (const [x, y, sc, tint] of [[150, H0 + 8, 0.95, 0x9c90c4], [GAME_W - 150, H0 + 8, 0.95, 0x9c90c4], [36, 360, 1.55, 0x7a6ea8], [GAME_W - 36, 360, 1.55, 0x7a6ea8]]) {
      this.add.image(x, y, 'pillar').setOrigin(0.3, 0.97).setScale(sc).setTint(tint).setDepth(sc > 1 ? 1.8 : 0.3);
    }
    for (const x of [300, GAME_W - 300]) this.add.image(x, H0 - 20, 'banner').setOrigin(0.5, 1).setScale(1.3).setDepth(0.25);
    // braziers, burning, with embers drifting up
    for (const x of [262, GAME_W - 262]) {
      this.add.image(x, H0 + 30, 'brazier').setOrigin(0.5, 0.95).setScale(1.1).setDepth(0.4);
      const fl = this.add.image(x, H0 - 44, 'glow').setBlendMode(Phaser.BlendModes.ADD).setScale(1.6).setTint(0xff9a3a).setDepth(0.45);
      this.tweens.add({ targets: fl, scale: 1.9, alpha: 0.75, duration: 180, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      this.add.particles(x, H0 - 50, 'spark', {
        x: { min: -10, max: 10 }, speedY: { min: -60, max: -25 }, speedX: { min: -12, max: 12 },
        lifespan: 1600, scale: { start: 0.12, end: 0 }, alpha: { start: 0.9, end: 0 },
        tint: [0xffd36a, 0xff9a3a], blendMode: 'ADD', frequency: 140,
      }).setDepth(0.46);
    }
    // dust motes in the light
    this.add.particles(0, 0, 'spark', {
      x: { min: 200, max: GAME_W - 200 }, y: { min: 60, max: GAME_H - 80 }, speedY: { min: -6, max: 6 }, speedX: { min: -8, max: 8 },
      lifespan: 4000, scale: { start: 0.05, end: 0.08 }, alpha: { start: 0, end: 0.6, ease: 'Sine.easeInOut' },
      tint: [0xffffff, 0xb89cff, 0x9dffd8], blendMode: 'ADD', frequency: 180,
    }).setDepth(0.5);
  }

  /** 3D-rendered platform (tools/props3d.py build_battle); anchor = centre of its top face. */
  platform(which) {
    const key = `plat_${which}${this.boss ? '_boss' : ''}`;
    const m = tilesMeta.props[key];
    const img = this.add.image(0, 0, key).setOrigin(m.ax / m.w, m.ay / m.h).setScale(1 / ART_SCALE);
    if (!this.boss && this.phase === 'night') img.setTint(0x8a96c8);
    else if (!this.boss && this.phase === 'dusk') img.setTint(0xe8c0a8);
    return img;
  }

  buildStage() {
    const nightTint = this.boss ? null : this.phase === 'night' ? 0xb0b8e0 : this.phase === 'dusk' ? 0xf4d8c8 : null;
    this.foeGroup = this.add.container(FOE_PLAT.x, FOE_PLAT.y).setDepth(2);
    this.foeGroup.add(this.platform('foe'));
    this.foeShadow = this.add.ellipse(0, 4, 130, 22, 0x0b1020, 0.25);
    this.foeGroup.add(this.foeShadow);
    this.foeSprite = this.add.image(0, 8, SPECIES[this.engine.foe.species].front).setOrigin(0.5, 1).setScale(FOE_S);
    if (nightTint) this.foeSprite.setTint(nightTint);
    this.foeGroup.add(this.foeSprite);
    if (this.trainerDef) {
      const art = trainerArt(this.save.teams[this.cfg.trainerId].design).battle;
      this.trainerSprite = this.add.image(0, 10, art.key).setOrigin(0.5, 1).setScale(art.scale);
      this.foeGroup.add(this.trainerSprite);
      this.foeSprite.setVisible(false);
    }
    this.meGroup = this.add.container(ME_PLAT.x, ME_PLAT.y).setDepth(3);
    this.meGroup.add(this.platform('me'));
    this.meSprite = this.add.image(0, 44, SPECIES[this.me.species].back).setOrigin(0.5, 1).setScale(ME_S).setVisible(false);
    if (nightTint) this.meSprite.setTint(nightTint);
    this.meGroup.add(this.meSprite);
    this.nightTint = nightTint;
  }

  plate(x, y, w, h, species) {
    const type = SPECIES[species].types[0];
    const accent = hex(TYPE_COLORS[type] ?? 0x888888);
    return panel(this, x, y, w, h, 'plate', { skew: 12, accent });
  }

  buildInfoBoxes() {
    const ink = '#12163a';
    // opponent
    this.foeBox = this.add.container(0, 0).setDepth(5).setAlpha(0);
    this.foePlate = this.plate(26, 26, 390, 100, this.engine.foe.species);
    this.foeName = text(this, 58, 36, '', 30, ink, { fontStyle: 'bold' });
    this.foeLvBg = this.add.graphics();
    this.foeLv = text(this, 384, 40, '', 20, '#fff7e6').setOrigin(1, 0);
    const fl = text(this, 132, 80, 'HP', 18, '#ffc94a', { fontStyle: 'bold', stroke: ink, strokeThickness: 4 });
    this.foeHp = new HpBar(this, 170, 86, 214, 12);
    // element symbols: its types on the plate, what it's weak to on a strip below
    this.foeTypes = this.add.container(0, 0);
    this.foeTypesFor = null;       // (the scene object is reused between battles)
    this.meTypesFor = null;
    this.foeBox.add([this.foePlate, this.foeLvBg, this.foeName, this.foeLv, fl, this.foeHp.g, this.foeTypes]);
    // player
    this.meBox = this.add.container(0, 0).setDepth(5).setAlpha(0);
    this.mePlate = this.plate(544, 310, 396, 142, this.me.species);
    this.meName = text(this, 576, 320, '', 30, ink, { fontStyle: 'bold' });
    this.meLvBg = this.add.graphics();
    this.meLv = text(this, 912, 324, '', 20, '#fff7e6').setOrigin(1, 0);
    const ml = text(this, 648, 364, 'HP', 18, '#ffc94a', { fontStyle: 'bold', stroke: ink, strokeThickness: 4 });
    this.meHp = new HpBar(this, 688, 370, 224, 12);
    this.meHpText = text(this, 912, 388, '', 24, ink).setOrigin(1, 0);
    const xl = text(this, 576, 418, 'EXP', 15, '#3a7fd0', { fontStyle: 'bold' });
    this.meXp = new HpBar(this, 624, 424, 288, 6, { color: COLORS.xp, ticks: false });
    this.meTypes = this.add.container(0, 0);
    this.meBox.add([this.mePlate, this.meLvBg, this.meName, this.meLv, ml, this.meHp.g, this.meHpText, xl, this.meXp.g, this.meTypes]);
    this.refreshFoe();
    this.refreshMe();
  }

  /** A side's element symbols (its types only - working out matchups is the player's job). */
  typeRow(layer, species, { tx, ty }) {
    layer.removeAll(true);
    SPECIES[species].types.forEach((t, i) => layer.add(this.add.image(tx + i * 34, ty, typeIcon(this, t, 30))));
  }

  lvPill(g, t) {
    g.clear();
    const b = t.getBounds();
    g.fillStyle(0x000000, 0.25).fillRoundedRect(b.x - 10, b.y - 1, b.width + 20, b.height + 4, 10);
    g.fillStyle(COLORS.navy, 1).fillRoundedRect(b.x - 10, b.y - 3, b.width + 20, b.height + 4, 10);
  }

  refreshFoe() {
    const f = this.engine.foe;
    this.foeName.setText(displayName(f).toUpperCase());
    this.foeLv.setText(`Lv.${f.level}`);
    this.lvPill(this.foeLvBg, this.foeLv);
    this.foeHp.set(f.hp / calcStats(f).hp);
    const type = SPECIES[f.species].types[0];
    this.foePlate.setTexture(panelTexture(this, 'plate', 390, 100, { skew: 12, accent: hex(TYPE_COLORS[type]) }));
    if (this.foeTypesFor !== f.species) {
      this.foeTypesFor = f.species;
      this.typeRow(this.foeTypes, f.species, { tx: 74, ty: 89 });
    }
  }

  refreshMe() {
    const m = this.me;
    const max = calcStats(m).hp;
    this.meName.setText(displayName(m).toUpperCase());
    this.meLv.setText(`Lv.${m.level}`);
    this.lvPill(this.meLvBg, this.meLv);
    this.meHp.set(m.hp / max);
    this.meHpText.setText(`${m.hp}/ ${max}`);
    this.meXp.set(this.xpFrac(m.level, m.xp));
    if (this.meTypesFor !== m.species) {
      this.meTypesFor = m.species;
      this.typeRow(this.meTypes, m.species, { tx: 594, ty: 400 });
    }
  }

  xpFrac(level, xp) {
    const a = xpForLevel(level);
    const b = xpForLevel(level + 1);
    return Math.max(0, Math.min(1, (xp - a) / Math.max(1, b - a)));
  }

  // ------------------------------------------------------------- VS splash
  async vsSplash() {
    const layer = this.add.container(0, 0).setDepth(6000);
    const gold = this.boss;
    const left = this.add.graphics();
    const right = this.add.graphics();
    left.fillStyle(gold ? 0x2a1450 : 0x12163a, 1).fillPoints([{ x: 0, y: 0 }, { x: 560, y: 0 }, { x: 400, y: GAME_H }, { x: 0, y: GAME_H }], true);
    right.fillStyle(gold ? 0xffc94a : 0x8b5cff, 1).fillPoints([{ x: 560, y: 0 }, { x: GAME_W, y: 0 }, { x: GAME_W, y: GAME_H }, { x: 400, y: GAME_H }], true);
    right.fillStyle(gold ? 0xff9a3a : 0x2ef2a8, 1).fillPoints([{ x: 548, y: 0 }, { x: 566, y: 0 }, { x: 406, y: GAME_H }, { x: 388, y: GAME_H }], true);
    for (let i = 0; i < 9; i++) right.fillStyle(0xffffff, 0.06).fillRect(560 + i * 50 - i * 12, 0, 18, GAME_H);
    left.x = -GAME_W;
    right.x = GAME_W;
    const me = this.add.image(-200, GAME_H, `player_${this.save.player.gender}_full`).setOrigin(0.5, 1).setScale(2.8 / HD.full);
    const art = trainerArt(this.save.teams[this.cfg.trainerId].design).battle;
    const foe = this.add.image(GAME_W + 220, GAME_H - 10, art.key).setOrigin(0.5, 1).setScale(3.4 / HD.battle).setFlipX(true);
    const vs = text(this, GAME_W / 2 - 10, GAME_H / 2 - 20, 'VS', 120, '#fff7e6', { fontStyle: 'bold', stroke: '#12163a', strokeThickness: 12 }).setOrigin(0.5).setScale(3).setAlpha(0);
    vs.setShadow(0, 8, gold ? '#ff9a3a' : '#2ef2a8', 0, true, true);
    const nameA = text(this, 40, 40, this.save.player.name, 40, '#fff7e6', { fontStyle: 'bold', stroke: '#12163a', strokeThickness: 8 }).setAlpha(0);
    const nameB = text(this, GAME_W - 40, GAME_H - 100, this.tName.toUpperCase(), 48, '#fff7e6', { fontStyle: 'bold', stroke: '#12163a', strokeThickness: 8 }).setOrigin(1, 0).setAlpha(0);
    const tag = text(this, GAME_W - 40, GAME_H - 140, gold ? 'FINAL ELITE' : 'ELITE TRAINER', 24, gold ? '#12163a' : '#fff7e6', { fontStyle: 'bold' }).setOrigin(1, 0).setAlpha(0);
    layer.add([left, right, me, foe, vs, nameA, nameB, tag]);
    sfx('vs');
    await Promise.all([
      tween(this, { targets: left, x: 0, duration: 320, ease: 'Cubic.easeOut' }),
      tween(this, { targets: right, x: 0, duration: 320, ease: 'Cubic.easeOut' }),
      tween(this, { targets: me, x: 210, duration: 420, ease: 'Back.easeOut', delay: 120 }),
      tween(this, { targets: foe, x: GAME_W - 230, duration: 420, ease: 'Back.easeOut', delay: 120 }),
    ]);
    this.cameras.main.shake(220, 0.012);
    await tween(this, { targets: vs, scale: 1, alpha: 1, duration: 200, ease: 'Back.easeOut' });
    await tween(this, { targets: [nameA, nameB, tag], alpha: 1, duration: 200 });
    await wait(this, 1100);
    await tween(this, { targets: layer, alpha: 0, duration: 300 });
    layer.destroy();
  }

  // ------------------------------------------------------------------- intro
  async intro() {
    this.foeGroup.x = -300;
    this.meGroup.x = GAME_W + 300;
    const wild = this.cfg.kind === 'wild';
    if (wild) this.foeSprite.setTintFill(0x1c2030);
    await Promise.all([
      tween(this, { targets: this.foeGroup, x: FOE_PLAT.x, duration: 900, ease: 'Cubic.easeOut' }),
      tween(this, { targets: this.meGroup, x: ME_PLAT.x, duration: 900, ease: 'Cubic.easeOut' }),
    ]);
    if (wild) {
      this.foeSprite.clearTint();
      if (this.nightTint) this.foeSprite.setTint(this.nightTint);
      this.cameras.main.flash(150, 255, 255, 255);
      sfx('cry');
      this.foeBox.x = -60;
      tween(this, { targets: this.foeBox, alpha: 1, x: 0, duration: 300, ease: 'Back.easeOut' });
      await this.dialog.say(`A wild ${displayName(this.engine.foe).toUpperCase()} appeared!`);
    } else {
      const name = this.tName.toUpperCase();
      await this.dialog.say(this.boss ? `${name} is ready to battle! This is it!` : `${name} wants to battle!`);
      await tween(this, { targets: this.trainerSprite, x: 320, alpha: 0, duration: 450, ease: 'Cubic.easeIn' });
      this.dialog.say(`${name} sent out ${displayName(this.engine.foe).toUpperCase()}!`, { wait: false });
      await this.popIn(this.foeSprite, FOE_S);
      this.foeBox.x = -60;
      await tween(this, { targets: this.foeBox, alpha: 1, x: 0, duration: 300, ease: 'Back.easeOut' });
      await wait(this, 350);
    }
    this.dialog.say(`Go! ${displayName(this.me).toUpperCase()}!`, { wait: false });
    await this.popIn(this.meSprite, ME_S);
    this.meBox.x = 60;
    await tween(this, { targets: this.meBox, alpha: 1, x: 0, duration: 300, ease: 'Back.easeOut' });
    await wait(this, 300);
    // idle breathing
    this.tweens.add({ targets: this.foeSprite, scaleY: FOE_S * 1.02, duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.tweens.add({ targets: this.meSprite, scaleY: ME_S * 1.017, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  async popIn(sprite, scale) {
    sprite.setVisible(true).setScale(0.1).setTintFill(0xffffff).setAlpha(1);
    sfx('sendout');
    const burst = this.add.image(0, 0, 'glow').setBlendMode(Phaser.BlendModes.ADD).setScale(0.2).setAlpha(0.9);
    const m = sprite.getWorldTransformMatrix();
    burst.setPosition(m.tx, m.ty - 60).setDepth(6);
    this.tweens.add({ targets: burst, scale: 3, alpha: 0, duration: 420, onComplete: () => burst.destroy() });
    await tween(this, { targets: sprite, scale, duration: 280, ease: 'Back.easeOut' });
    await wait(this, 80);
    sprite.clearTint();
    if (this.nightTint) sprite.setTint(this.nightTint);
  }

  // ------------------------------------------------------------- player input
  async chooseAction() {
    const name = displayName(this.me).toUpperCase();
    for (;;) {
      this.dialog.setVisible(false);
      this.prompt.say(`What will\n${name} do?`, { wait: false });
      const i = await this.commandMenu();
      this.prompt.setVisible(false);
      this.dialog.setVisible(true);
      this.lastCmd = i;
      if (i === 0) {
        const m = await this.chooseMove();
        if (m >= 0) return { type: 'move', index: m };
      } else if (i === 1) {
        const item = await this.chooseItem();
        if (item) return { type: 'item', item };
      } else if (i === 2) {
        await showSummary(this, this.me);
      } else {
        return { type: 'run' };
      }
    }
  }

  /** FIGHT / BAG / TEAM / RUN as chunky icon buttons stacked on the right. */
  commandMenu() {
    return new Promise((resolve) => {
      const bw = 300;
      const bh = 40;
      const x0 = GAME_W - bw - 22;
      const layer = this.add.container(0, 0).setDepth(1100);
      const btns = COMMANDS.map((c, i) => {
        const img = this.add.image(x0, BOTTOM_Y - 4 + i * 40, buttonTexture(this, c.label, c.color, bw, bh + 6, c.icon)).setOrigin(0);
        const t = text(this, x0 + 76, BOTTOM_Y + 6 + i * 40, c.label, 24, '#fff7e6', { fontStyle: 'bold', stroke: '#12163a', strokeThickness: 5 });
        const zone = this.add.zone(x0, BOTTOM_Y - 4 + i * 40, bw, bh).setOrigin(0).setInteractive({ useHandCursor: true });
        zone.on('pointerover', () => { idx = i; draw(); });
        zone.on('pointerdown', () => { idx = i; pick(); });
        layer.add([img, t, zone]);
        return { img, t };
      });
      let idx = this.lastCmd ?? 0;
      const draw = () => btns.forEach((b, i) => {
        const on = i === idx;
        b.img.x = x0 - (on ? 14 : 0);
        b.t.x = x0 + 76 - (on ? 14 : 0);
        b.img.setAlpha(on ? 1 : 0.82);
      });
      draw();
      layer.x = 60;
      layer.alpha = 0;
      this.tweens.add({ targets: layer, x: 0, alpha: 1, duration: 160, ease: 'Cubic.easeOut' });
      let release = null;
      const pick = () => { release(); sfx('confirm'); layer.destroy(); resolve(idx); };
      release = pushFocus((a) => {
        if (a === 'up' || a === 'left') { idx = (idx + 3) % 4; sfx('cursor'); draw(); }
        if (a === 'down' || a === 'right') { idx = (idx + 1) % 4; sfx('cursor'); draw(); }
        if (a === 'confirm') pick();
      }, this);
    });
  }

  /** Move cards: type-coloured, name, type, PP, category. */
  chooseMove() {
    if (this.me.moves.every((m) => m.pp <= 0)) return Promise.resolve(0); // engine falls back to Struggle
    this.dialog.setVisible(false);
    return new Promise((resolve) => {
      const layer = this.add.container(0, 0).setDepth(1100);
      layer.add(panel(this, 16, BOTTOM_Y, GAME_W - 32, 158, 'glass'));
      const cw = (GAME_W - 32 - 48) / 2;
      const ch = 60;
      const cards = this.me.moves.map((m, i) => {
        const mv = MOVES[m.id];
        const x = 36 + (i % 2) * (cw + 16);
        const y = BOTTOM_Y + 16 + Math.floor(i / 2) * (ch + 10);
        const col = TYPE_COLORS[mv.type] ?? 0x888888;
        const g = this.add.graphics();
        const t = text(this, x + 20, y + 6, mv.name, 24, '#fff7e6', { fontStyle: 'bold', stroke: '#12163a', strokeThickness: 4 });
        const ic = this.add.image(x + 32, y + 43, typeIcon(this, mv.type, 24, { mono: true }));
        const ty = text(this, x + 52, y + 35, `${mv.type.toUpperCase()} · ${mv.category === 'status' ? 'STATUS' : mv.category === 'physical' ? 'PHYS' : 'SPEC'}`, 15, '#fff7e6');
        const pp = text(this, x + cw - 16, y + 18, `PP ${m.pp}/${mv.pp}`, 20, m.pp <= 0 ? '#ff9aa6' : '#fff7e6').setOrigin(1, 0);
        const zone = this.add.zone(x, y, cw, ch).setOrigin(0).setInteractive({ useHandCursor: true });
        zone.on('pointerover', () => { idx = i; draw(); });
        zone.on('pointerdown', () => { idx = i; pick(); });
        layer.add([g, t, ic, ty, pp, zone]);
        return { g, x, y, col, disabled: m.pp <= 0 };
      });
      const hint = text(this, GAME_W - 40, BOTTOM_Y + 136, 'X / ESC: back', 14, '#a8acd6').setOrigin(1, 0);
      layer.add(hint);
      let idx = Math.min(this.lastMove ?? 0, cards.length - 1);
      const draw = () => cards.forEach((c, i) => {
        const on = i === idx;
        c.g.clear();
        c.g.fillStyle(0x000000, 0.35).fillRoundedRect(c.x + 3, c.y + 5, cw, ch, 14);
        c.g.fillGradientStyle(shadeInt(c.col, 0.2), shadeInt(c.col, 0.2), shadeInt(c.col, -0.25), shadeInt(c.col, -0.25), c.disabled ? 0.45 : 1);
        c.g.fillRect(c.x + 6, c.y, cw - 12, ch);
        c.g.fillStyle(shadeInt(c.col, 0.2), c.disabled ? 0.45 : 1).fillRoundedRect(c.x, c.y, 16, ch, { tl: 14, bl: 14, tr: 0, br: 0 });
        c.g.fillStyle(shadeInt(c.col, -0.25), c.disabled ? 0.45 : 1).fillRoundedRect(c.x + cw - 16, c.y, 16, ch, { tl: 0, bl: 0, tr: 14, br: 14 });
        c.g.fillStyle(0xffffff, 0.18).fillRect(c.x + 8, c.y + 3, cw - 16, 10);
        c.g.lineStyle(on ? 4 : 2.5, on ? COLORS.mint : COLORS.ink, 1).strokeRoundedRect(c.x, c.y, cw, ch, 14);
      });
      draw();
      let release = null;
      const close = (v) => { release(); layer.destroy(); this.dialog.setVisible(true); if (v >= 0) this.lastMove = v; resolve(v); };
      const pick = () => { if (cards[idx].disabled) { sfx('bump'); return; } sfx('confirm'); close(idx); };
      release = pushFocus((a) => {
        const n = cards.length;
        if (a === 'left' || a === 'right') { idx = idx ^ 1; if (idx >= n) idx = n - 1; sfx('cursor'); draw(); }
        if (a === 'up' || a === 'down') { idx = (idx + 2) % Math.max(2, n); if (idx >= n) idx = idx % 2; sfx('cursor'); draw(); }
        if (a === 'confirm') pick();
        if (a === 'cancel') { sfx('cancel'); close(-1); }
      }, this);
    });
  }

  async chooseItem() {
    const ids = Object.keys(ITEMS).filter((k) => this.save.bag[k] > 0 && ITEMS[k].heal);
    if (!ids.length) { await this.dialog.say('No usable items in your bag!'); return null; }
    const i = await chooseFrom(this, {
      x: GAME_W - 540, y: 40, w: 520, h: 50 + ids.length * 66, rowH: 66,
      items: ids.map((k) => ({ label: `${ITEMS[k].name}  x${this.save.bag[k]}`, detail: ITEMS[k].desc })),
    });
    if (i < 0) return null;
    if (this.me.hp >= calcStats(this.me).hp) { await this.dialog.say("It won't have any effect."); return null; }
    return ids[i];
  }

  // ---------------------------------------------------------------- playback
  async play(events) {
    for (const e of events) {
      switch (e.t) {
        case 'text':
          if (e.auto) { await this.dialog.say(e.text, { wait: false, hold: 450 }); } else await this.dialog.say(e.text);
          if (this.pendingLevelUp) { const lu = this.pendingLevelUp; this.pendingLevelUp = null; await this.statPanel(lu); }
          break;
        case 'attack': await this.animAttack(e); break;
        case 'hit': await this.animHit(e); break;
        case 'hp': await this.animHp(e); break;
        case 'stat': await this.animStat(e); break;
        case 'faint': await this.animFaint(e); break;
        case 'sendout': await this.sendOut(); break;
        case 'xpbar': await this.animXp(e); break;
        case 'levelup': this.onLevelUp(e); break;
        case 'taunt': await this.trainerLine(this.voice?.[e.key], false); break;
        case 'heal': await this.animHeal(e); break;
        case 'learn': await this.learn(e.moveId); break;
        case 'end': this.result = e.result; break;
        default: break;
      }
    }
  }

  spriteOf(side) { return side === 'player' ? this.meSprite : this.foeSprite; }

  async animAttack(e) {
    const s = this.spriteOf(e.side);
    if (e.category === 'status') {
      sfx('status');
      s.setTint(0xfff3a0);
      await wait(this, 180);
      s.clearTint();
      if (this.nightTint) s.setTint(this.nightTint);
      return;
    }
    sfx('attack');
    const dx = e.side === 'player' ? 40 : -40;
    const dy = e.side === 'player' ? -16 : 12;
    await tween(this, { targets: s, x: s.x + dx, y: s.y + dy, duration: 110, yoyo: true, ease: 'Quad.easeOut' });
    const target = this.spriteOf(e.side === 'player' ? 'foe' : 'player');
    const m = target.getWorldTransformMatrix();
    const cx = m.tx;
    const cy = m.ty - target.displayHeight * 0.45;
    const color = TYPE_COLORS[e.moveType] ?? 0xffffff;
    const ring = this.add.circle(cx, cy, 20, color, 0).setStrokeStyle(6, color, 0.9).setDepth(6);
    this.tweens.add({ targets: ring, scale: 3.2, alpha: 0, duration: 360, onComplete: () => ring.destroy() });
    for (let i = 0; i < 9; i++) {
      const c = this.add.circle(cx, cy, 9, color, 0.95).setDepth(6);
      const a = (i / 9) * Math.PI * 2;
      this.tweens.add({ targets: c, x: cx + Math.cos(a) * 80, y: cy + Math.sin(a) * 56, scale: 0.2, alpha: 0, duration: 340, onComplete: () => c.destroy() });
    }
    await wait(this, 120);
  }

  async animHit(e) {
    const s = this.spriteOf(e.side);
    sfx(e.eff > 1 ? 'superHit' : e.eff < 1 ? 'weakHit' : 'hit');
    if (e.eff > 1) this.cameras.main.shake(200, 0.01);
    for (let i = 0; i < 4; i++) {
      s.setAlpha(0.15);
      await wait(this, 60);
      s.setAlpha(1);
      await wait(this, 60);
    }
  }

  async animHp(e) {
    if (e.side === 'player') {
      await this.meHp.tweenTo(e.to / e.max, {
        onUpdate: (f) => this.meHpText.setText(`${Math.round(f * e.max)}/ ${e.max}`),
      });
      this.meHpText.setText(`${e.to}/ ${e.max}`);
      if (e.to / e.max <= 0.2 && e.to > 0) sfx('lowHp');
    } else {
      await this.foeHp.tweenTo(e.to / e.max);
    }
  }

  /** Level-up heal: green shimmer over the partner, HP bar refills. */
  async animHeal(e) {
    sfx('heal');
    const m = this.meSprite.getWorldTransformMatrix();
    for (let i = 0; i < 14; i++) {
      const sp = this.add.image(m.tx + Phaser.Math.Between(-70, 70), m.ty - Phaser.Math.Between(10, 60), 'spark')
        .setScale(0.25).setTint(0x7dffb0).setBlendMode(Phaser.BlendModes.ADD).setDepth(5);
      this.tweens.add({ targets: sp, y: sp.y - 90, alpha: 0, scale: 0.05, duration: 700 + i * 30, delay: i * 40, ease: 'Sine.easeOut', onComplete: () => sp.destroy() });
    }
    this.meSprite.setTint(0xc8ffd8);
    await this.meHp.tweenTo(e.to / e.max, {
      duration: 700,
      onUpdate: (f) => this.meHpText.setText(`${Math.round(f * e.max)}/ ${e.max}`),
    });
    this.meHpText.setText(`${e.to}/ ${e.max}`);
    this.meSprite.clearTint();
    if (this.nightTint) this.meSprite.setTint(this.nightTint);
  }

  async animStat(e) {
    const s = this.spriteOf(e.side);
    sfx(e.up ? 'statUp' : 'statDown');
    s.setTint(e.up ? 0xff9a9a : 0x9ab8ff);
    await tween(this, { targets: s, y: s.y + (e.up ? -8 : 8), duration: 140, yoyo: true, repeat: 1 });
    s.clearTint();
    if (this.nightTint) s.setTint(this.nightTint);
  }

  async animFaint(e) {
    const s = this.spriteOf(e.side);
    const box = e.side === 'player' ? this.meBox : this.foeBox;
    sfx('faint');
    this.tweens.killTweensOf(s);
    await tween(this, { targets: s, y: s.y + 70, alpha: 0, duration: 380, ease: 'Quad.easeIn' });
    await tween(this, { targets: box, alpha: 0, duration: 200 });
  }

  async sendOut() {
    const f = this.engine.foe;
    this.foeSprite.setTexture(SPECIES[f.species].front).setPosition(0, 8).setAlpha(1);
    this.refreshFoe();
    await this.popIn(this.foeSprite, FOE_S);
    await tween(this, { targets: this.foeBox, alpha: 1, duration: 200 });
  }

  async animXp(e) {
    this.meXp.set(this.xpFrac(e.level, e.from));
    sfx('xp');
    await this.meXp.tweenTo(this.xpFrac(e.level, e.to), { duration: 700 });
  }

  onLevelUp(e) {
    const max = e.stats.hp;
    const hp = Math.min(e.hpBefore ?? this.me.hp, max);
    this.meLv.setText(`Lv.${e.level}`);
    this.lvPill(this.meLvBg, this.meLv);
    this.meHp.set(hp / max);
    this.meHpText.setText(`${hp}/ ${max}`);
    this.meXp.set(0);
    this.cameras.main.flash(120, 255, 250, 200);
    sfx('levelup');
    this.pendingLevelUp = e;
  }

  async statPanel(e) {
    const objs = [];
    objs.push(panel(this, GAME_W - 340, 40, 320, 280, 'menu').setDepth(1300));
    objs.push(text(this, GAME_W - 316, 56, 'LEVEL UP!', 22, '#2ef2a8', { fontStyle: 'bold' }).setDepth(1301));
    const rows = STAT_KEYS.map((k, i) => {
      objs.push(text(this, GAME_W - 316, 90 + i * 36, STAT_LABELS[k], 22, '#fff7e6').setDepth(1301));
      const v = text(this, GAME_W - 46, 90 + i * 36, `+${e.delta[k]}`, 22, '#ffc94a').setOrigin(1, 0).setDepth(1301);
      objs.push(v);
      return v;
    });
    await this.waitConfirm();
    STAT_KEYS.forEach((k, i) => rows[i].setText(`${e.stats[k]}`).setColor('#fff7e6'));
    await this.waitConfirm();
    objs.forEach((o) => o.destroy());
  }

  waitConfirm() {
    return new Promise((resolve) => {
      const release = pushFocus((a) => { if (a === 'confirm' || a === 'cancel') { release(); sfx('tick'); resolve(); } }, this);
    });
  }

  async learn(moveId) {
    const name = displayName(this.me).toUpperCase();
    const mv = MOVES[moveId].name.toUpperCase();
    if (this.me.moves.length < 4) {
      learnMove(this.me, moveId);
      sfx('item');
      await this.dialog.say(`${name} learned ${mv}!`);
      return;
    }
    await this.dialog.say(`${name} wants to learn the move ${mv}.`);
    await this.dialog.say(`But ${name} can't learn more than four moves.`);
    this.dialog.say(`Forget an old move to make room for ${mv}?`, { wait: false });
    if (await yesNo(this, { x: GAME_W - 210, y: 290 })) {
      this.dialog.setVisible(false);
      const i = await chooseFrom(this, {
        x: 16, y: BOTTOM_Y, w: GAME_W - 32, h: 158, columns: 2, size: 24, pad: 12, rowH: 67,
        items: this.me.moves.map((m) => ({ label: MOVES[m.id].name, badge: TYPE_COLORS[MOVES[m.id].type], badgeText: MOVES[m.id].type, detail: `PP ${m.pp}/${MOVES[m.id].pp}` })),
      });
      this.dialog.setVisible(true);
      if (i >= 0) {
        const old = MOVES[this.me.moves[i].id].name.toUpperCase();
        learnMove(this.me, moveId, i);
        await this.dialog.say('1, 2, and... Poof!');
        await this.dialog.say(`${name} forgot ${old}... and learned ${mv}!`);
        return;
      }
    }
    await this.dialog.say(`${name} did not learn ${mv}.`);
  }

  // ------------------------------------------------------------------- outro
  /** The trainer steps back onto their platform and says something. */
  async trainerLine(line, showSprite = true) {
    if (!line || !this.trainerSprite) return;
    const opts = { speaker: this.tName.toUpperCase(), portrait: `trainer_${this.design}_battle` };
    if (showSprite) {
      this.foeSprite.setVisible(false);
      this.trainerSprite.setAlpha(0).setX(260);
      await tween(this, { targets: this.trainerSprite, x: 0, alpha: 1, duration: 420, ease: 'Cubic.easeOut' });
    }
    for (const l of Array.isArray(line) ? line : [line]) await this.dialog.say(l, opts);
  }

  async outro() {
    if (this.trainerDef && this.result === 'win') await this.trainerLine(this.voice.defeat[0]);
    if (this.trainerDef && this.result === 'lose') {
      await this.trainerLine(this.voice.victory);
      // ...then, in character, what you should do about it
      await this.trainerLine(coaching(this.save, this.cfg.trainerId, this.design), false);
    }
    if (this.result === 'win') {
      music(this.cfg.kind === 'trainer' ? 'victory' : 'victoryShort');
      if (pendingEvolution(this.me)) {
        // evolution gets its own full-screen sequence once the battle is over
        this.cameras.main.fadeOut(300, 0, 0, 0);
        await wait(this, 320);
        await runEvolution(this, this.me);
      }
    } else if (this.result === 'lose') {
      music('lose');
    }
    writeSave();
    await wait(this, 250);
    this.cameras.main.fadeOut(350, 0, 0, 0);
    await wait(this, 380);
    const res = { result: this.result, kind: this.cfg.kind, trainerId: this.cfg.trainerId ?? null };
    this.scene.resume('Overworld', res);
    this.scene.stop();
  }
}

function shadeInt(col, amt) {
  const c = Phaser.Display.Color.IntegerToColor(col);
  const f = (v) => Math.max(0, Math.min(255, Math.round(amt >= 0 ? v + (255 - v) * amt : v * (1 + amt))));
  return Phaser.Display.Color.GetColor(f(c.red), f(c.green), f(c.blue));
}
