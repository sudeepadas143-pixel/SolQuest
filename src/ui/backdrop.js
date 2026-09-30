// Shared menu-screen backdrop: night-route gradient, soft light blobs and the
// signature diagonal route stripes.
import Phaser from 'phaser';
import { GAME_W, GAME_H } from '../config.js';

export function backdrop(scene, { top = 0x1a1f4a, bottom = 0x0c2a33 } = {}) {
  const g = scene.add.graphics();
  g.fillGradientStyle(top, top, bottom, bottom, 1).fillRect(0, 0, GAME_W, GAME_H);
  for (let i = 0; i < 60; i++) g.fillStyle(0xffffff, Phaser.Math.FloatBetween(0.1, 0.6)).fillRect(Phaser.Math.Between(0, GAME_W), Phaser.Math.Between(0, GAME_H * 0.6), 2, 2);
  const cols = [0x8b5cff, 0x2ef2a8, 0xffc94a];
  for (let i = 0; i < 3; i++) {
    g.fillStyle(cols[i], 0.14);
    const x = -120 + i * 70;
    g.fillPoints([{ x, y: GAME_H }, { x: x + 46, y: GAME_H }, { x: x + 420, y: 0 }, { x: x + 374, y: 0 }], true);
  }
  for (let i = 0; i < 3; i++) {
    g.fillStyle(cols[i], 0.1);
    const x = GAME_W - 300 + i * 70;
    g.fillPoints([{ x, y: GAME_H }, { x: x + 46, y: GAME_H }, { x: x + 420, y: 0 }, { x: x + 374, y: 0 }], true);
  }
  const blob = scene.add.image(GAME_W / 2, GAME_H * 0.42, 'glow').setScale(9).setAlpha(0.12).setTint(0x8b5cff).setBlendMode(Phaser.BlendModes.ADD);
  scene.tweens.add({ targets: blob, alpha: 0.2, duration: 2400, yoyo: true, repeat: -1 });
  return g;
}
