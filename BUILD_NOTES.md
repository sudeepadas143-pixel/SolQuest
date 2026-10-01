# Build notes: decisions, flags and known gaps

This file covers decisions that are easy to "optimize away" later, and the gaps that
have to close before real money moves.

---

## 1. Seeded trainer teams: keep them seeded (do not remove)

**What it does:** each Elite Trainer and Cooker has a *pool* of eligible creatures
(`src/data/trainers.js`). When a save is created, `generateTeams(seed)` in
`src/systems/teams.js` rolls every team once and writes the result into the save
(`save.teams`). Battles always load that stored team (`OverworldScene.startBattle`).

**Why:** beating trainers feeds a scored airdrop. If a team were re-rolled on each
attempt, a player could lose on purpose, reload or retry until they drew an easy
matchup. That undermines the scoring. So:

- Retrying, losing, reloading or quitting **never** re-rolls a team.
- The seed is **derived from the wallet address**, as `hash(SEASON_SALT + wallet)`,
  whenever one is given at profile setup. Starting a *new game* with the same wallet
  therefore produces the same teams, which closes the "new save = new roll" loophole.
- Different players (wallets) get different teams.
- If the wallet step is skipped, the seed is random (`seedSource: 'random'`). A later
  wallet edit does **not** re-roll teams. `walletAtSeed` records which wallet, if
  any, the seed came from.

**Don't:**
- Move team generation to battle start.
- Call `Math.random()` for team selection.
- "Simplify" the stored teams away.

Changing `SEASON_SALT` in `src/config.js` intentionally re-rolls everyone, for
example for a new event.

**Remaining weakness:** the salt ships in the client, so someone could pre-compute
the teams for many throwaway wallets and pick the easiest. A server-issued seed
(secret salt, one seed per verified wallet) fixes this.

## 2. Wallet ownership is NOT verified ⚠️

The profile screen stores whatever address is pasted. There is no signature
challenge, so a player can enter someone else's address, and nothing proves the
person playing controls the wallet. That is acceptable for a first playable build.
**Before any airdrop is paid out** against these scores, add a signed-message
ownership check tied to the X account.

Validation today is only cosmetic: 4–128 characters, no spaces.

## 3. Score and run-time integrity: client-side only ⚠️

The score, the **run timer**, defeated flags and teams all live in `localStorage`
(`eliteRoute.save.v1`). Anyone can open devtools and set `score: 999999` or
`run.clearMs: 1`. The in-game debug handle
`window.__game` makes that even easier.

Real money needs **server-side validation of battle outcomes**, not client-reported
results. For example, the server issues the seed, receives each battle's action log,
and re-simulates it. `src/systems/battle.js` is already pure JavaScript with no
Phaser dependency, so it can run server-side. Until then, treat scores as
unverified.

## 3b. Speedrun payouts: the fastest clear wins ⚠️

You told me the airdrop comes out of creator fees and goes to the players who
**complete the game fastest**. The game now measures that.

**How it's timed** (`src/systems/runClock.js`):
- The timer starts on the first overworld frame, after the intro, the starter
  pick and the wallet screen. Reading the intro doesn't cost anyone time.
- It counts every frame in which the Overworld or a Battle is running, pause menu
  included. It stops the moment Cooker faints, which freezes `save.run.clearMs`
  and stamps `run.clearedAt`.
- `run.startedAt` is the wall-clock start, so a server can sanity-check that
  `clearMs ≤ clearedAt − startedAt`.
- It's **in-game time (IGT)**, like speedrun.com's IGT. It doesn't count while the
  tab is hidden or the game is closed, and a frame is capped at 250 ms. Closing
  the game and coming back later doesn't cost you, which is fair because everyone
  gets the same rule. Wall time (`clearedAt − startedAt`) is recorded too if you'd
  rather rank on that.
- The HUD shows **RUN** in mint while the timer runs and **CLEAR** in gold once
  it's frozen. The Hall of Fame plaque leads with the clear time.
- The day/night cycle and weather come from play time alone. Two players at the
  same timestamp see the same sky, so there's no luck in that.

**Things that make a race unequal. Decide these before paying anyone:**
1. **Per-player seeded teams.** Section 1 seeds each wallet differently, as you
   originally asked. For a score that was fine. For a *race* it means players
   face different Elite teams, and some are easier than others. I did **not**
   change your spec. If you want an equal race, seed from `SEASON_SALT` alone so
   everyone gets the same teams. That's a one-line change in
   `makeSeed()` in `src/systems/teams.js`. It still stops re-roll
   fishing, because everyone's roll is the same.
2. **Starter choice.** Fernie (grass) needs roughly 3–8 more levels than the others
   for T4 and Cooker (see section 6), so it clears slower. Either rebalance it or
   rank each starter separately.
3. **RNG.** Wild encounters, damage rolls, crits and misses use `Math.random()`.
   Some RNG is normal in speedrunning, but for money you may want a seeded battle
   RNG, which is also what you'd need for server replays.
4. **Save-scumming.** A player can copy `localStorage` before a hard fight and
   restore it after a loss. That rolls the timer back too and erases the lost
   time. Only server-side runs fix this.
5. **Editable time.** See section 3. A leaderboard fed by the client can be forged
   in seconds.

**What a payout-safe version needs:**
- A signed wallet login (section 2).
- A server-issued run ID and seed.
- The client streams its input and battle log.
- The server replays it with `src/systems/battle.js`, which has no Phaser
  dependency, and derives the time itself.

Until then, treat the leaderboard as unverified and check the top runs by hand
(ask for a recording) before paying out.

## 3c. Leaderboard and earnings (built) ⚠️

The menu now has **LEADERBOARD** (the season's fastest clears) and **EARNINGS**
(a wallet's rank, best time, projected payout and the payouts it has received).
Both are backed by `api/`, Vercel functions.

**Storage.** The functions talk a small Redis-command subset (`api/_lib/redis.js`). Live, that runs on **Vercel Blob**:
- the whole board is one private file, `leaderboard/db.json`;
- each request loads it once, runs its commands on that copy and saves it conditionally (ETag `ifMatch`, create-only for the first save);
- a request that lost a race re-runs on the fresh copy;
- `tools/blob_store_tests.mjs` races six submissions against a stand-in with real ETag semantics.

Upstash Redis is used instead if its env vars are set. Locally, the same commands run in memory.

The single file is fine for thousands of runs. If the game grows past that, move to Upstash (no code changes; just add it in the Marketplace).

**Runs**
- A run is sent automatically when Cooker falls; the Hall of Fame shows the rank.
- If the browser was offline then, it is sent again when LEADERBOARD or EARNINGS opens.
- The server keeps each wallet's best time.

**Checks on every run**
- The wallet must be a Solana address. The game now asks for one at the profile screen.
- The time can't be under the season minimum (5 minutes by default).
- In-game time can't exceed the wall-clock time between start and finish.
- Nothing can finish in the future.
- At most 10 submissions a minute per IP.
- The season must be open.

**Review**
- Every run starts as **PENDING**.
- From `/admin.html` (needs `ADMIN_KEY`) you:
  - **verify** a run;
  - **reject** it: it leaves the board and the player sees the reason;
  - **ban** a wallet for the season;
  - **record payouts**: amount, place, transaction signature, shown to the player with a Solscan link.
- **Projected payouts** follow the season's pool and split:
  - the default split is 30 / 20 / 12 / 9 / 7 / 6 / 5 / 4 / 4 / 3 % for the top 10;
  - a pool of 0 shows "to be announced".
- **New season:** change the season id. That starts an empty board, and payout history stays with each wallet.

**Still true from §3 / §3b:** times are reported by the browser, and the checks
above stop casual tampering, not a determined forger. The PENDING → VERIFIED step
is where a person confirms the top runs (ask for a recording) before paying. The
seeded-teams and starter-balance questions in §3b decide how fair the race is.

**Not included**
- Automatic payouts: payments are sent from your own wallet, then recorded.
- Signed wallet login (§2).

## 4. Decisions still open (yours to make)

- **Cooker's likeness sign-off.** Cooker is a real person's character. Get sign-off
  before anything ships publicly.
- **Trainer "who's who"** (complete): **A = TJR**, **B = Ansem**, **C = Orangie**,
  **D = Cooker**, **E = Cented**. That's five characters and five Elites:
  - TJR, Ansem, Orangie and Cented are the four route Elites (Trainers 1–4). Each
    appears exactly once, in a seeded order per player.
  - Cooker is the fifth Elite, pinned to D, and is fought in the Elite Hall.
  - The names live in `DESIGN_NAMES` in `src/data/trainers.js`.
  - Older saves from the six-opponent layout are migrated on load. The removed
    route slot and any points it awarded are dropped, and designs are re-skinned.
    Creatures are otherwise unchanged.
- **Likeness sign-off for Ansem, TJR, Orangie and Cented**, the same as for Cooker, before
  anything ships publicly.
- ~~OKX logo~~: resolved. Cooker's updated art (design D) has a plain tee, and
  the old logo art is no longer used.
- **Airdrop payout rule.** Decided: the fastest completions get paid from creator
  fees. Still open:
  - How many places are paid, and the split.
  - Whether you rank on IGT or wall time.
  - The season window.
  - Whether the race uses one shared seed (see 3b).

  The score (T1 100 · T2 250 · T3 250 · T4 600 · Cooker 1500, max 2700) is still
  shown. It could break ties, or you could drop it.

## 5. Overworld art (3D-rendered, original)

**Camera.** The view is lowered, like the newer titles, rather than pure
top-down. Tiles are **32×24**, foreshortened 0.75 vertically. Buildings render
with a steeper pitch, so you see a lot of their front walls, with a slight
left-to-right skew so side walls and both roof slopes show. The world draws at
an integer 2× zoom, about 15×13 tiles on screen.

**Fidelity: one texel is one screen pixel.** All world art is made at
`ART_SCALE = 2` texels per world unit and drawn at ½ scale under the 2× camera:
- 3D props render at `RES = 4` texels per model unit, with 14 light levels, a
  cool tint in the shade and a warm tint in sunlit areas. Tree foliage uses a
  cellular leaf-clump shader.
- Ground tiles are painted at 64×48.
- **Tall grass is real 3D blades**, rendered in two layers per tile. The back
  half sits behind whoever stands on the tile and the front half covers their
  legs. The front layer rustles, with leaf bits, when you step in. Short grass
  gets scattered 3D tufts.
- Battle platforms render at the same density. Battle backdrops use the same 3D
  trees and grass texture as the overworld, hazed by distance.

**Characters match the source art.** The overworld sprites are resampled
straight from the supplied art to about 96 px tall (`tools/charsprites.py`,
block-median, so the drawn pixels stay crisp). That keeps nearly all of the
source detail, so TJR, Ansem, Orangie, Cooker and Cented are recognisable on
the map. Supporting art is extracted at higher density too:
- Creature fronts at 2×.
- Creature backs, trainer battle poses and the player portraits at 3×.
- Display scales divide by `HD` in `src/config.js`.

**Walk and run cycles come from a jointed rig** (`tools/rig.py`, joint maps in
`tools/rig_configs.py`). This is the third version; the earlier ones only moved
pieces of one standing pose around.
- Each facing of each look is split into a body (head and torso, taken from the
  supplied art with the original arms painted out) and redrawn limbs in colours
  read off the art. Arms have a shoulder, an elbow and a hand. Legs have a hip,
  a knee and a shoe (sneakers for the boy; red sandals with visible toes and
  leg-warmers for the girl).
- Frames are keyframed poses:
  - **Running (side views):** the whole upper body leans forward about 12°,
    elbows bend around 90° and pump in opposition to the legs, the front leg
    reaches, the back foot kicks up, and passing frames go airborne.
  - **Running (front and back views):** alternating knee lifts with shin
    foreshortening, hands pumping up to chest height, and a bob.
  - **Walking:** a heel-to-toe stride with shoulder-driven arm swing.
- The torso lean is rotated RotSprite-style (Scale2x twice, rotate, then
  majority downsample), so rotated pixel art stays crisp. Each limb is drawn
  at 4× and brought down to sprite size, and is outlined as one piece.
- Frames are locked to tile movement like the handhelds. Walking goes step,
  idle, other foot, idle, one step per tile. Running shows a contact frame
  then an airborne frame for each tile.
- To re-pose, edit the `SIDE` / `FRONT` keyframes in `rig.py` and run
  `npm run assets`.

**Facing fix.** The boy's supplied turnaround drew *both* side views facing
left, so walking right looked like walking backwards. The owner supplied a
proper right-facing view (`raw_assets/boy_right.png`), and the pipeline uses it.

**Trainers** get a two-frame idle "breathing" loop on the map.
Buildings, trees, cars, lamps, signs and banners are **modelled in 3D and
rendered DS-style**. The code is in `tools/iso3d.py` (renderer) and
`tools/props3d.py` (models).

The renderer works like this:
- **Camera:** a tilted, slightly skewed camera that keeps the ground tile grid 1:1,
  so front walls, both roof slopes and the right-hand side walls all show.
- **Lighting:** a single sun, posterised into a few light levels.
- **Shadows:** a shadow map, so eaves shade walls, the dome shades the Elite Hall
  roof, and buildings cast shadows onto the ground.
- **Textures:** procedural shingles, siding, bricks, stone, glass and foliage.
- **Outlines:** sprite-style edges.

Each sprite stores an anchor (the footprint's bottom-left ground corner) in
`tiles.json`, and the game places sprites by that anchor.

To tweak a building, edit its model in `props3d.py` and run `npm run assets`, or
`python3 tools/make_tiles.py` for the tiles and props only. Footprints must still
match `PROP_FOOTPRINTS` in `src/data/map.js`.

**Variety.** There are nine house models, not one reskinned:
- Gabled cottages in three roof colours.
- A hip-roof house and a hip-roof townhouse.
- A brick townhouse with a balcony.
- A log cabin.
- An L-shaped house with a second wing.

Alongside those are a market shop with an awning, The Solace (the rest stop), a windmill with
sails, a gazebo, a fountain, wells, benches, boulders, crates, barrels and
flowerpots. Hedges and fences are 3D segments that tile seamlessly.

**Night lights.** The renderer records every emissive pixel cluster (lit windows,
lamp heads) into `tiles.json` → `props[type].lights`. At night the Atmosphere
scene places pooled additive glows there. Nearby clusters are merged, so a row
of panes reads as one warm pool.

Ground tiles (grass with painted blades, turf under the tall grass, road with
aggregate and cracks, paving, sand, dirt, water with two animation frames, the
bridge) are painted at 64×48 in `make_tiles.py`. The Hall of Fame room is drawn
in code.

Other missing art:
- **Embrute has no front sprite.** The summary and Hall of Fame fall back to its
  back view. It never appears as an opponent, so battles are unaffected.
- **No player back-view "trainer throw" sprite** for the battle intro. The partner
  appears directly.
- **No audio files.** Everything is synthesised with WebAudio in
  `src/systems/audio.js`:
  - 30+ sound effects.
  - Original tracks in `src/data/music.js`: title, day, night, wild battle,
    victory, defeat, evolution and Hall of Fame. There are also four boss
    themes:
    - **Every Elite has their own pair:** an "eyes meet" theme for their
      pre-fight lines and a battle theme built on the same motif. They're keyed
      to the character, not the route slot, because the order is seeded per
      player.
      - **TJR:** laid-back swagger, G minor, funky syncopated bass.
      - **Ansem:** heroic-villain fanfare, F minor, march drums.
      - **Orangie:** relentless 16th-note arpeggios, E minor, with a brass hook.
      - **Cented:** dark and stealthy, B minor, with a chromatic lead and
        prowling bass.
      - **Cooker:** slower, with timpani and low brass in the Hall, then the
        biggest battle track in the game, in D minor.
    - A generic Elite encounter and battle theme remain as a fallback for any
      unnamed design.

    They use a filtered brass lead and a driving bass, and play a few dB louder
    than the overworld music but stay soft on the ears.
  - A rain bed and thunder.

  The first version used raw square and saw waves and was harsh. The music now
  uses soft instruments: a warm lead, bells, a plucked lead for battles, pads and
  bass. Everything is low-passed, with a room reverb, a quiet echo and brushed
  drums. Measured with `npm run audio`, the spectral centroid dropped from
  2.2–3.2 kHz to 0.4–0.9 kHz and peaks halved.

  Replace them with real audio later if you like; the `sfx()`/`music()` calls stay
  the same.

## 5b. World systems (day/night, weather, exploration)

- **Clock.** One real second is one game minute, starting at 8:00 AM, so a full day
  takes 24 minutes. Dawn, day, dusk and night are colour-graded with a MULTIPLY
  overlay. Night brings lit windows, lamp glows, a small glow around the player,
  night music, and double encounter weight for Scorpix and Glowblade.
- **Weather.** Each 3-hour game block rolls clear, cloudy, rain or storm from
  `hash(SEASON_SALT, block)`. The first block is always clear. Weather is the same
  for everyone at the same play time.
  - Rain adds streaks, splashes and a rain bed.
  - Storms add lightning flashes and thunder.
  - Clouds cast drifting shadows on clear days.
  - Battles pick up the time of day and the weather: sky, stars and moon,
    platform tint, rain.
- **Exploration.** The map is 72×128 tiles. Beyond the main road there are three
  side areas, each with its own encounter levels:
  - **Market Row** and its square.
  - **Willow Pond**, with a pier.
  - **The Orchard**, with its Overlook.

  Side areas are gated behind the same Elites as the main road. There are 12 item
  balls, 6 of them hidden (they sparkle now and then). Level Gems give +1
  level. Props have lore text when you inspect them.

## 6. Difficulty design (verified with `npm run sim`)

The game is **easy early and ramps gently**. Walking straight to the first Elite
already gives about a 40–55% win rate, and a couple of wild fights make it
comfortable. Each later Elite needs a little more grinding than the one before,
but never a wall.

| | T1 | T2 | T3 | T4 | Cooker |
|---|---|---|---|---|---|
| Elite levels | 6–7 | 9–10 (×2) | 9–10 (×2) | 14–16 (×2) | 23–25 (×3) |
| Level for a ≥70% win: Emby | 8 | 13 | 14 | 18 | 22 |
| Level for a ≥70% win: Sharkpup | 6 | 12 | 12 | 15 | 24 |
| Level for a ≥70% win: Fernie | 6 | 13 | 14 | 18 | 22 |
| Wild wins needed on the way | 1–3 | 4–5 | 0–3 | 2–9 | 5–8 |

**Final form before the final battle.** Starters evolve at Lv 14 and Lv 22.
Against Cooker, every starter is at 0–3% one level before its final form and
70–100% once evolved, so the final form is what wins the fight.

Wild zones scale with the route:
- South and Market Row: Lv 3–6.
- The Fork: Lv 7–11.
- Willow Pond: Lv 8–12.
- North: Lv 12–17.
- The Orchard: Lv 16–22.
- Elite Approach: Lv 18–24.

`XP_MULT` is 2.4.

**The road north is gated too.** Trainer 4 stands in the only gap north. It
refuses to fight until Trainers 2 and 3 (the side paths) are beaten, and names
who is left, e.g. "Orangie and TJR are still undefeated out on the side paths."

**The Elite Hall needs all four route Elites.** The doors show four crests. That
makes "complete the game" mean the same five fights for every speedrunner.
Before, a runner could skip T2 and T3.

**Starter parity.** Grass is resisted by nearly every Elite creature. Fernie
learns Paw Smash at level 11, Solar Flare at 13 and Dawn Blaze (a Fire special)
at 22. Its final form, Fernking, is Grass/Steel. That makes it immune to
Scorpix's poison and neutral to bug, so all three starters now need about the
same level for Cooker.

**Tuning knobs:**
- `ENCOUNTER_RATE` and `XP_MULT` in `src/config.js`.
- Trainer `levels` and `pool` in `src/data/trainers.js`.
- Zone `levels` in `src/data/encounters.js`.

## 7. Content decisions from the asset review

- The 3 starter families belong **only** to the player. They never appear wild or on
  trainer teams. That leaves 5 wild/trainer species (Boxbun, Rubyclaw, Mantek,
  Scorpix, Glowblade), so wild variety is thin; more creature art would help.
- There is **no catching**. Progress comes from beating wild creatures and trainers.
  The team is the starter.
- Trainers' red/white capture balls were recoloured to Solana purple→green, with a
  dark lower half.
- Evolutions happen at level 14 and level 22, so a normal run reaches the final form before Cooker (Lv 23–25), and Cooker is tuned so that the final form is what beats him (0% win rate one level short, 70%+ at Lv 22–24). Fernking is Grass/Steel so the grass line isn't hard-countered by Cooker's poison and bug creatures.
- The fire line's order is confirmed: Emby → Emberfox → Embrute.
- **Professor Satoshi's intro was rewritten at the owner's request.** The
  original brief asked for an exact script, but the owner later found it read as
  generic. The new script is shorter and gives Satoshi a dry, mysterious voice.
  It states the real rules: all five Elites, the Hall, and the fastest runs paid
  from creator fees to your wallet. The black screen, the hidden face and the
  name entry are unchanged. It lives in `src/data/dialogue.js`. The Elites'
  lines were rewritten in the same voice (`src/data/trainers.js`).

## 7b. SolQuest presentation pass

- **Title screen**: a dawn scene. The party stands on a cliff, seen from behind,
  looking out over mountain ridges while the sun rises. It has parallax ridges,
  mist, swaying grass, birds and a gradient SolQuest logo, with no subtitle.
- **Elite Hall interior**: a separate area east of the outdoor map
  (`OUTDOOR_W`/`HALL` in `src/data/map.js`), reached by a warp at the doors. It
  has its own camera bounds and indoor lighting.
- **The final walk** (`hallStep()`, `ignite()`, `cookerApproach()` in
  OverworldScene):
  - The doors boom shut and the Hall starts dark (`hallLight` drives the colour
    grade in AtmosphereScene). Letterbox bars and a vignette close in
    (`cinema()` in OverworldUIScene).
  - Running is disabled and walking is 1.45× slower until Cooker is beaten.
  - Three pairs of aisle braziers ignite at `HALL.igniteRows`, each with a
    flame sprite, embers and a light pool. Each pair brightens the Hall.
  - `hallWalk` (a slow heartbeat) switches to `hallWalk2` (a faster heart and
    rising brass) at the second pair.
  - No text interrupts the walk (no entry narration, no voice from the dark).
    The lighting, the music and the flames carry it, and repeat speedrun
    attempts aren't padded.
  - At `HALL.spotRow` the music cuts out and the camera pans to the dais. Every
    flame flares and Cooker's silhouette lights up. He walks down to two tiles
    away, and the camera returns to the player.
  - Choosing NOT YET or losing resets the Hall.
- **Checkpoints** (`src/systems/checkpoints.js`, `CHECKPOINTS` in map.js):
  - A blackout returns you to the nearest unlocked checkpoint by walking
    distance (a BFS over the map), not to the last Solace you saved at.
  - Unlocked checkpoints are town, the tile past each beaten Elite, and each
    Solace within 4 tiles of where you've walked.
  - The list lives in the save, so it survives reloads with the regular autosave.
  - A blackout in the Hall counts from the Hall doors.
- **Fire line**: Emby → Embrute (Lv 14, the upright biped, now with the
  supplied front art) → Emberfox (Lv 22, the fox, the final form). Old saves
  are migrated by swapping the two names (`fixFireLine` in save.js), so each
  creature keeps its stage.
- **Tall grass sound**: a synthesised rustle (`grassRustle` in audio.js):
  - A band-swept noise swish, plus about 20 short, randomly filtered and
    panned "blade" grains, plus a couple of stem ticks.
  - It plays as you push into each grass tile, shorter and denser when
    running, and bursts when something jumps out.
- **Personalities**: TJR (cocky), Ansem (arrogant) and Cooker (disrespectful)
  were toned down a notch, so the five read as five distinct attitudes rather
  than three flavours of smug.
- **Night and rain** tints were lifted slightly for readability.
- **Hall of Fame skip bug fixed**: the "ignore input for the first moment"
  guard used the scene clock, which reads 0 during `create()`, so mashing A
  through Cooker's defeat lines could skip the Hall of Fame. It's now a
  delayed flag.
- **Player assistance** (`src/systems/advice.js`):
  - Each Elite has a `rec` level (about a 70% win rate in the sim) and a
    `train` location in `src/data/trainers.js`.
  - Below `rec - 1`, the Elite warns you in their own voice, adds a form line
    if you'd normally have evolved by then, and offers BATTLE / NOT YET.
  - After beating you they coach you (where to train, to what level). If your
    level was fine, they give battle tips instead.
  - Beaten Elites and The Solace tell you the next objective.
  - Covered by `tools/logic_tests.mjs`. `tools/hall_walk.mjs` plays the walk,
    the NOT YET path and a loss.
- **Final battle arena**: a throne room drawn in `drawThroneRoom()` in
  BattleScene: an arched Sol window, a carpet, pillars, banners and ember-lit
  braziers.
- **Wild encounters**: leaves burst out of the grass and the camera pushes in,
  then two flashes and a spinning pinwheel wipe, then a curtain opens on the
  battle.
- **Night**: the soft glow that used to follow the player at night is gone. Only
  lamps, windows and braziers glow.
- **Tall grass**: taller, darker blades in four variants, swaying in three wind
  frames. It rustles near you, and at night, eyes blink inside it.
- **Front/back running**: the rig squashes the body into a crouch, sways it
  side to side and swings the arms harder. Side runs lean forward.
- **Music**: each Elite has an encounter theme and a battle theme. Evolution has
  its own build-up and fanfare.

### Refinement pass

- **Professor Mia** replaces the faceless intro. `tools/make_mia.py` turns the
  supplied art (`tools/src_art/professor_mia.png`) into a crisp pixel portrait:
  a fixed palette, a 5.12 px sampling grid, the black background flood-filled
  away and a 1-texel outline restored. The intro is five lines plus the name.
- **Wallet is required.** No skip on the profile screen; a save from before
  this rule asks for one when it loads; the profile editor won't save a blank.
- **Mouse everywhere.** Every "continue" accepts a click (`waitContinue()` in
  `ui/helpers.js`); menus tick on hover; Look/Starter cards highlight on hover.
  In the overworld, click a tile to walk there (breadth-first path, long trips
  run, a direction key takes over) or click a trainer, item, sign, door or
  landmark to walk up to it and use it. A MENU button sits bottom-left on PC.
  `tools/mouse_check.mjs` plays title to overworld with the mouse alone.
- **Controls legend** (PC only): `systems/hints.js` counts uses per control;
  learned rows leave, and the legend goes once all are known (or after ten
  minutes of play). Remembered per browser, not per save.
- **Movement.** The rig's front/back views now lean into the direction of
  travel: toward the camera the torso foreshortens and the head drops, away
  from it the back lengthens (`pitch_body()` resizes only the torso, so faces
  never squash). About-turns flash the side frame; starting a run or reversing
  mid-run kicks up dust; the shadow tightens on airborne frames; sand takes
  footprints.
- **The Elite Hall's grand staircase.** You enter a ground-level foyer; a
  wide marble staircase (13 tiles, ten steps, the carpet running up the middle
  with gold stair rods, balustrades with gold rails and finials) climbs to the
  raised main floor (`props3d.hall_stage`: floor, dais, stairs in one model).
  The map carries a height per tile (`HALL.stage`, `map.elev`); sprites are
  lifted by it while depth sorts on the ground, and steps only join tiles of
  similar height, so the floor is reached by the stairs alone. The braziers
  catch as you enter, as you climb and as you walk on; past `HALL.revealRow`
  the gate behind the dais opens and Cooker walks out (`cookerArrives()`).
- **Ambient life** (`scenes/ambient.js`): the windmill turns (eight sail
  frames), chimneys smoke, the fountain plays, the pond ripples and a fish
  jumps, butterflies, pecking birds that scatter, flocks overhead, falling
  leaves and petals; fireflies (through the light pass) and lamp moths at
  night; birdsong by day and crickets by night. View-culled and capped.

### Battle feel, settings, art pass

- **Battles**: a wind-up before every move; physical moves lunge, special
  moves throw a glowing orb, status moves raise an aura. Hits flash white for
  a beat (hit-stop), knock the target back, throw sparks and float the damage
  up (gold with ! on a critical); shake scales with the hit. Info boxes jolt,
  low HP pulses red, faints sag and puff dust.
- **Settings** (pause menu and title): music and sound-effect volume (0-10),
  text speed (slow / normal / fast), sound on/off. `systems/settings.js`,
  `ui/Settings.js`; kept per browser.
- **Art**: Professor Mia is resampled at twice the density and shown 1:1
  (thinner outline, crisper face, closer to the other portraits). The Hall
  gate is an arched gateway: marble columns, a gilded arch and keystone, the
  Sol mark; light glows through the closed doors' seam.
- **Rough edges**: the boss reveal no longer zooms (pixel art shimmers at
  in-between zooms); a small "Saved" mark shows on every save.

### Townspeople

- Nine townspeople from the art sheets `tools/src_art/townsfolk_1.png` and `townsfolk_2.png`:
  - Rafi (the cap kid) in the start town.
  - Auntie Pearl (shopping bags) on Market Row.
  - Tilly at the Market Square fountain.
  - Nell (bug net) at the fork.
  - Bram (net) on the Willow Pond bank.
  - Joss (farmer) by the windmill.
  - Hazel (berry bucket) by the well and cabin.
  - Pip (straw hat) among the northern houses.
  - Mr. Alder (gardener) in the Orchard.
- The second sheet's bottom-row action poses of the net boy, cap kid and farmer are not used; they repeat characters that are already in.
- `tools/make_townsfolk.py` builds the sprites to match the player and the Elites:
  - **One size.** Every townsperson is 48 art pixels tall, drawn 2x2: 96 texels, the player's height. Kids and adults alike, as in the handheld games.
    - Scale is set once per character, from its shortest view, so a net held overhead doesn't shrink the body.
    - Every sheet uses the same frame size (88 x 120), bottom-aligned.
  - **One style.** Source art comes in different styles (sheet 1 is finely detailed, sheet 2 chunky), so everything is reduced to the same art-pixel grid:
    - a median-of-block downscale;
    - a 28-colour palette;
    - a 1-art-pixel outline in the player's outline colour (26, 22, 34).
    - The 2-pixel antialiased rim, which carried the backdrop green, is shaved off first.
  - **Cutting.** It cuts the four views (or three: front, side, back, with the side mirrored) and keys out the backdrop.
    - Keying only removes green that touches the crop's edge, plus enclosed gaps that are truly backdrop-coloured, so teal clothes stay solid.
  - **Balls.** Red-and-white balls (in a hand, on a bag) are found at full resolution, where their red is pure: a red blob by hue, ball-sized, with white beside it, inside a height band.
    - Each ball is then repainted in the art pixels as the game's capsule, violet over mint.
  - **Facing.** It works out which way each side view faces; this can be pinned per character.
  - **Output.** It poses walk frames with the simple poser (limbs move by whole art pixels) and writes `public/assets/sprites/townsfolk/` and `src/data/townsfolkSprites.json`.
    - The badge's head square is set per character there.
  - **Adding people.** Add the sheet and an entry in `SHEETS`, then an entry in `src/data/townsfolk.js`.
- **Dialogue** (`src/data/townsfolk.js`): each person's lines come from who they are, what they wear and carry, their age and their corner of the route.
  - Rafi practises throws with his capsule; Auntie Pearl explains her pearls and her snack bag; Nell's goggles and jars; Hazel's gloves and berry bucket; Pip's grandpa's hat; Mr. Alder's shears.
  - Some lines point at real things nearby: hidden items, the potion by the mill, the pier.
  - Neighbours mention each other: Joss and Bram's caps, Hazel and Joss's oil can, Pearl and the boy in the blue cap.
  - Each person has four conversations in turn, plus lines for night, for rain, and for after Cooker falls.
    - The moment comes first, once per visit (after Cooker, then rain, then night); then the usual turn.
    - `{NAME}` is the player's name.
- `scenes/townsfolk.js` runs them:
  - They amble a few tiles at a time and look your way when you come near.
  - They stand still while you're facing them.
  - They never step onto your tile, the tile you're stepping into, or the next few tiles of a clicked path.
  - They avoid tall grass, doorsteps, signs and checkpoints.
  - They block their tile.
  - They freeze while anything is open.
- Talking:
  - Face one and press confirm, or click them; you walk over and follow if they move.
  - Clicks hit their drawn pixels; when two overlap, the one in front wins.
  - They hop when spoken to.
  - Walking into them only bumps.
  - A clicked path re-plans around anyone who wanders across it.
- `tools/townsfolk_check.mjs` checks:
  - talking by key and by click, for everyone;
  - the text shown;
  - the order: after Cooker with the name, then night, then the usual talk;
  - wander bounds, and no overlap with the player.

## 8. Engineering notes

- **Phones.** The page blocks double-tap zoom, pinch zoom, the long-press
  magnifier and selection, and context menus. It does this with the viewport
  settings, `touch-action`, `user-select`, `-webkit-touch-callout`, and
  non-passive touch handlers (`blockBrowserGestures()` in
  `src/systems/controls.js`). Text inputs keep their normal behaviour. Name entry and the wallet editor have
  on-screen OK/SAVE buttons, and the touch pad's A button submits too, so
  players never need the phone keyboard's Enter key. Holding B
  (keyboard X) while moving runs; tapping B is still Back. `tools/mobile_check.mjs`
  verifies this in Pixel 7 emulation. Real iOS Safari can't be tested from here,
  so try it on a phone.

- `window.__game` (a debug handle) is only exposed on the dev server or in builds
  made with `VITE_DEBUG=1`, which the smoke and tour scripts use. The normal
  `npm run build` that Vercel runs leaves it out.
- Pixelify Sans renders broken "fi"/"fl" ligatures on canvas. `main.js` patches
  `Text.setText` to insert a zero-width non-joiner.
- Saves are versioned (`SAVE_VERSION`). Bumping the version makes old saves
  unreadable; there's no migration yet.
