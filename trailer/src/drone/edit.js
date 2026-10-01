// The title footage as an edit: eight shots of the overworld through one day,
// joined by transitions. Everything is a function of t, so the LOOP-second
// loop is seamless: the last transition (night into dawn) lands exactly on t =
// LOOP and shot 1 picks up from there at t = 0.
//
// A shot is a camera move over its visible span (u = 0..1, transitions
// included): pos(u) and target(u) in tiles (x east, y up, z south). The camera
// never pitches or rolls; it yaws towards the target and a lens shift puts the
// target at screen height `ty`, so walls and columns stay upright.
//
// Transitions (centred on the cut, `len` seconds):
//   dissolve  cross-fade (the night-to-dawn one is a matched time-lapse)
//   whip      fast pan out of A and into B with motion blur, cut at the middle
//   mist      a drifting, noise-edged dissolve through soft haze
//   leak      dissolve under a warm light leak sweeping across
//   focus     A racks out of focus, B racks back in
//   dip       sinks to deep blue and rises into B (nightfall)
import * as THREE from 'three';

const v = (x, y, z) => new THREE.Vector3(x, y, z);
const lerp = (a, b, k) => a + (b - a) * k;
const lerpV = (a, b, k) => a.clone().lerp(b, k);
// mostly constant speed, softened at the very ends
export const glide = (u) => u * 0.75 + (u * u * (3 - 2 * u)) * 0.25;
const orbit = (cx, cz, r, a, y) => v(cx + Math.cos(a) * r, y, cz + Math.sin(a) * r);

// shots in order; `len` = seconds between this shot's cut-in and the next cut
export const SHOTS = [
  { // 1. dawn on the main road, the drone lifts off and climbs over the route
    name: 'dawn climb', len: 7.5, hour: [6.5, 8.8],
    pos: (u) => v(22, lerp(2.2, 11, glide(u) ** 1.3), lerp(112, 99, glide(u))),
    target: (u) => v(23, lerp(1.4, 0, u), lerp(100, 72, u)), ty: (u) => lerp(0.05, -0.12, u),
  },
  { // 2. late morning: a slow arc around the fountain and the gazebo
    name: 'square', len: 6.5, hour: [10.4, 11.2], tilt: 2.2,
    pos: (u) => orbit(55.2, 107.4, 8.2, lerp(1.95, 1.2, glide(u)), lerp(3.6, 4.2, u)),
    target: () => v(55.2, 0.6, 107.4), ty: () => -0.1,
  },
  { // 3. midday: skimming the pond out along the pier
    name: 'pier', len: 7, hour: [12.8, 13.4],
    pos: (u) => v(56.95, lerp(1.1, 1.7, u), lerp(93.8, 82.5, glide(u))),
    target: (u) => v(lerp(56.6, 55, u), 0.2, lerp(88, 72, u)), ty: () => -0.18,
  },
  { // 4. afternoon: low through the grass towards the windmill
    name: 'windmill', len: 6.5, hour: [15.2, 15.8],
    pos: (u) => v(lerp(53.5, 50.2, glide(u)), lerp(0.85, 1.6, u), lerp(75.5, 71.2, glide(u))),
    target: () => v(46, 2.1, 66.2), ty: () => 0.06,
  },
  { // 5. rising high over the middle of the route: the whole world, north to the Hall
    name: 'overview', len: 7, hour: [15.9, 16.6],
    pos: (u) => v(lerp(40, 36, glide(u)), lerp(9, 17, glide(u)), lerp(64, 74, glide(u))),
    target: (u) => v(lerp(30, 26, u), 0, lerp(34, 28, u)), ty: () => 0.02,
  },
  { // 6. golden hour: up the approach to the Elite Hall
    name: 'approach', len: 7, hour: [18.0, 18.5],
    pos: (u) => v(lerp(20.6, 23.6, u), lerp(1.9, 2.9, u), lerp(33, 21.5, glide(u))),
    target: (u) => v(22.5, 2.6, lerp(12, 10, u)), ty: () => 0.1,
  },
  { // 7. dusk: arcing up round the Hall against the last of the sunset
    name: 'hall dusk', len: 6.5, hour: [19.0, 19.7],
    pos: (u) => orbit(22.5, 9.5, lerp(19, 22, u), lerp(1.2, 0.6, glide(u)), lerp(3.0, 8.5, glide(u))),
    target: () => v(22.5, 2.4, 9.5), ty: () => 0.0,
  },
  { // 8. night: down the lamplit road into town
    name: 'night road', len: 8, hour: [22.2, 22.8],
    pos: (u) => v(22, lerp(4.2, 2.2, glide(u)), lerp(123, 112, glide(u))),
    target: (u) => v(22, lerp(0.6, 1.4, u), lerp(108, 100, u)), ty: (u) => lerp(-0.08, 0.05, u),
  },
];
// transition INTO shot i (from shot i-1; shot 0's comes from the last shot)
export const CUTS = [
  { type: 'dissolve', len: 2.6 },
  { type: 'whip', len: 0.8, dir: 1 },
  { type: 'mist', len: 1.6 },
  { type: 'whip', len: 0.8, dir: -1 },
  { type: 'mist', len: 1.8, haze: 0.42 },
  { type: 'leak', len: 1.8 },
  { type: 'focus', len: 1.4 },
  { type: 'dip', len: 2.2 },
];

export const LOOP = SHOTS.reduce((s, x) => s + x.len, 0);

// The cut into shot i sits at START[i]. Shot 0's cut is at t = 0 (= LOOP) and
// its transition runs from LOOP - len up to it, so frame 0 is a clean frame
// (it is also the poster). Every other transition is centred on its cut.
const START = SHOTS.map((_, i) => SHOTS.slice(0, i).reduce((s, x) => s + x.len, 0));
const window_ = (i) => (i === 0 ? [LOOP - CUTS[0].len, LOOP] : [START[i] - CUTS[i].len / 2, START[i] + CUTS[i].len / 2]);
// visible span of each shot in seconds (shot 0's starts before 0: it is
// already on screen during the last transition)
function span(i) {
  const n = SHOTS.length;
  const a = i === 0 ? -CUTS[0].len : window_(i)[0];
  const b = i === n - 1 ? LOOP : window_(i + 1)[1];
  return [a, b];
}

/** A view of shot i at absolute time t (any t inside the span, or wrapped). */
function view(i, t) {
  const [a, b] = span(i);
  let tt = t;
  if (tt < a - 1e-9) tt += LOOP;           // shot 0, seen during the last transition
  if (tt > b + 1e-9) tt -= LOOP;
  const u = Math.min(1, Math.max(0, (tt - a) / (b - a)));
  const s = SHOTS[i];
  return {
    shot: i, u, clock: tt - a + i * 37,      // own clock per shot (clouds, water, grass)
    pos: s.pos(u), target: s.target(u), ty: s.ty(u), hour: lerp(s.hour[0], s.hour[1], u) % 24,
    yaw: 0, blur: [0, 0], defocus: 0, tilt: s.tilt || 0,
  };
}

const easeIn = (x) => x * x * x;
const easeOut = (x) => 1 - (1 - x) ** 3;
const smooth = (a, b, x) => { const k = Math.min(1, Math.max(0, (x - a) / (b - a))); return k * k * (3 - 2 * k); };

/**
 * What to draw at time t: { A, B, mix } where A/B are views (B only during a
 * blend) and mix holds the compositor's transition parameters.
 */
export function frameAt(t) {
  t = ((t % LOOP) + LOOP) % LOOP;
  const n = SHOTS.length;
  // in a transition?
  for (let i = 0; i < n; i++) {
    const c = CUTS[i];
    const from = (i + n - 1) % n;
    const [t0, t1] = window_(i);
    if (t < t0 || t >= t1) continue;
    const p = (t - t0) / c.len;
    const mix = { type: c.type, p, haze: c.haze ?? 0.3 };
    if (c.type === 'whip') {
      // one picture at a time: A whips away, B whips in; blur follows the speed
      const W = 1.25 * c.dir;
      const K = 120;
      if (p < 0.5) {
        const q = p / 0.5;
        const A = view(from, t);
        A.yaw = W * easeIn(q);
        A.blur = [K * q * q, 0];
        return { A, B: null, mix: { type: 'none' } };
      }
      const q = (p - 0.5) / 0.5;
      const A = view(i, t);
      A.yaw = -W * (1 - easeOut(q));
      A.blur = [K * (1 - q) ** 2, 0];
      return { A, B: null, mix: { type: 'none' } };
    }
    const A = view(from, t);
    const B = view(i, t);
    if (c.type === 'focus') {
      A.defocus = 7 * smooth(0, 0.6, p);
      B.defocus = 7 * (1 - smooth(0.4, 1, p));
    }
    return { A, B, mix };
  }
  // inside a shot
  let i = n - 1;
  for (let k = 0; k < n; k++) {
    const [a, b] = span(k);
    if (t >= a && t < b) { i = k; break; }
  }
  return { A: view(i, t), B: null, mix: { type: 'none' } };
}

export { smooth };
