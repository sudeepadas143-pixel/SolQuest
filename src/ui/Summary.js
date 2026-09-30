// Creature summary card (TEAM menu, both in battle and in the overworld).
import { SPECIES, displaySprite, spriteDensity } from '../data/creatures.js';
import { MOVES } from '../data/moves.js';
import { TYPE_COLORS } from '../data/types.js';
import { typeIcon } from './typeIcons.js';
import { calcStats, xpForLevel, STAT_KEYS, STAT_LABELS } from '../systems/creature.js';
import { pushFocus } from '../systems/controls.js';
import { HpBar } from './HpBar.js';
import { drawPanel, PANEL, text, COLORS } from './theme.js';

export function typeBadge(scene, x, y, type, w = 96) {
  const g = scene.add.graphics();
  g.fillStyle(TYPE_COLORS[type] ?? 0x888888, 1).fillRoundedRect(x, y, w, 26, 9);
  const ic = scene.add.image(x + 16, y + 13, typeIcon(scene, type, 22, { mono: true }));
  // the name sits in the space right of the symbol, shrunk to fit
  const t = text(scene, x + 28 + (w - 28) / 2, y + 13, type.toUpperCase(), 18, '#ffffff').setOrigin(0.5, 0.5);
  if (t.width > w - 36) t.setScale((w - 36) / t.width);
  return [g, ic, t];
}

export function showSummary(scene, c, { depth = 1500 } = {}) {
  const sp = SPECIES[c.species];
  const stats = calcStats(c);
  const objs = [];
  const add = (o) => { (Array.isArray(o) ? o : [o]).forEach((x) => { x.setDepth?.(depth); objs.push(x); }); return o; };

  const g = add(scene.add.graphics());
  drawPanel(g, 40, 30, 880, 580, 'card');
  g.fillStyle(0x8b5cff, 0.14).fillRoundedRect(64, 56, 300, 300, 16);
  g.fillStyle(0x2ef2a8, 0.12).fillRoundedRect(64, 206, 300, 150, 16);
  g.fillStyle(0x000000, 0.12).fillEllipse(214, 330, 220, 40);

  const key = displaySprite(c.species, 'front');
  add(scene.add.image(214, 334, key).setScale(Math.min(3, 260 / 100) / spriteDensity(key)).setOrigin(0.5, 1));
  add(text(scene, 64, 372, sp.name.toUpperCase(), 34, '#262a3b', { fontStyle: 'bold' }));
  add(text(scene, 300, 378, `Lv. ${c.level}`, 28, '#262a3b'));
  sp.types.forEach((t, i) => add(typeBadge(scene, 64 + i * 104, 420, t)));

  add(text(scene, 64, 462, 'HP', 22, '#6b6f80'));
  const hb = new HpBar(scene, 110, 470, 230, 12);
  hb.set(c.hp / stats.hp);
  add(hb.g);
  add(text(scene, 110, 488, `${c.hp} / ${stats.hp}`, 22, '#262a3b'));

  const next = xpForLevel(c.level + 1);
  const prev = xpForLevel(c.level);
  add(text(scene, 64, 524, 'EXP', 22, '#6b6f80'));
  const xb = new HpBar(scene, 110, 532, 230, 8, { color: COLORS.xp });
  xb.set((c.xp - prev) / Math.max(1, next - prev));
  add(xb.g);
  add(text(scene, 110, 548, `To next Lv: ${Math.max(0, next - c.xp)}`, 20, '#262a3b'));

  add(text(scene, 400, 60, 'STATS', 24, '#6b6f80'));
  STAT_KEYS.forEach((k, i) => {
    add(text(scene, 400, 96 + i * 34, STAT_LABELS[k], 24, '#262a3b'));
    add(text(scene, 640, 96 + i * 34, k === 'hp' ? `${stats.hp}` : `${stats[k]}`, 24, '#262a3b').setOrigin(1, 0));
  });
  if (sp.evolvesTo) add(text(scene, 680, 96, `Evolves at\nLv. ${sp.evolveLevel}`, 20, '#6b6f80'));

  add(text(scene, 400, 316, 'MOVES', 24, '#6b6f80'));
  c.moves.forEach((m, i) => {
    const mv = MOVES[m.id];
    const y = 352 + i * 54;
    add(typeBadge(scene, 396, y + 2, mv.type, 100));
    add(text(scene, 504, y, mv.name, 26, '#262a3b'));
    add(text(scene, 880, y, `PP ${m.pp}/${mv.pp}`, 22, '#5b5f70').setOrigin(1, 0));
    add(text(scene, 504, y + 28, mv.category === 'status' ? 'Status' : `${mv.category === 'physical' ? 'Physical' : 'Special'} · Pow ${mv.power}`, 16, '#8a8ea0'));
  });
  add(text(scene, 880, 580, 'ENTER / ESC: close', 18, '#8a8ea0').setOrigin(1, 0));

  return new Promise((resolve) => {
    const close = () => { release(); scene.input.off('pointerdown', close); objs.forEach((o) => o.destroy()); resolve(); };
    const release = pushFocus((a) => { if (a === 'confirm' || a === 'cancel' || a === 'menu') close(); }, scene);
    scene.time.delayedCall(150, () => scene.input.on('pointerdown', close));
  });
}
