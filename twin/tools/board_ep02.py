# Labelled storyboard board for ep02 from the saved stills (data/shots/board2_*.png) -> preview/board_ep02.jpg
# usage: python -I board_ep02.py <twin_dir>
import os, sys
from PIL import Image, ImageDraw, ImageFont

TW = sys.argv[1]
FR = [
    (0.1, "К1 · 0,1 с", "Владелец заносит банхаммер над EtoLikos"),
    (0.37, "К1 · 0,4 с", "Удар: импакт-кадр (негатив)"),
    (2.6, "К1 · 2,6 с", "«ВЫ ЗАБАНЕНЫ. Причина: просто так»"),
    (3.7, "К2 · 3,7 с", "EtoLikos летит через закат"),
    (4.3, "К2 · 4,3 с", "Приземление на спавн MoreCube, табло"),
    (5.95, "К2 · 6,0 с", "VS, «в видео спрятан код», буква M"),
    (7.6, "К3 · 7,6 с · там", "«ПРИВИЛЕГИЯ 99 999 ₽, скидка 0%»"),
    (10.9, "К3 · 10,9 с · тут", "/codes → D.HELPER, буква O, 1:0"),
    (12.35, "К4 · 12,4 с · там", "Ценники: алмаз, воздух, «постоять тут»"),
    (13.7, "К4 · 13,7 с · тут", "Перевёрнутый молоток, буква L"),
    (15.95, "К4 · 16,0 с", "Рулетка → приз, 2:0"),
    (17.65, "К5 · 17,7 с · там", "БАН за «привет»"),
    (19.75, "К5 · 19,8 с · тут", "_pogostik_: «привет!» и кейс, буква O"),
    (21.9, "К6 · 21,9 с · там", "Владелец зажрался, буква T"),
    (23.3, "К6 · 23,3 с · тут", "_pogostik_ раздаёт кейсы, 4:0"),
    (24.75, "К7 · 24,8 с", "«4 : 0», владелец один, буква O"),
    (27.95, "К8 · 28,0 с", "IP, код по буквам, буква K"),
    (29.4, "К8 · 29,4 с · петля", "Банхаммер снова летит → начало"),
]
COLS, CW = 6, 300
CH = CW * 16 // 9
LH = 74
TOP = 74
rows = (len(FR) + COLS - 1) // COLS
B = Image.new("RGB", (COLS * CW + (COLS + 1) * 10, TOP + rows * (CH + LH + 10) + 10), (18, 16, 24))
d = ImageDraw.Draw(B)
fb = ImageFont.truetype("C:/Windows/Fonts/arialbd.ttf", 20)
fr = ImageFont.truetype("C:/Windows/Fonts/arial.ttf", 17)
ft = ImageFont.truetype("C:/Windows/Fonts/arialbd.ttf", 30)
d.text((12, 18), "Ролик №2 «Рилик против MoreCube» · раскадровка · 29,7 с · EtoLikos (скин cherepaxa) · POG.MORECUBE.RU", fill=(255, 214, 90), font=ft)
for i, (t, a, b) in enumerate(FR):
    p = os.path.join(TW, "data/shots", f"board2_{t:.2f}".replace(".", "_") + ".png")
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
os.makedirs(os.path.join(TW, "preview"), exist_ok=True)
out = os.path.join(TW, "preview", "board_ep02.jpg")
B.save(out, quality=90)
print(out, B.size)
