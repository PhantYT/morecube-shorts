# Episode 3 voiceover: shorten long quiet gaps (< -45 dB for >= 0.32 s -> 0.24 s), speed up 1.07x, loudness -16 LUFS,
# and carry the whisper word times through the same edits -> assets/audio/ep03_vo.wav + ep03_words.json.
# Words: text and times from the pass prompted with the script; a word right after a phantom «—» token takes its
# start from the no-prompt pass (the dash token steals its onset).
# usage: python -I ep03_vo.py <twin_dir>
import json, os, re, subprocess, sys
import numpy as np

TW = sys.argv[1]
SPEED = 1.07
SR_IN = 44100
raw = os.path.join(TW, "assets/audio/ep03_vo_raw.mp3")
x = np.frombuffer(subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-i", raw, "-ac", "1", "-ar", str(SR_IN), "-f", "f32le", "-"],
                                 capture_output=True, check=True).stdout, dtype=np.float32).copy()

# quiet runs on a 20 ms RMS envelope
w = int(0.02 * SR_IN)
env = np.sqrt(np.convolve(x.astype(np.float64) ** 2, np.ones(w) / w, "same"))
quiet = 20 * np.log10(env + 1e-9) < -45
KEEP, MIN_RUN = 0.24, 0.32
cuts = []  # (a, b) sample ranges removed
i, n = 0, len(x)
while i < n:
    if quiet[i]:
        j = i
        while j < n and quiet[j]:
            j += 1
        if (j - i) / SR_IN >= MIN_RUN and i > 0 and j < n:
            keep = int(KEEP * SR_IN)
            a, b = i + keep // 2, j - keep // 2
            if b > a:
                cuts.append((a, b))
        i = j
    else:
        i += 1
parts, last = [], 0
for a, b in cuts:
    parts.append(x[last:a])
    last = b
parts.append(x[last:])
y = np.concatenate(parts)
removed = [(a / SR_IN, (b - a) / SR_IN) for a, b in cuts]
print("gap cuts (at, removed):", [(round(a, 2), round(r, 2)) for a, r in removed])


def remap(t):
    gone = sum(min(max(t - a, 0.0), r) for a, r in removed)
    return round((t - gone) / SPEED, 3)


tmp = os.path.join(TW, "assets/audio/_ep03_cut.f32")
y.astype(np.float32).tofile(tmp)
out = os.path.join(TW, "assets/audio/ep03_vo.wav")
pre = ["ffmpeg", "-hide_banner", "-nostats", "-f", "f32le", "-ar", str(SR_IN), "-ac", "1", "-i", tmp]
chain = f"atempo={SPEED},aresample=48000,pan=stereo|c0=c0|c1=c0"
m = subprocess.run(pre + ["-af", chain + ",loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json", "-f", "null", "-"], capture_output=True, text=True).stderr
J = json.loads(re.findall(r"\{[^{}]*\}", m, re.S)[-1])
ln = (f"loudnorm=I=-16:TP=-1.5:LRA=11:measured_I={J['input_i']}:measured_TP={J['input_tp']}:measured_LRA={J['input_lra']}:"
      f"measured_thresh={J['input_thresh']}:offset={J['target_offset']}:linear=true")
subprocess.run(pre + ["-y", "-af", chain + "," + ln + ",aresample=48000", "-c:a", "pcm_s16le", out], check=True, capture_output=True)
os.remove(tmp)

# ---------------------------------------------------------------- words
norm = lambda t: re.sub(r"[^\wё]", "", t.lower().replace("ё", "е"))
P = [w for s in json.load(open(os.path.join(TW, "assets/audio/ep03_words_raw_prompt.json"), encoding="utf-8")) for w in s["words"]]
N = [w for s in json.load(open(os.path.join(TW, "assets/audio/ep03_words_raw_noprompt.json"), encoding="utf-8")) for w in s["words"]]
words, after_dash = [], False
for w0, w1, t, p in P:
    if not re.search(r"\w", t):
        after_dash = True
        continue
    if after_dash:  # take the onset from the no-prompt pass (same word within 0.5 s)
        c = [q for q in N if norm(q[2]) and (norm(q[2]) == norm(t) or norm(t).endswith(norm(q[2]))) and abs(q[0] - w0) < 0.5]
        if c:
            w0 = min(c, key=lambda q: abs(q[0] - w0))[0]
    after_dash = False
    words.append([w0, w1, t])
res = [[remap(a), remap(b), t] for a, b, t in words]
json.dump(res, open(os.path.join(TW, "assets/audio/ep03_words.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=0)
dur = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", out], capture_output=True, text=True).stdout)
print("vo", round(dur, 2), "s, words", len(res), "| loudness in", J["input_i"], "LUFS")
