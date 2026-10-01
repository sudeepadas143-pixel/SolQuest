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
from process_assets import block_downscale, quantize  # noqa: E402

OUT = os.path.join(HERE, '..', 'public', 'assets', 'sprites', 'townsfolk')
BG = np.array([50, 198, 152])
OUTLINE = (26, 22, 34, 255)          # the player's outline colour
ART_H = 48                            # body height in art pixels (shortest view)...
U = 2                                 # ...each drawn U x U: 96 texels, the player's height

# sheet -> characters: id, row y-range, the four views' x-ranges in the sheet
# order [front, side, back, side] (which side looks left is detected), and the
# target height in texels (the player is ~96)
SHEETS = {
    'townsfolk_1.png': [
        dict(id='netkid', rows=(55, 365), xs=[(48, 210), (218, 360), (363, 498), (513, 680)], face=(1, 1), keep=4, head=(13, 24, 40)),
        dict(id='capkid', rows=(55, 365), xs=[(774, 902), (916, 1041), (1055, 1177), (1193, 1327)], ball=True, head=(19, 22, 42)),
        dict(id='girl', rows=(55, 365), xs=[(1394, 1514), (1520, 1633), (1663, 1776), (1810, 1983)], head=(21, 24, 42)),
        dict(id='gardener', rows=(385, 740), xs=[(153, 352), (382, 550), (577, 712), (731, 910)], head=(19, 18, 42)),
        dict(id='farmer', rows=(385, 740), xs=[(1084, 1277), (1303, 1420), (1480, 1684), (1740, 1983)], head=(26, 20, 40)),
    ],
    'townsfolk_2.png': [
        dict(id='shopper', rows=(50, 380), xs=[(12, 185), (190, 300), (300, 484), (493, 613)], ball=True, ball_zone=(0.45, 0.95), head=(24, 20, 44)),
        dict(id='picker', rows=(50, 380), xs=[(678, 806), (830, 950), (973, 1092), (1107, 1223)], head=(24, 18, 42)),
        dict(id='strawkid', rows=(50, 380), xs=[(1279, 1435), (1450, 1593), (1628, 1775), (1799, 1941)], ball=True, head=(24, 18, 42)),
        dict(id='buggirl', rows=(408, 742), xs=[(24, 176), (178, 298), (300, 494)], head=(21, 22, 42)),
    ],
}


def cut(a, y0, y1, x0, x1):
    """RGBA crop of one figure, background keyed out, specks dropped."""
    crop = a[y0:y1, x0:x1]
    d = np.abs(crop.astype(int) - BG).sum(2)
    # background: green-ish regions reaching the crop's edge, plus enclosed gaps
    # (between an arm and the body) that are truly background-coloured - so
    # teal clothes close to the backdrop green stay solid
    lab, n = ndimage.label(d <= 60)
    edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    bg = np.isin(lab, list(edge))
    for i in set(range(1, n + 1)) - edge:
        comp = lab == i
        if comp.sum() > 30 and d[comp].mean() < 22:
            bg |= comp
    fg = ~bg
    lab, n = ndimage.label(fg)
    if n > 1:
        sizes = ndimage.sum(fg, lab, range(1, n + 1))
        keep = [i + 1 for i, s in enumerate(sizes) if s > 0.02 * sizes.max()]
        fg = np.isin(lab, keep)
    ys, xs = np.nonzero(fg)
    crop, fg = crop[ys.min():ys.max() + 1, xs.min():xs.max() + 1], fg[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    # the antialiased rim is half backdrop green: shave it (the outline replaces it)
    fg = ndimage.binary_erosion(fg, iterations=2)
    rgba = np.zeros((*crop.shape[:2], 4), np.uint8)
    rgba[..., :3] = crop
    rgba[..., 3] = np.where(fg, 255, 0)
    return rgba


def resample(rgba, cell, colors=28):
    """To the game's art-pixel grid: median-of-block downscale (one art pixel
    per `cell` source pixels), a shared-size palette, a 1-art-pixel outline in
    the player's outline colour, then each art pixel drawn U x U texels - the
    same chunky density as the player and the Elites."""
    h, w = rgba.shape[:2]
    small = block_downscale(rgba.astype(np.int32), th=max(1, round(h / cell)), tw=max(1, round(w / cell)))
    small = quantize(small, colors).astype(np.uint8)
    out = np.zeros((small.shape[0] + 2, small.shape[1] + 2, 4), np.uint8)
    out[1:-1, 1:-1] = small
    m = out[..., 3] > 0
    ring = ndimage.binary_dilation(m, structure=np.array([[0, 1, 0], [1, 1, 1], [0, 1, 0]])) & ~m
    out[ring] = OUTLINE
    return out


def upscale(a):
    return np.kron(a, np.ones((U, U, 1), np.uint8))


def ball_boxes(img, zone=(0.0, 0.7)):
    """Red-and-white balls (in a hand, on a bag), found at full resolution
    where their red is still pure: a red blob (by hue, ball-sized) with white
    right beside it, inside `zone` (fractions of the height). Returns boxes
    (y0, y1, x0, x1) in the image's pixels."""
    rgb = img[..., :3].astype(int)
    h = img.shape[0]
    red = (rgb[..., 0] > 80) & (rgb[..., 0] > 2 * rgb[..., 1]) & (rgb[..., 0] > 1.8 * rgb[..., 2]) & (img[..., 3] > 0)
    red[: int(h * zone[0])] = False
    red[int(h * zone[1]):] = False
    white_all = (rgb.min(2) > 185) & (img[..., 3] > 0)
    boxes = []
    lab, n = ndimage.label(red, structure=np.ones((3, 3)))
    for i in range(1, n + 1):
        ys, xs = np.nonzero(lab == i)
        r = ys.max() - ys.min() + 1
        if len(ys) < 6 or max(r, xs.max() - xs.min() + 1) > 0.1 * h + 2:
            continue                                # a speck, or bigger than a ball (a bag, a belt)
        y0, y1, x0, x1 = max(0, ys.min() - 2), ys.max() + r + 2, max(0, xs.min() - 2), xs.max() + 3
        if white_all[y0:y1, x0:x1].sum() < 0.4 * len(ys):
            continue
        boxes.append((y0, y1, x0, x1))
    return boxes


def recolor_ball(art, boxes, cell):
    """Repaint each ball (boxes from ball_boxes, in source pixels) in the
    resampled art (one art pixel per `cell` source pixels, 1-pixel outline
    border) as the game's capsule: violet over mint - no outside IP in the game."""
    for y0, y1, x0, x1 in boxes:
        ay0, ay1 = int(y0 / cell) + 1, int(np.ceil(y1 / cell)) + 1
        ax0, ax1 = int(x0 / cell) + 1, int(np.ceil(x1 / cell)) + 1
        reg = art[ay0:ay1, ax0:ax1]
        rgb = reg[..., :3].astype(int)
        lum = rgb.max(2)
        body = (reg[..., 3] > 0) & (lum > 70) & ~((rgb[..., 0] > rgb[..., 2] + 60) & (rgb[..., 1] > 120))   # not outline, not skin
        mid = (ay1 - ay0) / 2
        for j, i in zip(*np.nonzero(body)):
            light = rgb[j, i].min() > 150
            reg[j, i, :3] = (20, 241, 149) if (light or j >= mid) else (153, 69, 255)
    return art


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
    built = {}
    for sheet, chars in SHEETS.items():
        a = np.asarray(Image.open(os.path.join(HERE, 'src_art', sheet)).convert('RGB'))
        for ch in chars:
            y0, y1 = ch['rows']
            cuts = [cut(a, y0, y1, x0, x1) for x0, x1 in ch['xs']]
            zone = ch.get('ball_zone', (0.0, 0.7))
            # one scale per character, from its shortest view (props held overhead
            # don't shrink the body), so every view - and everyone - is ART_H tall
            cell = min(c.shape[0] for c in cuts) / ART_H
            views = [resample(c, cell) for c in cuts]
            if ch.get('ball'):
                views = [recolor_ball(v, ball_boxes(c, zone), cell) for v, c in zip(views, cuts)]
            views = [upscale(v) for v in views]
            if len(views) == 3:
                # front / side / back only: the other side is the mirror image
                views.append(views[1])
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
            built[ch['id']] = (*charsprites.build_player_sheet(vd, u=U), ch)
    # everyone on the same frame size (bottom-aligned, centred), like a real sprite set
    FW = max(m['frameWidth'] for _, m, _ in built.values())
    FH = max(m['frameHeight'] for _, m, _ in built.values())
    FW += FW % 2
    for cid, (sheet_img, meta, ch) in built.items():
        fw, fh, nf = meta['frameWidth'], meta['frameHeight'], meta['frames']
        out = np.zeros((FH * 4, FW * nf, 4), np.uint8)
        for r in range(4):
            for c in range(nf):
                fr = sheet_img[r * fh:(r + 1) * fh, c * fw:(c + 1) * fw]
                oy, ox = FH - fh, (FW - fw) // 2
                out[r * FH + oy:r * FH + oy + fh, c * FW + ox:c * FW + ox + fw] = fr
        Image.fromarray(out, 'RGBA').save(os.path.join(OUT, f'{cid}.png'), optimize=True)
        # head: [x, y, size] square round the face in the front idle frame (the dialogue badge)
        manifest[cid] = {'sheet': f'townsfolk/{cid}.png', **meta, 'frameWidth': FW, 'frameHeight': FH,
                         'head': list(ch.get('head', (0, 0, 40)))}
    print('frame', FW, 'x', FH, 'for all', len(built))
    path = os.path.join(HERE, '..', 'src', 'data', 'townsfolkSprites.json')
    with open(path, 'w') as f:
        json.dump(manifest, f, indent=2)


if __name__ == '__main__':
    main()
