"""
Export the game's overworld prop models (tools/props3d.py) as real 3D meshes
for the title-screen drone flight.

props3d builds every prop from triangles + ellipsoids with procedural surface
shaders, then tools/iso3d.py renders a sprite. Here Model.render is swapped
for a capture, and each surface is subdivided into small triangles whose
colour is the shader sampled at the triangle's centre - the same shingles,
bricks, windows and foliage, baked into chunky retro-3D faces.

Output (drone/assets/props/): <name>.bin = per triangle 9 x float32 position
(world units, 16 per tile; x east, y south, z up) + 3 x uint8 colour + uint8
emissive flag; index.json lists counts and bounds.

    python3 drone/export_props.py
"""
import json
import os
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', '..', 'tools'))
import iso3d as I          # noqa: E402
import props3d as P        # noqa: E402

SUB = 2.0                  # max edge length of a baked face, in world units (16 per tile)
# coarser for the many small things (grass blades stay single faces)
SUB_FOR = {'tall_': 6.0, 'clump': 6.0, 'hedge_seg': 3.0, 'fence_seg': 3.0, 'tree': 2.4, 'bush': 3.0}
OUT = os.path.join(HERE, 'assets', 'props')


def subdivide(tris, max_edge):
    """Split triangles (N,3,3) at their longest edge until every edge <= max_edge.
    Returns (tris, parent index)."""
    parent = np.arange(len(tris))
    out_t, out_p = [], []
    while len(tris):
        e = np.stack([np.linalg.norm(tris[:, 1] - tris[:, 0], axis=1),
                      np.linalg.norm(tris[:, 2] - tris[:, 1], axis=1),
                      np.linalg.norm(tris[:, 0] - tris[:, 2], axis=1)], 1)
        big = e.max(1) > max_edge
        out_t.append(tris[~big]); out_p.append(parent[~big])
        tris, parent, e = tris[big], parent[big], e[big]
        if not len(tris):
            break
        k = e.argmax(1)                       # split edge k: (k, k+1)
        a = tris[np.arange(len(tris)), k]
        b = tris[np.arange(len(tris)), (k + 1) % 3]
        cc = tris[np.arange(len(tris)), (k + 2) % 3]
        m = (a + b) / 2
        t1 = np.stack([a, m, cc], 1)
        t2 = np.stack([m, b, cc], 1)
        tris = np.concatenate([t1, t2])
        parent = np.concatenate([parent, parent])
    return np.concatenate(out_t), np.concatenate(out_p)


def ellipsoid_tris(cen, rad, nl=9, nm=16):
    pts = [[cen + rad * np.array([np.cos(ph) * np.cos(th), np.cos(ph) * np.sin(th), np.sin(ph)])
            for th in np.linspace(0, 2 * np.pi, nm, endpoint=False)]
           for ph in np.linspace(-np.pi / 2, np.pi / 2, nl)]
    tris = []
    for i in range(nl - 1):
        for j in range(nm):
            a, b = pts[i][j], pts[i][(j + 1) % nm]
            cc, d = pts[i + 1][(j + 1) % nm], pts[i + 1][j]
            tris += [(a, b, cc), (a, cc, d)]
    return np.array(tris)


def bake(model, sub=SUB):
    pos, col, emit = [], [], []
    for P0, P1, P2, sh, frame, _cast in model.tris:
        t, _ = subdivide(np.array([[P0, P1, P2]]), sub)
        cen = t.mean(1)
        n = I.norm(np.cross(P1 - P0, P2 - P0))
        if n @ I.VIEW < 0:
            n = -n
        if frame is None:
            o, u, v = P0, I.norm(P1 - P0), I.norm(np.cross(n, I.norm(P1 - P0)))
        else:
            o, u, v = frame
        uv = np.stack([(cen - o) @ u, (cen - o) @ v], -1)
        rgb, em = sh(cen, uv, n)
        pos.append(t); col.append(np.asarray(rgb, float))
        emit.append(np.zeros(len(t), bool) if em is None else np.asarray(em, bool))
    for cen0, rad, sh in model.ells:
        t, _ = subdivide(ellipsoid_tris(cen0, rad), sub * 1.6)
        cen = t.mean(1)
        rgb, em = sh(cen, np.zeros((len(cen), 2)), None)
        pos.append(t); col.append(np.asarray(rgb, float))
        emit.append(np.zeros(len(t), bool) if em is None else np.asarray(em, bool))
    pos = np.concatenate(pos).astype(np.float32)
    col = np.clip(np.concatenate(col), 0, 255).astype(np.uint8)
    emit = np.concatenate(emit).astype(np.uint8)
    return pos, col, emit


def main():
    os.makedirs(OUT, exist_ok=True)
    captured = {}
    I.Model.render = lambda self, *a, **k: self          # capture instead of rasterising
    names = ['house_red', 'house_blue', 'house_green', 'house_hip', 'house_hip2', 'house_town', 'house_town2',
             'house_cabin', 'house_L', 'shop', 'windmill', 'gazebo', 'fountain', 'well', 'bench', 'rock', 'boulder',
             'stump', 'crates', 'barrel', 'flowerpot', 'hedge_seg', 'fence_seg', 'rest_house', 'hall', 'tree', 'tree2',
             'tree3', 'bush', 'car_blue', 'car_red', 'car_yellow', 'car_white', 'car_blue_v', 'car_red_v', 'lamp',
             'sign', 'banner', 'pillar', 'brazier', 'floor_emblem']
    builders = {
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
        'car_red_v': lambda: P.car('#d8464e', vertical=True), 'lamp': P.lamp, 'sign': P.signpost,
        'banner': P.banner, 'pillar': P.pillar, 'brazier': P.brazier, 'floor_emblem': P.floor_emblem,
    }
    for v in range(P.GRASS_VARIANTS):
        for layer in ('back', 'front'):
            names.append(f'tall_{layer}{v}')
            builders[f'tall_{layer}{v}'] = (lambda v=v, layer=layer: P.tall_grass(v, layer, 1))
    for v in range(3):
        names.append(f'clump{v}')
        builders[f'clump{v}'] = (lambda v=v: P.grass_clump(v))
    index = {}
    for name in names:
        m = builders[name]()
        if not isinstance(m, I.Model):
            print('skip (not a model):', name)
            continue
        sub = next((v for k, v in SUB_FOR.items() if name.startswith(k)), SUB)
        pos, col, emit = bake(m, sub)
        buf = pos.reshape(-1, 9).tobytes() + col.tobytes() + emit.tobytes()
        with open(os.path.join(OUT, f'{name}.bin'), 'wb') as f:
            f.write(buf)
        lo, hi = pos.reshape(-1, 3).min(0), pos.reshape(-1, 3).max(0)
        index[name] = {'tris': int(len(col)), 'min': lo.round(2).tolist(), 'max': hi.round(2).tolist(), 'lights': int(emit.sum())}
        print(f'{name:14s} {len(col):7d} tris  {lo.round(1)} .. {hi.round(1)}  emissive {int(emit.sum())}')
    with open(os.path.join(OUT, 'index.json'), 'w') as f:
        json.dump(index, f, indent=1)


if __name__ == '__main__':
    main()
