// Community links on the title screen are real page elements, so browsers
// honour them (Safari / phones won't open tabs from canvas taps): the X chip
// is an <a href> to the profile, the CA chip a <button>; both step aside when
// a board covers them. Desktop and phone (touch) viewports.
//   node tools/links_check.mjs   (VITE_DEBUG=1 build: vite preview on :4173 or URL=...)
import { chromium, devices } from 'playwright';
import { X_URL } from '../src/data/community.js';

const fails = [];
const check = (ok, msg) => { console.log(`${ok ? '  ok ' : 'FAIL '} ${msg}`); if (!ok) fails.push(msg); };
const b = await chromium.launch({ executablePath: process.env.CHROME ?? undefined });

for (const [label, opts] of [['desktop', { viewport: { width: 1280, height: 800 } }], ['phone', { ...devices['iPhone 13'] }]]) {
  console.log(`-- ${label}`);
  const ctx = await b.newContext(opts);
  await ctx.route('https://x.com/**', (r) => r.fulfill({ status: 200, body: 'x' }));
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  await p.goto(process.env.URL ?? 'http://localhost:4173/');
  await p.waitForFunction(() => window.__game?.scene.isActive('Title'));
  await p.waitForTimeout(1200);
  // game point -> page point
  const at = (x, y) => p.evaluate(([x, y]) => { const r = window.__game.canvas.getBoundingClientRect(); return [r.left + (x * r.width) / 960, r.top + (y * r.height) / 640]; }, [x, y]);
  const under = (pt) => p.evaluate(([x, y]) => { const e = document.elementFromPoint(x, y); return e ? { tag: e.tagName, href: e.getAttribute('href'), target: e.getAttribute('target') } : null; }, pt);
  const xPt = await at(16 + 56, 640 - 46 + 17);
  const caPt = await at(16 + 112 + 8 + 95, 640 - 46 + 17);
  const xEl = await under(xPt);
  check(xEl?.tag === 'A' && xEl.href === X_URL && xEl.target === '_blank', `X chip is a real link to ${X_URL} (${JSON.stringify(xEl)})`);
  check((await under(caPt))?.tag === 'BUTTON', 'CA chip is a real button');
  // a real tap / click on it opens the profile
  const pop = ctx.waitForEvent('page', { timeout: 5000 }).catch(() => null);
  if (label === 'phone') await p.touchscreen.tap(...xPt); else await p.mouse.click(...xPt);
  const np = await pop;
  check(np?.url() === X_URL, `tapping X opens ${np?.url() ?? 'nothing'}`);
  await np?.close();
  // the game itself still starts from a click elsewhere, and the menu works
  if (label === 'phone') await p.touchscreen.tap(...(await at(480, 400))); else await p.mouse.click(...(await at(480, 400)));
  await p.waitForTimeout(700);
  // open the leaderboard (no save: NEW GAME, LEADERBOARD, ...): its ◀ button sits where the strip was
  await p.evaluate(() => {
    const t = window.__game.scene.getScene('Title');
    t.strip.setLinksActive(false);
    t.scene.launch('Leaderboard', { from: 'Title' });
  });
  await p.waitForTimeout(800);
  check((await under(xPt))?.tag === 'CANVAS', 'with a board open, the strip links step aside');
  await p.evaluate(() => { window.__game.scene.getScene('Leaderboard').close(); window.__game.scene.getScene('Title').strip.setLinksActive(true); });
  await p.waitForTimeout(300);
  check((await under(xPt))?.tag === 'A', 'and come back when it closes');
  check(!errors.length, `no page errors ${errors.join(' | ')}`);
  await ctx.close();
}
await b.close();
process.exit(fails.length ? 1 : 0);
