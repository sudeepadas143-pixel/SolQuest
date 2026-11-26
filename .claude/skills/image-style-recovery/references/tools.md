# Optional tools that make this skill stronger

The skill runs with only Python + Pillow + numpy. These add capability; suggest them only when the user wants
generation or deeper analysis. Status as researched on 2026-11-26 (see reports/AI image prompt and style recovery.md).

## Generation (so the compare loop can run automatically)
| Tool | What it adds | Notes |
|---|---|---|
| artokun/comfyui-mcp | Drive a local ComfyUI: generate, view outputs, recover embedded workflows | Most complete; also a Claude Code plugin with model-specific prompting skills |
| Comfy-Org/comfy-mcp | Official ComfyUI MCP (beta), local or Comfy Cloud | |
| fal MCP (mcp.fal.ai) | Hosted FLUX.2, Nano Banana, Qwen-Image, etc. | OAuth, pay per image |
| Replicate MCP (mcp.replicate.com) | Hosted models incl. Flux and captioners | |
| Black Forest Labs MCP | FLUX.2 with multiple reference images | Listed in MCP directories; confirm on bfl.ai before relying on it |
| shinpr/mcp-image | Gemini / OpenAI / Seedream image generation | No style-reference parameter |
| Midjourney | No official API | Unofficial wrappers may break and may violate Midjourney's terms: give the user prompts instead |

## Better analysis
| Tool | Use |
|---|---|
| exiftool | `exiftool -j -a -G1 IMAGE` dumps every metadata field the script doesn't parse |
| c2pa-python (`pip install c2pa-python`) | Used automatically by inspect_image.py to read/validate Content Credentials |
| c2patool / contentauth c2pa-mcp | Same from the command line / as an MCP tool |
| SD Prompt Reader (receyuki) | GUI/CLI reader for many generator formats; cross-check the script |
| JoyCaption Beta One, Qwen3-VL | Better long captions for Flux-style prompts, run locally (ComfyUI nodes exist) |
| WD v3 tagger / Camie tagger | Danbooru tags for Pony/Illustrious/NoobAI prompts |
| Hugging Face MCP (hf-mcp-server) | Call captioner/tagger Spaces as tools |
| `pip install torch --index-url https://download.pytorch.org/whl/cpu` + `pip install transformers` | Enables `compare_images.py --deep` (CLIP image similarity); needs huggingface.co reachable for the model |
| Gemini app SynthID check | Tells you if an image came from Google's generators (Google images only) |

## Known limits
- Without metadata, the exact prompt, seed and settings are unrecoverable. Prompt inversion gets the same meaning,
  not the same words.
- AI-image detectors are unreliable; no maintained tool names the exact model from pixels.
- Midjourney prompts may sometimes sit in IPTC/XMP description fields, but this is undocumented.
