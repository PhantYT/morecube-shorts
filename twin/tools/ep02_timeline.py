# Episode 2 timeline from the processed voiceover (assets/audio/ep02_words.json): shot cuts at phrase starts, the
# «там → тут» switch inside every round, word captions with accent colours, SFX cues (Minecraft sounds + synthesized
# rain/thunder/cash/whoosh/hits), a light original beat that drops when the hero lands on MoreCube, and the root
# index.html + compositions/ep02.html. The ep01 root is kept as index_ep01.html.
# usage: python -I ep02_timeline.py <twin_dir>
import json, os, re, shutil, subprocess, sys, wave
import numpy as np
from scipy.signal import butter, lfilter

TW = sys.argv[1]
MC = "C:/Users/Dima/AppData/Roaming/.tlauncher/legacy/Minecraft/game/assets"
SFX_DIR = os.path.join(TW, "assets", "sfx")
os.makedirs(SFX_DIR, exist_ok=True)
SR = 48000
words = json.load(open(os.path.join(TW, "assets/audio/ep02_words.json"), encoding="utf-8"))
norm = lambda t: re.sub(r"[^\wё-]", "", t.lower())

ANCHORS = [("K2", "ну"), ("K3", "донат"), ("K4", "там"), ("K5", "там"), ("K6", "владелец"), ("K7", "четыре"), ("K8", "айпи")]
cuts = {"K1": 0.0}
i = 0
NEXT = {"K4": "всё", "K5": "банят"}  # «Там всё …», «Там банят …» (not the «там» inside «Донат там»)
for sid, w in ANCHORS:
    while norm(words[i][2]) != w or (sid in NEXT and norm(words[i + 1][2]) != NEXT[sid]):
        i += 1
    cuts[sid] = max(0.0, words[i][0] - 0.06)
    i += 1
END = round(words[-1][1] + 0.62, 2)
ids = [f"K{k}" for k in range(1, 9)]
shots = []
for k, sid in enumerate(ids):
    t1 = cuts[ids[k + 1]] if k + 1 < len(ids) else END
    shots.append({"id": sid, "t0": round(cuts[sid], 3), "t1": round(t1, 3)})
T = {s["id"]: s for s in shots}


def wt(word, after=0.0, before=1e9):
    for w in words:
        if after - 0.01 <= w[0] < before and norm(w[2]).startswith(word):
            return w[0]
    return None


def tut(sid):  # «А тут» inside a round
    s = T[sid]
    for k in range(len(words) - 1):
        if s["t0"] <= words[k][0] < s["t1"] and norm(words[k][2]) == "а" and norm(words[k + 1][2]) == "тут":
            return round(words[k][0] - 0.06, 3)
    return None


marks = {
    "zabanili": wt("забанили"), "prichina": wt("причина"), "prosto": wt("просто"), "ladno": wt("ладно"), "rilik": wt("рилик", T["K2"]["t0"]),
    "tut1": tut("K3"), "tut2": tut("K4"), "tut3": tut("K5"), "tut4": tut("K6"),
    "ayfona": wt("айфона"), "besplatno": wt("бесплатно"), "kodes": wt("кодес"), "dengi": wt("деньги"), "stroish": wt("строишь"),
    "molotok": wt("молоток"), "darit": wt("дарит"), "priz": wt("приз"), "banyat": wt("банят"), "privet1": wt("привет", T["K5"]["t0"]),
    "otvechaet": wt("отвечает"), "privet2": wt("привет", T["K5"]["t0"] + 2.0), "zazhralsya": wt("зажрался"), "razdaet": wt("раздаёт"),
    "donat4": wt("донат", T["K6"]["t0"] + 1.5), "chetyre": wt("четыре"), "nol": wt("ноль"), "aypi": wt("айпи"), "ekrane": wt("экране"),
    "kod": wt("код", T["K8"]["t0"]), "bukvam": wt("буквам"), "naydesh": wt("найдёшь"),
}
marks["land"] = round(T["K2"]["t0"] + 0.95, 3)
for k, sid in enumerate(("K3", "K4", "K5", "K6")):
    marks[f"r{k + 1}"] = T[sid]["t0"]
marks["pt1"] = round(marks["kodes"] + 0.35, 3)
marks["pt2"] = round(marks["priz"] + 0.05, 3)
marks["pt3"] = round(marks["privet2"] + 0.2, 3)
marks["pt4"] = round(marks["donat4"] + 0.1, 3)

# ------------------------------------------------------------------ captions
DISPLAY = {"кодес": "/CODES", "айпи": "АЙПИ"}
COLOR = [(r"^рилик", "#FF4D4D"), (r"^бесплатн", "#5CFF6E"), (r"^/codes$", "#5CFF6E"), (r"^деньги", "#FF4D4D"), (r"^молоток", "#FFD34D"),
         (r"^перевёрнут", "#FFD34D"), (r"^приз", "#FFD34D"), (r"^банят", "#FF4D4D"), (r"^зажрался", "#FF4D4D"), (r"^донат", "#FF4FA3"),
         (r"^айфона", "#FF4D4D"), (r"^четыре", "#FFD34D"), (r"^ноль", "#FFD34D"), (r"^буквам", "#FFD34D"), (r"^найдёшь", "#FFD34D"),
         (r"^просто", "#FFFFFF"), (r"^дарит", "#5CFF6E"), (r"^раздаёт", "#5CFF6E")]
SHORT = {"на", "в", "с", "и", "а", "по", "за", "ни", "не", "что", "как", "я", "там", "тут", "сам", "всё"}


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
    cur, groups = [], []
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

# ------------------------------------------------------------------ sounds
IDX = json.load(open(f"{MC}/indexes/19.json"))["objects"]


def mc(name, dst):
    h = IDX[f"minecraft/sounds/{name}.ogg"]["hash"]
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


def tt(d):
    return np.arange(int(SR * d)) / SR


def bp(x, lo, hi, order=2):
    b, a = butter(order, [lo / (SR / 2), hi / (SR / 2)], btype="band")
    return lfilter(b, a, x)


def lp(x, f, order=2):
    b, a = butter(order, f / (SR / 2))
    return lfilter(b, a, x)


def hp(x, f, order=2):
    b, a = butter(order, f / (SR / 2), btype="high")
    return lfilter(b, a, x)


rng = np.random.default_rng(11)
SYN = {}
t = tt(0.7)
n = rng.standard_normal(len(t))
SYN["whoosh"] = wav("syn_whoosh", bp(n, 300, 3000) * np.sin(np.pi * np.clip(t / 0.7, 0, 1)) ** 2 * 1.2)
t = tt(0.9)
f = 45 + 70 * np.exp(-t * 9)
SYN["bass"] = wav("syn_bass", np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 4.0) * 0.95)
t = tt(0.6)
SYN["ding"] = wav("syn_ding", (np.sin(2 * np.pi * 1318.5 * t) * np.exp(-t * 7) + 0.6 * np.sin(2 * np.pi * 1760 * t) * np.exp(-np.clip(t - 0.11, 0, None) * 7) * (t > 0.11)) * 0.45)
# rain: band-passed noise with drops, 6 s
t = tt(6.0)
rain = bp(rng.standard_normal(len(t)), 900, 7000) * 0.35
drops = np.zeros(len(t))
for p in rng.integers(0, len(t) - 400, 900):
    drops[p:p + 300] += rng.standard_normal(300) * np.exp(-np.arange(300) / 40) * 0.5
rain += hp(drops, 1500)
rain *= np.minimum(1, t * 3) * np.minimum(1, (6.0 - t) * 3)
SYN["rain"] = wav("syn_rain", rain * 0.7)
# thunder: long low rumble with a crack
t = tt(2.6)
br = np.cumsum(rng.standard_normal(len(t)))
br = hp(br / np.abs(br).max(), 20)
crack = bp(rng.standard_normal(len(t)), 800, 6000) * np.exp(-t * 14)
SYN["thunder"] = wav("syn_thunder", (lp(br, 160) * 3.0 * np.exp(-t * 1.1) + crack * 0.6) * np.minimum(1, t * 30))
# cash register: «ka» noise click + two bell tones + coin rattle
t = tt(0.9)
bell = (np.sin(2 * np.pi * 2093 * t) + 0.5 * np.sin(2 * np.pi * 2637 * t)) * np.exp(-np.clip(t - 0.06, 0, None) * 6) * (t > 0.06)
ka = bp(rng.standard_normal(len(t)), 1500, 5000) * np.exp(-t * 60)
coins = np.zeros(len(t))
for k in range(9):
    p = int((0.12 + 0.05 * k + 0.02 * rng.random()) * SR)
    coins[p:p + 2000] += np.sin(2 * np.pi * (3000 + 900 * rng.random()) * np.arange(2000) / SR) * np.exp(-np.arange(2000) / 300) * 0.4
SYN["cash"] = wav("syn_cash", (bell * 0.35 + ka * 0.6 + coins * 0.5) * 0.8)
# swoosh down (falling hammer): rising-pitch band noise
t = tt(0.55)
sweep = np.zeros(len(t))
nn = rng.standard_normal(len(t))
for k, (lo, hi) in enumerate(((300, 1200), (600, 2400), (1200, 5000))):
    seg = slice(int(len(t) * k / 3), int(len(t) * (k + 1) / 3))
    sweep[seg] = bp(nn, lo, hi)[seg]
SYN["fall"] = wav("syn_fall", lp(sweep, 6000) * np.minimum(1, t * 4) * 1.1)
# boing (launched into the sky)
t = tt(0.5)
SYN["boing"] = wav("syn_boing", np.sin(2 * np.pi * np.cumsum(180 + 420 * t + 40 * np.sin(t * 60)) / SR) * np.exp(-t * 5) * 0.5)

S = {
    "place": [mc(f"dig/stone{k}", f"place{k}") for k in (1, 2, 3, 4)], "click": mc("random/click_stereo", "click"), "beacon": mc("block/beacon/activate", "beacon"),
    "levelup": mc("random/levelup", "levelup"), "chest": mc("block/chest/open", "chest"), "pop": mc("random/pop", "pop"), "launch": mc("fireworks/launch1", "fw_launch"),
    "blast": mc("fireworks/blast1", "fw_blast"), "large": mc("fireworks/largeblast1", "fw_large"), "twinkle": mc("fireworks/twinkle1", "fw_twinkle"),
    "bell": mc("block/bell/bell_use01", "bell"), "toast": mc("ui/toast/challenge_complete", "toast"), "orb": mc("random/orb", "orb"),
    "shimmer": mc("block/amethyst/shimmer", "shimmer"), "pling": mc("note/pling", "pling"), "explode": mc("random/explode1", "explode"),
    "anvil": mc("random/anvil_land", "anvil"), "eat": [mc(f"random/eat{k}", f"eat{k}") for k in (1, 2, 3)], "burp": mc("random/burp", "burp"),
    "yes": mc("mob/villager/yes1", "villager_yes"), "no": mc("mob/villager/no1", "villager_no"), "hurt": mc("damage/hit1", "hurt"),
    "step": [mc(f"step/stone{k}", f"stepstone{k}") for k in (1, 2, 3, 4)],
}

cues = []


def cue(time, src, vol, dur=None):
    if time is None or time < 0:
        return
    cues.append({"t": round(time, 3), "src": src, "vol": vol, "dur": dur})


M = marks
k1 = T["K1"]
cue(0.0, SYN["fall"], 0.55)
cue(0.36, S["anvil"], 0.55)
cue(0.36, SYN["bass"], 0.85)
cue(0.37, S["explode"], 0.28)
cue(0.4, SYN["thunder"], 0.55)
cue(0.5, SYN["boing"], 0.5)
cue(0.0, SYN["rain"], 0.22, T["K2"]["t0"] + 0.3)
cue(M["prichina"], S["pop"], 0.45)
cue(M["prosto"] + 0.05, S["no"], 0.35)
k2 = T["K2"]
cue(k2["t0"] - 0.05, SYN["whoosh"], 0.5)
cue(M["land"], S["place"][2], 0.9)
cue(M["land"], SYN["bass"], 0.7)
cue(M["land"] + 0.02, S["anvil"], 0.12)
cue(M["rilik"] - 0.1, SYN["whoosh"], 0.3)
cue(M["rilik"] + 0.05, S["anvil"], 0.2)
cue(k2["t0"] + 2.5, SYN["ding"], 0.3)  # letter M


def round_sfx(sid, tut_t, rw_extra, mc_extra):
    s = T[sid]
    cue(s["t0"], S["bell"], 0.3, 1.0)
    cue(s["t0"], SYN["rain"], 0.2, tut_t - s["t0"] + 0.15)
    cue(tut_t - 0.08, SYN["whoosh"], 0.42)
    for f_ in rw_extra + mc_extra:
        f_()


round_sfx("K3", M["tut1"], [lambda: cue(M["ayfona"] - 0.05, SYN["cash"], 0.55), lambda: cue(M["ayfona"] + 0.35, S["pop"], 0.3)],
          [lambda: cue(M["tut1"] + 0.35, S["chest"], 0.4), lambda: cue(M["besplatno"], S["levelup"], 0.4, 1.2), lambda: cue(M["kodes"] + 0.1, S["orb"], 0.4),
           lambda: cue(M["pt1"], S["pling"], 0.55), lambda: cue(M["tut1"] + 1.1, SYN["ding"], 0.3)])
round_sfx("K4", M["tut2"], [lambda: [cue(T["K4"]["t0"] + 0.25 + 0.22 * j, S["pop"], 0.35) for j in range(3)], lambda: cue(M["dengi"], SYN["cash"], 0.5)],
          [lambda: [cue(M["tut2"] + 0.25 + 0.22 * j, S["place"][j], 0.7) for j in range(4)], lambda: cue(M["molotok"], S["place"][3], 0.9),
           lambda: cue(M["molotok"], SYN["bass"], 0.7), lambda: cue(M["molotok"] + 0.15, S["beacon"], 0.45, 1.3),
           lambda: [cue(M["molotok"] + 0.7 + 0.08 * j, S["click"], 0.25, 0.25) for j in range(int((M["priz"] - M["molotok"] - 0.75) / 0.08))],
           lambda: cue(M["priz"], S["toast"], 0.45), lambda: cue(M["priz"] + 0.1, S["launch"], 0.4), lambda: cue(M["priz"] + 0.45, S["blast"], 0.45),
           lambda: cue(M["pt2"], S["pling"], 0.55), lambda: cue(M["tut2"] + 0.6, SYN["ding"], 0.3)])
round_sfx("K5", M["tut3"], [lambda: [cue(T["K5"]["t0"] + 0.2 + 0.07 * j, S["click"], 0.3, 0.2) for j in range(5)], lambda: cue(M["privet1"] - 0.15, SYN["fall"], 0.5),
                           lambda: cue(M["privet1"] + 0.3, S["anvil"], 0.5), lambda: cue(M["privet1"] + 0.3, SYN["bass"], 0.7), lambda: cue(M["privet1"] + 0.35, SYN["thunder"], 0.35)],
          [lambda: [cue(M["tut3"] + 0.3 + 0.07 * j, S["click"], 0.3, 0.2) for j in range(5)], lambda: cue(M["privet2"], S["yes"], 0.5), lambda: cue(M["privet2"] + 0.05, S["orb"], 0.35),
           lambda: cue(M["privet2"] + 0.35, SYN["whoosh"], 0.25), lambda: cue(M["privet2"] + 0.75, S["chest"], 0.35), lambda: cue(M["pt3"], S["pling"], 0.55),
           lambda: cue(M["tut3"] + 1.0, SYN["ding"], 0.3)])
round_sfx("K6", M["tut4"], [lambda: [cue(T["K6"]["t0"] + 0.2 + 0.28 * j, S["eat"][j % 3], 0.5) for j in range(4)], lambda: cue(M["zazhralsya"] + 0.55, S["burp"], 0.55),
                           lambda: [cue(T["K6"]["t0"] + 0.3 + 0.2 * j, S["orb"], 0.15) for j in range(5)]],
          [lambda: [cue(M["tut4"] + 0.3 + 0.25 * j, SYN["whoosh"], 0.18) for j in range(4)], lambda: cue(M["razdaet"], S["twinkle"], 0.4),
           lambda: [cue(M["tut4"] + 0.5 + 0.3 * j, S["pop"], 0.3) for j in range(4)], lambda: cue(M["pt4"], S["pling"], 0.55), lambda: cue(T["K6"]["t0"] + 0.9, SYN["ding"], 0.3)])
k7 = T["K7"]
cue(M["chetyre"] - 0.02, SYN["bass"], 0.85)
cue(M["chetyre"], S["anvil"], 0.35)
cue(M["chetyre"], S["toast"], 0.5)
cue(M["chetyre"] + 0.1, S["large"], 0.5)
cue(M["nol"], S["levelup"], 0.45, 1.2)
cue(M["nol"] + 0.2, SYN["ding"], 0.3)  # letter O
k8 = T["K8"]
cue(k8["t0"] - 0.05, SYN["whoosh"], 0.35)
cue(M["ekrane"], S["orb"], 0.35)
cue(M["kod"], S["shimmer"], 0.4)
for j in range(7):
    cue(M["kod"] + 0.3 + 0.12 * j, S["click"], 0.25, 0.2)
cue(M["bukvam"] + 0.1, SYN["ding"], 0.4)  # letter K
cue(END - 0.6, SYN["fall"], 0.5)  # loop: the ban hammer starts falling again


# ------------------------------------------------------------------ the beat (125 BPM, A minor, drops at the landing)
BPM = 125
B = 60 / BPM
total = END
x = np.zeros(int(SR * total) + SR)


def add(at, sig):
    p = int(at * SR)
    if p >= len(x):
        return
    e = min(len(x), p + len(sig))
    x[p:e] += sig[: e - p]


tk = tt(0.35)
kick = np.sin(2 * np.pi * np.cumsum(48 + 120 * np.exp(-tk * 30)) / SR) * np.exp(-tk * 8) + bp(rng.standard_normal(len(tk)), 2000, 6000) * np.exp(-tk * 400) * 0.3
tc = tt(0.3)
cn = bp(rng.standard_normal(len(tc)), 900, 4000)
clap = cn * (np.exp(-tc * 25) + 0.6 * np.exp(-np.clip(tc - 0.012, 0, None) * 120) * (tc > 0.012)) * 0.7
th = tt(0.06)
hat = hp(rng.standard_normal(len(th)), 7000) * np.exp(-th * 90) * 0.35
ROOTS = [55.0, 43.65, 65.41, 49.0]
t0b = marks["land"]
mute = (T["K7"]["t0"], T["K8"]["t0"] + 0.1)
beat_n = int((total - t0b) / B)
for k in range(beat_n):
    at = t0b + k * B
    if mute[0] - 0.05 <= at < mute[1]:
        continue
    add(at, kick)
    if k % 2 == 1:
        add(at, clap)
    for h in range(2):
        add(at + h * B / 2, hat * (1.0 if h else 0.6))
    bar = (k // 4) % 4
    f0 = ROOTS[bar]
    for h in range(2):
        tb = tt(B / 2)
        env = np.minimum(1, tb * 200) * np.exp(-tb * 5)
        add(at + h * B / 2 + 0.03, np.sin(2 * np.pi * f0 * 2 * tb) * env * 0.45 + np.sin(2 * np.pi * f0 * tb) * env * 0.5)
# «там» parts sound muffled
rw = [(T["K3"]["t0"], marks["tut1"]), (T["K4"]["t0"], marks["tut2"]), (T["K5"]["t0"], marks["tut3"]), (T["K6"]["t0"], marks["tut4"])]
muff = lp(x, 500, 4)
mask = np.zeros(len(x))
for a, b in rw:
    mask[int(a * SR):int(b * SR)] = 1
from scipy.ndimage import uniform_filter1d
mask = uniform_filter1d(mask, int(0.05 * SR))
x = x * (1 - mask) + muff * mask * 1.3
x = x / (np.abs(x).max() + 1e-9) * 0.8
beat_src = wav("ep02_beat", x[: int(SR * total)])

# ------------------------------------------------------------------ write
json.dump({"end": END, "shots": shots, "captions": caps, "marks": marks}, open(os.path.join(TW, "assets/data/ep02/timeline.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)


def dur_of(src):
    with wave.open(os.path.join(TW, src)) as f:
        return f.getnframes() / f.getframerate()


vo_dur = dur_of("assets/audio/ep02_vo.wav")
tags = []
for k, c in enumerate(sorted(cues, key=lambda c: c["t"])):
    d = c["dur"] or dur_of(c["src"])
    d = min(d, dur_of(c["src"]), END - c["t"])
    if d <= 0.02:
        continue
    tags.append(f'      <audio id="sfx{k:03d}" class="clip" src="{c["src"]}" data-start="{c["t"]:.3f}" data-duration="{d:.3f}" data-track-index="{10 + k % 6}" data-volume="{c["vol"]}" data-fade-out="0.04"></audio>')
idx = os.path.join(TW, "index.html")
if os.path.exists(idx) and 'compositions/ep01.html' in open(idx, encoding="utf-8").read():
    shutil.copy(idx, os.path.join(TW, "index_ep01.html"))
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
      <div id="ep02" data-composition-id="ep02" data-composition-src="compositions/ep02.html" data-start="0" data-duration="{END}" data-track-index="1" data-track-kind="graphics" data-width="1080" data-height="1920" style="z-index: 1"></div>
      <audio id="vo" class="clip" src="assets/audio/ep02_vo.wav" data-start="0" data-duration="{min(END, vo_dur):.2f}" data-track-index="2" data-volume="1"></audio>
      <audio id="beat" class="clip" src="{beat_src}" data-start="0" data-duration="{END:.2f}" data-track-index="3" data-volume="0.2"></audio>
{chr(10).join(tags)}
    </div>
    <script>
      window.__timelines = window.__timelines || {{}};
      window.__timelines["main"] = gsap.timeline({{ paused: true }});
    </script>
  </body>
</html>
'''
open(idx, "w", encoding="utf-8").write(html)
comp = f'''<template>
  <style>
    #root {{ position: absolute; inset: 0; overflow: hidden; background: #000; }}
    #world-canvas {{ position: absolute; left: 0; top: 0; width: 1080px; height: 1920px; display: block; }}
  </style>
  <div id="root" data-composition-id="ep02" data-start="0" data-duration="{END}" data-width="1080" data-height="1920">
    <canvas id="world-canvas" class="clip" data-start="0" data-duration="{END}" data-track-index="1"></canvas>
  </div>
  <script>
    (function () {{
      var clock = {{ t: 0 }};
      var host = {{ clock: clock, render: null }};
      window.__world = host;
      window.__hf = window.__hf || {{}};
      window.__hf.buildReady = window.__hf.buildReady || {{}};
      window.__hf.buildReady["ep02"] = new Promise(function (resolve) {{ host.ready = resolve; }});
      var tl = gsap.timeline({{ paused: true }});
      tl.to(clock, {{ t: {END}, duration: {END}, ease: "none", onUpdate: function () {{ if (host.render) host.render(clock.t); }} }});
      window.__timelines = window.__timelines || {{}};
      window.__timelines["ep02"] = tl;
    }})();
  </script>
  <script type="module" src="assets/js/ep02.js"></script>
</template>
'''
open(os.path.join(TW, "compositions/ep02.html"), "w", encoding="utf-8").write(comp)
print("END", END, "shots:", [(s["id"], s["t0"], round(s["t1"] - s["t0"], 2)) for s in shots])
print("marks", {k: v for k, v in marks.items()})
print("captions", len(caps), "cues", len(tags))
