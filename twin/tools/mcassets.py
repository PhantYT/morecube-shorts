# Vanilla client assets: blockstates -> models (parents, textures) -> quad templates in block space.
import json, math, zipfile, io
import numpy as np
from PIL import Image

DIRS = ["down", "up", "north", "south", "west", "east"]
DVEC = {"down": (0, -1, 0), "up": (0, 1, 0), "north": (0, 0, -1), "south": (0, 0, 1), "west": (-1, 0, 0), "east": (1, 0, 0)}
DIDX = {d: i for i, d in enumerate(DIRS)}
VEC_D = {v: d for d, v in DVEC.items()}

# vertex order per face (FaceInfo), as (use_max_x, use_max_y, use_max_z)
FACE_INFO = {
    "down": [(0, 0, 1), (0, 0, 0), (1, 0, 0), (1, 0, 1)],
    "up": [(0, 1, 0), (0, 1, 1), (1, 1, 1), (1, 1, 0)],
    "north": [(1, 1, 0), (1, 0, 0), (0, 0, 0), (0, 1, 0)],
    "south": [(0, 1, 1), (0, 0, 1), (1, 0, 1), (1, 1, 1)],
    "west": [(0, 1, 0), (0, 0, 0), (0, 0, 1), (0, 1, 1)],
    "east": [(1, 1, 1), (1, 0, 1), (1, 0, 0), (1, 1, 0)],
}


def default_uv(d, f, t):
    if d == "down":
        return [f[0], 16 - t[2], t[0], 16 - f[2]]
    if d == "up":
        return [f[0], f[2], t[0], t[2]]
    if d == "north":
        return [16 - t[0], 16 - t[1], 16 - f[0], 16 - f[1]]
    if d == "south":
        return [f[0], 16 - t[1], t[0], 16 - f[1]]
    if d == "west":
        return [f[2], 16 - t[1], t[2], 16 - f[1]]
    return [16 - t[2], 16 - t[1], 16 - f[2], 16 - f[1]]  # east


def project_uv(d, p):
    """World-aligned uv (px) of a point p (px) on a face pointing d (uvlock)."""
    x, y, z = p
    if d == "up":
        return x, z
    if d == "down":
        return x, 16 - z
    if d == "north":
        return 16 - x, 16 - y
    if d == "south":
        return x, 16 - y
    if d == "west":
        return z, 16 - y
    return 16 - z, 16 - y


def rot_axis(axis, ang):
    c, s = math.cos(ang), math.sin(ang)
    if axis == "x":
        return np.array([[1, 0, 0], [0, c, -s], [0, s, c]])
    if axis == "y":
        return np.array([[c, 0, s], [0, 1, 0], [-s, 0, c]])
    return np.array([[c, -s, 0], [s, c, 0], [0, 0, 1]])


def model_rot(xdeg, ydeg):
    return rot_axis("y", math.radians(-ydeg)) @ rot_axis("x", math.radians(-xdeg))


def norm_name(n):
    n = n.split(":", 1)[1] if ":" in n else n
    return n


class Assets:
    def __init__(self, jar_path):
        self.z = zipfile.ZipFile(jar_path)
        self.names = set(self.z.namelist())
        self.mcache, self.bscache, self.tcache = {}, {}, {}

    def json(self, path):
        return json.loads(self.z.read(path).decode("utf-8"))

    def has(self, path):
        return path in self.names

    def blockstate(self, name):
        if name not in self.bscache:
            p = f"assets/minecraft/blockstates/{name}.json"
            self.bscache[name] = self.json(p) if self.has(p) else None
        return self.bscache[name]

    def model(self, name):
        name = norm_name(name)
        if name in self.mcache:
            return self.mcache[name]
        if name.startswith("builtin/"):
            m = {"textures": {}, "elements": [], "ao": True, "builtin": name}
            self.mcache[name] = m
            return m
        p = f"assets/minecraft/models/{name}.json"
        if not self.has(p):
            m = {"textures": {}, "elements": [], "ao": True, "missing": name}
            self.mcache[name] = m
            return m
        j = self.json(p)
        tex, elements, ao, builtin, chain = {}, None, True, None, [name]
        if "parent" in j:
            par = self.model(j["parent"])
            tex.update(par["textures"])
            elements = par["elements"]
            ao = par["ao"]
            builtin = par.get("builtin")
            chain = [name] + par.get("chain", [])
        tex.update(j.get("textures", {}))
        if "elements" in j:
            elements = j["elements"]
        if "ambientocclusion" in j:
            ao = j["ambientocclusion"]
        m = {"textures": tex, "elements": elements or [], "ao": ao, "chain": chain}
        if builtin and not (elements):
            m["builtin"] = builtin
        self.mcache[name] = m
        return m

    def texture(self, path):
        """RGBA 16x16 (first frame) for 'block/stone' style paths."""
        path = norm_name(path)
        if path in self.tcache:
            return self.tcache[path]
        p = f"assets/minecraft/textures/{path}.png"
        if not self.has(p):
            self.tcache[path] = None
            return None
        im = Image.open(io.BytesIO(self.z.read(p))).convert("RGBA")
        w, h = im.size
        if h > w:  # animated strip: first frame
            im = im.crop((0, 0, w, w))
        self.tcache[path] = im
        return im


def resolve_tex(textures, ref, depth=0):
    while ref and ref.startswith("#") and depth < 16:
        ref = textures.get(ref[1:])
        depth += 1
    return norm_name(ref) if ref else None


def match_cond(cond, props):
    if "OR" in cond:
        return any(match_cond(c, props) for c in cond["OR"])
    if "AND" in cond:
        return all(match_cond(c, props) for c in cond["AND"])
    for k, v in cond.items():
        if str(props.get(k, "")) not in str(v).split("|"):
            return False
    return True


def variant_matches(key, props):
    if key == "":
        return True
    for kv in key.split(","):
        k, v = kv.split("=")
        if str(props.get(k, "")) != v:
            return False
    return True


def state_slots(assets, name, props):
    """List of slots; each slot = list of options {model,x,y,uvlock,weight}."""
    bs = assets.blockstate(name)
    if bs is None:
        return []
    def as_list(v):
        return v if isinstance(v, list) else [v]
    if "variants" in bs:
        for k, v in bs["variants"].items():
            if variant_matches(k, props):
                return [as_list(v)]
        return []
    slots = []
    for part in bs.get("multipart", []):
        if "when" not in part or match_cond(part["when"], props):
            slots.append(as_list(part["apply"]))
    return slots


def build_quads(assets, opt, tex_index):
    """Quads for one model option. Each quad: dict(pos 4x3 (blocks), uv 4x2 (px), n, cull, tile, tint, ao, emissive-able)."""
    m = assets.model(opt["model"])
    if m.get("builtin") or not m["elements"]:
        return [], m
    R = model_rot(opt.get("x", 0), opt.get("y", 0))
    rotated = bool(opt.get("x", 0) or opt.get("y", 0))
    uvlock = bool(opt.get("uvlock", False)) and rotated
    quads = []
    for el in m["elements"]:
        f, t = el["from"], el["to"]
        er = el.get("rotation")
        Rel, org, scl = None, None, None
        if er and er.get("angle", 0):
            Rel = rot_axis(er["axis"], math.radians(er["angle"]))
            org = np.array(er.get("origin", [8, 8, 8]), dtype=float)
            scl = np.ones(3)
            if er.get("rescale"):
                k = 1.0 / math.cos(math.radians(abs(er["angle"])))
                ax = "xyz".index(er["axis"])
                for i in range(3):
                    if i != ax:
                        scl[i] = k
        for d, face in el.get("faces", {}).items():
            tp = resolve_tex(m["textures"], face.get("texture", ""))
            if tp is None:
                continue
            tile = tex_index(tp)
            if tile is None:
                continue
            pts = []
            for (mx, my, mz) in FACE_INFO[d]:
                pts.append([t[0] if mx else f[0], t[1] if my else f[1], t[2] if mz else f[2]])
            P = np.array(pts, dtype=float)
            uv = face.get("uv") or default_uv(d, f, t)
            r = int(face.get("rotation", 0)) // 90
            UV = []
            for i in range(4):
                j = (i + r) % 4
                UV.append([uv[0] if j in (0, 1) else uv[2], uv[1] if j in (0, 3) else uv[3]])
            if Rel is not None:
                P = ((P - org) @ Rel.T) * scl + org
            P = (P - 8.0) @ R.T + 8.0
            nrm = np.array(DVEC[d], dtype=float)
            if Rel is not None:
                nrm = Rel @ nrm
            nrm = R @ nrm
            nrm /= np.linalg.norm(nrm)
            wd = None
            for dd, vv in DVEC.items():
                if np.dot(nrm, vv) > 0.999:
                    wd = dd
            if uvlock and wd is not None:
                UV = [list(project_uv(wd, p)) for p in P]
            cull = face.get("cullface")
            if cull:
                cv = R @ np.array(DVEC[cull], dtype=float)
                cull = VEC_D.get(tuple(int(round(c)) for c in cv))
            # on the block boundary in the culled direction -> eligible for vertex AO
            on_edge = False
            if wd is not None:
                ax = [abs(c) for c in DVEC[wd]].index(1)
                side = 16.0 if DVEC[wd][ax] > 0 else 0.0
                on_edge = bool(np.all(np.abs(P[:, ax] - side) < 1e-3))
            quads.append({
                "pos": P / 16.0, "uv": np.array(UV, dtype=float), "n": nrm, "cull": cull, "wdir": wd,
                "tile": tile, "tint": face.get("tintindex") is not None, "edge": on_edge,
                "ao": bool(m["ao"]) and el.get("shade", True),
                "full_el": f == [0, 0, 0] and t == [16, 16, 16] and Rel is None,
            })
    return quads, m
