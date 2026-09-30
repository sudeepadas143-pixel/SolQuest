// Element symbols: one clean vector symbol per type, filled in the type's
// colour with a dark outline (no badge). The `mono` variant is white, for use
// on top of something already in the type's colour (move cards, type badges).
// Shapes are drawn on a 24x24 grid and scaled to the requested size.
import { TYPE_COLORS } from '../data/types.js';

const P = (d) => new Path2D(d);

function rr(x, y, w, h, r) {
  const p = new Path2D();
  p.moveTo(x + r, y);
  p.arcTo(x + w, y, x + w, y + h, r);
  p.arcTo(x + w, y + h, x, y + h, r);
  p.arcTo(x, y + h, x, y, r);
  p.arcTo(x, y, x + w, y, r);
  p.closePath();
  return p;
}

function circle(cx, cy, r) {
  const p = new Path2D();
  p.arc(cx, cy, r, 0, Math.PI * 2);
  return p;
}

function star(cx, cy, R, r, n = 5) {
  const p = new Path2D();
  for (let i = 0; i < n * 2; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / n;
    const rad = i % 2 ? r : R;
    p[i ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * rad, cy + Math.sin(a) * rad);
  }
  p.closePath();
  return p;
}

/** Crescent: circle A minus circle B, as one outlined path. */
function crescent(ax, ay, ar, bx, by, br) {
  const d = Math.hypot(bx - ax, by - ay);
  const a = (ar * ar - br * br + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, ar * ar - a * a));
  const mx = ax + (a * (bx - ax)) / d;
  const my = ay + (a * (by - ay)) / d;
  const p1 = [mx + (h * (by - ay)) / d, my - (h * (bx - ax)) / d];
  const p2 = [mx - (h * (by - ay)) / d, my + (h * (bx - ax)) / d];
  const ang = (cx, cy, [x, y]) => Math.atan2(y - cy, x - cx);
  // take the arc of A whose midpoint lies outside B
  const a1 = ang(ax, ay, p1);
  const a2 = ang(ax, ay, p2);
  const midOutside = (ccw) => {
    let span = ccw ? a1 - a2 : a2 - a1;
    span = ((span % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    const m = ccw ? a1 - span / 2 : a1 + span / 2;
    return Math.hypot(ax + Math.cos(m) * ar - bx, ay + Math.sin(m) * ar - by) > br;
  };
  const ccw = midOutside(true);
  const p = new Path2D();
  p.moveTo(...p1);
  p.arc(ax, ay, ar, a1, a2, ccw);
  p.arc(bx, by, br, ang(bx, by, p2), ang(bx, by, p1), !ccw);
  p.closePath();
  return p;
}

function eyes() {
  const p = new Path2D();
  p.ellipse(9.6, 9.6, 1.5, 2.2, 0, 0, Math.PI * 2);
  p.moveTo(15.9, 9.6);
  p.ellipse(14.4, 9.6, 1.5, 2.2, 0, 0, Math.PI * 2);
  return p;
}

function hexagon(cx, cy, r) {
  const p = new Path2D();
  for (let i = 0; i < 6; i++) {
    const a = Math.PI / 6 + (i * Math.PI) / 3;
    p[i ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  p.closePath();
  return p;
}

// shapes:   filled + outlined (their union reads as one silhouette)
// inner:    a lighter area inside the fill (the flame's core)
// light:    thin strokes in a lighter tint (veins, facets, highlights)
// dark:     outline-coloured strokes drawn under the fill (legs, stems)
// darkOver: outline-coloured strokes drawn over the fill (creases, seams)
// holes:    outline-coloured cut-outs (eyes)
const SYMBOLS = {
  normal: () => ({ shapes: [star(12, 13, 10.5, 4.6)] }),
  fire: () => ({
    shapes: [P('M12 1.5C13 5 17.5 7.5 18.8 11.8C20.3 17 16.8 22.5 12 22.5C7.2 22.5 3.8 18.6 5.2 13.8C5.9 11.4 7.5 10 8.2 7.6C9.3 9.2 9.6 10.6 9.4 12C11.5 9.5 12.9 6 12 1.5Z')],
    inner: [P('M12 11.5C13.3 13.8 15.4 15 15.4 17.6C15.4 19.6 13.9 21 12 21C10.1 21 8.6 19.6 8.6 17.8C8.6 16.2 9.8 15.1 10.5 13.6C11.1 14.4 11.4 15 11.3 15.8C12 14.6 12.4 13.2 12 11.5Z')],
  }),
  water: () => ({
    shapes: [P('M12 1.8C9 7 5 10.8 5 15.3A7 7 0 0 0 19 15.3C19 10.8 15 7 12 1.8Z')],
    light: [P('M8.4 15.2C8.4 17.4 9.7 19 11.6 19.4')],
  }),
  grass: () => ({
    dark: [P('M2.8 22.8L8.4 17')],
    shapes: [P('M21 2.8C11.2 3 4 7.4 4 15.2C4 19.1 7 21.6 11 21.6C18.2 21.6 21.2 13.2 21 2.8Z')],
    light: [P('M7.2 18.4C10.5 14 13.8 10.4 17.4 7.2')],
  }),
  fighting: () => ({
    shapes: [rr(5, 9.5, 14.5, 11.5, 3.2), rr(5, 4.2, 3.9, 8, 1.9), rr(8.6, 3.4, 3.9, 8, 1.9), rr(12.2, 3.8, 3.9, 8, 1.9), rr(15.8, 5, 3.7, 7.5, 1.8), rr(2.8, 11.6, 9.5, 4.4, 2.2)],
    darkOver: [P('M8.8 6.5V10.5M12.4 6V10.5M16 6.8V10.5M5.4 16.1H11.8')],
  }),
  dragon: () => ({
    shapes: [P('M2.5 4.5C8.2 4.6 13 7.6 15.5 12.2L17 6.5L19 12.6L21.8 10C21.8 16.4 17.6 21.2 11.4 21.6C12.4 18.6 11 16.6 8.4 16C9.4 13.4 8 11.4 5.4 10.9C6.2 8.6 5 6.3 2.5 4.5Z')],
    light: [P('M6.2 7.4C9.6 9 12.4 11.8 14 15.4')],
  }),
  rock: () => ({
    shapes: [P('M3.5 17.5L5.6 8.8L11 3.8L17.6 5.4L21 12.6L19 19.6L12.2 21.6L6 21Z')],
    light: [P('M11 3.8L10 11L5.6 8.8M10 11L17 12.6L21 12.6M17 12.6L19 19.6M10 11L12.2 21.6')],
  }),
  ghost: () => ({
    shapes: [P('M5 21.6V10.4C5 6 8.2 2.6 12 2.6C15.8 2.6 19 6 19 10.4V21.6L16.7 19.4L14.4 21.6L12 19.4L9.6 21.6L7.3 19.4Z')],
    holes: [eyes()],
  }),
  steel: () => {
    const nut = hexagon(12, 12, 10.3);
    nut.addPath(circle(12, 12, 4.2));
    return { shapes: [nut], evenodd: true, light: [P('M5.4 8L12 4.2L18.6 8')] };
  },
  poison: () => ({
    shapes: [circle(10, 15.4, 6), circle(17.2, 7.8, 3.8), circle(7.4, 5.2, 2.5)],
    light: [P('M6.6 14.2A3.8 3.8 0 0 1 9.2 11.2M15.6 6.8A1.9 1.9 0 0 1 16.8 5.6')],
  }),
  dark: () => ({ shapes: [crescent(11, 12.5, 9.8, 16.4, 8.6, 8.2)] }),
  bug: () => ({
    dark: [P('M7 11L3.2 8.8M6.4 15H2.6M7 19L3.6 21.6M17 11L20.8 8.8M17.6 15H21.4M17 19L20.4 21.6M10.8 4L8.6 1.4M13.2 4L15.4 1.4')],
    shapes: [P('M12 7.4C15.6 7.4 18 10.6 18 14.8C18 19.2 15.4 22.4 12 22.4C8.6 22.4 6 19.2 6 14.8C6 10.6 8.4 7.4 12 7.4Z'), circle(12, 5.6, 2.9)],
    darkOver: [P('M12 9.6V22')],
  }),
};

export const TYPES = Object.keys(SYMBOLS);

const rgb = (n) => [(n >> 16) & 255, (n >> 8) & 255, n & 255];
const shade = (n, k) => rgb(n).map((v) => Math.round(k >= 0 ? v + (255 - v) * k : v * (1 + k)));
const css = (a) => `rgb(${a[0]},${a[1]},${a[2]})`;

/**
 * Texture key for a type symbol `size` px square (drawn once, cached).
 * mono: white symbol with a dark outline, for coloured backgrounds.
 */
export function typeIcon(scene, type, size = 30, { mono = false } = {}) {
  const key = `type_${type}_${size}${mono ? '_w' : ''}`;
  if (scene.textures.exists(key)) return key;
  const col = TYPE_COLORS[type] ?? 0x888888;
  const tex = scene.textures.createCanvas(key, size, size);
  const ctx = tex.getContext();
  const s = (SYMBOLS[type] ?? SYMBOLS.normal)();
  const k = (size - 3) / 24;
  ctx.save();
  ctx.translate(1.5, 1.5);
  ctx.scale(k, k);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  const ink = mono ? css(shade(col, -0.62)) : '#12163a';
  const rule = s.evenodd ? 'evenodd' : 'nonzero';

  // 1) outline: stroke-only details and every shape, drawn thick in ink
  ctx.strokeStyle = ink;
  ctx.lineWidth = 1.9;
  for (const p of s.dark ?? []) ctx.stroke(p);
  ctx.lineWidth = 2.8;
  for (const p of s.shapes) ctx.stroke(p);

  // 2) fill: the type colour, lit from the top (plain white for mono)
  if (mono) ctx.fillStyle = '#ffffff';
  else {
    const g = ctx.createLinearGradient(0, 1, 0, 23);
    g.addColorStop(0, css(shade(col, 0.3)));
    g.addColorStop(1, css(shade(col, -0.15)));
    ctx.fillStyle = g;
  }
  for (const p of s.shapes) ctx.fill(p, rule);
  if (s.inner) {
    ctx.fillStyle = mono ? css(shade(col, 0.5)) : css(shade(col, 0.75));
    for (const p of s.inner) ctx.fill(p);
  }
  if (s.holes) {
    ctx.fillStyle = mono ? ink : '#fbf8ff';
    for (const p of s.holes) ctx.fill(p);
  }

  // 3) details
  ctx.lineWidth = 1.3;
  ctx.strokeStyle = mono ? css(shade(col, 0.3)) : css(shade(col, 0.72));
  for (const p of s.light ?? []) ctx.stroke(p);
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = ink;
  for (const p of s.darkOver ?? []) ctx.stroke(p);
  ctx.restore();
  tex.refresh();
  return key;
}
