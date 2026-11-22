# Episode 2 voiceover (STEOS take): squeeze digital-silence gaps to 0.28 s, speed up 1.07x, loudness −16 LUFS,
# and carry the whisper word times through the same edits -> assets/audio/ep02_vo.wav + ep02_words.json.
# usage: python -I ep02_vo.py <twin_dir> <head_words.txt>
import json, os, re, subprocess, sys
import numpy as np

TW, HEAD = sys.argv[1], sys.argv[2]
SPEED = 1.07
SR_IN = 44100
raw = os.path.join(TW, "assets/audio/ep02_vo_raw.mp3")
x = np.frombuffer(subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-i", raw, "-ac", "1", "-ar", str(SR_IN), "-f", "f32le", "-"],
                                 capture_output=True, check=True).stdout, dtype=np.float32).copy()

# digital silence runs (|x| < 1e-4 for at least 0.2 s) -> keep 0.28 s of each
quiet = np.abs(x) < 1e-4
cuts = []  # (start_s, removed_s)
i = 0
n = len(x)
while i < n:
    if quiet[i]:
        j = i
        while j < n and quiet[j]:
            j += 1
        if (j - i) / SR_IN >= 0.2 and i > 0 and j < n:
            keep = int(0.28 * SR_IN)
            a = i + keep // 2
            b = j - keep // 2
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
print("silence cuts:", [(round(a, 2), round(r, 2)) for a, r in removed])


def remap(t):
    for a, r in removed:
        if t > a:
            t -= min(r, t - a) if t < a + r else r
    return round(t / SPEED, 3)


tmp = os.path.join(TW, "assets/audio/_ep02_cut.f32")
y.astype(np.float32).tofile(tmp)
out = os.path.join(TW, "assets/audio/ep02_vo.wav")
pre = ["ffmpeg", "-hide_banner", "-nostats", "-f", "f32le", "-ar", str(SR_IN), "-ac", "1", "-i", tmp]
chain = f"atempo={SPEED},aresample=48000,pan=stereo|c0=c0|c1=c0"
m = subprocess.run(pre + ["-af", chain + ",loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json", "-f", "null", "-"], capture_output=True, text=True).stderr
J = json.loads(re.findall(r"\{[^{}]*\}", m, re.S)[-1])
ln = (f"loudnorm=I=-16:TP=-1.5:LRA=11:measured_I={J['input_i']}:measured_TP={J['input_tp']}:measured_LRA={J['input_lra']}:"
      f"measured_thresh={J['input_thresh']}:offset={J['target_offset']}:linear=true")
subprocess.run(pre + ["-y", "-af", chain + "," + ln + ",aresample=48000", "-c:a", "pcm_s16le", out], check=True, capture_output=True)
os.remove(tmp)

# words: the head (no-prompt pass) up to 4.3 s, the full pass after
words = []
for ln_ in open(HEAD, encoding="utf-8"):
    mm = re.match(r"([\d.]+)-([\d.]+) (.+?)\(([\d.]+)\)$", ln_.strip())
    if mm and float(mm.group(1)) < 4.3:
        words.append([float(mm.group(1)), float(mm.group(2)), mm.group(3)])
full = json.load(open(os.path.join(TW, "assets/audio/ep02_words_raw.json"), encoding="utf-8"))
for s in full:
    for w0, w1, t, p in s["words"]:
        if w0 >= 4.3 and re.search(r"\w", t):
            if words and words[-1][2] == t and abs(words[-1][0] - w0) < 0.05:
                words[-1][1] = max(words[-1][1], w1)  # whisper doubled «буквам»: keep the longer one
                continue
            words.append([w0, w1, t])
fix = {"релике.": "рилике.", "релик": "рилик", "Найдешь?": "Найдёшь?"}
res = [[remap(a), remap(b), fix.get(t, t)] for a, b, t in words]
json.dump(res, open(os.path.join(TW, "assets/audio/ep02_words.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=0)
dur = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", out], capture_output=True, text=True).stdout)
print("vo", round(dur, 2), "s, words", len(res), "first", res[:3], "last", res[-2:])
