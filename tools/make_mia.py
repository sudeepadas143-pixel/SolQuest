"""Professor Mia's portrait for the intro, from the supplied art
(tools/src_art/professor_mia.png, 1024x1536 pixel art on black).

The art is pixel art upscaled ~10x with fine details (eye lines, the smile)
about half a block wide. It is reduced to a fixed palette (no dithering) and
resampled on 2.56 px cells (twice the block grid, ~230x590), each cell taking
its most common colour, and shown 1:1 - about the texel density of the
game's other portraits. The black background (touching the border, or any
sizeable enclosed gap) is removed, and the dark edge pixels it took come
back as a 1-texel outline.

    python3 tools/make_mia.py
"""
import os

import numpy as np
from PIL import Image
from scipy import ndimage

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, 'src_art', 'professor_mia.png')
OUT = os.path.join(HERE, '..', 'public', 'assets', 'sprites', 'trainers', 'mia_full.png')
CELL = 2.56
COLORS = 96
OUTLINE = (26, 22, 34, 255)


def main():
    src = Image.open(SRC).convert('RGB')
    q = src.quantize(colors=COLORS, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    pal = np.array(q.getpalette()[:COLORS * 3]).reshape(-1, 3)
    idx = np.asarray(q)
    W, H = int(src.width / CELL), int(src.height / CELL)
    rgb = np.zeros((H, W, 3), np.uint8)
    for j in range(H):
        for i in range(W):
            m = 1 if CELL >= 4 else 0              # skip the cell's edge texels when cells are big
            blk = idx[int(j * CELL) + m:int((j + 1) * CELL) - m, int(i * CELL) + m:int((i + 1) * CELL) - m].ravel()
            v, c = np.unique(blk, return_counts=True)
            rgb[j, i] = pal[v[np.argmax(c)]]
    # background: near-black regions touching the border, plus any sizeable
    # enclosed one (the gap between an arm on the hip and the body); thin
    # dark detail lines inside the figure are far smaller and stay
    dark = rgb.max(2) < 40
    lab, n = ndimage.label(dark)
    border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    sizes = ndimage.sum(dark, lab, range(1, n + 1))
    big = {i + 1 for i, sz in enumerate(sizes) if sz >= 40 * (5.12 / CELL) ** 2}
    bg = np.isin(lab, list(border | big))
    fig = ~bg
    # keep only the main figure (drop specks)
    flab, n = ndimage.label(fig)
    if n > 1:
        sizes = ndimage.sum(fig, flab, range(1, n + 1))
        fig = flab == (int(np.argmax(sizes)) + 1)
    rgba = np.zeros((H, W, 4), np.uint8)
    rgba[..., :3] = rgb
    rgba[..., 3] = np.where(fig, 255, 0)
    # outline: background texels touching the figure
    ring = ndimage.binary_dilation(fig, structure=np.ones((3, 3))) & ~fig
    rgba[ring] = OUTLINE
    ys, xs = np.nonzero(rgba[..., 3])
    rgba = rgba[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    Image.fromarray(rgba, 'RGBA').save(OUT, optimize=True)
    print('wrote', OUT, rgba.shape[1], 'x', rgba.shape[0])


if __name__ == '__main__':
    main()
