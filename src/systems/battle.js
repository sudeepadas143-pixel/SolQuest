// Pure battle logic (no Phaser). A turn returns a list of events that the
// BattleScene plays back as text + animations. Also used headless by
// tools/balance_sim.mjs to check the difficulty curve.
import { SPECIES } from '../data/creatures.js';
import { MOVES } from '../data/moves.js';
import { ITEMS } from '../data/items.js';
import { effectiveness } from '../data/types.js';
import { calcStats, displayName, gainXp, xpReward, xpForLevel } from './creature.js';

const STRUGGLE = { name: 'Struggle', type: 'none', category: 'physical', power: 50, acc: 100, pp: 1, recoil: 0.25 };

const freshStages = () => ({ atk: 0, def: 0, spa: 0, spd: 0, spe: 0 });
const stageMult = (s) => (s >= 0 ? (2 + s) / 2 : 2 / (2 - s));

export class BattleEngine {
  /**
   * @param {object} o
   * @param {object} o.player   player's creature instance (mutated)
   * @param {object[]} o.foes   opposing creatures (mutated)
   * @param {'wild'|'trainer'} o.kind
   * @param {'wild'|'trainer'|'boss'} o.ai
   * @param {object} o.bag      item counts (mutated)
   * @param {Rng} o.rng
   * @param {string} [o.trainerName]
   */
  constructor({ player, foes, kind, ai = 'wild', bag = {}, rng, trainerName = '' }) {
    Object.assign(this, { player, foes, kind, ai, bag, rng, trainerName });
    this.foeIndex = 0;
    this.stages = { player: freshStages(), foe: freshStages() };
    this.runAttempts = 0;
    this.over = false;
    this.result = null;
    this.turns = 0;
  }

  get foe() { return this.foes[this.foeIndex]; }
  side(s) { return s === 'player' ? this.player : this.foe; }
  label(s) {
    const n = displayName(this.side(s)).toUpperCase();
    if (s === 'player') return n;
    return this.kind === 'wild' ? `The wild ${n}` : `The foe's ${n}`;
  }

  /** Main entry. action: {type:'move', index} | {type:'item', item} | {type:'run'} */
  turn(action) {
    if (this.over) return [];
    this.turns += 1;
    const ev = [];
    const foeMove = this.chooseFoeMove();

    if (action.type === 'run') {
      if (this.tryRun(ev)) return ev;
      this.executeMove('foe', foeMove, ev);
      this.checkFaints(ev);
      return ev;
    }
    if (action.type === 'item') {
      this.useItem(action.item, ev);
      this.executeMove('foe', foeMove, ev);
      this.checkFaints(ev);
      return ev;
    }

    const playerMove = this.player.moves.every((m) => m.pp <= 0) ? 'struggle' : action.index;
    const order = this.order(playerMove, foeMove);
    for (const s of order) {
      const mv = s === 'player' ? playerMove : foeMove;
      if (this.side(s).hp <= 0 || this.side(s === 'player' ? 'foe' : 'player').hp <= 0) continue;
      this.executeMove(s, mv, ev);
      this.checkFaints(ev);
      if (this.over || ev.some((e) => e.t === 'sendout' && e.turn === this.turns)) break;
    }
    return ev;
  }

  moveData(side, idx) {
    if (idx === 'struggle') return STRUGGLE;
    return MOVES[this.side(side).moves[idx].id];
  }

  order(pIdx, fIdx) {
    const pm = this.moveData('player', pIdx);
    const fm = this.moveData('foe', fIdx);
    const pp = pm.priority ?? 0;
    const fp = fm.priority ?? 0;
    if (pp !== fp) return pp > fp ? ['player', 'foe'] : ['foe', 'player'];
    const ps = calcStats(this.player).spe * stageMult(this.stages.player.spe);
    const fs = calcStats(this.foe).spe * stageMult(this.stages.foe.spe);
    if (ps !== fs) return ps > fs ? ['player', 'foe'] : ['foe', 'player'];
    return this.rng.chance(0.5) ? ['player', 'foe'] : ['foe', 'player'];
  }

  /** Expected damage of a move, used by the AI. */
  estimate(attSide, move) {
    const att = this.side(attSide);
    const defSide = attSide === 'player' ? 'foe' : 'player';
    const def = this.side(defSide);
    if (move.category === 'status') return 0;
    const phys = move.category === 'physical';
    const as = calcStats(att);
    const ds = calcStats(def);
    const A = as[phys ? 'atk' : 'spa'] * stageMult(this.stages[attSide][phys ? 'atk' : 'spa']);
    const D = ds[phys ? 'def' : 'spd'] * stageMult(this.stages[defSide][phys ? 'def' : 'spd']);
    const stab = SPECIES[att.species].types.includes(move.type) ? 1.5 : 1;
    const eff = move.type === 'none' ? 1 : effectiveness(move.type, SPECIES[def.species].types);
    return move.power * (A / D) * stab * eff * (move.acc / 100);
  }

  chooseFoeMove() {
    const foe = this.foe;
    const usable = foe.moves.map((m, i) => ({ m, i })).filter(({ m }) => m.pp > 0);
    if (!usable.length) return 'struggle';
    const scored = usable.map(({ m, i }) => {
      const mv = MOVES[m.id];
      let score = this.estimate('foe', mv);
      if (mv.category === 'status') {
        const { target, stat, stages } = mv.effect;
        const cur = this.stages[target === 'self' ? 'foe' : 'player'][stat];
        score = Math.abs(cur + stages) <= 2 ? 25 : 1;
        if (this.turns > 3) score *= 0.4;
      }
      return { i, score };
    });
    const best = scored.reduce((a, b) => (b.score > a.score ? b : a));
    const greedy = { wild: 0.0, trainer: 0.75, boss: 0.92 }[this.ai] ?? 0;
    if (this.rng.chance(greedy)) return best.i;
    return this.rng.weighted(scored.map((s) => [s.i, s.score + 10]));
  }

  executeMove(side, idx, ev) {
    const att = this.side(side);
    const defSide = side === 'player' ? 'foe' : 'player';
    const def = this.side(defSide);
    const move = this.moveData(side, idx);
    if (idx !== 'struggle') att.moves[idx].pp = Math.max(0, att.moves[idx].pp - 1);

    ev.push({ t: 'text', text: `${this.label(side)} used ${move.name.toUpperCase()}!`, auto: true });
    ev.push({ t: 'attack', side, moveType: move.type, category: move.category });

    if (this.rng.float() * 100 >= move.acc) {
      ev.push({ t: 'text', text: `${this.label(side)}'s attack missed!` });
      return;
    }

    if (move.category === 'status') {
      const { target, stat, stages } = move.effect;
      const tSide = target === 'self' ? side : defSide;
      const cur = this.stages[tSide][stat];
      const next = Math.max(-6, Math.min(6, cur + stages));
      const statName = { atk: 'Attack', def: 'Defense', spa: 'Sp. Atk', spd: 'Sp. Def', spe: 'Speed' }[stat];
      if (next === cur) {
        ev.push({ t: 'text', text: `${this.label(tSide)}'s ${statName} won't go any ${stages > 0 ? 'higher' : 'lower'}!` });
      } else {
        this.stages[tSide][stat] = next;
        ev.push({ t: 'stat', side: tSide, up: stages > 0 });
        ev.push({ t: 'text', text: `${this.label(tSide)}'s ${statName} ${Math.abs(stages) > 1 ? 'sharply ' : ''}${stages > 0 ? 'rose' : 'fell'}!` });
      }
      return;
    }

    const { dmg, eff, crit } = this.damage(side, move);
    const from = def.hp;
    def.hp = Math.max(0, def.hp - dmg);
    if (eff === 0) {
      ev.push({ t: 'text', text: `It doesn't affect ${this.label(defSide)}...` });
      return;
    }
    ev.push({ t: 'hit', side: defSide, eff, crit, dmg });
    ev.push({ t: 'hp', side: defSide, from, to: def.hp, max: calcStats(def).hp });
    if (crit) ev.push({ t: 'text', text: 'A critical hit!' });
    if (eff > 1) ev.push({ t: 'text', text: "It's super effective!" });
    else if (eff < 1) ev.push({ t: 'text', text: "It's not very effective..." });

    if (move.drain && dmg > 0 && att.hp > 0) {
      const aMax = calcStats(att).hp;
      const f = att.hp;
      att.hp = Math.min(aMax, att.hp + Math.max(1, Math.floor((from - def.hp) * move.drain)));
      if (att.hp > f) {
        ev.push({ t: 'hp', side, from: f, to: att.hp, max: aMax });
        ev.push({ t: 'text', text: `${this.label(defSide)} had its energy drained!` });
      }
    }
    if (move.recoil && dmg > 0) {
      const f = att.hp;
      att.hp = Math.max(0, att.hp - Math.max(1, Math.floor(calcStats(att).hp * move.recoil)));
      ev.push({ t: 'hp', side, from: f, to: att.hp, max: calcStats(att).hp });
      ev.push({ t: 'text', text: `${this.label(side)} is hit with recoil!` });
    }
  }

  damage(side, move) {
    const att = this.side(side);
    const defSide = side === 'player' ? 'foe' : 'player';
    const def = this.side(defSide);
    const phys = move.category === 'physical';
    const as = calcStats(att);
    const ds = calcStats(def);
    const crit = this.rng.chance(1 / 16);
    // crits ignore the attacker's negative and defender's positive stages
    let aSt = this.stages[side][phys ? 'atk' : 'spa'];
    let dSt = this.stages[defSide][phys ? 'def' : 'spd'];
    if (crit) { aSt = Math.max(0, aSt); dSt = Math.min(0, dSt); }
    const A = as[phys ? 'atk' : 'spa'] * stageMult(aSt);
    const D = ds[phys ? 'def' : 'spd'] * stageMult(dSt);
    const base = Math.floor(Math.floor((Math.floor((2 * att.level) / 5 + 2) * move.power * A) / D) / 50) + 2;
    const stab = SPECIES[att.species].types.includes(move.type) ? 1.5 : 1;
    const eff = move.type === 'none' ? 1 : effectiveness(move.type, SPECIES[def.species].types);
    const roll = 0.85 + this.rng.float() * 0.15;
    const dmg = eff === 0 ? 0 : Math.max(1, Math.floor(base * stab * eff * (crit ? 1.5 : 1) * roll));
    return { dmg, eff, crit };
  }

  useItem(itemId, ev) {
    const item = ITEMS[itemId];
    if (!item || !(this.bag[itemId] > 0)) return;
    this.bag[itemId] -= 1;
    const max = calcStats(this.player).hp;
    const from = this.player.hp;
    this.player.hp = Math.min(max, from + item.heal);
    ev.push({ t: 'text', text: `You used a ${item.name.toUpperCase()}.` });
    ev.push({ t: 'hp', side: 'player', from, to: this.player.hp, max });
    ev.push({ t: 'text', text: `${this.label('player')} recovered ${this.player.hp - from} HP!` });
  }

  tryRun(ev) {
    if (this.kind !== 'wild') {
      ev.push({ t: 'text', text: "No! There's no running from an Elite battle!" });
      return false;
    }
    this.runAttempts += 1;
    const ps = calcStats(this.player).spe;
    const fs = calcStats(this.foe).spe;
    const p = Math.min(0.98, 0.45 + 0.35 * (ps / Math.max(1, fs)) + 0.15 * (this.runAttempts - 1));
    if (this.rng.chance(p)) {
      ev.push({ t: 'text', text: 'Got away safely!' });
      this.finish('run', ev);
      return true;
    }
    ev.push({ t: 'text', text: "Couldn't get away!" });
    return false;
  }

  checkFaints(ev) {
    if (this.over) return;
    if (this.foe.hp <= 0 && !this.foe._fainted) {
      this.foe._fainted = true;
      ev.push({ t: 'faint', side: 'foe' });
      ev.push({ t: 'text', text: `${this.label('foe')} fainted!` });
      if (this.player.hp > 0) this.awardXp(this.foe, ev);
      const next = this.foes.findIndex((f) => f.hp > 0);
      if (next === -1) {
        if (this.kind === 'trainer') ev.push({ t: 'text', text: `You defeated ${this.trainerName.toUpperCase()}!` });
        this.finish('win', ev);
        return;
      }
      this.foeIndex = next;
      this.stages.foe = freshStages();
      // the trainer's last creature: a line in their own voice first
      if (this.kind === 'trainer' && this.foes.length > 1 && this.foes.filter((f) => f.hp > 0).length === 1) ev.push({ t: 'taunt', key: 'lastMon' });
      ev.push({ t: 'text', text: `${this.trainerName.toUpperCase()} sent out ${displayName(this.foe).toUpperCase()}!`, auto: true });
      ev.push({ t: 'sendout', index: next, turn: this.turns });
    }
    if (this.player.hp <= 0 && !this.over) {
      ev.push({ t: 'faint', side: 'player' });
      ev.push({ t: 'text', text: `${this.label('player')} fainted!` });
      ev.push({ t: 'text', text: "You're out of usable creatures!" });
      ev.push({ t: 'text', text: 'You blacked out...' });
      this.finish('lose', ev);
    }
  }

  awardXp(foe, ev) {
    const c = this.player;
    const amount = xpReward(foe, { trainer: this.kind === 'trainer' });
    ev.push({ t: 'text', text: `${this.label('player')} gained ${amount} EXP. Points!` });
    const startLevel = c.level;
    const startXp = c.xp;
    const ups = gainXp(c, amount);
    // bar segments: fill to each threshold, then the remainder
    let lvl = startLevel;
    let xp = startXp;
    for (const up of ups) {
      ev.push({ t: 'xpbar', level: lvl, from: xp, to: xpForLevel(lvl + 1) });
      lvl = up.level;
      xp = xpForLevel(lvl);
      ev.push({ t: 'levelup', level: up.level, delta: up.delta, stats: up.stats, hpBefore: up.hpBefore });
      ev.push({ t: 'text', text: `${this.label('player')} grew to Lv. ${up.level}!` });
      if (up.healed) {
        ev.push({ t: 'heal', side: 'player', from: up.hpBefore, to: up.stats.hp, max: up.stats.hp });
        ev.push({ t: 'text', text: `${this.label('player')} was fully healed!` });
      }
      for (const m of up.newMoves) ev.push({ t: 'learn', moveId: m });
    }
    ev.push({ t: 'xpbar', level: lvl, from: xp, to: c.xp });
  }

  finish(result, ev) {
    this.over = true;
    this.result = result;
    ev.push({ t: 'end', result });
  }
}
