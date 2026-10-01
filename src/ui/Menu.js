// Generic cursor menu (list or grid) on the skin. `await menu.choose()` -> index, or -1 on cancel.
import { pushFocus } from '../systems/controls.js';
import { sfx } from '../systems/audio.js';
import { panel, text, hex, COLORS } from './theme.js';
import { highlightTexture } from './skin.js';

export class Menu {
  /**
   * items: [{ label, detail?, badge?: color, badgeText?, disabled? }]
   */
  constructor(scene, { x, y, w, h, items, columns = 1, style = 'menu', size = 26, cancelable = true, depth = 1100, pad = 22, rowH = null, title = null, start = 0 }) {
    Object.assign(this, { scene, x, y, w, h, items, columns, cancelable });
    this.index = Math.max(0, Math.min(items.length - 1, start));
    this.container = scene.add.container(0, 0).setDepth(depth);
    this.container.add(panel(scene, x, y, w, h, style));
    const dark = style === 'plate' || style === 'card';
    const ink = dark ? hex(COLORS.navy) : '#fff7e6';
    const rows = Math.ceil(items.length / columns);
    const top = y + pad + (title ? 34 : 0);
    if (title) this.container.add(text(scene, x + pad + 8, y + pad - 4, title, 20, dark ? '#5b5f80' : '#a8acd6'));
    const cellW = (w - pad * 2) / columns;
    const cellH = rowH ?? (h - pad * 2 - (title ? 34 : 0)) / rows;
    this.hl = scene.add.image(0, 0, highlightTexture(scene, Math.round(cellW - 6), Math.round(Math.min(cellH - 4, 54)))).setOrigin(0);
    this.container.add(this.hl);
    this.cells = items.map((it, i) => {
      const cx = x + pad + (i % columns) * cellW;
      const cy = top + Math.floor(i / columns) * cellH;
      const labelY = it.detail ? cy + 4 : cy + cellH / 2 - size * 0.62;
      const label = text(scene, cx + 34, labelY, it.label, size, it.disabled ? '#7a7ea0' : ink);
      this.container.add(label);
      if (it.badge != null) {
        const bg = scene.add.graphics();
        bg.fillStyle(0x000000, 0.25).fillRoundedRect(cx + 36, cy + cellH - 33, 92, 24, 8);
        bg.fillStyle(it.badge, 1).fillRoundedRect(cx + 34, cy + cellH - 35, 92, 24, 8);
        const bt = text(scene, cx + 80, cy + cellH - 34, (it.badgeText ?? '').toUpperCase(), 16, '#ffffff').setOrigin(0.5, 0);
        this.container.add([bg, bt]);
      }
      if (it.detail) {
        this.container.add(text(scene, cx + (it.badge != null ? 138 : 34), cy + cellH - 34, it.detail, 18, dark ? '#5b5f80' : '#a8acd6'));
      }
      const zone = scene.add.zone(cx, cy, cellW, cellH).setOrigin(0).setInteractive({ useHandCursor: true });
      zone.on('pointerover', () => { if (this.index !== i) { this.index = i; sfx('cursor'); this.redraw(); } });
      zone.on('pointerdown', () => { this.index = i; this.redraw(); this.handle('confirm'); });
      this.container.add(zone);
      return { cx, cy, cellW, cellH, label };
    });
    this.cursor = text(scene, 0, 0, '▸', size, '#2ef2a8');
    this.container.add(this.cursor);
    scene.tweens.add({ targets: this.cursor, alpha: 0.55, duration: 420, yoyo: true, repeat: -1 });
    this.redraw();
  }

  redraw() {
    const c = this.cells[this.index];
    const it = this.items[this.index];
    this.hl.setPosition(c.cx + 2, c.cy + (it.detail ? 0 : Math.max(0, (c.cellH - this.hl.height) / 2)));
    this.cursor.setPosition(c.cx + 10, c.cy + (it.detail ? 6 : c.cellH / 2 - 17));
  }

  handle(a) {
    const n = this.items.length;
    const cols = this.columns;
    const prev = this.index;
    if (a === 'up') this.index = (this.index - cols + n) % n;
    else if (a === 'down') this.index = (this.index + cols) % n;
    else if (a === 'left' && cols > 1) this.index = (this.index - 1 + n) % n;
    else if (a === 'right' && cols > 1) this.index = (this.index + 1) % n;
    else if (a === 'confirm') {
      if (this.items[this.index].disabled) { sfx('bump'); return; }
      sfx('confirm');
      this.done?.(this.index);
      return;
    } else if (a === 'cancel' && this.cancelable) {
      sfx('cancel');
      this.done?.(-1);
      return;
    }
    if (prev !== this.index) sfx('cursor');
    this.redraw();
  }

  choose() {
    return new Promise((resolve) => {
      const release = pushFocus((a) => this.handle(a), this.scene);
      this.done = (i) => { release(); this.done = null; resolve(i); };
    });
  }

  destroy() { this.container.destroy(); }
}

/** One-shot helper. */
export async function chooseFrom(scene, opts) {
  const m = new Menu(scene, opts);
  const i = await m.choose();
  m.destroy();
  return i;
}
