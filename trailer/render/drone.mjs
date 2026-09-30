// Renders the title-screen drone flight (drone.html) frame by frame and encodes
// the seamless loop for the game: public/assets/title/drone.{mp4,webm} + poster.jpg.
//
//   node render/drone.mjs                 render every frame (4 parallel workers), then encode
//   node render/drone.mjs --workers 2     fewer workers
//   node render/drone.mjs --encode        encode only (frames already on disk)
//
// Frames go to out/drone-frames/NNNN.png and existing ones are skipped, so an
// interrupted render resumes where it stopped.
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { ROOT, server, ffmpegPath } from './common.mjs';

const FPS = 30;
const LOOP = 48;
const N = LOOP * FPS;
const OUT = path.resolve(ROOT, '..', 'public', 'assets', 'title');
const FRAMES = path.join(ROOT, 'out', 'drone-frames');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const frameFile = (i) => path.join(FRAMES, `${String(i).padStart(4, '0')}.png`);

async function worker(from, to) {
  const exe = process.env.CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
  const browser = await chromium.launch({ executablePath: exe, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 960, height: 640 } });
  page.on('pageerror', (e) => console.error('page error:', e.message));
  await page.goto('http://127.0.0.1:5174/drone.html');
  await page.waitForFunction(() => window.__drone, null, { timeout: 60000 });
  await page.evaluate(() => window.__drone.ready);
  const t0 = Date.now();
  let done = 0;
  for (let i = from; i < to; i++) {
    if (existsSync(frameFile(i))) continue;
    const url = await page.evaluate((t) => window.__drone.frame(t), i / FPS);
    writeFileSync(frameFile(i), Buffer.from(url.split(',')[1], 'base64'));
    done++;
    if (done % 30 === 0) console.log(`[${from}-${to}] frame ${i + 1}  ${((Date.now() - t0) / done / 1000).toFixed(2)} s/frame`);
  }
  await browser.close();
}

function encode() {
  const FF = ffmpegPath();
  const n = readdirSync(FRAMES).filter((f) => f.endsWith('.png')).length;
  if (n < N) throw new Error(`only ${n}/${N} frames rendered`);
  mkdirSync(OUT, { recursive: true });
  const run = (args) => new Promise((res, rej) => {
    const p = spawn(FF, ['-hide_banner', '-loglevel', 'error', '-y', '-framerate', String(FPS), '-i', path.join(FRAMES, '%04d.png'), ...args], { stdio: 'inherit' });
    p.on('close', (c) => (c === 0 ? res() : rej(new Error('ffmpeg ' + c))));
  });
  const crf = arg('--crf', '25');
  // the poster: frame 0 as a light JPEG (shown instantly while the video streams)
  const poster = new Promise((res, rej) => {
    const p = spawn(FF, ['-hide_banner', '-loglevel', 'error', '-y', '-i', frameFile(0), '-q:v', '3', path.join(OUT, 'poster.jpg')], { stdio: 'inherit' });
    p.on('close', (c) => (c === 0 ? res() : rej(new Error('ffmpeg ' + c))));
  });
  return poster.then(() => run(['-vf', 'format=yuv420p', '-c:v', 'libx264', '-profile:v', 'high', '-preset', 'veryslow', '-crf', crf, '-tune', 'film',
    '-g', '90', '-an', '-movflags', '+faststart', path.join(OUT, 'drone.mp4')]))
    // VP9 for browsers without H.264 (the game offers both)
    .then(() => run(['-vf', 'format=yuv420p', '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', String(Number(crf) + 12), '-row-mt', '1',
      '-deadline', 'good', '-cpu-used', '2', '-g', '90', '-an', path.join(OUT, 'drone.webm')]));
}

const self = fileURLToPath(import.meta.url);
if (process.argv.includes('--range')) {
  const [a, b] = arg('--range').split(':').map(Number);
  await worker(a, b);
} else {
  mkdirSync(FRAMES, { recursive: true });
  if (!process.argv.includes('--encode')) {
    const stop = await server();
    try {
      const W = Number(arg('--workers', 4));
      const step = Math.ceil(N / W);
      await Promise.all(Array.from({ length: W }, (_, k) => new Promise((res, rej) => {
        const p = spawn(process.execPath, [self, '--range', `${k * step}:${Math.min(N, (k + 1) * step)}`], { stdio: 'inherit' });
        p.on('close', (c) => (c === 0 ? res() : rej(new Error(`worker ${k} exited ${c}`))));
      })));
    } finally {
      stop();
    }
  }
  await encode();
  console.log('wrote', OUT);
}
