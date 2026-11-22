# Blocks the client draws with entity renderers (no block model): wall/standing signs, banners, chests, ender
# chests, shulker boxes. Emitted as quads on a separate entity atlas (layer "entity"), lit from the light grid.
import io, math, zipfile
import numpy as np
from PIL import Image

DYE = {"white": "F9FFFE", "orange": "F9801D", "magenta": "C74EBD", "light_blue": "3AB3DA", "yellow": "FED83D", "lime": "80C71F",
       "pink": "F38BAA", "gray": "474F52", "light_gray": "9D9D97", "cyan": "169C9C", "purple": "8932B8", "blue": "3C44AA",
       "brown": "835432", "green": "5E7C16", "red": "B02E26", "black": "1D1D21"}
WOODS = ["oak", "spruce", "birch", "jungle", "acacia", "dark_oak", "crimson", "warped", "mangrove", "cherry", "bamboo"]
FACING_YAW = {"north": 0.0, "east": -90.0, "south": 180.0, "west": 90.0}
# vertex corner order per face (same as block faces): (use_max_x, use_max_y, use_max_z)
FI = {
    "down": [(0, 0, 1), (0, 0, 0), (1, 0, 0), (1, 0, 1)], "up": [(0, 1, 0), (0, 1, 1), (1, 1, 1), (1, 1, 0)],
    "north": [(1, 1, 0), (1, 0, 0), (0, 0, 0), (0, 1, 0)], "south": [(0, 1, 1), (0, 0, 1), (1, 0, 1), (1, 1, 1)],
    "west": [(0, 1, 0), (0, 0, 0), (0, 0, 1), (0, 1, 1)], "east": [(1, 1, 1), (1, 0, 1), (1, 0, 0), (1, 1, 0)],
}
NRM = {"down": (0, -1, 0), "up": (0, 1, 0), "north": (0, 0, -1), "south": (0, 0, 1), "west": (-1, 0, 0), "east": (1, 0, 0)}


def srgb_lin(c):
    c = np.array(c, dtype=np.float32) / 255.0
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def box_uv(u, v, w, h, d):
    """Entity-model cube unfolding -> per-face uv rect (u0, v0, u1, v1) in texture px (front = north)."""
    return {
        "down": (u + d + w, v, u + d + 2 * w, v + d), "up": (u + d, v, u + d + w, v + d),
        "west": (u + d + w, v + d, u + 2 * d + w, v + d + h), "north": (u + d, v + d, u + d + w, v + d + h),
        "east": (u, v + d, u + d, v + d + h), "south": (u + 2 * d + w, v + d, u + 2 * d + 2 * w, v + d + h),
    }


class EntityAtlas:
    def __init__(self, jar, cell=64, cols=8):
        self.z = zipfile.ZipFile(jar)
        self.cell, self.cols = cell, cols
        self.slots, self.imgs = {}, []

    def slot(self, path):
        if path not in self.slots:
            im = Image.open(io.BytesIO(self.z.read(f"assets/minecraft/textures/{path}.png"))).convert("RGBA")
            self.slots[path] = len(self.imgs)
            self.imgs.append(im)
        i = self.slots[path]
        return (i % self.cols) * self.cell, (i // self.cols) * self.cell

    def image(self):
        rows = max(1, (len(self.imgs) + self.cols - 1) // self.cols)
        W = self.cols * self.cell
        H = 1
        while H < rows * self.cell:
            H *= 2
        out = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        for i, im in enumerate(self.imgs):
            out.paste(im.crop((0, 0, min(im.width, self.cell), min(im.height, self.cell))), ((i % self.cols) * self.cell, (i // self.cols) * self.cell))
        return out


def emit_specials(blocks, light_at_world, emit, jar):
    """blocks: [(name, props, (x,y,z))]. light_at_world(x,y,z)->(sky,blk). emit(P,N,UV,COL,AUX, bx, bz) world-space."""
    EA = EntityAtlas(jar)
    quads = []  # (P 4x3 world, n, uv 4x2 atlas px, tint rgb linear, sky, blk)

    def add_box(bp, lo, hi, tex, rects, yaw, tint=(255, 255, 255), faces=None, pivot=(8, 8, 8)):
        ox, oy = EA.slot(tex)
        R = None
        if yaw:
            a = math.radians(yaw)
            R = np.array([[math.cos(a), 0, math.sin(a)], [0, 1, 0], [-math.sin(a), 0, math.cos(a)]])
        sky, blk = light_at_world(*bp)
        tl = srgb_lin(tint)
        for f, (u0, v0, u1, v1) in rects.items():
            if faces and f not in faces:
                continue
            P = np.array([[hi[0] if mx else lo[0], hi[1] if my else lo[1], hi[2] if mz else lo[2]] for (mx, my, mz) in FI[f]], dtype=np.float64)
            UV = np.array([[u0, v0], [u0, v1], [u1, v1], [u1, v0]], dtype=np.float64) + np.array([ox, oy])
            n = np.array(NRM[f], dtype=np.float64)
            if R is not None:
                P = (P - np.array(pivot)) @ R.T + np.array(pivot)
                n = R @ n
            P = P / 16.0 + np.array(bp, dtype=np.float64)
            quads.append((P, n, UV, tl, sky, blk))

    for name, props, bp in blocks:
        if name.endswith("_wall_sign") and not name.endswith("hanging_sign"):
            wood = name[: -len("_wall_sign")]
            if wood not in WOODS:
                continue
            r = box_uv(0, 0, 24, 12, 2)
            # board 16 x 8 x 1.33 px against the wall behind the sign (front faces `facing`)
            add_box(bp, (0, 4.33, 14.67), (16, 12.33, 16), f"entity/signs/{wood}", r, FACING_YAW.get(props.get("facing", "north"), 0))
        elif name.endswith("_sign") and "hanging" not in name:
            wood = name[: -len("_sign")]
            if wood not in WOODS:
                continue
            yaw = 180.0 - int(props.get("rotation", 0)) * 22.5
            add_box(bp, (0, 9.33, 7.33), (16, 17.33, 8.67), f"entity/signs/{wood}", box_uv(0, 0, 24, 12, 2), yaw)
            add_box(bp, (7.33, 0, 7.33), (8.67, 9.33, 8.67), f"entity/signs/{wood}", box_uv(0, 14, 2, 14, 2), yaw)
        elif name.endswith("_wall_banner"):
            col = name[: -len("_wall_banner")]
            if col not in DYE:
                continue
            tint = tuple(int(DYE[col][i:i + 2], 16) for i in (0, 2, 4))
            yaw = FACING_YAW.get(props.get("facing", "north"), 0)
            # flag 13.3 x 26.7 x 0.67 px hanging from the bar near the block top, against the wall
            add_box(bp, (1.33, -11.33, 14.67), (14.67, 15.33, 15.33), "entity/banner/base", box_uv(0, 0, 20, 40, 1), yaw, tint)
            add_box(bp, (1.33, 15.33, 14.0), (14.67, 16.67, 15.33), "entity/banner_base", box_uv(0, 42, 20, 2, 2), yaw)
        elif name.endswith("_banner"):
            col = name[: -len("_banner")]
            if col not in DYE:
                continue
            tint = tuple(int(DYE[col][i:i + 2], 16) for i in (0, 2, 4))
            yaw = 180.0 - int(props.get("rotation", 0)) * 22.5
            add_box(bp, (1.33, 2.67, 7.0), (14.67, 29.33, 7.67), "entity/banner/base", box_uv(0, 0, 20, 40, 1), yaw, tint)
            add_box(bp, (7.33, 0, 7.33), (8.67, 28, 8.67), "entity/banner_base", box_uv(44, 0, 2, 42, 2), yaw)
            add_box(bp, (1.33, 28, 7.33), (14.67, 29.33, 8.67), "entity/banner_base", box_uv(0, 42, 20, 2, 2), yaw)
        elif name in ("chest", "trapped_chest", "ender_chest"):
            tex = {"chest": "entity/chest/normal", "trapped_chest": "entity/chest/trapped", "ender_chest": "entity/chest/ender"}[name]
            yaw = FACING_YAW.get(props.get("facing", "north"), 0) + 180.0
            add_box(bp, (1, 0, 1), (15, 10, 15), tex, box_uv(0, 19, 14, 10, 14), yaw)
            add_box(bp, (1, 9, 1), (15, 14, 15), tex, box_uv(0, 0, 14, 5, 14), yaw)
            add_box(bp, (7, 7, 0), (9, 11, 1), tex, box_uv(0, 0, 2, 4, 1), yaw)
        elif name.endswith("shulker_box"):
            col = name[: -len("_shulker_box")] if name != "shulker_box" else ""
            tex = f"entity/shulker/shulker_{col}" if col else "entity/shulker/shulker"
            add_box(bp, (0, 0, 0), (16, 8, 16), tex, box_uv(0, 28, 16, 8, 16), 0)
            add_box(bp, (-0.02, 4, -0.02), (16.02, 16, 16.02), tex, box_uv(0, 0, 16, 12, 16), 0)
    if not quads:
        return None, 0
    img = EA.image()
    for P, n, UV, tl, sky, blk in quads:
        emit(P[None].astype(np.float32), n[None].astype(np.float32), UV[None].astype(np.float32), tl, sky, blk)
    return img, len(quads)
