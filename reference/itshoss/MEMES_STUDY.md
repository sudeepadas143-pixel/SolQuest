# HOSS memes: deep study

All 15 images in `memes/`, studied with the `image-style-recovery` skill's analysis steps (metadata read,
pixel statistics, structured style rubric, zoomed crops). **Nothing was generated.**

---

## 1. What the files can tell us (and can't)

- All 15 are **896×896 WebP, RGB, no EXIF / XMP / C2PA / PNG text**. The site's author re-encoded them for the
  web (`script-2.js` calls them "896 px, from the user's HONKS/illus set"), which stripped any generator
  metadata. **The original prompts and settings are unrecoverable**; everything below is read from the pixels.
- Grain is near zero everywhere (`flat_area_noise` 1–2): they were cleaned / denoised, not raw captures.
- They are almost certainly **AI-generated or AI-edited** (hedged; pixels alone can't prove it):
  - **14** has the classic AI tell: the big skyline poster's lettering is garbled pseudo-glyphs, while the small
    hand-written note "SAME GUY BIGGER PLANS" with a crown is perfectly legible. That mix (clean short text,
    garbled long text) is typical of current image models such as gpt-image / Nano Banana.
  - **13**'s beer-poster small print is fake words under a legible headline.
  - **08** is a low-poly character composited onto a photographic night skyline with AI smoothing in the
    building windows.
  - The **same character** is reproduced across 5 different game engines/eras with consistent proportions,
    tie, suit and head markings: the signature of character-reference image editing, not hand modding.
- Most likely workflow (inference, not proof): a fixed character reference (the HONK model, which also exists as
  `honk.glb` on the site) + an image model that accepts references, prompted per scene "as a screenshot from
  <game era>", then cropped square and exported to WebP.

---

## 2. The formula (why the set works)

**One deadpan office worker × iconic video-game chaos × a corporate-life caption.**

1. **Same character, every frame.** Horse head, business suit. Never changes outfit, never emotes much.
   The joke comes from the *situation*, not the face.
2. **Every image wears a different, recognisable game look.** The viewer's brain does the work: "that's the
   PS2 crime game", "that's Garry's Mod", "that's the 2008 grey city". Nostalgia is the hook.
3. **The caption reframes crime-game action as 9-to-5 life.** From the site's code, each meme reads
   `It's {a} {name}. {ask}`:

| # | File | Title | Caption question |
|---|---|---|---|
| 1 | 01-hood-slide | a Hood Slide | Late for the 9 a.m.? |
| 2 | 02-getaway | the Getaway Commute | Is that a deadline behind you? |
| 3 | 03-payphone | a Payphone Pitch | Pick up, it might be the boss? |
| 4 | 04-canal | a Canal View | Thinking about Q4? |
| 5 | 05-bag-check | a Bag Check | Lunch is in here somewhere? |
| 6 | 06-home-video | a Home Video | Roll the tape? |
| 7 | 07-wrong-way | the Wrong Way | Left, he says? |
| 8 | 08-rooftop | a Rooftop Break | Five more minutes? |
| 9 | 09-red-rocket | the Red Rocket | Express delivery? |
| 10 | 10-office-hours | Office Hours | Do not disturb? |
| 11 | 11-night-stroll | a Night Stroll | Taxi or legs? |
| 12 | 12-supply-run | a Supply Run | Got the snacks? |
| 13 | 13-bull-market | a Bull Market | Buy high, neigh low? |
| 14 | 14-work-from-bed | Work From Bed | Camera off? |
| 15 | 15-parking-duty | Parking Duty | Guarding the good spot? |

Title = two-word noun phrase naming the scene. Question = a work cliché or pun that the image answers. Crypto
lands lightly (13's trading terminal, 14's laptop chart, the "neigh" pun) instead of being the whole joke.

---

## 3. Character bible (keep these exact or it stops being the same guy)

| Part | Spec | Measured colour |
|---|---|---|
| Head | realistic-ish **horse head**, chestnut brown, white blaze/stripe down the face, dark spiky forelock between upright ears, glossy dark eyes; reads like a rubber horse mask / low-poly game model | chestnut `#7a4d31`–`#9b5d31` |
| Body | human, average build, **brown human hands** | |
| Suit | dark **charcoal two-piece suit**, single-breasted, always buttoned or open, never another colour | `#1d1917`–`#3f3830` |
| Shirt | white / off-white dress shirt, cuffs showing | off-white |
| Tie | **burgundy / maroon** narrow tie (flies loose in action shots) | `#52272f`–`#582c2f` |
| Shoes | black dress shoes | |
| Attitude | deadpan; mouth slightly open at most (10, 14); finger-guns (07) are the biggest gesture | |

Props rotate (phones, cigar, coffee cup, guns, briefcase-bag) but the outfit never does. The one break, **10**
(trousers down on the toilet, grey boxers), works *because* everything above the waist stays on-model.

---

## 4. Per-meme breakdown

Game-look labels describe what each image imitates; they're my reading, not stated by the author.

| # | Look imitated | Scene / action | Camera | Light & grade | Stats (sat / warmth / detail) |
|---|---|---|---|---|---|
| 01 | **HD 2008 crime game** (grey NYC-like city, yellow cab) | slides over the hood of a crashed taxi, ragdoll pose | low 3/4, action freeze | flat overcast, desaturated grey-brown | 0.18 / 0.00 / 0.08 |
| 02 | **HD 2008–2013 crime game** | driving calmly while a man fires at him from the next car | driver's-side window, through glass | low golden sun, muzzle flash, tracer streaks | 0.25 / 0.04 / 0.07 |
| 03 | **Source / SFM render** | leaning on a payphone inside a red phone box, legs crossed | eye level, centred, tight | soft, flat, saturated reds | 0.46 / 0.14 / 0.05 |
| 04 | **PS2 sandbox, LA-style storm canal** | back to camera, hands on the bridge rail, looking at the canal | over the shoulder | hazy daylight, bleached | 0.20 / 0.02 / 0.09 |
| 05 | **clean 3D render** | reaching *into the camera*, holding a yellow coiled phone | **POV from inside a paper bag** | white blown-out sky, warm kraft paper | 0.40 / 0.19 / 0.04 |
| 06 | **cinematic film still** (not a game) | filming himself; flip-screen shows him in teal tiles | over the camcorder, shallow depth of field | green tiled room, teal grade, film look | 0.37 / −0.03 / 0.06 |
| 07 | **Source / GMod night map** | sliding down a stair rail doing finger-guns under a "turn left" sign | worm's-eye, dutch | dark navy night, hard flash-like key | 0.34 / 0.01 / 0.09 |
| 08 | **photo composite** | lounging on a rooftop ledge, head on hand | eye level, wide | sodium-orange smoggy night skyline | 0.42 / 0.10 / 0.05 |
| 09 | **PS2 80s-Miami sandbox** | wheelie on a red sports bike with a compact SMG, tie flying | low angle, close | flat cyan sky, palm trees, no shadows | 0.44 / **−0.19** / 0.10 |
| 10 | **Source / SFM interior** | on the toilet, cigar, scrolling phone, smoke | eye level, close | soft bathroom light, sage-green tiles | 0.33 / 0.09 / 0.06 |
| 11 | **Japanese-city action game** (Tokyo street, tower, katakana neon) | walking toward camera past a stranger | over a passer-by's shoulder | overcast daylight, paper lanterns, blue neon sign | 0.22 / 0.01 / 0.11 |
| 12 | **PS2/Xbox-era interior** | striding down a supermarket aisle with an orange box, shoe sole in your face | **extreme worm's-eye** | flat fluorescent | 0.27 / 0.07 / 0.10 |
| 13 | **HD 2008 crime game office** | trading on a CRT showing candle charts and an order book | over the shoulder | dim office, pink/green monitor glow | 0.32 / 0.06 / 0.07 |
| 14 | **modern stylised 3D** | WFH in bed, phone charging, cat asleep, LA skyline out the window | high angle, wide | warm afternoon sun through blinds | 0.36 / 0.10 / 0.12 |
| 15 | **PS2 sandbox suburb** | leaning on a black sports car with a rifle, chain-link fence | eye level, centred | flat late-day light, pixelated tree sprites | 0.38 / 0.14 / 0.12 |

### The five look families

1. **PS2 sandbox (04, 09, 12, 15)**: low-poly geometry, blurry low-res textures, billboard/sprite trees
   (visible as pixel blocks in 15), flat bright sky, weak or no shadows, big readable shapes.
2. **HD 2008 grey city (01, 02, 13)**: desaturated brown-grey grade, bloom, overcast skies, ragdoll physics
   poses, denser detail.
3. **Source engine / SFM / GMod (03, 05, 07, 10)**: smooth shading with soft ambient occlusion, clean
   mid-poly props, "posed puppet" body language (frozen mid-gesture), slightly plasticky skin.
4. **Modern stylised 3D (11, 14)**: higher-fidelity textures, real sunlight and shadows, richer set dressing.
5. **Mixed media (06, 08)**: game character placed into a photographic / cinematic world (film grade, shallow
   depth of field, real skyline).

Spread: 4 + 3 + 4 + 2 + 2. Variety of *look* is the point; no two neighbours in the carousel share a family.

---

## 5. Visual rules the set follows (reuse these)

- **Square 1:1, subject in the middle third**, usually filling 40–70% of the frame. It reads at thumbnail size.
- **Camera is always doing something**: worm's-eye (07, 12), POV from an object (05), through a device (06),
  over-the-shoulder (04, 11, 13), action freeze (01, 09). Plain eye-level is rare (03, 10, 15).
- **One saturated accent per image** against muted surroundings: yellow taxi (01), red booth (03), yellow phone
  (05), red bike (09), orange box (12), blue neon (11), green chart (13). The burgundy tie is the constant.
- **Brightness kept low-to-mid** (mean luminance 0.17–0.46, most 0.2–0.35): moody, game-screenshot, never
  bright stock-photo.
- **No captions or watermarks baked in.** Text lives in the site UI, so the images stay reusable.
- **Weapons appear (02, 09, 15) but are never pointed at the viewer**, and nobody is hurt on screen. Chaos
  is implied; the horse stays calm.

---

## 6. If you want to make your own set in this vein

The transferable part is the formula, not the assets. Use **your own character** (the horse, the suit and
the HONK/HOSS name belong to that project), and describe game *eras* rather than naming franchises or
copying trademarked in-game brands. (13's "Pißwasser" beer poster is a real game company's fictional brand,
for example.)

**Character sheet first.** Make one clean front/side/back reference of your character and reuse it as the
reference image for every scene. That is what keeps 15 images "the same guy".

**Scene prompt template** (natural-language models: FLUX.2, Nano Banana, gpt-image), with the character
sheet attached as reference:

```
A square in-game screenshot from a {ERA LOOK}. {CHARACTER: same character as the reference image, unchanged
outfit}, {ACTION}, in {SETTING}. Camera: {CAMERA}. Lighting: {LIGHT}. One strong accent colour: {ACCENT}.
Authentic {ERA} rendering: {ERA DETAILS}. No text, no UI, no watermark.
```

Era detail snippets that match the five families:

| Family | {ERA LOOK} | {ERA DETAILS} |
|---|---|---|
| PS2 sandbox | early-2000s PlayStation 2 open-world crime game | low-poly models, blurry low-resolution textures, flat-shaded sky, sprite trees, hard draw distance, no real-time shadows |
| HD 2008 city | 2008 HD open-world game set in a grey east-coast city | desaturated brown-grey colour grade, bloom, overcast light, ragdoll physics pose |
| Source / SFM | 2000s Source-engine sandbox / machinima render | smooth shading, soft ambient occlusion, clean mid-poly props, posed puppet-like body |
| Modern stylised | modern stylised 3D game | detailed textures, warm sunlight through windows, soft shadows, cosy set dressing |
| Mixed media | a low-poly game character composited into a real photograph | photographic background, film grain, shallow depth of field, cinematic grade |

**Caption template**: `It's {a/the} {Two-Word Scene}. {Work cliché or pun as a question}?` Write the
caption first, then design the image that answers it.

**Checklist per image** (the skill's "visual anchors" for this set):
1. Character on-model (head markings, charcoal suit, burgundy tie, brown hands).
2. Era look unmistakable within one second.
3. A camera angle that isn't plain eye level.
4. One saturated accent colour.
5. The caption's joke is readable from the image alone.

To check a batch against the originals' look without generating anything new, run
`compare_images.py` from the skill on your images vs. any meme here (`--deep` for the CLIP score).
