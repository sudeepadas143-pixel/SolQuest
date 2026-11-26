# Three.js rendering quality stack (late 2026): libraries, repos and techniques for a stylized-but-premium real-time site

Method and scope notes (for the report writer):
- Research date: 2026-11-26. Repo stars and "last push" come from the GitHub search API (`gh api -X GET search/repositories -f q="repo:<owner>/<name>"`) run on 2026-11-26. "Last push" is `pushed_at`, meaning the most recent commit to any branch. It is not a release date. The `repos/` and `releases` endpoints were blocked in this session, so release tags come from the github.com releases page fetched with WebFetch.
- These hosts could not be fetched (DNS blocked in the session): threejs.org, utsubo.com, awwwards.com. Claims from them come only from search-result snippets and are marked that way. Most rendering detail comes from github.com pages, which were reachable.
- Ratings like "perf cost" and "quality jump per ms" in the Inferences sections are engineering judgment, not measured numbers, unless a citation is attached.

## Objective: ranked, practical stack recommendation (summary table for the writer)

### Takeaway
Stay on **WebGLRenderer, three r18x, built with Vite**. The tool chain is: **pmndrs/postprocessing** (merged EffectPass) + **N8AO** + SMAA + AgX/Neutral tone mapping + LUT grade, a **Poly Haven HDRI through PMREM**, **baked AO/lightmaps in Blender**, stylized ramp/toon shading with outlines, and **glTF-Transform + KTX2 + meshopt** for assets. Most of the jump over a "PS2 retro" site comes from art direction (baked light, a controlled palette, real models) plus 4–5 well-tuned post effects. Exotic effects add little. Plan TSL/WebGPU as a later port and not the launch target.

### Cited Findings (repo metrics, GitHub search API, 2026-11-26)
| Repo | Stars | Last push | Status |
|---|---|---|---|
| [mrdoob/three.js](https://github.com/mrdoob/three.js) | 119,454 | 2026-11-26 | active; latest release r187 (30 Oct 2026) — [releases](https://github.com/mrdoob/three.js/releases) |
| [pmndrs/postprocessing](https://github.com/pmndrs/postprocessing) | 3,000 | 2026-11-22 | active |
| [N8python/n8ao](https://github.com/N8python/n8ao) | 524 | 2026-11-15 | active (v2.1 release notes cite M5 Max timings) |
| [pmndrs/react-three-fiber](https://github.com/pmndrs/react-three-fiber) | 33,959 | 2026-10-21 | active; v10 in alpha |
| [pmndrs/drei](https://github.com/pmndrs/drei) | 10,203 | 2026-11-17 | active; v11 alpha |
| [pmndrs/drei-vanilla](https://github.com/pmndrs/drei-vanilla) | 622 | 2026-02-20 | slow-moving |
| [pmndrs/react-postprocessing](https://github.com/pmndrs/react-postprocessing) | 1,771 | 2026-10-21 | active |
| [gkjohnson/three-mesh-bvh](https://github.com/gkjohnson/three-mesh-bvh) | 3,593 | 2026-11-25 | active |
| [donmccurdy/glTF-Transform](https://github.com/donmccurdy/glTF-Transform) | 2,104 | 2026-10-20 | active |
| [zeux/meshoptimizer](https://github.com/zeux/meshoptimizer) | 8,948 | 2026-11-25 | active |
| [KhronosGroup/KTX-Software](https://github.com/KhronosGroup/KTX-Software) | 1,413 | 2026-11-17 | active |
| [BinomialLLC/basis_universal](https://github.com/BinomialLLC/basis_universal) | 3,157 | 2026-10-30 | active |
| [pmndrs/detect-gpu](https://github.com/pmndrs/detect-gpu) | 1,225 | 2026-11-22 | active |
| [RenaudRohlinger/stats-gl](https://github.com/RenaudRohlinger/stats-gl) | 287 | 2026-07-10 | maintained |
| [utsuboco/r3f-perf](https://github.com/utsuboco/r3f-perf) | 784 | 2024-12-20 | **stale (~2 yrs)** |
| [FarazzShaikh/THREE-CustomShaderMaterial](https://github.com/FarazzShaikh/THREE-CustomShaderMaterial) | 1,372 | 2025-10-12 | ~13 months since last push; WebGL-material only |
| [StrandedKitty/three-csm](https://github.com/StrandedKitty/three-csm) | 344 | 2023-12-11 | **stale**; superseded by three's built-in `examples/jsm/csm` (CSM.js, CSMShadowNode.js) — [three.js csm dir](https://github.com/mrdoob/three.js/tree/dev/examples/jsm/csm) |
| [0beqz/realism-effects](https://github.com/0beqz/realism-effects) | 1,752 | 2024-02-04 | **stale (~3 yrs)**; avoid |
| [0beqz/screen-space-reflections](https://github.com/0beqz/screen-space-reflections) | 585 | 2023-06-10 | **stale**; avoid |
| [Ameobea/three-good-godrays](https://github.com/Ameobea/three-good-godrays) | 239 | 2026-11-05 | active |
| [protectwise/troika](https://github.com/protectwise/troika) (troika-three-text) | 1,998 | 2026-11-25 | active |
| [spite/THREE.MeshLine](https://github.com/spite/THREE.MeshLine) | 2,350 | 2026-10-20 | active |
| [gkjohnson/three-edge-projection](https://github.com/gkjohnson/three-edge-projection) | 361 | 2026-10-29 | active (offline/CAD-style edge lines) |
| [OmarShehata/webgl-outlines](https://github.com/OmarShehata/webgl-outlines) | 416 | 2022-12-09 | stale but a good technique reference |
| [pmndrs/gltfjsx](https://github.com/pmndrs/gltfjsx) | 5,906 | 2024-11-04 | stale-ish (R3F only) |
| [pmndrs/react-three-rapier](https://github.com/pmndrs/react-three-rapier) | 1,765 | 2026-10-12 | active |
| [dimforge/rapier.js](https://github.com/dimforge/rapier.js) | 700 | 2026-07-12 | active |
| [pmndrs/react-three-offscreen](https://github.com/pmndrs/react-three-offscreen) | 528 | 2025-01-30 | stale |
| [gkjohnson/three-gpu-pathtracer](https://github.com/gkjohnson/three-gpu-pathtracer) | 2,074 | 2026-11-26 | active (offline/hero stills, not real-time gameplay) |
| [takram-design-engineering/three-geospatial](https://github.com/takram-design-engineering/three-geospatial) | 1,794 | 2026-05-27 | active (physical atmosphere/clouds; heavy) |
| [FarazzShaikh/three-volumetric-clouds](https://github.com/FarazzShaikh/three-volumetric-clouds) | 124 | 2024-09-05 | stale |
| [brunosimon/folio-2025](https://github.com/brunosimon/folio-2025) | 2,060 | 2026-11-04 | reference project |
| [brunosimon/folio-2019](https://github.com/brunosimon/folio-2019) | 4,741 | 2024-05-25 | reference project (older) |
| [ektogamat/threejs-conference](https://github.com/ektogamat/threejs-conference) | 193 | 2026-09-23 | TSL/WebGPU post-processing showcase |
| [niccolofanton/dithering-shader](https://github.com/niccolofanton/dithering-shader) | 298 | 2026-09-20 | stylized post example |
| [sloemo01/diorama](https://github.com/sloemo01/diorama) | 735 | 2026-11-16 | top-starred "three.js toon" repo |
| [meshy-dev/ThreeRT](https://github.com/meshy-dev/ThreeRT) | 719 | 2026-11-26 | three.js WebGPU ray tracing (experimental) |
| [dgreenheck/webgpu-claude-skill](https://github.com/dgreenheck/webgpu-claude-skill) | 1,300 | 2026-04-10 | TSL/WebGPU agent skill (Dan Greenheck) |
| [KhronosGroup/glTF-Sample-Assets](https://github.com/KhronosGroup/glTF-Sample-Assets) | 1,181 | 2026-11-20 | test assets |

### Inferences (ranked stack, quality per ms on mid-range phones; judgment)
1. **Asset/art pipeline (zero runtime ms, biggest jump).** Use real GLB models with baked AO/lightmaps from Blender, a palette/gradient texture (the folio-2025 approach), and KTX2 + meshopt via glTF-Transform. It cuts load time and VRAM, and baked light reads as "premium" at no frame cost.
2. **Tone mapping + color grade (≈0.1–0.3 ms).** Use AgX or Neutral instead of a hand-rolled ACES, then a 3D LUT authored in Photoshop/Resolve for the dusk grade. This is the cheapest "cinematic" lever there is.
3. **SMAA (≈0.3–0.8 ms)** or MSAA on the render target. It removes the jaggies that make WebGL look cheap. Required anyway with AO because hardware AA doesn't work with N8AO ([n8ao README](https://github.com/N8python/n8ao)).
4. **Mipmap bloom (pmndrs `BloomEffect` with `mipmapBlur`, ≈0.5–1.5 ms)** with luminance threshold above 1 and emissive values above 1 on neon/headlights/police lights. That gives selective-looking bloom without a selective pass.
5. **N8AO "performance"/"low" + halfRes (≈1–3 ms on mobile, judgment)**, or baked AO only on low tier. Real-time AO grounds the character and cars.
6. **Soft shadows**: one directional shadow tightly fit to the player (or built-in CSM on desktop) + a contact/blob shadow under the board and cars.
7. **Optional on high tier only**: bokeh DoF for the gallery/hero shots, god rays toward the setting sun, chromatic aberration + grain at very low strength, and camera motion blur at speed.
8. **Tiering**: detect-gpu + adaptive DPR (cap ~1.5 on phones), and drop AO/DoF/godrays on low tier.

## Post-processing: pmndrs/postprocessing vs three's EffectComposer vs WebGPU/TSL post — which effects give the biggest quality jump per ms?

### Takeaway
On WebGLRenderer, **pmndrs/postprocessing** is the strongest option. It merges many effects into a single fullscreen pass, and three's own EffectComposer cannot do that. On WebGPURenderer, three's **TSL node post pipeline** (renamed `PostProcessing` → `RenderPipeline` in r183) is now the most complete effect set in the ecosystem (GTAO, SSR, SSGI, TRAA, bokeh DoF, godrays, LUT, motion blur, outline). pmndrs/postprocessing has no WebGPU support and N8AO doesn't support WebGPU yet. The biggest quality per ms comes from tone mapping + LUT, AA, mipmap bloom with HDR emissives, and AO, in that order.

### Cited Findings
- pmndrs/postprocessing's `EffectPass` "automatically organizes and merges any combination of effects", which "minimizes the amount of render operations". Fullscreen passes use a single triangle instead of a quad. The effect list covers antialiasing (SMAA), bloom, blur, color grading (brightness/contrast, hue/saturation, LUT), depth of field with vignette, chromatic aberration, noise, god rays, pixelation, outline, shock wave, SSAO, texture and tone mapping. The README does not mention WebGPU. — [pmndrs/postprocessing README](https://github.com/pmndrs/postprocessing)
- The postprocessing v7 design document (issue #419) plans to rename RenderPass→GeometryPass and replace EffectComposer with a lighter RenderPipeline class. It does not mention WebGPU, and no official 2026 WebGPU roadmap for pmndrs/postprocessing turned up. — [pmndrs/postprocessing #419](https://github.com/pmndrs/postprocessing/issues/419)
- A third-party 2026 migration guide recommends TSL-native effects from `three/tsl` over pmndrs/postprocessing when moving to WebGPU (search snippet; page not fetchable). — [utsubo migration guide](https://www.utsubo.com/blog/webgpu-threejs-migration-guide)
- three.js r183 (Feb 18, 2026) renamed `PostProcessing` to `RenderPipeline` for WebGPURenderer and added a reversed depth buffer on WebGPURenderer (secondary sources). — [cinevva news](https://app.cinevva.com/news/2026-03-18-threejs-r183-render-pipeline); [r183 release](https://github.com/mrdoob/three.js/releases/tag/r183)
- three's TSL display nodes in `examples/jsm/tsl/display` (dev branch, Nov 2026) include BloomNode, DepthOfFieldNode, GTAONode, SSAONode, SSGINode, SSRNode, SSSNode, TRAANode, TAAUNode, TemporalReprojectNode, SMAANode, FXAANode, SSAAPassNode, FSR1Node, Lut3DNode, ChromaticAberrationNode, FilmNode, MotionBlur, GodraysNode, LensflareNode, lensDirt, OutlineNode, PixelationPassNode, RetroPassNode, CRT, SobelOperatorNode, DenoiseNode/RecurrentDenoiseNode, OITPassNode, SharpenNode, radialBlur and TransitionNode. — [three.js tsl/display](https://github.com/mrdoob/three.js/tree/dev/examples/jsm/tsl/display)
- r187 (30 Oct 2026) added a TSL lens dirt function among other TSL changes (secondary). — [whatsnew/three.js](https://whatsnew.fyi/product/three-js); [r187 release](https://github.com/mrdoob/three.js/releases/tag/r187)
- **N8AO**: requires WebGL2, "does not yet support WebGPU", and three r161+ is recommended. Use `N8AOPostPass` with pmndrs/postprocessing. SMAA afterward is recommended "since hardware antialiasing doesn't work with AO". halfRes gives "generally 2x to 4x speedup". Presets: Performance (8 AO samples/4 denoise; "mobile, low-end iGPUs"), Low (16/4; "high-end mobile, iGPUs"), Medium default (16/8), High/Ultra (64 samples; desktop GPUs), plus "Neural" denoise variants. At 1080p on an Apple M5 Max: Medium ≈0.70 ms, Ultra ≈2.0 ms, Neural-Medium ≈1.1 ms, and the half-res learned upsampler adds ≈0.1 ms. No mobile timings are published. — [N8python/n8ao](https://github.com/N8python/n8ao)
- A Needle Engine source comment reports that N8AO's halfRes path returned black for background pixels. Needle only enables halfRes when `devicePixelRatio > 1`. This may already be fixed upstream. — [search summary of Needle engine source on unpkg](https://unpkg.com/@needle-tools/engine@4.8.6/src/engine-components/postprocessing/Effects/ScreenspaceAmbientOcclusionN8.ts)
- A three.js forum thread reports that the pmndrs/postprocessing build of N8AO performs far better than the three EffectComposer build ("night and day"). — [three.js forum: Best SSAO on par with Sketchfab](https://discourse.threejs.org/t/best-ssao-that-is-on-par-with-sketchfab-quality-performance/54284)
- three.js has an HBAO vs N8AO comparison thread and an official WebGPU AO example (GTAO). — [forum HBAO vs N8AO](https://discourse.threejs.org/t/new-ambient-occlusion-example-hbao-vs-n8ao/58847); [webgpu_postprocessing_ao](https://threejs.org/examples/webgpu_postprocessing_ao)
- **Tone mapping**: three has `AgXToneMapping` and `NeutralToneMapping` (Khronos PBR Neutral; requires r162+ per pmndrs docs). AgX is "less saturated than ACES Filmic by design". renderer.toneMapping is ignored when rendering to a render target, so tone mapping must happen in a ToneMappingPass/OutputPass/ToneMappingEffect at the end of the post chain. — [pmndrs ToneMappingMode docs](https://pmndrs.github.io/postprocessing/public/docs/file/src/enums/ToneMappingMode.js.html); [AgX PR #27413](https://github.com/mrdoob/three.js/pull/27413); [forum: AgX implemented correctly?](https://discourse.threejs.org/t/is-agx-tonemapping-implemented-correctly/60609); [forum: AO with Neutral](https://discourse.threejs.org/t/ambient-occlusion-wrong-with-khronos-neutral-tone-mapper/68192); [forum: Tone mapping overview](https://discourse.threejs.org/t/tone-mapping-overview/75204)
- God rays: [Ameobea/three-good-godrays](https://github.com/Ameobea/three-good-godrays) (239★, pushed 2026-11-05) is a maintained screen-space raymarched godrays pass for pmndrs/postprocessing. three also ships a TSL `GodraysNode`. — [three.js tsl/display](https://github.com/mrdoob/three.js/tree/dev/examples/jsm/tsl/display)
- Stylized post examples: [niccolofanton/dithering-shader](https://github.com/niccolofanton/dithering-shader) (298★) and [ektogamat/threejs-conference](https://github.com/ektogamat/threejs-conference) (193★, TSL post showcase).

### Inferences
- **Quality per ms ranking (WebGL, mid-range phone; judgment):** (1) AgX/Neutral + LUT ≈ free, huge mood gain for a dusk scene. (2) SMAA: cheap, removes the "cheap WebGL" aliasing look. (3) Mipmap bloom with HDR emissives: the main "premium neon dusk" signal. (4) N8AO halfRes Performance: grounds objects, mid cost. (5) Vignette + subtle grain: free, hides banding. (6) Bokeh DoF: expensive, so use only in gallery/hero moments or behind a quality tier. (7) Godrays: medium-high cost, high-tier only. (8) Motion blur: medium cost, worth it at speed on desktop. (9) Chromatic aberration: near-free but easy to overdo into "retro"; keep it subtle. Skip SSR/SSGI on mobile.
- **TAA/TRAA** removes shimmer on thin geometry (wires, railings) better than SMAA, but ghosts on fast-moving cars and characters. For a fast endless runner, SMAA (or MSAA on the composer render target) is safer. three's TRAANode is WebGPU-only.
- Merge everything into one or two `EffectPass`es (pmndrs). Each separate pass costs a full-screen read/write, which is the main mobile bottleneck (bandwidth). That is why the pmndrs approach beats chaining three's `EffectComposer` passes.
- The current site's "custom low-res bloom + ACES composite" is probably a big part of the cheap look. Low-res bloom without a mip chain gives blocky halos, and ACES over-saturates neon. Replacing them with mipmap bloom + AgX + LUT is a quick win.

### Gaps
- No published mobile (Adreno/Mali/Apple A-series) ms timings for pmndrs effects or N8AO were found. They need measuring on target devices.
- The pmndrs/postprocessing version number and v7 release status could not be confirmed (the README shows only a badge, and the releases API was blocked).
- Whether three's TSL post is faster or slower than pmndrs on WebGL2 fallback was not established.

## Lighting and materials: HDRI/PMREM, baked lighting, shadows, MeshPhysicalMaterial, toon/cel and outlines

### Takeaway
For a dusk city on phones, **bake as much as possible** (Blender lightmaps/AO, palette textures), add **one HDRI through PMREM** for reflections and ambient, a **single tight shadow-casting directional light** plus contact/blob shadows, and a **stylized shading model** (ramp/toon with rim light and an outline). That combination beats the reference's PBR-plus-RoomEnvironment look. Built-in CSM replaces the stale three-csm. r186 added a `SunLight` with cascaded shadows, and the PCFSoftShadowMap path was removed in r186.

### Cited Findings
- r186 added "SunLight with cascaded shadow maps", added retroreflectivity to MeshPhysicalMaterial, and removed the PCFSoftShadowMap code path. r187 replaced PMREM's CubeUV atlas with cube render targets and added the EON rough-diffuse BRDF to MeshPhysicalMaterial. — [three.js releases](https://github.com/mrdoob/three.js/releases)
- Dating conflict: the GitHub releases page shows r186 on "24 Sep", and a changelog aggregator says "Sep 8, 2026". — [three.js releases](https://github.com/mrdoob/three.js/releases); contradicted by [whatsnew.fyi](https://whatsnew.fyi/product/three-js)
- A migration guide snippet says PCFSoftShadowMap was removed "for WebGPURenderer" in r186. The GitHub release line says the PCFSoftShadowMap code path was removed without naming a renderer, so check which renderer is affected. — [utsubo (snippet)](https://www.utsubo.com/blog/webgpu-threejs-migration-guide); [three.js releases](https://github.com/mrdoob/three.js/releases)
- Built-in cascaded shadows: `examples/jsm/csm/` contains CSM.js, CSMFrustum.js, CSMHelper.js, CSMShader.js (WebGL) and CSMShadowNode.js (WebGPU). — [three.js csm dir](https://github.com/mrdoob/three.js/tree/dev/examples/jsm/csm). The standalone [three-csm](https://github.com/StrandedKitty/three-csm) was last pushed 2023-12-11 (stale).
- `examples/jsm/objects` provides Sky.js/SkyMesh.js (physical sky), Water/Water2 (+Mesh variants), Reflector/Refractor, Lensflare/LensflareMesh, GroundedSkybox, ShadowMesh and GaussianSplat. — [three.js objects dir](https://github.com/mrdoob/three.js/tree/dev/examples/jsm/objects)
- drei-vanilla (vanilla three ports of drei) includes `pcss` soft shadows (injected into three's shader chunk), MeshTransmissionMaterial, MeshReflectorMaterial, AccumulativeShadows, Caustics, Clouds, Sparkles, Stars, Outlines, Billboard, Text (troika), Splat, Trail, MeshPortalMaterial and SpriteAnimator. ContactShadows and Sky were not listed on the README page. — [pmndrs/drei-vanilla](https://github.com/pmndrs/drei-vanilla)
- Toon/outline in three: the forum recommends MeshToonMaterial + `OutlineEffect` (inverted-hull outlines, addon). The OutlineEffect docs say it must be imported explicitly. — [forum: smooth cartoon style with outlines](https://discourse.threejs.org/t/how-to-create-this-smooth-cartoon-style-with-outlines-in-three-js/60862); [OutlineEffect docs](https://threejs.org/docs/pages/OutlineEffect.html)
- Post-process "full outlines" from depth+normal edge detection: [forum tutorial](https://discourse.threejs.org/t/how-to-render-full-outlines-as-a-post-process-tutorial/22674) by Omar Shehata, with code at [OmarShehata/webgl-outlines](https://github.com/OmarShehata/webgl-outlines) (stale 2022 but still a valid technique). Codrops' sketchy pencil effect uses a Sobel operator for outlines. — [Codrops 2022](https://tympanus.net/codrops/2022/11/29/sketchy-pencil-effect-with-three-js-post-processing/). three now has TSL `OutlineNode` and `SobelOperatorNode`. — [three.js tsl/display](https://github.com/mrdoob/three.js/tree/dev/examples/jsm/tsl/display)
- Codrops Ronin161 case study: the team found three's toon material example "wasn't quite what we were looking for". They wrote a custom toon shader that started from two tones (lit color + black shadow) and then added grain. — [Codrops case study Ronin161](https://tympanus.net/codrops/2024/02/20/case-study-ronin161s-portfolio-2024/)
- Cel shading "quantizes [lighting] into 2-5 bands". — [MasterAllArts stylized NPR lesson](https://masterallarts.pages.dev/learn/threejs-from-zero/s4-09-stylized-npr/)
- THREE-CustomShaderMaterial (1,372★, last push 2025-10-12) lets you extend built-in materials (keep PBR/shadows and inject custom shading). — [FarazzShaikh/THREE-CustomShaderMaterial](https://github.com/FarazzShaikh/THREE-CustomShaderMaterial)
- Bruno Simon's folio-2025 uses a Blender palette texture "loaded and set in Three.js Material directly". Its systems include Lighting, Fog, Snow, RainLines, WaterSurface and Grass. — [brunosimon/folio-2025](https://github.com/brunosimon/folio-2025)

### Inferences
- **The "premium stylized" recipe** (judgment): (a) a 3–4 band ramp texture for diffuse instead of hard 2-tone, (b) a Fresnel rim light tinted with the dusk sky color, (c) emissive windows/neon above 1.0 feeding bloom, (d) depth-fog and a height gradient from Sky.js or an HDRI so the distance fades into dusk, (e) a selective outline only on the mascot and cars (inverted hull, cheap) instead of a full-screen edge pass, and (f) baked AO in building/street textures. This reads as "designed", unlike the PS2 low-res look.
- **HDRI choice**: a Poly Haven dusk/sunset HDRI (CC0) through PMREMGenerator for `scene.environment`, not RoomEnvironment (studio-neutral). That lets reflections on cars, the board and wet streets pick up the warm horizon. Keep it at 1k–2k resolution for phones. (Poly Haven licensing and resolutions were not verified here; see Gaps.)
- **MeshPhysicalMaterial**: clearcoat on police cars and the skateboard deck adds a "toy-like premium" read, and sheen suits the mascot's fabric/hoodie. Avoid transmission on mobile because it needs an extra scene render. Use physical features only on hero objects and use MeshStandard or baked/unlit for the city.
- **Shadows for an endless runner**: one directional light with the shadow camera following the player (1024–2048 map), plus `ContactShadows`-style blurred depth or a simple blob decal under the car and board. CSM is desktop-tier. PCSS (drei-vanilla `pcss`) is expensive per fragment, so use it for the hero only.

### Gaps
- Poly Haven HDRI license terms and recommended resolutions were not verified in this session (polyhaven.com was not fetched).
- No measured costs found for drei-vanilla pcss or MeshTransmissionMaterial on phones.
- Whether `OutlineEffect` works with WebGPURenderer was not confirmed. TSL OutlineNode exists for WebGPU.

## WebGPU + TSL in three r17x/r18x: production-ready on phones in 2026? What does it unlock?

### Takeaway
WebGPU itself now ships in Chrome (desktop and Android 12+ on Qualcomm/ARM GPUs), Safari 26 (iOS/iPadOS/macOS) and Firefox desktop. **Firefox for Android is still not shipped**, and global support is roughly 82–86%. three's own manual still recommends **WebGLRenderer for pure WebGL2 apps** and calls WebGPURenderer experimental. Reports show WebGPURenderer slower than WebGL on Android for many-draw-call scenes, though most of those reports are against older revisions. Verdict: **don't launch on WebGPURenderer for a mid-range-phone-first site**. If you author new shaders, write them in TSL, which compiles to both WGSL and GLSL and works on WebGPURenderer's WebGL2 backend. That keeps a migration path open.

### Cited Findings
- WebGPU availability: Chrome on Android since 121 (Android 12+, Qualcomm/ARM GPUs). Safari 26 on macOS Tahoe 26, iOS 26, iPadOS 26 and visionOS 26. Firefox 141 on Windows and Firefox 145 on ARM64 macOS Tahoe. Linux, Android and Intel Macs are "in progress" for Firefox. — [web.dev: WebGPU supported in major browsers](https://web.dev/blog/webgpu-supported-major-browsers)
- The web-features explorer lists Firefox for Android as not supported, with "Baseline availability blocked since January 2026 by Firefox". The gpuweb implementation wiki shows Android behind a flag. — [web-features explorer: WebGPU](https://web-platform-dx.github.io/web-features-explorer/features/webgpu/); [gpuweb Implementation Status](https://github.com/gpuweb/gpuweb/wiki/Implementation-Status)
- Secondhand caniuse figures: ~85.72% full support (≈Aug 2026) and ~82.17% (≈Jul 2026). Unverified, since caniuse was not reachable. — [xictron blog](https://www.xictron.com/en/blog/on-device-ai-browser-webgpu-shops-2026/); [webcodingcenter](https://webcodingcenter.com/webgpu/why-webgpu-exists-and-where-it-stands--firefox-behind-a-flag-and-the-road-to-universal-support.html)
- three.js manual (search snippet): "WebGPURenderer uses a WebGPU backend by default and a WebGL 2 backend as a fallback", with `forceWebGL` to force WebGL2, and "WebGLRenderer is still maintained and the recommended choice for pure WebGL 2 applications". A forum reply calls WebGPURenderer "currently experimental", including the WebGL fallback. Features needing native WebGPU (for example compute) may be unavailable on fallback. — [three.js manual: WebGPURenderer](https://threejs.org/manual/en/webgpurenderer); [forum: TSL and webgl2 vs webgpu](https://discourse.threejs.org/t/tsl-and-webgl2-vs-webgpu/87974); [forum: compute on Firefox fallback](https://discourse.threejs.org/t/some-threejs-webgpu-examples-run-fine-on-firefox-but-others-dont/77110)
- Android performance reports: BatchedMesh example ~13 FPS WebGPU vs ~25 FPS WebGL on a Galaxy S20 FE (r169). Another report: 19 FPS WebGPU vs 57 FPS WebGL on a Pixel 8a, attributed to the UBO system with many render items. Forum reports of WebGPURenderer being ~2x slower on non-instanced meshes. These are mostly 2024–25 against r169–r181 and may be outdated. — [#29580](https://github.com/mrdoob/three.js/issues/29580); [#30560](https://github.com/mrdoob/three.js/issues/30560); [#31055](https://github.com/mrdoob/three.js/issues/31055); [forum 77629](https://discourse.threejs.org/t/why-webgpurenderer-performance-significantly-lower-than-webglrenderer/77629); [forum 87939](https://discourse.threejs.org/t/webgpu-performance-issue/87939)
- Recent three.js WebGPU work: r185 (01 Jul 2026) added WebXR on WebGPU and rendering to texture arrays. r186 added SunLight CSM. r187 (30 Oct 2026) added WebGPU depth-only render targets and removed code deprecated in r177. — [three.js releases](https://github.com/mrdoob/three.js/releases). The r187 changelog (secondary) lists new StandardDrawingPipeline / MeshletDrawingPipeline / VisibilityBufferDrawingPipeline and parallel pipeline compilation in `compileAsync()`. A third-party analysis found ~80% of r187 core changes were on the WebGPU renderer side. — [whatsnew.fyi](https://whatsnew.fyi/product/three-js); [sirocco18 analysis](https://sirocco18.jp/journal/en/threejs-r187.html); [note.com A COURTYARD](https://note.com/a_courtyard/n/n31706078d140?hl=en)
- r183: Clock deprecated in favor of Timer, BatchedMesh per-instance opacity, and WebGLCubeRenderTarget no longer works with WebGPURenderer (use CubeRenderTarget) (secondary). — [cinevva](https://app.cinevva.com/news/2026-03-18-threejs-r183-render-pipeline)
- TSL compiles to WGSL or GLSL, and WebGPURenderer falls back to WebGL2. — [three.js forum: Introduction to WebGPU and TSL](https://discourse.threejs.org/t/three-js-introduction-to-webgpu-and-tsl/78205)
- Bruno Simon's 2025 portfolio was used to build TSL skills. TSL lets it "run on WebGPU when the browser supports it, with no extra work" (Awwwards case study, Mar 2026; snippet only). — [Awwwards case study](https://www.awwwards.com/brunos-portfolio-case-study.html)
- Unlocks (from three's TSL display node list): GTAO, SSR, SSGI, SSS, TRAA/TAAU, FSR1 upscaling, OIT, recurrent denoise, godrays, lens flare and lens dirt as first-party nodes. — [three.js tsl/display](https://github.com/mrdoob/three.js/tree/dev/examples/jsm/tsl/display). Community TSL/WebGPU showcases: [owenyuwono/poseidon](https://github.com/owenyuwono/poseidon) (326★), [MisterPrada/singularity](https://github.com/MisterPrada/singularity) (320★), [VictorZakharov/threejs-nanites](https://github.com/VictorZakharov/threejs-nanites) (123★), and [kekkorider/threejs-starter](https://github.com/kekkorider/threejs-starter) (195★, pushed 2026-11-06).

### Inferences
- **What WebGPU would unlock for this site**: compute-shader particles (sparks from the board, police-light dust, rain, confetti in the meme gallery at 100k+ particles), GPU-driven instancing for the city, and TRAA/FSR upscaling (render at 0.6–0.75 scale on phones and upscale). None of it is essential for launch. Sparks and rain at 1–5k particles run fine on WebGL with instanced points.
- **Recommended posture**: ship on WebGLRenderer + pmndrs. Keep custom shaders small and isolated so they can be ported to TSL later. Revisit WebGPURenderer when (a) the three manual drops "experimental", (b) Firefox Android ships, and (c) target-phone benchmarks show parity. A hybrid alternative: WebGPURenderer with `forceWebGL` on Android and WebGPU on iOS 26 and desktop. That doubles the QA matrix.
- Breaking churn is high: RenderPipeline rename (r183), PMREM rebuild (r187) and NodeMaterial renames all landed in 2026. That is another reason to delay for a small team.

### Gaps
- No 2026 benchmark of WebGPURenderer vs WebGLRenderer on current mid-range phones (e.g., Snapdragon 7-series, A16) at r186/r187 was found.
- Whether pmndrs/postprocessing will support WebGPU, and when, is unknown.

## Ecosystem: react-three-fiber + drei — switch to R3F or stay vanilla?

### Takeaway
R3F (33.9k★) and drei (10.2k★) are healthy. Stable R3F is v9.x, and **v10 (WebGPU-first) is still alpha** in late 2026, alongside drei v11 alpha. For a single-scene endless runner built in plain ES modules, **stay vanilla three + Vite**. Port the drei pieces you need from **drei-vanilla** or three's examples (Sky, CSM, Lensflare, Water, Reflector). Switch to R3F only if the team is React-first or wants the R3F ecosystem (rapier, uikit, postprocessing JSX).

### Cited Findings
- R3F v10.0.0-alpha.6 ("Going WebGPU First") makes WebGPU the default renderer. The `/webgpu` entry is deprecated, and `/legacy` keeps WebGL typing. TSL hooks moved to `@react-three/tsl`. The v10 alpha launched in January 2026 alongside Drei v11 alpha (new scheduler, WebGPU). A source dated Apr 28, 2026 lists v9.6.0 as the latest stable. — [newreleases: fiber 10.0.0-alpha.6](https://newreleases.io/project/npm/@react-three/fiber/release/10.0.0-alpha.6); [Web Game Dev Newsletter #029](https://buttondown.com/webgamedev/archive/issue-029/); [forum: R3F WebGPU, WebGL2 fallback](https://discourse.threejs.org/t/r3f-webgpu-webgl2-fallback-tree-shaking/87188)
- Repo metrics: react-three-fiber 33,959★ (pushed 2026-10-21), drei 10,203★ (2026-11-17), react-postprocessing 1,771★ (2026-10-21), drei-vanilla 622★ (2026-02-20), react-three-rapier 1,765★ (2026-10-12), gltfjsx 5,906★ (last push 2024-11-04), r3f-perf 784★ (last push 2024-12-20, stale). — GitHub search API (see table above)
- react-postprocessing exposes N8AO with a `quality="performance"` preset and `halfRes`. — [react-postprocessing N8AO docs](https://react-postprocessing.docs.pmnd.rs/effects/n8ao)
- drei-vanilla provides vanilla ports of MeshTransmissionMaterial, Sparkles, Clouds, pcss, AccumulativeShadows, Outlines and others. ContactShadows and Sky were not listed. — [pmndrs/drei-vanilla](https://github.com/pmndrs/drei-vanilla). three examples ship Sky.js/SkyMesh.js. — [three.js objects](https://github.com/mrdoob/three.js/tree/dev/examples/jsm/objects)

### Inferences
- Vanilla equivalents map: drei `Environment` → `PMREMGenerator.fromEquirectangular` + RGBELoader/HDRLoader or UltraHDR. `ContactShadows` → port drei's implementation (an orthographic depth render + two blur passes, ~60 lines). `Float` → a sin-based bob in the update loop. `Sparkles` and `Clouds` → drei-vanilla. `Sky` → three `Sky.js`. `MeshTransmissionMaterial` → drei-vanilla (avoid on mobile). `Outlines` → drei-vanilla.
- The R3F cost is a React reconciler plus a bundle and a rewrite. The benefit is mostly developer ergonomics, not visual quality. Every visual technique listed here is available in vanilla.
- Avoid stale R3F-only tooling (r3f-perf, gltfjsx, react-three-offscreen) if staying vanilla. stats-gl is the vanilla perf monitor.

### Gaps
- An exact R3F v10 stable date and the current stable patch version (npm dist-tags) were not confirmed.

## Performance tooling: gltf-transform, KTX2, instancing, LOD, three-mesh-bvh, stats-gl, adaptive DPR

### Takeaway
The standard 2026 pipeline is **glTF-Transform (meshopt + KTX2/Basis ETC1S/UASTC + resize + dedupe/prune/weld)** at build time, **InstancedMesh/BatchedMesh** for repeated city props (buildings, lamps, cars), **three-mesh-bvh** for fast raycasts against meme cards and the street, **stats-gl** for GPU timing, and **detect-gpu + adaptive DPR** for tiering. Bruno Simon's folio-2025 follows this approach with gltf-transform + toktx ETC1S compression in an `npm run compress` step, plus a Vite build.

### Cited Findings
- folio-2025: `npm run compress` compresses GLB-embedded textures with ETC1S at quality 255 and PNG/JPG textures with ETC1S qlevel 255 (per-path presets), and converts UI images to WebP. The README links the gltf-transform CLI and KTX-Software `toktx`. The Blender export guidance is to skip compression at export because the compress step handles it. The project builds with Vite (`vite.config.js`). — [brunosimon/folio-2025](https://github.com/brunosimon/folio-2025)
- Tool repos: glTF-Transform 2,104★ (pushed 2026-10-20), meshoptimizer 8,948★ (2026-11-25), KTX-Software 1,413★ (2026-11-17), basis_universal 3,157★ (2026-10-30), three-mesh-bvh 3,593★ (2026-11-25), stats-gl 287★ (2026-07-10), detect-gpu 1,225★ (2026-11-22). — GitHub search API (table above); [glTF-Transform](https://github.com/donmccurdy/glTF-Transform); [meshoptimizer](https://github.com/zeux/meshoptimizer); [three-mesh-bvh](https://github.com/gkjohnson/three-mesh-bvh); [stats-gl](https://github.com/RenaudRohlinger/stats-gl); [detect-gpu](https://github.com/pmndrs/detect-gpu)
- r183 added per-instance opacity for BatchedMesh, and r184 removed deprecated instancing render paths in BatchedMesh. — [cinevva](https://app.cinevva.com/news/2026-03-18-threejs-r183-render-pipeline); [three.js releases](https://github.com/mrdoob/three.js/releases)
- BatchedMesh on Android was ~2x slower on WebGPU than WebGL in an r169 report. That is another reason to keep WebGL for phones. — [#29580](https://github.com/mrdoob/three.js/issues/29580)

### Inferences
- Concrete pipeline (judgment): `gltf-transform optimize in.glb out.glb --compress meshopt --texture-compress ktx2` (ETC1S for albedo/props, UASTC for normal maps and the hero character), `resize` textures to 1024 max on phones, and serve with MeshoptDecoder + KTX2Loader (basis transcoder). Expect GLB sizes 3–10x smaller and much lower VRAM than PNG/JPG.
- City: build 5–10 building kit pieces as InstancedMesh/BatchedMesh, recycled as the street scrolls (object pooling). Draw calls are the main mobile CPU cost. Aim for under ~100–150 draw calls on phones.
- LOD: three's `LOD` object, or simply switching distant buildings to merged, unlit, baked low-poly versions, plus fog to hide pop-in.
- Adaptive DPR: start at `min(devicePixelRatio, 1.5)` on phones, measure frame time with stats-gl or `renderer.info`, and step DPR between 0.75 and 1.5. Disable AO/DoF/godrays when below the target.
- three-mesh-bvh is only needed if raycasting against high-poly meshes (gallery picking against simple planes doesn't need it).

### Gaps
- Exact current glTF-Transform CLI flags and defaults were not verified against its docs in this session (gltf-transform.dev was not fetched).

## Award-level three.js sites / case studies relevant to a stylized city + character scene

### Takeaway
The most relevant reference is **Bruno Simon's folio-2025**: a stylized drivable world built with three.js + TSL (WebGPU with fallback), Blender palette textures, KTX2 compression, and systems for grass, water, weather and fog. Codrops case studies (for example Ronin161) show custom toon shaders with grain beating the stock toon material. Award sites specifically about a stylized city with a character could not be verified because Awwwards was not reachable.

### Cited Findings
- Bruno Simon folio-2025 (2,060★, pushed 2026-11-04): Vite build, stage-ordered game loop (physics → rendering at stage 998 → monitoring at 999), systems for Lighting, Fog, Snow, RainLines, WaterSurface and Grass, a Blender palette texture workflow, and ETC1S/KTX2 compression via gltf-transform/toktx. — [brunosimon/folio-2025](https://github.com/brunosimon/folio-2025)
- Awwwards case study (Mar 2026, snippet only): built with TSL to run on WebGPU when available, and the author set an end-of-2025 release deadline. — [Awwwards: Bruno's portfolio case study](https://www.awwwards.com/brunos-portfolio-case-study.html)
- Codrops Ronin161 portfolio case study: custom two-tone toon shader plus grain because the stock toon material lacked control. — [Codrops](https://tympanus.net/codrops/2024/02/20/case-study-ronin161s-portfolio-2024/)
- Codrops sketchy pencil post effect: Sobel-based outlines. — [Codrops](https://tympanus.net/codrops/2022/11/29/sketchy-pencil-effect-with-three-js-post-processing/)
- Stylized community repos: [sloemo01/diorama](https://github.com/sloemo01/diorama) (735★, pushed 2026-11-16, top "three.js toon" result), [mayacoda/toon-shader](https://github.com/mayacoda/toon-shader) (83★, 2023), [StarKnightt/summer-cycle](https://github.com/StarKnightt/summer-cycle) (73★, 2026-11-03), [ZyFou/ProceduralTerrains](https://github.com/ZyFou/ProceduralTerrains) (740★, 2026-11-24, volumetric clouds), and [ZaneAtega/Three-js-Anime-Shader](https://github.com/ZaneAtega/Three-js-Anime-Shader) (35★, 2026-11-26). — GitHub search API
- Awwwards lists a "Good City" Site of the Day on Jan 30, 2026, but its tech stack is unverified. — [Awwwards listings (snippet)](https://www.awwwards.com/websites/%23211E1E/?page=1)

### Inferences
- Techniques to borrow for the skateboard/police chase (judgment): palette-texture or gradient-map coloring for the whole city (one material, one texture, which enables batching), wind/motion in shaders rather than CPU, stylized speed lines and screen-space motion blur at top speed, emissive police light bars with flashing bloom, wet-street reflections faked with a Reflector or screen-space blur (not SSR), and fog + Sky gradient for the dusk depth. Bruno's approach of compressing everything at build time and keeping draw calls low is the template for mid-range phones.
- What separates "premium stylized" from "PS2 retro" here: high-res crisp AA'd output (not low-res upscale), controlled color via grading, soft grounded shadows/AO, readable silhouettes with rim light or outlines, and consistent art direction across models. Mixing Meshy/Sketchfab styles, which the reference site does, breaks that consistency.

### Gaps
- Awwwards SOTD entries matching "stylized city + character + three.js" in 2026 could not be identified or verified (awwwards.com was blocked, and search gave only listing pages).
- No technical breakdown of itshoss.fun beyond the brief was researched.
- Three.js Journey (Bruno Simon's course) lesson-level techniques were not fetched. The general knowledge is that it covers baking in Blender, shaders, post-processing and performance, but that is not verified here.
