"""
Export the game's overworld prop models (tools/props3d.py) as textured 3D
meshes for the title-screen drone flight.

props3d builds every prop from triangles + ellipsoids with procedural surface
shaders (shingles, bricks, siding, windows, foliage...), then tools/iso3d.py
rasterises a sprite. Here Model.render is swapped for a capture, and every
surface is baked into a texture atlas at the sprites' own density (RES texels
per world unit), so the 3D models carry exactly the detail of the game art.

Output (drone/assets/props/):
  <name>.bin  per vertex: 3 x float32 position (world units, 16 per tile;
              x east, y south, z up) + 2 x float32 uv
  <name>.png  the atlas; alpha 255 = lit surface, 128 = emissive (windows,
              lamps: they glow at night)
  index.json  vertex counts, atlas sizes, bounds

    python3 drone/export_props.py
"""
import json
import os
import sys

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', '..', 'tools'))
import iso3d as I          # noqa: E402
import props3d as P        # noqa: E402

RES = 4                    # texels per world unit (= the game sprites' density)
PAD = 2                    # texels of bleed around every face (seams, mipmaps)
OUT = os.path.join(HERE, 'assets', 'props')


def ellipsoid_tris(cen, rad, nl=12, nm=20):
    pts = [[cen + rad * np.array([np.cos(ph) * np.cos(th), np.cos(ph) * np.sin(th), np.sin(ph)])
            for th in np.linspace(0, 2 * np.pi, nm, endpoint=False)]
           for ph in np.linspace(-np.pi / 2, np.pi / 2, nl)]
    tris = []
    for i in range(nl - 1):
        for j in range(nm):
            a, b = pts[i][j], pts[i][(j + 1) % nm]
            cc, d = pts[i + 1][(j + 1) % nm], pts[i + 1][j]
            if i > 0:
                tris.append((a, b, cc))
            if i < nl - 2:
                tris.append((a, cc, d))
    return tris


def faces(model):
    """Every surface triangle with the frame its shader expects: (P0,P1,P2, sh, o,u,v, n)."""
    out = []
    for P0, P1, P2, sh, frame, _cast in model.tris:
        n = I.norm(np.cross(P1 - P0, P2 - P0))
        if not np.isfinite(n).all():
            continue
        if n @ I.VIEW < 0:
            n = -n
        if frame is None:
            o, u, v = P0, I.norm(P1 - P0), I.norm(np.cross(n, I.norm(P1 - P0)))
        else:
            o, u, v = frame
        out.append((P0, P1, P2, sh, o, u, v, n, False))
    for cen, rad, sh in model.ells:
        for a, b, cc in ellipsoid_tris(cen, rad):
            a, b, cc = (np.asarray(p, float) for p in (a, b, cc))
            n = I.norm(np.cross(b - a, cc - a))
            if not np.isfinite(n).all():
                continue
            u = I.norm(b - a)
            out.append((a, b, cc, sh, a, u, I.norm(np.cross(n, u)), n, True))
    return out


def bake(model):
    fs = faces(model)
    # face-local coordinates: projections onto (u, v), as the shaders see them
    rects = []
    for P0, P1, P2, sh, o, u, v, n, ell in fs:
        uv = np.array([[(p - o) @ u, (p - o) @ v] for p in (P0, P1, P2)])
        lo = uv.min(0)
        size = np.ceil((uv.max(0) - lo) * RES).astype(int) + 2 * PAD + 1
        rects.append((uv, lo, size))
    # shelf packing, tallest first, into a square-ish atlas
    area = sum(int(r[2][0]) * int(r[2][1]) for r in rects)
    widest = max(int(r[2][0]) for r in rects)
    W = int(min(4096, max(64, widest, 2 ** np.ceil(np.log2(np.sqrt(area) * 1.25)))))
    order = sorted(range(len(fs)), key=lambda i: -rects[i][2][1])
    place = [None] * len(fs)
    x = y = shelf_h = 0
    for i in order:
        w, h = rects[i][2]
        if x + w > W:
            x, y, shelf_h = 0, y + shelf_h, 0
        place[i] = (x, y)
        x += w
        shelf_h = max(shelf_h, h)
    H = y + shelf_h
    H = int(2 ** np.ceil(np.log2(max(H, 4))))
    rgba = np.zeros((H, W, 4), np.uint8)
    pos, uvs = [], []
    for i, (P0, P1, P2, sh, o, u, v, n, ell) in enumerate(fs):
        uv, lo, (w, h) = rects[i]
        ox, oy = place[i]
        # texel centres -> face coordinates -> points on the face's plane
        gx, gy = np.meshgrid(np.arange(w), np.arange(h))
        fu = lo[0] + (gx.ravel() + 0.5 - PAD) / RES
        fv = lo[1] + (gy.ravel() + 0.5 - PAD) / RES
        uvn = u @ v
        det = 1 - uvn * uvn
        if abs(det) < 1e-6:
            a, b = fu, fv * 0
        else:
            a = (fu - uvn * fv) / det
            b = (fv - uvn * fu) / det
        Pt = o + a[:, None] * u + b[:, None] * v
        col, em = sh(Pt, np.stack([fu, fv], -1), None if ell else n)
        col = np.clip(np.asarray(col, float), 0, 255).astype(np.uint8)
        em = np.zeros(len(Pt), bool) if em is None else np.asarray(em, bool)
        block = np.zeros((h, w, 4), np.uint8)
        block[..., :3] = col.reshape(h, w, 3)
        block[..., 3] = np.where(em, 128, 255).reshape(h, w)
        rgba[oy:oy + h, ox:ox + w] = block
        for p, (pu, pv) in zip((P0, P1, P2), uv):
            tx = ox + PAD + (pu - lo[0]) * RES
            ty = oy + PAD + (pv - lo[1]) * RES
            pos.append(p)
            uvs.append((tx / W, 1 - ty / H))          # (textures load flipped: v = 1 at the top row)
    return np.array(pos, np.float32), np.array(uvs, np.float32), Image.fromarray(rgba, 'RGBA')


def builders():
    b = {
        'house_red': lambda: P.house('#d9534a', variant=0, shutter='#3f6fb0'),
        'house_blue': lambda: P.house('#4a7fd4', variant=1, wall='#f6f0de', shutter='#2f8a5a'),
        'house_green': lambda: P.house('#4ea85a', variant=2, wall='#efe6cc', trim='#7a4e32'),
        'house_hip': lambda: P.house_hip(),
        'house_hip2': lambda: P.house_hip(roof='#8a5ac8', wall='#f4e8f0', shutter='#5a3a8a'),
        'house_town': lambda: P.house_town(),
        'house_town2': lambda: P.house_town(brick='#7a6a8a', trim='#f4efe4'),
        'house_cabin': P.house_cabin, 'house_L': P.house_L, 'shop': P.shop, 'windmill': P.windmill,
        'gazebo': P.gazebo, 'fountain': P.fountain, 'well': P.well, 'bench': P.bench, 'rock': P.rock,
        'boulder': P.boulder, 'stump': P.stump, 'crates': P.crates, 'barrel': P.barrel, 'flowerpot': P.flowerpot,
        'hedge_seg': P.hedge_seg, 'fence_seg': P.fence_seg, 'rest_house': P.rest_house, 'hall': P.elite_hall,
        'tree': lambda: P.tree(0), 'tree2': lambda: P.tree(1), 'tree3': lambda: P.tree(2), 'bush': P.bush_prop,
        'car_blue': lambda: P.car('#3f78d8'), 'car_red': lambda: P.car('#d8464e'), 'car_yellow': lambda: P.car('#eec23c'),
        'car_white': lambda: P.car('#e8e8ee'), 'car_blue_v': lambda: P.car('#3f78d8', vertical=True),
        'car_red_v': lambda: P.car('#d8464e', vertical=True), 'lamp': P.lamp, 'sign': P.signpost, 'banner': P.banner,
    }
    for v in range(P.GRASS_VARIANTS):
        for layer in ('back', 'front'):
            b[f'tall_{layer}{v}'] = (lambda v=v, layer=layer: P.tall_grass(v, layer, 1))
    for v in range(3):
        b[f'clump{v}'] = (lambda v=v: P.grass_clump(v))
    return b


def main():
    os.makedirs(OUT, exist_ok=True)
    for f in os.listdir(OUT):
        os.remove(os.path.join(OUT, f))
    I.Model.render = lambda self, *a, **k: self          # capture instead of rasterising
    index = {}
    only = set(sys.argv[1:])
    for name, fn in builders().items():
        if only and name not in only:
            continue
        m = fn()
        pos, uv, img = bake(m)
        with open(os.path.join(OUT, f'{name}.bin'), 'wb') as f:
            f.write(np.concatenate([pos, uv], 1).astype(np.float32).tobytes())
        img.save(os.path.join(OUT, f'{name}.png'), optimize=True)
        lo, hi = pos.min(0), pos.max(0)
        index[name] = {'verts': int(len(pos)), 'atlas': list(img.size), 'min': lo.round(2).tolist(), 'max': hi.round(2).tolist()}
        print(f'{name:14s} {len(pos) // 3:6d} tris  atlas {img.size[0]}x{img.size[1]}')
    with open(os.path.join(OUT, 'index.json'), 'w') as f:
        json.dump(index, f, indent=1)


if __name__ == '__main__':
    main()
