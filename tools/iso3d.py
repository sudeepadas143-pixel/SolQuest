"""
Tiny software 3D renderer for DS-style (Pokemon Platinum-like) map props.

World axes: x = east, y = south (towards the camera / screen-down), z = up.
Units: models are built in world units (16 per tile); they are rendered at RES
texels per unit (RES = 2 -> 32 texels per tile). The camera looks down at the map
from the south at a steep pitch (oblique orthographic projection):

    screen_x = RES * (x + SKEW * z)
    screen_y = RES * (y - PITCH * z)

so the ground plane keeps the tile grid 1:1 while walls rise "up" the screen and
you see front walls plus BOTH slopes of a roof - the look of the DS games.
Everything is flat-shaded per face with a directional sun, posterised into a
few light levels, textured procedurally (shingles, siding, bricks, glass...),
then outlined like hand-drawn sprites. A cast shadow is projected onto the
ground.
"""
import numpy as np
from PIL import Image, ImageDraw, ImageFont

# Camera: ~46 degrees above the horizon (lower than a pure top-down view, so
# walls read tall and the ground is foreshortened - "2.5D, a little less").
GY = 0.75                                           # ground depth compression (tiles are 32 x 24)
PITCH = 0.74                                        # screen texels per unit of height (x RES)
SKEW = -0.10                                        # slight lean left -> the right-hand side walls show
VIEW = np.array([-SKEW, PITCH / GY, 1.0])
VIEW = VIEW / np.linalg.norm(VIEW)                 # direction towards the camera
LIGHT = np.array([-0.40, 0.42, 0.84])
LIGHT = LIGHT / np.linalg.norm(LIGHT)              # direction towards the sun (upper-left front)
AMBIENT = 0.46
DIFFUSE = 0.62
LEVELS = 14                                         # posterised light levels (hi-bit: smoother, still banded)
RES = 4                                             # texels per world unit (1 texel = 1 screen px in game)
LW = 1.1 / RES                                      # thin line width in world units (~1 texel)
LAST_LIGHTS = []                                    # light points of the most recent render


class camera:
    """Temporarily change the camera skew (e.g. 0 for thin upright props)."""
    def __init__(self, skew):
        self.skew = skew

    def __enter__(self):
        global SKEW, VIEW
        self.prev = SKEW
        SKEW = self.skew
        VIEW = norm(np.array([-SKEW, PITCH / GY, 1.0]))

    def __exit__(self, *exc):
        global SKEW, VIEW
        SKEW = self.prev
        VIEW = norm(np.array([-SKEW, PITCH / GY, 1.0]))


def norm(v):
    v = np.asarray(v, float)
    n = np.linalg.norm(v)
    return v / n if n else v


def proj(p):
    p = np.asarray(p, float)
    return RES * np.stack([p[..., 0] + SKEW * p[..., 2], GY * p[..., 1] - PITCH * p[..., 2]], -1)


# ------------------------------------------------------------------ noise ---

def hash3(ix, iy, iz=0, seed=0):
    ix = np.asarray(ix, np.int64)
    iy = np.asarray(iy, np.int64)
    iz = np.asarray(iz, np.int64)
    h = (ix * 73856093) ^ (iy * 19349663) ^ (iz * 83492791) ^ (seed * 2654435761)
    h &= 0xFFFFFFFF
    h = ((h ^ (h >> 13)) * 1274126177) & 0xFFFFFFFF
    return ((h ^ (h >> 16)) & 0xFFFF) / 65535.0


def c(hexstr):
    hexstr = hexstr.lstrip('#')
    return np.array([int(hexstr[i:i + 2], 16) for i in (0, 2, 4)], float)


# ---------------------------------------------------------------- shaders ---
# A shader gets world points P (N,3), face uv (N,2) and the face normal and
# returns (rgb (N,3) in 0..255, emissive mask (N,) or None).

def flat(col, jitter=0, seed=1):
    col = c(col) if isinstance(col, str) else np.asarray(col, float)

    def sh(P, uv, n):
        out = np.tile(col, (len(P), 1))
        if jitter:
            j = (hash3(np.floor(P[:, 0]), np.floor(P[:, 1]), np.floor(P[:, 2]), seed) - 0.5) * 2 * jitter
            out = out + j[:, None]
        return out, None
    return sh


def glow(col):
    col = c(col)

    def sh(P, uv, n):
        return np.tile(col, (len(P), 1)), np.ones(len(P), bool)
    return sh


def shingles(col, row=5, tile=7, seed=3):
    base = c(col)

    def sh(P, uv, n):
        u, v = uv[:, 0], uv[:, 1]
        r = np.floor(v / row)
        off = (r % 2) * tile / 2
        t = np.floor((u + off) / tile)
        tint = (hash3(t, r, 0, seed) - 0.5) * 22
        frac = (v % row) / row                      # 0 at the lower edge of a row
        out = base[None] * (0.96 + 0.16 * frac[:, None]) + tint[:, None]
        groove = ((u + off) % tile) < LW
        lip = frac < 0.22
        out = np.where(groove[:, None], out * 0.84, out)
        out = np.where(lip[:, None], out * 0.72, out)
        return out, None
    return sh


def siding(col, spacing=3, seed=5):
    base = c(col)

    def sh(P, uv, n):
        v = uv[:, 1]
        line = (v % spacing) < LW
        out = np.tile(base, (len(P), 1)) + (hash3(np.floor(uv[:, 0] / 7), np.floor(v / spacing), 0, seed)[:, None] - 0.5) * 8
        out = np.where(line[:, None], out * 0.86, out)
        return out, None
    return sh


def bricks(col, h=3, w=6, mortar='#d8d0c0', seed=7):
    base = c(col)
    mort = c(mortar)

    def sh(P, uv, n):
        u, v = uv[:, 0], uv[:, 1]
        r = np.floor(v / h)
        off = (r % 2) * w / 2
        t = np.floor((u + off) / w)
        out = base[None] + (hash3(t, r, 0, seed)[:, None] - 0.5) * 26
        m = ((v % h) < LW) | (((u + off) % w) < LW)
        out = np.where(m[:, None], mort[None] * 0.9, out)
        return out, None
    return sh


def stone(col, size=5, seed=9):
    base = c(col)

    def sh(P, uv, n):
        u, v = uv[:, 0], uv[:, 1]
        r = np.floor(v / size)
        off = (r % 2) * size * 0.6
        t = np.floor((u + off) / (size * 1.6))
        out = base[None] + (hash3(t, r, 1, seed)[:, None] - 0.5) * 18
        m = ((v % size) < LW) | ((((u + off) % (size * 1.6))) < LW)
        out = np.where(m[:, None], out * 0.8, out)
        return out, None
    return sh


def worley3(x, y, z, seed=0):
    """Cellular noise: F1, F2 distances and the offset to the nearest cell point."""
    ix, iy, iz = np.floor(x), np.floor(y), np.floor(z)
    f1 = np.full(len(x), 9.0)
    f2 = np.full(len(x), 9.0)
    off = np.zeros((len(x), 3))
    for dx in (-1, 0, 1):
        for dy in (-1, 0, 1):
            for dz in (-1, 0, 1):
                cx, cy, cz = ix + dx, iy + dy, iz + dz
                ox = x - (cx + 0.15 + 0.7 * hash3(cx, cy, cz, seed))
                oy = y - (cy + 0.15 + 0.7 * hash3(cx, cy, cz, seed + 7))
                oz = z - (cz + 0.15 + 0.7 * hash3(cx, cy, cz, seed + 13))
                d = np.sqrt(ox * ox + oy * oy + oz * oz)
                closer = d < f1
                f2 = np.where(closer, f1, np.minimum(f2, d))
                off = np.where(closer[:, None], np.stack([ox, oy, oz], -1), off)
                f1 = np.minimum(f1, d)
    return f1, f2, off


def foliage(col, seed=11, scale=3.2):
    """Leaf clumps: every cell of a cellular noise is lit like a little sphere
    (bright on the sun side, dark underneath), with soft gaps between clumps."""
    base = c(col)

    def sh(P, uv, n):
        x, y, z = P[:, 0] / scale, P[:, 1] / scale, P[:, 2] / scale
        f1, f2, off = worley3(x, y, z, seed)
        dn = off / (np.linalg.norm(off, axis=1, keepdims=True) + 1e-6)
        lit = np.clip(dn @ LIGHT, -1, 1)
        gap = np.clip((f2 - f1) / 0.22, 0, 1)
        tint = hash3(np.floor(x), np.floor(y), np.floor(z), seed + 3)
        k = 0.78 + 0.26 * lit + 0.06 * (tint - 0.5)
        k = k * (0.8 + 0.2 * gap)
        out = base[None] * k[:, None]
        # a few sunlit leaf tips
        spark = (lit > 0.8) & (hash3(np.floor(x * 4), np.floor(y * 4), np.floor(z * 4), seed + 5) > 0.7)
        out = np.where(spark[:, None], out * 1.12 + 10, out)
        return out, None
    return sh


def logs(col, h=3.2, seed=13):
    base = c(col)

    def sh(P, uv, n):
        v = uv[:, 1]
        frac = (v % h) / h
        out = base[None] * (0.72 + 0.42 * np.sin(np.pi * frac)[:, None])
        out = out + (hash3(np.floor(uv[:, 0] / 5), np.floor(v / h), 0, seed)[:, None] - 0.5) * 16
        gap = frac < 0.12
        return np.where(gap[:, None], base * 0.45, out), None
    return sh


def stucco(col, seed=17):
    base = c(col)

    def sh(P, uv, n):
        h = hash3(np.floor(uv[:, 0] * 2), np.floor(uv[:, 1] * 2), 0, seed)
        return base[None] * (0.96 + 0.07 * h[:, None]), None
    return sh


def planks(col, w=3.2, seed=19):
    base = c(col)

    def sh(P, uv, n):
        u = uv[:, 0]
        k = np.floor(u / w)
        out = base[None] * (0.9 + 0.18 * hash3(k, 0, 0, seed)[:, None])
        return np.where(((u % w) < LW)[:, None], base * 0.6, out), None
    return sh


def water(col='#3f8fd8', seed=23):
    base = c(col)

    def sh(P, uv, n):
        h = hash3(np.floor(P[:, 0] / 2), np.floor(P[:, 1] / 1.2), 0, seed)
        out = base[None] * (0.92 + 0.12 * h[:, None])
        return np.where((h > 0.93)[:, None], np.array([220, 240, 255]), out), None
    return sh


def decal(base_shader, decals):
    """decals: list of ((u0, v0, u1, v1), fn(u_local, v_local, w, h) -> (rgb, alpha, emit))."""
    def sh(P, uv, n):
        out, emit = base_shader(P, uv, n)
        emit = np.zeros(len(P), bool) if emit is None else emit.copy()
        for (u0, v0, u1, v1), fn in decals:
            m = (uv[:, 0] >= u0) & (uv[:, 0] < u1) & (uv[:, 1] >= v0) & (uv[:, 1] < v1)
            if not m.any():
                continue
            rgb, alpha, em = fn(uv[m, 0] - u0, uv[m, 1] - v0, u1 - u0, v1 - v0)
            a = alpha[:, None]
            out[m] = out[m] * (1 - a) + rgb * a
            if em is not None:
                emit[m] = emit[m] | (em & (alpha > 0.5))
        return out, emit
    return sh


# ------------------------------------------------------------ decal kinds ---

def window_decal(frame='#fbf6ea', glass='#7fc4ea', cross=True, lit=True):
    # lit=True: glass ignores the sun (reads as glass) and is recorded as a night light point
    fr, gl = c(frame), c(glass)

    def fn(u, v, w, h):
        rgb = np.tile(gl, (len(u), 1))
        # vertical glass gradient + diagonal glint
        rgb = rgb * (0.78 + 0.32 * (v / h))[:, None]
        glint = ((u + (h - v)) % 9 < 1.1) & (u > LW) & (v > LW)
        rgb = np.where(glint[:, None], np.minimum(255, rgb + 70), rgb)
        border = (u < 0.8) | (u >= w - 0.8) | (v < 0.8) | (v >= h - 0.8)
        if cross:
            border |= (np.abs(u - w / 2) < LW / 2 + 0.01) | (np.abs(v - h / 2) < LW / 2 + 0.01)
        rgb = np.where(border[:, None], fr, rgb)
        return rgb, np.ones(len(u)), (np.full(len(u), lit) & ~border)
    return fn


def door_decal(wood='#9c6a44', frame='#6b4428', knob='#f2c65a', glass=None):
    wd, fr, kn = c(wood), c(frame), c(knob)

    def fn(u, v, w, h):
        rgb = np.tile(wd, (len(u), 1)) * (0.92 + 0.1 * ((u % 2) < LW))[:, None]
        panel = ((np.abs(u - w * 0.3) < w * 0.16) | (np.abs(u - w * 0.7) < w * 0.16)) & ((np.abs(v - h * 0.3) < h * 0.14) | (np.abs(v - h * 0.7) < h * 0.14))
        rgb = np.where(panel[:, None], rgb * 0.84, rgb)
        if glass is not None:
            g = (v > h * 0.45) & (v < h - 2) & (u > 1.5) & (u < w - 1.5)
            rgb = np.where(g[:, None], c(glass) * (0.8 + 0.3 * (v / h))[:, None], rgb)
            rgb = np.where((g & (np.abs(u - w / 2) < LW / 2 + 0.01))[:, None], fr, rgb)
        border = (u < 0.8) | (u >= w - 0.8) | (v >= h - 0.8)
        rgb = np.where(border[:, None], fr, rgb)
        k = (np.abs(u - (w - 2.5)) < 0.6) & (np.abs(v - h * 0.45) < 0.6)
        rgb = np.where(k[:, None], kn, rgb)
        return rgb, np.ones(len(u)), None
    return fn


def rect_decal(col, border=None, emit=False):
    cc = c(col)
    bc = c(border) if border else None

    def fn(u, v, w, h):
        rgb = np.tile(cc, (len(u), 1))
        if bc is not None:
            b = (u < LW) | (u >= w - LW) | (v < LW) | (v >= h - LW)
            rgb = np.where(b[:, None], bc, rgb)
        return rgb, np.ones(len(u)), np.full(len(u), emit)
    return fn


def text_decal(txt, fg='#2f63c8', bg='#ffffff', border='#262a3b', size=None):
    """Bitmap text rendered with PIL's built-in pixel font, stretched to the rect."""
    font = ImageFont.load_default()
    bbox = font.getbbox(txt)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    img = Image.new('L', (tw + 2, th + 2), 0)
    ImageDraw.Draw(img).text((1 - bbox[0], 1 - bbox[1]), txt, fill=255, font=font)
    mask = np.asarray(img) > 100
    fgc, bgc, bc = c(fg), c(bg), c(border) if border else None

    def fn(u, v, w, h):
        # centre the text without stretching when it fits
        mh, mw = mask.shape
        ox = (w - mw) / 2
        oy = (h - mh) / 2
        iu = np.floor(u - ox).astype(int)
        iv = np.floor((h - 1 - v) - oy).astype(int)  # v runs upwards on walls
        inside = (iu >= 0) & (iu < mw) & (iv >= 0) & (iv < mh)
        on = np.zeros(len(u), bool)
        on[inside] = mask[iv[inside], iu[inside]]
        rgb = np.where(on[:, None], fgc, bgc)
        if bc is not None:
            b = (u < 1) | (u >= w - 1) | (v < 1) | (v >= h - 1)
            rgb = np.where(b[:, None], bc, rgb)
        return rgb, np.ones(len(u)), None
    return fn


def emblem_decal(col_a='#9945ff', col_b='#14f195', ring='#ecbc48'):
    a, b, r = c(col_a), c(col_b), c(ring)

    def fn(u, v, w, h):
        cx, cy = w / 2, h / 2
        d = np.sqrt((u + 0.5 - cx) ** 2 + (v + 0.5 - cy) ** 2)
        R = min(w, h) / 2
        t = np.clip((u / max(1, w)), 0, 1)[:, None]
        rgb = a * (1 - t) + b * t
        rgb = np.where((d > R - 0.9)[:, None], r, rgb)
        alpha = (d <= R).astype(float)
        return rgb, alpha, None
    return fn


# --------------------------------------------------------------- renderer ---

class Model:
    def __init__(self):
        self.tris = []      # (P0, P1, P2, shader, frame(o,u,v) or None, cast_shadow)
        self.ells = []      # (center, radii, shader)

    # ---- primitives ----
    def tri(self, a, b, cc, shader, frame=None, shadow=True):
        self.tris.append((np.array(a, float), np.array(b, float), np.array(cc, float), shader, frame, shadow))

    def quad(self, a, b, cc, d, shader, frame=None, shadow=True):
        """a->b is the face's u direction, a->d its v direction."""
        a, b, cc, d = (np.array(p, float) for p in (a, b, cc, d))
        if frame is None:
            frame = (a, norm(b - a), norm(d - a))
        self.tri(a, b, cc, shader, frame, shadow)
        self.tri(a, cc, d, shader, frame, shadow)

    def box(self, x0, y0, z0, x1, y1, z1, sh, top=None, south=None, north=None, east=None, west=None, shadow=True):
        top = top or sh
        south = south or sh
        north = north or sh
        east = east or sh
        west = west or sh
        # top (u = x, v = -y so v runs "up" the screen)
        self.quad((x0, y1, z1), (x1, y1, z1), (x1, y0, z1), (x0, y0, z1), top, shadow=shadow)
        # south face (towards camera): u = x, v = z
        self.quad((x0, y1, z0), (x1, y1, z0), (x1, y1, z1), (x0, y1, z1), south, shadow=shadow)
        self.quad((x1, y0, z0), (x0, y0, z0), (x0, y0, z1), (x1, y0, z1), north, shadow=shadow)
        self.quad((x1, y1, z0), (x1, y0, z0), (x1, y0, z1), (x1, y1, z1), east, shadow=shadow)
        self.quad((x0, y0, z0), (x0, y1, z0), (x0, y1, z1), (x0, y0, z1), west, shadow=shadow)

    def gable_x(self, x0, x1, y0, y1, zb, zr, roof_sh, gable_sh, fascia_sh=None, thick=2, back_sh=None):
        """Gable roof with the ridge running east-west (both slopes visible)."""
        ym = (y0 + y1) / 2
        # south slope: u = x, v = distance up-slope from the eave
        self.quad((x0, y1, zb), (x1, y1, zb), (x1, ym, zr), (x0, ym, zr), roof_sh)
        # north slope, seen from above/behind; v up-slope from the north eave
        self.quad((x1, y0, zb), (x0, y0, zb), (x0, ym, zr), (x1, ym, zr), back_sh or roof_sh)
        self.tri((x0, y0, zb), (x0, y1, zb), (x0, ym, zr), gable_sh)
        self.tri((x1, y1, zb), (x1, y0, zb), (x1, ym, zr), gable_sh)
        if fascia_sh is not None:   # roof thickness along the front eave and the rakes
            self.quad((x0, y1, zb - thick), (x1, y1, zb - thick), (x1, y1, zb), (x0, y1, zb), fascia_sh)
            for xx in (x0, x1):
                self.quad((xx, y1, zb - thick), (xx, ym, zr - thick), (xx, ym, zr), (xx, y1, zb), fascia_sh)
                self.quad((xx, ym, zr - thick), (xx, y0, zb - thick), (xx, y0, zb), (xx, ym, zr), fascia_sh)

    def gable_y(self, x0, x1, y0, y1, zb, zr, roof_sh, gable_sh, fascia_sh=None, thick=2):
        """Gable roof with the ridge running north-south (a pediment faces the camera)."""
        xm = (x0 + x1) / 2
        self.quad((x0, y1, zb), (x0, y0, zb), (xm, y0, zr), (xm, y1, zr), roof_sh,
                  frame=(np.array((x0, y1, zb), float), np.array((0, -1.0, 0)), norm((xm - x0, 0, zr - zb))))
        self.quad((x1, y0, zb), (x1, y1, zb), (xm, y1, zr), (xm, y0, zr), roof_sh,
                  frame=(np.array((x1, y0, zb), float), np.array((0, 1.0, 0)), norm((xm - x1, 0, zr - zb))))
        # south pediment: u = x, v = z (from zb)
        self.tri((x0, y1, zb), (x1, y1, zb), (xm, y1, zr), gable_sh,
                 frame=(np.array((x0, y1, zb), float), np.array((1.0, 0, 0)), np.array((0, 0, 1.0))))
        self.tri((x1, y0, zb), (x0, y0, zb), (xm, y0, zr), gable_sh)
        if fascia_sh is not None:
            self.quad((x0, y1, zb - thick), (x1, y1, zb - thick), (x1, y1, zb), (x0, y1, zb), fascia_sh)

    def prism(self, cx, cy, z0, z1, r, sh, sides=8, top=None):
        pts = [(cx + r * np.cos(2 * np.pi * (i + 0.5) / sides), cy + r * np.sin(2 * np.pi * (i + 0.5) / sides)) for i in range(sides)]
        for i in range(sides):
            (ax, ay), (bx, by) = pts[i], pts[(i + 1) % sides]
            self.quad((ax, ay, z0), (bx, by, z0), (bx, by, z1), (ax, ay, z1), sh)
        top = top or sh
        for i in range(sides):
            (ax, ay), (bx, by) = pts[i], pts[(i + 1) % sides]
            self.tri((cx, cy, z1), (ax, ay, z1), (bx, by, z1), top)

    def hip(self, x0, x1, y0, y1, zb, zr, roof_sh, fascia_sh=None, thick=2):
        """Hip roof: four slopes up to a ridge along x."""
        ym = (y0 + y1) / 2
        d = min((y1 - y0) / 2, (x1 - x0) / 2 - 0.5)
        self.quad((x0, y1, zb), (x1, y1, zb), (x1 - d, ym, zr), (x0 + d, ym, zr), roof_sh)
        self.quad((x1, y0, zb), (x0, y0, zb), (x0 + d, ym, zr), (x1 - d, ym, zr), roof_sh)
        self.tri((x0, y0, zb), (x0, y1, zb), (x0 + d, ym, zr), roof_sh,
                 frame=(np.array((x0, y1, zb), float), np.array((0, -1.0, 0)), norm((d, 0, zr - zb))))
        self.tri((x1, y1, zb), (x1, y0, zb), (x1 - d, ym, zr), roof_sh,
                 frame=(np.array((x1, y0, zb), float), np.array((0, 1.0, 0)), norm((-d, 0, zr - zb))))
        if fascia_sh is not None:
            self.quad((x0, y1, zb - thick), (x1, y1, zb - thick), (x1, y1, zb), (x0, y1, zb), fascia_sh)
            self.quad((x1, y1, zb - thick), (x1, y0, zb - thick), (x1, y0, zb), (x1, y1, zb), fascia_sh)

    def cone(self, cx, cy, z0, z1, r0, r1, sh, sides=12, top=None):
        """Tapered prism (towers, conical roofs when r1 == 0)."""
        p0 = [(cx + r0 * np.cos(2 * np.pi * (i + 0.5) / sides), cy + r0 * np.sin(2 * np.pi * (i + 0.5) / sides)) for i in range(sides)]
        p1 = [(cx + r1 * np.cos(2 * np.pi * (i + 0.5) / sides), cy + r1 * np.sin(2 * np.pi * (i + 0.5) / sides)) for i in range(sides)]
        for i in range(sides):
            j = (i + 1) % sides
            if r1 > 0:
                self.quad((*p0[i], z0), (*p0[j], z0), (*p1[j], z1), (*p1[i], z1), sh)
            else:
                self.tri((*p0[i], z0), (*p0[j], z0), (cx, cy, z1), sh)
        if r1 > 0:
            for i in range(sides):
                j = (i + 1) % sides
                self.tri((cx, cy, z1), (*p1[i], z1), (*p1[j], z1), top or sh)

    def disk(self, cx, cy, z0, z1, rx, ry, top_sh, side_sh, sides=48):
        """Elliptical slab (battle platforms)."""
        pts = [(cx + rx * np.cos(2 * np.pi * i / sides), cy + ry * np.sin(2 * np.pi * i / sides)) for i in range(sides)]
        for i in range(sides):
            (ax, ay), (bx, by) = pts[i], pts[(i + 1) % sides]
            u = norm((bx - ax, by - ay, 0))
            self.quad((ax, ay, z0), (bx, by, z0), (bx, by, z1), (ax, ay, z1), side_sh,
                      frame=(np.array((ax, ay, z0)), u, np.array((0, 0, 1.0))))
            self.tri((cx, cy, z1), (ax, ay, z1), (bx, by, z1), top_sh,
                     frame=(np.array((cx, cy, z1)), np.array((1.0, 0, 0)), np.array((0, -1.0, 0))))

    def ellipsoid(self, center, radii, sh):
        self.ells.append((np.array(center, float), np.array(radii, float), sh))

    # ---- render ----
    def _all_tris(self):
        """Triangles for shadow casting (ellipsoids tessellated)."""
        tris = [(P0, P1, P2) for P0, P1, P2, _sh, _f, cast in self.tris if cast]
        for cen, rad, _ in self.ells:
            nl, nm = 8, 14
            pts = [[cen + rad * np.array([np.cos(ph) * np.cos(th), np.cos(ph) * np.sin(th), np.sin(ph)])
                    for th in np.linspace(0, 2 * np.pi, nm, endpoint=False)]
                   for ph in np.linspace(-np.pi / 2, np.pi / 2, nl)]
            for i in range(nl - 1):
                for j in range(nm):
                    a, b = pts[i][j], pts[i][(j + 1) % nm]
                    cc, d = pts[i + 1][(j + 1) % nm], pts[i + 1][j]
                    tris += [(a, b, cc), (a, cc, d)]
        return tris

    def _shadow_map(self, res=None):
        res = res or 2.0 * RES
        a = norm(np.cross(LIGHT, [0, 0, 1.0]))
        b = np.cross(LIGHT, a)
        tris = self._all_tris()
        allp = np.array([p for t in tris for p in t])
        uv = np.stack([allp @ a, allp @ b], -1) * res
        lo = np.floor(uv.min(0)) - 2
        size = (np.ceil(uv.max(0)) - lo + 3).astype(int)
        smap = np.full((size[1], size[0]), -np.inf)
        for P0, P1, P2 in tris:
            s0, s1, s2 = ((np.array([P @ a, P @ b]) * res - lo) for P in (P0, P1, P2))
            g = self._bary_grid(s0, s1, s2, size[1], size[0])
            if g is None:
                continue
            gy, gx, w0, w1, w2 = g
            dep = w0 * (P0 @ LIGHT) + w1 * (P1 @ LIGHT) + w2 * (P2 @ LIGHT)
            np.maximum.at(smap, (gy, gx), dep)

        def occluded(P, bias=1.6):
            t = np.floor(np.stack([P @ a, P @ b], -1) * res - lo).astype(int)
            ok = (t[:, 0] >= 0) & (t[:, 0] < size[0]) & (t[:, 1] >= 0) & (t[:, 1] < size[1])
            occ = np.zeros(len(P), bool)
            d = P @ LIGHT
            occ[ok] = d[ok] < smap[t[ok, 1], t[ok, 0]] - bias
            return occ
        return occluded

    def render(self, anchor_world, margin=3, shadow_alpha=0.34, outline=True, cast=True, blob=None, seamless_x=False, crop_x=None):
        """Render to an RGBA array. Returns (img, (ax, ay)) where (ax, ay) is the
        pixel of `anchor_world` (usually the footprint's bottom-left ground corner)."""
        pts = []
        for P0, P1, P2, *_ in self.tris:
            for P in (P0, P1, P2):
                pts += [P, self._shadow_point(P)]
        for cen, rad, _ in self.ells:
            for sx in (-1, 1):
                for sy in (-1, 1):
                    for sz in (-1, 1):
                        p = cen + rad * np.array([sx, sy, sz])
                        pts += [p, self._shadow_point(p)]
        S = proj(np.array(pts))
        minx, miny = np.floor(S.min(0)) - margin * RES
        maxx, maxy = np.ceil(S.max(0)) + margin * RES
        W, H = int(maxx - minx), int(maxy - miny)
        off = np.array([-minx, -miny])

        base = np.zeros((H, W, 3))
        difb = np.zeros((H, W))
        Pb = np.zeros((H, W, 3))
        depth = np.full((H, W), -np.inf)
        emit = np.zeros((H, W), bool)
        for P0, P1, P2, sh, frame, _cast in self.tris:
            self._raster_tri(P0, P1, P2, sh, frame, off, base, difb, Pb, depth, emit)
        for cen, rad, sh in self.ells:
            self._raster_ellipsoid(cen, rad, sh, off, base, difb, Pb, depth, emit)

        occluded = self._shadow_map()
        solid = np.isfinite(depth)
        occ = np.zeros((H, W), bool)
        occ[solid] = occluded(Pb[solid])
        shade = AMBIENT + DIFFUSE * difb * np.where(occ, 0.08, 1.0)
        shade = shade * np.clip(0.8 + Pb[..., 2] / 25.0, 0.8, 1.0)          # ambient occlusion at the base
        shade = np.round(shade * LEVELS) / LEVELS
        lit = base * shade[..., None]
        # cool sky bounce in the shade, warm sun on lit faces (hi-bit colour)
        cool = np.array([0.86, 0.92, 1.12])
        warm = np.array([1.05, 1.0, 0.92])
        t = np.clip((shade - AMBIENT) / DIFFUSE, 0, 1)[..., None]
        lit = lit * (cool * (1 - t) + warm * t)
        rgb = np.where(emit[..., None], base, lit)

        out = np.zeros((H, W, 4))
        out[..., :3] = rgb
        out[..., 3] = np.where(solid, 255, 0)

        if outline:
            d = np.where(solid, depth, -1e9)
            crease = np.zeros_like(solid)
            for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0)):
                nb = np.roll(np.roll(d, dy, 0), dx, 1)
                crease |= solid & (nb - d > 3.5)
            out[..., :3] = np.where(crease[..., None], out[..., :3] * 0.66, out[..., :3])
            edge = np.zeros_like(solid)
            dirs = ((1, 0), (-1, 0)) if seamless_x else ((0, 1), (0, -1), (1, 0), (-1, 0))
            for dy, dx in dirs:
                edge |= solid & ~np.roll(np.roll(solid, dy, 0), dx, 1)
            out[..., :3] = np.where(edge[..., None], out[..., :3] * 0.42 + np.array([20, 18, 34]) * 0.3, out[..., :3])

        # ground shadow: empty pixels whose ground point can't see the sun,
        # or (for thin props) a small contact blob under the base
        gy, gx = np.nonzero(~solid)
        Pg = np.stack([(gx + 0.5 - off[0]) / RES, (gy + 0.5 - off[1]) / (RES * GY), np.zeros(len(gx))], -1)
        gocc = occluded(Pg, bias=0.5) if cast else np.zeros(len(gx), bool)
        if blob is not None:
            bx, by, brx, bry = blob
            gocc |= ((Pg[:, 0] - bx) / brx) ** 2 + ((Pg[:, 1] - by) / bry) ** 2 <= 1
        out[gy[gocc], gx[gocc], 3] = 255 * shadow_alpha
        out[gy[gocc], gx[gocc], :3] = np.array([18, 24, 40])

        a = proj(np.array(anchor_world, float)) + off
        img = np.clip(out, 0, 255).astype(np.uint8)
        ax, ay = int(round(a[0])), int(round(a[1]))
        # light points for the night system: centroids of emissive blobs, relative to the anchor
        from scipy import ndimage
        lab, n = ndimage.label(emit & solid)
        global LAST_LIGHTS
        self.last_lights = LAST_LIGHTS = []
        for i in range(1, n + 1):
            ys, xs = np.nonzero(lab == i)
            if len(ys) < 3:
                continue
            col = rgb[ys, xs].mean(0)
            self.last_lights.append([round(float(xs.mean()) - ax, 1), round(float(ys.mean()) - ay, 1), int(len(ys)),
                                     '#%02x%02x%02x' % tuple(int(min(255, v)) for v in col)])
        if crop_x is not None:
            # keep exactly [anchor_x, anchor_x + crop_x) so segments butt together seamlessly
            x0 = ax
            img = img[:, x0:x0 + crop_x]
            ax = 0
        return img, (ax, ay)

    # ---- internals ----
    @staticmethod
    def _shadow_point(P):
        return P - LIGHT * (P[2] / LIGHT[2])

    @staticmethod
    def _bary_grid(s0, s1, s2, H, W):
        xs = [s0[0], s1[0], s2[0]]
        ys = [s0[1], s1[1], s2[1]]
        x0, x1 = max(0, int(np.floor(min(xs)))), min(W - 1, int(np.ceil(max(xs))))
        y0, y1 = max(0, int(np.floor(min(ys)))), min(H - 1, int(np.ceil(max(ys))))
        if x1 < x0 or y1 < y0:
            return None
        gy, gx = np.mgrid[y0:y1 + 1, x0:x1 + 1]
        px, py = gx + 0.5, gy + 0.5
        area = (s1[0] - s0[0]) * (s2[1] - s0[1]) - (s1[1] - s0[1]) * (s2[0] - s0[0])
        if abs(area) < 1e-6:
            return None
        w0 = ((s1[0] - px) * (s2[1] - py) - (s1[1] - py) * (s2[0] - px)) / area
        w1 = ((s2[0] - px) * (s0[1] - py) - (s2[1] - py) * (s0[0] - px)) / area
        w2 = 1 - w0 - w1
        eps = -1e-4
        inside = (w0 >= eps) & (w1 >= eps) & (w2 >= eps)
        return gy[inside], gx[inside], w0[inside], w1[inside], w2[inside]

    def _raster_tri(self, P0, P1, P2, sh, frame, off, base, difb, Pb, depth, emit):
        H, W = depth.shape
        s0, s1, s2 = proj(P0) + off, proj(P1) + off, proj(P2) + off
        g = self._bary_grid(s0, s1, s2, H, W)
        if g is None:
            return
        gy, gx, w0, w1, w2 = g
        if not len(gy):
            return
        P = w0[:, None] * P0 + w1[:, None] * P1 + w2[:, None] * P2
        dz = P @ VIEW
        closer = dz > depth[gy, gx] + 1e-6
        if not closer.any():
            return
        gy, gx, P, dz = gy[closer], gx[closer], P[closer], dz[closer]
        n = norm(np.cross(P1 - P0, P2 - P0))
        if n @ VIEW < 0:
            n = -n
        if frame is None:
            o, u, v = P0, norm(P1 - P0), norm(np.cross(n, norm(P1 - P0)))
        else:
            o, u, v = frame
        uv = np.stack([(P - o) @ u, (P - o) @ v], -1)
        col, em = sh(P, uv, n)
        base[gy, gx] = col
        difb[gy, gx] = max(0.0, float(n @ LIGHT))
        Pb[gy, gx] = P
        emit[gy, gx] = em if em is not None else False
        depth[gy, gx] = dz

    def _raster_ellipsoid(self, cen, rad, sh, off, base, difb, Pb, depth, emit):
        H, W = depth.shape
        sc = proj(cen) + off
        ext = (np.abs(rad).max() * 1.5 + 2) * RES
        x0, x1 = max(0, int(sc[0] - ext)), min(W - 1, int(sc[0] + ext))
        y0, y1 = max(0, int(sc[1] - ext)), min(H - 1, int(sc[1] + ext))
        gy, gx = np.mgrid[y0:y1 + 1, x0:x1 + 1]
        sx = (gx + 0.5 - off[0]) / RES
        sy = (gy + 0.5 - off[1]) / RES
        # points on the view line: x = sx - SKEW z, y = (sy + PITCH z) / GY, z = z
        ax = -SKEW / rad[0]
        bx = (sx - cen[0]) / rad[0]
        ay = PITCH / GY / rad[1]
        by = (sy / GY - cen[1]) / rad[1]
        az = 1 / rad[2]
        bz = -cen[2] / rad[2]
        A = ax * ax + ay * ay + az * az
        B = 2 * (ax * bx + ay * by + az * bz)
        C = bx * bx + by * by + bz * bz - 1
        disc = B * B - 4 * A * C
        hit = disc >= 0
        if not hit.any():
            return
        z = (-B + np.sqrt(np.where(hit, disc, 0))) / (2 * A)       # nearest to camera
        P = np.stack([sx - SKEW * z, (sy + PITCH * z) / GY, z], -1)[hit]
        gyh, gxh = gy[hit], gx[hit]
        dz = P @ VIEW
        closer = dz > depth[gyh, gxh]
        P, gyh, gxh, dz = P[closer], gyh[closer], gxh[closer], dz[closer]
        if not len(P):
            return
        nrm = (P - cen) / (rad ** 2)
        nrm = nrm / np.linalg.norm(nrm, axis=1, keepdims=True)
        col, em = sh(P, np.zeros((len(P), 2)), None)
        base[gyh, gxh] = col
        difb[gyh, gxh] = np.clip(nrm @ LIGHT, 0, 1)
        Pb[gyh, gxh] = P
        depth[gyh, gxh] = dz


def save_png(arr, path):
    Image.fromarray(arr, 'RGBA').save(path)
