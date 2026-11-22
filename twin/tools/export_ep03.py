# Episode 3 props in the real Minecraft look (client font + vanilla GUI sprites from the jar): the multiplayer
# server list with 4 parody «копии рилика» + MoreCube, the connecting / connection-lost screens, the «edit server»
# dialog typing pog.morecube.ru letter by letter, the copy's tab list, the scam shop, floating text lines, server
# icons drawn in code, and block textures for the crumbling world.
# usage: python -I export_ep03.py <pack.zip> <client.jar> <out_dir>
import io, os, sys, zipfile
from PIL import Image, ImageDraw

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from mcfont import Fonts, render_line
from gui import Canvas

PACK, JAR, OUT = sys.argv[1:4]
os.makedirs(os.path.join(OUT, "tex"), exist_ok=True)
fonts = Fonts(PACK, JAR)
client = zipfile.ZipFile(JAR)
pack = zipfile.ZipFile(PACK)
K = 4
IP = "pog.morecube.ru"


def tex(p):
    return Image.open(io.BytesIO(client.read(f"assets/minecraft/textures/{p}.png"))).convert("RGBA")


BG = tex("gui/menu_background")
LISTBG = tex("gui/menu_list_background")
HSEP, FSEP = tex("gui/header_separator"), tex("gui/footer_separator")
BTN, BTN_HI = tex("gui/sprites/widget/button"), tex("gui/sprites/widget/button_highlighted")
FIELD, FIELD_HI = tex("gui/sprites/widget/text_field"), tex("gui/sprites/widget/text_field_highlighted")
PING = {n: tex(f"gui/sprites/icon/ping_{n}") for n in range(1, 6)}
JOIN = tex("gui/sprites/server_list/join_highlighted")


def base(C, w, h, a=225):
    C.rect(0, 0, w, h, (14, 11, 20, a))


def tile(C, im, x0, y0, x1, y1, shade=1.0):
    w, h = im.size
    for y in range(y0, y1, h):
        for x in range(x0, x1, w):
            cw, chh = min(w, x1 - x), min(h, y1 - y)
            C.image(im, x, y, cw, chh, crop=(0, 0, cw, chh), tint=None if shade == 1 else (int(255 * shade),) * 3)


def center(C, text, y, W, shadow=True):
    C.text(text, (W - C.text_width(text)) / 2, y, shadow=shadow)


def button(C, label, x, y, w, hi=False):
    C.nine(BTN_HI if hi else BTN, x, y, w, 20, 3)
    C.text(label, x + (w - C.text_width(label)) / 2, y + 6, shadow=True)


# ---- server icons (64x64) drawn in code + the MoreCube pack icon
def icon(bg, draw_fn):
    im = Image.new("RGBA", (64, 64), bg)
    d = ImageDraw.Draw(im)
    draw_fn(im, d)
    return im


def big_text(im, text, col, y, k=4):
    C = Canvas(fonts, 16, 16, 1)
    w = C.text_width(text)
    C2 = Canvas(fonts, max(1, w + 2), 10, 1)
    C2.text(text, 0, 0, shadow=False, default=col)
    t = C2.img.resize((C2.img.width * k, C2.img.height * k), Image.NEAREST)
    im.alpha_composite(t, ((64 - t.width) // 2, y))


ICONS = {
    "c1": icon((70, 70, 76, 255), lambda im, d: (big_text(im, "&#FF5555R", (255, 85, 85), 6, 5), big_text(im, "&7копия", (170, 170, 170), 44, 2), d.line([(8, 58), (30, 34), (40, 46), (58, 12)], fill=(20, 20, 24, 255), width=2))),
    "c2": icon((92, 104, 40, 255), lambda im, d: (big_text(im, "&eTPS", (255, 255, 85), 6, 3), big_text(im, "&c2", (255, 85, 85), 30, 4))),
    "c3": icon((70, 30, 100, 255), lambda im, d: big_text(im, "&6₽", (255, 170, 0), 10, 6)),
    "c4": icon((150, 26, 30, 255), lambda im, d: (big_text(im, "&fx10", (255, 255, 255), 8, 4), big_text(im, "&eДОНАТ", (255, 255, 85), 42, 2))),
}
try:
    ICONS["mc"] = Image.open(io.BytesIO(pack.read("pack.png"))).convert("RGBA").resize((64, 64), Image.LANCZOS)
except KeyError:
    ICONS["mc"] = icon((40, 140, 60, 255), lambda im, d: big_text(im, "&6MC", (255, 170, 0), 18, 5))
for k, im in ICONS.items():
    im.save(os.path.join(OUT, f"icon_{k}.png"))

SERVERS = [
    ("c1", "&fКОПИЯ РИЛИКА &7#1", "&aОНЛАЙН 1000+ &8(на самом деле 2)", "&7Самый живой сервер!!!", "&72&8/&71000", 3),
    ("c2", "&fКОПИЯ РИЛИКА &7#2", "&eБЕЗ ЛАГОВ!!!", "&7TPS: 2 · пинг: 999", "&734&8/&7500", 1),
    ("c3", "&fКОПИЯ РИЛИКА &7#3", "&6ДОНАТ ОТ 9 999 ₽", "&7Прыжок — 10 ₽", "&712&8/&7300", 4),
    ("c4", "&fКОПИЯ РИЛИКА &7#4", "&c&lОТКРЫТИЕ! &6ДОНАТ x10", "&7Только сегодня!!!", "&777&8/&7100", 5),
    ("mc", "&6&lMoreCube &7| &fГРИФ #1", "&aБесплатный донат: /code PODAROK", "&b" + IP + " &7· ивенты", "", 5),
]


def server_list(sel=None, glow_mc=False):
    W, H = 320, 252
    C = Canvas(fonts, W, H, K)
    base(C, W, H)
    tile(C, BG, 0, 0, W, H)
    tile(C, LISTBG, 0, 30, W, 220)
    tile(C, HSEP, 0, 30, W, 32)
    tile(C, FSEP, 0, 218, W, 220)
    center(C, "&fСетевая игра", 11, W)
    x0 = 8
    for i, (ic, name, m1, m2, cnt, ping) in enumerate(SERVERS):
        y = 34 + i * 36
        if i == sel:
            C.rect(x0 - 2, y - 2, x0 + 307, y + 34, (255, 255, 255, 255) if not (glow_mc and i == 4) else (255, 200, 60, 255))
            C.rect(x0 - 1, y - 1, x0 + 306, y + 33, (0, 0, 0, 255))
        C.image(ICONS[ic], x0 + 2, y, 32, 32)
        if i == sel:
            C.image(JOIN, x0 + 2, y, 32, 32)
        C.text(name, x0 + 37, y + 1, shadow=True)
        C.text(m1, x0 + 37, y + 12, shadow=True)
        C.text(m2, x0 + 37, y + 22, shadow=True)
        C.image(PING[ping], x0 + 305 - 12, y + 1, 10, 8)
        if cnt:
            C.text(cnt, x0 + 305 - 15 - C.text_width(cnt), y + 1, shadow=True)
    button(C, "&fПрисоединиться", 56, 226, 100, hi=sel is not None)
    button(C, "&fДобавить", 164, 226, 100, hi=False)
    return C.img


server_list().save(os.path.join(OUT, "srv_list.png"))
for i in range(5):
    server_list(sel=i, glow_mc=(i == 4)).save(os.path.join(OUT, f"srv_list_sel{i + 1}.png"))

# ---- connecting / connection lost
C = Canvas(fonts, 200, 110, K)
base(C, 200, 110, 255)
tile(C, BG, 0, 0, 200, 110)
center(C, "&fПодключение к серверу...", 42, 200)
center(C, "&7Загрузка мира", 56, 200)
C.img.save(os.path.join(OUT, "screen_connect.png"))

C = Canvas(fonts, 240, 132, K)
base(C, 240, 132)
tile(C, BG, 0, 0, 240, 132)
center(C, "&7Соединение потеряно", 24, 240)
center(C, "&cСервер закрыт навсегда.", 48, 240)
center(C, "&fСпасибо за донат! &c❤", 60, 240)
button(C, "&fВернуться к списку серверов", 20, 96, 200, hi=True)
C.img.save(os.path.join(OUT, "screen_lost.png"))

# ---- edit-server dialog typing the address
for n in range(len(IP) + 1):
    C = Canvas(fonts, 240, 156, K)
    base(C, 240, 156)
    tile(C, BG, 0, 0, 240, 156)
    center(C, "&fИзменение данных сервера", 10, 240)
    C.text("&7Имя сервера", 20, 32, shadow=True)
    C.nine(FIELD, 20, 42, 200, 20, 1)
    C.text("&fMoreCube", 24, 48, shadow=True)
    C.text("&7Адрес сервера", 20, 70, shadow=True)
    C.nine(FIELD_HI, 20, 80, 200, 20, 1)
    typed = IP[:n]
    end = C.text("&f" + typed, 24, 86, shadow=True)
    if n < len(IP):
        C.text("&f_", end, 86, shadow=True)
    button(C, "&fГотово", 20, 120, 96, hi=n == len(IP))
    button(C, "&fОтмена", 124, 120, 96)
    C.img.save(os.path.join(OUT, f"addsrv_{n:02d}.png"))

# ---- tab list of copy #1 (2 players)
C = Canvas(fonts, 128, 62, K)
C.rect(0, 0, 128, 62, (0, 0, 0, 150))
center(C, "&7КОПИЯ РИЛИКА #1", 3, 128)
center(C, "&a&lОНЛАЙН 1000+", 13, 128)
for j, nm in enumerate(["&fEtoLikos", "&cAdmin &8[AFK]"]):
    y = 26 + j * 11
    C.rect(8, y, 120, y + 9, (255, 255, 255, 40))
    C.text(nm, 10, y + 1, shadow=True)
    C.image(PING[5 if j == 0 else 1], 108, y, 10, 8)
center(C, "&7Онлайн: &c&l2", 50, 128)
C.img.save(os.path.join(OUT, "tab_copy1.png"))

# ---- scam shop (copy #4)
C = Canvas(fonts, 190, 76, K)
base(C, 190, 76)
tile(C, BG, 0, 0, 190, 76, shade=0.9)
center(C, "&c&lОТКРЫТИЕ! &6ДОНАТ x10", 6, 190)
C.text("&fꕀ &7(навсегда*)", 14, 24, shadow=True)
C.text("&#FF4D4D&l499 ₽", 190 - 14 - C.text_width("&#FF4D4D&l499 ₽"), 24, shadow=True)
C.text("&8*навсегда = пока сервер жив", 14, 36, shadow=True)
button(C, "&fКупить", 45, 50, 100, hi=True)
C.img.save(os.path.join(OUT, "shop_scam.png"))


# ---- floating lines (nametag / hologram style)
def line(text, name, bg=(0, 0, 0, 64)):
    img, w = render_line(fonts, text, K=4, shadow=bg is None, bg=bg)
    img.save(os.path.join(OUT, name + ".png"))


line("&#FF4D4D&lTPS: 2", "fl_tps", bg=(0, 0, 0, 110))
line("&#FF4D4D&lПИНГ: 999", "fl_ping", bg=(0, 0, 0, 110))
line("&fПРЫЖОК &7— &#FF4D4D&l10 ₽", "price_jump", bg=(0, 0, 0, 96))
line("&fКРАФТ &7— &#FF4D4D&l99 ₽", "price_craft", bg=(0, 0, 0, 96))
line("&fСЕСТЬ &7— &#FF4D4D&l15 ₽", "price_sit", bg=(0, 0, 0, 96))
def two_lines(a, b, name, bg=(0, 0, 0, 110)):
    T = Canvas(fonts, 8, 8, K)
    w = int(max(T.text_width(a), T.text_width(b))) + 10
    C = Canvas(fonts, w, 24, K)
    C.rect(0, 0, w, 24, bg)
    center(C, a, 3, w)
    center(C, b, 13, w)
    C.img.save(os.path.join(OUT, name + ".png"))


two_lines("&fСМОТРЕТЬ НА НЕБО", "&7— &#FF4D4D&l5 ₽", "price_sky", bg=(0, 0, 0, 96))
line("&#FF4D4D&l−10 ₽", "fl_minus10", bg=None)
line("&7Zzz", "fl_zzz", bg=None)
line("&cAdmin &7[AFK]", "tag_admin")
# MoreCube crowd nametags in the client font (some with the HYDRA badge from /code)
CROWD = ['Kotik228', 'xXProXx', 'Lera_mc', 'Den4ik', 'Sasha_pvp', 'Nastya', 'Grifer777', 'Max_top', 'ShadowKid', 'Vlad1k', 'Kira', 'Tima_YT', 'Zhenya', 'Artem', 'Bober', 'Mira', 'Egorka', 'Pixel', 'Lis', 'Nik_off', 'Dimon', 'Sonya_cat', 'Kirill_pro', 'Vanya228', 'Liza', 'Tolik', 'Pashka', 'Alina_mc', 'Stepa', 'Gosha']
for i, nick in enumerate(CROWD):
    line(("&fꕀ &f" if i in {1, 17, 4, 22, 8, 26, 13} else "&f") + nick, f"tag_c{i:02d}")
line("&fвсем привет!", "bub_1", bg=(0, 0, 0, 175))
line("&eго на ивент!", "bub_2", bg=(0, 0, 0, 175))
line("&aкруто тут!", "bub_3", bg=(0, 0, 0, 175))
line("&fEtoLikos", "tag_hero")
line("&fꔴ &f_pogostik_", "tag_pog_owner")
line("&eДОБРО ПОЖАЛОВАТЬ НА КОПИЮ РИЛИКА", "holo_welcome", bg=(0, 0, 0, 80))
line("&7<&fEtoLikos&7> &fпривет?", "chat_hi", bg=(0, 0, 0, 110))
two_lines("&a&lПокупка успешна!", "&fꕀ &fx10 &7— навсегда*", "chat_buy", bg=(0, 0, 0, 130))
two_lines("&c&lВЫ ЗАБАНЕНЫ", "&7Причина: &fпросто так", "ban_msg", bg=(0, 0, 0, 150))
two_lines("&a&l✔ КОД АКТИВИРОВАН!", "&fКейс с донатом — &e&lтвой", "chat_reward", bg=(0, 0, 0, 175))
line("&f/code PODAROK", "cmd_code", bg=(0, 0, 0, 200))


# ---- block textures for the crumbling copy island
for k, p in (("cobble", "block/cobblestone"), ("mossy", "block/mossy_cobblestone"), ("dirt", "block/dirt"), ("planks", "block/oak_planks"),
             ("gravel", "block/gravel"), ("dead_bush", "block/dead_bush"), ("chest_item", "entity/chest/normal")):
    im = tex(p)
    if im.height > im.width and p.startswith("block/"):
        im = im.crop((0, 0, im.width, im.width))
    im.save(os.path.join(OUT, "tex", k + ".png"))
print("ok")
