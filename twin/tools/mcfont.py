# Minecraft text as the client draws it: vanilla font (client jar) + resource-pack fonts/glyphs, legacy & and &#hex codes,
# DecentHolograms <#hex>..</#hex> gradients, bold (double draw, +1 advance), optional shadow and nametag background.
import io, json, re, zipfile
import numpy as np
from PIL import Image

LEGACY = {"0": (0, 0, 0), "1": (0, 0, 170), "2": (0, 170, 0), "3": (0, 170, 170), "4": (170, 0, 0), "5": (170, 0, 170), "6": (255, 170, 0),
          "7": (170, 170, 170), "8": (85, 85, 85), "9": (85, 85, 255), "a": (85, 255, 85), "b": (85, 255, 255), "c": (255, 85, 85),
          "d": (255, 85, 255), "e": (255, 255, 85), "f": (255, 255, 255)}


ASSETS = "C:/Users/Dima/AppData/Roaming/.tlauncher/legacy/Minecraft/game/assets"


class FontTable(dict):
    """Glyph table; characters missing from the bitmap providers fall back to unifont (unihex) lazily."""

    def __init__(self):
        super().__init__()
        self.unihex = []

    def get(self, ch, default=None):
        g = super().get(ch)
        if g is not None:
            return g
        for hx in self.unihex:
            g = hx(ch)
            if g is not None:
                self[ch] = g
                return g
        return default


class Unihex:
    def __init__(self, data, overrides):
        self.lines = {}
        with zipfile.ZipFile(io.BytesIO(data)) as z:
            for n in z.namelist():
                if n.endswith(".hex"):
                    for ln in z.read(n).decode("ascii").splitlines():
                        if ":" in ln:
                            k, v = ln.split(":", 1)
                            self.lines.setdefault(int(k, 16), v.strip())
        self.over = []
        for o in overrides or []:
            self.over.append((ord(o["from"]), ord(o["to"]), o["left"], o["right"]))

    def __call__(self, ch):
        v = self.lines.get(ord(ch))
        if v is None:
            return None
        w = len(v) * 4 // 16
        bits = np.zeros((16, w), dtype=bool)
        for r in range(16):
            row = int(v[r * w // 4:(r + 1) * w // 4], 16)
            for c in range(w):
                bits[r, c] = (row >> (w - 1 - c)) & 1
        cols = np.flatnonzero(bits.any(0))
        left, right = (int(cols[0]), int(cols[-1])) if len(cols) else (0, -1)
        for a, b, l, r in self.over:
            if a <= ord(ch) <= b:
                left, right = l, r
        if right < left:
            return ("space", 4)
        cut = bits[:, left:right + 1]
        img = np.zeros(cut.shape + (4,), dtype=np.uint8)
        img[cut] = (255, 255, 255, 255)
        cell = Image.fromarray(img)
        width = right - left + 1
        return ("bmp", cell, 7, 8, width // 2 + 1, 0.5)


class Fonts:
    def __init__(self, pack, client, assets=ASSETS, index="19"):
        self.zips = [zipfile.ZipFile(p) for p in ([pack] if pack else []) + [client]]
        self.cache = {}
        self.objects = {}
        try:
            self.objects = json.load(open(f"{assets}/indexes/{index}.json"))["objects"]
            self.assets = assets
        except OSError:
            pass

    def _obj(self, key):
        o = self.objects.get(key)
        if not o:
            return None
        h = o["hash"]
        return open(f"{self.assets}/objects/{h[:2]}/{h}", "rb").read()

    def _read(self, path):
        for z in self.zips:
            try:
                return z.read(path)
            except KeyError:
                continue
        return None

    def _res(self, rid, kind, ext):
        ns, path = rid.split(":", 1) if ":" in rid else ("minecraft", rid)
        return f"assets/{ns}/{kind}/{path}{ext}"

    def font(self, fid="minecraft:default"):
        if fid in self.cache:
            return self.cache[fid]
        table = FontTable()
        self.cache[fid] = table
        # the client stacks providers of the same font id from every pack (pack first, then vanilla)
        provs = []
        for z in self.zips:
            try:
                provs += json.loads(z.read(self._res(fid, "font", ".json")).decode("utf-8"))["providers"]
            except KeyError:
                continue
        ns, path = fid.split(":", 1) if ":" in fid else ("minecraft", fid)
        extra = self._obj(f"{ns}/font/{path}.json")  # unifont lives in the launcher asset index
        if extra:
            provs += json.loads(re.sub(r",(\s*[\]}])", lambda m: m.group(1), extra.decode("utf-8")))["providers"]  # GSON-lenient
        for prov in provs:
            t = prov["type"]
            if t == "reference":
                sub = self.font(prov["id"])
                for ch, g in sub.items():
                    table.setdefault(ch, g)
                table.unihex += sub.unihex
            elif t == "unihex":
                hns, hpath = prov["hex_file"].split(":", 1) if ":" in prov["hex_file"] else ("minecraft", prov["hex_file"])
                data = self._obj(f"{hns}/{hpath}") or self._read(f"assets/{hns}/{hpath}")
                if data:
                    table.unihex.append(Unihex(data, prov.get("size_overrides")))
            elif t == "space":
                for ch, adv in prov["advances"].items():
                    table.setdefault(ch, ("space", adv))
            elif t == "bitmap":
                raw = self._read(self._res(prov["file"], "textures", ""))
                if raw is None:
                    continue
                im = Image.open(io.BytesIO(raw)).convert("RGBA")
                rows = prov["chars"]
                ch_h = im.height // len(rows)
                ch_w = im.width // max(len(r) for r in rows)
                h = prov.get("height", 8)
                asc = prov.get("ascent", 7)
                scale = h / ch_h
                for ry, r in enumerate(rows):
                    for rx, ch in enumerate(r):
                        if ch in ("\u0000",) or ch in table:
                            continue
                        cell = im.crop((rx * ch_w, ry * ch_h, (rx + 1) * ch_w, (ry + 1) * ch_h))
                        bb = cell.getchannel("A").getbbox()
                        if ch == " ":
                            table[ch] = ("space", 4)
                            continue
                        w = bb[2] if bb else 0
                        adv = int(0.5 + w * scale) + 1
                        table[ch] = ("bmp", cell, asc, h, adv, scale)
        if fid == "minecraft:default":
            table.setdefault(" ", ("space", 4))
        return table


GRAD = re.compile(r"<#([0-9a-fA-F]{6})>(.*?)</#([0-9a-fA-F]{6})>", re.S)


def parse_legacy(text):
    """[(char, rgb, bold)] from &-coded text with &#RRGGBB and DecentHolograms <#a>..</#b> gradients."""
    def expand(m):
        a, body, b = m.group(1), m.group(2), m.group(3)
        toks = re.findall(r"(&[0-9a-fk-orA-FK-OR])|(.)", body, re.S)
        vis = [t[1] for t in toks if t[1]]
        out, fmt = [], ""
        n = max(1, len(vis) - 1)
        ca = tuple(int(a[i:i + 2], 16) for i in (0, 2, 4))
        cb = tuple(int(b[i:i + 2], 16) for i in (0, 2, 4))
        i = 0
        for code, ch in toks:
            if code:
                fmt = "" if code.lower() == "&r" else fmt + code
                continue
            k = i / n
            c = tuple(int(round(ca[j] + (cb[j] - ca[j]) * k)) for j in range(3))
            out.append("&#%02X%02X%02X" % c + fmt + ch)
            i += 1
        return "".join(out)
    text = GRAD.sub(expand, text)
    text = text.replace("§", "&")
    out = []
    col, bold = (255, 255, 255), False
    i = 0
    while i < len(text):
        if text[i] == "&" and i + 1 < len(text):
            c = text[i + 1].lower()
            if c == "#" and i + 8 <= len(text) and re.match(r"[0-9a-fA-F]{6}", text[i + 2:i + 8]):
                col = tuple(int(text[i + 2 + k:i + 4 + k], 16) for k in (0, 2, 4))
                i += 8
                continue
            if c == "x" and i + 14 <= len(text):  # &x&R&R&G&G&B&B
                hx = text[i + 2:i + 14].replace("&", "")
                if re.match(r"[0-9a-fA-F]{6}$", hx):
                    col = tuple(int(hx[k:k + 2], 16) for k in (0, 2, 4))
                    i += 14
                    continue
            if c in LEGACY:
                col, bold = LEGACY[c], False
                i += 2
                continue
            if c == "l":
                bold = True
                i += 2
                continue
            if c == "r":
                col, bold = (255, 255, 255), False
                i += 2
                continue
            if c in "kmno":
                i += 2
                continue
        out.append((text[i], col, bold))
        i += 1
    return out


def glyph(fonts, ch):
    return fonts.font("minecraft:default").get(ch)


def text_width(fonts, runs):
    w = 0
    for ch, col, bold in runs:
        g = glyph(fonts, ch)
        if g is None:
            w += 6
        elif g[0] == "space":
            w += g[1]
        else:
            w += g[4] + (1 if bold else 0)
    return w


def render_line(fonts, text, K=4, shadow=False, bg=None, pad=1, white_glyphs=True):
    """RGBA image of one line at K px per font px. bg = (r,g,b,a) nametag box. Returns (image, width_px_font)."""
    runs = parse_legacy(text)
    w = max(1, text_width(fonts, runs))
    H = 12
    W = w + 2 * pad
    img = Image.new("RGBA", (W * K, H * K), (0, 0, 0, 0))
    if bg:
        box = Image.new("RGBA", (W * K, H * K), bg)
        img.alpha_composite(box)
    x = pad
    base = 9  # baseline row (font ascent 7 -> top at 2)
    for ch, col, bold in runs:
        g = glyph(fonts, ch)
        if g is None:
            x += 6
            continue
        if g[0] == "space":
            x += g[1]
            continue
        _, cell, asc, h, adv, scale = g
        gw = max(1, int(round(cell.width * scale)))
        gh = max(1, int(round(cell.height * scale)))
        ci = cell.resize((gw * K, gh * K), Image.NEAREST)
        a = np.asarray(ci).astype(np.float32)
        colored = a.copy()
        colored[:, :, :3] = a[:, :, :3] * (np.array(col, dtype=np.float32) / 255.0)  # the client tints every glyph
        gi = Image.fromarray(colored.clip(0, 255).astype(np.uint8))
        top = (base - asc) * K + (pad - 1) * 0
        if shadow:
            sh = np.asarray(gi).astype(np.float32).copy()
            sh[:, :, :3] *= 0.25
            si = Image.fromarray(sh.astype(np.uint8))
            img.alpha_composite(si, (int((x + 1) * K), int(top + K)))
            if bold:
                img.alpha_composite(si, (int((x + 2) * K), int(top + K)))
        img.alpha_composite(gi, (int(x * K), int(top)))
        if bold:
            img.alpha_composite(gi, (int((x + 1) * K), int(top)))
        x += adv + (1 if bold else 0)
    return img, W
