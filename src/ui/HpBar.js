// HP bar: colour shifts green > 50% > yellow > 20% > red, animates smoothly,
// has tick marks and a trailing "ghost" bar that shows the damage just taken.
import { COLORS, hpColor } from './theme.js';

export class HpBar {
  constructor(scene, x, y, w, h = 12, { color = null, ticks = true } = {}) {
    Object.assign(this, { scene, x, y, w, h, ticks });
    this.fixedColor = color;
    this.g = scene.add.graphics();
    this.frac = 1;
    this.ghost = 1;
    this.draw();
  }

  draw() {
    const { g, x, y, w, h } = this;
    g.clear();
    g.fillStyle(0x000000, 0.3).fillRoundedRect(x - 3, y - 1, w + 6, h + 6, (h + 6) / 2);
    g.fillStyle(COLORS.ink, 1).fillRoundedRect(x - 3, y - 3, w + 6, h + 6, (h + 6) / 2);
    g.fillStyle(0x2a2f55, 1).fillRoundedRect(x, y, w, h, h / 2);
    const gw = Math.round(w * this.ghost);
    if (gw > 0 && this.ghost > this.frac) g.fillStyle(0xff9aa6, 1).fillRoundedRect(x, y, Math.max(gw, h), h, h / 2);
    const fw = Math.max(0, Math.round(w * this.frac));
    if (fw > 0) {
      const col = this.fixedColor ?? hpColor(this.frac);
      g.fillStyle(col, 1).fillRoundedRect(x, y, Math.max(fw, h), h, h / 2);
      g.fillStyle(0xffffff, 0.35).fillRect(x + h / 2, y + 2, Math.max(0, fw - h), Math.max(1, h * 0.25));
      g.fillStyle(0x000000, 0.12).fillRect(x + h / 2, y + h * 0.7, Math.max(0, fw - h), h * 0.3);
    }
    if (this.ticks && h >= 8) {
      g.fillStyle(COLORS.ink, 0.35);
      for (let i = 1; i < 10; i++) g.fillRect(x + (w * i) / 10, y + 1, 1, h - 2);
    }
  }

  set(frac) { this.frac = Math.max(0, Math.min(1, frac)); this.ghost = this.frac; this.draw(); }

  /** Tween to a fraction. onUpdate(frac) lets callers sync the "XX/YY" text. */
  tweenTo(frac, { duration = null, onUpdate = null } = {}) {
    frac = Math.max(0, Math.min(1, frac));
    const d = duration ?? Math.max(250, Math.abs(frac - this.frac) * 1400);
    const dropping = frac < this.frac;
    if (!dropping) this.ghost = frac;
    return new Promise((resolve) => {
      const obj = { f: this.frac };
      this.scene.tweens.add({
        targets: obj, f: frac, duration: d, ease: 'Sine.easeInOut',
        onUpdate: () => { this.frac = obj.f; this.draw(); onUpdate?.(obj.f); },
        onComplete: () => {
          this.frac = frac; this.draw(); onUpdate?.(frac);
          if (dropping) {
            const gh = { g: this.ghost };
            this.scene.tweens.add({ targets: gh, g: frac, delay: 250, duration: 450, onUpdate: () => { this.ghost = gh.g; this.draw(); } });
          }
          resolve();
        },
      });
    });
  }

  setDepth(d) { this.g.setDepth(d); return this; }
  destroy() { this.g.destroy(); }
}
