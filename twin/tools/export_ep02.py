# Episode 2 props: nametags for etoLikos / _pogostik_ / the parody owner, hologram price tags, chat lines, the
# ban title, the owner's price sign (all with the real Minecraft font + pack glyphs), and the owner's skin drawn
# from scratch (crown, sunglasses, tuxedo, gold chain with «$») — an invented caricature, not anyone's real skin.
# usage: python -I export_ep02.py <pack.zip> <client.jar> <out_dir>
import io, os, sys, zipfile
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from mcfont import Fonts, render_line
from gui import Canvas, render_title

PACK, JAR, OUT = sys.argv[1:4]
os.makedirs(OUT, exist_ok=True)
fonts = Fonts(PACK, JAR)
client = zipfile.ZipFile(JAR)
NICK = "EtoLikos"


def line(text, name, bg=(0, 0, 0, 64), K=4):
    img, w = render_line(fonts, text, K=K, shadow=False, bg=bg)
    img.save(os.path.join(OUT, name + ".png"))


# nametags
line(f"&f{NICK}", "tag_hero")
line(f"&fꕠ &f{NICK}", "tag_hero_dhelper")
line("&fꔴ &f_pogostik_", "tag_pog_owner")
line("&#FFD24D&lВЛАДЕЛЕЦ", "tag_villain")
line("&f/codes", "cmd_codes", bg=(0, 0, 0, 128))
line("&fпривет", "cmd_hello", bg=(0, 0, 0, 128))

# hologram price tags over everything on the parody plaza (absurd on purpose)
PRICES = {
    "price_diamond": "&fАЛМАЗ &7— &#FF4D4D&l299 ₽",
    "price_air": "&fВОЗДУХ &7— &#FF4D4D&l9 ₽/мин",
    "price_exit": "&fВЫХОД &7— &#FF4D4D&l199 ₽",
    "price_bench": "&fПОСТОЯТЬ ТУТ &7— &#FF4D4D&l49 ₽",
    "price_unban": "&fРАЗБАН &7— &#FF4D4D&l4 999 ₽",
    "price_priv": "&#FFD24D&lПРИВИЛЕГИЯ &7— &#FF4D4D&l99 999 ₽",
}
for k, t in PRICES.items():
    line(t, k, bg=(0, 0, 0, 96))

# chat lines
line(f"&7<&f{NICK}&7> &fпривет", "chat_hello", bg=(0, 0, 0, 110))
line(f"&#FF4D4D&l[!] &f{NICK} &#FF4D4Dзабанен. &7Причина: &fпросто так", "chat_ban", bg=(0, 0, 0, 110))
line("&fꔴ &#FFD97D_pogostik_&7: &fпривет! держи кейс", "chat_owner", bg=(0, 0, 0, 110))

# titles
render_title(fonts, "&#FF3B3B&lВЫ ЗАБАНЕНЫ", "&7Причина: &fпросто так", os.path.join(OUT, "title_ban.png"), px0=14)
render_title(fonts, "&#FF3B3B&lБАН", "&7Причина: &f«привет»", os.path.join(OUT, "title_ban2.png"), px0=16)

# the owner's sign (oak board front, black text like a real sign)
signs = Image.open(io.BytesIO(client.read("assets/minecraft/textures/entity/signs/oak.png"))).convert("RGBA")
S = 8
for name, lines in (("sign_priv", ["&0ПРИВИЛЕГИЯ", "&4&l99 999 ₽", "&0скидка 0%", ""]),
                    ("sign_t", ["", "&0&lT", "", ""])):
    board = signs.crop((2, 2, 26, 14)).resize((96 * S, 48 * S), Image.NEAREST)
    C = Canvas(fonts, 96, 48, S)
    C.img = board.copy()
    for i, l in enumerate(lines):
        w = C.text_width(l)
        C.text(l, (96 - w) / 2, 4 + i * 10)
    C.img.save(os.path.join(OUT, name + ".png"))
signs.save(os.path.join(OUT, "sign_oak.png"))

# ---- the owner's skin (classic 64x64 layout)
sk = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
P = sk.load()
SKIN, SKIN_D = (236, 182, 140, 255), (214, 156, 118, 255)
HAIR = (58, 38, 28, 255)
BLACK, BLACK2 = (26, 26, 34, 255), (40, 40, 52, 255)
WHITE = (236, 236, 240, 255)
RED = (190, 28, 36, 255)
GOLD, GOLD_D, GOLD_L = (250, 200, 46, 255), (196, 140, 20, 255), (255, 236, 140, 255)
GEM = (210, 30, 60, 255)


def rect(x, y, w, h, c):
    for i in range(x, x + w):
        for j in range(y, y + h):
            P[i, j] = c


def face_set(u, v, w, h, d, cols):  # fill all 6 faces of a box unfolding with one colour fn(face, x, y)
    faces = {"top": (u + d, v, w, d), "bottom": (u + d + w, v, w, d), "right": (u, v + d, d, h), "front": (u + d, v + d, w, h),
             "left": (u + d + w, v + d, d, h), "back": (u + 2 * d + w, v + d, w, h)}
    for f, (x, y, fw, fh) in faces.items():
        for i in range(fw):
            for j in range(fh):
                c = cols(f, i, j, fw, fh)
                if c:
                    P[x + i, y + j] = c


# head: slicked hair, sunglasses with a glint, moustache, smug mouth with a gold tooth
def head(f, i, j, w, h):
    if f == "top":
        return HAIR
    if f == "bottom":
        return SKIN_D
    if j <= 1 or (f in ("left", "right", "back") and j <= 3) or f == "back" and j <= 6:
        return HAIR
    if f != "front":
        return SKIN
    if j == 3:
        return (16, 16, 20, 255) if 1 <= i <= 6 else SKIN
    if j == 4:
        return (16, 16, 20, 255) if i in (1, 2, 5, 6) else SKIN
    if j == 5:
        return HAIR if 2 <= i <= 5 else SKIN
    if j == 6:
        return (120, 30, 30, 255) if 3 <= i <= 5 else SKIN
    if j == 7:
        return SKIN_D
    return SKIN


face_set(0, 0, 8, 8, 8, head)
P[8 + 8 + 2, 8 + 3] = (230, 230, 255, 255)  # glint on the left lens
P[8 + 8 + 5, 8 + 6] = GOLD                   # gold tooth


# crown on the hat layer: three rows of gold round the head with spikes and a red gem in front
def crown(f, i, j, w, h):
    if f in ("top", "bottom"):
        return None
    if j == 0:
        return GOLD if i % 3 == 0 else None
    if j == 1:
        return GEM if (f == "front" and i in (3, 4)) else GOLD_L if i % 3 == 0 else GOLD
    if j == 2:
        return GOLD_D
    return None


face_set(32, 0, 8, 8, 8, crown)


# body: tuxedo, white shirt, red tie, gold chain with a «$» medallion, gold belt buckle
def body(f, i, j, w, h):
    if f in ("top", "bottom"):
        return BLACK
    if f != "front":
        return BLACK if f != "back" or j != 11 else GOLD_D
    if j == 11:
        return GOLD if 3 <= i <= 4 else BLACK2
    shirt = 2 <= i <= 5 and j <= 7
    c = WHITE if shirt else BLACK
    if 3 <= i <= 4 and j <= 6:
        c = RED
    chain = {1: (1, 6), 2: (1, 6), 3: (2, 5), 4: (2, 5), 5: (3, 4)}
    if j in chain and i in chain[j]:
        c = GOLD
    if j in (6, 7) and 3 <= i <= 4:
        c = GOLD_L if j == 6 else GOLD_D
    if j in (8, 10) and i in (2, 5):
        c = GOLD_D
    return c


face_set(16, 16, 8, 12, 4, body)


def arm(f, i, j, w, h):
    if f == "top":
        return BLACK
    if f == "bottom":
        return SKIN
    if j >= 10:
        return GOLD if (f == "front" and j == 10 and i == 1) else SKIN
    if j == 9:
        return GOLD_D
    return BLACK if i != 0 else BLACK2


face_set(40, 16, 4, 12, 4, arm)
face_set(32, 48, 4, 12, 4, arm)


def leg(f, i, j, w, h):
    if f == "top":
        return BLACK
    if j >= 10 or f == "bottom":
        return GOLD if j != 11 else GOLD_D
    return BLACK if i != 0 else BLACK2


face_set(0, 16, 4, 12, 4, leg)
face_set(16, 48, 4, 12, 4, leg)
sk.save(os.path.join(OUT, "skin_owner.png"))
sk.resize((512, 512), Image.NEAREST).save(os.path.join(OUT, "_skin_owner_preview.png"))
print("ok")
