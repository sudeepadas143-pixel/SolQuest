// Player settings (per browser, not per save): music and sound-effect
// volumes (0..10) and text speed. Read by systems/audio.js and ui/DialogBox.js.
const KEY = 'solquest.settings.v1';
const DEFAULTS = { music: 8, sfx: 8, text: 'normal' };
export const TEXT_SPEEDS = ['slow', 'normal', 'fast'];
// typewriter delay multiplier per text speed
const TEXT_FACTOR = { slow: 1.7, normal: 1, fast: 0.4 };

let state = { ...DEFAULTS };
try { state = { ...DEFAULTS, ...(JSON.parse(localStorage.getItem(KEY) ?? '{}') ?? {}) }; } catch { /* defaults */ }
const listeners = new Set();

export function getSetting(k) { return state[k]; }

export function setSetting(k, v) {
  state[k] = v;
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* private mode: this session only */ }
  listeners.forEach((fn) => fn(k, v));
}

export function onSetting(fn) { listeners.add(fn); return () => listeners.delete(fn); }

/** 0..1 volume for 'music' or 'sfx'. */
export const volume = (k) => Math.max(0, Math.min(10, state[k])) / 10;

/** Typewriter delay multiplier for the current text speed. */
export const textFactor = () => TEXT_FACTOR[state.text] ?? 1;
