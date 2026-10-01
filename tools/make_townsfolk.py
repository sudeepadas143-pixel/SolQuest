"""Townspeople for the overworld, from turnaround sheets (tools/src_art/
townsfolk_*.png: each character drawn front / side / back / side on a flat
green background).

Each figure is cut out (background keyed off by colour, small specks
dropped), reduced to a fixed palette and resampled to overworld height
(each cell takes its most common colour), then posed into walk frames by the
same simple poser the game used for its first player sprites
(tools/charsprites.py walk_run_frames). Output, per character:
public/assets/sprites/townsfolk/<id>.png - rows down / left / right / up,
7 frames each (idle, walk, walk, run x4) - and a manifest entry.

    python3 tools/make_townsfolk.py
"""
import json
import os
import sys

import numpy as np
from PIL import Image
from scipy import ndimage

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import charsprites  # noqa: E402

OUT = os.path.join(HERE, '..', 'public', 'assets', 'sprites', 'townsfolk')
BG = np.array([50, 198, 152])
OUTLINE = (26, 22, 34, 255)

# sheet -> characters: id, row y-range, the four views' x-ranges in the sheet
# order [front, side, back, side] (which side looks left is detected), and the
# target height in texels (the player is ~96)
SHEETS = {
    'townsfolk_1.png': [
        dict(id='netkid', rows=(55, 365), xs=[(48, 210), (218, 360), (363, 498), (513, 680)], h=78, face=(1, 1), keep=4, head=(6, 20, 36)),
        dict(id='capkid', rows=(55, 365), xs=[(774, 902), (916, 1041), (1055, 1177), (1193, 1327)], h=80, ball=True, head=(9, 6, 40)),
        dict(id='girl', rows=(55, 365), xs=[(1394, 1514), (1520, 1633), (1663, 1776), (1810, 1983)], h=76, head=(7, 12, 38)),
        dict(id='gardener', rows=(385, 740), xs=[(153, 352), (382, 550), (577, 712), (731, 910)], h=96, head=(14, 14, 40)),
        dict(id='farmer', rows=(385, 740), xs=[(1084, 1277), (1303, 1420), (1480, 1684), (1740, 1983)], h=100, head=(22, 10, 38)),
    ],
}


def cut(a, y0, y1, x0, x1):
    """RGBA crop of one figure, background keyed out, specks dropped."""
    crop = a[y0:y1, x0:x1]
    fg = np.abs(crop.astype(int) - BG).sum(2) > 60
    lab, n = ndimage.label(fg)
    if n > 1:
        sizes = ndimage.sum(fg, lab, range(1, n + 1))
        keep = [i + 1 for i, s in enumerate(sizes) if s > 0.02 * sizes.max()]
        fg = np.isin(lab, keep)
    ys, xs = np.nonzero(fg)
    crop, fg = crop[ys.min():ys.max() + 1, xs.min():xs.max() + 1], fg[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    rgba = np.zeros((*crop.shape[:2], 4), np.uint8)
    rgba[..., :3] = crop
    rgba[..., 3] = np.where(fg, 255, 0)
    return rgba


def resample(rgba, H, colors=48):
    """Palette-reduce and resample to height H (mode per cell); 1-texel outline."""
    h, w = rgba.shape[:2]
    cell = h / H
    W = max(1, int(round(w / cell)))
    rgb = Image.fromarray(rgba[..., :3].astype(np.uint8))
    q = rgb.quantize(colors=colors, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    pal = np.array(q.getpalette()[:colors * 3]).reshape(-1, 3)
    idx = np.asarray(q)
    alpha = rgba[..., 3] > 0
    out = np.zeros((H, W, 4), np.uint8)
    for j in range(H):
        for i in range(W):
            ys = slice(int(j * cell), max(int(j * cell) + 1, int((j + 1) * cell)))
            xs = slice(int(i * cell), max(int(i * cell) + 1, int((i + 1) * cell)))
            al = alpha[ys, xs]
            if al.mean() < 0.5:
                continue
            v, c = np.unique(idx[ys, xs][al], return_counts=True)
            out[j, i, :3] = pal[v[np.argmax(c)]]
            out[j, i, 3] = 255
    m = out[..., 3] > 0
    ring = ndimage.binary_dilation(m, structure=np.ones((3, 3))) & ~m
    out[ring] = OUTLINE
    return out


def recolor_ball(img):
    """The cap kid's red-and-white ball becomes the game's own capsule colours
    (violet over mint) - no outside IP in the game."""
    rgb = img[..., :3].astype(int)
    red = (rgb[..., 0] > 170) & (rgb[..., 1] < 90) & (rgb[..., 2] < 90) & (img[..., 3] > 0)
    if red.any():
        ys, xs = np.nonzero(red)
        y0, y1, x0, x1 = ys.min() - 3, ys.max() + 5, xs.min() - 3, xs.max() + 4
        box = np.zeros(red.shape, bool)
        box[max(0, y0):y1, max(0, x0):x1] = True
        white = box & (rgb.min(2) > 200) & (img[..., 3] > 0)
        img[red] = (153, 69, 255, 255)
        img[white] = (20, 241, 149, 255)
    return img


def facing(img):
    """-1 if a side view looks left, +1 if right: where the face's skin sits
    on the head (top third of the figure)."""
    h = img.shape[0]
    head = img[: int(h * 0.36)]
    rgb = head[..., :3].astype(int)
    a = head[..., 3] > 0
    skin = a & (rgb[..., 0] > 170) & (rgb[..., 0] > rgb[..., 2] + 40) & (rgb[..., 1] > 110)
    if skin.sum() < 3:
        return 0
    xs = np.nonzero(a)[1]
    sx = np.nonzero(skin)[1]
    return -1 if sx.mean() < xs.mean() else 1


def pad_to(img, H, W):
    out = np.zeros((H, W, 4), np.uint8)
    h, w = img.shape[:2]
    out[H - h:, (W - w) // 2:(W - w) // 2 + w] = img
    return out


def main():
    os.makedirs(OUT, exist_ok=True)
    manifest = {}
    for sheet, chars in SHEETS.items():
        a = np.asarray(Image.open(os.path.join(HERE, 'src_art', sheet)).convert('RGB'))
        for ch in chars:
            y0, y1 = ch['rows']
            views = [resample(cut(a, y0, y1, x0, x1), ch['h']) for x0, x1 in ch['xs']]
            if ch.get('ball'):
                views = [recolor_ball(v) for v in views]
            front, s2, back, s4 = views
            # facing can be pinned per character when a hat brim fools the skin test
            f2, f4 = ch.get('face') or (facing(s2), facing(s4))
            if f2 != f4 and f2 and f4:
                left, right = (s2, s4) if f2 < 0 else (s4, s2)
            else:
                # both profiles look the same way: keep the cleaner one, mirror it
                d = f2 or f4 or -1
                s = s4 if ch.get('keep') == 4 else s2
                left, right = (s, s[:, ::-1].copy()) if d < 0 else (s[:, ::-1].copy(), s)
            print('  ', ch['id'], 'side views face', f2, f4)
            W = max(v.shape[1] for v in views)
            H = max(v.shape[0] for v in views)
            vd = {d: pad_to(v, H, W) for d, v in (('down', front), ('left', left), ('right', right), ('up', back))}
            sheet_img, meta = charsprites.build_player_sheet(vd, u=3)
            Image.fromarray(sheet_img, 'RGBA').save(os.path.join(OUT, f"{ch['id']}.png"), optimize=True)
            # head: [x, y, size] square round the face in the front idle frame (the dialogue badge)
            manifest[ch['id']] = {'sheet': f"townsfolk/{ch['id']}.png", **meta, 'head': list(ch['head'])}
            print(ch['id'], sheet_img.shape[1], 'x', sheet_img.shape[0], meta['frameWidth'], meta['frameHeight'])
    path = os.path.join(HERE, '..', 'src', 'data', 'townsfolkSprites.json')
    with open(path, 'w') as f:
        json.dump(manifest, f, indent=2)


if __name__ == '__main__':
    main()
