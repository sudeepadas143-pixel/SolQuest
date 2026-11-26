"""Build Sniffer's skateboard in headless Blender and export a GLB.

    python3 sniffer/tools/build_board.py [--out sniffer/assets/models/board.glb] [--renders DIR]

Z up, nose = +X (exports to three.js as +X with Y up). Deck with kicktails and concave, grip tape on top, a printed
underside, cast trucks, glowing green urethane wheels (named Wheel_* so the site can spin them).
"""
import argparse, math, os, sys
import bpy, bmesh
from mathutils import Vector, Matrix

ap = argparse.ArgumentParser(); ap.add_argument('--out', default=os.path.join(os.path.dirname(__file__), '..', 'assets', 'models', 'board.glb'))
ap.add_argument('--renders', default=''); args = ap.parse_args(sys.argv[1:])
bpy.ops.wm.read_factory_settings(use_empty=True); scene = bpy.context.scene; col = scene.collection

def lin(h):
    h = h.lstrip('#'); c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple((x / 12.92 if x <= .04045 else ((x + .055) / 1.055) ** 2.4) for x in c) + (1,)
def mat(name, color, rough=.5, metal=0., coat=0., emit=None, es=0.):
    m = bpy.data.materials.new(name); m.use_nodes = True; p = m.node_tree.nodes['Principled BSDF']
    p.inputs['Base Color'].default_value = lin(color); p.inputs['Roughness'].default_value = rough; p.inputs['Metallic'].default_value = metal
    p.inputs['Coat Weight'].default_value = coat
    if emit: p.inputs['Emission Color'].default_value = lin(emit); p.inputs['Emission Strength'].default_value = es
    return m
def obj_from_bm(name, bm):
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free(); o = bpy.data.objects.new(name, me); col.objects.link(o)
    o.data.polygons.foreach_set('use_smooth', [True] * len(o.data.polygons)); return o
def apply_mods(o):
    dg = bpy.context.evaluated_depsgraph_get(); me = bpy.data.meshes.new_from_object(o.evaluated_get(dg)); o.modifiers.clear(); o.data = me; return o

GRIP, DECK_BOTTOM, EDGE = mat('Grip', '#151515', .95), mat('DeckPrint', '#8fd14f', .45, coat=.6), mat('DeckPly', '#d8c49a', .7)
METAL, BUSH = mat('Truck', '#b9bdc4', .3, .9), mat('Bushing', '#f2c84b', .5)
URE = mat('Urethane', '#a8ff74', .35, coat=.5, emit='#7dff4a', es=2.5)

# deck: rounded-rect grid → kicktails + concave → solidify → subdivide
L, W, R = .41, .108, .1
bm = bmesh.new(); NX, NY = 64, 14; grid = {}
for i in range(NX + 1):
    for j in range(NY + 1):
        x = -L + 2 * L * i / NX; y = -W + 2 * W * j / NY
        ax = max(0, abs(x) - (L - R)); ay = max(0, abs(y) - (W - R * .9))  # pull corners in to round the ends
        if ax > 0:
            k = 1 - (ax / R) ** 2; y *= math.sqrt(max(.02, k)) if abs(y) > 0 else 1
        z = (max(0, abs(x) - .28) ** 2) * 3.2 + (y / W) ** 2 * .006  # kicktails + concave
        grid[i, j] = bm.verts.new((x, y, z))
for i in range(NX):
    for j in range(NY): bm.faces.new((grid[i, j], grid[i + 1, j], grid[i + 1, j + 1], grid[i, j + 1]))
deck = obj_from_bm('Deck', bm)
sol = deck.modifiers.new('s', 'SOLIDIFY'); sol.thickness = .013; sol.offset = -1; sol.material_offset = 1; sol.material_offset_rim = 2
deck.data.materials.append(GRIP); deck.data.materials.append(DECK_BOTTOM); deck.data.materials.append(EDGE)
sd = deck.modifiers.new('d', 'SUBSURF'); sd.levels = 1; apply_mods(deck); deck.location.z = .1

def cyl(name, r, h, loc, rot=(0, 0, 0), m=METAL, segs=24, bevel=.003):
    bm = bmesh.new(); bmesh.ops.create_cone(bm, cap_ends=True, segments=segs, radius1=r, radius2=r, depth=h)
    o = obj_from_bm(name, bm); o.data.materials.append(m); o.rotation_euler = rot; o.location = loc
    b = o.modifiers.new('b', 'BEVEL'); b.width = bevel; b.segments = 2; b.limit_method = 'ANGLE'; apply_mods(o)
    o.data.polygons.foreach_set('use_smooth', [True] * len(o.data.polygons)); return o
def box(name, size, loc, m=METAL, bevel=.004):
    bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1); o = obj_from_bm(name, bm); o.data.transform(Matrix.Diagonal((*size, 1)))
    o.data.materials.append(m); o.location = loc; b = o.modifiers.new('b', 'BEVEL'); b.width = bevel; b.segments = 3; apply_mods(o)
    o.data.polygons.foreach_set('use_smooth', [True] * len(o.data.polygons)); return o

for sx, tag in ((.27, 'F'), (-.27, 'B')):
    box('Base_' + tag, (.07, .055, .01), (sx, 0, .093))
    box('Hanger_' + tag, (.04, .17, .03), (sx, 0, .062), bevel=.009)
    cyl('Kingpin_' + tag, .009, .03, (sx, 0, .08), m=METAL, segs=12)
    cyl('Bush_' + tag, .014, .012, (sx, 0, .077), m=BUSH, segs=16)
    cyl('Axle_' + tag, .005, .25, (sx, 0, .045), rot=(math.pi / 2, 0, 0), segs=10)
    for sy, w in ((.105, 'L'), (-.105, 'R')):
        bm = bmesh.new(); prof = [(.0, -.018), (.024, -.018), (.031, -.014), (.034, -.006), (.034, .006), (.031, .014), (.024, .018), (0, .018)]
        rings = []
        for r, y in prof:
            rings.append([bm.verts.new((r * math.cos(2 * math.pi * k / 32), y, r * math.sin(2 * math.pi * k / 32))) for k in range(32)])
        for a, b in zip(rings, rings[1:]):
            for k in range(32): bm.faces.new((a[k], a[(k + 1) % 32], b[(k + 1) % 32], b[k]))
        bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5); bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        o = obj_from_bm(f'Wheel_{tag}{w}', bm); o.data.materials.append(URE); o.location = (sx, sy, .034)

if args.renders:
    os.makedirs(args.renders, exist_ok=True); scene.render.engine = 'CYCLES'; scene.cycles.samples = 32; scene.cycles.use_denoising = True
    w = bpy.data.worlds.new('w'); scene.world = w; w.use_nodes = True; w.node_tree.nodes['Background'].inputs[0].default_value = (.5, .5, .58, 1)
    l = bpy.data.lights.new('k', 'AREA'); l.energy = 80; l.size = 1; lo = bpy.data.objects.new('k', l); col.objects.link(lo); lo.location = (.6, -.8, 1)
    lo.rotation_euler = (Vector((0, 0, .05)) - lo.location).to_track_quat('-Z', 'Y').to_euler()
    cd = bpy.data.cameras.new('c'); cd.lens = 60; c = bpy.data.objects.new('c', cd); col.objects.link(c); scene.camera = c
    scene.render.resolution_x, scene.render.resolution_y = 640, 400
    for n, pos in (('top', (.7, -.9, .55)), ('under', (.6, -.7, -.35))):
        c.location = pos; c.rotation_euler = (Vector((0, 0, .06)) - c.location).to_track_quat('-Z', 'Y').to_euler()
        scene.render.filepath = os.path.join(args.renders, f'board_{n}.png'); bpy.ops.render.render(write_still=True)

for o in scene.objects: o.select_set(o.type == 'MESH')
bpy.ops.export_scene.gltf(filepath=os.path.abspath(args.out), export_format='GLB', use_selection=True, export_yup=True, export_materials='EXPORT')
print('exported', args.out)
