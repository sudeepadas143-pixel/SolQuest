# Step 0 — Asset Manifest

Source: `characters_.zip` → `characters /` (note the trailing space in the folder name).
36 image files. The `__MACOSX/` folder held 36 macOS resource-fork stubs (`._*`), not images; they were discarded.

**Global observations**

- **These are not game-ready sprites.** They are large (≈350–1776 px) upscaled pixel-art illustrations. The effective pixel grid differs from file to file: chibis use ~16–20 px blocks, battle poses ~10–13 px, creatures ~3–7 px. They are also not perfectly grid-aligned, which looks like AI upscaling. Everything will be keyed, cropped and re-sampled to a common in-game scale.
- **Only 2 files have real transparency** (`609E61A9`, `FA0CF62E`). The rest sit on solid backgrounds (white, teal, magenta, black, navy) that need chroma-keying. The 16 JPEGs have compression fringing, so their edges will need cleanup.
- **Most creature images carry a ✦ sparkle watermark** in a bottom corner, which looks like an image-generator mark. It sits over the background and will be removed during keying.
- **Several creature images are cropped screenshots.** A sprite touches the canvas edge in `IMG_4949` (top ear), `IMG_4954 2`, `IMG_4956`, `IMG_4958 2` and `IMG_4962` (left edge). Some also contain slivers of a neighbouring image: the right edge of `IMG_4954`, and the edges of `IMG_4958` and `IMG_4962`.
- **The `… 2.jpg` files are NOT duplicates.** Each is a different evolution stage from its same-named sibling.

Dims = file W×H. BBox = W×H of the non-background content.

---

## A. Humans

### A1. Playable characters

| File | Dims | BBox | Role (inferred) | Notes |
|---|---|---|---|---|
| `FA0CF62E-…4DC.PNG` | 1024×1536 | 450×1410 | **Player BOY – full-body portrait** (spiky black hair, dark hoodie, two-tone jeans, red sneakers, hands in pockets) | RGBA, transparent, with a soft dark halo |
| `EA65143C-…B37.PNG` | 1278×1230 | 414×652 | **Player BOY – overworld chibi, FRONT** (spiky hair) | Only one frame, no walk cycle |
| `3B1ACE55-…BCB.PNG` | 950×1655 | 570×1626 | **Player GIRL – full-body portrait** (long brown hair, sunglasses on head, black top/wrap skirt, sandals) | Black background; the top of the head touches the canvas edge |
| `609E61A9-…B3E.PNG` | 1312×1199 | 638×1022 | **Player GIRL – overworld chibi, FRONT** | RGBA, transparent. Only one frame |

### A2. Trainers (a "pointing + holding a capture ball" battle pose, plus a matching overworld chibi)

| ID | Battle pose file | Dims | Chibi (front) file | Dims | Look |
|---|---|---|---|---|---|
| T-A (**TJR**) | `151715CC-…B5C.PNG` | 1254×1254 | `3378E2C2-…A44.PNG` | 1254×1254 | Long curly hair, green sunglasses, white graphic tee, camo shorts |
| T-B (**Ansem**) | `195210FF-…FCE.PNG` | 1254×1254 | `992DF2BA-…EDE.PNG` | 1278×1230 | Short curly black hair, lavender tee, lanyard/badge, khaki pants |
| T-C (**Orangie**) | `64EC1B57-…7B7.PNG` | 1254×1254 | `887F1F1A-…683.PNG` | 1278×1230 | Curly brown hair, glasses, black hoodie, jeans |
| T-D (**Cooker**) | `cooker_sheet.png` (left half) — *replaces* `B369724A` | 1774×887 sheet | `cooker_sheet.png` (right half) — *replaces* `D0992FE5` | — | Curly brown hair, plain black tee (logo removed), dark pants |
| T-E (**Cented**) | `BA194F31-…D7E.PNG` | 1159×1358 | `6FA4B02E-…2C3.PNG` | 1254×1254 | Spiky/messy black hair, dark hoodie, two-tone jeans, red sneakers (**the same outfit as the player boy**) |

---

## B. Creatures

### B1. Fire family — orange ferret/fox, black wing-like ears, striped tail with a flame tip

| File | Dims | BBox | View | Stage |
|---|---|---|---|---|
| `IMG_4927.PNG` | 1024×1024 | 850×850 | FRONT | Stage 1 |
| `IMG_4928.jpg` | 926×946 | 826×844 | BACK | Stage 1 |
| `IMG_4950.jpg` | 516×659 | 482×572 | FRONT | Stage 2? (fluffy quadruped fox, fire tail) |
| `IMG_4953.jpg` | 511×660 | 482×588 | BACK | Stage 2? (matches 4950) |
| `IMG_4949.jpg` | 498×614 | 448×548 | BACK | Stage 3? (upright biped, flame shoulders, striped tail) — **NO FRONT** |

### B2. Water family — blue shark-dragon, white belly

| File | Dims | BBox | View | Stage |
|---|---|---|---|---|
| `IMG_4930.PNG` | 1008×1041 | 738×808 | FRONT | Stage 1 |
| `IMG_4931.jpg` | 1320×1135 | 966×846 | BACK | Stage 1 |
| `IMG_4954.jpg` | 661×986 | 628×816 | FRONT | Stage 2 |
| `IMG_4956.jpg` | 571×883 | 512×694 | BACK | Stage 2 |
| `IMG_4954 2.jpg` | 652×1020 | 626×934 | FRONT | Stage 3 (finned, darker, muscular) |
| `IMG_4956 2.jpg` | 545×881 | 526×792 | BACK | Stage 3 |

### B3. Grass family — teal otter with a leaf mane, hibiscus flowers and a spiral-leaf tail

| File | Dims | BBox | View | Stage |
|---|---|---|---|---|
| `IMG_4935.PNG` | 1024×1024 | 876×804 | FRONT | Stage 1 |
| `IMG_4936.jpg` | 1024×1024 | 900×794 | BACK | Stage 1 |
| `IMG_4958.jpg` | 357×603 | 346×522 | FRONT | Stage 2 (cream belly, smaller mane, 3 flowers) |
| `IMG_4962.jpg` | 348×634 | 344×506 | BACK | Stage 2 (smaller mane) — *pairing inferred* |
| `IMG_4958 2.jpg` | 481×580 | 470×522 | FRONT | Stage 3 (big mane, large central hibiscus) |
| `IMG_4959.jpg` | 483×594 | 470×500 | BACK | Stage 3 (big mane) — *pairing inferred* |

### B4. Single-stage creatures (FRONT only, no back view)

| File | Dims | BBox | Description |
|---|---|---|---|
| `IMG_4939.PNG` | 896×1195 | 608×1094 | Upright grey rabbit, white/orange ruff, boxer stance |
| `IMG_4941.jpg` | 1131×1288 | 978×1240 | White and green armoured blade-knight with a green flame plume and a glowing blade |
| `IMG_4945.jpg` | 1320×1776 | 1066×1674 | Dark purple humanoid, scorpion tail, pale-green crystal crest |
| `IMG_4946.jpg` | 1320×1295 | 986×1266 | Dark green armoured mantis, scythe arms |
| `IMG_4948.PNG` | 878×1216 | 728×1028 | Green reptilian humanoid with red crystal spikes. **Different art style and navy background**; no watermark |

---

## C. Missing entirely

- **No tileset of any kind:** no road, grass, tall grass, trees, houses, cars, signposts, fences, the boss building, interiors, or Hall of Fame props.
- **No back or side views for either player character.** Each has one front idle frame, so 4-directional walk cycles cannot be built from the supplied art.
- No back or side overworld frames for the trainers. They are static front-facing NPCs, so this is fine.
- No UI art. This is expected: the UI will be drawn in code.

---

## D. Flags / ambiguities (need your call)

1. **Walk cycles are missing** (see C).
2. **There are 6 opponents (T1–T5 + Cooker) but only 5 trainer designs** (T-A to T-E). Which one is Cooker, and what are the T1–T5 assignments?
3. **T-E looks like the player boy** (same hoodie, two-tone jeans and red sneakers). Is `BA194F31` + `6FA4B02E` a separate trainer, or alternate player-boy art?
4. **The T-D hair doesn't match:** the battle pose has brown curly hair, while the chibi `D0992FE5` has black straight/bowl hair. Both wear the OKX tee. Same person?
5. **Fire family stage order is unclear.** I also have no FRONT for `IMG_4949`, so that creature can only appear as the player's own creature (back view) and never as an opponent.
6. **The grass stage 2/3 back views are paired by best guess.**
7. **Brand/IP marks in the art:** the red-and-white capture ball in all 5 trainer poses is Nintendo's Poké Ball design, and T-D's shirt carries the real **OKX** logo.
8. **`IMG_4948` has a different art style** from the rest of the creature set.

---

## E. Resolved after review (confirmed by the owner)

- **Walk and run cycles:** 4-direction turnaround sheets were supplied (`raw_assets/boy_turnaround.png`, `raw_assets/girl_turnaround.png`). The boy's sheet draws both side views facing left, so a separate right-facing view was supplied (`raw_assets/boy_right.png`). `tools/charsprites.py` builds the sprites from these at source fidelity, about 96 px tall, with posed walk and run cycles. `EA65143C` and `609E61A9` (the old single-frame chibis) are superseded and unused.
- **Trainers:** every Elite and Cooker gets a seeded-random design (A–E) and a seeded-random team drawn from the non-starter creatures. The "who's who" mapping will be pinned in `src/data/trainers.js` once it's posted.
- **Fire family order:** `IMG_4927` → `IMG_4950`/`IMG_4953` → `IMG_4949` (Emby → Emberfox → Embrute). Starter families are player-only, so the missing Embrute front view only affects the summary card and Hall of Fame, which fall back to the back view.
- **No catching.**
- **Capture ball:** recoloured to the Solana purple→green gradient with a dark lower half, in all 5 trainer battle poses.
- **Cooker** is a character (the final boss), not an object.
- **Tileset/props:** placeholders until real art arrives (see BUILD_NOTES §5).

## F. Final creature names

| Files (front / back) | Name | Type | Tier |
|---|---|---|---|
| IMG_4927 / IMG_4928 | Emby | Fire | starter |
| IMG_4950 / IMG_4953 | Emberfox | Fire | mid |
| — / IMG_4949 | Embrute | Fire | trainer |
| IMG_4930 / IMG_4931 | Sharkpup | Water | starter |
| IMG_4954 / IMG_4956 | Sharkjaw | Water | mid |
| IMG_4954 2 / IMG_4956 2 | Sharkrex | Water/Dragon | trainer |
| IMG_4935 / IMG_4936 | Fernie | Grass | starter |
| IMG_4958 / IMG_4962 | Fernbloom | Grass | mid |
| IMG_4958 2 / IMG_4959 | Fernking | Grass | trainer |
| IMG_4939 | Boxbun | Fighting | trainer |
| IMG_4948 | Rubyclaw | Dragon/Rock | trainer |
| IMG_4941 | Glowblade | Ghost/Steel | boss |
| IMG_4945 | Scorpix | Poison/Dark | boss |
| IMG_4946 | Mantek | Bug/Steel | boss |

- **Cooker (design D)**: updated art supplied as one side-by-side sheet (`raw_assets/cooker_sheet.png`). The pipeline splits it into `raw_assets/_derived/`. The old D files are superseded. Cooker's overworld sprite is rendered at 26 px tall so the eyes survive the downscale.
