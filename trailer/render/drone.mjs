// Renders the title-screen drone flight (drone.html) frame by frame and encodes
// the seamless loop for the game: public/assets/title/drone.{mp4,webm} + poster.png.
//
//   node render/drone.mjs [--seconds 4]      (a short test loop)
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { ROOT, server, ffmpegPath } from './common.mjs';

const FPS = 30;
const OUT = path.resolve(ROOT, '..', 'public', 'assets', 'title');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };

const stop = await server();
try {
  const exe = process.env.CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
  const browser = await chromium.launch({ executablePath: exe, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 960, height: 642 } });
  page.on('pageerror', (e) => console.error('page error:', e.message));
  await page.goto('http://127.0.0.1:5174/drone.html');
  await page.waitForFunction(() => window.__drone, null, { timeout: 60000 });
  await page.evaluate(() => window.__drone.ready);
  const loop = await page.evaluate(() => window.__drone.LOOP);
  const seconds = Number(arg('--seconds', loop));
  const n = Math.round(seconds * FPS);
  mkdirSync(OUT, { recursive: true });

  // lossless intermediate at the native 320x214, upscaled x3 (nearest) when encoding
  const tmp = path.join(ROOT, 'out', 'drone-lossless.mkv');
  mkdirSync(path.dirname(tmp), { recursive: true });
  const ff = spawn(ffmpegPath(), ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'image2pipe', '-c:v', 'png', '-framerate', String(FPS), '-i', '-',
    '-c:v', 'ffv1', tmp], { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((res, rej) => ff.on('close', (c) => (c === 0 ? res() : rej(new Error('ffmpeg ' + c)))));
  const t0 = Date.now();
  for (let i = 0; i < n; i++) {
    const url = await page.evaluate((t) => window.__drone.frame(t), i / FPS);
    const png = Buffer.from(url.split(',')[1], 'base64');
    if (i === 0) writeFileSync(path.join(OUT, 'poster.png'), png);
    if (!ff.stdin.write(png)) await new Promise((r) => ff.stdin.once('drain', r));
    if ((i + 1) % 60 === 0) console.log(`frame ${i + 1}/${n}  ${((Date.now() - t0) / (i + 1) / 1000).toFixed(2)} s/frame`);
  }
  ff.stdin.end();
  await done;
  await browser.close();

  const FF = ffmpegPath();
  const enc = (args) => new Promise((res, rej) => {
    const p = spawn(FF, ['-hide_banner', '-loglevel', 'error', '-y', '-i', tmp, ...args], { stdio: 'inherit' });
    p.on('close', (c) => (c === 0 ? res() : rej(new Error('ffmpeg ' + c))));
  });
  // native 320x214 (the game scales it x3 with nearest-neighbour): a fraction of
  // the size of a pre-scaled video and almost identical on screen
  await enc(['-vf', 'format=yuv420p', '-c:v', 'libx264', '-profile:v', 'high', '-preset', 'veryslow', '-crf', '26', '-tune', 'animation',
    '-g', '90', '-an', '-movflags', '+faststart', path.join(OUT, 'drone.mp4')]);
  // VP9 for browsers without H.264 (the game offers both)
  await enc(['-vf', 'format=yuv420p', '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '38', '-row-mt', '1', '-deadline', 'good', '-cpu-used', '1',
    '-g', '90', '-an', path.join(OUT, 'drone.webm')]);
  console.log('wrote', OUT);
} finally {
  stop();
}
