// Leaderboard: the season's fastest clears (api/leaderboard). Opens over the
// title screen. Ten a page: left/right (or the arrows) to page, ESC / BACK to
// close. Your own row glows; the paid places show their share of the pool.
import Phaser from 'phaser';
import { GAME_W, GAME_H } from '../config.js';
import { SPECIES } from '../data/creatures.js';
import { getSave, loadSave } from '../systems/save.js';
import { fetchLeaderboard, resubmitIfNeeded, shortWallet } from '../systems/leaderboard.js';
import { formatRun } from '../systems/world.js';
import { pushFocus } from '../systems/controls.js';
import { sfx } from '../systems/audio.js';
import { panel, text } from '../ui/theme.js';
import { tapButton } from '../ui/helpers.js';

const PAGE = 10;
const COLS = { rank: 78, name: 112, wallet: 252, time: 436, mon: 566, status: 690, pay: 872 };
const MEDAL = ['#ffd257', '#d7dcef', '#e09a5c'];

export const fmtSol = (x) => `${Number(x).toLocaleString('en-US', { maximumFractionDigits: x < 1 ? 4 : 2 })} SOL`;

export class LeaderboardScene extends Phaser.Scene {
  constructor() { super('Leaderboard'); }

  create() {
    this.save = getSave() ?? loadSave();
    this.add.rectangle(0, 0, GAME_W, GAME_H, 0x05040c, 0.62).setOrigin(0).setInteractive();
    panel(this, 36, 22, GAME_W - 72, GAME_H - 44, 'gold');
    text(this, 66, 40, 'LEADERBOARD', 34, '#ffc94a', { fontStyle: 'bold' });
    this.seasonT = text(this, GAME_W - 66, 46, '', 20, '#c9c2ff', { fontStyle: 'bold' }).setOrigin(1, 0);
    this.subT = text(this, 66, 84, 'Fastest clears this season', 18, '#a8acd6');
    const head = (x, s, o = 0) => text(this, x, 118, s, 15, '#8f93c4', { fontStyle: 'bold' }).setOrigin(o, 0);
    head(COLS.rank, '#', 0.5); head(COLS.name, 'TRAINER'); head(COLS.time, 'TIME', 0.5); head(COLS.mon, 'PARTNER', 0.5);
    head(COLS.status, 'STATUS', 0.5); head(COLS.pay, 'PAYOUT', 1);
    this.rowsLayer = this.add.container(0, 0);
    this.msg = text(this, GAME_W / 2, 320, 'Loading…', 22, '#fff7e6', { align: 'center', wordWrap: { width: 700 } }).setOrigin(0.5);
    this.you = text(this, 66, 536, '', 17, '#2ef2a8', { fontStyle: 'bold' });
    this.pageT = text(this, GAME_W / 2 - 60, 588, '', 16, '#a8acd6').setOrigin(0.5);
    this.prev = tapButton(this, GAME_W / 2 - 230, 588, '◀', () => this.turn(-1), { w: 64, h: 40, size: 22, style: 'chip', color: '#2ef2a8' });
    this.next = tapButton(this, GAME_W / 2 + 110, 588, '▶', () => this.turn(1), { w: 64, h: 40, size: 22, style: 'chip', color: '#2ef2a8' });
    tapButton(this, GAME_W - 140, 588, 'BACK', () => this.close(), { w: 150, h: 44, size: 22 });
    this.page = 0;
    this.release = pushFocus((a) => {
      if (a === 'left') this.turn(-1);
      else if (a === 'right') this.turn(1);
      else if (a === 'cancel' || a === 'menu' || a === 'confirm') this.close();
    }, this);
    this.load_();
  }

  async load_() {
    this.msg.setText('Loading…').setVisible(true);
    await resubmitIfNeeded(this.save);          // a clear that never reached the board goes up first
    const res = await fetchLeaderboard(this.page * PAGE, PAGE);
    if (!this.sys.isActive()) return;
    this.rowsLayer.removeAll(true);
    if (!res.ok) {
      this.msg.setText(`${res.error}\n\nTry again in a moment.`);
      this.pageT.setText('');
      return;
    }
    this.data_ = res;
    const pool = res.poolSol > 0 ? `Prize pool ${fmtSol(res.poolSol)} · top ${res.paidPlaces} paid` : 'Prize pool to be announced';
    const ends = res.endsAt ? ` · ends ${new Date(res.endsAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}` : '';
    this.seasonT.setText(`${res.seasonName.toUpperCase()}${res.open ? '' : ' · CLOSED'}`);
    this.subT.setText(`Fastest clears · ${pool}${ends}`);
    const pages = Math.max(1, Math.ceil(res.total / PAGE));
    this.pageT.setText(res.total ? `Page ${this.page + 1} of ${pages} · ${res.total} trainer${res.total === 1 ? '' : 's'}` : '');
    this.prev.setAlpha(this.page > 0 ? 1 : 0.35);
    this.next.setAlpha(this.page < pages - 1 ? 1 : 0.35);
    if (!res.entries.length) {
      this.msg.setText('No clears yet this season.\nBeat COOKER to set the first time!');
    } else this.msg.setVisible(false);

    const mine = this.save?.player?.wallet ? shortWallet(this.save.player.wallet) : null;
    res.entries.forEach((e, i) => {
      const y = 146 + i * 39;
      const me = mine && e.wallet === mine && e.name === (this.save.player.name ?? '').toUpperCase();
      const g = this.add.graphics();
      g.fillStyle(me ? 0x2ef2a8 : 0xffffff, me ? 0.16 : i % 2 ? 0.035 : 0.07).fillRoundedRect(56, y - 3, GAME_W - 112, 35, 8);
      if (me) g.lineStyle(2, 0x2ef2a8, 0.8).strokeRoundedRect(56, y - 3, GAME_W - 112, 35, 8);
      const col = e.rank <= 3 ? MEDAL[e.rank - 1] : '#fff7e6';
      const status = e.status === 'verified' ? ['VERIFIED', '#2ef2a8'] : ['PENDING', '#ffc94a'];
      const pay = e.payoutSol > 0 ? fmtSol(e.payoutSol) : e.rank <= res.paidPlaces ? 'TBA' : '—';
      const mon = SPECIES[e.starter]?.name ?? '—';
      this.rowsLayer.add([
        g,
        text(this, COLS.rank, y + 4, `${e.rank}`, 20, col, { fontStyle: 'bold' }).setOrigin(0.5, 0),
        text(this, COLS.name, y + 4, e.name, 20, me ? '#2ef2a8' : '#fff7e6', { fontStyle: 'bold' }),
        text(this, COLS.wallet, y + 8, e.wallet, 13, '#8f93c4'),
        text(this, COLS.time, y + 4, formatRun(e.clearMs), 20, col).setOrigin(0.5, 0),
        text(this, COLS.mon, y + 6, mon, 17, '#c9c2ff').setOrigin(0.5, 0),
        text(this, COLS.status, y + 7, status[0], 15, status[1], { fontStyle: 'bold' }).setOrigin(0.5, 0),
        text(this, COLS.pay, y + 5, pay, 18, e.payoutSol > 0 ? '#ffc94a' : '#7a7ea0', { fontStyle: 'bold' }).setOrigin(1, 0),
      ]);
    });

    // your own standing, whatever page this is
    const s = this.save;
    if (!s?.run?.clearMs) this.you.setText(s ? 'Your best: no clear yet. Beat COOKER to get on the board!' : 'Start a game and beat COOKER to get on the board!').setColor('#a8acd6');
    else if (s.run.submitted) this.you.setText(`Your best: ${formatRun(s.run.submitted.clearMs)}  ·  EARNINGS shows where you stand and what you've been paid.`).setColor('#2ef2a8');
    else this.you.setText(`Your best: ${formatRun(s.run.clearMs)}  ·  not on the board yet: ${s.run.submitError ?? 'will retry'}`).setColor('#ffc94a');
    this.you.setWordWrapWidth(GAME_W - 132);
  }

  turn(d) {
    const res = this.data_;
    if (!res) return;
    const pages = Math.max(1, Math.ceil(res.total / PAGE));
    const p = Phaser.Math.Clamp(this.page + d, 0, pages - 1);
    if (p === this.page) { sfx('bump'); return; }
    this.page = p;
    sfx('cursor');
    this.load_();
  }

  close() {
    this.release?.();
    sfx('cancel');
    this.scene.stop();
  }
}
