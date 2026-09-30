// Global run timer. Counts real play time from the moment the player gains
// control (first overworld frame) until Cooker is beaten - including battles
// and menus - and keeps the world clock (day/night) moving.
//
// LEADERBOARD NOTE (BUILD_NOTES.md): this is client-side. A browser can edit
// it; payouts for "fastest clear" need server-side verification of the run.
import Phaser from 'phaser';
import { getSave } from './save.js';

const RUN_SCENES = ['Overworld', 'Battle'];

export function installRunClock(game) {
  game.events.on(Phaser.Core.Events.STEP, (_time, delta) => {
    const s = getSave();
    if (!s || !s.run) return;
    const mgr = game.scene;
    const inRun = RUN_SCENES.some((k) => mgr.isActive(k) || mgr.isPaused(k));
    if (!inRun) return;
    s.run.startedAt ??= new Date().toISOString(); // wall-clock start, for audits
    const d = Math.min(delta, 250); // ignore giant gaps (tab switches, debugger)
    s.stats.playMs += d;
    if (!s.run.clearMs) s.run.ms += d;
  });
}
