import { FONT } from '../config.js';
import { panel as skinPanel, C, hex as h } from './skin.js';

export const COLORS = {
  ink: h(C.ink), navy: h(C.navy), cream: h(C.cream), muted: h(C.muted),
  violet: h(C.violet), mint: h(C.mint), gold: h(C.gold), coral: h(C.coral), sky: h(C.sky),
  teal: h(C.mint), sand: 0xd8cfb8, dialogFill: h(C.navy),
  solPurple: 0x9945ff, solGreen: 0x14f195,
  hpGreen: 0x3fe07a, hpYellow: 0xffc94a, hpRed: 0xff5a6a,
  xp: 0x5ccaff,
};

// style names understood by skin.panel()
export const PANEL = { dialog: 'glass', menu: 'menu', info: 'plate', dark: 'gold', chip: 'chip', card: 'card' };

export const panel = (scene, x, y, w, h2, style = 'glass', opts) => skinPanel(scene, x, y, w, h2, style, opts);

/** Text with the house style: pixel font, soft drop shadow on light text. */
export function text(scene, x, y, str, size = 26, color = '#fff7e6', extra = {}) {
  const t = scene.add.text(x, y, str, { fontFamily: FONT, fontSize: `${size}px`, color, ...extra }).setResolution(2);
  const light = typeof color === 'string' && parseInt(color.slice(1, 3), 16) > 150;
  if (light && !extra.noShadow) t.setShadow(0, 2, 'rgba(6,8,24,0.75)', 0, true, true);
  return t;
}

export const hex = (n) => `#${n.toString(16).padStart(6, '0')}`;

export function hpColor(frac) {
  if (frac > 0.5) return COLORS.hpGreen;
  if (frac > 0.2) return COLORS.hpYellow;
  return COLORS.hpRed;
}

// Legacy helper kept for scenes that draw simple shapes into a Graphics.
export function drawPanel(g, x, y, w, h2, style = 'glass') {
  const scene = g.scene;
  const img = skinPanel(scene, x, y, w, h2, typeof style === 'string' ? style : 'glass');
  img.setDepth(g.depth - 0.01);
  g.once('destroy', () => img.destroy());
  return img;
}
