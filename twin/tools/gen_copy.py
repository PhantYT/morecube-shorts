# Episode 3 «копия рилика» set: a cheap, badly built spawn on a floating island in the void (crooked fountain,
# plank shack, tasteless wool, cobwebs, dead bushes, two sad lanterns), plus a tiny «lobby» platform nearby where
# the server list floats. Also writes the island's block list (blocks.json) so ep03 can crumble it block by block.
# Returns block-state keys + a dense state array that bake_world.py meshes like the other worlds.
import json, os
import numpy as np
from gen_world import fbm

X0, Z0, Y0 = 5000, -64, 30
NX, NZ, NY = 128, 128, 60
C = (5064, 0)
TOP = 64
LOBBY = (5104, 2, 70)
R = 13


def generate():
    keys = ["minecraft:air"]
    reg = {"minecraft:air": 0}

    def sid(k):
        if k not in reg:
            reg[k] = len(keys)
            keys.append(k)
        return reg[k]

    S = np.zeros((NY, NZ, NX), dtype=np.uint16)
    rng = np.random.default_rng(13)
    n1 = fbm((NZ, NX), 16, 5)
    n2 = fbm((NZ, NX), 6, 9)
    blocks = []

    def put(x, y, z, k, rec=True):
        if 0 <= x - X0 < NX and 0 <= z - Z0 < NZ and 0 <= y - Y0 < NY:
            S[y - Y0, z - Z0, x - X0] = sid(k)
            if rec and k.split("[")[0] in TYPE:
                blocks.append([x, y, z, TYPE[k.split("[")[0]]])

    def get(x, y, z):
        if 0 <= x - X0 < NX and 0 <= z - Z0 < NZ and 0 <= y - Y0 < NY:
            return keys[S[y - Y0, z - Z0, x - X0]]
        return "minecraft:air"

    TYPE = {"minecraft:cobblestone": 0, "minecraft:mossy_cobblestone": 1, "minecraft:dirt": 2, "minecraft:grass_block": 2,
            "minecraft:oak_planks": 3, "minecraft:gravel": 4, "minecraft:stone": 0}
    # the island: flat-ish crooked top, tapering underside
    for z in range(C[1] - R - 3, C[1] + R + 4):
        for x in range(C[0] - R - 3, C[0] + R + 4):
            dx, dz = x - C[0], z - C[1]
            wob = (n1[z - Z0, x - X0] - 0.5) * 6
            r = np.hypot(dx, dz)
            if r > R + wob:
                continue
            top = TOP + (1 if n2[z - Z0, x - X0] > 0.68 else 0) - (1 if n2[z - Z0, x - X0] < 0.25 else 0)
            depth = int((1 - (r / (R + 3)) ** 2) * 11 + n2[z - Z0, x - X0] * 3) + 1
            for y in range(top - depth, top):
                k = "minecraft:stone" if y < top - 3 else "minecraft:dirt"
                put(x, y, z, k, rec=y >= top - 2)
            p = rng.random()
            ring = 3.0 <= r <= 4.4
            if ring:
                tk = "minecraft:cobblestone" if p < 0.75 else "minecraft:mossy_cobblestone"
            elif p < 0.12:
                tk = "minecraft:gravel"
            elif p < 0.18:
                tk = "minecraft:cobblestone"
            else:
                tk = "minecraft:grass_block[snowy=false]"
            put(x, top - 1, z, tk)
    # crooked fountain: cobble ring with a water puddle, one block too high on one side
    cx, cz = C
    for dx in range(-2, 3):
        for dz in range(-2, 3):
            if max(abs(dx), abs(dz)) == 2:
                put(cx + dx, TOP, cz + dz, "minecraft:cobblestone")
                if dx == 2 and dz <= 0:
                    put(cx + dx, TOP + 1, cz + dz, "minecraft:cobblestone")
            else:
                put(cx + dx, TOP - 1, cz + dz, "minecraft:water[level=0]", rec=False)
    # the plank shack with a missing wall block and a flat roof
    hx, hz = cx + 6, cz - 8
    for x in range(hx, hx + 5):
        for z in range(hz, hz + 4):
            edge = x in (hx, hx + 4) or z in (hz, hz + 3)
            for y in range(TOP, TOP + 3):
                if edge and not (x == hx + 2 and z == hz + 3 and y < TOP + 2) and not (x == hx + 4 and z == hz + 1 and y == TOP + 1):
                    put(x, y, z, "minecraft:oak_planks")
            put(x, TOP + 3, z, "minecraft:cobblestone")
    for y in range(TOP, TOP + 3):
        put(hx, y, hz, "minecraft:cobweb", rec=False) if y == TOP + 2 else None
    # tasteless decor: wool pillars, a glass box with gaps, lanterns on fences, dead bushes, cobwebs
    for (x, z, col) in ((cx + 7, cz - 3, "magenta"), (cx + 7, cz - 2, "lime"), (cx + 9, cz + 2, "orange"), (cx - 2, cz - 10, "light_blue")):
        for y in range(TOP, TOP + 2 + (x + z) % 2):
            put(x, y, z, f"minecraft:{col}_wool", rec=False)
    for x in range(cx - 9, cx - 6):
        for y in range(TOP, TOP + 3):
            if (x + y) % 3:
                put(x, y, cz - 6, "minecraft:glass", rec=False)
    for (x, z) in ((cx + 4, cz + 3), (cx - 4, cz - 3)):
        put(x, TOP, z, "minecraft:oak_fence[east=false,north=false,south=false,waterlogged=false,west=false]", rec=False)
        put(x, TOP + 1, z, "minecraft:lantern[hanging=false,waterlogged=false]", rec=False)
    for _ in range(40):
        x, z = int(rng.integers(cx - R, cx + R)), int(rng.integers(cz - R, cz + R))
        near_cam = np.hypot(x - (cx - 7), z - (cz + 10)) < 7.5  # ep03 cameras stand here: no bush in the foreground
        if get(x, TOP - 1, z).startswith("minecraft:grass_block") and get(x, TOP, z) == "minecraft:air" and np.hypot(x - cx, z - cz) > 5 and not near_cam:
            put(x, TOP, z, "minecraft:dead_bush", rec=False)
    for (x, y, z) in ((cx - 9, TOP + 2, cz - 6), (cx + 10, TOP + 2, cz - 5)):
        put(x, y, z, "minecraft:cobweb", rec=False)
    # the lobby: a 5x5 polished blackstone slab in the void with amethyst corners
    lx, lz, ly = LOBBY
    for x in range(lx - 2, lx + 3):
        for z in range(lz - 2, lz + 3):
            corner = abs(x - lx) == 2 and abs(z - lz) == 2
            put(x, ly - 1, z, "minecraft:amethyst_block" if corner else "minecraft:polished_blackstone", rec=False)
            put(x, ly - 2, z, "minecraft:blackstone", rec=False)
    out = os.environ.get("COPY_BLOCKS_OUT")
    if out:
        json.dump({"blocks": blocks, "center": [cx, TOP, cz]}, open(out, "w"))
    return keys, S, (X0, Z0, Y0), {"center": [cx, TOP, cz], "lobby": [lx, ly, lz]}
