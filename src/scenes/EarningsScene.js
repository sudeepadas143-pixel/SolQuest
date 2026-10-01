// Earnings: where your wallet stands this season and what it has been paid
// (api/player). Opens over the title screen with your save's wallet; CHECK
// ANOTHER looks up any Solana address. Payouts link to their transaction.
import Phaser from 'phaser';
import { GAME_W, GAME_H } from '../config.js';
import { getSave, loadSave } from '../systems/save.js';
import { fetchPlayer, resubmitIfNeeded } from '../systems/leaderboard.js';
import { formatRun } from '../systems/world.js';
import { pushFocus } from '../systems/controls.js';
import { sfx } from '../systems/audio.js';
import { panel, text } from '../ui/theme.js';
import { domInput, tapButton } from '../ui/helpers.js';
import { validWallet } from './WalletScene.js';
import { openUrl } from '../ui/Community.js';
import { fmtSol } from './LeaderboardScene.js';

const day = (iso) => new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });

export class EarningsScene extends Phaser.Scene {
  constructor() { super('Earnings'); }

  create() {
    this.save = getSave() ?? loadSave();
    this.add.rectangle(0, 0, GAME_W, GAME_H, 0x05040c, 0.62).setOrigin(0).setInteractive();
    panel(this, 36, 22, GAME_W - 72, GAME_H - 44, 'gold');
    text(this, 66, 40, 'EARNINGS', 34, '#ffc94a', { fontStyle: 'bold' });
    this.walletT = text(this, GAME_W - 66, 48, '', 18, '#c9c2ff', { fontStyle: 'bold' }).setOrigin(1, 0);
    this.body_ = this.add.container(0, 0);
    tapButton(this, GAME_W - 140, 586, 'BACK', () => this.close(), { w: 150, h: 44, size: 22 });
    this.other = tapButton(this, 196, 586, 'CHECK ANOTHER', () => this.ask(), { w: 240, h: 44, size: 20, style: 'chip', color: '#2ef2a8' });
    this.release = pushFocus((a) => {
      if (this.input_) return;                  // typing an address
      if (a === 'cancel' || a === 'menu') this.close();
      else if (a === 'confirm') this.ask();
    }, this);
    const w = this.save?.player?.wallet;
    if (w && validWallet(w)) this.show(w, true);
    else this.ask(w ? 'Your saved wallet is not a Solana address. Paste the one you want to check:' : null);
  }

  /** Paste a wallet to look up. */
  ask(note = null) {
    if (this.input_) return;
    this.body_.removeAll(true);
    this.walletT.setText('');
    const prompt = text(this, GAME_W / 2, 180, note ?? 'Paste a Solana wallet address to see its rank and earnings:', 22, '#fff7e6', { align: 'center', wordWrap: { width: 760 } }).setOrigin(0.5);
    const err = text(this, GAME_W / 2, 320, '', 18, '#ff6b7a').setOrigin(0.5);
    const input = domInput(this, GAME_W / 2, 260, { width: 720, maxLength: 64, placeholder: 'wallet address', fontSize: '20px' });
    this.input_ = input;
    const go = () => {
      const v = input.value().trim();
      if (!validWallet(v)) { sfx('bump'); err.setText("That isn't a Solana wallet address."); return; }
      sfx('confirm');
      this.cleanupInput();
      this.show(v, false);
    };
    const btn = tapButton(this, GAME_W / 2, 380, 'CHECK', go, { w: 200, h: 50, size: 24 });
    input.el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); go(); }
      if (e.key === 'Escape') { e.preventDefault(); this.close(); }
    });
    this.body_.add([prompt, err]);
    this.cleanupInput = () => { input.destroy(); btn.destroy(); this.input_ = null; this.cleanupInput = null; };
  }

  async show(wallet, own) {
    this.body_.removeAll(true);
    this.walletT.setText(`${wallet.slice(0, 4)}…${wallet.slice(-4)}${own ? ' (you)' : ''}`);
    const loading = text(this, GAME_W / 2, 300, 'Loading…', 22, '#fff7e6').setOrigin(0.5);
    this.body_.add(loading);
    if (own) await resubmitIfNeeded(this.save);
    const res = await fetchPlayer(wallet);
    if (!this.sys.isActive()) return;
    this.body_.removeAll(true);
    if (!res.ok) {
      this.body_.add(text(this, GAME_W / 2, 300, `${res.error}\n\nTry again in a moment.`, 22, '#fff7e6', { align: 'center', wordWrap: { width: 720 } }).setOrigin(0.5));
      return;
    }
    const B = this.body_;
    B.add(text(this, 66, 84, `${res.seasonName}${res.open ? '' : ' (closed)'}${res.poolSol > 0 ? ` · prize pool ${fmtSol(res.poolSol)}, top ${res.paidPlaces} paid` : ' · prize pool to be announced'}`, 18, '#a8acd6'));

    // three cards: rank, best time, this season's payout
    const card = (x, label, value, sub, color) => {
      B.add(panel(this, x, 120, 268, 132, 'card'));
      B.add(text(this, x + 20, 136, label, 16, '#5b5f80', { fontStyle: 'bold' }));
      B.add(text(this, x + 20, 162, value, 34, color, { fontStyle: 'bold', noShadow: true }));
      B.add(text(this, x + 20, 210, sub, 15, '#5b5f80', { wordWrap: { width: 236 }, noShadow: true }));
    };
    const r = res.run;
    card(66, 'RANK', res.rank ? `#${res.rank}` : '—', res.rank ? `of ${res.total} trainer${res.total === 1 ? '' : 's'}` : 'not on the board', '#12163a');
    card(346, 'BEST TIME', r && r.status !== 'rejected' ? formatRun(r.clearMs) : '—', r ? `cleared ${day(r.clearedAt)}` : 'no clear yet', '#12163a');
    const proj = res.inPaidPlaces ? (res.poolSol > 0 ? fmtSol(res.projectedSol) : 'TBA') : '0 SOL';
    card(626, 'THIS SEASON', proj, res.inPaidPlaces ? (r?.status === 'verified' ? 'if you hold your place' : 'pending review') : 'outside the paid places', res.inPaidPlaces ? '#b8860b' : '#12163a');

    // what it means
    let msg; let col = '#fff7e6';
    if (res.banned) { msg = 'This wallet cannot enter this season.'; col = '#ff8a8a'; }
    else if (r?.status === 'rejected') { msg = `Your run was not accepted${r.note ? `: ${r.note}` : '.'} Set a new time to re-enter.`; col = '#ff8a8a'; }
    else if (!r) msg = own ? 'No finished run on the board yet. Beat COOKER to set a time!' : 'No finished run on the board for this wallet.';
    else if (res.inPaidPlaces && r.status === 'verified') { msg = `Verified! You're in the paid places. Hold #${res.rank} until the season closes${res.endsAt ? ` (${day(res.endsAt)})` : ''} to be paid.`; col = '#2ef2a8'; }
    else if (res.inPaidPlaces) { msg = "You're in the paid places! Your run is waiting for review - payouts are confirmed when the season closes."; col = '#ffc94a'; }
    else msg = res.cutoffMs ? `Beat ${formatRun(res.cutoffMs)} to reach the paid places (top ${res.paidPlaces}).` : `The top ${res.paidPlaces} clears are paid.`;
    B.add(text(this, GAME_W / 2, 284, msg, 20, col, { align: 'center', wordWrap: { width: 800 } }).setOrigin(0.5, 0.5));

    // earnings to date
    B.add(text(this, 66, 322, 'TOTAL EARNED', 18, '#a8acd6', { fontStyle: 'bold' }));
    B.add(text(this, 66, 344, fmtSol(res.totalPaidSol), 34, '#2ef2a8', { fontStyle: 'bold' }));
    B.add(text(this, 330, 322, 'PAYOUTS', 18, '#a8acd6', { fontStyle: 'bold' }));
    if (!res.payouts.length) {
      B.add(text(this, 330, 350, 'None yet.', 20, '#7a7ea0'));
    } else {
      const shown = res.payouts.slice(0, 5);
      shown.forEach((p, i) => {
        const y = 350 + i * 34;
        const place = p.rank ? `#${p.rank}` : '';
        B.add(text(this, 330, y, `${day(p.at)}  ${p.season.toUpperCase()} ${place}`, 17, '#fff7e6'));
        B.add(text(this, 640, y, fmtSol(p.amountSol), 18, '#ffc94a', { fontStyle: 'bold' }).setOrigin(1, 0));
        if (p.tx) {
          const link = text(this, 660, y, `tx ${p.tx.slice(0, 6)}… ↗`, 16, '#5ccaff').setInteractive({ useHandCursor: true });
          link.on('pointerdown', () => { sfx('confirm'); openUrl(`https://solscan.io/tx/${p.tx}`); });
          B.add(link);
        } else B.add(text(this, 660, y, 'recorded', 16, '#7a7ea0'));
      });
      if (res.payouts.length > shown.length) B.add(text(this, 330, 350 + 5 * 34, `+${res.payouts.length - shown.length} earlier`, 16, '#8f93c4'));
    }
  }

  close() {
    this.cleanupInput?.();
    this.release?.();
    sfx('cancel');
    this.scene.stop();
  }
}
