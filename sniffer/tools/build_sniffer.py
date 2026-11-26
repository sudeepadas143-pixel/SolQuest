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

def fuse(name, objs, voxel=0.006, smooth=6, smooth_factor=.5):
    """Union by voxel remesh (organic, seamless), then relax."""
    for o in objs[1:]:
        m = objs[0].modifiers.new('u', 'BOOLEAN'); m.operation = 'UNION'; m.object = o; m.solver = 'MANIFOLD' if hasattr(m, 'solver') else 'EXACT'
    apply_mods(objs[0])
    for o in objs[1:]: bpy.data.objects.remove(o, do_unlink=True)
    o = objs[0]; o.name = name
    r = o.modifiers.new('r', 'REMESH'); r.mode = 'VOXEL'; r.voxel_size = voxel; r.adaptivity = 0
    s = o.modifiers.new('s', 'LAPLACIANSMOOTH'); s.iterations = smooth; s.lambda_factor = smooth_factor; s.use_volume_preserve = True
    apply_mods(o); return o

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
    'robe': material('Robe', '#4a6236', rough=.62, coat=.25, coat_rough=.35),
    'hood': material('Hood', '#4d6638', rough=.58, coat=.3, coat_rough=.3),
    'dark': material('HandDark', '#2c3a21', rough=.6, coat=.2),
    'face': material('Face', '#121412', rough=.32, coat=.7, coat_rough=.1),
    'white': material('EyeWhite', '#f4f4f0', rough=.18, coat=.8, coat_rough=.05),
    'rim': material('GoggleRim', '#e6e6e2', rough=.25, coat=.6),
    'pupil': material('Pupil', '#060606', rough=.1, coat=1.0, coat_rough=.02),
    'snout': material('Snout', '#1b1b1b', rough=.35, coat=.5),
    'steel': material('SnoutRim', '#a3a39e', rough=.28, metal=.6, coat=.3),
    'belt': material('Belt', '#2a2016', rough=.55, coat=.2),
    'brass': material('Buckle', '#c9a54e', rough=.22, metal=.9),
    'shoe': material('Shoe', '#0b0b0c', rough=.3, coat=.8, coat_rough=.08),
}

# ------------------------------------------------------------------ body: robe, belt, buckle, feet, arms
robe = lathe('Robe', [(0, .075), (.238, .075), (.262, .085), (.276, .115), (.272, .17), (.262, .24), (.245, .31),
                      (.226, .37), (.205, .43), (.18, .49), (.15, .54), (0, .56)], segs=72)
robe = subdiv(robe, 1); assign(robe, M['robe'])

belt = lathe('Belt', [(.236, .345), (.243, .352), (.245, .362), (.243, .372), (.236, .379), (.229, .372), (.229, .352), (.236, .345)], segs=72)
belt = subdiv(belt, 1); assign(belt, M['belt'])
buckle = sphere('Buckle', (0, -.245, .362), (.042, .012, .03), 32, 16)
hole = sphere('h', (0, -.258, .362), (.024, .02, .014), 24, 12)
buckle = cut(buckle, hole); smooth_shade(buckle); assign(buckle, M['brass'])

feet = []
for s, nm in ((1, 'Foot_L'), (-1, 'Foot_R')):
    f = sphere(nm, (s * .105, -.055, .055), (.085, .125, .06), 40, 20)
    flat = sphere('fc', (s * .105, -.055, -.03), (.2, .25, .07), 16, 8)  # flatten the sole
    f = cut(f, flat); f = fuse(nm, [f], voxel=.004, smooth=4); assign(f, M['shoe']); feet.append(f)

arms = []
for s, nm in ((1, 'Arm_L'), (-1, 'Arm_R')):
    a = tube(nm, [Vector((s * .17, .01, .47)), Vector((s * .235, .0, .40)), Vector((s * .255, -.015, .31))], [.05, .046, .04], res=8)
    hand = sphere('hand', (s * .258, -.022, .285), (.052, .048, .056), 32, 16)
    arm = fuse(nm, [a], voxel=.005, smooth=4); assign(arm, M['robe']); arms.append(arm)
    hand.name = 'Hand_' + nm[-1]; hand = fuse(hand.name, [hand], voxel=.004, smooth=3); assign(hand, M['dark']); arms.append(hand)

# ------------------------------------------------------------------ head: hood with the floppy tip, recessed black face
TIP = [Vector((0, .035, .93)), Vector((.012, .115, 1.07)), Vector((.03, .23, 1.13)), Vector((.05, .335, 1.095))]
dome = sphere('dome', (0, 0, .735), (.27, .255, .275), 64, 32)
tip = tube('tip', TIP, [.15, .085, .042, .014], res=10)
hood = fuse('Hood', [dome, tip], voxel=.006, smooth=10, smooth_factor=.6)
opening = sphere('open', (0, -.215, .705), (.195, .14, .2), 48, 24)
hood = cut(hood, opening, voxel=.005, smooth=6)
hood = decimate(hood, .35); assign(hood, M['hood'])
face = sphere('Face', (0, -.06, .705), (.188, .17, .195), 64, 32); assign(face, M['face'])

# goggles: thick white rim, bulging white eye, glossy black pupil (pupils are their own nodes so they can look around)
goggles, pupils = [], []
for s, sx in ((1, 'L'), (-1, 'R')):
    c = Vector((s * .078, -.215, .735)); tilt = Matrix.Rotation(s * math.radians(-17), 4, 'Z') @ Matrix.Rotation(math.radians(-4), 4, 'X')
    tor = bpy.data.meshes.new('torus'); bm = bmesh.new()
    R, r, U, V = .068, .019, 64, 16
    vs = [[bm.verts.new(((R + r * math.cos(v * 2 * math.pi / V)) * math.cos(u * 2 * math.pi / U), r * math.sin(v * 2 * math.pi / V),
                         (R + r * math.cos(v * 2 * math.pi / V)) * math.sin(u * 2 * math.pi / U))) for v in range(V)] for u in range(U)]
    for u in range(U):
        for v in range(V): bm.faces.new((vs[u][v], vs[(u + 1) % U][v], vs[(u + 1) % U][(v + 1) % V], vs[u][(v + 1) % V]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces); bm.to_mesh(tor); bm.free()
    rim = link(bpy.data.objects.new('GoggleRim_' + sx, tor)); rim.data.transform(Matrix.Translation(c) @ tilt)
    assign(rim, M['rim'])
    eye = sphere('Eye_' + sx, (0, 0, 0), (.062, .026, .062), 48, 24); eye.data.transform(Matrix.Translation(c + tilt.to_3x3() @ Vector((0, -.004, 0))) @ tilt); assign(eye, M['white'])
    pup = sphere('Pupil_' + sx, (0, 0, 0), (.03, .012, .034), 32, 16)
    pc = c + tilt.to_3x3() @ Vector((-s * .012, -.024, -.006))
    pup.data.transform(Matrix.Translation(pc) @ tilt); assign(pup, M['pupil']); pupils.append(pup)
    goggles += [rim, eye]

# respirator snout: bevelled black canister, steel rim, recessed dark filter with vent holes
snout = lathe('Snout', [(0, 0), (.05, 0), (.057, .006), (.059, .02), (.059, .07), (.054, .082), (.044, .086), (0, .086)], segs=48)
snout.data.transform(Matrix.Translation((0, -.205, .628)) @ Matrix.Rotation(math.radians(90), 4, 'X'))
snout = subdiv(snout, 1); assign(snout, M['snout'])
srim = lathe('SnoutRim', [(.043, .083), (.054, .083), (.058, .089), (.054, .095), (.043, .095), (.04, .089), (.043, .083)], segs=48)
srim.data.transform(Matrix.Translation((0, -.205, .628)) @ Matrix.Rotation(math.radians(90), 4, 'X'))
srim = subdiv(srim, 1); assign(srim, M['steel'])
grill = sphere('Grill', (0, -.29, .628), (.041, .006, .041), 40, 12)
for k in range(7):
    a = k / 7 * 2 * math.pi; x, z = (0, 0) if k == 0 else (.022 * math.cos(a), .022 * math.sin(a))
    if k: grill = cut(grill, sphere('v', (x, -.297, .628 + z), (.007, .01, .007), 12, 8))
grill = cut(grill, sphere('v', (0, -.297, .628), (.008, .01, .008), 12, 8)); assign(grill, M['snout'])

# ------------------------------------------------------------------ armature + deterministic weights
arm_d = bpy.data.armatures.new('SnifferRig'); rig = link(bpy.data.objects.new('SnifferRig', arm_d))
activate(rig); bpy.ops.object.mode_set(mode='EDIT')
def bone(n, h, t, parent=None):
    b = arm_d.edit_bones.new(n); b.head = h; b.tail = t
    if parent: b.parent = arm_d.edit_bones[parent]
    return b
bone('root', (0, 0, 0), (0, 0, .07)); bone('body', (0, 0, .075), (0, 0, .5), 'root'); bone('head', (0, 0, .52), (0, 0, .9), 'body')
bone('tip1', TIP[0], TIP[1], 'head'); bone('tip2', TIP[1], TIP[2], 'tip1'); bone('tip3', TIP[2], TIP[3], 'tip2')
bone('arm_L', (.17, .01, .47), (.255, -.015, .31), 'body'); bone('arm_R', (-.17, .01, .47), (-.255, -.015, .31), 'body')
bone('foot_L', (.105, -.0, .06), (.105, -.15, .06), 'root'); bone('foot_R', (-.105, 0, .06), (-.105, -.15, .06), 'root')
bone('pupil_L', (.078, -.2, .735), (.078, -.26, .735), 'head'); bone('pupil_R', (-.078, -.2, .735), (-.078, -.26, .735), 'head')
bone('snout', (0, -.2, .628), (0, -.29, .628), 'head')
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
    if p.z < .86: return {'head': 1}
    t = seg_param(p); base = max(0, min(1, (p.z - .86) / .09))  # blend into the chain over the top of the dome
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
for p, s in zip(pupils, 'LR'): skin(p, {'pupil_' + s: 1})
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
