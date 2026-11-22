# NPCs (ZNPCsPlus) + holograms (DecentHolograms) of the spawn: positions, skins (downloaded once), text lines
# rendered with the real Minecraft font + MoreCube pack glyphs into PNGs.
# usage: python -I bake_npcs.py <rw1_public_dir> <pack.zip> <client.jar> <out_dir>
import os, sys, json, glob, base64, hashlib, re, time, urllib.request
import yaml

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from mcfont import Fonts, render_line

SRC, PACK, JAR, OUT = sys.argv[1:5]
fonts = Fonts(PACK, JAR)
os.makedirs(os.path.join(OUT, "skins"), exist_ok=True)
os.makedirs(os.path.join(OUT, "holo"), exist_ok=True)
UA = {"User-Agent": "curl/8.4.0"}

# neutral nicks for the tops (the server's own fake-broadcast list)
NICKS = ["Kirbezik", "MalinovyjZakat", "TemnyiStranik", "ZlobnyKabanchik", "Prostokvasha", "LunnyVolk", "KotVSapogah_", "Grozovoy",
         "SonnayaSova", "MedovyBaton", "ChernyPlashch", "VeselyPirat", "LedyanoyStrannik", "OgnennyLis", "TihiyOmut"]
TOPVAL = {"eco": lambda i: f"{(14 - i) * 1_013_000:,}".replace(",", " ") + " &fꐃ", "kills": lambda i: f"{1840 - i * 131}", "bp": lambda i: f"{60 - i * 4} ур.",
          "clan": lambda i: f"{220 - i * 17} очк.", "duels": lambda i: f"{412 - i * 33}", "online": lambda i: f"{311 - i * 21} ч."}


def placeholder(m):
    key = m.group(1)
    mm = re.match(r"reallytops_(\w+?)_(\d+)", key)
    if mm:
        kind, n = mm.group(1), int(mm.group(2))
        nick = NICKS[(n * 7 + len(kind)) % len(NICKS)] if kind != "clan" else ["Котята", "Шазики", "Prime1", "Level_up", "Драконы", "Сигмы", "Бобры", "Волки", "Тигры", "Звери"][(n - 1) % 10]
        val = TOPVAL.get(kind, lambda i: str(100 - i))(n)
        return f"&e{n}. &f{nick} &7- &6{val}"
    return {"player_name": "_pogostik_"}.get(key, "")


def fetch(url, path):
    if os.path.exists(path) and os.path.getsize(path) > 0:
        return path
    for k in range(3):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=20) as r:
                data = r.read()
            open(path, "wb").write(data)
            return path
        except Exception as e:
            print("fetch fail", url, e)
            time.sleep(2)
    return None


SKCACHE_P = os.path.join(OUT, "skins", "cache.json")
SKCACHE = json.load(open(SKCACHE_P)) if os.path.exists(SKCACHE_P) else {}


def skin_from_prop(val):
    """(url, slim) from a ZNPCsPlus skin property; Mojang lookups are cached in skins/cache.json."""
    if val in SKCACHE:
        return tuple(SKCACHE[val])
    r = _skin_from_prop(val)
    if r[0]:
        SKCACHE[val] = list(r)
        json.dump(SKCACHE, open(SKCACHE_P, "w"))
    return r


def _skin_from_prop(val):
    parts = val.split(";")
    if parts[0] == "prefetched":
        js = json.loads(base64.b64decode(parts[2] + "==="))
        sk = js["textures"]["SKIN"]
        return sk["url"], (sk.get("metadata", {}).get("model") == "slim")
    if parts[0] == "fetching":
        name = parts[1]
        prof = json.loads(urllib.request.urlopen(urllib.request.Request(f"https://api.mojang.com/users/profiles/minecraft/{name}", headers=UA), timeout=20).read())
        ses = json.loads(urllib.request.urlopen(urllib.request.Request(f"https://sessionserver.mojang.com/session/minecraft/profile/{prof['id']}", headers=UA), timeout=20).read())
        tex = json.loads(base64.b64decode(ses["properties"][0]["value"] + "==="))
        sk = tex["textures"]["SKIN"]
        return sk["url"], (sk.get("metadata", {}).get("model") == "slim")
    return None, False


def line_png(text, name, bg=(0, 0, 0, 64)):
    text = re.sub(r"%([a-zA-Z0-9_]+)%", placeholder, text)
    if not text.strip() or re.fullmatch(r"(&[0-9a-fk-orA-FK-OR])*\s*", text):
        return None
    img, w = render_line(fonts, text, K=4, shadow=False, bg=bg)
    p = os.path.join(OUT, "holo", name + ".png")
    img.save(p)
    return {"png": "holo/" + name + ".png", "wpx": w, "hpx": 12}


npcs = []
for f in sorted(glob.glob(os.path.join(SRC, "ZNPCsPlus", "data", "*.yml"))):
    d = yaml.safe_load(open(f, encoding="utf-8"))
    if d.get("world") != "world_spawn" or not d.get("enabled", True):
        continue
    loc = d["location"]
    props = d.get("properties", {}) or {}
    rec = {"id": d["id"], "type": d.get("type", "player"), "pos": [loc["x"], loc["y"], loc["z"]], "yaw": loc.get("yaw", 0), "pitch": loc.get("pitch", 0), "skin": None, "slim": False, "lines": []}
    if "skin" in props:
        try:
            url, slim = skin_from_prop(str(props["skin"]))
            if url:
                h = hashlib.md5(url.encode()).hexdigest()[:12]
                if fetch(url, os.path.join(OUT, "skins", h + ".png")):
                    rec["skin"], rec["slim"] = "skins/" + h + ".png", slim
        except Exception as e:
            print("skin fail", d["id"], e)
    lines = (d.get("hologram") or {}).get("lines") or []
    safe = hashlib.md5(d["id"].encode("utf-8")).hexdigest()[:8]
    for i, ln in enumerate(lines):
        r = line_png(str(ln), f"npc_{safe}_{i}")
        rec["lines"].append(r)
    npcs.append(rec)
    print("npc", safe, rec["type"], bool(rec["skin"]), len(lines), flush=True)

holos = []
for f in sorted(glob.glob(os.path.join(SRC, "DecentHolograms", "holograms", "*.yml"))):
    d = yaml.safe_load(open(f, encoding="utf-8"))
    loc = d.get("location", "")
    if not loc.startswith("world_spawn:") or not d.get("enabled", True):
        continue
    _, x, y, z = loc.split(":")
    name = os.path.splitext(os.path.basename(f))[0]
    rec = {"id": name, "pos": [float(x), float(y), float(z)], "lines": []}
    for i, ln in enumerate(d["pages"][0]["lines"]):
        r = line_png(str(ln.get("content", "")), f"dh_{name}_{i}")
        rec["lines"].append({"img": r, "h": float(ln.get("height", 0.3))})
    holos.append(rec)
json.dump({"npcs": npcs, "holos": holos, "line_spacing": 0.3}, open(os.path.join(OUT, "entities.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print("npcs", len(npcs), "holos", len(holos))
