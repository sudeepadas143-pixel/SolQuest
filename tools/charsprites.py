"""Hi-fi character sprites for the overworld.

Characters are resampled straight from the supplied art to ~96 texels tall
(1 texel = 1 screen pixel in game) with a block-median filter, so the source's
pixel art survives almost exactly. Walk and run cycles are then *posed* from
the idle views: legs are cut out and swung/lifted, arms swing, the body bobs
and leans - so the feet and hands really move.
"""
import os

import numpy as np
from scipy import ndimage

from process_assets import load_rgba, key_background, clean_components, crop, block_downscale, split_turnaround, quantize


def extract(name, **kw):
    a = load_rgba(name)
    fg = key_background(a, **kw)
    fg = ndimage.binary_opening(fg, iterations=1) | (fg & (a[..., :3].max(axis=2) < 60))
    fg = clean_components(fg, keep_frac=0.002, drop_edge_slivers=False)
    return crop(a, fg)


def to_height(c, H, colors=64):
    small = block_downscale(c, th=H)
    return quantize(small, colors)


def mirror(img):
    return img[:, ::-1].copy()


# ------------------------------------------------------------ posing ------
# Frames are made the way a pixel artist edits a sprite: whole limbs move
# rigidly by one or two *art* pixels (u texels), nothing is sheared or
# squashed, and vacated pixels are filled from the limb itself (a sleeve or
# trouser leg simply gets a little longer). That keeps every frame crisp.

def is_skin(rgb):
    r, g, b = rgb[..., 0].astype(int), rgb[..., 1].astype(int), rgb[..., 2].astype(int)
    return (r > 150) & (r > g + 12) & (g > b + 8) & (r - b > 45) & (b < 200)


def opaque(a):
    return a[..., 3] > 0


def hem_row(img):
    """Row where the torso (hoodie / top / skirt) ends and the legs begin:
    the lowest place the silhouette narrows sharply going down."""
    h = img.shape[0]
    op = opaque(img)
    rows = np.where(op.any(axis=1))[0]
    top, bot = rows.min(), rows.max()
    widths = op.sum(axis=1)
    best = None
    for r in range(int(top + 0.6 * (bot - top)), int(top + 0.92 * (bot - top))):
        if widths[r] >= 1.22 * max(1, widths[r + 1]) and widths[r + 1] > 0:
            best = r + 1
    return best if best is not None else int(top + 0.78 * (bot - top))


def shift(layer, dy=0, dx=0):
    out = np.zeros_like(layer)
    h, w, _ = layer.shape
    ys, yd = (slice(0, h - dy), slice(dy, h)) if dy >= 0 else (slice(-dy, h), slice(0, h + dy))
    xs, xd = (slice(0, w - dx), slice(dx, w)) if dx >= 0 else (slice(-dx, w), slice(0, w + dx))
    out[yd, xd] = layer[ys, xs]
    return out


def over(dst, src):
    m = src[..., 3:4] > 0
    return np.where(m, src, dst)


def darken(layer, k=0.72):
    out = layer.copy()
    out[..., :3] = (out[..., :3] * k).astype(np.uint8)
    return out


def extend(layer, dy=0, dx=0):
    """Rigidly move a limb and fill the gap it leaves by repeating its edge
    (so a hand moving away from the sleeve lengthens the sleeve)."""
    out = shift(layer, dy, dx)
    steps = abs(dy) or abs(dx)
    for k in range(1, steps + 1):
        f = k / (steps + 1)
        part = shift(layer, int(round(dy * f)), int(round(dx * f)))
        out = over(part, out)
    return out


class Poser:
    def __init__(self, img, view, u):
        self.img, self.view, self.u = img, view, u
        self.h, self.w, _ = img.shape
        op = opaque(img)
        rows = np.where(op.any(axis=1))[0]
        self.top, self.bot = rows.min(), rows.max()
        self.hem = hem_row(img)
        cols = np.where(op[self.hem:].any(axis=0))[0]
        self.cx = int(round((cols.min() + cols.max() + 1) / 2)) if len(cols) else self.w // 2
        fig_h = self.bot - self.top + 1
        # hands: small skin blobs in the lower half, never the face
        skin = is_skin(img[..., :3]) & op
        skin[: int(self.top + 0.64 * fig_h)] = False
        skin[self.hem:] = False
        lab, n = ndimage.label(skin)
        self.hands = []
        cols = np.where(op.any(axis=0))[0]
        left, right = cols.min(), cols.max()
        for i in range(1, n + 1):
            m = lab == i
            if 3 <= m.sum() <= 0.03 * op.sum():
                ys, xs = np.nonzero(m)
                rel = (xs.mean() - left) / max(1, right - left)
                if view in ('down', 'up') and 0.28 < rel < 0.72:
                    continue            # front/back: hands hang at the sides
                # take the hand and the cuff just above/around it
                y0, y1 = max(0, ys.min() - u), min(self.h, ys.max() + 1)
                x0, x1 = max(0, xs.min() - 1), min(self.w, xs.max() + 2)
                box = np.zeros_like(m)
                box[y0:y1, x0:x1] = True
                self.hands.append((box & op, xs.mean()))
        self.hands.sort(key=lambda t: t[1])

    def layers(self):
        body = self.img.copy()
        body[self.hem:] = 0
        legs = self.img.copy()
        legs[:self.hem] = 0
        return body, legs

    def swing(self, body, amount):
        """Move the hands; front/back views up-down, side views fore-aft."""
        if not self.hands or not amount:
            return body
        out = body.copy()
        for k, (m, _x) in enumerate(self.hands):
            a = amount if k % 2 == 0 else -amount
            part = np.zeros_like(body)
            part[m] = body[m]
            # clear the old hand (and its outline); where it sat on top of the
            # torso, paint the torso back in from the nearest clothing pixels
            rest = opaque(out) & ~m
            ys, xs = np.nonzero(m)
            bw = xs.max() - xs.min() + 3
            inside = m & ndimage.binary_closing(rest, structure=np.ones((1, bw)))
            out[m] = 0
            src = rest & ~is_skin(out[..., :3]) & (out[..., :3].max(axis=2) > 32)
            if inside.any() and src.any():
                _, (iy, ix) = ndimage.distance_transform_edt(~src, return_indices=True)
                out[inside] = out[iy[inside], ix[inside]]
            if self.view in ('down', 'up'):
                out = over(out, extend(part, dy=a))          # sleeve lengthens as the hand drops
            else:
                fwd = -1 if self.view == 'left' else 1
                out = over(out, shift(part, dx=a * fwd))
        return out

    def front(self, lift_l=0, lift_r=0, arm=0, bob=0):
        body, legs = self.layers()
        L, R = legs.copy(), legs.copy()
        L[:, self.cx:] = 0
        R[:, :self.cx] = 0
        f = np.zeros_like(self.img)
        f = over(f, shift(L, dy=-lift_l))
        f = over(f, shift(R, dy=-lift_r))
        f = over(f, self.swing(body, arm))
        return shift(f, dy=-bob) if bob else f

    def side(self, reach=0, lift_far=0, lift_near=0, arm=0, bob=0, near_fwd=True):
        body, legs = self.layers()
        fwd = -1 if self.view == 'left' else 1
        # two rigid pieces per leg: thigh moves half as far as the shin + shoe
        knee = self.hem + (self.h - self.hem) // 2

        def leg(sign, lift):
            thigh = legs.copy(); thigh[knee:] = 0
            shin = legs.copy(); shin[:knee] = 0
            d = sign * reach * fwd
            out = over(shift(shin, dy=-lift, dx=d), shift(thigh, dx=int(round(d / 2))))
            return out
        near = leg(1 if near_fwd else -1, lift_near)
        far = darken(leg(-1 if near_fwd else 1, lift_far))
        f = np.zeros_like(self.img)
        f = over(f, far)
        f = over(f, near)
        f = over(f, self.swing(body, arm if near_fwd else -arm))
        return shift(f, dy=-bob) if bob else f


def walk_run_frames(idle, view, u, _legtop=None):
    """[idle, walk1, walk2, run1, run2, run3, run4] - classic sprite timing:
    walk = step, idle, step, idle; run = contact, passing (airborne), x2."""
    p = Poser(idle, view, u)
    if view in ('down', 'up'):
        return [
            idle,
            p.front(lift_l=u, arm=u),
            p.front(lift_r=u, arm=-u),
            p.front(lift_l=2 * u, arm=2 * u),
            p.front(bob=u, arm=0),
            p.front(lift_r=2 * u, arm=-2 * u),
            p.front(bob=u, arm=0),
        ]
    return [
        idle,
        p.side(reach=2 * u, arm=u, near_fwd=True),
        p.side(reach=2 * u, arm=u, near_fwd=False),
        p.side(reach=3 * u, lift_far=u, arm=2 * u, near_fwd=True),
        p.side(reach=0, lift_near=u, bob=u, arm=0, near_fwd=True),
        p.side(reach=3 * u, lift_far=u, arm=2 * u, near_fwd=False),
        p.side(reach=0, lift_near=u, bob=u, arm=0, near_fwd=False),
    ]


def build_player_sheet(views, u=None, pad=None, rig_prefix=None):
    """views: dict down/left/right/up -> idle RGBA (same height).
    With rig_prefix ('boy' / 'girl') the frames come from the jointed rig
    (tools/rig.py + rig_configs.py); otherwise from the simple poser."""
    order = ['down', 'left', 'right', 'up']
    rows = {}
    for d in order:
        if rig_prefix:
            import rig
            import rig_configs
            rows[d], _ = rig.frames_for(views[d], rig_configs.CONFIGS[f'{rig_prefix}_{d}'])
        else:
            p = 10
            v = views[d]
            fr = np.zeros((v.shape[0] + p, v.shape[1] + 2 * p, 4), np.uint8)
            fr[p - 1:p - 1 + v.shape[0], p:p + v.shape[1]] = v
            rows[d] = walk_run_frames(fr, d, u or 3)
    fw = max(f.shape[1] for r in rows.values() for f in r)
    fh = max(f.shape[0] for r in rows.values() for f in r)
    NF = 7
    sheet = np.zeros((fh * 4, fw * NF, 4), np.uint8)
    for row, d in enumerate(order):
        for col, fr in enumerate(rows[d]):
            h, w, _ = fr.shape
            oy, ox = fh - h, (fw - w) // 2                  # bottom-aligned, centred
            sheet[row * fh + oy:row * fh + oy + h, col * fw + ox:col * fw + ox + w] = fr
    return sheet, {"frameWidth": fw, "frameHeight": fh, "rows": order, "frames": NF,
                   "walkFrames": [1, 0, 2, 0], "runFrames": [3, 4, 5, 6]}
