"""Final master for the shorts: static gain + look-ahead limiter to -14 LUFS / <= -1 dBTP, video copied
(or re-encoded with --reenc for a platform-friendly H.264 High yuv420p file).
usage: python -I master.py <raw.mp4> <out.mp4> [--reenc KBPS]   (ep01: --reenc 13000)"""
import re
import subprocess
import sys

raw, out = sys.argv[1], sys.argv[2]
reenc = int(sys.argv[sys.argv.index("--reenc") + 1]) if "--reenc" in sys.argv else 0
TARGET, LIMIT = -14.0, 0.776  # 0.776 = -2.2 dBFS sample ceiling, leaves room for AAC inter-sample overs


def run(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace")
    if r.returncode:
        print(r.stderr[-2000:])
        raise SystemExit(f"failed: {' '.join(cmd[:6])}")
    return r.stderr


def measure(path, af=None):
    chain = (af + ",") if af else ""
    s = run(["ffmpeg", "-hide_banner", "-nostats", "-i", path, "-vn", "-af", chain + "ebur128=peak=true", "-f", "null", "-"])
    s = s[s.rfind("Summary:"):]
    i = float(re.search(r"I:\s+(-?[\d.]+) LUFS", s).group(1))
    lra = float(re.search(r"LRA:\s+(-?[\d.]+) LU", s).group(1))
    tp = float(re.search(r"Peak:\s+(-?[\d.]+|-inf) dBFS", s).group(1))
    return i, tp, lra


def chain(g):
    # 24 dB/oct high-pass at 45 Hz: the SFX sub rumble (inaudible on phones) was eating the headroom and made the
    # limiter duck the voice by ~3.6 dB during the K13 loot eruption; with it the limiter only shaves transients.
    hp = "highpass=f=45:poles=2,highpass=f=45:poles=2"
    return f"{hp},volume={g:.2f}dB,alimiter=limit={LIMIT}:attack=5:release=120:level=0:latency=1,aresample=48000"


i0, tp0, lra0 = measure(raw)
print(f"raw: I {i0} LUFS, TP {tp0} dBTP, LRA {lra0}")
g = TARGET - i0
for _ in range(4):
    i1, tp1, _l = measure(raw, chain(g))
    print(f"  gain {g:+.2f} dB -> I {i1}, TP {tp1}")
    if abs(i1 - TARGET) <= 0.15:
        break
    g += TARGET - i1

vcodec = ["-c:v", "copy"]
if reenc:  # two-pass x264 so one file fits every platform's upload limit (TikTok app on Android ~72 MB)
    import os
    import tempfile
    passlog = os.path.join(tempfile.gettempdir(), "x264pass_master")
    vx = ["-c:v", "libx264", "-preset", "slow", "-tune", "film", "-profile:v", "high", "-level", "4.2",
          "-pix_fmt", "yuv420p", "-b:v", f"{reenc}k", "-maxrate", f"{int(reenc * 1.6)}k", "-bufsize", f"{reenc * 2}k",
          "-g", "120", "-bf", "2", "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709",
          "-color_range", "tv", "-passlogfile", passlog]
    run(["ffmpeg", "-hide_banner", "-nostats", "-y", "-i", raw, "-map", "0:v:0", *vx, "-pass", "1", "-an", "-f", "null", "-"])
    print("  pass 1 done")
    vcodec = vx + ["-pass", "2"]
cmd = ["ffmpeg", "-hide_banner", "-nostats", "-y", "-i", raw, "-map", "0:v:0", "-map", "0:a:0", *vcodec,
       "-af", chain(g), "-c:a", "aac", "-b:a", "256k", "-ar", "48000", "-movflags", "+faststart", out]
run(cmd)
i2, tp2, lra2 = measure(out)
print(f"out: I {i2} LUFS, TP {tp2} dBTP, LRA {lra2}")
print(subprocess.run(["ffprobe", "-v", "error", "-show_entries",
                      "stream=codec_name,profile,pix_fmt,width,height,r_frame_rate,bit_rate:format=duration,size,bit_rate",
                      "-of", "compact", out], capture_output=True, text=True).stdout)
