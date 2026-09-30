#!/usr/bin/env python3
"""
Builds the overworld art: the 16x16 ground tileset (drawn here) and the map
props (houses, Rest House, Elite Hall, trees, cars, lamps, signs, banners),
which are modelled in 3D and rendered DS-style by tools/props3d.py + iso3d.py.

Run: python3 tools/make_tiles.py
"""
import json
import os
import random
import sys

from PIL import Image, ImageDraw

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import props3d  # noqa: E402  (3D-rendered buildings, trees, cars, lamps...)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "public", "assets", "tiles")
T = 16
rng = random.Random(7)

# palette
OUTLINE = (36, 40, 52)
GRASS = (120, 200, 104)
GRASS_D = (96, 176, 88)
GRASS_L = (152, 222, 128)
TALL = (56, 150, 72)
TALL_D = (36, 112, 56)
TALL_L = (96, 190, 96)
ROAD = (104, 108, 120)
ROAD_D = (88, 92, 104)
ROAD_L = (122, 126, 138)
LINE = (240, 232, 176)
WALK = (214, 204, 180)
WALK_D = (186, 176, 152)
FENCE = (236, 236, 228)
FENCE_D = (176, 172, 168)


def new(w=T, h=T, fill=(0, 0, 0, 0)):
    return Image.new("RGBA", (w, h), fill)


def speckle(img, colors, n, box=None):
    d = ImageDraw.Draw(img)
    x0, y0, x1, y1 = box or (0, 0, img.width, img.height)
    for _ in range(n):
        d.point((rng.randrange(x0, x1), rng.randrange(y0, y1)), fill=rng.choice(colors))


# ---------------------------------------------------------------- tiles ----
# 64 x 48 texel tiles (32 x 24 world units at ART_SCALE 2): the ground is
# foreshortened by the lowered camera (GY = 0.75), matching the 3D props
# (4 texels per model unit). One texel = one screen pixel in game.
import numpy as np  # noqa: E402

K = 2                      # texel density vs. the old 32 x 24 tiles
TW, TH = 32 * K, 24 * K
T = TW
nrng = np.random.default_rng(7)


def arr_img(a):
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), "RGBA")


def base(col, jitter=6, seed=None):
    r = np.random.default_rng(seed) if seed is not None else nrng
    a = np.zeros((TH, TW, 4))
    a[..., :3] = np.array(col, float) + r.normal(0, jitter, (TH, TW, 1))
    a[..., 3] = 255
    return a


def blob_noise(seed=0, octaves=4, fmax=3):
    """Tileable low-frequency noise in 0..1."""
    r = np.random.default_rng(seed)
    y, x = np.mgrid[0:TH, 0:TW]
    y = y / TH * 2 * np.pi
    x = x / TW * 2 * np.pi
    n = np.zeros((TH, TW))
    for _ in range(octaves):
        fx, fy = r.integers(1, fmax, 2)
        n += np.sin(fx * x + r.uniform(0, 6)) * np.sin(fy * y + r.uniform(0, 6))
    return (n - n.min()) / (n.max() - n.min() + 1e-9)


def blades(a, r, n, root, tip, hmin=3, hmax=6, shadow=0.82):
    """Short painted grass blades (tileable): dark root, bright tip, a one-texel
    contact shadow at the base - reads as 3D turf at 1:1 pixels."""
    root, tip = np.array(root, float), np.array(tip, float)
    for _ in range(n):
        x, y = int(r.integers(0, TW)), int(r.integers(0, TH))
        h = int(r.integers(hmin, hmax + 1))
        lean = r.choice((-1, 0, 0, 1))
        a[y % TH, (x + 1) % TW, :3] *= shadow
        for k in range(h):
            t = k / max(1, h - 1)
            xx = (x + (lean if k >= h // 2 else 0)) % TW
            a[(y - k) % TH, xx, :3] = root * (1 - t) + tip * t


def t_grass(seed=1):
    a = base(GRASS, 3, seed)
    a[..., :3] *= (0.9 + 0.16 * blob_noise(seed)[..., None])
    r = np.random.default_rng(seed)
    blades(a, r, 150, (86, 164, 76), (166, 226, 132))
    blades(a, r, 40, (76, 150, 70), (190, 238, 150), 4, 7)
    return arr_img(a)


def t_grass2():
    return t_grass(seed=5)


def t_tall():
    """Ground under the 3D tall-grass blades: dark, dense, shadowed turf."""
    a = base((30, 90, 44), 3, 2)
    a[..., :3] *= (0.84 + 0.2 * blob_noise(2)[..., None])
    r = np.random.default_rng(2)
    blades(a, r, 180, (16, 60, 30), (56, 128, 60), 3, 6, 0.72)
    return arr_img(a)


def t_road(dash=None):
    a = base(ROAD, 4, 3)
    a[..., :3] *= (0.95 + 0.08 * blob_noise(3, fmax=4)[..., None])
    r = np.random.default_rng(3)
    for _ in range(90):                          # aggregate
        x, y = r.integers(0, TW), r.integers(0, TH)
        a[y, x, :3] = ROAD_L if r.random() > 0.5 else ROAD_D
    for _ in range(3):                           # hairline cracks
        x, y = int(r.integers(0, TW)), int(r.integers(0, TH))
        for k in range(int(r.integers(5, 12))):
            a[y % TH, x % TW, :3] *= 0.8
            x += int(r.integers(0, 2)); y += int(r.choice((-1, 0, 1)))
    if dash == 'v':
        a[6:42, 30:34, :3] = LINE
        a[6:42, 34, :3] = np.array(LINE) * 0.8
        a[41, 30:34, :3] = np.array(LINE) * 0.85
    elif dash == 'h':
        a[22:26, 8:56, :3] = LINE
        a[26, 8:56, :3] = np.array(LINE) * 0.78
    return arr_img(a)


def t_road_dash_v():
    return t_road('v')


def t_road_dash_h():
    return t_road('h')


def slabs(col, hi, lo, cells, seed, bevel=1):
    a = base(col, 3, seed)
    r = np.random.default_rng(seed)
    for (x0, y0, w, h) in cells:
        tint = r.normal(0, 6)
        for y in range(y0, y0 + h):
            for x in range(x0, x0 + w):
                xx, yy = x % TW, y % TH
                a[yy, xx, :3] += tint
                if y - y0 < bevel or x - x0 < bevel:
                    a[yy, xx, :3] = hi
                elif y0 + h - 1 - y < bevel + 1 or x0 + w - 1 - x < bevel:
                    a[yy, xx, :3] = lo
        # a few specks per slab
        for _ in range(max(1, w * h // 60)):
            sx, sy = x0 + int(r.integers(2, max(3, w - 2))), y0 + int(r.integers(2, max(3, h - 2)))
            a[sy % TH, sx % TW, :3] *= 0.9
    return a


def t_walk():
    cells = ((0, 0, 32, 24), (32, 0, 32, 24), (-16, 24, 32, 24), (16, 24, 32, 24), (48, 24, 32, 24))
    return arr_img(slabs(WALK, (238, 230, 212), WALK_D, cells, 4))


def t_plaza():
    """Cobbled plaza (small stones)."""
    cells = [(x + (8 if (y // 12) % 2 else 0), y, 16, 12) for y in range(0, TH, 12) for x in range(-16, TW, 16)]
    return arr_img(slabs((206, 196, 182), (230, 222, 208), (156, 146, 134), cells, 6))


def t_flowers():
    im = np.asarray(t_grass(seed=9)).astype(float)
    r = np.random.default_rng(12)
    for (x, y) in ((12, 12), (44, 10), (26, 30), (52, 36), (8, 40), (36, 20)):
        petal = np.array([(248, 96, 112), (255, 240, 120), (255, 255, 255), (255, 140, 190), (160, 150, 255)][r.integers(0, 5)], float)
        im[y + 2, x - 2:x + 4, :3] *= 0.75                                   # little shadow
        for dx, dy in ((0, -2), (-2, 0), (2, 0), (0, 2), (-1, -1), (1, -1), (-1, 1), (1, 1), (0, -1), (-1, 0), (1, 0), (0, 1)):
            shade = 1.08 if dy < 0 else (0.86 if dy > 0 else 1.0)
            im[y + dy, x + dx, :3] = np.clip(petal * shade, 0, 255)
        im[y, x, :3] = (255, 208, 80)
        im[y + 3:y + 5, x, :3] = (70, 140, 60)                               # stem
    return arr_img(im)


def t_under():
    """Grass under a 3D hedge/fence segment (the prop draws on top)."""
    a = np.asarray(t_grass(seed=4)).astype(float)
    a[..., :3] *= 0.86
    return arr_img(a)


def t_water(phase=0):
    a = base((58, 132, 214), 2, 8)
    y, x = np.mgrid[0:TH, 0:TW]
    wave = np.sin((x / TW) * 2 * np.pi * 2 + (y / TH) * 2 * np.pi * 2 + phase * np.pi) * 0.5 + 0.5
    wave2 = np.sin((x / TW) * 2 * np.pi * 3 - (y / TH) * 2 * np.pi + phase * np.pi * 0.5) * 0.5 + 0.5
    a[..., :3] *= (0.88 + 0.1 * wave[..., None] + 0.06 * wave2[..., None])
    r = np.random.default_rng(20 + phase)
    for _ in range(9):                       # glints: short bright dashes
        sx, sy = r.integers(2, TW - 8), r.integers(2, TH - 2)
        L = int(r.integers(3, 7))
        a[sy, sx:sx + L, :3] = (220, 240, 255)
        a[sy + 1, sx + 1:sx + L - 1, :3] = (150, 200, 245)
    return arr_img(a)


def t_water2():
    return t_water(1)


def t_sand():
    a = base((226, 206, 152), 4, 11)
    a[..., :3] *= (0.94 + 0.09 * blob_noise(11)[..., None])
    r = np.random.default_rng(11)
    for _ in range(60):
        x, y = r.integers(0, TW), r.integers(0, TH)
        a[y, x, :3] = (200, 178, 128) if r.random() < 0.6 else (244, 230, 188)
    return arr_img(a)


def t_bridge():
    """Wooden planks over water (walkable), boards run across."""
    a = base((168, 124, 80), 3, 13)
    for x in range(0, TW, 16):
        a[:, x, :3] = (100, 68, 40)
        a[:, x + 1, :3] = (196, 152, 106)
    r = np.random.default_rng(13)
    for x in range(0, TW, 16):
        for _ in range(4):                                   # grain
            gy, gx = int(r.integers(0, TH - 8)), x + int(r.integers(3, 14))
            a[gy:gy + int(r.integers(4, 10)), gx, :3] *= 0.88
    for y in (10, 34):
        for x in (6, 22, 38, 54):
            a[y, x:x + 2, :3] = (70, 52, 38)
    return arr_img(a)


def t_dirt():
    a = base((186, 150, 104), 4, 15)
    a[..., :3] *= (0.93 + 0.1 * blob_noise(15)[..., None])
    r = np.random.default_rng(15)
    for _ in range(40):
        x, y = r.integers(0, TW - 2), r.integers(0, TH)
        a[y, x:x + 2, :3] = (150, 118, 82) if r.random() < 0.7 else (212, 180, 136)
    return arr_img(a)


# ----------------------------------------------------- Elite Hall interior ----

GOLD = np.array((236, 188, 72), float)


def t_hall_floor():
    """Polished marble in large checker slabs with a soft sheen."""
    a = np.zeros((TH, TW, 4)); a[..., 3] = 255
    y, x = np.mgrid[0:TH, 0:TW]
    check = ((x // 32) + (y // 24)) % 2
    a[..., :3] = np.where(check[..., None] == 0, (234, 230, 242), (206, 200, 222))
    a[..., :3] *= (0.96 + 0.06 * blob_noise(31)[..., None])
    veins = np.random.default_rng(31)
    for _ in range(5):
        vx, vy = int(veins.integers(0, TW)), int(veins.integers(0, TH))
        for k in range(int(veins.integers(6, 16))):
            a[vy % TH, vx % TW, :3] *= 0.9
            vx += 1; vy += int(veins.choice((-1, 0, 1)))
    a[(y % 24) == 0, :3] *= 0.86
    a[(x % 32) == 0, :3] *= 0.86
    sheen = ((x - y * 1.3) % 64 < 5)
    a[sheen, :3] = np.minimum(255, a[sheen, :3] * 1.06)
    return arr_img(a)


def _carpet(left=False, right=False):
    a = base((168, 34, 58), 3, 32)
    a[..., :3] *= (0.94 + 0.08 * blob_noise(32)[..., None])
    y, x = np.mgrid[0:TH, 0:TW]
    a[(y % 12) == 0, :3] *= 0.9                     # woven rows
    if left:
        a[:, 0:4, :3] = GOLD * 0.8
        a[:, 4:6, :3] = GOLD
        a[:, 8:9, :3] = GOLD * 0.9
    if right:
        a[:, TW - 4:TW, :3] = GOLD * 0.8
        a[:, TW - 6:TW - 4, :3] = GOLD
        a[:, TW - 9:TW - 8, :3] = GOLD * 0.9
    return arr_img(a)


def t_carpet_l():
    return _carpet(left=True)


def t_carpet_m():
    return _carpet()


def t_carpet_r():
    return _carpet(right=True)


def t_dais():
    """Raised gold-trimmed platform where Cooker stands."""
    a = base((222, 214, 236), 2, 33)
    y, x = np.mgrid[0:TH, 0:TW]
    a[((x + y) % 16) < 1, :3] *= 0.94
    return arr_img(a)


def t_dais_edge():
    """Front edge of the dais: its gold lip and riser, seen from the camera."""
    a = np.asarray(t_dais()).astype(float)
    a[TH - 18:TH - 14, :, :3] = GOLD
    a[TH - 14:TH, :, :3] = (150, 132, 186)
    a[TH - 14:TH - 12, :, :3] = (120, 104, 156)
    return arr_img(a)


def t_hall_wall():
    """The back wall's face: violet stone panels, gold trim, dark wainscot."""
    a = base((70, 44, 118), 3, 34)
    y, x = np.mgrid[0:TH, 0:TW]
    a[(x % 32) < 2, :3] = (52, 30, 90)
    a[(y % 24) < 1, :3] *= 0.85
    a[TH - 10:, :, :3] = (40, 24, 70)
    a[TH - 12:TH - 10, :, :3] = GOLD
    a[4:6, :, :3] = GOLD * 0.85
    return arr_img(a)


def t_hall_top():
    """Top of the walls (seen from above): dark with a gold coping."""
    a = base((34, 22, 58), 2, 35)
    a[TH - 5:TH - 2, :, :3] = GOLD
    return arr_img(a)


def t_hall_side_l():
    a = base((34, 22, 58), 2, 36)
    a[:, TW - 6:TW - 3, :3] = GOLD
    return arr_img(a)


def t_hall_side_r():
    a = base((34, 22, 58), 2, 37)
    a[:, 3:6, :3] = GOLD
    return arr_img(a)


def t_hall_bottom():
    a = base((34, 22, 58), 2, 38)
    a[3:6, :, :3] = GOLD
    return arr_img(a)


def t_hall_mat():
    """The way out: a gold-edged mat in the doorway."""
    a = base((64, 40, 104), 2, 39)
    a[3:6, :, :3] = GOLD
    a[:, :4, :3] = GOLD * 0.8
    a[:, TW - 4:, :3] = GOLD * 0.8
    y, x = np.mgrid[0:TH, 0:TW]
    a[(np.abs(x - TW / 2) < 10) & (y > 16) & (y < 40), :3] = (46, 242, 168)   # exit arrow block
    return arr_img(a)


def t_void():
    return arr_img(np.dstack([np.zeros((TH, TW, 3)) + (8, 8, 16), np.full((TH, TW), 255)]))


def _legacy(col, lines=()):
    def f():
        im = new(TW, TH, col + (255,))
        d = ImageDraw.Draw(im)
        for ln, lc in lines:
            d.line(ln, fill=lc)
        return im
    return f


t_marble = _legacy((236, 232, 244), [([(0, 0), (TW - 1, 0)], (212, 206, 228))])
t_carpet = _legacy((176, 36, 60), [([(2, 0), (2, TH)], (236, 188, 72)), ([(TW - 3, 0), (TW - 3, TH)], (236, 188, 72))])
t_wall = _legacy((64, 48, 104), [([(0, TH - 6), (TW, TH - 6)], (236, 188, 72))])
t_floor_wood = _legacy((196, 150, 100), [([(0, 5), (TW, 5)], (170, 124, 80)), ([(0, 17), (TW, 17)], (170, 124, 80))])
t_fence_h = t_under
t_hedge = t_under


TILES = [
    ("grass", t_grass, True, False),
    ("grass2", t_grass2, True, False),
    ("tall", t_tall, True, True),
    ("road", t_road, True, False),
    ("road_v", t_road_dash_v, True, False),
    ("road_h", t_road_dash_h, True, False),
    ("walk", t_walk, True, False),
    ("flowers", t_flowers, True, False),
    ("fence", t_fence_h, False, False),      # grass under a 3D fence_seg prop
    ("hedge", t_hedge, False, False),        # grass under a 3D hedge_seg prop
    ("marble", t_marble, True, False),
    ("carpet", t_carpet, True, False),
    ("wall", t_wall, False, False),
    ("wood", t_floor_wood, True, False),
    ("water", t_water, False, False),
    ("water2", t_water2, False, False),       # animation frame (swapped at runtime)
    ("sand", t_sand, True, False),
    ("bridge", t_bridge, True, False),
    ("dirt", t_dirt, True, False),
    ("plaza", t_plaza, True, False),
    ("hall_floor", t_hall_floor, True, False),
    ("carpet_l", t_carpet_l, True, False),
    ("carpet_m", t_carpet_m, True, False),
    ("carpet_r", t_carpet_r, True, False),
    ("dais", t_dais, True, False),
    ("dais_edge", t_dais_edge, True, False),
    ("hall_wall", t_hall_wall, False, False),
    ("hall_top", t_hall_top, False, False),
    ("hall_side_l", t_hall_side_l, False, False),
    ("hall_side_r", t_hall_side_r, False, False),
    ("hall_bottom", t_hall_bottom, False, False),
    ("hall_mat", t_hall_mat, True, False),
    ("void", t_void, False, False),
]

# --------------------------------------------------------------- props -----

def pedestal():
    im = new(32, 28)
    d = ImageDraw.Draw(im)
    d.ellipse([2, 20, 30, 27], fill=(0, 0, 0, 60))
    d.rectangle([4, 8, 27, 23], fill=(236, 226, 206), outline=OUTLINE)
    d.rectangle([2, 4, 29, 9], fill=(236, 188, 72), outline=OUTLINE)
    d.rectangle([2, 22, 29, 25], fill=(236, 188, 72), outline=OUTLINE)
    return im


def grass_overlay():
    """Front row of tall-grass blades drawn over the player's feet (32 x 14)."""
    im = np.zeros((14, 32, 4))
    for x0 in range(-3, 36, 7):
        for dy in range(12):
            y = 13 - dy
            half = max(0, int(3.2 - dy * 0.3))
            for x in range(x0 - half, x0 + half + 1):
                if 0 <= x < 32:
                    t = dy / 12
                    col = np.array([40 + 72 * t, 118 + 88 * t, 54 + 52 * t])
                    if x == x0 - half:
                        col = col * 0.7
                    im[y, x, :3] = col
                    im[y, x, 3] = 255
        if 0 <= x0 < 32:
            im[1, x0, :] = (206, 246, 160, 255)
    return Image.fromarray(im.astype(np.uint8), "RGBA")


def main():
    os.makedirs(OUT, exist_ok=True)
    sheet = new(TW * len(TILES), TH)
    meta = {"tileWidth": TW, "tileHeight": TH, "tiles": {}}
    for i, (name, fn, walkable, encounter) in enumerate(TILES):
        sheet.alpha_composite(fn(), (i * TW, 0))
        meta["tiles"][name] = {"index": i, "walkable": walkable, "encounter": encounter}
    sheet.save(os.path.join(OUT, "tileset.png"))

    # 3D-rendered props (tools/props3d.py) carry an anchor: the pixel of the
    # footprint's bottom-left ground corner. 2D props anchor at their bottom-left.
    meta["props"] = {}
    for k, (arr, (ax, ay)) in props3d.build_all().items():
        im = Image.fromarray(arr, "RGBA")
        im.save(os.path.join(OUT, f"{k}.png"))
        meta["props"][k] = {"w": im.width, "h": im.height, "ax": ax, "ay": ay, "lights": props3d.LIGHTS.get(k, [])}
    # battle platforms (anchor = centre of the top face)
    for k, (arr, (ax, ay)) in props3d.build_battle().items():
        im = Image.fromarray(arr, "RGBA")
        im.save(os.path.join(OUT, f"{k}.png"))
        meta["props"][k] = {"w": im.width, "h": im.height, "ax": ax, "ay": ay}
    for k, im in {"pedestal": pedestal()}.items():
        im.save(os.path.join(OUT, f"{k}.png"))
        meta["props"][k] = {"w": im.width, "h": im.height, "ax": 0, "ay": im.height}
    for path in (os.path.join(OUT, "tiles.json"), os.path.join(ROOT, "src", "data", "tiles.json")):
        with open(path, "w") as f:
            json.dump(meta, f, indent=2)
    print("tiles:", len(TILES), "props:", len(meta["props"]))


if __name__ == "__main__":
    main()
