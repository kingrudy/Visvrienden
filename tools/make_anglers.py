# Visvrienden - maakt de 4 vissers (angler0..3.glb) in Blender.
# Gebruik (Blender, Scripting-tab > Python Console):
#   P = r"<pad naar deze file>"; exec(compile(open(P, encoding="utf8").read(), P, "exec"), {"__file__": P})
# Of in een terminal: blender --background --python tools/make_anglers.py
# Uitvoer: public/models/angler0.glb ... angler3.glb  (+ _export_log.txt)
import bpy, bmesh, os, math, traceback
from mathutils import Matrix, Vector, Euler

HERE = os.path.dirname(os.path.abspath(globals().get("__file__", "")))
OUT = os.path.normpath(os.path.join(HERE, "..", "public", "models"))
os.makedirs(OUT, exist_ok=True)
LOG = []
def log(*a):
    s = " ".join(str(x) for x in a); LOG.append(s); print(s)

def lin(c):  # sRGB-hex -> lineair
    c = c.lstrip("#"); r, g, b = [int(c[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    f = lambda v: v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4
    return (f(r), f(g), f(b), 1.0)

MATS = {}
def material(hexc, rough=0.8):
    if hexc not in MATS:
        m = bpy.data.materials.new("m" + hexc.lstrip("#")); m.use_nodes = True
        bsdf = m.node_tree.nodes.get("Principled BSDF")
        bsdf.inputs["Base Color"].default_value = lin(hexc)
        bsdf.inputs["Roughness"].default_value = rough
        m.diffuse_color = lin(hexc)
        MATS[hexc] = m
    return MATS[hexc]

def prim(kind, r2=1.0):
    bm = bmesh.new()
    if kind == "sphere":
        try: bmesh.ops.create_uvsphere(bm, u_segments=18, v_segments=12, radius=0.5)
        except TypeError: bmesh.ops.create_uvsphere(bm, u_segments=18, v_segments=12, diameter=0.5)
    elif kind in ("cyl", "cone"):
        try: bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=20, radius1=0.5, radius2=0.5 * r2, depth=1.0)
        except TypeError: bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=20, diameter1=1.0, diameter2=1.0 * r2, depth=1.0)
    else:
        bmesh.ops.create_cube(bm, size=1.0)
        if kind == "box":
            try: bmesh.ops.bevel(bm, geom=list(bm.edges), offset=0.16, segments=2, profile=0.5, affect="EDGES")
            except Exception as e: log("bevel", e)
    return bm

class Char:
    def __init__(self, name):
        self.name = name; self.acc = {}; self.pivots = {}; self.objs = []
        self.root = self.empty("root", (0, 0, 0), None)
        self.body = self.empty("body", (0, 0, 0), self.root)
    def empty(self, name, g, parent):
        o = bpy.data.objects.new(name, None); o.empty_display_type = "PLAIN_AXES"
        o.location = (g[0], -g[2], g[1])           # game (x,y,z) -> Blender (x,-z,y)
        bpy.context.scene.collection.objects.link(o); o.parent = parent; self.objs.append(o); return o
    def pivot(self, name, g):
        self.pivots[name] = (self.empty(name, g, self.body), Vector(g)); return name
    def part(self, pv, kind, color, size, pos, rot=(0, 0, 0), r2=1.0, rough=0.8):
        """pos = positie t.o.v. de pivot (spel-assen: x rechts, y omhoog, z voren)."""
        bm = prim(kind, r2)
        sx, sy, sz = size; px, py, pz = pos
        # rotatie in spel-assen -> Blender (z-as spiegelt)
        rx, ry, rz = rot
        R = Euler((rx, -rz, ry), "XYZ").to_matrix().to_4x4()
        # kegel/cilinder-as is Blender-Z = spel-y
        S = Matrix.Diagonal((sx, sz, sy, 1.0))
        T = Matrix.Translation((px, -pz, py))
        bmesh.ops.transform(bm, matrix=T @ R @ S, verts=bm.verts)
        key = (pv, color, rough)
        if key not in self.acc: self.acc[key] = bmesh.new()
        tmp = bpy.data.meshes.new("tmp"); bm.to_mesh(tmp); bm.free(); self.acc[key].from_mesh(tmp); bpy.data.meshes.remove(tmp)
    def finish(self):
        for (pv, color, rough), bm in self.acc.items():
            for f in bm.faces: f.smooth = True
            bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
            me = bpy.data.meshes.new(f"{pv}_{color.lstrip('#')}"); bm.to_mesh(me); bm.free()
            me.materials.append(material(color, rough))
            ob = bpy.data.objects.new(f"{pv}_{color.lstrip('#')}", me)
            bpy.context.scene.collection.objects.link(ob); ob.parent = self.body if pv == "body" else self.pivots[pv][0]
            # de pivot-empty zit op de pivotpositie: geometrie is lokaal tov. die pivot
            self.objs.append(ob)
        self.acc = {}

def build(look):
    L = LOOKS[look]; c = Char(f"angler{look}")
    for n, g in (("legL", (-0.12, 0.85, 0)), ("legR", (0.12, 0.85, 0)), ("armL", (-0.33, 1.42, 0)), ("armR", (0.33, 1.42, 0)), ("head", (0, 1.72, 0))): c.pivot(n, g)
    skin, shirt, pants, boot = L["skin"], L["shirt"], L["pants"], L["boots"]
    # benen en laarzen
    for n in ("legL", "legR"):
        c.part(n, "box", pants, (0.2, 0.58, 0.22), (0, -0.33, 0))
        c.part(n, "box", boot, (0.225, 0.3, 0.25), (0, -0.69, 0.005))
        c.part(n, "box", "#2a2420", (0.235, 0.07, 0.33), (0, -0.815, 0.045))
        c.part(n, "box", boot, (0.235, 0.05, 0.255), (0, -0.55, 0.005))
    # romp (pivot "body" = oorsprong op de grond)
    c.part("body", "box", pants, (0.44, 0.14, 0.27), (0, 0.9, 0))
    c.part("body", "box", "#4a3322", (0.47, 0.06, 0.29), (0, 0.97, 0), rough=0.6)
    c.part("body", "box", "#c8a24a", (0.07, 0.05, 0.02), (0, 0.97, 0.15), rough=0.3)
    c.part("body", "box", shirt, (0.45, 0.34, 0.28), (0, 1.12, 0))
    c.part("body", "box", shirt, (0.52, 0.34, 0.3), (0, 1.38, 0))
    c.part("body", "sphere", skin, (0.14, 0.14, 0.14), (0, 1.54, 0))
    c.part("body", "box", L["collar"], (0.24, 0.07, 0.24), (0, 1.55, 0.0))
    if L["vest"]:
        c.part("body", "box", L["vest"], (0.54, 0.5, 0.325), (0, 1.22, 0.01))
        for sx in (-1, 1):
            c.part("body", "box", L["vestd"], (0.15, 0.12, 0.05), (sx * 0.14, 1.07, 0.17))
            c.part("body", "box", L["vestd"], (0.12, 0.09, 0.05), (sx * 0.15, 1.31, 0.17))
        c.part("body", "box", "#d8d8d0", (0.015, 0.45, 0.02), (0, 1.22, 0.172), rough=0.4)
    if L["suspenders"]:
        for sx in (-1, 1):
            c.part("body", "box", "#5a3a22", (0.045, 0.56, 0.02), (sx * 0.12, 1.2, 0.158), rot=(0, 0, 0.0))
    if L["coat"]:
        c.part("body", "box", L["coat"], (0.58, 0.46, 0.36), (0, 0.98, 0))
        c.part("body", "box", L["coat"], (0.56, 0.4, 0.32), (0, 1.36, 0))
    # rugzak / tackle box (achterkant = -z)
    c.part("body", "box", L["pack"], (0.3, 0.32, 0.14), (0, 1.22, -0.23))
    c.part("body", "box", "#d8d0b8", (0.2, 0.06, 0.15), (0, 1.36, -0.23), rough=0.4)
    c.part("body", "box", "#2a2a2a", (0.06, 0.04, 0.04), (0, 1.22, -0.31))
    # armen
    for sx, n in ((-1, "armL"), (1, "armR")):
        c.part(n, "sphere", L["coat"] or shirt, (0.18, 0.18, 0.18), (0, 0, 0))
        c.part(n, "box", L["coat"] or shirt, (0.15, 0.34, 0.16), (0, -0.16, 0))
        c.part(n, "box", L["coat"] or shirt, (0.165, 0.05, 0.175), (0, -0.33, 0))
        c.part(n, "cyl", skin, (0.115, 0.28, 0.12), (0, -0.48, 0))
        c.part(n, "sphere", L["glove"] or skin, (0.14, 0.14, 0.14), (0, -0.66, 0.01))
    # hoofd
    c.part("head", "sphere", skin, (0.32, 0.34, 0.32), (0, 0, 0))
    c.part("head", "sphere", skin, (0.3, 0.2, 0.3), (0, -0.09, 0.015))           # kin
    c.part("head", "sphere", skin, (0.05, 0.05, 0.055), (0, -0.02, 0.17))        # neus
    for sx in (-1, 1):
        c.part("head", "sphere", skin, (0.05, 0.09, 0.05), (sx * 0.165, 0, 0))   # oren
        c.part("head", "sphere", "#f5f5f0", (0.07, 0.06, 0.04), (sx * 0.08, 0.035, 0.14), rough=0.3)
        c.part("head", "sphere", "#1b1b22", (0.04, 0.045, 0.03), (sx * 0.08, 0.035, 0.158), rough=0.2)
        c.part("head", "box", L["hair"], (0.085, 0.02, 0.025), (sx * 0.08, 0.09, 0.15), rot=(0, 0, sx * -0.12))
        c.part("head", "sphere", "#e89a8a", (0.06, 0.04, 0.03), (sx * 0.1, -0.04, 0.14), rough=0.9)  # wangen
    c.part("head", "box", "#8a3a3a", (0.09, 0.018, 0.025), (0, -0.095, 0.15), rough=0.5)  # mond
    c.part("head", "sphere", L["hair"], (0.345, 0.24, 0.34), (0, 0.07, -0.015))           # haar
    if L["hair2"]: c.part("head", "sphere", L["hair"], (0.34, 0.22, 0.2), (0, -0.02, -0.12))
    if L["beard"]:
        c.part("head", "sphere", L["beard"], (0.28, 0.14, 0.15), (0, -0.13, 0.09))
        c.part("head", "sphere", L["beard"], (0.13, 0.04, 0.05), (0, -0.065, 0.165))
    if L["glasses"]:
        for sx in (-1, 1): c.part("head", "box", "#16161c", (0.105, 0.075, 0.02), (sx * 0.085, 0.035, 0.172), rough=0.15)
        c.part("head", "box", "#16161c", (0.05, 0.015, 0.02), (0, 0.045, 0.172))
    hat, hc, hb = L["hat"], L["hatc"], L["band"]
    if hat == "bucket":
        c.part("head", "cone", hc, (0.36, 0.17, 0.36), (0, 0.17, 0), r2=0.78)
        c.part("head", "cyl", hc, (0.5, 0.035, 0.5), (0, 0.095, 0), rot=(0.0, 0, 0))
        c.part("head", "cyl", hb, (0.365, 0.035, 0.365), (0, 0.125, 0))
        c.part("head", "sphere", hc, (0.28, 0.06, 0.28), (0, 0.255, 0))
    elif hat == "cap":
        c.part("head", "sphere", hc, (0.36, 0.3, 0.36), (0, 0.075, -0.005))
        c.part("head", "box", hc, (0.3, 0.03, 0.21), (0, 0.05, 0.2), rot=(0.18, 0, 0))
        c.part("head", "sphere", hb, (0.05, 0.05, 0.05), (0, 0.235, 0))
        c.part("head", "box", hb, (0.14, 0.07, 0.015), (0, 0.11, 0.18))
    elif hat == "straw":
        c.part("head", "cone", hc, (0.36, 0.17, 0.36), (0, 0.18, 0), r2=0.85)
        c.part("head", "cyl", hc, (0.66, 0.03, 0.66), (0, 0.1, 0))
        c.part("head", "cyl", hb, (0.375, 0.05, 0.375), (0, 0.13, 0))
        c.part("head", "sphere", hc, (0.28, 0.07, 0.28), (0, 0.265, 0))
    else:  # hood (regenjas)
        c.part("head", "sphere", L["coat"], (0.44, 0.44, 0.43), (0, 0.02, -0.075))
        c.part("head", "box", L["coat"], (0.34, 0.035, 0.14), (0, 0.135, 0.16), rot=(0.25, 0, 0))
        c.part("head", "box", hb, (0.34, 0.03, 0.03), (0, 0.095, 0.2))
    c.finish()
    return c

LOOKS = [
    dict(skin="#f1c9a5", shirt="#c8423a", pants="#3a4a6a", boots="#2f5a3a", collar="#e8e0d0", vest="#7a6a3a", vestd="#5e5028", suspenders=False, coat=None, pack="#6a4a2a",
         glove=None, hair="#6a4a2a", hair2=False, beard=None, glasses=False, hat="bucket", hatc="#e8c84a", band="#8a5a2a"),
    dict(skin="#d8a07a", shirt="#3a78c8", pants="#4a4a3a", boots="#3a3a3a", collar="#dfe6ef", vest="#e8742a", vestd="#c25a1a", suspenders=False, coat=None, pack="#2a4a6a",
         glove=None, hair="#2a2018", hair2=False, beard=None, glasses=True, hat="cap", hatc="#2f8a4a", band="#e8e0d0"),
    dict(skin="#a8714f", shirt="#4a8a4a", pants="#6a5a3a", boots="#4a3a2a", collar="#d8d0b0", vest=None, vestd="", suspenders=True, coat=None, pack="#7a5a2a",
         glove=None, hair="#c8c8c8", hair2=True, beard="#cfcfcf", glasses=False, hat="straw", hatc="#e0c878", band="#b8402a"),
    dict(skin="#f6d7bd", shirt="#e8962a", pants="#2a3a4a", boots="#1f3a52", collar="#f2d23a", vest=None, vestd="", suspenders=False, coat="#f2d23a", pack="#3a4a5a",
         glove="#2a3a4a", hair="#b86a2a", hair2=True, beard=None, glasses=False, hat="hood", hatc="#f2d23a", band="#2a3a4a"),
]

def export(c, path):
    for o in bpy.data.objects: o.select_set(False)
    for o in c.objs: o.select_set(True)
    kw = dict(filepath=path, export_format="GLB", use_selection=True, export_apply=True, export_yup=True)
    try: bpy.ops.export_scene.gltf(**kw)
    except TypeError as e:
        log("export-kwargs", e); kw.pop("export_apply", None); bpy.ops.export_scene.gltf(**kw)

def clean():
    for o in list(bpy.data.objects): bpy.data.objects.remove(o, do_unlink=True)
    for m in list(bpy.data.meshes): bpy.data.meshes.remove(m)

try:
    log("Blender", bpy.app.version_string)
    clean()
    for i in range(4):
        c = build(i)
        p = os.path.join(OUT, f"angler{i}.glb")
        export(c, p); log("ok", p, os.path.getsize(p), "bytes", len(c.objs), "objecten")
        clean()
    log("KLAAR")
except Exception:
    log("FOUT", traceback.format_exc())
try:
    open(os.path.join(OUT, "_export_log.txt"), "w", encoding="utf8").write("\n".join(LOG))
except Exception as e: print(e)
