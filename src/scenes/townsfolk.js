// Townspeople (data/townsfolk.js): they amble about their patch of the route,
// glance at you when you come close, and chat when you face them and press
// confirm or click them. They block the tile they stand on (and the one they
// are stepping into), never step where you are going, and stand still while
// a conversation, a menu or a battle is open.
import { CHAR_SCALE } from '../config.js';
import { TOWNSFOLK } from '../data/townsfolk.js';
import { CHECKPOINTS, PLAYER_START } from '../data/map.js';
import { looseRng } from '../systems/rng.js';
import { sfx } from '../systems/audio.js';
import sprites from '../data/townsfolkSprites.json' with { type: 'json' };

const DELTA = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const OPPOSITE = { up: 'down', down: 'up', left: 'right', right: 'left' };
const STEP_MS = 330;          // an amble: slower than the player's walk

export class Townsfolk {
  constructor(scene) {
    this.scene = scene;
    this.at = new Map();      // tile key -> person (their tile, and the one they are stepping into)
    const map = scene.map;
    // tiles nobody loiters on: doorsteps, checkpoints, the start
    this.avoid = new Set([PLAYER_START, ...CHECKPOINTS].map((p) => map.key(p.x, p.y)));
    for (const k of map.doors.keys()) {
      const [x, y] = k.split(',').map(Number);
      this.avoid.add(map.key(x, y + 1));
    }
    this.people = TOWNSFOLK.map((def) => {
      const meta = sprites[def.id];
      const key = `towns_${def.id}`;
      const p = {
        def, meta, key, x: def.home.x, y: def.home.y, dir: 'down', moving: false,
        next: scene.time.now + looseRng.int(400, 2600), talks: 0, parity: false,
      };
      const f = scene.standAt(p.x, p.y);
      p.shadow = scene.add.ellipse(f.x, f.y - 1, 20, 7, 0x0b1020, 0.28).setDepth(f.depth - 0.5);
      p.sprite = scene.add.sprite(f.x, f.y, key, this.frame(p, 0)).setOrigin(0.5, 1).setScale(CHAR_SCALE).setDepth(f.depth + 0.4);
      this.at.set(map.key(p.x, p.y), p);
      return p;
    });
  }

  frame(p, i, dir = p.dir) { return p.meta.rows.indexOf(dir) * p.meta.frames + i; }

  face(p, dir) { p.dir = dir; p.sprite.setFrame(this.frame(p, 0)); }

  personAt(x, y) { return this.at.get(this.scene.map.key(x, y)) ?? null; }

  /** The person whose sprite covers world point (wx, wy), if any. */
  personUnder(wx, wy) {
    return this.people.find((p) => p.sprite.visible && p.sprite.getBounds().contains(wx, wy)) ?? null;
  }

  update(time) {
    const s = this.scene;
    if (s.locked || s.indoors) return;
    for (const p of this.people) {
      if (p.moving || time < p.next) continue;
      p.next = time + looseRng.int(1300, 3800);
      // someone walking up to talk to them: they wait
      if (s.path?.use?.person === p) continue;
      const dx = s.pos.x - p.x;
      const dy = s.pos.y - p.y;
      const near = Math.abs(dx) + Math.abs(dy);
      if (near <= 3 && looseRng.chance(0.6)) {
        // you came close: they look your way
        this.face(p, Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'up' : 'down'));
        continue;
      }
      if (looseRng.chance(0.3)) { this.face(p, looseRng.pick(Object.keys(DELTA))); continue; }
      // a few steps the same way, now and then
      const dir = looseRng.chance(0.55) ? p.dir : looseRng.pick(Object.keys(DELTA));
      this.step(p, dir, looseRng.int(1, 3));
    }
  }

  canEnter(p, x, y) {
    const s = this.scene;
    const [x0, y0, x1, y1] = p.def.area;
    if (x < x0 || x > x1 || y < y0 || y > y1) return false;
    const k = s.map.key(x, y);
    if (this.avoid.has(k) || s.map.isEncounter(x, y) || s.map.signs.has(k)) return false;
    if (!s.walkable(x, y) || !s.map.canStep(p.x, p.y, x, y)) return false;
    // keep out of the player's way: their tile, the tile they are stepping
    // into, and the next few tiles of a clicked path
    if (x === s.pos.x && y === s.pos.y) return false;
    if (s.stepTo && s.stepTo.x === x && s.stepTo.y === y) return false;
    if (s.path?.steps.slice(0, 3).some((t) => t.x === x && t.y === y)) return false;
    return true;
  }

  step(p, dir, left) {
    const s = this.scene;
    const [dx, dy] = DELTA[dir];
    const nx = p.x + dx;
    const ny = p.y + dy;
    if (!this.canEnter(p, nx, ny)) { this.face(p, dir); return; }
    p.dir = dir;
    p.moving = true;
    p.parity = !p.parity;
    const nk = s.map.key(nx, ny);
    this.at.set(nk, p);                         // claim the tile before setting off
    const from = s.standAt(p.x, p.y);
    const to = s.standAt(nx, ny);
    const seq = p.parity ? [1, 0] : [2, 0];
    p.sprite.setFrame(this.frame(p, seq[0]));
    const prog = { k: 0 };
    s.tweens.add({
      targets: prog,
      k: 1,
      duration: STEP_MS,
      onUpdate: () => {
        const k = prog.k;
        p.sprite.setFrame(this.frame(p, seq[k >= 0.55 ? 1 : 0]));
        p.sprite.setPosition(from.x + (to.x - from.x) * k, from.y + (to.y - from.y) * k);
        p.sprite.setDepth(from.depth + (to.depth - from.depth) * k + 0.4);
        p.shadow.setPosition(p.sprite.x, p.sprite.y - 1).setDepth(p.sprite.depth - 0.9);
      },
      onComplete: () => {
        this.at.delete(s.map.key(p.x, p.y));
        p.x = nx;
        p.y = ny;
        p.moving = false;
        p.sprite.setFrame(this.frame(p, 0));
        // carry on a step or two, unless something came up
        if (left > 1 && !s.locked) s.time.delayedCall(40, () => { if (!p.moving && !s.locked) this.step(p, dir, left - 1); });
      },
    });
  }

  /** Called when the player talks to `p` (they face each other first). */
  async talk(p) {
    const s = this.scene;
    // let a step in progress land before turning round
    while (p.moving) await new Promise((r) => s.time.delayedCall(30, r));
    this.face(p, OPPOSITE[s.facing]);
    sfx('confirm');
    const convo = s.save.defeated.cooker && p.def.after
      ? p.def.after[p.talks % p.def.after.length]
      : p.def.lines[p.talks % p.def.lines.length];
    p.talks += 1;
    await s.ui.say(convo, { speaker: p.def.name, portrait: `${p.key}_face` });
    p.next = s.time.now + looseRng.int(1800, 3200);   // a moment's pause before they wander off
  }
}
