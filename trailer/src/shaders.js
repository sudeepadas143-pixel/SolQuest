// GLSL for the compositor. Everything is a function of uniforms that the
// timeline sets per frame, so every frame renders the same every time.

// Pixel-art sampling. At the base 2x zoom (and any integer zoom on the pixel
// grid) this is exactly nearest-neighbour: each game pixel is a hard square.
// During push-ins the zoom is fractional; texel edges then get a 1-screen-pixel
// blend instead of some pixels snapping a whole pixel wider ("pixel crawl").
const SHARP = /* glsl */`
  vec4 sharp(sampler2D tex, vec2 size, vec2 p) {
    if (p.x < 0.0 || p.y < 0.0 || p.x > size.x || p.y > size.y) return vec4(0.0, 0.0, 0.0, 1.0);
    vec2 seam = floor(p + 0.5);
    vec2 dudv = max(fwidth(p), vec2(1e-4));
    vec2 q = seam + clamp((p - seam) / dudv, -0.5, 0.5);
    return texture2D(tex, vec2(q.x / size.x, 1.0 - q.y / size.y));
  }
`;

const GRADE = /* glsl */`
  uniform float uDuo;       // 0 none, 1 violet duotone, 2 mint duotone
  uniform float uInvert;
  uniform float uBright;
  vec3 grade(vec3 c) {
    if (uDuo > 0.5) {
      float l = dot(c, vec3(0.299, 0.587, 0.114));
      vec3 lo = uDuo < 1.5 ? vec3(0.071, 0.086, 0.227) : vec3(0.043, 0.055, 0.141);
      vec3 mid = uDuo < 1.5 ? vec3(0.545, 0.361, 1.0) : vec3(0.180, 0.949, 0.659);
      vec3 hi = vec3(1.0, 0.969, 0.902);
      c = l < 0.5 ? mix(lo, mid, l * 2.0) : mix(mid, hi, (l - 0.5) * 2.0);
    }
    c = mix(c, 1.0 - c, uInvert);
    return c * uBright;
  }
`;

export const plateVert = /* glsl */`
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;

/** Full-screen plate seen through the trailer camera. */
export const plateCamFrag = /* glsl */`
  uniform sampler2D uTex;
  uniform vec2 uSize;        // plate size in game pixels (960 x 640)
  uniform vec2 uCenter;      // game pixel at the centre of the screen
  uniform float uZoom;       // screen pixels per game pixel
  uniform vec2 uOffset;      // whip-pan offset, screen px
  uniform vec2 uBlur;        // motion blur vector, screen px
  uniform vec2 uRes;
  ${SHARP}
  ${GRADE}
  void main() {
    vec2 s = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
    vec2 p = uCenter + (s - uRes * 0.5 - uOffset) / uZoom;
    vec4 c = vec4(0.0);
    if (dot(uBlur, uBlur) < 1.0) c = sharp(uTex, uSize, p);
    else {
      for (int i = 0; i < 12; i++) {
        float k = float(i) / 11.0 - 0.5;
        c += sharp(uTex, uSize, p + uBlur * k / uZoom);
      }
      c /= 12.0;
    }
    gl_FragColor = vec4(grade(c.rgb), 1.0);
  }
`;

/** A rectangle of a plate mapped onto a quad (HUD lifted out as a graphic, the logo). */
export const plateRectFrag = /* glsl */`
  uniform sampler2D uTex;
  uniform vec2 uSize;
  uniform vec4 uSrc;         // x, y, w, h in game pixels
  uniform float uAlpha;
  varying vec2 vUv;
  ${SHARP}
  ${GRADE}
  void main() {
    vec2 p = uSrc.xy + vec2(vUv.x, 1.0 - vUv.y) * uSrc.zw;
    vec4 c = sharp(uTex, uSize, p);
    gl_FragColor = vec4(grade(c.rgb), uAlpha);
  }
`;

/** A sprite as a dark silhouette with a 1-pixel violet rim (the unannounced bosses). */
export const silhouetteFrag = /* glsl */`
  uniform sampler2D uTex;
  uniform vec2 uSize;
  uniform float uAlpha;
  uniform vec3 uBody;
  uniform vec3 uRim;
  uniform float uStep;       // texels per game pixel (trainers 3, creature fronts 2)
  varying vec2 vUv;
  float A(vec2 p) {
    if (p.x < 0.0 || p.y < 0.0 || p.x >= uSize.x || p.y >= uSize.y) return 0.0;
    return texture2D(uTex, (floor(p) + 0.5) / uSize).a;
  }
  void main() {
    vec2 p = floor(vUv * uSize);
    float a = A(p);
    vec2 dx = vec2(uStep, 0.0);
    vec2 dy = vec2(0.0, uStep);
    float ring = max(max(A(p + dx), A(p - dx)), max(A(p + dy), A(p - dy)));
    if (a > 0.5) {
      float edge = 1.0 - min(min(A(p + dx), A(p - dx)), min(A(p + dy), A(p - dy)));
      gl_FragColor = vec4(mix(uBody, uRim, step(0.5, edge)), uAlpha);
    } else if (ring > 0.5) {
      gl_FragColor = vec4(uRim * 0.55, uAlpha * 0.55);
    } else discard;
  }
`;

/** Bloom only on gold / warm highlights (coins, gold UI, flames), plus an
 *  "all bright pixels" mode for the logo's glow on the end card. Drop-in
 *  replacement for UnrealBloomPass's luminosity high-pass. */
export const goldHighPassFrag = /* glsl */`
  uniform sampler2D tDiffuse;
  uniform vec3 defaultColor;
  uniform float defaultOpacity;
  uniform float luminosityThreshold;
  uniform float smoothWidth;
  uniform float uAll;
  varying vec2 vUv;
  void main() {
    vec4 t = texture2D(tDiffuse, vUv);
    vec3 c = t.rgb;
    float lum = dot(c, vec3(0.299, 0.587, 0.114));
    float warm = smoothstep(0.10, 0.34, min(c.r, c.g) - c.b) * smoothstep(0.62, 0.86, c.r);
    float bright = smoothstep(luminosityThreshold, luminosityThreshold + smoothWidth, lum);
    float m = max(warm * smoothstep(0.35, 0.7, lum), uAll * bright);
    gl_FragColor = mix(vec4(defaultColor, defaultOpacity), vec4(c, 1.0), m);
  }
`;

/** Glitch wipe from the previous shot to the new one, in random blocks. */
export const wipeFrag = /* glsl */`
  uniform sampler2D tDiffuse;
  uniform sampler2D tPrev;
  uniform float uP;
  uniform float uSeed;
  varying vec2 vUv;
  float h(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233)) + uSeed) * 43758.5453); }
  void main() {
    vec2 cell = floor(vUv * vec2(12.0, 7.0));
    vec2 fine = floor(vUv * vec2(48.0, 27.0));
    float r = mix(h(cell), h(fine), 0.35);
    float band = h(vec2(floor(vUv.y * 40.0), 7.0));
    vec2 uv = vUv + vec2((band - 0.5) * 0.08 * (1.0 - uP), 0.0);
    vec4 a = texture2D(tPrev, uv);
    vec4 b = texture2D(tDiffuse, vUv);
    vec4 bs = vec4(texture2D(tDiffuse, vUv + vec2(0.012, 0.0)).r, b.g, texture2D(tDiffuse, vUv - vec2(0.012, 0.0)).b, 1.0);
    gl_FragColor = r < uP ? mix(bs, b, uP) : a;
  }
`;

/** Final pass: shake (with a hair of zoom so no edges show), RGB split, the
 *  glitch (band shifts, block tears, channel swaps), light CRT scanlines,
 *  vignette, white flash, fade to black. */
export const fxFrag = /* glsl */`
  uniform sampler2D tDiffuse;
  uniform vec2 uRes;
  uniform vec2 uShake;       // px
  uniform float uZoomPad;    // zoom so shake never shows an edge
  uniform float uRGB;
  uniform float uGlitch;
  uniform float uFrame;
  uniform float uFlash;
  uniform float uFade;
  uniform float uScan;
  varying vec2 vUv;
  float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7)) + uFrame * 17.13) * 43758.5453); }
  void main() {
    vec2 uv = (vUv - 0.5) / uZoomPad + 0.5 - uShake / uRes;
    // glitch: horizontal bands slide, some blocks tear further
    if (uGlitch > 0.001) {
      float by = floor(uv.y * mix(24.0, 70.0, h(vec2(uFrame, 3.0))));
      float r = h(vec2(by, 1.0));
      if (r < uGlitch * 0.55) uv.x += (h(vec2(by, 2.0)) - 0.5) * 0.22 * uGlitch;
      vec2 blk = floor(uv * vec2(16.0, 9.0));
      if (h(blk + 5.0) < uGlitch * 0.18) uv += (vec2(h(blk), h(blk + 1.0)) - 0.5) * 0.06;
    }
    vec2 dir = vec2(1.0, 0.18) * (uRGB * 7.0 + uGlitch * 12.0) / uRes;
    vec3 c = vec3(texture2D(tDiffuse, uv + dir).r, texture2D(tDiffuse, uv).g, texture2D(tDiffuse, uv - dir).b);
    if (uGlitch > 0.001) {
      vec2 blk = floor(uv * vec2(24.0, 14.0));
      float k = h(blk + 9.0);
      if (k < uGlitch * 0.10) c = c.brg;
      else if (k < uGlitch * 0.13) c = mix(c, 1.0 - c, 0.6);
    }
    // light CRT: every third line a touch darker, soft vignette
    float line = mod(floor(gl_FragCoord.y), 3.0) < 1.0 ? 1.0 - uScan : 1.0;
    vec2 d = vUv - 0.5;
    float vig = 1.0 - dot(d, d) * 0.55;
    c *= line * vig;
    c = mix(c, vec3(1.0), clamp(uFlash, 0.0, 1.0) * 0.85);
    c *= 1.0 - clamp(uFade, 0.0, 1.0);
    gl_FragColor = vec4(c, 1.0);
  }
`;
