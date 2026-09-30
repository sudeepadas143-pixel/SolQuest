// Resolves which textures draw a trainer design.
import { HD } from '../config.js';

export function trainerArt(design) {
  return {
    overworld: { key: `trainer_${design}_ow`, frame: 0, anim: `trainer_${design}_idle` },
    battle: { key: `trainer_${design}_battle`, scale: 2 / HD.battle },
  };
}
