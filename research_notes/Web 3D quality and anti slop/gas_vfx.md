# Stylized real-time gas / smoke / cloud VFX for a three.js site (late 2026)

Scope: what to use to make the hero's thick green toxic fart gas look good. It trails behind a skateboarder, envelops police cars, bursts in a "mega fart", steams out of a manhole, and fills the screen in a transition. The site has a Pixar/Nintendo-toy look, must hold 60fps on desktop, and must run on mid-range phones. The current version uses instanced camera-facing quads with one canvas radial-gradient texture and normal alpha blending, so it reads as flat green circles.

Repo metadata comes from `gh api -X GET search/repositories` run on 2026-11-26. "pushed" is the last push date. Some repo lookups failed (GitHub search rate limit, and the `repos/` endpoint is blocked in this session); those are listed under Gaps. unity.com is not reachable from this session.

## Particle/VFX libraries for three.js: which are maintained and good?

### Takeaway
Three libraries are actively maintained and fit this project. **three.quarks** is the most complete, with a Unity-Shuriken-style feature set and a new WebGPU/TSL batch renderer. **mustache-dev/Three-VFX** is GPU-compute (WebGPU) with soft particles, flipbooks, curl noise and lit modes. **wawa-vfx** is simpler and suits R3F. three-nebula is still maintained but older in design. The three.quarks editor is stale (last pushed 2023). For a "star of the show" effect, the library matters less than the shading; whichever library you pick, you will still write a custom material (see the next sections).

### Cited Findings
**Ranked table (repo metadata from GitHub search, 2026-11-26)**

| Rank | Repo | Stars | Last push | Notes |
|---|---|---|---|---|
| 1 | [Alchemist0823/three.quarks](https://github.com/Alchemist0823/three.quarks) | 1311 | 2026-11-18 | "General purpose particle system / VFX engine for three.js". Active. |
| 2 | [mustache-dev/Three-VFX](https://github.com/mustache-dev/Three-VFX) | 155 | 2026-02-24 | WebGPU compute particles; R3F/TresJS/Threlte. About 9 months since last push. |
| 3 | [wass08/wawa-vfx](https://github.com/wass08/wawa-vfx) | 158 | 2025-09-23 | R3F + vanilla packages. About 14 months since last push. |
| 4 | [creativelifeform/three-nebula](https://github.com/creativelifeform/three-nebula) | 1253 | 2026-10-22 | WebGL particle engine; mature, older architecture. |
| 5 | [verekia/tslfx](https://github.com/verekia/tslfx) | 115 | 2026-11-19 | "Early-stage collection of VFX, utils, and SDFs for TSL". A useful snippet source. |
| – | [Alchemist0823/three.quarks-editor](https://github.com/Alchemist0823/three.quarks-editor) | 34 | 2023-01-27 | **Stale** repo for the editor. |
| – | [reifier-k/nachi](https://github.com/reifier-k/nachi) | 2 | 2026-10-12 | "TSL/WebGPU-native VFX, Niagara-style staged simulation". Tiny and experimental. |
| – | [jango-git/sparcoon](https://github.com/jango-git/sparcoon) + [sparcoon-editor](https://github.com/jango-git/sparcoon-editor) | 0 | 2026-11-26 | Node-based VFX editor that exports a TS module with "one draw call per" effect. Brand new, unproven. |
| – | [painh/unityprefabtoquark](https://github.com/painh/unityprefabtoquark) | 0 | 2026-09-19 | Converts Unity ParticleSystem prefabs to three.quarks. |
| – | [brunosimon/three.js-tsl-particles-system](https://github.com/brunosimon/three.js-tsl-particles-system) | 107 | 2024-06-26 | Reference TSL particle code (stale). |

**three.quarks details**
- The changelog lists these, newest first. Version 0.18.0: "Add `three.quarks/webgpu`: batch renderer for three.js `WebGPURenderer`, built on TSL node materials", which also runs on the WebGL2 fallback. Soft particles "read the framebuffer depth automatically, so the depth pre-pass WebGL needs is gone". "Sprite sheets with frame blending". Trails use 16-bit indices. 0.17.0 adds WebGPU shader support. 0.14.0 split the code into quarks.core / quarks.nodes / three.quarks. Earlier versions added soft particles and UV blend tiles (0.12.0) and burst emission on emitter shapes (0.12.2). — [three.quarks CHANGELOG](https://raw.githubusercontent.com/Alchemist0823/three.quarks/master/CHANGELOG.md)
- The editor is a WYSIWYG tool for previewing and adjusting particle systems and exporting JSON. — [npm three.quarks-editor](https://www.npmjs.com/package/three.quarks-editor)
- babylon.quarks has a Shuriken-style editor, supports WebGL and WebGPU, and historically derives from three.quarks. — [libraries.io babylon.quarks-editor](https://libraries.io/npm/babylon.quarks-editor); [Babylon forum](https://forum.babylonjs.com/t/babylon-quarks-particles/63367)

**Three-VFX (mustache-dev) details**
- Simulates on the GPU with compute shaders, sorts by depth with a GPU bitonic sort on WebGPU, and falls back to the CPU on WebGL. Also has optional soft particles (default fade distance 0.5 units), flipbooks (rows x cols), curl-noise turbulence, three lighting modes (BASIC / STANDARD / PHYSICAL) and shadow casting and receiving. A debug panel generates code. Default max 10,000 particles. MIT. Publishes no benchmark numbers. — [GitHub README](https://github.com/mustache-dev/Three-VFX)

**wawa-vfx details**
- Ships two packages: `wawa-vfx-vanilla` (plain three.js) and `wawa-vfx` (R3F components `VFXParticles` / `VFXEmitter`, with Leva controls). It is the engine built in Wawa Sensei's paid R3F course, whose VFX chapter has 8 lessons on particles, trails, the engine, fireworks and WebGPU/TSL. — [dev.to announcement](https://dev.to/wawasensei/wawa-vfx-open-source-vfx-particle-system-for-react-three-fiber-projects-151l); [unpkg README 1.2.10](https://unpkg.com/wawa-vfx@1.2.10/README.md)

**three.js built-in WebGPU/TSL compute particles**
- The official examples `webgpu_compute_particles`, `webgpu_compute_particles_rain` and `webgpu_tsl_compute_attractors_particles` show the compute features. There is also an MLS-MPM fluid example that only works in WebGPU, not with the WebGL fallback. — [three.js forum](https://discourse.threejs.org/t/webgpu-compute-shaders-support/66758); [forum: learning compute shaders in TSL](https://discourse.threejs.org/t/learning-compute-shaders-in-tsl/90013); [Maxime Heckel, Field Guide to TSL and WebGPU](https://blog.maximeheckel.com/posts/field-guide-to-tsl-and-webgpu/)
- In three.js, three.js docs say that when you use `WebGPURenderer` you write custom materials in TSL rather than raw GLSL. — [three.js TSL wiki](https://github.com/mrdoob/three.js/wiki/Three.js-Shading-Language)
- Main repo: [mrdoob/three.js](https://github.com/mrdoob/three.js) has 119,454 stars and was pushed 2026-11-26.

### Inferences
- **Recommended:** three.quarks, using `three.quarks/webgpu` when you are on `WebGPURenderer`, or the classic batch renderer on WebGLRenderer. It is the most mature emitter/curve/burst/trail system and the only one with a (dated) visual editor and a Unity-prefab converter. Its built-in soft particles and frame-blended flipbooks cover two of the biggest anti-slop fixes out of the box.
- The fart trail needs only a few hundred to a couple thousand large puffs. GPU compute (Three-VFX, raw TSL compute) is not needed for particle count, because fill-rate/overdraw will be the bottleneck on phones, not simulation. Pick a library for authoring ergonomics and custom-material hooks, not raw throughput.
- An in-house approach is also very viable: keep your existing InstancedMesh, replace the texture and shader, and drive puffs with your own simple CPU sim. The current "slop" problem is shading and texture, not the particle engine.

### Gaps
- Could not get the three.quarks editor's live web URL or confirm whether it supports the 0.18 WebGPU features. The editor repo itself is stale.
- No library publishes mobile fps benchmarks.
- Release dates for three.quarks 0.17/0.18 are not in the changelog. The push date (2026-11-18) shows it is active.

## Better billboard smoke: flipbooks, soft particles, lighting, noise, toon shading

### Takeaway
The biggest quality jump for the least cost is to keep billboards and change four things. (1) Replace the radial gradient with a real puff texture or flipbook: CC0 options include Kenney, OpenGameArt, JangaFX/EmberGen and Unity Labs. (2) Add depth-fade soft particles. (3) Light the puffs with a normal map or six-way maps, then quantize the lighting to 2-3 toon bands with a rim. (4) Animate shape and dissolve with noise-distorted UVs and alpha erosion, and move puffs with curl noise. Billboards stay the cheapest option on phones.

### Cited Findings
**Free smoke textures and flipbooks**
- **Kenney "Smoke Particles"**: 70 files, CC0, free. — [kenney.nl/assets/smoke-particles](https://kenney.nl/assets/smoke-particles)
- **Kenney "Particle Pack"**: 80 sprites (particles, light cookies), CC0, with Unity samples for fire, smoke, magic and sparks. — [kenney.nl/assets/particle-pack](https://kenney.nl/assets/particle-pack); mirror at [Godot asset library](https://godotengine.org/asset-library/asset/784)
- OpenGameArt hosts CC0 smoke particle assets and sprite sheets. — [OpenGameArt smoke particle assets](https://opengameart.org/content/smoke-particle-assets); [smoke sprite sheet](https://opengameart.org/content/smoke-sprite-sheet)
- **JangaFX** released 6 free fire/smoke/explosion sims (2020) and later 15 smoke/fire/dust sims of 120-250 frames plus 10 static clouds (2022). They are in **VDB format, CC0**, generated in EmberGen. Being volumes, not flipbooks, you would render them to a flipbook yourself (for example in Blender or EmberGen). — [CG Channel 2020](https://www.cgchannel.com/?p=113054); [CG Channel 2022](https://www.cgchannel.com/2022/04/download-15-free-smoke-fire-and-dust-sims-in-vdb-format)
- **Unity Labs** released free VFX image sequences/flipbooks authored in Houdini under a **CC0 license**. — [Unity blog: Free VFX image sequences and flipbooks](https://unity.com/blog/engine-platform/free-vfx-image-sequences-flipbooks) (search snippet only; the page could not be fetched from this session)
- Other free stylized sprite packs exist on itch.io (e.g. Kalponic "Free Stylized Sprite VFX", Brackeys VFX bundle). Check each license. — [Kalponic](https://kalponic-studio.itch.io/free-stylized-sprite-vfx/purchase); [Brackeys VFX bundle](https://brackeysgames.itch.io/brackeys-vfx-bundle); [itch.io open-source VFX collection](https://itch.io/c/4909438/open-source-vfx)
- Stylized smoke textures can be authored in Substance Designer. — [RealtimeVFX: Stylized Smoke Texture breakdown](https://realtimevfx.com/t/stylized-smoke-texture-substance-designer-breakdown/30038)

**Six-way lighting**
- Six-way (six-point) lighting stores per-direction light masks in the colour channels of two flipbook textures (light from +X/-X/+Y/-Y/+Z/-Z). The shader blends them by the light direction so a 2D flipbook responds to scene lights. — [O3DE six-point lighting tutorial](https://docs.o3de.org/docs/learning-guide/tutorials/rendering/six-point-lighting-tutorial/); [RealtimeVFX: EmberGen 6 point light](https://realtimevfx.com/t/embergen-6-point-light/28544)
- A commercial Unity shader for EmberGen flipbooks supports six-point lighting and requires EmberGen's "Gradient Normal Maps". — [Unity Asset Store: Flipbook shader for EmberGen](https://assetstore-fallback.unity.com/packages/vfx/shaders/flipbook-shader-for-embergen-276899)
- A Godot 4 six-way volumetric shader repo exists (38 stars, **archived**, pushed 2025-04-24). Its shader code could be ported. — [TheAenema/Godot-Six-Way-Volumetric-Shader](https://github.com/TheAenema/Godot-Six-Way-Volumetric-Shader)
- I found no ready-made three.js six-way smoke shader. — (search for "EmberGen six-way lighting flipbook three.js shader" returned none)

**Soft particles (depth fade)**
- three.quarks ≥0.18 and Three-VFX have soft particles built in (see above).
- Small, old three.js demos: [takumifukasawa/threejsSoftParticleDemo](https://github.com/takumifukasawa/threejsSoftParticleDemo) (11 stars, 2021) and [DolphinIQ/Three.js-soft-particles](https://github.com/DolphinIQ/Three.js-soft-particles) (1 star, 2019; "Just some toxic fog", which is coincidentally on-theme).

**Toon / cel smoke**
- **McGuire & Fein, "Real-time cartoon rendering of smoke" (NPAR 2006 / SIGGRAPH 2004 poster).** Smoke particles are billboards with a shaded puff texture whose **normal maps drive two-tone (cel) shading**; **outlines come from depth differences**, and the method also has self-shadowing. — [paper PDF](https://faculty.digipen.edu/~gherron/references/References/NPR/mf-2006-toonsmoke.pdf); [SIGGRAPH poster](https://history.siggraph.org/wp-content/uploads/2023/01/2004-Poster-026-Mcguire_Real-Time-Cartoon-Rendering-of-Smoke.pdf). This is the most directly relevant technique for "thick cartoon fart cloud".
- Soenke Seidel's Unity breakdown recreates Breath of the Wild's swirling cloud dissolution. He extracted BotW frames to study how the dissolution steps frame by frame. — [80.lv: Creating stylized combat VFX in the Zelda style](https://80.lv/articles/creating-stylized-combat-vfx-in-the-zelda-style/); also [80.lv: Making Zelda-like VFX with Unity](https://80.lv/articles/making-zelda-like-vfx-with-unity)
- A BotW remote-bomb recreation uses a Shader Graph explosion shader plus a VFX Graph particle setup. — [infraredapple/shaders-botw-bomb](https://github.com/infraredapple/shaders-botw-bomb)
- A Velan Studios tech-VFX article on a smoke puff notes that the noise texture largely decides the puff's shape. — [Medium: Tip of the Brush](https://medium.com/velan-studios/tip-of-the-brush-the-joy-of-technical-vfx-4ba15deba9fe)
- Other stylized smoke references: [80.lv: stylized 3D smoke pillar VFX](https://80.lv/articles/how-to-create-stylized-3d-smoke-pillar-vfx), [Godot Shaders: Stylized Smoke Shader](https://godotshaders.com/shader/stylized-smoke-shader/), [Godot Shaders: Stylized 3D Fire and Smoke](https://godotshaders.com/shader/stylized-3d-fire-and-smoke/), [UE community tutorial: Procedural Stylized Smoke](https://forums.unrealengine.com/t/community-tutorial-procedural-stylized-smoke/593751), [UE 5.5 Niagara Toon Explosion tutorial](https://forums.unrealengine.com/t/community-tutorial-unreal-engine-5-5-toon-explosion-complete-step-by-step-niagara-tutorial/2843653), [RealtimeVFX: Zelda BotW VFX](https://realtimevfx.com/t/zelda-breath-of-the-wild-vfx/1439).
- A UE4 campfire breakdown cites a Fortnite talk on how Epic made its smoke puffs. I did not find the Fortnite talk itself. — [80.lv: campfire VFX in UE4](https://80.lv/articles/creating-a-campfire-vfx-in-ue4)

**Noise-driven smoke in three.js (tutorials)**
- Three.js Journey has a "Coffee Smoke" shader lesson (Perlin-texture UV scrolling plus vertex twist on a plane) and a WebGPU/TSL version. Both are paid. — [Coffee smoke (GLSL)](https://www.threejs-journey.com/lessons/coffee-smoke-shader); [Coffee smoke (TSL)](https://threejs-journey.com/lessons/webgpu-tsl/coffee-smoke)
- Brad Woods' garden has a cigarette-smoke shader built from a Perlin noise texture on a plane. — [Shaders 103 – smoke](https://garden.bradwoods.io/notes/javascript/three-js/shaders/shaders-103-smoke)
- Codrops (2020, by Robert Borghesi) builds a procedural cloud on a Sprite material with FBM for a smoky border and simplex noise for shape morphing. — [Codrops: Procedural clouds using three.js sprites](https://tympanus.net/codrops/2020/01/28/how-to-create-procedural-clouds-using-three-js-sprites/)
- One recent tutorial still recommends the canvas radial-gradient + `depthWrite:false` approach. That is exactly the "slop" baseline the project wants to leave behind. — [Shane Brumback: Three.js smoke effect](https://www.shanebrumback.com/articles/threejs-smoke-effect.html)
- I found no 2025-2026 Codrops tutorial specifically on stylized smoke. — (search returned only the 2020 piece)

### Inferences
**Concrete recipe: "toon puff billboard" shader**, ranked as the best fit for the trail, the police-car envelope and the manhole steam.
1. **Texture:** a 2-4 frame set of lumpy cauliflower puff silhouettes. Hand-paint them, take Kenney CC0, or render displaced spheres in Blender. Store **alpha in A and a baked sphere-ish normal in RGB** (McGuire-style normal-mapped puff). If you want "real" volume detail, use an EmberGen/Unity Labs flipbook (CC0) with frame blending.
2. **Lighting:** N·L from the normal map, using the scene's key light direction transformed into billboard space. Then `smoothstep`-quantize it into 2-3 bands of a green ramp: dark olive core shadow, toxic lime mid, pale yellow-green highlight. Add a Fresnel-like rim from the normal's Z, and optionally a subtle emissive "glow" band so it reads as toxic.
3. **Shape over life:** alpha erosion. Threshold `alpha * noise` against a lifetime-driven value with a hard `smoothstep(t, t+0.05)` edge, so puffs "eat away" in a crisp cartoon way instead of fading to transparent mush. This is the BotW dissolution look.
4. **Motion:** scale up with an ease-out-back pop on spawn, add drag, slow upward drift and curl-noise turbulence, and rotate a little per puff. Emit along the trail with inherited velocity.
5. **Soft particles:** fade alpha by `(sceneDepth - fragDepth)` so puffs don't show hard intersections with the road and the police cars.
6. **Outline (optional, very "Nintendo"):** either a darker rim band in the ramp (cheap), or McGuire-style depth-discontinuity outlines in a post pass over a separate smoke depth/ID buffer.
7. **Blending:** premultiplied alpha. Sort back-to-front per emitter (you already do), and keep normal (not additive) blending so the gas reads as thick and opaque.

Cost: this is one instanced draw per material and one texture fetch plus a noise fetch per pixel. On phones it is bounded by overdraw, so use fewer, bigger, more opaque puffs and render at reduced resolution where needed (see the final section).

## Volumetric approaches: raymarched noise, SDF/metaball puffs, displaced meshes, Gaussian splats

### Takeaway
Full raymarched volumes (e.g. takram three-clouds) look great but are costly, sky-scale, WebGL/postprocessing-tied and unproven on phones, so they are the wrong tool for cartoon fart puffs. The best "volumetric-feeling" stylized option is **instanced, noise-displaced low-poly spheres with toon shading** ("cartoon puff balls"). They are solid geometry, so they write depth, need no sorting, can carry real outlines, and look great right up against the camera. A small bounded raymarched SDF-metaball pass is a premium desktop-tier option. Gaussian splats are not a fit for animated smoke.

### Cited Findings
- **takram three-clouds** (in [takram-design-engineering/three-geospatial](https://github.com/takram-design-engineering/three-geospatial): 1794 stars, pushed 2026-05-27). Geospatial volumetric clouds with Beer shadow maps, temporal upscaling/filtering and light shafts. It is a post-processing effect that requires the pmndrs `postprocessing` EffectComposer. It is **GLSL only; TSL/WebGPU are planned but not supported**. — [@takram/three-clouds README 0.7.4](https://cdn.jsdelivr.net/npm/@takram/three-clouds@0.7.4/README.md); [npm](https://www.npmjs.com/package/@takram/three-clouds). An unofficial WebGPU/TSL port exists: [johnfewell/three-clouds-webgpu](https://github.com/johnfewell/three-clouds-webgpu) (0 stars, pushed 2026-11-15).
- I found no official mobile performance figures for takram clouds. — [search result summary of README/npm](https://www.npmjs.com/package/@takram/three-clouds)
- [FarazzShaikh/three-volumetric-clouds](https://github.com/FarazzShaikh/three-volumetric-clouds) (124 stars) is **archived** (pushed 2024-09-05). It follows Guerrilla's "Nubis, Evolved".
- Other raymarch references:
  - [CK42BB/procedural-clouds-threejs](https://github.com/CK42BB/procedural-clouds-threejs) (52 stars, 2026-02-12): "WebGPU raymarching with WebGL2 billboard/mesh fallbacks". The fallback pattern is a good model.
  - [MisterPrada/tornado](https://github.com/MisterPrada/tornado) (43 stars, 2025-11-29): TSL raymarched clouds tornado.
  - [KozakBartosz/volumetric-smoke-studio](https://github.com/KozakBartosz/volumetric-smoke-studio) (0 stars, 2026-11-23): WebGPU/TSL volumetric smoke raymarching.
  - [lejrimostfa/force-field-vfx-threejs](https://github.com/lejrimostfa/force-field-vfx-threejs) (30 stars, 2026-11-07): "real-time 3D fire and smoke on three.js WebGPU".
  - [Donitzo/three.js-volume-renderer](https://github.com/Donitzo/three.js-volume-renderer) (22 stars, 2026-04-21): customizable volume renderer.
  - [Token-Gremlin/natural-disasters](https://github.com/Token-Gremlin/natural-disasters) (309 stars, 2026-09-01): procedural weather sim with volumetrics.
  - [mattatz/THREE.Fire](https://github.com/mattatz/THREE.Fire) (169 stars, **stale**, 2020): raymarched volumetric fire on a box.
  - [mattrossman/magic-marble-tutorial](https://github.com/mattrossman/magic-marble-tutorial) (97 stars, 2021): adds volumetric effects to a built-in material.
  - [rsteth/three-planet-clouds](https://github.com/rsteth/three-planet-clouds) (0 stars, 2026-10-19): ships two quality tiers, "instanced ellipsoids and volumetric raymarching". That tiering pattern matches this project.
- **Displaced-icosphere cartoon puffs:** a Blender cartoon-explosion tutorial builds puffs from icospheres with selectively pushed-out vertices. With low vertex counts it uses a hard-edged texture with isolated dark patches. — [Blender Artists: Cartoon Explosions tutorial](https://blenderartists.org/t/cartoon-explosions-tutorial/1175640). Similar C4D "cartoon poof" with Cloner and toon shading: [lesterbanks](https://lesterbanks.com/?p=31932).
- **Gaussian splats** in three.js: [sparkjsdev/spark](https://github.com/sparkjsdev/spark) (3972 stars, pushed 2026-11-19, active) and [mkkellogg/GaussianSplats3D](https://github.com/mkkellogg/GaussianSplats3D) (2984 stars, pushed 2025-10-19; slowing). Both are built for captured static scenes. I found no source using splats for stylized animated smoke.

### Inferences
**Recipe: "toon puff balls"**, ranked as the best fit for the mega-fart burst and the close-to-camera hero shots.
- Use an InstancedMesh of an icosphere (detail 2-3, ~320-1280 tris). In the vertex shader, displace along the normal by 3D noise (time-animated plus a per-instance seed) to get lumpy cauliflower silhouettes.
- Shade with MeshToonMaterial (gradient map with 3 steps in green tones) or a custom ramp, plus a Fresnel rim and a slight emissive. This matches the Pixar/Nintendo toy look of the rest of the site and receives real scene lighting and shadows.
- Dissolve over life with noise-thresholded `discard` (alpha-test, no blending): no sorting, writes depth, cheap. Combine with scale-pop and inflate/shrink.
- Get outlines with an inverted-hull back-face pass on the same instances (dark green), or with a post-process edge pass if the site already has one.
- Mix both approaches: solid toon puff-balls for the "body" of big clouds, plus soft billboard wisps at the edges and in the trail for softness. This hybrid is the usual stylized-game approach (my inference).
- Phone cost is low: alpha-tested opaque geometry avoids the overdraw problem entirely, which is billboards' main weakness on mobile GPUs.
- A raymarched bounded-SDF metaball cloud (a few spheres smooth-unioned, raymarched in a screen-space quad or proxy box with toon-stepped lighting) can look gorgeous for one hero cloud. It costs per pixel, so keep it to a desktop or WebGPU tier, at half resolution.

### Gaps
- No measured phone fps for any raymarched cloud library was found.
- No published benchmark comparing displaced-icosphere puffs against billboard puffs on mobile.

## Fluid sims on the web (screen-space overlay / 2D texture / WebGPU)

### Takeaway
PavelDoGreat's WebGL Fluid Simulation is the famous, phone-friendly 2D stable-fluids sim, but it is not updated since Nov 2024 (stale but stable). Its best role here is a **screen-space overlay for the full-screen gas wipe**: inject green dye and velocity from the character's screen position, then quantize or posterize the dye into toon bands. 3D WebGPU fluid sims are impressive but too heavy and too WebGPU-only for the main effect.

### Cited Findings
- [PavelDoGreat/WebGL-Fluid-Simulation](https://github.com/PavelDoGreat/WebGL-Fluid-Simulation): 16,915 stars, last pushed **2024-11-12** (about 2 years: stale). Description: "Play with fluids in your browser (works even on mobile)".
- [haxiomic/GPU-Fluid-Experiments](https://github.com/haxiomic/GPU-Fluid-Experiments): 3072 stars, **stale** (2019).
- three.js wrappers:
  - [amsXYZ/three-fluid-sim](https://github.com/amsXYZ/three-fluid-sim): 178 stars, stale (2020). 2D fluid in three.js.
  - [hartkaymann/three-fluid](https://github.com/hartkaymann/three-fluid): 15 stars, 2026-07-17. Eulerian fluid in three.js.
  - [bandinopla/threejs-fluid-simulation](https://github.com/bandinopla/threejs-fluid-simulation): 45 stars, 2025-07-19.
  - [ardeshiir/react-three-fiber-fluid-simulation](https://github.com/ardeshiir/react-three-fiber-fluid-simulation): 30 stars, 2024.
  - A three.js forum tutorial on fluid simulation using shaders: [discourse](https://discourse.threejs.org/t/fluid-simulation-using-shaders-tutorial/85109.md).
- WebGPU fluids:
  - [matsuoka-601/WebGPU-Ocean](https://github.com/matsuoka-601/WebGPU-Ocean): 574 stars, 2025-06-09.
  - [matsuoka-601/Splash](https://github.com/matsuoka-601/Splash): 207 stars, 2025-04.
  - [jeantimex/fluid](https://github.com/jeantimex/fluid): 138 stars, 2026-04-17. SPH and PIC/FLIP.
  - [kishimisu/WebGPU-Fluid-Simulation](https://github.com/kishimisu/WebGPU-Fluid-Simulation): 135 stars, 2023. Jos Stam stable fluids.
  - [APS4087/spill](https://github.com/APS4087/spill): 3 stars, 2026-07. MLS-MPM in three.js WebGPU/TSL, 131k particles.
  - three.js has an official MLS-MPM WebGPU-only example (see the forum link in the libraries section).
- [emmettl/driftfield](https://github.com/emmettl/driftfield) (2026-10-20) is a game where "one velocity field drives the smoke". It shows a 2D fluid velocity field driving smoke visuals.

### Inferences
- **Full-screen wipe recipe:** run a low-res (e.g. 128-256 px) stable-fluids sim, ported from Pavel's shaders, which are MIT-licensed (license not verified in this session). Emit big green dye splats with strong outward velocity from the character, then composite as a post pass. Map dye density through a 3-step green ramp with a dark outline at the density threshold (`fwidth`-based edge), so it reads as cartoon gas rather than ink. Then overlay a few huge near-camera toon puff-balls or billboards for parallax depth. This scales well on phones because the sim resolution is tiny.
- A cheaper wipe alternative: a single full-screen shader with an animated, domain-warped FBM threshold expanding from the character's screen position, using stepped colour bands and outlines. There's no sim and it's trivially fast; the look is less "physical" but very on-style.
- A 2D fluid can also be used as a flow-map texture to advect the billboard UVs of the manhole steam. That is a nice touch, but optional.

### Gaps
- Couldn't verify Pavel's license or mobile fps figures in this session.

## Concrete recipes and references: best fit for a "thick green cartoon fart cloud", including close-to-camera

### Takeaway
No single technique covers every shot. The best fit is a **tiered hybrid** built around a shared green toon ramp:
1. Toon-shaded, noise-displaced instanced puff-balls for the body of trail and burst clouds.
2. Normal-mapped, cel-banded, alpha-eroded soft billboards for wisps, the trail tail and the manhole steam.
3. A screen-space toon fluid or noise wipe for the full-screen transition.

### Cited Findings
- The classic real-time toon smoke method is normal-mapped billboards plus two-tone shading plus depth-difference outlines. — [McGuire & Fein 2006](https://faculty.digipen.edu/~gherron/references/References/NPR/mf-2006-toonsmoke.pdf)
- BotW-style cloud dissolution as a reference target, with frame-by-frame study. — [80.lv Soenke Seidel](https://80.lv/articles/creating-stylized-combat-vfx-in-the-zelda-style/)
- Cartoon explosion puffs from displaced icospheres. — [Blender Artists](https://blenderartists.org/t/cartoon-explosions-tutorial/1175640)
- three.js-specific smoke shader tutorials. — [Three.js Journey Coffee Smoke (GLSL)](https://www.threejs-journey.com/lessons/coffee-smoke-shader), [TSL version](https://threejs-journey.com/lessons/webgpu-tsl/coffee-smoke), [Brad Woods](https://garden.bradwoods.io/notes/javascript/three-js/shaders/shaders-103-smoke), [Codrops 2020 procedural cloud sprites](https://tympanus.net/codrops/2020/01/28/how-to-create-procedural-clouds-using-three-js-sprites/)
- SimonDev's old particle tutorial repo: [simondevyoutube/ThreeJS_Tutorial_ParticleSystems](https://github.com/simondevyoutube/ThreeJS_Tutorial_ParticleSystems) (40 stars, **stale**, 2020).
- [FarazzShaikh/THREE-CustomShaderMaterial](https://github.com/FarazzShaikh/THREE-CustomShaderMaterial) (1372 stars, pushed 2025-10-12) lets you extend MeshToonMaterial/Standard with custom vertex displacement and dissolve while keeping three.js lighting. That is useful for the puff-ball approach on WebGLRenderer.

### Inferences
**Ranked techniques for this project**

| Rank | Technique | Visual quality (stylized) | Phone perf cost | Difficulty | Best shots |
|---|---|---|---|---|---|
| 1 | Toon puff-balls (instanced displaced icospheres, toon ramp, rim, noise-dissolve, inverted-hull outline) | Very high, matches toy look, great near camera | Low (opaque, alpha-test, no sort) | Medium | Mega-fart burst, police envelope, trail body, close-ups |
| 2 | Upgraded billboards (normal-mapped puff/flipbook, 3-band cel ramp, alpha erosion, soft particles, curl noise) via three.quarks or the existing InstancedMesh | High | Low-medium (overdraw-bound) | Low-medium | Trail tail wisps, manhole steam, soft edges around puff-balls |
| 3 | Screen-space toon wipe (2D stable fluid or domain-warped FBM threshold, posterized) | High for the transition | Low (low-res sim) | Medium | Full-screen transition |
| 4 | Six-way lit flipbooks (EmberGen-style) | High realism, less "toon" unless quantized | Low-medium (2 textures/particle) | Medium-high (custom shader port, baking) | Manhole steam with alley lights |
| 5 | Bounded raymarched SDF metaballs with toon steps | Very high hero shot | High (per-pixel) | High | Desktop-only hero burst |
| 6 | Full volumetric clouds (takram etc.) | Realistic, off-style | High | Medium (lib) / WebGL-only | Background sky only |
| 7 | Gaussian splats | Static capture; poor fit | Medium-high | High | Not recommended |

**Close-to-camera / full-screen considerations**
- Billboards break down when they fill the screen: you see huge blurry texels, massive overdraw and camera-plane clipping. Puff-balls hold up because they're geometry with crisp toon edges. During the wipe, hand off to the screen-space pass rather than flooding the screen with particles.
- Fade billboards by distance to the near plane (a near-fade) to avoid harsh clipping.

## Related VFX: speed lines, skateboard sparks, police light glows / lens flares, heat haze

### Takeaway
Use cheap, stylized, mostly screen-space or additive effects:
- radial anime speed lines in a post shader or on camera-attached streak quads;
- velocity-stretched additive spark billboards (three.quarks has stretched-billboard and trail support);
- bloom plus emissive sprites for the police lights, using `pmndrs/postprocessing` and three.js's `Lensflare` addon;
- a noise-driven UV-distortion pass (masked) for heat haze.

### Cited Findings
- [pmndrs/postprocessing](https://github.com/pmndrs/postprocessing): 3000 stars, pushed 2026-11-22 (active). It is the standard bloom/effect stack, and takram clouds also require it ([takram README](https://cdn.jsdelivr.net/npm/@takram/three-clouds@0.7.4/README.md)).
- [pmndrs/drei](https://github.com/pmndrs/drei): 10,203 stars, pushed 2026-11-17 (R3F helpers).
- Trails:
  - [mkkellogg/TrailRendererJS](https://github.com/mkkellogg/TrailRendererJS): 192 stars, 2024-06 (slowing).
  - [svartmc/trails](https://github.com/svartmc/trails): 91 stars, stale 2020.
  - three.quarks has trails with 16-bit indices in 0.18 ([changelog](https://raw.githubusercontent.com/Alchemist0823/three.quarks/master/CHANGELOG.md)).
  - wawa-vfx course covers trails ([dev.to](https://dev.to/wawasensei/wawa-vfx-open-source-vfx-particle-system-for-react-three-fiber-projects-151l)).
- Lens flare repos on GitHub are all tiny tutorial copies (0 stars). — GitHub search "three.js lens flare" (2026-11-26)
- A "hologram particles" TSL demo shows WebGPU node particles with Next.js. — [cortiz2894/hologram-particles](https://github.com/cortiz2894/hologram-particles) (111 stars, 2026-06-30)

### Inferences
- **Speed lines:** a full-screen post shader. Draw radial streaks from a focus point using `atan2` angle bucketed into noise, then mask by radius and speed. Or use a few camera-parented long thin additive quads with scrolling alpha. Both are nearly free.
- **Sparks:** additive, velocity-aligned stretched billboards with short life and gravity, plus a tiny trail. Emit from wheel/grind contact points. Bloom makes them pop.
- **Police lights:** red/blue emissive sprites with a glow texture, an alternating strobe, and bloom. three.js examples include a `Lensflare` addon for flares. Keep flares subtle and stylized (a few hex ghosts) to match the toy look. Use a spotlight cookie on the road for colour spill (cheap fake: an additive decal quad).
- **Heat haze / gas shimmer:** render a distortion mask (the gas puffs into a low-res buffer). Then offset scene UVs by scrolling noise times the mask in a post pass. Giving the green gas a faint refraction shimmer sells "toxic". It is cheap if the buffer is half or quarter resolution.
- **Mobile tiering:**
  - render particles to a half-res offscreen target and composite (a classic overdraw fix);
  - cap puff count and size by device tier;
  - prefer alpha-tested puff-balls over blended billboards on low tier;
  - disable distortion and outlines-post on low tier.

### Gaps
- I did not find primary sources for the three.js `Lensflare` addon's mobile cost, or for specific stylized speed-line shaders. The recommendations above are standard practice, not sourced.
- Harry Alisavakis and Ben Cloward specific smoke tutorials did not surface in search; their sites were not checked (web fetch budget).
- No specific Fortnite smoke talk or Arcane smoke breakdown was found.
- GitHub search was rate-limited partway, so a few repos lack metadata:
  - [mattatz/THREE.Fluid](https://github.com/mattatz/THREE.Fluid) was not found by search;
  - [Ameobea/three-volumetric-clouds](https://github.com/Ameobea/three-volumetric-clouds) was not found;
  - [N8python/n8ao](https://github.com/N8python/n8ao) was not checked;
  - simondev Quick_Shaders was not found.
