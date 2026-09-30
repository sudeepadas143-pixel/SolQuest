// Bar 1: red candles crashing - the one scene the game can't produce, built
// for the trailer in the game's own palette at a low native resolution
// (480x270, scaled up 4x with nearest-neighbour like the game layer).
// Every beat is a new chart crashing ("charts. bundles. rugs. repeat.").
import { BEAT } from '../grid.js';
import { prng } from '../remap.js';

export const PW = 480;
export const PH = 270;

const PAL = {
  bg0: '#0b0e24', bg1: '#1a0f2c', grid: '#161a3e', grid2: '#1e2350',
  red: '#ee4f4b', redHi: '#ff6b7a', redLo: '#8e1f33', redInk: '#3a0d1c',
  mint: '#2ef2a8', mintLo: '#14a878', cream: '#fff7e6', line: '#ff9aa6',
};

function chart(seed) {
  const r = prng(seed);
  const cs = [];
  let p = 100;
  for (let i = 0; i < 70; i++) {
    const pump = i < 9 && r() < 0.55;                    // a little fake strength first
    const move = pump ? r() * 5 + 1 : -(r() * 7 + 1.5) * (i > 16 ? 1.8 : 1);
    const rug = i === 21 || i === 38;                     // the big candles
    const o = p;
    const c = p + (rug ? -(38 + r() * 20) : move);
    const hi = Math.max(o, c) + r() * 4 + 0.5;
    const lo = Math.min(o, c) - r() * (rug ? 14 : 5) - 0.5;
    cs.push({ o, c, hi, lo });
    p = c;
  }
  return cs;
}
const charts = [chart(11), chart(29), chart(47), chart(83)];

/** Draw the candle scene at local time t (0 .. one bar). */
export function drawCandles(ctx, t) {
  const beat = Math.min(3, Math.floor(t / BEAT));
  const lt = t - beat * BEAT;
  const cs = charts[beat];
  ctx.imageSmoothingEnabled = false;
  const g = ctx.createLinearGradient(0, 0, 0, PH);
  g.addColorStop(0, PAL.bg0);
  g.addColorStop(0.7, PAL.bg1);
  g.addColorStop(1, '#3a0d1c');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, PW, PH);
  const cw = 11;
  const step = 15;
  const RATE = 0.028;                                   // a candle prints every ~28 ms: a free fall
  const printed = 17 + Math.floor(lt / RATE);
  const scroll = Math.max(0, (printed + 1) * step - (PW - 96));
  // the camera lags the price: the newest candles fall out of the bottom
  const recent = cs.slice(Math.max(0, printed - 16), printed + 1);
  const top = Math.max(...recent.map((c) => c.hi)) + 4;
  const bottom = recent[Math.floor(recent.length / 2)].lo - 18;
  const y = (p) => Math.round(18 + ((top - p) / (top - bottom)) * (PH - 36));
  // grid
  ctx.fillStyle = PAL.grid2;
  for (let x = -(scroll % 45); x < PW; x += 45) ctx.fillRect(Math.round(x), 0, 1, PH);
  for (let k = 0; k < 7; k++) ctx.fillRect(0, 18 + k * 39, PW, 1);
  // candles; the newest one is still forming (growing downward)
  let prevClose = null;
  for (let i = Math.max(0, printed - 40); i <= Math.min(printed, cs.length - 1); i++) {
    const c = cs[i];
    const x = Math.round(24 + i * step - scroll);
    if (x < -cw || x > PW) continue;
    const forming = i === printed;
    const f = forming ? ((lt / RATE) % 1) : 1;
    const close = c.o + (c.c - c.o) * f;
    const up = close >= c.o;
    const yt = y(Math.max(c.o, close));
    const yb = Math.max(yt + 2, y(Math.min(c.o, close)));
    ctx.fillStyle = up ? PAL.mintLo : PAL.redLo;
    ctx.fillRect(x + 5, y(c.hi), 1, Math.max(1, y(forming ? Math.min(c.lo, close) : c.lo) - y(c.hi)));
    ctx.fillStyle = PAL.redInk;
    ctx.fillRect(x - 1, yt - 1, cw + 2, yb - yt + 2);
    ctx.fillStyle = up ? PAL.mint : PAL.red;
    ctx.fillRect(x, yt, cw, yb - yt);
    ctx.fillStyle = up ? '#8dffd2' : PAL.redHi;
    ctx.fillRect(x, yt, 2, yb - yt);
    ctx.fillStyle = up ? PAL.mintLo : PAL.redLo;
    ctx.fillRect(x + cw - 2, yt, 2, yb - yt);
    if (prevClose !== null) {
      ctx.fillStyle = PAL.line;
      const y0 = y(prevClose);
      const y1 = y(close);
      for (let yy = Math.min(y0, y1); yy <= Math.max(y0, y1); yy++) ctx.fillRect(x - 2, yy, 1, 1);
    }
    prevClose = close;
    if (forming) {
      const py = Math.min(PH - 8, y(close));
      ctx.fillStyle = PAL.red;
      ctx.fillRect(x + cw + 2, py, PW - x, 1);
      ctx.fillRect(PW - 40, py - 6, 40, 13);
      ctx.fillStyle = PAL.redInk;
      ctx.fillRect(PW - 40, py + 7, 40, 1);
      ctx.fillStyle = PAL.cream;
      ctx.fillRect(PW - 33, py - 1, 26, 3);
    }
  }
  // each beat opens on a red wash (the flash of the next crash)
  if (beat > 0 && lt < 0.07) {                          // (beat 0 stays clean: frame 0 must read)
    ctx.fillStyle = `rgba(238,79,75,${0.4 * (1 - lt / 0.07)})`;
    ctx.fillRect(0, 0, PW, PH);
  }
}
