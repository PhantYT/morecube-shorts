# Procedural "ordinary world" for gameplay shots: rolling plains hills, a lake, oak and birch trees, grass and
# flowers, stone outcrops and far hills for the horizon. Returns block-state keys + a dense state array that
# bake_world.py meshes exactly like the real spawn.
import numpy as np

X0, Z0, Y0 = 2000, -112, 40
NX, NZ, NY = 224, 224, 72
SITE = (2112, 0)  # hilltop build site (x, z)
CODE_SPOT = (2018, -104)  # clearing on the far north-west crest where the video's code is spelled in blocks
LAKE_Y = 63


def value_noise(shape, cell, seed):
    rng = np.random.default_rng(seed)
    gx, gz = shape[1] // cell + 2, shape[0] // cell + 2
    g = rng.random((gz, gx))
    zz, xx = np.mgrid[0:shape[0], 0:shape[1]] / cell
    x0, z0 = xx.astype(int), zz.astype(int)
    fx, fz = xx - x0, zz - z0
    fx, fz = fx * fx * (3 - 2 * fx), fz * fz * (3 - 2 * fz)
    a, b = g[z0, x0], g[z0, x0 + 1]
    c, d = g[z0 + 1, x0], g[z0 + 1, x0 + 1]
    return (a * (1 - fx) + b * fx) * (1 - fz) + (c * (1 - fx) + d * fx) * fz


def fbm(shape, cell, seed, oct=4):
    v, amp, tot = 0, 1.0, 0
    for o in range(oct):
        v = v + value_noise(shape, max(2, cell >> o), seed + o * 17) * amp
        tot += amp
        amp *= 0.5
    return v / tot


def generate():
    keys = ["minecraft:air"]
    reg = {"minecraft:air": 0}

    def sid(k):
        if k not in reg:
            reg[k] = len(keys)
            keys.append(k)
        return reg[k]

    S = np.zeros((NY, NZ, NX), dtype=np.uint16)
    zz, xx = np.mgrid[0:NZ, 0:NX]
    wx, wz = xx + X0, zz + Z0
    n1 = fbm((NZ, NX), 64, 3)
    n2 = fbm((NZ, NX), 24, 11)
    sx, sz = SITE
    r = np.hypot(wx - sx, wz - sz)
    h = 64 + 9 * (n1 - 0.45) + 3 * (n2 - 0.5)
    h += 9.5 * np.exp(-(r / 30.0) ** 2)                      # the hill with the build site
    lake = np.hypot((wx - (sx - 46)) / 26.0, (wz - (sz + 28)) / 17.0)
    h = np.where(lake < 1.0, np.minimum(h, LAKE_Y - 1 - 3 * (1 - lake)), h)
    h += np.clip(1 - lake, -9, 0) * 0  # keep
    edge = np.maximum(np.abs(wx - (X0 + NX / 2)), np.abs(wz - (Z0 + NZ / 2))) / (NX / 2)
    h += np.clip((edge - 0.62) / 0.38, 0, 1) ** 1.6 * (16 + 14 * n2)  # far hills frame the horizon
    # a real summit: flat top r < 6, then the hill falls away on every side
    h_site = float(np.round(h[np.unravel_index(np.argmin(r), r.shape)])) + 1
    cap = h_site - 0.5 - (r - 6.5) * 0.32 + np.maximum(0, r - 28) * 0.55  # cone near the hill only, far hills stay
    h = np.where(r < 6.5, h_site, np.minimum(h, cap))
    H = np.clip(np.round(h).astype(int), Y0 + 4, Y0 + NY - 20)
    GRASS, DIRT, STONE, SAND, GRAVEL = sid("minecraft:grass_block[snowy=false]"), sid("minecraft:dirt"), sid("minecraft:stone"), sid("minecraft:sand"), sid("minecraft:gravel")
    ANDES, COBBLE, MOSSY = sid("minecraft:andesite"), sid("minecraft:cobblestone"), sid("minecraft:mossy_cobblestone")
    WATER = sid("minecraft:water[level=0]")
    ys = np.arange(NY)[:, None, None] + Y0
    Hb = H[None]
    S[ys < Hb - 4] = STONE
    shore = (lake < 1.25) & (H <= LAKE_Y + 1)
    top_mat = np.where(shore, SAND, GRASS)
    sub_mat = np.where(shore, SAND, DIRT)
    m_sub = (ys >= Hb - 4) & (ys < Hb - 1)
    S[m_sub] = np.broadcast_to(sub_mat[None], S.shape)[m_sub]
    m_top = ys == Hb - 1
    S[m_top] = np.broadcast_to(top_mat[None], S.shape)[m_top]
    # steep slopes show stone
    gz_, gx_ = np.gradient(H.astype(float))
    steep = np.hypot(gx_, gz_) > 1.6
    S[m_top & steep[None]] = STONE
    # lake water
    wmask = (ys >= Hb) & (ys < LAKE_Y) & (lake < 1.3)[None]
    S[wmask] = WATER
    rng = np.random.default_rng(42)
    surf = lambda x, z: int(H[z - Z0, x - X0])

    def put(x, y, z, k):
        if 0 <= x - X0 < NX and 0 <= z - Z0 < NZ and 0 <= y - Y0 < NY:
            S[y - Y0, z - Z0, x - X0] = sid(k)

    def get(x, y, z):
        if 0 <= x - X0 < NX and 0 <= z - Z0 < NZ and 0 <= y - Y0 < NY:
            return keys[S[y - Y0, z - Z0, x - X0]]
        return "minecraft:air"

    # stone outcrops
    for _ in range(26):
        x, z = int(rng.integers(X0 + 10, X0 + NX - 10)), int(rng.integers(Z0 + 10, Z0 + NZ - 10))
        if np.hypot(x - sx, z - sz) < 14 or lake[z - Z0, x - X0] < 1.4:
            continue
        y = surf(x, z)
        for dx in range(-2, 3):
            for dz in range(-2, 3):
                for dy in range(0, 3):
                    if dx * dx + dz * dz + dy * dy * 2 <= 4 + rng.integers(0, 3):
                        put(x + dx, surf(x + dx, z + dz) - 1 + dy, z + dz, ["minecraft:stone", "minecraft:andesite", "minecraft:cobblestone", "minecraft:mossy_cobblestone"][int(rng.integers(0, 4))])
    # trees (oak + birch), not on the hilltop, not in the lake
    trees = []
    for _ in range(900):
        x, z = int(rng.integers(X0 + 4, X0 + NX - 4)), int(rng.integers(Z0 + 4, Z0 + NZ - 4))
        d = np.hypot(x - sx, z - sz)
        if d < 13 or lake[z - Z0, x - X0] < 1.35 or np.hypot(x - CODE_SPOT[0], z - CODE_SPOT[1]) < 18 or any(abs(x - tx) + abs(z - tz) < 6 for tx, tz in trees):
            continue
        dens = 0.08 if d < 40 else 0.45
        if rng.random() > dens:
            continue
        y = surf(x, z)
        if get(x, y - 1, z) != "minecraft:grass_block[snowy=false]":
            continue
        birch = rng.random() < 0.3
        log = "minecraft:birch_log[axis=y]" if birch else "minecraft:oak_log[axis=y]"
        leaf = "minecraft:birch_leaves[distance=1,persistent=true,waterlogged=false]" if birch else "minecraft:oak_leaves[distance=1,persistent=true,waterlogged=false]"
        th = int(rng.integers(4, 7))
        for k in range(th):
            put(x, y + k, z, log)
        top = y + th
        for dy, rad in ((-2, 2), (-1, 2), (0, 1), (1, 1)):
            for dx in range(-rad, rad + 1):
                for dz in range(-rad, rad + 1):
                    if abs(dx) == rad and abs(dz) == rad and (dy >= 0 or rng.random() < 0.5):
                        continue
                    if get(x + dx, top + dy, z + dz) == "minecraft:air":
                        put(x + dx, top + dy, z + dz, leaf)
        trees.append((x, z))
    # grass and flowers
    flowers = ["minecraft:poppy", "minecraft:dandelion", "minecraft:oxeye_daisy", "minecraft:cornflower", "minecraft:azure_bluet"]
    for z in range(Z0 + 1, Z0 + NZ - 1):
        for x in range(X0 + 1, X0 + NX - 1):
            y = surf(x, z)
            if get(x, y - 1, z) != "minecraft:grass_block[snowy=false]" or get(x, y, z) != "minecraft:air":
                continue
            d = np.hypot(x - sx, z - sz)
            if d < 12:
                continue
            p = rng.random()
            if p < (0.22 if d > 8 else 0.08):
                put(x, y, z, "minecraft:short_grass")
            elif p < 0.26:
                put(x, y, z, flowers[int(rng.integers(0, len(flowers)))])
    site_y = surf(sx, sz)
    return keys, S, (X0, Z0, Y0), {"site": [sx, site_y, sz], "lake_y": LAKE_Y}
