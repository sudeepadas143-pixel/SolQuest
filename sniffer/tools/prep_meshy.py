"""Turn the Meshy 'Gassy Shy Guy' GLB into the site's rigged sniffer.glb.

    python3 sniffer/tools/prep_meshy.py IN.glb OUT.glb [--renders DIR] [--tris 70000]

1. strip the sculpted gas cloud (pale-sage texels behind/below the body) and any floating leftovers
2. decimate to a web budget (UVs and the PBR textures are kept)
3. stand it on z = 0, face -Y (exports as +Z), find landmarks (hood tip, snout, feet, arms)
4. add the skeleton the site animates (root, body, head, tip1-3, arm_L/R, foot_L/R, snout) with smooth,
   position-based weights, and export.
"""
import argparse, math, os, sys
import bpy, bmesh
import numpy as np
from mathutils import Vector, Matrix

ap = argparse.ArgumentParser(); ap.add_argument('src'); ap.add_argument('out'); ap.add_argument('--renders', default=''); ap.add_argument('--tris', type=int, default=70000)
args = ap.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:])
bpy.ops.wm.read_factory_settings(use_empty=True); sc = bpy.context.scene
bpy.ops.import_scene.gltf(filepath=os.path.abspath(args.src))
ob = [o for o in sc.objects if o.type == 'MESH'][0]
for o in list(sc.objects):
    if o is not ob and o.type != 'MESH': o.select_set(False)
# bake the import transform into the mesh, stand on z=0, centre x/y
ob.data.transform(ob.matrix_world); ob.matrix_world = Matrix.Identity(4); ob.parent = None
me = ob.data; n = len(me.vertices)
co = np.empty(n * 3, np.float32); me.vertices.foreach_get('co', co); co = co.reshape(-1, 3)
# the gas trails toward +Y (behind); centre on the body, not on the gas: use the front 60% for x/y centring
front = co[co[:, 1] < np.percentile(co[:, 1], 60)]
shift = Vector((-(front[:, 0].min() + front[:, 0].max()) / 2, 0, -co[:, 2].min()))
me.transform(Matrix.Translation(shift)); co += np.array(shift, np.float32)

# ---------------------------------------------------------------- 1. find gas texels
mat = me.materials[0]; tex = None
for nd in mat.node_tree.nodes:
    if nd.type == 'TEX_IMAGE' and any(l.to_socket.name == 'Base Color' for l in nd.outputs['Color'].links): tex = nd.image
img = np.array(tex.pixels[:], np.float32).reshape(tex.size[1], tex.size[0], 4)
uv = np.empty(len(me.loops) * 2, np.float32); me.uv_layers.active.data.foreach_get('uv', uv); uv = uv.reshape(-1, 2)
lv = np.empty(len(me.loops), np.int32); me.loops.foreach_get('vertex_index', lv)
px = np.clip((uv[:, 0] % 1) * (tex.size[0] - 1), 0, tex.size[0] - 1).astype(int); py = np.clip((uv[:, 1] % 1) * (tex.size[1] - 1), 0, tex.size[1] - 1).astype(int)
c = img[py, px, :3]  # linear
srgb = np.where(c <= .0031308, c * 12.92, 1.055 * np.clip(c, 0, None) ** (1 / 2.4) - .055)
H = co[:, 2].max()
# classify per FACE from the texel at the face's UV centre (no bleeding across UV seams), then cut only pale-sage faces
# that sit behind the body (the head/hood never reaches past y≈0.28; the cloud fills y 0.18–0.95 below head height)
nf = len(me.polygons); ls = np.empty(nf, np.int32); lt = np.empty(nf, np.int32); me.polygons.foreach_get('loop_start', ls); me.polygons.foreach_get('loop_total', lt)
fuv = np.add.reduceat(uv, ls, axis=0) / lt[:, None]
fc = np.empty(nf * 3, np.float32); me.polygons.foreach_get('center', fc); fc = fc.reshape(-1, 3)
tx = np.clip((fuv[:, 0] % 1) * (tex.size[0] - 1), 0, tex.size[0] - 1).astype(int); ty = np.clip((fuv[:, 1] % 1) * (tex.size[1] - 1), 0, tex.size[1] - 1).astype(int)
cs = img[ty, tx, :3]; cs = np.where(cs <= .0031308, cs * 12.92, 1.055 * np.clip(cs, 0, None) ** (1 / 2.4) - .055)
pale_f = (cs.mean(1) > .52) & (cs[:, 1] > cs[:, 2] + .07) & (cs[:, 1] > cs[:, 0] - .04)
kill_f = (pale_f & (fc[:, 1] > .12) & (fc[:, 2] < .8 * H)) | ((cs.mean(1) > .38) & (fc[:, 1] > .1) & (fc[:, 2] < .5 * H))  # + greyish cloud remnants at the butt (robe/belt there are dark)
pale_l = (srgb.mean(1) > .52) & (srgb[:, 1] > srgb[:, 2] + .07) & (srgb[:, 1] > srgb[:, 0] - .04)
pale_v = np.zeros(n, bool); np.logical_or.at(pale_v, lv, pale_l)
gas_v = np.zeros(n, bool)
fv = np.empty(len(me.loops), np.int32); me.loops.foreach_get('vertex_index', fv)
for i in np.nonzero(kill_f)[0]: gas_v[fv[ls[i]:ls[i] + lt[i]]] = True
bm = bmesh.new(); bm.from_mesh(me); bm.faces.ensure_lookup_table()
bmesh.ops.delete(bm, geom=[bm.faces[i] for i in np.nonzero(kill_f)[0]], context='FACES')
# drop floating islands that are mostly gas or tiny
bm.verts.ensure_lookup_table(); seen = set(); islands = []
for v in bm.verts:
    if v.index in seen or not v.link_edges: continue
    stack, isl = [v], []
    seen.add(v.index)
    while stack:
        a = stack.pop(); isl.append(a)
        for e in a.link_edges:
            b = e.other_vert(a)
            if b.index not in seen: seen.add(b.index); stack.append(b)
    islands.append(isl)
islands.sort(key=len, reverse=True)
drop = []
for isl in islands[1:]:
    g = np.mean([pale_v[v.index] for v in isl]); ys = np.mean([v.co.y for v in isl])
    zs = np.mean([v.co.z for v in isl])
    if (g > .6 and ys > .12) or (len(isl) < 60 and ys > .05 and zs < .6 * H): drop += isl  # leftover cloud only; the Meshy mesh is fragmented, so never drop by size alone
bmesh.ops.delete(bm, geom=list(set(drop)) + [v for v in bm.verts if not v.link_edges], context='VERTS')
bmesh.ops.holes_fill(bm, edges=[e for e in bm.edges if e.is_boundary and (e.verts[0].co.y + e.verts[1].co.y) / 2 > .05 and (e.verts[0].co.z + e.verts[1].co.z) / 2 < .6 * H], sides=300)  # patch only the opening on his back
low = [v.co.y for v in bm.verts if v.co.z < .08 * H]; fy = float(np.median(low)) if low else 0.0
bmesh.ops.translate(bm, verts=bm.verts, vec=(0, -fy, 0))  # centre on the feet
bm.to_mesh(me); bm.free()
print('islands', len(islands), 'dropped verts', len(drop), 'gas faces', int(kill_f.sum()))

# ---------------------------------------------------------------- 2. decimate
me.calc_loop_triangles(); tris = len(me.loop_triangles)
if tris > args.tris:
    d = ob.modifiers.new('d', 'DECIMATE'); d.ratio = args.tris / tris
    dg = bpy.context.evaluated_depsgraph_get(); nm = bpy.data.meshes.new_from_object(ob.evaluated_get(dg)); ob.modifiers.clear(); ob.data = nm; me = nm
me.calc_loop_triangles(); print('tris', tris, '->', len(me.loop_triangles))
for img_ in bpy.data.images:
    if img_.size[0] > 1024: img_.scale(1024, 1024)

# ---------------------------------------------------------------- 3. landmarks
n = len(me.vertices); co = np.empty(n * 3, np.float32); me.vertices.foreach_get('co', co); co = co.reshape(-1, 3)
H = co[:, 2].max()
tipv = co[np.argmax(co[:, 2] * 1.0 + co[:, 1] * .6)]                 # top-back extreme = hood tip end
snoutv = co[np.argmin(co[:, 1])]                                      # most forward point = snout front
neck = .42 * H
top = co[co[:, 2] > .8 * H]; crown = Vector((0, float(np.median(top[:, 1])), float(top[:, 2].min()) + .02))
tip_end = Vector(tipv.tolist()); tip0 = crown.lerp(tip_end, .0); tip0.z = max(tip0.z, .78 * H)
TIP = [tip0, tip0.lerp(tip_end, .4) + Vector((0, 0, .03)), tip0.lerp(tip_end, .75) + Vector((0, 0, .02)), tip_end]
xs = np.abs(co[:, 0]); armband = (co[:, 2] > .18 * H) & (co[:, 2] < .5 * H)
arm_x = float(np.percentile(xs[armband], 97))
print('H', round(H, 3), 'tip', tip_end, 'snout', snoutv, 'arm_x', round(arm_x, 3))

# ---------------------------------------------------------------- 3b. plug the hole the cloud left in the robe's back
# robe profile measured on the FRONT half (untouched): radial distance per height band, arms excluded
band = []
for z0 in np.arange(.07 * H, .39 * H, .02 * H):
    m = (co[:, 2] >= z0) & (co[:, 2] < z0 + .02 * H) & (co[:, 1] < 0) & (np.abs(co[:, 0]) < np.abs(co[:, 1]) * 1.2 + .05) & (np.hypot(co[:, 0], co[:, 1]) < .45)
    mb = (co[:, 2] >= z0) & (co[:, 2] < z0 + .02 * H) & (co[:, 1] > np.abs(co[:, 0]) * .8) & (np.hypot(co[:, 0], co[:, 1]) < .5)
    rb = float(np.percentile(np.hypot(co[mb, 0], co[mb, 1]), 90)) if mb.sum() > 20 else None
    if m.sum() > 20:
        rf = min(.42, float(np.percentile(np.hypot(co[m, 0], co[m, 1]), 85)))
        band.append((rf * .965, float(z0 + .01 * H), min((rb or rf) * .985, rf * 1.2)))
fl = [l for l in me.loops]; tex_rgb = None
robe_rgb = np.median(srgb[(lum > .005)][:0], axis=0) if False else None
mfront = (co[:, 1] < -.05) & (co[:, 2] > .12 * H) & (co[:, 2] < .45 * H)
# robe colour = median of dark-green texels on the front robe (sampled per loop)
lv2 = np.empty(len(me.loops), np.int32); me.loops.foreach_get('vertex_index', lv2)
uv2 = np.empty(len(me.loops) * 2, np.float32); me.uv_layers.active.data.foreach_get('uv', uv2); uv2 = uv2.reshape(-1, 2)
cl = img[np.clip((uv2[:, 1] % 1) * (tex.size[1] - 1), 0, None).astype(int), np.clip((uv2[:, 0] % 1) * (tex.size[0] - 1), 0, None).astype(int), :3]
sel = mfront[lv2] & (cl[:, 1] > cl[:, 2]) & (cl.mean(1) < .1) & (cl.mean(1) > .01)
robe_lin = np.median(cl[sel], axis=0) if sel.sum() > 50 else np.array([.03, .05, .02])
belt_z = None
zz = np.array([b_[1] for b_ in band]); lums = []
for z0 in zz:
    m = mfront[lv2] & (np.abs(co[lv2, 2] - z0) < .01 * H); lums.append(cl[m].mean() if m.sum() > 10 else 1)
belt_z = float(zz[int(np.argmin(lums))])
bmp = bmesh.new(); segs = 72; rings = []
prof = [(0.0, band[0][1], 0.0)] + band + [(0.0, band[-1][1], 0.0)]
for r, zc, rback in prof:
    ring = []
    for k in range(segs):
        ang = 2 * math.pi * k / segs; sb = math.sin(ang); t = max(0., min(1., (sb - .1) / .5)); t = t * t * (3 - 2 * t)
        rr = r + (rback - r) * t  # back sector sits just OUTSIDE the measured back surface (hides the ragged cut); the front stays tucked inside
        ring.append(bmp.verts.new((rr * math.cos(ang), rr * sb, zc)))
    rings.append(ring)
for A, B in zip(rings, rings[1:]):
    for k in range(segs): bmp.faces.new((A[k], A[(k + 1) % segs], B[(k + 1) % segs], B[k]))
bmesh.ops.remove_doubles(bmp, verts=bmp.verts, dist=1e-5); bmesh.ops.recalc_face_normals(bmp, faces=bmp.faces)
pm = bpy.data.meshes.new('RobePlug'); bmp.to_mesh(pm); bmp.free()
pm.polygons.foreach_set('use_smooth', [True] * len(pm.polygons))
ca = pm.color_attributes.new('Col', 'FLOAT_COLOR', 'POINT')
for i, v in enumerate(pm.vertices):
    k = 1 - min(1, abs(v.co.z - belt_z) / (.025 * H)); col = robe_lin * (1 - k) + np.array([.006, .006, .005]) * k
    ca.data[i].color = (*col.tolist(), 1)
plug = bpy.data.objects.new('RobePlug', pm); sc.collection.objects.link(plug)
pmat = bpy.data.materials.new('RobePlug'); pmat.use_nodes = True; bsdf = pmat.node_tree.nodes['Principled BSDF']
vc = pmat.node_tree.nodes.new('ShaderNodeVertexColor'); vc.layer_name = 'Col'; pmat.node_tree.links.new(vc.outputs['Color'], bsdf.inputs['Base Color'])
bsdf.inputs['Roughness'].default_value = .75; pm.materials.append(pmat)
print('plug bands', len(band), 'belt_z', round(belt_z, 3), 'robe', robe_lin.round(3))

# ---------------------------------------------------------------- 4. armature + weights
arm_d = bpy.data.armatures.new('SnifferRig'); rig = bpy.data.objects.new('SnifferRig', arm_d); sc.collection.objects.link(rig)
for o in sc.objects: o.select_set(False)
rig.select_set(True); bpy.context.view_layer.objects.active = rig; bpy.ops.object.mode_set(mode='EDIT')
def bone(nm, h, t, par=None):
    b = arm_d.edit_bones.new(nm); b.head = h; b.tail = t
    if par: b.parent = arm_d.edit_bones[par]
bone('root', (0, 0, 0), (0, 0, .06)); bone('body', (0, 0, .07), (0, 0, neck - .02), 'root'); bone('head', (0, 0, neck), (0, 0, .78 * H), 'body')
bone('tip1', TIP[0], TIP[1], 'head'); bone('tip2', TIP[1], TIP[2], 'tip1'); bone('tip3', TIP[2], TIP[3], 'tip2')
sh = .38 * H
bone('arm_L', (arm_x * .62, 0, sh), (arm_x, -.02, .2 * H), 'body'); bone('arm_R', (-arm_x * .62, 0, sh), (-arm_x, -.02, .2 * H), 'body')
bone('foot_L', (.12, 0, .05), (.12, -.15, .05), 'root'); bone('foot_R', (-.12, 0, .05), (-.12, -.15, .05), 'root')
sn = Vector(snoutv.tolist()); bone('snout', (0, sn.y + .13, sn.z), (0, sn.y, sn.z), 'head')
bpy.ops.object.mode_set(mode='OBJECT')

def sstep(a, b, x): t = np.clip((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t)
z, y, x = co[:, 2], co[:, 1], co[:, 0]
W = {}
head = sstep(neck - .04, neck + .05, z)
W['foot_L'] = (1 - sstep(.05 * H, .11 * H, z)) * (x > 0); W['foot_R'] = (1 - sstep(.05 * H, .11 * H, z)) * (x <= 0)
armw = sstep(arm_x * .62, arm_x * .8, xs) * sstep(.14 * H, .2 * H, z) * (1 - sstep(.46 * H, .52 * H, z))
W['arm_L'] = armw * (x > 0); W['arm_R'] = armw * (x <= 0)
# hood tip chain: parameter along the tip polyline for verts in the top-back region
P = np.array([list(p) for p in TIP], np.float32); best_t = np.full(n, -1.0); best_d = np.full(n, 9.0)
for i in range(3):
    a, b = P[i], P[i + 1]; ab = b - a; t = np.clip(((co - a) @ ab) / (ab @ ab), 0, 1); d = np.linalg.norm(a + t[:, None] * ab - co, axis=1)
    upd = d < best_d; best_d[upd] = d[upd]; best_t[upd] = i + t[upd]
in_tip = sstep(TIP[0].z - .05, TIP[0].z + .04, z) * (y > TIP[0].y - .08) * sstep(.2, .12, best_d)
for i, nm in enumerate(['tip1', 'tip2', 'tip3']):
    W[nm] = in_tip * np.clip(1 - np.abs(best_t - (i + .5)) / 1.0, 0, 1)
snout = (y < sn.y + .14) * sstep(.13, .09, np.abs(z - sn.z)) * sstep(.12, .08, np.abs(x))
W['snout'] = snout * head
taken = sum(W.values())
W['head'] = np.clip(head - taken, 0, 1); W['body'] = np.clip(1 - head - W['foot_L'] - W['foot_R'] - W['arm_L'] - W['arm_R'], 0, 1) * (1 - head)
tot = sum(W.values()) + 1e-6
ob.parent = rig; mod = ob.modifiers.new('Armature', 'ARMATURE'); mod.object = rig
plug.parent = rig; pmod = plug.modifiers.new('Armature', 'ARMATURE'); pmod.object = rig; pvg = plug.vertex_groups.new(name='body'); pvg.add(list(range(len(plug.data.vertices))), 1.0, 'REPLACE')
for nm, w in W.items():
    vg = ob.vertex_groups.new(name=nm); w = w / tot
    for i in np.nonzero(w > .002)[0]: vg.add([int(i)], float(w[i]), 'REPLACE')

if args.renders:
    os.makedirs(args.renders, exist_ok=True); sc.render.engine = 'CYCLES'; sc.cycles.samples = 24; sc.cycles.use_denoising = True; sc.render.resolution_x = sc.render.resolution_y = 560
    wd = bpy.data.worlds.new('w'); sc.world = wd; wd.use_nodes = True; wd.node_tree.nodes['Background'].inputs[0].default_value = (.55, .52, .6, 1); wd.node_tree.nodes['Background'].inputs[1].default_value = 1.2
    cd = bpy.data.cameras.new('c'); cd.lens = 70; cam = bpy.data.objects.new('c', cd); sc.collection.objects.link(cam); sc.camera = cam
    for nm, ang in (('front', -20), ('three_q', -50), ('side', -95), ('back', 160)):
        a = math.radians(ang - 90); cam.location = (3.4 * math.cos(a), 3.4 * math.sin(a), .9)
        cam.rotation_euler = (Vector((0, 0, .55)) - cam.location).to_track_quat('-Z', 'Y').to_euler()
        sc.render.filepath = os.path.join(args.renders, f'm_{nm}.png'); bpy.ops.render.render(write_still=True)

for o in sc.objects: o.select_set(o in (ob, rig, plug))
bpy.ops.export_scene.gltf(filepath=os.path.abspath(args.out), export_format='GLB', use_selection=True, export_skins=True, export_animations=False, export_yup=True, export_image_format='JPEG')
print('exported', args.out)
