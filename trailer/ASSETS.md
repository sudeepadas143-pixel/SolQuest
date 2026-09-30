# SolQuest: game asset inventory (source material for the trailer)

Everything the trailer shows or plays comes from this list. Nothing here was
made for the trailer; the trailer only stages, crops and composites it.

## Sprites (`public/assets/sprites/`)

### Creatures (`creatures/`, fronts at 2 texels/unit, backs at 3)
| Species | Types | Front | Back |
|---|---|---|---|
| Emby → Embrute → Emberfox (fire starter line) | Fire | ✓ | ✓ |
| Sharkpup → Sharkjaw → Sharkrex (water starter line) | Water, Sharkrex Water/Dragon | ✓ | ✓ |
| Fernie → Fernbloom → Fernking (grass starter line) | Grass, Fernking Grass/Steel | ✓ | ✓ |
| Boxbun | Fighting | ✓ | – |
| Rubyclaw | Dragon/Rock | ✓ | – |
| Mantek | Bug/Steel | ✓ | – |
| Scorpix | Poison/Dark | ✓ | – |
| Glowblade | Ghost/Steel | ✓ | – |

### Trainers (`trainers/`)
Battle poses (`*_battle.png`) and overworld idle sheets (`*_ow.png`) for
the five Elite designs: **A** TJR, **B** Ansem, **C** Orangie, **E** Cented,
**D** Cooker (final boss).

### Player (`player/`)
- `boy_walk.png` and `girl_walk.png`: rigged walk/run sheets in four directions, seven frames each.
- `boy_full.png` and `girl_full.png`: full-body portraits, used on the look pick and the VS screen.

## Tileset and props (`public/assets/tiles/`, meta in `src/data/tiles.json`)
- **`tileset.png`**: 33 ground tiles, each 64×48:
  - Outdoors: grass, grass2, tall grass, road, road_v, road_h, walk, flowers, fence, hedge, marble, carpet, wall, wood, water, water2 (animated), sand, bridge, dirt, plaza.
  - Hall interior: hall_floor, carpet l/m/r, dais, dais_edge, hall_wall, hall_top, hall_side l/r, hall_bottom, hall_mat, void.
- **75 3D-rendered props**:
  - Buildings: 7 house styles, shop, `rest_house` (The Solace), `hall` (Elite Hall), windmill, gazebo.
  - Street and yard objects: fountain, well, bench, rock, boulder, stump, crates, barrel, flowerpot, lamp, sign, banner, 6 cars.
  - Plants: trees ×3, bush, hedge and fence segments.
  - Hall interior: pillar, brazier, brazier_cold, floor_emblem.
  - Misc: item_ball, pedestal.
  - Tall grass: 4 variants × back/front × 3 wind frames, plus 3 grass clumps.
- **Battle platforms**: `plat_me`, `plat_foe` and their `_boss` versions, plus `grass_overlay`.

## Maps (`src/data/map.js`, built by `src/systems/mapBuilder.js`)
- **Outdoor route** (72×128 tiles):
  - Start town and Market Row.
  - Route 1 South; the Fork (west and east side paths); Willow Pond; Route 1 North.
  - The Orchard Overlook; the Elite Approach; the Elite Hall exterior.
  - Three Solace rest stops.
- **Elite Hall interior** (x 76–92): carpet aisle, colonnade, braziers, dais, Hall of Fame gate.
- **Encounter zones** (`src/data/encounters.js`) and day/night/weather (`src/systems/world.js`).

## UI elements (`src/ui/`, `src/scenes/`)
- **Skin** (`skin.js`):
  - Panel styles glass, menu, chip, plate, gold and card, all with the violet/mint/gold route stripe.
  - Highlight bar; command buttons FIGHT/BAG/TEAM/RUN.
  - Icons: pin, sun, moon, cloudy, rain, storm, clock, star, fight, bag, team, run.
  - Trainer portrait badges.
  - FX textures: glow, spark, exclaim, raindrop, ripple, cloudshadow.
- **Widgets**:
  - `DialogBox` (typewriter, speaker tab, portrait); `HpBar` (tweening HP/XP bars).
  - `Menu` / `chooseFrom`; `Summary` (stat card, type badges); `typeIcons` (12 element symbols).
  - `helpers.tapButton` and DOM text inputs.
- **Overworld HUD** (`OverworldUIScene`):
  - Location chip, clock/weather chip, RUN timer chip, Elite badge row, score.
  - Toasts and banners; battle wipes (trainer chevrons, wild pinwheel); cinema bars and vignette.
- **Battle UI** (`BattleScene`):
  - Foe and player info plates (type-coloured accent, Lv pill, HP bar, HP numbers, EXP bar).
  - VS splash; command menu; move cards; LEVEL UP! stat panel.
  - Hit rings and sparks; throne-room arena for the final boss.
- **Title screen**: gradient SolQuest logo, dawn sky, ridges, party on the cliff.
- **Other scenes**: Evolution (rays, flicker, burst); Hall of Fame card; Wallet profile panel; Starter cards; name entry.

## Font
- **Pixelify Sans** 400 and 700 (`@fontsource/pixelify-sans`), used through `src/ui/theme.js` (`FONT` in `src/config.js`).

## Sound effects (synthesised, `src/systems/audio.js` → `sfx(name)`)
37 effects:
- **Menus:** cursor, tick, type, confirm, cancel, open.
- **Overworld:** bump, grass (layered rustle), footstep, door, spotted.
- **Pickups and saves:** heal, item, save.
- **Levels and evolution:** levelup, xp, evolve, evolveBurst, fanfare.
- **Encounters:** encounter, encounterTrainer, vs, cry, sendout.
- **Battle:** attack, hit, superHit, weakHit, status, statUp, statDown, faint, lowHp.
- **Weather:** thunder, plus the rain ambience bed.
- **Elite Hall:** hallDoors, ignite, flare.

## Music (step-sequenced, `src/data/music.js`, voices in `audio.js`)
24 tracks:
- **Title and overworld:** title 88, day 104, night 72.
- **Battle and encounter themes:** battle 138, eliteEncounter 138, cookerEncounter 112, eliteBattle 152, boss 158.
- **Elite Hall walk:** hallWalk 80, hallWalk2 88.
- **Per-Elite themes:** encounter_A 132, battle_A 144; encounter_B 124, battle_B 156; encounter_C 150, battle_C 166; encounter_E 128, battle_E 148.
- **Results and evolution:** victory 120, victoryShort 132, lose 64, evolve 96, evolved 124, hof 84.

Instruments are soft, bell, pluck, pad, bass, brass and drive. Drum tokens are
k, s, h, r, t (timpani) and c (crash). None of the tracks runs at 140 bpm, so
the trailer adds a 140 bpm cue written in the same format and played through
the same synth (`trailer/src/audio/track.js`).
