# itshoss.fun — reference snapshot (2026-11-26)

Mirror of https://itshoss.fun/ for study. Serve with `python3 -m http.server` from this folder
(three.js 0.170.0 loads from cdn.jsdelivr.net through the importmap in index.html).

## Layout
- `index.html` — the whole site: one HTML file with inline CSS and two inline module scripts.
- `src/styles.css`, `src/script-1.js`, `src/script-2.js` — the inline code split out for reading
  (the main Three.js scene / game logic is `script-2.js`).
- `*.glb` — vehicles (delorean, golfcart, murphy, urban car pack) and the `honk` character.
- `tv/` — TV-room intro scene (room, rug, floor texture, food/soda/cash props).
- `memes/` — 15 caption images (896px webp).
- `sfx/` — bgm, horns, siren. `fonts/honkfont.otf` — custom display font.

## Animations
- **Skeletal (baked in GLB):** `honk.glb` has the clips Idle, Walk, Run, Float, Sit, Remote, Yank, Panic, SitPose
  (played with THREE.AnimationMixer in script-2.js).
- **Procedural:** everything else (vehicles, camera, TV intro) is animated in code in script-2.js.
- **CSS @keyframes:** g, wheel, nudge, nudgeup, swipe, crtflick, psxj, blink, flash (in styles.css).
- GLBs use EXT_meshopt_compression, so load them with GLTFLoader + MeshoptDecoder.

## Licensing
The 3D models are third-party Sketchfab assets (credits/CC BY 4.0 links are in index.html), sounds are
Pixabay-licensed, and the art/font belong to the site's author. Treat this as reference only; don't ship
these assets without checking their licenses.
