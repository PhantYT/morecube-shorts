# Episode props from the real assets: block/item textures (client jar), the /codes panel and tooltip as separate
# images for floating 3D panels, MC titles, nametags and chat-command lines, the Telegram-bot phone screen.
# usage: python -I export_assets.py <pack.zip> <client.jar> <code.yml> <out_dir>
import io, os, sys, zipfile
import yaml
from PIL import Image, ImageDraw, ImageFont

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from mcfont import Fonts, render_line
from gui import Canvas, render_codes, render_title, item_skin, head_icon2

PACK, JAR, MENU, OUT = sys.argv[1:5]
os.makedirs(OUT, exist_ok=True)
fonts = Fonts(PACK, JAR)
client = zipfile.ZipFile(JAR)
menu = yaml.safe_load(open(MENU, encoding="utf-8"))

# ---- textures
TEX = {"gold_block": "block/gold_block", "diamond": "item/diamond", "netherite_ingot": "item/netherite_ingot", "totem": "item/totem_of_undying",
       "golden_apple": "item/golden_apple", "ender_pearl": "item/ender_pearl", "xp_bottle": "item/experience_bottle", "diamond_sword": "item/diamond_sword",
       "emerald": "item/emerald", "gold_ingot": "item/gold_ingot", "netherite_sword": "item/netherite_sword", "firework": "item/firework_rocket",
       "chest_item": "entity/chest/normal", "particle_spark": "particle/spark_7", "particle_glint": "particle/glint", "particle_star": "particle/flash"}
os.makedirs(os.path.join(OUT, "tex"), exist_ok=True)
for k, p in TEX.items():
    try:
        im = Image.open(io.BytesIO(client.read(f"assets/minecraft/textures/{p}.png"))).convert("RGBA")
        if im.height > im.width and p.startswith("block/"):
            im = im.crop((0, 0, im.width, im.width))
        im.save(os.path.join(OUT, "tex", k + ".png"))
    except KeyError:
        print("missing", p)

# ---- /codes panel without the screen dim, cropped to the menu; tooltips as their own images
cache = os.path.join(os.path.dirname(OUT.rstrip("/\\")), "gui", "heads")
for hover, name in ((None, "panel_codes"), ("tgreward", "panel_codes_free"), ("pogostik", "panel_codes_pog")):
    C = render_codes(fonts, client, menu, os.path.join(OUT, name + "_full.png"), hover=hover, cache_dir=cache, tip="none", dim=False)
for key, name in (("tgreward", "tip_free"), ("pogostik", "tip_pog")):
    it = menu["items"][key]
    lines = [it.get("display_name", " ")] + list(it.get("lore", []))
    probe = Canvas(fonts, 10, 10, 1)
    tw = max(probe.text_width(l) for l in lines)
    th = 8 + 2 + (len(lines) - 1) * 10
    C = Canvas(fonts, tw + 6 + 18, th + 6 + 18, 4)
    bg = Image.open(io.BytesIO(client.read("assets/minecraft/textures/gui/sprites/tooltip/background.png"))).convert("RGBA")
    fr = Image.open(io.BytesIO(client.read("assets/minecraft/textures/gui/sprites/tooltip/frame.png"))).convert("RGBA")
    C.nine(bg, 0, 0, tw + 6 + 18, th + 6 + 18, 9)
    C.nine(fr, 0, 0, tw + 6 + 18, th + 6 + 18, 10)
    y = 12
    for i, l in enumerate(lines):
        C.text(l if l.startswith("&") else "&f" + l, 12, y, shadow=True)
        y += 10 + (2 if i == 0 else 0)
    C.img.save(os.path.join(OUT, name + ".png"))

# ---- titles (vanilla title x4 / subtitle x2 look, rendered big for overlays)
render_title(fonts, "&#FF4D6DВы построили огромный х*й.", "&#FFD97D✦ &#FFF3C4Сейчас начнётся рулетка с призом &#FFD97D✦", os.path.join(OUT, "title_built.png"))
render_title(fonts, "&#B37DFF❖ Выбор приза ❖", "", os.path.join(OUT, "title_roulette.png"))
for g, n in (("ꔶ", "tiger"), ("ꕖ", "bunny"), ("ꕄ", "vampire"), ("ꕒ", "rabbit"), ("ꕀ", "hydra"), ("ꕠ", "dhelper")):
    render_title(fonts, "", "&f" + g, os.path.join(OUT, f"sub_{n}.png"))
render_title(fonts, "", "&#D9BFFF❖ Кейс с донатом ❖", os.path.join(OUT, "sub_case.png"))
render_title(fonts, "", "&#FFC94D✦ &#FFEBA6300 рилликов &#FFC94D✦", os.path.join(OUT, "sub_r300.png"))
render_title(fonts, "&#7DFFB3✔ Поздравляем!", "&fꕀ", os.path.join(OUT, "title_win.png"))

# ---- floating text lines (nametag style): player tags, chat command, broadcast
def tag(text, name, bg=(0, 0, 0, 64)):
    img, w = render_line(fonts, text, K=4, shadow=False, bg=bg)
    img.save(os.path.join(OUT, name + ".png"))

tag("&f_pogostik_", "tag_plain")
tag("&fꕠ &f_pogostik_", "tag_dhelper")
tag("&fꕀ &f_pogostik_", "tag_hydra")
tag("&fꔴ &f_pogostik_", "tag_owner")
tag("&f/codes", "cmd_codes", bg=(0, 0, 0, 128))
tag("&#FF4D6D❘ &#FF758FСекретная система &#FF4D6D❘ &#7DFFB3Вам выпало: &fꕀ", "chat_win", bg=(0, 0, 0, 110))
tag("&#FF4D6D❘ &#FF758FСекретная система &#FF4D6D❘ &#FF9500⚠ &#FFD97D_pogostik_ &#FFB84Dвоздвиг ОГРОМНУЮ структуру!", "chat_volcano", bg=(0, 0, 0, 110))

# ---- phone screen (Telegram-like chat with the reward bot; generic UI, not a copy of the app)
W, H = 360, 640
ph = Image.new("RGBA", (W, H), (23, 33, 43, 255))
d = ImageDraw.Draw(ph)
fdir = "C:/Windows/Fonts/"
f_b = ImageFont.truetype(fdir + "segoeuib.ttf", 22)
f_r = ImageFont.truetype(fdir + "segoeui.ttf", 21)
f_s = ImageFont.truetype(fdir + "segoeui.ttf", 15)
d.rectangle((0, 0, W, 74), fill=(36, 47, 61, 255))
d.ellipse((16, 14, 62, 60), fill=(255, 176, 0, 255))
d.text((28, 22), "MC", font=f_b, fill=(40, 20, 0, 255))
d.text((74, 14), "MoreCube Free", font=f_b, fill=(255, 255, 255, 255))
d.text((74, 44), "бот", font=f_s, fill=(140, 160, 180, 255))

def bubble(y, text, mine=False, accent=None):
    lines = text.split("\n")
    w = max(d.textlength(l, font=f_r) for l in lines) + 28
    h = 14 + 28 * len(lines)
    x = W - w - 14 if mine else 14
    d.rounded_rectangle((x, y, x + w, y + h), radius=16, fill=(43, 82, 120, 255) if mine else (24, 37, 51, 255) if False else (44, 56, 70, 255))
    for i, l in enumerate(lines):
        d.text((x + 14, y + 7 + 28 * i), l, font=f_r, fill=accent if (accent and i == 0) else (255, 255, 255, 255))
    return y + h + 14

d.rounded_rectangle((14, H - 62, W - 14, H - 14), radius=22, fill=(36, 47, 61, 255))
d.text((34, H - 52), "Сообщение", font=f_r, fill=(110, 125, 140, 255))
y = 100
y = bubble(y, "Напиши свой ник\nс сервера", False)
ph.save(os.path.join(OUT, "phone_screen_1.png"))
y = bubble(y, "_pogostik_", True)
ph.save(os.path.join(OUT, "phone_screen_2.png"))
y = bubble(y, "Готово!\nD.HELPER + 5000 рилликов\nуже на сервере", False, accent=(125, 255, 179, 255))
ph.save(os.path.join(OUT, "phone_screen_3.png"))
ph.save(os.path.join(OUT, "phone_screen.png"))

# ---- oak sign with the video's code (front of the board 24x12 model px = 96x48 text px; black text, centred lines)
signs = Image.open(io.BytesIO(client.read("assets/minecraft/textures/entity/signs/oak.png"))).convert("RGBA")
S = 8  # image px per text px
board = signs.crop((2, 2, 26, 14)).resize((96 * S, 48 * S), Image.NEAREST)
C = Canvas(fonts, 96, 48, S)
C.img = board.copy()
for i, line in enumerate(["", "&0КОД:", "&0&lMOLOTOK", ""]):
    w = C.text_width(line)
    C.text(line, (96 - w) / 2, 4 + i * 10)
C.img.save(os.path.join(OUT, "sign_code.png"))
signs.save(os.path.join(OUT, "tex", "sign_oak.png"))
print("ok")
