# Episode 1 timeline from the owner's voiceover: shot cuts at phrase starts, word captions with accent colours,
# SFX cues (Minecraft sounds + synthesized whooshes/hits), the root index.html with every audio clip.
# usage: python -I ep01_timeline.py <twin_dir>
import json, os, re, sys, shutil, subprocess, wave
import numpy as np

TW = sys.argv[1]
SPEED = 1.15
MC = "C:/Users/Dima/AppData/Roaming/.tlauncher/legacy/Minecraft/game/assets"
SFX_DIR = os.path.join(TW, "assets", "sfx")
os.makedirs(SFX_DIR, exist_ok=True)
SR = 48000

# ------------------------------------------------------------------ words
raw = json.load(open(os.path.join(TW, "assets/audio/vo_words_raw.json"), encoding="utf-8"))
words = []
for s in raw:
    for w0, w1, txt, p in s["words"]:
        t = txt.strip()
        if not re.search(r"\w", t):
            continue
        if t.startswith("-") and words:  # «телеграм» + «-бота» -> one word
            words[-1][2] += t
            words[-1][1] = round(w1 / SPEED, 3)
            continue
        words.append([round(w0 / SPEED, 3), round(w1 / SPEED, 3), t])
norm = lambda t: re.sub(r"[^\wё-]", "", t.lower())
for i in range(len(words) - 1):
    if norm(words[i][2]) == "не" and norm(words[i + 1][2]).startswith("рубл"):
        words[i][2] = "ни"  # «ни рубля» is what was meant

ANCHORS = [("K2", "сразу"), ("K3", "что"), ("K4", "захожу"), ("K5", "пишу"), ("K6", "ник"), ("K7", "а"), ("K8", "телепорт"), ("K9", "три"),
           ("K10", "последний"), ("K11", "рулетка"), ("K12", "гидра"), ("K13", "а"), ("K14", "такой"), ("K15", "айпи")]
cuts = {"K1": 0.0}
i = 0
for sid, w in ANCHORS:
    while norm(words[i][2]) != w:
        i += 1
    cuts[sid] = max(0.0, words[i][0] - 0.06)
    i += 1
END = round(words[-1][1] + 0.6, 2)
ids = [f"K{k}" for k in range(1, 16)]
shots = []
for k, sid in enumerate(ids):
    t1 = cuts[ids[k + 1]] if k + 1 < len(ids) else END
    shots.append({"id": sid, "t0": round(cuts[sid], 3), "t1": round(t1, 3)})

# ------------------------------------------------------------------ captions
DISPLAY = {"моркьюб": "MORECUBE", "кодес": "/CODES", "айпи": "АЙПИ"}
COLOR = [(r"^донат", "#FF4FA3"), (r"^/codes$", "#5CFF6E"), (r"^молоток", "#FFD34D"), (r"^гидр", "#4DE1C1"), (r"^хелпер", "#FFD34D"),
         (r"^кейс", "#C77DFF"), (r"^ноль", "#FF4D6D"), (r"^подпишись", "#FF4D6D"), (r"^найди", "#FFD34D"), (r"^morecube", "#FFB13B"),
         (r"^гигантск", "#FFD34D"), (r"^рулетк", "#C77DFF"), (r"^бесплатн", "#5CFF6E"), (r"^пуст", "#FF4D6D"), (r"^сервер$", "#FFFFFF"),
         (r"^перевёрнут", "#FFD34D"), (r"^блок", "#FFD34D"), (r"^телепорт", "#5CFF6E"), (r"^рубля", "#5CFF6E"), (r"^видео", "#FFD34D")]
SHORT = {"на", "в", "с", "и", "а", "по", "за", "ни", "не", "что", "как", "мне", "тот", "мой", "два", "три", "ещё", "мир", "в"}


def disp(t):
    n = norm(t)
    base = DISPLAY.get(n, re.sub(r"[^\wё/-]", "", t)).upper()
    col = "#FFFFFF"
    for pat, c in COLOR:
        if re.search(pat, base.lower()):
            col = c
            break
    return base, col


caps = []
for sh in shots:
    ws = [w for w in words if sh["t0"] - 0.01 <= w[0] < sh["t1"]]
    cur = []
    groups = []
    for w in ws:
        cur.append(w)
        letters = sum(len(norm(x[2])) for x in cur)
        punct = bool(re.search(r"[.,!?:…]$", w[2]))
        short_tail = norm(w[2]) in SHORT and not punct
        if not short_tail and (len(cur) >= 2 or letters >= 8 or punct):
            groups.append(cur)
            cur = []
    if cur:
        groups.append(cur)
    for g in groups:
        caps.append({"t0": round(max(0.0, g[0][0] - 0.03), 3), "end": g[-1][1], "words": [list(disp(x[2])) for x in g]})
for k, c in enumerate(caps):
    nxt = caps[k + 1]["t0"] if k + 1 < len(caps) else END
    c["t1"] = round(nxt if nxt - c["end"] < 0.45 else c["end"] + 0.25, 3)
    del c["end"]
for c in caps:
    for w in c["words"]:
        w[0] = w[0] + " "
    c["words"][-1][0] = c["words"][-1][0].rstrip()

# key word times for the animation (scaled)
def wt(word, after=0.0):
    for w in words:
        if w[0] >= after - 0.01 and norm(w[2]).startswith(word):
            return w[0]
    return None
marks = {"podpishis": wt("подпишись"), "aypi": wt("айпи"), "naydi": wt("найди"), "gidra": wt("гидра"), "tri": wt("три"), "dva": wt("два"),
         "posledniy": wt("последний"), "vypadaet": wt("выпадает", cuts["K11"]), "inventar": wt("инвентарь"), "kod_pog": wt("коду"),
         "helper": wt("хелпер"), "besplatnyy": wt("бесплатный"), "stroyu": wt("строю", cuts["K8"]), "ruletka": wt("рулетка", cuts["K2"]),
         "vletaet": wt("влетает"), "gigant": wt("гигантский"), "vzryv": wt("взрывается"), "kejs7": wt("кейс", cuts["K7"])}

# ------------------------------------------------------------------ sounds
def mc(name, dst):
    idx = json.load(open(f"{MC}/indexes/19.json"))["objects"]
    h = idx[f"minecraft/sounds/{name}.ogg"]["hash"]
    out = os.path.join(SFX_DIR, dst + ".wav")
    if not os.path.exists(out):
        subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", f"{MC}/objects/{h[:2]}/{h}", "-ar", str(SR), "-ac", "2", out], check=True)
    return "assets/sfx/" + dst + ".wav"


def wav(name, x):
    x = np.clip(x, -1, 1)
    st = np.stack([x, x], 1) if x.ndim == 1 else x
    p = os.path.join(SFX_DIR, name + ".wav")
    with wave.open(p, "wb") as f:
        f.setnchannels(2)
        f.setsampwidth(2)
        f.setframerate(SR)
        f.writeframes((st * 32767).astype(np.int16).tobytes())
    return "assets/sfx/" + name + ".wav"


rng = np.random.default_rng(7)
def tt(d):
    return np.arange(int(SR * d)) / SR


def lowpass(x, a):
    y = np.zeros_like(x)
    acc = 0.0
    for i in range(len(x)):
        acc += a * (x[i] - acc)
        y[i] = acc
    return y


def onepole(x, a):
    from scipy.signal import lfilter
    return lfilter([a], [1, -(1 - a)], x)


SYN = {}
t = tt(0.7)
n = rng.standard_normal(len(t))
env = np.sin(np.pi * np.clip(t / 0.7, 0, 1)) ** 2
SYN["whoosh"] = wav("syn_whoosh", (onepole(n, 0.08) - onepole(n, 0.01)) * env * 1.6)
t = tt(0.9)
f = 45 + 70 * np.exp(-t * 9)
SYN["bass"] = wav("syn_bass", np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 4.0) * 0.95)
t = tt(0.4)
saw = ((np.cumsum(600 * (1 - t / 0.4) ** 2 + 80) / SR) % 1.0) * 2 - 1
SYN["scratch"] = wav("syn_scratch", (saw * 0.5 + onepole(rng.standard_normal(len(t)), 0.3) * 0.4) * np.exp(-t * 3) * 0.8)
t = tt(1.3)
chirp = np.sin(2 * np.pi * np.cumsum(1800 + 900 * np.sin(t * 34)) / SR) * 0.18
SYN["rewind"] = wav("syn_rewind", (chirp + onepole(rng.standard_normal(len(t)), 0.25) * 0.25) * np.minimum(1, t * 6) * np.minimum(1, (1.3 - t) * 4))
t = tt(0.45)
thump = lambda d: np.sin(2 * np.pi * 55 * tt(0.45)) * np.exp(-np.clip(tt(0.45) - d, 0, None) * 18) * (tt(0.45) >= d)
SYN["heart"] = wav("syn_heart", (thump(0.0) + 0.7 * thump(0.16)) * 0.9)
t = tt(2.8)
brown = np.cumsum(rng.standard_normal(len(t)))
brown = brown - onepole(brown, 0.0005)
brown /= np.abs(brown).max()
SYN["rumble"] = wav("syn_rumble", onepole(brown, 0.02) * 3.2 * np.minimum(1, t * 3) * np.minimum(1, (2.8 - t) * 1.5))
t = tt(0.6)
SYN["ding"] = wav("syn_ding", (np.sin(2 * np.pi * 1318.5 * t) * np.exp(-t * 7) + 0.6 * np.sin(2 * np.pi * 1760 * t) * np.exp(-np.clip(t - 0.11, 0, None) * 7) * (t > 0.11)) * 0.45)

S = {
    "place": [mc(f"dig/stone{k}", f"place{k}") for k in (1, 2, 3, 4)], "click": mc("random/click_stereo", "click"), "beacon": mc("block/beacon/activate", "beacon"),
    "levelup": mc("random/levelup", "levelup"), "chest": mc("block/chest/open", "chest"), "pop": mc("random/pop", "pop"), "launch": mc("fireworks/launch1", "fw_launch"),
    "blast": mc("fireworks/blast1", "fw_blast"), "large": mc("fireworks/largeblast1", "fw_large"), "twinkle": mc("fireworks/twinkle1", "fw_twinkle"),
    "portal": mc("portal/trigger", "portal"), "bell": mc("block/bell/bell_use01", "bell"), "toast": mc("ui/toast/challenge_complete", "toast"),
    "orb": mc("random/orb", "orb"), "step": [mc(f"step/grass{k}", f"step{k}") for k in (1, 2, 3, 4)], "tp": mc("mob/endermen/portal", "tp"),
    "shimmer": mc("block/amethyst/shimmer", "shimmer"), "pling": mc("note/pling", "pling"), "explode": mc("random/explode1", "explode"),
    "anvil": mc("random/anvil_land", "anvil"),
}

cues = []
def cue(time, src, vol, dur=None, media=None):
    if time is None or time < 0:
        return
    cues.append({"t": round(time, 3), "src": src, "vol": vol, "dur": dur, "media": media})

T = {s["id"]: s for s in shots}
k1, k2 = T["K1"], T["K2"]
cue(k1["t0"], SYN["whoosh"], 0.45, 0.7)
cue(k1["t0"] + 0.3, S["place"][0], 0.9)
cue(k1["t0"] + 0.3, SYN["bass"], 0.75, 0.9)
cue(k1["t0"] + 0.31, S["anvil"], 0.18, 0.8)
cue(k1["t0"] + 0.45, S["shimmer"], 0.3)
cue(k2["t0"] + 0.02, S["beacon"], 0.55, 1.6)
cue(k2["t0"] + 0.85, S["levelup"], 0.45, 1.4)
rt0, rt1 = k2["t0"] + 1.25, k2["t1"] - 0.3
x = rt0
while x < rt1:
    cue(x, S["click"], 0.28, 0.25)
    x += 0.085
cue(k2["t1"] - 0.3, SYN["scratch"], 0.6, 0.4)
cue(T["K3"]["t0"], SYN["rewind"], 0.55, 1.3)
k4 = T["K4"]
cue(k4["t0"], SYN["whoosh"], 0.35, 0.7)
for j in range(5):
    cue(k4["t0"] + 1.75 + j * 0.3, S["step"][j % 4], 0.3)
cue(k4["t0"] + 3.05, S["pling"], 0.35)
k5 = T["K5"]
for j in range(3):
    cue(k5["t0"] + j * 0.08, S["click"], 0.3, 0.25)
cue(k5["t0"] + 0.32, S["chest"], 0.5)
cue(k5["t0"] + 1.0, S["click"], 0.5, 0.25)
cue(k5["t0"] + 1.05, S["pop"], 0.3)
k6 = T["K6"]
cue(k6["t0"] + 0.2, SYN["ding"], 0.5, 0.6)
cue(k6["t0"] + 0.75, SYN["ding"], 0.45, 0.6)
cue(k6["t0"] + 1.25, S["levelup"], 0.5, 1.4)
cue(k6["t0"] + 1.25, S["orb"], 0.35)
k7 = T["K7"]
cue(k7["t0"] + 0.35, S["click"], 0.5, 0.25)
cue(k7["t0"] + 0.6, S["pop"], 0.5)
cue(k7["t0"] + 0.8, S["pop"], 0.45)
cue(k7["t0"] + 1.15, S["chest"], 0.35)
k8 = T["K8"]
x = k8["t0"]
j = 0
while x < k8["t1"] - 0.5:
    cue(x, S["step"][j % 4], 0.28)
    x += 0.26
    j += 1
cue(k8["t1"] - 0.9, S["portal"], 0.3, 0.9)
cue(k8["t1"] - 0.15, S["tp"], 0.5)
k9 = T["K9"]
for j, dt in enumerate((0.25, 0.55, 0.85)):
    cue(k9["t0"] + dt, S["place"][j], 0.7)
cue((marks["dva"] or k9["t0"] + 1.5) + 0.1, S["place"][3], 0.7)
cue((marks["dva"] or k9["t0"] + 1.5) + 0.25, S["shimmer"], 0.25)
k10 = T["K10"]
cue(k10["t0"] + 0.05, SYN["whoosh"], 0.4, 0.7)
cue(k10["t0"] + 1.1, S["place"][1], 0.85)
cue(k10["t0"] + 1.1, SYN["bass"], 0.7, 0.9)
cue(k10["t0"] + 1.12, S["anvil"], 0.15, 0.8)
cue(k10["t0"] + 1.35, S["beacon"], 0.45, 1.5)
k11 = T["K11"]
x, gap = k11["t0"], 0.07
while x < k11["t1"] - 0.15:
    cue(x, S["click"], 0.3, 0.25)
    x += gap
    gap *= 1.09
for j in range(int((k11["t1"] - k11["t0"]) / 0.55)):
    cue(k11["t0"] + j * 0.55, SYN["heart"], 0.5, 0.45)
k12 = T["K12"]
cue(k12["t0"], S["toast"], 0.45)
cue(k12["t0"], S["levelup"], 0.55, 1.4)
cue(k12["t0"] + 0.15, S["launch"], 0.45)
cue(k12["t0"] + 0.6, S["blast"], 0.55)
cue(k12["t0"] + 0.95, S["twinkle"], 0.4)
cue(k12["t0"] + 0.55, S["launch"], 0.4)
cue(k12["t0"] + 1.1, S["blast"], 0.5)
cue(k12["t0"] + 1.6, S["large"], 0.5)
k13 = T["K13"]
cue(k13["t0"], SYN["rumble"], 0.7, 2.8)
cue(k13["t0"] + 0.15, S["explode"], 0.3)
cue(k13["t0"] + 0.4, S["large"], 0.35)
rr = np.random.default_rng(3)
for j in range(9):
    cue(k13["t0"] + 0.4 + rr.random() * (k13["t1"] - k13["t0"] - 0.6), S["pop"], 0.22)
k14 = T["K14"]
cue((marks["podpishis"] or k14["t0"] + 1.5) + 0.05, S["pop"], 0.6)
cue((marks["podpishis"] or k14["t0"] + 1.5) + 0.12, S["bell"], 0.4, 1.5)
k15 = T["K15"]
cue(k15["t0"], SYN["whoosh"], 0.3, 0.7)
cue((marks["aypi"] or k15["t0"]) + 0.1, S["orb"], 0.35)
cue((marks["naydi"] or k15["t1"] - 0.8), S["shimmer"], 0.4)

# ------------------------------------------------------------------ write
json.dump({"end": END, "shots": shots, "captions": caps, "marks": marks, "speed": SPEED}, open(os.path.join(TW, "assets/data/ep01/timeline.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)


def dur_of(src):
    with wave.open(os.path.join(TW, src)) as f:
        return f.getnframes() / f.getframerate()


tags = []
for k, c in enumerate(sorted(cues, key=lambda c: c["t"])):
    d = c["dur"] or dur_of(c["src"])
    d = min(d, dur_of(c["src"]), END - c["t"])
    if d <= 0.02:
        continue
    tags.append(f'      <audio id="sfx{k:03d}" class="clip" src="{c["src"]}" data-start="{c["t"]:.3f}" data-duration="{d:.3f}" data-track-index="{10 + k % 6}" data-volume="{c["vol"]}" data-fade-out="0.04"></audio>')
html = f'''<!doctype html>
<html lang="ru">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=1080, height=1920" />
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
    <style>
      * {{ margin: 0; padding: 0; box-sizing: border-box; }}
      html, body {{ margin: 0; width: 1080px; height: 1920px; overflow: hidden; background: #000; }}
      #root {{ position: relative; width: 100%; height: 100%; background: #000; }}
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="{END}" data-width="1080" data-height="1920">
      <div id="ep01" data-composition-id="ep01" data-composition-src="compositions/ep01.html" data-start="0" data-duration="{END}" data-track-index="1" data-track-kind="graphics" data-width="1080" data-height="1920" style="z-index: 1"></div>
      <audio id="vo" class="clip" src="assets/audio/vo.wav" data-start="0" data-duration="{min(END, 40.40):.2f}" data-track-index="2" data-volume="1"></audio>
{chr(10).join(tags)}
    </div>
    <script>
      window.__timelines = window.__timelines || {{}};
      window.__timelines["main"] = gsap.timeline({{ paused: true }});
    </script>
  </body>
</html>
'''
open(os.path.join(TW, "index.html"), "w", encoding="utf-8").write(html)
comp = f'''<template>
  <style>
    #root {{ position: absolute; inset: 0; overflow: hidden; background: #000; }}
    #world-canvas {{ position: absolute; left: 0; top: 0; width: 1080px; height: 1920px; display: block; }}
  </style>
  <div id="root" data-composition-id="ep01" data-start="0" data-duration="{END}" data-width="1080" data-height="1920">
    <canvas id="world-canvas" class="clip" data-start="0" data-duration="{END}" data-track-index="1"></canvas>
  </div>
  <script>
    (function () {{
      var clock = {{ t: 0 }};
      var host = {{ clock: clock, render: null }};
      window.__world = host;
      window.__hf = window.__hf || {{}};
      window.__hf.buildReady = window.__hf.buildReady || {{}};
      window.__hf.buildReady["ep01"] = new Promise(function (resolve) {{ host.ready = resolve; }});
      var tl = gsap.timeline({{ paused: true }});
      tl.to(clock, {{ t: {END}, duration: {END}, ease: "none", onUpdate: function () {{ if (host.render) host.render(clock.t); }} }});
      window.__timelines = window.__timelines || {{}};
      window.__timelines["ep01"] = tl;
    }})();
  </script>
  <script type="module" src="assets/js/ep01.js"></script>
</template>
'''
open(os.path.join(TW, "compositions/ep01.html"), "w", encoding="utf-8").write(comp)
print("END", END, "shots:", [(s["id"], s["t0"], round(s["t1"] - s["t0"], 2)) for s in shots])
print("captions", len(caps), "cues", len(tags))
for c in caps[:40]:
    print(c["t0"], c["t1"], "".join(w[0] for w in c["words"]))
