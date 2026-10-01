"""Professor Mia's portrait for the intro, from the supplied art
(tools/src_art/professor_mia.png, 1024x1536 pixel art on black).

The art is pixel art upscaled ~10x with fine details (eye lines, the smile)
about half a block wide, so it is resampled on a 5.12 px grid (200x300): the
image is first reduced to a fixed palette (no dithering), then each cell takes
its most common colour. The black background is flood-filled away from the
border, and the dark pixels it took off the figure's edge come back as a
1-texel outline. Shown at 2x in the intro.

    python3 tools/make_mia.py
"""
import os

import numpy as np
from PIL import Image
from scipy import ndimage

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, 'src_art', 'professor_mia.png')
OUT = os.path.join(HERE, '..', 'public', 'assets', 'sprites', 'trainers', 'mia_full.png')
CELL = 5.12
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
            blk = idx[int(j * CELL) + 1:int((j + 1) * CELL) - 1, int(i * CELL) + 1:int((i + 1) * CELL) - 1].ravel()
            v, c = np.unique(blk, return_counts=True)
            rgb[j, i] = pal[v[np.argmax(c)]]
    # background: near-black regions connected to the border
    dark = rgb.max(2) < 40
    lab, _ = ndimage.label(dark)
    border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    bg = np.isin(lab, list(border))
    fig = ~bg
    # keep only the main figure (drop specks)
    flab, n = ndimage.label(fig)
    if n > 1:
        sizes = ndimage.sum(fig, flab, range(1, n + 1))
        fig = flab == (int(np.argmax(sizes)) + 1)
        fig = ndimage.binary_fill_holes(fig)
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
