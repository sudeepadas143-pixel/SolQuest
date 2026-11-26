# itshoss.fun — how it works

A full read of the site's code. Line numbers point at `src/script-2.js` (the main scene) unless another file is named.
Everything is one HTML page: plain three.js r170 from a CDN, no framework, no build step, no bundler.

The site is a Solana memecoin landing page ("HONK", a horse in a beat-up hatchback being chased by a police car).
`src/script-1.js` only fills in the token links (X, Pump.fun buy button, DexScreener chart, contract address with Copy).

---

## 1. The visitor's journey

1. **Loading gate** — full-screen "CRT glass" (a tiny raw-WebGL shader, not three.js) with a flickering amber
   `LOADING` → `ENTER` word. Shows for at least 2.6 s even if everything loaded. (L257–286, L1283–1290)
2. **TV room intro** (a separate three.js scene) — clicking ENTER starts *inside* a CRT TV screen; the camera pulls
   back 4.5 s to reveal HONK lounging on a sofa in a dark room. The TV shows a **live feed of the highway scene**
   rendered from a helicopter angle. A second ENTER button appears. (L717–998)
3. Second ENTER → music starts → HONK turns his head to the TV → lightning bolts jump from the screen to his head,
   snacks blow off the table, sofa and table get shoved → he's yanked off the sofa, flies head-first and is
   **sucked through the glass** → white flash radiates out of the screen. (L951–998)
4. **The drive** — lands on the highway through a chromatic CRT glitch. HONK drives at 95 km/h, chased by a cop car
   with flashing lightbar, traffic in both directions. Three camera "stations": **Home / About / Memes**,
   switched by nav buttons, scroll wheel, arrow keys, 1–3, or swipes. (L384–440)
5. **Memes** — the car fires **jet flames from the exhaust**, rockets away from the cop, flash cut to the **sky**,
   it climbs through clouds and a spinning card carousel of 15 meme images appears. (L442–669)

Debug URL flags baked in: `?raw` (no post-processing), `?dbg` (depth/blur debug view), `?hold` (freeze time),
`?shot=0|1|2` (skip intro, jump to a station), `?tv=<seconds>` (jump into the TV intro timeline).
`window.__honk` exposes almost every internal for console poking (L1329).

---

## 2. The "infinite highway" trick

The car **never moves**. It sits at the origin facing +X and the world scrolls past it. (L140–204, L424–440)

- **Road and ground** are single static planes; only their *texture offset* scrolls (`roadTex.offset.x = dist/12`).
  Seamless forever, zero geometry changes.
- **Roadside** (buildings, palms, lamp posts, power lines, sign gantries) is 6 procedurally generated 60 m tiles
  (360 m loop). Each frame, `wrapX()` moves each tile; when one falls 210 m behind it jumps to the front.
- **No pop-in**: the fog ends at 148 m, before the wrap point. Crucially they **replaced three.js's fog shader
  chunk** (L35–52) so fog fades to the *exact same sky function* as the sky dome (sun glow included). Anything fully
  fogged is pixel-identical to the sky behind it, so wrapping is invisible.
- **Traffic**: 20 cars from one GLB, 5 lanes, one speed per lane (so cars never overlap), the oncoming carriageway
  has negative speed. Position = `(carSpeed − HONK's speed) × t`, wrapped with the same loop. One DeLorean in the
  overtaking lane passes about every 90 s. (L228–314)
- **Cop car** doesn't follow physics: its distance and weave are sums of slow sines (L430–432); nose yaw is the
  derivative of the weave so it steers into its own motion. Lightbar = two boxes toggled in a double-flash pattern.
- **Wheels spin** from distance travelled: `angle = distance / radius`, axle found from the wheel's world
  orientation at load. (L214–220, L434)
- **Suspension**: car y / roll / pitch are three sines at unrelated frequencies (11.3, 17.9, 2.1 Hz…) — reads as
  road vibration. The camera rides 70% of it. (L436–437, L1235)

**Draw-call economy** (L106–138): every procedural tile is built with a `bag()` helper that bakes each
box/cylinder's colour into vertex colours, applies its transform, and merges everything sharing a material into one
mesh. A whole 60 m tile of hundreds of boxes is ~5 draw calls.

**Textures are drawn on tiny canvases** at load (L61–104): road 48×104 px, facades 16×32, palm fronds 32×8, sign
32×18, all `NearestFilter` → the chunky PS2 look, no image files needed. A seeded RNG (`seed = 101 + i*37`) makes
each tile different but identical on every visit.

---

## 3. Camera system

- **Stations** (L385–389): each is `{pos, look, fov, ap (aperture/blur strength), bloom, par (mouse parallax)}`.
  `lookOf()` shifts the aim point by screen aspect so the About card has room on wide screens and the subject is
  centred on portrait phones.
- **Travel between stations** (L396–421): a *quadratic Bézier* through a midpoint lifted by 22% of the distance
  (the camera arcs up and over), cubic ease-in-out, FOV bulges +6° mid-move, slight roll. 2.6 s, or 0.9 s into Memes.
  An 800 ms lock stops scroll-wheel spam.
- **Every frame** (L1228–1240): mouse parallax, tiny idle wobble, suspension follow, portrait mode widens FOV ×1.45
  and pulls back 12%.
- `prefers-reduced-motion` turns off bounce, wobble, parallax and travel (jumps instantly).

---

## 4. Character animation (HONK)

`honk.glb` is a rigged Meshy-generated character with clips **Idle, Walk, Run, Float, Sit, Remote, Yank, Panic,
SitPose**. Only **Idle, Sit, Yank, Panic** are actually used. The interesting part is how much is layered *on top*
of the clips procedurally, every frame, after the mixer runs (order at L1274):

| Layer | What it does | Where |
|---|---|---|
| `poseBase` | Restores the clean clip pose before the mixer, snapshots after. Needed because three's mixer skips writing unchanged bones, so additive offsets would accumulate. **Key trick if you do procedural layers.** | L1106–1113 |
| Seated IK (car) | Pins hips, two-bone IK puts feet on the pedals and **wrists on the steering wheel at 10 and 2**. The wheel itself wiggles (small steering corrections) and the hands follow. | L671–715 |
| Hover pop-out | Hover/tap HONK's head → he half-stands and leans out the driver's window (spine/neck/head rotations, eased). Hit test uses the *seated* head position so it doesn't flicker. | L687–705 |
| Neck spring | Head is a damped spring driven by the hips' vertical **acceleration** (from the suspension). Semi-implicit Euler, 4 substeps, `tanh` soft clamp. Gives a natural bobble. | L1000–1019 |
| Look-at | Neck + head turn toward the camera, nudged by the mouse, clamped, smoothed; ignores targets behind him. | L1115–1133 |
| Blink | The mesh has **no eyelids**. A shader patch (`onBeforeCompile`) paints a fur-coloured lid over each eye in bind-pose space, sweeping top→bottom with a lash line. Random interval 2–5.5 s, 20% chance of double blink. | L1021–1045 |
| Sofa IK (TV room) | Fixes the Meshy sit clip (thighs sank into the cushion): feet planted on the floor, torso aimed upright, slow breathing, weight shift, wandering head, right arm draped on the sofa arm, left hand on knee or raising the remote. `orientHand` builds a rotation from finger + back-of-hand vectors. | L882–938 |

Two IK solvers exist: `ik2` (L676) and `twoBone` with a blend weight (L891). Both are the classic law-of-cosines
two-bone solve with a pole vector.

---

## 5. TV-room intro in detail (L717–998)

- **Phases** (`TVI.ph`): `pull` → `wait` → `face` → `zap` → `fly` → `into` → `endTV()`.
  (`video`, `swing`, `remote`, `wide` exist from an earlier version with an opening video; the `<video>` element
  has no source now.)
- **Camera keys** `TK` (L796–805): named shots (`scr`, `back`, `zapB`, `pushB`…) blended with `camTo(key, dur)`.
- **The CRT screen** is its own shader plane (L728–747): barrel bulge, scanlines, tube vignette, TV static
  (hashed noise), blinking red LIVE dot, a vertex-displacement ripple and orange glow when he's being pulled in,
  and a white flash. Its texture is a **320×240 render target of the highway scene** from a circling helicopter
  camera (L824–829) — the TV literally shows the next scene, live.
- **Lightning**: three `TubeGeometry` bolts along jittered CatmullRom curves from random points on the screen to
  his head, rebuilt every 50–110 ms, additive orange, plus a flickering point light. (L783–793)
- **Blast physics**: snacks get random velocity + spin, gravity, floor bounce with damping; sofa/table slide with
  ease-out. (L939–950)
- **Through the glass**: his hips follow an arc to the screen while he pitches head-first; then a **clipping plane
  at the glass** (`R.localClippingEnabled`) cuts away everything that passes behind it, so he really disappears
  *into* the TV. Pillow and remote get sucked in after him. (L977–990)
- **Exit flash**: a CSS radial gradient positioned at the screen's projected position, radius growing to 160 vmax,
  then the post shader's glitch uniform takes over on the highway. (L991–995, L871)
- The room is mostly darkness: walls are invisible planes, black fog from 4.8–8.5 m, lit by TV glow (flickering
  blue), a warm lamp and a blue "moon" light.

---

## 6. Memes gallery: jet boost → sky (L442–669)

Timeline on `GAL.t` (seconds):

- **0–0.4** flames ignite. Each exhaust tip has an orange outer cone + blue-white core, additive. Each cone's
  length is an **underdamped spring kicked to a random target every 50–130 ms** → elastic, living flame.
- **0.6–2.2** car accelerates out of frame (`x = 46·b^2.2`), nose lifts, cop falls behind.
- **2.2** white flash, hide road/traffic/cop, show clouds, swap to a bluer horizon, cut to a high chase camera.
- **2.2–3.8** car climbs up through the clouds to centre, then bobs, surges, banks.
- **4.4–5.2** car eases to the right third; carousel slides in on the left (centre-bottom in portrait).

**Particles** (L523–586): three instanced billboard systems, one draw call each — fire (white-blue → orange → red),
sparks (gravity, white-hot streaks) and smoke (billowing, slows into the airflow, drifts up, back-to-front sorted).
The vertex shader **stretches each quad along its velocity** (`uStretch`) for motion streaks. Spawn rates use
accumulators so they're frame-rate independent.

**Clouds** (L488–522): ~500 camera-facing puffs from one 128 px canvas texture (overlapping radial gradients), one
instanced draw call, grouped into 40 clouds (flat-ish base, domed top, lit top / blue-grey underside), kept out of
a corridor around the car, re-sorted far-to-near every frame, faded at the wrap edges.

**Carousel**: a single box with a meme on each face. Next/prev loads the *hidden* face and spins the card 180°
(PS1 inventory turn), with a small pop and an idle rock. On hover a crisp `<img>` is positioned exactly over the
card's projected screen rect, because the 3D render is deliberately low-res. Textures load lazily, neighbours
prefetched. ← → keys / swipe / silver spinning cone arrows (real `<button>`s positioned over them).

---

## 7. Rendering pipeline and the PS2 look (L1135–1261)

- **Low internal resolution** (L1213–1222): pixel ratio chosen so the short side is ~520 px (and ≤ 2.4 MP), then
  upscaled by CSS `image-rendering: pixelated`. No antialiasing. This is most of the retro feel.
- **Nearest-filtered textures** everywhere, including the GLB models' textures (`prepCar`, `px()`).
- **Custom post chain**, no EffectComposer:
  1. Scene → half-float render target with a depth texture.
  2. **Depth of field**: golden-angle disc gather, 48 taps (24 on mobile), circle of confusion from linear depth,
     bright pixels weighted up (bokeh). Focus smoothly tracks HONK's head; in the TV room it pulls to whatever the
     cursor hovers (raycast).
  3. **Bloom**: bright-pass → quarter-res → 4 separable Gaussian passes.
  4. **Composite**: chromatic aberration, bloom add, warm **anamorphic streaks** off bright bulbs, **ACES tonemap
     blended 55/45 with a luminance-preserving version** ("per-channel alone turns brown fur red"), slight
     desaturate + contrast, cool shadows, vignette. Plus two effect modes: **CRT glitch** (rows tearing sideways,
     prism split, scanlines — on landing from the TV) and **speed vignette** (radial zoom blur with chromatic split
     and flickering rainbow streaks — in the gallery).
- Sky dome: gradient + sun glow + hot sun disc that the bloom catches. Lighting: hemisphere + one shadow-casting sun.

---

## 8. Sound (L835–1104)

Almost all of it is **synthesized with Web Audio** — only three files are used:

| Sound | How |
|---|---|
| Engine drone | 44 Hz sawtooth, LFO wobbling the pitch, low-passed at 160 Hz |
| Road roar | 2 s of generated **brown noise**, looped, low-passed |
| Siren | `sfx/siren.mp3` looped (padding trimmed to avoid a click); volume rises as the cop closes in, silent in the sky |
| Horns | `sfx/horns.mp3` is **7 horns in 3 s slots**; one random slot every 4–13 s, random pitch, volume and stereo pan |
| Zap | Sub thump + 118 Hz buzz + hundreds of tiny high-passed noise bursts (arcs) |
| Whoosh / suction | Band-pass sweep on noise; falling triangle tone + bright noise hit |
| NOS jet | Low-passed noise roar + band-passed hiss with a 23 Hz square-wave flutter (crackle) + ignition thump; gain follows the flame |
| Music | `sfx/bgm.mp3` through a gain node with a 1 s fade-in, starts on the second ENTER |

Audio context is created on the first click (browser autoplay rules). Tab hidden → render loop and audio suspend.

---

## 9. UI / CSS (src/styles.css)

- **PSX menu buttons**: dithered navy (`repeating-conic-gradient` 4×4 checker = PS1 15-bit dither), stepped
  pixel corners via `clip-path` polygon, chunky inset bevel via `box-shadow`, *Press Start 2P* font.
- **About card**: same style, perspective tilt `rotateY(-9deg)`, CRT lines, and a `psxj` keyframe that nudges it
  1 px at odd times = **PS1 vertex-snapping wobble**. Transitions use `steps()` so they move in choppy frames.
- **Title** gradient-filled with `background-clip:text` in the custom Honk font.
- **Film grain**: a 160 px random-noise canvas as a background, jumping position with `steps(5)`, overlay blend.
- **Scroll hint**: mouse icon with wheel dot (desktop) / phone with finger swipe (touch), hidden after first nav.
- Keyframes: `g` (grain), `wheel`/`nudge`/`nudgeup`/`swipe` (scroll hint), `crtflick` (gate title), `psxj` (card
  wobble), `blink` (▶ cursor), `flash` (white cut).

---

## 10. Techniques worth stealing

1. Scroll the world, not the camera — static planes with scrolling textures + wrapped tiles.
2. Make fog and sky the same function so wrapped objects never pop.
3. Bake colours into vertices and merge per material for procedural scenery.
4. Generate tiny textures on canvas at load instead of shipping images.
5. Low internal resolution + nearest filtering + `steps()` CSS = instant retro.
6. Layer procedural motion (springs, IK, look-at, blink) on top of a few clips — and reset the base pose each frame.
7. Fake eyelids in a shader instead of re-rigging.
8. Render one scene into a texture and show it on a TV in another scene.
9. Clipping plane to make something go *through* a surface.
10. Instanced billboards with velocity stretch for cheap fire/smoke/sparks.
11. Synthesize SFX with Web Audio; pack several samples into one file with fixed slots.
