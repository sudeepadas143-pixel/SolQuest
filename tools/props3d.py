"""
3D models for the overworld props, rendered with tools/iso3d.py in the
DS-era oblique camera. Every builder returns (rgba_array, (ax, ay)) where
(ax, ay) is the pixel of the footprint's bottom-left ground corner - the game
places the sprite by that anchor.

Footprints (tiles) must match PROP_FOOTPRINTS in src/data/map.js.
"""
import numpy as np

import iso3d as I
from iso3d import Model, c

T = 16

# ------------------------------------------------------------- tiny font ----
GLYPHS = {
    'A': ['010', '101', '111', '101', '101'], 'B': ['110', '101', '110', '101', '110'],
    'C': ['011', '100', '100', '100', '011'], 'D': ['110', '101', '101', '101', '110'],
    'E': ['111', '100', '110', '100', '111'], 'F': ['111', '100', '110', '100', '100'],
    'G': ['011', '100', '101', '101', '011'], 'H': ['101', '101', '111', '101', '101'],
    'I': ['111', '010', '010', '010', '111'], 'J': ['001', '001', '001', '101', '010'],
    'K': ['101', '101', '110', '101', '101'], 'L': ['100', '100', '100', '100', '111'],
    'M': ['101', '111', '111', '101', '101'], 'N': ['110', '101', '101', '101', '101'],
    'O': ['010', '101', '101', '101', '010'], 'P': ['110', '101', '110', '100', '100'],
    'Q': ['010', '101', '101', '110', '011'], 'R': ['110', '101', '110', '101', '101'],
    'S': ['011', '100', '010', '001', '110'], 'T': ['111', '010', '010', '010', '010'],
    'U': ['101', '101', '101', '101', '111'], 'V': ['101', '101', '101', '101', '010'],
    'W': ['101', '101', '111', '111', '101'], 'X': ['101', '101', '010', '101', '101'],
    'Y': ['101', '101', '010', '010', '010'], 'Z': ['111', '001', '010', '100', '111'],
    ' ': ['000', '000', '000', '000', '000'],
}


def pixel_text(txt, scale=1):
    rows = []
    for r in range(5):
        line = []
        for ch in txt:
            line += [int(b) for b in GLYPHS[ch][r]] + [0]
        rows.append(line[:-1])
    m = np.array(rows, bool)
    return np.kron(m, np.ones((scale, scale), bool))


def text_on(txt, fg, bg, border=None, scale=1):
    mask = pixel_text(txt, scale)
    fgc, bgc = c(fg), c(bg)
    bc = c(border) if border else None

    def fn(u, v, w, h):
        mh, mw = mask.shape
        ox = int((w - mw) // 2)
        oy = int((h - mh) // 2)
        iu = np.floor(u).astype(int) - ox
        iv = (int(h) - 1 - np.floor(v).astype(int)) - oy
        ins = (iu >= 0) & (iu < mw) & (iv >= 0) & (iv < mh)
        on = np.zeros(len(u), bool)
        on[ins] = mask[iv[ins], iu[ins]]
        rgb = np.where(on[:, None], fgc, bgc)
        if bc is not None:
            b = (u < I.LW) | (u >= w - I.LW) | (v < I.LW) | (v >= h - I.LW)
            rgb = np.where(b[:, None], bc, rgb)
        return rgb, np.ones(len(u)), None
    return fn


def flowers_shader(seed=4):
    petals = [c('#f0506a'), c('#ffd84a'), c('#ffffff'), c('#ff8ac0')]
    leaf = c('#3f9a4e')

    def sh(P, uv, n):
        h = I.hash3(np.floor(P[:, 0]), np.floor(P[:, 1]), np.floor(P[:, 2]), seed)
        out = np.tile(leaf, (len(P), 1)) * (0.85 + 0.3 * h[:, None])
        k = (h * 13).astype(int) % 4
        petal = h > 0.62
        pc = np.stack([petals[i] for i in k])
        return np.where(petal[:, None], pc, out), None
    return sh


# ----------------------------------------------------------------- helpers --

def darker(col, k=0.7):
    return '#' + ''.join(f'{int(v * k):02x}' for v in c(col))


def bush(m, cx, cy, r=4.0, col='#3f9d4f', seed=21):
    leaf = I.foliage(col, seed=seed, scale=1.6)
    m.ellipsoid((cx, cy, r * 0.7), (r, r * 0.8, r * 0.75), leaf)
    m.ellipsoid((cx - r * 0.55, cy + 0.3, r * 0.5), (r * 0.6, r * 0.55, r * 0.55), leaf)
    m.ellipsoid((cx + r * 0.55, cy + 0.3, r * 0.5), (r * 0.6, r * 0.55, r * 0.55), leaf)


def window_unit(m, a, b, z0, z1, y1, trim, shutter=None):
    """Sill + optional shutters around a window decal already painted on the wall."""
    m.box(a - 1, y1, z0 - 1.2, b + 1, y1 + 1.6, z0, I.flat('#fbf6ea'))
    m.box(a - 0.6, y1, z1, b + 0.6, y1 + 1.0, z1 + 1.0, I.flat('#fbf6ea'))
    if shutter:
        sh = I.decal(I.flat(shutter), [((0.6, 1, 2.4, z1 - z0 - 1), I.rect_decal(darker(shutter, 0.8)))])
        m.box(a - 4, y1, z0, a - 1, y1 + 0.8, z1, I.flat(shutter), south=sh)
        m.box(b + 1, y1, z0, b + 4, y1 + 0.8, z1, I.flat(shutter), south=sh)


# ----------------------------------------------------------------- houses ---

def house(roof='#d9534a', wall='#f4ead2', trim='#8a5a3a', shutter='#3f6fb0', w=5, d=4, door_col=2, variant=0):
    """Cottage: brick base course, siding, shuttered windows with sills and a
    flower box, gutters, shingled gable roof with ridge cap, chimney, a roof
    dormer (some variants), door canopy + porch lamp, mailbox and bushes."""
    m = Model()
    W, D = w * T, d * T
    x0, x1 = 5, W - 5
    y0, y1 = 22, D - 6
    zt = 36
    dx0 = door_col * T + 2
    dx1 = dx0 + 12
    win_w, win_z0, win_z1 = 13, 13, 27
    wins = [(x0 + 7, x0 + 7 + win_w), (x1 - 7 - win_w, x1 - 7)]

    stone = I.stone('#b8b2a8', size=4)
    m.box(x0 - 1, y0 - 1, 0, x1 + 1, y1 + 1, 3, stone)
    # brick base course, slightly proud of the wall
    m.box(x0 - 0.4, y0, 3, x1 + 0.4, y1 + 0.5, 9, I.bricks('#b06a52', h=2.2, w=4.5))
    wall_decals = [((dx0 - x0, -6, dx1 - x0, 13), I.door_decal())]
    for a, b in wins:
        wall_decals.append(((a - x0, win_z0 - 9, b - x0, win_z1 - 9), I.window_decal()))
    walls = I.decal(I.siding(wall, spacing=2.5), wall_decals)
    side = I.decal(I.siding(wall, spacing=2.5), [((12, win_z0 - 9, 24, win_z1 - 9), I.window_decal())])
    m.box(x0, y0, 9, x1, y1, zt, I.siding(wall, spacing=2.5), south=walls, east=side)
    # the door cuts through the brick course too
    m.box(dx0, y1 + 0.5, 3, dx1, y1 + 0.55, 9, I.flat('#9c6a44'), south=I.decal(I.flat('#9c6a44'), [((0, 0, 12, 6), I.door_decal())]), shadow=False)
    wood = I.flat(trim, jitter=5)
    for px in (x0, x1 - 2.5):
        m.box(px, y1 - 2.5, 3, px + 2.5, y1 + 0.6, zt, wood)
    m.box(x0, y1 - 1, zt - 2.5, x1, y1 + 0.6, zt, wood)
    for a, b in wins:
        window_unit(m, a, b, win_z0, win_z1, y1, trim, shutter if variant != 2 else None)
    a, b = wins[variant % 2]
    m.box(a, y1, win_z0 - 5, b, y1 + 3, win_z0 - 1.2, I.flat(trim), top=flowers_shader())
    # door: step, mat, canopy, porch lamp
    m.box(dx0 - 2, y1, 0, dx1 + 2, y1 + 4, 2, stone)
    m.box(dx0, y1 + 0.5, 2, dx1, y1 + 3.5, 2.3, I.flat('#8a3a3a'))
    canopy = I.shingles(roof, row=2, tile=3)
    m.gable_x(dx0 - 4, dx1 + 4, y1 - 1, y1 + 6, 21, 25, canopy, I.flat(wall), I.flat(darker(roof)), thick=1.2)
    m.box(dx1 + 2, y1, 15, dx1 + 4, y1 + 1.5, 18.5, I.flat('#3a3a44'), south=I.glow('#ffe89a'))
    # main roof, gutter and ridge cap
    m.gable_x(1, W - 1, 15, D - 2, zt, zt + 21, I.shingles(roof, row=4, tile=6), I.siding(wall, spacing=2.5), I.flat(darker(roof)), thick=2.2)
    m.box(1, D - 3, zt - 3.2, W - 1, D - 1.4, zt - 1.8, I.flat('#9aa0ac'))          # gutter
    ym = (15 + D - 2) / 2
    m.box(1, ym - 1.4, zt + 20, W - 1, ym + 1.4, zt + 22.5, I.shingles(darker(roof, 0.8), row=1.4, tile=4))
    # dormer on the front slope
    if variant in (1, 2):
        cx = W / 2 + (14 if variant == 1 else -14)
        slope_y = lambda z: (D - 2) - (z - zt) * ((D - 2 - ym) / 21)
        ybase = slope_y(zt + 6)
        m.box(cx - 6, ybase - 8, zt + 3, cx + 6, ybase, zt + 13, I.siding(wall, spacing=2.5),
              south=I.decal(I.siding(wall, spacing=2.5), [((2.5, 2, 9.5, 9), I.window_decal())]))
        m.gable_y(cx - 7.5, cx + 7.5, ybase - 9, ybase + 1, zt + 13, zt + 18, I.shingles(roof, row=2.5, tile=3.5),
                  I.flat(wall), I.flat(darker(roof)), thick=1)
    # chimney
    cx = W - 22 if variant % 2 == 0 else 14
    m.box(cx, 24, zt + 4, cx + 7, 30, zt + 27, I.bricks('#b0584a', h=2.2, w=4))
    m.box(cx - 1, 23, zt + 27, cx + 8, 31, zt + 29, I.flat('#5a5560'), top=I.decal(I.flat('#6a6570'), [((2.8, 2.8, 6.2, 5.2), I.rect_decal('#2a2830'))]))
    # mailbox + bushes (inside the footprint, in front of the wall)
    mbx = 2.5 if variant != 1 else W - 5
    m.box(mbx + 0.8, D - 4, 0, mbx + 1.8, D - 3, 9, I.flat('#6b4428'))
    m.box(mbx - 0.5, D - 5.5, 9, mbx + 3.2, D - 1.5, 12.5, I.flat('#c94a4a'), top=I.flat('#d85a5a'))
    bush(m, x0 + 3, y1 + 3, 3.4)
    bush(m, x1 - 3, y1 + 3, 3.4, col='#378f48', seed=23)
    return m.render((0, D, 0))


def rest_house():
    """Healing stop: white walls, teal roof with REST painted on it, glass
    sliding doors under an awning, planters and a blue-cross sign."""
    m = Model()
    W, D = 5 * T, 4 * T
    x0, x1, y0, y1, zt = 4, W - 4, 22, D - 6, 34
    teal, teal_d = '#2fb4b0', '#1c7f86'
    dx0, dx1 = 2 * T - 3, 3 * T + 3
    m.box(x0 - 1, y0 - 1, 0, x1 + 1, y1 + 1, 3, I.stone('#c9c3b8', size=4))
    decals = [((dx0 - x0, 0, dx1 - x0, 20), I.door_decal(wood='#e8f4f6', frame=teal_d, knob=teal_d, glass='#8fd8ee'))]
    for a in (x0 + 4, x1 - 19):
        decals.append(((a - x0, 10, a - x0 + 15, 24), I.window_decal(frame='#ffffff', glass='#8fd8ee')))
    decals.append(((0, 27, x1 - x0, 29.5), I.rect_decal(teal)))
    decals.append(((0, 2, x1 - x0, 3.2), I.rect_decal('#b9c2c6')))
    white = I.flat('#fbfbf6', jitter=2)
    m.box(x0, y0, 3, x1, y1, zt, white, south=I.decal(white, decals),
          east=I.decal(white, [((10, 10, 26, 24), I.window_decal(frame='#ffffff', glass='#8fd8ee'))]))
    m.box(dx0 - 5, y1, 22, dx1 + 5, y1 + 7, 24, I.decal(I.flat(teal), [((0, 0, 50, 7), stripes(teal, '#ffffff'))]), south=I.flat(teal_d))
    for px in (dx0 - 4, dx1 + 3):
        m.box(px, y1 + 5.5, 0, px + 1, y1 + 6.5, 22, I.flat('#dfe6e8'))
    m.box(dx0 - 3, y1, 0, dx1 + 3, y1 + 5, 1.5, I.flat('#dcd6cc'))
    for px in (x0 + 2, x1 - 12):
        m.box(px, y1 + 0.5, 0, px + 10, y1 + 4, 4, I.flat('#c9c3b8'), top=flowers_shader(seed=9))
    plain = I.shingles(teal, row=4, tile=6)
    roof = I.decal(plain, [((W / 2 - 27, 10, W / 2 + 27, 24), text_on('SOLACE', '#1c7f86', '#ffffff', '#1c7f86', scale=2))])
    m.gable_x(1, W - 1, 15, D - 2, zt, zt + 19, roof, I.flat('#fbfbf6'), I.flat(teal_d), thick=2.2, back_sh=plain)
    m.box(1, D - 3, zt - 3.2, W - 1, D - 1.4, zt - 1.8, I.flat('#9aa0ac'))
    ym = (15 + D - 2) / 2
    m.box(1, ym - 1.4, zt + 18, W - 1, ym + 1.4, zt + 20.5, I.flat(teal_d))
    # little lit sign on a pole at the corner
    m.box(W - 4.5, D - 4, 0, W - 3.5, D - 3, 16, I.flat('#6b6f80'))
    m.box(W - 8, D - 4.2, 16, W - 0.5, D - 2.8, 23, I.flat('#ffffff'), south=I.decal(I.glow('#f4fbff'), [((2.5, 1, 5, 6), I.rect_decal(teal, emit=True)), ((1.2, 2.3, 6.3, 4.7), I.rect_decal(teal, emit=True))]))
    return m.render((0, D, 0))


def stripes(a, b, width=3):
    ca, cb = c(a), c(b)

    def fn(u, v, w, h):
        k = (np.floor(u / width) % 2 == 0)
        return np.where(k[:, None], ca, cb), np.ones(len(u)), None
    return fn


# -------------------------------------------------------------- the hall ---

def pediment_shader(fill='#3b2468', rim='#ecbc48', width=160, height=24):
    f, r = c(fill), c(rim)
    emb = I.emblem_decal()

    def sh(P, uv, n):
        u, v = uv[:, 0], uv[:, 1]
        out = np.tile(f, (len(u), 1))
        lim = height * (1 - np.abs(u - width / 2) / (width / 2))
        border = (v < 2.2) | (v > lim - 2.4)
        out = np.where(border[:, None], r, out)
        # central emblem
        R = 8
        m = (np.abs(u - width / 2) < R) & (np.abs(v - (R + 3)) < R)
        if m.any():
            rgb, a, _ = emb(u[m] - (width / 2 - R), v[m] - 3, 2 * R, 2 * R)
            out[m] = out[m] * (1 - a[:, None]) + rgb * a[:, None]
        return out, None
    return sh


def dome_shader(col='#5b37a0', rib='#ecbc48', center=(0, 0), ribs=12):
    base, rb = c(col), c(rib)

    def sh(P, uv, n):
        ang = np.arctan2(P[:, 1] - center[1], P[:, 0] - center[0])
        k = (ang / (2 * np.pi) * ribs) % 1.0
        out = np.tile(base, (len(P), 1)) * (0.92 + 0.12 * I.hash3(np.floor(P[:, 0] / 3), np.floor(P[:, 1] / 3), np.floor(P[:, 2] / 3), 7)[:, None])
        out = np.where((k < 0.09)[:, None], rb, out)
        return out, None
    return sh


def elite_hall():
    """Cooker's arena: marble plinth and stairs, a colonnade under a pediment,
    glowing windows and a gold-ribbed dome - far grander than any house."""
    m = Model()
    W, D = 11 * T, 8 * T
    marble = I.stone('#e9e4f2', size=6)
    gold = I.flat('#ecbc48')
    zb, ztop = 5, 46
    m.box(2, 20, 0, W - 2, 112, zb, marble)
    for (yy, zz) in ((127, 1.7), (121, 3.4), (116, zb)):
        m.box(5 * T - 12, 112, 0, 6 * T + 12, yy, zz, marble)
    # statues + torches flanking the stairs
    for sx in (5 * T - 20, 6 * T + 20):
        m.box(sx - 4, 114, 0, sx + 4, 122, 8, marble, top=I.flat('#ecbc48'))
        m.ellipsoid((sx, 118, 13), (3.2, 3.2, 4.6), I.flat('#9a7cf0'))
        m.ellipsoid((sx, 118, 19.5), (2.2, 2.2, 2.2), I.flat('#ecbc48'))
    for tx in (14, W - 14):
        m.prism(tx, 116, 0, 16, 1.2, I.flat('#4a2d80'), sides=6)
        m.box(tx - 2.2, 113.8, 16, tx + 2.2, 118.2, 18, I.flat('#ecbc48'))
        m.ellipsoid((tx, 116, 21), (1.8, 1.8, 3.2), I.glow('#9dffcf'))

    decals = []
    door_u0 = 5 * T - 8
    decals.append(((door_u0 - 3, 0, door_u0 + 19, 31), I.rect_decal('#ecbc48')))
    decals.append(((door_u0, 0, door_u0 + 16, 28), glow_door()))
    for wx in (26, 54, 114, 142):
        decals.append(((wx - 8, 9, wx - 8 + 10, 34), I.window_decal(frame='#ecbc48', glass='#14f195', cross=True, lit=True)))
    decals.append(((0, 0, W - 16, 2), I.rect_decal('#ecbc48')))
    body = I.flat('#3b2468', jitter=4)
    m.box(8, 26, zb, W - 8, 94, ztop + 4, body, south=I.decal(body, decals),
          east=I.decal(body, [((10, 9, 20, 34), I.window_decal(frame='#ecbc48', glass='#14f195', lit=True)),
                              ((36, 9, 46, 34), I.window_decal(frame='#ecbc48', glass='#14f195', lit=True))]))
    # cornice + roof terrace
    m.box(6, 24, ztop + 4, W - 6, 95, ztop + 8, gold, top=I.stone('#4a2d80', size=7))
    # drum + dome
    cx, cy = W / 2, 56
    m.prism(cx, cy, ztop + 8, ztop + 20, 23, I.flat('#f4efe4', jitter=3), sides=20, top=gold)
    for i in range(10):
        a = 2 * np.pi * i / 10
        m.box(cx + 23 * np.cos(a) - 1.5, cy + 23 * np.sin(a) - 1.5, ztop + 8, cx + 23 * np.cos(a) + 1.5, cy + 23 * np.sin(a) + 1.5, ztop + 20, gold)
    m.ellipsoid((cx, cy, ztop + 20), (22, 22, 20), dome_shader(center=(cx, cy)))
    # cupola lantern on the dome
    m.prism(cx, cy, ztop + 37, ztop + 44, 4.2, I.flat('#f4efe4'), sides=10, top=gold)
    for i in range(5):
        ang = 2 * np.pi * i / 5
        m.box(cx + 4.3 * np.cos(ang) - 0.7, cy + 4.3 * np.sin(ang) - 0.7, ztop + 38, cx + 4.3 * np.cos(ang) + 0.7, cy + 4.3 * np.sin(ang) + 0.7, ztop + 43, I.glow('#b8ffe0'))
    m.prism(cx, cy, ztop + 44, ztop + 48, 1.6, gold)
    m.ellipsoid((cx, cy, ztop + 50), (3.0, 3.0, 3.0), I.flat('#14f195'))
    # balustrade around the roof terrace
    for x in np.arange(10, W - 9, 5):
        for y in (25.5, 93.5):
            m.box(x - 0.8, y - 0.8, ztop + 8, x + 0.8, y + 0.8, ztop + 11.5, I.flat('#f4efe4'))
    m.box(8, 92.6, ztop + 11.5, W - 8, 94.4, ztop + 12.8, gold)
    m.box(8, 24.6, ztop + 11.5, W - 8, 26.4, ztop + 12.8, gold)

    # colonnade
    for x in (20, 44, 68, 108, 132, 156):
        m.box(x - 5.5, 99, zb, x + 5.5, 107, zb + 2, marble)
        m.prism(x, 103, zb + 2, ztop - 2, 4.2, I.flat('#f4efe4', jitter=3))
        m.box(x - 6, 97.5, ztop - 3, x + 6, 108.5, ztop, gold)
    # entablature with the name, then the pediment over the portico
    m.box(8, 94, ztop, W - 8, 112, ztop + 12, I.flat('#f4efe4'),
          south=I.decal(I.flat('#f4efe4'), [((0, 0, W - 16, 12), text_on('ELITE HALL', '#3b2468', '#f4efe4', '#ecbc48', scale=2))]))
    zr = ztop + 12 + 22
    m.gable_y(6, W - 6, 94, 113, ztop + 12, zr, I.shingles('#4a2d80', row=4, tile=6), pediment_shader(width=W - 12, height=22), None)
    return m.render((0, D, 0))


def glow_door():
    inner, glowc = c('#1b0f33'), c('#9945ff')

    def fn(u, v, w, h):
        t = (v / h)[:, None]
        rgb = inner * (1 - t) + glowc * t * 0.9
        seam = np.abs(u - w / 2) < 0.6
        rgb = np.where(seam[:, None], c('#ecbc48'), rgb)
        return rgb, np.ones(len(u)), ~seam
    return fn


# ---------------------------------------------------------- small props ----

def tree(variant=0):
    """Three leafy variants: round oak, tall conifer-ish, and a flowering tree."""
    m = Model()
    rng = np.random.default_rng(variant + 3)
    bark = I.flat('#7a5236', jitter=8)
    if variant == 1:        # tall, layered
        m.prism(16, 24, 0, 10, 2.4, bark, sides=6)
        leaf = I.foliage('#2f7f48', seed=31, scale=1.9)
        for z, r in ((13, 11), (21, 9), (28, 7), (34, 4.5)):
            j = rng.uniform(-0.6, 0.6, 2)
            m.ellipsoid((16 + j[0], 22 + j[1], z), (r, r * 0.85, 4.8), leaf)
        return m.render((0, 32, 0))
    m.prism(16, 24, 0, 13, 2.8, bark, sides=6)
    m.prism(13.5, 23.5, 9, 15, 1.2, bark, sides=5)
    g = '#3f9d4f' if variant == 0 else '#4aa65a'
    leaf = I.foliage(g, seed=11 + variant, scale=1.9)
    blobs = [((16, 22, 21), (12.5, 10.5, 10)), ((9.5, 22, 19), (7.5, 6.5, 7)), ((22.5, 22, 19), (7.5, 6.5, 7)),
             ((16, 18, 28), (9, 8, 7.5)), ((12, 25, 16), (7, 5, 6)), ((20, 25, 16), (7, 5, 6)), ((16, 21, 31), (5, 4.5, 4))]
    for (cx, cy, cz), r in blobs:
        j = rng.uniform(-0.8, 0.8, 3)
        m.ellipsoid((cx + j[0], cy + j[1], cz + j[2]), r, leaf)
    if variant == 2:        # blossoms
        pink = I.flat('#ff9ac4')
        for (cx, cy, cz), r in blobs:          # dot blossoms onto each blob's camera-facing surface
            for _ in range(4):
                th = rng.uniform(-1.2, 1.2)
                ph = rng.uniform(0.1, 0.9)
                d = np.array([np.sin(th) * np.cos(ph), np.cos(th) * np.cos(ph) * 0.8, np.sin(ph)])
                p = np.array([cx, cy, cz]) + d * np.array(r) * 0.95
                m.ellipsoid(tuple(p), (1.2, 1.2, 1.2), pink)
    return m.render((0, 32, 0))


def _cabin(m, xa, xb, xc, xd, y0, y1, zb, zt, body, glass_col='#bfe6f6'):
    """Trapezoid cabin along x: bottom from xa..xd, top from xb..xc (windshields slope)."""
    glass = I.flat(glass_col)
    frame = darker(body, 0.72)
    side = I.decal(I.flat(body), [((xb - xa + 0.4, 0.6, (xb + xc) / 2 - xa - 0.5, zt - zb - 0.8), I.rect_decal(glass_col)),
                                  (((xb + xc) / 2 - xa + 0.5, 0.6, xc - xa - 0.4, zt - zb - 0.8), I.rect_decal(glass_col))])
    m.quad((xa, y1, zb), (xd, y1, zb), (xc, y1, zt), (xb, y1, zt), side)             # south side
    m.quad((xd, y0, zb), (xa, y0, zb), (xb, y0, zt), (xc, y0, zt), I.flat(body))    # north side
    m.quad((xb, y1, zt), (xc, y1, zt), (xc, y0, zt), (xb, y0, zt), I.flat(body))    # roof
    m.quad((xd, y1, zb), (xd, y0, zb), (xc, y0, zt), (xc, y1, zt), I.decal(glass, [((0, 0, 0.6, 99), I.rect_decal(frame))]))  # windshield
    m.quad((xa, y0, zb), (xa, y1, zb), (xb, y1, zt), (xb, y0, zt), glass)           # rear window


def car(body='#3f78d8', vertical=False):
    m = Model()
    tyre = I.flat('#26262e')
    hub = I.flat('#b8bcc8')
    trim = I.flat('#3a3a44')
    if not vertical:        # side view, nose to the east, 2x1 tiles
        for wx in (7, 24):
            m.box(wx - 3, 11.6, 0, wx + 3, 14, 5.2, tyre, south=I.decal(tyre, [((1.8, 1.6, 4.2, 3.6), I.rect_decal('#b8bcc8'))]))
        m.box(1.8, 3, 2.2, 30.2, 13, 7.5, I.flat(body, jitter=2), top=I.flat(body),
              south=I.decal(I.flat(body), [((0, 2.2, 28.4, 2.8), I.rect_decal(darker(body, 0.8))), ((13.5, 3, 14, 5.3), I.rect_decal(darker(body, 0.7)))]))
        m.box(1.2, 3.3, 2, 2, 12.7, 4.5, trim)
        m.box(30, 3.3, 2, 30.8, 12.7, 4.5, trim)
        m.box(30.2, 4.5, 4.6, 30.8, 6.5, 6.4, I.glow('#fff2a8'))
        m.box(30.2, 9.5, 4.6, 30.8, 11.5, 6.4, I.glow('#fff2a8'))
        m.box(1.2, 4.5, 4.6, 1.8, 6.5, 6.4, I.glow('#ff5a5a'))
        _cabin(m, 8.5, 11, 20, 23, 3.8, 12.2, 7.5, 12.5, body)
        return m.render((0, 16, 0))
    # nose towards the camera (south), 1x2 tiles
    for wy in (7, 25):
        for wx in (1.4, 12.6):
            m.box(wx, wy - 3, 0, wx + 2, wy + 3, 5.2, tyre)
    front = I.decal(I.flat(body), [((1.5, 2.2, 3.8, 4.4), I.rect_decal('#fff2a8', emit=True)), ((7.2, 2.2, 9.5, 4.4), I.rect_decal('#fff2a8', emit=True)),
                                   ((4, 1.2, 7, 3.2), I.rect_decal('#3a3a44'))])
    m.box(2.5, 2, 2.2, 13.5, 30, 7.5, I.flat(body, jitter=2), south=front, top=I.flat(body))
    m.box(2.3, 29.8, 2, 13.7, 30.8, 4, trim)
    # cabin trapezoid along y (windshield faces the camera)
    y_rear, y_rt, y_ft, y_front = 9, 11, 19, 22
    glass = I.flat('#bfe6f6')
    m.quad((3.5, y_front, 7.5), (12.5, y_front, 7.5), (12.5, y_ft, 12.5), (3.5, y_ft, 12.5), glass)
    m.quad((3.5, y_ft, 12.5), (12.5, y_ft, 12.5), (12.5, y_rt, 12.5), (3.5, y_rt, 12.5), I.flat(body))
    m.quad((12.5, y_front, 7.5), (12.5, y_rear, 7.5), (12.5, y_rt, 12.5), (12.5, y_ft, 12.5), I.decal(I.flat(body), [((1, 0.6, 11, 4.2), I.rect_decal('#bfe6f6'))]))
    m.quad((3.5, y_rear, 7.5), (3.5, y_front, 7.5), (3.5, y_ft, 12.5), (3.5, y_rt, 12.5), I.flat(body))
    m.quad((12.5, y_rear, 7.5), (3.5, y_rear, 7.5), (3.5, y_rt, 12.5), (12.5, y_rt, 12.5), glass)
    return m.render((0, 32, 0))


def bush_prop():
    m = Model()
    bush(m, 8, 10, 6.2, col='#3a944c', seed=41)
    return m.render((0, 16, 0))


def lamp():
    m = Model()
    iron = I.flat('#3f4356')
    m.prism(8, 13.5, 0, 2, 3, iron, sides=8)
    m.prism(8, 13.5, 2, 4, 1.8, iron, sides=8)
    m.prism(8, 13.5, 4, 27, 0.9, iron, sides=6)
    lantern = I.decal(I.glow('#fff0a0'), [((0, 0, 0.5, 9), I.rect_decal('#3f4356')), ((4.5, 0, 5, 9), I.rect_decal('#3f4356'))])
    m.box(5.5, 11, 27, 10.5, 16, 33, iron, south=lantern, east=lantern, top=iron)
    m.box(5, 10.5, 33, 11, 16.5, 34.2, iron)
    m.prism(8, 13.5, 34.2, 36.2, 1.4, iron, sides=6)
    with I.camera(0):
        return m.render((0, 16, 0), cast=False, blob=(8.5, 14, 5, 2.5))


def signpost():
    m = Model()
    post = I.flat('#6b4428', jitter=5)
    m.box(3.5, 11, 0, 5, 12.5, 9, post)
    m.box(11, 11, 0, 12.5, 12.5, 9, post)
    board = I.decal(I.flat('#c8955c', jitter=6), [((2, 2, 11, 3), I.rect_decal('#8a5a34')), ((2, 5, 9, 6), I.rect_decal('#8a5a34'))])
    m.box(1.5, 10, 6, 14.5, 13, 15, I.flat('#b07e48'), south=board)
    with I.camera(0):
        return m.render((0, 16, 0), cast=False, blob=(8, 12.5, 7.5, 2.5))


def banner():
    m = Model()
    m.box(6, 12, 0, 10, 15, 2, I.flat('#ecbc48'))
    m.prism(8, 13.5, 2, 31, 0.9, I.flat('#ecbc48'), sides=6)
    cloth = I.decal(I.flat('#9945ff'), [((1.5, 5, 6.5, 10), I.emblem_decal())])
    m.box(3.5, 12.5, 12, 12.5, 13.5, 29, I.flat('#9945ff'), south=cloth)
    m.ellipsoid((8, 13.5, 32.5), (1.6, 1.6, 1.6), I.flat('#ecbc48'))
    with I.camera(0):
        return m.render((0, 16, 0), cast=False, blob=(8.5, 14, 5, 2.5))


# ------------------------------------------------------- battle platforms ---

def lawn(col='#8cc864', seed=51, rx=1.0, ry=1.0, rim='#5f9e45'):
    base, rimc = c(col), c(rim)

    def sh(P, uv, n):
        x, y = uv[:, 0], -uv[:, 1]
        h = I.hash3(np.floor(P[:, 0] / 1.5), np.floor(P[:, 1] / 1.5), 0, seed)
        out = base[None] * (0.9 + 0.16 * h[:, None])
        tuft = I.hash3(np.floor(P[:, 0]), np.floor(P[:, 1]), 1, seed) > 0.93
        out = np.where(tuft[:, None], out * 0.8, out)
        d = (x / rx) ** 2 + (y / ry) ** 2
        out = np.where((d > 0.86)[:, None], rimc, out)
        out = np.where(((d > 0.8) & (d <= 0.86))[:, None], out * 1.12, out)
        return out, None
    return sh


def marble_top(rx, ry):
    base, gold, purple = c('#ece7f6'), c('#ecbc48'), c('#9a7cf0')

    def sh(P, uv, n):
        x, y = uv[:, 0], -uv[:, 1]
        h = I.hash3(np.floor(P[:, 0] / 3), np.floor(P[:, 1] / 3), 0, 3)
        out = base[None] * (0.94 + 0.08 * h[:, None])
        d = np.sqrt((x / rx) ** 2 + (y / ry) ** 2)
        out = np.where((np.abs(d - 0.72) < 0.03)[:, None], gold, out)
        out = np.where((np.abs(d - 0.35) < 0.025)[:, None], purple, out)
        out = np.where((d > 0.93)[:, None], gold, out)
        return out, None
    return sh


def soil_side():
    base = c('#8a6a48')

    def sh(P, uv, n):
        v = uv[:, 1]
        h = I.hash3(np.floor(uv[:, 0] / 2), np.floor(v / 1.5), 2, 7)
        out = base[None] * (0.85 + 0.25 * h[:, None])
        out = np.where((v > 3.4)[:, None], c('#5f9e45'), out)      # grass lip
        return out, None
    return sh


def platform(rx, ry, boss=False):
    m = Model()
    if boss:
        m.disk(0, 0, 0, 5, rx, ry, marble_top(rx, ry), I.decal(I.flat('#b9b0d0'), [((0, 1.6, 9999, 2.6), I.rect_decal('#ecbc48'))]))
    else:
        m.disk(0, 0, 0, 5, rx, ry, lawn(rx=rx, ry=ry), soil_side())
    with I.camera(0):
        img, anchor = m.render((0, 0, 5), cast=False, blob=(0, 3, rx * 1.03, ry * 1.15), shadow_alpha=0.25)
    return img, anchor


def build_battle():
    return {
        'plat_foe': platform(75, 24),
        'plat_me': platform(97, 31),
        'plat_foe_boss': platform(75, 24, boss=True),
        'plat_me_boss': platform(97, 31, boss=True),
    }


# ============================================================ new models ====

LIGHTS = {}


def _r(m, key, *a, **k):
    out = m.render(*a, **k)
    LIGHTS[key] = getattr(m, 'last_lights', [])
    return out


def window_row(x0, us, v0, v1, w, frame='#fbf6ea', glass='#7fc4ea', lit=True):
    return [((u - x0, v0, u - x0 + w, v1), I.window_decal(frame=frame, glass=glass, lit=lit)) for u in us]


def house_hip(roof='#d8703a', wall='#f3d6b0', shutter='#3f8a5a'):
    """Villa: stucco walls, four-sided hip roof, columned front porch."""
    m = Model()
    W, D = 80, 64
    x0, x1, y0, y1, zt = 6, 74, 22, 54, 34
    m.box(x0 - 1, y0 - 1, 0, x1 + 1, y1 + 1, 3, I.stone('#c8beaf', size=4))
    dec = [((28, 0, 40, 18), I.door_decal(wood='#6b8fb0', frame='#3f5f80'))]
    dec += window_row(x0, (12, 55), 9, 24, 13)
    wall_sh = I.decal(I.stucco(wall), dec)
    m.box(x0, y0, 3, x1, y1, zt, I.stucco(wall), south=wall_sh,
          east=I.decal(I.stucco(wall), [((10, 9, 22, 24), I.window_decal())]))
    for a in (12, 55):
        window_unit(m, a, a + 13, 12, 27, y1, '#ffffff', shutter)
    # porch
    m.box(24, y1, 0, 56, 63, 2.5, I.planks('#b89468'), top=I.planks('#c9a57a'))
    for px in (27, 53):
        m.prism(px, 61, 2.5, 24, 1.6, I.flat('#fbf6ea'), sides=8)
    m.hip(22, 58, 52, 64, 24, 29, I.shingles(roof, row=2.5, tile=3.5), I.flat(darker(roof)), thick=1.2)
    m.hip(1, 79, 16, 60, zt, zt + 19, I.shingles(roof, row=4, tile=6), I.flat(darker(roof)), thick=2.2)
    m.box(60, 30, zt + 6, 66, 36, zt + 22, I.stucco(wall))
    m.box(59, 29, zt + 22, 67, 37, zt + 24, I.flat('#6a6570'))
    bush(m, 12, 60, 3.6, col='#4a9a4e')
    bush(m, 68, 60, 3.6, col='#3f8f48', seed=25)
    return _r(m, 'house_hip', (0, D, 0))


def house_town(brick='#a8543f', trim='#f1e6d0', roof='#4b4f63'):
    """Two-storey brick townhouse with a balcony, stoop and a flat roof."""
    m = Model()
    W, D = 64, 64
    x0, x1, y0, y1, zt = 5, 59, 20, 54, 60
    m.box(x0 - 1, y0 - 1, 0, x1 + 1, y1 + 1, 3, I.stone('#b8b2a8', size=4))
    dec = [((13, 0, 25, 19), I.door_decal(wood='#2f4f3f', frame='#1f2f28'))]
    dec += window_row(x0, (36,), 7, 21, 13)
    dec += window_row(x0, (9, 35), 32, 48, 12)
    dec += [((0, 25, x1 - x0, 26.2), I.rect_decal(trim))]
    wall = I.decal(I.bricks(brick, h=2.2, w=4.6), dec)
    m.box(x0, y0, 3, x1, y1, zt, I.bricks(brick, h=2.2, w=4.6), south=wall,
          east=I.decal(I.bricks(brick, h=2.2, w=4.6), [((10, 7, 22, 21), I.window_decal()), ((10, 32, 22, 48), I.window_decal())]))
    for a, z0, z1 in ((41, 10, 24), (14, 35, 51), (40, 35, 51)):
        m.box(a - 1, y1, z0 - 1.2, a + 13, y1 + 1.6, z0, I.flat(trim))
        m.box(a - 0.6, y1, z1, a + 12.6, y1 + 1.2, z1 + 1.4, I.flat(trim))
    # balcony on the upper floor
    m.box(34, y1, 33, 59, 60, 34.5, I.flat(trim))
    for bx in np.arange(35, 59, 3):
        m.box(bx, 59, 34.5, bx + 0.8, 59.8, 40, I.flat('#2a2c38'), shadow=False)
    m.box(34, 58.8, 40, 59, 60, 41, I.flat('#2a2c38'))
    # stoop + little awning
    m.box(16, y1, 0, 32, 62, 1.6, I.flat('#b8b2a8'))
    m.box(17, y1, 1.6, 31, 59, 3.2, I.flat('#b8b2a8'))
    m.box(15, y1, 20, 33, 60, 21.5, I.flat('#2f4f3f'), south=I.decal(I.flat('#2f4f3f'), [((0, 0, 18, 1.5), stripes('#2f4f3f', '#f1e6d0', 2))]))
    # cornice, flat roof, rooftop kit
    m.box(x0 - 1.5, y0 - 1.5, zt, x1 + 1.5, y1 + 1.5, zt + 3, I.flat(trim), top=I.stone(roof, size=5))
    m.box(10, 26, zt + 3, 20, 34, zt + 9, I.flat('#9aa0ac'), south=I.decal(I.flat('#9aa0ac'), [((1, 1, 9, 5), stripes('#7a808c', '#9aa0ac', 1))]))
    m.cone(46, 32, zt + 3, zt + 14, 5, 5, I.planks('#8a6a48', w=2), sides=10, top=I.flat('#5a4a3a'))
    m.cone(46, 32, zt + 14, zt + 17, 5.5, 0, I.flat('#5a4a3a'), sides=10)
    return _r(m, 'house_town', (0, D, 0))


def house_cabin(roof='#6b4a33'):
    """Log cabin: log walls, steep shake roof, stone chimney, plank porch."""
    m = Model()
    W, D = 64, 64
    x0, x1, y0, y1, zt = 6, 56, 24, 54, 26
    m.box(x0 - 1, y0 - 1, 0, x1 + 1, y1 + 1, 2, I.stone('#9a938a', size=3))
    dec = [((26, 0, 36, 17), I.door_decal(wood='#8a5a34', frame='#4a2e1a'))]
    dec += window_row(x0, (11, 44), 7, 17, 9, frame='#e8d8b8')
    m.box(x0, y0, 2, x1, y1, zt, I.logs('#9a6a42'), south=I.decal(I.logs('#9a6a42'), dec), east=I.logs('#9a6a42'))
    m.box(3, y1, 0, 59, 62, 2.2, I.planks('#a07a50'), top=I.planks('#b08a5e'))
    for px in (4, 57):
        m.box(px, 58, 2.2, px + 2, 60, 17, I.logs('#8a5a34', h=2))
    m.quad((2, 60, 17), (60, 60, 17), (60, y1 - 0.5, 20), (2, y1 - 0.5, 20), I.shingles(roof, row=2.5, tile=4))
    m.gable_x(1, 61, 17, 60, zt, zt + 26, I.shingles(roof, row=3.5, tile=5), I.logs('#9a6a42'), I.flat(darker(roof)), thick=2)
    m.box(56, 32, 0, 63, 40, zt + 30, I.stone('#8f8a82', size=3))
    m.box(55.5, 31.5, zt + 30, 63.5, 40.5, zt + 32, I.flat('#6a6570'))
    for i, (fx, fz) in enumerate(((8, 2.2), (12, 2.2), (10, 5.4))):
        m.prism(fx, 58, fz, fz, 1.6, I.flat('#7a5236'))
        m.box(fx - 1.6, 56.5, fz, fx + 1.6, 59.5, fz + 3.2, I.logs('#8a5a34', h=3.2), south=I.flat('#d8b888'))
    return _r(m, 'house_cabin', (0, D, 0))


def house_L(wall='#f6efcf', roof='#3f7fc0'):
    """Family home: wide front wing with a garage, and a back wing (L-plan)."""
    m = Model()
    W, D = 96, 80
    m.box(6, 6, 0, 40, 42, 2, I.stone('#b8b2a8', size=4))
    m.box(8, 8, 2, 38, 40, 30, I.siding(wall, spacing=2.5), east=I.decal(I.siding(wall, spacing=2.5), [((8, 8, 20, 22), I.window_decal())]))
    m.hip(4, 42, 4, 44, 30, 41, I.shingles(roof, row=4, tile=6), I.flat(darker(roof)), thick=1.8)
    x0, x1, y0, y1, zt = 6, 90, 36, 72, 32
    m.box(x0 - 1, y0 - 1, 0, x1 + 1, y1 + 1, 3, I.stone('#b8b2a8', size=4))
    dec = [((28, 0, 40, 18), I.door_decal())]
    dec += window_row(x0, (10, 44), 9, 23, 13)
    garage = I.decal(I.flat('#e8e2d0'), [((0, 0, 99, 99), stripes('#e8e2d0', '#cfc8b4', 1.6))])
    dec += [((56, 0, 80, 17), rect_like(garage))]
    m.box(x0, y0, 3, x1, y1, zt, I.siding(wall, spacing=2.5), south=I.decal(I.siding(wall, spacing=2.5), dec),
          east=I.decal(I.siding(wall, spacing=2.5), [((10, 9, 22, 23), I.window_decal())]))
    for a in (10, 44):
        window_unit(m, a + x0, a + x0 + 13, 12, 26, y1, '#ffffff', '#b04a4a')
    m.box(60, y1, 0, 88, 80, 0.8, I.flat('#9a9aa2'))     # driveway
    m.box(32, y1, 0, 48, 76, 2, I.stone('#b8b2a8', size=3))
    m.gable_x(30, 50, y1 - 1, y1 + 5, 20, 23.5, I.shingles(roof, row=2, tile=3), I.flat(wall), I.flat(darker(roof)), thick=1)
    m.gable_x(2, 94, 30, 78, zt, zt + 18, I.shingles(roof, row=4, tile=6), I.siding(wall, spacing=2.5), I.flat(darker(roof)), thick=2.2)
    bush(m, 12, 76, 3.4)
    bush(m, 52, 76, 3.2, col='#378f48', seed=27)
    return _r(m, 'house_L', (0, D, 0))


def rect_like(shader):
    def fn(u, v, w, h):
        P = np.zeros((len(u), 3))
        rgb, _ = shader(P, np.stack([u, v], -1), None)
        border = (u < I.LW) | (u >= w - I.LW) | (v >= h - I.LW)
        rgb = np.where(border[:, None], c('#8a8474'), rgb)
        return rgb, np.ones(len(u)), None
    return fn


def shop():
    """Corner shop: display windows, full striped awning, SHOP sign, flat roof."""
    m = Model()
    W, D = 80, 64
    x0, x1, y0, y1, zt = 4, 76, 22, 54, 34
    m.box(x0 - 1, y0 - 1, 0, x1 + 1, y1 + 1, 3, I.stone('#c9c3b8', size=4))
    dec = [((26, 0, 46, 20), I.door_decal(wood='#e8f4f6', frame='#b8323a', knob='#b8323a', glass='#9fdcf2'))]
    dec += [((3, 3, 23, 19), I.window_decal(frame='#b8323a', glass='#9fdcf2', cross=False)),
            ((49, 3, 69, 19), I.window_decal(frame='#b8323a', glass='#9fdcf2', cross=False))]
    dec += [((10, 24, 62, 31), text_on('SHOP', '#ffffff', '#b8323a', '#7a1f26', scale=1))]
    m.box(x0, y0, 3, x1, y1, zt, I.stucco('#fbf8f0'), south=I.decal(I.stucco('#fbf8f0'), dec),
          east=I.decal(I.stucco('#fbf8f0'), [((8, 3, 24, 19), I.window_decal(frame='#b8323a', glass='#9fdcf2', cross=False))]))
    aw = stripes('#d8404a', '#ffffff', 4)
    m.quad((2, 62, 19), (78, 62, 19), (78, y1, 24), (2, y1, 24), I.decal(I.flat('#d8404a'), [((0, 0, 99, 99), aw)]))
    m.box(2, 61.5, 17.5, 78, 62, 19, I.decal(I.flat('#d8404a'), [((0, 0, 99, 99), aw)]))
    m.box(x0 - 1.5, y0 - 1.5, zt, x1 + 1.5, y1 + 1.5, zt + 3, I.flat('#b8323a'), top=I.stone('#7a7f8c', size=5))
    m.box(52, 28, zt + 3, 64, 36, zt + 9, I.flat('#9aa0ac'))
    for cx in (8, 70):
        m.box(cx - 3, 57, 0, cx + 3, 62, 5, I.planks('#b08a5e'), top=flowers_shader(seed=31))
    return _r(m, 'shop', (0, D, 0))


def windmill():
    """Landmark: stone windmill with a red cap and four lattice sails."""
    m = Model()
    m.cone(32, 34, 0, 58, 17, 11, I.stone('#ddd6c8', size=4), sides=12, top=I.flat('#8a3a3a'))
    m.cone(32, 34, 58, 76, 13.5, 0, I.shingles('#a8423a', row=3, tile=4), sides=12)
    m.box(28, 48, 0, 36, 51.5, 14, I.planks('#7a5236'), south=I.decal(I.planks('#7a5236'), [((0, 0, 8, 14), I.door_decal(wood='#7a5236', frame='#4a2e1a'))]))
    m.box(29.5, 46, 36, 34.5, 50, 42, I.flat('#ddd6c8'), south=I.decal(I.flat('#ddd6c8'), [((0, 0, 5, 6), I.window_decal())]))
    hub = np.array((32, 49.5, 56))
    sail = I.decal(I.flat('#efe4cc'), [((0, 0, 999, 999), stripes('#efe4cc', '#a88a5e', 3))])
    for ang in (np.pi / 4, 3 * np.pi / 4, 5 * np.pi / 4, 7 * np.pi / 4):
        d = np.array((np.cos(ang), 0, np.sin(ang)))
        pp = np.array((-np.sin(ang), 0, np.cos(ang)))
        a0, a1 = hub + d * 3, hub + d * 30
        m.quad(a0 - pp * 0.6, a1 - pp * 0.6, a1 + pp * 5, a0 + pp * 5, sail, frame=(a0, d, pp))
        m.quad(a0 - pp * 0.8, a1 - pp * 0.8, a1 + pp * 0.3, a0 + pp * 0.3, I.flat('#6b4428'), frame=(a0, d, pp))
    m.ellipsoid(tuple(hub + np.array((0, 1, 0))), (2.4, 2.4, 2.4), I.flat('#6b4428'))
    return _r(m, 'windmill', (0, 64, 0))


def gazebo():
    m = Model()
    m.cone(24, 26, 0, 3, 20, 20, I.planks('#c9a57a'), sides=8, top=I.planks('#d8b488'))
    for i in range(8):
        a = 2 * np.pi * (i + 0.5) / 8
        m.prism(24 + 18 * np.cos(a), 26 + 18 * np.sin(a), 3, 22, 1.1, I.flat('#ffffff'), sides=6)
    m.cone(24, 26, 22, 24, 22, 22, I.flat('#ffffff'), sides=8)
    m.cone(24, 26, 24, 38, 22, 0, I.shingles('#2fb4b0', row=3, tile=4), sides=8)
    m.ellipsoid((24, 26, 39.5), (1.8, 1.8, 1.8), I.flat('#ecbc48'))
    return _r(m, 'gazebo', (0, 48, 0))


def fountain():
    m = Model()
    stone = I.stone('#d8d2c8', size=4)
    m.cone(24, 26, 0, 6, 20, 20, stone, sides=16, top=I.water('#5aa8e8'))
    m.cone(24, 26, 6, 7.2, 20.5, 20.5, I.flat('#e8e2d8'), sides=16)
    m.prism(24, 26, 6, 15, 3, stone, sides=10)
    m.cone(24, 26, 15, 17, 9, 9, stone, sides=12, top=I.water('#6ab8f0'))
    m.ellipsoid((24, 26, 21), (2.2, 2.2, 4.5), I.flat('#bfe6ff'))
    return _r(m, 'fountain', (0, 48, 0))


def well():
    m = Model()
    m.cone(16, 18, 0, 8, 9, 9, I.stone('#b8b2a8', size=3), sides=12, top=I.flat('#1e2a3a'))
    for px in (8, 24):
        m.box(px - 1, 17, 8, px + 1, 19, 24, I.planks('#7a5236'))
    m.gable_x(5, 27, 12, 24, 22, 29, I.shingles('#8a3a3a', row=2, tile=3), I.flat('#7a5236'), I.flat('#5a2a24'), thick=1)
    m.box(12, 17.4, 14, 20, 18.6, 15, I.flat('#6b4428'))
    return _r(m, 'well', (0, 32, 0))


def bench():
    m = Model()
    wood = I.planks('#b07e48', w=2.4)
    for lx in (5, 26):
        m.box(lx, 6, 0, lx + 1.2, 12, 6, I.flat('#3f4356'))
    m.box(3, 7, 6, 29, 12, 7.2, wood)
    m.box(3, 6, 7.2, 29, 7.2, 13, wood)
    return _r(m, 'bench', (0, 16, 0), cast=False, blob=(16, 10, 14, 4))


def rock():
    m = Model()
    g = I.flat('#9a9aa4', jitter=10)
    m.ellipsoid((8, 10, 3), (6, 4.5, 4.2), g)
    m.ellipsoid((11, 11.5, 2), (3.5, 3, 2.6), I.flat('#8a8a94', jitter=10))
    return _r(m, 'rock', (0, 16, 0))


def boulder():
    m = Model()
    m.ellipsoid((16, 20, 7), (13, 9, 10), I.flat('#9294a0', jitter=12))
    m.ellipsoid((22, 24, 4), (7, 5, 5), I.flat('#868894', jitter=12))
    m.ellipsoid((10, 22, 3.5), (5, 4, 4), I.flat('#7fb070', jitter=8))
    return _r(m, 'boulder', (0, 32, 0))


def stump():
    m = Model()
    m.prism(8, 10, 0, 6, 5, I.flat('#7a5236', jitter=8), sides=10,
            top=I.decal(I.flat('#c9a57a'), [((0, 0, 99, 99), rings('#c9a57a', '#9a7a52'))]))
    return _r(m, 'stump', (0, 16, 0))


def rings(a, b):
    ca, cb = c(a), c(b)

    def fn(u, v, w, h):
        return np.where((np.hypot(u, v) % 1.8 < 0.5)[:, None], cb, ca), np.ones(len(u)), None
    return fn


def crates():
    m = Model()
    m.box(2, 5, 0, 14, 14, 9, I.planks('#b08a5e', w=2.4), top=I.planks('#c49a6c', w=2.4))
    m.box(4, 7, 9, 12, 12, 15, I.planks('#a07a50', w=2.4), top=I.planks('#b08a5e', w=2.4))
    return _r(m, 'crates', (0, 16, 0))


def barrel():
    m = Model()
    m.cone(8, 10, 0, 12, 5, 5, I.decal(I.planks('#9a6a42', w=2), [((0, 2, 999, 3), I.rect_decal('#4a4e60')), ((0, 9, 999, 10), I.rect_decal('#4a4e60'))]),
           sides=12, top=I.flat('#7a5236'))
    return _r(m, 'barrel', (0, 16, 0))


def flowerpot():
    m = Model()
    m.cone(8, 10, 0, 6, 4.2, 5.2, I.flat('#c8683f', jitter=6), sides=10, top=I.flat('#5a3a24'))
    m.ellipsoid((8, 10, 8.5), (5, 4.5, 3.8), flowers_shader(seed=41))
    return _r(m, 'flowerpot', (0, 16, 0), cast=False, blob=(8, 10.5, 5, 2.5))


def item_ball():
    """Pickup capsule in the brand colours (purple top -> green, dark base)."""
    m = Model()
    top_a, top_b, dark = c('#9945ff'), c('#14f195'), c('#1a1830')

    def sh(P, uv, n):
        t = np.clip((P[:, 0] - 4) / 8, 0, 1)[:, None]
        top = top_a * (1 - t) + top_b * t
        out = np.where((P[:, 2] > 3.6)[:, None], top, dark)
        band = np.abs(P[:, 2] - 3.6) < 0.45
        return np.where(band[:, None], c('#f4f4f8'), out), None
    m.ellipsoid((8, 10, 3.6), (3.4, 3.4, 3.4), sh)
    return _r(m, 'item_ball', (0, 16, 0), cast=False, blob=(8, 10.5, 3.6, 1.8))


def hedge_seg():
    m = Model()
    leaf = I.foliage('#3f9a4f', seed=61, scale=2.0)
    m.box(-2, 3, 0, 18, 13, 13, leaf)
    m.box(-2, 3.5, 13, 18, 12.5, 14, I.foliage('#4aa65a', seed=62, scale=2.0))
    return _r(m, 'hedge_seg', (0, 16, 0), seamless_x=True, crop_x=16 * I.RES)


def fence_seg():
    m = Model()
    paint = I.flat('#f4f2ea')
    for px in (2.5, 10.5):
        m.box(px, 8.5, 0, px + 2.4, 10.5, 11, paint)
        m.box(px + 0.4, 8.7, 11, px + 2.0, 10.3, 12.2, paint)
    m.box(-1, 9, 3.5, 17, 10, 5, paint)
    m.box(-1, 9, 7.5, 17, 10, 9, paint)
    return _r(m, 'fence_seg', (0, 16, 0), seamless_x=True, crop_x=16 * I.RES)



# ------------------------------------------------------------------ grass ----

def blade_shader(root, tip, h, seed=0):
    r0, t0 = c(root), c(tip)

    def sh(P, uv, n):
        t = np.clip(P[:, 2] / h, 0, 1)[:, None]
        out = r0 * (1 - t) + t0 * t
        return out, None
    return sh


def _blades(m, rng, x0, x1, y0, y1, n, hmin, hmax, root, tip, width=1.5, sway=0.0, sharp=False):
    for _ in range(n):
        bx, by = rng.uniform(x0, x1), rng.uniform(y0, y1)
        h = rng.uniform(hmin, hmax)
        ang = rng.uniform(-0.9, 0.9)                     # blade plane mostly faces the camera
        ax, ay = np.cos(ang), np.sin(ang) * 0.6
        w = width * rng.uniform(0.8, 1.2)
        lx, ly = rng.uniform(-2.2, 2.2), rng.uniform(-1.5, 1.0)
        tipc = np.array(c(tip)) * rng.uniform(0.85, 1.08)
        lx += sway * h / 8.0                             # wind: taller blades bend further
        sh = blade_shader(root, '#%02x%02x%02x' % tuple(int(min(255, v)) for v in tipc), h)
        a = (bx - ax * w / 2, by - ay * w / 2, 0)
        b = (bx + ax * w / 2, by + ay * w / 2, 0)
        mid = (bx + lx * 0.35, by + ly * 0.35, h * 0.55)
        mw = 0.26 if sharp else 0.34
        ma = (mid[0] - ax * w * mw, mid[1] - ay * w * mw, mid[2])
        mb = (mid[0] + ax * w * mw, mid[1] + ay * w * mw, mid[2])
        top = (bx + lx, by + ly, h)
        m.quad(a, b, mb, ma, sh)
        m.tri(ma, mb, top, sh)


GRASS_SWAY = (-1.4, 0.0, 1.4)       # wind frames (tools + game must agree)
GRASS_VARIANTS = 4


def tall_grass(variant=0, layer='front', frame=1):
    """One tile of *dangerous* tall grass as real 3D blades: tall, dense,
    sharp, dark roots with a few sun-scorched and teal blades. Rendered in two
    layers so the player stands in it ('back' behind them, 'front' over their
    legs) and in three wind frames (GRASS_SWAY) for the rolling-wave effect."""
    m = Model()
    ys = (0.5, 8.5) if layer == 'back' else (8.5, 16.2)
    rng = np.random.default_rng(100 + variant * 2 + (layer == 'front'))
    sw = GRASS_SWAY[frame]
    _blades(m, rng, 0.2, 15.8, ys[0], ys[1], 28, 6.5, 10.0, '#174a28', '#86d86c', width=1.6, sway=sw, sharp=True)
    _blades(m, rng, 0.5, 15.5, ys[0], ys[1], 10, 4.0, 6.5, '#1a5230', '#b4ec88', width=1.3, sway=sw, sharp=True)
    _blades(m, rng, 0.5, 15.5, ys[0], ys[1], 4, 8.0, 11.0, '#123e32', '#4cb89a', width=1.4, sway=sw, sharp=True)   # teal
    _blades(m, rng, 0.5, 15.5, ys[0], ys[1], 3, 6.0, 9.0, '#3e3e1e', '#d8c466', width=1.2, sway=sw, sharp=True)    # scorched
    return _r(m, f'tall_{layer}{variant}_{frame}', (0, 16, 0), margin=1, shadow_alpha=0.34)


def grass_clump(variant=0):
    """A small decorative tuft scattered over short grass."""
    m = Model()
    rng = np.random.default_rng(300 + variant)
    _blades(m, rng, 5.5, 10.5, 6, 10, 9, 2.6, 4.4, '#62ad52', '#d4f8a0', width=1.2)
    return _r(m, f'clump{variant}', (0, 16, 0), margin=1, shadow_alpha=0.14, outline=False)



# ------------------------------------------------------------ hall interior ----

def pillar():
    """Marble column with gold base and capital (Elite Hall interior)."""
    m = Model()
    marble = I.flat('#efeaf6', jitter=3)
    gold = I.flat('#ecbc48')
    m.box(2, 3, 0, 14, 15, 3, gold)                       # plinth
    m.box(3, 4, 3, 13, 14, 5, I.flat('#dcd4ea'))
    m.prism(8, 9, 5, 40, 4.4, marble, sides=12)           # shaft
    for z in (12, 20, 28):                                # fluting bands
        m.prism(8, 9, z, z + 0.8, 4.6, I.flat('#d4cce6'), sides=12)
    m.box(3, 4, 40, 13, 14, 43, gold)                     # capital
    m.box(1.5, 2.5, 43, 14.5, 15.5, 46, I.flat('#f6f0fa'))
    with I.camera(0):                     # tall and thin: keep it upright
        return _r(m, 'pillar', (0, 16, 0), cast=True)


def brazier(lit=True):
    """Gold brazier on a dark stand, burning (its flame is a night-light).
    lit=False: the cold variant - a bowl of dark coals - for the Hall's aisle,
    which the game ignites one pair at a time as the player walks up."""
    m = Model()
    iron = I.flat('#2c2238')
    gold = I.flat('#ecbc48')
    m.box(5, 9, 0, 11, 15, 2, iron)
    m.prism(8, 12, 2, 14, 1.6, iron, sides=8)
    m.cone(8, 12, 14, 19, 3.2, 6.2, gold, sides=16)       # bowl
    if lit:
        m.ellipsoid((8, 12, 20.5), (4.4, 3.4, 3.6), I.glow('#ff9a3a'))
        m.ellipsoid((8, 12, 23.5), (2.6, 2.0, 3.0), I.glow('#ffd36a'))
        m.ellipsoid((8, 12, 26), (1.2, 1.0, 1.8), I.glow('#fff4c0'))
    else:
        m.ellipsoid((8, 12, 19.4), (4.6, 3.6, 1.6), I.flat('#3a2a30'))   # cold coals
        m.ellipsoid((8, 12, 19.9), (2.0, 1.6, 0.9), I.flat('#5a2a24'))
    with I.camera(0):
        return _r(m, 'brazier' if lit else 'brazier_cold', (0, 16, 0), cast=False, blob=(8, 12.5, 6, 3))



def floor_emblem():
    """The Sol emblem inlaid in the Hall floor: gold rings, a violet-to-mint
    disc and three slanted bars. Flat - players walk over it."""
    m = Model()
    gold, violet, mint = c('#ecbc48'), c('#9945ff'), c('#14f195')
    dark = c('#2a1c5a')

    def top(P, uv, n):
        x, y = P[:, 0] - 56, (P[:, 1] - 24) / 0.62       # centre, undo the ellipse
        d = np.sqrt(x * x + y * y)
        t = np.clip((x + 30) / 60, 0, 1)[:, None]
        out = violet * (1 - t) + mint * t
        out = np.where(((d > 26) & (d < 29.5))[:, None] | ((d > 31.5))[:, None], gold, out)
        out = np.where(((d >= 29.5) & (d <= 31.5))[:, None], dark, out)
        # three slanted bars (the Sol mark)
        for k in (-8, 0, 8):
            bar = (np.abs(y - k) < 2.6) & (np.abs(x - (y - k) * 0.35) < 15)
            out = np.where(bar[:, None], np.array([250, 248, 255.0]), out)
        return out, None
    m.disk(56, 24, 0, 0.35, 34, 21, top, I.flat('#b8962e'))
    return _r(m, 'floor_emblem', (0, 48, 0), cast=False, outline=False, shadow_alpha=0)


# --------------------------------------------------- the Hall's grand stage ----
# The dais is raised STAGE_H units (a third of a person); a staircase of
# STEPS carpeted steps climbs to it over three tile rows. The game lifts
# anything standing on it by the same height (src/data/map.js HALL.stage).
STAGE_H = 16
STEPS = 8
GOLD_HEX = '#ecbc48'


def carpet_shader(lane0, lane1, riser=False):
    """The Hall's red carpet, gold-edged at the lane borders; on risers it is
    darker with a gold stair rod at the top."""
    red = c('#a8223a')
    gold = c(GOLD_HEX)

    def sh(P, uv, n):
        x = P[:, 0]
        out = np.tile(red * (0.82 if riser else 1.0), (len(P), 1))
        weave = (np.floor(P[:, 1] * 2 + P[:, 2] * 2) % 2 == 0)
        out = np.where(weave[:, None], out * 0.95, out)
        edge = (x < lane0 + 2.2) | (x > lane1 - 2.2)
        inner = ((x > lane0 + 3.2) & (x < lane0 + 3.9)) | ((x < lane1 - 3.2) & (x > lane1 - 3.9))
        out = np.where(edge[:, None], gold * 0.88, out)
        out = np.where(inner[:, None], gold, out)
        if riser:
            rod = uv[:, 1] > (uv[:, 1].max() - 0.7) if len(uv) else np.zeros(0, bool)
            out = np.where(rod[:, None], gold * 1.05, out)
        return np.clip(out, 0, 255), None
    return sh


def dais_top_shader(x0, x1, y0, y1, lane0, lane1):
    """Pale lilac marble with a gold inlay border; the carpet runs up the middle to the gate."""
    marble = c('#ded6ec')
    gold = c(GOLD_HEX)
    carpet = carpet_shader(lane0, lane1)

    def sh(P, uv, n):
        x, y = P[:, 0], P[:, 1]
        out = np.tile(marble, (len(P), 1))
        diag = ((x + y) % 16) < 0.9
        out = np.where(diag[:, None], out * 0.94, out)
        j = (I.hash3(np.floor(x / 4), np.floor(y / 4), 0, 61) - 0.5) * 8
        out = out + j[:, None]
        border = (np.abs(x - x0 - 4) < 0.7) | (np.abs(x - x1 + 4) < 0.7) | (np.abs(y - y1 + 4) < 0.7)
        out = np.where(border[:, None], gold, out)
        lane = (x >= lane0) & (x <= lane1)
        if lane.any():
            cp, _ = carpet(P[lane], uv[lane], n)
            out[lane] = cp
        return np.clip(out, 0, 255), None
    return sh


def riser_shader():
    """The dais's front face: violet marble panels, a gold lip, a dark plinth line."""
    stone = c('#8a74b4')
    gold = c(GOLD_HEX)

    def sh(P, uv, n):
        z = P[:, 2]
        out = np.tile(stone, (len(P), 1))
        panel = (np.floor(P[:, 0] / 16) % 2 == 0)
        out = np.where(panel[:, None], out * 0.93, out)
        out = np.where((z > STAGE_H - 2.2)[:, None], gold, out)
        out = np.where(((z > STAGE_H - 3.0) & (z <= STAGE_H - 2.2))[:, None], gold * 0.7, out)
        out = np.where((z < 1.4)[:, None], stone * 0.62, out)
        return out, None
    return sh


def hall_stage():
    """The raised dais and its grand staircase (footprint 11 x 6 tiles: the
    dais is the back three rows, the stairs the front three, centred on the
    carpet). Flat-topped and walkable - drawn under the characters."""
    m = Model()
    W, D = 11 * T, 6 * T
    top_y = 3 * T                         # dais front edge / top of the stairs
    lane0, lane1 = 4 * T, 7 * T           # the carpet lane (3 tiles)
    marble = I.flat('#efeaf6', jitter=2)
    gold = I.flat(GOLD_HEX)
    # the dais
    m.box(0, 0, 0, W, top_y, STAGE_H, I.flat('#8a74b4'), top=dais_top_shader(0, W, 0, top_y, lane0, lane1),
          south=riser_shader())
    # the stairs: one block per step, its top the tread and its front the riser
    run = (D - top_y) / STEPS
    rise = STAGE_H / STEPS
    for k in range(STEPS):
        y0 = top_y + k * run
        zt = STAGE_H - (k + 1) * rise
        m.box(lane0, y0, 0, lane1, y0 + run, max(0.01, zt), carpet_shader(lane0, lane1, riser=True),
              top=carpet_shader(lane0, lane1), south=carpet_shader(lane0, lane1, riser=True))
    # balustrades: low marble walls following the slope, gold rail on top
    def zt_at(y):
        return 9 + STAGE_H * (D - y) / (D - top_y)
    for xa, xb in ((lane0 - 7, lane0), (lane1, lane1 + 7)):
        ya, yb = top_y, D - 2
        za, zb = zt_at(ya), zt_at(yb)
        for xx, sgn in ((xa, -1), (xb, 1)):          # side faces
            m.quad((xx, yb, 0), (xx, ya, 0), (xx, ya, za), (xx, yb, zb), marble)
        m.quad((xa, yb, 0), (xb, yb, 0), (xb, yb, zb), (xa, yb, zb), marble)      # front end
        m.quad((xa, yb, zb), (xb, yb, zb), (xb, ya, za), (xa, ya, za), marble)    # sloped top
        r0, r1 = (xa + xb) / 2 - 2.4, (xa + xb) / 2 + 2.4                         # the gold rail
        m.quad((r0, yb, zb + 1.6), (r1, yb, zb + 1.6), (r1, ya, za + 1.6), (r0, ya, za + 1.6), gold)
        m.quad((r0, yb, zb), (r1, yb, zb), (r1, yb, zb + 1.6), (r0, yb, zb + 1.6), gold)
        m.quad((r0, yb, zb), (r0, ya, za), (r0, ya, za + 1.6), (r0, yb, zb + 1.6), gold)
        m.quad((r1, ya, za), (r1, yb, zb), (r1, yb, zb + 1.6), (r1, ya, za + 1.6), gold)
        cx = (xa + xb) / 2
        # newel posts with gold finials: at the foot, and up on the dais
        m.box(cx - 4.5, D - 9, 0, cx + 4.5, D, zb + 5, marble, top=gold)
        m.ellipsoid((cx, D - 4.5, zb + 8), (2.8, 2.4, 2.8), gold)
        m.box(cx - 4, top_y - 7, STAGE_H, cx + 4, top_y + 1, STAGE_H + 15, marble, top=gold)
        m.ellipsoid((cx, top_y - 3, STAGE_H + 18), (2.6, 2.2, 2.6), gold)
    return _r(m, 'hall_stage', (0, D, 0), cast=False, shadow_alpha=0.22, margin=2)


def hall_gate(open_=False):
    """The Hall of Fame gate in the back wall, standing on the dais (footprint
    3 x 2 tiles: wall rows). Closed: violet leaves with gold studs and the Sol
    mark. Open: the doorway blazes with light."""
    m = Model()
    W = 3 * T
    z0 = STAGE_H
    gold = I.flat(GOLD_HEX)
    gold_dk = I.flat('#b8902e')
    yb = 2 * T                                 # front of the gate (wall face)
    # pillars
    for xa in (1, W - 8):
        m.box(xa, yb - 7, z0, xa + 7, yb, z0 + 40, gold, south=gold_dk)
        m.box(xa - 1, yb - 8, z0 + 40, xa + 8, yb + 1, z0 + 43, gold)
    # lintel with the Sol mark
    m.box(0, yb - 8, z0 + 43, W, yb + 1, z0 + 50, gold)
    m.ellipsoid((W / 2, yb - 1, z0 + 47), (5.5, 1.4, 4.5), I.flat('#9945ff'))
    m.ellipsoid((W / 2 + 2.2, yb - 0.6, z0 + 47), (2.8, 1, 2.6), I.flat('#14f195'))
    if open_:
        m.box(8, yb - 3, z0, W - 8, yb - 1.5, z0 + 40, I.glow('#fff1c8'))
        m.box(10, yb - 2, z0, W - 10, yb - 0.5, z0 + 37, I.glow('#ffd77a'))
    else:
        leaf = c('#4a2c86')
        studs = c(GOLD_HEX)

        def leaves(P, uv, n):
            x, z = P[:, 0], P[:, 2] - z0
            out = np.tile(leaf, (len(P), 1))
            seam = np.abs(x - W / 2) < 0.6
            stud = ((np.abs((x - 8) % 6 - 3) < 0.9) & (np.abs(z % 8 - 4) < 0.9))
            band = (np.abs(z - 18) < 1.0) | (np.abs(z - 34) < 1.0)
            out = np.where(stud[:, None] | band[:, None], studs, out)
            out = np.where(seam[:, None], leaf * 0.55, out)
            return out, None
        m.box(8, yb - 3, z0, W - 8, yb - 1, z0 + 40, I.flat('#3a2268'), south=leaves)
    with I.camera(0):
        return _r(m, 'hall_gate_open' if open_ else 'hall_gate', (0, 2 * T, 0), cast=False, shadow_alpha=0, margin=2)


def build_all():
    """Render every prop; light points (lit windows, lamps) are recorded in LIGHTS."""
    builders = [
        ('house_red', lambda: house('#d9534a', variant=0, shutter='#3f6fb0')),
        ('house_blue', lambda: house('#4a7fd4', variant=1, wall='#f6f0de', shutter='#2f8a5a')),
        ('house_green', lambda: house('#4ea85a', variant=2, wall='#efe6cc', trim='#7a4e32')),
        ('house_hip', lambda: house_hip()),
        ('house_hip2', lambda: house_hip(roof='#8a5ac8', wall='#f4e8f0', shutter='#5a3a8a')),
        ('house_town', lambda: house_town()),
        ('house_town2', lambda: house_town(brick='#7a6a8a', trim='#f4efe4')),
        ('house_cabin', lambda: house_cabin()),
        ('house_L', lambda: house_L()),
        ('shop', lambda: shop()),
        ('windmill', lambda: windmill()),
        ('gazebo', lambda: gazebo()),
        ('fountain', lambda: fountain()),
        ('well', lambda: well()),
        ('bench', lambda: bench()),
        ('rock', lambda: rock()),
        ('boulder', lambda: boulder()),
        ('stump', lambda: stump()),
        ('crates', lambda: crates()),
        ('barrel', lambda: barrel()),
        ('flowerpot', lambda: flowerpot()),
        ('item_ball', lambda: item_ball()),
        ('hedge_seg', lambda: hedge_seg()),
        ('fence_seg', lambda: fence_seg()),
        ('rest_house', lambda: rest_house()),
        ('hall', lambda: elite_hall()),
        ('tree', lambda: tree(0)),
        ('tree2', lambda: tree(1)),
        ('tree3', lambda: tree(2)),
        ('bush', lambda: bush_prop()),
        ('car_blue', lambda: car('#3f78d8')),
        ('car_red', lambda: car('#d8464e')),
        ('car_yellow', lambda: car('#eec23c')),
        ('car_white', lambda: car('#e8e8ee')),
        ('car_blue_v', lambda: car('#3f78d8', vertical=True)),
        ('car_red_v', lambda: car('#d8464e', vertical=True)),
        ('lamp', lambda: lamp()),
        ('sign', lambda: signpost()),
        ('banner', lambda: banner()),
        ('pillar', lambda: pillar()),
        ('brazier', lambda: brazier()),
        ('brazier_cold', lambda: brazier(lit=False)),
        ('floor_emblem', lambda: floor_emblem()),
        ('hall_stage', lambda: hall_stage()),
        ('hall_gate', lambda: hall_gate()),
        ('hall_gate_open', lambda: hall_gate(open_=True)),
    ] + [(f'tall_{l}{v}_{f}', (lambda v=v, l=l, f=f: tall_grass(v, l, f)))
         for v in range(GRASS_VARIANTS) for l in ('back', 'front') for f in range(len(GRASS_SWAY))] \
      + [(f'clump{v}', (lambda v=v: grass_clump(v))) for v in range(3)]
    out = {}
    for key, fn in builders:
        out[key] = fn()
        LIGHTS[key] = list(getattr(I, 'LAST_LIGHTS', []))
    return out
