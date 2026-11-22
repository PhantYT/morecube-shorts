// Math, easing, keyframes, seeded noise and canvas textures shared by every module.
import * as THREE from "./three.js";
import { mergeVertices } from "https://cdn.jsdelivr.net/npm/three@0.184.0/examples/jsm/utils/BufferGeometryUtils.js/+esm";

export const PI = Math.PI;
export const TAU = Math.PI * 2;
export const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
export const lerp = (a, b, t) => a + (b - a) * t;
export const prog = (t, a, b) => clamp((t - a) / (b - a));
export const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
// 0 -> 1 -> 0 over [a, d] with ramps [a, b] and [c, d]
export const window4 = (t, a, b, c, d) => (t < a || t > d ? 0 : t < b ? (t - a) / (b - a) : t <= c ? 1 : 1 - (t - c) / (d - c));

export const E = {
  lin: (t) => t,
  in2: (t) => t * t,
  out2: (t) => 1 - (1 - t) * (1 - t),
  io2: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  in3: (t) => t * t * t,
  out3: (t) => 1 - Math.pow(1 - t, 3),
  io3: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  in4: (t) => t * t * t * t,
  out4: (t) => 1 - Math.pow(1 - t, 4),
  outExpo: (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  inExpo: (t) => (t <= 0 ? 0 : Math.pow(2, 10 * t - 10)),
  outBack: (t) => {
    const c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
  outBack2: (t) => {
    const c1 = 3.2, c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
  inBack: (t) => {
    const c1 = 1.70158, c3 = c1 + 1;
    return c3 * t * t * t - c1 * t * t;
  },
  outElastic: (t) => (t <= 0 ? 0 : t >= 1 ? 1 : Math.pow(2, -10 * t) * Math.sin(((t * 10 - 0.75) * TAU) / 3) + 1),
  sine: (t) => -(Math.cos(PI * t) - 1) / 2,
  step: (t) => (t < 1 ? 0 : 1),
};

// keys: [[time, value, ease]]; the ease shapes the segment that ends on that key.
export function kf(t, keys) {
  const n = keys.length;
  if (t <= keys[0][0]) return keys[0][1];
  if (t >= keys[n - 1][0]) return keys[n - 1][1];
  for (let i = 1; i < n; i++) {
    const k1 = keys[i];
    if (t <= k1[0]) {
      const k0 = keys[i - 1];
      const p = E[k1[2] || "io2"]((t - k0[0]) / (k1[0] - k0[0]));
      const a = k0[1], b = k1[1];
      if (Array.isArray(a)) return a.map((x, j) => x + (b[j] - x) * p);
      return a + (b - a) * p;
    }
  }
  return keys[n - 1][1];
}

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function hash1(n) {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}
export function vnoise(x, seed = 0) {
  const i = Math.floor(x), f = x - i;
  const a = hash1(i + seed * 57.31), b = hash1(i + 1 + seed * 57.31);
  const u = f * f * (3 - 2 * f);
  return a + (b - a) * u;
}
export const snoise = (x, seed = 0) => vnoise(x, seed) * 2 - 1;
// 3D value noise for rock displacement
function h3(x, y, z, s) {
  const v = Math.sin(x * 127.1 + y * 311.7 + z * 74.7 + s * 19.19) * 43758.5453;
  return v - Math.floor(v);
}
export function noise3(x, y, z, s = 0) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = x - xi, yf = y - yi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
  let r = 0;
  for (let dz = 0; dz < 2; dz++)
    for (let dy = 0; dy < 2; dy++)
      for (let dx = 0; dx < 2; dx++) {
        const c = h3(xi + dx, yi + dy, zi + dz, s);
        r += c * (dx ? u : 1 - u) * (dy ? v : 1 - v) * (dz ? w : 1 - w);
      }
  return r * 2 - 1;
}
export function fbm3(x, y, z, s = 0, oct = 3) {
  let a = 0.5, f = 1, r = 0;
  for (let i = 0; i < oct; i++) {
    r += a * noise3(x * f, y * f, z * f, s + i * 13);
    a *= 0.5;
    f *= 2.03;
  }
  return r;
}
// camera / hit shake, deterministic in t
export const shake = (t, amp, freq = 16, seed = 0) => [
  snoise(t * freq, seed + 1) * amp,
  snoise(t * freq, seed + 2) * amp,
  snoise(t * freq, seed + 3) * amp,
];

export const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

export function canvasTex(w, h, draw, opts = {}) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d");
  draw(g, w, h);
  const tex = new THREE.CanvasTexture(c);
  if (opts.srgb !== false) tex.colorSpace = THREE.SRGBColorSpace;
  if (opts.repeat) {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(opts.repeat[0], opts.repeat[1]);
  }
  tex.anisotropy = 8;
  return tex;
}

export const softDot = () =>
  canvasTex(128, 128, (g) => {
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, "rgba(255,255,255,1)");
    gr.addColorStop(0.35, "rgba(255,255,255,0.55)");
    gr.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = gr;
    g.fillRect(0, 0, 128, 128);
  });

export const shadowBlob = () =>
  canvasTex(128, 128, (g) => {
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, "rgba(0,0,0,0.6)");
    gr.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = gr;
    g.fillRect(0, 0, 128, 128);
  });

// Voronoi crack lines, used as an emissive map on lava creatures and rocks
export function crackTex(seed = 7, cells = 46, size = 512) {
  return canvasTex(size, size, (g, w, h) => {
    const rnd = mulberry32(seed);
    const pts = [];
    for (let i = 0; i < cells; i++) pts.push([rnd() * w, rnd() * h]);
    const img = g.createImageData(w, h);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        let d1 = 1e9, d2 = 1e9;
        for (const [px, py] of pts) {
          for (let ox = -w; ox <= w; ox += w) {
            const dx = x - px - ox, dy = y - py;
            const d = dx * dx + dy * dy;
            if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
          }
        }
        const e = Math.sqrt(d2) - Math.sqrt(d1);
        const v = clamp(1 - e / 5.5);
        const k = (y * w + x) * 4;
        img.data[k] = 255 * Math.pow(v, 0.8);
        img.data[k + 1] = 150 * Math.pow(v, 1.6);
        img.data[k + 2] = 40 * Math.pow(v, 3);
        img.data[k + 3] = 255;
      }
    g.putImageData(img, 0, 0);
  });
}

export function noiseTex(seed, size, c0, c1, scale = 8, repeat = [1, 1]) {
  return canvasTex(
    size,
    size,
    (g, w, h) => {
      const img = g.createImageData(w, h);
      const a = new THREE.Color(c0), b = new THREE.Color(c1);
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
          // tileable: sample noise on a torus
          const u = (x / w) * TAU, v = (y / h) * TAU;
          const n =
            fbm3(Math.cos(u) * scale * 0.16, Math.sin(u) * scale * 0.16, Math.cos(v) * scale * 0.16 + Math.sin(v) * 0.7, seed, 4) * 0.9 + 0.5;
          const m = clamp(n);
          const k = (y * w + x) * 4;
          img.data[k] = (a.r + (b.r - a.r) * m) * 255;
          img.data[k + 1] = (a.g + (b.g - a.g) * m) * 255;
          img.data[k + 2] = (a.b + (b.b - a.b) * m) * 255;
          img.data[k + 3] = 255;
        }
      g.putImageData(img, 0, 0);
    },
    { repeat },
  );
}

export function mesh(geo, mat, cast = true) {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = cast;
  m.receiveShadow = true;
  return m;
}

// rounded "pebble": icosphere displaced by smooth noise, normals recomputed for soft shading
export function pebbleGeo(seed, detail = 4, amp = 0.22, freq = 1.6) {
  let g = new THREE.IcosahedronGeometry(1, detail);
  g.deleteAttribute("normal");
  g.deleteAttribute("uv");
  g = mergeVertices(g);
  const p = g.attributes.position;
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    uv[i * 2] = Math.atan2(z, x) / TAU + 0.5;
    uv[i * 2 + 1] = Math.asin(clamp(y, -1, 1)) / PI + 0.5;
    const n = fbm3(x * freq, y * freq, z * freq, seed, 3);
    const s = 1 + n * amp;
    p.setXYZ(i, x * s, y * s, z * s);
  }
  g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  g.computeVertexNormals();
  return g;
}

// tapered tube along a curve: radiusFn(s) with s in [0, 1]
export function taperTube(curve, segs, radial, radiusFn) {
  const frames = curve.computeFrenetFrames(segs, false);
  const pos = [], nor = [], uv = [], idx = [];
  const P = new THREE.Vector3(), N = new THREE.Vector3();
  for (let i = 0; i <= segs; i++) {
    const s = i / segs;
    curve.getPointAt(s, P);
    const r = radiusFn(s);
    const n = frames.normals[i], b = frames.binormals[i];
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * TAU;
      const sin = Math.sin(a), cos = -Math.cos(a);
      N.set(cos * n.x + sin * b.x, cos * n.y + sin * b.y, cos * n.z + sin * b.z).normalize();
      pos.push(P.x + r * N.x, P.y + r * N.y, P.z + r * N.z);
      nor.push(N.x, N.y, N.z);
      uv.push(s, j / radial);
    }
  }
  for (let i = 0; i < segs; i++)
    for (let j = 0; j < radial; j++) {
      const a = i * (radial + 1) + j, b = (i + 1) * (radial + 1) + j;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export const glsl = {
  hsv: /* glsl */ `
    vec3 hsv2rgb(vec3 c){ vec3 p = abs(fract(c.xxx + vec3(0.0, 2.0/3.0, 1.0/3.0)) * 6.0 - 3.0); return c.z * mix(vec3(1.0), clamp(p - 1.0, 0.0, 1.0), c.y); }`,
  noise: /* glsl */ `
    float hh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float vn(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.0-2.0*f);
      return mix(mix(hh(i), hh(i+vec2(1,0)), u.x), mix(hh(i+vec2(0,1)), hh(i+vec2(1,1)), u.x), u.y); }
    float fbm(vec2 p){ float a = 0.5, r = 0.0; for (int i = 0; i < 5; i++){ r += a * vn(p); p = p * 2.03 + 17.1; a *= 0.5; } return r; }`,
};
