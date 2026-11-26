# Anti-slop tooling, design-taste skills, three.js/3D skills and visual self-critique loops for Claude Code (as of 2026-11-26)

Method note: star counts and "pushed" dates come from the GitHub REST search API (`gh api -X GET search/repositories`) queried on 2026-11-26. READMEs were pulled from raw.githubusercontent.com and read directly. The ECC plugin was inspected from the local clone at /home/user/affaan-m/ecc (HEAD 4adeee6, 2026-11-19). Star counts in late 2026 are very inflated: several design skills show 100k+ stars, and ECC shows 311k. Treat stars as a measure of attention, not of quality. Nothing was installed.

## 1. Anti-slop tools: which ones target visual/design quality and which target prose?

### Takeaway
"Anti-slop" now covers three separate categories. (a) Visual/UI design skills with deterministic slop linters: Impeccable, Hallmark, unslop, antislop (miqdadbadjuber), Gesso and auteur. (b) Prose de-slop skills and detectors: sam-paech antislop-sampler/slop-forensics, theclaymethod/unslop, sloptrim, FeedHive. (c) Code-slop linters: dmmulroy/anti-slop and AI-SLOP-Detector. Only (a) is relevant to the mascot site. Every tool in (a) targets 2D web UI tells (purple gradients, Inter, cards inside cards, eyebrow labels, emoji icons). None of them detects 3D/WebGL slop such as primitive-built characters, flat sprite smoke or muddy tone mapping. auteur comes closest because it gates on a GPU/motion check.

### Cited Findings
**Visual/design anti-slop (relevant):**
- pbakaus/impeccable: ★117,284, pushed 2026-11-26. "Design vocabulary for your coding agent." It has 24 commands (`critique`, `audit`, `polish`, `bolder`, `quieter`, `colorize`, `typeset`, `layout`, `live`, and others) and a slop detector with "62 deterministic rules… No LLM, no API key." `npx impeccable detect https://…` scans a rendered page in your installed Chrome. The README says it is "strongest on interfaces that already exist." Install: `npx impeccable install` then `/impeccable init`, which writes PRODUCT.md. — [pbakaus/impeccable](https://github.com/pbakaus/impeccable)
- Nutlope/hallmark (made by Together AI): ★61,427, pushed 2026-11-11. "A design skill… that refuses to look AI-generated". It deals three themes from a catalog of 50 materials, lints the result "in a real browser," and ships 755 openly licensed photos. Gates come in tiers: Floor, Reflex and Finish. Install: `/plugin marketplace add nutlope/hallmark` then `/plugin install hallmark@hallmark`, or `npx skills add nutlope/hallmark -g --agent claude-code`. — [Nutlope/hallmark](https://github.com/Nutlope/hallmark)
- heydamir/unslop: ★22,040, pushed 2026-11-15. It turns "vibecoded, AI-looking UI into a designed interface" by finding "purple gradients, glows, emoji labels, shouty copy and uneven spacing" first and then restyling. Optional Playwright snapshots of a live site. Install: `claude plugin marketplace add heydamir/unslop` then `claude plugin install unslop@heydamir`. — [heydamir/unslop](https://github.com/heydamir/unslop)
- miqdadbadjuber/anti-slop ("antislop"): ★10,213, pushed 2026-11-21. A rulebook of "40 rules in three tiers." It describes itself as "a filter, not a style guide." The README says plainly that antislop alone produces a draft with "no direction," and that a DESIGN.md is mandatory for shippable UI. It has sub-skills /antislop-ui, -copywriting, -layoutmobile and -code. Install: `/plugin marketplace add https://github.com/miqdadbadjuber/anti-slop` then `/plugin install antislop@anti-slop`, or `npx antislop-ai`. — [miqdadbadjuber/anti-slop](https://github.com/miqdadbadjuber/anti-slop)
- Gesso-Build/skills (`@gessobuild/anti-slop`): ★95, pushed 2026-10-27. A deterministic HTML/CSS critic with "73 slop guards," each with an exact threshold and most with an idempotent auto-fix. It reads .html only, not JSX. Install: `npx -y @gessobuild/anti-slop install` or `/plugin marketplace add Gesso-Build/skills`. — [Gesso-Build/skills](https://github.com/Gesso-Build/skills)
- agiwhitelist/auteur: ★936, pushed 2026-08-06. "Directs a website like a film. Art direction is locked before a line of code… Every ship is gated by an executable anti-slop linter and a real motion check." Its own landing page runs 131,072 GPU particles. Install: `/plugin marketplace add agiwhitelist/auteur` then `/plugin install auteur@auteur`. — [agiwhitelist/auteur](https://github.com/agiwhitelist/auteur)
- Smaller UI de-slop skills: felipebasurto/unslop-ui ★913, funboy322/avoid-ai-design ★175 (also flags the "tasteful" defaults: cream plus terracotta), Laith0003/ux-skill ★112 ("171-rule anti-AI-slop linter"), gustavo-henriq/antislop-ui-ux-skill ★56, Vanszs/AntiSlopUI ★42. — GitHub search results: [unslop-ui](https://github.com/felipebasurto/unslop-ui), [avoid-ai-design](https://github.com/funboy322/avoid-ai-design), [ux-skill](https://github.com/Laith0003/ux-skill)

**Prose anti-slop (not relevant to visuals):**
- sam-paech/antislop-sampler: ★360, last pushed 2026-03-05. A backtracking token sampler that bans phrases ("No more testaments or tapestries"). It works at the inference level with koboldcpp, open-webui and vLLM, so it cannot be used with Claude. Related repos: sam-paech/auto-antislop ★212 and sam-paech/slop-forensics ★373 (last push 2025-11-01, stale). — [antislop-sampler](https://github.com/sam-paech/antislop-sampler), [slop-forensics](https://github.com/sam-paech/slop-forensics)
- Prose de-slop skills: theclaymethod/unslop ★1,239, MohamedAbdallah-14/unslop ★199, aplaceforallmystuff/the-antislop ★38, seyedehsanhadi/sloptrim ★436 (local detector), FeedHive/ai-slop-detector ★113 ("120 patterns"). mshumer/unslop ★573 was last pushed 2026-03-18. — [theclaymethod/unslop](https://github.com/theclaymethod/unslop), [sloptrim](https://github.com/seyedehsanhadi/sloptrim), [FeedHive](https://github.com/FeedHive/ai-slop-detector)

**Code slop (not relevant):** dmmulroy/anti-slop ★6,469 (Oxlint rules for "low-evidence TypeScript"). flamehaven01/AI-SLOP-Detector ★124. — [dmmulroy/anti-slop](https://github.com/dmmulroy/anti-slop)

### Inferences
- Every visual anti-slop tool here is tuned for 2D marketing/UI pages: typography, gradients, card layouts and copy. They will help with the site chrome around the mascot (hero layout, type, palette, copy). They will not make a primitive-built mascot or circle-sprite smoke look good. That needs the 3D skills in section 3.
- Deterministic linters (Impeccable detect, Gesso, Hallmark's browser lint) are worth more inside an agent loop than prose rules, because they return the same verdict every time and the generator cannot argue with them. Anthropic's own harness post makes the same argument (section 4).
- antislop's README admits that removing slop without a direction produces a bland draft. Pair any anti-slop filter with a positive art direction (a DESIGN.md or moodboard), not with the filter alone.

### Gaps
- I found no anti-slop rule set aimed specifically at 3D/WebGL output (for example "default MeshStandardMaterial grey," "no tone mapping," "sprite smoke," "capsule-and-sphere character"). This looks like a real gap. A custom rubric would have to be written.
- I did not verify any tool's before/after claims independently. All the comparisons are author-supplied.

## 2. Design-quality skills for Claude (Anthropic official, community taste skills) and what ECC contains

### Takeaway
Anthropic's official `frontend-design` skill is the baseline. It now explicitly lists the current AI-design clusters to avoid, including cream plus terracotta #D97757 and near-black plus acid green. The strongest community additions are Impeccable (critique/audit vocabulary), Taste Skill v2.5 (dealt palettes, layouts and real photos plus a headless-Chrome checker at 5 widths), Hallmark, and tastemaker (palette pulled from reference pixels and a persisted style lock). ECC has no three.js skill and no Anthropic frontend-design copy. Its useful pieces are the GAN-style generator/evaluator harness with a Playwright evaluator agent, browser-qa, design-system (with slop-check), frontend-design-direction and make-interfaces-feel-better. ECC's skills named `taste*` are about music-video and colour-grade direction, not web design.

### Cited Findings
**Anthropic official:**
- anthropics/skills: ★200,850, pushed 2026-11-16. Skills include `frontend-design`, `canvas-design`, `algorithmic-art`, `theme-factory`, `web-artifacts-builder`, `webapp-testing`, `brand-guidelines`, `slack-gif-creator` and `skill-creator`. Install: `/plugin marketplace add anthropics/skills` then `/plugin install example-skills@anthropic-agent-skills`. — [anthropics/skills](https://github.com/anthropics/skills)
- The `frontend-design` SKILL.md text: "Approach this as the design lead at a design studio known for giving every client a distinct visual identity…". It lists the current generated-design clusters: "a warm cream background (near #F4F1EA) with a high-contrast serif display and a terracotta or warm-clay accent (often near #D97757…)" and "a near-black background with a single bright acid-green or vermilion accent". It warns against "fade-and-slide-up entrances on each section" and decorative 01/02/03 numbering. Its process is "plan, review against the brief, build, critique". — [anthropics/skills frontend-design](https://github.com/anthropics/skills/tree/main/skills/frontend-design)
- anthropics/claude-plugins-official: ★48,285, pushed 2026-11-26. It hosts the `frontend-design` and `playground` plugins and a `playwright` plugin. Install: `claude plugin install playwright@claude-plugins-official`. — [claude-plugins-official](https://github.com/anthropics/claude-plugins-official); install string per [wilwaldon toolkit](https://github.com/wilwaldon/Claude-Code-Frontend-Design-Toolkit)

**Community taste skills:**
- Leonxlnx/taste-skill (`tasteskill 2.5.1`, skill name `design-taste-frontend`): ★121,848, pushed 2026-11-26.
  - It deals a palette and a Google Fonts pairing per page kind (`scripts/start.mjs`) and one of eleven hero layouts, then pulls vetted photographs and real brand icons.
  - "Shader grounds… scroll scenes… and procedural 3D prints are dealt only on software, tech and gaming pages within a four-context WebGL cap."
  - `scripts/consistency.mjs` "renders the page in headless Chrome over HTTP at 1440, 1024, 820, 768 and 390 and prints PASS, WARN or FAIL per rule". `scripts/gate.mjs` is also a Stop hook.
  - Install: `/plugin marketplace add Leonxlnx/taste-skill` then `/plugin install taste-skill@taste-skill`. Older variants (high-end-visual-design, minimalist-ui, industrial-brutalist-ui) moved to Leonxlnx/taste-skill-classics.
  - Source: [Leonxlnx/taste-skill](https://github.com/Leonxlnx/taste-skill)
- nextlevelbuilder/ui-ux-pro-max-skill: ★154,505, pushed 2026-11-26. It is a "Design System Generator" that maps product type to pattern, style, colours and fonts from catalog data. The README's own sample output, a spa site in "Soft Pink #E8B4B8 / Sage Green / Gold" with Cormorant Garamond and Montserrat, is itself a fairly stock combination. Install: `/plugin marketplace add nextlevelbuilder/ui-ux-pro-max-skill` then `/plugin install ui-ux-pro-max@ui-ux-pro-max-skill`. — [ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill)
- codeswithroh/tastemaker: ★623, pushed 2026-10-11. "Ground in real pixels, not words": `extract_palette.py` reads colours from reference screenshots, and `check_contrast.py --matrix` computes contrast. It persists `.tastemaker/style-lock.md` and `decisions.log` across sessions. Install: `/plugin marketplace add codeswithroh/tastemaker` then `/plugin install tastemaker@codeswithroh`. — [tastemaker](https://github.com/codeswithroh/tastemaker)
- superdesigndev/superdesign-skill: ★1,080, last push 2026-08-21. AThevon/genjutsu: ★880, pushed 2026-11-16, covering creative coding, motion and micro-interactions including a `threejs-r3f` skill. kylezantos/design-motion-principles: ★1,658, last push 2026-05-30. — [superdesign-skill](https://github.com/superdesigndev/superdesign-skill), [genjutsu](https://github.com/AThevon/genjutsu), [design-motion-principles](https://github.com/kylezantos/design-motion-principles)
- Merge/bundle repos, low substance: h3nryprod01/design-taste ★107 ("merged synthesis" of emilkowalski, impeccable and taste). JaimeJunr/claude-code-frontend-skills ★11 (bundles the others). — [design-taste](https://github.com/h3nryprod01/design-taste)
- I could not find emilkowalski/skill by search. The wilwaldon toolkit lists "Emil Kowalski's Skills" under Animation & Motion, and ECC bundles `make-interfaces-feel-better`, which is in the same polish/design-engineering genre. — [wilwaldon toolkit](https://github.com/wilwaldon/Claude-Code-Frontend-Design-Toolkit)

**ECC (affaan-m/ECC):** ★311,082, pushed 2026-11-23. Plugin `ecc` v2.2.3 is described as "72 agents, 328 skills". — [affaan-m/ECC](https://github.com/affaan-m/ECC). Local inspection of /home/user/affaan-m/ecc:
- `skills/gan-style-harness` (279 lines): a Planner/Generator/Evaluator loop "Based on Anthropic's March 2026 harness design paper". The rubric weights are Design Quality 0.3, Originality 0.2, Craft 0.3 and Functionality 0.2, with a pass threshold of 7.0. Agents `agents/gan-planner.md`, `gan-generator.md` and `gan-evaluator.md` are included. The evaluator's tools list includes `mcp__playwright__browser_take_screenshot`, `browser_snapshot`, `browser_resize` and others. This is the most directly useful ECC component for a generate→screenshot→critique→fix loop.
- `skills/design-system` (83 lines): extracts tokens, scores the UI "across 10 dimensions" and has "Mode 3: AI Slop Detection" (`/design-system slop-check`).
- `skills/browser-qa` (105 lines): Playwright, claude-in-chrome or Puppeteer smoke tests, "screenshot visual regression across three breakpoints," axe-core and a SHIP / DO-NOT-SHIP verdict.
- `skills/frontend-design-direction` (172 lines): salvaged from community PR #1659. It notes "ECC intentionally does not rebundle the canonical Anthropic frontend-design skill. Install that from anthropics/skills." It requires an "evidence contract" (the reference observation behind each choice) and "real or generated visual assets when the interface depends on… gameplay."
- `skills/make-interfaces-feel-better` (spacing, borders, shadows, motion, hit areas). `skills/loop-design-check` (catching an agent loop that is Goodhart-gaming its verifier). `skills/ui-canvas` (a human edits a mockup in a browser canvas). `skills/fal-ai-media` (image and video generation via a fal.ai MCP, which needs a key). `skills/blender-motion-state-inspection` (rig, pose and ground-contact inspection "where screenshots alone are not enough").
- `skills/taste`, `taste-application` and `taste-distillation` are about music-video and short-form edit direction: LUTs, cut rhythm, angelcore/hyperpop genres. They are not about web design.
- three.js appears in ECC only in `remotion-video-creation/rules/3d.md` and in a lazy-loading snippet in `frontend-patterns`. ECC has no three.js, R3F, shader or game-art skill.
- `mcp-configs/mcp-servers.json` includes a `playwright` entry (`npx -y @playwright/mcp --browser chrome`) plus browserbase and browser-use, which need API keys.

### Inferences
- For this job, enable only a subset of ECC: gan-style-harness plus its three agents, browser-qa, design-system, frontend-design-direction, make-interfaces-feel-better and loop-design-check. Installing all 328 skills mostly adds description noise and makes skill routing worse.
- Impeccable's `critique` and `audit` and Taste Skill's `consistency.mjs` fill the "reviewer" role. Hallmark and Taste Skill also fill the "art direction" role. Pick one primary aesthetic skill so they do not fight. Hallmark and Taste Skill both prescribe layouts, while Impeccable is mostly a review and refine vocabulary that layers well on top of either.
- ui-ux-pro-max is the most-starred design skill, but its catalog-driven output (industry → palette and font lookup) is the kind of default-picking that produces recognisable sameness. I rate it hype-leaning for an art-directed mascot site.

### Gaps
- I could not verify the GitHub location or star count of Emil Kowalski's skill repo. Search returned only derivatives.
- I found no independent benchmark comparing Impeccable, Hallmark and Taste Skill. All the comparisons are self-published.

## 3. three.js / 3D / game-dev skills and MCP servers (Blender, asset generation, shaders)

### Takeaway
The strongest options for the "slop mascot" problem are:
1. scottstts/Threejs-Awesome-Graphics-Agent-Skills: graphics-excellence focused, including a `threejs-procedural-vfx` skill with "voxel fire and smoke" and volumetric clouds. It directly replaces circle-sprite smoke.
2. CloudAI-X/threejs-skills: current r186 API correctness.
3. majidmanzarpour/threejs-game-skills: a director skill with a QA and asset-generation pipeline.
4. For the character itself, an authored asset rather than primitives: Blender via ahujasid/mcp-for-blender plus EL4CTEO or arjun988 Blender skill packs, or majidmanzarpour/blender-game-skills (image→3D), or an agent-driven procedural asset tool (instruktlabs/kiln). The Blender options need Blender in the container (CPU rendering is possible but slow). Hosted text/image→3D MCPs (Meshy, Tripo) need API keys.

### Cited Findings
**three.js skills:**
- scottstts/Threejs-Awesome-Graphics-Agent-Skills: ★1,030, pushed 2026-10-22.
  - It "is NOT a three.js API cheat sheet." The README says graphics excellence is the main focus.
  - Skills include `threejs-skill-router`, `threejs-camera-direction`, `threejs-procedural-materials`, `threejs-procedural-geometry` ("mesh and scene defect audits"), `threejs-volumetric-clouds`, `threejs-procedural-vfx` ("WebGPU voxel fire and smoke, coupled fluid fields, mesh emitters…") and `threejs-atmosphere-aerial-perspective`.
  - Its operating model requires "diagnostic outputs" and "a no-post baseline that still reads."
  - Install: `npx threejs-awesome-graphics-agent-skills@latest install --agent claude-code`.
  - Source: [scottstts/Threejs-Awesome-Graphics-Agent-Skills](https://github.com/scottstts/Threejs-Awesome-Graphics-Agent-Skills)
- CloudAI-X/threejs-skills: ★4,446, pushed 2026-10-19. It targets "three.js r186 … React Three Fiber 9.8 with drei 10.7". It exists because model training mixes releases ("RGBELoader became HDRLoader, Clock gave way to Timer, PostProcessing became RenderPipeline"). It has 11 skills covering fundamentals, materials, lighting, shaders, postprocessing, performance and more. Install: `npx skills add cloudai-x/threejs-skills`, or copy `skills/*` into `.claude/skills/`. — [CloudAI-X/threejs-skills](https://github.com/CloudAI-X/threejs-skills)
- majidmanzarpour/threejs-game-skills: ★2,905, pushed 2026-09-28. It has nine skills routed by `threejs-game-director`, covering gameplay, "AAA graphics," UI, debug/profile, QA/release, 3D generation, image generation and audio. It ships a Vite+TS+three scaffold and "deterministic test hooks." It falls back to procedural assets when API keys are missing. There are live demos (ridgedrift.netlify.app and others). Install: `npx skills add majidmanzarpour/threejs-game-skills --skill '*' -a claude-code -g -y`. — [threejs-game-skills](https://github.com/majidmanzarpour/threejs-game-skills)
- viettranx/3dviz-pro-max: ★1,514, pushed 2026-09-11. It has a ten-step workflow that includes "check what actually appears on screen", plus 223 recipes, 440 knowledge records, 37 style profiles and 24 directions. Its showcase frames were captured in "headless Chromium, GPU, 1920×1080". Its own hero video is labelled "Visual inspiration, not a benchmark", which is honest but notable. Install: `/plugin marketplace add viettranx/3dviz-pro-max` then `/plugin install 3dviz-pro-max@3dviz-pro-max`. — [3dviz-pro-max](https://github.com/viettranx/3dviz-pro-max)
- feitangyuan/motion-web: ★880, pushed 2026-11-05. Motion-first vanilla Three.js/Canvas/WebGL with spring-damper physics. It has seven single-file cases, each with Playwright headless verification (`verify_case.py`). Install by cloning into `~/.claude/skills/motion-web`. — [motion-web](https://github.com/feitangyuan/motion-web)
- Smaller or older packs: EnzeD/r3f-skills ★138, pushed 2026-08-31 (r3f fundamentals, materials, lighting and more; `npx skills add EnzeD/r3f-skills`). emalorenzo/three-agent-skills ★78, last push 2026-01-28 (stale; "100+ rules" of best practice). freshtechbro/claudedesignskills ★1,451, last push 2025-11-20 (stale; `core-3d-animation` bundle). JetBrains/skills ★400 includes `webgpu-threejs-tsl`. iart-ai/webgl-animation-skills ★66. skinnye/3d-web-pack ★11. — [r3f-skills](https://github.com/EnzeD/r3f-skills), [three-agent-skills](https://github.com/emalorenzo/three-agent-skills), [claudedesignskills](https://github.com/freshtechbro/claudedesignskills), [JetBrains/skills](https://github.com/JetBrains/skills)
- gamedev-skills/awesome-gamedev-agent-skills: ★11,445, pushed 2026-11-12. 79 skills across 12 engines including three.js r187, with a router. It claims "Art direction, not one-off generations": the asset workflow locks a visual target, builds families and checks assets in-game. Its evals claim the right skill loaded for 98.7% of 366 blind prompts. Install: `claude plugin marketplace add gamedev-skills/awesome-gamedev-agent-skills` then `claude plugin install gamedev@awesome-gamedev-agent-skills`. — [awesome-gamedev-agent-skills](https://github.com/gamedev-skills/awesome-gamedev-agent-skills)
- htdt/godogen: ★7,423, pushed 2026-11-21. It has two skills: `engine-guide` (Godot, Bevy, Babylon, three.js, with "headless capture to screenshots and video") and `asset-gen`. Generation needs OPENAI/XAI/GEMINI/TRIPO API keys, or an NVIDIA GPU for local generation. — [godogen](https://github.com/htdt/godogen)

**Blender / 3D asset MCPs and skills:**
- ahujasid/mcp-for-blender (formerly blender-mcp): ★35,877, pushed 2026-11-18. Install: `claude mcp add blender uvx mcp-for-blender`, plus the Blender addon. It needs a running Blender instance. — [mcp-for-blender](https://github.com/ahujasid/mcp-for-blender)
- EL4CTEO/blender-skills: ★2,941, pushed 2026-11-21. 28 skills covering modeling, UVs, PBR, baking, rigging, animation, stylized looks, export and QA. It requires Blender 5.2 LTS+ (5.3 recommended, "adds KTX2 web export"). Install: `/plugin marketplace add EL4CTEO/blender-skills` then `/plugin install blender-agent-skills@blender-agent-skills`. — [EL4CTEO/blender-skills](https://github.com/EL4CTEO/blender-skills)
- arjun988/blender-skills: ★5,014, pushed 2026-11-06. "94 Specialized Skills", run through Blender MCP. Marketplace listing is "currently under review by Anthropic", so install by cloning and copying `.claude/skills`. — [arjun988/blender-skills](https://github.com/arjun988/blender-skills)
- majidmanzarpour/blender-game-skills: ★202, pushed 2026-09-24. `blender-image-to-3d` turns concept art, model sheets and turnarounds into rigged, game-ready assets "measured against your references". Install: `npx skills add majidmanzarpour/blender-game-skills --skill blender-image-to-3d -a claude-code`. — [blender-game-skills](https://github.com/majidmanzarpour/blender-game-skills)
- instruktlabs/kiln: ★356, pushed 2026-11-26. "Your agent writes JavaScript using Kiln's geometry and material helpers. Kiln runs the program, returns rendered views and structural checks, and exports a GLB." It runs locally via MCP, CLI or SDK, and needs no account or key. — [instruktlabs/kiln](https://github.com/instruktlabs/kiln)
- codepawl/crucible (formerly 67js): ★1,028, pushed 2026-11-26. A WebGL2 engine plus path tracer, with addons for terrain, vegetation and characters, and an MCP server. This would replace three.js rather than extend it. — [codepawl/crucible](https://github.com/codepawl/crucible)
- Hosted text/image→3D MCPs (API keys required): meshy-dev/meshy-mcp-server ★97, pushed 2026-11-25. Tripo-Developer/tripo-mcp ★236, last push 2025-04-14 (stale). scenario-labs/skills ★4,037 ("images, video, audio, and 3D from any AI agent"). — [meshy-mcp-server](https://github.com/meshy-dev/meshy-mcp-server), [tripo-mcp](https://github.com/Tripo-Developer/tripo-mcp), [scenario-labs/skills](https://github.com/scenario-labs/skills)

**Game feel / juice:** The GitHub results were engine-specific add-ons (Kelpekk/Juicee ★174 for Godot, playdate-juice ★13). I found no Claude skill dedicated to game-feel for three.js. — [Juicee](https://github.com/Kelpekk/Juicee)

### Inferences
- The user's three named failures map onto specific skills:
  - "Flat circle-sprite smoke" → scottstts `threejs-procedural-vfx` / `volumetric-clouds`.
  - "Muddy colours" → CloudAI-X lighting/textures/postprocessing (colour space and tone mapping on r186), plus scottstts colour management and tone mapping.
  - "Generic primitive-built character" → an authored asset path: Blender MCP plus skills, image→3D, or Kiln's rendered-view loop. Better prompting of primitives will not fix this.
- In a no-GPU container, Blender would have to run headless with Cycles/EEVEE on CPU, if it can be installed at all. Kiln, three.js procedural skills and CloudAI-X are more practical in the current environment. Hosted Meshy or Tripo depend on the user supplying API keys.
- WebGPU and TSL recipes (scottstts, JetBrains `webgpu-threejs-tsl`) may silently fall back to WebGL2 in headless no-GPU Chromium, so check which backend actually ran (see section 4).

### Gaps
- None of these 3D skills has an independent quality review. Demos are author-curated.
- I did not check whether Blender can be installed in this container, or how fast CPU rendering would be there.
- I did not find a dedicated "stylized mascot/character" three.js skill. Character work is covered only indirectly, through Blender packs and image→3D.

## 4. Visual self-critique loops: screenshot MCPs, visual regression, LLM-as-judge, and wiring generate→screenshot→critique→fix

### Takeaway
Use the pattern Anthropic validated: a separate, skeptical evaluator agent drives the live page through Playwright MCP, takes screenshots, scores against explicit weighted criteria calibrated with few-shot examples, and feeds back to a generator for 5–15 rounds. A model grading its own output "confidently prais[es]" mediocre work. ECC's gan-style-harness already implements this pattern. Add deterministic gates (Impeccable detect, Taste Skill consistency.mjs, pixelmatch diffs) and make WebGL capture reliable in headless, no-GPU Chromium with SwiftShader/ANGLE flags and an app-defined "frame ready" signal.

### Cited Findings
- Anthropic's harness post (Prithvi Rajasekaran, March 2026). The evaluator "used the Playwright MCP to interact with the live running page rather than scoring a static screenshot". There were four criteria: design quality, originality, craft and functionality. Design and originality were emphasized because Claude already did craft and functionality well. The generator ran 5–15 iterations, and scores improved then plateaued, sometimes with a middle iteration best. Self-evaluating agents were "confidently praising the work" even when it was mediocre. Tuning a separate skeptical evaluator was easier. Few-shot examples with score breakdowns reduced drift. The criteria explicitly penalized "purple gradients over white cards" and stock components. The generator was told to refine or "change aesthetic entirely" depending on score trend. In one example the generator pivoted to a "spatial, 3D gallery experience" at iteration 10. — [Anthropic Engineering: Harness design for long-running apps](https://www.anthropic.com/engineering/harness-design-long-running-apps); secondary coverage: [InfoQ](https://www.infoq.com/news/2026/04/anthropic-three-agent-harness-ai)
- microsoft/playwright-mcp: ★40,168, pushed 2026-11-18. It drives the browser through accessibility snapshots, and screenshots are available. `--caps vision` enables coordinate-based interaction "for canvas/WebGL". Microsoft now points coding agents at playwright-cli plus skills, to avoid large MCP tool schemas. Install: `claude mcp add playwright -s user -- npx @playwright/mcp@latest` or `claude plugin install playwright@claude-plugins-official`. — [microsoft/playwright-mcp](https://github.com/microsoft/playwright-mcp); capability and install details from [wilwaldon toolkit](https://github.com/wilwaldon/Claude-Code-Frontend-Design-Toolkit)
- ChromeDevTools/chrome-devtools-mcp: ★59,455, pushed 2026-11-26. It offers performance traces, network inspection, `take_screenshot` and console messages. Flags include `--headless`, `--isolated` and `--slim`. Usage statistics collection is on by default (opt out with `--no-usage-statistics`), and CrUX lookups can be disabled with `--no-performance-crux`. — [chrome-devtools-mcp](https://github.com/ChromeDevTools/chrome-devtools-mcp)
- Headless WebGL without a GPU:
  - Chromium's explicit SwiftShader WebGL path uses `--use-gl=angle --use-angle=swiftshader-webgl --enable-unsafe-swiftshader`, and automatic fallback is deprecated.
  - Wait for an app-level ready marker before capturing, and validate that the canvas is non-blank.
  - WebGPURenderer awaits async `init()` and silently falls back to WebGL2 when no adapter is available.
  - Sources are blog-level, so check the flags against current Chromium docs. — [microlink: WebGL without a GPU](https://microlink.io/blog/webgl-without-a-gpu), [Chromium SwiftShader doc](https://chromium.googlesource.com/chromium/src/+/798e59c5275d4131797e8ea2e96e6c6000256b58/docs/gpu/swiftshader.md), [three.js forum](https://discourse.threejs.org/t/running-threejs-on-headless-chromium-using-gpu/18080)
- Visual regression: mapbox/pixelmatch ★7,032, pushed 2026-11-24 ("smallest, simplest and fastest JavaScript pixel-level image comparison"). lost-pixel/lost-pixel ★1,678, last push 2026-04-22 ("Open source alternative to Percy, Chromatic, Applitools"; activity has slowed). — [pixelmatch](https://github.com/mapbox/pixelmatch), [lost-pixel](https://github.com/lost-pixel/lost-pixel)
- Review/visual-QA plugins:
  - iamumeransari/claude-show-your-work ★314, pushed 2026-11-24. It shows images and videos in the terminal chat and records Playwright runs before and after a change. It requires the Ghostty or kitty terminal, so it is not useful in a headless cloud container.
  - alexdevlabs/visualice ★16 (every page and state on one canvas).
  - djig/ui-loop ★1 ("diff-only crops… within a token budget," an MCP).
  - Sources: [claude-show-your-work](https://github.com/iamumeransari/claude-show-your-work), [ui-loop](https://github.com/djig/ui-loop)
- Built-in checker loops in skills: Taste Skill's `consistency.mjs` and `shoot.mjs` (headless Chrome at 5 widths, plus a Stop-hook gate). Impeccable's `detect <url>` and `critique`. Hallmark's browser lint. motion-web's `verify_case.py`. ECC browser-qa (3-breakpoint screenshot regression plus SHIP verdict). ECC gan-evaluator (Playwright MCP tools). — [taste-skill](https://github.com/Leonxlnx/taste-skill), [impeccable](https://github.com/pbakaus/impeccable), [motion-web](https://github.com/feitangyuan/motion-web); ECC local files `skills/browser-qa/SKILL.md` and `agents/gan-evaluator.md`
- Reference-grounding: tastemaker's `extract_palette.py` reads real pixel values from reference images instead of text descriptions. The local `image-style-recovery` skill available in this session also has a "generate-compare-refine loop with an image similarity scorer". — [tastemaker](https://github.com/codeswithroh/tastemaker)

### Inferences
- Suggested wiring for this project, all achievable with existing pieces:
  1. Write the art direction first: a moodboard or reference images saved in the repo, and a DESIGN.md with a palette taken from the references, for example via tastemaker.
  2. The generator subagent builds.
  3. A capture script (Playwright, SwiftShader flags, wait for a `window.__frameReady` flag set after N rendered frames) saves fixed-camera PNGs: hero, mascot close-up, smoke close-up, and mobile 390px.
  4. A separate evaluator subagent views the PNGs next to the reference images and scores a 3D-specific rubric: silhouette readability, material and lighting quality, colour/tone-mapping, VFX quality, originality and composition. The rubric is calibrated with 1–2 scored examples, including the rejected first attempt as a known "slop = 3/10" anchor.
  5. Deterministic gates run alongside: non-blank canvas, pixelmatch against the last accepted frame, Impeccable/Taste checks for the HTML chrome, and FPS/perf.
  6. Loop 5–10 rounds, keeping the best-scoring iteration rather than the last.
- ECC's gan-style-harness already supplies the planner, generator and evaluator agents and the weights. Its rubric should be rewritten for 3D, with originality and visual quality weighted up, and the evaluator should be pointed at the reference board. ECC's loop-design-check skill is useful for keeping the evaluator from being gamed.
- Because Anthropic found evaluators lean generous, the rubric should name concrete 3D slop tells, and the evaluator should be required to list the three worst visual defects before giving any score.

### Gaps
- I found no published LLM-as-judge benchmark for evaluating 3D or WebGL renders. Anthropic's results are for web frontends.
- I did not test SwiftShader rendering quality and speed for this specific scene in this container.

## 5. Curated lists: which entries are worth installing for this job

### Takeaway
The curated lists are useful for discovery but heavily padded. The entries worth acting on for a three.js mascot site are already covered in sections 2–4. The single most useful list is wilwaldon/Claude-Code-Frontend-Design-Toolkit, because it is current, opinionated and has install strings. awesome-threejs and awesome-creative-coding are human-learning resource lists, not agent tooling.

### Cited Findings
- wilwaldon/Claude-Code-Frontend-Design-Toolkit: ★1,391, pushed 2026-11-25. Sections include Design Skills (Frontend Design official, Impeccable, UI/UX Pro Max, Taste, Make Interfaces Feel Better), Design Tokens (Google DESIGN.md format), Animation & Motion (GSAP Skills official, Emil Kowalski, freshtechbro, Remotion), Figma MCP (with `get_screenshot` for comparing against design), and Playwright MCP / Chrome DevTools MCP / Claude in Chrome as the "TEST / VERIFY" layers. — [wilwaldon toolkit](https://github.com/wilwaldon/Claude-Code-Frontend-Design-Toolkit)
- hesreallyhim/awesome-claude-code: ★58,846, pushed 2026-11-26. It has a "Design & UI/UX" section, but the entries I sampled were mostly general tooling. One relevant entry is HeyRenan/showreel (annotated screenshots and flow GIFs). — [awesome-claude-code](https://github.com/hesreallyhim/awesome-claude-code)
- ComposioHQ/awesome-claude-skills: ★80,364, last push 2026-09-18. travisvn/awesome-claude-skills: ★15,941, last push 2026-04-28 (slowing). BehiSecc/awesome-claude-skills: ★10,491. bergside/awesome-design-skills: ★3,803, last push 2026-06-28 ("67 awesome DESIGN.md and SKILL.md design skill files"). VoltAgent/awesome-claude-code-subagents: ★26,786. — [ComposioHQ](https://github.com/ComposioHQ/awesome-claude-skills), [travisvn](https://github.com/travisvn/awesome-claude-skills), [bergside/awesome-design-skills](https://github.com/bergside/awesome-design-skills), [VoltAgent subagents](https://github.com/VoltAgent/awesome-claude-code-subagents)
- AxiomeCG/awesome-threejs: ★1,034, last push 2026-07-28. terkelg/awesome-creative-coding: ★15,661, last push 2026-07-21. Both are human learning-resource lists (tutorials, libraries), not agent skills. agmmnn/awesome-blender ★7,757 includes an "AI/MCP tools" section. — [awesome-threejs](https://github.com/AxiomeCG/awesome-threejs), [awesome-creative-coding](https://github.com/terkelg/awesome-creative-coding), [awesome-blender](https://github.com/agmmnn/awesome-blender)
- Aggregator "registries" such as majiayu000/claude-skill-registry and diegosouzapw/awesome-omni-skills are mass mirrors. A code search for `threejs filename:SKILL.md` returned 18,176 hits, dominated by duplicate copies. — GitHub code search (`gh api search/code q='threejs filename:SKILL.md'`, 2026-11-26)

### Inferences

**Ranked install shortlist for this job (my synthesis; substance over stars):**
1. **Anthropic `frontend-design`** ([anthropics/skills](https://github.com/anthropics/skills)): the baseline anti-default guidance. Install: `/plugin marketplace add anthropics/skills`.
2. **scottstts/Threejs-Awesome-Graphics-Agent-Skills**: the only pack aimed squarely at graphics quality (VFX smoke, volumetrics, materials, tone mapping). Install: `npx threejs-awesome-graphics-agent-skills@latest install --agent claude-code`.
3. **CloudAI-X/threejs-skills**: correct r186 APIs (colour space, HDRLoader, RenderPipeline). It prevents stale-API breakage. Install: `npx skills add cloudai-x/threejs-skills`.
4. **ECC gan-style-harness + gan-evaluator + browser-qa + design-system** (already in the ECC marketplace): the evaluator loop scaffold. Retune its rubric for 3D.
5. **Playwright MCP** (`claude mcp add playwright -- npx @playwright/mcp@latest`, with `--caps vision`). ECC's mcp-configs already has an entry for it.
6. **pbakaus/impeccable**: `critique`, `audit` and `detect <url>` for the HTML/CSS layer around the canvas.
7. **Leonxlnx/taste-skill or Nutlope/hallmark**: pick one for page-level art direction. Taste Skill keeps shader and 3D effects to tech and gaming pages, and its headless checker is reusable.
8. **majidmanzarpour/threejs-game-skills**: if the site gains game-like interactivity, its director, QA and asset routing helps.
9. **Character asset path**: instruktlabs/kiln (local, keyless, returns rendered views) or, if Blender can run, ahujasid/mcp-for-blender plus EL4CTEO/blender-skills or majidmanzarpour/blender-game-skills. Meshy or Tripo MCP only if the user provides keys.
10. **codeswithroh/tastemaker**: reference-pixel palette extraction and a persisted style lock, which helps with the "muddy colours" problem.

**Hype vs substance flags:**
- *Substance* (deterministic checks or verified-current APIs): Impeccable (62 rules, rendered-page detect), Gesso (73 thresholded rules), CloudAI-X (version-pinned), Taste Skill (scripted dealer plus headless checker), scottstts (diagnostic-output operating model), ECC gan-style-harness (follows a published Anthropic method).
- *Hype-leaning*:
  - ui-ux-pro-max: 154k stars, catalog-default output.
  - h3nryprod01/design-taste and JaimeJunr bundles: merges of other skills.
  - Registries that mirror thousands of SKILL.md files.
  - ECC as a whole: 328 skills, most irrelevant here, and its `taste*` skills are about video, not web.
  - Star counts across this space look inflated (ECC 311k, ui-ux-pro-max 154k, taste-skill 122k, impeccable 117k), so stars should not drive selection.
- *Stale or abandoned*: freshtechbro/claudedesignskills (last push 2025-11), emalorenzo/three-agent-skills (2026-01), tripo-mcp (2025-04), sam-paech/slop-forensics (2025-11), travisvn/awesome-claude-skills (2026-04), lost-pixel (2026-04, slowing).

### Gaps
- I could not read the full contents of every list. Entries were sampled by keyword grep.
- The GitHub `repos/` endpoint was blocked in this session for repositories not attached to it, so some metadata came only from search results. Emil Kowalski's skill repo could not be located.
