"""Retarget CC0 humanoid mocap clips (three.ws catalog, 'm2m' set) onto Sniffer's small rig.

    python3 sniffer/tools/retarget_clips.py CLIPS_DIR OUT.json

Each source clip is a three.js AnimationClip JSON over a 50-bone humanoid (Hips, 3 spine bones, Neck, Head, arms, legs).
We rebuild the source skeleton by forward kinematics, express every frame as a WORLD-space rotation change from one
shared standing reference pose, re-express that in a canonical character frame (Y up, +Z forward, +X = character's left),
and keep only what Sniffer's rig can use: root (hips), body (chest), head, arm_L/R (upper arm), foot_L/R, plus the hips'
height/offset scaled to Sniffer's size. Output: one compact JSON the site plays with crossfades.
"""
import json, sys, os
import numpy as np

def qmul(a, b):
    ax, ay, az, aw = a[..., 0], a[..., 1], a[..., 2], a[..., 3]; bx, by, bz, bw = b[..., 0], b[..., 1], b[..., 2], b[..., 3]
    return np.stack([aw * bx + ax * bw + ay * bz - az * by, aw * by - ax * bz + ay * bw + az * bx, aw * bz + ax * by - ay * bx + az * bw, aw * bw - ax * bx - ay * by - az * bz], -1)
def qinv(q): return q * np.array([-1, -1, -1, 1.])
def qrot(q, v):
    u = q[..., :3]; w = q[..., 3:4]; t = 2 * np.cross(u, v); return v + w * t + np.cross(u, t)
def qnorm(q): return q / np.linalg.norm(q, axis=-1, keepdims=True)
def mat2q(m):
    t = np.trace(m)
    if t > 0: s = np.sqrt(t + 1) * 2; return np.array([(m[2, 1] - m[1, 2]) / s, (m[0, 2] - m[2, 0]) / s, (m[1, 0] - m[0, 1]) / s, .25 * s])
    i = np.argmax(np.diag(m)); j, k = (i + 1) % 3, (i + 2) % 3; s = np.sqrt(1 + m[i, i] - m[j, j] - m[k, k]) * 2
    q = np.zeros(4); q[i] = .25 * s; q[j] = (m[j, i] + m[i, j]) / s; q[k] = (m[k, i] + m[i, k]) / s; q[3] = (m[k, j] - m[j, k]) / s; return q

PARENT = {'Hips': None, 'Spine': 'Hips', 'Spine1': 'Spine', 'Spine2': 'Spine1', 'Neck': 'Spine2', 'Head': 'Neck'}
for s in ('Left', 'Right'):
    PARENT.update({s + 'Shoulder': 'Spine2', s + 'Arm': s + 'Shoulder', s + 'ForeArm': s + 'Arm', s + 'Hand': s + 'ForeArm',
                   s + 'UpLeg': 'Hips', s + 'Leg': s + 'UpLeg', s + 'Foot': s + 'Leg', s + 'ToeBase': s + 'Foot'})

def load(path, fps=30):
    d = json.load(open(path)); tr = d['tracks']; dur = d['duration']
    names, seen = [], {}
    for t in tr:  # tracks come grouped per bone; the three spine bones were all exported as "Spine"
        b = t['name'].rsplit('.', 1)[0]
        if not names or names[-1][0] != b or t['name'].endswith('.position') and names[-1][1].get('position'):
            n = b
            if b == 'Spine': c = seen.get('Spine', 0); n = ['Spine', 'Spine1', 'Spine2'][c]; seen['Spine'] = c + 1
            names.append([b, {}, n])
        names[-1][1][t['name'].rsplit('.', 1)[1]] = t
    T = np.arange(0, dur + 1e-6, 1 / fps); out = {}
    for b, d2, n in names:
        if n not in PARENT: continue
        res = {}
        for k, dim in (('position', 3), ('quaternion', 4)):
            t = d2[k]; times = np.array(t['times']); vals = np.array(t['values']).reshape(-1, dim)
            if k == 'quaternion':
                for i in range(1, len(vals)):
                    if np.dot(vals[i], vals[i - 1]) < 0: vals[i] = -vals[i]
            res[k] = np.stack([np.interp(T, times, vals[:, c]) for c in range(dim)], -1)
        res['quaternion'] = qnorm(res['quaternion']); out[n] = res
    return T, out

def fk(B):
    W = {}
    def go(n):
        if n in W: return W[n]
        p = PARENT[n]; lq, lp = B[n]['quaternion'], B[n]['position']
        if p is None: W[n] = (lq, lp)
        else: pq, pp = go(p); W[n] = (qmul(pq, lq), pp + qrot(pq, lp))
        return W[n]
    for n in B: go(n)
    return W

clips_dir, out_path = sys.argv[1], sys.argv[2]
CLIPS = {  # site name: (file, loop)
    'idle': ('m2m-addon-idle-subtle', True), 'listen': ('m2m-addon-idle-listening', True), 'startle': ('m2m-addon-dodge-back', False),
    'jumpStart': ('m2m-base-jump-start', False), 'jumpAir': ('m2m-base-jump-air', False), 'jumpLand': ('m2m-base-jump-land', False),
    'crouch': ('m2m-base-crouch-idle', True), 'greet': ('m2m-addon-greeting', False), 'cheer': ('m2m-mocap-cheering-two-hands', False), 'victory': ('m2m-addon-victory', False),
}
# the shared standing reference: frame 0 of the subtle idle
_, RB = load(os.path.join(clips_dir, 'm2m-addon-idle-subtle.json')); RW = fk(RB)
ref = {n: (q[0], p[0]) for n, (q, p) in RW.items()}
# canonical frame from the reference body: up = hips→head, forward = heel→toe, left = up × forward
up = ref['Head'][1] - (ref['LeftFoot'][1] + ref['RightFoot'][1]) / 2; up /= np.linalg.norm(up)
fwd = (ref['LeftToeBase'][1] + ref['RightToeBase'][1]) / 2 - (ref['LeftFoot'][1] + ref['RightFoot'][1]) / 2; fwd -= up * np.dot(fwd, up); fwd /= np.linalg.norm(fwd)
left = np.cross(up, fwd); left /= np.linalg.norm(left)
if np.dot(left, ref['LeftUpLeg'][1] - ref['RightUpLeg'][1]) < 0: left = -left; fwd = np.cross(left, up)
C = mat2q(np.stack([left, up, fwd], 0))  # rotates source-world vectors into canonical (rows = canonical axes)
height = np.dot(ref['Head'][1] - (ref['LeftFoot'][1] + ref['RightFoot'][1]) / 2, up)
hip0 = ref['Hips'][1]
print('source height', round(float(height), 3), 'canonical check: toe fwd', np.round(qrot(C, fwd), 2), 'up', np.round(qrot(C, up), 2), 'left', np.round(qrot(C, left), 2))
MAP = {'root': 'Hips', 'body': 'Spine2', 'head': 'Head', 'arm_L': 'LeftArm', 'arm_R': 'RightArm', 'foot_L': 'LeftFoot', 'foot_R': 'RightFoot'}
out = {'fps': 30, 'height': float(height), 'clips': {}}
for name, (f, loop) in CLIPS.items():
    T, B = load(os.path.join(clips_dir, f + '.json')); W = fk(B); clip = {'loop': loop, 'dur': float(T[-1]), 'n': len(T), 'q': {}}
    for ours, src in MAP.items():
        Dw = qmul(W[src][0], qinv(ref[src][0]))                 # world-space change from the standing reference
        Dc = qnorm(qmul(qmul(C, Dw), qinv(C)))                  # … expressed in the canonical character frame
        Dc[Dc[:, 3] < 0] *= -1
        clip['q'][ours] = np.round(Dc, 4).flatten().tolist()
    dp = qrot(np.broadcast_to(C, W['Hips'][1].shape[:-1] + (4,)), W['Hips'][1] - hip0) / height  # hips offset, in body heights
    clip['p'] = np.round(dp, 4).flatten().tolist()
    lo = dp[:, 1]; print(f'{name:10s} {len(T):4d} frames  hips y min {lo.min():+.3f} at {T[lo.argmin()]:.2f}s  max {lo.max():+.3f} at {T[lo.argmax()]:.2f}s')
    out['clips'][name] = clip
json.dump(out, open(out_path, 'w'), separators=(',', ':'))
print('wrote', out_path, os.path.getsize(out_path) // 1024, 'KB')
