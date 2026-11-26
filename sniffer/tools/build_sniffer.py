"""Build the Sniffer character in headless Blender (pip install bpy) and export a rigged GLB.

    python3 sniffer/tools/build_sniffer.py [--out sniffer/assets/models/sniffer.glb] [--renders DIR]

Blender convention: Z up, front = -Y, character's left = +X. The glTF exporter converts to Y-up / front +Z.
Forms are built from primitives, fused with voxel remeshing and smoothed (no visible primitive seams), then:
vinyl-toy materials (flat colours + clearcoat), ambient occlusion baked into vertex colours, a small skeleton
(root, body, head, 3-bone hood-tip chain, arms, feet, pupils, snout) with deterministic weights.
"""
import argparse, math, os, sys
import bpy, bmesh
from mathutils import Vector, Matrix

ap = argparse.ArgumentParser()
ap.add_argument('--out', default=os.path.join(os.path.dirname(__file__), '..', 'assets', 'models', 'sniffer.glb'))
ap.add_argument('--renders', default='')
ap.add_argument('--samples', type=int, default=48)
args = ap.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:])

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
col = scene.collection

# ------------------------------------------------------------------ helpers
def link(obj):
    col.objects.link(obj); return obj

def activate(obj):
    for o in scene.objects: o.select_set(False)
    obj.select_set(True); bpy.context.view_layer.objects.active = obj

def apply_mods(obj):
    """Bake all modifiers into a fresh mesh (no operator context needed)."""
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(obj.evaluated_get(dg))
    old = obj.data; obj.modifiers.clear(); obj.data = me
    if old.users == 0: bpy.data.meshes.remove(old)
    return obj

def sphere(name, loc, radii, segs=48, rings=24):
    bm = bmesh.new(); bmesh.ops.create_uvsphere(bm, u_segments=segs, v_segments=rings, radius=1.0)
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    o = link(bpy.data.objects.new(name, me)); o.location = loc; o.scale = radii
    o.data.transform(Matrix.Diagonal((*radii, 1))); o.scale = (1, 1, 1); return o

def lathe(name, profile, segs=72, loc=(0, 0, 0)):
    """Revolve (r, z) points around Z."""
    bm = bmesh.new(); rings = []
    for r, z in profile:
        ring = []
        for i in range(segs):
            a = 2 * math.pi * i / segs
            ring.append(bm.verts.new((r * math.cos(a), r * math.sin(a), z)) if r > 1e-6 else None)
        rings.append(ring)
    pole = {}
    for k, (r, z) in enumerate(profile):
        if r <= 1e-6: pole[k] = bm.verts.new((0, 0, z))
    for k in range(len(profile) - 1):
        A, B = rings[k], rings[k + 1]
        for i in range(segs):
            j = (i + 1) % segs
            if A[i] is None: bm.faces.new((pole[k], B[j], B[i]))
            elif B[i] is None: bm.faces.new((A[i], A[j], pole[k + 1]))
            else: bm.faces.new((A[i], A[j], B[j], B[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    o = link(bpy.data.objects.new(name, me)); o.location = loc; return o

def tube(name, pts, radii, res=12, bevel=1.0):
    """Tapered tube along a smooth bezier through pts; radii per point (absolute metres)."""
    cu = bpy.data.curves.new(name, 'CURVE'); cu.dimensions = '3D'
    cu.bevel_depth = bevel; cu.bevel_resolution = res; cu.use_fill_caps = True; cu.resolution_u = 16
    sp = cu.splines.new('BEZIER'); sp.bezier_points.add(len(pts) - 1)
    for bp, p, r in zip(sp.bezier_points, pts, radii):
        bp.co = p; bp.radius = r; bp.handle_left_type = bp.handle_right_type = 'AUTO'
    o = link(bpy.data.objects.new(name, cu))
    activate(o); bpy.ops.object.convert(target='MESH'); return bpy.context.view_layer.objects.active

def fuse(name, objs, voxel=0.006, smooth=6, smooth_factor=.5, target=None):
    """Union by voxel remesh (organic, seamless), then relax."""
    bm = bmesh.new()  # join everything into one mesh; the voxel remesh below turns overlapping volumes into one surface
    for o in objs:
        me = o.data.copy(); me.transform(o.matrix_world); bm.from_mesh(me); bpy.data.meshes.remove(me)
    o = objs[0]; bm.to_mesh(o.data); bm.free(); o.matrix_world = Matrix.Identity(4)
    for x in objs[1:]: bpy.data.objects.remove(x, do_unlink=True)
    o.name = name
    r = o.modifiers.new('r', 'REMESH'); r.mode = 'VOXEL'; r.voxel_size = voxel; r.adaptivity = 0
    s = o.modifiers.new('s', 'LAPLACIANSMOOTH'); s.iterations = smooth; s.lambda_factor = smooth_factor; s.use_volume_preserve = True
    apply_mods(o)
    if target and len(o.data.polygons) > target: decimate(o, target / len(o.data.polygons))
    return o

def cut(obj, cutter, voxel=None, smooth=0):
    m = obj.modifiers.new('c', 'BOOLEAN'); m.operation = 'DIFFERENCE'; m.object = cutter
    apply_mods(obj); bpy.data.objects.remove(cutter, do_unlink=True)
    if voxel:
        r = obj.modifiers.new('r', 'REMESH'); r.mode = 'VOXEL'; r.voxel_size = voxel
        if smooth: s = obj.modifiers.new('s', 'LAPLACIANSMOOTH'); s.iterations = smooth; s.lambda_factor = .5; s.use_volume_preserve = True
        apply_mods(obj)
    return obj

def subdiv(obj, levels=2, bevel=0.0):
    if bevel: b = obj.modifiers.new('b', 'BEVEL'); b.width = bevel; b.segments = 3; b.limit_method = 'ANGLE'
    s = obj.modifiers.new('sd', 'SUBSURF'); s.levels = s.render_levels = levels
    return apply_mods(obj)

def decimate(obj, ratio):
    d = obj.modifiers.new('d', 'DECIMATE'); d.ratio = ratio; return apply_mods(obj)

def smooth_shade(obj):
    obj.data.polygons.foreach_set('use_smooth', [True] * len(obj.data.polygons)); obj.data.update()

def hexrgb(h, a=1.0):
    h = h.lstrip('#'); c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple((x / 12.92 if x <= .04045 else ((x + .055) / 1.055) ** 2.4) for x in c) + (a,)  # sRGB → linear

def material(name, color, rough=.5, metal=0.0, coat=0.0, coat_rough=.15, emit=None, emit_strength=0.0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    p = m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value = hexrgb(color); p.inputs['Roughness'].default_value = rough
    p.inputs['Metallic'].default_value = metal
    if 'Coat Weight' in p.inputs: p.inputs['Coat Weight'].default_value = coat; p.inputs['Coat Roughness'].default_value = coat_rough
    if emit: p.inputs['Emission Color'].default_value = hexrgb(emit); p.inputs['Emission Strength'].default_value = emit_strength
    return m

def assign(obj, mat):
    obj.data.materials.clear(); obj.data.materials.append(mat); smooth_shade(obj); return obj

# ------------------------------------------------------------------ palette (sampled from the reference art)
M = {
    'robe': material('Robe', '#3d5329', rough=.7, coat=.15, coat_rough=.4),
    'hood': material('Hood', '#3f562b', rough=.66, coat=.2, coat_rough=.35),
    'dark': material('HandDark', '#2c3a21', rough=.6, coat=.2),
    'face': material('Face', '#121412', rough=.32, coat=.7, coat_rough=.1),
    'white': material('EyeWhite', '#f2f2ee', rough=.2, coat=.8, coat_rough=.05),
    'rim': material('GoggleRim', '#e6e6e2', rough=.25, coat=.6),
    'pupil': material('Pupil', '#060606', rough=.1, coat=1.0, coat_rough=.02),
    'snout': material('Snout', '#1b1b1b', rough=.35, coat=.5),
    'steel': material('SnoutRim', '#a3a39e', rough=.28, metal=.6, coat=.3),
    'belt': material('Belt', '#18200f', rough=.5, coat=.3),
    'brass': material('Buckle', '#d6d2c0', rough=.3, metal=.35, coat=.4),
    'hole': material('SnoutHole', '#030303', rough=.9),
    'shoe': material('Shoe', '#0b0b0c', rough=.3, coat=.8, coat_rough=.08),
}

# ------------------------------------------------------------------ body: short flared robe, belt with a pale buckle, big shoes, nub arms
def rbox(name, loc, size, bevel=.35):
    bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1.0); me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    o = link(bpy.data.objects.new(name, me)); o.data.transform(Matrix.Diagonal((*size, 1))); o.location = loc
    bv = o.modifiers.new('b', 'BEVEL'); bv.width = min(size) * bevel; bv.segments = 4
    sd = o.modifiers.new('s', 'SUBSURF'); sd.levels = sd.render_levels = 2; return apply_mods(o)

robe = lathe('Robe', [(0, .08), (.262, .08), (.292, .092), (.304, .125), (.298, .18), (.278, .25), (.25, .31),
                      (.215, .36), (.175, .4), (0, .42)], segs=72)
robe = subdiv(robe, 1); assign(robe, M['robe'])
belt = lathe('Belt', [(.262, .25), (.274, .256), (.277, .27), (.274, .284), (.262, .29), (.254, .284), (.254, .256), (.262, .25)], segs=72)
belt = subdiv(belt, 1); assign(belt, M['belt'])
buckle = rbox('Buckle', (0, -.272, .27), (.075, .018, .048), .3)
buckle = cut(buckle, rbox('h', (0, -.285, .27), (.042, .03, .022), .3)); smooth_shade(buckle); assign(buckle, M['brass'])

feet = []
for s, nm in ((1, 'Foot_L'), (-1, 'Foot_R')):
    f = sphere(nm, (s * .12, -.1, .066), (.11, .155, .074), 40, 20)
    flat = sphere('fc', (s * .12, -.1, -.03), (.25, .3, .075), 16, 8)  # flatten the sole
    f = cut(f, flat); f = fuse(nm, [f], voxel=.004, smooth=4, target=1400); assign(f, M['shoe']); feet.append(f)

arms = []
for s, nm in ((1, 'Arm_L'), (-1, 'Arm_R')):
    a = tube(nm, [Vector((s * .2, .02, .36)), Vector((s * .262, .0, .3)), Vector((s * .282, -.02, .225))], [.056, .05, .045], res=8)
    hand = sphere('hand', (s * .284, -.03, .198), (.058, .054, .06), 32, 16)
    arm = fuse(nm, [a], voxel=.005, smooth=4, target=1600); assign(arm, M['robe']); arms.append(arm)
    hand.name = 'Hand_' + nm[-1]; hand = fuse(hand.name, [hand], voxel=.004, smooth=3, target=900); assign(hand, M['dark']); arms.append(hand)

# ------------------------------------------------------------------ head: big hood with the floppy tip; a glossy black mask that bulges out of it
TIP = [Vector((0, .04, .9)), Vector((.014, .13, 1.05)), Vector((.034, .255, 1.11)), Vector((.056, .37, 1.075))]
dome = sphere('dome', (0, 0, .64), (.3, .285, .305), 64, 32)
tip = tube('tip', TIP, [.165, .094, .047, .016], res=10)
hood = fuse('Hood', [dome, tip], voxel=.006, smooth=10, smooth_factor=.6)
hood = cut(hood, sphere('open', (0, -.25, .6), (.228, .15, .232), 48, 24), voxel=.005, smooth=6)
hood = decimate(hood, min(1, 10000 / len(hood.data.polygons))); assign(hood, M['hood'])
face = sphere('Face', (0, -.12, .6), (.216, .2, .226), 64, 32); assign(face, M['face'])

# goggles: thick white rings with glossy black lenses (as in the reference art)
goggles = []
def torus(name, R, r, U=64, V=16):
    me = bpy.data.meshes.new(name); bm = bmesh.new()
    vs = [[bm.verts.new(((R + r * math.cos(v * 2 * math.pi / V)) * math.cos(u * 2 * math.pi / U), r * math.sin(v * 2 * math.pi / V),
                         (R + r * math.cos(v * 2 * math.pi / V)) * math.sin(u * 2 * math.pi / U))) for v in range(V)] for u in range(U)]
    for u in range(U):
        for v in range(V): bm.faces.new((vs[u][v], vs[(u + 1) % U][v], vs[(u + 1) % U][(v + 1) % V], vs[u][(v + 1) % V]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces); bm.to_mesh(me); bm.free(); return link(bpy.data.objects.new(name, me))
for s, sx in ((1, 'L'), (-1, 'R')):
    c = Vector((s * .1, -.338, .655)); tilt = Matrix.Rotation(s * math.radians(-14), 4, 'Z') @ Matrix.Rotation(math.radians(-6), 4, 'X')
    cup = lathe('Cup_' + sx, [(0, .002), (.074, .002), (.082, .02), (.084, .11), (0, .11)], segs=48)  # goggle cup back into the mask
    cup.data.transform(Matrix.Translation(c) @ tilt @ Matrix.Rotation(math.radians(-90), 4, 'X')); assign(cup, M['face']); goggles.append(cup)
    rim = torus('GoggleRim_' + sx, .078, .03); rim.data.transform(Matrix.Translation(c) @ tilt); assign(rim, M['white'])
    lens = sphere('Lens_' + sx, (0, 0, 0), (.062, .02, .062), 40, 20)
    lens.data.transform(Matrix.Translation(c + tilt.to_3x3() @ Vector((0, .004, 0))) @ tilt); assign(lens, M['pupil'])
    goggles += [rim, lens]

# respirator snout: a big black canister with a white rim and a dark recessed filter
SN_T = Matrix.Translation((0, -.268, .528)) @ Matrix.Rotation(math.radians(98), 4, 'X')
snout = lathe('Snout', [(0, 0), (.064, 0), (.074, .01), (.078, .03), (.078, .1), (.072, .114), (.06, .12), (0, .12)], segs=48)
snout.data.transform(SN_T); snout = subdiv(snout, 1); assign(snout, M['snout'])
srim = lathe('SnoutRim', [(.054, .112), (.074, .112), (.083, .122), (.076, .132), (.056, .132), (.05, .122), (.054, .112)], segs=48)
srim.data.transform(SN_T); srim = subdiv(srim, 1); assign(srim, M['white'])
grill = lathe('Grill', [(0, .1), (.05, .1), (.053, .118), (0, .112)], segs=40); grill.data.transform(SN_T); assign(grill, M['hole'])

# ------------------------------------------------------------------ armature + deterministic weights
arm_d = bpy.data.armatures.new('SnifferRig'); rig = link(bpy.data.objects.new('SnifferRig', arm_d))
activate(rig); bpy.ops.object.mode_set(mode='EDIT')
def bone(n, h, t, parent=None):
    b = arm_d.edit_bones.new(n); b.head = h; b.tail = t
    if parent: b.parent = arm_d.edit_bones[parent]
    return b
bone('root', (0, 0, 0), (0, 0, .07)); bone('body', (0, 0, .08), (0, 0, .4), 'root'); bone('head', (0, 0, .42), (0, 0, .85), 'body')
bone('tip1', TIP[0], TIP[1], 'head'); bone('tip2', TIP[1], TIP[2], 'tip1'); bone('tip3', TIP[2], TIP[3], 'tip2')
bone('arm_L', (.2, .02, .36), (.282, -.02, .225), 'body'); bone('arm_R', (-.2, .02, .36), (-.282, -.02, .225), 'body')
bone('foot_L', (.12, -.03, .066), (.12, -.2, .066), 'root'); bone('foot_R', (-.12, -.03, .066), (-.12, -.2, .066), 'root')
bone('snout', (0, -.26, .53), (0, -.39, .515), 'head')
bpy.ops.object.mode_set(mode='OBJECT')

def skin(obj, weights):
    """weights: dict bone → weight (constant) or callable(co) → dict."""
    obj.parent = rig; m = obj.modifiers.new('Armature', 'ARMATURE'); m.object = rig
    groups = {}
    for v in obj.data.vertices:
        w = weights(v.co) if callable(weights) else weights
        tot = sum(w.values()) or 1
        for b, x in w.items():
            if x <= 0: continue
            if b not in groups: groups[b] = obj.vertex_groups.new(name=b)
            groups[b].add([v.index], x / tot, 'REPLACE')

def seg_param(p):
    """Closest position along the TIP polyline, 0..3 (bone index + fraction); -1 when below the tip root."""
    best, bt = 1e9, -1
    for i in range(3):
        a, b = TIP[i], TIP[i + 1]; ab = b - a; t = max(0, min(1, (p - a).dot(ab) / ab.length_squared))
        d = (a + ab * t - p).length
        if d < best: best, bt = d, i + t
    return bt
def hood_w(p):
    if p.z < .84: return {'head': 1}
    t = seg_param(p); base = max(0, min(1, (p.z - .84) / .09))  # blend into the chain over the top of the dome
    if t <= 0.0: return {'head': 1 - base * .5, 'tip1': base * .5}
    i = min(2, int(t)); f = t - i
    w = {'head': 0.0, 'tip1': 0.0, 'tip2': 0.0, 'tip3': 0.0}
    names = ['tip1', 'tip2', 'tip3']
    w[names[i]] += 1 - max(0, f - .6) / .4 * .5
    if i < 2: w[names[i + 1]] += max(0, f - .6) / .4 * .5
    if i == 0 and f < .3: w['head'] += (.3 - f) / .3 * (1 - base * .5)
    return w

skin(robe, {'body': 1}); skin(belt, {'body': 1}); skin(buckle, {'body': 1})
for f, s in zip(feet, 'LR'): skin(f, {'foot_' + s: 1})
for a in arms: skin(a, {'arm_' + a.name[-1]: 1})
skin(hood, hood_w); skin(face, {'head': 1})
for g in goggles: skin(g, {'head': 1})
for o in (snout, srim, grill): skin(o, {'snout': 1})

# ------------------------------------------------------------------ bake ambient occlusion into vertex colours (multiplies base colour in three.js)
scene.render.engine = 'CYCLES'; scene.cycles.device = 'CPU'; scene.cycles.samples = 64
meshes = [o for o in scene.objects if o.type == 'MESH']
for o in meshes:
    o.data.color_attributes.new('AO', 'FLOAT_COLOR', 'POINT'); o.data.color_attributes.active_color = o.data.color_attributes['AO']
scene.render.bake.target = 'VERTEX_COLORS'
for o in meshes:
    activate(o)
    bpy.ops.object.bake(type='AO')
# soften: AO multiplies albedo; keep it gentle so colours stay clean (0.55 → 1.0 range)
for o in meshes:
    ca = o.data.color_attributes['AO']
    for d in ca.data:
        v = d.color[0]; v = .55 + .45 * v; d.color = (v, v, v, 1)

# ------------------------------------------------------------------ renders for review (optional)
if args.renders:
    os.makedirs(args.renders, exist_ok=True)
    world = bpy.data.worlds.new('w'); scene.world = world; world.use_nodes = True
    world.node_tree.nodes['Background'].inputs[0].default_value = (.55, .5, .62, 1); world.node_tree.nodes['Background'].inputs[1].default_value = .8
    def light(n, t, loc, e, c=(1, 1, 1), size=1.0):
        l = bpy.data.lights.new(n, t); l.energy = e; l.color = c
        if t == 'AREA': l.size = size
        o = link(bpy.data.objects.new(n, l)); o.location = loc
        o.rotation_euler = (Vector((0, 0, .6)) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler(); return o
    light('key', 'AREA', (1.6, -2.2, 2.2), 260, (1, .93, .85), 1.5); light('fill', 'AREA', (-2.2, -1.5, 1.2), 90, (.8, .85, 1), 2)
    light('rim', 'AREA', (0, 2.2, 1.8), 160, (1, 1, 1), 1.5)
    camd = bpy.data.cameras.new('cam'); camd.lens = 70; cam = link(bpy.data.objects.new('cam', camd)); scene.camera = cam
    scene.render.resolution_x = scene.render.resolution_y = 640; scene.cycles.samples = args.samples; scene.cycles.use_denoising = True
    scene.render.film_transparent = False; scene.view_settings.view_transform = 'AgX'
    for name, ang in (('front', -20), ('side', -95), ('back', 160), ('three_q', -45)):
        a = math.radians(ang - 90); cam.location = (3.4 * math.cos(a), 3.4 * math.sin(a), 1.0)
        cam.rotation_euler = (Vector((0, 0, .6)) - cam.location).to_track_quat('-Z', 'Y').to_euler()
        scene.render.filepath = os.path.join(args.renders, f'sniffer_{name}.png'); bpy.ops.render.render(write_still=True)

# ------------------------------------------------------------------ export
os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
for o in scene.objects: o.select_set(o.type in ('MESH', 'ARMATURE'))
props = bpy.ops.export_scene.gltf.get_rna_type().properties.keys()
opts = dict(filepath=os.path.abspath(args.out), export_format='GLB', use_selection=True, export_apply=False,
            export_skins=True, export_animations=False, export_yup=True, export_materials='EXPORT')
if 'export_vertex_color' in props: opts['export_vertex_color'] = 'ACTIVE'
elif 'export_colors' in props: opts['export_colors'] = True
if 'export_all_vertex_colors' in props: opts['export_all_vertex_colors'] = False
bpy.ops.export_scene.gltf(**opts)
tris = 0
for o in meshes: o.data.calc_loop_triangles(); tris += len(o.data.loop_triangles)
print('exported', args.out, 'tris', tris, 'objects', len(meshes))
