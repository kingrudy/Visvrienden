# Visvrienden - 4 vissers in zachte klei/knuffel-stijl (angler0..3.glb) in Blender.
# Grote kop, afgeronde vormen, rode wangen, gestreepte gebreide trui, vest met zakken, dikke laarzen, emmer met vis.
# Gebruik (Blender, Scripting-tab > Python Console):
#   P = r"<pad naar deze file>"; exec(compile(open(P, encoding="utf8").read(), P, "exec"), {"__file__": P})
# Of in een terminal: blender --background --python tools/make_anglers_klei.py
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
        try: bmesh.ops.create_uvsphere(bm, u_segments=24, v_segments=16, radius=0.5)
        except TypeError: bmesh.ops.create_uvsphere(bm, u_segments=24, v_segments=16, diameter=0.5)
    elif kind in ("cyl", "cone"):
        try: bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=24, radius1=0.5, radius2=0.5 * r2, depth=1.0)
        except TypeError: bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=24, diameter1=1.0, diameter2=1.0 * r2, depth=1.0)
    else:
        bmesh.ops.create_cube(bm, size=1.0)
        if kind == "box":
            try: bmesh.ops.bevel(bm, geom=list(bm.edges), offset=0.3, segments=3, profile=0.5, affect="EDGES")
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

def stripes_cycle(L, i): return L["stripes"][i % len(L["stripes"])]

def build(look):
    L = LOOKS[look]; c = Char(f"angler{look}")
    for n, g in (("legL", (-0.13, 0.85, 0)), ("legR", (0.13, 0.85, 0)), ("armL", (-0.37, 1.45, 0)), ("armR", (0.37, 1.45, 0)), ("head", (0, 1.78, 0))): c.pivot(n, g)
    skin, rib = L["skin"], L["rib"]
    # ---------------- benen, laarzen
    for n, sx in (("legL", -1), ("legR", 1)):
        c.part(n, "box", L["pants"], (0.25, 0.52, 0.27), (0, -0.27, 0))
        c.part(n, "box", L["boots"], (0.285, 0.4, 0.32), (0, -0.65, 0.02), rough=0.55)
        c.part(n, "box", L["boots2"], (0.305, 0.075, 0.34), (0, -0.47, 0.02), rough=0.6)          # omgeslagen rand
        c.part(n, "sphere", L["boots"], (0.25, 0.17, 0.22), (0, -0.76, 0.16), rough=0.55)          # neus van de laars
        c.part(n, "box", "#3a2a20", (0.31, 0.075, 0.42), (0, -0.815, 0.06), rough=0.7)             # zool
    if L["patch"]:
        c.part("legL", "box", L["patch"], (0.11, 0.11, 0.03), (0.02, -0.28, 0.135))
        for dx in (-0.045, 0.045): c.part("legL", "box", "#2a3a2a", (0.01, 0.1, 0.012), (0.02 + dx, -0.28, 0.152))
    # ---------------- romp: broek, gebreide trui met banden, kraag
    c.part("body", "box", L["pants"], (0.54, 0.22, 0.36), (0, 0.93, 0))
    c.part("body", "box", rib, (0.57, 0.08, 0.38), (0, 0.99, 0))                                   # boord onderaan de trui
    for i in range(6):
        y = 1.07 + i * 0.075; w = 0.55 + 0.035 * math.sin((i + 0.5) / 6 * math.pi)
        c.part("body", "box", stripes_cycle(L, i), (w, 0.1, w * 0.66), (0, y, 0))
    c.part("body", "box", L["stripes"][0], (0.58, 0.1, 0.38), (0, 1.52, 0))                          # schouderstuk
    c.part("body", "cyl", rib, (0.3, 0.12, 0.3), (0, 1.62, 0))                                      # rolkraag
    c.part("body", "cyl", rib, (0.27, 0.07, 0.27), (0, 1.69, 0))
    c.part("body", "sphere", skin, (0.17, 0.12, 0.17), (0, 1.67, 0.0))                              # hals
    # ---------------- vest met zakken (of tuinbroek of regenjas)
    if L["vest"]:
        for sx in (-1, 1):
            c.part("body", "box", L["vest"], (0.24, 0.56, 0.1), (sx * 0.17, 1.27, 0.19), rough=0.7)
            c.part("body", "box", L["vest"], (0.13, 0.15, 0.3), (sx * 0.17, 1.54, 0.0), rough=0.7)          # schouderbanden
            c.part("body", "box", L["vestd"], (0.16, 0.12, 0.06), (sx * 0.17, 1.1, 0.25), rough=0.6)        # onderste zak
            c.part("body", "box", L["vestd"], (0.17, 0.045, 0.065), (sx * 0.17, 1.17, 0.25), rough=0.6)     # klep
            c.part("body", "sphere", "#d8b84a", (0.03, 0.03, 0.02), (sx * 0.17, 1.15, 0.285), rough=0.3)    # knoopje
            c.part("body", "box", L["vestd"], (0.14, 0.1, 0.06), (sx * 0.17, 1.36, 0.25), rough=0.6)        # bovenste zak
            c.part("body", "sphere", "#d8b84a", (0.025, 0.025, 0.02), (sx * 0.17, 1.33, 0.285), rough=0.3)
        c.part("body", "box", L["vest"], (0.56, 0.56, 0.08), (0, 1.27, -0.2), rough=0.7)                    # rug
        c.part("body", "sphere", "#9a9aa2", (0.04, 0.04, 0.03), (0.1, 1.3, 0.27), rough=0.3)               # ringetje
        c.part("body", "box", "#7a7a84", (0.03, 0.13, 0.03), (-0.12, 1.45, 0.29), rough=0.3)                # tangetje
    if L["bib"]:
        c.part("body", "box", L["bib"], (0.32, 0.3, 0.07), (0, 1.17, 0.2), rough=0.8)
        for sx in (-1, 1):
            c.part("body", "box", L["bib"], (0.07, 0.38, 0.07), (sx * 0.14, 1.5, 0.17), rough=0.8)
            c.part("body", "sphere", "#d8b84a", (0.045, 0.045, 0.03), (sx * 0.14, 1.3, 0.24), rough=0.3)
        c.part("body", "box", "#a6762a", (0.12, 0.09, 0.04), (0, 1.15, 0.245), rough=0.8)
    if L["coat"]:
        c.part("body", "box", L["coat"], (0.64, 0.5, 0.44), (0, 1.0, 0))
        c.part("body", "box", L["coat"], (0.62, 0.42, 0.4), (0, 1.43, 0))
        c.part("body", "box", L["coatd"], (0.5, 0.025, 0.02), (0, 1.1, 0.222))
    c.part("body", "box", L["pack"], (0.34, 0.34, 0.16), (0, 1.25, -0.28), rough=0.7)               # rugzak
    c.part("body", "box", L["pack2"], (0.24, 0.07, 0.17), (0, 1.43, -0.28), rough=0.6)
    # ---------------- armen: gestreepte mouwen, boord, handschoenen
    for sx, n in ((-1, "armL"), (1, "armR")):
        sl = L["coat"] or None
        c.part(n, "sphere", sl or L["stripes"][0], (0.24, 0.22, 0.24), (0, 0, 0))
        for k in range(5):
            c.part(n, "cyl", sl or stripes_cycle(L, k + 1), (0.2, 0.09, 0.2), (0, -0.09 - k * 0.085, 0))
        c.part(n, "cyl", L["coatd"] if sl else rib, (0.185, 0.08, 0.185), (0, -0.53, 0))
        c.part(n, "sphere", L["glove"], (0.18, 0.17, 0.17), (0, -0.64, 0.02), rough=0.9)
        c.part(n, "sphere", L["glove"], (0.07, 0.11, 0.07), (-sx * 0.085, -0.6, 0.075), rough=0.9)       # duim
    if L["bucket"]:       # emmer met vis in de linkerhand
        n = "armL"; bz = 0.1
        c.part(n, "cone", "#8fb4e8", (0.25, 0.3, 0.25), (0, -1.0, bz), r2=1.28, rough=0.4)
        c.part(n, "cyl", "#6f94c8", (0.33, 0.03, 0.33), (0, -0.85, bz), rough=0.4)
        for t in range(7):
            a = math.pi * t / 6
            c.part(n, "sphere", "#9a9aa2", (0.028, 0.028, 0.028), (math.cos(a) * 0.15, -0.85 + math.sin(a) * 0.12, bz), rough=0.3)
        for dx, dz, rz in ((-0.05, 0.0, 0.4), (0.06, 0.04, -0.5)):
            c.part(n, "sphere", "#aab4c8", (0.16, 0.06, 0.06), (dx, -0.86, bz + dz), rot=(0, 0, rz), rough=0.3)
            c.part(n, "cone", "#8a94a8", (0.07, 0.07, 0.02), (dx + 0.09 * (1 if rz < 0 else -1), -0.82, bz + dz), rot=(0, 0, 1.4 if rz > 0 else -1.4), rough=0.4)
    # ---------------- hoofd: grote, ronde kop met rode wangen
    c.part("head", "sphere", skin, (0.5, 0.46, 0.46), (0, 0, 0), rough=0.7)
    c.part("head", "sphere", skin, (0.4, 0.2, 0.38), (0, -0.12, 0.04), rough=0.7)
    for sx in (-1, 1):
        c.part("head", "sphere", "#e8806a", (0.11, 0.085, 0.05), (sx * 0.165, -0.06, 0.2), rough=0.9)     # rode wangen
        c.part("head", "sphere", skin, (0.085, 0.13, 0.07), (sx * 0.25, -0.02, 0.0), rough=0.7)            # oren
        c.part("head", "sphere", "#e8806a", (0.04, 0.07, 0.03), (sx * 0.25, -0.02, 0.025), rough=0.9)
        c.part("head", "sphere", "#16141a", (0.06, 0.072, 0.04), (sx * 0.1, 0.05, 0.205), rough=0.15)      # ogen
        c.part("head", "sphere", "#ffffff", (0.02, 0.022, 0.015), (sx * 0.088, 0.07, 0.232), rough=0.1)
        c.part("head", "box", L["hair"], (0.12, 0.035, 0.035), (sx * 0.105, 0.135, 0.205), rot=(0, 0, sx * 0.22))   # wenkbrauwen
        if L["freckles"]:
            for dx, dy in ((-0.03, 0.0), (0.0, 0.015), (0.03, -0.005)): c.part("head", "sphere", "#b8705a", (0.014, 0.014, 0.01), (sx * 0.165 + dx, -0.03 + dy, 0.235), rough=0.9)
    c.part("head", "sphere", L["nose"], (0.1, 0.09, 0.09), (0, -0.035, 0.225), rough=0.6)                     # ronde neus
    if L["beard"]:
        c.part("head", "sphere", L["beard"], (0.44, 0.3, 0.32), (0, -0.18, 0.06))
        c.part("head", "sphere", L["beard"], (0.3, 0.16, 0.2), (0, -0.3, 0.13))
        for sx in (-1, 1):
            c.part("head", "sphere", L["beard"], (0.12, 0.22, 0.22), (sx * 0.2, -0.1, 0.06))
            c.part("head", "sphere", L["beard"], (0.13, 0.065, 0.08), (sx * 0.065, -0.08, 0.235))              # snor
        c.part("head", "box", "#4a1a1a", (0.13, 0.045, 0.02), (0, -0.135, 0.255), rough=0.5)                   # lachende mond
        c.part("head", "box", "#fbf6ea", (0.1, 0.025, 0.02), (0, -0.122, 0.262), rough=0.4)                    # tanden
    else:
        c.part("head", "box", "#8a3a3a", (0.12, 0.028, 0.025), (0, -0.14, 0.215), rough=0.5)
        c.part("head", "box", "#fbf6ea", (0.08, 0.02, 0.02), (0, -0.131, 0.222), rough=0.4)
    c.part("head", "sphere", L["hair"], (0.5, 0.3, 0.46), (0, 0.1, -0.03))                                     # haar
    if L["braids"]:
        for sx in (-1, 1):
            c.part("head", "sphere", L["hair"], (0.16, 0.28, 0.16), (sx * 0.26, -0.12, -0.02))
            c.part("head", "sphere", L["hair"], (0.12, 0.12, 0.12), (sx * 0.26, -0.3, -0.02))
            c.part("head", "sphere", "#c8423a", (0.07, 0.04, 0.07), (sx * 0.26, -0.22, -0.02), rough=0.5)
    if L["glasses"]:
        for sx in (-1, 1):
            c.part("head", "cyl", "#2a2a30", (0.13, 0.02, 0.13), (sx * 0.1, 0.05, 0.225), rot=(math.pi / 2, 0, 0), rough=0.3)
        c.part("head", "box", "#2a2a30", (0.05, 0.015, 0.02), (0, 0.06, 0.235))
    hat = L["hat"]; hc, hb = L["hatc"], L["hatb"]
    if hat == "beanie":
        c.part("head", "sphere", hc, (0.52, 0.36, 0.51), (0, 0.13, -0.01), rough=0.95)
        c.part("head", "cyl", hb, (0.52, 0.1, 0.5), (0, 0.045, -0.005), rough=0.95)
        if L["pompom"]: c.part("head", "sphere", L["pompom"], (0.13, 0.13, 0.13), (0, 0.33, -0.01), rough=1.0)
    elif hat == "cap":
        c.part("head", "cyl", hc, (0.5, 0.11, 0.49), (0, 0.15, 0), rough=0.8)
        c.part("head", "sphere", hc, (0.5, 0.2, 0.49), (0, 0.19, 0), rough=0.8)
        c.part("head", "cyl", hb, (0.51, 0.045, 0.5), (0, 0.095, 0), rough=0.8)
        c.part("head", "box", "#1a1a22", (0.34, 0.03, 0.17), (0, 0.075, 0.25), rot=(0.2, 0, 0), rough=0.4)
        c.part("head", "sphere", "#d8b84a", (0.06, 0.06, 0.02), (0, 0.15, 0.245), rough=0.3)
    else:  # kap van de regenjas
        c.part("head", "sphere", hc, (0.58, 0.54, 0.54), (0, 0.04, -0.09), rough=0.5)
        c.part("head", "box", hc, (0.42, 0.045, 0.17), (0, 0.19, 0.2), rot=(0.28, 0, 0), rough=0.5)
        c.part("head", "box", hb, (0.44, 0.03, 0.03), (0, 0.17, 0.27), rough=0.5)
    c.finish()
    return c

LOOKS = [   # Dirk: marineblauwe muts, oranje trui, bruin vest, groene broek, bruine laarzen, baard, emmer met vis
    dict(skin="#f1c19c", hair="#6a4226", beard="#7a4a2a", nose="#e89a82", freckles=False, braids=False, glasses=False,
         hat="beanie", hatc="#2f4a8a", hatb="#243a70", pompom=None,
         stripes=["#e8772a", "#d8b078", "#e8772a", "#3f74b8", "#d8b078", "#e8772a"], rib="#c8601e",
         vest="#7a5636", vestd="#664628", bib=None, coat=None, coatd="#c8a020", pants="#3f6a3f", patch="#365a36",
         boots="#6a4428", boots2="#563620", glove="#7a8a4a", pack="#6a4a2a", pack2="#d8d0b8", bucket=True),
    dict(skin="#e6b08c", hair="#b8642a", beard=None, nose="#e0907a", freckles=True, braids=True, glasses=False,
         hat="beanie", hatc="#2fa89a", hatb="#238a80", pompom="#f2d23a",
         stripes=["#d8423a", "#f4ecd8", "#d8423a", "#f4ecd8", "#2f6aa8", "#f4ecd8"], rib="#b8322a",
         vest=None, vestd="", bib="#3a5f9a", coat=None, coatd="", pants="#3a5f9a", patch=None,
         boots="#d8b02a", boots2="#b8901a", glove="#d86a3a", pack="#2f4a6a", pack2="#d8d0b8", bucket=False),
    dict(skin="#b87a56", hair="#d8d8d8", beard="#e4e4e4", nose="#d08a70", freckles=False, braids=False, glasses=False,
         hat="cap", hatc="#1f2f4a", hatb="#d8d8d8", pompom=None,
         stripes=["#8f979f", "#f2f2ee", "#8f979f", "#8f979f", "#f2f2ee", "#8f979f"], rib="#6f777f",
         vest="#4a6a4a", vestd="#3a5a3a", bib=None, coat=None, coatd="", pants="#5a4a32", patch=None,
         boots="#2f3a2f", boots2="#232b23", glove="#5a4a32", pack="#7a5a2a", pack2="#d8d0b8", bucket=True),
    dict(skin="#f6d4b8", hair="#8a4a2a", beard=None, nose="#ee9a88", freckles=True, braids=False, glasses=True,
         hat="hood", hatc="#f2cf3a", hatb="#2a3a4a", pompom=None,
         stripes=["#3f8fd8", "#f4ecd8", "#3f8fd8", "#f4ecd8", "#3f8fd8", "#f4ecd8"], rib="#2f78bf",
         vest=None, vestd="", bib=None, coat="#f2cf3a", coatd="#c8a020", pants="#2a3a4a", patch=None,
         boots="#c8423a", boots2="#a8322a", glove="#2a3a4a", pack="#3a4a5a", pack2="#d8d0b8", bucket=False),
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
