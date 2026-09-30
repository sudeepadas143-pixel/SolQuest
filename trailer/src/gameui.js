// The game's own UI, used as motion graphics. skin.js paints its panels,
// chips and icons into Phaser canvas textures; a tiny shim hands it plain
// canvases instead, so the leaderboard, pool counter and countdown are drawn
// by exactly the code that draws the game's HUD.
import '@fontsource/pixelify-sans/400.css';
import '@fontsource/pixelify-sans/700.css';
import { panelTexture, drawIcon, C } from '@game/ui/skin.js';
import { COLORS } from '@game/ui/theme.js';
import { FONT } from '@game/config.js';
import { formatRun } from '@game/systems/world.js';
import manifest from '@game/data/spriteManifest.json';

export { C, COLORS, FONT, formatRun, drawIcon };

const store = new Map();
export const shimScene = {
  textures: {
    exists: (k) => store.has(k),
    createCanvas: (k, w, h) => {
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const t = { canvas, getContext: () => canvas.getContext('2d'), refresh() {} };
      store.set(k, t);
      return t;
    },
    get: (k) => ({ getSourceImage: () => store.get(k)?.canvas }),
  },
};

/** A game panel (glass / menu / chip / plate / gold / card) as a canvas.
 *  Like the game, the canvas has an 18px shadow margin around the box. */
export const PANEL_PAD = 18;
export function panelCanvas(style, w, h, opts = {}) {
  const key = panelTexture(shimScene, style, Math.round(w), Math.round(h), opts);
  return store.get(key).canvas;
}
export function drawPanel(ctx, style, x, y, w, h, opts) {
  ctx.drawImage(panelCanvas(style, w, h, opts), Math.round(x - PANEL_PAD), Math.round(y - PANEL_PAD));
}

export async function fontsReady() {
  await Promise.all([
    document.fonts.load(`400 64px ${FONT}`),
    document.fonts.load(`700 64px ${FONT}`),
  ]);
}

/** Text in the game's house style: pixel font, cream fill, thick ink stroke,
 *  a hard drop shadow. f-ligatures broken like the game does. */
export function drawText(ctx, str, x, y, {
  size = 64, weight = 700, color = C.cream, stroke = C.navy, strokeWidth = null,
  shadow = C.ink, shadowY = null, align = 'center', baseline = 'alphabetic', alpha = 1,
} = {}) {
  const s = String(str).replace(/f(?=[fil])/g, 'f‌');
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.font = `${weight} ${size}px ${FONT}`;
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
  ctx.lineJoin = 'round';
  const sw = strokeWidth ?? Math.max(4, Math.round(size * 0.16));
  const sy = shadowY ?? Math.max(3, Math.round(size * 0.09));
  if (shadow) {
    ctx.fillStyle = shadow;
    ctx.strokeStyle = shadow;
    ctx.lineWidth = sw;
    ctx.strokeText(s, x, y + sy);
    ctx.fillText(s, x, y + sy);
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = sw;
    ctx.strokeText(s, x, y);
  }
  ctx.fillStyle = color;
  ctx.fillText(s, x, y);
  ctx.restore();
}
export function measure(ctx, str, size, weight = 700) {
  ctx.save();
  ctx.font = `${weight} ${size}px ${FONT}`;
  const w = ctx.measureText(String(str).replace(/f(?=[fil])/g, 'f‌')).width;
  ctx.restore();
  return w;
}

/** Game sprites (creatures, trainers) as decoded images. */
const imgs = new Map();
export function loadImage(url) {
  if (!imgs.has(url)) {
    imgs.set(url, new Promise((res, rej) => {
      const im = new Image();
      im.onload = () => res(im);
      im.onerror = rej;
      im.src = url;
    }));
  }
  return imgs.get(url);
}
export const creatureUrl = (id, view = 'front') => `/assets/sprites/${manifest.creatures[id][view]}`;
export const trainerUrl = (design) => `/assets/sprites/${manifest.trainers[design].battle}`;

/** Draw an image with nearest-neighbour scaling (pixel art). */
export function drawPixel(ctx, img, x, y, w, h, alpha = 1) {
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.globalAlpha *= alpha;
  ctx.drawImage(img, Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  ctx.restore();
}
