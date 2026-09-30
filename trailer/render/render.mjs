// Offline render: every frame of the trailer at 1920x1080 / 30 fps, rendered
// headless from the compositor's time-driven state (no realtime, no dropped
// frames), piped straight into ffmpeg and muxed with the offline soundtrack.
//
//   node render/render.mjs            -> solquest-trailer.mp4
//   node render/render.mjs --from 12 --to 16 --out out/part.mp4   (a slice, for checks)
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { ROOT, OUT, server, page, ffmpegPath } from './common.mjs';
import { renderAudioFile } from './audio.mjs';
import { FPS, DURATION } from '../src/grid.js';

const arg = (k, d) => {
  const i = process.argv.indexOf(k);
  return i > 0 ? process.argv[i + 1] : d;
};
const from = Number(arg('--from', 0));
const to = Number(arg('--to', DURATION));
const outFile = path.resolve(ROOT, arg('--out', 'solquest-trailer.mp4'));
const f0 = Math.round(from * FPS);
const f1 = Math.round(to * FPS);

const stop = await server();
try {
  const wav = path.join(OUT, 'audio.wav');
  if (!existsSync(wav) || process.argv.includes('--audio')) {
    console.log('rendering audio ...');
    const { report } = await renderAudioFile();
    console.log(JSON.stringify(report));
  }

  const ff = spawn(ffmpegPath(), [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-f', 'image2pipe', '-c:v', 'png', '-framerate', String(FPS), '-i', '-',
    '-ss', String(from), '-t', String((f1 - f0) / FPS), '-i', wav,
    '-map', '0:v', '-map', '1:a',
    // RGB -> BT.709 limited range, tagged, so players don't shift the palette
    '-vf', 'scale=out_color_matrix=bt709:out_range=tv:flags=lanczos+accurate_rnd+full_chroma_int,format=yuv420p',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '13', '-tune', 'animation',
    '-maxrate', '28M', '-bufsize', '40M', '-g', String(FPS),
    '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
    '-c:a', 'aac', '-b:a', '320k', '-ar', '48000',
    '-movflags', '+faststart', '-shortest',
    outFile,
  ], { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((res, rej) => ff.on('close', (c) => (c === 0 ? res() : rej(new Error('ffmpeg exited ' + c)))));

  let { browser, page: p } = await page();
  // a dev-server reload (someone saved a file) kills the page mid-render: reopen it and redo the frame
  const frame = async (f) => {
    for (let attempt = 0; ; attempt++) {
      try {
        await p.evaluate((t) => window.__trailer.renderAt(t), f / FPS);
        return await p.screenshot({ type: 'png' });
      } catch (e) {
        if (attempt >= 3) throw e;
        console.log(`frame ${f}: ${e.message.split('\n')[0]} - reopening the page`);
        await browser.close().catch(() => {});
        ({ browser, page: p } = await page());
      }
    }
  };
  const t0 = Date.now();
  for (let f = f0; f < f1; f++) {
    const png = await frame(f);
    if (!ff.stdin.write(png)) await new Promise((r) => ff.stdin.once('drain', r));
    const n = f - f0 + 1;
    if (n % 30 === 0 || f === f1 - 1) {
      const el = (Date.now() - t0) / 1000;
      console.log(`frame ${f + 1}/${f1}  ${(el / n).toFixed(2)} s/frame  eta ${Math.round((el / n) * (f1 - f - 1))} s`);
    }
  }
  ff.stdin.end();
  await done;
  await browser.close();
  console.log(outFile);
} finally {
  stop();
}
