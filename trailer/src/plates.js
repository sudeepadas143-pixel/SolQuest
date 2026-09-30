// Captured game plates: one PNG per real game frame (capture/capture.mjs).
// Looks frames up by source time and keeps a small LRU of GPU textures.
import * as THREE from 'three';

export class PlateBank {
  constructor({ max = 72 } = {}) {
    this.max = max;
    this.cache = new Map();      // key -> Promise<Texture>
    this.ready = new Map();      // key -> Texture (decoded)
  }

  async init() {
    this.manifest = await (await fetch('/plates/manifest.json')).json();
    [this.w, this.h] = this.manifest.size;
  }

  /** Nearest frame of `plate` to source time `src` (seconds). */
  index(plate, src) {
    const fr = this.manifest.plates[plate].frames;
    const ms = src * 1000;
    let lo = 0;
    let hi = fr.length - 1;
    if (ms <= fr[0]) return 0;
    if (ms >= fr[hi]) return hi;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (fr[mid] <= ms) lo = mid; else hi = mid;
    }
    return ms - fr[lo] <= fr[hi] - ms ? lo : hi;
  }

  events(plate) { return this.manifest.plates[plate].events ?? []; }

  key(plate, i) { return `${plate}/${String(i).padStart(4, '0')}`; }

  load(plate, i) {
    const k = this.key(plate, i);
    if (this.cache.has(k)) {
      const p = this.cache.get(k);
      this.cache.delete(k);
      this.cache.set(k, p);
      return p;
    }
    const p = new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const tex = new THREE.Texture(img);
        tex.minFilter = THREE.LinearFilter;
        tex.magFilter = THREE.LinearFilter;
        tex.generateMipmaps = false;
        tex.colorSpace = THREE.NoColorSpace;
        tex.needsUpdate = true;
        this.ready.set(k, tex);
        resolve(tex);
      };
      img.onerror = () => reject(new Error(`plate frame missing: ${k}`));
      img.src = `/plates/${k}.png`;
    });
    this.cache.set(k, p);
    while (this.cache.size > this.max) {
      const old = this.cache.keys().next().value;
      this.ready.get(old)?.dispose();
      this.ready.delete(old);
      this.cache.delete(old);
    }
    return p;
  }

  /** Decoded texture now, or the closest decoded neighbour (live preview). */
  peek(plate, i) {
    const exact = this.ready.get(this.key(plate, i));
    if (exact) return exact;
    this.load(plate, i).catch(() => {});
    for (let d = 1; d < 12; d++) {
      const a = this.ready.get(this.key(plate, i - d)) ?? this.ready.get(this.key(plate, i + d));
      if (a) return a;
    }
    return null;
  }
}
