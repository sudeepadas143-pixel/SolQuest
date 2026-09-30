// Seamless loop: the camera path and the time of day repeat every LOOP seconds,
// but clouds, water and grass sway keep running on the clock. Render one more
// second past the end (t = LOOP .. LOOP+1: same camera as 0..1, the clock
// continued) and cross-fade it into the first second, so the wrap from the last
// frame to the first is invisible (drone/blend_seam.py does the blend; the
// originals are kept in out/drone-frames-orig).
import { existsSync, mkdirSync, writeFileSync, copyFileSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { ROOT, server } from './common.mjs';

const FPS = 30;
const LOOP = 48;
const FADE = 30;
const FRAMES = path.join(ROOT, 'out', 'drone-frames');
const ORIG = path.join(ROOT, 'out', 'drone-frames-orig');
const EXTRA = path.join(ROOT, 'out', 'drone-frames-extra');
mkdirSync(ORIG, { recursive: true });
mkdirSync(EXTRA, { recursive: true });
const f = (dir, i) => path.join(dir, `${String(i).padStart(4, '0')}.png`);

const stop = await server();
try {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 960, height: 640 } });
  await page.goto('http://127.0.0.1:5174/drone.html');
  await page.waitForFunction(() => window.__drone, null, { timeout: 60000 });
  await page.evaluate(() => window.__drone.ready);
  for (let i = 0; i < FADE; i++) {
    if (existsSync(f(EXTRA, i))) continue;
    const url = await page.evaluate((t) => window.__drone.frame(t), LOOP + i / FPS);
    writeFileSync(f(EXTRA, i), Buffer.from(url.split(',')[1], 'base64'));
    if (!existsSync(f(ORIG, i))) copyFileSync(f(FRAMES, i), f(ORIG, i));
    console.log('extra', i);
  }
  await browser.close();
  console.log('extra frames rendered; now: python3 drone/blend_seam.py');
} finally {
  stop();
}
