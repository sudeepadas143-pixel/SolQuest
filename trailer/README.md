# SolQuest trailer (30 s, 16:9)

Self-contained Vite app that builds the trailer from the game's own renderer,
sprites, UI skin, font and sound. The game code is not modified; the trailer
reads `../public` (as `/assets`) and `../src` (as `@game`).

## Commands

```bash
npm install
npm run capture   # real game plates -> plates/ (needs the game dev server on :5173)
node capture/teaser.mjs   # the teaser's plates: world, look scene, bosses, the Hall
npm run dev       # preview page on http://127.0.0.1:5174  (space, R replay, T timecode, scrub, record)
npm run render    # frame-by-frame 1920x1080 / 30 fps + offline audio -> solquest-trailer.mp4
npm run check     # beat grid, duration, frames, true peak, pre-drop gap, flashes, stills -> out/
npm run render:10 # the 10-second cut -> solquest-teaser-10s.mp4
npm run check:10
```

Two cuts share one engine (`src/cut.js`, `src/cuts/`): `full` (30 s) and
`ten` (10 s). Pick one with `CUT=ten` in Node, or `?cut=ten` on the preview
page (http://127.0.0.1:5174/?cut=ten).

`render` starts its own Vite server if none is running. Set `FFMPEG=` or
`CHROMIUM=` to override the binaries. `node render/render.mjs --from 12 --to 16 --out out/part.mp4`
renders a slice.

## How it's built

- **Grid.** 140 bpm (beat 0.4286 s, bar 1.714 s). Every shot, caption and
  sound-design cue is placed on it in `src/timeline.js` with `T(bar, beat, 16th)`.
- **Edit.** A teaser, built on the world, the character and the bosses:

  | Time | What's on screen |
  |---|---|
  | 0-3.4 s | drone flyover of the whole route, morning to night |
  | 3.4-6.9 s | Market Square, Willow Pond, the windmill, the route in the rain |
  | 6.9-9.4 s | the look scene: the portrait shrinks into the overworld sprite |
  | 9.4-12 s | three Elites' VS screens (names hidden) |
  | 12-15.4 s | Ansem's VS screen, the hit, 0.32 s of black and silence |
  | 15.4-18 s | the slow-motion knockout |
  | 18-20.6 s | leaderboard and pool |
  | 20.6-24.9 s | the Elite Hall: outside at night, the brazier walk, the flare |
  | 24.9-26.6 s | the final Elite's VS screen (name hidden) |
  | 26.6-30 s | end card |
- **The 10-second cut.** Show little, land hard:

  | Time | What's on screen |
  |---|---|
  | 0-1.7 s | the drone flyover at speed, morning to night |
  | 1.7-2.6 s | the portrait shrinking into the sprite |
  | 2.6-4.3 s | four VS screens, one per beat (only Ansem named) |
  | 4.3-5.1 s | the knockout blow in slow motion |
  | 5.1-6.4 s | the Hall walk, the braziers catching |
  | 6.4-7 s | a push-in on the dark figure on the dais (never revealed) |
  | 7-7.3 s | black and silence |
  | 7.3-10 s | the logo on the drop, "win creator fees daily.", "coming soon" |
- **Flashes.** Flashes are kept soft (at most a 0.2 white lift, on a handful
  of hits). `npm run check` counts large full-frame brightness reversals and
  fails if any 1 s window has more than 3.
- **Picture.**
  - `capture/` steps the real Phaser game frame by frame (virtual clock) and
    saves PNG plates with frame times and battle events.
  - `src/compositor.js` (Three.js) puts them on screen: integer-scaled,
    nearest-neighbour, with the camera snapped to the pixel grid.
  - The EffectComposer chain adds a glitch wipe, a gold-only bloom and a final
    pass: shake, a little RGB split, light CRT, a soft flash and fade.
  - A paused GSAP master timeline drives every animated value, evaluated at
    exact frame times.
- **Sound.** `src/audio/render.js` renders offline at 48 kHz.
  - The game's real `src/systems/audio.js` plays its own SFX into the offline
    context at the cue times.
  - The 140 bpm cue uses the game's instrument table and track format.
  - Risers, whooshes, slams and glass are built from the same voices.
  - A lookahead limiter holds the ceiling at −2 dBFS (the MP4 measures
    −1.9 dBTP), and the pre-drop gap is exact digital zero.

## Game assets used

| Kind | Assets |
|---|---|
| Captured gameplay (plates) | drone flyover (time-lapse); Market Square, Willow Pond pier, the windmill, the route in the rain, the Elite Hall at night; the look scene (portrait shrinking into the sprite); VS screens for Elites A, C and E and the final Elite D, with their names hidden; the Hall brazier walk and flare; the Ansem battle (VS intro, hit) and KO; title-screen logo; UI backdrop |
| Creature sprites | emberfox, sharkrex, fernking, sharkjaw, fernbloom (leaderboard rows) |
| Trainer sprites | every Elite, as the game draws them; only Ansem is named (by the game's own VS screen). The other bosses' names are hidden at capture. |
| UI | `ui/skin.js` panels (gold, glass, chip) and icons (star, clock), the game palette (`COLORS`), `formatRun` run-time format, Pixelify Sans (the game font) |
| Sound effects | footstep, status, sendout, tick, confirm, vs, encounterTrainer, attack, superHit, faint, item, hallDoors, ignite, flare, spotted, evolveBurst (all from `src/systems/audio.js`) |
| Music voices | the game's `INSTR` table and note/drum voices (the 140 bpm cue itself is new; no game track is 140 bpm) |

Made for the trailer only: the leaderboard and pool graphics, and
the damage numbers. The leaderboard names, times, pool amount and trades are
illustrative. The trailer contains no contract address.

## Title-screen drone footage

The game's main menu plays an edited, looping sequence of drone shots over the
overworld, rendered as a 3D world from the game's own data:

```bash
python3 drone/export_props.py     # the game's prop models (tools/props3d.py) -> textured 3D meshes (drone/assets/props)
npm run dev                        # then open http://127.0.0.1:5174/drone.html?play for a live preview
node render/drone.mjs --crf 28     # 56 s loop, 4 workers, resumable -> ../public/assets/title/drone.{mp4,webm} + poster.jpg
```

- **Models** (`drone/export_props.py`):
  - Every prop (the houses, the Elite Hall, the windmill, trees, hedges, fences,
    lamps, cars, tall grass) is the game's own model from `tools/props3d.py`.
  - Instead of rasterising a sprite, the exporter captures the model's
    triangles and ellipsoids and bakes each surface's procedural shader
    (shingles, bricks, siding, windows, foliage) into a texture atlas.
  - The atlases use the sprites' own density (4 texels per unit), so the 3D
    models carry the same detail as the game art.
  - Windows and lamps are flagged in the atlas alpha and glow at night.
- **World** (`src/drone/world.js`):
  - The map comes from the game's `buildMap()`. The ground is the whole route
    painted into one texture from the game's tileset (mipmapped, crisp up close).
  - Water drifts, and tall grass sways in the wind.
- **Look** (`src/drone/main.js`):
  - Renders at the game's 960x640 with 4x multisampling.
  - Soft shadows from a 4096 shadow map, drifting clouds, fog, and a sky dome
    with sun, moon and stars.
- **Edit** (`src/drone/edit.js`): eight shots through one day, each its own
  slow camera move, joined by six kinds of transition.

  | Shot | Hour | Move | Into the next shot |
  |---|---|---|---|
  | Dawn climb | 6:30-8:50 | lifts off the main road and climbs over the route | whip pan |
  | Market Square | 10:30 | slow arc round the fountain and gazebo (light tilt-shift) | mist |
  | Willow Pond | 13:00 | skims the water out along the pier | whip pan |
  | Windmill | 15:30 | low through the grass towards the windmill | mist (through haze) |
  | Overview | 16:00 | rises high over the route, the Hall far to the north | warm light leak |
  | Approach | 18:00 | golden hour up the approach to the Elite Hall | focus rack |
  | Hall at dusk | 19:00 | arcs up round the Hall against the sunset | dip to night |
  | Night road | 22:30 | down the lamplit road into town | time-lapse dissolve to dawn |

  - The camera only yaws; a lens shift frames the subject, so walls and columns
    stay upright.
  - The final pass (`main.js`) draws both shots during a transition and does
    the whip-pan motion blur, the focus racks, the tilt-shift and a soft grade
    (cool shadows, warm highlights, vignette). Nothing flashes: the brightest
    moment is the light leak's gentle warm sweep.
  - Each shot runs on its own clock (clouds, water, grass), and the last
    transition ends exactly on t = 0, so the loop is seamless and frame 0 (the
    poster) is a clean frame.
- **In the game** (`src/scenes/TitleScene.js`): the poster shows at once and the
  video streams in, muted. It offers H.264 first and VP9 as a fallback. If the
  video can't play, the poster stays as the backdrop.
