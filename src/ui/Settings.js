// Settings panel: music volume, sound-effect volume, text speed, sound on/off.
// Mouse: click the arrows (or a bar) and DONE. Keys: up/down pick a row,
// left/right change it, ENTER/ESC close. Changes apply at once and are kept
// per browser (systems/settings.js).
import { GAME_W, GAME_H } from '../config.js';
import { pushFocus } from '../systems/controls.js';
import { sfx, setMuted, isMuted } from '../systems/audio.js';
import { getSetting, setSetting, TEXT_SPEEDS } from '../systems/settings.js';
import { panel, text } from './theme.js';
import { highlightTexture } from './skin.js';
import { tapButton } from './helpers.js';

const TEXT_LABEL = { slow: 'SLOW', normal: 'NORMAL', fast: 'FAST' };

export function openSettings(scene, { depth = 1500 } = {}) {
  return new Promise((resolve) => {
    const W = 600;
    const H = 420;
    const x0 = (GAME_W - W) / 2;
    const y0 = (GAME_H - H) / 2 - 20;
    const objs = [];
    const add = (o) => { o.setDepth?.(depth + 1); objs.push(o); return o; };
    const shade = add(scene.add.rectangle(0, 0, GAME_W, GAME_H, 0x05040c, 0.55).setOrigin(0).setInteractive());
    shade.setDepth(depth);
    add(panel(scene, x0, y0, W, H, 'gold'));
    add(text(scene, x0 + 32, y0 + 22, 'SETTINGS', 30, '#ffc94a', { fontStyle: 'bold' }));
    const hl = add(scene.add.image(x0 + 22, 0, highlightTexture(scene, W - 44, 46)).setOrigin(0, 0.5).setAlpha(0.5));

    const rows = [
      { key: 'music', label: 'Music', kind: 'vol' },
      { key: 'sfx', label: 'Sound effects', kind: 'vol' },
      { key: 'text', label: 'Text speed', kind: 'text' },
      { key: 'mute', label: 'Sound', kind: 'mute' },
    ];
    const valueOf = (r) => (r.kind === 'mute' ? !isMuted() : getSetting(r.key));
    const change = (r, dir) => {
      if (r.kind === 'vol') {
        const v = Math.max(0, Math.min(10, getSetting(r.key) + dir));
        if (v === getSetting(r.key)) { sfx('bump'); return; }
        setSetting(r.key, v);
        if (r.key === 'sfx') sfx('confirm'); else sfx('cursor');
      } else if (r.kind === 'text') {
        const i = TEXT_SPEEDS.indexOf(getSetting('text'));
        const j = Math.max(0, Math.min(TEXT_SPEEDS.length - 1, i + dir));
        if (j === i) { sfx('bump'); return; }
        setSetting('text', TEXT_SPEEDS[j]);
        sfx('cursor');
      } else {
        setMuted(!isMuted());
        sfx('cursor');
      }
      draw();
    };

    rows.forEach((r, i) => {
      r.y = y0 + 104 + i * 58;
      add(text(scene, x0 + 48, r.y, r.label, 24, '#fff7e6').setOrigin(0, 0.5));
      const ax = x0 + W - 250;
      r.left = add(text(scene, ax, r.y, '◀', 24, '#2ef2a8').setOrigin(0.5));
      r.right = add(text(scene, x0 + W - 48, r.y, '▶', 24, '#2ef2a8').setOrigin(0.5));
      for (const [arrow, dir] of [[r.left, -1], [r.right, 1]]) {
        arrow.setInteractive({ useHandCursor: true }).on('pointerdown', () => { sel = i; change(r, r.kind === 'mute' ? 0 : dir); });
      }
      r.g = add(scene.add.graphics());
      r.val = add(text(scene, (ax + x0 + W - 48) / 2, r.y, '', 22, '#fff7e6', { fontStyle: 'bold' }).setOrigin(0.5));
      // volume bars are clickable too: click a bar to set that level
      if (r.kind === 'vol') {
        for (let k = 0; k < 10; k++) {
          const bx = ax + 26 + k * 16;
          add(scene.add.zone(bx - 1, r.y - 14, 16, 28).setOrigin(0).setInteractive({ useHandCursor: true }))
            .on('pointerdown', () => { sel = i; const v = k + 1; const d = v - getSetting(r.key); if (d) change(r, d); });
        }
      }
      add(scene.add.zone(x0 + 22, r.y - 23, 260, 46).setOrigin(0).setInteractive())
        .on('pointerover', () => { sel = i; draw(); });
    });
    const done = tapButton(scene, GAME_W / 2, y0 + H - 40, 'DONE', () => close(), { w: 200, h: 48, depth: depth + 2, size: 24 });
    objs.push(done);

    let sel = 0;
    function draw() {
      hl.setY(rows[sel].y);
      for (const r of rows) {
        r.g.clear();
        const v = valueOf(r);
        if (r.kind === 'vol') {
          r.val.setText('');
          const ax = x0 + W - 250;
          for (let k = 0; k < 10; k++) {
            const on = k < v;
            r.g.fillStyle(on ? 0x2ef2a8 : 0x3a3f6a, 1).fillRoundedRect(ax + 26 + k * 16, r.y - 9 - (k * 0.8), 11, 18 + k * 0.8, 3);
          }
        } else if (r.kind === 'text') {
          r.val.setText(TEXT_LABEL[v]);
        } else {
          r.val.setText(v ? 'ON' : 'OFF').setColor(v ? '#2ef2a8' : '#ff8a8a');
        }
      }
    }
    draw();

    let release = () => {};
    function close() {
      release();
      sfx('cancel');
      objs.forEach((o) => o.destroy());
      resolve();
    }
    release = pushFocus((a) => {
      if (a === 'up') { sel = (sel + rows.length - 1) % rows.length; sfx('cursor'); draw(); }
      if (a === 'down') { sel = (sel + 1) % rows.length; sfx('cursor'); draw(); }
      if (a === 'left') change(rows[sel], -1);
      if (a === 'right') change(rows[sel], 1);
      if (a === 'confirm') { if (rows[sel].kind === 'mute') change(rows[sel], 0); else close(); }
      if (a === 'cancel' || a === 'menu') close();
    }, scene);
  });
}
