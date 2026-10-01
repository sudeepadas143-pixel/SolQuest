# SolQuest

A Pokémon-Platinum-style creature battler built with Phaser 3 and Vite.

You walk one route and its side areas past four Elite Trainers to Cooker's Elite
Hall. On the way you grind in tall grass to level up and evolve, explore for items,
and race the clock: the airdrop goes to the **fastest clears**. A run timer starts
when you gain control and freezes when Cooker falls. Beating Cooker unlocks the
Hall of Fame.

The world has a day/night cycle, where one real second is one game minute, and
seeded weather: clear, cloudy, rain and storms. All the art is 3D-rendered, all
the audio is synthesised, and the UI has its own violet, mint and gold identity.

> Read **BUILD_NOTES.md** before shipping. It covers the speedrun-payout fairness
> flags (§3b), seeded-team fairness, the unverified wallet, the client-side score
> and run time, and open sign-offs.

## Deploy (Vercel)

Import the folder or repo into Vercel, or run `npx vercel --prod`. `vercel.json`
sets the Vite preset: `npm run build` builds to `dist/`. It's a static site, so
there are no environment variables or server to set up.

## Run it

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # production build -> dist/
npm run preview      # serve dist/ on :4173
```

Processed sprites and tiles are already committed in `public/assets/`. Re-run the art
pipeline only when the source art changes. It needs Python 3 with Pillow, NumPy and
SciPy:

```bash
pip install pillow numpy scipy
npm run assets       # raw_assets/ -> public/assets/sprites, and renders tiles + 3D props
```

Checks:

```bash
npm test             # 25 logic/content/map tests (headless, no browser)
npm run sim          # difficulty simulation using the real battle engine
VITE_DEBUG=1 npm run build && npm run preview &   # debug build (exposes window.__game / __audio), then:
npm run smoke        # headless Chromium playthrough with screenshots -> tools/_smoke/
npm run tour         # screenshots of every area at noon/dusk/night/rain/storm -> tools/_tour/
npm run audio        # plays every music track and reports loudness / brightness
node tools/mobile_check.mjs   # phone emulation: no double-tap zoom, hold-B running
node tools/name_entry_check.mjs out/   # phone emulation: name entry via OK button and A
node tools/townsfolk_check.mjs out/    # townspeople: talk by key and click, wander bounds (VITE_DEBUG=1 build on :4173)
```

## Controls

| | Keyboard | Touch |
|---|---|---|
| Move | Arrow keys / WASD | D-pad |
| Run | hold **X** (the B button) or **Shift** while moving | hold **B** while moving |
| Confirm / talk / read | Enter, Space, Z | A |
| Back | Esc, X, Backspace | B (tap) |
| Menu (Team, Bag, Profile, Sound, Save) | M | MENU |
| Sound on/off | N | via MENU |
| Walk somewhere / use something | click a tile, a trainer, sign, door or item | tap it |

Everything can be played with the mouse alone: click to walk (long trips run),
click things to walk up and use them, click to advance dialogue, and use the
**MENU** button in the bottom-left corner. On PC a small key legend sits in the
bottom-right corner; each control drops off it once you've used it a few times,
and it's gone once you know them all (remembered per browser).

Walk into a trainer to battle them. Walk up into a door to enter. Walk through the
Elite Hall's doors, up the grand staircase and along the carpet to face Cooker. **The Solace** (the rest
stop) heals your team, saves the game, and sets your respawn point.

## Game flow

Title → Professor Mia's intro (five short lines and your name) → choose look
(boy or girl; the portrait shrinks into your in-game sprite) → choose starter (no
take-backs) → wallet (required) → overworld.

The route runs south to north:
- **Start town**, then **Trainer 1**, who blocks the only gap in the first hedge wall.
- Nine townspeople wander the towns, the fork, the pond, the windmill, the northern houses and the Orchard; face one and press confirm (or click them) to chat.
- **The fork**: optional west and east loops, with **Trainer 2** and **Trainer 3**.
- The loops reconverge at **The Solace**, the rest stop.
- **Trainer 4** blocks the next wall.
- Open grassland with the strongest wild creatures.
- The **Elite Hall** is last. Its doors open once all four route Elites are beaten.
  They slam shut behind you and the Hall is dark. You can't run on the carpet.
  Letterbox bars close in, a heartbeat theme plays, and the cold braziers along
  the aisle catch fire pair by pair as you pass. Halfway up, the music speeds up.
  There's no narration: the dark and the flames carry it. From the entrance
  foyer a wide marble staircase climbs to the Hall's raised main floor; walk
  forward up the carpet toward the dais and the HUD falls away, the camera
  rises to the gold gate in the back wall, light leaks round its doors and they
  open: **Cooker** steps out of the light as every flame flares. Winning leaves that
  gate open onto the **Hall of Fame**.

The four route Elites are TJR, Ansem, Orangie and Cented, in a seeded order per
player. The Elite blocking the road north (Trainer 4) won't fight until both
side-path Elites (2 and 3) are beaten; the Elite Hall's doors open only once all
four are beaten.

Side areas open up as you progress:
- **Market Row**, east of town (Lv 3–7).
- **Willow Pond** and its pier, after T1 (Lv 10–16).
- **The Orchard** and its Overlook, after T4 (Lv 18–27).

They hold 12 item balls, including hidden ones that sparkle now and then, and
Level Gems. Press Enter on houses, the windmill, the fountain and the other props
for lore.

Tall-grass zones get stronger toward the Hall. Wild encounters trigger on 10% of
steps in tall grass. At night, Scorpix and Glowblade show up twice as often.

**Elites have personalities.** TJR is cocky, Ansem arrogant, Orangie nice,
Cented respectful and Cooker openly disrespectful (`src/data/personalities.js`).
Each has intro, rematch, last-creature, defeat, victory, post-battle and
"not yet" lines, and each has their own encounter and battle theme.

**The Elites point the way.** If your lead creature is under-levelled, the Elite
tells you so in character: your level, theirs, where to train and to what level.
For Cooker, they also mention a missing final form. You then choose **BATTLE** or
**NOT YET**. If one beats you, they coach you in the same voice. Once beaten,
they tell you where to go next, and so does the host at The Solace
(`src/systems/advice.js`).

**Element symbols in battle.** Every type has a clean vector symbol in its
colour (`src/ui/typeIcons.js`): a flame, a drop, a leaf and so on. Both info
plates show each creature's type symbols, and move cards show each move's
symbol. Matchups aren't spelled out: players learn what beats what themselves.
The Summary and Hall of Fame badges use the white version of each symbol.

**Levelling up fully heals** the creature that levelled. Evolution plays as its
own full-screen scene (`EvolutionScene.js`) with a build-up theme and a fanfare.

**Blacking out** sends you to the nearest checkpoint you've unlocked, whether or
not you rested at a Solace: town, the tile past each Elite you've beaten, and
every Solace you've walked past (`src/systems/checkpoints.js`).

**Timer:** the HUD's **RUN** chip counts in-game time through the overworld,
battles and menus. It turns gold and reads **CLEAR** once Cooker is beaten, and
that time goes on the Hall of Fame plaque.

## Project structure

```
elite-route/
├── index.html                 # page shell + touch pad
├── vite.config.js
├── package.json
├── README.md / BUILD_NOTES.md
├── docs/ASSET_MANIFEST.md     # Step-0 inventory + resolved decisions
├── raw_assets/                # original art as delivered (input to the pipeline)
├── public/assets/
│   ├── sprites/               # processed creature/trainer/player sprites
│   └── tiles/                 # tileset + 3D-rendered props (houses, hall, trees, cars...)
├── tools/
│   ├── process_assets.py      # key backgrounds, hi-fi downscale, ball recolour, sprite sheets
│   ├── charsprites.py         # overworld characters from the source art (hi-fi resample)
│   ├── make_townsfolk.py      # townspeople sprite sheets from tools/src_art/townsfolk_*.png
│   ├── rig.py / rig_configs.py # jointed walk/run rig: keyframed poses, RotSprite lean
│   ├── make_tiles.py          # ground tileset + calls the 3D prop renderer
│   ├── iso3d.py               # tiny DS-style 3D renderer (oblique camera, shadow map, outlines)
│   ├── props3d.py             # 3D models: houses, The Solace, Elite Hall, trees, cars, lamps...
│   ├── preview.py             # contact sheet of processed sprites
│   ├── logic_tests.mjs        # npm test
│   ├── balance_sim.mjs        # npm run sim
│   ├── smoke_play.mjs         # npm run smoke
│   ├── tour.mjs               # npm run tour
│   └── audio_check.mjs        # npm run audio
└── src/
    ├── main.js                # Phaser game config, font loading
    ├── config.js              # tuning knobs (encounter rate, XP multiplier, ...)
    ├── data/                  # CONTENT - edit these to tune the game
    │   ├── creatures.js       # species, types, base stats, learnsets, evolutions, tiers
    │   ├── moves.js           # move list
    │   ├── types.js           # type chart + colours
    │   ├── trainers.js        # 4 route Elites + Cooker: pools, levels, points, rewards, lines
    │   ├── encounters.js      # wild zones: level ranges + pools
    │   ├── items.js           # potions, Level Gem, starting bag
    │   ├── music.js           # chiptune tracks (note strings)
    │   ├── map.js             # route layout, props, signs, trainer spots
    │   ├── dialogue.js        # intro script, wallet prompt
    │   ├── townsfolk.js       # townspeople: names, wander patches, conversations
    │   ├── spriteManifest.json / tiles.json   # generated by the pipeline
    ├── systems/               # LOGIC - no content hardcoded here
    │   ├── battle.js          # pure battle engine (damage, AI, XP, events)
    │   ├── creature.js        # stats, XP curve (level³), level-ups, evolution, move learning
    │   ├── teams.js           # seeded trainer-team generation (see BUILD_NOTES §1)
    │   ├── save.js            # localStorage save file
    │   ├── score.js           # points per trainer
    │   ├── rng.js             # seeded PRNG
    │   ├── mapBuilder.js      # map.js -> grids for rendering/collision
    │   ├── controls.js        # keyboard/touch -> actions, focus stack
    │   ├── world.js           # game clock, lighting keyframes, seeded weather
    │   ├── runClock.js        # speedrun timer (in-game time) -> save.run
    │   └── audio.js           # WebAudio synth: SFX + chiptune sequencer + rain
    ├── ui/                    # skin.js (painted panels/icons/badges), DialogBox,
    │                          # Menu, HpBar, Summary card, theme, backdrop
    └── scenes/                # Boot, Title, Intro, Look, Starter, Wallet,
                               # Overworld (+ Atmosphere + OverworldUI), Battle, HallOfFame
```

## Creature roster

| Family / creature | Stages | Type | Tier | Where it appears |
|---|---|---|---|---|
| Fire | **Emby** → **Embrute** (Lv14) → **Emberfox** (Lv22) | Fire | starter → mid → trainer | player only |
| Water | **Sharkpup** → **Sharkjaw** (Lv14) → **Sharkrex** (Lv22) | Water (Sharkrex: Water/Dragon) | starter → mid → trainer | player only |
| Grass | **Fernie** → **Fernbloom** (Lv14) → **Fernking** (Lv22) | Grass (Fernking: Grass/Steel) | starter → mid → trainer | player only |
| Boxbun | single stage | Fighting | trainer | zones 1–3, Market, Pond, T1–T4 |
| Rubyclaw | single stage | Dragon/Rock | trainer | every area, T1–T4 |
| Mantek | single stage | Bug/Steel | boss | zones 2–4, Pond, Orchard, T2, T4, Cooker |
| Scorpix | single stage | Poison/Dark | boss | zones 3–4, Pond, Orchard, T3, T4, Cooker (more at night) |
| Glowblade | single stage | Ghost/Steel | boss | zones 3–4, Pond, Orchard, T4, Cooker (more at night) |

## Tuning cheat-sheet

| I want to... | Edit |
|---|---|
| Change the encounter rate or overall grind length | `src/config.js` → `ENCOUNTER_RATE`, `XP_MULT` |
| Make a trainer harder or easier | `src/data/trainers.js` → `levels`, `teamSize`, `pool` |
| Name a character design (A = TJR, B = Ansem, C = Orangie, D = Cooker, E = Cented) | `src/data/trainers.js` → `DESIGN_NAMES` |
| Pin which character art a trainer uses | `src/data/trainers.js` → `design: 'A'..'E'` |
| Change wild creatures by area | `src/data/encounters.js` |
| Rename a creature or change its stats or moves | `src/data/creatures.js` |
| Move trainers, houses or grass | `src/data/map.js` (then run `npm test` to re-check reachability) |
| Re-roll everyone's teams (and weather) for a new event | `src/config.js` → `SEASON_SALT` |
| Change the day length or the starting hour | `src/systems/world.js` (1 s = 1 game minute), `START_HOUR` in `src/config.js` |
| Change how often it rains | `weatherForBlock()` in `src/systems/world.js` |
| Give everyone the same Elite teams (fair race) | `makeSeed()` in `src/systems/teams.js` (see BUILD_NOTES §3b) |
| Place or hide an item | `MAP_ITEMS` in `src/data/map.js` |
