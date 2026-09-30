// End-to-end smoke playthrough in headless Chromium.
//   npx vite build && npx vite preview --port 4173 &   then:   node tools/smoke_play.mjs [outDir]
// Walks: title -> intro -> name -> look -> starter -> wallet -> overworld ->
// wild battle -> Trainer 1 -> (debug-warp) Cooker -> Hall of Fame, taking screenshots.
import { chromium } from 'playwright';
import fs from 'node:fs';

const OUT = process.argv[2] ?? 'tools/_smoke';
const URL = process.env.URL ?? 'http://localhost:4173/';
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: process.env.CHROME ?? undefined });
const page = await browser.newPage({ viewport: { width: 960, height: 640 } });
const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });

const sleep = (ms) => page.waitForTimeout(ms);
const shot = async (name) => { await page.screenshot({ path: `${OUT}/${name}.png` }); console.log('  shot', name); };
const active = (key) => page.evaluate((k) => window.__game?.scene.isActive(k), key);
async function pressUntil(cond, { key = 'Enter', max = 300, delay = 140 } = {}) {
  for (let i = 0; i < max; i++) {
    if (await cond()) return true;
    await page.keyboard.press(key);
    await sleep(delay);
  }
  const state = await page.evaluate(() => ({
    scenes: window.__game.scene.getScenes(true).map((x) => x.scene.key),
    texts: window.__game.scene.getScenes(true).flatMap((sc) => sc.children.list.filter((c) => c.type === 'Text' && c.visible).map((c) => c.text)).slice(-6),
  }));
  console.log('STATE', JSON.stringify(state), '\n', errors.join('\n'));
  throw new Error(`pressUntil timed out (${cond})`);
}

await page.goto(URL);
await page.waitForFunction(() => window.__game?.scene.isActive('Title'));
await sleep(900);
await shot('01_title');
await page.keyboard.press('Enter'); await sleep(300);
await page.keyboard.press('Enter'); // NEW GAME
await page.waitForFunction(() => window.__game.scene.isActive('Intro'));
await sleep(1600);
await page.keyboard.press('Enter'); await sleep(300); await page.keyboard.press('Enter'); await sleep(900);
await shot('02_intro_black');
await pressUntil(() => page.evaluate(() => !!document.querySelector('input.er-input')));
await shot('03_name_input');
await page.keyboard.type('Kai');
await page.keyboard.press('Enter');
await sleep(600);
await pressUntil(() => active('Look'));
await sleep(900);
await shot('04_look');
await page.keyboard.press('Enter'); await sleep(300); await page.keyboard.press('Enter');
await page.waitForFunction(() => window.__game.scene.isActive('Starter'));
await sleep(900);
await page.keyboard.press('ArrowRight'); await sleep(250); await page.keyboard.press('ArrowLeft'); await sleep(400);
await shot('05_starter');
await page.keyboard.press('Enter'); await sleep(400);
await shot('05b_starter_confirm');
await page.keyboard.press('Enter');
await pressUntil(() => active('Wallet'));
await sleep(900);
await page.keyboard.type('7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU');
await shot('06_wallet');
await page.keyboard.press('Enter');
await page.waitForFunction(() => window.__game.scene.isActive('Overworld'));
await sleep(1500);
await shot('07_overworld_start');

// walk north a bit
await page.keyboard.down('ArrowUp'); await sleep(1500); await page.keyboard.up('ArrowUp');
await sleep(400);
await shot('08_overworld_walk');
// step left into the zone-1 grass
await page.evaluate(() => { const o = window.__game.scene.getScene('Overworld'); o.pos = { x: 15, y: 110 }; o.syncPlayer(); });
await sleep(300);
await shot('09_tall_grass');

// ---- wild battle ----
await page.evaluate(() => window.__game.scene.getScene('Overworld').startWild());
await page.waitForFunction(() => window.__game.scene.isActive('Battle'));
await sleep(1700);
await shot('10_wild_intro');
await pressUntil(() => page.evaluate(() => window.__game.scene.getScene('Battle').children.list.some((c) => c.type === 'Container' && c.depth === 1100)));
await sleep(300);
await shot('11_command_menu');
await page.keyboard.press('Enter'); await sleep(400);
await shot('12_fight_menu');
await page.keyboard.press('Enter'); await sleep(900);
await shot('13_attack');
await pressUntil(async () => !(await active('Battle')), { max: 600 });
await sleep(900);
await shot('14_after_wild');

// ---- level-up, stat panel, move learning and evolution ----
const visibleTexts = () => page.evaluate(() => {
  const out = [];
  const walk = (list) => list.forEach((c) => {
    if (!c.visible) return;
    if (c.type === 'Container') walk(c.list);
    else if (c.type === 'Text' && c.alpha > 0) out.push(c.text.replace(/\u200C/g, ''));
  });
  window.__game.scene.getScenes(true).forEach((sc) => walk(sc.children.list));
  return out.join(' | ');
});
async function playUntilDone(shots) {
  const taken = new Set();
  for (let i = 0; i < 900; i++) {
    if (!(await active('Battle'))) return;
    const t = await visibleTexts();
    for (const [re, name, delay] of shots) {
      if (!taken.has(name) && re.test(t)) { taken.add(name); await sleep(delay ?? 200); await shot(name); }
    }
    await page.keyboard.press('Enter');
    await sleep(130);
  }
}
await page.evaluate(() => {
  const o = window.__game.scene.getScene('Overworld');
  const c = o.save.party[0];
  c.level = 13; c.xp = 14 ** 3 - 1; c.hp = 40;
  o.startWild();
});
await page.waitForFunction(() => window.__game.scene.isActive('Battle'));
await playUntilDone([[/grew to Lv\. 14/, '14b_levelup', 300], [/Attack/, '14c_stat_panel', 200], [/is evolving/, '14d_evolving', 1400], [/evolved into/, '14e_evolved', 400]]);
await pressUntil(() => page.evaluate(() => !window.__game.scene.getScene('Overworld').locked), { max: 60 });
await sleep(400);

// ---- pause menu, team summary, bag, profile ----
await page.keyboard.press('m'); await sleep(400);
await shot('14f_pause_menu');
await page.keyboard.press('Enter'); await sleep(500);
await shot('14g_team_summary');
await page.keyboard.press('Escape'); await sleep(300);
await page.keyboard.press('ArrowDown'); await sleep(150); await page.keyboard.press('Enter'); await sleep(400);
await shot('14h_bag');
await page.keyboard.press('Escape'); await sleep(300);
await page.keyboard.press('ArrowDown'); await sleep(150); await page.keyboard.press('Enter'); await sleep(500);
await shot('14i_profile');
await page.keyboard.press('ArrowRight'); await sleep(150); await page.keyboard.press('Enter'); await sleep(300);
await page.keyboard.press('Escape'); await sleep(400);

// ---- Trainer 1 (boost the partner so the run is deterministic) ----
await page.evaluate(() => {
  const o = window.__game.scene.getScene('Overworld');
  const c = o.save.party[0];
  c.level = 14; c.xp = 14 ** 3; c.hp = 999; // clamp below
  o.pos = { x: 22, y: 101 }; o.facing = 'up'; o.face('up'); o.syncPlayer();
});
await page.evaluate(() => { const c = window.__game.scene.getScene('Overworld').save.party[0]; c.hp = 60; });
await sleep(400);
await shot('15_trainer1_approach');
await page.keyboard.press('Enter');
await sleep(1500);
await shot('16_trainer1_dialog');
await pressUntil(() => active('Battle'));
await sleep(700);
await shot('17_trainer1_intro');
await pressUntil(async () => !(await active('Battle')), { max: 900 });
await sleep(600);
await shot('18_after_trainer1');
await pressUntil(() => page.evaluate(() => { const o = window.__game.scene.getScene('Overworld'); return !o.locked; }), { max: 60 });
await sleep(500);
await shot('19_score_hud');

// ---- debug-warp to the Elite Hall, beat Cooker ----
await page.evaluate(() => {
  const o = window.__game.scene.getScene('Overworld');
  const s = o.save;
  for (const id of ['t2', 't3', 't4']) s.defeated[id] = true;
  const c = s.party[0];
  const fam = { emby: 'fire', emberfox: 'fire', embrute: 'fire', sharkpup: 'water', sharkjaw: 'water', sharkrex: 'water', fernie: 'grass', fernbloom: 'grass', fernking: 'grass' }[c.species];
  c.species = { fire: 'emberfox', water: 'sharkrex', grass: 'fernking' }[fam];
  c.level = 58; c.xp = 58 ** 3; c.hp = 400;
  c.moves = { fire: ['blazerush', 'infernoroar', 'hammerfist', 'flamefang'], water: ['surge', 'wyrmclaw', 'maelstrom', 'tidefang'], grass: ['solarflare', 'petalstorm', 'sunbloom', 'sapdrain'] }[fam].map((id) => ({ id, pp: 30 }));
  o.placeTrainer('t4', { x: 22, y: 62, moved: { x: 21, y: 61 } });
  o.pos = { x: 22, y: 13 }; o.face('up'); o.syncPlayer();
});
await sleep(600);
// through the doors into the Hall...
await page.keyboard.down('ArrowUp'); await sleep(250); await page.keyboard.up('ArrowUp');
await page.waitForFunction(() => window.__game.scene.getScene('Overworld').indoors === true, null, { timeout: 8000 });
await pressUntil(() => page.evaluate(() => !window.__game.scene.getScene('Overworld').locked), { max: 20, delay: 250 });
await shot('20_elite_hall');
// ...up the carpet until Cooker notices, walks over and talks
// (the braziers catch as you pass; Cooker's voice interrupts from the dark)
for (let i = 0; i < 40; i++) {
  const st = await page.evaluate(() => { const o = window.__game.scene.getScene('Overworld'); return { met: !!o.cookerMet, locked: o.locked }; });
  if (st.met) break;
  if (st.locked) { await page.keyboard.press('Enter'); await sleep(350); continue; }
  await page.keyboard.down('ArrowUp'); await sleep(120); await page.keyboard.up('ArrowUp'); await sleep(300);
}
await page.waitForFunction(() => window.__game.scene.getScene('Overworld').cookerMet === true, null, { timeout: 5000 });
await sleep(5200);
await shot('20b_cooker_approach');
await pressUntil(() => active('Battle'), { max: 60, delay: 200 });
await sleep(1200);
await shot('21_cooker_intro');
await pressUntil(async () => !(await active('Battle')), { max: 1500, delay: 110 });
for (let i = 0; i < 40 && !(await active('HallOfFame')); i++) {
  console.log('  after-cooker scenes:', await page.evaluate(() => window.__game.scene.getScenes(true).map((x) => x.scene.key).join(',')));
  await page.keyboard.press('Enter');
  await sleep(400);
}
await sleep(2500);
await shot('22_hall_of_fame');

const save = await page.evaluate(() => JSON.parse(localStorage.getItem('eliteRoute.save.v1')));
console.log('score', save.score, 'defeated', JSON.stringify(save.defeated), 'wallet', save.player.wallet, 'seedSource', save.seedSource);
console.log('species now', save.party[0].species, 'Lv', save.party[0].level);
console.log(errors.length ? `ERRORS:\n${errors.join('\n')}` : 'no page errors');
await browser.close();
