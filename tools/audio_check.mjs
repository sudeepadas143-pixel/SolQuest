// Plays each music track in headless Chromium and reports its loudness and
// brightness (spectral centroid) from an analyser on the master bus.
//   VITE_DEBUG=1 npm run build && npm run preview &   then: node tools/audio_check.mjs
import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: process.env.CHROME ?? undefined, args: ['--autoplay-policy=no-user-gesture-required'] });
const p = await b.newPage();
const errors = [];
p.on('pageerror', (e) => errors.push(e.message));
await p.goto(process.env.URL ?? 'http://localhost:4173/');
await p.waitForFunction(() => window.__audio && window.__game?.scene.isActive('Title'));
await p.keyboard.press('Shift');
const tracks = process.argv.slice(2).length ? process.argv.slice(2) : ['title', 'day', 'night', 'battle', 'boss', 'victory', 'lose', 'evolve', 'hof'];
const rows = await p.evaluate(async (tracks) => {
  const A = window.__audio;
  A.unlockAudio();
  const an = A.debugTap();
  const out = [];
  for (const t of tracks) {
    A.music(t);
    await new Promise((r) => setTimeout(r, 900));
    const buf = new Float32Array(an.fftSize);
    const spec = new Float32Array(an.frequencyBinCount);
    let peak = 0; let sum = 0; let n = 0; let cen = 0; let cw = 0;
    const t0 = performance.now();
    while (performance.now() - t0 < 5000) {
      an.getFloatTimeDomainData(buf);
      for (const v of buf) { peak = Math.max(peak, Math.abs(v)); sum += v * v; n++; }
      an.getFloatFrequencyData(spec);
      spec.forEach((db, i) => { const m = 10 ** (db / 20); cen += m * i; cw += m; });
      await new Promise((r) => setTimeout(r, 50));
    }
    const hz = (cen / cw) * (an.context.sampleRate / an.fftSize);
    out.push({ track: t, rmsDb: +(10 * Math.log10(sum / n)).toFixed(1), peak: +peak.toFixed(3), centroidHz: Math.round(hz) });
  }
  A.music(null);
  return out;
}, tracks);
console.table(rows);
console.log(errors.length ? `ERRORS: ${errors.join('\n')}` : 'no page errors');
await b.close();
