# Labelled storyboard board for ep03 from the saved stills (data/shots/b3_*.png) -> preview/board_ep03.jpg
# usage: python -I board_ep03.py <twin_dir>
import os, sys
from PIL import Image, ImageDraw, ImageFont

TW = sys.argv[1]
FR = [
    (1.2, "К1 · хук", "Меню «Сетевая игра», штамп «НЕ ЗАХОДИ!», EtoLikos тянется к копии"),
    (4.9, "К2 · копия №1", "«Онлайн 1000+», а в табе двое: EtoLikos и спящий Админ"),
    (6.5, "К2", "«привет?» — в ответ только храп"),
    (8.2, "К3 · копия №2", "Лаги: идёт рывками, TPS 2 · ПИНГ 999"),
    (11.3, "К4 · копия №3", "Ценник на всё: прыжок −10 ₽, сесть, смотреть на небо"),
    (13.8, "К5 · копия №4", "«ДОНАТ x10»: ГИДРА навсегда* за 499 ₽"),
    (15.0, "К5", "Купил — и мир рассыпается по блокам"),
    (16.2, "К5", "«Сервер закрыт навсегда. Спасибо за донат!»"),
    (18.3, "К6 · рилик", "Банхаммер: «ВЫ ЗАБАНЕНЫ. Причина: просто так»"),
    (19.3, "К7", "В меню светится MoreCube"),
    (21.5, "К7 · MoreCube", "Спавн: толпа игроков, салют, _pogostik_ машет"),
    (25.0, "К8", "«Добавить сервер»: печатается pog.morecube.ru"),
    (27.2, "К8", "/code PODAROK → «Код активирован!», кейс с донатом"),
    (28.9, "К8 · финал", "«КАК ЗАЙТИ»: 3 шага, IP и код на экране"),
]
COLS, CW = 7, 300
CH = CW * 16 // 9
LH, TOP = 74, 74
rows = (len(FR) + COLS - 1) // COLS
B = Image.new("RGB", (COLS * CW + (COLS + 1) * 10, TOP + rows * (CH + LH + 10) + 10), (18, 16, 24))
d = ImageDraw.Draw(B)
fb = ImageFont.truetype("C:/Windows/Fonts/arialbd.ttf", 20)
fr = ImageFont.truetype("C:/Windows/Fonts/arial.ttf", 17)
ft = ImageFont.truetype("C:/Windows/Fonts/arialbd.ttf", 30)
d.text((12, 18), "Ролик №3 «Не заходи на копии рилика» · раскадровка (тайминг уточнится по озвучке) · POG.MORECUBE.RU · /code PODAROK", fill=(255, 214, 90), font=ft)
for i, (t, a, b) in enumerate(FR):
    p = os.path.join(TW, "data/shots", f"b3_{t:.2f}".replace(".", "_") + ".png")
    im = Image.open(p).convert("RGB").resize((CW, CH), Image.LANCZOS)
    x = 10 + (i % COLS) * (CW + 10)
    y = TOP + (i // COLS) * (CH + LH + 10)
    B.paste(im, (x, y))
    d.text((x + 4, y + CH + 6), a, fill=(255, 214, 90), font=fb)
    words, lines, cur = b.split(), [], ""
    for w in words:
        if d.textlength((cur + " " + w).strip(), font=fr) > CW - 8:
            lines.append(cur)
            cur = w
        else:
            cur = (cur + " " + w).strip()
    lines.append(cur)
    for j, ln in enumerate(lines[:2]):
        d.text((x + 4, y + CH + 30 + j * 19), ln, fill=(235, 235, 240), font=fr)
out = os.path.join(TW, "preview", "board_ep03.jpg")
B.save(out, quality=90)
print(out, B.size)
