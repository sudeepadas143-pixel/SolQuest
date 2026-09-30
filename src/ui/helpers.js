import { panelTexture } from './skin.js';
import { FONT } from '../config.js';
import { chooseFrom } from './Menu.js';
import { PANEL } from './theme.js';

export function fadeTo(scene, key, data, ms = 350) {
  scene.cameras.main.fadeOut(ms, 0, 0, 0);
  scene.cameras.main.once('camerafadeoutcomplete', () => scene.scene.start(key, data));
}

export async function yesNo(scene, { x = 760, y = 330, depth = 1200 } = {}) {
  const i = await chooseFrom(scene, {
    x, y, w: 180, h: 130, items: [{ label: 'YES' }, { label: 'NO' }], style: PANEL.menu, depth, cancelable: true,
  });
  return i === 0;
}

export const wait = (scene, ms) => new Promise((r) => scene.time.delayedCall(ms, r));

export function tween(scene, cfg) {
  return new Promise((resolve) => scene.tweens.add({ ...cfg, onComplete: () => { cfg.onComplete?.(); resolve(); } }));
}

/** A styled DOM <input> centred at (x, y). Returns { el, dom, value(), destroy() }. */
export function domInput(scene, x, y, { width = 520, maxLength = 64, placeholder = '', fontSize = null } = {}) {
  const el = document.createElement('input');
  el.className = 'er-input';
  el.type = 'text';
  el.maxLength = maxLength;
  el.placeholder = placeholder;
  el.autocomplete = 'off';
  el.spellcheck = false;
  el.style.width = `${width}px`;
  el.style.boxSizing = 'border-box';
  if (fontSize) el.style.fontSize = fontSize;
  // style before handing to Phaser, so the origin is computed from the real size
  const dom = scene.add.dom(x, y, el).setOrigin(0.5);
  setTimeout(() => el.focus(), 50);
  return { el, dom, value: () => el.value, destroy: () => dom.destroy() };
}

/** A big tappable button (phones): a chip panel with a label. Returns the container. */
export function tapButton(scene, cx, cy, label, onTap, { w = 220, h = 56, style = 'gold', color = '#ffc94a', depth = 0, size = 28 } = {}) {
  const c = scene.add.container(cx, cy).setDepth(depth);
  const bg = scene.add.image(0, 0, panelTexture(scene, style, w, h)).setOrigin(0.5);
  const t = scene.add.text(0, 0, label, { fontFamily: FONT, fontSize: `${size}px`, color, fontStyle: 'bold' }).setOrigin(0.5);
  const zone = scene.add.zone(0, 0, w + 20, h + 20).setOrigin(0.5).setInteractive({ useHandCursor: true });
  c.add([bg, t, zone]);
  zone.on('pointerdown', () => {
    scene.tweens.add({ targets: c, scale: 0.94, duration: 70, yoyo: true });
    onTap();
  });
  return c;
}
