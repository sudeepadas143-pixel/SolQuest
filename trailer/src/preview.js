// Realtime preview of the trailer: the same compositor + timeline as the
// offline render, driven by the audio clock. Space / R / T / arrows, a scrub
// slider, and a MediaRecorder fallback that saves a .webm of a realtime pass.
import { Trailer } from './compositor.js';
import { FPS, DURATION, gridLabel } from './grid.js';
import { shotAt, captions } from './timeline.js';
import { CUT, CUTS } from './cut.js';

const $ = (id) => document.getElementById(id);
const canvas = $('c');
const trailer = new Trailer(canvas);
const status = (s) => { $('status').textContent = s ?? ''; };

let actx = null;
let buffer = null;
let src = null;
let dest = null;
let playing = false;
let startCtx = 0;
let startT = 0;
let t = 0;
let showTc = false;
let rendering = false;
let pending = null;
let recorder = null;

async function loadAudio() {
  actx = new AudioContext({ sampleRate: 48000 });
  dest = actx.createMediaStreamDestination();
  try {
    const r = await fetch(`/out/${CUTS[CUT].audio}`);
    if (!r.ok) throw new Error(String(r.status));
    buffer = await actx.decodeAudioData(await r.arrayBuffer());
  } catch {
    status('rendering audio offline ...');
    const { renderAudio } = await import('./audio/render.js');
    buffer = (await renderAudio()).buffer;
  }
}

const now = () => (playing ? startT + Math.max(0, actx.currentTime - startCtx) : t);

function play(from = t) {
  if (from >= DURATION - 1 / FPS) from = 0;
  stopAudio();
  actx.resume();
  src = actx.createBufferSource();
  src.buffer = buffer;
  src.connect(actx.destination);
  src.connect(dest);
  startCtx = actx.currentTime + 0.05;
  startT = from;
  src.start(startCtx, from);
  playing = true;
  $('play').textContent = 'pause';
}
function stopAudio() {
  if (src) { try { src.stop(); } catch {} src.disconnect(); src = null; }
}
function pause() {
  t = Math.min(DURATION - 1 / FPS, now());
  playing = false;
  stopAudio();
  $('play').textContent = 'play';
}
function seek(to) {
  const was = playing;
  if (playing) pause();
  t = Math.max(0, Math.min(DURATION - 1 / FPS, to));
  if (was) play(t);
  else draw(t, true);
}

const pad = (n) => String(n).padStart(2, '0');
const frameOf = (x) => Math.floor(x * FPS + 1e-6);
function timecode(x) {
  const f = frameOf(x);
  return `${pad(Math.floor(f / FPS / 60))}:${pad(Math.floor(f / FPS) % 60)}:${pad(f % FPS)}`;
}

function overlay(x) {
  $('time').textContent = timecode(x);
  $('scrub').value = String(frameOf(x));
  if (!showTc) return;
  const S = trailer.evaluate(x);
  const cap = S.cap.cid >= 0 && S.cap.alpha > 0 ? captions[S.cap.cid].text : '-';
  $('tc').textContent = `${timecode(x)}   frame ${frameOf(x)}\nbar ${gridLabel(x)}\nshot ${shotAt(x).id}\ntext ${cap}`;
}

/** Render the frame for time x; while playing, never wait for textures. */
function draw(x, wait = false) {
  const f = frameOf(x) / FPS;
  overlay(x);
  if (rendering) { pending = [f, wait]; return; }
  rendering = true;
  trailer.renderAt(f, { wait }).finally(() => {
    rendering = false;
    if (pending) { const [pf, pw] = pending; pending = null; draw(pf, pw); }
  });
}

/** Keep the next second of plate frames decoding ahead of the playhead. */
function prefetch(x) {
  for (let k = 1; k <= 30; k += 2) {
    for (const [p, i] of trailer.needs(Math.min(DURATION - 0.01, x + k / FPS))) trailer.plates.load(p, i).catch(() => {});
  }
}

function tick() {
  if (playing) {
    const x = now();
    if (x >= DURATION) {
      pause();
      if (recorder) recorder.stop();
    } else {
      t = x;
      prefetch(x);
      draw(x);
    }
  }
  requestAnimationFrame(tick);
}

function record() {
  if (recorder) { recorder.stop(); return; }
  const stream = new MediaStream([...canvas.captureStream(FPS).getVideoTracks(), ...dest.stream.getAudioTracks()]);
  const type = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'].find((m) => MediaRecorder.isTypeSupported(m));
  recorder = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 24e6, audioBitsPerSecond: 256e3 });
  const chunks = [];
  recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  recorder.onstop = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(chunks, { type: 'video/webm' }));
    a.download = CUTS[CUT].out.replace('.mp4', '-realtime.webm');
    a.click();
    recorder = null;
    $('rec').classList.remove('on');
    $('rec').textContent = 'record';
    if (playing) pause();
  };
  recorder.start(250);
  $('rec').classList.add('on');
  $('rec').textContent = 'stop';
  seek(0);
  play(0);
}

async function main() {
  await trailer.init();
  status('loading audio ...');
  await loadAudio();
  status();
  $('scrub').max = String(DURATION * FPS - 1);
  draw(0, true);
  $('play').onclick = () => (playing ? pause() : play());
  $('replay').onclick = () => { seek(0); play(0); };
  $('tcBtn').onclick = () => { showTc = !showTc; $('tc').hidden = !showTc; overlay(now()); };
  $('rec').onclick = record;
  $('scrub').oninput = (e) => seek(Number(e.target.value) / FPS);
  addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' && e.key !== ' ') return;
    const k = e.key.toLowerCase();
    if (k === ' ') { e.preventDefault(); playing ? pause() : play(); }
    else if (k === 'r') { seek(0); play(0); }
    else if (k === 't') $('tcBtn').click();
    else if (k === 'arrowright') seek(frameOf(now()) / FPS + 1 / FPS);
    else if (k === 'arrowleft') seek(frameOf(now()) / FPS - 1 / FPS);
  });
  requestAnimationFrame(tick);
}
main().catch((e) => status('error: ' + e.message));
