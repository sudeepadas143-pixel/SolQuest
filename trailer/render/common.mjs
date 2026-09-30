// Shared bits for the offline render scripts: the local Vite server, a
// headless Chromium on the trailer's render page, and the ffmpeg binary.
import { spawn, execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { chromium } from 'playwright';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const OUT = path.join(ROOT, 'out');
export const PORT = 5174;
export const URL = `http://127.0.0.1:${PORT}/render.html`;

export function ffmpegPath() {
  if (process.env.FFMPEG) return process.env.FFMPEG;
  try {
    execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' });
    return 'ffmpeg';
  } catch {}
  const bundled = '/usr/local/lib/python3.11/dist-packages/imageio_ffmpeg/binaries/ffmpeg-linux-x86_64-v7.0.2';
  if (existsSync(bundled)) return bundled;
  throw new Error('ffmpeg not found: set FFMPEG=/path/to/ffmpeg');
}

async function up() {
  try { return (await fetch(URL)).ok; } catch { return false; }
}

/** Use a running dev server on :5174, or start one for the duration of the script. */
export async function server() {
  if (await up()) return () => {};
  const vite = spawn('npx', ['vite', '--config', 'vite.config.js', '--port', String(PORT), '--strictPort'], { cwd: ROOT, stdio: 'ignore' });
  for (let i = 0; i < 120 && !(await up()); i++) await new Promise((r) => setTimeout(r, 250));
  if (!(await up())) throw new Error('vite did not start on :' + PORT);
  return () => vite.kill();
}

export async function page() {
  const exe = process.env.CHROMIUM || (existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome') ? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' : undefined);
  const browser = await chromium.launch({
    executablePath: exe,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'],
  });
  const p = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  p.on('pageerror', (e) => console.error('page error:', e.message));
  await p.goto(URL);
  await p.waitForFunction(() => window.__trailer, null, { timeout: 60000 });
  await p.evaluate(() => window.__trailer.ready);
  return { browser, page: p };
}
