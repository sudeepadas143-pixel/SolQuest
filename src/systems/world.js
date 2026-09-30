// World clock, lighting and weather. Everything is derived from in-game play
// time, so it is deterministic: the same run time gives the same sky for every
// player (fair for a speedrun leaderboard) and nothing depends on the real clock.
import { START_HOUR, WEATHER_BLOCK_MIN, SEASON_SALT } from '../config.js';
import { hashString } from './rng.js';

export function gameMinutes(playMs) {
  return START_HOUR * 60 + playMs / 1000;
}

export function clock(playMs) {
  const m = gameMinutes(playMs);
  const day = Math.floor(m / 1440) + 1;
  const t = (m % 1440) / 60; // hours 0..24
  const hour = Math.floor(t);
  const minute = Math.floor((t - hour) * 60);
  return { day, t, hour, minute, phase: phaseAt(t) };
}

export function phaseAt(t) {
  if (t >= 5 && t < 7) return 'dawn';
  if (t >= 7 && t < 17.5) return 'day';
  if (t >= 17.5 && t < 20) return 'dusk';
  return 'night';
}

export const isNight = (playMs) => {
  const { t } = clock(playMs);
  return t >= 19.5 || t < 5.5;
};

// [hour, multiply tint rgb, light level 0..1]  (night and rain were lifted a
// touch so the route stays readable after dark)
const KEYS = [
  [0, [84, 96, 166], 1],
  [4.5, [84, 96, 166], 1],
  [6, [226, 168, 178], 0.55],
  [7.5, [255, 255, 255], 0],
  [16.5, [255, 252, 244], 0],
  [18, [255, 196, 146], 0.25],
  [19.5, [160, 138, 204], 0.8],
  [21, [84, 96, 166], 1],
  [24, [84, 96, 166], 1],
];

export function lighting(playMs) {
  const { t } = clock(playMs);
  let i = 0;
  while (i < KEYS.length - 2 && KEYS[i + 1][0] <= t) i++;
  const [t0, c0, l0] = KEYS[i];
  const [t1, c1, l1] = KEYS[i + 1];
  const f = (t - t0) / Math.max(0.0001, t1 - t0);
  const tint = c0.map((v, k) => Math.round(v + (c1[k] - v) * f));
  return { tint, light: l0 + (l1 - l0) * f };
}

const WEATHER_TINT = { clear: [255, 255, 255], cloudy: [214, 218, 228], rain: [184, 192, 210], storm: [146, 154, 176] };
export const WEATHER_LABEL = { clear: 'Clear', cloudy: 'Cloudy', rain: 'Rain', storm: 'Storm' };

/** Weather for the current block plus a 0..1 intensity that fades in/out at block edges. */
export function weather(playMs) {
  const m = gameMinutes(playMs) - START_HOUR * 60;
  const block = Math.floor(m / WEATHER_BLOCK_MIN);
  const f = (m % WEATHER_BLOCK_MIN) / WEATHER_BLOCK_MIN;
  const kind = weatherForBlock(block);
  const ramp = Math.min(1, f / 0.1, (1 - f) / 0.1);
  return { kind, intensity: kind === 'clear' ? 0 : ramp, block };
}

export function weatherForBlock(block) {
  if (block < 1) return 'clear'; // a sunny first impression
  const r = hashString(`${SEASON_SALT}|weather|${block}`) / 4294967296;
  if (r < 0.46) return 'clear';
  if (r < 0.68) return 'cloudy';
  if (r < 0.9) return 'rain';
  return 'storm';
}

/** Combined multiply tint (time of day x weather) as 0xRRGGBB, plus light level. */
export function atmosphere(playMs) {
  const { tint, light } = lighting(playMs);
  const w = weather(playMs);
  const wt = WEATHER_TINT[w.kind];
  const mix = tint.map((v, k) => Math.round(v * (255 - (255 - wt[k]) * w.intensity) / 255));
  const lightLevel = Math.min(1, light + (w.kind === 'storm' ? 0.35 : w.kind === 'rain' ? 0.2 : 0) * w.intensity);
  return { rgb: mix, color: (mix[0] << 16) | (mix[1] << 8) | mix[2], light: lightLevel, weather: w };
}

export function formatClock(playMs) {
  const { hour, minute } = clock(playMs);
  const h12 = ((hour + 11) % 12) + 1;
  return `${h12}:${String(minute).padStart(2, '0')} ${hour < 12 ? 'AM' : 'PM'}`;
}

export function formatRun(ms) {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const tenth = Math.floor((ms % 1000) / 100);
  return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}.${tenth}`;
}
