# Minimal Anvil (.mca) + NBT reader for 1.21.x worlds: chunk NBT, block-state sections, entity files.
import struct, zlib, gzip, io
import numpy as np

_S = struct.Struct


def _nbt(buf, off, t):
    """Parse a payload of tag type t at offset off; returns (value, new_off)."""
    if t == 1:
        return struct.unpack_from(">b", buf, off)[0], off + 1
    if t == 2:
        return struct.unpack_from(">h", buf, off)[0], off + 2
    if t == 3:
        return struct.unpack_from(">i", buf, off)[0], off + 4
    if t == 4:
        return struct.unpack_from(">q", buf, off)[0], off + 8
    if t == 5:
        return struct.unpack_from(">f", buf, off)[0], off + 4
    if t == 6:
        return struct.unpack_from(">d", buf, off)[0], off + 8
    if t == 7:
        n = struct.unpack_from(">i", buf, off)[0]
        off += 4
        return np.frombuffer(buf, dtype=">i1", count=n, offset=off).copy(), off + n
    if t == 8:
        n = struct.unpack_from(">H", buf, off)[0]
        off += 2
        return bytes(buf[off:off + n]).decode("utf-8", "replace"), off + n
    if t == 9:
        et = buf[off]
        n = struct.unpack_from(">i", buf, off + 1)[0]
        off += 5
        out = []
        for _ in range(n):
            v, off = _nbt(buf, off, et)
            out.append(v)
        return out, off
    if t == 10:
        d = {}
        while True:
            tt = buf[off]
            off += 1
            if tt == 0:
                return d, off
            n = struct.unpack_from(">H", buf, off)[0]
            off += 2
            k = bytes(buf[off:off + n]).decode("utf-8", "replace")
            off += n
            d[k], off = _nbt(buf, off, tt)
    if t == 11:
        n = struct.unpack_from(">i", buf, off)[0]
        off += 4
        return np.frombuffer(buf, dtype=">i4", count=n, offset=off).copy(), off + 4 * n
    if t == 12:
        n = struct.unpack_from(">i", buf, off)[0]
        off += 4
        return np.frombuffer(buf, dtype=">i8", count=n, offset=off).copy(), off + 8 * n
    raise ValueError(f"bad tag {t} at {off}")


def parse_nbt(data):
    buf = memoryview(data)
    t = buf[0]
    n = struct.unpack_from(">H", buf, 1)[0]
    v, _ = _nbt(buf, 3 + n, t)
    return v


def read_gz_nbt(path):
    return parse_nbt(gzip.decompress(open(path, "rb").read()))


def region_chunks(path):
    """Yield chunk NBT roots of one region file."""
    data = open(path, "rb").read()
    if len(data) < 8192:
        return
    for i in range(1024):
        loc = struct.unpack_from(">I", data, i * 4)[0]
        off, cnt = (loc >> 8) * 4096, loc & 0xFF
        if off == 0 or cnt == 0:
            continue
        ln = struct.unpack_from(">I", data, off)[0]
        comp = data[off + 4]
        raw = data[off + 5: off + 4 + ln]
        if comp == 2:
            raw = zlib.decompress(raw)
        elif comp == 1:
            raw = gzip.decompress(raw)
        elif comp == 3:
            pass
        else:
            continue
        yield parse_nbt(raw)


def unpack_indices(longs, n_palette, count=4096):
    """Unpack the packed long array of a palette container (values never span longs, 1.16+)."""
    bits = max(4, int(np.ceil(np.log2(n_palette)))) if n_palette > 1 else 0
    if bits == 0:
        return np.zeros(count, dtype=np.int32)
    per = 64 // bits
    u = longs.astype(np.int64).view(np.uint64)
    shifts = (np.arange(per, dtype=np.uint64) * np.uint64(bits))
    mask = np.uint64((1 << bits) - 1)
    vals = ((u[:, None] >> shifts[None, :]) & mask).reshape(-1)[:count]
    return vals.astype(np.int32)


def state_key(entry):
    """'minecraft:oak_stairs[facing=east,half=bottom]' from a palette entry."""
    name = entry["Name"]
    props = entry.get("Properties")
    if props:
        return name + "[" + ",".join(f"{k}={props[k]}" for k in sorted(props)) + "]"
    return name


def chunk_sections(root):
    """Yield (section_y, palette_keys, indices[4096]) for non-empty sections. Index = (y*16+z)*16+x."""
    for s in root.get("sections", []):
        bs = s.get("block_states")
        if not bs:
            continue
        pal = bs.get("palette", [])
        keys = [state_key(p) for p in pal]
        if len(keys) == 1 and keys[0] in ("minecraft:air", "minecraft:void_air", "minecraft:cave_air"):
            continue
        data = bs.get("data")
        idx = unpack_indices(data, len(keys)) if data is not None else np.zeros(4096, dtype=np.int32)
        yield s["Y"], keys, idx
