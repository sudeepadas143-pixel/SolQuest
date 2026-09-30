#!/usr/bin/env python3
"""
Asset pipeline: raw_assets/ (large upscaled illustrations on solid backgrounds)
-> public/assets/sprites/ (keyed, cropped, pixel-grid PNGs ready for Phaser).

Steps per image:
  1. Key out the background by flood-filling from the canvas border
     (colour-distance to the border colour, plus a "magenta-ish" rule for the
     pink/purple backdrops so drop-shadows go too).
  2. Keep the main sprite; drop small islands (image-generator sparkle
     watermark, stray embers) and slivers of neighbouring images at the edges.
  3. Crop, then downscale with a block-median filter so the pixel art stays
     crisp, and reduce to a small palette to kill JPEG noise.

Run:  python3 tools/process_assets.py      (needs pillow, numpy, scipy)
"""
import json
import os
import sys

import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, "raw_assets")
OUT = os.path.join(ROOT, "public", "assets", "sprites")

# ---------------------------------------------------------------- keying ----

def load_rgba(name):
    return np.asarray(Image.open(os.path.join(RAW, name)).convert("RGBA")).astype(np.int32)


def border_color(a):
    b = np.concatenate([a[0, :, :3], a[-1, :, :3], a[:, 0, :3], a[:, -1, :3]])
    return np.median(b, axis=0)


def key_background(a, tol=60, magenta=False, dark_max=None):
    """Return boolean foreground mask."""
    h, w, _ = a.shape
    if a[..., 3].min() < 250:  # already has real transparency
        return a[..., 3] >= 128
    rgb = a[..., :3]
    if dark_max is not None:
        cand = rgb.max(axis=2) <= dark_max
    else:
        bg = border_color(a)
        cand = np.abs(rgb - bg).sum(axis=2) < tol
        if magenta:
            r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
            cand |= (r > g + 50) & (b > g + 30) & (np.abs(r - b) < 90) & (g < 125)
    lab, n = ndimage.label(cand)
    edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    bgmask = np.isin(lab, list(edge))
    if magenta and dark_max is None:
        # enclosed holes (e.g. inside a curled tail) that are clearly backdrop colour
        strict = np.abs(rgb - bg).sum(axis=2) < 80
        hl, hn = ndimage.label(strict & ~bgmask)
        if hn:
            sizes = ndimage.sum(strict, hl, range(1, hn + 1))
            big = np.where(sizes > 0.0015 * h * w)[0] + 1
            bgmask |= np.isin(hl, big)
    return ~bgmask


def clean_components(fg, keep_frac=0.012, drop_edge_slivers=True):
    lab, n = ndimage.label(fg)
    if n == 0:
        return fg
    sizes = ndimage.sum(fg, lab, range(1, n + 1))
    main = int(np.argmax(sizes)) + 1
    h, w = fg.shape
    keep = np.zeros(n + 1, bool)
    keep[main] = True
    objs = ndimage.find_objects(lab)
    for i, sl in enumerate(objs, start=1):
        if i == main or sizes[i - 1] < keep_frac * sizes[main - 1]:
            continue
        ys, xs = sl
        touches_lr = xs.start == 0 or xs.stop == w
        if drop_edge_slivers and touches_lr and (xs.stop - xs.start) < 0.08 * w:
            continue
        keep[i] = True
    return keep[lab]


def crop(a, fg):
    ys, xs = np.where(fg)
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    out = a[y0:y1, x0:x1].copy()
    out[..., 3] = np.where(fg[y0:y1, x0:x1], 255, 0)
    return out


def block_downscale(a, th=None, tw=None, dark_bias=0.0):
    """Median-of-block downscale; keeps flat pixel-art colours crisp.
    dark_bias > 0: if at least that fraction of a block is near-black (eyes,
    outlines), keep the dark colour - stops tiny sprites losing their faces."""
    h, w, _ = a.shape
    if th is None:
        th = max(1, round(h * tw / w))
    if tw is None:
        tw = max(1, round(w * th / h))
    out = np.zeros((th, tw, 4), np.uint8)
    ye = np.linspace(0, h, th + 1).astype(int)
    xe = np.linspace(0, w, tw + 1).astype(int)
    for ty in range(th):
        for tx in range(tw):
            blk = a[ye[ty]:max(ye[ty + 1], ye[ty] + 1), xe[tx]:max(xe[tx + 1], xe[tx] + 1)]
            al = blk[..., 3] > 0
            if al.mean() < 0.5:
                continue
            px = blk[al][:, :3]
            if dark_bias:
                dark = px.max(axis=1) < 70
                if dark.mean() >= dark_bias:
                    out[ty, tx, :3] = np.median(px[dark], axis=0)
                    out[ty, tx, 3] = 255
                    continue
            out[ty, tx, :3] = np.median(px, axis=0)
            out[ty, tx, 3] = 255
    return out


def fit_scale(a, box_w, box_h, dark_bias=0.0):
    h, w, _ = a.shape
    s = min(box_w / w, box_h / h)
    return block_downscale(a, th=max(1, round(h * s)), tw=max(1, round(w * s)), dark_bias=dark_bias)


def quantize(a, colors=40):
    img = Image.fromarray(a.astype(np.uint8), "RGBA")
    rgb = img.convert("RGB").quantize(colors=colors, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert("RGB")
    out = np.asarray(rgb).copy()
    return np.dstack([out, np.asarray(img)[..., 3]])


def save(a, rel):
    path = os.path.join(OUT, rel)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    Image.fromarray(a.astype(np.uint8), "RGBA").save(path)
    return path


def process(name, box, magenta=False, tol=60, dark_max=None, colors=40, keep_frac=0.012, pre=None, dark_bias=0.0):
    a = load_rgba(name)
    fg = key_background(a, tol=tol, magenta=magenta, dark_max=dark_max)
    fg = ndimage.binary_opening(fg, iterations=1) | (fg & (a[..., :3].max(axis=2) < 60))
    fg = clean_components(fg, keep_frac=keep_frac)
    c = crop(a, fg)
    if pre:
        c = pre(c)
    small = fit_scale(c, *box, dark_bias=dark_bias)
    return quantize(small, colors)

# ------------------------------------------------- capture-ball recolour ----
# The trainer battle poses hold a red/white capture ball (Nintendo's design).
# Recolour it to a Solana-style purple -> green gradient with a dark lower half.

SOL_PURPLE = np.array([153, 69, 255], float)
SOL_GREEN = np.array([20, 241, 149], float)
SOL_DARK = np.array([26, 22, 44], float)

# Ball bounding boxes (x0, y0, x1, y1) in the downscaled 110x120-box battle sprites,
# located by eye on a zoomed grid. Re-check these if the box size above changes.
BALL_BOXES = {
    "A": (72, 34, 84, 47),
    "B": (69, 40, 81, 51),
    "C": (78, 37, 89, 50),
    "D": (76, 36, 91, 48),   # Cooker (updated art)
    "E": (67, 38, 80, 50),
}


def recolor_ball(img, box):
    x0, y0, x1, y1 = box
    out = img.copy()
    reg = out[y0:y1, x0:x1, :3].astype(float)
    op = out[y0:y1, x0:x1, 3] > 0
    r, g, b = reg[..., 0], reg[..., 1], reg[..., 2]
    red = op & (r > g + 45) & (r > b + 35) & (g < r * 0.6)
    if not red.any():
        return out
    lum = (0.3 * r + 0.59 * g + 0.11 * b) / 255.0
    rows = np.where(red.any(axis=1))[0]
    cols = np.where(red.any(axis=0))[0]
    t = (np.arange(x1 - x0)[None, :] - cols.min()) / max(1, cols.max() - cols.min())
    t = np.clip(t, 0, 1).repeat(y1 - y0, 0)
    grad = SOL_PURPLE * (1 - t[..., None]) + SOL_GREEN * t[..., None]
    shade = np.clip(0.45 + lum * 1.4, 0.45, 1.1)[..., None]
    reg = np.where(red[..., None], grad * shade, reg)
    # white lower shell -> dark, leaving the seam row (button) bright
    mn, mx = np.minimum(np.minimum(r, g), b), np.maximum(np.maximum(r, g), b)
    white = op & (mn > 190) & (mx - mn < 40)
    below = np.zeros_like(white)
    below[rows.max() + 2:, cols.min():cols.max() + 1] = True
    darken = white & below
    reg = np.where(darken[..., None], SOL_DARK + (lum[..., None] - 0.8) * 80, reg)
    out[y0:y1, x0:x1, :3] = np.clip(reg, 0, 255)
    return out

# ------------------------------------------------------ walk-cycle frames ----

def split_turnaround(name, dark_max=None, tol=60):
    """Split a 4-view turnaround (front, left, back, right) into 4 cropped views."""
    a = load_rgba(name)
    fg = key_background(a, tol=tol, dark_max=dark_max)
    fg = clean_components(fg, keep_frac=0.002, drop_edge_slivers=False)
    cols = fg.any(axis=0)
    segs, inside, start = [], False, 0
    for x, v in enumerate(cols):
        if v and not inside:
            inside, start = True, x
        elif not v and inside:
            inside = False
            segs.append((start, x))
    if inside:
        segs.append((start, len(cols)))
    # merge segments separated by tiny gaps (hair spikes etc.)
    merged = []
    for s in segs:
        if merged and s[0] - merged[-1][1] < 25:
            merged[-1] = (merged[-1][0], s[1])
        else:
            merged.append(s)
    merged = [s for s in merged if s[1] - s[0] > 60]
    assert len(merged) == 4, f"{name}: expected 4 views, got {merged}"
    views = []
    for x0, x1 in merged:
        sub = a[:, x0:x1]
        f = fg[:, x0:x1]
        views.append(crop(sub, f))
    return views  # front(down), left, back(up), right


def step_frames(img, direction):
    """From one idle frame make [idle, stepA, stepB] by nudging the feet."""
    h, w, _ = img.shape
    leg0 = int(h * 0.74)
    idle = img.copy()

    def shifted(src, rows, cols, dy=0, dx=0):
        out = src.copy()
        region = src[rows, cols].copy()
        out[rows, cols] = 0
        r0, r1 = rows.start, rows.stop
        c0, c1 = cols.start, cols.stop
        tr0, tr1 = r0 + dy, r1 + dy
        tc0, tc1 = c0 + dx, c1 + dx
        # paste with alpha
        dst = out[max(tr0, 0):min(tr1, h), max(tc0, 0):min(tc1, w)]
        srcr = region[max(0, -tr0):region.shape[0] - max(0, tr1 - h), max(0, -tc0):region.shape[1] - max(0, tc1 - w)]
        m = srcr[..., 3:4] > 0
        dst[:] = np.where(m, srcr, dst)
        return out

    if direction in ("down", "up"):
        mid = w // 2
        a = shifted(idle, slice(leg0, h), slice(0, mid), dy=-1)
        b = shifted(idle, slice(leg0, h), slice(mid, w), dy=-1)
        # small body bob on step frames
        a = np.vstack([a[1:], np.zeros((1, w, 4), a.dtype)]) if False else a
        return [idle, a, b]
    else:
        fwd = -1 if direction == "left" else 1
        mid = w // 2
        front = slice(0, mid) if direction == "left" else slice(mid, w)
        back = slice(mid, w) if direction == "left" else slice(0, mid)
        a = shifted(idle, slice(leg0, h), front, dx=fwd)
        a = shifted(a, slice(leg0, h), back, dx=-fwd)
        b = shifted(idle, slice(0, leg0), slice(0, w), dy=-1)
        return [idle, a, b]


def build_walk_sheet(name, out_rel, height, dark_max=None, tol=60):
    views = split_turnaround(name, dark_max=dark_max, tol=tol)
    smalls = [quantize(fit_scale(v, 999, height), 32) for v in views]
    fw = max(s.shape[1] for s in smalls) + 2
    fh = height + 2
    order = [("down", smalls[0]), ("left", smalls[1]), ("right", smalls[3]), ("up", smalls[2])]
    sheet = np.zeros((fh * 4, fw * 3, 4), np.uint8)
    for row, (d, img) in enumerate(order):
        # pad to frame, bottom-aligned & centred
        frame = np.zeros((fh, fw, 4), np.uint8)
        ih, iw, _ = img.shape
        oy, ox = fh - ih - 1, (fw - iw) // 2
        frame[oy:oy + ih, ox:ox + iw] = img
        for col, fr in enumerate(step_frames(frame, d)):
            sheet[row * fh:(row + 1) * fh, col * fw:(col + 1) * fw] = fr
    save(sheet, out_rel)
    return {"frameWidth": fw, "frameHeight": fh, "rows": ["down", "left", "right", "up"]}

# ------------------------------------------------------------- manifest ----

CREATURES = {
    # id: (front file, back file, box, magenta)
    "emby":      ("IMG_4927.PNG", "IMG_4928.jpg", 72),
    # fire line: Emby -> Embrute (upright biped) -> Emberfox (the fox, final form)
    "embrute":   ("IMG_user_embrute_front.png", "IMG_4949.jpg", 84),
    "emberfox":  ("IMG_4950.jpg", "IMG_4953.jpg", 96),
    "sharkpup":  ("IMG_4930.PNG", "IMG_4931.jpg", 72),
    "sharkjaw":  ("IMG_4954.jpg", "IMG_4956.jpg", 84),
    "sharkrex":  ("IMG_4954 2.jpg", "IMG_4956 2.jpg", 96),
    "fernie":    ("IMG_4935.PNG", "IMG_4936.jpg", 72),
    "fernbloom": ("IMG_4958.jpg", "IMG_4962.jpg", 84),
    "fernking":  ("IMG_4958 2.jpg", "IMG_4959.jpg", 96),
    "boxbun":    ("IMG_4939.PNG", None, 88),
    "rubyclaw":  ("IMG_4948.PNG", None, 92),
    "glowblade": ("IMG_4941.jpg", None, 100),
    "scorpix":   ("IMG_4945.jpg", None, 100),
    "mantek":    ("IMG_4946.jpg", None, 100),
}

TRAINERS = {
    # design id: (battle pose, overworld chibi)
    "A": ("151715CC-0862-400D-83CC-218B6F54FB5C.PNG", "3378E2C2-6EF0-48B9-9DA9-5DC4B0351A44.PNG"),
    "B": ("195210FF-2B49-40E7-BB8F-C8E5C153EFCE.PNG", "992DF2BA-1FED-4F25-BD32-0388AF87EEDE.PNG"),
    "C": ("64EC1B57-70CE-4019-ADF0-ECB6C5DDE3B7.PNG", "887F1F1A-1441-4BA4-94C9-196227F29683.PNG"),
    # D = Cooker. Updated art (no brand logo) supplied as one sheet: battle pose | overworld,
    # split into raw_assets/_derived/ by split_sheets(). The original D files are superseded.
    "D": ("_derived/cooker_battle.png", "_derived/cooker_ow.png"),
    "E": ("BA194F31-FB63-45C0-BE3E-75AB6B623D7E.PNG", "6FA4B02E-DFF1-4DC5-A6BB-B8635373C2C3.PNG"),
}

OW_HEIGHT = 24
# Cooker's overworld art keeps its eyes at 26px (at 24 they fall between pixels); also reads as the boss.
OW_HEIGHT_OVERRIDE = {"D": 26}

# Side-by-side sheets: (source, [left_out, right_out]) split at the white divider line.
SHEETS = [("cooker_sheet.png", ["_derived/cooker_battle.png", "_derived/cooker_ow.png"])]


def split_sheets():
    for src, outs in SHEETS:
        a = np.asarray(Image.open(os.path.join(RAW, src)).convert("RGB")).astype(int)
        white_cols = np.where((a.min(axis=2) > 225).mean(axis=0) > 0.9)[0]
        mid = a.shape[1] // 2
        near = white_cols[np.abs(white_cols - mid) < a.shape[1] * 0.2]
        x0, x1 = (near.min(), near.max() + 1) if len(near) else (mid, mid)
        os.makedirs(os.path.join(RAW, "_derived"), exist_ok=True)
        Image.fromarray(a[:, : x0 - 2].astype(np.uint8)).save(os.path.join(RAW, outs[0]))
        Image.fromarray(a[:, x1 + 2:].astype(np.uint8)).save(os.path.join(RAW, outs[1]))


# Texel density of each sprite family vs. how it is displayed (see src/config.js HD).
HD = {"front": 2, "back": 3, "battle": 3, "full": 3}

# Overworld heights (texels = screen px). Ansem/Orangie/Cented's art is drawn
# slightly smaller, Cooker a touch taller (final boss presence).
OW_H = {"A": 100, "B": 94, "C": 94, "D": 104, "E": 96}
PLAYER_H = {"boy": 96, "girl": 98}


def player_views(g):
    from charsprites import extract, to_height
    if g == "boy":
        v = split_turnaround("boy_turnaround.png", tol=40)
        # the turnaround's 4th view faces left too; the owner supplied a proper right view
        right = extract("boy_right.png", tol=40)
        H = PLAYER_H[g]
        return {"down": to_height(v[0], H), "left": to_height(v[1], H), "up": to_height(v[2], H), "right": to_height(right, H)}
    v = split_turnaround("girl_turnaround.png", dark_max=3)
    H = PLAYER_H[g]
    return {"down": to_height(v[0], H), "left": to_height(v[1], H), "up": to_height(v[2], H), "right": to_height(v[3], H)}


def idle_sheet(img, pad=6):
    """Trainer overworld: [idle, breathe] - the upper body dips one texel."""
    h, w, _ = img.shape
    fw, fh = w + 2 * pad, h + pad
    fr = np.zeros((fh, fw, 4), np.uint8)
    fr[fh - h - 1:fh - 1, pad:pad + w] = img
    br = fr.copy()
    cut = fh - 1 - int(h * 0.3)
    up = fr[:cut].copy()
    br[:cut] = 0
    br[1:cut + 1] = np.where(up[..., 3:4] > 0, up, br[1:cut + 1])
    return np.concatenate([fr, br], axis=1), fw, fh


def main():
    import charsprites
    only = sys.argv[1:]
    split_sheets()
    manifest = {"creatures": {}, "trainers": {}, "player": {}, "hd": HD}

    for cid, (front, back, box) in CREATURES.items():
        if only and cid not in only:
            continue
        entry = {}
        if front:
            mag = front.startswith("IMG_") and front != "IMG_4948.PNG"
            b = box * HD["front"]
            img = process(front, (b, b), magenta=mag, tol=70, colors=96)
            save(img, f"creatures/{cid}_front.png")
            entry["front"] = f"creatures/{cid}_front.png"
        if back:
            b = box * HD["back"]
            img = process(back, (b, b), magenta=True, tol=70, colors=96)
            save(img, f"creatures/{cid}_back.png")
            entry["back"] = f"creatures/{cid}_back.png"
        manifest["creatures"][cid] = entry
        print("creature", cid, entry)

    for tid, (pose, ow) in TRAINERS.items():
        if only and tid not in only:
            continue
        k = HD["battle"]
        img = process(pose, (110 * k, 120 * k), tol=60, colors=96)
        x0, y0, x1, y1 = BALL_BOXES[tid]
        img = recolor_ball(img, (x0 * k, y0 * k, x1 * k, y1 * k))
        save(img, f"trainers/{tid}_battle.png")
        c = charsprites.extract(ow, tol=40)
        small = charsprites.to_height(c, OW_H[tid])
        sheet, fw, fh = idle_sheet(small)
        save(sheet, f"trainers/{tid}_ow.png")
        manifest["trainers"][tid] = {"battle": f"trainers/{tid}_battle.png", "overworld": f"trainers/{tid}_ow.png",
                                     "owFrameWidth": fw, "owFrameHeight": fh}
        print("trainer", tid)

    if not only or "player" in only:
        k = HD["full"]
        for g, full, kw in (("boy", "FA0CF62E-7EBA-4F8C-9064-BD481E75C4DC.PNG", {}),
                            ("girl", "3B1ACE55-F6AE-4A60-93EE-27F41B8BD8CB.PNG", {"dark_max": 3})):
            sheet, meta = charsprites.build_player_sheet(player_views(g), rig_prefix=g)
            save(sheet, f"player/{g}_walk.png")
            save(process(full, (80 * k, 140 * k), colors=96, **kw), f"player/{g}_full.png")
            manifest["player"][g] = {"walk": f"player/{g}_walk.png", **meta, "full": f"player/{g}_full.png"}
        print("player sheets done")

    if not only:
        for path in (os.path.join(OUT, "manifest.json"), os.path.join(ROOT, "src", "data", "spriteManifest.json")):
            with open(path, "w") as f:
                json.dump(manifest, f, indent=2)


if __name__ == "__main__":
    main()
