// Phone check (Pixel 7 emulation, debug build on :4173): the touch pad shows,
// double-taps do not zoom, and holding B + a direction runs.
//   node tools/mobile_check.mjs [screenshot.png]
import { chromium, devices } from 'playwright';
const b = await chromium.launch({ executablePath: process.env.CHROME });
const ctx = await b.newContext({ ...devices['Pixel 7'] });
const p = await ctx.newPage();
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.goto('http://localhost:4173/');
await p.waitForFunction(() => window.__game?.scene.isActive('Title'));
await p.evaluate(() => { localStorage.clear(); window.__game.scene.getScene('Title').scene.start('Wallet', { name: 'KAI', gender: 'boy', starter: 'emby' }); });
await p.waitForTimeout(600);
await p.keyboard.type('mobilewallet1'); await p.keyboard.press('Enter');
await p.waitForFunction(() => window.__game.scene.isActive('Overworld'));
await p.waitForTimeout(1200);
const box = async (act) => p.locator(`#touchpad [data-act=${act}]`).boundingBox();
const A = await box('confirm'); const B = await box('cancel'); const R = await box('right');
console.log('pad visible:', !!A && !!B);
const cdp = await ctx.newCDPSession(p);
const tp = (bx, id) => ({ x: bx.x + bx.width / 2, y: bx.y + bx.height / 2, id });
// double-tap A quickly, twice
for (let k = 0; k < 2; k++) {
  for (let i = 0; i < 2; i++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [tp(A, 1)] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await p.waitForTimeout(90);
  }
}
await p.waitForTimeout(500);
console.log('zoom after double taps:', await p.evaluate(() => window.visualViewport.scale));
// dismiss any dialog opened by A
await p.evaluate(() => { const o = window.__game.scene.getScene('Overworld'); o.pos = { x: 20, y: 119 }; o.face('right'); o.syncPlayer(); });
await p.waitForTimeout(800);
const before = await p.evaluate(() => window.__game.scene.getScene('Overworld').pos.x);
// hold B + right for 1.2 s with two fingers
await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [tp(B, 1)] });
await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [tp(B, 1), tp(R, 2)] });
const frames = new Set();
const t0 = Date.now();
while (Date.now() - t0 < 1200) { frames.add(await p.evaluate(() => Number(window.__game.scene.getScene('Overworld').player.frame.name) % 7)); await p.waitForTimeout(30); }
await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
await p.waitForTimeout(400);
const after = await p.evaluate(() => window.__game.scene.getScene('Overworld').pos.x);
console.log('tiles moved in 1.2s holding B+right:', after - before, 'frames used:', [...frames].sort());
await p.screenshot({ path: process.argv[2] });
console.log('errors', errs);
await b.close();
