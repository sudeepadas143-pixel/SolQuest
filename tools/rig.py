"""2D cut-out rig for the player's overworld walk / run cycles.

Each facing (down / left / right / up) of each player look gets a small rig:
  * the BODY (head + torso) is the supplied art with its limbs painted out;
  * ARMS (upper arm, forearm, hand) and LEGS (thigh, shin, shoe) are re-drawn
    as jointed limbs in colours sampled from the art, so they can really bend:
    elbows pump, knees lift, the back foot kicks up.
Poses are keyframes (joint angles, torso lean, bob). Everything is drawn at
4x and brought down to sprite resolution: limbs by point sampling, the leaning
torso RotSprite-style (Scale2x twice -> rotate -> majority downsample), so
rotated pixel art stays crisp. Every part gets a 1-texel outline.
"""
import math

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

SS = 4                       # supersampling factor for limbs / rotation
OUTLINE = np.array([26, 22, 34, 255], np.uint8)


# ----------------------------------------------------------------- helpers --

def mode_color(img, box, exclude_dark=True):
    x0, y0, x1, y1 = box
    reg = img[y0:y1, x0:x1].reshape(-1, 4)
    reg = reg[reg[:, 3] > 0]
    if exclude_dark:
        keep = reg[:, :3].max(axis=1) > 38
        if keep.any():
            reg = reg[keep]
    if not len(reg):
        return np.array([128, 128, 128])
    keys, counts = np.unique(reg[:, :3], axis=0, return_counts=True)
    return keys[np.argmax(counts)].astype(float)


def shade(c, k):
    return np.clip(np.asarray(c, float) * k, 0, 255)


def opaque(a):
    return a[..., 3] > 0


def scale2x(a):
    """EPX / Scale2x on an RGBA array (keeps pixel-art edges when enlarging)."""
    h, w, _ = a.shape
    key = (a[..., 0].astype(np.uint32) << 24) | (a[..., 1].astype(np.uint32) << 16) | (a[..., 2].astype(np.uint32) << 8) | a[..., 3]
    P = np.pad(key, 1, mode='edge')
    A, B, C, D = P[:-2, 1:-1], P[1:-1, 2:], P[1:-1, :-2], P[2:, 1:-1]   # up, right, left, down
    E = key
    e0 = np.where((C == A) & (C != D) & (A != B), A, E)
    e1 = np.where((A == B) & (A != C) & (B != D), B, E)
    e2 = np.where((D == C) & (D != B) & (C != A), C, E)
    e3 = np.where((B == D) & (B != A) & (D != C), D, E)
    out = np.zeros((h * 2, w * 2), np.uint32)
    out[0::2, 0::2], out[0::2, 1::2], out[1::2, 0::2], out[1::2, 1::2] = e0, e1, e2, e3
    rgba = np.stack([(out >> 24) & 255, (out >> 16) & 255, (out >> 8) & 255, out & 255], -1).astype(np.uint8)
    return rgba


def majority_down(a, k):
    """Downsample by k taking each block's most common colour (alpha by majority)."""
    h, w, _ = a.shape
    H, W = h // k, w // k
    a = a[:H * k, :W * k]
    key = (a[..., 0].astype(np.uint32) << 24) | (a[..., 1].astype(np.uint32) << 16) | (a[..., 2].astype(np.uint32) << 8) | a[..., 3]
    blocks = key.reshape(H, k, W, k).transpose(0, 2, 1, 3).reshape(H, W, k * k)
    out = np.zeros((H, W), np.uint32)
    for y in range(H):
        for x in range(W):
            b = blocks[y, x]
            opq = b[(b & 255) > 0]
            if len(opq) * 2 < len(b):
                continue
            vals, cnt = np.unique(opq, return_counts=True)
            out[y, x] = vals[np.argmax(cnt)]
    return np.stack([(out >> 24) & 255, (out >> 16) & 255, (out >> 8) & 255, out & 255], -1).astype(np.uint8)


def rotsprite(a, angle_deg, pivot):
    """Rotate pixel art about pivot (x, y) without mangling it."""
    if abs(angle_deg) < 0.01:
        return a
    big = scale2x(scale2x(a))
    im = Image.fromarray(big, 'RGBA').rotate(angle_deg, resample=Image.NEAREST, center=(pivot[0] * 4, pivot[1] * 4))
    return majority_down(np.asarray(im), 4)


def squash(a, k, pivot_y):
    """Compress everything above pivot_y vertically by k (keeps the pivot row
    fixed) - reads as a lean toward / away from the camera. RotSprite-style:
    Scale2x twice, resize, majority downsample."""
    if abs(k - 1) < 1e-3:
        return a
    top = a[:pivot_y]
    big = scale2x(scale2x(top))
    H4 = big.shape[0]
    newH = max(4, int(round(H4 * k / 4)) * 4)
    im = Image.fromarray(big, 'RGBA').resize((big.shape[1], newH), Image.NEAREST)
    small = majority_down(np.asarray(im), 4)
    out = np.zeros_like(a)
    out[pivot_y:] = a[pivot_y:]
    h = small.shape[0]
    out[pivot_y - h:pivot_y] = over(out[pivot_y - h:pivot_y], small)
    return out


def outline(layer, color=OUTLINE):
    m = opaque(layer)
    ring = ndimage.binary_dilation(m, structure=np.ones((3, 3))) & ~m
    out = layer.copy()
    out[ring] = color
    return out


def over(dst, src):
    m = src[..., 3:4] > 0
    return np.where(m, src, dst)


def shift(a, dy=0, dx=0):
    out = np.zeros_like(a)
    h, w, _ = a.shape
    ys, yd = (slice(0, h - dy), slice(dy, h)) if dy >= 0 else (slice(-dy, h), slice(0, h + dy))
    xs, xd = (slice(0, w - dx), slice(dx, w)) if dx >= 0 else (slice(-dx, w), slice(0, w + dx))
    out[yd, xd] = a[ys, xs]
    return out


# ------------------------------------------------------------ limb drawing --

class Canvas:
    """Draws limb parts at SS x and returns sprite-resolution RGBA layers."""

    def __init__(self, w, h):
        self.w, self.h = w, h

    def _layer_from(self, mask_img, color_fn):
        m = np.asarray(mask_img) > 0
        H, W = self.h, self.w
        # point-sample at texel centres, alpha by majority of the block
        blocks = m.reshape(H, SS, W, SS).sum(axis=(1, 3))
        alpha = blocks >= (SS * SS) // 2
        yy, xx = np.mgrid[0:H, 0:W]
        out = np.zeros((H, W, 4), np.uint8)
        cols = color_fn(xx + 0.5, yy + 0.5)
        out[..., :3] = np.clip(cols, 0, 255).astype(np.uint8)
        out[..., 3] = np.where(alpha, 255, 0)
        return out

    def segment(self, p0, p1, width, bands, shade_k=0.78, light=(-0.6, -0.8)):
        """Capsule from p0 to p1. bands: [(t0, t1, rgb)] along the length.
        The side facing away from the light is shaded."""
        im = Image.new('L', (self.w * SS, self.h * SS), 0)
        d = ImageDraw.Draw(im)
        (x0, y0), (x1, y1) = p0, p1
        dx, dy = x1 - x0, y1 - y0
        L = math.hypot(dx, dy) or 1e-6
        nx, ny = -dy / L, dx / L
        r = width / 2
        quad = [(x0 + nx * r, y0 + ny * r), (x1 + nx * r, y1 + ny * r), (x1 - nx * r, y1 - ny * r), (x0 - nx * r, y0 - ny * r)]
        d.polygon([(x * SS, y * SS) for x, y in quad], fill=255)
        for (cx, cy) in (p0, p1):
            d.ellipse([(cx - r) * SS, (cy - r) * SS, (cx + r) * SS, (cy + r) * SS], fill=255)
        lx, ly = light
        side = 1 if (nx * lx + ny * ly) < 0 else -1          # normal pointing away from the light

        def color_fn(X, Y):
            t = np.clip(((X - x0) * dx + (Y - y0) * dy) / (L * L), 0, 1)
            s = ((X - x0) * nx + (Y - y0) * ny) * side
            out = np.zeros(X.shape + (3,))
            for (t0, t1, c) in bands:
                m = (t >= t0) & (t <= t1)
                out[m] = c
            dark = s > r * 0.25
            out[dark] = out[dark] * shade_k
            return out
        return self._layer_from(im, color_fn)

    def blob(self, c, radius, color, shade_k=0.8):
        im = Image.new('L', (self.w * SS, self.h * SS), 0)
        d = ImageDraw.Draw(im)
        x, y = c
        d.ellipse([(x - radius) * SS, (y - radius) * SS, (x + radius) * SS, (y + radius) * SS], fill=255)

        def color_fn(X, Y):
            out = np.zeros(X.shape + (3,))
            out[:] = color
            dark = (X - x) + (Y - y) > radius * 0.5
            out[dark] = out[dark] * shade_k
            return out
        return self._layer_from(im, color_fn)

    def shoe_side(self, ankle, fwd, length, height, heel, angle_deg, upper, sole, toe_cap=None):
        """Side-view shoe: ankle sits at the heel-top; toe points `fwd`;
        angle > 0 lifts the toe."""
        a = math.radians(angle_deg)
        ca, sa = math.cos(a), math.sin(a)

        def P(u, v):     # u along the foot (+ forward), v down; toe-up rotation
            return (ankle[0] + fwd * (u * ca + v * sa), ankle[1] - u * sa + v * ca)
        pts = [P(-heel, 0.5), P(length - heel - 5, 0.8), P(length - heel - 1.5, height * 0.3), P(length - heel, height * 0.6),
               P(length - heel - 0.5, height), P(-heel + 0.5, height), P(-heel - 0.5, height * 0.5)]
        im = Image.new('L', (self.w * SS, self.h * SS), 0)
        ImageDraw.Draw(im).polygon([(x * SS, y * SS) for x, y in pts], fill=255)
        # local v coordinate for the sole stripe
        def color_fn(X, Y):
            rx, ry = (X - ankle[0]) * fwd, (Y - ankle[1])
            v = rx * sa * 1 + ry * ca
            u = rx * ca - ry * sa
            out = np.zeros(X.shape + (3,))
            out[:] = upper
            out[v > height * 0.62] = sole
            if toe_cap is not None:
                out[(u > length - heel - 6) & (v <= height * 0.62)] = toe_cap
            return out
        return self._layer_from(im, color_fn)

    def shoe_front(self, ankle, width, height, upper, sole, toe=None):
        x, y = ankle
        im = Image.new('L', (self.w * SS, self.h * SS), 0)
        d = ImageDraw.Draw(im)
        d.rounded_rectangle([(x - width / 2) * SS, y * SS, (x + width / 2) * SS, (y + height) * SS], radius=SS * 2, fill=255)

        def color_fn(X, Y):
            out = np.zeros(X.shape + (3,))
            out[:] = upper
            if toe is not None:                  # sandals: toes show between strap and sole
                out[(Y > y + height * 0.4) & (Y <= y + height * 0.7)] = toe
            out[Y > y + height * (0.7 if toe is not None else 0.62)] = sole
            dark = X > x + width * 0.2
            out[dark] = out[dark] * 0.85
            return out
        return self._layer_from(im, color_fn)


def darken_layer(layer, k=0.68):
    out = layer.copy()
    out[..., :3] = (out[..., :3].astype(float) * k).astype(np.uint8)
    return out


# --------------------------------------------------------------- the rig ----

class Rig:
    def __init__(self, art, cfg, pad=(14, 10, 2)):
        """art: idle RGBA at sprite resolution. pad = (top, side, bottom)."""
        pt, ps, pb = pad
        h, w, _ = art.shape
        self.W, self.H = w + 2 * ps, h + pt + pb
        self.ox, self.oy = ps, pt
        self.cfg = cfg
        self.view = cfg['view']
        self.fwd = cfg.get('fwd', 1)
        canvas = np.zeros((self.H, self.W, 4), np.uint8)
        canvas[pt:pt + h, ps:ps + w] = art
        self.art = canvas
        P = lambda p: (p[0] + ps, p[1] + pt)
        self.P = P
        # palette sampled from the art
        pal = {}
        for k, v in {**cfg['palette'], **cfg.get('palette_extra', {})}.items():
            pal[k] = mode_color(art, v) if isinstance(v, tuple) and len(v) == 4 else np.array(v, float)
        self.pal = pal
        self.body = self._make_body()

    def _make_body(self):
        cfg, a = self.cfg, self.art.copy()
        cut = cfg['cut'] + self.oy
        a[cut:] = 0
        # paint out the original arms: erased pixels inside the torso become
        # the nearest clothing, the rest becomes transparent
        erase = np.zeros(a.shape[:2], bool)
        for (x0, y0, x1, y1, *mode) in cfg.get('erase', []):
            box = np.zeros_like(erase)
            box[y0 + self.oy:y1 + self.oy, x0 + self.ox:x1 + self.ox] = True
            if mode and mode[0] == 'skin':
                rgb = a[..., :3].astype(int)
                r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
                skinish = (r > 140) & (r > b + 30) | ((r > 180) & (g > 130) & (b < 90))     # skin or gold bangles
                box &= skinish | ((rgb.max(axis=2) < 40) & ndimage.binary_dilation(skinish & box, iterations=1))
            erase |= box & opaque(a)
        keep = opaque(a) & ~erase
        torso_zone = np.zeros_like(erase)
        tz = cfg.get('torso')
        if tz:
            x0, y0, x1, y1 = tz
            torso_zone[y0 + self.oy:y1 + self.oy, x0 + self.ox:x1 + self.ox] = True
        fill = erase & torso_zone
        a[erase] = 0
        # the torso behind the arm: the garment colour, lightly shaded toward the back
        base = self.pal.get('torso', self.pal.get('sleeve'))
        if fill.any():
            ys, xs = np.nonzero(fill)
            a[ys, xs, :3] = shade(base, 0.92).astype(np.uint8)
            back = (xs - xs.mean()) * self.fwd < -1
            a[ys[back], xs[back], :3] = shade(base, 0.8).astype(np.uint8)
            a[fill, 3] = 255
        # re-close the silhouette outline where arms were removed
        m = opaque(a)
        ring = ndimage.binary_dilation(m, structure=np.ones((3, 3))) & ~m & ndimage.binary_dilation(erase, iterations=1)
        a[ring] = OUTLINE
        return a

    # --- limbs ---------------------------------------------------------------
    def _leg_side(self, cv, hip, hip_deg, knee_deg, far):
        c, pal, f = self.cfg, self.pal, self.fwd
        L1, L2 = c['thigh'], c['shin']
        th = math.radians(hip_deg)
        knee = (hip[0] + f * L1 * math.sin(th), hip[1] + L1 * math.cos(th))
        sh = math.radians(hip_deg - knee_deg)
        ankle = (knee[0] + f * L2 * math.sin(sh), knee[1] + L2 * math.cos(sh))
        thigh = cv.segment(hip, knee, c['leg_w'], c['thigh_bands'](pal))
        shin = cv.segment(knee, ankle, c['leg_w'] - 0.5, c['shin_bands'](pal))
        leg = outline(over(thigh, shin))                 # one outline per limb, no seams at the knee
        shin_deg = hip_deg - knee_deg
        foot = max(-50, shin_deg * 0.5) if shin_deg < -20 else min(12, max(-8, shin_deg * 0.2))
        shoe = cv.shoe_side(ankle, f, c['shoe_len'], c['shoe_h'], c['heel'], foot, pal['shoe'], pal['sole'], pal.get('toe'))
        layer = over(leg, outline(shoe))
        return darken_layer(layer) if far else layer

    def _arm_side(self, cv, sh, sh_deg, el_deg, far):
        c, pal, f = self.cfg, self.pal, self.fwd
        U, F = c['upper'], c['fore']
        a = math.radians(sh_deg)
        el = (sh[0] + f * U * math.sin(a), sh[1] + U * math.cos(a))
        b = math.radians(sh_deg + el_deg)
        hand = (el[0] + f * F * math.sin(b), el[1] + F * math.cos(b))
        up = cv.segment(sh, el, c['arm_w'], c['upper_bands'](pal))
        fo = cv.segment(el, hand, c['arm_w'] - 0.5, c['fore_bands'](pal))
        hd = cv.blob(hand, c['hand_r'], pal['skin'])
        layer = outline(over(over(up, fo), hd))
        return darken_layer(layer) if far else layer

    def _leg_front(self, cv, hip, lift_deg, spread=0, foot_dy=0):
        c, pal = self.cfg, self.pal
        L1, L2 = c['thigh'], c['shin']
        a = math.radians(lift_deg)
        knee = (hip[0] + spread, hip[1] + L1 * math.cos(a))
        # a knee raised toward the camera foreshortens the shin too
        ankle = (knee[0], knee[1] + L2 * (1 - 0.45 * math.sin(a)) + foot_dy)
        thigh = cv.segment(hip, knee, c['leg_w'], c['thigh_bands'](pal))
        shin = cv.segment(knee, ankle, c['leg_w'] - 0.5, c['shin_bands'](pal))
        shoe = cv.shoe_front(ankle, c['shoe_w'], c['shoe_h'], pal['shoe'], pal['sole'], pal.get('toe'))
        return over(outline(over(thigh, shin)), outline(shoe))

    def _arm_front(self, cv, sh, elbow, hand, side):
        c, pal = self.cfg, self.pal
        up = cv.segment(sh, elbow, c['arm_w'], c['upper_bands'](pal))
        fo = cv.segment(elbow, hand, c['arm_w'] - 0.5, c['fore_bands'](pal))
        hd = cv.blob(hand, c['hand_r'], pal['skin'])
        return outline(over(over(up, fo), hd))

    # --- poses ---------------------------------------------------------------
    def pose(self, p):
        cfg = self.cfg
        cv = Canvas(self.W, self.H)
        lean = p.get('lean', 0) * (-self.fwd)           # PIL: + = counter-clockwise
        bob = p.get('bob', 0)
        hip_pivot = self.P(cfg['hip_pivot'])
        body = rotsprite(self.body, lean, hip_pivot)

        def rot(pt):
            if not lean:
                return pt
            a = math.radians(-lean)
            x, y = pt[0] - hip_pivot[0], pt[1] - hip_pivot[1]
            return (hip_pivot[0] + x * math.cos(a) - y * math.sin(a), hip_pivot[1] + x * math.sin(a) + y * math.cos(a))

        f = np.zeros((self.H, self.W, 4), np.uint8)
        if self.view in ('left', 'right'):
            nh, fh = self.P(cfg['hip_near']), self.P(cfg['hip_far'])
            ns, fs = rot(self.P(cfg['sh_near'])), rot(self.P(cfg['sh_far']))
            (nhip, nknee), (fhip, fknee) = p['legs']
            (nsh, nel), (fsh, fel) = p['arms']
            f = over(f, self._arm_side(cv, fs, fsh, fel, True))
            f = over(f, self._leg_side(cv, fh, fhip, fknee, True))
            f = over(f, self._leg_side(cv, nh, nhip, nknee, False))
            f = over(f, body)
            f = over(f, self._arm_side(cv, ns, nsh, nel, False))
        else:
            # lean toward (front) / away from (back) the camera: crouch the
            # body over the hips, drop the shoulders with it, sway sideways
            k = 1 - p.get('crouch', 0)
            pivot_y = int(round(hip_pivot[1]))
            body = squash(body, k, pivot_y)
            sway = p.get('sway', 0)
            if sway:
                body = shift(body, dx=sway)
            lh, rh = self.P(cfg['hip_l']), self.P(cfg['hip_r'])

            def drop(pt):
                return (pt[0] + sway, pivot_y - (pivot_y - pt[1]) * k)
            ls, rs = drop(self.P(cfg['sh_l'])), drop(self.P(cfg['sh_r']))
            (llift, ldy), (rlift, rdy) = p['legs']
            # draw the lifted (nearer) leg last
            legs = [(lh, llift, ldy), (rh, rlift, rdy)]
            legs.sort(key=lambda t: t[1])
            for hip, lift, dy in legs:
                f = over(f, self._leg_front(cv, hip, lift, 0, dy))
            arms = []
            for sh, spec, side in ((ls, p['arms'][0], -1), (rs, p['arms'][1], 1)):
                edx, edy, hdx, hdy, *layer = spec
                layer = layer[0] if layer else 'front'
                # seen from behind, the forward-swinging arm is the hidden one
                if self.view == 'up':
                    layer = 'back' if layer == 'front' else 'front'
                elbow = (sh[0] + side * edx, sh[1] + edy)
                hand = (elbow[0] + side * hdx, elbow[1] + hdy)
                arms.append((layer, self._arm_front(cv, sh, elbow, hand, side)))
            for layer, a in arms:
                if layer == 'back':
                    f = over(f, darken_layer(a, 0.8))
            f = over(f, body)
            for layer, a in arms:
                if layer == 'front':
                    f = over(f, a)
        if bob:
            f = shift(f, dy=-bob)
        return f


# ---------------------------------------------------------------- poses -----
# Side views: legs = ((near hip, near knee), (far hip, far knee)) in degrees
# (hip + = swung forward; knee + = bent). arms = ((near shoulder, elbow), (far..))
# (shoulder + = forward; elbow + = forearm raised forward).
# Front/back: legs = ((lift deg, foot dy) left, right); arms = per side
# (elbow out, elbow down, hand in/out, hand down) in texels.

SIDE = {
    'idle':  dict(legs=((3, 2), (-3, 2)), arms=((-4, 8), (4, 8))),
    'walk1': dict(lean=2, legs=((24, 6), (-22, 20)), arms=((-26, 14), (26, 22))),
    'walk2': dict(lean=2, legs=((-22, 20), (24, 6)), arms=((26, 22), (-26, 14))),
    'run1':  dict(lean=12, legs=((36, 16), (-38, 88)), arms=((-48, 95), (52, 100))),
    'run2':  dict(lean=12, bob=3, legs=((-6, 10), (44, 100)), arms=((-6, 100), (12, 100))),
    'run3':  dict(lean=12, legs=((-38, 88), (36, 16)), arms=((52, 100), (-48, 95))),
    'run4':  dict(lean=12, bob=3, legs=((44, 100), (-6, 10)), arms=((12, 100), (-6, 100))),
}
FRONT = {
    # arms: (elbow out, elbow down, hand out(+)/in(-), hand down, layer)
    'idle':  dict(legs=((0, 0), (0, 0)), arms=((1, 7, 0, 6), (1, 7, 0, 6))),
    'walk1': dict(sway=1, legs=((38, 0), (8, 1)), arms=((1, 6, -2, 3, 'front'), (2, 7, 1, 7, 'back'))),
    'walk2': dict(sway=-1, legs=((8, 1), (38, 0)), arms=((2, 7, 1, 7, 'back'), (1, 6, -2, 3, 'front'))),
    # run: crouched lean, hard arm pump (front hand up to the chest, back arm
    # behind the body), high knee drive, airborne passing frames
    'run1':  dict(crouch=0.08, bob=1, sway=1, legs=((78, -2), (14, 0)), arms=((2, 5, -7, -4, 'front'), (4, 6, 2, 6, 'back'))),
    'run2':  dict(crouch=0.05, bob=4, legs=((30, 0), (30, 0)), arms=((3, 6, -3, 1, 'front'), (3, 6, -3, 1, 'front'))),
    'run3':  dict(crouch=0.08, bob=1, sway=-1, legs=((14, 0), (78, -2)), arms=((4, 6, 2, 6, 'back'), (2, 5, -7, -4, 'front'))),
    'run4':  dict(crouch=0.05, bob=4, legs=((30, 0), (30, 0)), arms=((3, 6, -3, 1, 'front'), (3, 6, -3, 1, 'front'))),
}
ORDER = ['idle', 'walk1', 'walk2', 'run1', 'run2', 'run3', 'run4']


def frames_for(art, cfg):
    rig = Rig(art, cfg)
    table = SIDE if cfg['view'] in ('left', 'right') else FRONT
    return [rig.pose(table[k]) for k in ORDER], rig
