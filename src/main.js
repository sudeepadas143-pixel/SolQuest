import Phaser from 'phaser';
import '@fontsource/pixelify-sans/400.css';
import '@fontsource/pixelify-sans/700.css';
import { GAME_W, GAME_H } from './config.js';
import { installControls } from './systems/controls.js';
import { BootScene } from './scenes/BootScene.js';
import { TitleScene } from './scenes/TitleScene.js';
import { IntroScene } from './scenes/IntroScene.js';
import { LookScene } from './scenes/LookScene.js';
import { StarterScene } from './scenes/StarterScene.js';
import { WalletScene } from './scenes/WalletScene.js';
import { OverworldScene } from './scenes/OverworldScene.js';
import { OverworldUIScene } from './scenes/OverworldUIScene.js';
import { AtmosphereScene } from './scenes/AtmosphereScene.js';
import { installRunClock } from './systems/runClock.js';
import { unlockAudio } from './systems/audio.js';
import { BattleScene } from './scenes/BattleScene.js';
import { EvolutionScene } from './scenes/EvolutionScene.js';
import { HallOfFameScene } from './scenes/HallOfFameScene.js';
import { LeaderboardScene } from './scenes/LeaderboardScene.js';
import { EarningsScene } from './scenes/EarningsScene.js';

// Pixelify Sans has broken "fi"/"fl" ligature glyphs on canvas ("final" renders
// as "Anal"). Break f-ligatures with a zero-width non-joiner on every Text.
const setText = Phaser.GameObjects.Text.prototype.setText;
Phaser.GameObjects.Text.prototype.setText = function patchedSetText(value) {
  if (typeof value === 'string') value = value.replace(/f(?=[fil])/g, 'f\u200C');
  return setText.call(this, value);
};

async function start() {
  try {
    await Promise.all([
      document.fonts.load('28px "Pixelify Sans"'),
      document.fonts.load('bold 28px "Pixelify Sans"'),
    ]);
  } catch { /* fall back to monospace */ }
  installControls();
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    width: GAME_W,
    height: GAME_H,
    backgroundColor: '#000000',
    pixelArt: true,
    roundPixels: true,
    dom: { createContainer: true },
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: [BootScene, TitleScene, IntroScene, LookScene, StarterScene, WalletScene,
      OverworldScene, AtmosphereScene, OverworldUIScene, BattleScene, EvolutionScene, HallOfFameScene,
      LeaderboardScene, EarningsScene],
  });
  installRunClock(game);
  // browsers only allow audio after a user gesture
  for (const ev of ['pointerdown', 'keydown', 'touchstart']) window.addEventListener(ev, unlockAudio, { once: false, passive: true });
  // debug handle: dev server, or builds made with VITE_DEBUG=1 (used by the test scripts).
  // Never exposed in the normal production build, so players cannot edit runs from the console.
  if (import.meta.env.DEV || import.meta.env.VITE_DEBUG) {
    window.__game = game;
    import('./systems/audio.js').then((a) => { window.__audio = a; });
  }
}

start();
