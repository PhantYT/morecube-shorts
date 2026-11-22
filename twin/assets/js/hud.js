// Screen layer for the ads: the pinned IP header, word captions, Minecraft title overlays (pre-rendered PNGs in the
// real font), the rewind stamp, price tags, the subscribe button and the end card. Drawn into a canvas that the
// final post pass composites over the picture.
import * as THREE from "./three.js";

const HEADER_TOP = 196;

export async function makeHud(W, H, images, opts = {}) {
  const EP2 = opts.variant === "ep02";
  const EP3 = opts.variant === "ep03";
  const ff = new FontFace("MB", "url(assets/fonts/Montserrat-Black.ttf)");
  await ff.load();
  document.fonts.add(ff);
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d");
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.NoColorSpace;
  tex.generateMipmaps = false;
  tex.minFilter = tex.magFilter = THREE.LinearFilter;
  const img = {};
  await Promise.all(Object.entries(images).map(([k, src]) => new Promise((res) => {
    const im = new Image();
    im.onload = () => { img[k] = im; res(); };
    im.onerror = () => res();
    im.src = src;
  })));

  // text pieces: [[text, colour], ...] on one line, centred at cx
  function line(pieces, cx, y, size, stroke = size * 0.16, align = "center") {
    g.font = `${size}px MB`;
    g.lineJoin = "round";
    g.textBaseline = "alphabetic";
    const w = pieces.reduce((a, [t]) => a + g.measureText(t).width, 0);
    let x = align === "center" ? cx - w / 2 : cx;
    for (const [t, col] of pieces) {
      g.strokeStyle = "rgba(0,0,0,0.92)";
      g.lineWidth = stroke;
      g.strokeText(t, x, y);
      if (Array.isArray(col)) {
        const gr = g.createLinearGradient(0, y - size * 0.8, 0, y);
        gr.addColorStop(0, col[0]);
        gr.addColorStop(1, col[1]);
        g.fillStyle = gr;
      } else g.fillStyle = col;
      g.fillText(t, x, y);
      x += g.measureText(t).width;
    }
    return w;
  }

  function header() {
    g.save();
    g.shadowColor = "rgba(0,0,0,0.45)";
    g.shadowBlur = 14;
    if (EP2) {
      line([["IP: ", "#FFFFFF"], ["POG.MORECUBE.RU", ["#FFF27A", "#FF9F1C"]]], W / 2, HEADER_TOP + 52, 58, 11);
      line([["/CODES", "#5CFF6E"], [" — БЕСПЛАТНЫЙ ", "#FFFFFF"], ["ДОНАТ", "#FF4FA3"]], W / 2, HEADER_TOP + 100, 34, 7);
      g.restore();
      return;
    }
    if (EP3) {
      line([["IP: ", "#FFFFFF"], ["POG.MORECUBE.RU", ["#FFF27A", "#FF9F1C"]]], W / 2, HEADER_TOP + 52, 58, 11);
      line([["/CODE PODAROK", ["#B6FFC4", "#2EE65C"]], [" — ", "#FFFFFF"], ["ДОНАТ БЕСПЛАТНО", "#FF4FA3"]], W / 2, HEADER_TOP + 104, 38, 8);
      g.restore();
      return;
    }
    line([["IP: ", "#FFFFFF"], ["PLAY.MORECUBE.RU", ["#FFF27A", "#FF9F1C"]]], W / 2, HEADER_TOP + 52, 58, 11);
    line([["↑ ЗАХОДИ ↑ И ПОЛУЧИ ", "#FFFFFF"], ["ДОНАТ", "#FF4FA3"]], W / 2, HEADER_TOP + 108, 40, 8);
    line([["ПО КОМАНДЕ ", "#FFFFFF"], ["/CODES", "#5CFF6E"]], W / 2, HEADER_TOP + 158, 40, 8);
    g.globalAlpha = 0.85;
    line([["Версия 1.16.5 и выше", "#FFFFFF"]], W / 2, HEADER_TOP + 196, 24, 5);
    g.restore();
  }

  function caption(words, pop = 1) {
    if (!words || !words.length) return;
    const s = 1 + 0.2 * (1 - pop);
    g.save();
    g.translate(W / 2, 1268);
    g.scale(s, s);
    g.shadowColor = "rgba(0,0,0,0.55)";
    g.shadowBlur = 18;
    let size = 92;
    g.font = `${size}px MB`;
    const w = words.reduce((a, [t]) => a + g.measureText(t).width, 0);
    if (w > 900) size = Math.floor(size * 900 / w);
    line(words, 0, 0, size, size * 0.17);
    g.restore();
  }

  function stamp(text) {
    g.save();
    g.translate(150, 560);
    g.rotate(-0.08);
    g.font = "54px MB";
    const w = g.measureText(text).width + 60;
    g.fillStyle = "rgba(230,20,40,0.92)";
    g.fillRect(-20, -62, w, 84);
    g.strokeStyle = "#fff";
    g.lineWidth = 5;
    g.strokeRect(-12, -54, w - 16, 68);
    g.fillStyle = "#fff";
    g.fillText(text, 10, 0);
    g.restore();
  }

  function price(oldP, newP, y = 1420, s = 1, strike = 1) {
    g.save();
    g.translate(W / 2, y);
    g.scale(s, s);
    g.translate(-W / 2, -y);
    g.font = "64px MB";
    const w1 = g.measureText(oldP).width, w2 = g.measureText(newP).width, arr = 70;
    const x0 = W / 2 - (w1 + arr + w2) / 2;
    line([[oldP, "#FFFFFF"]], x0, y, 64, 11, "left");
    g.strokeStyle = "#FF2D3F";
    g.lineWidth = 10;
    g.beginPath();
    g.moveTo(x0 - 8, y - 18);
    g.lineTo(x0 - 8 + (w1 + 16) * strike, y - 18 - 12 * strike);
    g.stroke();
    line([["→", "#FFFFFF"]], x0 + w1 + 14, y, 56, 9, "left");
    line([[newP, ["#7DFF9A", "#1FD655"]]], x0 + w1 + arr, y, 84, 13, "left");
    g.restore();
  }

  function subscribe(x, y, s = 1, pressed = 0) {
    g.save();
    g.translate(x, y);
    g.scale(s, s);
    g.translate(-x, -y);
    const w = 470, h = 104;
    g.shadowColor = "rgba(0,0,0,0.5)";
    g.shadowBlur = 20;
    g.fillStyle = pressed ? "#3A3A44" : "#FF2D55";
    g.beginPath();
    g.roundRect(x - w / 2, y - h / 2, w, h, 52);
    g.fill();
    g.shadowBlur = 0;
    g.font = "46px MB";
    g.fillStyle = "#fff";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(pressed ? "✓ ВЫ ПОДПИСАНЫ" : "+ ПОДПИСАТЬСЯ", x, y + 3);
    g.restore();
  }

  function endcard(a = 1) {
    g.save();
    g.globalAlpha = a;
    const gr = g.createLinearGradient(0, 760, 0, 1500);
    gr.addColorStop(0, "rgba(10,6,20,0)");
    gr.addColorStop(0.35, "rgba(10,6,20,0.72)");
    gr.addColorStop(1, "rgba(10,6,20,0.82)");
    g.fillStyle = gr;
    g.fillRect(0, 760, W, 740);
    g.shadowColor = "rgba(255,170,40,0.55)";
    g.shadowBlur = 30;
    line([["PLAY.MORECUBE.RU", ["#FFF27A", "#FF9F1C"]]], W / 2, 1060, 96, 16);
    g.shadowBlur = 0;
    line([["/CODES", "#5CFF6E"], [" — БЕСПЛАТНЫЙ ДОНАТ", "#FFFFFF"]], W / 2, 1160, 46, 9);
    g.restore();
  }

  // ---- ep02: match score bar «MORECUBE a : b РИЛИК», round label, +1, VS splash, big final score, code hint, end card
  const SCORE_Y = HEADER_TOP + 178;
  function score(s) {
    const y = SCORE_Y;
    const pop = 1 - (s.slide ?? 0);
    g.save();
    g.globalAlpha = (s.a ?? 1) * Math.min(1, pop * 1.6);
    g.translate(W / 2, y);
    g.scale(0.8 + 0.2 * pop, 0.8 + 0.2 * pop);
    g.translate(-W / 2, -y);
    const w = 820, h = 104;
    g.shadowColor = "rgba(0,0,0,0.55)";
    g.shadowBlur = 22;
    g.fillStyle = "rgba(12,9,22,0.72)";
    g.beginPath();
    g.roundRect(W / 2 - w / 2, y - h / 2, w, h, 52);
    g.fill();
    g.shadowBlur = 0;
    g.lineWidth = 4;
    const gb = g.createLinearGradient(W / 2 - w / 2, 0, W / 2 + w / 2, 0);
    gb.addColorStop(0, "rgba(255,200,60,0.95)");
    gb.addColorStop(0.5, "rgba(255,255,255,0.25)");
    gb.addColorStop(1, "rgba(255,60,60,0.9)");
    g.strokeStyle = gb;
    g.stroke();
    line([["MORECUBE", ["#FFF27A", "#FF9F1C"]]], W / 2 - 238, y + 15, 44, 8);
    line([["РИЛИК", ["#FF8A8A", "#D61F1F"]]], W / 2 + 250, y + 15, 44, 8);
    const pa = s.pulseA ?? 0, pb = s.pulseB ?? 0;
    for (const [v, x, p, col] of [[s.l, W / 2 - 58, pa, "#FFFFFF"], [s.r, W / 2 + 58, pb, "#FFFFFF"]]) {
      g.save();
      g.translate(x, y + 24);
      g.scale(1 + 0.6 * p, 1 + 0.6 * p);
      line([[String(v), p > 0.05 ? ["#B6FFC4", "#2EE65C"] : col]], 0, 0, 74, 12);
      g.restore();
    }
    line([[":", "#FFFFFF"]], W / 2, y + 20, 64, 10);
    if (s.plus > 0) {
      g.save();
      g.globalAlpha = (s.a ?? 1) * Math.min(1, (1 - s.plus) * 3);
      line([["+1", ["#B6FFC4", "#2EE65C"]]], W / 2 - 58, y - 64 - 60 * s.plus, 56, 10);
      g.restore();
    }
    if (s.round && s.roundA > 0) {
      g.save();
      g.globalAlpha = (s.a ?? 1) * s.roundA;
      const ry = y + h / 2 + 52;
      g.font = "36px MB";
      const tw = g.measureText(s.round).width + 56;
      g.fillStyle = "rgba(0,0,0,0.55)";
      g.beginPath();
      g.roundRect(W / 2 - tw / 2, ry - 40, tw, 54, 27);
      g.fill();
      line([[s.round, "#FFFFFF"]], W / 2 + (1 - s.roundA) * 60, ry, 36, 7);
      g.restore();
    }
    if (s.vs > 0) {
      g.save();
      g.globalAlpha = Math.min(1, s.vs * 2) * (s.a ?? 1);
      g.translate(W / 2, 760);
      const k = 1 + 1.2 * Math.max(0, 1 - s.vs * 1.6);
      g.scale(k, k);
      g.shadowColor = "rgba(255,80,40,0.8)";
      g.shadowBlur = 40;
      line([["VS", ["#FFFFFF", "#FF5A3C"]]], 0, 60, 190, 24);
      g.restore();
    }
    g.restore();
  }
  function bigScore(k, l, r) {
    g.save();
    g.globalAlpha = Math.min(1, k * 3);
    g.translate(W / 2, 900);
    const s = 1 + 1.4 * Math.max(0, 1 - k * 2.2);
    g.scale(s, s);
    g.shadowColor = "rgba(255,190,40,0.85)";
    g.shadowBlur = 50;
    line([[`${l} : ${r}`, ["#FFFBD0", "#FFB300"]]], 0, 80, 230, 28);
    g.shadowBlur = 0;
    line([["MORECUBE ПОБЕЖДАЕТ", "#FFFFFF"]], 0, 170, 52, 10);
    g.restore();
  }
  function codeHint(a) {
    g.save();
    g.globalAlpha = a;
    const y = SCORE_Y + 128, text = "В ВИДЕО СПРЯТАН КОД";
    g.font = "34px MB";
    const tw = g.measureText(text).width + 104;
    g.fillStyle = "rgba(255,210,60,0.95)";
    g.beginPath();
    g.roundRect(W / 2 - tw / 2, y - 38, tw, 56, 28);
    g.fill();
    g.strokeStyle = "#1A1208";
    g.lineWidth = 6;
    g.beginPath();
    g.arc(W / 2 - tw / 2 + 40, y - 14, 12, 0, Math.PI * 2);
    g.moveTo(W / 2 - tw / 2 + 49, y - 5);
    g.lineTo(W / 2 - tw / 2 + 60, y + 7);
    g.stroke();
    g.fillStyle = "#1A1208";
    g.textBaseline = "alphabetic";
    g.fillText(text, W / 2 - tw / 2 + 76, y);
    g.restore();
  }
  function endcard2(a, slots, flashK) {
    g.save();
    g.globalAlpha = a;
    const gr = g.createLinearGradient(0, 700, 0, 1500);
    gr.addColorStop(0, "rgba(10,6,20,0)");
    gr.addColorStop(0.3, "rgba(10,6,20,0.74)");
    gr.addColorStop(1, "rgba(10,6,20,0.84)");
    g.fillStyle = gr;
    g.fillRect(0, 700, W, 800);
    g.shadowColor = "rgba(255,170,40,0.55)";
    g.shadowBlur = 30;
    line([["POG.MORECUBE.RU", ["#FFF27A", "#FF9F1C"]]], W / 2, 1000, 84, 14);
    g.shadowBlur = 0;
    line([["/CODES", "#5CFF6E"], [" — БЕСПЛАТНЫЙ ДОНАТ", "#FFFFFF"]], W / 2, 1090, 46, 9);
    if (slots > 0) {
      line([["КОД:", "#FFFFFF"]], W / 2 - 330, 1250, 54, 10);
      for (let i = 0; i < 7; i++) {
        const k = Math.max(0, Math.min(1, slots * 7 - i));
        if (k <= 0) continue;
        const x = W / 2 - 205 + i * 78;
        g.fillStyle = `rgba(255,255,255,${0.12 * k})`;
        g.fillRect(x, 1182, 64, 84);
        g.fillStyle = `rgba(255,210,60,${k})`;
        g.fillRect(x, 1262, 64, 8);
        if (i === 6 && flashK > 0) {
          g.save();
          g.globalAlpha = a * flashK;
          line([["K", ["#FFF27A", "#FF9F1C"]]], x + 32, 1252, 70, 10);
          g.restore();
        } else line([["?", "rgba(255,255,255,0.35)"]], x + 32, 1250, 54, 8);
      }
    }
    g.restore();
  }

  // ---- ep03: copy label banner, «НЕ ЗАХОДИ» stamp, «как зайти» card
  function copyLabel(s) {
    g.save();
    g.globalAlpha = s.a ?? 1;
    const y = HEADER_TOP + 186;
    g.font = "40px MB";
    const tw = g.measureText(s.text).width + 70;
    const k = 0.85 + 0.15 * Math.min(1, (s.a ?? 1) * 1.5);
    g.translate(W / 2, y);
    g.scale(k, k);
    g.translate(-W / 2, -y);
    g.shadowColor = "rgba(0,0,0,0.5)";
    g.shadowBlur = 18;
    g.fillStyle = s.good ? "rgba(20,120,50,0.88)" : "rgba(150,20,28,0.88)";
    g.beginPath();
    g.roundRect(W / 2 - tw / 2, y - 46, tw, 66, 33);
    g.fill();
    g.shadowBlur = 0;
    g.lineWidth = 4;
    g.strokeStyle = s.good ? "rgba(140,255,170,0.9)" : "rgba(255,150,150,0.85)";
    g.stroke();
    line([[s.text, "#FFFFFF"]], W / 2, y + 2, 40, 8);
    g.restore();
  }
  function warn(a) {
    g.save();
    g.globalAlpha = Math.min(1, a * 2);
    g.translate(W / 2, 760);
    g.rotate(-0.09);
    const k = 1 + 0.9 * Math.max(0, 1 - a * 2.5);
    g.scale(k, k);
    g.font = "92px MB";
    const text = "⚠ НЕ ЗАХОДИ!";
    const tw = g.measureText(text).width + 70;
    g.fillStyle = "rgba(220,20,32,0.93)";
    g.fillRect(-tw / 2, -84, tw, 118);
    g.strokeStyle = "#fff";
    g.lineWidth = 7;
    g.strokeRect(-tw / 2 + 10, -74, tw - 20, 98);
    g.fillStyle = "#fff";
    g.textAlign = "center";
    g.textBaseline = "alphabetic";
    g.fillText(text, 0, 2);
    g.restore();
  }
  function howTo(a, step) {
    g.save();
    g.globalAlpha = a;
    const gr = g.createLinearGradient(0, 640, 0, 1480);
    gr.addColorStop(0, "rgba(8,6,18,0)");
    gr.addColorStop(0.18, "rgba(8,6,18,0.8)");
    gr.addColorStop(1, "rgba(8,6,18,0.88)");
    g.fillStyle = gr;
    g.fillRect(0, 640, W, 840);
    g.shadowColor = "rgba(255,170,40,0.5)";
    g.shadowBlur = 26;
    line([["КАК ЗАЙТИ", ["#FFF27A", "#FF9F1C"]]], W / 2, 820, 76, 13);
    g.shadowBlur = 0;
    const rows = [
      [["Сетевая игра → ", "#FFFFFF"], ["Добавить", "#FFFFFF"]],
      [["POG.MORECUBE.RU", ["#FFF27A", "#FF9F1C"]]],
      [["/code PODAROK", ["#B6FFC4", "#2EE65C"]], [" → донат", "#FF4FA3"]],
    ];
    rows.forEach((r, i) => {
      const k = Math.max(0, Math.min(1, step - i));
      if (k <= 0) return;
      const y = 960 + i * 150;
      g.save();
      g.globalAlpha = a * k;
      g.translate((1 - k) * 80, 0);
      g.fillStyle = i === 2 ? "#2EE65C" : "#FF9F1C";
      g.beginPath();
      g.arc(150, y - 22, 40, 0, Math.PI * 2);
      g.fill();
      line([[String(i + 1), "#140C04"]], 150, y, 52, 0);
      line(r, 210, y, i === 1 ? 70 : 54, 10, "left");
      g.restore();
    });
    g.restore();
  }

  function draw(st) {
    g.clearRect(0, 0, W, H);
    if (st.rewind) {
      g.fillStyle = `rgba(255,255,255,${0.08 * st.rewind})`;
      for (let y = 0; y < H; y += 9) if ((y * 7) % 23 < 4) g.fillRect(0, y, W, 2);
    }
    for (const o of st.overlays || []) {
      const k = typeof o === "string" ? o : o.k;
      if (!img[k]) continue;
      g.save();
      g.globalAlpha = typeof o === "string" ? 1 : o.a ?? 1;
      g.drawImage(img[k], 0, typeof o === "string" ? st.overlayY || 0 : o.y ?? 0, W, H);
      g.restore();
    }
    if (st.header !== false) header();
    if (st.stamp) stamp(st.stamp);
    if (st.price) price(st.price[0], st.price[1], st.priceY, st.priceS ?? 1, st.strike ?? 1);
    if (st.subscribe) subscribe(st.subscribe[0], st.subscribe[1], st.subscribe[2] ?? 1, st.subscribe[3] ?? 0);
    if (st.endcard) endcard(typeof st.endcard === "number" ? st.endcard : 1);
    if (st.score) score(st.score);
    if (st.codeHint > 0) codeHint(st.codeHint);
    if (st.bigScore > 0) bigScore(st.bigScore, ...(st.bigScoreLR || [4, 0]));
    if (st.endcard2 > 0) endcard2(st.endcard2, st.slots ?? 0, st.flashK ?? 0);
    if (st.copyLabel && st.copyLabel.a > 0) copyLabel(st.copyLabel);
    if (st.warn > 0) warn(st.warn);
    if (st.howTo > 0) howTo(st.howTo, st.howStep ?? 3);
    if (st.caption) caption(st.caption, st.capPop ?? 1);
    tex.needsUpdate = true;
  }
  return { tex, draw, canvas: c };
}
