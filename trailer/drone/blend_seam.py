"""Cross-fade the second rendered past the loop's end (out/drone-frames-extra,
t = LOOP .. LOOP+1) into the loop's first second (see render/drone_seam.mjs).
The camera is identical in both, so only clouds, water and grass blend."""
import os
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', 'out')
FADE = 30
for i in range(FADE):
    n = f'{i:04d}.png'
    extra = Image.open(os.path.join(OUT, 'drone-frames-extra', n)).convert('RGB')
    orig = Image.open(os.path.join(OUT, 'drone-frames-orig', n)).convert('RGB')
    Image.blend(extra, orig, (i + 0.5) / FADE).save(os.path.join(OUT, 'drone-frames', n))
print('blended', FADE, 'frames')
