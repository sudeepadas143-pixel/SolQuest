// Capture helpers: drive the real SolQuest build (Vite dev server) in headless
// Chromium, frame by frame. The Phaser loop is put to sleep and stepped by hand
// with a fixed delta, so every captured frame is a real game frame and nothing
// is dropped however slow the screenshot is.
import fs from 'node:fs';
import path from 'node:path';

export const W = 960;
export const H = 640;

/** Installed into the page once: manual stepping, hide rules, event marks. */
export async function installHarness(page) {
  await page.evaluate(async () => {
    const g = window.__game;
    const L = g.loop;
    L.sleep();
    L.smoothStep = false;
    let T = L.lastTime;
    // Phaser's TweenManager times tweens with Date.now(), not the loop delta, so
    // the page gets a virtual wall clock that advances exactly with each step.
    // Without it every tween would run at the speed of the screenshots.
    const realNow = Date.now.bind(Date);
    const base = realNow();
    const cap = {
      gt: 0,                 // game-time ms since capture started
      events: [],
      menu: null,            // 'cmd' | 'move' | 'confirm' (battle UI waiting on input)
      menuSeq: 0,            // bumps every time a menu opens (two confirms in a row)
      hide: {},              // what to strip from frames (see prerender below)
      hideTrainers: [],      // overworld trainer ids to keep off screen
      dmgQueue: [],          // scripted battle outcomes (see damage hook)
      step(ms) {
        L.inFocus = true;
        L._coolDown = 0;
        T += ms;
        cap.gt += ms;
        L.step(T);
      },
      mark(type, data = {}) { cap.events.push({ type, gt: cap.gt, ...data }); },
    };
    window.__cap = cap;
    Date.now = () => base + cap.gt;

    // Hide rules are applied just before each render, so a DialogBox that
    // re-shows itself mid-step never reaches the frame.
    g.events.on('prerender', () => {
      const h = cap.hide;
      const ui = g.scene.getScene('OverworldUI');
      if (h.hud && ui?.locChip) {
        for (const k of ['locChip', 'timeChip', 'runChip', 'badgeChip', 'scoreText', 'hint', 'banner', 'toast']) ui[k]?.setVisible(false);
        ui.badges?.forEach((b) => b.setVisible(false));      // the Elite portrait row
      }
      const bs = g.scene.getScene('Battle');
      if (h.battleText && bs?.dialog) { bs.dialog.setVisible(false); bs.prompt?.setVisible(false); }
      const ev = g.scene.getScene('Evolution');
      if (h.evoText && ev?.box) ev.box.setVisible(false);
      const st = g.scene.getScene('Starter');
      if (h.starterText && st?.box) st.box.setVisible(false);
      const ow = g.scene.getScene('Overworld');
      if (ow?.npcSprites) {
        for (const id of cap.hideTrainers) {
          ow.npcSprites[id]?.setVisible(false);
          ow.npcSprites[`${id}_shadow`]?.setVisible(false);
        }
      }
    });

    // Battle hooks: mark every animation beat (with the target's on-screen box,
    // for damage numbers) and flag when the battle UI is waiting on input.
    const BS = g.scene.getScene('Battle').constructor.prototype;
    const box = (s) => { const b = s.getBounds(); return { x: b.x, y: b.y, w: b.width, h: b.height }; };
    const wrap = (name, fn) => {
      const orig = BS[name];
      BS[name] = function wrapped(...a) { fn.call(this, ...a); return orig.apply(this, a); };
    };
    wrap('animAttack', function (e) { cap.mark('attack', { side: e.side, moveType: e.moveType, category: e.category }); });
    wrap('animHit', function (e) { cap.mark('hit', { side: e.side, eff: e.eff, box: box(this.spriteOf(e.side)) }); });
    wrap('animHp', function (e) { cap.mark('hp', { side: e.side, from: e.from, to: e.to, max: e.max, box: box(this.spriteOf(e.side)) }); });
    wrap('animFaint', function (e) { cap.mark('faint', { side: e.side }); });
    wrap('animXp', function (e) { cap.mark('xp', { level: e.level }); });
    wrap('onLevelUp', function (e) { cap.mark('levelup', { level: e.level }); });
    wrap('statPanel', function () { cap.mark('statpanel'); });
    wrap('vsSplash', function () { cap.mark('vs'); });
    wrap('popIn', function (s) { cap.mark('popin', { side: s === this.meSprite ? 'player' : 'foe' }); });
    wrap('outro', function () { cap.mark('outro'); });
    const flag = (name, tag) => {
      const orig = BS[name];
      BS[name] = function flagged(...a) {
        cap.menu = tag;
        cap.menuSeq++;
        return orig.apply(this, a).then((v) => { cap.menu = null; return v; });
      };
    };
    flag('commandMenu', 'cmd');
    flag('chooseMove', 'move');
    flag('waitConfirm', 'confirm');

    // Scripted outcomes: each queued entry sets the defender's HP after the
    // hit as a fraction of max (or 'ko'). Type effectiveness stays real.
    const { BattleEngine } = await import('/src/systems/battle.js');
    const { calcStats } = await import('/src/systems/creature.js');
    const dmg = BattleEngine.prototype.damage;
    BattleEngine.prototype.damage = function scripted(side, move) {
      const r = dmg.call(this, side, move);
      const s = cap.dmgQueue.shift();
      if (!s) return r;
      const def = this.side(side === 'player' ? 'foe' : 'player');
      const max = calcStats(def).hp;
      const target = s.to === 'ko' ? 0 : Math.round(max * s.to);
      return { dmg: Math.max(1, def.hp - target), eff: r.eff, crit: false };
    };
  });
}

/** Step one frame and read back what the autopilot needs to know. */
export async function stepState(page, ms) {
  return page.evaluate(async (ms) => {
    const c = window.__cap;
    c.step(ms);
    // let the promise chains the step resolved run (menus open, turns advance)
    // before reading state, so the autopilot never presses into a stale screen
    await new Promise((r) => setTimeout(r, 0));
    const g = window.__game;
    const bs = g.scene.getScene('Battle');
    const ev = g.scene.getScene('Evolution');
    const ui = g.scene.getScene('OverworldUI');
    const on = (k) => g.scene.isActive(k);
    return {
      gt: c.gt,
      menu: c.menu,
      menuSeq: c.menuSeq,
      battle: on('Battle'),
      evo: on('Evolution'),
      overworld: on('Overworld'),
      arrow: !!((on('Battle') && (bs.dialog?.arrow.visible || bs.prompt?.arrow.visible))
        || (on('Evolution') && ev.box?.arrow.visible)
        || (on('OverworldUI') && ui.box?.arrow.visible)),
      locked: g.scene.getScene('Overworld')?.locked ?? null,
    };
  }, ms);
}

export class Plate {
  constructor(root, name) {
    this.name = name;
    this.dir = path.join(root, name);
    fs.rmSync(this.dir, { recursive: true, force: true });
    fs.mkdirSync(this.dir, { recursive: true });
    this.frames = [];
    this.gt0 = null;
  }

  async shoot(page, gt) {
    const i = this.frames.length;
    if (this.gt0 === null) this.gt0 = gt;
    const file = path.join(this.dir, `${String(i).padStart(4, '0')}.png`);
    await page.screenshot({ path: file, clip: { x: 0, y: 0, width: W, height: H }, caret: 'initial' });
    this.frames.push(+(gt - this.gt0).toFixed(3));
  }
}
