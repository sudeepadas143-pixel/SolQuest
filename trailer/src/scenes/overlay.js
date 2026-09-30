// The motion-graphics layers, drawn with the game's own UI code (panels,
// icons, palette, pixel font, RUN-timer format): the leaderboard, the
// creator-fee pool, buy/sell flashes, the 24h countdown, damage numbers,
// captions, the handle, and the pixel sparkles on the end card.
import { W, H, S16 } from '../grid.js';
import { captions, board, HANDLE, BOARD0, RESET } from '../timeline.js';
import { C, drawPanel, drawText, measure, drawIcon, formatRun, drawPixel, loadImage, creatureUrl } from '../gameui.js';
import { hash1 } from '../remap.js';

const snap = (v, g = 2) => Math.round(v / g) * g;
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const easeOut = (x) => 1 - (1 - x) ** 3;
const backOut = (x, s = 2.2) => 1 + (s + 1) * (x - 1) ** 3 + s * (x - 1) ** 2;

// ------------------------------------------------------------ pixel coin
// 12x12 gold coin in the game's palette, drawn once, scaled nearest.
let coinCanvas = null;
function coin() {
  if (coinCanvas) return coinCanvas;
  const c = document.createElement('canvas');
  c.width = 12; c.height = 12;
  const x = c.getContext('2d');
  for (let j = 0; j < 12; j++) {
    for (let i = 0; i < 12; i++) {
      const d = Math.hypot(i - 5.5, j - 5.5);
      if (d > 5.9) continue;
      let col = '#ffc94a';
      if (d > 4.9) col = '#7a4a12';
      else if (d > 3.9) col = '#d9962a';
      else if (i + j < 9) col = '#fff1a8';
      if (d <= 3.9 && Math.abs(i - 5.5) < 1 && j > 2 && j < 9) col = '#d9962a';
      x.fillStyle = col;
      x.fillRect(i, j, 1, 1);
    }
  }
  coinCanvas = c;
  return c;
}
function drawCoin(ctx, cx, cy, size, alpha = 1) {
  drawPixel(ctx, coin(), cx - size / 2, cy - size / 2, size, size, alpha);
}

const monImgs = {};
export async function loadOverlayAssets() {
  for (const r of board.rows) monImgs[r.mon] = await loadImage(creatureUrl(r.mon));
}

// -------------------------------------------------------------- the board
const ROW_Y = (i) => 318 + i * 104;
const ROW_X = 300;
const ROW_W = 1320;
const ROW_H = 90;
const POOL = { x: 540, y: 150, w: 840, h: 150 };
const TRADE_SLOTS = [[350, 186], [1570, 186], [350, 270], [1570, 270]];

function fmtHMS(sec) {
  const s = Math.max(0, Math.ceil(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}

/** Everything on the leaderboard world, at global time t. */
export function drawBoard(ctx, t, S) {
  const B = S.board;
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.scale(B.z, B.z);
  ctx.translate(-snap(B.x), -snap(B.y));

  // title chip
  if (B.title > 0) {
    ctx.save();
    ctx.translate(960, 92);
    ctx.scale(backOut(clamp01(B.title)), backOut(clamp01(B.title)));
    drawPanel(ctx, 'gold', -330, -44, 660, 86);
    drawIcon(ctx, 'star', -270, 0, 22, C.gold);
    drawIcon(ctx, 'star', 270, 0, 22, C.gold);
    drawText(ctx, 'daily leaderboard', 0, 16, { size: 50, color: C.gold });
    ctx.restore();
  }

  // the creator-fee pool, ticking up as trades pour in
  if (B.poolIn > 0) {
    let pulse = 0;
    for (const tr of board.trades) {
      const lt = t - (tr.t + 0.3);
      if (lt >= 0 && lt < 0.18) pulse = Math.max(pulse, 1 - lt / 0.18);
    }
    const k = backOut(clamp01(B.poolIn)) * (1 + pulse * 0.04);
    ctx.save();
    ctx.translate(POOL.x + POOL.w / 2, POOL.y + POOL.h / 2);
    ctx.scale(k, k);
    drawPanel(ctx, 'gold', -POOL.w / 2, -POOL.h / 2, POOL.w, POOL.h);
    drawText(ctx, 'creator fee pool', 0, -30, { size: 34, color: C.mint });
    drawText(ctx, `${B.pool.toFixed(3)} sol`, 0, 48, { size: 84, color: pulse > 0.5 ? '#fff1a8' : C.gold });
    drawCoin(ctx, -POOL.w / 2 + 70, 18, 72);
    drawCoin(ctx, POOL.w / 2 - 70, 18, 72);
    ctx.restore();
  }

  // buy / sell flashes: pop in, then fly into the pool
  for (const tr of board.trades) {
    const lt = t - tr.t;
    if (lt < 0 || lt > 0.42) continue;
    const [sx, sy] = TRADE_SLOTS[tr.slot];
    const fly = clamp01((lt - 0.22) / 0.2);
    const x = sx + (POOL.x + POOL.w / 2 - sx) * easeOut(fly) * 0.85;
    const y = sy + (POOL.y + POOL.h / 2 - sy) * easeOut(fly) * 0.85;
    const s = backOut(clamp01(lt / 0.09)) * (1 - fly * 0.6);
    const buy = tr.side === 'buy';
    ctx.save();
    ctx.translate(snap(x), snap(y));
    ctx.scale(s, s);
    ctx.globalAlpha = 1 - fly;
    drawPanel(ctx, 'chip', -150, -30, 300, 60);
    drawText(ctx, `${tr.side} ${buy ? '+' : '-'}${tr.amt.toFixed(2)} sol`, 0, 12, { size: 34, color: buy ? C.mint : C.coral });
    ctx.restore();
  }

  // the rows
  const erased = (i) => B.reset > (i + 0.6) / 5.2;
  board.rows.forEach((r, i) => {
    const R = B.rows[i];
    if (i > 3) return;                           // four rows: the captions own the lower third
    if (R.a <= 0 || R.x > 1500) return;
    const gone = erased(i);
    const jitter = B.reset > 0 && B.reset < 1 && Math.abs(B.reset - (i + 0.6) / 5.2) < 0.08 ? hash1(Math.floor(t * 60) + i) * 60 : 0;
    const x = ROW_X + snap(R.x) + jitter;
    const y = ROW_Y(i);
    const top3 = i < 3 && !gone;
    drawPanel(ctx, top3 ? 'gold' : 'glass', x, y, ROW_W, ROW_H);
    const mid = y + ROW_H / 2;
    drawText(ctx, `#${i + 1}`, x + 72, mid + 20, { size: 62, color: top3 ? C.gold : C.muted });
    if (!gone) {
      const img = monImgs[r.mon];
      const h = ROW_H - 6;
      const w = (img.width / img.height) * h;
      drawPixel(ctx, img, x + 160, y + ROW_H - h - 2, w, h);
    }
    drawText(ctx, gone ? '---' : r.name, x + 310, mid + 20, { size: 58, align: 'left', color: gone ? C.muted : C.cream });
    drawIcon(ctx, 'clock', x + 745, mid, 20, gone ? C.muted : C.mint);
    drawText(ctx, gone ? '-:--:--.-' : formatRun(r.ms), x + 780, mid + 18, { size: 50, align: 'left', color: gone ? C.muted : C.mint });
    if (top3) {
      drawCoin(ctx, x + ROW_W - 210, mid, 56);
      drawText(ctx, 'paid', x + ROW_W - 160, mid + 16, { size: 46, align: 'left', color: C.gold });
    }
  });

  // top 3 get paid: coins arc from the pool into the gold rows
  const payT = board.payAt;
  if (t >= payT && t < payT + 1.0) {
    for (let k = 0; k < 18; k++) {
      const row = k % 3;
      const lt = t - payT - (k % 6) * 0.035;
      if (lt < 0 || lt > 0.55) continue;
      const p = easeOut(clamp01(lt / 0.5));
      const x0 = POOL.x + POOL.w / 2 + hash1(k) * 120;
      const y0 = POOL.y + POOL.h / 2;
      const x1 = ROW_X + ROW_W - 210 + hash1(k + 40) * 30;
      const y1 = ROW_Y(row) + ROW_H / 2;
      const x = x0 + (x1 - x0) * p;
      const y = y0 + (y1 - y0) * p - Math.sin(p * Math.PI) * (140 + 60 * hash1(k + 7));
      drawCoin(ctx, snap(x), snap(y), 44, 1 - clamp01((lt - 0.45) / 0.1));
    }
  }
  // a glint sweeps the gold rows
  if (B.glint >= 0 && B.glint <= 1) {
    const gx = ROW_X - 300 + B.glint * (ROW_W + 600);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.beginPath();
    ctx.rect(ROW_X, ROW_Y(0), ROW_W, ROW_Y(2) + ROW_H - ROW_Y(0));
    ctx.clip();
    const g = ctx.createLinearGradient(gx - 120, 0, gx + 120, 0);
    g.addColorStop(0, 'rgba(255,241,168,0)');
    g.addColorStop(0.5, 'rgba(255,241,168,0.55)');
    g.addColorStop(1, 'rgba(255,241,168,0)');
    ctx.fillStyle = g;
    ctx.transform(1, 0, -0.35, 1, 0, 0);
    ctx.fillRect(gx - 400, ROW_Y(0) - 20, 800, 480);
    ctx.restore();
  }
  ctx.restore();

  // the countdown sits over the dimmed board, in the game's RUN-chip style
  if (B.dim > 0) {
    ctx.fillStyle = `rgba(6,7,20,${B.dim})`;
    ctx.fillRect(0, 0, W, H);
  }
  if (B.timerAlpha > 0) {
    ctx.save();
    ctx.translate(W / 2, 520);
    ctx.scale(B.timerScale, B.timerScale);
    ctx.globalAlpha = B.timerAlpha;
    drawPanel(ctx, 'chip', -560, -150, 1120, 300);
    drawText(ctx, 'resets in', 0, -80, { size: 44, color: C.muted });
    const col = mix(C.mint, C.coral, B.timerRed);
    const str = fmtHMS(B.timer);
    const cell = 104;
    const colon = 50;
    const widths = [...str].map((ch) => (ch === ':' ? colon : cell));
    let x = -widths.reduce((a, b) => a + b, 0) / 2 + 60;
    drawIcon(ctx, 'clock', x - 60, 40, 40, col);
    [...str].forEach((ch, i) => {
      drawText(ctx, ch, x + widths[i] / 2, 96, { size: 170, color: col });
      x += widths[i];
    });
    ctx.restore();
  }
}

function mix(a, b, k) {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  const c = pa.map((v, i) => Math.round(v + (pb[i] - v) * clamp01(k)));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

// ------------------------------------------------------------ damage numbers
/** Floating damage numbers (HUD motion graphics), mapped through the shot's camera. */
export function drawDamage(ctx, t, dmg, toScreen) {
  for (const d of dmg) {
    const dur = d.dur ?? 0.55;
    const lt = t - d.t;
    if (lt < 0 || lt > dur) continue;
    const [sx, sy] = toScreen(d.x, d.y);
    const pop = lt < 0.08 ? 1.9 - 0.9 * (lt / 0.08) : 1;
    const a = lt > dur - 0.14 ? (dur - lt) / 0.14 : 1;
    ctx.save();
    ctx.translate(snap(sx), snap(sy - lt * 70));
    ctx.scale(pop, pop);
    drawText(ctx, d.text, 0, 0, { size: d.big ? 110 : 80, color: d.gold ? C.gold : '#ffffff', stroke: C.navy, alpha: a, baseline: 'middle' });
    ctx.restore();
  }
}

// ------------------------------------------------------------------ captions
export function drawCaption(ctx, S) {
  const id = S.cap.cid;
  if (id < 0 || S.cap.alpha <= 0) return;
  const c = captions[id];
  let size = c.size;
  const maxW = W * 0.9 - 40;                       // 5% margin each side
  const w = measure(ctx, c.text, size);
  if (w > maxW) size *= maxW / w;
  const y = c.y ?? 916;
  if (!c.y) {
    // lower thirds sit on a soft dark band so they read over any game screen
    const g = ctx.createLinearGradient(0, H - 300, 0, H);
    g.addColorStop(0, 'rgba(6,7,20,0)');
    g.addColorStop(0.55, `rgba(6,7,20,${0.62 * S.cap.alpha})`);
    g.addColorStop(1, `rgba(6,7,20,${0.72 * S.cap.alpha})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, H - 300, W, 300);
  }
  ctx.save();
  ctx.translate(W / 2, y);
  ctx.scale(S.cap.scale, S.cap.scale);
  const base = c.gold ? C.gold : C.cream;
  drawText(ctx, c.text, 0, 0, { size, color: S.cap.heat > 0.45 ? '#ffffff' : base, alpha: S.cap.alpha, baseline: 'middle' });
  ctx.restore();
}

export function drawHandle(ctx, S) {
  if (S.handle <= 0) return;
  drawText(ctx, HANDLE.text, W / 2, 990, { size: 60, weight: 400, color: C.cream, alpha: S.handle, baseline: 'middle' });
}

// -------------------------------------------------------- end-card sparkles
const SPARK_COLS = ['#b77bff', '#e9dcff', '#3df2b4', '#ffc94a'];
/** Pixel stars twinkling around the logo, on the 480x270 pixel layer. */
export function drawSparkles(ctx, t, amount) {
  ctx.clearRect(0, 0, 480, 270);
  if (amount <= 0) return;
  // a dithered pixel glow behind the logo
  for (let y = 60; y < 150; y += 2) {
    for (let x = 90; x < 390; x += 2) {
      const d = Math.hypot((x - 240) / 150, (y - 105) / 45);
      if (d < 1 && hash1(x * 7 + y * 13) * 0.5 + 0.5 > d * 1.25) {
        ctx.fillStyle = `rgba(139,92,255,${0.16 * amount})`;
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }
  for (let k = 0; k < 26; k++) {
    const x = Math.round(240 + hash1(k * 3.1) * 190);
    const y = Math.round(105 + hash1(k * 5.7) * 62);
    const ph = (t * (1.3 + (k % 5) * 0.35) + hash1(k) * 3) % 1;
    const s = ph < 0.5 ? ph * 2 : (1 - ph) * 2;
    if (s < 0.25) continue;
    ctx.fillStyle = SPARK_COLS[k % 4];
    ctx.globalAlpha = amount;
    const r = s > 0.75 ? 2 : 1;
    ctx.fillRect(x - r, y, r * 2 + 1, 1);
    ctx.fillRect(x, y - r, 1, r * 2 + 1);
    ctx.globalAlpha = 1;
  }
}

export { BOARD0, RESET, S16 };
