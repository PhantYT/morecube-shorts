# Procedural «рилик» parody plaza for ep02 (an invented location, not a copy of any real spawn): a grey paved
# square with rain puddles, a stepped gold throne under a big gold «$», a vault of diamonds behind iron bars,
# market stalls, a barred exit gate, lamp posts and grey towers with a few lit windows.
# Returns block-state keys + a dense state array that bake_world.py meshes like the other worlds.
import numpy as np
from gen_world import fbm

X0, Z0, Y0 = 3000, -64, 40
NX, NZ, NY = 128, 128, 64
C = (3064, 0)        # plaza centre (x, z)
GY = 64              # walking level: the paving is y = 63
SEAT = (3064, -16)   # throne seat centre (x, z); the owner faces south (+z)
VAULT = (3080, 3086, -6, 2)
GATE_Z = 24

DOLLAR = ["01110", "10101", "10100", "01110", "00101", "10101", "01110"]


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
    n1 = fbm((NZ, NX), 48, 7)
    n2 = fbm((NZ, NX), 12, 19)
    dc = np.maximum(np.abs(wx - C[0]), np.abs(wz - C[1]))
    h = GY + 3.0 * (n1 - 0.5)
    h = np.where(dc < 46, GY, h)
    edge = np.maximum(np.abs(wx - (X0 + NX / 2)), np.abs(wz - (Z0 + NZ / 2))) / (NX / 2)
    h += np.clip((edge - 0.72) / 0.28, 0, 1) ** 1.5 * (14 + 10 * n2)
    H = np.clip(np.round(h).astype(int), Y0 + 4, Y0 + NY - 24)
    ys = np.arange(NY)[:, None, None] + Y0
    Hb = H[None]
    STONE, ANDES, GRAVEL, CDIRT = sid("minecraft:stone"), sid("minecraft:andesite"), sid("minecraft:gravel"), sid("minecraft:coarse_dirt")
    S[ys < Hb - 1] = STONE
    top = np.where(n2 > 0.56, GRAVEL, np.where(n2 < 0.4, ANDES, CDIRT))
    m_top = ys == Hb - 1
    S[m_top] = np.broadcast_to(top[None], S.shape)[m_top]
    rng = np.random.default_rng(5)

    def put(x, y, z, k):
        if 0 <= x - X0 < NX and 0 <= z - Z0 < NZ and 0 <= y - Y0 < NY:
            S[y - Y0, z - Z0, x - X0] = sid(k)

    def get(x, y, z):
        if 0 <= x - X0 < NX and 0 <= z - Z0 < NZ and 0 <= y - Y0 < NY:
            return keys[S[y - Y0, z - Z0, x - X0]]
        return "minecraft:air"

    def fill(xa, xb, ya, yb, za, zb, k):
        for x in range(xa, xb + 1):
            for y in range(ya, yb + 1):
                for z in range(za, zb + 1):
                    put(x, y, z, k)

    # paving: stone bricks with cracks and moss, polished andesite rings, rain puddles
    puddle = fbm((NZ, NX), 6, 31)
    for z in range(C[1] - 26, C[1] + 25):
        for x in range(C[0] - 26, C[0] + 27):
            r = max(abs(x - C[0]), abs(z - C[1]))
            p = rng.random()
            k = "minecraft:stone_bricks"
            if r in (8, 18, 26):
                k = "minecraft:polished_andesite"
            elif p < 0.16:
                k = "minecraft:cracked_stone_bricks"
            elif p < 0.21:
                k = "minecraft:mossy_stone_bricks"
            if puddle[z - Z0, x - X0] > 0.66 and r < 24 and not (abs(x - C[0]) <= 2):
                k = "minecraft:water[level=0]"
            put(x, GY - 1, z, k)
            put(x, GY - 2, z, "minecraft:stone")
    # red carpet from the gate to the throne
    for z in range(SEAT[1] + 5, GATE_Z):
        for x in range(C[0] - 1, C[0] + 2):
            put(x, GY - 1, z, "minecraft:stone_bricks")
            put(x, GY, z, "minecraft:red_carpet")

    # the throne: three gold tiers, a seat, armrests, a tall back with crown spikes, a gold «$» on the wall behind
    sx, sz = SEAT
    fill(sx - 7, sx + 7, GY, GY, sz - 6, sz + 4, "minecraft:gold_block")
    fill(sx - 5, sx + 5, GY + 1, GY + 1, sz - 6, sz + 2, "minecraft:gold_block")
    fill(sx - 3, sx + 3, GY + 2, GY + 2, sz - 6, sz + 1, "minecraft:gold_block")
    fill(sx - 1, sx + 1, GY + 3, GY + 3, sz - 1, sz + 1, "minecraft:gold_block")        # seat, top at GY + 4
    fill(sx - 2, sx - 2, GY + 3, GY + 4, sz - 1, sz + 1, "minecraft:gold_block")        # armrests
    fill(sx + 2, sx + 2, GY + 3, GY + 4, sz - 1, sz + 1, "minecraft:gold_block")
    fill(sx - 1, sx + 1, GY + 3, GY + 10, sz - 2, sz - 2, "minecraft:gold_block")       # back
    for dx in (-1, 1):
        put(sx + dx, GY + 11, sz - 2, "minecraft:gold_block")
    put(sx, GY + 12, sz - 2, "minecraft:gold_block")
    put(sx, GY + 11, sz - 2, "minecraft:diamond_block")
    # wall behind the throne: deepslate with red cloth strips and the «$»
    wz_ = sz - 8
    fill(sx - 13, sx + 13, GY, GY + 26, wz_, wz_ + 1, "minecraft:deepslate_bricks")
    fill(sx - 13, sx + 13, GY + 27, GY + 27, wz_, wz_ + 1, "minecraft:polished_deepslate")
    for x in (sx - 10, sx - 6, sx + 6, sx + 10):
        fill(x, x, GY + 3, GY + 22, wz_ + 2, wz_ + 2, "minecraft:red_wool")
    for ry, row in enumerate(DOLLAR):  # the «$» at 2x2 blocks per pixel, above the throne back
        for rx, v in enumerate(row):
            if v == "1":
                for ax in range(2):
                    for ay in range(2):
                        put(sx - 5 + rx * 2 + ax, GY + 25 - ry * 2 - ay, wz_ + 2, "minecraft:gold_block")
    for x in (sx - 4, sx + 4):
        put(x, GY + 2, sz - 3, "minecraft:soul_lantern[hanging=false,waterlogged=false]")

    # the vault: iron bars facing the plaza, diamonds and gold piled inside
    vx0, vx1, vz0, vz1 = VAULT
    fill(vx0, vx1, GY - 1, GY - 1, vz0, vz1, "minecraft:polished_andesite")
    fill(vx0, vx1, GY + 4, GY + 4, vz0, vz1, "minecraft:stone_bricks")
    fill(vx1, vx1, GY, GY + 3, vz0, vz1, "minecraft:deepslate_bricks")
    fill(vx0, vx1, GY, GY + 3, vz0, vz0, "minecraft:deepslate_bricks")
    fill(vx0, vx1, GY, GY + 3, vz1, vz1, "minecraft:deepslate_bricks")
    for z in range(vz0 + 1, vz1):
        for y in range(GY, GY + 4):
            put(vx0, y, z, "minecraft:iron_bars[east=false,north=true,south=true,waterlogged=false,west=false]")
    for x in range(vx0 + 1, vx1):
        for z in range(vz0 + 1, vz1):
            hgt = int(rng.integers(1, 3))
            for y in range(GY, GY + hgt):
                put(x, y, z, "minecraft:diamond_block" if rng.random() < 0.6 else "minecraft:gold_block")
    put(vx0 - 1, GY + 3, vz0 + 2, "minecraft:lantern[hanging=false,waterlogged=false]")

    # market stalls on the west side: fence posts, striped wool roofs, barrel counters
    for k, z0 in enumerate((-9, -1, 7)):
        x0 = C[0] - 19
        for dx, dz in ((0, 0), (4, 0), (0, 4), (4, 4)):
            fill(x0 + dx, x0 + dx, GY, GY + 2, z0 + dz, z0 + dz, "minecraft:oak_fence[east=false,north=false,south=false,waterlogged=false,west=false]")
        for dx in range(-1, 6):
            for dz in range(-1, 6):
                put(x0 + dx, GY + 3, z0 + dz, "minecraft:red_wool" if (dx + k) % 2 == 0 else "minecraft:white_wool")
        if k != 1:  # the middle stall sells «air»: it stays empty
            for dz in range(0, 5):
                put(x0 + 4, GY, z0 + dz, "minecraft:barrel[facing=up,open=false]")
            put(x0 + 4, GY + 1, z0 + 2, "minecraft:emerald_block")

    # the exit: a wall across the south with a barred gate in the middle
    fill(C[0] - 26, C[0] + 26, GY, GY + 5, GATE_Z, GATE_Z, "minecraft:stone_bricks")
    fill(C[0] - 26, C[0] + 26, GY + 6, GY + 6, GATE_Z, GATE_Z, "minecraft:polished_andesite")
    fill(C[0] - 2, C[0] + 2, GY, GY + 4, GATE_Z, GATE_Z, "minecraft:air")
    for x in range(C[0] - 2, C[0] + 3):
        for y in range(GY, GY + 5):
            put(x, y, GATE_Z, "minecraft:iron_bars[east=true,north=false,south=false,waterlogged=false,west=true]")
    for x in (C[0] - 3, C[0] + 3):
        fill(x, x, GY, GY + 7, GATE_Z, GATE_Z, "minecraft:polished_deepslate")
        put(x, GY + 8, GATE_Z, "minecraft:lantern[hanging=false,waterlogged=false]")

    # lamp posts around the square
    for x, z in ((C[0] - 22, -20), (C[0] + 22, -20), (C[0] - 22, 18), (C[0] + 22, 18), (C[0] - 9, 12), (C[0] + 9, 12), (C[0] - 9, -2), (C[0] + 9, -2)):
        fill(x, x, GY, GY + 2, z, z, "minecraft:cobblestone_wall[east=none,north=none,south=none,up=true,waterlogged=false,west=none]")
        put(x, GY + 3, z, "minecraft:lantern[hanging=false,waterlogged=false]")

    # grey towers on a ring outside the square, a few windows lit
    for k in range(16):
        a = k / 16 * np.pi * 2 + 0.2
        rad = 36 + 6 * rng.random()
        cx, cz = int(C[0] + np.cos(a) * rad), int(C[1] + np.sin(a) * rad)
        if abs(cx - C[0]) < 8 and cz > C[1]:
            continue  # keep the view through the gate open
        w = int(rng.integers(5, 9))
        hh = int(rng.integers(10, 24))
        mat = ["minecraft:deepslate_bricks", "minecraft:stone_bricks", "minecraft:polished_deepslate", "minecraft:andesite"][k % 4]
        base = int(H[cz - Z0, cx - X0]) if 0 <= cz - Z0 < NZ and 0 <= cx - X0 < NX else GY
        for x in range(cx - w // 2, cx + w - w // 2):
            for z in range(cz - w // 2, cz + w - w // 2):
                edge_ = x in (cx - w // 2, cx + w - w // 2 - 1) or z in (cz - w // 2, cz + w - w // 2 - 1)
                for y in range(base - 1, base + hh):
                    if not edge_ and y > base:
                        continue
                    win = edge_ and (y - base) % 4 == 2 and (x + z) % 3 == 1 and y < base + hh - 1
                    if win:
                        put(x, y, z, "minecraft:glowstone" if rng.random() < 0.32 else "minecraft:gray_concrete")
                    else:
                        put(x, y, z, mat)
                put(x, base + hh, z, "minecraft:dark_oak_planks")

    # gloom: dead bushes on the dirt, cobwebs in a few corners
    for _ in range(260):
        x, z = int(rng.integers(X0 + 2, X0 + NX - 2)), int(rng.integers(Z0 + 2, Z0 + NZ - 2))
        y = int(H[z - Z0, x - X0])
        if get(x, y - 1, z) in ("minecraft:coarse_dirt", "minecraft:gravel") and get(x, y, z) == "minecraft:air":
            put(x, y, z, "minecraft:dead_bush")
    for x, y, z in ((vx1 - 1, GY + 3, vz0 + 1), (C[0] - 26, GY + 5, GATE_Z - 1), (sx + 12, GY + 13, wz_ + 2)):
        put(x, y, z, "minecraft:cobweb")

    meta = {"seat": [sx, GY + 4, sz], "plaza": [C[0], GY, C[1]], "vault": [vx0 - 1, GY, (vz0 + vz1) / 2], "gate": [C[0], GY, GATE_Z],
            "stalls": [[C[0] - 17, GY, -7], [C[0] - 17, GY, 1], [C[0] - 17, GY, 9]], "dollar_wall_z": wz_ + 2}
    return keys, S, (X0, Z0, Y0), meta
