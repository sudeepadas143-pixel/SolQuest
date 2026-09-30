// SolQuest UI skin: panels, chips, buttons and bars painted with the 2D
// canvas (real blurred drop shadows, gradients, gloss) and cached as textures.
//
// Identity: deep "night route" navy glass, cream type, and a signature
// three-colour diagonal ROUTE STRIPE (violet / mint / gold) on panel corners.
import Phaser from 'phaser';

export const C = {
  navy: '#12163a', navy2: '#1c2150', ink: '#0b0e24',
  cream: '#fff7e6', muted: '#a8acd6',
  violet: '#8b5cff', mint: '#2ef2a8', gold: '#ffc94a', coral: '#ff6b7a', sky: '#5ccaff',
  plate: '#fffaf0', plate2: '#e8e0cf',
};
export const hex = (s) => parseInt(s.slice(1), 16);

export const STYLES = {
  glass: { top: 'rgba(30,36,84,0.94)', bottom: 'rgba(14,17,44,0.94)', border: '#fff7e6', inner: 'rgba(139,92,255,0.8)', stripes: true, r: 16 },
  menu: { top: 'rgba(34,40,92,0.97)', bottom: 'rgba(16,19,48,0.97)', border: '#fff7e6', inner: 'rgba(46,242,168,0.55)', stripes: true, r: 14 },
  chip: { top: 'rgba(24,29,70,0.86)', bottom: 'rgba(12,15,38,0.86)', border: 'rgba(255,247,230,0.85)', inner: null, stripes: false, r: 12, shadow: 0.35 },
  plate: { top: '#fffdf6', bottom: '#e9e1cf', border: '#12163a', inner: 'rgba(255,255,255,0.8)', stripes: true, r: 12, text: 'dark' },
  gold: { top: 'rgba(52,30,92,0.96)', bottom: 'rgba(22,12,44,0.96)', border: '#ffc94a', inner: 'rgba(46,242,168,0.6)', stripes: true, r: 16 },
  card: { top: 'rgba(255,253,246,0.97)', bottom: 'rgba(233,225,207,0.97)', border: '#12163a', inner: 'rgba(255,255,255,0.9)', stripes: false, r: 18, text: 'dark' },
};

const PAD = 18;

function roundRect(ctx, x, y, w, h, r, skew = 0) {
  ctx.beginPath();
  ctx.moveTo(x + r + skew, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w - skew, y + h - r);
  ctx.quadraticCurveTo(x + w - skew, y + h, x + w - r - skew, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x + skew, y + r);
  ctx.quadraticCurveTo(x + skew, y, x + r + skew, y);
  ctx.closePath();
}

function stripes(ctx, x, y, w, h, n = 3) {
  const cols = [C.violet, C.mint, C.gold];
  const sw = 9;
  ctx.save();
  roundRect(ctx, x, y, w, h, 14);
  ctx.clip();
  for (let i = 0; i < n; i++) {
    const sx = x + w - 26 - i * (sw + 5);
    ctx.fillStyle = cols[i % 3];
    ctx.beginPath();
    ctx.moveTo(sx, y - 2);
    ctx.lineTo(sx + sw, y - 2);
    ctx.lineTo(sx + sw - 16, y + 18);
    ctx.lineTo(sx - 16, y + 18);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

/** Texture key for a panel of the given style and size (cached). */
export function panelTexture(scene, style, w, h, { skew = 0, accent = null } = {}) {
  const key = `pnl_${style}_${w}x${h}_${skew}_${accent ?? ''}`;
  if (scene.textures.exists(key)) return key;
  const s = STYLES[style];
  const cw = w + PAD * 2;
  const ch = h + PAD * 2;
  const tex = scene.textures.createCanvas(key, cw, ch);
  const ctx = tex.getContext();
  const x = PAD;
  const y = PAD;
  // soft blurred shadow + hard offset shadow (the "sticker" look)
  ctx.save();
  ctx.shadowColor = `rgba(4,6,20,${s.shadow ?? 0.5})`;
  ctx.shadowBlur = 16;
  ctx.shadowOffsetY = 7;
  ctx.fillStyle = 'rgba(8,10,28,0.55)';
  roundRect(ctx, x + 5, y + 6, w, h, s.r, skew);
  ctx.fill();
  ctx.restore();
  // body gradient
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, s.top);
  g.addColorStop(1, s.bottom);
  ctx.fillStyle = g;
  roundRect(ctx, x, y, w, h, s.r, skew);
  ctx.fill();
  // coloured accent bar on the left (battle plates use the creature's type colour)
  if (accent) {
    ctx.save();
    roundRect(ctx, x, y, w, h, s.r, skew);
    ctx.clip();
    ctx.fillStyle = accent;
    ctx.fillRect(x, y, 10 + skew, h);
    ctx.restore();
  }
  // gloss
  ctx.save();
  roundRect(ctx, x, y, w, h, s.r, skew);
  ctx.clip();
  const gl = ctx.createLinearGradient(0, y, 0, y + h * 0.5);
  gl.addColorStop(0, 'rgba(255,255,255,0.16)');
  gl.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gl;
  ctx.fillRect(x, y, w, h * 0.5);
  ctx.restore();
  if (s.stripes) stripes(ctx, x, y, w, h);
  // borders
  ctx.lineWidth = 3;
  ctx.strokeStyle = s.border;
  roundRect(ctx, x + 1.5, y + 1.5, w - 3, h - 3, s.r - 1, skew);
  ctx.stroke();
  if (s.inner) {
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = s.inner;
    roundRect(ctx, x + 6, y + 6, w - 12, h - 12, Math.max(4, s.r - 6), skew);
    ctx.stroke();
  }
  tex.refresh();
  return key;
}

/** Add a panel image whose visible box starts at (x, y). */
export function panel(scene, x, y, w, h, style = 'glass', opts = {}) {
  return scene.add.image(x - PAD, y - PAD, panelTexture(scene, style, w, h, opts)).setOrigin(0);
}

/** Gradient selection bar (violet -> mint) with a chevron notch. */
export function highlightTexture(scene, w, h) {
  const key = `hl_${w}x${h}`;
  if (scene.textures.exists(key)) return key;
  const tex = scene.textures.createCanvas(key, w, h);
  const ctx = tex.getContext();
  const g = ctx.createLinearGradient(0, 0, w, 0);
  g.addColorStop(0, 'rgba(139,92,255,0.95)');
  g.addColorStop(1, 'rgba(46,242,168,0.75)');
  ctx.fillStyle = g;
  roundRect(ctx, 0, 0, w, h, Math.min(12, h / 2));
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(4, 3, w - 8, Math.max(2, h * 0.3));
  tex.refresh();
  return key;
}

/** Big command button (battle): coloured pill with icon glyph and shadow. */
export function buttonTexture(scene, label, color, w, h, icon) {
  const key = `btn_${label}_${w}x${h}`;
  if (scene.textures.exists(key)) return key;
  const cw = w + 16;
  const ch = h + 16;
  const tex = scene.textures.createCanvas(key, cw, ch);
  const ctx = tex.getContext();
  ctx.save();
  ctx.shadowColor = 'rgba(4,6,20,0.55)';
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 4;
  ctx.fillStyle = shade(color, -0.35);
  roundRect(ctx, 8, 11, w, h - 3, h / 2 - 2);
  ctx.fill();
  ctx.restore();
  const g = ctx.createLinearGradient(0, 8, 0, 8 + h);
  g.addColorStop(0, shade(color, 0.18));
  g.addColorStop(1, shade(color, -0.12));
  ctx.fillStyle = g;
  roundRect(ctx, 8, 8, w, h - 5, h / 2 - 3);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  roundRect(ctx, 16, 11, w - 16, (h - 5) * 0.32, 6);
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = C.ink;
  roundRect(ctx, 8, 8, w, h - 5, h / 2 - 3);
  ctx.stroke();
  // icon disc
  const cx = 8 + h / 2;
  const cy = 8 + (h - 5) / 2;
  ctx.fillStyle = 'rgba(11,14,36,0.35)';
  ctx.beginPath();
  ctx.arc(cx, cy, (h - 5) / 2 - 6, 0, Math.PI * 2);
  ctx.fill();
  drawIcon(ctx, icon, cx, cy, (h - 5) / 2 - 9, '#fff7e6');
  tex.refresh();
  return key;
}

export function drawIcon(ctx, icon, cx, cy, r, col) {
  ctx.save();
  ctx.fillStyle = col;
  ctx.strokeStyle = col;
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  if (icon === 'fight') {           // crossed claws
    ctx.beginPath();
    ctx.moveTo(cx - r, cy + r); ctx.lineTo(cx + r * 0.7, cy - r * 0.8);
    ctx.moveTo(cx + r, cy + r); ctx.lineTo(cx - r * 0.7, cy - r * 0.8);
    ctx.stroke();
  } else if (icon === 'bag') {
    roundRect(ctx, cx - r * 0.8, cy - r * 0.4, r * 1.6, r * 1.3, 3);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx, cy - r * 0.4, r * 0.45, Math.PI, 0);
    ctx.stroke();
  } else if (icon === 'team') {      // capsule
    ctx.beginPath(); ctx.arc(cx, cy, r * 0.9, Math.PI, 0); ctx.fill();
    ctx.beginPath(); ctx.arc(cx, cy, r * 0.9, 0, Math.PI); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, r * 0.28, 0, Math.PI * 2); ctx.fill();
  } else if (icon === 'run') {       // arrow
    ctx.beginPath();
    ctx.moveTo(cx - r, cy); ctx.lineTo(cx + r * 0.6, cy);
    ctx.moveTo(cx + r * 0.1, cy - r * 0.6); ctx.lineTo(cx + r * 0.8, cy); ctx.lineTo(cx + r * 0.1, cy + r * 0.6);
    ctx.stroke();
  } else if (icon === 'sun') {
    ctx.beginPath(); ctx.arc(cx, cy, r * 0.5, 0, Math.PI * 2); ctx.fill();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * r * 0.75, cy + Math.sin(a) * r * 0.75);
      ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); ctx.stroke();
    }
  } else if (icon === 'moon') {
    ctx.beginPath(); ctx.arc(cx, cy, r * 0.8, 0, Math.PI * 2); ctx.fill();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath(); ctx.arc(cx + r * 0.4, cy - r * 0.3, r * 0.7, 0, Math.PI * 2); ctx.fill();
  } else if (icon === 'rain' || icon === 'storm' || icon === 'cloudy') {
    ctx.beginPath();
    ctx.arc(cx - r * 0.35, cy - r * 0.05, r * 0.45, 0, Math.PI * 2);
    ctx.arc(cx + r * 0.25, cy - r * 0.25, r * 0.55, 0, Math.PI * 2);
    ctx.arc(cx + r * 0.55, cy + r * 0.05, r * 0.35, 0, Math.PI * 2);
    ctx.fill();
    if (icon === 'rain') {
      for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(cx + i * r * 0.4, cy + r * 0.45); ctx.lineTo(cx + i * r * 0.4 - 3, cy + r * 0.9); ctx.stroke(); }
    }
    if (icon === 'storm') {
      ctx.fillStyle = C.gold;
      ctx.beginPath(); ctx.moveTo(cx, cy + r * 0.2); ctx.lineTo(cx - r * 0.3, cy + r * 0.7); ctx.lineTo(cx, cy + r * 0.6); ctx.lineTo(cx - r * 0.15, cy + r); ctx.lineTo(cx + r * 0.3, cy + r * 0.45); ctx.lineTo(cx, cy + r * 0.5); ctx.closePath(); ctx.fill();
    }
  } else if (icon === 'pin') {
    ctx.beginPath(); ctx.arc(cx, cy - r * 0.25, r * 0.55, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(cx - r * 0.45, cy); ctx.lineTo(cx, cy + r); ctx.lineTo(cx + r * 0.45, cy); ctx.fill();
    ctx.fillStyle = C.navy; ctx.beginPath(); ctx.arc(cx, cy - r * 0.25, r * 0.22, 0, Math.PI * 2); ctx.fill();
  } else if (icon === 'clock') {
    ctx.beginPath(); ctx.arc(cx, cy, r * 0.85, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx, cy - r * 0.55); ctx.moveTo(cx, cy); ctx.lineTo(cx + r * 0.4, cy + r * 0.1); ctx.stroke();
  } else if (icon === 'star') {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const rr = i % 2 ? r * 0.45 : r;
      ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
    }
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

/** Small icon texture (HUD). */
export function iconTexture(scene, icon, size = 26, col = '#fff7e6') {
  const key = `ico_${icon}_${size}_${col}`;
  if (scene.textures.exists(key)) return key;
  const tex = scene.textures.createCanvas(key, size, size);
  drawIcon(tex.getContext(), icon, size / 2, size / 2, size / 2 - 2, col);
  tex.refresh();
  return key;
}

/**
 * Circular portrait badge cut from a trainer's battle sprite (the head).
 * beaten=false renders it desaturated behind a lock tint.
 */
export function badgeTexture(scene, spriteKey, size, ring, beaten) {
  const key = `badge_${spriteKey}_${size}_${ring}_${beaten ? 1 : 0}`;
  if (scene.textures.exists(key)) return key;
  const src = scene.textures.get(spriteKey).getSourceImage();
  const head = headBox(src);
  const tex = scene.textures.createCanvas(key, size + 8, size + 8);
  const ctx = tex.getContext();
  const c = size / 2 + 4;
  ctx.save();
  ctx.shadowColor = 'rgba(4,6,20,0.6)';
  ctx.shadowBlur = 6;
  ctx.shadowOffsetY = 2;
  ctx.fillStyle = beaten ? C.navy2 : '#2a2e48';
  ctx.beginPath(); ctx.arc(c, c, size / 2, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.beginPath(); ctx.arc(c, c, size / 2 - 2, 0, Math.PI * 2); ctx.clip();
  ctx.imageSmoothingEnabled = false;
  const s = (size * 1.05) / head.w;
  ctx.drawImage(src, head.x, head.y, head.w, head.w, c - (head.w * s) / 2, c - (head.w * s) / 2 + 2, head.w * s, head.w * s);
  if (!beaten) {
    const d = ctx.getImageData(0, 0, size + 8, size + 8);
    for (let i = 0; i < d.data.length; i += 4) {
      const l = d.data[i] * 0.3 + d.data[i + 1] * 0.59 + d.data[i + 2] * 0.11;
      d.data[i] = l * 0.55 + 20; d.data[i + 1] = l * 0.55 + 22; d.data[i + 2] = l * 0.55 + 40;
    }
    ctx.putImageData(d, 0, 0);
  }
  ctx.restore();
  ctx.lineWidth = 3;
  ctx.strokeStyle = beaten ? ring : 'rgba(168,172,214,0.7)';
  ctx.beginPath(); ctx.arc(c, c, size / 2 - 1, 0, Math.PI * 2); ctx.stroke();
  tex.refresh();
  return key;
}

function headBox(img) {
  const cv = document.createElement('canvas');
  cv.width = img.width;
  cv.height = img.height;
  const ctx = cv.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const { data } = ctx.getImageData(0, 0, img.width, img.height);
  let top = img.height;
  let minx = img.width;
  let maxx = 0;
  const limit = Math.floor(img.height * 0.3);
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      if (data[(y * img.width + x) * 4 + 3] > 0) {
        if (y < top) top = y;
        if (y < top + limit) { minx = Math.min(minx, x); maxx = Math.max(maxx, x); }
      }
    }
  }
  // the head sits in the top ~30% but pointing arms widen that band; centre on
  // the densest column range instead of the full width.
  const w = Math.max(18, Math.min(maxx - minx, Math.round(img.height * 0.3)));
  let best = minx;
  let bestCount = -1;
  for (let x0 = minx; x0 <= maxx - w; x0++) {
    let n = 0;
    for (let y = top; y < top + w; y++) for (let x = x0; x < x0 + w; x += 2) if (data[(y * img.width + x) * 4 + 3] > 0) n++;
    if (n > bestCount) { bestCount = n; best = x0; }
  }
  return { x: best, y: Math.max(0, top - 2), w };
}

export function shade(col, amt) {
  const c = Phaser.Display.Color.HexStringToColor(col);
  const f = (v) => Math.max(0, Math.min(255, Math.round(amt >= 0 ? v + (255 - v) * amt : v * (1 + amt))));
  return `rgb(${f(c.red)},${f(c.green)},${f(c.blue)})`;
}

/** Procedural helper textures used across scenes (called once in Boot). */
export function makeFxTextures(scene) {
  const radial = (key, size, stops) => {
    const t = scene.textures.createCanvas(key, size, size);
    const ctx = t.getContext();
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    for (const [o, c] of stops) g.addColorStop(o, c);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    t.refresh();
  };
  radial('glow', 128, [[0, 'rgba(255,255,255,0.95)'], [0.25, 'rgba(255,255,255,0.45)'], [1, 'rgba(255,255,255,0)']]);
  const cs = scene.textures.createCanvas('cloudshadow', 420, 240);
  const cctx = cs.getContext();
  for (const [x, y, r] of [[140, 120, 90], [220, 100, 110], [300, 130, 80], [200, 150, 90]]) {
    const g = cctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(10,20,40,0.9)');
    g.addColorStop(1, 'rgba(10,20,40,0)');
    cctx.fillStyle = g;
    cctx.fillRect(0, 0, 420, 240);
  }
  cs.refresh();
  const rd = scene.textures.createCanvas('raindrop', 2, 18);
  const rctx = rd.getContext();
  const rg = rctx.createLinearGradient(0, 0, 0, 18);
  rg.addColorStop(0, 'rgba(200,220,255,0)');
  rg.addColorStop(1, 'rgba(220,235,255,0.9)');
  rctx.fillStyle = rg;
  rctx.fillRect(0, 0, 2, 18);
  rd.refresh();
  const rp = scene.textures.createCanvas('ripple', 24, 10);
  const pctx = rp.getContext();
  pctx.strokeStyle = 'rgba(220,235,255,0.9)';
  pctx.lineWidth = 1.5;
  pctx.beginPath(); pctx.ellipse(12, 5, 10, 3.5, 0, 0, Math.PI * 2); pctx.stroke();
  rp.refresh();
  const sp = scene.textures.createCanvas('spark', 24, 24);
  const sctx = sp.getContext();
  sctx.fillStyle = '#ffffff';
  sctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    const r = i % 2 ? 3 : 11;
    sctx.lineTo(12 + Math.cos(a) * r, 12 + Math.sin(a) * r);
  }
  sctx.closePath();
  sctx.fill();
  sp.refresh();
  // speech-bubble "!" used when a trainer spots you
  const ex = scene.textures.createCanvas('exclaim', 26, 30);
  const ectx = ex.getContext();
  ectx.fillStyle = '#fff7e6';
  ectx.strokeStyle = '#12163a';
  ectx.lineWidth = 2.5;
  roundRect(ectx, 2, 2, 22, 20, 7);
  ectx.fill(); ectx.stroke();
  ectx.beginPath(); ectx.moveTo(9, 21); ectx.lineTo(13, 28); ectx.lineTo(16, 21); ectx.closePath(); ectx.fill(); ectx.stroke();
  ectx.fillStyle = '#ff6b7a';
  ectx.fillRect(11.5, 6, 3.5, 9);
  ectx.fillRect(11.5, 16.5, 3.5, 3);
  ex.refresh();
}
