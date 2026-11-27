# walkingspaz.fun — how it's built (observed)

Notes from viewing the live site in a headless browser on 2026-11-27: screenshots, clicks on the 3D scene, the list of
files it loads, and which libraries its script bundle contains. Nothing from the site (code, models, images, audio) was
saved into this repo. The server sends automated tools (curl, and the stylesheet request from a headless browser) a decoy
page that says "Scraped copy. Taken without permission." That block was left alone, so the site's own CSS never loaded
in these captures; the canvas was resized to full screen in the viewer to see the 3D.

## Stack
- **Vite** build: one `index-*.js` bundle (~940 KB) + one `index-*.css`.
- **three.js r187**, **WebGL 2**, `antialias: false`, `powerPreference: "high-performance"`, alpha canvas, one canvas
  (`.webgl-canvas`) filling the screen.
- **React** for the DOM layer (accessible buttons, sound toggle, footer pill). The 3D world is plain three.js, not
  react-three-fiber.
- Loaders bundled: **GLTFLoader** with **Draco**, **meshopt** and **KTX2** support.
- Effects via **three's own EffectComposer / RenderPass** (not pmndrs `postprocessing`). The look on screen: CRT
  scanlines, a soft vignette, a little chromatic fringing, low-res crunchy edges (antialias off).
- Materials seen in the bundle: **MeshToonMaterial**, **MeshMatcapMaterial**, **ShaderMaterial** (the portal), **Sprites**
  and **Points** (stars, specks), **Fog**.
- Interaction: **Raycaster** on 3D props. Every 3D button also has a visually hidden HTML `<button>` with an
  `aria-label` ("Enter selected tape through the portal", "Enter gallery story room", ...), so it stays usable with a
  keyboard and a screen reader.
- Fonts: **Cormorant Garamond** (serif, italic) + **DM Mono** (labels).

## Assets it loads
| file | size | role |
|---|---|---|
| `models/spaz.glb` | 1.75 MB | the character (one GLB) |
| `spaz-title.png` | 1.2 MB | the bubbly "SPAZ" logo (a 2D image in the 3D scene, not geometry) |
| `spaz-head.png` | 1.3 MB | head art (favicon / UI) |
| `art/gallery/gallery-01.png` … | ~2 MB each | gallery story paintings |
| `art/spaz-gallery-viewer.png`, `art/pink-visitor.png` | ~0.9 MB | gallery / party room art |
| `dexscreener-logo.webp` | 4 KB | chart prop |

The PNGs are large and not compressed; the first screen pulls ~7 MB.

## Flow
1. **Intro: the fall.** Flat blue void; Spaz tumbles toward a big black square slab (a hole / portal plate). The camera
   chases him down and he drops *into* the square. Hidden text: "SPAZ IS FALLING TOWARD THE BLACK SQUARE".
2. **Hub: "came through the other side".** A night valley with low-poly pink hills, dark cone trees, salmon stairs, an
   orange door frame, floating glossy spheres, a starry purple-black sky. Centre stage: a **round portal**, a ShaderMaterial
   of concentric rainbow rings around a pulsing five-point star, framed by glossy candy tubes (pink / orange / blue).
   The "SPAZ" logo floats top-left. Spaz stands beside the portal, waving. In front of him, a row of **3D props that are
   the menu**, each with a tiny label under it:
   - orange ball **ENTER**: picks the current "tape"
   - blue knot: **X** (opens x.com in a new tab)
   - orange donut **GALLERY**: gallery story room
   - eagle tile **CHART**: chart room
   - green/white pill **BUY**: opens the buy site in a new tab
   - a 3D **contract panel** under them (`CA / 5eMdZT…pump` + a copy button)
3. **"Tapes"** (story chapters): *the unfinished party*, *flight*, *green-room*; "Enter selected tape through the portal"
   takes you to that room.
4. **Party room** ("THE PARTY THAT NEVER STARTED"): checkerboard dance floor, black silhouette chairs and guests, floating
   balloons, coloured cassette-like blocks on the walls, a TV with Spaz's face, a pink disc. Over-the-shoulder camera with
   Spaz in the foreground. "BACK" in the corner.
5. **Gallery story room**: a warm yellow office corridor with ceiling light strips and pillars; a painting in a window
   frame; Spaz sits in the left foreground; three **3D arcade buttons** (yellow / red / yellow) are PREV / BACK / NEXT.
   "Gallery story 1 of 8".
6. **Chart room**: dark pink room with a big screen (the chart embed), Spaz's foot in the corner, "BACK".
7. Always on: a glossy pink **sound button** top right (head-shaped, "SOUND ON"), and a footer pill in DM Mono: "ALL FEES
   WILL BE DONATED TO AUTISM CHARITIES".

## Ideas worth taking (as techniques, not their art)
- **The menu is in the world.** Props are the buttons (label under each, hover lift, raycast click) and each one has a
  hidden HTML twin for keyboard and screen readers. HOSS and Sniffer use HTML buttons over the 3D instead.
- **Rooms per section** instead of camera stations on one road: each nav item is a whole little set with its own
  lighting and palette.
- **A portal shader** as the centrepiece: animated concentric rings around a star, framed by glossy tubes.
- **Story chapters ("tapes")** that change what's behind the portal.
- **Over-the-shoulder foreground character** in rooms: a big, partly cropped character in the corner gives depth and scale.
- **CRT finish** done with three's EffectComposer (scanlines + vignette + light fringing) over a non-antialiased render.

## What it does less well
- ~7 MB of uncompressed PNGs on first load (the GLB is fine at 1.75 MB).
- Labels under the props are tiny at desktop size and unreadable on phones.
- The ENTER ball, door and stairs gave no visible response to a click.
