# Bake the spawn world into chunked binary meshes + one texture atlas for the Three.js twin.
# usage: python -I bake_world.py <world_dir> <client_jar> <out_dir>   (reads <out_dir>/survey/bounds.json)
import os, sys, json, glob, time, itertools
import numpy as np
from PIL import Image
from scipy import ndimage

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from anvil import region_chunks, chunk_sections
from mcassets import Assets, state_slots, build_quads, DIRS, DVEC

WORLD, JAR, OUT = sys.argv[1:4]
t0 = time.time()
SYNTH = WORLD.startswith("synthetic:")
META = {}
CH = 32  # mesh chunk size (columns)
INVIS = {"minecraft:air", "minecraft:cave_air", "minecraft:void_air", "minecraft:barrier", "minecraft:light", "minecraft:structure_void"}
os.makedirs(OUT, exist_ok=True)
if SYNTH:
    if WORLD == "synthetic:rwplaza":  # ep02 parody plaza
        from gen_rw import generate
    elif WORLD == "synthetic:copyspawn":  # ep03 «копия рилика» island
        from gen_copy import generate
    else:
        from gen_world import generate
    keys, S, (X0, Z0, Y0), META = generate()
    reg = {k: i for i, k in enumerate(keys)}
    NY, NZ, NX = S.shape
    X1, Z1, Y1 = X0 + NX, Z0 + NZ, Y0 + NY
else:
    B = json.load(open(sys.argv[4] if len(sys.argv) > 4 else os.path.join(OUT, "survey", "bounds.json")))
    X0, X1, Z0, Z1 = B["x0"], B["x1"], B["z0"], B["z1"]
    Y0, Y1 = B["ymin"], B["ymax"] + 2
    NY, NZ, NX = Y1 - Y0, Z1 - Z0, X1 - X0
    keys, reg = ["minecraft:air"], {"minecraft:air": 0}


def sid(k):
    if k.split("[")[0] in INVIS:
        return 0
    if k not in reg:
        reg[k] = len(keys)
        keys.append(k)
    return reg[k]


if not SYNTH:
    S = np.zeros((NY, NZ, NX), dtype=np.uint16)
bents = []
for rp in ([] if SYNTH else sorted(glob.glob(os.path.join(WORLD, "region", "*.mca")))):
    for root in region_chunks(rp):
        cx, cz = root["xPos"], root["zPos"]
        bx, bz = cx * 16 - X0, cz * 16 - Z0
        if bx < 0 or bz < 0 or bx + 16 > NX or bz + 16 > NZ:
            continue
        for sy, kl, idx in chunk_sections(root):
            lut = np.array([sid(k) for k in kl], dtype=np.uint16)
            by = sy * 16 - Y0
            ya, yb = max(0, by), min(NY, by + 16)
            if ya >= yb:
                continue
            S[ya:yb, bz:bz + 16, bx:bx + 16] = lut[idx].reshape(16, 16, 16)[ya - by:yb - by]
        for e in root.get("block_entities", []):
            if e.get("id") in ("minecraft:beehive", "minecraft:hopper", "minecraft:barrel", "minecraft:brewing_stand", "minecraft:dispenser", "minecraft:jukebox"):
                continue
            bents.append(e)
print(f"loaded {len(keys)} states in {time.time() - t0:.1f}s", flush=True)

# ------------------------------------------------------------------ states -> quad templates
A = Assets(JAR)
tiles, tile_of, tile_cls = [], {}, []


def tex_index(path):
    if path in tile_of:
        return tile_of[path]
    im = A.texture(path)
    if im is None:
        tile_of[path] = None
        return None
    im = im.resize((16, 16), Image.NEAREST) if im.size != (16, 16) else im
    a = np.asarray(im)[:, :, 3]
    cls = 0 if a.min() == 255 else (2 if ((a > 8) & (a < 247)).mean() > 0.05 else 1)
    tile_of[path] = len(tiles)
    tiles.append(im)
    tile_cls.append(cls)
    return tile_of[path]


GRASS, FOLIAGE, WATER = (0x91, 0xBD, 0x59), (0x77, 0xAB, 0x2F), (0x3F, 0x76, 0xE4)
TINT_FIXED = {"spruce_leaves": (0x61, 0x99, 0x61), "birch_leaves": (0x80, 0xA7, 0x55), "lily_pad": (0x20, 0x80, 0x30)}
GRASSY = {"grass_block", "short_grass", "tall_grass", "fern", "large_fern", "potted_fern", "sugar_cane"}
LIGHT = {"glowstone": 15, "sea_lantern": 15, "shroomlight": 15, "end_rod": 14, "lantern": 15, "soul_lantern": 10, "torch": 14, "wall_torch": 14,
         "jack_o_lantern": 15, "magma_block": 3, "beacon": 15, "crying_obsidian": 10, "redstone_wall_torch": 7, "soul_campfire": 10, "campfire": 15,
         "lava": 15, "sea_pickle": 6, "ochre_froglight": 15, "verdant_froglight": 15, "pearlescent_froglight": 15, "end_gateway": 15}
SELF_CULL_SUFFIX = ("glass", "_ice", "ice", "slime_block", "honey_block")
WATERY = {"water", "seagrass", "tall_seagrass", "kelp", "kelp_plant", "bubble_column"}


def tint_for(name, props):
    if name in TINT_FIXED:
        return TINT_FIXED[name]
    if name in GRASSY:
        return GRASS
    if name.endswith("leaves") or name == "vine":
        return FOLIAGE
    if name in ("water_cauldron", "water"):
        return WATER
    if name == "redstone_wire":
        p = int(props.get("power", 0)) / 15.0
        return (int(255 * (0.3 + 0.7 * p) if p > 0 else 0x4B), int(255 * max(0, p * p * 0.7 - 0.5)), int(255 * max(0, p * p * 0.6 - 0.7)))
    if name.endswith("_stem"):
        return (0xE0, 0xC7, 0x1C)
    return (255, 255, 255)


def parse_key(k):
    if "[" in k:
        n, p = k[:-1].split("[", 1)
        props = dict(kv.split("=") for kv in p.split(","))
    else:
        n, props = k, {}
    return n.split(":", 1)[1], props


NS = len(keys)
full_lut = np.zeros(NS, dtype=bool)
water_lut = np.zeros(NS, dtype=bool)
lava_lut = np.zeros(NS, dtype=bool)
name_id = np.zeros(NS, dtype=np.int32)
names = {}
info = [None] * NS
special = {}
for s in range(1, NS):
    name, props = parse_key(keys[s])
    name_id[s] = names.setdefault(name, len(names))
    if name in WATERY or props.get("waterlogged") == "true":
        water_lut[s] = True
    if name == "lava":
        lava_lut[s] = True
    if name in ("water", "lava", "bubble_column"):
        info[s] = {"variants": [], "weights": []}
        continue
    slots = state_slots(A, name, props)
    opts = [sl[:4] for sl in slots]
    combos = list(itertools.product(*opts)) if opts else []
    if len(combos) > 8:
        combos = combos[:8]
    variants, weights, plant = [], [], False
    for combo in combos:
        qs, w = [], 1.0
        for o in combo:
            q, m = build_quads(A, o, tex_index)
            qs += q
            w *= o.get("weight", 1)
            if any(("cross" in c) or ("crop" in c) for c in m.get("chain", [])):
                plant = True
        # coplanar duplicates (grass overlay): push the later quad outward a hair
        for i in range(len(qs)):
            for j in range(i):
                if np.allclose(qs[i]["pos"], qs[j]["pos"], atol=1e-5):
                    qs[i] = dict(qs[i], pos=qs[i]["pos"] + qs[i]["n"] * (1 / 512))
        variants.append(qs)
        weights.append(w)
    if not variants or all(len(v) == 0 for v in variants):
        special[s] = (name, props)
    # full opaque cube: one model, 6 face quads of one full element, all tiles opaque
    q0 = variants[0] if variants else []
    full = (len(variants) >= 1 and len(q0) == 6 and all(q["full_el"] and q["cull"] for q in q0)
            and all(tile_cls[q["tile"]] == 0 for q in q0) and not name.endswith("leaves"))
    full_lut[s] = full
    info[s] = {"variants": variants, "weights": weights, "tint": tint_for(name, props), "emi": LIGHT.get(name, 0) / 15.0
               if (name not in ("redstone_lamp",) or props.get("lit") == "true") else 0.0,
               "wave": 1 if name.endswith("leaves") else (2 if plant else 0), "selfcull": name.endswith(SELF_CULL_SUFFIX) and "pane" not in name,
               "name": name}
    if name == "redstone_lamp" and props.get("lit") == "true":
        info[s]["emi"] = 1.0
print(f"states resolved: {NS}, tiles {len(tiles)}, special {len(special)} in {time.time() - t0:.1f}s", flush=True)

# ------------------------------------------------------------------ visibility
F = full_lut[S]
lab, n = ndimage.label(~F)
border = set(np.unique(lab[[0, -1], :, :]).tolist()) | set(np.unique(lab[:, [0, -1], :]).tolist()) | set(np.unique(lab[:, :, [0, -1]]).tolist())
border.discard(0)
reach = np.isin(lab, np.array(sorted(border), dtype=lab.dtype))
del lab
nb_reach = np.zeros_like(reach)
nb_reach[1:] |= reach[:-1]
nb_reach[:-1] |= reach[1:]
nb_reach[:, 1:] |= reach[:, :-1]
nb_reach[:, :-1] |= reach[:, 1:]
nb_reach[:, :, 1:] |= reach[:, :, :-1]
nb_reach[:, :, :-1] |= reach[:, :, 1:]
cand = (S != 0) & ((F & nb_reach) | (~F & reach))
del nb_reach
ys, zs, xs = np.nonzero(cand)
st = S[ys, zs, xs]
del cand
print(f"visible candidates {len(st)} in {time.time() - t0:.1f}s", flush=True)

# ------------------------------------------------------------------ light: a simplified vanilla light engine
LV = np.zeros(NS, dtype=np.uint8)
for s in range(1, NS):
    name, props = parse_key(keys[s])
    lv = LIGHT.get(name, 0)
    if name == "redstone_lamp":
        lv = 15 if props.get("lit") == "true" else 0
    if name in ("campfire", "soul_campfire") and props.get("lit") == "false":
        lv = 0
    if name == "sea_pickle":
        lv = 3 + 3 * int(props.get("pickles", 1)) if props.get("waterlogged") == "true" else 0
    LV[s] = min(15, lv)


def propagate(Lv, passable, iters=15):
    for _ in range(iters):
        nb = np.zeros_like(Lv)
        nb[1:] = Lv[:-1]
        np.maximum(nb[:-1], Lv[1:], out=nb[:-1])
        np.maximum(nb[:, 1:], Lv[:, :-1], out=nb[:, 1:])
        np.maximum(nb[:, :-1], Lv[:, 1:], out=nb[:, :-1])
        np.maximum(nb[:, :, 1:], Lv[:, :, :-1], out=nb[:, :, 1:])
        np.maximum(nb[:, :, :-1], Lv[:, :, 1:], out=nb[:, :, :-1])
        np.subtract(nb, 1, out=nb, where=nb > 0)
        nb[~passable] = 0
        np.maximum(Lv, nb, out=Lv)
    return Lv


blocked = np.maximum.accumulate(F[::-1], axis=0)[::-1]
SKY = np.where(blocked, 0, 15).astype(np.uint8)
del blocked
SKY = propagate(SKY, ~F)
BLK = propagate(LV[S], ~F)
print(f"light computed in {time.time() - t0:.1f}s", flush=True)
# light volume around the spawn for characters (sky, block) -> light.bin
LX0, LX1, LZ0, LZ1, LY0, LY1 = (X0, X1, Z0, Z1, Y0, Y1) if SYNTH else (-80, 176, -112, 128, 60, 124)
sl = (slice(LY0 - Y0, LY1 - Y0), slice(LZ0 - Z0, LZ1 - Z0), slice(LX0 - X0, LX1 - X0))
np.stack([SKY[sl], BLK[sl]], axis=-1).astype(np.uint8).tofile(os.path.join(OUT, "light.bin"))
json.dump({"x0": LX0, "y0": LY0, "z0": LZ0, "nx": LX1 - LX0, "ny": LY1 - LY0, "nz": LZ1 - LZ0, "layout": "y,z,x,[sky,block]"}, open(os.path.join(OUT, "light.json"), "w"))


def light_at(y, z, x):
    return at(SKY, y, z, x, 15).astype(np.float32), at(BLK, y, z, x, 0).astype(np.float32)


# ------------------------------------------------------------------ emission
OFF = {d: np.array(DVEC[d]) for d in DIRS}
AOL = np.array([0.45, 0.64, 0.83, 1.0], dtype=np.float32)
L = {k: {"pos": [], "nrm": [], "uv": [], "col": [], "aux": [], "chunk": []} for k in ("solid", "cutout", "trans", "water", "entity")}
LAYER_OF = {0: "solid", 1: "cutout", 2: "trans"}


def at(arr, y, z, x, default):
    ok = (y >= 0) & (y < NY) & (z >= 0) & (z < NZ) & (x >= 0) & (x < NX)
    out = np.full(len(y), default, dtype=arr.dtype)
    out[ok] = arr[y[ok], z[ok], x[ok]]
    return out


def emit(layer, P, N, UV, COL, AUX, bx, bz):
    """P (m,4,3) world, N (m,3), UV (m,4,2) atlas px, COL (m,4,4) uint8, AUX (m,4,4) uint8."""
    D = L[layer]
    D["pos"].append(P.astype(np.float32))
    D["nrm"].append(np.repeat(N[:, None, :], 4, axis=1).astype(np.float32))
    D["uv"].append(UV.astype(np.float32))
    D["col"].append(COL)
    D["aux"].append(AUX)
    D["chunk"].append(((bx // CH) * 1000 + (bz // CH)).astype(np.int32))


ATLAS_COLS, CELL = 32, 32
tile_xy = lambda t: ((t % ATLAS_COLS) * CELL + 8, (t // ATLAS_COLS) * CELL + 8)
order = np.argsort(st, kind="stable")
st_sorted = st[order]
bounds = np.flatnonzero(np.diff(st_sorted)) + 1
groups = np.split(order, bounds)
nq = 0
for g in groups:
    s = int(st[g[0]])
    inf = info[s]
    if not inf or not inf["variants"]:
        continue
    gy, gz, gx = ys[g], zs[g], xs[g]
    wx, wy, wz = gx + X0, gy + Y0, gz + Z0
    V = inf["variants"]
    if len(V) > 1:
        h = (wx.astype(np.int64) * 3129871) ^ (wz.astype(np.int64) * 116129781) ^ wy.astype(np.int64)
        h = h * h * 42317861 + h * 11
        r = ((h >> 16) & 0xFFFF).astype(np.float64) / 65536.0
        cw = np.cumsum(inf["weights"]) / np.sum(inf["weights"])
        vsel = np.searchsorted(cw, r, side="right").clip(0, len(V) - 1)
    else:
        vsel = np.zeros(len(g), dtype=np.int64)
    tint = np.array(inf["tint"], dtype=np.float32) / 255.0
    tint = np.where(tint <= 0.04045, tint / 12.92, ((tint + 0.055) / 1.055) ** 2.4)  # sRGB -> linear
    emi = int(round(inf["emi"] * 255))
    for vi, quads in enumerate(V):
        sel = np.flatnonzero(vsel == vi)
        if not len(sel) or not quads:
            continue
        by, bz_, bx_ = gy[sel], gz[sel], gx[sel]
        selfreach = reach[by, bz_, bx_]
        for q in quads:
            if q["cull"]:
                o = OFF[q["cull"]]
                ny_, nz_, nx_ = by + o[1], bz_ + o[2], bx_ + o[0]
                fn = at(F, ny_, nz_, nx_, False)
                rn = at(reach, ny_, nz_, nx_, True)
                ok = ~fn & rn
                if inf["selfcull"]:
                    sn = at(S, ny_, nz_, nx_, 0)
                    ok &= name_id[sn] != name_id[s]
            else:
                ok = selfreach.copy()
            idx = np.flatnonzero(ok)
            m = len(idx)
            if not m:
                continue
            base = np.stack([bx_[idx] + X0, by[idx] + Y0, bz_[idx] + Z0], axis=1).astype(np.float32)
            P = base[:, None, :] + q["pos"][None, :, :].astype(np.float32)
            ao = np.ones((m, 4), dtype=np.float32)
            sk4 = np.zeros((m, 4), dtype=np.float32)
            bl4 = np.zeros((m, 4), dtype=np.float32)
            if q["cull"]:
                d = DVEC[q["cull"]]
                ly, lz, lx = by[idx] + d[1], bz_[idx] + d[2], bx_[idx] + d[0]
            else:
                ly, lz, lx = by[idx], bz_[idx], bx_[idx]
            s0, b0 = light_at(ly, lz, lx)
            if q["cull"] and q["edge"]:
                a = [abs(c) for c in d].index(1)
                t1, t2 = [i for i in range(3) if i != a]
                lvl = np.zeros((m, 4), dtype=np.int32)
                for k in range(4):
                    p = q["pos"][k]
                    s1 = 1 if p[t1] > 0.5 else -1
                    s2 = 1 if p[t2] > 0.5 else -1
                    e1, e2 = [0, 0, 0], [0, 0, 0]
                    e1[t1], e2[t2] = s1, s2
                    y1, z1, x1 = ly + e1[1], lz + e1[2], lx + e1[0]
                    y2, z2, x2 = ly + e2[1], lz + e2[2], lx + e2[0]
                    yc, zc, xc = ly + e1[1] + e2[1], lz + e1[2] + e2[2], lx + e1[0] + e2[0]
                    a1 = at(F, y1, z1, x1, False)
                    a2 = at(F, y2, z2, x2, False)
                    acb = at(F, yc, zc, xc, False)
                    lvl[:, k] = np.where(a1 & a2, 0, 3 - (a1.astype(np.int32) + a2 + acb))
                    # smooth light: average the non-opaque cells around the vertex in the outside layer
                    ss, bb, nn = s0.copy(), b0.copy(), np.ones(m, dtype=np.float32)
                    for (yy_, zz_, xx_, opq) in ((y1, z1, x1, a1), (y2, z2, x2, a2), (yc, zc, xc, acb | (a1 & a2))):
                        sv, bv = light_at(yy_, zz_, xx_)
                        use = ~opq
                        ss += np.where(use, sv, 0)
                        bb += np.where(use, bv, 0)
                        nn += use
                    sk4[:, k] = ss / nn
                    bl4[:, k] = bb / nn
                if q["ao"]:
                    ao = AOL[lvl]
                flip = (lvl[:, 0] + lvl[:, 2]) < (lvl[:, 1] + lvl[:, 3]) if q["ao"] else np.zeros(m, dtype=bool)
                if flip.any():
                    P[flip] = np.roll(P[flip], -1, axis=1)
                    ao[flip] = np.roll(ao[flip], -1, axis=1)
                    sk4[flip] = np.roll(sk4[flip], -1, axis=1)
                    bl4[flip] = np.roll(bl4[flip], -1, axis=1)
            else:
                sk4[:] = s0[:, None]
                bl4[:] = b0[:, None]
                flip = np.zeros(m, dtype=bool)
            tx, ty = tile_xy(q["tile"])
            UV = np.repeat((q["uv"] + np.array([tx, ty]))[None], m, axis=0).astype(np.float32)
            if flip.any():
                UV[flip] = np.roll(UV[flip], -1, axis=1)
            tcol = tint if q["tint"] else np.ones(3, dtype=np.float32)
            COL = np.zeros((m, 4, 4), dtype=np.uint8)
            COL[:, :, :3] = np.clip(ao[:, :, None] * tcol[None, None, :] * 255, 0, 255).astype(np.uint8)
            COL[:, :, 3] = emi
            AUX = np.zeros((m, 4, 4), dtype=np.uint8)
            if inf["wave"] == 1:
                AUX[:, :, 0] = 1
            elif inf["wave"] == 2:
                tops = (q["pos"][:, 1] > 0.3)
                AUX[:, :, 0] = np.where(tops, 2, 0)[None, :]
            AUX[:, :, 2] = np.clip(np.round(sk4 * 17), 0, 255).astype(np.uint8)
            AUX[:, :, 3] = np.clip(np.round(bl4 * 17), 0, 255).astype(np.uint8)
            layer = LAYER_OF[tile_cls[q["tile"]]]
            emit(layer, P, np.repeat(q["n"][None].astype(np.float32), m, axis=0), UV, COL, AUX, bx_[idx], bz_[idx])
            nq += m
print(f"block quads {nq} in {time.time() - t0:.1f}s", flush=True)

# ------------------------------------------------------------------ fluids
Wm = water_lut[S]
Lm = lava_lut[S]
wl_tile = tex_index("block/water_still")
lv_tile = tex_index("block/lava_still")
lvl_lut = np.zeros(len(keys), dtype=np.float32)
for s in range(1, len(keys)):
    name, props = parse_key(keys[s])
    if name in ("water", "lava"):
        lv = int(props.get("level", 0))
        lvl_lut[s] = (8 - lv) / 9.0 if lv < 8 else 8 / 9.0
    elif water_lut[s]:
        lvl_lut[s] = 8 / 9.0
for mask, tile, layer, color, emi in ((Wm, wl_tile, "water", WATER, 0), (Lm, lv_tile, "solid", (255, 255, 255), 255)):
    fy, fz, fx = np.nonzero(mask & reach)
    if not len(fy):
        continue
    h = lvl_lut[S[fy, fz, fx]]
    above = at(mask, fy + 1, fz, fx, False)
    h = np.where(above, 1.0, h)
    tx, ty = tile_xy(tile)
    col = np.array(color, dtype=np.float32) / 255.0
    col = np.where(col <= 0.04045, col / 12.92, ((col + 0.055) / 1.055) ** 2.4)
    faces = [("up", None)] + [(d, None) for d in ("north", "south", "west", "east")]
    for d, _ in faces:
        o = DVEC[d]
        ny_, nz_, nx_ = fy + o[1], fz + o[2], fx + o[0]
        if d == "up":
            ok = ~above & ~at(F, ny_, nz_, nx_, False)
        else:
            ok = ~at(mask, ny_, nz_, nx_, False) & ~at(F, ny_, nz_, nx_, False) & at(reach, ny_, nz_, nx_, True)
        idx = np.flatnonzero(ok)
        m = len(idx)
        if not m:
            continue
        x, y, z, hh = (fx[idx] + X0).astype(np.float32), (fy[idx] + Y0).astype(np.float32), (fz[idx] + Z0).astype(np.float32), h[idx]
        if d == "up":
            P = np.stack([np.stack([x, y + hh, z], 1), np.stack([x, y + hh, z + 1], 1), np.stack([x + 1, y + hh, z + 1], 1), np.stack([x + 1, y + hh, z], 1)], 1)
            UVq = np.array([[0, 0], [0, 16], [16, 16], [16, 0]], dtype=np.float32)
        else:
            if d == "north":
                c = [(1, 1, 0), (1, 0, 0), (0, 0, 0), (0, 1, 0)]
            elif d == "south":
                c = [(0, 1, 1), (0, 0, 1), (1, 0, 1), (1, 1, 1)]
            elif d == "west":
                c = [(0, 1, 0), (0, 0, 0), (0, 0, 1), (0, 1, 1)]
            else:
                c = [(1, 1, 1), (1, 0, 1), (1, 0, 0), (1, 1, 0)]
            P = np.stack([np.stack([x + cx, y + cy * hh, z + cz], 1) for (cx, cy, cz) in c], 1)
            UVq = np.array([[0, 0], [0, 16], [16, 16], [16, 0]], dtype=np.float32)
        UV = np.repeat((UVq + np.array([tx, ty]))[None], m, axis=0)
        COL = np.zeros((m, 4, 4), dtype=np.uint8)
        COL[:, :, :3] = (col * 255).astype(np.uint8)
        COL[:, :, 3] = emi
        AUX = np.zeros((m, 4, 4), dtype=np.uint8)
        AUX[:, :, 1] = 1 if layer == "water" else 0
        fs, fb = light_at(fy[idx] + (1 if d == "up" else 0), fz[idx], fx[idx])
        AUX[:, :, 2] = np.clip(fs * 17, 0, 255).astype(np.uint8)[:, None]
        AUX[:, :, 3] = np.clip(np.maximum(fb, 15 if layer == "solid" else 0) * 17, 0, 255).astype(np.uint8)[:, None]
        emit(layer, P.astype(np.float32), np.repeat(np.array(o, dtype=np.float32)[None], m, axis=0), UV, COL, AUX, fx[idx], fz[idx])
        nq += m
print(f"total quads {nq} in {time.time() - t0:.1f}s", flush=True)

# ------------------------------------------------------------------ entity-rendered blocks (signs, banners, chests...)
from specials import emit_specials
spec_blocks = []
for s_id, (name, props) in special.items():
    yy_, zz_, xx_ = np.nonzero(S == s_id)
    for y_, z_, x_ in zip(yy_, zz_, xx_):
        spec_blocks.append((name, props, (int(x_ + X0), int(y_ + Y0), int(z_ + Z0))))


def light_w(x, y, z):
    yi, zi, xi = y - Y0, z - Z0, x - X0
    if 0 <= yi < NY and 0 <= zi < NZ and 0 <= xi < NX:
        return float(SKY[yi, zi, xi]), float(BLK[yi, zi, xi])
    return 15.0, 0.0


def emit_e(P, N, UV, tl, sky, blk):
    COL = np.zeros((1, 4, 4), dtype=np.uint8)
    COL[:, :, :3] = np.clip(tl * 255, 0, 255).astype(np.uint8)
    AUX = np.zeros((1, 4, 4), dtype=np.uint8)
    AUX[:, :, 2] = int(sky * 17)
    AUX[:, :, 3] = int(blk * 17)
    c = P[0].mean(0)
    emit("entity", P, N, UV, COL, AUX, np.array([int(np.floor(c[0])) - X0]), np.array([int(np.floor(c[2])) - Z0]))


ent_img, n_ent = emit_specials(spec_blocks, light_w, emit_e, JAR)
EAW, EAH = (ent_img.size if ent_img else (1, 1))
if ent_img:
    ent_img.save(os.path.join(OUT, "entity_atlas.png"))
print(f"entity quads {n_ent}", flush=True)

# ------------------------------------------------------------------ atlas
rows = (len(tiles) + ATLAS_COLS - 1) // ATLAS_COLS
AW, AH = ATLAS_COLS * CELL, 1
while AH < rows * CELL:
    AH *= 2
atlas = np.zeros((AH, AW, 4), dtype=np.uint8)
yy, xx = np.mgrid[0:CELL, 0:CELL]
for t, im in enumerate(tiles):
    a = np.asarray(im)
    cx, cy = (t % ATLAS_COLS) * CELL, (t // ATLAS_COLS) * CELL
    atlas[cy:cy + CELL, cx:cx + CELL] = a[(yy - 8) % 16, (xx - 8) % 16]
Image.fromarray(atlas).save(os.path.join(OUT, "atlas.png"))
json.dump({"w": AW, "h": AH, "cell": CELL, "cols": ATLAS_COLS, "tiles": {k: v for k, v in tile_of.items() if v is not None}},
          open(os.path.join(OUT, "atlas.json"), "w"), indent=0)

# ------------------------------------------------------------------ write layers
index = {"y0": Y0, "ch": CH, "atlas": [AW, AH], "layers": {}, "meta": META, "bounds": [X0, Y0, Z0, X1, Y1, Z1]}
for name, D in L.items():
    if not D["pos"]:
        continue
    pos = np.concatenate(D["pos"])
    nrm = np.concatenate(D["nrm"])
    uv = np.concatenate(D["uv"])
    col = np.concatenate(D["col"])
    aux = np.concatenate(D["aux"])
    ch = np.concatenate(D["chunk"])
    o = np.argsort(ch, kind="stable")
    pos, nrm, uv, col, aux, ch = pos[o], nrm[o], uv[o], col[o], aux[o], ch[o]
    nqd = len(ch)
    cxs, czs = ch // 1000, ch % 1000
    ox = (cxs * CH + X0).astype(np.float32)
    oz = (czs * CH + Z0).astype(np.float32)
    rel = pos - np.stack([ox, np.full(nqd, Y0, np.float32), oz], 1)[:, None, :]
    assert rel.min() > -1 and rel[:, :, 1].max() * 128 < 32767 and rel[:, :, [0, 2]].max() * 128 < 32767
    P16 = np.zeros((nqd, 4, 4), dtype=np.int16)
    P16[:, :, :3] = np.round(rel * 128).astype(np.int16)
    N8 = np.zeros((nqd, 4, 4), dtype=np.int8)
    N8[:, :, :3] = np.round(nrm * 127).astype(np.int8)
    aw_, ah_ = (EAW, EAH) if name == "entity" else (AW, AH)
    UV16 = np.round(uv / np.array([aw_, ah_], dtype=np.float32) * 65535).clip(0, 65535).astype(np.uint16)
    parts = [P16.tobytes(), N8.tobytes(), UV16.tobytes(), col.tobytes(), aux.tobytes()]
    with open(os.path.join(OUT, f"world_{name}.bin"), "wb") as f:
        offs = []
        for p in parts:
            offs.append(f.tell())
            f.write(p)
    starts = np.flatnonzero(np.r_[True, ch[1:] != ch[:-1]])
    ends = np.r_[starts[1:], nqd]
    chunks = []
    for a_, b_ in zip(starts, ends):
        c = int(ch[a_])
        pmin = pos[a_:b_].reshape(-1, 3).min(0)
        pmax = pos[a_:b_].reshape(-1, 3).max(0)
        chunks.append({"cx": c // 1000, "cz": c % 1000, "q0": int(a_), "nq": int(b_ - a_),
                       "o": [float(ox[a_]), float(Y0), float(oz[a_])], "min": [round(float(v), 2) for v in pmin], "max": [round(float(v), 2) for v in pmax]})
    index["layers"][name] = {"file": f"world_{name}.bin", "quads": nqd, "offs": offs, "chunks": chunks}
    if name == "entity":
        index["layers"][name]["atlas"] = "entity_atlas.png"
    print(f"{name}: {nqd} quads, {sum(len(p) for p in parts) / 1e6:.1f} MB", flush=True)
json.dump(index, open(os.path.join(OUT, "world.json"), "w"))

# ------------------------------------------------------------------ specials (entity-rendered blocks) + block entities
spec = [{"name": n_, "props": p_, "pos": list(b_)} for (n_, p_, b_) in spec_blocks]
be_out = []
for e in bents:
    d = {k: v for k, v in e.items() if k not in ("keepPacked",)}
    be_out.append(json.loads(json.dumps(d, default=lambda o: o.tolist() if hasattr(o, "tolist") else str(o))))
json.dump({"blocks": spec, "block_entities": be_out}, open(os.path.join(OUT, "specials.json"), "w", encoding="utf-8"), ensure_ascii=False)
print(f"specials {len(spec)}, block entities {len(be_out)}; done in {time.time() - t0:.1f}s")
