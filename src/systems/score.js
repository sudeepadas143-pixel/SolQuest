// Scoring. Points are awarded the FIRST time each trainer is beaten, scaled by
// difficulty order (data/trainers.js). Client-side only - see BUILD_NOTES.md.
import { TRAINERS, ELITE_IDS } from '../data/trainers.js';

export function awardTrainer(save, trainerId) {
  if (save.defeated[trainerId]) return 0;
  save.defeated[trainerId] = true;
  const pts = TRAINERS[trainerId].points;
  save.score += pts;
  save.scoreLog.push({ trainer: trainerId, points: pts, at: new Date().toISOString(), level: save.party[0].level });
  return pts;
}

export function elitesBeaten(save) {
  return ELITE_IDS.filter((id) => save.defeated[id]).length;
}

export function maxScore() {
  return Object.values(TRAINERS).reduce((s, t) => s + t.points, 0);
}
