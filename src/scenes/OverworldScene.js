// The explorable route: tile-grid movement on a foreshortened (32 x 24) grid,
// collisions, tall-grass encounters, Elite Trainers, Solaces (healing stops), items, lore
// and the Elite Hall entrance. Lighting/weather live in AtmosphereScene; the
// HUD and menus in OverworldUIScene.
import Phaser from 'phaser';
import { TILE_W, TILE_H, WORLD_ZOOM, CHAR_SCALE, ART_SCALE, ENCOUNTER_RATE, WALK_MS, RUN_MS } from '../config.js';
import { TRAINER_SPOTS, MAP_ITEMS, HALL, OUTDOOR_W, CHECKPOINTS } from '../data/map.js';
import tilesMeta from '../data/tiles.json' with { type: 'json' };
import { TRAINERS } from '../data/trainers.js';
import { personality } from '../data/personalities.js';
import { zoneAt, poolFor } from '../data/encounters.js';
import { ITEMS, WILD_DROP_CHANCE } from '../data/items.js';
import { buildMap } from '../systems/mapBuilder.js';
import { getSave, writeSave, loadSave } from '../systems/save.js';
import { createCreature, fullRestore } from '../systems/creature.js';
import { awardTrainer } from '../systems/score.js';
import { trainerName } from '../systems/teams.js';
import { isNight } from '../systems/world.js';
import { warning, objective } from '../systems/advice.js';
import { unlockCheckpoints, nearestCheckpoint } from '../systems/checkpoints.js';
import { sfx, music } from '../systems/audio.js';
import { TRACKS } from '../data/music.js';
import { trainerArt } from '../ui/trainerArt.js';
import { looseRng } from '../systems/rng.js';
import { heldDirection, isHeld, pushFocusToken } from '../systems/controls.js';
import { wait, tween } from '../ui/helpers.js';
import { used } from '../systems/hints.js';
import { Ambient } from './ambient.js';
import { Townsfolk } from './townsfolk.js';

const DELTA = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const OPPOSITE = { up: 'down', down: 'up', left: 'right', right: 'left' };

/** Each Elite has their own encounter + battle theme, keyed by character design
 *  (the route order is shuffled per player). Falls back to the generic themes. */
function themeFor(kind, design) {
  const key = `${kind}_${design}`;
  if (TRACKS[key]) return key;
  return kind === 'encounter' ? 'eliteEncounter' : 'eliteBattle';
}
const ROWS = ['down', 'left', 'right', 'up'];
// screen lift per model unit of height (tools/iso3d.py: PITCH x RES texels,
// ART_SCALE texels per world unit): how far up the Hall's dais draws you
const LIFT = (0.74 * 4) / ART_SCALE;
const WARM = 0xffd38a;

export class OverworldScene extends Phaser.Scene {
  constructor() { super('Overworld'); }

  create() {
    this.save = getSave() ?? loadSave();
    if (!this.save) { this.scene.start('Title'); return; }
    this.map = buildMap();
    this.moving = false;
    this.locked = false;
    this.turnUntil = 0;
    this.lastMoveEnd = 0;
    this.bumpCooldown = 0;

    // ground
    // (tiles are painted at ART_SCALE texels per world unit; the layer is scaled
    // back to world units so 1 texel = 1 screen pixel under the 2x camera)
    const TWt = TILE_W * ART_SCALE;
    const THt = TILE_H * ART_SCALE;
    const tm = this.make.tilemap({ data: this.map.indices, tileWidth: TWt, tileHeight: THt });
    const ts = tm.addTilesetImage('tileset', 'tileset', TWt, THt, 0, 0);
    this.layer = tm.createLayer(0, ts, 0, 0).setDepth(-10).setScale(1 / ART_SCALE);
    const wA = tilesMeta.tiles.water.index;
    const wB = tilesMeta.tiles.water2.index;
    this.time.addEvent({ delay: 650, loop: true, callback: () => this.layer.swapByIndex(wA, wB) });

    // props (y-sorted by their base). 3D renders; each sprite's anchor pixel is
    // the footprint's bottom-left ground corner (see tools/props3d.py).
    this.lights = [];
    this.aisle = [];            // the Hall's braziers, lit pair by pair on the final walk
    for (const p of this.map.props) {
      const bx = p.x * TILE_W;
      const ground = (p.y + p.h) * TILE_H;
      const by = ground - this.lift(p.x, p.y + p.h - 1);     // up on the dais, drawn higher (sorted by the ground)
      const m = tilesMeta.props[p.type];
      const img = this.add.image(bx, by, p.type).setOrigin(m.ax / m.w, m.ay / m.h).setDepth(p.deco ? -5 : ground).setScale(1 / ART_SCALE);
      if (p.type === 'hall_gate') this.gateImg = img;
      let pair = null;
      if (p.aisle != null) {
        // the bowl stays the cold model; fire is an animated sprite on top (see ignite)
        img.setTexture('brazier_cold');
        const fx = bx + (36.5 - tilesMeta.props.brazier_cold.ax) / ART_SCALE;
        const fy = by - 38;
        pair = { img, fx, fy, flame: null, lights: [{ x: fx, y: fy - 6, r: 30, color: 0xffa040, off: true }] };
        this.lights.push(pair.lights[0]);
        (this.aisle[p.aisle] ??= []).push(pair);
      }
      // merge emissive blobs that sit close together (a row of window panes
      // reads as one soft pool of light, not a stack of additive blobs)
      const merged = [];
      for (const [lx, ly, area, col] of m.lights ?? []) {
        const c = Phaser.Display.Color.HexStringToColor(col);
        // blue glass = house windows -> warm interior light at night
        const color = c.blue > c.red + 20 && p.type !== 'hall' ? WARM : c.color;
        const near = merged.find((q) => q.color === color && Math.abs(q.x - lx) < 18 * ART_SCALE && Math.abs(q.y - ly) < 14 * ART_SCALE);
        if (near) {
          const a = near.area + area;
          near.x = (near.x * near.area + lx * area) / a;
          near.y = (near.y * near.area + ly * area) / a;
          near.area = a;
        } else merged.push({ x: lx, y: ly, area, color });
      }
      for (const q of merged) {
        const area = q.area / (ART_SCALE * ART_SCALE);          // texels -> world units
        const light = { x: bx + q.x / ART_SCALE, y: by + q.y / ART_SCALE, r: Math.min(28, 7 + Math.sqrt(area) * 1.8), color: q.color };
        this.lights.push(light);
        pair?.lights.push(light);
      }
    }

    // map items
    this.itemAt = new Map();
    this.itemSprites = new Map();
    const picked = new Set(this.save.pickedItems);
    for (const it of MAP_ITEMS) {
      if (picked.has(it.id)) continue;
      this.itemAt.set(this.map.key(it.x, it.y), it);
      if (!it.hidden) {
        const m = tilesMeta.props.item_ball;
        const by = (it.y + 1) * TILE_H;
        const s = this.add.image(it.x * TILE_W, by, 'item_ball').setOrigin(m.ax / m.w, m.ay / m.h).setDepth(by).setScale(1 / ART_SCALE);
        this.tweens.add({ targets: s, y: by - 2, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        this.itemSprites.set(it.id, s);
      }
    }
    this.time.addEvent({ delay: 2600, loop: true, callback: () => this.sparkleHidden() });

    // trainers
    this.npcAt = new Map();
    this.npcSprites = {};
    for (const [id, spot] of Object.entries(TRAINER_SPOTS)) this.placeTrainer(id, spot);
    this.stepTo = null;
    this.townsfolk = new Townsfolk(this);

    // player (+ soft contact shadow)
    const { x, y, facing } = this.save.pos;
    this.pos = { x, y };
    this.facing = facing ?? 'down';
    this.gender = this.save.player.gender;
    this.shadow = this.add.ellipse(0, 0, 22, 8, 0x0b1020, 0.28);
    this.player = this.add.sprite(0, 0, `player_${this.gender}`, this.idleFrame(this.facing)).setOrigin(0.5, 1).setScale(CHAR_SCALE);
    this.buildGrass();
    this.syncPlayer();
    this.buildHallDust();
    this.ambient = new Ambient(this);
    this.hallReset();
    this.unlockCheckpoints();

    const cam = this.cameras.main;
    cam.setZoom(WORLD_ZOOM).setRoundPixels(true);
    cam.startFollow(this.player, true, 1, 1, 0, TILE_H / 2);
    this.applyArea();
    cam.fadeIn(500);

    this.scene.launch('Atmosphere');
    this.scene.launch('OverworldUI');
    this.ui = this.scene.get('OverworldUI');
    this.focus = pushFocusToken((a) => this.onAction(a), this);
    this.path = null;
    this.input.on('pointerdown', (p) => this.onPointer(p));
    // Scene event emitters survive restarts, so detach on shutdown to avoid
    // handling one battle result twice after coming back from the Hall of Fame.
    const onResume = (_sys, data) => this.onBattleEnd(data);
    this.events.on('resume', onResume);
    this.events.once('shutdown', () => {
      this.events.off('resume', onResume);
      this.scene.stop('OverworldUI');
      this.scene.stop('Atmosphere');
    });
    this.zoneId = null;
    this.time.delayedCall(600, () => this.checkZone());
    this.time.delayedCall(50, () => this.applyArea());      // (re)applies the Hall's cinema bars once the UI exists
    this.nightMusic = null;
    this.updateMusic(true);
    // wallets are required: an old save without one adds it before moving on
    if (!this.save.player.wallet) this.time.delayedCall(700, () => this.runLocked(() => this.ui.editWallet({ required: true })));
  }

  // ------------------------------------------------------------------ helpers
  idleFrame(dir) { return ROWS.indexOf(dir) * (this.registry.get('playerFrames') ?? 7); }

  /** 3D tall grass: every encounter tile gets a back half (behind whoever
   *  stands on it) and a front half (over their legs); short grass gets a few
   *  scattered 3D tufts. */
  buildGrass() {
    this.tallFront = new Map();
    this.grassSprites = [];
    const hash = (x, y) => ((x * 73856093) ^ (y * 19349663)) >>> 0;
    const place = (key, x, y, depth) => {
      const m = tilesMeta.props[key];
      return this.add.image(x * TILE_W, (y + 1) * TILE_H, key).setOrigin(m.ax / m.w, m.ay / m.h)
        .setScale(1 / ART_SCALE).setDepth(depth);
    };
    for (let y = 0; y < this.map.h; y++) {
      for (let x = 0; x < this.map.w; x++) {
        const h = hash(x, y);
        if (this.map.isEncounter(x, y)) {
          const v = h % 4;
          const back = place(`tall_back${v}_1`, x, y, y * TILE_H + TILE_H / 2);
          const front = place(`tall_front${v}_1`, x, y, y * TILE_H + TILE_H - 0.5);
          this.tallFront.set(this.map.key(x, y), front);
          this.grassSprites.push({ x, y, v, back, front, f: 1 });
        } else if (this.map.ground[y][x] === 'grass' && !this.map.blocked[y][x] && h % 100 < 9) {
          place(`clump${h % 3}`, x, y, y * TILE_H + TILE_H - 3);
        }
      }
    }
    // wind: waves roll across the field (three bend frames per blade tile)
    this.time.addEvent({ delay: 220, loop: true, callback: () => this.windTick() });
    // something moves in the grass nearby
    this.time.addEvent({ delay: 1500, loop: true, callback: () => this.lurk() });
  }

  setGrassFrame(g, f) {
    if (g.f === f) return;
    g.f = f;
    for (const [img, layer] of [[g.back, 'back'], [g.front, 'front']]) {
      const key = `tall_${layer}${g.v}_${f}`;
      const m = tilesMeta.props[key];
      img.setTexture(key).setOrigin(m.ax / m.w, m.ay / m.h);
    }
  }

  windTick() {
    const view = this.cameras.main.worldView;
    const t = this.time.now / 1000;
    const gust = 0.55 + 0.45 * Math.sin(t * 0.37);           // gusts come and go
    for (const g of this.grassSprites) {
      const px = g.x * TILE_W;
      const py = g.y * TILE_H;
      if (px < view.x - 64 || px > view.right + 32 || py < view.y - 48 || py > view.bottom + 48) continue;
      const w = Math.sin(g.x * 0.55 - g.y * 0.22 - t * 2.4) * gust;
      this.setGrassFrame(g, w > 0.42 ? 2 : w < -0.55 ? 0 : 1);
    }
  }

  /** A random patch of tall grass near the player rustles on its own; at
   *  night, sometimes a pair of eyes blinks in it. */
  lurk() {
    if (this.locked || !this.grassSprites.length) return;
    const near = this.grassSprites.filter((g) => Math.abs(g.x - this.pos.x) <= 5 && Math.abs(g.y - this.pos.y) <= 4
      && !(g.x === this.pos.x && g.y === this.pos.y));
    if (!near.length || !looseRng.chance(0.7)) return;
    const g = near[looseRng.int(0, near.length - 1)];
    this.rustle(g.x, g.y);
    if (isNight(this.save.stats.playMs) && looseRng.chance(0.35)) {
      const f = this.tileFoot(g.x, g.y);
      const col = looseRng.pick([0xffe066, 0xff5a5a, 0x9dff7a]);
      const eyes = [-2.5, 2.5].map((dx) => this.add.ellipse(f.x + dx, f.y - 9, 2.2, 1.4, col, 1)
        .setBlendMode(Phaser.BlendModes.ADD).setDepth(f.y + 0.2).setAlpha(0));
      this.tweens.add({ targets: eyes, alpha: 1, duration: 160, yoyo: true, hold: 700, onComplete: () => eyes.forEach((e) => e.destroy()) });
      this.tweens.add({ targets: eyes, scaleY: 0.1, duration: 70, yoyo: true, delay: 420 });
    }
  }

  /** Grass parts around the player's feet. */
  rustle(x, y) {
    const g = this.tallFront.get(this.map.key(x, y));
    if (!g) return;
    this.tweens.killTweensOf(g);
    const x0 = x * TILE_W;
    g.setScale(1 / ART_SCALE).setX(x0);
    this.tweens.add({ targets: g, scaleY: 0.82 / ART_SCALE, scaleX: 1.06 / ART_SCALE, duration: 90, yoyo: true, ease: 'Sine.easeOut' });
    this.tweens.add({ targets: g, x: { from: x0 - 1.2, to: x0 + 1.2 }, duration: 55, yoyo: true, repeat: 2, onComplete: () => g.setX(x0) });
    const f = this.tileFoot(x, y);
    for (let i = 0; i < 3; i++) {
      const leaf = this.add.rectangle(f.x + looseRng.int(-8, 8), f.y - 6, 2, 1, 0x9be07a).setDepth(f.y + 2);
      this.tweens.add({ targets: leaf, x: leaf.x + looseRng.int(-10, 10), y: leaf.y - looseRng.int(6, 12), alpha: 0, angle: 180, duration: 420, ease: 'Sine.easeOut', onComplete: () => leaf.destroy() });
    }
  }

  tileFoot(x, y) { return { x: x * TILE_W + TILE_W / 2, y: y * TILE_H + TILE_H - 2 }; }

  /** Screen lift of tile (x, y): the Hall's dais and stairs raise whoever stands there. */
  lift(x, y) { return (this.map.elev[y]?.[x] ?? 0) * LIFT; }

  /** Where a character standing on (x, y) is drawn: feet (lifted) + depth (ground). */
  standAt(x, y) {
    const f = this.tileFoot(x, y);
    return { x: f.x, y: f.y - this.lift(x, y), depth: f.y };
  }

  syncPlayer() {
    const s = this.standAt(this.pos.x, this.pos.y);
    this.player.setPosition(s.x, s.y);
    this.player.setDepth(s.depth + 0.5);
    this.shadow.setPosition(s.x, s.y - 1).setDepth(this.player.depth - 0.2);
  }

  placeTrainer(id, spot) {
    const defeated = this.save.defeated[id];
    const at = defeated && spot.moved ? spot.moved : spot;
    const design = this.save.teams[id].design;
    this.npcSprites[id]?.destroy();
    this.npcSprites[`${id}_shadow`]?.destroy();
    for (const [k, v] of this.npcAt) if (v === id) this.npcAt.delete(k);
    const art = trainerArt(design).overworld;
    const f = this.standAt(at.x, at.y);
    this.npcSprites[`${id}_shadow`] = this.add.ellipse(f.x, f.y - 1, 22, 8, 0x0b1020, 0.28).setDepth(f.depth - 0.5);
    const s = this.add.sprite(f.x, f.y, art.key, art.frame).setOrigin(0.5, 1).setScale(CHAR_SCALE);
    s.setDepth(f.depth);
    s.anims.play({ key: art.anim, startFrame: looseRng.int(0, 4) });
    this.npcSprites[id] = s;
    this.npcAt.set(this.map.key(at.x, at.y), id);
  }

  walkable(x, y) {
    if (x < 0 || y < 0 || x >= this.map.w || y >= this.map.h) return false;
    const k = this.map.key(x, y);
    return !this.map.blocked[y][x] && !this.npcAt.has(k) && !this.itemAt.has(k) && !this.townsfolk?.at.has(k);
  }

  /** A step from (x0, y0) to the neighbour (x1, y1): free, and no ledge in between. */
  canStep(x0, y0, x1, y1) { return this.walkable(x1, y1) && this.map.canStep(x0, y0, x1, y1); }

  face(dir) {
    this.facing = dir;
    this.player.anims.stop();
    this.player.setFrame(this.idleFrame(dir));
  }

  /** About-turn: flash the side view for a beat before facing `dir`. */
  pivotThrough(dir) {
    const side = dir === 'up' || dir === 'down' ? (this.stepParity ? 'left' : 'right') : 'down';
    this.player.setFrame(this.idleFrame(side));
    this.time.delayedCall(60, () => { if (!this.moving && this.facing === dir) this.player.setFrame(this.idleFrame(dir)); });
  }

  /** A little kicked-up dust at (x, y). */
  puff(x, y, n = 4) {
    for (let i = 0; i < n; i++) {
      const d = this.add.ellipse(x + looseRng.int(-5, 5), y - 1, 4, 3, 0xd8c8a4, 0.75).setDepth(y + 0.6);
      this.tweens.add({
        targets: d, x: d.x + looseRng.int(-9, 9), y: d.y - looseRng.int(2, 6), scaleX: 2.2, scaleY: 1.8, alpha: 0,
        duration: looseRng.int(320, 520), ease: 'Sine.easeOut', onComplete: () => d.destroy(),
      });
    }
  }

  /** Footprints in sand: two soft prints that fade out. */
  footprint(x, y, dir) {
    const [dx, dy] = DELTA[dir];
    const side = this.stepParity ? 1 : -1;
    const px = x + (dy ? side * 3 : 0);
    const py = y - 2 + (dx ? side * 1.5 : 0);
    const f = this.add.ellipse(px, py, dy ? 3 : 4, dy ? 4 : 2.5, 0x8a6e45, 0.4).setDepth(-4);
    this.tweens.add({ targets: f, alpha: 0, delay: 2600, duration: 1800, onComplete: () => f.destroy() });
  }

  updateMusic(force = false) {
    if (this.indoors) {
      if (force) music(this.hallTrack());
      return;
    }
    const night = isNight(this.save.stats.playMs);
    if (force || night !== this.nightMusic) {
      this.nightMusic = night;
      music(night ? 'night' : 'day');
    }
  }

  // ------------------------------------------------------------------- update
  update(time, delta) {
    if (!this.save) return;
    this.ambient?.update(time, delta);
    this.townsfolk?.update(time);
    if (!this.locked) this.updateMusic();
    if (this.moving || this.locked || !this.focus.isTop()) return;
    if (this.pendingClick) { const c = this.pendingClick; this.pendingClick = null; this.planTo(c.x, c.y); }
    const dir = heldDirection();
    if (this.path) {
      if (dir) this.clearPath();                 // the keyboard takes over
      else { this.followPath(); return; }
    }
    if (!dir) {
      if (Number(this.player.frame.name) !== this.idleFrame(this.facing)) this.face(this.facing);
      if (time - this.lastMoveEnd > 120) this.lastRun = false;
      return;
    }
    const continuing = time - this.lastMoveEnd < 60;
    if (dir !== this.facing) {
      const turnBack = OPPOSITE[dir] === this.facing;
      this.face(dir);
      if (!continuing) {
        // turning on the spot; turning right round passes through a side
        // frame first, so the body visibly pivots
        if (turnBack) this.pivotThrough(dir);
        this.turnUntil = time + (turnBack ? 120 : 90);
        return;
      }
      if (turnBack && this.lastRun) this.puff(this.player.x, this.player.y, 5);   // skidding round
    }
    if (time < this.turnUntil) return;
    this.tryStep(dir);
  }

  tryStep(dir) {
    const [dx, dy] = DELTA[dir];
    const nx = this.pos.x + dx;
    const ny = this.pos.y + dy;
    if (!this.canStep(this.pos.x, this.pos.y, nx, ny)) {
      this.face(dir);
      if (this.time.now > this.bumpCooldown) {
        this.bumpCooldown = this.time.now + 350;
        if (!this.interactAt(nx, ny, true)) sfx('bump');
      }
      return;
    }
    this.moving = true;
    this.stepTo = { x: nx, y: ny };       // townspeople keep out of it
    // the Hall before Cooker falls: no running, a slower, heavier step
    const tense = this.indoors && !this.save.defeated.cooker;
    const running = !tense && (isHeld('run') || !!this.path?.run);
    // stairs: a measured climb (or descent), one soft footfall per step
    const stairs = this.map.elev[ny][nx] !== this.map.elev[this.pos.y][this.pos.x];
    const WALK = WALK_MS * (tense ? 1.45 : 1) * (stairs ? 1.35 : 1);
    if (stairs) sfx('footstep');
    // Frames are locked to the tile step, like the handheld games: each tile is
    // one step (alternating feet); running shows contact then airborne frames.
    this.stepParity = !this.stepParity;
    const row = ROWS.indexOf(dir) * (this.registry.get('playerFrames') ?? 7);
    const seq = running
      ? (this.stepParity ? [3, 4] : [5, 6])
      : (this.stepParity ? [1, 0] : [2, 0]);
    this.player.anims.stop();
    this.player.setFrame(row + seq[0]);
    const dur = running ? RUN_MS : WALK;
    const t0 = this.time.now;
    // breaking into a run kicks up a little dust
    if (running && !this.lastRun) this.puff(this.player.x, this.player.y, 4);
    this.lastRun = running;
    if (this.map.ground[this.pos.y]?.[this.pos.x] === 'sand') this.footprint(this.player.x, this.player.y, dir);
    if (!this.path) used(running ? 'run' : 'move');      // the controls legend learns as you go
    if (this.map.isEncounter(nx, ny)) {
      // the rustle starts as you push in, the blades shake mid-stride
      sfx('grass', { run: running });
      this.time.delayedCall(dur * 0.5, () => this.rustle(nx, ny));
    }
    const from = this.standAt(this.pos.x, this.pos.y);
    const to = this.standAt(nx, ny);
    const prog = { k: 0 };
    this.tweens.add({
      targets: prog,
      k: 1,
      duration: dur,
      onUpdate: () => {
        const k = prog.k;
        const second = k >= (running ? 0.5 : 0.55);
        this.player.setFrame(row + seq[second ? 1 : 0]);
        this.player.setPosition(from.x + (to.x - from.x) * k, from.y + (to.y - from.y) * k);
        this.player.setDepth(from.depth + (to.depth - from.depth) * k + 0.5);
        // airborne run frames: the shadow tightens under the feet
        this.shadow.setScale(running && second ? 0.82 : 1);
        this.shadow.setPosition(this.player.x, this.player.y - 1).setDepth(this.player.depth - 0.2);
      },
      onComplete: () => {
        this.pos = { x: nx, y: ny };
        this.moving = false;
        this.stepTo = null;
        this.shadow.setScale(1);
        this.lastMoveEnd = this.time.now;
        this.syncPlayer();
        this.afterStep();
      },
    });
  }

  afterStep() {
    const s = this.save;
    s.pos = { x: this.pos.x, y: this.pos.y, facing: this.facing };
    if (this.indoors) {
      if (this.pos.x === HALL.exit.x && this.pos.y === HALL.exit.y) { this.runLocked(() => this.warp(HALL.out)); return; }
      if (this.hallStep()) return;
    }
    s.stats.steps += 1;
    this.unlockCheckpoints();
    if (s.stats.steps % 25 === 0) writeSave();
    this.checkZone();
    if (this.map.isEncounter(this.pos.x, this.pos.y) && looseRng.chance(ENCOUNTER_RATE)) this.startWild();
  }

  checkZone() {
    const z = zoneAt(this.pos.y, this.pos.x);
    if (z.id !== this.zoneId) {
      this.zoneId = z.id;
      this.ui.showZone?.(z.name);
    }
  }

  sparkleHidden() {
    const view = this.cameras.main.worldView;
    for (const it of this.itemAt.values()) {
      if (!it.hidden || !looseRng.chance(0.55)) continue;
      const f = this.tileFoot(it.x, it.y);
      if (!view.contains(f.x, f.y)) continue;
      const s = this.add.image(f.x + looseRng.int(-5, 5), f.y - 8, 'spark').setDepth(f.y + 1).setScale(0.2).setAlpha(0.95);
      this.tweens.add({ targets: s, scale: 0.9, angle: 90, alpha: 0, duration: 650, ease: 'Sine.easeOut', onComplete: () => s.destroy() });
    }
  }

  // ------------------------------------------------------------ mouse / tap
  // Click a tile to walk there; click a trainer, item, sign, door or landmark
  // to walk up to it and use it. Long trips run. A direction key takes over.
  onPointer(p) {
    if (this.locked || !this.focus.isTop() || p.rightButtonDown()) return;
    if (this.ui?.input.hitTestPointer(p).length) return;     // a HUD button took it
    // (the pointer is shared by every scene: map the screen point through our camera)
    const w = this.cameras.main.getWorldPoint(p.x, p.y);
    if (this.moving) { this.pendingClick = { x: w.x, y: w.y }; return; }
    this.planTo(w.x, w.y);
  }

  /** What a click at world (wx, wy) means: a thing to use, or a tile to reach. */
  pickTarget(wx, wy) {
    // characters and capsules are tall: hit their sprites, not just the tile
    const person = this.townsfolk?.personUnder(wx, wy);
    if (person) return { use: true, x: person.x, y: person.y, person };
    for (const [k, id] of this.npcAt) {
      const s = this.npcSprites[id];
      if (s?.getBounds().contains(wx, wy)) { const [x, y] = k.split(',').map(Number); return { use: true, x, y }; }
    }
    for (const it of this.itemAt.values()) {
      const s = this.itemSprites.get(it.id);
      if (s?.getBounds().contains(wx, wy)) return { use: true, x: it.x, y: it.y };
    }
    const x = Math.floor(wx / TILE_W);
    const y = Math.floor(wy / TILE_H);
    if (x < 0 || y < 0 || x >= this.map.w || y >= this.map.h) return null;
    if (this.walkable(x, y)) return { use: false, x, y };
    const k = this.map.key(x, y);
    const folk = this.townsfolk?.at.get(k);
    if (folk) return { use: true, x: folk.x, y: folk.y, person: folk };
    const usable = this.npcAt.has(k) || this.itemAt.has(k) || this.map.doors.has(k) || this.map.signs.has(k)
      || this.map.lore.has(k) || (x === HALL.gate.x && y === HALL.gate.y);
    if (usable) return { use: true, x, y };
    // a wall or a roof: the nearest open tile to where you clicked
    for (let r = 1; r <= 3; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.abs(dx) + Math.abs(dy) !== r) continue;
          if (this.walkable(x + dx, y + dy)) return { use: false, x: x + dx, y: y + dy };
        }
      }
    }
    return null;
  }

  planTo(wx, wy) {
    const t = this.pickTarget(wx, wy);
    if (!t) return;
    let goals;
    if (t.use) {
      const k = this.map.key(t.x, t.y);
      // doors and the Hall gate are used from below, facing up; the rest from any side
      const fromBelow = this.map.doors.has(k) || (t.x === HALL.gate.x && t.y === HALL.gate.y);
      goals = (fromBelow ? [[0, 1]] : [[0, 1], [0, -1], [-1, 0], [1, 0]]).map(([dx, dy]) => ({ x: t.x + dx, y: t.y + dy }));
    } else goals = [{ x: t.x, y: t.y }];
    const steps = this.findPath(goals);
    if (!steps) { sfx('bump'); return; }
    this.path = { steps, goals, use: t.use ? { x: t.x, y: t.y, person: t.person } : null, run: steps.length > 6 };
    used('click');
    this.markTarget(t);
    if (!steps.length) this.followPath();
  }

  /** Breadth-first search over walkable tiles to the nearest goal: a list of tiles. */
  findPath(goals) {
    const W = this.map.w;
    const want = new Set(goals.filter((g) => g.x === this.pos.x && g.y === this.pos.y || this.walkable(g.x, g.y)).map((g) => g.y * W + g.x));
    if (!want.size) return null;
    const start = this.pos.y * W + this.pos.x;
    const prev = new Map([[start, -1]]);
    const queue = [start];
    for (let qi = 0; qi < queue.length && qi < 6000; qi++) {
      const cur = queue[qi];
      if (want.has(cur)) {
        const out = [];
        for (let c = cur; c !== start; c = prev.get(c)) out.push({ x: c % W, y: Math.floor(c / W) });
        return out.reverse();
      }
      const cx = cur % W;
      const cy = Math.floor(cur / W);
      for (const [dx, dy] of Object.values(DELTA)) {
        const nx = cx + dx;
        const ny = cy + dy;
        const n = ny * W + nx;
        if (prev.has(n) || !this.canStep(cx, cy, nx, ny)) continue;
        prev.set(n, cur);
        queue.push(n);
      }
    }
    return null;
  }

  followPath() {
    const path = this.path;
    const next = path.steps.shift();
    if (!next) {
      this.path = null;
      if (path.use?.person) { this.reachPerson(path); return; }
      if (path.use) {
        const { x, y } = path.use;
        const dir = x < this.pos.x ? 'left' : x > this.pos.x ? 'right' : y < this.pos.y ? 'up' : 'down';
        this.face(dir);
        this.interactAt(x, y, false);
      }
      return;
    }
    const dir = next.x < this.pos.x ? 'left' : next.x > this.pos.x ? 'right' : next.y < this.pos.y ? 'up' : 'down';
    if (!this.canStep(this.pos.x, this.pos.y, next.x, next.y)) {
      // someone wandered across the path: find a way round them
      if (this.townsfolk?.personAt(next.x, next.y) && (path.replans ?? 0) < 4) {
        const steps = this.findPath(path.goals);
        if (steps?.length) { this.path = { ...path, steps, replans: (path.replans ?? 0) + 1 }; return; }
      }
      this.clearPath(); this.face(dir); return;
    }
    this.facing = dir;
    this.tryStep(dir);
  }

  /** End of a walk to a townsperson: talk if they are still next to us,
   *  otherwise follow them (they wait for you, so this settles quickly). */
  reachPerson(path) {
    const p = path.use.person;
    const dx = p.x - this.pos.x;
    const dy = p.y - this.pos.y;
    if (Math.abs(dx) + Math.abs(dy) === 1) {
      this.face(dx < 0 ? 'left' : dx > 0 ? 'right' : dy < 0 ? 'up' : 'down');
      this.interactAt(p.x, p.y, false);
      return;
    }
    if ((path.replans ?? 0) >= 4) return;
    const goals = [[0, 1], [0, -1], [-1, 0], [1, 0]].map(([gx, gy]) => ({ x: p.x + gx, y: p.y + gy }));
    const steps = this.findPath(goals);
    if (steps) this.path = { ...path, steps, goals, replans: (path.replans ?? 0) + 1 };
  }

  clearPath() {
    this.path = null;
    this.pendingClick = null;
    this.marker?.destroy();
    this.marker = null;
  }

  /** A soft ring where you clicked. */
  markTarget(t) {
    this.marker?.destroy();
    const f = this.tileFoot(t.x, t.y);
    const ring = this.add.ellipse(f.x, f.y - 3, 22, 9).setStrokeStyle(1.5, t.use ? 0xffc94a : 0x2ef2a8, 0.9).setDepth(f.y - 1);
    this.marker = ring;
    this.tweens.add({ targets: ring, scaleX: 1.35, scaleY: 1.35, alpha: 0, duration: 650, ease: 'Sine.easeOut', onComplete: () => { ring.destroy(); if (this.marker === ring) this.marker = null; } });
  }

  // -------------------------------------------------------------- interaction
  onAction(a) {
    if (this.locked || this.moving) return;
    if (a === 'confirm') {
      used('use');
      const [dx, dy] = DELTA[this.facing];
      this.interactAt(this.pos.x + dx, this.pos.y + dy, false);
    } else if (a === 'menu') {
      used('menu');
      sfx('open');
      this.runLocked(() => this.ui.pauseMenu());
    }
  }

  async runLocked(fn) {
    this.clearPath();
    this.locked = true;
    this.player.anims.stop();
    this.player.setFrame(this.idleFrame(this.facing));
    try { await fn(); } finally { this.locked = false; }
    this.ui.refreshHud();
  }

  /** Returns true when something handled the interaction. */
  interactAt(x, y, bumped) {
    const k = this.map.key(x, y);
    const trainerId = this.npcAt.get(k);
    if (trainerId) { this.runLocked(() => this.talkTrainer(trainerId)); return true; }
    // townspeople chat when you face them and press confirm (walking into them just bumps)
    const person = this.townsfolk?.at.get(k);
    if (person) { if (bumped) return false; this.runLocked(() => this.townsfolk.talk(person)); return true; }
    const item = this.itemAt.get(k);
    if (item && (!bumped || !item.hidden)) { this.runLocked(() => this.pickItem(item)); return true; }
    const door = this.map.doors.get(k);
    if (door && (bumped ? this.facing === 'up' : true)) { this.runLocked(() => this.enterDoor(door)); return true; }
    if (x === HALL.gate.x && y === HALL.gate.y && this.facing === 'up') { this.runLocked(() => this.hallGate()); return true; }
    if (bumped) return false;
    const sign = this.map.signs.get(k);
    if (sign) { sfx('confirm'); this.runLocked(() => this.ui.say(sign.split('\n').join(' '), { speaker: 'SIGN' })); return true; }
    const lore = this.map.lore.get(k);
    if (lore) { sfx('confirm'); this.runLocked(() => this.ui.say(lore)); return true; }
    return false;
  }

  async pickItem(item) {
    const def = ITEMS[item.item];
    this.itemAt.delete(this.map.key(item.x, item.y));
    const spr = this.itemSprites.get(item.id);
    if (spr) {
      this.tweens.killTweensOf(spr);
      this.tweens.add({ targets: spr, y: spr.y - 16, alpha: 0, duration: 260, onComplete: () => spr.destroy() });
    }
    this.save.pickedItems.push(item.id);
    this.save.bag[item.item] = (this.save.bag[item.item] ?? 0) + 1;
    writeSave();
    sfx('item');
    await this.ui.say(`${this.save.player.name} found ${/^[AEIOU]/i.test(def.name) ? 'an' : 'a'} ${def.name.toUpperCase()}!`, { banner: def.name });
  }

  async talkTrainer(id, { noticed = false } = {}) {
    const s = this.save;
    const name = trainerName(s.teams, id).toUpperCase();
    const design = s.teams[id].design;
    const portrait = `trainer_${design}_battle`;
    const voice = personality(design);
    if (s.defeated[id]) {
      // what they think of you now, plus where to head next
      await this.ui.say([...voice.after, ...(id === 'cooker' ? [] : objective(s))], { speaker: name, portrait });
      return;
    }
    if (!noticed) {
      sfx('spotted');
      music(id === 'cooker' ? 'cookerEncounter' : themeFor('encounter', design));
      await this.exclaim(this.npcSprites[id]);
    }
    // the road-block Elite won't fight until the side-path Elites are beaten
    const missing = (TRAINERS[id].requires ?? []).filter((r) => !s.defeated[r]);
    if (missing.length) {
      const names = missing.map((r) => trainerName(s.teams, r));
      const list = names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names[0];
      const lines = voice.blocked.map((l) => l.replace('{LIST}', list).replace('{VERB}', names.length > 1 ? 'are' : 'is'));
      await this.ui.say(lines, { speaker: name, portrait });
      this.updateMusic(true);
      return;
    }
    await this.ui.say(s.stats.lostTo?.[id] ? voice.rematch : voice.intro, { speaker: name, portrait });
    // under-levelled (or not evolved for the Hall)? They tell you, and let you back out
    const warn = warning(s, id, design);
    if (warn.length) {
      await this.ui.say(warn, { speaker: name, portrait });
      const pick = await this.ui.ask(voice.ask, ['BATTLE', 'NOT YET'], { speaker: name, portrait });
      if (pick !== 0) {
        await this.ui.say(voice.wait, { speaker: name, portrait });
        if (id === 'cooker') await this.leaveHall();
        else this.updateMusic(true);
        return;
      }
    }
    if (id === 'cooker') {
      sfx('flare');
      this.cameras.main.flash(260, 255, 244, 220);
      this.cameras.main.shake(520, 0.01);
      await wait(this, 420);
    }
    await this.startBattle({ kind: 'trainer', trainerId: id });
  }

  async exclaim(target) {
    const bubble = this.add.image(target.x, target.y - target.displayHeight - 6, 'exclaim').setOrigin(0.5, 1).setDepth(100000).setScale(0.2);
    this.tweens.add({ targets: bubble, scale: 1, duration: 180, ease: 'Back.easeOut' });
    await wait(this, 700);
    bubble.destroy();
  }

  async enterDoor(door) {
    if (door.kind === 'rest') {
      const cam = this.cameras.main;
      sfx('door');
      cam.fadeOut(250);
      await wait(this, 300);
      fullRestore(this.save.party[0]);
      this.save.respawn = { x: door.x, y: door.y + 1, facing: 'down' };
      const cp = CHECKPOINTS.find((c) => c.near && c.x === door.x && c.y === door.y + 1);
      if (cp && !this.save.checkpoints.includes(cp.id)) this.save.checkpoints.push(cp.id);
      writeSave();
      cam.fadeIn(250);
      sfx('heal');
      await this.ui.say(['Welcome to the Solace!', 'Your partner is fully rested. Stop by any time.', '(Game saved. You will wake up here if you black out.)'], { speaker: 'SOLACE' });
      const [first, ...more] = objective(this.save);
      await this.ui.say([`Word around the Solace: ${first}`, ...more], { speaker: 'SOLACE' });
      return;
    }
    if (door.kind === 'house') {
      const lore = this.map.lore.get(this.map.key(door.x, door.y));
      await this.ui.say(lore ?? looseRng.pick(["It's locked. Nobody seems to be home.", 'The door is locked.', 'You hear a TV inside, but nobody answers.', 'A dog barks from somewhere inside. The door stays shut.']));
      return;
    }
    // Elite Hall: sealed until the four route Elites are beaten, then the
    // doors open onto the Hall itself, where Cooker waits.
    const missing = ['t1', 't2', 't3', 't4'].filter((id) => !this.save.defeated[id]);
    if (missing.length) {
      sfx('bump');
      const names = missing.map((id) => trainerName(this.save.teams, id));
      await this.ui.say(`Four crests are set into the doors. ${4 - missing.length} of them glow.`);
      await this.ui.say(`Still dark: ${names.join(', ')}.`);
      return;
    }
    sfx('door');
    this.hallReset();
    await this.warp(HALL.entry);
    if (!this.save.defeated.cooker) {
      // the doors slam behind you; the Hall is dark
      sfx('hallDoors');
      this.cameras.main.shake(420, 0.004);
      this.dustBurst(26);
      // no narration in here: the dark and the braziers tell it
    }
  }

  /** Teleport (fade out / in) to a tile; the camera clamps to that area. */
  async warp(to) {
    const cam = this.cameras.main;
    cam.fadeOut(260, 0, 0, 0);
    await wait(this, 280);
    this.pos = { x: to.x, y: to.y };
    this.facing = to.facing ?? this.facing;
    this.face(this.facing);
    this.syncPlayer();
    this.applyArea();
    this.save.pos = { ...this.pos, facing: this.facing };
    this.checkZone();
    this.updateMusic(true);
    cam.fadeIn(300, 0, 0, 0);
    await wait(this, 300);
  }

  /** Outdoors vs the Hall interior: camera bounds, backdrop, lighting flag. */
  applyArea() {
    const cam = this.cameras.main;
    this.indoors = this.pos.x >= OUTDOOR_W;
    if (this.indoors) {
      // headroom above the back wall, so the gate can be framed clear of the HUD
      cam.setBounds(HALL.x0 * TILE_W, (HALL.y0 - 3) * TILE_H, (HALL.x1 - HALL.x0 + 1) * TILE_W, (HALL.y1 - HALL.y0 + 5) * TILE_H);
      cam.setBackgroundColor('#08080f');
    } else {
      cam.setBounds(0, 0, OUTDOOR_W * TILE_W, this.map.h * TILE_H);
      cam.setBackgroundColor('#2c6a3a');
    }
    const tense = this.indoors && !this.save.defeated.cooker;
    this.ui?.cinema?.(tense);
    if (this.hallDust) this.hallDust.emitting = this.indoors;
  }

  /** Up the stairs and forward up the carpet: the gate behind the dais opens
   *  and Cooker walks out of the light to meet you. */
  cookerArrives() {
    this.cookerMet = true;
    this.runLocked(async () => {
      const spr = this.npcSprites.cooker;
      const shadow = this.npcSprites.cooker_shadow;
      const cam = this.cameras.main;
      const gate = this.gateImg;
      const panTo = (x, y, ms) => new Promise((res) => cam.pan(x, y, ms, 'Sine.easeInOut', false, (_c, t) => { if (t === 1) res(); }));
      music(null);
      this.ui.hud?.(false);
      cam.stopFollow();
      // the camera rises to the gate (no zoom: pixel art at an in-between zoom shimmers)
      const door = this.standAt(HALL.gate.x, HALL.gate.y);
      await panTo(door.x, door.y - 10, 1500);
      await wait(this, 350);
      // light leaks round the doors; the Hall shudders; they open
      this.gateLeak?.destroy();
      const leak = this.gateLeak = this.add.image(door.x, door.y - 34, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0xffd890)
        .setScale(0.5, 1.2).setAlpha(0).setDepth(gate.depth + 1);
      sfx('hallDoors');
      cam.shake(800, 0.0035);
      await tween(this, { targets: leak, alpha: 0.75, duration: 800, ease: 'Sine.easeIn' });
      const m = tilesMeta.props.hall_gate_open;
      gate.setTexture('hall_gate_open').setOrigin(m.ax / m.w, m.ay / m.h);
      this.setGateLight(true);
      cam.flash(260, 255, 226, 170);
      this.dustBurst(30);
      this.tweens.add({ targets: leak, scaleX: 1.1, scaleY: 1.6, alpha: 0.35, duration: 900, ease: 'Cubic.easeOut' });
      await wait(this, 500);
      // Cooker, a silhouette against the light, steps out and down to the dais
      spr.setPosition(door.x, door.y).setDepth(door.depth + 0.4).setAlpha(0).setTint(0x140f20);
      shadow?.setPosition(door.x, door.y - 1).setAlpha(0);
      await tween(this, { targets: spr, alpha: 1, duration: 450 });
      const spot = TRAINER_SPOTS.cooker;
      const to = this.standAt(spot.x, spot.y);
      sfx('footstep');
      const shade = { k: 0 };
      await tween(this, {
        targets: shade, k: 1, duration: 700, ease: 'Sine.easeInOut',
        onUpdate: () => {
          spr.setPosition(door.x + (to.x - door.x) * shade.k, door.y + (to.y - door.y) * shade.k).setDepth(door.depth + (to.depth - door.depth) * shade.k + 0.4);
          const c = Phaser.Display.Color.Interpolate.ColorWithColor({ r: 20, g: 15, b: 32 }, { r: 255, g: 255, b: 255 }, 100, shade.k * 100);
          spr.setTint(Phaser.Display.Color.GetColor(c.r, c.g, c.b));
          shadow?.setPosition(spr.x, spr.y - 1).setDepth(spr.depth - 0.5).setAlpha(0.28 * shade.k);
        },
      });
      spr.clearTint().setDepth(to.depth);
      this.npcAt.set(this.map.key(spot.x, spot.y), 'cooker');
      // every flame in the Hall answers him
      this.ignite(3, { flare: true });
      await wait(this, 700);
      sfx('spotted');
      music('cookerEncounter');
      await this.exclaim(spr);
      // back to the two of you
      const me = this.standAt(this.pos.x, this.pos.y);
      await panTo((me.x + to.x) / 2, (me.y + to.y) / 2 - 20, 700);
      cam.startFollow(this.player, true, 1, 1, 0, TILE_H / 2);
      const dir = spot.x < this.pos.x ? 'left' : spot.x > this.pos.x ? 'right' : 'up';
      this.face(dir);
      await wait(this, 250);
      await this.talkTrainer('cooker', { noticed: true });
      this.ui.hud?.(true);
    });
  }

  /** Unlock checkpoints: Elites you've beaten, Solaces you've reached. */
  unlockCheckpoints() {
    unlockCheckpoints(this.save, this.indoors ? null : this.pos);
  }

  nearestCheckpoint(from) {
    return nearestCheckpoint(this.map, this.save.checkpoints, from);
  }

  hallTrack() {
    if (this.save.defeated.cooker) return 'hof';
    if (this.cookerMet) return 'cookerEncounter';
    return this.hallStage >= 2 ? 'hallWalk2' : 'hallWalk';
  }

  /** The Hall as you find it: cold braziers, dark, Cooker a silhouette on the dais
   *  (or, once he's beaten, every flame burning). */
  hallReset() {
    const lit = !!this.save.defeated.cooker;
    this.hallStage = 0;
    this.hallLight = lit ? 1 : 0.18;
    this.aisle.forEach((pair) => pair?.forEach((b) => this.setFlame(b, lit)));
    // before he falls, Cooker waits behind the closed gate; after, it stands open
    const ck = this.npcSprites.cooker;
    const sh = this.npcSprites.cooker_shadow;
    if (ck) {
      ck.clearTint().setAlpha(lit ? 1 : 0);
      sh?.setAlpha(lit ? 0.28 : 0);
      if (!lit) for (const [k, v] of this.npcAt) if (v === 'cooker') this.npcAt.delete(k);
    }
    this.gateLeak?.destroy();
    this.gateLeak = null;
    this.setGateLight(lit);
    if (this.gateImg) {
      const key = lit ? 'hall_gate_open' : 'hall_gate';
      const m = tilesMeta.props[key];
      this.gateImg.setTexture(key).setOrigin(m.ax / m.w, m.ay / m.h);
    }
  }

  /** The open gate's light spilling onto the dais (a light pool for the atmosphere pass). */
  setGateLight(on) {
    if (!this.gateLight) {
      const door = this.standAt(HALL.gate.x, HALL.gate.y);
      this.gateLight = { x: door.x, y: door.y - 30, r: 46, color: 0xffd890 };
    }
    const i = this.lights.indexOf(this.gateLight);
    if (on && i < 0) this.lights.push(this.gateLight);
    if (!on && i >= 0) this.lights.splice(i, 1);
  }

  /** Light (or put out) one brazier: a flickering flame, embers and its light pool. */
  setFlame(b, on) {
    b.lights.forEach((l) => { l.off = !on; });
    if (!on) { b.flame?.forEach((o) => o.destroy()); b.flame = null; return; }
    if (b.flame) return;
    if (!this.textures.exists('flame')) makeFlameTexture(this);
    const d = b.img.depth + 0.5;
    const halo = this.add.image(b.fx, b.fy - 6, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0xff9a40).setScale(0.32).setAlpha(0.55).setDepth(d);
    const outer = this.add.image(b.fx, b.fy + 2, 'flame').setOrigin(0.5, 1).setScale(0.5).setDepth(d).setTint(0xff8a30);
    const inner = this.add.image(b.fx, b.fy + 2, 'flame').setOrigin(0.5, 1).setScale(0.3, 0.32).setDepth(d + 0.1).setTint(0xfff0b0);
    const flick = (img, sx, sy) => this.tweens.add({
      targets: img, scaleX: { from: sx * 0.9, to: sx * 1.08 }, scaleY: { from: sy * 0.82, to: sy * 1.12 },
      duration: looseRng.int(120, 190), yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: looseRng.int(0, 150),
    });
    flick(outer, 0.5, 0.5); flick(inner, 0.3, 0.32);
    this.tweens.add({ targets: halo, alpha: 0.35, scale: 0.36, duration: 260, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    const embers = this.add.particles(b.fx, b.fy - 10, 'spark', {
      x: { min: -3, max: 3 }, speedY: { min: -26, max: -12 }, speedX: { min: -5, max: 5 }, lifespan: { min: 600, max: 1100 },
      scale: { start: 0.06, end: 0 }, alpha: { start: 0.9, end: 0 }, tint: [0xffc060, 0xff7a30], frequency: 220, blendMode: 'ADD',
    }).setDepth(d + 0.2);
    b.flame = [halo, outer, inner, embers];
  }

  /** Light aisle pair n (3 = the dais pair; flare = every flame at once). */
  ignite(n, { flare = false } = {}) {
    const pairs = flare ? this.aisle.map((_, i) => i) : [n];
    sfx(flare ? 'flare' : 'ignite');
    for (const i of pairs) {
      for (const b of this.aisle[i] ?? []) {
        const wasCold = !b.flame;
        this.setFlame(b, true);
        if (!wasCold && !flare) continue;
        const burst = this.add.image(b.fx, b.fy - 8, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0xffb050).setDepth(b.img.depth + 1).setScale(0.1).setAlpha(0.95);
        this.tweens.add({ targets: burst, scale: flare ? 1.3 : 0.8, alpha: 0, duration: flare ? 900 : 650, ease: 'Cubic.easeOut', onComplete: () => burst.destroy() });
        for (let k = 0; k < (flare ? 12 : 8); k++) {
          const e = this.add.image(b.fx + looseRng.int(-3, 3), b.fy - 4, 'spark').setBlendMode(Phaser.BlendModes.ADD).setTint(0xffc060).setDepth(b.img.depth + 1).setScale(0.1);
          this.tweens.add({ targets: e, x: e.x + looseRng.int(-12, 12), y: e.y - looseRng.int(16, 40), alpha: 0, scale: 0.02, duration: looseRng.int(500, 900), ease: 'Sine.easeOut', onComplete: () => e.destroy() });
        }
      }
    }
    const target = flare ? 1 : Math.min(0.75, 0.18 + (n + 1) * 0.17);
    this.tweens.add({ targets: this, hallLight: target, duration: flare ? 500 : 900, ease: 'Sine.easeOut' });
    if (flare) {
      this.cameras.main.flash(380, 255, 190, 120);
      this.cameras.main.shake(600, 0.006);
      this.dustBurst(40);
    }
  }

  /** One step of the walk up the carpet. Returns true when it took over. */
  hallStep() {
    const s = this.save;
    if (s.defeated.cooker || this.cookerMet) return false;
    const y = this.pos.y;
    HALL.igniteRows.forEach((row, n) => {
      if (y <= row && this.hallStage <= n) {
        this.hallStage = n + 1;
        this.ignite(n);
        if (n === 1) music('hallWalk2');             // halfway: the heart speeds up
      }
    });
    if (y <= HALL.revealRow) { this.cookerArrives(); return true; }
    return false;
  }

  /** Dust drifting down through the Hall's light. */
  buildHallDust() {
    const w = (HALL.x1 - HALL.x0 + 1) * TILE_W;
    this.hallDust = this.add.particles(0, 0, 'spark', {
      x: { min: HALL.x0 * TILE_W, max: HALL.x0 * TILE_W + w }, y: { min: HALL.y0 * TILE_H, max: (HALL.y1 - 4) * TILE_H },
      speedY: { min: 3, max: 9 }, speedX: { min: -3, max: 3 }, lifespan: 5200,
      scale: { min: 0.03, max: 0.07 }, alpha: { start: 0.75, end: 0 },
      tint: [0xe8dcff, 0xffe0b0], frequency: 90, blendMode: 'ADD',
    }).setDepth(90000);
    this.hallDust.emitting = false;
  }

  dustBurst(n) {
    const view = this.cameras.main.worldView;
    for (let i = 0; i < n; i++) {
      const d = this.add.image(view.x + looseRng.int(0, view.width), view.y + looseRng.int(0, 40), 'spark')
        .setBlendMode(Phaser.BlendModes.ADD).setTint(0xd8ccf0).setScale(0.05).setAlpha(0.8).setDepth(90001);
      this.tweens.add({ targets: d, y: d.y + looseRng.int(60, 160), x: d.x + looseRng.int(-10, 10), alpha: 0, duration: looseRng.int(1400, 2600), ease: 'Sine.easeIn', onComplete: () => d.destroy() });
    }
  }

  /** Turned back by Cooker: out through the doors, and he returns to his throne. */
  async leaveHall() {
    this.cookerMet = false;
    this.cameras.main.setZoom(WORLD_ZOOM);
    this.placeTrainer('cooker', TRAINER_SPOTS.cooker);
    this.hallReset();
    await this.warp(HALL.out);
  }

  async hallGate() {
    if (!this.save.defeated.cooker) {
      await this.ui.say('A tall gate of gold and glass. Beyond it, names are carved into the walls of the Hall of Fame.');
      await this.ui.say("It won't open while the Hall's champion still stands.");
      return;
    }
    sfx('door');
    this.goHallOfFame();
  }

  // ------------------------------------------------------------------- battles
  startWild() {
    const z = zoneAt(this.pos.y, this.pos.x);
    const species = looseRng.weighted(poolFor(z, isNight(this.save.stats.playMs)));
    const level = looseRng.int(z.levels[0], z.levels[1]);
    const foe = createCreature(species, level, looseRng);
    this.runLocked(async () => {
      // something bursts out of the grass: jolt, leaves, a quick push-in
      const cam = this.cameras.main;
      const f = this.tileFoot(this.pos.x, this.pos.y);
      for (let i = 0; i < 14; i++) {
        const leaf = this.add.rectangle(f.x + looseRng.int(-10, 10), f.y - looseRng.int(2, 10), 2, 1, looseRng.pick([0x9be07a, 0x5fae52, 0xd8c466])).setDepth(f.y + 3);
        this.tweens.add({ targets: leaf, x: leaf.x + looseRng.int(-26, 26), y: leaf.y - looseRng.int(10, 30), angle: looseRng.int(-360, 360), alpha: 0, duration: 520, ease: 'Cubic.easeOut', onComplete: () => leaf.destroy() });
      }
      this.rustle(this.pos.x, this.pos.y);
      sfx('grass', { run: true });
      cam.shake(220, 0.006);
      this.tweens.add({ targets: cam, zoom: WORLD_ZOOM * 1.18, duration: 520, ease: 'Cubic.easeIn' });
      await wait(this, 260);
      await this.startBattle({ kind: 'wild', foes: [foe], zone: z.id });
    });
  }

  startBattle(cfg) {
    return new Promise((resolve) => {
      this.clearPath();
      this.locked = true;
      this.pendingBattle = resolve;
      this.player.anims.stop();
      this.player.setFrame(this.idleFrame(this.facing));
      music(cfg.trainerId === 'cooker' ? 'boss'
        : cfg.kind === 'trainer' ? themeFor('battle', this.save.teams[cfg.trainerId].design)
          : 'battle');
      this.ui.battleWipe(cfg.kind, () => {
        this.save.stats.battles += 1;
        let data = cfg;
        if (cfg.kind === 'trainer') {
          // Always battle the team rolled into the save - never re-roll (see teams.js).
          const team = structuredClone(this.save.teams[cfg.trainerId].creatures);
          data = { ...cfg, foes: team };
        }
        this.scene.sleep('OverworldUI');
        this.scene.sleep('Atmosphere');
        this.scene.launch('Battle', data);
        this.scene.pause();
      });
    });
  }

  async onBattleEnd(res) {
    if (!res) return;
    const s = this.save;
    this.scene.wake('OverworldUI');
    this.scene.wake('Atmosphere');
    this.ui.clearWipe();
    this.ui.hud?.(true);
    this.cameras.main.setZoom(WORLD_ZOOM);
    this.cameras.main.fadeIn(350);
    if (res.result !== 'lose') this.updateMusic(true);   // after a loss the lament plays out first
    const done = this.pendingBattle;
    this.pendingBattle = null;
    const finish = () => { writeSave(); this.ui.refreshHud(); this.locked = false; done?.(); };

    if (res.result === 'lose') {
      s.stats.losses += 1;
      if (res.kind === 'trainer' && res.trainerId) {
        s.stats.lostTo = s.stats.lostTo ?? {};
        s.stats.lostTo[res.trainerId] = (s.stats.lostTo[res.trainerId] ?? 0) + 1;
      }
      fullRestore(s.party[0]);
      // back to the nearest checkpoint you've unlocked - saved or not
      const cp = this.nearestCheckpoint(this.indoors ? HALL.out : this.pos) ?? { ...s.respawn, label: 'safety' };
      this.pos = { x: cp.x, y: cp.y };
      this.facing = cp.facing ?? 'down';
      s.pos = { x: cp.x, y: cp.y, facing: this.facing };
      this.face(this.facing);
      this.syncPlayer();
      this.applyArea();
      if (res.trainerId === 'cooker') { this.cookerMet = false; this.placeTrainer('cooker', TRAINER_SPOTS.cooker); this.hallReset(); }
      this.checkZone();
      await this.ui.say([`You hurried back to ${cp.label}...`, 'Your partner was restored to full health.']);
      this.updateMusic(true);
      finish();
      return;
    }
    if (res.result === 'win' && res.kind === 'wild') {
      s.stats.wildWins += 1;
      if (looseRng.chance(WILD_DROP_CHANCE)) {
        s.bag.potion = (s.bag.potion ?? 0) + 1;
        sfx('item');
        await this.ui.say('You found a POTION in the grass!');
      }
    }
    if (res.result === 'win' && res.kind === 'trainer') {
      const id = res.trainerId;
      const def = TRAINERS[id];
      const pts = awardTrainer(s, id);
      this.unlockCheckpoints();
      // first defeat line was said in battle; the rest here, then the route hint
      const rest = personality(s.teams[id].design).defeat.slice(1);
      if (rest.length) await this.ui.say(rest, { speaker: trainerName(s.teams, id).toUpperCase(), portrait: `trainer_${s.teams[id].design}_battle` });
      if (pts) await this.ui.say(`You earned ${pts} points! Total score: ${s.score}.`, { banner: `+${pts}` });
      for (const [item, n] of Object.entries(def.reward ?? {})) {
        s.bag[item] = (s.bag[item] ?? 0) + n;
        sfx('item');
        await this.ui.say(`Received ${n} ${ITEMS[item].name.toUpperCase()}${n > 1 ? 'S' : ''}!`);
      }
      // ...and, still in their voice, where to go next
      if (id !== 'cooker') await this.ui.say(objective(s), { speaker: trainerName(s.teams, id).toUpperCase(), portrait: `trainer_${s.teams[id].design}_battle` });
      if (TRAINER_SPOTS[id]) this.placeTrainer(id, TRAINER_SPOTS[id]);
      if (id === 'cooker') {
        // run complete: freeze the clear time (the leaderboard metric)
        s.run.clearMs = s.run.ms;
        s.run.clearedAt = new Date().toISOString();
        s.hallOfFame = {
          at: s.run.clearedAt,
          score: s.score,
          clearMs: s.run.clearMs,
          team: structuredClone(s.party),
          playMs: s.stats.playMs,
        };
        writeSave();
        this.ui.refreshHud();
        done?.();
        this.goHallOfFame();
        return;
      }
    }
    finish();
  }

  goHallOfFame() {
    this.locked = true;
    // stand just outside the door when we come back
    this.save.pos = { x: this.pos.x, y: this.pos.y, facing: 'down' };
    writeSave();
    const cam = this.cameras.main;
    cam.fadeOut(600, 255, 255, 255);
    cam.once('camerafadeoutcomplete', () => this.scene.start('HallOfFame'));
  }
}

/** A teardrop flame, tinted per layer at runtime (white core, drawn once). */
function makeFlameTexture(scene) {
  const W = 24;
  const H = 40;
  const t = scene.textures.createCanvas('flame', W, H);
  const ctx = t.getContext();
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.75)');
  g.addColorStop(1, 'rgba(255,255,255,1)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(W / 2, 0);
  ctx.bezierCurveTo(W * 0.62, H * 0.3, W, H * 0.55, W * 0.86, H * 0.82);
  ctx.bezierCurveTo(W * 0.76, H, W * 0.24, H, W * 0.14, H * 0.82);
  ctx.bezierCurveTo(0, H * 0.55, W * 0.38, H * 0.3, W / 2, 0);
  ctx.fill();
  t.refresh();
}
