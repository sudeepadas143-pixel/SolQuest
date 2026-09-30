// Headless render entry: render/render.mjs drives this page frame by frame.
import { Trailer } from './compositor.js';

const trailer = new Trailer(document.getElementById('c'));
window.__trailer = {
  ready: trailer.init().then(() => true),
  renderAt: (t) => trailer.renderAt(t, { wait: true }),
  async renderAudio() {
    const { renderAudio } = await import('./audio/render.js');
    const { wav, report } = await renderAudio();
    let s = '';
    const u = new Uint8Array(wav);
    for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
    return { b64: btoa(s), report };
  },
};
