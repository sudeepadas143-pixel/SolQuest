# Image-to-prompt / prompt inversion: tools and methods (as of Nov 2026)

Method note: GitHub star counts and last-push dates came from `gh api search/repositories` run on 2026-11-26. They are approximate, and the search hit GitHub's rate limit partway through, so some repos have no numbers. arxiv.org could not be fetched directly from this session, so paper details come from search-result abstracts and CVF/ICLR/NeurIPS proceedings pages.

## 1. CLIP Interrogator and its variants: is it still maintained?

### Takeaway
CLIP Interrogator (pharmapsychotic) is the original image-to-prompt tool, but it is effectively unmaintained. Its last push was May 2024, there are no tagged releases, and its "0.6.0 WIP" with BLIP-2 never moved on. It still works as a quick baseline for CLIP-based SD1.5/SD2 prompts. Benchmarks rate it well below modern VLM captioners, and it is a poor fit for Flux or other models with T5 or LLM text encoders.

### Cited Findings
- **pharmapsychotic/clip-interrogator:** about 2,990 stars, last push 2024-05-15, not archived — [gh api search](https://github.com/pharmapsychotic/clip-interrogator).
- **pharmapsychotic/clip-interrogator-ext (A1111 extension):** about 541 stars, last push 2024-06-28 — [gh api search](https://github.com/pharmapsychotic/clip-interrogator-ext).
- **Other ports:**
  - prodogape/ComfyUI-clip-interrogator: about 67 stars, last push 2024-07.
  - zer0int/CLIP-Interrogator-LongCLIP-hallucinwords (LongCLIP variant): about 19 stars, last push 2025-07.
  - lucataco/cog-sdxl-clip-interrogator: about 10 stars, pushed 2026-10.
  - Source: [gh api search](https://github.com/zer0int/CLIP-Interrogator-LongCLIP-hallucinwords).
- **How it works:** It combines OpenAI CLIP and Salesforce BLIP to "optimize text prompts to match a given image" — [GitHub README](https://github.com/pharmapsychotic/clip-interrogator).
  - Recommended CLIP models: `ViT-L-14/openai` for SD 1.x and `ViT-H-14/laion2b_s32b_b79k` for SD 2.0. The README does not mention SDXL or ViT-bigG.
  - VRAM: about 6.3 GB by default, or about 2.7 GB with `apply_low_vram_defaults()`.
  - Versions: the pip example pins 0.5.4, and 0.6.0 is described as "WIP" with BLIP-2. The Releases section is empty.
- **Benchmarks:**
  - In the Kaggle "Stable Diffusion – Image to Prompts" competition, a CLIP Interrogator baseline scored about 0.41–0.46 cosine similarity on the test set. A fine-tuned CLIP ViT-L reached 0.559, ranked 107 of 981 teams — [UBC wiki](https://wiki.ubc.ca/Stable_Diffusion:_Image_to_Prompts); [jacksonchen1998/Image-to-Prompts](https://www.github.com/jacksonchen1998/Image-to-Prompts).
  - Capped at 8 tokens, CLIP Interrogator scored 0.539 CLIP score on LAION versus 0.697 for PEZ. This figure comes from a third-party summary of the PEZ paper — [Liner review](https://liner.com/review/hard-prompts-made-easy-gradientbased-discrete-optimization-for-prompt-tuning).
  - In a vendor-written 2026 comparison, CLIP Interrogator caught 2 of 8 visible details versus 7 of 8 for ImagePrompt.org. Treat this as unverified, since the comparison comes from a vendor — [Taskade blog](https://www.taskade.com/blog/image-prompt-generators.md).
- MinusZoneAI/ComfyUI-Prompt-MZ is an LLM-based prompt-generation node pack: about 137 stars, last push 2025-08 — [gh api search](https://github.com/MinusZoneAI/ComfyUI-Prompt-MZ).

### Inferences
- CLIP Interrogator's output is a BLIP caption plus "flavor" phrases ranked by CLIP from fixed word banks. That suits SD1.5-era prompt style ("..., trending on artstation, by greg rutkowski"). It is mismatched with Flux, SD3 and Qwen-Image, which want long natural-language prose, and with Pony/Illustrious, which want booru tags.
- Treat it as legacy. Keep it as a baseline or "flavor" source only.

### Gaps
- I could not confirm whether any fork has added SDXL ViT-bigG support or is actively maintained. The GitHub rate limit cut off further search.
- Gaps on the extension: I did not see a list of its modes (best/fast/classic/negative), and I could not tell whether it works on current Forge.

## 2. Hard-prompt optimisation and prompt inversion research: how close do they get?

### Takeaway
Research inverters optimise discrete tokens against CLIP or diffusion losses. PEZ (2023), PH2P (2024), VGD (2025), EDITOR (2025), the CVPR 2026 dLLM method, and the PRISM baseline (named in 2408.06502) all recover prompts that are semantically similar to the original, never the exact one. The best systematic comparison found that a plain BLIP-2 caption often regenerates images closer to the original than discrete optimisers do. It also found that CLIP image-text similarity is a poor proxy for how well the inverted prompt regenerates the image. These are research codebases, mostly for SD1.x/2.x. None is a practical everyday tool.

### Cited Findings
- **PEZ, "Hard Prompts Made Easy"** (Wen et al., NeurIPS 2023, arXiv 2302.03668):
  - Gradient-based discrete optimisation that uses CLIP encoders — [NeurIPS PDF](https://papers.neurips.cc/paper_files/paper/2023/file/a00548031e4647b13042c97c922fadf1-Paper-Conference.pdf).
  - Code: YuxinWenRick/hard-prompts-made-easy, about 648 stars, last push 2023-08 (stale). A Replicate demo exists — [GitHub](https://github.com/yuxinwenrick/hard-prompts-made-easy); [Replicate](https://replicate.com/cjwbw/hard-prompts-made-easy).
  - CLIP scores with 8 tokens, from a third-party summary: 0.697 on LAION, 0.674 on MS-COCO, 0.602 on Celeb-A and 0.711 on Lexica — [Liner review](https://liner.com/review/hard-prompts-made-easy-gradientbased-discrete-optimization-for-prompt-tuning).
- **PH2P, "Prompting Hard or Hardly Prompting"** (Mahajan, Rahman, Yi, Sigal; CVPR 2024, arXiv 2312.12416):
  - Optimises hard prompts through the diffusion loss, restricted to a sub-range of later, noisier timesteps that carry semantics. It uses a delayed projection to the vocabulary.
  - Ablation: CLIP similarity of 0.77 for the full method, versus 0.72 when optimising all timesteps and 0.65 for an Adam variant.
  - Sources: [CVPR paper](https://openaccess.thecvf.com/content/CVPR2024/papers/Mahajan_Prompting_Hard_or_Hardly_Prompting_Prompt_Inversion_for_Text-to-Image_Diffusion_CVPR_2024_paper.pdf); [arXiv](https://arxiv.org/abs/2312.12416).
- **VGD, "Visually Guided Decoding"** (Kim, Bae, Shim, Shim; ICLR 2025, arXiv 2505.08622):
  - A gradient-free method. An LLM (LLaMA2, LLaMA3 or Mistral) decodes a prompt token by token, and CLIP similarity reranks the top-K candidates. CLIP stands in for P(image|text) because running diffusion at every step is intractable.
  - Evaluated on DALL-E 2, Midjourney and SD 2. It produces more readable prompts than soft- or hard-prompt methods.
  - Sources: [ICLR PDF](https://proceedings.iclr.cc/paper_files/paper/2025/file/cd61329e2c14b93a89d617c914140f64-Paper-Conference.pdf); [arXiv](https://arxiv.org/abs/2505.08622v1).
- **EDITOR** (arXiv 2506.03067, 2025): an "Effective and Interpretable Prompt Inversion" method. It reports surpassing PEZ, PH2P and VGD on prompt interpretability — [arXiv HTML](https://arxiv.org/html/2506.03067v2).
- **"Interpretable Prompts made Edit-Friendly"** (Devulapally et al., CVPR 2026):
  - A diffusion-LLM (dLLM) hard-prompt inverter that is plug-and-play, with no fine-tuning. It reports about 10× faster inversion than baselines, plus better interpretability and editability, measured by TIFA and GPT-V preference.
  - The supplement compares reconstructions on SD3.5-Medium, SD2.1, SDXL and FLUX against CLIP Interrogator 2.1 and VGD. It reports that the baselines degrade more when prompts are transferred across backbones.
  - Sources: [CVPR 2026 poster](https://cvpr.thecvf.com/virtual/2026/poster/36604); [supplement](https://openaccess.thecvf.com/content/CVPR2026/supplemental/Devulapally_Interpretable_Prompts_made_CVPR_2026_supplemental.pdf).
- **"Prompt Recovery for Image Generation Models: A Comparative Study of Discrete Optimizers"** (Williams, Schwarzschild, Kolter; arXiv 2408.06502, v2 April 2025):
  - Discrete optimisers minimise their own objectives well, but CLIP similarity between the inverted prompt and the target image is "a poor proxy" for how similar the regenerated images are.
  - BLIP-2 captions often produced images closer to the originals. The study also compares PRISM.
  - Source: [arXiv](https://arxiv.org/abs/2408.06502v2).
- "Dual Inversion for Text-to-Image Diffusion Models: From Both Prompt and Noise Perspectives" (arXiv 2607.26735) also appeared in searches. I did not read its details — [arXiv PDF](https://arxiv.org/pdf/2607.26735).

### Inferences
- How close do they get? Inverted prompts land in the same semantic neighbourhood. Typical CLIP scores of about 0.6–0.77 mean "same subject and style", not "same words".
- The prompts are often unreadable token soup (PEZ). Newer LLM- and dLLM-guided methods trade some fidelity for readability.
- For practitioners, a strong VLM caption, refined by regenerating and comparing, tends to work as well or better.
- Most of these methods target CLIP-text-encoder models. Inverting through T5, Gemma or Qwen text encoders (Flux, SD3, newer models) is less studied. The CVPR 2026 paper is the main exception I found.

### Gaps
- I found no maintained ComfyUI or Forge integration of PEZ, PH2P, VGD or EDITOR.
- I found no code-repo star counts for PH2P, VGD or EDITOR, because of the rate limit and blocked arXiv access.
- I could not get exact headline numbers for EDITOR or the CVPR 2026 paper.

## 3. Booru taggers (WD14 / WD v3, JoyTag, Camie): when to use tags

### Takeaway
For SD1.5 anime models, NovelAI-lineage models, Pony, Illustrious and NoobAI (all trained on Danbooru-style tags), a booru tagger is the right first pass. The usual choices are SmilingWolf's WD v3 taggers (EVA02-Large, ViT-Large, SwinV2, ConvNeXt), Camie Tagger v2, or JoyTag. Taggers output only tags. You still add the model-specific quality and score tokens (Pony's `score_9...`, Illustrious/NoobAI's `masterpiece, best quality...`), and character names that the tagger misses.

### Cited Findings
- **SmilingWolf/wd-eva02-large-tagger-v3:**
  - Trained on Danbooru images with tags current to 2024-02-28 (last image ID 7,220,105). Tags with fewer than 600 images were filtered out.
  - v1.0 F1 is 0.4772 at threshold 0.5296 (P=R), and it reports Macro-F1.
  - timm-compatible, with ONNX available (batch dimension unfixed, needs onnxruntime ≥1.17). Demo Space: SmilingWolf/wd-tagger.
  - Source: [HF model card](https://huggingface.co/SmilingWolf/wd-eva02-large-tagger-v3).
- **Camie Tagger:**
  - v1 has 424M parameters, trained on p1atdev/danbooru-2024, GPL-3.0. It is described as "61% F1 on 70k tags".
  - v2: overall micro-F1 of 67.3% versus 61.3% for v1, with per-category thresholds and Safetensors and ONNX files. Official Space: Camais03/camie-tagger-v2-app. ONNX ports exist at deepghs/camie_tagger_onnx, usable via `dghs-imgutils`.
  - Sources: [Camie v1 card](https://huggingface.co/Camais03/camie-tagger); [v2 card mirror](https://huggingface-proxy-6ci.pages.dev/Camais03/camie-tagger-v2); [v2 Space](https://huggingface.co/spaces/Camais03/camie-tagger-v2-app/blob/main/app.py); [deepghs ONNX](https://huggingface.co/deepghs/camie_tagger_onnx).
- **Tagger repos (gh api search):**

  | Repo | Stars | Last push | Notes |
  |---|---|---|---|
  | pythongosssss/ComfyUI-WD14-Tagger | about 1,272 | 2025-07-11 | Standard ComfyUI tagger node |
  | corkborg/wd14-tagger-standalone | about 119 | 2026-11-16 | Active CLI |
  | fpgaminer/joytag | about 585 | 2024-05-18 | Stale |
  | StartHua/Comfyui_joytag | about 73 | 2024-05 | |
  | neggles/wdv3-timm | about 59 | 2024-05 | Reference v3 inference script |
  | SmilingWolf/wdv3-jax | about 16 | 2024-08 | |
  | xiaolaa2/stable-diffusion-webui-wd14-tagger | about 21 | | Archived |
  | tsukimiya/stable-diffusion-webui-wd14-tagger | about 30 | 2023 | |
  | sln77/ComfyUI-Tagger | about 20 | 2026-10 | Includes Camie |
  | gaowanliang/TAG.OPS | about 24 | 2026-09 | |

  Source: [gh api search](https://github.com/pythongosssss/ComfyUI-WD14-Tagger).
- Florence-2 PromptGen also has a `<GENERATE_TAGS>` mode that outputs Danbooru-style tags (see section 4) — [HF card](https://huggingface.co/MiaoshouAI/Florence-2-large-PromptGen-v2.0).
- In community practice, Florence-2 is often paired with a WD14 tagger rather than run alone, and tag-style output is seen as fitting SD-based models better than sentence captions — [Reddit summary via search](https://lr.us.psf.lt/r/comfyui/comments/1ffr296/what_are_the_best_img2txt_models_currently).

### Inferences
- Use tags when the target is SD1.5 anime, Pony, Illustrious or NoobAI, or another Danbooru-trained SDXL fine-tune. Use natural language for Flux, SD3.x, Qwen-Image, HiDream and other prose models. Hybrid tags plus a short caption works for Illustrious/NoobAI.
- WD v3's tag cutoff (Feb 2024) means newer characters and tags are missing. Camie v2 uses a 2024 dataset and may be fresher.
- The A1111 wd14-tagger extension lineage (toriato, then picobyte, then forks) is fragmented and partly archived. In Forge or reForge, users rely on forks. In ComfyUI, pythongosssss's node is the de facto standard, though it has been quiet since mid-2025.

### Gaps
- I did not get star counts for Camais03's GitHub or for the picobyte/toriato A1111 extensions (rate limit).
- I found no independent head-to-head benchmark of WD v3 vs Camie v2 vs JoyTag on the same test set.
- I found nothing on whether SmilingWolf released anything newer than v3 by 2026.

## 4. Captioning VLMs for prompt recovery, and their ComfyUI/Forge wrappers

### Takeaway
For natural-language targets like Flux, the 2025–26 community default is JoyCaption Beta One (Llama-3.1-based, uncensored, with prompt-style modes). Florence-2-PromptGen v2.0 (0.8B, about 1 GB of VRAM) is the low-VRAM choice. General VLMs are increasingly used through ComfyUI-QwenVL-style nodes: Qwen2.5-VL, Qwen3-VL and now Qwen3.5, plus InternVL and Molmo. Frontier APIs (Gemini, GPT, Claude) prompted with a "write a prompt for model X" system prompt give the most accurate descriptions, but they may refuse NSFW and are not tuned to any generator's prompt dialect.

### Cited Findings
- **JoyCaption Beta One** (fpgaminer / fancyfeast):
  - Released 12 May 2025. About 2× the training of Alpha Two (about 2.4M samples), a new "Straightforward" mode, and the first JoyCaption release to go through RL.
  - Known weaknesses: multiple subjects, left/right confusion and OCR. Some NSFW refusals are inherited from the Llama base, which the author says is not intentional.
  - Model: `fancyfeast/llama-joycaption-beta-one-hf-llava`. Demo Space: fancyfeast/joy-caption-beta-one.
  - Sources: [Civitai release article](https://civitai.com/articles/14672/joycaption-beta-one-release); [HF model](https://huggingface.co/fancyfeast/llama-joycaption-beta-one-hf-llava); [GitHub](https://github.com/fpgaminer/joycaption).
- **JoyCaption repos (gh api search):**

  | Repo | Stars | Last push |
  |---|---|---|
  | fpgaminer/joycaption | about 1,305 | 2026-02-24 |
  | 1038lab/ComfyUI-JoyCaption | about 337 | 2025-12 |
  | fpgaminer/joycaption_comfyui (official node) | about 130 | 2026-02 |
  | judian17/ComfyUI-joycaption-beta-one-GGUF | about 60 | 2025-10 |
  | StartHua/Comfyui_CXH_joy_caption | about 621 | 2025-02 |
  | aidenli/ComfyUI_NYJY | about 147 | 2026-04 |

  GPTQ 4-bit quants exist on HF. Source: [gh api search](https://github.com/fpgaminer/joycaption).
- **Florence-2-large-PromptGen v2.0** (MiaoshouAI, MIT):
  - 0.8B parameters, "slightly over 1 GB" of VRAM, designed for Flux (T5XXL + CLIP-L).
  - Modes: `<GENERATE_TAGS>`, `<CAPTION>`, `<DETAILED_CAPTION>`, `<MORE_DETAILED_CAPTION>`, `<ANALYZE>`, `<MIXED_CAPTION>` (caption plus tags) and `<MIXED_CAPTION_PLUS>`.
  - Samples date from around November 2024. ComfyUI node: miaoshouai/ComfyUI-Miaoshouai-Tagger.
  - Source: [HF card](https://huggingface.co/MiaoshouAI/Florence-2-large-PromptGen-v2.0).
- **Other wrappers and tools (gh api search):**
  - kijai/ComfyUI-Florence2: about 1,765 stars, last push 2026-05 — [GitHub](https://github.com/kijai/ComfyUI-Florence2).
  - 1038lab/ComfyUI-QwenVL: about 932 stars, last push 2026-09 — [GitHub](https://github.com/1038lab/ComfyUI-QwenVL).
  - alexcong/ComfyUI_QwenVL: about 147 stars.
  - WingeD123/ComfyUI_QwenVL_PromptCaption: about 51 stars, last push 2026-05, with Qwen3-VL "Inverse Prompt" and Qwen3.5 caption nodes — [RunComfy](https://www.runcomfy.com/comfyui-nodes/ComfyUI_QwenVL_PromptCaption/qwen3-caption).
  - gokayfem/ComfyUI_VLM_nodes: about 593 stars, last push 2026-08.
  - zhongpei/Comfyui_image2prompt: about 389 stars, last push 2025-06.
  - jhc13/taggui (desktop batch tagger/captioner): about 1,368 stars, last push 2025-10.
  - perfectgf/lora-dataset-studio: about 382 stars, pushed 2026-11.
- **Qwen3-VL in ComfyUI:** nodes offer 2B and 4B Instruct and Thinking variants and take local checkpoints in `models/LLM/Qwen-VL/`. API nodes go through DashScope, which applies content policy, so local is the uncensored route — [RunComfy listing](https://www.runcomfy.com/comfyui-nodes/ComfyUI-QwenVL); [comfy.icu](https://comfy.icu/node/AILab_QwenVL). Comfy docs have a Qwen3.5 tutorial — [docs.comfy.org](https://docs.comfy.org/tutorials/llm/qwen/qwen3_5.md).
- **Community opinion (mostly 2024 threads, so dated):**
  - "Joy caption alpha is the best captioning tool for stable diffusion."
  - "Florence 2 for flux and joy alpha caption 2 for SD-based models."
  - Florence-2 PromptGen was judged "not as good as joycaption".
  - Source: [r/StableDiffusion via search](https://axebps-redlib.hf.space/r/StableDiffusion/comments/1f9qcki/this_caption_model_is_even_better_than_joy_caption).
  - Tensor.art lists Florence-2-base-PromptGen as good for Flux dev/schnell — [Tensor.art](https://tensor.art/articles/785977804262023268).
  - A separate comparison of InternVL2-8B captions exists — [r/sdforall](https://lr.us.psf.lt/r/sdforall/comments/1fc28kq/i_have_compared_captions_generated_by_internvl28b).
  - Gokaygokay's FLUX-Prompt-Generator Space bundles several captioners — [HF Space](https://huggingface.co/spaces/gokaygokay/FLUX-Prompt-Generator/blob/main/caption_models.py).
- Captioning tools now note that Z-Image and Flux "need long, precise, and well-structured descriptions" and support local Qwen3-VL via Ollama — [search result summary, Civitai](https://civitai.com/models/2200639).

### Inferences
- **By target model:**
  - Flux, Flux.2, SD3.5, Qwen-Image, Z-Image: JoyCaption Beta One ("Descriptive" or "Stable Diffusion prompt" modes), Qwen3-VL/3.5, or a frontier API with a prompt-writing system prompt.
  - Pony, Illustrious, NoobAI: a WD v3 or Camie tagger, optionally combined with Florence `<MIXED_CAPTION>` or JoyCaption's "Booru tag list" mode.
  - Low-VRAM: Florence-2-PromptGen.
- Florence-2 (Microsoft, 2024) has not been updated by Microsoft. PromptGen v2.0 (around late 2024) is the last fine-tune I saw, so treat it as aging but still functional.
- Older LLaVA-1.5/1.6 and Molmo wrappers have mostly been displaced by Qwen-VL nodes.

### Gaps
- No rigorous, recent benchmark ranks JoyCaption vs Qwen3-VL vs Gemini/GPT/Claude for prompt recovery measured by regeneration similarity.
- I did not verify whether JoyCaption had a release after Beta One by late 2026. The repo was pushed in Feb 2026, but I saw no announcement.
- I did not cover Forge-specific extensions (e.g. a JoyCaption or Florence extension for Forge) because of the rate limit.
- I found no current star count for miaoshouai/ComfyUI-Miaoshouai-Tagger.

## 5. Commercial and web options: Midjourney /describe, image-to-prompt sites, Civitai

### Takeaway
Midjourney `/describe` returns four suggested prompts in Midjourney's own style. It is the best way to get prompts that work in Midjourney specifically, but the docs say it cannot recreate an image exactly. The many "image to prompt" websites are mostly thin wrappers around a VLM, with per-model output modes. Their quality claims come from vendors and are unverified.

### Cited Findings
- **Midjourney `/describe`:**
  - Upload an image and get four possible prompts, which are "inspirational and suggestive" and cannot recreate the image exactly. Running it again gives different suggestions.
  - On the web you can "Use Prompt" or "Run all prompts", and right-click an image and choose "Describe Image".
  - Sources: [Midjourney docs](https://docs.midjourney.com/docs/describe); [Tom's Guide on the upgraded Describe](https://tomsguide.com/ai/ai-image-video/i-just-tried-midjourneys-vastly-upgraded-describe-feature-and-i-made-an-alternative-version-of-myself).
- **Web tools:**
  - ImagePrompt.org: modes for General, Flux, Midjourney, Stable Diffusion and JSON; 5 free credits a day with no account, per a 2026 comparison — [imageprompt.org](https://imageprompt.org/image-to-prompt); [Taskade 2026 test](https://www.taskade.com/blog/image-prompt-generators.md).
  - Picsart image-to-prompt — [Picsart](https://picsart.com/image-to-prompt/).
  - Miniwebtool: outputs a Midjourney prompt with `--ar` matched to the image, and an SD/Flux prompt with a negative prompt — [miniwebtool](https://miniwebtool.com/ai-image-to-prompt/).
  - ImageTo Prompt: about 176.7K monthly visits — [Toolify](https://www.toolify.ai/tool/imageto-prompt).
  - Guides advise manually revising the output before use — [FlexClip](https://www.flexclip.com/learn/image-to-prompt-generator.html).
- Civitai users have requested a different captioner for Flux on Civitai's feature board — [Civitai featurebase](https://civitai.featurebase.app/p/use-a-different-captioner-for-flux).

### Inferences
- If the image came from Midjourney, `/describe` plus `--sref` or style references is the most practical way to recover the look. Exact text is not recoverable.
- On Civitai, the first thing to check is whether the original post exposes generation data (prompt, seed, model). That is real prompt recovery, not inversion.

### Gaps
- I did not verify which backend models the commercial sites use.
- I found no independent accuracy benchmark of these sites.
- I did not confirm Civitai's current built-in image-to-prompt or interrogation feature as of late 2026.

## 6. Is exact prompt recovery possible? Evidence, and how to verify by regeneration

### Takeaway
No. Without metadata, exact recovery of the prompt, seed, sampler and model is not possible in practice. Many prompts map to near-identical images, and the seed and sampler noise are unrecoverable. The realistic goal is a prompt that regenerates a similar image on the same model family. You verify it by regenerating and scoring similarity with CLIP image embeddings, DINOv2 or DreamSim, or perceptual metrics. Score image to image, not image to text.

### Cited Findings
- Midjourney's own docs say `/describe` prompts cannot recreate the uploaded image exactly — [Midjourney docs](https://docs.midjourney.com/docs/describe).
- **Kaggle "Stable Diffusion – Image to Prompts" (2023):**
  - The score was cosine similarity between sentence embeddings of predicted and true prompts, on 16,000 hidden SD 2 images.
  - Strong solutions used retrieval over a very large candidate-prompt pool (about 66M prompts embedded with CLIP) or fine-tuned CLIP ViTs. Mid-table scores were around 0.56, and CLIP Interrogator scored around 0.41–0.46.
  - Sources: [UBC wiki](https://wiki.ubc.ca/Stable_Diffusion:_Image_to_Prompts); [Speakerdeck top-solution review (JP)](https://speakerdeck.com/kfujikawa/stable-diffusion-image-to-prompts); [jacksonchen1998/Image-to-Prompts](https://www.github.com/jacksonchen1998/Image-to-Prompts).
- In a related paper, Kaggle-style prompt prediction ensembles reached cosine similarities in roughly the same range — [arXiv 2401.09763](https://www.arxiv.org/pdf/2401.09763). I did not read the details.
- **Proxy problem:** CLIP prompt-image similarity is a poor proxy for regenerated-image similarity, and BLIP-2 captions often beat discrete optimisers on regeneration — [Williams et al., arXiv 2408.06502](https://arxiv.org/abs/2408.06502v2).
- PH2P's best ablation reaches 0.77 CLIP similarity, which is semantic closeness, not textual identity — [CVPR 2024](https://openaccess.thecvf.com/content/CVPR2024/papers/Mahajan_Prompting_Hard_or_Hardly_Prompting_Prompt_Inversion_for_Text-to-Image_Diffusion_CVPR_2024_paper.pdf).
- The CVPR 2026 dLLM paper evaluates regenerated reconstructions across SD3.5, SDXL and FLUX, and uses TIFA for faithfulness — [supplement](https://openaccess.thecvf.com/content/CVPR2026/supplemental/Devulapally_Interpretable_Prompts_made_CVPR_2026_supplemental.pdf).

### Inferences
- **Practical verification loop:**
  1. Caption or tag the image.
  2. Regenerate several seeds on the suspected model.
  3. Compute CLIP image-image cosine, or DINOv2/DreamSim distance, between the original and each regeneration.
  4. Edit the prompt (add or remove tags and style terms) and repeat.
  - Keep the best-scoring prompt, and report a range rather than claiming the result is "the prompt".
- Identifying the model or checkpoint and any LoRAs matters as much as the prompt text, especially for anime fine-tunes and style LoRAs.
- Expected fidelity by target:
  - Booru-tag models: high for content tags, low for exact weights or ordering.
  - Flux and other prose models: good semantic match; the wording will differ.
  - Midjourney: style is approximated through `/describe` plus `--sref`.

### Gaps
- I found no published benchmark scoring modern VLM captioners (JoyCaption, Qwen3-VL, GPT/Gemini/Claude) on regeneration similarity with DINO or DreamSim for Flux or SDXL.
- The regeneration loop and metric recommendations above are my inference from the papers, not from a single cited protocol.
