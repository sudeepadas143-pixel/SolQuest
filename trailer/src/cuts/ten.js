// The 10-second teaser: show little, land hard. A drone swoop over the world,
// the portrait shrinking into the sprite, the bosses slamming in one per beat
// (only Ansem named, by his own VS screen), one slow-motion knockout, then the
// Hall: braziers catching, a dark figure on the dais - black - the logo.
// Same grid (140 bpm), plates, compositor and audio engine as the full cut.
import gsap from 'gsap';
import { BEAT, S16, DURATION } from '../grid.js';
import { linear, smooth } from '../remap.js';
import { DEFAULTS as FULL_DEFAULTS, board } from './full.js';

const b = (n) => n * BEAT;                 // beat n (0-based) from the top

const shots = [];
function plate(id, t0, dur, plateName, src, cam, opts = {}) {
  const remap = Array.isArray(src)
    ? linear([[0, src[0]], [dur, src[1]]])
    : src.type === 'smooth' ? smooth(src.pts) : linear(src.pts);
  shots.push({ id, kind: 'plate', t0, t1: t0 + dur, plate: plateName, remap, cam, ...opts });
}
const cam = (z0, x0, y0, z1 = z0, x1 = x0, y1 = y0, ease = 'sine.inOut') => ({ from: { z: z0, x: x0, y: y0 }, to: { z: z1, x: x1, y: y1 }, ease });

// beats 0-3: the world, morning to night, at speed
plate('fly', 0, b(4), 'fly_world', [0.10, 4.95], cam(2.0, 480, 320, 2.14, 480, 316, 'none'));
// beats 4-5: you - the portrait flashes and shrinks into the overworld sprite
plate('shrink', b(4), b(2), 'look_shrink', [1.05, 2.75], cam(2.3, 480, 330, 3.2, 480, 396, 'power2.in'));
// beats 6-9: the bosses, one per beat; Ansem last, named by his own VS screen
export const LINEUP = b(6);
const vsCam = cam(2.0, 480, 306, 2.06, 510, 310, 'power1.out');
plate('vsA', b(6), b(1), 'vs_a', [2.35, 2.75], vsCam);
plate('vsC', b(7), b(1), 'vs_c', [2.35, 2.75], vsCam);
plate('vsE', b(8), b(1), 'vs_e', [2.35, 2.75], vsCam);
export const VS0 = b(9);
plate('vs', VS0, b(1), 'ansem_battle', [1.05, 1.45], cam(2.0, 480, 319));
// beats 10-11: the knockout blow, in slow motion
export const KO = b(10);
plate('ko', KO, b(2), 'ansem_ko', {
  type: 'smooth', pts: [[0, 0.78], [0.1, 0.83], [b(2), 1.12]],
}, cam(2.5, 690, 215, 2.35, 650, 232, 'power2.out'), {
  dmg: [{ at: 0.03, x: 715, y: 140, text: '-26', big: true, gold: true, dur: 0.8 }],
});
// beats 12-14: the Hall - the braziers catch as you walk up the carpet
export const HALL0 = b(12);
plate('hallWalk', HALL0, b(3), 'hall_walk', [0.60, 3.30], cam(2.0, 480, 320, 2.1, 480, 318, 'none'));
// beat 15: push in on the dark figure on the dais (never revealed)
export const BUILD0 = b(15);
export const SILENCE0 = b(16) + S16;       // black + total silence (3 sixteenths = 0.32 s)
export const DROP = b(17);
plate('dais', BUILD0, SILENCE0 - BUILD0, 'hall_walk', [4.25, 4.85], cam(2.2, 480, 250, 2.9, 480, 168, 'power2.in'));
shots.push({ id: 'silence', kind: 'black', t0: SILENCE0, t1: DROP });
// the drop: the logo
shots.push({ id: 'end', kind: 'end', t0: DROP, t1: DURATION });
export const LAST = b(22);
// (the music isn't cut for the end card here: a pad rings under the logo)
export const END = DURATION;
// (no leaderboard in this cut)
export const BOARD0 = DURATION + 1;
export const RESET = DURATION + 1;
export { board };

shots.sort((a, c) => a.t0 - c.t0);
export { shots };

function when(id, src) {
  const sh = shots.find((x) => x.id === id);
  let lo = 0;
  let hi = sh.t1 - sh.t0;
  for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (sh.remap(m) < src) lo = m; else hi = m; }
  return sh.t0 + hi;
}

export const damage = [];
for (const s of shots) for (const d of s.dmg ?? []) damage.push({ ...d, t: s.t0 + d.at, plate: s.plate });
export function shotAt(t) {
  let lo = 0;
  for (let i = 0; i < shots.length; i++) if (shots[i].t0 <= t + 1e-9) lo = i;
  return shots[lo];
}
export const shotById = (id) => shots.find((s) => s.id === id);

// --------------------------------------------------------------- captions
export const captions = [
  { t0: 0, t1: b(4), text: 'we built a world.', size: 112, still: true },
  { t0: LINEUP, t1: KO, text: 'battle your favorite creators.', size: 96, y: 140 },
  { t0: HALL0 + S16, t1: SILENCE0, text: 'one waits at the top.', size: 104 },
  { t0: b(18), t1: b(20), text: 'win creator fees daily.', size: 92, y: 760, gold: true },
  { t0: b(20), t1: DURATION, text: 'coming soon', size: 92, y: 760, noOut: true },
];
export const HANDLE = { t0: b(20), text: '@SolQuestOnSol' };

// ---------------------------------------------------------------- impacts
export const impacts = [];
const hit = (t, o) => impacts.push({ t, flash: 0, shake: 0, rgb: 0, glitch: 0, ...o });
for (let i = 6; i <= 9; i++) hit(b(i), { shake: 8, rgb: 0.15 });      // each boss slams in
hit(KO, { shake: 14, flash: 0.15, rgb: 0.2, bloom: 0.8 });              // the knockout blow
hit(HALL0, { shake: 4 });
hit(DROP, { shake: 10, bloom: 0.35 });                                  // the logo
hit(LAST, { shake: 5 });

// ------------------------------------------------------------ audio cues
export const cues = [];
const sfx = (t, name, opts) => cues.push({ t, type: 'sfx', name, opts });
const fx = (t, name, opts) => cues.push({ t, type: 'fx', name, opts });
fx(0, 'whoosh', { dir: 1 });
fx(b(2), 'swell', { dur: b(2) });
sfx(when('shrink', 1.15), 'status');
sfx(when('shrink', 2.10), 'sendout');
for (let k = 0; k < 4; k++) sfx(when('shrink', 2.45 + k * 0.08), 'tick');
for (let i = 6; i <= 8; i++) { fx(b(i), 'slam', { size: 0.55 }); sfx(b(i), 'vs'); }
fx(VS0, 'slam', { size: 0.6 }); sfx(VS0, 'encounterTrainer');
fx(KO, 'drop', { size: 0.5 }); sfx(KO, 'superHit');
sfx(HALL0, 'hallDoors');
for (const src of [0.8, 1.6, 2.4]) sfx(when('hallWalk', src), 'ignite');
fx(BUILD0, 'riser', { dur: SILENCE0 - BUILD0 });
fx(DROP, 'logo'); sfx(DROP, 'evolveBurst');
sfx(b(18), 'item');
sfx(b(20), 'confirm');
fx(LAST, 'last');
cues.sort((a, c) => a.t - c.t);

// For the audio render: section levels and where to duck the music.
export const SECTIONS = [['fly', 0, b(4)], ['you', b(4), LINEUP], ['bosses', LINEUP, KO], ['ko', KO, HALL0],
  ['hall', HALL0, SILENCE0], ['end', DROP, DURATION]];
export const DUCKS = [KO, DROP];

// ------------------------------------------------------ the master timeline
export const DEFAULTS = FULL_DEFAULTS;

export function buildMaster(S) {
  const tl = gsap.timeline({ paused: true, defaults: { ease: 'none' } });
  for (const s of shots) {
    if (s.kind !== 'plate') continue;
    tl.set(S.cam, { ...s.cam.from, wx: 0, wy: 0, blur: 0 }, s.t0);
    tl.to(S.cam, { ...s.cam.to, duration: s.t1 - s.t0, ease: s.cam.ease }, s.t0);
  }
  for (const im of impacts) {
    for (const [k, dur, ease] of [['flash', 0.16, 'power2.out'], ['shake', 0.38, 'power2.out'], ['rgb', 0.2, 'power3.out'], ['glitch', 0.16, 'power2.out'], ['bloom', 0.5, 'power2.out']]) {
      if (!im[k]) continue;
      tl.set(S.fx, { [k]: im[k] }, im.t);
      tl.to(S.fx, { [k]: 0, duration: dur, ease }, im.t);
    }
  }
  captions.forEach((c, i) => {
    if (c.still) {
      tl.set(S.cap, { cid: i, scale: 1, alpha: 1, heat: 0 }, c.t0);
    } else {
      tl.set(S.cap, { cid: i, scale: 1.08, alpha: 0, heat: 0 }, c.t0);
      tl.to(S.cap, { alpha: 1, duration: 0.1, ease: 'power1.out' }, c.t0);
      tl.to(S.cap, { scale: 1, duration: 0.22, ease: 'power2.out' }, c.t0);
    }
    if (!c.noOut) tl.to(S.cap, { alpha: 0, duration: 0.1 }, c.t1 - 0.1);
    tl.set(S.cap, { cid: c.noOut ? i : -1 }, c.t1 - 0.0001);
  });
  tl.to(S, { handle: 1, duration: 0.3 }, HANDLE.t0);
  // the logo lands on the drop
  const E = S.end;
  tl.set(E, { logo: 1, logoScale: 1.4, glow: 0.55 }, DROP);
  tl.to(E, { logoScale: 1, duration: 0.2, ease: 'expo.out' }, DROP);
  tl.to(E, { logoScale: 1.04, duration: LAST - DROP, ease: 'sine.inOut' }, DROP + 0.2);
  tl.to(E, { glow: 0.45, duration: 0.4 }, DROP + 0.1);
  tl.to(E, { glow: 0.6, duration: 0.15 }, LAST);
  tl.to(E, { glow: 0.3, duration: 0.5 }, LAST + 0.15);
  tl.set(S.fx, { fade: 0 }, LAST);
  tl.to(S.fx, { fade: 1, duration: DURATION - LAST - 0.02, ease: 'power2.in' }, LAST);
  tl.set(S.fx, { fade: 1 }, SILENCE0);
  tl.set(S.fx, { fade: 0 }, DROP);
  tl.duration();
  return tl;
}

export function makeEvaluator() {
  let S = DEFAULTS();
  let tl = buildMaster(S);
  let last = -1;
  return (t) => {
    if (t < last) { S = DEFAULTS(); tl.kill(); tl = buildMaster(S); }
    tl.time(Math.max(t, 1e-6), true);
    last = t;
    return S;
  };
}
