# Character pipeline: one 2D mascot image -> rigged, animated, web-optimized 3D (GLB) for "Sniffer"

Research date: 2026-11-26. Method notes for the report writer:
- GitHub stats came from `gh api -X GET search/repositories` (stars / last push date, pulled 2026-11-26). The per-repo `repos/<owner>/<name>` endpoint is blocked in this session, but the search API works. Cited as [GitHub search API](https://api.github.com/search/repositories).
- WebFetch could not reach `fal.ai` or `docs.meshy.ai` (DNS blocked in this sandbox: those hosts have to be allowed in the session's network settings). Everything about fal/Meshy comes from search-result snippets of their own llms.txt/docs pages, not full-page reads. Check exact prices again before spending money.
- The project also needs fal.ai reachable from the container for API calls (`fal.run`, `queue.fal.run`). Right now `fal.ai` does not resolve here.

## 1. Image-to-3D: which services give the cleanest stylized/toy characters, and which run via API with no GPU?

### Takeaway
For a glossy chibi mascot with no local GPU, the practical shortlist is **Meshy 7.1 (on fal or Meshy API)**, **Tripo H3.1 / Smart Mesh P1 (on fal or Tripo API)**, **Hunyuan3D 3.1 Pro (on fal or Replicate)** and **Rodin Gen-2/2.5 (on fal, quad modes)**. All cost roughly $0.2-$1.2 per generation. Meshy and Tripo are the only ones that also do rig + animation in the same API. Open weights (TRELLIS.2, Hunyuan3D 2.1, Step1X-3D, TripoSG) need 24-29 GB VRAM GPUs, so we can only use them through hosted endpoints.

### Cited Findings
**Meshy (what itshoss.fun used)**
- fal endpoints exist: `fal-ai/meshy/v6/image-to-3d`, `fal-ai/meshy/v6/multi-image-to-3d`, `fal-ai/meshy/v6/text-to-3d`, `fal-ai/meshy/v6-preview/...`, `fal-ai/meshy/v7.1/image-to-3d` (also listed as `meshy/v7.1/image-to-3d` and `meshy/v7/image-to-3d`), and standalone `fal-ai/meshy/rigging` — [fal Meshy v6 llms.txt](https://fal.ai/models/fal-ai/meshy/v6/image-to-3d/llms.txt); [fal Meshy 7.1](https://fal.ai/models/fal-ai/meshy/v7.1/image-to-3d/llms.txt); [fal meshy/v7.1](https://fal.ai/models/meshy/v7.1/image-to-3d/llms.txt); [fal Meshy Rigging](https://fal.ai/models/fal-ai/meshy/rigging/llms.txt)
- On the fal v6 image-to-3d endpoint, `enable_animation` requires `enable_rigging=true`. The animation preset id must be in [0, 696] (0 = Idle, default 92). Character height defaults to 1.7 m. Animated GLB + FBX are returned — [fal Meshy v6 llms.txt](https://fal.ai/models/fal-ai/meshy/v6/image-to-3d/llms.txt)
- fal add-on pricing: auto-rig +$0.20, animation +$0.12 (multi-image v6 and v7.1). Standalone `fal-ai/meshy/rigging` costs $0.20 per request, or $0.32 with animation. It is described as rigging "humanoid" GLBs — [fal Meshy Rigging](https://fal.ai/models/fal-ai/meshy/rigging/llms.txt); [fal Meshy v6 multi-image](https://fal.ai/models/fal-ai/meshy/v6/multi-image-to-3d/llms.txt). I did not find the base per-call price of the v6 or v7.1 single-image endpoints on fal.
- Meshy's own API uses prepaid credits. The pricing table lists 20 credits for mesh-only image-to-3D on meshy-7.1/meshy-6, rigging 5 credits per request, and animation billed per action (a localized page says 3 credits). A third-party review and Meshy's consumer credits guide disagree and say animation is free — [Meshy API pricing](https://docs.meshy.ai/api/pricing); [Meshy credits guide](https://www.meshy.ai/tutorials/meshy-credits-guide); [3rd-party review](https://intercom.help/insideverdict/en/articles/16539001-meshy-ai-review-2026-i-tested-it-is-this-ai-3d-model-generator-worth-it)
- Meshy API changelog: quadruped rigging was added 2026-11-18. **meshy-7 retires 2026-12-31**. T1 requests return HTTP 400 from 2026-11-30 — [Meshy API changelog](https://docs.meshy.ai/api/changelog)
- Meshy 7.1 shipped around 2026-09-10 per third parties (the web changelog files it under October 2026). The API added `meshy-7.1` on Oct 14, and `latest` now resolves to it. Ultra mode was replaced by Standard / Ultra 2K / Ultra 4K. 4K needs meshy-7.1, works with single-image input only, and is not available on Multi-Image. Downloading 7.1 results requires a paid subscription — [VoxelMatters](https://www.voxelmatters.com/meshy-7-1-raises-geometric-detail-with-a-new-ultra-4k-mode/); [Meshy web changelog](https://docs.meshy.ai/en/webapp/changelog); [Meshy API changelog](https://docs.meshy.ai/en/api/changelog)
- Meshy "Smart Topology" (model T2.5, default since Oct 2026) makes low-poly meshes with native part segmentation and a controllable polycount, up to 30,000 faces. Multi-Image to 3D does not support meshy-t2.5 — [Meshy web changelog](https://docs.meshy.ai/en/webapp/changelog)
- **Meshy N1** is a texture model "for stylized and low-poly game assets". It paints base color directly and is on all plans including Free. Via the API it textures from the reference image stored in a meshy-7.1 preview — [Meshy web changelog](https://docs.meshy.ai/en/webapp/changelog); [Meshy API changelog](https://docs.meshy.ai/en/api/changelog)
- Meshy 7 launch PR (Aug 2026) claims "a new bar for image-3D alignment" (vendor claim) — [AAP/Cision](https://www.aap.com.au/aapreleases/cision20260812ae24698/)

**Tripo (VAST)**
- fal endpoints: `tripo3d/h3.1/image-to-3d` and `tripo3d/p1/image-to-3d`. P1 costs $0.40 untextured or $0.50 textured — [fal Tripo H3.1](https://fal.ai/models/tripo3d/h3.1/image-to-3d/llms.txt); [fal Tripo P1](https://fal.ai/models/tripo3d/p1/image-to-3d/llms.txt)
- Smart Mesh P1.0 and H3.1 were released together around March 2026. P1.0 makes "clean, structured low-poly topology" with organized edge flow in about 2 s. H3.1 is the high-fidelity hero-asset model — [Tripo blog](https://www.tripo3d.ai/blog/introducing-smart-mesh-v1); [Newsfile PR](https://www.newsfilecorp.com/release/289472/Tripo-AI-Introduces-Smart-Mesh-P1.0-Defining-a-New-Phase-for-AI-3D-Production); [Programming Insider](https://programminginsider.com/tripo-ai-introduces-h3-1-advancing-high-fidelity-ai-3d-generation-for-production/)
- Tripo dev docs: the smart low-poly option covers 500-20,000 faces, or 500-10,000 with `quad=true`. Quad-mesh FBX output is available. Another Tripo page says quads go up to 25k — [Tripo v3.1 docs](https://developers.tripo3d.com/en/models/v3-1); [Tripo smart mesh](https://www.tripo3d.ai/uk/features/smart-mesh)
- A third-party review says H3.1 can produce "chaotic triangles" on complex shapes and recommends P1.0 for low-poly work — [Neural4D review](https://blog.neural4d.com/comparisons/tripo-3-1-model-review/)
- The Tripo rig model is version v3.0-20260909. It outputs rigged GLB/FBX in about 30 s. Third-party reseller WaveSpeed charges $0.30 per rig plus $0.12 per animation. A Tripo page says rigging costs 25 credits via the API — [Tripo rig docs](https://developers.tripo3d.com/en/models/rig); [WaveSpeed Tripo animate](https://wavespeed.ai/models/tripo3d/animate); [Tripo blog (stylized proportions)](https://www.tripo3d.ai/blog/best-mixamo-alternatives-stylized-creature-proportions)

**Hunyuan3D (Tencent)**
- fal endpoints: `fal-ai/hunyuan-3d/v3.1/pro/image-to-3d`, `fal-ai/hunyuan-3d/v3.1/rapid/image-to-3d`, `fal-ai/hunyuan3d-v3/image-to-3d`, `fal-ai/hunyuan3d/v2`, `fal-ai/hunyuan3d/v2/turbo`, and `fal-ai/hunyuan3d/v2/mini/turbo` ($0.08). The fal marketing page lists Pro at $0.375 and Rapid at $0.225 per generation — [fal Hunyuan 3.1 Pro docs](https://fal.ai/docs/model-api-reference/3d-api/hunyuan-3d-v3.1-pro); [fal Hunyuan page](https://fal.ai/hunyuan-3d); [fal v2 mini turbo](https://fal.ai/models/fal-ai/hunyuan3d/v2/mini/turbo/llms.txt)
- Replicate also hosts `tencent/hunyuan-3d-3.1` (official) and `ndreca/hunyuan3d-2` (community) — [Replicate hunyuan-3d-3.1](https://replicate.com/tencent/hunyuan-3d-3.1); [Replicate ndreca/hunyuan3d-2](https://replicate.com/ndreca/hunyuan3d-2/examples)
- 3.0 (Sep 2025) and 3.1 (early 2026) are hosted or closed only. **No open-weight 3.x release was found.** 2.1 is the fully open release with training code. Some 3.0-only controls (Optimized Mesh, polygon type) are not exposed on 3.1 — [Scenario help](https://help.scenario.com/articles/5967392966-hunyuan-3d-models-the-essentials); [Pandaily](https://pandaily.com/tencent-unveils-hunyuan-3d-3-0-ai-model-tripling-modeling-accuracy-with-free-access)
- Hunyuan3D 2.1 (open) needs 10 GB VRAM for shape, 21 GB for texture and 29 GB for both. It was tested on an A100. It has a `--low_vram_mode` flag — [Hunyuan3D-2.1 README](https://raw.githubusercontent.com/Tencent-Hunyuan/Hunyuan3D-2.1/main/README.md); [arXiv 2506.15442](https://arxiv.org/abs/2506.15442)
- A comparison article says Hunyuan accepts up to 8 views of an object, which suits multi-view input (third-party) — [inker.si](https://inker.si/blog/best-ai-3d-model-generators-2026)

**Rodin / Hyper3D (Deemos)**
- fal endpoints: `fal-ai/hyper3d/rodin` ($0.40), `fal-ai/hyper3d/rodin/v2` (Gen-2), `fal-ai/hyper3d/rodin/v2.5` plus `/fast`, and `/text-to-3d(/fast)`. HighPack add-on +$0.80 on fal. Runware lists Gen-2 at $0.40, or $1.20 with HighPack — [fal Rodin v2.5](https://fal.ai/models/fal-ai/hyper3d/rodin/v2.5/llms.txt); [fal Rodin](https://fal.ai/models/fal-ai/hyper3d/rodin/llms.txt); [Runware schema](https://runware.ai/docs/models/hyper3d-rodin-gen-2/schema.json)
- Gen-2.5 topology enum on fal: Auto, 1K/4K/8K/18K/20K Quad, and 2K/4K/8K/10K/20K Triangle. Gen-2 maps options to `mesh_mode` Quad or Raw plus `quality_override` — [fal Rodin v2.5 llms.txt](https://fal.ai/models/fal-ai/hyper3d/rodin/v2.5/llms.txt); [fal Rodin v2](https://fal.ai/models/fal-ai/hyper3d/rodin/v2/llms.txt)
- Comparisons call Rodin the "highest raw photorealism / dense geometry" option. "Tripo and Rodin both offer quad topology and clean UVs; Meshy's textures go highest in resolution" — [inker.si](https://inker.si/blog/best-ai-3d-model-generators-2026); [blenderai.org compare](https://blenderai.org/compare/best-image-to-3d-ai)
- No Rodin listing found on Replicate — [search summary of Replicate listings](https://replicate.com/firtoz/trellis)

**TRELLIS / TRELLIS.2 (Microsoft, open, MIT)**
- fal: `fal-ai/trellis-2`, `fal-ai/trellis`, `fal-ai/trellis/multi`. Replicate (community): `firtoz/trellis`, `firtoz/trellis2`, `fishwowater/trellis2`. One user warns of a 4-8 min cold-start setup on Replicate ("be aware of the cost") — [fal Trellis docs](https://fal.ai/docs/model-api-reference/3d-api/trellis); [Replicate fishwowater/trellis2](https://replicate.com/fishwowater/trellis2); [Replicate firtoz/trellis2](https://replicate.com/firtoz/trellis2)
- TRELLIS.2-4B: a 4B flow-matching model with PBR output (base color, roughness, metallic, opacity) at 512³-1536³ voxel grids. **Needs at least 24 GB NVIDIA VRAM**, verified on A100/H100. About 17 s at 1024³ and 60 s at 1536³ on H100. Third-party VRAM figures (16/40/80 GB) conflict with this and are unverified — [HF model card](https://huggingface.co/microsoft/TRELLIS.2-4B/blob/main/README.md); [Codesota](https://www.codesota.com/news/trellis-2-3d-generation)
- `pwilkin/trellis.cpp` is a C++/GGML port of TRELLIS.2 (CUDA + Vulkan, HTTP server), 417 stars, pushed 2026-11-24. I found no evidence it runs usefully on CPU only — [GitHub search API](https://api.github.com/search/repositories)

**Other open models (all GPU-only for us)**
- Step1X-3D (Apache-2.0) is stale since Sep 2025. TripoSG (MIT) is stale since Apr 2025. SPAR3D was last pushed May 2025. Sparc3D, Direct3D-S2 and UltraShape-1.0 are geometry-focused (UltraShape last pushed Jan 2026). Hi3D v1.0 (refinement on Sparc3D) was pushed 2026-10-23. Hunyuan3D-Omni (multi-condition control) and Hunyuan3D-Part (part segmentation) are both late-2025. fal has a "Hunyuan3D Part Splitter" endpoint (referenced by the `alexanderwanyoike/depart` Blender addon) — [GitHub search API](https://api.github.com/search/repositories)

**GitHub stats (pulled 2026-11-26 via search API)** — [GitHub search API](https://api.github.com/search/repositories)
| Repo | Stars | Last push | License | Status |
|---|---|---|---|---|
| Tencent-Hunyuan/Hunyuan3D-2 | 15,572 | 2025-10-28 | custom | slowing |
| microsoft/TRELLIS | 14,408 | 2026-10-27 | MIT | active |
| microsoft/TRELLIS.2 | 13,242 | 2026-07-10 | MIT | active-ish |
| Tencent-Hunyuan/Hunyuan3D-2.1 | 4,565 | 2025-10-17 | custom (Tencent) | stale >1y |
| VAST-AI-Research/TripoSG | 1,952 | 2025-04-18 | MIT | stale |
| lizhihao6/Sparc3D | 1,365 | 2025-06-16 | - | stale |
| DreamTechAI/Direct3D-S2 | 1,303 | 2025-09-26 | - | stale |
| Stability-AI/stable-point-aware-3d (SPAR3D) | 1,095 | 2025-05-05 | custom | stale |
| stepfun-ai/Step1X-3D | 908 | 2025-09-08 | Apache-2.0 | stale |
| PKU-YuanGroup/UltraShape-1.0 | 875 | 2026-01-06 | - | quiet |
| hi3d-official/Hi3Dv1.0 | 772 | 2026-10-23 | - | active |
| Tencent-Hunyuan/Hunyuan3D-Omni | 672 | 2025-10-17 | - | stale |
| Tencent-Hunyuan/Hunyuan3D-Part | 567 | 2025-12-05 | - | stale |
| pwilkin/trellis.cpp | 417 | 2026-11-24 | MIT | active |
| lightningpixel/modly (local desktop image-to-3D app) | 8,792 | 2026-11-19 | custom | active |
| Bingeljell/image-to-3dlab ("AssetFurnace" open pipeline) | 1,283 | 2026-11-25 | Apache-2.0 | active |
| img2threejs/img2threejs ("rebuild object in image as code-only procedural three.js") | 21,965 | 2026-11-25 | Apache-2.0 | active |

### Inferences
- **Ranking for Sniffer (stylized toy, needs a rig, no GPU):**
  1. **Meshy 7.1 via fal or Meshy API**: proven by the reference site, with one call for mesh + rig + 697 animation presets. Use Smart Topology T2.5 or remesh to under 30k faces, and try N1 for the stylized texture look. Risk: its rigging is aimed at humanoids, and the robe hides the legs.
  2. **Tripo P1 (low-poly quad) or H3.1 via fal**, then the Tripo rig API: the cleanest native low-poly/quad topology, and a "universal" rig marketed for odd proportions. Cheap ($0.40-0.50 + $0.30 rig).
  3. **Hunyuan3D 3.1 Pro (fal or Replicate)**: strong geometry plus multi-view input, but no rigging, so pair it with UniRig/Meshy rigging.
  4. **Rodin Gen-2.5 quad modes (fal)**: good quad options, but tuned for realism and detail, which is less ideal for a smooth vinyl toy.
  5. **TRELLIS.2 (fal `fal-ai/trellis-2`)**: open, PBR, cheap, but triangle soup that needs retopology.
- A glossy vinyl toy is mostly smooth, low-frequency shapes with flat colors. Texture fidelity matters less than clean silhouettes, so a low-poly or quad output plus a **hand-authored three.js material** (MeshPhysicalMaterial with clearcoat, flat color per part) will probably look better than baked AI textures. Part-segmented output (Meshy T2.5, Hunyuan3D-Part) helps here: separate meshes for the robe, face, goggles, snout and belt can each get their own material.
- The budget is tiny: about 10-20 generations across 3 providers is under $15 on fal. Run the same image through Meshy 7.1, Tripo P1/H3.1 and Hunyuan 3.1 Pro and pick by eye.
- img2threejs (22k stars, procedural code-only rebuilds) may be a relevant "upgrade our primitives" path that needs no mesh generation. I only saw its repo description and did not evaluate its quality.

### Gaps
- Base per-call fal price for Meshy v6/v7.1 single-image and for `fal-ai/trellis-2` was not confirmed (fal pages could not be fetched).
- No independent head-to-head test on stylized chibi or toy characters was found. Comparisons are vendor or affiliate blogs.
- Whether the Tripo rig is exposed on fal (vs only Tripo API / WaveSpeed) was not confirmed.
- Whether Meshy 7.1 results downloaded via fal are subject to Meshy's "paid subscription required" rule was not confirmed.

## 2. Does generating a clean multi-view turnaround first help image-to-3D?

### Takeaway
Generating front/side/back views with Nano Banana Pro or GPT Image 2 and feeding them to a multi-image endpoint is now a standard, documented workflow (ComfyUI template, 3D AI Studio, Scenario). No controlled benchmark proves it beats single-image input. It is most useful for hidden areas (back of the hood, the hood tip, the robe back). The older research multi-view models (Zero123++, Era3D, MV-Adapter) are stale and need GPUs.

### Cited Findings
- ComfyUI's official "Character turnaround" template uses Nano Banana Pro to make a 360° turnaround from one reference image on a white background — [Comfy hub](https://comfy.org/hub/workflows/character-turnaround/)
- 3D AI Studio says character-sheet views can be split into panels and fed as multi-view input to multi-image image-to-3D models "for more accurate 3D characters". It lists GPT Image 2 as the most consistent option and Nano Banana 2 as the fast or cheap one. It warns that views "are drawn, not measured", so check proportions. Describe the outfit head to toe so the back view is right — [3D AI Studio docs](https://docs.3daistudio.com/image-studio/character-sheet); [3D AI Studio template](https://www.3daistudio.com/templates/character-turnaround-sheet)
- invideo says Nano Banana Pro beats Nano Banana 2 for character-sheet fidelity. Scenario says Nano Banana Pro and Seedream 4.5 reach similar or better results in fewer steps, with a ControlNet pose mode for strict pose consistency — [invideo](https://invideo.io/faq/how-do-you-create-a-multi-angle-character-turnaround/); [Scenario blog](https://www.scenario.com/blog/generate-character-turnarounds-scenario)
- Remove hand-held props before generating, because they drift between angles. **Relevant: generate Sniffer without the skateboard and add the board as a separate asset** — [3D AI Studio docs](https://docs.3daistudio.com/image-studio/character-sheet)
- Multi-image endpoints available: `fal-ai/meshy/v6/multi-image-to-3d` (no 4K, no T2.5 on multi-image), `fal-ai/trellis/multi`, and Hunyuan (up to 8 views per a third-party source) — [fal Meshy multi-image](https://fal.ai/models/fal-ai/meshy/v6/multi-image-to-3d/llms.txt); [fal Trellis](https://fal.ai/docs/model-api-reference/3d-api/trellis); [Meshy API changelog](https://docs.meshy.ai/en/api/changelog); [inker.si](https://inker.si/blog/best-ai-3d-model-generators-2026)
- Research multi-view generators are stale. Zero123++ (2,105 stars) last pushed 2024-02-23. Era3D (648, AGPL-3.0) last pushed 2024-12-09. MV-Adapter (1,304, Apache-2.0, ICCV 2025) last pushed 2025-06-26 — [GitHub search API](https://api.github.com/search/repositories)

### Inferences
- For Sniffer, do this: (a) make a clean single front A-pose or T-pose-ish image, with arms slightly out, no skateboard, plain background and even lighting. (b) Make side and back views with Nano Banana Pro or GPT Image 2. (c) Run single-image Meshy 7.1 (gets 4K and T2.5) **and** multi-image Meshy v6 / Trellis multi, then compare. Arms held away from the body also make auto-rigging more reliable.
- Zero123++, Era3D and MV-Adapter are not worth using in 2026 for this. Hosted image models already handle stylized characters well.

### Gaps
- No quantitative evidence that multi-view input improves mesh quality for stylized characters.
- I did not confirm the fal endpoint ids for Nano Banana Pro or GPT Image 2 (fal pages blocked).

## 3. Auto-rigging and animation for a short, squat, robed chibi

### Takeaway
No tool has been publicly tested on chibi proportions. Meshy (via fal, $0.20 rig + $0.12 animation) and Tripo ($0.30 rig) are the easiest API routes. UniRig (open, MIT, also on Replicate) and RigAnything are template-free and handle odd proportions, but need a GPU. Mixamo is humanoid-only and a weak fit. Because Sniffer is mostly a rigid shape (robe + head, stubby feet), a **simple hand-built rig in Blender (about 6-10 bones) plus procedural animation in three.js** is a strong, low-risk fallback.

### Cited Findings
- Mixamo's auto-rigger is documented for bipedal humanoids and is called a poor first choice for stylized creatures — [threejsresources](https://threejsresources.com/guides/mixamo-alternative); [Tripo blog](https://www.tripo3d.ai/blog/best-mixamo-alternatives-stylized-creature-proportions)
- AccuRIG (Reallusion, free) supports cartoonish figures and lets you place joints by hand for different body shapes. A reviewer says it is tuned for human motion, so stylized characters may need cleanup — [Reallusion Magazine](https://magazine.reallusion.com/2022/10/07/want-accurate-auto-rigging-for-characters-try-accurig/); [ludo.ai](https://ludo.ai/compare/best-ai-auto-rigging-tools)
- Meshy Smart Rig (Beta) targets creatures, robots and props, exports GLB only, and has no built-in animation. The fal `fal-ai/meshy/rigging` endpoint is described as for humanoid GLBs — [Meshy Mixamo-alternative blog](https://www.meshy.ai/blog/mixamo-alternative); [fal Meshy Rigging](https://fal.ai/models/fal-ai/meshy/rigging/llms.txt)
- Meshy animation presets: ids 0-696 on v6 (v6-preview says 500+, with default 1001) — [fal Meshy v6](https://fal.ai/models/fal-ai/meshy/v6/image-to-3d/llms.txt)
- The Tripo rig v3.0-20260909 auto-detects rig type and does bone naming. It outputs GLB/FBX in about 30 s. Tripo claims its "universal rig" works from humanoids to complex creatures (vendor claim) — [Tripo rig docs](https://developers.tripo3d.com/en/models/rig); [WaveSpeed Tripo rig](https://wavespeed.ai/models/tripo3d/rig); [Tripo guide](https://www.tripo3d.ai/content/en/guide/the-best-auto-rig-mixamo-alternative-tools)
- Grab3D's free auto-rigger says it handles big heads, but only for bipeds with two arms and a head — [Grab3D](https://grab3d.com/tools/auto-rig/)
- UniRig (VAST, SIGGRAPH 2025, MIT): 2,373 stars, last push 2026-06-04. ComfyUI-UniRig wrapper (GPL-3.0) pushed 2026-08-24. A community Replicate deployment exists at `aaronjmars/unirig-ai` — [GitHub search API](https://api.github.com/search/repositories); [Replicate unirig-ai](https://replicate.com/aaronjmars/unirig-ai)
- RigAnything (template-free autoregressive rigging, SIGGRAPH): `Isabella98Liu/RigAnything`, 175 stars, last push 2025-10-23 (stale-ish). A community pipeline (`flora6907/character-animation-pipeline`) chains InstantMesh + RigAnything + AnyTop/MDM on Modal — [GitHub search API](https://api.github.com/search/repositories)
- Text-to-motion: Tencent HY-Motion 1.0 (about 1B-parameter flow matching, open) has 2,689 stars, last push 2026-11-13. It outputs SMPL-H human motion. Retargeting to custom skeletons comes from community tools such as the Aero-Ex ComfyUI-HyMotion plugin (text -> rigged FBX with retarget) — [arXiv 2512.23464](https://arxiv.org/abs/2512.23464); [NYU Shanghai RITS](https://rits.shanghai.nyu.edu/ai/tencent-open-sources-hy-motion-1-0-a-billion-parameter-text-to-motion-ai-model/); [comfy.icu HyMotion](https://comfy.icu/extension/Aero-Ex__ComfyUI-HyMotion); [GitHub search API](https://api.github.com/search/repositories)
- MoMask (1,354 stars) last pushed 2024-09 (stale) — [GitHub search API](https://api.github.com/search/repositories)
- Rigify in Blender is free and handles any character but has a steep learning curve — [ludo.ai](https://ludo.ai/compare/best-ai-auto-rigging-tools)

### Inferences
- Sniffer's legs are mostly hidden by the robe, and his feet are stubby. Humanoid auto-riggers may misplace hips and knees, and walk-cycle presets will look odd on a squat body. Riding a skateboard needs only a few motions: idle bob, crouch or ollie, lean left/right, balance wobble, hood-tip flop, blink or goggle glint, and a wave.
- Suggested approach: (1) Try Meshy rig + a few presets (idle, wave, jump) and Tripo rig on the best mesh. (2) If the joints look wrong, build a minimal Blender armature by script (root, spine, head, hood_1..3 chain for the floppy tip, arm_L/R, foot_L/R) with automatic weights. Then key 5-8 short clips in Blender or drive them in three.js (the hood tip can be a spring or verlet chain at runtime, and skateboard tricks can be procedural transforms). This avoids depending on a GPU or an odd-proportion rigger.
- Text-to-motion (HY-Motion) produces human-body motion and adds retargeting risk with little gain for a 6-bone mascot. It is low priority.

### Gaps
- No public test of Meshy, Tripo or UniRig on chibi or robe characters.
- I could not confirm whether Meshy's new quadruped / Smart Rig is available on the API or fal for non-humanoids.
- Anything-World and ActorCore pricing and terms were not researched (out of tool budget).

## 4. Blender in a headless, GPU-less container

### Takeaway
`pip install bpy` works if the Python version matches the wheel exactly (each Blender release supports one Python version). Otherwise apt or a downloaded Blender tarball runs `blender -b -P script.py`. Blender MCP (`ahujasid/mcp-for-blender`, about 35.9k stars, active) needs a running Blender GUI or addon socket, so plain bpy scripting suits our container better. Instant Meshes is stale. QuadriFlow (built into Blender) and autoremesher are the retopology options.

### Cited Findings
- bpy 5.0.0 and 5.0.1 are on PyPI next to the 4.5/4.2 LTS lines. Each Blender release supports exactly one Python version (5.0.0 wheels seen are cp311; a third-party doc says 5.x targets 3.13, which conflicts, so check wheel tags). Versions outside the LTS window move to download.blender.org/pypi/bpy/. A Python version mismatch is the usual cause of "no matching distribution" — [PyPI bpy](https://pypi.org/project/bpy/5.0.0/); [pyvista-blender docs](https://kmarchais.github.io/pyvista-blender/getting-started/installation/); [Blender issue #119156](https://projects.blender.org/blender/blender/issues/119156)
- `ahujasid/mcp-for-blender` (renamed from blender-mcp; "Community plugin to control Blender 3D with any LLM") has 35,877 stars, last push 2026-11-18. Related: `arjun988/blender-skills` (5,014 stars, 94 Blender skills for Claude Code and others) and `EL4CTEO/blender-skills` (2,941, "Blender 5.3 workflows as Agent Skills") — [GitHub search API](https://api.github.com/search/repositories)
- Retopology tools: `wjakob/instant-meshes` has 6,313 stars, **last push 2022-01-03 (stale)**. `huxingyi/autoremesher` (MIT, automatic quad remeshing) has 3,735 stars, pushed 2026-10-07. `CGCookie/retopoflow` (3,369 stars, pushed 2026-11-09) is interactive, not scripted. `buaacyw/MeshAnythingV2` (artist-like mesh generation, GPU) last pushed 2025-04 — [GitHub search API](https://api.github.com/search/repositories)

### Inferences
- Container plan: `pip install bpy==<version matching python>`, or download the official Linux Blender tarball and run `blender -b`. Cycles CPU or EEVEE-Next headless rendering may need extra GL/EGL libs. A low-sample Cycles CPU render or Workbench is enough for turntable QA PNGs that the agent can read back as images.
- Scripted cleanup steps in bpy: merge by distance, then Remesh (voxel) or `bpy.ops.object.quadriflow_remesh()` to the target face count, then Decimate (collapse) to the budget, Smart UV Project, and bake the original AI texture onto the new mesh (Cycles bake on CPU works, just slowly). Add the armature and automatic weights, then export with `bpy.ops.export_scene.gltf(export_format='GLB', export_animations=True)`. These are standard Blender operators (from my own knowledge, not sourced in this pass).
- Use Blender MCP only if a human runs Blender locally. For an agent in a container, plain bpy scripts are simpler and reproducible.

### Gaps
- I did not verify which bpy wheel matches the container's Python, or whether Blender 5.x has headless EGL quirks on this machine.
- No source checked for QuadriFlow behavior or quality on AI meshes.

## 5. Web optimization (glTF-Transform, gltfpack, three.js loaders, size budgets)

### Takeaway
Use `gltf-transform optimize` (meshopt geometry + animation compression, KTX2/Basis or WebP textures, resize to 1024-2048) or `gltfpack`. In three.js, register `MeshoptDecoder` and `KTX2Loader` on `GLTFLoader`. Do not stack Draco and meshopt encoders. For a hero character, aim for roughly 1-3 MB GLB and 10-30k triangles.

### Cited Findings
- `@gltf-transform/cli` has a combined `optimize` command: meshopt for geometry and animation, plus KTX2 via Basis Universal (ETC1S smaller and lossier, UASTC higher quality) or `--texture-compress webp` — [npm @gltf-transform/cli](https://www.npmjs.com/package/@gltf-transform/cli)
- Meshopt is "fast decode, animation-safe". three.js loads it with `meshopt_decoder.module.js` from examples/jsm/libs — [jvinhit blog](https://jvinhit.github.io/blog/threejs-16-gltf-compression-draco-meshopt-ktx2/)
- One forum report: gltfpack with KTX2 shrank a 40 MB GLB to 5 MB. A blog claims 5-10x smaller with no visible loss (anecdotal) — [Babylon forum](https://forum.babylonjs.com/t/about-the-gltf-transform-tool/49116); [jvinhit blog](https://jvinhit.github.io/blog/threejs-16-gltf-compression-draco-meshopt-ktx2/)
- Example budget (secondary source): mobile web about 2 MB, 50k triangles, 1024² textures. It also warns never to mix gltfpack meshopt output with gltf-transform Draco — [skills.sh model optimizer](https://skills.sh/openaec-foundation/three.js-claude-skill-package/threejs-agents-model-optimizer)
- Tools are active: `donmccurdy/glTF-Transform` (2,104 stars, MIT, pushed 2026-10-20), `zeux/meshoptimizer` incl. gltfpack (8,948 stars, MIT, pushed 2026-11-25), `CesiumGS/gltf-pipeline` (2,138, pushed 2026-06-23). `pmndrs/gltfjsx` (5,906 stars) last pushed 2024-11 (quiet). `microsoft/glTF-Toolkit` is stale (2023) — [GitHub search API](https://api.github.com/search/repositories)

### Inferences
- Suggested commands:
  `gltf-transform optimize in.glb out.glb --compress meshopt --texture-compress ktx2 --texture-size 1024`
  or `gltfpack -i in.glb -o out.glb -cc -tc -kn`. Run `gltf-transform inspect` to see what dominates the size. ETC1S works for base color and UASTC for normal maps. The flags are from my own knowledge of the CLIs, so verify them with `--help`.
- If the mascot uses flat per-part colors and clearcoat materials instead of baked textures (see section 1), textures nearly vanish from the file. The GLB can be under 1 MB with 10-20k triangles plus 6-8 animation clips, which beats a Meshy-textured 4K export by a wide margin.
- In three.js: `loader.setMeshoptDecoder(MeshoptDecoder)` and `loader.setKTX2Loader(new KTX2Loader().setTranscoderPath(...).detectSupport(renderer))`. Use AnimationMixer for the clips.

### Gaps
- No authoritative size budget for web hero characters was found. The 2 MB / 50k figure is from a secondary source.

## 6. Free CC0/CC-BY props, vehicles and city kits

### Takeaway
Kenney (CC0, ships glTF) and Quaternius (CC0) are the safest no-attribution sources for stylized cars, cities and props. Poly Pizza bundles many CC0 low-poly packs (e.g., Kay Lousberg's City Builder Bits). Sketchfab has far more variety, but CC-BY needs attribution, and the NC/ND variants must be avoided for modified commercial use.

### Cited Findings
- Kenney Car Kit is CC0 1.0 and comes in OBJ, FBX and glTF. Attribution is not required — [Kenney Car Kit itch.io](https://kenney-assets.itch.io/car-kit); [OpenGameArt car kit](https://opengameart.org/content/car-kit)
- Other Kenney kits on OpenGameArt include City Kit (Commercial) and Retro Urban Kit — [OpenGameArt city kit commercial](https://opengameart.org/content/city-kit-commercial); [OpenGameArt retro urban kit](https://opengameart.org/content/retro-urban-kit)
- Quaternius releases are CC0 ("you can even use them in commercial projects"), e.g., low-poly car packs — [OpenGameArt lowpoly cars](https://opengameart.org/content/lowpoly-cars); [itch.io comment](https://itch.io/post/608031)
- Poly Pizza bundle "City Builder Bits" (by Kay Lousberg) is free for personal and commercial use with no attribution — [Poly Pizza](https://poly.pizza/bundle/City-Builder-Bits-1wLdnIddSx)
- Sketchfab: CC models need credit unless CC0, and the attribution must travel with the asset (creator username + model link). CC BY-NC bans commercial use. CC BY-ND bans modification. Sketchfab Standard-license (paid store) models need no credit. Store models are all available as glTF. The download dialog has a "Copy credits" button, and license filters exist in search — [Sketchfab help](https://help.sketchfab.com/en/articles/16152215-crediting-users-for-3d-model-downloads); [Sketchfab Download API guidelines](https://sketchfab.com/developers/download-api/guidelines); [Sketchfab CC intro](https://sketchfab.com/blogs/community/an-introduction-to-creative-commons-licenses); [Sketchfab license filters](https://sketchfab.com/blogs/community/refine-downloadable-model-searches-with-new-license-filters)

### Inferences
- Mixing kits gives a mismatched look. Pick one family (for example, all Kenney or all Quaternius, which both use a flat-shaded low-poly style) and re-material it in three.js with one palette so it matches Sniffer's glossy toy look. Keep a CREDITS file and on-page credits for any Sketchfab CC-BY assets.
- Poly Haven (CC0 HDRIs, textures and some models) is likely the best source of environment HDRIs for glossy reflections, but its license was not confirmed in this pass.

### Gaps
- Poly Haven license terms were not returned by search. It is widely known as CC0, but that is unverified here.
- I did not confirm Quaternius's current city or skate-park pack names, or whether Poly Pizza attribution varies by model (some Poly Pizza models are CC-BY).

## Free route (no Meshy)

Added 2026-11-26 after the user ruled out Meshy and other paid-only main routes. Space data comes from the Hub API (`https://huggingface.co/api/spaces/<id>`: runtime stage, hardware, host) and from each Space's `app.py`/`gradio_app.py`, fetched raw from huggingface.co. Cited as [HF Spaces API](https://huggingface.co/api/spaces) and the per-Space file links.

### Takeaway
The best free image-to-3D right now is **TRELLIS.2 (`microsoft/TRELLIS.2`, MIT, PBR GLB)** and **Hunyuan3D-2.1 (`tencent/Hunyuan3D-2.1`, PBR GLB)** on free ZeroGPU Spaces, plus **SkinTokens (`VAST-AI/SkinTokens`, MIT, UniRig's successor)** for free auto-rigging. All can be called with `gradio_client`. The free quota is tiny: about 2 min/day of GPU time anonymous and about 5 min/day with a free HF token, which is roughly 1-2 full generations per day per account. For a mascot made of simple shapes like Sniffer, a **carefully scripted Blender model will probably match or beat free AI output on web-readiness and polish**. Use the AI meshes as proportion/reference checks or for props, not as the hero.

### Cited Findings
**(1) Free ZeroGPU Spaces (status checked 2026-11-26)**
| Space id | Stage / HW | Host (needs allowlist) | Output | Main endpoints (fn names = default gradio api_name) |
|---|---|---|---|---|
| `microsoft/TRELLIS.2` (MIT, Gradio 6.1) | RUNNING / zero-a10g | `microsoft-trellis-2.hf.space` | textured **PBR GLB** (WebP textures) | `/image_to_3d`(image RGBA, seed, resolution "512"/"1024"/"1536", 12 sampler params) -> state + preview; then `/extract_glb`(state, decimation_target 100k-500k default 300k, texture_size 1024-4096 default 2048). Each is `@spaces.GPU(duration=120)`. Calls `briaai/BRIA-RMBG-2.0` for background removal, server-side |
| `trellis-community/TRELLIS` (MIT, Gradio 5.34) | RUNNING / zero-a10g | `trellis-community-trellis.hf.space` | textured GLB (TRELLIS v1) + Gaussian .ply | `/generate_and_extract_glb`(image, multiimage gallery, is_multiimage, seed, ss/slat guidance+steps, multiimage_algo, mesh_simplify 0.9-0.98, texture_size 512-2048). `duration=120`. **Supports multi-image input** |
| `microsoft/TRELLIS` | **CONFIG_ERROR** (broken) | `microsoft-trellis.hf.space` | - | use trellis-community instead |
| `tencent/Hunyuan3D-2.1` (Gradio 4.44) | RUNNING / zero-a10g | `tencent-hunyuan3d-2-1.hf.space` | GLB/OBJ etc. shape-only or **PBR-textured** (obj2gltf PBR conversion) | `/shape_generation`(caption, image, mv_front/back/left/right, steps, cfg, seed, octree_resolution, rembg, num_chunks, randomize) `duration=60`; `/generation_all` (shape + texture) `duration=180`. Has Simplify Mesh with target_face_num (default 10,000) and an Include Texture export |
| `tencent/Hunyuan3D-2` | RUNNING / zero-a10g | `tencent-hunyuan3d-2.hf.space` | GLB with texture | same pattern. `generation_all` duration=90, shape duration=40 |
| `tencent/Hunyuan3D-2mv` | RUNNING / zero-a10g | `tencent-hunyuan3d-2mv.hf.space` | multi-view (front/back/left/right) -> shape | - |
| `tencent/Hunyuan3D-2mini-Turbo` | RUNNING / zero-a10g | `tencent-hunyuan3d-2mini-turbo.hf.space` | fast shape | - |
| `tencent/Hunyuan3D-Part` | RUNNING / zero-a10g | `tencent-hunyuan3d-part.hf.space` | part segmentation | - |
| `VAST-AI/TripoSG` (2025-05) | RUNNING / zero-a10g | `vast-ai-triposg.hf.space` | GLB + separate "Textured GLB" step (MV-Adapter texture) | `/run_full` duration=180, `/image_to_3d` 90 (target_face_num 10k-1M), `/run_texture` 120 |
| `Stable-X/Hi3DGen` (MIT) | RUNNING / zero-a10g | `stable-x-hi3dgen.hf.space` | **geometry only** (normal-bridged, about 40 MB mesh), no texture | `/generate_3d` |
| `hugging-apps/hi3dv1` | RUNNING / zero-a10g | `hugging-apps-hi3dv1.hf.space` | geometry refinement (Sparc3D-based) | - |
| `stepfun-ai/Step1X-3D` (Apache-2.0) | **PAUSED** | `stepfun-ai-step1x-3d.hf.space` | - | not usable |
| `ilcve21/Sparc3D`, `wushuang98/Direct3D-S2-v1.0-demo` | RUNNING but **cpu-basic** (proxies/placeholder, not real GPU inference) | - | - | not useful |
| `VAST-AI/MV-Adapter-I2MV-SDXL` (Apache-2.0) | RUNNING / zero-a10g | `vast-ai-mv-adapter-i2mv-sdxl.hf.space` | image -> multi-view images (for turnaround input) | - |
| `VAST-AI/SkinTokens` (MIT) | RUNNING / zero-a10g | `vast-ai-skintokens.hf.space` | **rigged GLB** (skeleton + skin weights) | `run_gradio`(files GLB, model_ckpt, sampling params, use_skeleton/use_transfer/use_postprocess). Uses an internal bpy server. Code comment says about 60 s budget on free tier |
| `Faisal786U/unirig-api` (MIT) | RUNNING / zero-a10g | `faisal786u-unirig-api.hf.space` | UniRig rigged GLB | `/rig_model`(input_glb) |
| `kirikir13/image-to-rigged-3d` (MIT) | RUNNING / zero-a10g | `kirikir13-image-to-rigged-3d.hf.space` | TRELLIS.2 PBR GLB -> SkinTokens-rigged GLB/FBX in one Space | `generate_3d`, `rig_3d` (duration=480) |
| `MohamedRashad/UniRig` | RUNTIME_ERROR | - | - | broken |
Sources: [HF Spaces API](https://huggingface.co/api/spaces/microsoft/TRELLIS.2); [TRELLIS.2 app.py](https://huggingface.co/spaces/microsoft/TRELLIS.2/blob/main/app.py); [trellis-community app.py](https://huggingface.co/spaces/trellis-community/TRELLIS/blob/main/app.py); [Hunyuan3D-2.1 gradio_app.py](https://huggingface.co/spaces/tencent/Hunyuan3D-2.1/blob/main/gradio_app.py); [Hunyuan3D-2 gradio_app.py](https://huggingface.co/spaces/tencent/Hunyuan3D-2/blob/main/gradio_app.py); [TripoSG app.py](https://huggingface.co/spaces/VAST-AI/TripoSG/blob/main/app.py); [Hi3DGen app.py](https://huggingface.co/spaces/Stable-X/Hi3DGen/blob/main/app.py); [SkinTokens demo.py](https://huggingface.co/spaces/VAST-AI/SkinTokens/blob/main/demo.py); [unirig-api app.py](https://huggingface.co/spaces/Faisal786U/unirig-api/blob/main/app.py); [image-to-rigged-3d app.py](https://huggingface.co/spaces/kirikir13/image-to-rigged-3d/blob/main/app.py)

- **ZeroGPU quota:** current docs and an HF blog give 2 min/day GPU for unauthenticated users, 5 min/day for free accounts and 40 min/day for PRO ($9/mo). An older docs version said 3.5 / 25 min. Since Apr 2026, PRO can buy overage at $1 per 10 min. A forum answer claims free accounts are also limited to about 3 requests/day (unconfirmed). Quota can be charged to the wrong identity when hitting `*.hf.space` directly or browsing incognito. Another forum thread reports quota being debited by the declared `duration` rather than real time — [HF ZeroGPU docs](https://huggingface.co/docs/hub/spaces-zerogpu.md); [HF blog](https://huggingface.co/blog/victor/building-zerogpu-spaces-autonomously); [HF changelog](https://api-inference.huggingface.co/changelog/zerogpu-overquota); [HF forum quota](https://discuss.huggingface.co/t/what-is-the-free-zerogpu-quota-for-1-space/178610/2); [HF forum 60s](https://discuss.huggingface.co/t/it-seems-use-60-sec-gpu-quota-instead-of-real-time-usage/175130)
- **Network:** from this container, `huggingface.co` works, but `tencent-hunyuan3d-2-1.hf.space` was **refused by the egress proxy (HTTP 403)**. Each Space host above must be allowlisted by exact name. `gradio_client` resolves the Space via `huggingface.co/api/spaces/<id>` and then talks to the `host` value (the `<subdomain>.hf.space` URL) for config, upload, queue and file download — [HF Spaces API host field](https://huggingface.co/api/spaces/tencent/Hunyuan3D-2.1)
- **Licences:** TRELLIS.2 code and weights are MIT — [HF model card](https://huggingface.co/microsoft/TRELLIS.2-4B/blob/main/README.md). The Hunyuan3D 2.x community licence **excludes the EU, UK and South Korea**, and the HF repo gates EU access — [Hunyuan3D-2 LICENSE](https://huggingface.co/tencent/Hunyuan3D-2/blob/main/LICENSE); [Hunyuan3D-2.1 LICENSE mirror](https://gitserver.onethingai.com/ai-models/Hunyuan3D-2.1/raw/branch/main/LICENSE). SkinTokens code and weights are MIT (Qwen3-0.6B backbone, arXiv 2602.04805), about 1.6 GB of checkpoints — [SkinTokens model card](https://huggingface.co/VAST-AI/SkinTokens/blob/main/README.md); [arXiv](https://arxiv.org/abs/2602.04805v1)

**(2) Free web tiers (secondary option)**
- **Tripo free:** 200 credits/month per Tripo help (third parties say 300). Free-plan outputs are public under CC BY 4.0, but Tripo says **free-plan models do not support commercial use**. Commercial rights come with paid plans (Pro about $20/mo) — [Tripo plan help](https://www.tripo3d.ai/help/billing/which-tripo-ai-plan-is-right-for-me); [Tripo commercial-use blog](https://www.tripo3d.ai/blog/commercial-use-ai-3d-models); [CostBench](https://www.costbench.com/software/ai-3d-generation/tripo-ai/free-plan/)
- **Hunyuan 3D official web app (3D engine):** Tencent's global launch announced **20 free generations/day** (enterprise API: 200 free credits). Not verified on the live site. The output licence for web-app generations was not found — [Tencent announcement](https://www.tencent.com/en-us/articles/2202235.html)
- **Rodin (Hyper3D):** generation and preview are free, and credits are spent on download. The free tier is about 10 credits, while a Gen-2 download reportedly costs about 40 credits (conflicting figures), so in practice no free hero downloads. A 7-day Creator trial is mentioned, and Creator costs $30/mo. Third parties say exports are licence-free for commercial use. Not confirmed officially — [itechguides](https://www.itechguides.com/hyper3d-rodin-cost-what-credits-cover-and-when-downloads-are-free); [VideoSDK](https://www.videosdk.live/ai-apps/hyper3d); [hyper3d pricing](https://hyper3d.ai/pricing)

**(3) Free rigging for a squat chibi**
- **SkinTokens / UniRig** on free Spaces (above) rig arbitrary GLBs template-free and are MIT — [SkinTokens model card](https://huggingface.co/VAST-AI/SkinTokens/blob/main/README.md)
- **Mixamo:** free with an Adobe ID, royalty-free commercial use, and the raw files cannot be redistributed. The auto-rigger needs a humanoid "with distinguishable head, body, arm, and leg areas". Large clothing, hair, tails or wings may fail, and it needs a neutral pose. Not available for Enterprise or Federated IDs. Web only — [Adobe Mixamo FAQ](https://helpx.adobe.com/creative-cloud/faq/mixamo-faq.html); [Adobe community FAQ](https://community.adobe.com/t5/mixamo-discussions/mixamo-faq-licensing-royalties-ownership-eula-and-tos/m-p/13234775)
- **AccuRIG 2 (Reallusion):** a free desktop app. Rigged-character export needs a free ActorCore account. It exports **FBX / USD / iAvatar (no GLB mentioned)** and is aimed at two-legged characters. v2.0 browses 4,500+ ActorCore motions, most of them paid — [CG Channel](https://www.cgchannel.com/2025/07/rig-and-animate-3d-characters-for-free-with-accurig-2-0/); [ActorCore upload/export](https://actorcore.reallusion.com/static-page/auto-rig/pre_page/upload-export/upload-export.html); [MakeUseOf](https://www.makeuseof.com/accurig-free-rigging-tool/)

### Inferences
- **Quota math:** TRELLIS.2 reserves 120 s for generate plus 120 s for extract. Hunyuan3D-2.1 `generation_all` reserves 180 s. On a free account (5 min/day) that is about **1 textured generation per day per account**. Anonymous (2 min) may not even cover one textured Hunyuan run. Shape-only Hunyuan (60 s) fits about 4-5 times. HF PRO ($9/mo, 40 min/day, about 10-15 full runs) is the cheap unlock if "free" can bend to $9. Always pass an `hf_token` so quota is charged to the logged-in account.
- **Allowlist for the free route:** `huggingface.co`, plus `microsoft-trellis-2.hf.space`, `tencent-hunyuan3d-2-1.hf.space`, `trellis-community-trellis.hf.space`, `vast-ai-skintokens.hf.space` (and optionally `tencent-hunyuan3d-2mv.hf.space`, `vast-ai-triposg.hf.space`, `faisal786u-unirig-api.hf.space`, `kirikir13-image-to-rigged-3d.hf.space`, `vast-ai-mv-adapter-i2mv-sdxl.hf.space`). The Spaces use Gradio 4.44 / 5.34 / 6.1, so install a current `gradio_client` and run `Client(id).view_api()` first to confirm the exact endpoint names and argument order.
- **Free ranking for Sniffer:**
  1. **Procedural headless-Blender model** (best fit, see 4).
  2. TRELLIS.2 Space (MIT, PBR) as a reference mesh or for props, decimated from about 300k faces.
  3. Hunyuan3D-2.1 Space (good shape, built-in 10k-face simplify, multi-view input). Avoid it if the site or team is in the EU/UK because of the licence.
  4. trellis-community TRELLIS v1 with multi-image turnaround input.
  5. TripoSG, or Hi3DGen (geometry only).
  Free Tripo/Rodin web tiers are not usable for a commercial site: Tripo bans commercial use, and Rodin's free credits do not cover a download.
- **Rigging verdict for a squat robe chibi:** Mixamo will probably reject or misplace joints, because the legs are hidden by the robe. AccuRIG needs a GUI desktop (no headless use) and outputs FBX. SkinTokens is the best free automatic option to try. But the most reliable route is a **scripted bpy armature**: root -> body -> head, a 3-bone hood-tip chain, short arm_L/R, foot_L/R, `ARMATURE_AUTO` weights, and keyed clips (idle bob, lean L/R, ollie crouch-jump, wave, hood flop). Export as GLB with animations. Few bones means clean weights and tiny files.
- **(4) Quality verdict:** For Sniffer, a scripted Blender model (subdivided quad primitives, bevels, crease edges, a solidified robe shell, clearcoat "vinyl" Principled BSDF with flat per-part colors, baked AO lightmap) **should match or beat free image-to-3D** for this use. The reasons:
  (a) The character is made of primitives: a cone/teardrop hood with a bent tip, sphere goggles with a torus rim, a cylinder snout with a grille, a torus belt with a box buckle, and capsule feet.
  (b) AI outputs arrive as 100k-500k-tri triangle soup, with lighting baked into the textures and mushy small features. They then need retopology, UVs and rebaking, which takes the same headless-Blender work anyway.
  (c) The procedural version is natively low-poly (about 10-20k tris), fully parametric (easy proportion tweaks) and rig-friendly (separate parts). It ships with materials that react to real-time lights and environment maps, so it gives the "glossy toy" look on the web.
  The weakness is organic silhouette nuance (a soft hood drape, a robe flare), where AI or sculpting is better. A hybrid works: generate a TRELLIS.2 or Hunyuan mesh from the front image as a **proportion and silhouette reference** in the Blender scene, and fit the procedural parts to it. Render turntables of both and compare by eye against the reference.

### Gaps
- No public quality comparison of procedural vs AI-generated stylized mascots exists. The verdict above is reasoning, not measurement.
- Could not call any Space (the `*.hf.space` hosts are blocked by the proxy), so exact `view_api()` signatures, real run times and output file sizes are unverified. The endpoint names above come from the function names in app.py.
- Whether free-account ZeroGPU checks the declared `duration` against remaining quota before running (which would block a 180 s job when less than 180 s remains) is not officially documented.
- Licence terms for output from Tencent's Hunyuan web app, and Rodin's official free-tier commercial terms, were not confirmed.
