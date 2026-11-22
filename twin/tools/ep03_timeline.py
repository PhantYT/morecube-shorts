# Episode 3 timeline from the processed voiceover (assets/audio/ep03_words.json): shot cuts at phrase starts, gag
# marks tied to words, word captions with accent colours, SFX cues (Minecraft sounds + synthesized whoosh/bass/cash/
# wind/glitch/rain/thunder), an original 125 BPM beat (muffled on the copies and on рилик, full when EtoLikos lands on
# MoreCube) and the root index.html + compositions/ep03.html. The ep02 root is kept as index_ep02.html.
# usage: python -I ep03_timeline.py <twin_dir>
import json, os, re, shutil, subprocess, sys, wave
import numpy as np
from scipy.signal import butter, lfilter
from scipy.ndimage import uniform_filter1d

TW = sys.argv[1]
MC = "C:/Users/Dima/AppData/Roaming/.tlauncher/legacy/Minecraft/game/assets"
SFX_DIR = os.path.join(TW, "assets", "sfx")
os.makedirs(SFX_DIR, exist_ok=True)
SR = 48000
words = json.load(open(os.path.join(TW, "assets/audio/ep03_words.json"), encoding="utf-8"))
norm = lambda t: re.sub(r"[^\w-]", "", t.lower().replace("ё", "е"))

# ------------------------------------------------------------------ shots
ANCHORS = [("K2", ["копия"]), ("K3", ["вторая"]), ("K4", ["в", "третьей"]), ("K5", ["а", "четвертая"]), ("K6", ["рилик"]),
           ("K7", ["а", "на", "morecube"]), ("K8", ["заходи"])]
cuts = {"K1": 0.0}
i = 1
for sid, seq in ANCHORS:
    while [norm(w[2]) for w in words[i:i + len(seq)]] != seq:
        i += 1
    cuts[sid] = round(max(0.0, words[i][0] - 0.06), 3)
    i += len(seq)


def wt(word, after=0.0):
    for w in words:
        if w[0] >= after - 0.01 and norm(w[2]).startswith(word):
            return w[0]
    raise SystemExit("word not found: " + word)


vo_end = words[-1][1]
ids = [f"K{k}" for k in range(1, 9)]
M = {}
M["click1"] = round(wt("код") , 3)                                   # «В конце — код на донат»: EtoLikos picks copy #1
M["tab"] = round(wt("онлайн", cuts["K2"]) - 0.1, 3)                  # tab list with its two players
M["rubber"] = round(wt("сих", cuts["K3"]), 3)                        # «…до сих пор иду до спавна»
M["jump1"] = round(wt("донат", cuts["K4"]) - 0.05, 3)
M["jump2"] = round(wt("прыжок", cuts["K4"]) - 0.05, 3)
M["buy"] = round(wt("закрылась", cuts["K5"]) + 0.3, 3)              # bought during the «…» pause
M["crash"] = round(wt("после", cuts["K5"]) - 0.05, 3)               # «…прямо после моего доната»
M["hit"] = round(wt("просто", cuts["K6"]) - 0.05, 3)                # the hammer lands on «просто», ban text on «забанят»
M["click5"] = round(wt("morecube", cuts["K7"]) + 0.1, 3)
M["k7land"] = round(wt("ивенты", cuts["K7"]) - 0.1, 3)
M["owners"] = round(wt("владельцы", cuts["K7"]), 3)
M["free"] = round(wt("бесплатно", cuts["K7"]), 3)
M["type0"] = round(wt("заходи", cuts["K8"]) + 0.25, 3)
M["code"] = round(wt("код", cuts["K8"]), 3)
M["reward"] = round(wt("донат", M["code"]), 3)
M["how"] = round(max(M["reward"] + 0.9, vo_end + 0.12), 3)
END = round(M["how"] + 2.4, 2)
shots = []
for k, sid in enumerate(ids):
    t1 = cuts[ids[k + 1]] if k + 1 < len(ids) else END
    shots.append({"id": sid, "t0": cuts[sid], "t1": round(t1, 3)})
T = {s["id"]: s for s in shots}

# ------------------------------------------------------------------ captions
DISPLAY = {"подарок": "PODAROK", "morecube": "MORECUBE", "айпи": "АЙПИ"}
COLOR = [(r"^рилик", "#FF4D4D"), (r"^копи", "#FFD34D"), (r"^донат", "#FF4FA3"), (r"^бесплатно", "#5CFF6E"), (r"^podarok", "#5CFF6E"),
         (r"^morecube", "#FFC83D"), (r"^забанят", "#FF4D4D"), (r"^закрылась", "#FF4D4D"), (r"^два", "#FFD34D"), (r"^спит", "#B9C2CF"),
         (r"^лагает", "#9BE15D"), (r"^прыжок", "#FFD34D"), (r"^ивенты", "#FFD34D"), (r"^владельцы", "#FFC83D"), (r"^айпи", "#FFC83D"),
         (r"^код", "#5CFF6E"), (r"^не$", "#FF4D4D"), (r"^заходи", "#FFFFFF")]
SHORT = {"на", "в", "с", "и", "а", "по", "за", "не", "что", "я", "там", "до", "код"}


# hand-made caption groups for this take (word counts); used when they add up to the word count, else automatic
GROUPS = [2, 3, 3, 2, 3, 2, 1, 2, 3, 2, 2, 3, 3, 3, 2, 2, 2, 2, 1, 2, 2, 1, 2, 2, 3, 1, 1, 3, 2, 1, 1, 2, 3, 2, 1, 3]


def disp(t):
    n = norm(t)
    base = DISPLAY.get(n, re.sub(r"[^\w/?…-]", "", t)).upper()
    col = "#FFFFFF"
    for pat, c in COLOR:
        if re.search(pat, base.lower()):
            col = c
            break
    return base, col


caps = []
if sum(GROUPS) == len(words):
    k = 0
    for g in GROUPS:
        ws = words[k:k + g]
        k += g
        caps.append({"t0": round(max(0.0, ws[0][0] - 0.03), 3), "end": ws[-1][1], "words": [list(disp(x[2])) for x in ws]})
    shots_for_auto = []
else:
    print("caption groups do not match the take; automatic grouping")
    shots_for_auto = shots
for sh in shots_for_auto:
    ws = [w for w in words if sh["t0"] - 0.01 <= w[0] < sh["t1"]]
    cur, groups = [], []
    for w in ws:
        cur.append(w)
        letters = sum(len(norm(x[2])) for x in cur)
        punct = bool(re.search(r"[.,!?:…»]$", w[2]))
        short_tail = norm(w[2]) in SHORT and not punct
        if not short_tail and (len(cur) >= 2 or letters >= 8 or punct):
            groups.append(cur)
            cur = []
    if cur:
        groups.append(cur)
    for g in groups:
        caps.append({"t0": round(max(0.0, g[0][0] - 0.03), 3), "end": g[-1][1], "words": [list(disp(x[2])) for x in g]})
for k, c in enumerate(caps):
    nxt = caps[k + 1]["t0"] if k + 1 < len(caps) else M["how"]
    c["t1"] = round(min(nxt if nxt - c["end"] < 0.45 else c["end"] + 0.25, M["how"]), 3)
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


rng = np.random.default_rng(31)
SYN = {}
t = tt(0.7)
SYN["whoosh"] = wav("syn_whoosh", bp(rng.standard_normal(len(t)), 300, 3000) * np.sin(np.pi * np.clip(t / 0.7, 0, 1)) ** 2 * 1.2)
t = tt(0.9)
SYN["bass"] = wav("syn_bass", np.sin(2 * np.pi * np.cumsum(45 + 70 * np.exp(-t * 9)) / SR) * np.exp(-t * 4.0) * 0.95)
t = tt(0.6)
SYN["ding"] = wav("syn_ding", (np.sin(2 * np.pi * 1318.5 * t) * np.exp(-t * 7) + 0.6 * np.sin(2 * np.pi * 1760 * t) * np.exp(-np.clip(t - 0.11, 0, None) * 7) * (t > 0.11)) * 0.45)
# empty-server wind: slow-swelling low band noise
t = tt(4.5)
wind = bp(rng.standard_normal(len(t)), 150, 900) * (0.55 + 0.45 * np.sin(2 * np.pi * 0.35 * t + 1.0)) * np.minimum(1, t * 2) * np.minimum(1, (4.5 - t) * 2)
SYN["wind"] = wav("syn_wind", wind * 0.9)
# lag glitch: bit-crushed noise + square blip
t = tt(0.12)
blip = np.sign(np.sin(2 * np.pi * 620 * t)) * 0.25 + np.round(rng.standard_normal(len(t)) * 3) / 3 * 0.25
SYN["glitch"] = wav("syn_glitch", blip * np.exp(-t * 18))
# cash register
t = tt(0.9)
bell = (np.sin(2 * np.pi * 2093 * t) + 0.5 * np.sin(2 * np.pi * 2637 * t)) * np.exp(-np.clip(t - 0.06, 0, None) * 6) * (t > 0.06)
ka = bp(rng.standard_normal(len(t)), 1500, 5000) * np.exp(-t * 60)
coins = np.zeros(len(t))
for k in range(9):
    p = int((0.12 + 0.05 * k + 0.02 * rng.random()) * SR)
    coins[p:p + 2000] += np.sin(2 * np.pi * (3000 + 900 * rng.random()) * np.arange(2000) / SR) * np.exp(-np.arange(2000) / 300) * 0.4
SYN["cash"] = wav("syn_cash", (bell * 0.35 + ka * 0.6 + coins * 0.5) * 0.8)
# rain (6 s) and thunder for рилик
t = tt(6.0)
rain = bp(rng.standard_normal(len(t)), 900, 7000) * 0.35
drops = np.zeros(len(t))
for p in rng.integers(0, len(t) - 400, 900):
    drops[p:p + 300] += rng.standard_normal(300) * np.exp(-np.arange(300) / 40) * 0.5
rain = (rain + hp(drops, 1500)) * np.minimum(1, t * 3) * np.minimum(1, (6.0 - t) * 3)
SYN["rain"] = wav("syn_rain", rain * 0.7)
t = tt(2.6)
br = np.cumsum(rng.standard_normal(len(t)))
br = hp(br / np.abs(br).max(), 20)
crack = bp(rng.standard_normal(len(t)), 800, 6000) * np.exp(-t * 14)
SYN["thunder"] = wav("syn_thunder", (lp(br, 160) * 3.0 * np.exp(-t * 1.1) + crack * 0.6) * np.minimum(1, t * 30))
# falling swoosh (the hammer)
t = tt(0.55)
sweep = np.zeros(len(t))
nn = rng.standard_normal(len(t))
for k, (lo, hi) in enumerate(((300, 1200), (600, 2400), (1200, 5000))):
    seg = slice(int(len(t) * k / 3), int(len(t) * (k + 1) / 3))
    sweep[seg] = bp(nn, lo, hi)[seg]
SYN["fall"] = wav("syn_fall", lp(sweep, 6000) * np.minimum(1, t * 4) * 1.1)
# the world crumbling: long low rumble with grit
t = tt(1.8)
rum = lp(np.cumsum(rng.standard_normal(len(t))) / 300, 120) * 2.5 + bp(rng.standard_normal(len(t)), 200, 1200) * 0.25
SYN["rumble"] = wav("syn_rumble", rum * np.exp(-t * 1.2) * np.minimum(1, t * 20))

S = {
    "click": mc("random/click_stereo", "click"), "pop": mc("random/pop", "pop"), "anvil": mc("random/anvil_land", "anvil"),
    "explode": mc("random/explode1", "explode"), "levelup": mc("random/levelup", "levelup"), "chest": mc("block/chest/open", "chest"),
    "orb": mc("random/orb", "orb"), "shimmer": mc("block/amethyst/shimmer", "shimmer"), "pling": mc("note/pling", "pling"),
    "toast": mc("ui/toast/challenge_complete", "toast"), "launch": mc("fireworks/launch1", "fw_launch"), "blast": mc("fireworks/blast1", "fw_blast"),
    "large": mc("fireworks/largeblast1", "fw_large"), "twinkle": mc("fireworks/twinkle1", "fw_twinkle"), "no": mc("mob/villager/no1", "villager_no"),
    "yes": mc("mob/villager/yes1", "villager_yes"), "hmm": mc("mob/villager/idle1", "villager_idle"), "glass": mc("random/glass1", "glass"),
    "portal": mc("mob/endermen/portal", "ender_portal"), "snore": [mc(f"mob/fox/sleep{k}", f"fox_sleep{k}") for k in (1, 2, 3)],
    "grass": [mc(f"step/grass{k}", f"stepgrass{k}") for k in (1, 2)], "stone": [mc(f"dig/stone{k}", f"place{k}") for k in (1, 2, 3, 4)],
    "door": mc("random/door_close", "door_close"),
}
cues = []


def cue(time, src, vol, dur=None):
    if time is None or time < 0:
        return
    cues.append({"t": round(time, 3), "src": src, "vol": vol, "dur": dur})


# K1: the stamp slams on the server list, EtoLikos picks copy #1, the camera dives in
cue(0.0, SYN["whoosh"], 0.35)
cue(0.2, S["anvil"], 0.32)
cue(0.2, SYN["bass"], 0.75)
cue(0.22, S["pop"], 0.3)
cue(M["click1"], S["click"], 0.55)
cue(M["click1"] + 0.06, SYN["whoosh"], 0.45)
cue(T["K2"]["t0"] - 0.25, S["portal"], 0.18)
# K2: copy #1 — wind, «привет?», tab list, the admin snoring, a tumbleweed
k2 = T["K2"]
cue(k2["t0"], SYN["wind"], 0.45, k2["t1"] - k2["t0"] + 0.1)
cue(k2["t0"] + 0.27, S["pop"], 0.3)
cue(M["tab"], S["click"], 0.4)
cue(M["tab"] + 0.03, S["pop"], 0.25)
cue(k2["t0"] + 0.9, S["snore"][0], 0.55)
cue(k2["t0"] + 2.6, S["snore"][1], 0.55)
for j in range(4):
    cue(k2["t0"] + 0.5 + 0.45 * j, S["grass"][j % 2], 0.16)
# K3: copy #2 — lag stutter, TPS/PING pop, rubber-band teleport back
k3 = T["K3"]
cue(k3["t0"] - 0.05, SYN["whoosh"], 0.35)
cue(k3["t0"] + 0.3, S["pop"], 0.3)
cue(k3["t0"] + 0.55, S["pop"], 0.3)
for j in range(int((k3["t1"] - k3["t0"] - 0.3) / 0.3125)):
    cue(k3["t0"] + 0.3 + 0.3125 * j, SYN["glitch"], 0.22)
cue(M["rubber"], S["portal"], 0.45)
cue(M["rubber"], SYN["glitch"], 0.45)
# K4: copy #3 — price tags pop, every jump costs 10 ₽
k4 = T["K4"]
cue(k4["t0"] - 0.05, SYN["whoosh"], 0.35)
cue(k4["t0"] + 0.2, S["pop"], 0.32)
cue(k4["t0"] + 0.4, S["pop"], 0.32)
for j in ("jump1", "jump2"):
    cue(M[j], S["grass"][0], 0.4)
    cue(M[j] + 0.3, SYN["cash"], 0.5)
# K5: copy #4 — the shop, the purchase, the world crumbles, «Соединение потеряно»
k5 = T["K5"]
cue(k5["t0"] - 0.05, SYN["whoosh"], 0.35)
cue(k5["t0"] + 0.05, S["chest"], 0.35)
cue(M["buy"] - 0.02, S["click"], 0.55)
cue(M["buy"] + 0.05, SYN["cash"], 0.5)
cue(M["buy"] + 0.12, S["levelup"], 0.35)
cue(M["crash"], S["explode"], 0.5)
cue(M["crash"], SYN["bass"], 0.9)
cue(M["crash"] + 0.02, SYN["rumble"], 0.7)
cue(M["crash"] + 0.05, S["glass"], 0.35)
for j in range(5):
    cue(M["crash"] + 0.12 + 0.13 * j, S["stone"][j % 4], 0.45)
cue(M["crash"] + 0.6, S["door"], 0.4)
cue(M["crash"] + 0.75, S["no"], 0.4)
# K6: рилик — rain and thunder, the hammer falls, «ВЫ ЗАБАНЕНЫ»
k6 = T["K6"]
cue(k6["t0"], SYN["rain"], 0.25, k6["t1"] - k6["t0"] + 0.1)
cue(k6["t0"] + 0.05, SYN["thunder"], 0.3)
cue(M["hit"] - 0.45, SYN["fall"], 0.55)
cue(M["hit"], S["anvil"], 0.6)
cue(M["hit"], SYN["bass"], 0.9)
cue(M["hit"] + 0.01, S["explode"], 0.3)
cue(M["hit"] + 0.05, SYN["thunder"], 0.5)
cue(M["hit"] + 0.22, S["no"], 0.5)
# K7: MoreCube — click, dive, landing on a full spawn, fireworks, the owner waves, «донат бесплатно»
k7 = T["K7"]
cue(k7["t0"] - 0.05, SYN["whoosh"], 0.3)
cue(M["click5"], S["click"], 0.55)
cue(M["click5"] + 0.06, SYN["whoosh"], 0.45)
cue(M["k7land"], SYN["bass"], 0.75)
cue(M["k7land"], S["stone"][2], 0.7)
cue(M["k7land"] + 0.03, S["levelup"], 0.45)
cue(M["k7land"] + 0.05, S["toast"], 0.4)
for j in range(4):
    cue(M["k7land"] + 0.3 + 0.3 * j - 0.45, S["launch"], 0.3)
    cue(M["k7land"] + 0.3 + 0.3 * j, S["large"] if j % 2 else S["blast"], 0.35)
    cue(M["k7land"] + 0.55 + 0.3 * j, S["twinkle"], 0.22)
cue(M["owners"], S["pling"], 0.45)
cue(M["owners"] + 0.05, S["yes"], 0.35)
cue(M["free"], S["orb"], 0.4)
cue(M["free"] + 0.1, SYN["ding"], 0.3)
# K8: how to join — dialog, typing the address, /code PODAROK, the case, the «КАК ЗАЙТИ» card
k8 = T["K8"]
cue(k8["t0"] - 0.05, SYN["whoosh"], 0.35)
cue(M["type0"] - 0.15, S["click"], 0.4)
for j in range(15):
    cue(M["type0"] + 0.085 * j, S["click"], 0.16, 0.12)
cue(M["type0"] + 0.085 * 15 + 0.05, S["pling"], 0.4)
cue(M["code"] - 0.3, S["click"], 0.35)
cue(M["code"], S["shimmer"], 0.45)
cue(M["code"] + 0.05, S["orb"], 0.35)
cue(M["reward"], S["chest"], 0.5)
cue(M["reward"] + 0.05, S["levelup"], 0.45)
cue(M["reward"] + 0.08, S["toast"], 0.45)
for j in range(3):
    cue(M["reward"] + 0.1 + 0.3 * j - 0.45, S["launch"], 0.28)
    cue(M["reward"] + 0.1 + 0.3 * j, S["blast"], 0.32)
cue(M["how"] - 0.05, SYN["whoosh"], 0.4)
for j in range(3):
    cue(M["how"] + 0.45 * j + 0.1, SYN["ding"], 0.32)

# ------------------------------------------------------------------ the beat (125 BPM, A minor)
BPM = 125
B = 60 / BPM
x = np.zeros(int(SR * END) + SR)


def add(at, sig):
    p = int(at * SR)
    if p >= len(x):
        return
    e = min(len(x), p + len(sig))
    x[p:e] += sig[: e - p]


tk = tt(0.35)
kick = np.sin(2 * np.pi * np.cumsum(48 + 120 * np.exp(-tk * 30)) / SR) * np.exp(-tk * 8) + bp(rng.standard_normal(len(tk)), 2000, 6000) * np.exp(-tk * 400) * 0.3
tc = tt(0.3)
clap = bp(rng.standard_normal(len(tc)), 900, 4000) * (np.exp(-tc * 25) + 0.6 * np.exp(-np.clip(tc - 0.012, 0, None) * 120) * (tc > 0.012)) * 0.7
th = tt(0.06)
hat = hp(rng.standard_normal(len(th)), 7000) * np.exp(-th * 90) * 0.35
ROOTS = [55.0, 43.65, 65.41, 49.0]
t0b = 0.2  # starts with the stamp
silent = [(M["crash"] - 0.02, M["crash"] + 0.9), (M["hit"] - 0.08, M["hit"] + 0.5), (M["k7land"] - 0.35, M["k7land"] - 0.01)]
for k in range(int((END - t0b) / B)):
    at = t0b + k * B
    if any(a <= at < b for a, b in silent):
        continue
    add(at, kick)
    if k % 2 == 1:
        add(at, clap)
    for h in range(2):
        add(at + h * B / 2, hat * (1.0 if h else 0.6))
    f0 = ROOTS[(k // 4) % 4]
    for h in range(2):
        tb = tt(B / 2)
        env = np.minimum(1, tb * 200) * np.exp(-tb * 5)
        add(at + h * B / 2 + 0.03, np.sin(2 * np.pi * f0 * 2 * tb) * env * 0.45 + np.sin(2 * np.pi * f0 * tb) * env * 0.5)
# muffled and thin on the copies and on рилик, full from the MoreCube landing
muff = lp(x, 500, 4)
mask = np.zeros(len(x))
mask[: int(M["k7land"] * SR)] = 1
mask = uniform_filter1d(mask, int(0.05 * SR))
x = x * (1 - mask) + muff * mask * 1.25
x = x / (np.abs(x).max() + 1e-9) * 0.8
beat_src = wav("ep03_beat", x[: int(SR * END)])

# ------------------------------------------------------------------ write
json.dump({"end": END, "shots": shots, "captions": caps, "marks": M}, open(os.path.join(TW, "assets/data/ep03/timeline.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)


def dur_of(src):
    with wave.open(os.path.join(TW, src)) as f:
        return f.getnframes() / f.getframerate()


vo_dur = dur_of("assets/audio/ep03_vo.wav")
tags = []
for k, c in enumerate(sorted(cues, key=lambda c: c["t"])):
    d = c["dur"] or dur_of(c["src"])
    d = min(d, dur_of(c["src"]), END - c["t"])
    if d <= 0.02:
        continue
    tags.append(f'      <audio id="sfx{k:03d}" class="clip" src="{c["src"]}" data-start="{c["t"]:.3f}" data-duration="{d:.3f}" data-track-index="{10 + k % 6}" data-volume="{c["vol"]}" data-fade-out="0.04"></audio>')
idx = os.path.join(TW, "index.html")
if os.path.exists(idx) and "compositions/ep02.html" in open(idx, encoding="utf-8").read():
    shutil.copy(idx, os.path.join(TW, "index_ep02.html"))
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
      <div id="ep03" data-composition-id="ep03" data-composition-src="compositions/ep03.html" data-start="0" data-duration="{END}" data-track-index="1" data-track-kind="graphics" data-width="1080" data-height="1920" style="z-index: 1"></div>
      <audio id="vo" class="clip" src="assets/audio/ep03_vo.wav" data-start="0" data-duration="{min(END, vo_dur):.2f}" data-track-index="2" data-volume="1"></audio>
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
  <div id="root" data-composition-id="ep03" data-start="0" data-duration="{END}" data-width="1080" data-height="1920">
    <canvas id="world-canvas" class="clip" data-start="0" data-duration="{END}" data-track-index="1"></canvas>
  </div>
  <script>
    (function () {{
      var clock = {{ t: 0 }};
      var host = {{ clock: clock, render: null }};
      window.__world = host;
      window.__hf = window.__hf || {{}};
      window.__hf.buildReady = window.__hf.buildReady || {{}};
      window.__hf.buildReady["ep03"] = new Promise(function (resolve) {{ host.ready = resolve; }});
      var tl = gsap.timeline({{ paused: true }});
      tl.to(clock, {{ t: {END}, duration: {END}, ease: "none", onUpdate: function () {{ if (host.render) host.render(clock.t); }} }});
      window.__timelines = window.__timelines || {{}};
      window.__timelines["ep03"] = tl;
    }})();
  </script>
  <script type="module" src="assets/js/ep03.js"></script>
</template>
'''
open(os.path.join(TW, "compositions/ep03.html"), "w", encoding="utf-8").write(comp)
print("END", END, "shots:", [(s["id"], s["t0"], round(s["t1"] - s["t0"], 2)) for s in shots])
print("marks", M)
print("captions", len(caps), "cues", len(tags))
