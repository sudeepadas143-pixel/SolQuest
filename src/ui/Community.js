// Community: the project's X (Twitter) and the token's contract address (CA),
// from data/community.js. A strip on the title screen (always visible) and a
// panel from the main menu. Mouse: click OPEN / COPY. Keys: up/down, ENTER,
// ESC to close.
import { GAME_W, GAME_H } from '../config.js';
import { X_URL, X_HANDLE, CONTRACT_ADDRESS, TOKEN_TICKER } from '../data/community.js';
import { pushFocus } from '../systems/controls.js';
import { sfx } from '../systems/audio.js';
import { panel, text } from './theme.js';
import { highlightTexture } from './skin.js';
import { tapButton } from './helpers.js';

export const shortCA = (ca) => (ca.length > 14 ? `${ca.slice(0, 6)}…${ca.slice(-6)}` : ca);

export function openUrl(url) {
  if (!url) return false;
  const w = window.open(url, '_blank', 'noopener,noreferrer');
  if (w) w.opener = null;
  return true;
}

/** Copy to the clipboard (with a fallback for older / insecure contexts). */
export async function copyText(str) {
  try {
    await navigator.clipboard.writeText(str);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = str;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;left:-9999px;top:0';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { ok = false; }
    ta.remove();
    return ok;
  }
}

/** An invisible real-DOM hotspot over part of the canvas: an <a href> for a
 *  link, a <button> otherwise. Browsers (Safari and phones especially) only
 *  open new tabs and write the clipboard from a genuine click on a page
 *  element - not from the game's own tap handling - so links and copy buttons
 *  get one of these on top. Returns the DOMElement (hide it with setVisible). */
export function domHotspot(scene, x, y, w, h, { href = null, onClick = null, label = '' } = {}) {
  const el = document.createElement(href ? 'a' : 'button');
  if (href) {
    el.href = href;
    el.target = '_blank';
    el.rel = 'noopener noreferrer';
  } else el.type = 'button';
  el.setAttribute('aria-label', label);
  el.style.cssText = `display:block;width:${w}px;height:${h}px;margin:0;padding:0;border:0;background:transparent;cursor:pointer;-webkit-tap-highlight-color:transparent;outline:none`;
  if (onClick) el.addEventListener('click', (e) => { if (!href) e.preventDefault(); onClick(e); });
  return scene.add.dom(x, y, el).setOrigin(0);
}

/** A brief "Copied!" note floating up from (x, y). */
function toast(scene, x, y, msg, color = '#2ef2a8', depth = 2000) {
  const t = text(scene, x, y, msg, 18, color, { fontStyle: 'bold' }).setOrigin(0.5).setDepth(depth);
  scene.tweens.add({ targets: t, y: y - 22, alpha: 0, delay: 650, duration: 450, onComplete: () => t.destroy() });
}

export async function copyCA(scene, x, y, depth) {
  if (!CONTRACT_ADDRESS) { sfx('bump'); toast(scene, x, y, 'Coming soon', '#ffc94a', depth); return; }
  const ok = await copyText(CONTRACT_ADDRESS);
  sfx(ok ? 'confirm' : 'bump');
  toast(scene, x, y, ok ? 'CA copied!' : 'Copy failed - select it by hand', ok ? '#2ef2a8' : '#ff8a8a', depth);
}

export function followX(scene, x, y, depth) {
  if (!openUrl(X_URL)) { sfx('bump'); toast(scene, x, y, 'Coming soon', '#ffc94a', depth); return; }
  sfx('confirm');
}

/** The always-on strip at the bottom-left of the title screen: [X] and [CA ⧉]. */
export function communityStrip(scene, { x = 16, y = GAME_H - 46, depth = 50 } = {}) {
  const c = scene.add.container(0, 0).setDepth(depth);
  const hotspots = [];
  const chip = (cx, w, label, color, hot) => {
    c.add(panel(scene, cx, y, w, 34, 'chip'));
    const t = text(scene, cx + w / 2, y + 17, label, 17, color, { fontStyle: 'bold' }).setOrigin(0.5);
    c.add(t);
    const d = domHotspot(scene, cx, y, w, 34, hot);
    d.node.addEventListener('pointerenter', () => t.setAlpha(0.75));
    d.node.addEventListener('pointerleave', () => t.setAlpha(1));
    hotspots.push(d);
    return cx + w + 8;
  };
  let nx = chip(x, 112, X_URL ? 'X  FOLLOW' : 'X  SOON', '#fff7e6', X_URL
    ? { href: X_URL, label: 'SolQuest on X', onClick: () => sfx('confirm') }
    : { label: 'X coming soon', onClick: () => followX(scene, x + 56, y - 8, depth + 1) });
  const ca = CONTRACT_ADDRESS ? `CA ${shortCA(CONTRACT_ADDRESS)}  COPY` : 'CA  COMING SOON';
  const caW = CONTRACT_ADDRESS ? 250 : 190;
  const caX = nx;
  nx = chip(nx, caW, ca, '#2ef2a8', { label: 'Copy the contract address', onClick: () => copyCA(scene, caX + caW / 2, y - 8, depth + 1) });
  // page elements sit above the canvas: hide them while a board or panel covers the strip
  c.setLinksActive = (on) => hotspots.forEach((d) => d.setVisible(on));
  return c;
}

/** The COMMUNITY panel from the main menu. Resolves when closed. */
export function openCommunity(scene, { depth = 1500 } = {}) {
  return new Promise((resolve) => {
    const W = 640;
    const H = 380;
    const x0 = (GAME_W - W) / 2;
    const y0 = (GAME_H - H) / 2 - 20;
    const objs = [];
    const add = (o) => { o.setDepth?.(depth + 1); objs.push(o); return o; };
    add(scene.add.rectangle(0, 0, GAME_W, GAME_H, 0x05040c, 0.55).setOrigin(0).setInteractive()).setDepth(depth);
    add(panel(scene, x0, y0, W, H, 'gold'));
    add(text(scene, x0 + 32, y0 + 22, 'COMMUNITY', 30, '#ffc94a', { fontStyle: 'bold' }));
    const hl = add(scene.add.image(x0 + 22, 0, highlightTexture(scene, W - 44, 76)).setOrigin(0, 0.5).setAlpha(0.45));

    const rows = [
      {
        label: 'X (Twitter)', value: X_URL ? (X_HANDLE || X_URL.replace(/^https?:\/\/(www\.)?/, '')) : 'Coming soon',
        action: X_URL ? 'OPEN' : null, run: (bx, by) => followX(scene, bx, by, depth + 3),
      },
      {
        label: `Contract address${TOKEN_TICKER ? ` (${TOKEN_TICKER})` : ''}`, value: CONTRACT_ADDRESS || 'Coming soon',
        action: CONTRACT_ADDRESS ? 'COPY' : null, run: (bx, by) => copyCA(scene, bx, by, depth + 3),
      },
    ];
    rows.forEach((r, i) => {
      r.y = y0 + 120 + i * 96;
      add(text(scene, x0 + 48, r.y - 30, r.label, 20, '#a8acd6'));
      // a long CA in a smaller face so the whole address shows (people should see it in full)
      const long = r.value.length > 30;
      add(text(scene, x0 + 48, r.y - 4, r.value, long ? 15 : 24, r.action ? '#fff7e6' : '#7a7ea0', { fontStyle: 'bold' }));
      if (r.action) {
        const bx = x0 + W - 92;
        r.btn = tapButton(scene, bx, r.y - 6, r.action, () => {}, { w: 104, h: 40, size: 20, depth: depth + 2, style: 'chip', color: '#2ef2a8' });
        objs.push(r.btn);
        // the real click target (see domHotspot)
        const pop = () => { sel = i; draw(); scene.tweens.add({ targets: r.btn, scale: 0.94, duration: 70, yoyo: true }); };
        objs.push(domHotspot(scene, bx - 56, r.y - 30, 112, 48, i === 0
          ? { href: X_URL, label: 'SolQuest on X', onClick: () => { pop(); sfx('confirm'); } }
          : { label: 'Copy the contract address', onClick: () => { pop(); r.run(bx, r.y - 40); } }));
      }
      add(scene.add.zone(x0 + 22, r.y - 44, W - 160, 84).setOrigin(0).setInteractive())
        .on('pointerover', () => { sel = i; draw(); });
    });
    add(text(scene, GAME_W / 2, y0 + H - 98, 'Only trust the address shown here. We will never DM you first.', 16, '#8f93c4').setOrigin(0.5));
    const done = tapButton(scene, GAME_W / 2, y0 + H - 44, 'DONE', () => close(), { w: 200, h: 48, depth: depth + 2, size: 24 });
    objs.push(done);

    let sel = 0;
    function draw() { hl.setY(rows[sel].y - 10); }
    draw();

    let release = () => {};
    function close() {
      release();
      sfx('cancel');
      objs.forEach((o) => o.destroy());
      resolve();
    }
    release = pushFocus((a) => {
      if (a === 'up' || a === 'down') { sel = (sel + 1) % rows.length; sfx('cursor'); draw(); }
      if (a === 'confirm') { const r = rows[sel]; if (r.action) r.run(x0 + W - 92, r.y - 40); else sfx('bump'); }
      if (a === 'cancel' || a === 'menu') close();
    }, scene);
  });
}
