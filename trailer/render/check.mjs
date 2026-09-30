// Post-render checks on solquest-trailer.mp4:
//   1. every cut and caption slam against the 140 bpm grid (and the frame it lands on)
//   2. stills at 0 / 3 / 8 / 14 / 22 / 28 s
//   3. true peak (EBU R128) under -1 dBTP, loudness
//   4. the pre-drop gap: black picture + digital silence
//   5. duration / format
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { ROOT, OUT, ffmpegPath } from './common.mjs';
import { FPS, DURATION, BEAT, S16, gridLabel, offGrid, cutFrame } from '../src/grid.js';
import { shots, captions, impacts, cues, SILENCE0, DROP, HANDLE } from '../src/timeline.js';

const FF = ffmpegPath();
const mp4 = path.resolve(ROOT, process.argv[2] ?? 'solquest-trailer.mp4');
const ff = (args) => execFileSync(FF, ['-hide_banner', ...args], { maxBuffer: 1 << 30, stdio: ['ignore', 'pipe', 'pipe'] });
/** ffmpeg's log (stderr), for commands whose report goes there. */
const ffLog = (args) => String(spawnSync(FF, ['-hide_banner', ...args], { maxBuffer: 1 << 30 }).stderr);

const lines = [];
const log = (s = '') => { lines.push(s); console.log(s); };
let fails = 0;
const ok = (cond, msg) => { if (!cond) fails++; log(`${cond ? 'PASS' : 'FAIL'}  ${msg}`); };

// ------------------------------------------------------------ 1. beat grid
log('# beat grid (140 bpm: beat 428.6 ms, 16th 107.1 ms; 30 fps)');
log('');
const rows = [];
for (const s of shots) rows.push(['cut', s.id, s.t0]);
for (const c of captions) rows.push(['text', c.text, c.t0]);
rows.push(['text', HANDLE.text, HANDLE.t0]);
rows.sort((a, b) => a[2] - b[2]);
let worst = 0;
log('kind  time      grid        frame  frame err  off-grid  what');
for (const [kind, what, t] of rows) {
  const dev = offGrid(t) * 1000;
  const fr = cutFrame(t);
  const ferr = (fr / FPS - t) * 1000;
  worst = Math.max(worst, Math.abs(dev));
  log(`${kind.padEnd(5)} ${t.toFixed(3).padStart(7)}s  ${gridLabel(t).padEnd(10)}  ${String(fr).padStart(4)}  ${ferr.toFixed(1).padStart(6)} ms  ${dev.toFixed(2).padStart(6)} ms  ${what}`);
}
ok(worst < 0.5, `all ${rows.length} cuts + text slams on the 16th-note grid (worst ${worst.toFixed(3)} ms; frame quantisation <= ${(500 / FPS).toFixed(1)} ms)`);
// hits inside a shot: on the grid, or deliberately on the game's own hit frame
const sync = impacts.filter((h) => Math.abs(offGrid(h.t)) > 0.0005);
log(`INFO  ${impacts.length - sync.length}/${impacts.length} flash/shake/rgb hits on the grid; ${sync.length} sit on the captured game's hit frame (${sync.map((h) => { const d = Math.round(offGrid(h.t) * 1000); return (d > 0 ? '+' : '') + d + ' ms'; }).join(', ')})`);
// sound design: on the grid, unless it lands with a hit that follows the game's own hit frame
const fxOff = cues.filter((c) => c.type === 'fx' && Math.abs(offGrid(c.t)) > 0.0005);
const hitSynced = (c) => sync.some((h) => Math.abs(h.t - c.t) < 0.0005);
const fxBad = fxOff.filter((c) => !hitSynced(c));
ok(fxBad.length === 0, `trailer sound design (slams, whooshes, riser, glass, drop, logo) on the grid${fxBad.length ? ': off ' + fxBad.map((c) => c.name + '@' + c.t.toFixed(3)).join(' ') : ''}${fxOff.length - fxBad.length ? `; ${fxOff.length - fxBad.length} land with a game-synced hit (${fxOff.filter(hitSynced).map((c) => c.name + '@' + c.t.toFixed(3)).join(' ')})` : ''}`);
log('');

// ------------------------------------------------------------ 2. format
log('# file');
const info = ffLog(['-i', mp4]);
const dur = /Duration: (\d+):(\d+):([\d.]+)/.exec(info);
const secs = dur ? +dur[1] * 3600 + +dur[2] * 60 + +dur[3] : 0;
log(info.split('\n').filter((l) => /Duration|Stream/.test(l)).map((l) => '  ' + l.trim()).join('\n'));
ok(Math.abs(secs - DURATION) < 0.05, `duration ${secs.toFixed(3)} s`);
ok(/1920x1080/.test(info) && /30 fps/.test(info) && /h264/.test(info) && /aac/.test(info), '1920x1080, 30 fps, H.264 + AAC');
const nb = [...ffLog(['-i', mp4, '-map', '0:v', '-f', 'null', '-']).matchAll(/frame=\s*(\d+)/g)].at(-1);
ok(nb && +nb[1] === DURATION * FPS, `frame count ${nb ? nb[1] : '?'}`);
log('');

// ------------------------------------------------------------ 3. loudness
log('# audio');
const eb = ffLog(['-nostats', '-i', mp4, '-map', '0:a', '-af', 'ebur128=peak=true', '-f', 'null', '-']);
const I = /I:\s+(-?[\d.]+) LUFS/.exec(eb.slice(eb.lastIndexOf('Summary')));
const TP = /Peak:\s+(-?[\d.]+) dBFS/.exec(eb.slice(eb.lastIndexOf('Summary')));
log(`  integrated ${I ? I[1] : '?'} LUFS`);
ok(TP && +TP[1] < -1, `true peak ${TP ? TP[1] : '?'} dBTP (< -1)`);

// ------------------------------------------------------------ 4. the gap
const pcm = ff(['-loglevel', 'error', '-i', mp4, '-map', '0:a', '-f', 'f32le', '-ac', '2', '-ar', '48000', '-']);
const a = new Float32Array(pcm.buffer, pcm.byteOffset, pcm.length / 4);
// AAC spreads each edge across up to two 1024-sample frames (~43 ms); check the gap's inside
const i0 = Math.ceil((SILENCE0 + 0.045) * 48000) * 2;
const i1 = Math.floor((DROP - 0.045) * 48000) * 2;
let mx = 0;
for (let i = i0; i < i1; i++) mx = Math.max(mx, Math.abs(a[i]));
ok(mx < 10 ** (-80 / 20), `pre-drop gap ${SILENCE0.toFixed(3)}-${DROP.toFixed(3)} s is silent (max ${mx === 0 ? '-inf' : (20 * Math.log10(mx)).toFixed(1)} dBFS inside the AAC edges)`);
const gapFrames = [];
for (let f = Math.ceil(SILENCE0 * FPS + 1e-6); f < Math.floor(DROP * FPS - 1e-6); f++) gapFrames.push(f);
let maxLuma = 0;
for (const f of gapFrames) {
  const raw = ff(['-loglevel', 'error', '-ss', ((f + 0.5) / FPS).toFixed(4), '-i', mp4, '-frames:v', '1', '-vf', 'scale=96:54,format=gray', '-f', 'rawvideo', '-']);
  maxLuma = Math.max(maxLuma, ...raw);
}
ok(maxLuma <= 20, `gap frames ${gapFrames[0]}-${gapFrames.at(-1)} are black (max luma ${maxLuma}/255)`);
log('');

// ------------------------------------------------------------ 5. flashes
// Simplified photosensitivity check: a "flash" is a pair of opposing swings
// in mean frame brightness of >= 10% of full scale; at most 3 in any 1 s.
{
  const raw = ff(['-loglevel', 'error', '-i', mp4, '-vf', 'scale=64:36,format=gray', '-f', 'rawvideo', '-']);
  const n = raw.length / (64 * 36);
  const luma = [];
  for (let f = 0; f < n; f++) {
    let sum = 0;
    for (let i = f * 2304; i < (f + 1) * 2304; i++) sum += raw[i];
    luma.push(sum / 2304 / 255);
  }
  // swings: runs of same-direction change between local extremes
  const swings = [];
  let start = 0;
  for (let f = 1; f < n; f++) {
    const d0 = Math.sign(luma[f] - luma[f - 1]);
    const d1 = f + 1 < n ? Math.sign(luma[f + 1] - luma[f]) : 0;
    if (d1 !== d0) {
      const amp = luma[f] - luma[start];
      if (Math.abs(amp) >= 0.1) swings.push({ f, dir: Math.sign(amp) });
      start = f;
    }
  }
  const flashes = [];
  for (let i = 1; i < swings.length; i++) if (swings[i].dir !== swings[i - 1].dir) flashes.push(swings[i].f);
  let worst = 0;
  for (const f of flashes) worst = Math.max(worst, flashes.filter((g) => g >= f && g < f + FPS).length);
  ok(worst <= 3, `flashes: at most ${worst} large brightness reversals in any 1 s window (limit 3); ${flashes.length} in total`);
}
log('');

// ------------------------------------------------------------ 6. stills
log('# stills');
const dir = path.join(OUT, 'stills');
mkdirSync(dir, { recursive: true });
for (const t of [0, 3, 8, 14, 22, 28]) {
  const f = path.join(dir, `still_${String(t).padStart(2, '0')}s.png`);
  ff(['-loglevel', 'error', '-y', '-ss', String(t), '-i', mp4, '-frames:v', '1', f]);
  log(`  ${path.relative(ROOT, f)}  (${gridLabel(t)})`);
}
log('');
log(fails ? `${fails} check(s) FAILED` : 'all checks passed');
writeFileSync(path.join(OUT, 'check-report.txt'), lines.join('\n') + '\n');
process.exit(fails ? 1 : 0);
