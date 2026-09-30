// Profile: X wallet address for the airdrop. Stored in the save file.
// NOTE (BUILD_NOTES.md): a pasted address is NOT proof of ownership - there is
// no signature check yet.
import Phaser from 'phaser';
import { GAME_W, GAME_H } from '../config.js';
import { WALLET_PROMPT } from '../data/dialogue.js';
import { createSave } from '../systems/save.js';
import { chooseFrom } from '../ui/Menu.js';
import { panel, text } from '../ui/theme.js';
import { backdrop } from '../ui/backdrop.js';
import { domInput, fadeTo } from '../ui/helpers.js';

export function validWallet(v) {
  return v.length >= 4 && v.length <= 128 && !/\s/.test(v);
}

export class WalletScene extends Phaser.Scene {
  constructor() { super('Wallet'); }

  init(data) { this.info = data; }

  create() {
    this.cameras.main.fadeIn(500);
    backdrop(this);
    panel(this, 60, 60, GAME_W - 120, 470, 'gold');
    text(this, GAME_W / 2, 100, 'TRAINER PROFILE', 34, '#ffc94a', { fontStyle: 'bold' }).setOrigin(0.5);
    text(this, GAME_W / 2, 160, `${this.info.name}`, 30, '#fbf6e9').setOrigin(0.5);
    text(this, GAME_W / 2, 220, WALLET_PROMPT, 24, '#fbf6e9', { wordWrap: { width: 720 }, align: 'center' }).setOrigin(0.5, 0);
    this.err = text(this, GAME_W / 2, 360, '', 20, '#ee4f4b').setOrigin(0.5);
    text(this, GAME_W / 2, 470,
      'Saved in this browser - change it any time from MENU > PROFILE.\nPayouts go to the fastest clears - your run timer starts when you gain control.', 18, '#a8acd6',
      { wordWrap: { width: 780 }, align: 'center' }).setOrigin(0.5);
    this.input_ = domInput(this, GAME_W / 2, 320, { width: 720, maxLength: 128, placeholder: 'wallet address', fontSize: '22px' });
    this.input_.el.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); this.submit(false); } });
    this.buttons();
  }

  async buttons() {
    this.menuOpen = true;
    const i = await chooseFrom(this, {
      x: GAME_W / 2 - 250, y: 548, w: 500, h: 80, columns: 2, cancelable: false,
      items: [{ label: 'CONFIRM' }, { label: 'SKIP FOR NOW' }], size: 24,
    });
    this.menuOpen = false;
    this.submit(i === 1);
  }

  submit(skip) {
    if (this.done) return;
    const v = this.input_.value().trim();
    if (!skip && !validWallet(v)) {
      this.err.setText(v ? 'That address looks invalid (no spaces, 4-128 characters).' : 'Paste an address, or choose SKIP FOR NOW.');
      if (!this.menuOpen) this.buttons();
      return;
    }
    this.done = true;
    this.input_.destroy();
    createSave({ ...this.info, wallet: skip ? '' : v });
    fadeTo(this, 'Overworld', { fresh: true }, 700);
  }
}
