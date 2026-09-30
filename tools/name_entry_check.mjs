// Phone check: the intro name entry submits via the on-screen OK button and via A.
//   (debug build on :4173) node tools/name_entry_check.mjs <outDir>
import { chromium, devices } from 'playwright';
const OUT = process.argv[2];
const b = await chromium.launch({ executablePath: process.env.CHROME });
const run = async (useA) => {
  const ctx = await b.newContext({ ...devices['Pixel 7'] });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('http://localhost:4173/');
  await p.waitForFunction(() => window.__game?.scene.isActive('Title'));
  await p.evaluate(() => { localStorage.clear(); window.__game.scene.getScene('Title').scene.start('Intro'); });
  const A = await p.locator('#touchpad [data-act=confirm]').boundingBox();
  const tapA = () => p.touchscreen.tap(A.x + A.width / 2, A.y + A.height / 2);
  // advance dialogue with A until the name input shows
  for (let i = 0; i < 60 && !(await p.locator('input.er-input').count()); i++) { await tapA(); await p.waitForTimeout(250); }
  await p.waitForTimeout(400);
  await p.screenshot({ path: `${OUT}/name_${useA ? 'A' : 'ok'}.png` });
  // empty submit should not advance
  if (useA) await tapA(); else await p.touchscreen.tap(...(await okXY(p)));
  await p.waitForTimeout(400);
  const stillOpen = await p.locator('input.er-input').count();
  await p.locator('input.er-input').fill('Kai');
  if (useA) await tapA(); else await p.touchscreen.tap(...(await okXY(p)));
  await p.waitForTimeout(600);
  const gone = !(await p.locator('input.er-input').count());
  const txt = await p.evaluate(() => window.__game.scene.getScene('Intro').box.text.text);
  console.log(useA ? 'A button:' : 'OK button:', 'empty kept open:', !!stillOpen, '| submitted:', gone, '| next line:', JSON.stringify(txt.slice(0, 40)), errs);
  await ctx.close();
};
async function okXY(p) {
  // OK button: game coords (480, 405) -> page coords through the canvas scale
  return p.evaluate(() => { const c = document.querySelector('canvas').getBoundingClientRect(); return [c.left + (480 / 960) * c.width, c.top + (405 / 640) * c.height]; });
}
await run(false);
await run(true);
await b.close();
