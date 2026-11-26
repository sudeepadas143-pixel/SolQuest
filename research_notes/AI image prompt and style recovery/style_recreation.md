# Recreating the Exact Visual Style of a Reference AI Image (methods, models, repos; as of late Nov 2026)

Method note: GitHub stars and last-push dates come from `gh api search/repositories` run on 2026-11-26 (the direct repo endpoint was blocked; search returned the same fields). WebFetch could not reach blog.comfy.org or docs.midjourney.com from this session, so those pages are cited only from search-result snippets. Descriptions marked "(background knowledge)" were not re-verified this session.

## 1. Zero-shot style reference (no training)

### Takeaway
In late 2026 the practical zero-shot options have moved from SD-era adapters (IP-Adapter, InstantStyle, StyleAligned, CSGO, RB-Modulation; mostly frozen in 2024-2025) to multi-reference edit/generation models: FLUX.2 (up to 10 refs), Qwen-Image-Edit 2509/2511 with style LoRAs (QwenStyle), USO on Flux.1-dev, Krea 2 (up to 10 style refs, native ComfyUI node), and closed models such as Nano Banana Pro and GPT Image 2. IP-Adapter is still the most controllable route on SDXL/SD1.5, but its main ComfyUI pack has been in maintenance-only mode since April 2025.

### Cited Findings
**SD1.5 / SDXL adapters (mature, mostly unmaintained)**
- tencent-ailab/IP-Adapter: 6,720 stars, last push 2024-06-28, so effectively frozen — [GitHub](https://github.com/tencent-ailab/IP-Adapter)
- cubiq/ComfyUI_IPAdapter_plus: 6,189 stars, last push 2025-04-14. The README entry dated 2025.04.14 says the author no longer uses ComfyUI as his main tool and sets the repo to "maintenance only". It is SD1.5/SDXL only and does not load on Flux. Comfy Cloud still preinstalls it (v2.0.0, GPL-3.0) — [GitHub](https://github.com/cubiq/ComfyUI_IPAdapter_plus); [Comfy Cloud](https://comfy.org/cloud/supported-nodes/comfyui_ipadapter_plus.md)
- InstantStyle (instantX-research/InstantStyle): 2,022 stars, last push 2024-09-18. It ties style (color, material, atmosphere) to SDXL block `up_blocks.0.attentions.1` and layout to `down_blocks.2.attentions.1`. Its style-only mode injects IP-Adapter only at the style block, via `target_blocks=["up_blocks.0.attentions.1"]` — [InstantStyle mirror](https://uithub.com/instantX-research/InstantStyle); [HF Space commit](https://huggingface.co/spaces/klausagnoletti/InstantStyle/commit/21f94455b890211a0f1c2c306759bacab0d02eec)
- In diffusers, style-only IP-Adapter uses `pipe.set_ip_adapter_scale({"up": {"block_0": [0.0, 1.0, 0.0]}})` (only the second attention layer of up block 0). Adding the down block_2 layer brings layout in too — [Diffusers IP-Adapter docs](https://huggingface.co/docs/diffusers/using-diffusers/ip_adapter); [diffusers PR #7806](https://github.com/huggingface/diffusers/pull/7806/files)
- google/style-aligned: 1,316 stars, **archived**, last push 2023-12 — [GitHub](https://github.com/google/style-aligned). ComfyUI port brianfitzgerald/style_aligned_comfy: 305 stars, last push 2025-03 — [GitHub](https://github.com/brianfitzgerald/style_aligned_comfy)
- google/RB-Modulation: 401 stars, **archived**, last push 2025-03 — [GitHub](https://github.com/google/RB-Modulation)
- open-mmlab/StyleShot: 476 stars, last push 2025-06 — [GitHub](https://github.com/open-mmlab/StyleShot)
- instantX-research/CSGO: 392 stars, last push 2024-09 — [GitHub](https://github.com/instantX-research/CSGO)
- Other academic style-transfer repos (InST 588 stars, StyleID 489, FreeStyle 133, StyleSSP by ByteDance 93) are all stale (last pushes 2024 to early 2025). Curated lists are still updated: Westlake-AGI-Lab/Awesome-Style-Transfer-with-Diffusion-Models (205 stars, pushed 2026-09) and wd1511/Awesome-Diffusion-for-Image-Translation (274 stars, pushed 2026-11) — [GitHub search](https://github.com/Westlake-AGI-Lab/Awesome-Style-Transfer-with-Diffusion-Models); [GitHub](https://github.com/wd1511/Awesome-Diffusion-for-Image-Translation)

**Flux.1 era**
- Flux.1 Redux is a style model applied with ComfyUI's StyleModelApply node. Community nodes add the strength control the stock node lacks: ShmuelRonen/ComfyUI-Apply_Style_Model_Adjust (it says the stock node can let style overwhelm the prompt, and warns that strength <0.2 can hurt quality), 1038lab ComfyUI-ReduxFineTune (fusion_strength 0.1–2.0 plus an AdaIN mode) and kaibioinfo/ComfyUI_AdvancedRefluxControl (653 stars, last push 2025-04). RES4LYF notes say plain Flux-dev is weak on style by itself and works better with HiDream, Chroma or a Flux style LoRA — [comfy.icu StyleModelApplyStyle](https://comfy.icu/node/StyleModelApplyStyle); [Apply Style Model Adjust](https://comfy.icu/extension/ShmuelRonen__ComfyUI-Apply_Style_Model_Adjust); [ReduxFineTune](https://awesome.ecosyste.ms/projects/github.com%2F1038lab%2FComfyUI-ReduxFineTune); [Comfy Redux workflow](https://comfy.org/workflows/flux_redux_model_example-52dd3f09bb59/)
- Flux IP-Adapters: Shakker-Labs/ComfyUI-IPAdapter-Flux (478 stars, last push 2025-06) and XLabs-AI/x-flux-comfyui (1,700 stars, last push 2024-10, stale) — [GitHub](https://github.com/Shakker-Labs/ComfyUI-IPAdapter-Flux); [GitHub](https://github.com/XLabs-AI/x-flux-comfyui)
- **USO (ByteDance UXO team, Aug 2025):** built on FLUX.1-dev and unifies style-driven and subject-driven generation. Training aligns SigLIP embeddings, then disentangles encoders on content/style/stylized triplets, with a style reward. It runs subject-only, style-only, or combined. In combined mode the first image is the content reference and the rest are style references (so several style images are supported), and an empty prompt keeps the layout. Native in ComfyUI since September 2025. Released for academic research. Repo bytedance/USO: 1,241 stars, last push 2025-09 — [arXiv 2508.18966](https://arxiv.org/html/2508.18966v1); [ComfyUI USO tutorial](https://docs.comfy.org/tutorials/flux/flux-1-uso); [project page](https://bytedance.github.io/USO); [HF](https://huggingface.co/bytedance-research/USO)
- Related ByteDance and Ali repos: bytedance/UNO (1,364 stars, 2025-09), bytedance/DreamO (1,648 stars, 2025-08), ali-vilab/In-Context-LoRA (2,074 stars, 2024-12, stale) — [UNO](https://github.com/bytedance/UNO); [DreamO](https://github.com/bytedance/DreamO); [In-Context-LoRA](https://github.com/ali-vilab/In-Context-LoRA)
- black-forest-labs/flux (Flux.1 / Kontext inference): 26,083 stars, last push 2025-07 — [GitHub](https://github.com/black-forest-labs/flux)

**Edit models and multi-reference models (2025-2026, current state of the art)**
- **FLUX.2 (BFL, launched 2025-11-25):** up to 10 reference images combined into one output, which BFL markets as the "best character / product / style consistency available". The product page has a "Change Image 1 into the Style of Image 2" example. FLUX.2 [dev] has open weights and its code caps references at 10. Repo black-forest-labs/flux2: 2,898 stars, last push 2026-03 — [BFL blog](https://bfl.ai/blog/flux-2); [BFL FLUX.2 page](https://bfl.ai/models/flux-2); [GitHub](https://github.com/black-forest-labs/flux2)
- **Flux.1 Kontext vs Qwen-Image-Edit (original):** in a hands-on test, Kontext "tends to only change what you tell it to" and held truer to the original, while Qwen-Image-Edit was freer and did better on a painting-style test but changed facial features more — [Diffusion Doodles](https://diffusiondoodles.substack.com/p/qwen-image-edit-vs-flux1-kontext)
- TeleStyle's report says neither Qwen-Image-Edit nor FLUX-Kontext natively supports a subject reference plus a style reference together, so a LoRA or fine-tune is needed for true reference-image style transfer — [TeleStyle arXiv 2601.20175](https://arxiv.org/html/2601.20175v1)
- **QwenStyle (TeleAI, Jan 2026):** a content-preserving style-transfer LoRA on Qwen-Image-Edit-2509 that claims SOTA style similarity and content preservation. It must be used with the Qwen-Image-Lightning LoRA. TeleStyleV2 repo: 115 stars, pushed 2026-10 — [arXiv 2601.06202](https://arxiv.org/html/2601.06202); [TeleStyleV2](https://github.com/Tele-AI/TeleStyleV2)
- Community "sref" style LoRAs for Qwen edit: svjack/Qwen_Image_Edit_2509_Sref_Lora and Zaytron40k/Qwen-Image-Edit-2511-StyleTransfer-LoRA — [HF](https://huggingface.co/svjack/Qwen_Image_Edit_2509_Sref_Lora); [HF](https://huggingface.co/Zaytron40k/Qwen-Image-Edit-2511-StyleTransfer-LoRA)
- QwenLM/Qwen-Image: 8,501 stars, last push 2026-02 — [GitHub](https://github.com/QwenLM/Qwen-Image)
- ComfyUI's handbook says edit models can do much general style transfer from the prompt alone, and recommends LoRAs for niche styles — [Comfy blog (snippet)](https://blog.comfy.org/p/the-complete-style-transfer-handbook)
- **Krea 2:** style transfer with one reference or several (up to 10 chained), each with its own strength slider, where negative values invert the style. It is available in the Krea app, the Krea API and as a ComfyUI Partner (API) node, Krea2StyleReferenceNode → Krea2ImageNode, which needs credentials. Krea 2 Medium is stronger on illustration/anime/painting and Large on photorealism. The template advises using references that show the look (palette, brushwork, lighting) rather than content. One Comfy page also describes a local "Krea2 Style Reference" LoRA with HF weights, which conflicts with the API-only description — [Krea docs](https://www.krea.ai/docs/developers/krea-2/style-transfer); [Krea blog](https://www.krea.ai/blog/style-references-krea-2); [Comfy workflow](https://comfy.org/hub/workflows/krea-2-style-reference-fd76422c14ea/); [Comfy model page](https://comfy.org/hub/models/local/krea2-style-reference/); [Comfy blog](https://blog.comfy.org/p/krea-2-image-is-now-available-via)
- Community repos riding Krea 2: nkxx188/ComfyUI-Krea2-StyleTransfer (252 stars, 2026-07), kgilper/krea-reference (22, 2026-11). There is also an Anima ref adapter, ArcAnima/ComfyUI-Anima-Ref-Adapter (251 stars, 2026-11) — [GitHub](https://github.com/nkxx188/ComfyUI-Krea2-StyleTransfer); [GitHub](https://github.com/ArcAnima/ComfyUI-Anima-Ref-Adapter)
- **OmniGen:** VectorSpaceLab/OmniGen has 4,341 stars (last push 2025-12) and OmniGen2 has 4,120 (last push 2026-03) — [OmniGen](https://github.com/VectorSpaceLab/OmniGen); [OmniGen2](https://github.com/VectorSpaceLab/OmniGen2)
- **HiDream:** HiDream-I1 has 2,509 stars (2025-07) and HiDream-E1 (edit) 787 (2025-07) — [I1](https://github.com/HiDream-ai/HiDream-I1); [E1](https://github.com/HiDream-ai/HiDream-E1)
- **Closed models (Nano Banana Pro / GPT Image 2):** sources disagree on the Nano Banana Pro reference cap: 14 per one guide, 8 per another and per Higgsfield, 4 in Krea's integration. Vendors claim it keeps lighting, perspective and style consistent across blended references. The MultiBanana benchmark (CVPR 2026) found that Nano Banana and GPT-Image-1 degrade as the number of reference images grows, though it did not test style transfer specifically. A blog comparison calls GPT Image 2 the safer general choice and Nano Banana Pro the stronger pick for many-reference work (opinion, not a benchmark) — [wavespeed guide](https://wavespeed.ai/blog/posts/google-nano-banana-pro-complete-guide-2026); [Higgsfield](https://higgsfield.ai/creator-hub/help-center/ai-models/how-do-i-use-nano-banana-pro); [Krea docs](https://www.krea.ai/docs/user-guide/features/nano-banana-pro); [MultiBanana arXiv](https://arxiv.org/html/2511.22989v1); [tech-insider](https://tech-insider.org/gpt-image-2-vs-nano-banana-pro/)

### Inferences
- How the older methods work (background knowledge): IP-Adapter is a decoupled cross-attention image-prompt adapter whose CLIP-image embedding carries both content and style. The "Plus" variants (patch embeddings) give higher fidelity but more content leakage. "Style transfer"/"strong style transfer" weight types in IPAdapter_plus apply InstantStyle-style block targeting. StyleAligned shares self-attention (AdaIN on queries and keys) with a reference during DDIM inversion on SDXL. RB-Modulation (Google) is training-free, uses a stochastic-optimal-control style descriptor, and was released on Stable Cascade. CSGO is an SDXL decoupled content/style injection model trained on the IMAGStyle dataset. StyleShot (SD1.5) uses a style-aware encoder. All take one reference image (IP-Adapter can average or batch several).
- Fidelity versus content leakage, roughly ranked: (a) IP-Adapter Plus full blocks leaks the most content, (b) InstantStyle style-block-only and USO style mode leak little but lose fine texture, (c) Redux at high strength overrides the prompt, (d) edit models (Kontext, Qwen-Edit) keep the content image but approximate style from text unless a style LoRA is added, (e) FLUX.2 / Krea 2 / Nano Banana multi-reference is the best zero-shot fidelity in 2026 but can still copy objects from the reference.
- For SD1.5/SDXL users, ComfyUI_IPAdapter_plus still works but should be treated as frozen. Forge ships a built-in IP-Adapter in extensions-builtin/sd_forge_ipadapter. lllyasviel/stable-diffusion-webui-forge has 13,156 stars and was last pushed 2025-07, also effectively frozen ([GitHub](https://github.com/lllyasviel/stable-diffusion-webui-forge)).
- Superseded or outdated: StyleAligned and RB-Modulation (both archived), CSGO, InstantStyle, StyleShot, the XLabs Flux IP-Adapter and In-Context-LoRA. OmniGen v1 is superseded by OmniGen2 and both are behind FLUX.2/Qwen-Edit for style.

### Gaps
- No quantitative head-to-head (CSD/DINO style score) across USO, FLUX.2, Krea 2, QwenStyle and Nano Banana was found.
- Wan (2.1/2.2) style-reference support was not researched: the repos were not reachable through search and no source on Wan style transfer was found. TeleStyle covers video style transfer ([arXiv](https://arxiv.org/html/2601.20175v1)), but its details were not extracted.
- The official OpenAI and Google docs on style-reference limits were not fetched.
- The B-LoRA repo star count could not be retrieved (the search API returned 422 for yardenfren1/B-LoRA).

## 2. Trained approaches (LoRA, B-LoRA, TI, DreamBooth) and dataset/caption advice

### Cited Findings
**Trainers (all actively maintained Nov 2026 unless noted)**
- ostris/ai-toolkit: 12,715 stars, pushed 2026-11-18. It is described as the default recommendation for Flux.1 and the Flux.2 family, and has an `is_style` setting that disables auto-captioning and segmentation masks — [GitHub](https://github.com/ostris/ai-toolkit); [fal guide](https://blog.fal.ai/training-flux-style-lora-on-fal-ai); [tech-insider](https://tech-insider.org/?p=20310)
- kohya-ss/sd-scripts: 7,277 stars, pushed 2026-11-26. GUI bmaltais/kohya_ss: 12,682 stars, pushed 2026-08 — [sd-scripts](https://github.com/kohya-ss/sd-scripts); [kohya_ss](https://github.com/bmaltais/kohya_ss)
- kohya-ss/musubi-tuner (video and newer DiT models): 2,149 stars, pushed 2026-10 — [GitHub](https://github.com/kohya-ss/musubi-tuner)
- Nerogar/OneTrainer: 3,268 stars, pushed 2026-11-24 — [GitHub](https://github.com/Nerogar/OneTrainer)
- bghira/SimpleTuner: 2,963 stars, pushed 2026-11-25 — [GitHub](https://github.com/bghira/SimpleTuner)
- tdrussell/diffusion-pipe: 2,039 stars, pushed 2026-11-19 — [GitHub](https://github.com/tdrussell/diffusion-pipe)
- modelscope/DiffSynth-Studio (Qwen-Image/Wan training and inference): 13,442 stars, pushed 2026-11-25 — [GitHub](https://github.com/modelscope/DiffSynth-Studio)
- cocktailpeanut/fluxgym: 3,264 stars, pushed 2026-07, slowing — [GitHub](https://github.com/cocktailpeanut/fluxgym)
- kijai/ComfyUI-FluxTrainer: 1,159 stars, last push 2025-04, stale — [GitHub](https://github.com/kijai/ComfyUI-FluxTrainer)
- BFL publishes an official FLUX.2 [klein] LoRA training guide with a style-LoRA example trained on a fully synthetic dataset — [BFL docs](https://docs.bfl.ai/flux_2/flux2_klein_training_example)

**B-LoRA**
- B-LoRA (Frenkel, Vinker, Shamir, Cohen-Or; ECCV 2024) jointly trains LoRAs on two specific SDXL transformer blocks (a block is 10 consecutive attention layers) from a **single image**, separating style from content. The style B-LoRA can then be re-plugged and mixed with content B-LoRAs from other images without retraining. Uses include style transfer, text-based stylization and consistent-style generation — [arXiv 2403.14572](https://arxiv.org/html/2403.14572v2); [ECCV PDF](https://www.ecva.net/papers/eccv_2024/papers_ECCV/papers/01549.pdf)

**Dataset size**
- For Flux style LoRAs, one Civitai guide says 20–30 images, and fewer if the style is rare — [Civitai article](https://civitai.com/articles/7777)
- Apatero: minimum 15, recommended 30–50, with quality plateauing beyond ~40 — [Apatero](https://apatero.com/blog/flux-lora-dataset-preparation-complete-guide-2025)
- fal: a 9-image example, with step count depending on dataset size and diversity — [fal](https://blog.fal.ai/training-flux-style-lora-on-fal-ai)
- In 50+ Klein LoRA runs, higher network dimension consistently outperformed lower for style LoRAs transferring an entire visual language, and the same LoRA behaved visibly differently on Klein 9B base versus Flux.2-dev — [Medium](https://medium.com/@calvinherbst/50-flux-2-klein-lora-training-runs-dev-and-klein-to-see-what-config-parameters-actually-matter-3196e4f64fd5)
- Typical inference strength for a trained style LoRA is 0.8–1.0 per community pages. Some Klein style LoRAs also work as edit LoRAs ("keep the pose" if the result drifts) — [HackerNoon](https://hackernoon.com/turn-any-photo-into-any-look-flux-2-klein-9b-lora-for-image-to-image-editing)

**Captioning (sources conflict)**
- BFL (Klein guide): captions should describe only what is in the image, with **no style descriptors**, because a small dataset strongly ties text to visuals — [BFL docs](https://docs.bfl.ai/flux_2/flux2_klein_training_example)
- Contradicted in part by an AI-Toolkit guide (Ideogram 4 style LoRA), which advises putting the same style words in every caption file for a stronger concept — [Substack](https://estylon.substack.com/p/training-an-ideogram-4-style-lora)
- Flux reads natural language through T5, so short descriptive sentences suit it better than tag lists — [Promptzone](https://www.promptzone.com/santiago_saleh/training-a-flux-lora-dataset-captions-and-settings-59m1.md)
- fal: captioning "will have a large influence" on capturing the style — [fal](https://blog.fal.ai/training-flux-style-lora-on-fal-ai)

### Inferences
- The two caption philosophies can be reconciled. Content-only captions plus a single trigger token make the style "always on" and absorbed into the LoRA. Consistent style words make the style prompt-controllable but tie it to those words. For "exactly this style", content-only captions plus a unique trigger is the safer default.
- With only 1–5 reference images: try B-LoRA (SDXL, a single image), or bootstrap a synthetic dataset first. Generate 20–40 images with a zero-shot method (USO/FLUX.2/Krea 2/Midjourney sref), keep only the most on-style ones, and train a LoRA on them. That is the same synthetic-dataset approach BFL documents.
- Textual inversion and DreamBooth (background knowledge) are largely superseded by LoRA for style. TI is weak on DiT/T5 models, and full DreamBooth fine-tunes are rarely worth it for a single style.

### Gaps
- No controlled study comparing caption strategies for style LoRAs was found. The numbers above are community rules of thumb.
- Qwen-Image, HiDream and Wan style-LoRA specific settings were not verified this session.

## 3. Commercial: Midjourney sref/moodboards/personalization, and Leonardo/Krea/Ideogram

### Cited Findings
- **Midjourney --sref:** takes image URLs (or a drag-in on the web), or numeric style codes. V7 has six style-reference versions, with `--sv 6` the default. `--sv 4` is the old V7 sref model from before June 16, 2025 and is needed for old codes (or switch to V6). `--sref random` and sref codes work only with `--sv 4` and `--sv 6`. Style weight (`--sw`) has more impact with codes than with images in V7. `--sw` and `--sv` are not compatible with Moodboards — [Midjourney docs](https://docs.midjourney.com/docs/style-reference); [MJ update](https://updates.midjourney.com/style-references-for-v7/)
- Sref codes are version-bound, so code libraries need re-validation across versions. A third-party source claims a V8 Alpha (March 2026) moved to an `--sv 7` baseline, with moodboards defaulting to the same system. Even that source flags the V8 details as unverified against Midjourney — [Blake Crosley](https://blakecrosley.com/blog/midjourney-sref-library-strategy)
- Moodboards can be updated after creation, unlike a fixed sref code — [Chase Jarvis](https://chasejarvis.com/blog/how-to-control-midjourney-style-references-image-references-and-moodboards/)
- Sref code libraries: Midlibrary (Patreon), plus community collections indexed on Raindrop — [Midlibrary](https://www.patreon.com/Midlibrary/sitemap); [Raindrop](https://raindrop.io/apoctarain/reference-tutorials-51918733/embed/sort=-sort&perpage=30&page=0&search=%23reference)
- **Ideogram:** Style Reference takes up to 3 images and is saved as a reusable custom style ("My styles" → "Create new style"). Ideogram 3.0 allows up to 10 style reference images under Advanced settings. Compatibility varies by model, plan and endpoint — [Ideogram docs](https://docs.ideogram.ai/using-ideogram/features-and-tools/reference-features/style-reference); [Ideogram Styles](https://ideogram.ai/features/styles/)
- **Leonardo:** Style Reference lives under Image Guidance with Low-to-Max strength. Up to 4 images on Phoenix/SDXL, only 1 on Flux, and another article says up to 6 in Legacy Mode (inconsistent) — [Leonardo help](https://intercom.help/leonardo-ai/en/articles/8497988-image-guidance); [Leonardo learn](https://www.leonardo.ai/learn/core-feature/how-to-use-leonardo-ais-style-reference-feature)
- **Krea:** Krea 2 offers up to 10 style references with per-reference strength, negative values to invert style, and presets in the app (see section 1). A Krea 3 technical report is referenced on Krea's site — [Krea docs](https://www.krea.ai/docs/developers/krea-2/style-transfer); [Krea blog](https://www.krea.ai/blog/how-to-generate-images-with-style-references-in-krea)

### Inferences
- Personalization (`--p` codes, built from your image rankings) and moodboards layer on top of sref (background knowledge). For reproducing one reference image's style, sref with the image itself plus a tuned `--sw` is the primary tool, and a moodboard is better for a small set of 3+ images.
- Midjourney reference images remain inside Midjourney: there is no export of a style to open models. To bridge, generate a consistent set in MJ and train an open LoRA on it (check the MJ ToS on output use).

### Gaps
- Exact `--sw` range and default, moodboard limits and current V8 sref behaviour could not be confirmed from the official docs (docs.midjourney.com was unreachable via fetch).

## 4. Identifying a style's base model/checkpoint/LoRA and extracting descriptors

### Cited Findings
- If metadata is intact (A1111/Forge "parameters" chunk, ComfyUI workflow JSON), readers recover the checkpoint, LoRAs, weights and prompt. Tools include receyuki's SD Prompt Reader / comfyui-prompt-reader-node and the AI Image Metadata Editor (JPG/PNG/WEBP, mainly A1111-format) — [prompt reader node](https://www.github.com/receyuki/comfyui-prompt-reader-node); [Civitai article](https://civitai.com/articles/10564)
- Civitai identifies resources by file hash. If the hash is not on Civitai, or the tool did not write hashes, the checkpoint or LoRA version is not auto-detected. Converters can look up hashes via the Civitai API — [Civitai article](https://civitai.com/articles/10564); [Civitai Metadata Bridge](https://comfy.icu/extension/Mikaelosa__ComfyUI-Civitai-Metadata-Bridge); [Civitai public REST API](https://developer.civitai.com/docs/api/public-rest)
- imgfig.com is a free tool (per a Reddit post summarized by PulseAugur) that reads metadata or does a visual match to suggest the Civitai checkpoint or LoRA. It is unverified — [PulseAugur](https://pulseaugur.com/cluster/94783-free-tool-identifies-ai-image-models-via-metadata-or-visual-match)
- pharmapsychotic/clip-interrogator (image → prompt with artist, medium and movement "flavors"): 2,990 stars, last push 2024-05, stale — [GitHub](https://github.com/pharmapsychotic/clip-interrogator)
- Community style explorers for anime models exist, e.g. ThetaCursed/Illustrious-NoobAI-Style-Explorer (96 stars, 2026-06) — [GitHub](https://github.com/ThetaCursed/Illustrious-NoobAI-Style-Explorer)

### Inferences
- When metadata is stripped, a practical heuristic workflow is: (1) judge the model family from tell-tale signs (Midjourney painterly polish and aspect conventions, Flux skin and bokeh, SDXL/Pony/Illustrious anime line conventions, GPT-image warm/yellow cast). (2) Run a Civitai image search with similar keywords and compare the top LoRAs. (3) Use a VLM (Gemini/GPT/Claude/JoyCaption/Florence-2) to extract a structured style descriptor: medium, art movement or artist-like references, line quality, rendering technique, palette (hex values), lighting setup, lens/focal length/DoF, film stock or grain, and composition. (4) Prompt with that descriptor and iterate. These are not verified from a source this session.
- CLIP-interrogator is outdated for DiT/T5 models. VLM captioning (JoyCaption etc.) is the modern replacement.

### Gaps
- No reliable source on accuracy of visual model-identification tools.
- No source for a standard "style descriptor" schema. The list above is practitioner convention.

## 5. Recommended pipelines for "make more images in exactly this style"

### Cited Findings
- BFL's official route to a reusable style is a style LoRA on FLUX.2 [klein], including one trained on synthetic data — [BFL docs](https://docs.bfl.ai/flux_2/flux2_klein_training_example)
- Reference-only LoRAs on Klein (e.g. RefControl) mainly preserve identity, not style, so they are not a substitute for a style LoRA — [HF RefControl](https://huggingface.co/thedeoxen/refcontrol-FLUX.2-klein-9B-reference-lineart-lora)
- USO supports multiple style references with Flux.1-dev natively in ComfyUI — [ComfyUI docs](https://docs.comfy.org/tutorials/flux/flux-1-uso)
- FLUX.2 and Krea 2 accept up to 10 references — [BFL](https://bfl.ai/blog/flux-2); [Krea](https://www.krea.ai/docs/developers/krea-2/style-transfer)

### Inferences
**Open-source pipeline (late 2026):**
1. Check metadata first (prompt reader, Civitai hash). If the source model and LoRA are found, reuse them, which is the highest-fidelity option.
2. Extract a style descriptor with a VLM and write a base prompt.
3. Zero-shot pass:
   - FLUX.2 [dev] multi-reference, or Krea 2 if API use is fine
   - USO (Flux.1-dev) style mode
   - Qwen-Image-Edit-2509/2511 + QwenStyle or an sref LoRA, for restyling a specific content image
   - On SDXL: IP-Adapter style-only (InstantStyle blocks) at weight ~0.8–1.0
4. If consistency over many images matters, curate 15–40 best outputs (plus the originals) and train a style LoRA with ai-toolkit (Flux.1/Flux.2/Qwen/Wan), OneTrainer, SimpleTuner or kohya sd-scripts/musubi. Use content-only captions plus a trigger and a higher rank for style. For SDXL with one image, B-LoRA.
5. Generate with LoRA 0.8–1.0, optionally combined with the zero-shot reference at reduced strength.

**Midjourney pipeline:**
1. Use `--sref <image URL(s)>` and tune `--sw`; for several images, use a moodboard.
2. Alternatively, find a matching sref code (`--sref random` exploration, or libraries like Midlibrary) and note the `--sv` version (codes are version-bound).
3. Lock the result with the sref code or moodboard plus the same `--v`, `--stylize` and `--p` profile, and reuse the descriptor prompt.
4. To leave MJ, export a curated set and train an open LoRA.

### Gaps
- No published end-to-end benchmark validates one pipeline over another. These recommendations are a synthesis.
