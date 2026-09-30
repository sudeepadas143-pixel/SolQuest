import Phaser from 'phaser';
import manifest from '../data/spriteManifest.json' with { type: 'json' };
import tilesMeta from '../data/tiles.json' with { type: 'json' };
import { text } from '../ui/theme.js';
import { GAME_W, GAME_H } from '../config.js';
import { makeFxTextures } from '../ui/skin.js';

const BASE = `${import.meta.env.BASE_URL}assets/`;

export class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }

  preload() {
    const bar = this.add.graphics();
    const label = text(this, GAME_W / 2, GAME_H / 2 + 40, 'Loading...', 24, '#fbf6e9').setOrigin(0.5);
    this.load.on('progress', (p) => {
      bar.clear().fillStyle(0x6fd3c1, 1).fillRoundedRect(GAME_W / 2 - 200, GAME_H / 2, 400 * p, 14, 7);
    });
    this.load.on('complete', () => label.destroy());

    for (const [id, e] of Object.entries(manifest.creatures)) {
      if (e.front) this.load.image(`${id}_front`, `${BASE}sprites/${e.front}`);
      if (e.back) this.load.image(`${id}_back`, `${BASE}sprites/${e.back}`);
    }
    for (const [id, e] of Object.entries(manifest.trainers)) {
      this.load.image(`trainer_${id}_battle`, `${BASE}sprites/${e.battle}`);
      this.load.spritesheet(`trainer_${id}_ow`, `${BASE}sprites/${e.overworld}`, { frameWidth: e.owFrameWidth, frameHeight: e.owFrameHeight });
    }
    for (const [g, e] of Object.entries(manifest.player)) {
      this.load.spritesheet(`player_${g}`, `${BASE}sprites/${e.walk}`, { frameWidth: e.frameWidth, frameHeight: e.frameHeight });
      this.load.image(`player_${g}_full`, `${BASE}sprites/${e.full}`);
    }
    this.load.image('tileset', `${BASE}tiles/tileset.png`);
    // title screen: first frame of the drone flight (the video itself streams in the Title scene)
    this.load.image('title_poster', `${BASE}title/poster.jpg`);
    for (const k of Object.keys(tilesMeta.props)) this.load.image(k, `${BASE}tiles/${k}.png`);
  }

  create() {
    makeFxTextures(this);
    for (const [g, e] of Object.entries(manifest.player)) {
      e.rows.forEach((dir, row) => {
        const f = (i) => ({ key: `player_${g}`, frame: row * e.frames + i });
        this.anims.create({ key: `${g}-walk-${dir}`, frames: e.walkFrames.map(f), frameRate: 9, repeat: -1 });
        this.anims.create({ key: `${g}-run-${dir}`, frames: e.runFrames.map(f), frameRate: 12, repeat: -1 });
      });
    }
    for (const id of Object.keys(manifest.trainers)) {
      this.anims.create({ key: `trainer_${id}_idle`, frames: [0, 0, 0, 1, 1].map((frame) => ({ key: `trainer_${id}_ow`, frame })), frameRate: 3, repeat: -1 });
    }
    this.registry.set('playerRows', manifest.player.boy.rows);
    this.registry.set('playerFrames', manifest.player.boy.frames);
    this.scene.start('Title');
  }
}
