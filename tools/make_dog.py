# Visvrienden - maakt 4 gedetailleerde honden (dog0..3.glb) in Blender.
# Gebruik (Blender, Scripting-tab > Python Console):
#   P = r"<pad naar deze file>"; exec(compile(open(P, encoding="utf8").read(), P, "exec"), {"__file__": P})
# Of in een terminal: blender --background --python tools/make_dog.py
# Uitvoer: public/models/angler0.glb ... angler3.glb  (+ _dog_log.txt)
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
    L = DOGS[look]; c = Char(f"dog{look}")
    fur, fur2, belly, ear, paw, nose, eye = L["fur"], L["fur2"], L["belly"], L["ear"], L["paw"], L["nose"], L["eye"]
    for n, g in (("legFL", (-0.11, 0.34, 0.26)), ("legFR", (0.11, 0.34, 0.26)), ("legBL", (-0.11, 0.34, -0.26)), ("legBR", (0.11, 0.34, -0.26)),
                 ("head", (0, 0.72, 0.38)), ("tail", (0, 0.58, -0.38))): c.pivot(n, g)
    # romp: borst, middenstuk, achterlijf, buik, nek
    c.part("body", "sphere", fur, (0.33, 0.37, 0.42), (0, 0.5, 0.18))                    # borstkas
    c.part("body", "sphere", fur, (0.31, 0.34, 0.66), (0, 0.5, -0.02))                     # middenstuk
    c.part("body", "sphere", fur, (0.3, 0.34, 0.4), (0, 0.5, -0.22))                    # achterlijf / heupen
    c.part("body", "sphere", belly, (0.24, 0.14, 0.5), (0, 0.37, 0.02))                  # buik
    c.part("body", "sphere", belly, (0.22, 0.2, 0.16), (0, 0.46, 0.34))                  # borst-bef
    if L["saddle"]: c.part("body", "sphere", L["saddle"], (0.285, 0.15, 0.56), (0, 0.6, -0.02))   # zadelvlek
    c.part("body", "sphere", fur, (0.2, 0.26, 0.24), (0, 0.62, 0.33), rot=(-0.5, 0, 0))   # nek
    # halsband met penning
    c.part("body", "cyl", L["collar"], (0.2, 0.05, 0.2), (0, 0.64, 0.34), rot=(-0.5, 0, 0), rough=0.5)
    c.part("body", "sphere", "#e8c84a", (0.045, 0.045, 0.02), (0, 0.55, 0.43), rough=0.3)
    # poten (links/rechts, voor/achter): bovenpoot, onderpoot, pootje
    for n in ("legFL", "legFR", "legBL", "legBR"):
        back = n.startswith("legB")
        c.part(n, "sphere", fur, (0.15, 0.2, 0.2) if back else (0.13, 0.18, 0.16), (0, -0.04, 0))     # schouder / dij
        c.part(n, "cyl", fur, (0.075, 0.2, 0.075), (0, -0.17, 0.0 if not back else -0.01))             # onderpoot
        c.part(n, "sphere", paw, (0.105, 0.065, 0.14), (0, -0.31, 0.025))                              # pootje
        for dx in (-0.03, 0.0, 0.03): c.part(n, "sphere", paw, (0.035, 0.03, 0.05), (dx, -0.315, 0.1))  # tenen
    # kop
    c.part("head", "sphere", fur, (0.22, 0.2, 0.24), (0, 0.03, 0.08))                    # schedel
    c.part("head", "sphere", L["muz"], (0.13, 0.1, 0.17), (0, -0.04, 0.22))              # snuit
    c.part("head", "sphere", L["muz"], (0.11, 0.05, 0.14), (0, -0.085, 0.2))             # onderkaak
    c.part("head", "sphere", nose, (0.06, 0.045, 0.04), (0, -0.015, 0.305), rough=0.2)  # neus
    c.part("head", "box", "#2a1414", (0.1, 0.012, 0.02), (0, -0.075, 0.28))              # mondlijn
    c.part("head", "sphere", "#e87a8a", (0.05, 0.015, 0.09), (0, -0.095, 0.26), rough=0.6) # tong
    for sx in (-1, 1):
        c.part("head", "sphere", eye, (0.045, 0.05, 0.035), (sx * 0.07, 0.07, 0.17), rough=0.2)
        c.part("head", "sphere", "#ffffff", (0.012, 0.014, 0.01), (sx * 0.062, 0.082, 0.19), rough=0.1)   # lichtpuntje
        if L["brow"]: c.part("head", "sphere", L["brow"], (0.06, 0.035, 0.04), (sx * 0.07, 0.12, 0.165))    # wenkbrauwvlek
        c.part("head", "sphere", ear, (0.075, 0.17, 0.12), (sx * 0.125, 0.04, 0.04), rot=(0, 0, sx * -0.35))  # hangoren
        c.part("head", "sphere", ear, (0.05, 0.09, 0.07), (sx * 0.14, -0.04, 0.05), rot=(0, 0, sx * -0.35))
        c.part("head", "sphere", fur2 or fur, (0.1, 0.08, 0.12), (sx * 0.09, -0.02, 0.15))               # wangen
    if L["mask"]: c.part("head", "sphere", L["mask"], (0.17, 0.14, 0.1), (0, 0.02, 0.17))                 # masker (husky)
    # staart: gebogen reeks overlappende bollen (aaneengesloten), punt lichter
    segs = ((0.03, -0.06, 0.11, -0.9), (0.09, -0.12, 0.105, -0.7), (0.16, -0.16, 0.1, -0.45), (0.23, -0.18, 0.095, -0.2), (0.3, -0.18, 0.09, 0.05), (0.36, -0.16, 0.085, 0.3))
    for i, (y, z, w, rx) in enumerate(segs):
        col = L["tailtip"] if (i >= 4 and L["tailtip"]) else fur
        c.part("tail", "sphere", col, (w, w, 0.19), (0, y, z), rot=(rx, 0, 0))
    c.finish()
    return c

DOGS = [
    dict(fur="#b8844a", fur2="#c89658", belly="#e8d0a0", ear="#8a5a2a", paw="#e8d0a0", muz="#d8aa70", nose="#2a1a1a", eye="#2a1a14", collar="#c8423a", saddle=None, brow=None, mask=None, tailtip="#d8aa70"),
    dict(fur="#e8d8b8", fur2=None, belly="#f4ecd8", ear="#8a5a3a", paw="#f4ecd8", muz="#f1e6cc", nose="#2a1a1a", eye="#2a1a14", collar="#3a78c8", saddle="#b88a5a", brow="#b88a5a", mask=None, tailtip="#f4ecd8"),
    dict(fur="#4a2e22", fur2=None, belly="#3a2218", ear="#3a2218", paw="#b8844a", muz="#b8844a", nose="#141010", eye="#1a120e", collar="#e8962a", saddle=None, brow="#b8844a", mask=None, tailtip=None),
    dict(fur="#8a8f96", fur2="#a8adb4", belly="#f0f0f2", ear="#5a5f66", paw="#f0f0f2", muz="#f0f0f2", nose="#1a1a1e", eye="#6ac0e8", collar="#2f8a4a", saddle="#5e636a", brow=None, mask="#e8e8ec", tailtip="#e8e8ec"),
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
        p = os.path.join(OUT, f"dog{i}.glb")
        export(c, p); log("ok", p, os.path.getsize(p), "bytes", len(c.objs), "objecten")
        clean()
    log("KLAAR")
except Exception:
    log("FOUT", traceback.format_exc())
try:
    open(os.path.join(OUT, "_dog_log.txt"), "w", encoding="utf8").write("\n".join(LOG))
except Exception as e: print(e)
