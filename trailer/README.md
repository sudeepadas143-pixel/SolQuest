# SolQuest trailer (30 s, 16:9)

Self-contained Vite app that builds the trailer from the game's own renderer,
sprites, UI skin, font and sound. The game code is not modified; the trailer
reads `../public` (as `/assets`) and `../src` (as `@game`).

## Commands

```bash
npm install
npm run capture   # real game plates -> plates/ (needs the game dev server on :5173)
npm run dev       # preview page on http://127.0.0.1:5174  (space, R replay, T timecode, scrub, record)
npm run render    # frame-by-frame 1920x1080 / 30 fps + offline audio -> solquest-trailer.mp4
npm run check     # beat grid, duration, frames, true peak, pre-drop gap, stills -> out/
```

`render` starts its own Vite server if none is running. Set `FFMPEG=` or
`CHROMIUM=` to override the binaries. `node render/render.mjs --from 12 --to 16 --out out/part.mp4`
renders a slice.

## How it's built

- **Grid.** 140 bpm (beat 0.4286 s, bar 1.714 s). Every shot, caption and
  sound-design cue is placed on it in `src/timeline.js` with `T(bar, beat, 16th)`.
  The pacing runs: one long shot, then cuts on every beat, every half-beat and
  every 16th, then 0.32 s of black and silence, then the drop at 13.714 s.
- **Picture.**
  - `capture/` steps the real Phaser game frame by frame (virtual clock) and
    saves PNG plates with frame times and battle events.
  - `src/compositor.js` (Three.js) puts them on screen: integer-scaled,
    nearest-neighbour, with the camera snapped to the pixel grid.
  - The EffectComposer chain adds a glitch wipe, a gold-only bloom and a final
    pass: shake, RGB split, glitch, light CRT, flash and fade.
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
| Captured gameplay (plates) | name entry, starter pick (Emby), wallet screen, town, road, tall grass at dusk, wild encounter, wild battle (hits, faint, XP, level up, stat panel), evolution (Embrute to Emberfox), Ansem battle intro and fight, Ansem KO, rainy-night pond (new map), title logo, UI backdrop |
| Creature sprites | emberfox, sharkrex, fernking, sharkjaw, fernbloom (leaderboard rows); scorpix, rubyclaw, boxbun (new-map silhouettes) |
| Trainer sprites | Elites A, C, E and D (Cooker), as unnamed dark silhouettes only. Ansem appears only as his in-game battle sprite and in the game's battle-intro text. |
| UI | `ui/skin.js` panels (gold, glass, chip) and icons (star, clock), the game palette (`COLORS`), `formatRun` run-time format, Pixelify Sans (the game font) |
| Sound effects | attack, hit, weakHit, superHit, faint, lowHp, cry, sendout, xp, levelup, evolveBurst, encounter, encounterTrainer, vs, spotted, grass, footstep, cursor, confirm, cancel, item, tick, thunder (all from `src/systems/audio.js`) |
| Music voices | the game's `INSTR` table and note/drum voices (the 140 bpm cue itself is new; no game track is 140 bpm) |

Made for the trailer only: the red candle chart in bar 1 (game palette), the
leaderboard, pool and countdown graphics, and the damage numbers. The
leaderboard names, times, pool amount and trades are illustrative. The trailer
contains no contract address.
