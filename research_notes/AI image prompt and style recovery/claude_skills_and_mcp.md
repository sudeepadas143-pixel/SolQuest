# Claude Skills, Claude Code Plugins, MCP Servers and Agent Tooling for Image Analysis, Reverse-Prompting and Style-Matched Generation

Method note: star counts, last-push dates and archived flags come from GitHub search API queries (`gh api search/repositories`) run on 2026-11-26. They are approximate and will drift. "Last push" is the date of the most recent push to any branch, so it says the project is active, not that it is good. The `repos/` endpoint was blocked in this session and the search API hit its rate limit partway through, so some official repos (for example replicate/*, fal-ai/*, black-forest-labs/flux-mcp, Comfy-Org cloud) have no GitHub star figures and are documented from their web pages. Unless a source says otherwise, each row's GitHub URL is `https://github.com/<owner/repo>`.

## Q1. Are there Claude Agent Skills (SKILL.md) for image prompt engineering, reverse-prompting or style guides?

### Takeaway
anthropics/skills has no image-analysis or reverse-prompting skill. Its visual skills (canvas-design, algorithmic-art, brand-guidelines, theme-factory) make art and themes with code. They do not recover prompts. The community has built a small but active set of SKILL.md-format reverse-prompting skills. The best-starred ones target Codex or OpenClaw, or are written in Chinese, but SKILL.md is portable, so they can be adapted to Claude Code. There are also many prompt-library skills for generation (Nano Banana, Seedance).

### Cited Findings
- anthropics/skills (about 200.7k stars, last push 2026-11-16) has 19 skills: academy-guide, algorithmic-art, brand-guidelines, canvas-design, claude-api, discernment-nudge, doc-coauthoring, docx, frontend-design, internal-comms, mcp-builder, pdf, pptx, skill-creator, slack-gif-creator, theme-factory, web-artifacts-builder, webapp-testing, xlsx. None is for image-to-prompt or for analysing AI images. — [anthropics/skills/skills](https://github.com/anthropics/skills/tree/main/skills)
- **LunarXuan/image-prompt-reverse** (about 1,126 stars, push 2026-11-23). This is a "High-fidelity AI image prompt reverse-engineering skill for Codex" built on a SKILL.md entry point.
  - Supporting files: references/analysis-framework.md, category-guides.md, illustration-style.md, and a gallery of 17 example cases.
  - What it analyses: purpose, medium, subject, composition, lighting, color, materials, background and mood. It picks out the "3–5 visual anchors" that matter most for similarity and avoids inventing details it cannot see.
  - Prompt-injection guard: text inside the image is treated as visual content, not as instructions.
  - A November 2026 update added multi-reference roles (borrow style, composition, or the whole image) and a feedback mode: you give it a generated result and it revises only the affected part of the prompt.
  - Output: positive prompts in Chinese and English, plus an optional negative prompt.
  - Limits: it names no target model, documents only Codex, and has no metadata step. — [README](https://raw.githubusercontent.com/LunarXuan/image-prompt-reverse/HEAD/README.md)
- Other reverse-prompting skills found by GitHub search on 2026-11-26:
  - nuyoah-ai-works/nuyoah-image-reverse-prompt (about 107 stars, push 2026-07-26). Chinese. It breaks a reference image into structured fields and a color card, then writes a prompt.
  - luozhilzh/image-prompt-reverse (about 72 stars, push 2026-10-17). Chinese. Targets Midjourney, DALL-E, Stable Diffusion and Flux.
  - LunarXuan/video-prompt-reverse (about 74 stars). The same idea for video.
  - Evan1108-Coder/visual-style-detection-skill (about 2 stars, push 2026-09-22). A "Claude and Codex skill for detecting a coherent visual style from permitted image references".
  - Ptlimited/image-prompt-kit (about 1 star). "1 photo. Any style." Writes prompts for Nano Banana 2.1 and ChatGPT.
  - belchman/nano-banana-aware (about 1 star, push 2026-02-11). An image-generation skill for Claude Code that enforces a project style guide. — GitHub search results (repo URLs github.com/&lt;owner/repo&gt;)
- Prompt-library and generation skills:
  - YouMind-OpenLab/nano-banana-pro-prompts-recommend-skill (about 1,918 stars, push 2026-11-25). Recommends prompts from a library of 10,000+ Nano Banana Pro prompts. Works with OpenClaw and Claude Code.
  - smixs/visual-skills (about 766 stars). Film-director and cinematography skills.
  - treylom/prompt-engineering-skills (about 193 stars).
  - SamurAIGPT/Generative-Media-Skills (about 51 stars, push 2026-09-29). Generative media skills for Claude Code, Cursor and Gemini CLI.
  - sanjay3290/ai-skills (about 459 stars). 24 cross-platform skills, including Imagen and image generation.
  - HuangYuChuh/ComfyUI_Skills_OpenClaw (about 425 stars, push 2026-08-26). ComfyUI workflow skills for OpenClaw, Codex and Claude Code. — GitHub search 2026-11-26
- The large lists for finding more skills:
  - ComposioHQ/awesome-claude-skills (about 80.3k stars, push 2026-09-18)
  - hesreallyhim/awesome-claude-code (about 58.8k stars)
  - sickn33/agentic-awesome-skills (about 50.3k stars, "3,000+ skills")
  - VoltAgent/awesome-agent-skills (about 37.6k stars)
  - travisvn/awesome-claude-skills (about 15.9k stars, last push 2026-04-28, slowing)
  - BehiSecc/awesome-claude-skills (about 10.5k stars) — GitHub search 2026-11-26
- The prompt dataset ZeroLu/awesome-nanobanana-pro (about 10.4k stars, push 2026-11-26) is a curated list of Nano Banana Pro prompts. It is a resource, not a skill. — GitHub search 2026-11-26

### Inferences
- A Claude Code user can copy LunarXuan/image-prompt-reverse into `~/.claude/skills/`, since the SKILL.md format is shared. They would need to translate or trim the Chinese output and add steps for specific target models.
- None of the skills found combines (a) reading embedded metadata first, (b) vision description, (c) a model-specific prompt dialect, and (d) a generate-and-compare loop. This is the main gap.

### Gaps
- I could not check the skill marketplaces (Smithery skills, claude-plugins listings) directly. I did not confirm that any awesome list has a dedicated "image prompting" category.
- I did not read the SKILL.md bodies of the Chinese skills.

## Q2. MCP servers for image generation and editing

### Takeaway
By late 2026 most major image providers ship an official hosted MCP server: Replicate, fal, Black Forest Labs (FLUX), Hugging Face, Comfy (local beta and cloud), and Google's experimental genmedia suite. Midjourney and OpenAI image generation are covered only by third-party servers. Many early community servers are now archived or stale.

### Cited Findings
**ComfyUI**
- **artokun/comfyui-mcp** (about 958 stars, push 2026-11-23). The most complete option and actively maintained.
  - 38 MCP tools covering generation, workflow authoring and validation, model downloads, VRAM and queue control.
  - `get_workflow` with `from_image` recovers the workflow ComfyUI embedded in a PNG, including the prompt.
  - `get_image` with `view` returns output bytes so the agent can look at its own results. `analyze_color` gives palette and contrast statistics.
  - It ships as a Claude Code plugin with about 10–11 slash commands, 42 skills (including model-family prompting guides for Flux, SDXL, SD3, Qwen, Z-Image and others), 4 agents and 3 hooks. — [README](https://raw.githubusercontent.com/artokun/comfyui-mcp/HEAD/README.md)
- **Comfy-Org/comfy-mcp** (about 375 stars, push 2026-11-25). The official Comfy-Org local server, marked "beta".
  - 42 tools, including run_workflow, generate_image, vary_workflow, preview_media and download_model.
  - It does not document reading workflow metadata from images.
  - There is also a hosted server at `https://cloud.comfy.org/mcp` (plugin `comfy-cloud@comfy-skills`). The separate repo Comfy-Org/comfy-cloud-mcp is archived. — [README](https://raw.githubusercontent.com/Comfy-Org/comfy-mcp/HEAD/README.md); GitHub search
- Other ComfyUI servers:
  - joenorton/comfyui-mcp-server (about 411 stars, last push 2026-02-17, slowing)
  - ConstantineB6/comfy-pilot (about 231 stars, push 2026-02-16). Lets Claude Code see and edit ComfyUI workflows.
  - ATH-MaaS/Pixelle-MCP (about 1,131 stars, last push 2025-12-17, possibly stale)
  - lalanikarim/comfy-mcp-server (about 46 stars, last push 2025-03-02, **abandoned**)
  - Overseer66/comfyui-mcp-server (about 22 stars, 2025-11)
  - heshengtao/comfyui_LLM_party (about 2.4k stars). An LLM agent framework inside ComfyUI that includes MCP. — GitHub search 2026-11-26

**Replicate**
- The official hosted server is at mcp.replicate.com (SSE, takes a Replicate API token). Replicate recommends it for most users. A local npm package, `replicate-mcp`, is generated automatically from the HTTP API. The server can be discovered through the official MCP Registry. — [Replicate blog](https://replicate.com/blog/remote-mcp-server); [Replicate changelog](https://replicate.com/changelog/2026-02-10-mcp-server-auto-discovery); [Replicate MCP docs](https://replicate.com/docs/reference/mcp)
- deepfates/mcp-replicate (about 94 stars) is **archived**. Its README points to the official server. GongRzhe/Image-Generation-MCP-Server (Replicate Flux, about 51 stars) is **archived**. awkoy/replicate-flux-mcp (about 106 stars, push 2026-10-01) is still active. — [deepfates README](https://cdn.jsdelivr.net/gh/deepfates/mcp-replicate@main/README.md); GitHub search

**fal.ai**
- The official hosted server is at `https://mcp.fal.ai/mcp-relay` (Streamable HTTP, OAuth). An older setup used `https://mcp.fal.ai/mcp` with a Bearer key. The fal blog says it reaches "1,000+ models". fal also has a separate docs-only MCP and a Platform MCP. — [fal docs](https://fal.ai/docs/documentation/setting-up/mcp); [fal blog](https://blog.fal.ai/connect-your-ai-to-1-000-models-with-the-fal-mcp-server)
- Community alternatives: luminarylane/fal-mcp-server (about 63 stars, push 2026-05-04) and raveenb/fal-mcp-server (listed on glama). — GitHub search; [glama](https://glama.ai/mcp/servers/raveenb/fal-mcp-server/schema)

**Black Forest Labs (FLUX)**
- An official hosted server is reported at `https://mcp.bfl.ai` (OAuth), with source repo black-forest-labs/flux-mcp (MIT). It handles FLUX.2 text-to-image, editing, and multi-reference editing with up to 8 input images. The source for this is directory listings, not a BFL page, so verify before relying on it. — [mcpservers.org](https://mcpservers.org/servers/black-forest-labs/flux-mcp); [mcp.so](https://mcp.so/servers/flux-mcp?tab=config)

**Google Gemini / Imagen / "Nano Banana"**
- Google's mcp-genmedia, in GoogleCloudPlatform/vertex-ai-creative-studio, is a set of Go MCP servers for Gemini Image, Imagen, Veo, Chirp and TTS through Vertex AI. It uses Application Default Credentials (ADC) for auth. It is marked "not an officially supported Google product". One source says Imagen 4.x models are deprecated with a shutdown date of 2026-08-17, and recommends the Gemini image models instead. — [Google mcp-genmedia docs](https://googlecloudplatform.github.io/vertex-ai-creative-studio/experiments/mcp-genmedia/); [DEV write-up](https://dev.to/nishilbhave/gemini-image-mcp-for-claude-and-cursor-mcp-genmedia-44mn)
- **shinpr/mcp-image** (about 196 stars, push 2026-11-13). Uses Gemini by default, with OpenAI and Seedream as alternatives.
  - A single `generate_image` tool. It rewrites short prompts automatically (turn this off with SKIP_PROMPT_ENHANCEMENT) and has quality presets.
  - Image-to-image works through `inputImagePaths`. There is no dedicated style-reference parameter, only `blendImages` and `maintainCharacterConsistency`. — [README](https://raw.githubusercontent.com/shinpr/mcp-image/HEAD/README.md)
- Other Gemini and Imagen servers:
  - ConechoAI/Nano-Banana-MCP (about 240 stars, last push 2025-11-04, stale)
  - ffroliva/gflow-cli (about 891 stars, push 2026-11-26). MCP and CLI for Google Flow (Veo, Nano Banana, Imagen).
  - guinacio/claude-image-gen (about 84 stars, push 2026-11-08). A Claude Code integration for Gemini and gpt-image-2.
  - lansespirit/image-gen-mcp (about 69 stars, push 2026-04-25). gpt-image-1 and Imagen 4.
  - hamflx/imagen3-mcp (about 80 stars, last push 2025-05, **abandoned**)
  - mimo-3/mcp-imagenate (about 17 stars, push 2026-11-13). Gemini, gpt-image, BFL FLUX and Reve in one server. — GitHub search
- A DAIR.AI write-up (Feb 2026) describes a Claude Code plugin that uses Nano Banana Pro (gemini-3-pro-image-preview), with Claude examining each output and refining it. — [DAIR.AI](https://academy.dair.ai/blog/agentic-context-engineering)

**OpenAI gpt-image**
- Under the `openai` GitHub org, the search turned up no official image-generation MCP server. Its MCP repos are mcp-extensions, tunnel-client, openai-mcpkit and sample-deep-research-mcp. Community servers:
  - Subaru486desuwa/micu-image-mcp (about 275 stars). Wraps a third-party Chinese gpt-image-2 proxy; treat with caution.
  - fujc683/gpt-image-2-6-mcp-server (about 102 stars)
  - lownamlee/gpt-image-2-mcp (about 94 stars, push 2026-07-18)
  - lidge-ai/ima2-gen (about 909 stars, push 2026-11-23). "Local-first visual generation runtime ... for coding agents, with reprod[ucibility]". — GitHub search 2026-11-26

**Midjourney**
- Midjourney has no public API and no official MCP server (Cotlet's listing says this, checked 6 Nov 2026). Unofficial options:
  - AceDataCloud `mcp-midjourney` (PyPI releases January to May 2026; github.com/acedatacloud/midjourneymcp, tool `midjourney_imagine`)
  - Cotlet's hosted server
  - apinetwork/piapi-mcp-server (about 76 stars, push 2026-09-17)
  - trueai-org/midjourney-proxy (about 838 stars). An unofficial API.
- These wrap Midjourney's Discord or web interface and can break when Midjourney changes it, and they may conflict with Midjourney's terms. — [mcpservers.org Cotlet](https://mcpservers.org/servers/cotlet-dev-integrations-midjourney-api-mcp-server); [PyPI mcp-midjourney](https://pypi.org/project/mcp-midjourney/2026.5.31.0); GitHub search

**Stability AI**
- tadasant/mcp-server-stability-ai (about 84 stars, last push 2025-06-24, **stale or abandoned**). The search found no official Stability MCP server. — GitHub search

**Hugging Face**
- huggingface/hf-mcp-server (about 324 stars, push 2026-11-25) is the official server, configured at huggingface.co/settings/mcp.
  - Users add MCP-compatible Gradio Spaces as tools. Gradio apps launched with `mcp_server=True` get an MCP badge automatically.
  - A setting strips embedded images from Space outputs.
  - evalstate/mcp-hfspace is superseded by it. — [HF docs](https://huggingface.co/docs/hub/agents-mcp); [HF Spaces MCP docs](https://huggingface.co/docs/hub/spaces-mcp-servers); [mcp-hfspace](https://github.com/evalstate/mcp-hfspace)
- Captioning models an agent could call this way, or locally: fpgaminer/joycaption (about 1,305 stars, push 2026-02-24); jkawamoto/mcp-florence2 (about 8 stars, push 2026-11-14), an MCP server that runs Florence-2 directly. — GitHub search

**Civitai** (useful for finding a LoRA or checkpoint from a style)
- timoncool/civitai-mcp-ultimate (about 27 stars, push 2026-11-25) can "browse top images with prompts". Cicatriiz/civitai-mcp-server (about 13 stars, last push 2025-07, stale). — GitHub search

**Large aggregators**
- punkpeye/awesome-mcp-servers (about 98.5k stars, active), punkpeye/awesome-remote-mcp-servers (about 4.1k), wong2/awesome-mcp-servers (about 4.4k). appcypher/awesome-mcp-servers is **archived**. — GitHub search

### Inferences
- For a Claude-based "match this style" pipeline, the easiest hosted options are fal or Replicate (many models, including FLUX, SDXL with LoRAs, and Ideogram), BFL (FLUX.2 multi-reference), or a Gemini server (Nano Banana editing and reference images). For local work, artokun/comfyui-mcp is the most complete, because it can also recover workflows from ComfyUI PNGs.
- Reference images and style transfer are well supported (BFL multi-reference, Gemini editing, image-to-image in mcp-image). Explicit style parameters such as Midjourney `--sref` are reachable only through unofficial Midjourney wrappers.

### Gaps
- No star or activity data for the official replicate, fal-ai or black-forest-labs repos, because of the API block and rate limit.
- I did not verify the BFL MCP on bfl.ai itself.
- I did not check whether OpenAI added gpt-image to a hosted MCP or connector after the date of the search.

## Q3. MCP servers or CLI tools for reading image metadata (EXIF, PNG text chunks, C2PA)

### Takeaway
Claude does not read image metadata at all, so a tool is required. Several small, low-star MCP servers wrap exiftool, exifr or the C2PA SDK. The most useful source for AI images, the Stable Diffusion, ComfyUI and A1111 `parameters` and `workflow` PNG text chunks, is handled best by artokun/comfyui-mcp's `get_workflow from_image`. Otherwise, run exiftool or a parser library through Bash.

### Cited Findings
- Anthropic's docs say: "Claude does not parse or receive any metadata from images passed to it." — [Claude vision docs](https://platform.claude.com/docs/en/build-with-claude/vision)
- **stass/exif-mcp** (about 40 stars, last push 2025-11-14). Eleven tools: read-metadata, read-exif, read-xmp, read-icc, read-iptc, read-jfif, read-ihdr, orientation, rotation-info, gps-coordinates, thumbnail. It is built on the exifr library. The README does not mention PNG tEXt/iTXt chunks, which is where SD parameters live, or C2PA. — [README](https://raw.githubusercontent.com/stass/exif-mcp/HEAD/README.md)
- exiftool wrappers:
  - vgribok/exiftool-mcp-server (about 3 stars, push 2026-10-24)
  - dullroar/metadata_mcp (0 stars, push 2026-11-24)
  - joshmsimpson/ExifTool_MCP (0 stars, 2025-10)
  - jfdasher/image-analysis-mcp (about 7 stars, 2025-10). Read-only image analysis for Claude Desktop.
  - renkagod/osint-toolbox-mcp (about 3 stars). Includes classic OSINT tools. — GitHub search 2026-11-26
- **contentauth/c2pa-mcp** (about 4 stars, last push 2026-03-27). Under the Content Authenticity Initiative org. Tools: `read_credentials_file` and `read_credentials_url`. It uses the official c2pa Rust SDK and validates against the C2PA trust lists. It ships as a `.mcpb` bundle for Claude Desktop, an install script, or a CLI. Licensed MIT/Apache-2.0. — [README](https://raw.githubusercontent.com/contentauth/c2pa-mcp/HEAD/README.md)
- Other provenance tools: msmenzyk/mtl-c2pa-mcp (about 3 stars); Neeeophytee/ai-watermarks-reality-check (about 18 stars), which tests what watermark and provenance evidence survives; alvdansen/vellum (about 6 stars), which does provenance tracking for AI asset generation as MCP tools. — GitHub search
- SD metadata parser libraries, which have no MCP and would need a wrapper or a skill script:
  - d3x-at/sd-parsers (Python, about 43 stars, last push 2025-04-03, stale)
  - deepratna-awale/sd-parsers (TypeScript port, push 2026-11-25)
  - reteter/SDMetaKit (A1111/Forge format) — GitHub search

### Inferences
- The simplest reliable approach in Claude Code is a skill that calls `exiftool -j -G` (it reads PNG text chunks including A1111 `parameters` and ComfyUI `prompt` and `workflow`) and `c2patool`, or calls the c2pa-mcp server, before any vision analysis. Every exif/exiftool MCP found has under 50 stars, so treat them as hobby projects.

### Gaps
- I found no MCP server built specifically to parse A1111, ComfyUI, NovelAI, InvokeAI or Fooocus generation parameters into structured fields (prompt, negative, seed, sampler, LoRAs). This is a clear build-your-own gap.
- I found no MCP for invisible-watermark detection such as SynthID, because SynthID's detector is not public.

## Q4. Using Claude's own vision for prompt reconstruction, and its limits

### Takeaway
Claude's vision can describe medium, subject, composition, lighting and palette, which is the job reverse-prompt skills give it. But it cannot see metadata and cannot reliably tell whether an image is AI-generated. Fine details, counts and small images are weak spots. Community skills therefore force an explicit structured-analysis step before Claude writes a prompt.

### Cited Findings
- Official limitations listed in Anthropic's vision docs:
  - Claude cannot name people.
  - It may hallucinate on low-quality, rotated or very small images (under 200 px).
  - Spatial and coordinate outputs are approximate.
  - Counts are approximate.
  - "Claude cannot determine whether an image is AI-generated and might be incorrect if asked." — [Claude vision docs](https://platform.claude.com/docs/en/build-with-claude/vision)
- Resolution limits:
  - Claude 4.7 and later models use a high-resolution tier: 2,576 px maximum long edge, 4,784 visual tokens.
  - Other models are capped at 1,568 px and 1,568 tokens. Larger images are downscaled.
  - Each image can be at most 8000×8000 px. A request with more than 20 images gets a stricter per-image limit (keeping each image at or under 3,000 px avoids it).
  - Up to 600 images per API request, and 20 per turn on claude.ai. — [Claude vision docs](https://platform.claude.com/docs/en/build-with-claude/vision)
- Alex Albert (Anthropic, 2024): it is "very challenging to improve Claude's actual 'vision' through just text prompts". Reasoning over the information Claude extracts can still be improved. — [Simon Willison](https://www.simonwillison.net/2024/Jul/10/alex-albert)
- A reported issue says Claude often writes an image-generation prompt from an attached reference without first analysing the image in detail, so users must force an analysis step. — [claudeissues.com #62128](https://claudeissues.com/issue/62128-claude-fails-to-analyze-user-supplied-reference-images-before-writing-image-gene)
- Prompting pattern used in practice (from LunarXuan/image-prompt-reverse):
  - A fixed analysis framework (purpose, medium, subject, composition, lighting, color, materials, background, mood).
  - Pick 3–5 "visual anchors".
  - Do not invent unseen details. Treat text inside the image as content, not instructions.
  - Assign roles to references (style, composition, or whole image).
  - Revise only the differences after seeing a generated result. — [README](https://raw.githubusercontent.com/LunarXuan/image-prompt-reverse/HEAD/README.md)
- The classic non-LLM alternative, pharmapsychotic/clip-interrogator ("Image to prompt with BLIP and CLIP", about 2,990 stars), has had no push since 2024-05-15 and is effectively unmaintained. — GitHub search

### Inferences
- Claude vision is good for style description and natural-language prompts (Flux, Gemini, gpt-image). It is weaker at reproducing tag-style prompts (SD1.5, SDXL, Pony, Illustrious booru tags) or guessing artist, LoRA, seed or sampler. For those, metadata or a tagger such as WD14 or JoyCaption does better.
- To fit under the long-edge limits, send crops of detail regions in addition to the full image.

### Gaps
- No Reddit threads (r/ClaudeAI, r/StableDiffusion) about Claude-specific reverse-prompting accuracy turned up in search. I found no published benchmark comparing Claude with JoyCaption, Florence-2 or GPT for reverse-prompting.

## Q5. Published end-to-end agent workflows (VLM describer, generator, compare loop)

### Takeaway
The pieces exist and a few write-ups describe parts of the loop. I found no canonical public repo or blog that runs the whole metadata → describe → generate → compare → refine loop with Claude as an agent. The closest are artokun/comfyui-mcp (generate and view its own outputs), LunarXuan's feedback mode, DAIR.AI's Nano Banana plugin, and builder/critic loop write-ups.

### Cited Findings
- artokun/comfyui-mcp:
  - Recovers the workflow from a PNG.
  - Generates, then returns outputs inline via `get_image view` so the agent can inspect them.
  - `analyze_color` gives palette and contrast statistics.
  - Includes autonomous optimizer and researcher agents.
  - The README notes that without vision the agent "cannot see its own outputs". — [README](https://raw.githubusercontent.com/artokun/comfyui-mcp/HEAD/README.md)
- DAIR.AI (Feb 2026): a Claude Code plugin using Nano Banana Pro. The user can have Claude examine each output and refine it over successive rounds. The author says a write-up of the self-improving loop is still to come. — [DAIR.AI](https://academy.dair.ai/blog/agentic-context-engineering)
- Stork: a builder/critic loop where an example image of the target aesthetic acts as the style guide and the agents iterate for 3+ rounds. — [Stork](https://www.stork.ai/blog/this-loop-unlocks-pro-ai-design)
- Anthropic's loop guidance (June 2026) recommends defining "done" with `/goal` and using a fresh-context second agent to review, which suits a compare step. — [Claude blog](https://claude.com/blog/getting-started-with-loops)
- A DEV post notes that Claude Code is a text agent and cannot create image files itself, so it needs an MCP or skill for generation. — [DEV](https://dev.to/gauravsinghbisen/how-to-generate-images-and-video-in-claude-code-without-leaving-the-terminal-2c3b)
- MindStudio describes an iterative multimodal refinement loop. I saw only the title and snippet. — [MindStudio](https://www.mindstudio.ai/blog/iterative-refinement-loop-claude-design-multimodal/)

### Inferences
Build-your-own gap list, to be filled by a custom skill or plugin:
1. A metadata-first step that parses A1111, ComfyUI, NovelAI and other parameters into structured JSON, with C2PA and EXIF as fallback.
2. A structured style-analysis rubric.
3. Prompt dialects for each target model (natural language for Flux, Gemini and gpt-image; booru tags with weights for SD and SDXL; Midjourney parameters).
4. An objective similarity check, such as CLIP, DINO or DreamSim embeddings or palette comparison. No MCP server was found for this.
5. A loop cap with a critic sub-agent.

None of the tools found supplies piece (4).

### Gaps
- I found no MCP server that computes image similarity (CLIP, DINOv2, DreamSim, LPIPS). The search "image compare similarity mcp" was cut off by the rate limit, so this is unconfirmed.
- I found no Reddit or r/comfyui write-ups of full loops.
- Some high-star repos seen in results have unclear relevance or credibility, for example rehan-remade/universal-modder (about 9.9k stars, a "fal MCP" game-modding toolkit). I did not vet them and they are excluded from the recommendations.
