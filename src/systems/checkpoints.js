// Blackout checkpoints (see CHECKPOINTS in src/data/map.js). Kept in the save
// as a list of unlocked ids, so a blackout returns you to the right place
// whether or not you rested/saved at a Solace.
import { CHECKPOINTS, OUTDOOR_W } from '../data/map.js';

/** Unlock checkpoints: beaten Elites, and Solaces within reach of `pos` (null = indoors). */
export function unlockCheckpoints(save, pos) {
  save.checkpoints ??= ['start'];
  for (const c of CHECKPOINTS) {
    if (save.checkpoints.includes(c.id)) continue;
    const open = c.after ? !!save.defeated[c.after]
      : c.near ? !!pos && Math.abs(pos.x - c.x) + Math.abs(pos.y - c.y) <= c.near
        : true;
    if (open) save.checkpoints.push(c.id);
  }
  return save.checkpoints;
}

/** The unlocked checkpoint closest to `from` by walking distance (BFS over the outdoor map). */
export function nearestCheckpoint(map, unlocked, from) {
  const open = CHECKPOINTS.filter((c) => (unlocked ?? ['start']).includes(c.id));
  if (!open.length) return null;
  const W = OUTDOOR_W;
  const H = map.h;
  const want = new Map(open.map((c) => [c.y * W + c.x, c]));
  const seen = new Uint8Array(W * H);
  let q = [from.y * W + from.x];
  seen[q[0]] = 1;
  while (q.length) {
    const next = [];
    for (const k of q) {
      if (want.has(k)) return want.get(k);
      const x = k % W;
      const y = (k - x) / W;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const nk = ny * W + nx;
        if (seen[nk] || (map.blocked[ny][nx] && !want.has(nk))) continue;
        seen[nk] = 1;
        next.push(nk);
      }
    }
    q = next;
  }
  return open[open.length - 1];     // unreachable (shouldn't happen): the latest unlocked
}
