// Ambient life for the overworld - the small things that make the route feel
// lived in: the windmill turns, chimneys smoke, the fountain plays, the pond
// ripples (a fish jumps now and then), butterflies work the flower beds,
// birds peck on the paths and scatter when you come close, flocks cross the
// sky, leaves drift down from the trees; at night fireflies rise over the
// grass and moths circle the street lamps. Birdsong by day, crickets by night.
// Everything spawns only around the camera and is capped, so it costs next to
// nothing; nothing here affects gameplay.
import Phaser from 'phaser';
import { TILE_W, TILE_H, ART_SCALE } from '../config.js';
import tilesMeta from '../data/tiles.json' with { type: 'json' };
import { atmosphere } from '../systems/world.js';
import { looseRng } from '../systems/rng.js';
import { sfx } from '../systems/audio.js';

// chimney tops in model units (tools/props3d.py) and the footprint depth the
// sprite is anchored at; projected with the props' camera
const CHIMNEYS = {
  house_red: [61.5, 27, 65, 64], house_green: [61.5, 27, 65, 64], house_blue: [17.5, 27, 65, 64],
  house_hip: [63, 33, 58, 64], house_hip2: [63, 33, 58, 64], house_cabin: [59.5, 36, 58, 64],
};
const SKEW = -0.10;
const GY = 0.75;
const PITCH = 0.74;
const U = 4 / ART_SCALE;               // world units per model unit
const WINDMILL_FRAMES = 8;
/** A point of a prop model (model units) on screen, from the sprite's anchor
 *  (bx, by) = the footprint's bottom-left ground corner, depth D. */
const proj = (bx, by, D, x, y, z, skew = SKEW) => ({ x: bx + (x + skew * z) * U, y: by + (GY * (y - D) - PITCH * z) * U });

export class Ambient {
  constructor(scene) {
    this.s = scene;
    const map = scene.map;
    makeTextures(scene);
    // where things happen (tile lists)
    this.flowers = [];
    this.water = [];
    this.grass = [];
    this.paths = [];
    for (let y = 0; y < map.h; y++) {
      for (let x = 0; x < map.w; x++) {
        const g = map.ground[y][x];
        if (g === 'flowers') this.flowers.push([x, y]);
        else if (g === 'water') this.water.push([x, y]);
        else if (g === 'tall') this.grass.push([x, y]);
        else if ((g === 'walk' || g === 'plaza' || g === 'dirt') && !map.blocked[y][x]) this.paths.push([x, y]);
      }
    }
    this.chimneys = [];
    this.lamps = [];
    this.trees = [];
    this.windmills = [];
    for (const p of map.props) {
      const bx = p.x * TILE_W;
      const by = (p.y + p.h) * TILE_H;
      const ch = CHIMNEYS[p.type];
      if (ch) this.chimneys.push(proj(bx, by, ch[3], ch[0], ch[1], ch[2]));
      if (p.type === 'lamp') this.lamps.push(proj(bx, by, 16, 8, 13.5, 30, 0));            // the lantern
      if (p.type === 'fountain') this.fountain = proj(bx, by, 48, 24, 26, 21);             // the top jet
      if ((p.type === 'tree' || p.type === 'tree2' || p.type === 'tree3') && !p.border) this.trees.push({ x: bx + TILE_W, y: by - 40, fruit: p.type === 'tree3' });
      if (p.type === 'windmill') this.windmills.push(p);
    }
    // the windmill's sails turn over its tower
    for (const p of this.windmills) {
      const bx = p.x * TILE_W;
      const by = (p.y + p.h) * TILE_H;
      const m = tilesMeta.props.windmill_sails0;
      const img = scene.add.image(bx, by, 'windmill_sails0').setOrigin(m.ax / m.w, m.ay / m.h).setScale(1 / ART_SCALE).setDepth(by + 0.2);
      p.sails = img;
      p.frame = 0;
    }
    this.mills = this.windmills.filter((p) => p.sails);
    // the fountain: water leaps from the jet and falls back into the basin
    if (this.fountain) {
      const f = this.fountain;
      this.jet = scene.add.particles(f.x, f.y - 2, 'drop', {
        speedY: { min: -70, max: -48 }, speedX: { min: -16, max: 16 }, gravityY: 190,
        lifespan: { min: 620, max: 820 }, scale: { start: 0.7, end: 0.45 }, alpha: { start: 1, end: 0.5 },
        tint: [0xffffff, 0xe0f4ff, 0xb8e0ff], frequency: 16, quantity: 1,
      }).setDepth(f.y + 70);
      this.jet.emitting = false;
    }
    this.millTimer = 0;
    this.birds = [];          // pecking birds
    this.flies = [];          // butterflies / fireflies / moths
    this.timers = { smoke: 0, rip: 0, bfly: 0, bird: 0, flock: 9000, leaf: 0, chirp: 2000, fish: 6000, spray: 0, night: 0 };
  }

  get view() { return this.s.cameras.main.worldView; }
  inView(x, y, pad = 40) {
    const v = this.view;
    return x > v.x - pad && x < v.right + pad && y > v.y - pad && y < v.bottom + pad;
  }
  pickNear(list, pad = 0) {
    const v = this.view;
    const near = list.filter(([x, y]) => x * TILE_W > v.x - pad && x * TILE_W < v.right + pad && y * TILE_H > v.y - pad && y * TILE_H < v.bottom + pad);
    return near.length ? near[looseRng.int(0, near.length - 1)] : null;
  }

  update(time, delta) {
    const s = this.s;
    if (s.indoors || !s.save) return;
    const atm = atmosphere(s.save.stats.playMs);
    const night = atm.light > 0.45;
    const wet = atm.weather.kind === 'rain' || atm.weather.kind === 'storm';
    const T = this.timers;
    for (const k of Object.keys(T)) T[k] -= delta;

    // the windmill: faster when it storms
    this.millTimer -= delta;
    if (this.millTimer <= 0) {
      this.millTimer = atm.weather.kind === 'storm' ? 90 : wet ? 140 : 210;
      for (const p of this.mills) {
        p.frame = (p.frame + 1) % WINDMILL_FRAMES;
        const key = `windmill_sails${p.frame}`;
        const m = tilesMeta.props[key];
        p.sails.setTexture(key).setOrigin(m.ax / m.w, m.ay / m.h);
      }
    }
    // chimney smoke
    if (T.smoke <= 0) {
      T.smoke = 260;
      for (const c of this.chimneys) if (this.inView(c.x, c.y, 120)) this.smoke(c, night);
    }
    // the fountain plays (only while on screen)
    if (this.jet) this.jet.emitting = this.inView(this.fountain.x, this.fountain.y, 80);
    // pond ripples, and a fish now and then
    if (T.rip <= 0) {
      T.rip = wet ? 120 : 650;
      const w = this.pickNear(this.water);
      if (w) this.ripple(w[0] * TILE_W + looseRng.int(4, 28), w[1] * TILE_H + looseRng.int(4, 20), wet ? 0.5 : 1);
    }
    if (T.fish <= 0) {
      T.fish = looseRng.int(5000, 11000);
      const w = !night && !wet && this.pickNear(this.water, -40);
      if (w) this.fish(w[0] * TILE_W + 16, w[1] * TILE_H + 14);
    }
    // butterflies (fair days), fireflies and moths (nights)
    this.flies = this.flies.filter((f) => f.img.active);
    if (!wet && T.bfly <= 0) {
      T.bfly = 900;
      const n = this.flies.filter((f) => f.kind === 'bfly').length;
      if (!night && n < 6) { const f = this.pickNear(this.flowers, 60); if (f) this.butterfly(f[0], f[1]); }
      const nf = this.flies.filter((f) => f.kind === 'firefly').length;
      if (night && nf < 16) {
        const g = this.pickNear(looseRng.chance(0.3) ? this.water : this.grass, 40);
        if (g) this.firefly(g[0] * TILE_W + looseRng.int(0, 32), g[1] * TILE_H + looseRng.int(0, 24));
      }
    }
    if (night && !wet && T.night <= 0) {
      T.night = 1200;
      for (const l of this.lamps) {
        if (!this.inView(l.x, l.y)) continue;
        if (this.flies.filter((f) => f.kind === 'moth' && f.home === l).length < 2) this.moth(l);
      }
    }
    for (const f of this.flies) f.tick?.(time, delta);
    // birds on the paths: peck, hop - and scatter when you come close
    this.birds = this.birds.filter((b) => b.img.active);
    if (!night && !wet && T.bird <= 0) {
      T.bird = 2600;
      if (this.birds.length < 5) {
        const p = this.pickNear(this.paths, -30);
        if (p && Math.abs(p[0] - s.pos.x) + Math.abs(p[1] - s.pos.y) > 4) this.bird(p[0], p[1]);
      }
    }
    const me = s.player;
    for (const b of this.birds) {
      if (b.flying) continue;
      if (Phaser.Math.Distance.Between(me.x, me.y, b.img.x, b.img.y) < 54) this.flee(b);
      else if (!this.inView(b.img.x, b.img.y, 200)) { b.img.destroy(); b.shadow.destroy(); }
    }
    // a flock crosses the sky
    if (!night && !wet && T.flock <= 0) {
      T.flock = looseRng.int(16000, 30000);
      this.flock();
    }
    // leaves (and orchard petals) let go of the trees
    if (T.leaf <= 0) {
      T.leaf = wet ? 500 : 1100;
      const near = this.trees.filter((t) => this.inView(t.x, t.y, 20));
      if (near.length) this.leaf(looseRng.pick(near));
    }
    // birdsong by day, crickets at night
    if (T.chirp <= 0) {
      T.chirp = looseRng.int(2200, 5200);
      if (!wet) sfx(night ? 'cricket' : 'chirp');
    }
  }

  // ---------------------------------------------------------------- effects
  smoke(c, night) {
    const p = this.s.add.image(c.x + looseRng.int(-1, 1), c.y, 'puff').setDepth(c.y + 400).setAlpha(night ? 0.28 : 0.45).setScale(0.35).setTint(night ? 0x8a8aa0 : 0xe8e6ee);
    this.s.tweens.add({
      targets: p, x: p.x + looseRng.int(10, 22), y: p.y - looseRng.int(26, 40), scale: looseRng.int(10, 14) / 10, alpha: 0,
      duration: looseRng.int(2200, 3000), ease: 'Sine.easeOut', onComplete: () => p.destroy(),
    });
  }

  ripple(x, y, k = 1) {
    for (const [d, w] of [[0, 1.3], [260, 1]]) {
      const r = this.s.add.ellipse(x, y, 5, 2.4).setStrokeStyle(w, 0xeef9ff, 0.85 * k).setDepth(-6).setAlpha(0);
      this.s.tweens.add({ targets: r, scaleX: 4.2, scaleY: 4.2, alpha: { from: 1, to: 0 }, delay: d, duration: 1500, ease: 'Sine.easeOut', onComplete: () => r.destroy() });
    }
  }

  fish(x, y) {
    const f = this.s.add.image(x, y, 'fish').setDepth(y + 1).setScale(0.5);
    const dir = looseRng.chance(0.5) ? 1 : -1;
    f.setFlipX(dir < 0).setAngle(-50 * dir);
    this.s.tweens.add({ targets: f, x: x + dir * 18, duration: 620, ease: 'Linear' });
    this.s.tweens.add({ targets: f, angle: 50 * dir, duration: 620, ease: 'Linear' });
    this.s.tweens.add({ targets: f, y: y - 16, duration: 310, ease: 'Quad.easeOut', yoyo: true, onComplete: () => { f.destroy(); this.ripple(x + dir * 18, y, 1); this.ripple(x + dir * 18, y, 0.6); } });
    this.ripple(x, y, 1);
  }

  butterfly(tx, ty) {
    const s = this.s;
    const col = looseRng.pick([0xfff3a8, 0xffffff, 0xffb0d8, 0xa8d8ff, 0xffc070]);
    const img = s.add.image(tx * TILE_W + 16, ty * TILE_H + 8, 'bfly0').setTint(col).setScale(0.5).setAlpha(0);
    const f = { kind: 'bfly', img, home: [tx * TILE_W + 16, ty * TILE_H + 12], t: looseRng.int(0, 1000), life: looseRng.int(14000, 24000) };
    s.tweens.add({ targets: img, alpha: 1, duration: 400 });
    f.tick = (time, delta) => {
      f.t += delta;
      f.life -= delta;
      const a = f.t / 1000;
      const x = f.home[0] + Math.sin(a * 0.9) * 22 + Math.sin(a * 2.3) * 6;
      const y = f.home[1] + Math.cos(a * 0.7) * 10 - 12 + Math.sin(a * 5.1) * 3;
      img.setPosition(x, y).setDepth(f.home[1] + 30);
      img.setTexture(Math.sin(a * 22) > 0 ? 'bfly0' : 'bfly1');
      if (f.life < 0 && img.alpha === 1) s.tweens.add({ targets: img, alpha: 0, y: y - 30, duration: 800, onComplete: () => img.destroy() });
    };
    this.flies.push(f);
  }

  firefly(x, y) {
    const s = this.s;
    const img = s.add.rectangle(x, y, 1.6, 1.6, 0xf4ffb0).setDepth(y + 50).setAlpha(0);
    // its glow goes through the atmosphere's light pass, so it shines over the night grade
    const light = { x, y, r: 9, color: 0xd8ff70, a: 0 };
    s.lights.push(light);
    const f = { kind: 'firefly', img, x, y, t: looseRng.int(0, 4000), life: looseRng.int(7000, 13000) };
    f.tick = (time, delta) => {
      f.t += delta;
      f.life -= delta;
      const a = f.t / 1000;
      const px = f.x + Math.sin(a * 0.6) * 14;
      const py = f.y - 8 - a * 1.6 + Math.sin(a * 1.7) * 4;
      const pulse = Math.max(0, Math.sin(a * 2.4));
      const k = Math.min(1, f.life / 800) * (0.15 + 0.85 * pulse);
      img.setPosition(px, py).setAlpha(k);
      Object.assign(light, { x: px, y: py, a: k * 1.6 });
      if (f.life <= 0) {
        img.destroy();
        const i = s.lights.indexOf(light);
        if (i >= 0) s.lights.splice(i, 1);
      }
    };
    this.flies.push(f);
  }

  moth(l) {
    const s = this.s;
    const img = s.add.rectangle(l.x, l.y, 2, 1.5, 0xfff6e0, 1).setDepth(l.y + 80);
    const f = { kind: 'moth', img, home: l, t: looseRng.int(0, 3000), life: looseRng.int(9000, 16000), r: looseRng.int(5, 9) };
    f.tick = (time, delta) => {
      f.t += delta;
      f.life -= delta;
      const a = f.t / 1000;
      img.setPosition(l.x + Math.cos(a * 3.1) * f.r + Math.sin(a * 7.3) * 1.5, l.y + Math.sin(a * 2.6) * f.r * 0.6);
      if (f.life <= 0) img.destroy();
    };
    this.flies.push(f);
  }

  bird(tx, ty) {
    const s = this.s;
    const x = tx * TILE_W + looseRng.int(6, 26);
    const y = ty * TILE_H + looseRng.int(8, 20);
    const shadow = s.add.ellipse(x, y, 5, 2, 0x0b1020, 0.25).setDepth(y - 0.5);
    const img = s.add.image(x, y, 'bird_peck').setOrigin(0.5, 1).setScale(0.5).setDepth(y).setFlipX(looseRng.chance(0.5));
    const b = { img, shadow, flying: false };
    // peck... peck... hop
    b.loop = s.time.addEvent({
      delay: looseRng.int(500, 900), loop: true,
      callback: () => {
        if (b.flying || !img.active) return;
        if (looseRng.chance(0.3)) {
          const dx = looseRng.int(-6, 6);
          s.tweens.add({ targets: [img, shadow], x: `+=${dx}`, duration: 160 });
          s.tweens.add({ targets: img, y: img.y - 3, duration: 80, yoyo: true });
          img.setFlipX(dx < 0);
        } else {
          img.setTexture('bird_stand');
          s.time.delayedCall(140, () => { if (img.active && !b.flying) img.setTexture('bird_peck'); });
        }
      },
    });
    this.birds.push(b);
  }

  flee(b) {
    const s = this.s;
    b.flying = true;
    b.loop?.remove();
    const away = Math.sign(b.img.x - s.player.x) || 1;
    b.img.setFlipX(away < 0);
    let flap = 0;
    const ev = s.time.addEvent({ delay: 70, loop: true, callback: () => { if (b.img.active) b.img.setTexture(flap++ % 2 ? 'bird_up' : 'bird_down'); } });
    s.tweens.add({ targets: b.shadow, x: b.img.x + away * 120, alpha: 0, duration: 900 });
    s.tweens.add({
      targets: b.img, x: b.img.x + away * 140, y: b.img.y - 110, duration: 1100, ease: 'Quad.easeIn',
      onStart: () => b.img.setDepth(95000),
      onComplete: () => { ev.remove(); b.img.destroy(); b.shadow.destroy(); },
    });
  }

  flock() {
    const s = this.s;
    const v = this.view;
    const dir = looseRng.chance(0.5) ? 1 : -1;
    const y0 = v.y + looseRng.int(30, Math.max(40, v.height * 0.5));
    const x0 = dir > 0 ? v.x - 40 : v.right + 40;
    for (let i = 0; i < looseRng.int(4, 7); i++) {
      const off = [-Math.abs(i - 3) * 9 * dir, (i - 3) * 6];
      const img = s.add.image(x0 + off[0], y0 + off[1], 'bird_up').setScale(0.45).setDepth(96000).setFlipX(dir < 0).setTint(0x2a2c3a);
      const shadow = s.add.ellipse(img.x + 30, img.y + 90, 4, 1.6, 0x0b1020, 0.16).setDepth(-3);
      let flap = i;
      const ev = s.time.addEvent({ delay: 110, loop: true, callback: () => { if (img.active) img.setTexture(flap++ % 2 ? 'bird_up' : 'bird_down'); } });
      const dx = (v.width + 160) * dir;
      const dur = 7000 + i * 120;
      s.tweens.add({ targets: img, x: img.x + dx, y: img.y - 20, duration: dur, ease: 'Linear', onComplete: () => { ev.remove(); img.destroy(); } });
      s.tweens.add({ targets: shadow, x: shadow.x + dx, y: shadow.y - 20, duration: dur, ease: 'Linear', onComplete: () => shadow.destroy() });
    }
  }

  leaf(t) {
    const s = this.s;
    const col = t.fruit && looseRng.chance(0.6) ? looseRng.pick([0xffc8e0, 0xffffff]) : looseRng.pick([0x6fbf5a, 0x9bd16a, 0xd8c060]);
    const img = s.add.rectangle(t.x + looseRng.int(-18, 18), t.y + looseRng.int(-10, 6), 2, 1.4, col).setDepth(t.y + 200);
    const fall = looseRng.int(30, 54);
    s.tweens.add({ targets: img, y: img.y + fall, duration: 3200, ease: 'Sine.easeIn' });
    s.tweens.add({ targets: img, x: img.x + looseRng.int(14, 34), duration: 3200, ease: 'Sine.easeInOut' });
    s.tweens.add({ targets: img, angle: 540, duration: 3200 });
    s.tweens.add({ targets: img, alpha: 0, delay: 2500, duration: 700, onComplete: () => img.destroy() });
  }
}

/** Tiny pixel textures for the critters, drawn once. */
function makeTextures(scene) {
  if (scene.textures.exists('bfly0')) return;
  const px = (key, w, h, rows, palette) => {
    const t = scene.textures.createCanvas(key, w, h);
    const ctx = t.getContext();
    rows.forEach((row, y) => [...row].forEach((ch, x) => {
      if (ch === '.') return;
      ctx.fillStyle = palette[ch];
      ctx.fillRect(x, y, 1, 1);
    }));
    t.refresh();
  };
  // butterflies (white, tinted per individual): wings open / folded
  px('bfly0', 7, 5, ['ww.k.ww', 'wwwkwww', '.wwkww.', 'ww.k.ww', 'w..k..w'], { w: '#ffffff', k: '#3a2a2a' });
  px('bfly1', 7, 5, ['..wkw..', '..wkw..', '..wkw..', '..wkw..', '...k...'], { w: '#ffffff', k: '#3a2a2a' });
  // a small brown bird: pecking, standing, wings up / down in flight
  const B = { b: '#7a5a44', d: '#4a3428', o: '#e8b04a', e: '#101018', w: '#efe2cc' };
  px('bird_peck', 8, 6, ['........', '..bbb...', '.bbbbb..', 'dbbbbbbe', '..d.dbbo', '........'], B);
  px('bird_stand', 8, 6, ['...bbe..', '..bbbbo.', '.bbbbb..', 'dbbbbb..', '..d.d...', '........'], B);
  px('bird_up', 8, 6, ['b......b', '.b....b.', '..bbbb..', '.dbbbbeo', '........', '........'], B);
  px('bird_down', 8, 6, ['........', '........', '..bbbb..', '.dbbbbeo', '.b....b.', 'b......b'], B);
  // a silver fish
  px('fish', 9, 4, ['..sss....', '.sssssw.s', '.ssssss.s', '..sss....'], { s: '#c8d8e8', w: '#101018' });
  // a water droplet
  px('drop', 3, 3, ['.w.', 'www', '.w.'], { w: '#ffffff' });
  // a soft round smoke puff
  const t = scene.textures.createCanvas('puff', 24, 24);
  const ctx = t.getContext();
  const g = ctx.createRadialGradient(12, 12, 0, 12, 12, 12);
  g.addColorStop(0, 'rgba(255,255,255,0.9)');
  g.addColorStop(0.6, 'rgba(255,255,255,0.45)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 24, 24);
  t.refresh();
}
