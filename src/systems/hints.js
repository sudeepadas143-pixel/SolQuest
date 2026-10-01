// Which controls the player has shown they know (PC controls legend). A
// control is "learned" after it has been used a few times; learned ones drop
// off the legend, and it disappears once everything is known. Remembered per
// browser (not in the save: knowing the keys isn't part of a run).
const KEY = 'solquest.controlsLearned.v1';
// uses needed before a control counts as learned
const NEED = { move: 12, run: 6, use: 2, menu: 1, click: 3 };

let state = {};
try { state = JSON.parse(localStorage.getItem(KEY) ?? '{}') ?? {}; } catch { state = {}; }
const listeners = new Set();

export const HINT_IDS = Object.keys(NEED);

export function isLearned(id) { return (state[id] ?? 0) >= NEED[id]; }
export function allLearned() { return HINT_IDS.every(isLearned); }

/** Count one use of a control; listeners hear when it becomes learned. */
export function used(id) {
  if (!(id in NEED) || isLearned(id)) return;
  state[id] = (state[id] ?? 0) + 1;
  if (isLearned(id)) {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* private mode: forget on reload */ }
    listeners.forEach((fn) => fn(id));
  }
}

/** Learn everything at once (e.g. after a long stretch of play). */
export function learnAll() {
  for (const id of HINT_IDS) if (!isLearned(id)) { state[id] = NEED[id]; listeners.forEach((fn) => fn(id)); }
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* ignore */ }
}

export function onLearned(fn) { listeners.add(fn); return () => listeners.delete(fn); }
