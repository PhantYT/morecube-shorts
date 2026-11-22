# Client-accurate Minecraft GUI overlays for the twin: the /codes DeluxeMenus chest (pack background glyphs in the
# title, vanilla chest texture, player-head items, hover tooltip with the real lore) and on-screen titles.
# usage: python -I gui.py <pack.zip> <client.jar> <deluxemenus code.yml> <out_dir>
import base64, io, json, math, os, re, sys, urllib.request, zipfile, hashlib
import numpy as np
import yaml
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from mcfont import Fonts, parse_legacy

UA = {"User-Agent": "curl/8.4.0"}


def jtrunc(v):
    return int(v)  # Java (int) cast truncates toward zero


class Canvas:
    """Drawing in GUI pixels onto an RGBA image scaled by K."""

    def __init__(self, fonts, wgui, hgui, K):
        self.f, self.W, self.H, self.K = fonts, wgui, hgui, K
        self.img = Image.new("RGBA", (wgui * K, hgui * K), (0, 0, 0, 0))

    def rect(self, x0, y0, x1, y1, rgba):
        K = self.K
        box = Image.new("RGBA", (max(1, int((x1 - x0) * K)), max(1, int((y1 - y0) * K))), rgba)
        self.img.alpha_composite(box, (int(x0 * K), int(y0 * K)))

    def gradient(self, x0, y0, x1, y1, top, bot):
        K = self.K
        h = max(1, int((y1 - y0) * K))
        w = max(1, int((x1 - x0) * K))
        a = np.zeros((h, w, 4), dtype=np.float32)
        t = np.linspace(0, 1, h)[:, None]
        for i in range(4):
            a[:, :, i] = top[i] * (1 - t) + bot[i] * t
        self.img.alpha_composite(Image.fromarray(a.clip(0, 255).astype(np.uint8)), (int(x0 * K), int(y0 * K)))

    def image(self, im, x, y, w=None, h=None, tint=None, crop=None):
        K = self.K
        if crop:
            im = im.crop(crop)
        w = im.width if w is None else w
        h = im.height if h is None else h
        if w <= 0 or h <= 0:
            return
        r = im.convert("RGBA").resize((max(1, round(w * K)), max(1, round(h * K))), Image.NEAREST)
        if tint is not None:
            a = np.asarray(r).astype(np.float32)
            a[:, :, :3] *= np.array(tint, dtype=np.float32) / 255.0
            r = Image.fromarray(a.clip(0, 255).astype(np.uint8))
        self.img.alpha_composite(r, (round(x * K), round(y * K)))

    def glyph(self, ch):
        return self.f.font("minecraft:default").get(ch)

    def text_width(self, text):
        w = 0
        for ch, col, bold in parse_legacy(text):
            g = self.glyph(ch)
            if g is None:
                continue
            if g[0] == "space":
                w += g[1]
            else:
                w += self._adv(g) + (1 if bold else 0)
        return w

    def _adv(self, g):
        return g[4]

    def text(self, text, x, y, shadow=False, default=(255, 255, 255)):
        cx = x
        for ch, col, bold in parse_legacy(text):
            g = self.glyph(ch)
            if g is None:
                continue
            if g[0] == "space":
                cx += g[1]
                continue
            _, cell, asc, h, adv, scale = g
            adv = self._adv(g)
            if h > 0 and asc > -1000:
                gw, gh = cell.width * scale, cell.height * scale
                top = y + 7 - asc
                if shadow:
                    sc = tuple(int(c * 0.25) for c in col)
                    self.image(cell, cx + 1, top + 1, gw, gh, tint=sc)
                    if bold:
                        self.image(cell, cx + 2, top + 1, gw, gh, tint=sc)
                self.image(cell, cx, top, gw, gh, tint=col)
                if bold:
                    self.image(cell, cx + 1, top, gw, gh, tint=col)
            cx += adv + (1 if bold else 0)
        return cx

    def nine(self, sprite, x, y, w, h, border):
        """9-slice blit of a sprite (border in sprite px == gui px)."""
        S = sprite
        b = border
        sw, sh = S.size
        parts = [((0, 0, b, b), (x, y, b, b)), ((sw - b, 0, sw, b), (x + w - b, y, b, b)),
                 ((0, sh - b, b, sh), (x, y + h - b, b, b)), ((sw - b, sh - b, sw, sh), (x + w - b, y + h - b, b, b)),
                 ((b, 0, sw - b, b), (x + b, y, w - 2 * b, b)), ((b, sh - b, sw - b, sh), (x + b, y + h - b, w - 2 * b, b)),
                 ((0, b, b, sh - b), (x, y + b, b, h - 2 * b)), ((sw - b, b, sw, sh - b), (x + w - b, y + b, b, h - 2 * b)),
                 ((b, b, sw - b, sh - b), (x + b, y + b, w - 2 * b, h - 2 * b))]
        for src, (dx, dy, dw, dh) in parts:
            self.image(S, dx, dy, dw, dh, crop=src)


def head_icon(skin, K):
    """Player-head item as the GUI draws it (isometric skull, flat GUI lighting), 16x16 GUI px at scale K."""
    S = 8 * K * 2
    sk = skin.convert("RGBA")
    def face(box, hat_box):
        f = sk.crop(box).resize((S, S), Image.NEAREST)
        h = sk.crop(hat_box).resize((S, S), Image.NEAREST)
        f.alpha_composite(h)
        return np.asarray(f).astype(np.float32)
    top = face((8, 0, 16, 8), (40, 0, 48, 8))
    front = face((8, 8, 16, 16), (40, 8, 48, 16))
    side = face((0, 8, 8, 16), (32, 8, 40, 16))
    N = 16 * K
    out = np.zeros((N, N, 4), dtype=np.float32)
    # isometric frame (GUI skull: face toward the viewer's left, side to the right)
    cx, cy = N / 2, N / 2
    s = N * 0.36
    ax = np.array([math.cos(math.radians(30)), math.sin(math.radians(30))]) * s   # x axis (to the right-down)
    az = np.array([-math.cos(math.radians(30)), math.sin(math.radians(30))]) * s  # z axis (to the left-down)
    ay = np.array([0, -1.0]) * s * 1.15
    o = np.array([cx, cy + s * 0.55])
    yy, xx = np.mgrid[0:N, 0:N]
    P = np.stack([xx + 0.5, yy + 0.5], -1).reshape(-1, 2) - o
    def paint(img, e1, e2, base, shade):
        M = np.stack([e1, e2], 1)
        inv = np.linalg.inv(M)
        uv = (P - base) @ inv.T
        ok = (uv[:, 0] >= 0) & (uv[:, 0] < 1) & (uv[:, 1] >= 0) & (uv[:, 1] < 1)
        u = np.clip((uv[:, 0] * S).astype(int), 0, S - 1)
        v = np.clip((uv[:, 1] * S).astype(int), 0, S - 1)
        col = img[v, u]
        col[:, :3] *= shade
        flat = out.reshape(-1, 4)
        m = ok & (col[:, 3] > 128)
        flat[m] = col[m]
    # front face: spans -z..(left) and up; side: +x and up; top: x and z
    paint(front, -az, ay, -ax * 0 + ay * 0 + np.array([0, 0]) - (-az) * 0 + az * 0 + (np.array([0, 0])), 0.62)
    return out


def head_icon2(skin, K):
    """Simpler, faithful-looking skull icon: three faces of the head composed with affine warps."""
    N = 16 * K
    sk = skin.convert("RGBA")
    def face(box, hat):
        f = sk.crop(box)
        h = sk.crop(hat)
        f = f.copy()
        f.alpha_composite(h)
        return f.resize((64, 64), Image.NEAREST)
    top, front, side = face((8, 0, 16, 8), (40, 0, 48, 8)), face((8, 8, 16, 16), (40, 8, 48, 16)), face((16, 8, 24, 16), (48, 8, 56, 16))
    can = Image.new("RGBA", (N * 4, N * 4), (0, 0, 0, 0))
    W4 = N * 4
    # cube corners in screen space (isometric 30 deg), size fitted to 16 px item
    s = W4 * 0.31
    c = (W4 / 2, W4 / 2 + s * 0.08)
    cos30, sin30 = math.cos(math.radians(30)), 0.5
    up = (0, -s * 1.0)
    L = (-s * cos30, s * sin30)
    R = (s * cos30, s * sin30)
    top_c = (c[0], c[1] - s * 0.5)
    def warp(img, p0, px, py, shade):
        # map image (64x64) unit square: (0,0)->p0, (1,0)->p0+px, (0,1)->p0+py
        a = np.array([[px[0] / 64, py[0] / 64, p0[0]], [px[1] / 64, py[1] / 64, p0[1]], [0, 0, 1]])
        inv = np.linalg.inv(a)
        coeffs = (inv[0, 0], inv[0, 1], inv[0, 2], inv[1, 0], inv[1, 1], inv[1, 2])
        arr = np.asarray(img).astype(np.float32)
        arr[:, :, :3] *= shade
        im2 = Image.fromarray(arr.clip(0, 255).astype(np.uint8))
        t = im2.transform((W4, W4), Image.AFFINE, coeffs, resample=Image.NEAREST)
        can.alpha_composite(t)
    # top face: back corner at top_c - (L+R)/2 ...
    back = (c[0], c[1] - s * 1.5)
    warp(top, (back[0] + L[0], back[1] + L[1]), (R[0], R[1]), (-L[0] * 0 + R[0] * 0 + ( -L[0]) * 0 + 0, 0), 1.0) if False else None
    # explicit: top rhombus with corners: back, back+R, back+R+L, back+L  (u along R, v along L)
    warp(top, back, R, L, 1.0)
    # front (face) on the left: from back+L down: corners (back+L), (back+L+R)... face spans L side
    fl = (back[0] + L[0], back[1] + L[1])
    warp(front, fl, R, (0, s), 0.82)
    # side on the right
    fr = (back[0] + L[0] + R[0], back[1] + L[1] + R[1])
    warp(side, fr, (-L[0], -L[1]), (0, s), 0.62)
    return can.resize((N, N), Image.BOX)


def fetch_skin(url, cache_dir):
    os.makedirs(cache_dir, exist_ok=True)
    p = os.path.join(cache_dir, hashlib.md5(url.encode()).hexdigest()[:12] + ".png")
    if not os.path.exists(p):
        open(p, "wb").write(urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=20).read())
    return Image.open(p).convert("RGBA")


def skin_by_name(name, cache_dir):
    cp = os.path.join(cache_dir, "names.json")
    cache = json.load(open(cp)) if os.path.exists(cp) else {}
    if name not in cache:
        import time
        def get(url):
            for k in range(8):
                try:
                    return json.loads(urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=20).read())
                except urllib.error.HTTPError as e:
                    if e.code != 429:
                        raise
                    time.sleep(15)
            raise RuntimeError("rate limited: " + url)
        prof = get(f"https://api.mojang.com/users/profiles/minecraft/{name}")
        ses = get(f"https://sessionserver.mojang.com/session/minecraft/profile/{prof['id']}")
        tex = json.loads(base64.b64decode(ses["properties"][0]["value"] + "==="))
        cache[name] = tex["textures"]["SKIN"]["url"]
        json.dump(cache, open(cp, "w"))
    return fetch_skin(cache[name], cache_dir)


def item_skin(material, cache_dir):
    if material.startswith("head-"):
        return skin_by_name(material[5:], cache_dir)
    if material.startswith("basehead-"):
        js = json.loads(base64.b64decode(material[9:] + "==="))
        return fetch_skin(js["textures"]["SKIN"]["url"], cache_dir)
    return None


CURSOR = ["X..........", "XX.........", "XWX........", "XWWX.......", "XWWWX......", "XWWWWX.....", "XWWWWWX....", "XWWWWWWX...",
          "XWWWWWWWX..", "XWWWWWWWWX.", "XWWWWWXXXXX", "XWWXWWX....", "XWX.XWWX...", "XX..XWWX...", "X....XWWX..", ".....XWWX..", "......XX..."]


def draw_cursor(C, mx, my):
    """Arrow pointer like the OS draws over the game (1 px = 1/2 GUI px)."""
    for r, row in enumerate(CURSOR):
        for c, ch in enumerate(row):
            if ch == "X":
                C.rect(mx + c * 0.5, my + r * 0.5, mx + c * 0.5 + 0.5, my + r * 0.5 + 0.5, (0, 0, 0, 255))
            elif ch == "W":
                C.rect(mx + c * 0.5, my + r * 0.5, mx + c * 0.5 + 0.5, my + r * 0.5 + 0.5, (255, 255, 255, 255))


def render_codes(fonts, client, menu, out_png, hover=None, K=4, WG=270, HG=480, mouse=None, cache_dir=".", tip="below", dim=True):
    C = Canvas(fonts, WG, HG, K)
    # in-game container background: dark gradient over the world
    if dim:
        C.gradient(0, 0, WG, HG, (16, 16, 16, 0xC0), (16, 16, 16, 0xD0))
    rows = menu.get("size", 54) // 9
    iw, ih = 176, 114 + rows * 18
    lx, ty = (WG - iw) // 2, (HG - ih) // 2
    chest = Image.open(io.BytesIO(client.read("assets/minecraft/textures/gui/container/generic_54.png"))).convert("RGBA")
    C.image(chest, lx, ty, 176, rows * 18 + 17, crop=(0, 0, 176, rows * 18 + 17))
    C.image(chest, lx, ty + rows * 18 + 17, 176, 96, crop=(0, 126, 176, 222))
    # title (pack background glyphs ride in it)
    C.text(menu["menu_title"], lx + 8, ty + 6)
    C.text("&#404040Инвентарь", lx + 8, ty + ih - 94)
    icons = {}
    for key, it in menu["items"].items():
        slot = it["slot"]
        sx, sy = lx + 8 + (slot % 9) * 18, ty + 18 + (slot // 9) * 18
        sk = item_skin(it["material"], cache_dir)
        if sk is not None:
            ic = head_icon2(sk, K)
            C.img.alpha_composite(ic, (sx * K, sy * K))
        icons[key] = (sx, sy)
    if hover:
        it = menu["items"][hover]
        sx, sy = icons[hover]
        C.rect(sx, sy, sx + 16, sy + 16, (255, 255, 255, 0x80))  # slot highlight
        mx, my = mouse or (sx + 10, sy + 9)
        lines = [it.get("display_name", " ")] + list(it.get("lore", []))
        tw = max(C.text_width(l) for l in lines)
        th = 8 + (2 if len(lines) > 1 else 0) + (len(lines) - 1) * 10
        tx, tyy = mx + 12, my - 12
        if tip == "none":
            draw_cursor(C, mx, my)
            lines = []
        if tip == "below":  # vertical frame: keep the hovered row visible, tooltip under the slot
            tx, tyy = (WG - tw) // 2, sy + 30
        if tx + tw > WG - 4:
            tx = max(4, mx - 16 - tw)
        if tyy + th + 3 > HG:
            tyy = HG - th - 3
        if lines:
            bg = Image.open(io.BytesIO(client.read("assets/minecraft/textures/gui/sprites/tooltip/background.png"))).convert("RGBA")
            fr = Image.open(io.BytesIO(client.read("assets/minecraft/textures/gui/sprites/tooltip/frame.png"))).convert("RGBA")
            bx, by, bw, bh = tx - 3 - 9, tyy - 3 - 9, tw + 6 + 18, th + 6 + 18
            C.nine(bg, bx, by, bw, bh, 9)
            C.nine(fr, bx, by, bw, bh, 10)
            yy = tyy
            for i, l in enumerate(lines):
                C.text("&f" + l if not l.startswith("&") else l, tx, yy, shadow=True)
                yy += 10 + (2 if i == 0 else 0)
            draw_cursor(C, mx, my)
    if not dim:  # floating panel: crop to the menu artwork
        C.img = C.img.crop(((lx - 40) * K, (ty - 27) * K, (lx + 216) * K, (ty + 229) * K))
    C.img.save(out_png)
    return C


def render_title(fonts, title, subtitle, out_png, K=2, WG=540, HG=960, ty_frac=0.5, maxw=1000, px0=None):
    """Vanilla title (x4) and subtitle (x2) look, centred; the pixel scale drops to fit a vertical frame."""
    Wpx, Hpx = WG * K, HG * K
    out = Image.new("RGBA", (Wpx, Hpx), (0, 0, 0, 0))
    probe = Canvas(fonts, 10, 10, 1)
    tw = probe.text_width(title) if title else 0
    sw = probe.text_width(subtitle) if subtitle else 0
    px = px0 or 4 * K  # px per font px for the title
    while px > 2 and max(tw * px, sw * px / 2) > maxw:
        px -= 1
    for text, scale, dy in ((title, px, -10), (subtitle, max(2, px // 2), 5)):
        if not text:
            continue
        w = probe.text_width(text)
        sub = Canvas(fonts, w + 4, 14, 1)
        sub.text(text, 0, 2, shadow=True)
        im = sub.img.resize(((w + 4) * scale, 14 * scale), Image.NEAREST)
        x = (Wpx - w * scale) // 2
        y = int(Hpx * ty_frac + (dy - 2) * (px if text is title else px))
        out.alpha_composite(im, (x, y))
    out.save(out_png)


if __name__ == "__main__":
    PACK, JAR, MENU, OUT = sys.argv[1:5]
    fonts = Fonts(PACK, JAR)
    client = zipfile.ZipFile(JAR)
    menu = yaml.safe_load(open(MENU, encoding="utf-8"))
    os.makedirs(OUT, exist_ok=True)
    cache = os.path.join(OUT, "heads")
    render_codes(fonts, client, menu, os.path.join(OUT, "codes_plain.png"), cache_dir=cache)
    render_codes(fonts, client, menu, os.path.join(OUT, "codes_hover_free.png"), hover="tgreward", cache_dir=cache)
    render_codes(fonts, client, menu, os.path.join(OUT, "codes_hover_pogostik.png"), hover="pogostik", cache_dir=cache)
    render_title(fonts, "&#B37DFF❖ Выбор приза ❖", "&fꕀ", os.path.join(OUT, "title_roulette.png"))
    render_title(fonts, "&#FF4D6DВы построили огромный х*й.", "&#FFD97D✦ &#FFF3C4Сейчас начнётся рулетка с призом &#FFD97D✦", os.path.join(OUT, "title_built.png"))
    render_title(fonts, "&#7DFFB3✔ Поздравляем!", "&fꕀ", os.path.join(OUT, "title_win.png"))
    print("ok")
