# Recovering how an AI image was made from the file: metadata, provenance and generator ID

Method note: GitHub numbers come from `gh api search/repositories` run on 2026-11-26. They show `stargazers_count` and `pushed_at`. `pushed_at` is the last push to any branch, not necessarily a commit to the default branch or a release. Direct `repos/` and release endpoints were blocked in this session, so there are no release dates. help.openai.com could not be reached (DNS blocked), so the OpenAI claims come from search-result snippets of that page.

## 1. What metadata do the major generators embed?

### Takeaway
Local Stable Diffusion front-ends (A1111/Forge, ComfyUI, InvokeAI, Fooocus, NovelAI) write the full recipe into the file in plain text: prompt, negative prompt, seed, sampler, model hash, and for ComfyUI the whole node graph. Commercial services (OpenAI, Google, Adobe, Midjourney) mostly embed only provenance, meaning a C2PA manifest and/or the IPTC "trainedAlgorithmicMedia" tag plus an invisible watermark. They do not embed the prompt. Midjourney is a partial exception: it reportedly writes the prompt and job ID into IPTC/EXIF, but this is not documented.

### Cited Findings
**Automatic1111 / Forge**
- PNG: the prompt, negative prompt, model hash and settings are stored as one "infotext" string in a PNG `tEXt` chunk with the keyword `parameters`. The A1111 code does this with `pnginfo.add_text('parameters', infotexts[i])` — [A1111 commit mirror](https://mirrors.sustech.edu.cn/git/github_fork/stable-diffusion-webui/-/commit/a112168d2814d691936a7fb1d4cde5acb8440679); [HF PNGInfo README](https://huggingface.co/spaces/EnD-Diffusers/PNGInfo/blob/7b9aa96c75b6092f431beab436644714d9311be6/README.md)
- JPEG/WebP: there are no text chunks, so A1111 writes the infotext to EXIF `UserComment` with piexif when `enable_pnginfo` is on — [A1111 commit mirror](https://mirrors.sustech.edu.cn/git/github_fork/stable-diffusion-webui/-/commit/a112168d2814d691936a7fb1d4cde5acb8440679)
- Generic image viewers often don't show it. For example, KDE Gwenview does not display SD `parameters`, and UserComment can render as garbled text — [KDE bug 471404](https://bugs.kde.org/show_bug.cgi?id=471404)

**ComfyUI**
- PNG: the `prompt` (API graph) and `workflow` (UI graph) JSON are stored in text chunks. Dragging the image onto the canvas, or using File > Open, restores the workflow — [ComfyUI docs: workflow metadata](https://docs.comfy.org/development/api-development/workflow-metadata)
- Animated WebP: the metadata goes in EXIF tags as `workflow:{JSON}` / `prompt:{JSON}` strings on the first frame. If another app rewrites the file it can drop these tags, and files saved with `--disable-metadata` have no workflow — [ComfyUI docs](https://docs.comfy.org/development/api-development/workflow-metadata)
- JPEG/WebP saving with metadata often depends on custom saver nodes: comfy-image-saver (347★, pushed 2026-07), comfyui_image_metadata_extension (89★, pushed 2025-11), comfyui-compressed-metadata — [comfyui-compressed-metadata](https://github.com/jonstreeter/comfyui-compressed-metadata); GitHub search API
- Privacy risk: ComfyUI PNG metadata can leak secrets such as API keys inside node inputs when an image is shared — [nhimg.org](https://nhimg.org/articles/comfyui-png-metadata-turns-image-sharing-into-secret-exposure/)

**Fooocus**
- Fooocus has two schemes. One is a native JSON `fooocus` scheme, used for embedded metadata from v2.2 on. The other is an A1111-compatible plaintext `a1111` scheme that does not support Fooocus-specific keys — [fkleon/fooocus-metadata (Go pkg)](https://pkg.go.dev/github.com/fkleon/fooocus-metadata/fooocus)
- SD Prompt Reader supports only the Fooocus-MRE fork, not original Fooocus — [receyuki/stable-diffusion-prompt-reader](https://github.com/receyuki/stable-diffusion-prompt-reader)

**InvokeAI**
- SD Prompt Reader and sd-parsers support it, including older InvokeAI versions. One gist reads an older `sd-metadata` tEXt chunk — [sd-parsers](https://github.com/d3x-at/sd-parsers); [gist](https://gist.github.com/Fortyseven/60ef70872e77fe154e6cf3cc2d60bb83)

**NovelAI**
- NovelAI writes metadata to regular PNG text chunks and also into the alpha channel in "stealth pnginfo" format. The alpha-channel copy survives some metadata stripping. A `signed_hash` field holds a signature that verifies the image came from NovelAI's models, with "no user specific data". The official repo has `nai_meta.py` (extract), `nai_meta_writer.py` and `nai_sig.py` (verify signature). It also describes optional FEC codes in the alpha channel, but notes NovelAI "does not add FEC at the moment" — [NovelAI/novelai-image-metadata](https://github.com/NovelAI/novelai-image-metadata) (44★, pushed 2026-08-20)
- Stealth pnginfo started as an A1111 extension. ashen-sensored/sd_webui_stealth_pnginfo (32★) and neggles/sd-webui-stealth-pnginfo (20★) were last pushed in May 2023, so treat both as unmaintained — GitHub search API

**Midjourney**
- Midjourney (with Shutterstock AI) signed up to use IPTC Digital Source Type to mark generative AI output — [IPTC news](https://iptc.org/news/midjourney-and-shutterstock-ai-sign-up-to-use-of-iptc-digital-source-type-for-generated-ai-content/)
- One vendor guide makes several claims: Midjourney does not embed C2PA as of early 2026, the EXIF/IPTC Author field holds the username, the Digital Image GUID holds the Job ID (UUID), and the Description holds the prompt. Midjourney does not document this, and the claims are not corroborated — [Fast.io guide](https://fast.io/resources/ai-generated-image-metadata-detection-tools/); a second vendor writer says the fields are not fixed — [bushe.co](https://bushe.co/answers/detect-midjourney-images-from-metadata/)

**OpenAI (DALL-E / ChatGPT images / API)**
- Images generated in ChatGPT and the API include C2PA metadata, and the C2PA data uses the IPTC standard. This applies only to images generated after the rollout. The current help article (as indexed) says ChatGPT, Codex and API images include both C2PA and SynthID watermarks, and notes an image may still be OpenAI-made if the metadata was stripped — [OpenAI help 8912793 (search snippet)](https://help.openai.com/en/articles/8912793-c2pa-in-chatgpt); [VentureBeat](https://venturebeat.com/ai/openai-joins-meta-in-labeling-ai-generated-images); [OpenAI: advancing content provenance](https://openai.com/index/advancing-content-provenance)
- Unconfirmed user reports say ChatGPT images lacked `claim_generator_info` and had `is_ai_generated` set to false, and that uploading a C2PA PNG to ChatGPT stripped its C2PA chunks — [OpenAI community thread](https://community.openai.com/t/questions-regarding-openais-implementation-of-the-c2pa-standard-for-generative-ai-images/1059002); [thread 2](https://community.openai.com/t/are-c2pa-metadata-chunks-intentionally-stripped-from-images-uploaded-to-chatgpt/1385097)

**Google (Gemini / Imagen / Nano Banana Pro)**
- Nano Banana Pro (Gemini 3 Pro Image) images from the Gemini app, Vertex AI and Google Ads carry embedded C2PA metadata as well as a SynthID watermark — [Google blog](https://blog.google/technology/ai/ai-image-verification-gemini-app/); [Vertex AI Content Credentials docs](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/content-credentials)
- Google's docs note that C2PA does not guarantee its assertions are truthful — [Vertex AI docs](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/content-credentials)

**IPTC standard**
- IPTC recommends that AI tools write Digital Source Type `http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia` in XMP, or inside a C2PA manifest via the IPTC assertion. IPTC also notes that both IPTC and C2PA metadata can be stripped — [IPTC guidance](https://iptc.org/news/iptc-publishes-metadata-guidance-for-ai-generated-synthetic-media/)

**Invisible watermarks**
- Stable Diffusion / SDXL: diffusers' SDXL pipeline applies a fixed message (copied from Stability AI's code) with invisible-watermark's `dwtDct` encoder via `set_watermark("bits", ...)`. The pipeline needs the `invisible-watermark` package. Users have complained the watermark adds pixel noise — [diffusers watermark.py (HF mirror)](https://huggingface.co/svjack/diffusers-sdxl-controlnet/blob/43b7e9254e36a5e9d5712edafe059fb656d60a91/src/diffusers/pipelines/stable_diffusion_xl/watermark.py); [SDXL 0.9 discussion](https://huggingface.co/stabilityai/stable-diffusion-xl-base-0.9/discussions/31)
- ShieldMnt/invisible-watermark (the library, ~1,993★) was last pushed 2023-09, so it is unmaintained but still a dependency — GitHub search API
- SynthID: Google's image watermark, which the Gemini app can check (see section 4)

### Inferences
- A file can only reveal a prompt and settings if it came from a local or open tool, or possibly Midjourney. For ChatGPT, Gemini and Firefly, the most you can recover from the file is "made by X AI, at time T, maybe with edits". The prompt is not there.
- ComfyUI's metadata is the richest, since it holds the full graph with model names, LoRAs and seeds. It is also the hardest to parse into a simple "prompt" (see section 2).

### Gaps
- I could not confirm the current InvokeAI chunk names (e.g. `invokeai_metadata` / `invokeai_graph`) from a primary source.
- I found no Firefly-specific source for its C2PA/IPTC fields. Adobe is known as a C2PA founder, but I did not verify the field details.
- I did not verify whether ComfyUI core's static (non-animated) WebP save embeds the workflow.
- The bit count of the SD watermark payload was not verified against a source.
- I found no evidence on whether A1111/Forge themselves still apply an invisible watermark by default.

## 2. Which tools read them?

### Takeaway
SD Prompt Reader (receyuki) is the broadest maintained multi-format reader and has a CLI. exiftool reads all raw chunks, EXIF and XMP. c2patool and the c2pa SDKs (all actively maintained by the CAI) read and validate Content Credentials. ComfyUI drag-and-drop gives the most faithful workflow recovery. NovelAI's own repo handles stealth alpha-channel metadata.

### Cited Findings
| Tool | Stars / last push (2026-11-26) | What it does |
|---|---|---|
| [receyuki/stable-diffusion-prompt-reader](https://github.com/receyuki/stable-diffusion-prompt-reader) | 1,346★, pushed 2026-11-23 (active) | GUI and `sd-prompt-reader-cli` for PNG/JPEG/WebP. Covers A1111, InvokeAI, NovelAI (stealth and legacy), ComfyUI, Draw Things, Naifu, Easy Diffusion, StableSwarmUI, Fooocus-MRE. CLI modes are read/write/clear, with TXT/JSON output and batch read/clear. Limits: ComfyUI reads reliably only for basic workflows, and multiple KSamplers produce multiple setting sets. Source now needs Python ≥3.11. |
| [receyuki/comfyui-prompt-reader-node](https://github.com/receyuki/comfyui-prompt-reader-node) | 466★, pushed 2025-02 (stale) | ComfyUI node that reads and writes metadata |
| ComfyUI core (Comfy-Org/ComfyUI; the old comfyanonymous/ComfyUI URL now points here) | 148,651★, pushed 2026-11-26 | Drag-and-drop or File > Open restores the workflow from PNG/WebP — [docs](https://docs.comfy.org/development/api-development/workflow-metadata) |
| AUTOMATIC1111/stable-diffusion-webui | 165,387★, pushed 2026-03-02 | PNG Info tab reads `parameters`/UserComment and sends them to txt2img. Pushes have slowed. |
| lllyasviel/stable-diffusion-webui-forge | 13,156★, pushed 2025-07-31 | Same PNG Info feature. Pushes appear to have stalled since mid-2025. |
| [exiftool/exiftool](https://github.com/exiftool/exiftool) | 5,319★, pushed 2026-11-16 | Dumps PNG text chunks, EXIF UserComment, XMP/IPTC (DigitalSourceType) and JUMBF/C2PA blocks. Handles batch work. |
| contentauth/c2pa-rs | 455★, pushed 2026-11-25 | Rust reference SDK for C2PA |
| contentauth/c2patool | 174★, pushed 2026-11-25 | CLI to read and validate C2PA manifests |
| contentauth/c2pa-python | 110★, pushed 2026-11-25 | Python bindings, suited to batch work |
| contentauth/c2pa-js | 46★, pushed 2026-11-25 | JS SDK. c2pa-js-legacy was last pushed 2025-11, and c2pa-node is archived. |
| [NovelAI/novelai-image-metadata](https://github.com/NovelAI/novelai-image-metadata) | 44★, pushed 2026-08 | Official stealth/alpha reader and writer, plus signature verify |
| [d3x-at/sd-parsers](https://github.com/d3x-at/sd-parsers) | 43★, pushed 2025-04 | Python library parsing A1111, ComfyUI, InvokeAI, NovelAI, Fooocus. Slowing. |
| enslo/sd-metadata (npm `@enslo/sd-metadata`) | 5★, pushed 2026-11-22 | JS library for PNG/JPEG/WebP that claims support for 20+ tools. New and small. |
| fkleon/fooocus-metadata | n/a | Go package for the Fooocus native and a1111 schemes — [pkg.go.dev](https://pkg.go.dev/github.com/fkleon/fooocus-metadata/fooocus) |
| zanllp/infinite-image-browsing | 1,379★, pushed 2026-11-24 | Image browser that shows SD/ComfyUI/NovelAI generation info |
| MatrixA/aicheck | 245★, pushed 2026-11-23 | Offline detector that checks metadata and invisible watermarks |
| otacoo/comfyui_metadata_extract | 19★, pushed 2026-08 | Extracts ComfyUI metadata |
| ilian6806/stable-diffusion-webui-state | 337★, pushed 2025-12 | **Not a metadata reader.** It only saves and restores the A1111 UI state between sessions. |

(Star counts and pushes are from the GitHub search API. Tool descriptions are from each repo's GitHub description or README.)

- Civitai: a browser extension copies prompts and metadata from civitai.com images — [ExcaliburAI-Civitai-Prompt-Extractor](https://github.com/digitalego-one/ExcaliburAI-Civitai-Prompt-Extractor) (17★)
- Content Credentials verify site: Google's docs point users to "the Content Credentials website" to verify C2PA, and Adobe products such as Photoshop and Lightroom also read C2PA — [Vertex AI docs](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/content-credentials)

### Inferences
- For batch work, a practical stack is: exiftool for a raw JSON dump of everything; sd-prompt-reader-cli or sd-parsers for normalized SD fields; c2pa-python or c2patool for provenance; and NovelAI's `nai_meta.py` for alpha-channel data. Most of the dedicated SD parsers are small one-person projects. receyuki's reader is the exception that is still actively updated.

### Gaps
- I did not fetch Civitai's own documentation on how its image info panel parses metadata (from A1111 infotext vs. its own resource hashes).
- I did not directly confirm that contentcredentials.org/verify is the current URL, or its behavior.
- I could not get release dates, since the GitHub releases API was blocked.

## 3. When is metadata stripped, and what survives?

### Takeaway
Text chunks, EXIF, XMP and C2PA are fragile. Most social platforms, chat apps, screenshots and any re-encode remove them. Invisible watermarks (SynthID, SD dwtDct) and NovelAI's alpha-channel data are meant to survive some stripping. However, an alpha-channel payload dies with JPEG conversion or flattening, and watermarks can be attacked.

### Cited Findings
- Discord: users reported that an update stripped all text metadata from images, which broke SD prompt sharing. Discord also removes data appended after a PNG's IEND chunk — [Discord community: metadata removed](https://support.discord.com/hc/da/community/posts/13996617793559-Image-metadata-getting-removed); [PNG files changed by Discord](https://support.discord.com/hc/tr/community/posts/11980316326039-PNG-files-attached-to-text-chat-messages-are-changed-by-Discord). One bot author says Discord "usually strips off EXIF data, though not always" — [S1D1T1/metaDataBot](https://github.com/S1D1T1/metaDataBot)
- Messengers compress images sent as photos, which drops metadata. Sending as a file can keep it (vendor guide) — [DEV Community](https://dev.to/deutli/how-to-extract-prompts-from-comfyui-images-free-png-parser-the-deut-standard-3c3p)
- Conversion tools such as XnConvert drop SD metadata even with "keep metadata" set — [XnView forum](https://newsgroup.xnview.com/viewtopic.php?p=197464)
- ComfyUI WebP EXIF is lost when another app rewrites the file — [ComfyUI docs](https://docs.comfy.org/development/api-development/workflow-metadata)
- C2PA on social media: a Washington Post test of eight platforms found none kept Content Credentials or exposed them to users (as reported via IPTC). Pinterest read only OpenAI's C2PA version, not Google's. Spec-version mismatches across platforms make results inconsistent — [IPTC: AI disclosure on social media](https://iptc.org/news/ai-disclosure-on-social-media-a-work-in-progress/)
- The IPTC itself says IPTC and C2PA metadata can be stripped intentionally or accidentally — [IPTC guidance](https://iptc.org/news/iptc-publishes-metadata-guidance-for-ai-generated-synthetic-media/)
- Clearing NovelAI stealth metadata can shift alpha values by 1/255. This shows the data lives in pixel LSBs, not in chunks — [SD Prompt Reader README](https://github.com/receyuki/stable-diffusion-prompt-reader)
- SynthID still detected after one stripping tool was used on a Nano Banana Pro image (Register test) — [The Register](https://www.theregister.com/2025/11/20/google_ai_image_detector/)

### Inferences
- Order of survivability, roughly: watermark (SynthID / dwtDct) > NovelAI alpha LSB (survives chunk stripping but not JPEG or alpha flattening) > C2PA / XMP / EXIF / text chunks (gone after nearly any platform upload or screenshot). A screenshot keeps nothing except whatever the watermark carries in the pixels.

### Gaps
- I found no controlled 2026 test covering X/Twitter, Reddit, Instagram, LinkedIn or Discord specifically for SD text chunks or C2PA. A fresh upload-and-download test would be needed.
- I found no robustness data for the SD dwtDct watermark under JPEG compression or resizing.

## 4. Identifying the generator or model when metadata is gone

### Takeaway
Only watermark checks are vendor-specific and fairly reliable: SynthID for Google (and, per OpenAI, OpenAI images), and NovelAI's signature when its metadata is intact. Generic "AI or not" detectors give probabilistic answers and vary widely outside their benchmarks. Telling which specific model made an image (attribution) is research-grade only. Watermarks themselves can be removed, and popular removal repos exist.

### Cited Findings
- **SynthID in Gemini:** you upload an image and ask whether it was made with Google AI. This works only for Google's own watermark, for images, video (since Dec 2025) and audio, in all Gemini-supported regions. Google advises cropping tight and not uploading collages. Gemini's public check was SynthID-only at launch, and Google said it would later extend to C2PA from other ecosystems — [Google blog](https://blog.google/technology/ai/ai-image-verification-gemini-app/); [Gemini support](https://support.google.com/gemini/answer/16722517); [The Register](https://www.theregister.com/2025/11/20/google_ai_image_detector/)
- Unverified: a Digital Trends item says Google announced at I/O 2026 that it is working with Nvidia, OpenAI, ElevenLabs and Kakao to expand SynthID support — [Digital Trends via search](https://www.digitaltrends.com/?p=5974997)
- google-deepmind/synthid-text (1,260★, pushed 2026-11) is for text only. I found no open-source image SynthID detector — GitHub search API
- **Watermark removal:** UnMarker (IEEE S&P 2025) reports a 79% attack success rate against SynthID. Google DeepMind disputed the figure. Google has reportedly restricted SDK access to the SynthID verifier — [IEEE Spectrum](https://spectrum.ieee.org/ai-watermark-remover); [andrekassis/ai-watermark](https://github.com/andrekassis/ai-watermark) (319★, pushed 2025-12)
- Community removal and reverse-engineering repos are popular as of late 2026: wiltodelta/remove-ai-watermarks (6,525★, pushed 2026-11-25), aloshdenny/reverse-SynthID (5,126★, "reverse engineering Gemini's SynthID detection", pushed 2026-07), cebeuq/Synthid-Bypass (1,035★) — GitHub search API. I did not verify how well they work.
- A Feb 2026 Google DeepMind / UW–Madison paper concluded that no existing image-provenance scheme is robust, unforgeable and publicly detectable all at once (as reported) — [The Register](https://www.theregister.com/2025/07/24/ai_watermarks_unmarker/)
- **Commercial detectors:**
  - "Organic or Diffused" study on art: Hive had about 98% accuracy, 0 false positives on human art and about a 3% miss rate. Optic and Illuminarty did worse, and Illuminarty rejected files over 3MB. Adversarial perturbations significantly degraded Hive — [arXiv 2402.03214](https://arxiv.org/abs/2402.03214)
  - Western blot study: Hive missed most AI blots, and Illuminarty and Is It AI? had high false-positive rates. Predictive value collapses at low prevalence — [arXiv 2407.10308](https://arxiv.org/pdf/2407.10308)
  - CBC test: AI or Not and Hive got 3/3 right, while Illuminarty and Is It AI? got 0/3. A Hugging Face detector flagged a real photo as fake — [CBC](https://www.cbc.ca/1.7482913)
- **Open-source detectors and benchmarks** (GitHub search API, 2026-11-26):
  - shilinyan99/AIDE: ICLR 2025, 351★, pushed 2025-06
  - YZY-stack/Effort-AIGI-Detection: ICML 2025, 241★, pushed 2025-07
  - mever-team/spai: CVPR 2025, any-resolution spectral, 91★, pushed 2025-08
  - bcmi/SSP-AI-Generated-Image-Detection: 160★, pushed 2026-03
  - Ouxiang-Li/SAFE: KDD'25, 115★, pushed 2026-06
  - grip-unina/DMimageDetection: 241★, pushed 2024-05 (stale)
  - grip-unina/ClipBased-SyntheticImageDetection: 94★, pushed 2024-11 (stale)
  - lynote-ai/ai-image-detector: CLI/API/web UI with benchmarks, 343★, pushed 2026-08
  - MI-BioLab/AI-GenBench: ongoing benchmark, 37★
  - ant-research/Awesome-AIGC-Image-Video-Detection: curated list, 502★, pushed 2026-11-26 (best index of current papers)
- **Model attribution research** (small, mostly stale):
  - kylemin/WOUAF: user-attribution fingerprinting, 26★, 2024
  - k8xu/ImageAttribution: 11★, 2024
  - PeterWang512/AttributeByUnlearning: training-data attribution, not generator ID, 19★, 2025-05

### Inferences
- Many academic detector repos are paper code frozen after publication. Expect them to fall behind newer generators such as Nano Banana Pro, GPT-image and Flux-class models, because the reported generalization failures match this pattern.
- A detector score is evidence, not proof. At realistic low prevalence most positives can be false, per the Western blot study's predictive-value finding.

### Gaps
- I found no rigorous 2026 independent benchmark of Hive, AI or Not or Illuminarty against current generators.
- I found no maintained open tool that names the specific model or checkpoint (e.g. SDXL vs. Flux vs. Midjourney v7) from pixels alone.
- I did not verify accuracy claims from the 2026 community SynthID removal repos.

## 5. CLI / Python libraries for batch extraction

### Takeaway
Use exiftool (`-j -a -G1` style JSON dump) for everything. Use sd-prompt-reader-cli (pip) or sd-parsers (Python) for normalized SD fields. Use c2patool or c2pa-python for C2PA. Use NovelAI's scripts for alpha-channel metadata. Pillow `Image.info` can read PNG text chunks directly.

### Cited Findings
- sd-prompt-reader-cli: `-r`/`-w`/`-c` modes, `-i`/`-o` paths, `-f` TXT/JSON output, `--raw`. Batch works for read and clear. Installable via pip — [receyuki README](https://github.com/receyuki/stable-diffusion-prompt-reader)
- sd-parsers: Python library for A1111, ComfyUI, InvokeAI, NovelAI, Fooocus — [d3x-at/sd-parsers](https://github.com/d3x-at/sd-parsers)
- c2pa-python and c2patool are actively maintained (pushes on 2026-11-25) — GitHub search API
- NovelAI `nai_meta.py` needs pynacl, pydantic, bchlib, Pillow, numpy, pyyaml — [NovelAI repo](https://github.com/NovelAI/novelai-image-metadata)
- MatrixA/aicheck: offline metadata and watermark check for images, video and audio — GitHub search API

### Inferences
- A robust batch pipeline would run four steps. (1) Run exiftool to JSON. (2) If PNG `parameters`, `prompt` or `workflow` exists, parse it with sd-parsers or sd-prompt-reader. (3) If a JUMBF/C2PA block exists, validate it with c2pa-python. (4) If the PNG has an alpha channel and no text chunks, try the NovelAI stealth reader. (5) Only then fall back to watermark or detector checks.

### Gaps
- I did not check the exact pip package name or version of sd-prompt-reader on PyPI.
- I did not verify exiftool's handling of C2PA JUMBF in current versions from its changelog.
