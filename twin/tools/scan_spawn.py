# Survey the spawn world: block counts, extent of the build, top-down map PNG, entity list.
# usage: python -I scan_spawn.py <world_dir> <out_dir>
import os, sys, glob, json, collections
import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from anvil import region_chunks, chunk_sections, read_gz_nbt

world, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)
AIRS = {"minecraft:air", "minecraft:cave_air", "minecraft:void_air"}

counts = collections.Counter()
col_count = collections.Counter()  # (cx, cz) -> non-air blocks
top = {}  # (x, z) -> (y, name)
ymin, ymax = 10**9, -10**9
for rp in sorted(glob.glob(os.path.join(world, "region", "*.mca"))):
    n_ch = 0
    for root in region_chunks(rp):
        cx, cz = root.get("xPos"), root.get("zPos")
        status = root.get("Status", "")
        n_ch += 1
        for sy, keys, idx in chunk_sections(root):
            names = np.array([k.split("[")[0] for k in keys])
            nonair = np.array([n not in AIRS for n in names])
            mask = nonair[idx]
            nb = int(mask.sum())
            if not nb:
                continue
            col_count[(cx, cz)] += nb
            for k, c in zip(*np.unique(idx[mask], return_counts=True)):
                counts[names[k]] += int(c)
            ys = np.nonzero(mask)[0] // 256
            ymin = min(ymin, sy * 16 + int(ys.min()))
            ymax = max(ymax, sy * 16 + int(ys.max()))
            # top-down: highest non-air per column
            m3 = mask.reshape(16, 16, 16)
            any_col = m3.any(axis=0)
            hi = 15 - np.argmax(m3[::-1], axis=0)
            for z in range(16):
                for x in range(16):
                    if any_col[z, x]:
                        y = sy * 16 + int(hi[z, x])
                        key = (cx * 16 + x, cz * 16 + z)
                        if key not in top or top[key][0] < y:
                            top[key] = (y, names[idx[(int(hi[z, x]) * 16 + z) * 16 + x]])
    print(os.path.basename(rp), "chunks", n_ch, flush=True)

print("y range", ymin, ymax)
print("non-air chunks", len(col_count))
xs = [k[0] for k in col_count]
zs = [k[1] for k in col_count]
print("chunk x", min(xs), max(xs), "z", min(zs), max(zs))
# clusters of chunks (8-connected)
seen, clusters = set(), []
for c in col_count:
    if c in seen:
        continue
    stack, comp = [c], []
    seen.add(c)
    while stack:
        a = stack.pop()
        comp.append(a)
        for dx in (-1, 0, 1):
            for dz in (-1, 0, 1):
                b = (a[0] + dx, a[1] + dz)
                if b in col_count and b not in seen:
                    seen.add(b)
                    stack.append(b)
    clusters.append(comp)
clusters.sort(key=lambda c: -sum(col_count[k] for k in c))
for c in clusters[:12]:
    cxs = [k[0] for k in c]
    czs = [k[1] for k in c]
    print("cluster chunks", len(c), "blocks", sum(col_count[k] for k in c), "x", min(cxs) * 16, (max(cxs) + 1) * 16, "z", min(czs) * 16, (max(czs) + 1) * 16)
with open(os.path.join(out, "block_counts.json"), "w", encoding="utf-8") as f:
    json.dump(counts.most_common(), f, ensure_ascii=False, indent=0)
print("distinct blocks", len(counts))
for n, c in counts.most_common(60):
    print(f"{c:8d} {n}")

# top-down map of the main cluster (colour by block name hash, shaded by height)
main = clusters[0]
x0 = min(k[0] for k in main) * 16
x1 = (max(k[0] for k in main) + 1) * 16
z0 = min(k[1] for k in main) * 16
z1 = (max(k[1] for k in main) + 1) * 16
img = np.zeros((z1 - z0, x1 - x0, 3), dtype=np.uint8)
import hashlib
pal = {}
for (x, z), (y, name) in top.items():
    if x0 <= x < x1 and z0 <= z < z1:
        if name not in pal:
            h = hashlib.md5(name.encode()).digest()
            pal[name] = np.array([60 + h[0] % 180, 60 + h[1] % 180, 60 + h[2] % 180], dtype=np.float32)
        shade = 0.55 + 0.45 * min(1.0, max(0.0, (y - 40) / 80.0))
        img[z - z0, x - x0] = np.clip(pal[name] * shade, 0, 255)
Image.fromarray(img).resize(((x1 - x0) * 3, (z1 - z0) * 3), Image.NEAREST).save(os.path.join(out, "topdown.png"))
json.dump({"x0": x0, "x1": x1, "z0": z0, "z1": z1, "ymin": ymin, "ymax": ymax}, open(os.path.join(out, "bounds.json"), "w"))
print("map", x0, x1, z0, z1)

# entities
ents = collections.Counter()
elist = []
for rp in sorted(glob.glob(os.path.join(world, "entities", "*.mca"))):
    for root in region_chunks(rp):
        for e in root.get("Entities", []):
            ents[e.get("id")] += 1
            pos = e.get("Pos", [0, 0, 0])
            item = e.get("Item", {}) or e.get("item", {})
            elist.append({"id": e.get("id"), "pos": [round(float(p), 2) for p in pos], "item": item.get("id") if isinstance(item, dict) else None,
                          "block": (e.get("block_state") or {}).get("Name"), "text": e.get("text") if isinstance(e.get("text"), str) else None,
                          "tags": e.get("Tags"), "invisible": e.get("Invisible"), "custom": e.get("CustomName")})
print("entities", ents.most_common())
json.dump(elist, open(os.path.join(out, "entities.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=0)
