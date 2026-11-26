#!/usr/bin/env python3
"""Score candidate images against a reference: how close is the STYLE, and how close is the COMPOSITION?

Usage:
  python3 -I compare_images.py REFERENCE CANDIDATE [CANDIDATE ...] [--sheet sheet.png] [--deep] [--json out.json]
  (candidates may be directories or globs)

Scores are 0-100, higher = closer.
  style       palette + tone + saturation + texture (what "same look" mostly means)
  composition layout/structure (SSIM on a small grayscale) + perceptual hash
  deep        optional CLIP image-image cosine (needs: pip install torch transformers), the best single
              semantic+style signal; off by default because it downloads a ~600 MB model
--sheet writes a contact sheet (reference first, then candidates ranked) to look at in one view.

These are heuristics for ranking iterations, not ground truth: always look at the sheet too.
"""
import argparse, glob, json, sys
from pathlib import Path

try:
    from PIL import Image, ImageDraw, ImageFilter
    import numpy as np
except ImportError:
    sys.exit("Needs Pillow and numpy: pip install pillow numpy")

EXTS = {".png", ".jpg", ".jpeg", ".webp", ".bmp", ".gif", ".tif", ".tiff"}


def expand(items):
    out = []
    for it in items:
        p = Path(it)
        if p.is_dir():
            out += sorted(q for q in p.iterdir() if q.suffix.lower() in EXTS)
        elif any(ch in it for ch in "*?["):
            out += sorted(Path(q) for q in glob.glob(it) if Path(q).suffix.lower() in EXTS)
        else:
            out.append(p)
    return out


def features(path):
    img = Image.open(path).convert("RGB")
    s = img.copy(); s.thumbnail((256, 256))
    a = np.asarray(s).astype(np.float32) / 255
    hsv = np.asarray(s.convert("HSV")).astype(np.float32) / 255
    lum = a @ np.array([.2126, .7152, .0722], np.float32)
    q = (np.asarray(s) // 32).reshape(-1, 3).astype(np.int32)  # 8x8x8 colour histogram
    hist = np.bincount(q[:, 0] * 64 + q[:, 1] * 8 + q[:, 2], minlength=512).astype(np.float32); hist /= hist.sum()
    lh = np.histogram(lum, bins=16, range=(0, 1))[0].astype(np.float32); lh /= lh.sum()
    g = img.convert("L").resize((128, 128), Image.BILINEAR)
    e = np.asarray(g.filter(ImageFilter.FIND_EDGES)).astype(np.float32)
    small = np.asarray(img.convert("L").resize((64, 64), Image.BILINEAR)).astype(np.float32) / 255
    d = np.asarray(img.convert("L").resize((9, 8), Image.BILINEAR)).astype(np.float32)
    dhash = (d[:, 1:] > d[:, :-1]).reshape(-1)
    return {"img": img, "hist": hist, "lumhist": lh, "sat": float(hsv[..., 1].mean()), "lum": float(lum.mean()),
            "contrast": float(lum.std()), "warm": float((a[..., 0] - a[..., 2]).mean()),
            "edge": float((e > 32).mean()), "gray64": small, "dhash": dhash}


def ssim(x, y, block=8):
    c1, c2 = .01 ** 2, .03 ** 2
    n = x.shape[0] // block
    xs = x[:n * block, :n * block].reshape(n, block, n, block).transpose(0, 2, 1, 3).reshape(n, n, -1)
    ys = y[:n * block, :n * block].reshape(n, block, n, block).transpose(0, 2, 1, 3).reshape(n, n, -1)
    mx, my = xs.mean(-1), ys.mean(-1); vx, vy = xs.var(-1), ys.var(-1)
    cov = ((xs - mx[..., None]) * (ys - my[..., None])).mean(-1)
    return float((((2 * mx * my + c1) * (2 * cov + c2)) / ((mx ** 2 + my ** 2 + c1) * (vx + vy + c2))).mean())


def score(r, c):
    palette = float(np.minimum(r["hist"], c["hist"]).sum())          # histogram intersection, 0..1
    tone = float(np.minimum(r["lumhist"], c["lumhist"]).sum())
    sat = 1 - min(1, abs(r["sat"] - c["sat"]) / .35)
    warm = 1 - min(1, abs(r["warm"] - c["warm"]) / .25)
    contrast = 1 - min(1, abs(r["contrast"] - c["contrast"]) / .2)
    texture = 1 - min(1, abs(r["edge"] - c["edge"]) / max(.05, r["edge"]))
    style = 100 * (.32 * palette + .18 * tone + .14 * sat + .1 * warm + .1 * contrast + .16 * texture)
    s = max(0.0, ssim(r["gray64"], c["gray64"]))
    ph = 1 - float((r["dhash"] != c["dhash"]).mean())
    comp = 100 * (.6 * s + .4 * max(0.0, (ph - .5) * 2))
    return {"style": round(style, 1), "composition": round(comp, 1),
            "detail": {"palette": round(palette, 3), "tone": round(tone, 3), "saturation": round(sat, 3),
                       "warmth": round(warm, 3), "contrast": round(contrast, 3), "texture": round(texture, 3),
                       "ssim": round(s, 3), "phash_match": round(ph, 3)},
            "hints": hints(r, c)}


def hints(r, c):
    h = []
    if c["sat"] - r["sat"] > .07: h.append("more saturated than reference: tone down colour")
    if r["sat"] - c["sat"] > .07: h.append("less saturated than reference: push colour")
    if c["lum"] - r["lum"] > .07: h.append("brighter than reference")
    if r["lum"] - c["lum"] > .07: h.append("darker than reference")
    if c["contrast"] - r["contrast"] > .05: h.append("more contrast than reference")
    if r["contrast"] - c["contrast"] > .05: h.append("flatter/less contrast than reference")
    if c["warm"] - r["warm"] > .05: h.append("warmer than reference")
    if r["warm"] - c["warm"] > .05: h.append("cooler than reference")
    if c["edge"] > r["edge"] * 1.4 + .01: h.append("busier/more detailed or sharper linework than reference")
    if c["edge"] < r["edge"] * .7 - .01: h.append("softer/less detailed than reference")
    return h


def deep_scores(ref, cands):
    import os
    os.environ.setdefault("HF_HUB_DISABLE_XET", "1")  # plain HTTPS download; Xet storage hosts are often blocked by proxies
    try:
        import torch
        from transformers import CLIPModel, CLIPProcessor
    except ImportError:
        return None, "deep scoring skipped: pip install torch transformers"
    name = "openai/clip-vit-base-patch32"
    model, proc = CLIPModel.from_pretrained(name), CLIPProcessor.from_pretrained(name)
    with torch.no_grad():
        emb = model.get_image_features(**proc(images=[Image.open(p).convert("RGB") for p in [ref, *cands]], return_tensors="pt"))
    if not torch.is_tensor(emb):  # transformers v5 returns a model output; the projected embedding is pooler_output
        emb = emb.image_embeds if getattr(emb, "image_embeds", None) is not None else emb.pooler_output
    emb = emb / emb.norm(dim=-1, keepdim=True)
    return [round(float(emb[0] @ emb[i + 1]) * 100, 1) for i in range(len(cands))], None


def sheet(ref, ranked, out, cell=320):
    items = [(ref, "REFERENCE")] + [(Path(r["file"]), f"#{i + 1} style {r['style']} comp {r['composition']}")
                                    for i, r in enumerate(ranked)]
    cols = min(4, len(items)); rows = (len(items) + cols - 1) // cols
    S = Image.new("RGB", (cols * cell, rows * (cell + 24)), (24, 24, 24)); d = ImageDraw.Draw(S)
    for k, (p, label) in enumerate(items):
        im = Image.open(p).convert("RGB"); im.thumbnail((cell - 8, cell - 8))
        x, y = (k % cols) * cell, (k // cols) * (cell + 24)
        S.paste(im, (x + (cell - im.width) // 2, y + 4)); d.text((x + 6, y + cell + 4), label, fill=(240, 240, 240))
    S.save(out)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("reference"); ap.add_argument("candidates", nargs="+")
    ap.add_argument("--sheet"); ap.add_argument("--deep", action="store_true"); ap.add_argument("--json")
    a = ap.parse_args()
    cands = [p for p in expand(a.candidates) if p.resolve() != Path(a.reference).resolve()]
    if not cands: sys.exit("no candidate images found")
    rf = features(a.reference)
    res = [{"file": str(p), **score(rf, features(p))} for p in cands]
    note = None
    if a.deep:
        ds, note = deep_scores(a.reference, [str(p) for p in cands])
        if ds:
            for r, v in zip(res, ds): r["deep_clip"] = v
    key = (lambda r: (r.get("deep_clip", 0), r["style"])) if a.deep and "deep_clip" in res[0] else (lambda r: r["style"])
    res.sort(key=key, reverse=True)
    out = {"reference": a.reference, "ranked": res}
    if note: out["note"] = note
    if a.sheet: sheet(Path(a.reference), res, a.sheet); out["sheet"] = a.sheet
    s = json.dumps(out, indent=2)
    if a.json: Path(a.json).write_text(s)
    print(s)


if __name__ == "__main__":
    main()
