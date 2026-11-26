# Writing prompts for each model family

Always write separate content and style parts so the user can swap the subject and keep the style.
Put the visual anchors from the rubric in every variant.

## Natural-language models: Flux.1 / FLUX.2, SD3.5, Qwen-Image, HiDream, gpt-image, Gemini / Nano Banana, Ideogram
- Full sentences, most important first: medium and style → subject → setting → light → camera → finish.
- Be concrete ("low-poly 3D render with nearest-neighbour textures and a PS2-era fog falloff"), not vague
  ("retro vibe"). 40-120 words. No negative prompt for Flux (it ignores it); describe what you want instead.
- Quote any text that must appear, in double quotes.
- gpt-image / Nano Banana: can take the reference image directly ("Create a new image in the exact style of
  this image: …"), which beats any prompt on its own.

## SDXL photoreal / general checkpoints (Juggernaut, RealVis, DreamShaper XL)
- Comma-separated phrases, most important first. 30-75 tokens per chunk.
- Positive: `<medium>, <subject>, <setting>, <lighting>, <camera/lens>, <colour/grade>, <detail words>`
- Negative: `lowres, blurry, jpeg artifacts, watermark, text, deformed hands` (+ the opposite of the style,
  e.g. `photo, realistic` for an illustration).

## Pony / Illustrious / NoobAI / SD1.5 anime (Danbooru tags)
- Use booru tags with underscores replaced by spaces where the checkpoint expects; get them from a tagger
  (WD v3 or Camie) when available, because vision descriptions miss tag vocabulary.
- Pony: start with `score_9, score_8_up, score_7_up,` and a source tag (`source_anime`, `source_cartoon`,
  `source_furry`, `source_pony`); negative `score_4, score_5, score_6`.
- Illustrious / NoobAI: start with `masterpiece, best quality, very aesthetic, absurdres,`; character count tags
  (`1girl`, `solo`), then appearance, pose, background, style tags (`flat color`, `lineart`, `cel shading`).
- Weighting: `(tag:1.2)`; artist tags strongly control style on these models, but describe qualities if the user
  doesn't want named artists.

## Midjourney (V7)
- Short natural phrases; style words matter more than grammar.
- Parameters at the end: `--ar W:H` (match the reference aspect), `--sref <image URL or style code> --sw 0-1000`
  (style weight, default 100), `--sv 6` (V7 default sref version; `--sv 4` for old style codes),
  `--stylize`/`--s`, `--chaos` for variety, `--raw` for less MJ house style. Moodboards for multiple references
  (no `--sw`/`--sv` with moodboards). `/describe` on the reference gives 4 extra prompt ideas.
- There is no official Midjourney API; give the user the prompt to paste.

## Style-reference settings to suggest alongside the prompt
| Tool | How |
|---|---|
| FLUX.2 [dev]/[pro] | add the reference image(s) as references (up to ~10) and say "in the style of the reference image" |
| USO (ComfyUI, Flux.1-dev) | style reference image(s) + prompt for content |
| IP-Adapter SDXL (ComfyUI_IPAdapter_plus) | "style transfer" weight type / InstantStyle block (`up.block_0`), weight 0.6-1.0 |
| Flux Redux | works, but overpowers the prompt; lower strength with a community conditioning-strength node |
| Qwen-Image-Edit + style LoRA | restyle a given content image |
| Krea 2 | up to 10 style refs, strength per ref (negative inverts) |
| gpt-image / Nano Banana | attach the image and describe what to keep |

## When zero-shot isn't consistent enough
Train a style LoRA: 15-40 curated images (generate them with the best zero-shot setup, keep only the on-style
ones), content-only captions plus one trigger word, higher rank for style. Tools: ai-toolkit (Flux), OneTrainer,
kohya_ss/sd-scripts (SDXL), SimpleTuner. From a single image on SDXL: B-LoRA.
