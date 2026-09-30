// Renders the soundtrack offline (game SFX + music + sound design) to out/audio.wav
// (CUT=ten: out/audio-ten.wav).
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { OUT, server, page } from './common.mjs';
import { CUT, CUTS } from '../src/cut.js';

export async function renderAudioFile() {
  const { browser, page: p } = await page();
  const { b64, report } = await p.evaluate(() => window.__trailer.renderAudio());
  await browser.close();
  mkdirSync(OUT, { recursive: true });
  const file = path.join(OUT, CUTS[CUT].audio);
  writeFileSync(file, Buffer.from(b64, 'base64'));
  return { file, report };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const stop = await server();
  try {
    const { file, report } = await renderAudioFile();
    console.log(file);
    console.log(JSON.stringify(report, null, 2));
  } finally {
    stop();
  }
}
