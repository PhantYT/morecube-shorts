// Episode 1 «Перевёрнутый молоток»: the server twin (spawn) + the plains world, _pogostik_ always seen from the
// outside (animation style), floating /codes panel, the MoreDick structure, roulette, the giant hammer.
// SHOTS hold one function per shot of local time; window.__dbg.still(i) renders shot i at its storyboard key.
import * as THREE from "./three.js";
import { clamp, lerp, E, mulberry32 } from "./lib.js";
import { WU, loadWorld } from "./world.js";
import { buildSky, buildClouds } from "./sky.js";
import { makePost } from "./post.js";
import { loadEntities } from "./holo.js";
import { makePlayer, walkPose, PX } from "./player.js";
import { makeHud } from "./hud.js";

const host = window.__world || (window.__world = {});
const W = 1080, H = 1920;
const BASE = "assets/data/";
const EP = BASE + "ep01/";

const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById("world-canvas"), antialias: false, preserveDrawingBuffer: true, powerPreference: "high-performance" });
renderer.setPixelRatio(1);
renderer.setSize(W, H, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;

const loader = new THREE.TextureLoader();
async function atlasTex(p) {
  const t = await loader.loadAsync(p);
  t.flipY = false;
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  t.needsUpdate = true;
  return t;
}
async function pix(p) {
  const t = await loader.loadAsync(p);
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.anisotropy = 8;
  return t;
}

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, W / H, 0.05, 3000);
const post = makePost(renderer, scene, camera, W, H);

function bakeEnv(zen, hor, gnd, sunDir) {
  const s = new THREE.Scene();
  s.add(new THREE.Mesh(new THREE.SphereGeometry(100, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: { uZen: { value: new THREE.Color(zen) }, uHor: { value: new THREE.Color(hor) }, uGnd: { value: new THREE.Color(gnd) }, uSun: { value: sunDir.clone().normalize() } },
    vertexShader: `varying vec3 vD; void main(){ vD = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform vec3 uZen, uHor, uGnd, uSun; varying vec3 vD; void main(){ vec3 d = normalize(vD); vec3 c = mix(uHor, uZen, pow(clamp(d.y, 0.0, 1.0), 0.5)); c = mix(c, uGnd, smoothstep(0.0, -0.25, d.y)); c += vec3(1.0, 0.7, 0.4) * pow(clamp(dot(d, uSun), 0.0, 1.0), 48.0) * 7.0; gl_FragColor = vec4(c, 1.0); }`,
  })));
  const pm = new THREE.PMREMGenerator(renderer);
  const rt = pm.fromScene(s, 0, 0.1, 200);
  pm.dispose();
  return rt.texture;
}
const SUN_SPAWN = new THREE.Vector3(0.55, 0.42, 0.72).normalize();
const SUN_PLAINS = new THREE.Vector3(0.18, 0.15, -0.97).normalize();
const env = bakeEnv("#4677c9", "#f4c494", "#5d5048", SUN_SPAWN);

const [spawnAtlas, plainsAtlas] = await Promise.all([atlasTex(BASE + "atlas.png"), atlasTex(BASE + "plains/atlas.png")]);
const spawn = await loadWorld(BASE, spawnAtlas, env);
const plains = await loadWorld(BASE + "plains/", plainsAtlas, env);
scene.add(spawn.group, plains.group);
const sky = buildSky();
scene.add(sky.group);
const clouds = buildClouds();
scene.add(clouds.mesh);
const ents = await loadEntities(BASE, loader);
scene.add(ents.group);

// light volumes (spawn + plains)
async function lightVol(base) {
  const J = await (await fetch(base + "light.json", { cache: "no-cache" })).json();
  const B = new Uint8Array(await (await fetch(base + "light.bin", { cache: "no-cache" })).arrayBuffer());
  return { J, B };
}
const LV = [await lightVol(BASE), await lightVol(BASE + "plains/")];
function lightAt(x, y, z) {
  for (const { J, B } of LV) {
    const ix = Math.floor(x) - J.x0, iy = Math.floor(y) - J.y0, iz = Math.floor(z) - J.z0;
    if (ix < 0 || iy < 0 || iz < 0 || ix >= J.nx || iy >= J.ny || iz >= J.nz) continue;
    const i = ((iy * J.nz + iz) * J.nx + ix) * 2;
    return [B[i] / 15, B[i + 1] / 15];
  }
  return [1, 0];
}
// ground: highest cell under (x,z) that the sky can't pass (spawn volume only)
function groundY(x, z, from = 110) {
  const { J, B } = LV[0];
  const ix = Math.floor(x) - J.x0, iz = Math.floor(z) - J.z0;
  for (let y = Math.min(from, J.y0 + J.ny - 1); y > J.y0; y--) {
    const i = (((y - J.y0) * J.nz + iz) * J.nx + ix) * 2;
    if (B[i] === 0 && B[i + 1] === 0) return y + 1;
  }
  return 85;
}
for (const n of ents.npcs) if (n.model) n.model.light(...lightAt(n.pos[0], n.pos[1] + 1.4, n.pos[2]));

/* ------------------------------------------------------------------ characters */
const E_ = ents.E;
const heroSkin = await loader.loadAsync(BASE + E_.npcs.find((n) => n.id === "тиктокер").skin);
const hero = makePlayer({ skin: heroSkin, slim: false });
scene.add(hero.root);
const extraSkins = ["барыга", "киллер", "фри", "аукцион", "рынок", "шахтер"].map((id) => E_.npcs.find((n) => n.id === id)).filter(Boolean);
const extras = [];
for (const n of extraSkins) {
  const P = makePlayer({ skin: await loader.loadAsync(BASE + n.skin), slim: n.slim });
  P.set({ visible: false });
  scene.add(P.root);
  extras.push(P);
}

/* ------------------------------------------------------------------ props */
const T = {};
for (const k of ["gold_block", "diamond", "netherite_ingot", "totem", "golden_apple", "ender_pearl", "xp_bottle", "diamond_sword", "emerald", "gold_ingot", "netherite_sword", "chest_item", "particle_star", "particle_spark"])
  T[k] = await pix(EP + "tex/" + k + ".png");
const goldMat = new THREE.MeshStandardMaterial({ map: T.gold_block, metalness: 0.55, roughness: 0.3, envMap: env, envMapIntensity: 1.15, emissive: new THREE.Color(1.0, 0.62, 0.1), emissiveIntensity: 0.06 });
const box = new THREE.BoxGeometry(1, 1, 1);
const blocks = [];
for (let i = 0; i < 20; i++) {
  const m = new THREE.Mesh(box, goldMat);
  m.castShadow = m.receiveShadow = true;
  m.visible = false;
  scene.add(m);
  blocks.push(m);
}
const ghostMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.22, depthWrite: false });
const ghost = new THREE.Mesh(box, ghostMat);
const ghostEdge = new THREE.LineSegments(new THREE.EdgesGeometry(box), new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 }));
ghost.add(ghostEdge);
ghost.visible = false;
scene.add(ghost);
const handBlock = new THREE.Mesh(box, goldMat);
handBlock.scale.setScalar(0.36);
handBlock.position.set(0, -0.12, 0.08);
handBlock.castShadow = true;
hero.hand.add(handBlock);

// floating panel + tooltip + glow
function planeTex(tex, w, h, opts = {}) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false, depthWrite: false, side: THREE.DoubleSide, ...opts }));
  m.renderOrder = 6;
  return m;
}
const panelTex = { plain: await pix(EP + "panel_codes_full.png"), free: await pix(EP + "panel_codes_free_full.png"), pog: await pix(EP + "panel_codes_pog_full.png") };
const tipTex = { free: await pix(EP + "tip_free.png"), pog: await pix(EP + "tip_pog.png") };
const panel = new THREE.Group();
const panelPlane = planeTex(panelTex.free, 2.8, 2.8);
const glowC = document.createElement("canvas");
glowC.width = glowC.height = 128;
{
  const g = glowC.getContext("2d");
  const gr = g.createRadialGradient(64, 64, 8, 64, 64, 64);
  gr.addColorStop(0, "rgba(255,190,90,0.9)");
  gr.addColorStop(1, "rgba(255,120,30,0)");
  g.fillStyle = gr;
  g.fillRect(0, 0, 128, 128);
}
const glow = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 3.6), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(glowC), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, opacity: 0.55 }));
glow.position.z = -0.02;
glow.renderOrder = 5;
panel.add(glow, panelPlane);
const tipPlane = planeTex(tipTex.free, 1.0 * (796 / 616), 1.0);
panel.add(tipPlane);
panel.visible = false;
scene.add(panel);

// billboard text lines (nametag style)
async function tagMesh(name, hMeters) {
  const t = await pix(EP + name + ".png");
  const m = planeTex(t, (t.image.width / t.image.height) * hMeters, hMeters);
  m.visible = false;
  scene.add(m);
  return m;
}
const tags = { plain: await tagMesh("tag_plain", 0.3), dhelper: await tagMesh("tag_dhelper", 0.3), hydra: await tagMesh("tag_hydra", 0.3), cmd: await tagMesh("cmd_codes", 0.34) };

// phone in the hand
const phone = new THREE.Group();
const phoneBody = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.36, 0.03), new THREE.MeshStandardMaterial({ color: 0x15161c, roughness: 0.35, metalness: 0.3 }));
const phoneScr = planeTex(await pix(EP + "phone_screen.png"), 0.18, 0.32);
phoneScr.material.depthWrite = true;
phoneScr.position.z = 0.016;
phone.add(phoneBody, phoneScr);
phone.visible = false;
hero.hand.add(phone);

// item sprites (loot, cases)
const itemKeys = ["diamond", "netherite_ingot", "totem", "golden_apple", "ender_pearl", "xp_bottle", "diamond_sword", "emerald", "gold_ingot", "netherite_sword"];
const sprites = [];
for (let i = 0; i < 140; i++) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: T[itemKeys[i % itemKeys.length]], transparent: true, alphaTest: 0.3 }));
  s.visible = false;
  s.scale.setScalar(0.45);
  scene.add(s);
  sprites.push(s);
}
const caseSprites = [0, 1].map(() => {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: T.chest_item, transparent: true, alphaTest: 0.3 }));
  s.material.map = T.chest_item.clone();
  s.material.map.repeat.set(14 / 64, 14 / 64);
  s.material.map.offset.set(14 / 64, 1 - (19 + 14) / 64);
  s.material.map.needsUpdate = true;
  s.visible = false;
  s.scale.setScalar(0.5);
  scene.add(s);
  return s;
});

// glow particles (sparkles, fireworks, portal swirl, absorption)
const NP = 1600;
const pGeo = new THREE.BufferGeometry();
const pPos = new Float32Array(NP * 3), pCol = new Float32Array(NP * 3), pSize = new Float32Array(NP);
pGeo.setAttribute("position", new THREE.BufferAttribute(pPos, 3));
pGeo.setAttribute("color", new THREE.BufferAttribute(pCol, 3));
pGeo.setAttribute("aSize", new THREE.BufferAttribute(pSize, 1));
const pMat = new THREE.ShaderMaterial({
  uniforms: { uTex: { value: T.particle_star }, uScale: { value: H / 2 } },
  vertexShader: `attribute float aSize; attribute vec3 color; varying vec3 vC; uniform float uScale; void main(){ vC = color; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = aSize * uScale / max(-mv.z, 0.1); }`,
  fragmentShader: `uniform sampler2D uTex; varying vec3 vC; void main(){ vec4 t = texture2D(uTex, gl_PointCoord); if (t.a < 0.05) discard; gl_FragColor = vec4(vC * t.rgb * t.a, 1.0); }`,
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
});
const points = new THREE.Points(pGeo, pMat);
points.frustumCulled = false;
points.renderOrder = 7;
scene.add(points);
let np = 0;
function pReset() { np = 0; }
function pAdd(x, y, z, r, g, b, s) {
  if (np >= NP) return;
  pPos[np * 3] = x; pPos[np * 3 + 1] = y; pPos[np * 3 + 2] = z;
  pCol[np * 3] = r; pCol[np * 3 + 1] = g; pCol[np * 3 + 2] = b;
  pSize[np] = s;
  np++;
}
function pCommit() {
  pGeo.setDrawRange(0, np);
  pGeo.attributes.position.needsUpdate = pGeo.attributes.color.needsUpdate = pGeo.attributes.aSize.needsUpdate = true;
}

// hidden code: MOLOTOK in white blocks on a far slope (5x7 letters)
const FONT5 = {
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"], O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"], T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
};
const codeMat = new THREE.MeshStandardMaterial({ color: 0xf3f1ea, roughness: 0.6, emissive: 0xfff4e0, emissiveIntensity: 0.25 });
const codeGroup = new THREE.Group();
{
  const word = "MOLOTOK";
  let cx = 0;
  const geo = [];
  for (const ch of word) {
    const rows = FONT5[ch];
    rows.forEach((row, ry) => [...row].forEach((v, rx) => { if (v === "1") geo.push([cx + rx, 6 - ry]); }));
    cx += 6;
  }
  const inst = new THREE.InstancedMesh(box, codeMat, geo.length);
  const M = new THREE.Matrix4();
  geo.forEach(([x, y], i) => { M.makeTranslation(x + 0.5, y + 0.5, 0); inst.setMatrixAt(i, M); });
  inst.castShadow = true;
  codeGroup.add(inst);
  codeGroup.position.set(2060, 67, -24);
  codeGroup.rotation.set(-0.08, 1.13, 0);
  codeGroup.scale.setScalar(0.75);
}
scene.add(codeGroup);

// the video's code on an oak sign next to the build (front = rendered board with the text)
const signTex = await pix(EP + "sign_code.png");
const oakTex = await pix(EP + "tex/sign_oak.png");
const oakSide = oakTex.clone();
oakSide.repeat.set(2 / 64, 12 / 32);
oakSide.offset.set(0, 1 - 14 / 32);
oakSide.needsUpdate = true;
const signGroup = new THREE.Group();
{
  const side = new THREE.MeshStandardMaterial({ map: oakSide, roughness: 0.85 });
  const front = new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.85 });
  const board = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.5, 0.083), [side, side, side, side, front, side]);
  board.position.y = 0.83;
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.083, 0.58, 0.083), side);
  post.position.y = 0.29;
  board.castShadow = post.castShadow = true;
  signGroup.add(board, post);
}
signGroup.visible = false;
scene.add(signGroup);

/* ------------------------------------------------------------------ lights */
const hemi = new THREE.HemisphereLight(0xc4d6f5, 0x7a6252, 1.45);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffcf98, 3.3);
sun.castShadow = true;
sun.shadow.mapSize.set(4096, 4096);
sun.shadow.bias = -0.0003;
sun.shadow.normalBias = 0.03;
sun.shadow.radius = 2;
scene.add(sun, sun.target);

/* ------------------------------------------------------------------ HUD */
const hud = await makeHud(W, H, {
  built: EP + "title_built.png", roulette: EP + "title_roulette.png", win: EP + "title_win.png",
  sub_hydra: EP + "sub_hydra.png", sub_tiger: EP + "sub_tiger.png", sub_case: EP + "sub_case.png", sub_r300: EP + "sub_r300.png",
  sub_vampire: EP + "sub_vampire.png", sub_bunny: EP + "sub_bunny.png", sub_rabbit: EP + "sub_rabbit.png",
});
post.fin.tHud.value = hud.tex;
const phoneTex = [await pix(EP + "phone_screen_1.png"), await pix(EP + "phone_screen_2.png"), await pix(EP + "phone_screen_3.png")];
const TLD = await (await fetch(EP + "timeline.json", { cache: "no-cache" })).json();
const MK = TLD.marks;

/* ------------------------------------------------------------------ helpers */
const v3 = (a) => new THREE.Vector3(a[0], a[1], a[2]);
const D2R = Math.PI / 180;
const SITE = [2112, 73, 0]; // structure base row x 2111..2113 at y 73, z 0 (hilltop)
const HAMMER = [[-1, 0], [0, 0], [1, 0], [0, 1], [0, 2]];
const HERO_SITE = [2114.3, 73, 0.6];
let SPAWN_Y = 85;
const GIANT_C = [36, 0, 0];
const SY = SITE[1];
const SUN_HOOK = new THREE.Vector3(0.55, 0.2, 0.81).normalize();
const cl = (x) => Math.max(0, Math.min(1, x));
const sm = (x) => { const k = cl(x); return k * k * (3 - 2 * k); };
const L3 = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
const fadeA = (lt, tin, tout, fi = 0.1, fo = 0.15) => cl((lt - tin) / fi) * (1 - cl((lt - tout) / fo));
const SUBS = ["sub_tiger", "sub_bunny", "sub_vampire", "sub_rabbit", "sub_hydra", "sub_case", "sub_r300"];
let FX = {};

function hideAll() {
  hero.set({ visible: false });
  for (const P of extras) P.set({ visible: false });
  for (const b of blocks) { b.visible = false; b.scale.setScalar(1); }
  ghost.visible = false;
  panel.visible = false;
  panel.scale.set(1, 1, 1);
  tipPlane.visible = true;
  tipPlane.scale.setScalar(1);
  phone.visible = false;
  handBlock.visible = false;
  for (const k in tags) { tags[k].visible = false; tags[k].scale.setScalar(1); }
  for (const s of sprites) s.visible = false;
  for (const s of caseSprites) s.visible = false;
  codeGroup.visible = false;
  signGroup.visible = false;
  goldMat.emissiveIntensity = 0.06;
  FX = {};
  pReset();
}
function pose(P, x, y, z, yawMC, extra = {}) {
  P.set({ x, y, z, yaw: -yawMC * D2R, ...extra });
  P.light(...lightAt(x, y + 1.4, z));
}
function placeHammer(n, scale = 1, center = SITE) {
  for (let i = 0; i < 5; i++) {
    const b = blocks[i];
    if (i >= n) { b.visible = false; continue; }
    const [dx, dy] = HAMMER[i];
    b.visible = true;
    b.scale.setScalar(scale);
    b.position.set(center[0] + (dx + 0.5) * scale, center[1] + (dy + 0.5) * scale, center[2] + 0.5 * scale);
    b.rotation.set(0, 0, 0);
  }
}
function tag(which, x, y, z, s = 1) {
  const m = tags[which];
  m.visible = s > 0.01;
  m.position.set(x, y + 2.15, z);
  m.scale.setScalar(Math.max(0.01, s));
}
function sparkle(cx, cy, cz, n, rad, seed, col = [1.6, 1.2, 0.5], size = 0.12) {
  const r = mulberry32(seed);
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2, u = r() * 2 - 1, d = rad * Math.cbrt(r());
    const s = Math.sqrt(1 - u * u);
    pAdd(cx + Math.cos(a) * s * d, cy + u * d, cz + Math.sin(a) * s * d, col[0], col[1], col[2], size * (0.5 + r()));
  }
}
function dust(cx, cy, cz, s, seed, n = 46, col = [0.9, 0.82, 0.62]) {
  if (s < 0 || s > 1.2) return;
  const r = mulberry32(seed);
  const f = Math.exp(-s * 3.2);
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2, up = r() * 0.6, sp = 0.6 + r() * 2.2;
    pAdd(cx + Math.cos(a) * sp * E.out3(cl(s / 0.8)), cy + up * s * 1.5 - 0.45, cz + Math.sin(a) * sp * E.out3(cl(s / 0.8)), col[0] * f, col[1] * f, col[2] * f, 0.1 + r() * 0.08);
  }
}
function firework(cx, cy, cz, t, seed, col) {
  if (t < -0.45) return;
  if (t < 0) { // rocket trail
    const k = 1 + t / 0.45;
    for (let i = 0; i < 10; i++) pAdd(cx, cy - 9 * (1 - k) - i * 0.25, cz, 1.6, 1.2, 0.8, 0.12 * (1 - i / 10));
    return;
  }
  const r = mulberry32(seed);
  const rad = 4.2 * E.out3(cl(t / 0.9));
  const fade = cl(1.4 - t);
  for (let i = 0; i < 90; i++) {
    const a = r() * Math.PI * 2, u = r() * 2 - 1, s = Math.sqrt(1 - u * u);
    const k = 0.75 + 0.25 * r();
    pAdd(cx + Math.cos(a) * s * rad * k, cy + u * rad * k - t * t * 0.8, cz + Math.sin(a) * s * rad * k, col[0] * fade, col[1] * fade, col[2] * fade, 0.55);
  }
}
function shake(lt, t0, amp, decay = 7) {
  if (lt < t0) return [0, 0, 0];
  const a = amp * Math.exp(-(lt - t0) * decay);
  return [Math.sin(lt * 61) * a, Math.sin(lt * 47 + 1) * a, Math.sin(lt * 53 + 2) * a * 0.5];
}
const add3 = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
// the five blocks flying into the hero (k: 0 = built, 1 = absorbed)
function absorb(k) {
  for (let i = 0; i < 5; i++) {
    const [dx, dy] = HAMMER[i];
    const ki = cl(k * 1.15 - (4 - i) * 0.04);
    if (ki >= 1) { blocks[i].visible = false; continue; }
    const from = v3([SITE[0] + dx + 0.5, SY + dy + 0.5, SITE[2] + 0.5]);
    const to = v3([HERO_SITE[0], SY + 1.3, HERO_SITE[2]]);
    const p = from.clone().lerp(to, E.in2(ki));
    const a = ki * 6 + i * 1.25;
    p.x += Math.cos(a) * Math.sin(ki * Math.PI) * 0.9;
    p.z += Math.sin(a) * Math.sin(ki * Math.PI) * 0.9;
    const b = blocks[i];
    b.visible = true;
    b.position.copy(p);
    b.scale.setScalar(1 - 0.75 * ki);
    b.rotation.set(a * ki, a * 0.7 * ki, 0);
    if (ki > 0.02) sparkle(p.x, p.y, p.z, 14, 0.45, 20 + i + Math.floor(k * 20), [1.8, 1.3, 0.5], 0.1);
  }
}

/* ------------------------------------------------------------------ shots (times come from the voiceover) */
const SHOTS = [
  { id: "K1", label: "Хук: золотой «молоток» на вершине холма, рядом _pogostik_",
    run(lt, dur) {
      placeHammer(5);
      const drop = cl(lt / 0.3);
      blocks[4].position.y += (1 - E.in2(drop)) * 2.6;
      blocks[4].rotation.set(0, (1 - drop) * 0.7, 0);
      const look = sm((lt - 1.3) / 0.45);
      pose(hero, HERO_SITE[0], SY, 0.8, 20, { hP: -0.05 + 0.03 * Math.sin(lt * 2.2), hY: -0.35 + 0.45 * look, aRx: -0.15, aLx: 0.1, aRz: 0.1 + 0.02 * Math.sin(lt * 2), aLz: -0.1 });
      tag("plain", HERO_SITE[0], SY, 0.8);
      sparkle(2112.5, SY + 1.6, 0.5, 50, 2.2, 3 + Math.floor(lt * 7));
      dust(2112.5, SY + 2.0, 0.5, lt - 0.3, 11);
      FX.flash = lt >= 0.3 ? 0.3 * Math.exp(-(lt - 0.3) * 9) : 0;
      const k = E.out3(cl(lt / dur));
      const cam = add3(L3([2113.5, SY + 0.42, 6.2], [2112.9, SY + 0.66, 8.9], k), shake(lt, 0.3, 0.07));
      return { cam, tgt: [2112.95, SY + 1.58 + 0.1 * k, 0.4], fov: 50, sun: SUN_HOOK, shadow: { c: [2112, SY, 0], r: 22 }, focus: 6.6 + 2.0 * k, aper: 0.22 };
    } },
  { id: "K2", label: "Блоки влетают в героя, титул MoreDick, рулетка обрывается",
    run(lt, dur) {
      const freeze = dur - 0.3;
      const lw = Math.min(lt, freeze);
      const kA = cl(lw / 0.9);
      absorb(E.in2(kA));
      pose(hero, ...HERO_SITE, 35, { hP: -0.25, hY: 0.45, aRx: -0.3 - 0.45 * kA, aLx: -0.3 - 0.45 * kA, aRz: 0.35 + 0.35 * kA, aLz: -0.35 - 0.35 * kA });
      sparkle(HERO_SITE[0], SY + 1.3, HERO_SITE[2], 30 + Math.floor(70 * kA), 0.6 + 0.6 * kA, 9 + Math.floor(lw * 9), [2.0, 1.4, 0.6], 0.09);
      const titleA = fadeA(lt, 0.12, 1.0, 0.1, 0.12);
      const ov = [];
      if (titleA > 0) ov.push({ k: "built", a: titleA, y: -150 });
      if (lt >= 1.05) {
        const n = Math.floor((lw - 1.05) / 0.085);
        ov.push({ k: "roulette", a: 1, y: -330 }, { k: SUBS[((n % SUBS.length) + SUBS.length) % SUBS.length], a: 1, y: -330 });
      }
      if (lt >= freeze) FX.freeze = 1;
      const k = E.io2(cl(lw / dur));
      return { cam: L3([2117.4, SY + 1.0, 6.2], [2116.6, SY + 1.1, 5.3], k), tgt: [2113.8, SY + 1.75, 0.4], fov: 50, sun: SUN_HOOK, shadow: { c: [2113, SY, 0], r: 22 }, focus: 6.4, aper: 0.3,
        hud: { overlays: ov, noCaption: titleA > 0.05 } };
    } },
  { id: "K3", label: "Перемотка назад, штамп «ЧАС НАЗАД»",
    run(lt, dur) {
      for (let i = 0; i < 5; i++) {
        const [dx, dy] = HAMMER[i];
        const s = cl((lt - (4 - i) * 0.16 - 0.15) / 0.45);
        if (s >= 1) continue;
        const b = blocks[i];
        b.visible = true;
        b.position.set(SITE[0] + dx + 0.5, SY + dy + 0.5 + E.in2(s) * 7, SITE[2] + 0.5 + s * 1.5);
        b.rotation.set(s * 3, s * 2, 0);
      }
      const x = HERO_SITE[0] + E.in2(cl(lt / dur)) * 2.4;
      pose(hero, x, SY, 0.8, 20, { ...walkPose(-lt * 2.2, 0.9) });
      const k = cl(lt / dur);
      FX.rewind = 1;
      return { cam: L3([2112.9, SY + 0.66, 8.9], [2113.3, SY + 0.95, 10.4], k), tgt: [2112.95, SY + 1.6, 0.4], fov: 52, sun: SUN_HOOK, shadow: { c: [2112, SY, 0], r: 22 }, focus: 9, aper: 0.2,
        hud: { stamp: Math.floor(lt * 4) % 2 === 0 ? "◀◀ ЧАС НАЗАД" : null, rewind: 1 } };
    } },
  { id: "K4", label: "Спавн: дрон снижается, герой встречает своего же НПС",
    run(lt, dur) {
      if (lt < 1.4) {
        const k = E.io2(lt / 1.4);
        pose(hero, 1.6 + lt * 0.9, SPAWN_Y, 0.8 + lt * 0.7, -40, { ...walkPose(lt * 1.8, 1) });
        return { cam: L3([44, 116, 50], [8.5, 91, 12.5], k), tgt: L3([10, 87, 0], [4.5, 86.6, 3.6], k), fov: 54, sun: SUN_SPAWN, shadow: { c: [10, 86, 4], r: 70 }, focus: 0, fog: 0.0012 };
      }
      const l2 = lt - 1.4;
      const w = cl(l2 / 1.1);
      const x = 2.4 + (3.6 - 2.4) * w, z = 1.8 + (3.2 - 1.8) * w;
      const walking = l2 < 1.1;
      let hY = -0.25;
      if (l2 > 1.5 && l2 < 1.75) hY = 0.65;
      const shrug = sm((l2 - 2.0) / 0.25);
      pose(hero, x, SPAWN_Y, z, -40, { ...(walking ? walkPose(l2 * 1.8, 1) : {}), hY, hP: -0.12, aRz: 0.05 + 0.75 * shrug, aLz: -0.05 - 0.75 * shrug, aRx: -0.25 * shrug, aLx: -0.25 * shrug });
      tag("plain", x, SPAWN_Y, z);
      const k = cl(l2 / (dur - 1.4));
      return { cam: L3([0.2, 86.7, -3.6], [0.6, 86.75, -2.9], k), tgt: [4.8, 86.6, 4.5], fov: 50, sun: SUN_SPAWN, shadow: { c: [4, 85, 4], r: 30 }, focus: 8.0, aper: 0.28 };
    } },
  { id: "K5", label: "/codes: меню из пака раскрывается в воздухе",
    run(lt, dur) {
      const up = sm((lt - 0.15) / 0.45);
      pose(hero, 0.5, SPAWN_Y, 0.5, -60, { aRx: -0.2 - 2.0 * up, aRy: 0.15, aRz: 0.1, hP: -0.45 * sm(lt / 0.4), hY: 0.1 });
      tag("cmd", 0.5, SPAWN_Y + 0.42, 0.5, E.outBack(cl(lt / 0.22)));
      const u = E.outBack(cl((lt - 0.3) / 0.4));
      panel.visible = lt > 0.3;
      panel.scale.set(1, Math.max(0.02, u), 1);
      panel.position.set(1.7, SPAWN_Y + 3.15, 0.9);
      panel.userData.face = true;
      const hovT = MK.besplatnyy - SHOT_T0.K5 - 0.12;
      const hov = lt >= hovT;
      panelPlane.material.map = hov ? panelTex.free : panelTex.plain;
      tipPlane.material.map = tipTex.free;
      tipPlane.visible = hov;
      tipPlane.position.set(0.62, -1.25, 0.06);
      tipPlane.scale.setScalar(0.95 * E.outBack(cl((lt - hovT) / 0.2)));
      sparkle(1.7, SPAWN_Y + 3.15, 0.9, 30, 1.6, 31 + Math.floor(lt * 6), [1.6, 1.0, 0.4], 0.08);
      const k = E.out3(cl(lt / dur));
      return { cam: L3([4.9, 86.5, 7.1], [4.4, 86.65, 6.3], k), tgt: [1.35, 87.55, 0.6], fov: 56, sun: SUN_SPAWN, shadow: { c: [1, 85, 0], r: 25 }, focus: 6.6, aper: 0.25 };
    } },
  { id: "K6", label: "Ник в ТГ-бота → над головой загорается D.HELPER",
    run(lt, dur) {
      const raise = sm(lt / 0.35);
      pose(hero, 0.5, SPAWN_Y, 0.5, -48, { aRx: -1.75 * raise, aRy: -0.55 * raise, aRz: 0.05, hP: 0.3 * raise, hY: 0.3 * raise });
      phone.visible = true;
      phone.scale.setScalar(2.3);
      phone.position.set(0.06, -0.1, 0.26);
      phone.userData.face = true;
      phoneScr.material.map = phoneTex[lt < 0.55 ? 0 : lt < 1.0 ? 1 : 2];
      const hT = MK.helper - SHOT_T0.K6 - 0.05;
      if (lt < hT) tag("plain", 0.5, SPAWN_Y, 0.5);
      else {
        tag("dhelper", 0.5, SPAWN_Y, 0.5, E.outBack(cl((lt - hT) / 0.25)));
        sparkle(0.5, SPAWN_Y + 2.15, 0.5, 70, 0.4 + 0.6 * cl((lt - hT) / 0.3), 41 + Math.floor(lt * 8), [2.0, 1.8, 0.4], 0.07);
        FX.flash = 0.2 * Math.exp(-(lt - hT) * 8);
      }
      const pA = cl((lt - hT) / 0.12);
      const k = E.io2(cl(lt / dur));
      return { cam: L3([3.7, 86.9, 3.2], [3.3, 86.95, 3.6], k), tgt: [0.45, 86.95, 0.75], fov: 50, sun: SUN_SPAWN, shadow: { c: [1, 85, 0], r: 25 }, focus: 4.1, aper: 0.5,
        hud: lt >= hT ? { price: ["199 ₽", "0 ₽"], priceY: 1440, priceS: E.outBack(pA), strike: cl((lt - hT - 0.15) / 0.2) } : {} };
    } },
  { id: "K7", label: "Код Погостика: из меню вылетают два кейса",
    run(lt, dur) {
      const cT = MK.kejs7 - SHOT_T0.K7 - 0.35;
      const catchK = sm((lt - cT) / 0.4);
      pose(hero, 0.5, SPAWN_Y, 0.5, -60, { aRx: -1.6 * catchK - 0.2, aLx: -1.5 * catchK - 0.2, aRz: 0.3 * catchK, aLz: -0.3 * catchK, hP: -0.25 });
      tag("dhelper", 0.5, SPAWN_Y, 0.5);
      panel.visible = true;
      panel.scale.set(1, Math.max(0.02, E.outBack(cl(lt / 0.2))), 1);
      panel.position.set(1.7, SPAWN_Y + 3.15, 0.9);
      panel.userData.face = true;
      panelPlane.material.map = panelTex.pog;
      tipPlane.material.map = tipTex.pog;
      tipPlane.visible = lt > 0.3;
      tipPlane.position.set(-0.62, -1.25, 0.06);
      tipPlane.scale.setScalar(0.9 * E.outBack(cl((lt - 0.3) / 0.2)));
      const from = [1.45, SPAWN_Y + 3.1, 1.0];
      const hands = [[0.95, SPAWN_Y + 1.25, 0.95], [0.75, SPAWN_Y + 1.2, 1.25]];
      for (let j = 0; j < 2; j++) {
        const f = cl((lt - cT - j * 0.12) / 0.45);
        if (f <= 0) continue;
        const p = L3(from, hands[j], E.io2(f));
        p[1] += Math.sin(f * Math.PI) * 0.6;
        caseSprites[j].visible = true;
        caseSprites[j].position.set(...p);
        caseSprites[j].scale.setScalar(0.35 + 0.2 * f);
        if (f > 0 && f < 1) sparkle(p[0], p[1], p[2], 16, 0.25, 51 + j + Math.floor(lt * 10), [1.4, 0.9, 2.0], 0.07);
      }
      const k = E.out3(cl(lt / dur));
      return { cam: L3([4.8, 86.5, 6.9], [4.4, 86.65, 6.4], k), tgt: [1.35, 87.55, 0.6], fov: 56, sun: SUN_SPAWN, shadow: { c: [1, 85, 0], r: 25 }, focus: 6.6, aper: 0.25 };
    } },
  { id: "K8", label: "Бежит в портал «ГРИФ #1»",
    run(lt, dur) {
      const end = dur - 0.25;
      const k = E.io2(cl(lt / end));
      const p = [64.8 + 0.3 * k, 78, -24.4 - 8.0 * k];
      if (lt < end) {
        pose(hero, ...p, 180, { ...walkPose(lt * 2.7, 1.25), tP: 0.25, hP: -0.2 });
        tag("dhelper", ...p);
      }
      const sw = 0.6 + 0.6 * k;
      for (let i = 0; i < 180; i++) {
        const r = mulberry32(i + 7);
        const a = r() * Math.PI * 2 + lt * (1.5 + r() * 2), rad = 0.4 + r() * 1.4;
        pAdd(65.2 + Math.cos(a) * rad, 79.2 + (r() - 0.5) * 2.4, -33.2 + Math.sin(a) * rad * 0.3, 1.3 * sw, 0.5 * sw, 2.2 * sw, 0.14);
      }
      if (lt >= end) { FX.flash = 0.85; FX.flashCol = [2.2, 0.9, 3.4]; }
      const cam = [p[0] - 2.4, 79.7, p[2] + 5.4];
      return { cam, tgt: [65.0, 79.25, Math.min(p[2] - 2.0, -31.6)], fov: 52, sun: SUN_SPAWN, shadow: { c: [64, 78, -30], r: 25 }, focus: 5.6, aper: 0.3 };
    } },
  { id: "K9", label: "Как строить: 3 в ряд + 2 сверху; табличка с кодом",
    run(lt, dur) {
      const dvaT = MK.dva - SHOT_T0.K9 + 0.1;
      const P = [0.25, 0.55, 0.85, dvaT];
      let n = 0;
      for (let i = 0; i < 4; i++) {
        if (lt < P[i]) continue;
        n = i + 1;
      }
      placeHammer(n);
      for (let i = 0; i < n; i++) blocks[i].scale.setScalar(1 + 0.18 * (1 - cl((lt - P[i]) / 0.12)));
      for (let i = 0; i < n; i++) {
        const [dx, dy] = HAMMER[i];
        dust(SITE[0] + dx + 0.5, SY + dy + 0.6, 0.5, lt - P[i], 70 + i, 18);
      }
      if (lt >= dvaT + 0.15) {
        ghost.visible = true;
        ghost.position.set(SITE[0] + 0.5, SY + 2.5, SITE[2] + 0.5);
      }
      handBlock.visible = true;
      let swing = 0;
      for (const p of P) swing = Math.max(swing, Math.exp(-((lt - p) * (lt - p)) / 0.004));
      pose(hero, HERO_SITE[0] + 0.15, SY, HERO_SITE[2] + 0.4, 100, { aRx: -1.85 + 0.55 * swing, aRz: 0.15, hP: -0.4, tP: 0.05 });
      tag("dhelper", HERO_SITE[0] + 0.15, SY, HERO_SITE[2] + 0.4);
      signGroup.visible = true;
      signGroup.position.set(2110.4, SY, 0.5);
      signGroup.scale.setScalar(2.2);
      signGroup.rotation.set(0, Math.atan2(2117.8 - 2110.4, 7.8 - 0.5), 0);
      const k = E.io2(cl(lt / dur));
      return { cam: L3([2118.1, SY + 2.3, 8.2], [2117.5, SY + 2.2, 7.5], k), tgt: [2112.3, SY + 1.2, -0.2], fov: 54, sun: SUN_HOOK, shadow: { c: [2106, SY, -12], r: 60 }, focus: 8.0, aper: 0.08 };
    } },
  { id: "K10", label: "Последний блок — замедление, удар, молоток влетает в героя",
    run(lt, dur) {
      const land = 1.1;
      const vT = MK.vletaet - SHOT_T0.K10;
      const ka = cl((lt - vT) / 0.75);
      if (ka > 0) absorb(E.in2(ka));
      else {
        placeHammer(5);
        blocks[4].position.y += 0.9 * (1 - E.in2(cl(lt / land)));
        blocks[4].rotation.set(0.1 * (1 - cl(lt / land)), 0.25 * (1 - cl(lt / land)), 0);
      }
      dust(SITE[0] + 0.5, SY + 2.2, 0.5, lt - land, 81);
      const glow = cl((lt - land) / 0.25);
      goldMat.emissiveIntensity = 0.06 + 0.55 * glow;
      if (lt >= land) FX.flash = 0.28 * Math.exp(-(lt - land) * 9);
      const arms = sm((lt - land) / 0.3);
      pose(hero, HERO_SITE[0], SY, HERO_SITE[2] + 0.3, 95 - 60 * arms, { aRx: -2.15 * (1 - arms) - 0.5 * arms, aLx: -0.5 * arms, aRz: 0.1 + 0.6 * arms, aLz: -0.6 * arms, hP: -0.55 * (1 - arms) });
      tag("dhelper", HERO_SITE[0], SY, HERO_SITE[2] + 0.3);
      sparkle(2112.5, SY + 2.9, 0.5, 40, 0.8, 61 + Math.floor(lt * 7), [2.0, 1.5, 0.6], 0.08);
      const cam = add3(L3([2115.9, SY + 2.3, 6.6], [2116.4, SY + 1.9, 6.1], E.io2(cl(lt / dur))), shake(lt, land, 0.06));
      return { cam, tgt: [2113.1, SY + 1.9, 0.4], fov: 50, sun: SUN_HOOK, shadow: { c: [2112, SY, 0], r: 20 }, focus: 6.4, aper: 0.4 };
    } },
  { id: "K11", label: "Рулетка: «Выбор приза», значки замедляются",
    run(lt, dur) {
      pose(hero, ...HERO_SITE, 30, { hP: -0.32 + 0.02 * Math.sin(lt * 23), hY: -0.2 + 0.03 * Math.sin(lt * 17), aRx: -0.65, aLx: -0.65, aRz: 0.32, aLz: -0.32 });
      tag("dhelper", ...HERO_SITE);
      sparkle(HERO_SITE[0], SY + 1.2, HERO_SITE[2], 50, 1.3, 71 + Math.floor(lt * 6), [1.2, 0.7, 2.0], 0.07);
      let x = 0, gap = 0.07, n = 0;
      while (x <= lt) { x += gap; gap *= 1.09; n++; }
      const ang = -0.45 + 0.6 * E.io2(cl(lt / dur));
      const cam = [HERO_SITE[0] + Math.sin(ang) * 5.0, SY + 0.95, HERO_SITE[2] + Math.cos(ang) * 5.0];
      return { cam, tgt: [HERO_SITE[0], SY + 2.05, HERO_SITE[2]], fov: 50, sun: SUN_HOOK, shadow: { c: [2114, SY, 0], r: 20 }, focus: 5.0, aper: 0.45,
        vig: 0.4 + 0.35 * cl(lt / dur), hud: { overlays: [{ k: "roulette", a: 1, y: -330 }, { k: SUBS[n % SUBS.length], a: 1, y: -330 }] } };
    } },
  { id: "K12", label: "Выпала HYDRA: фейерверки, прыжок",
    run(lt, dur) {
      const jump = 0.95 * Math.sin(Math.PI * cl(lt / 0.6)) + 0.45 * Math.sin(Math.PI * cl((lt - 0.85) / 0.45));
      pose(hero, HERO_SITE[0], SY + jump, HERO_SITE[2], 25, { aRx: -2.6, aLx: -2.6, aRz: 0.35 + 0.1 * Math.sin(lt * 9), aLz: -0.35 - 0.1 * Math.sin(lt * 9), hP: -0.35, lR: 0.3 * Math.sign(jump), lL: -0.2 * Math.sign(jump) });
      tag("dhelper", HERO_SITE[0], SY + jump, HERO_SITE[2]);
      firework(2109, SY + 11, -9, lt - 0.6, 81, [2.4, 0.8, 1.6]);
      firework(2120, SY + 9, -6, lt - 1.1, 82, [0.6, 2.2, 1.0]);
      firework(2114, SY + 14, -15, lt - 1.6, 83, [2.4, 1.8, 0.4]);
      if (lt < 0.15) FX.flash = 0.45 * (1 - lt / 0.15);
      const pA = cl((lt - 1.0) / 0.12);
      const k = E.out3(cl(lt / dur));
      return { cam: L3([2117.9, SY + 0.95, 6.1], [2117.4, SY + 1.0, 5.5], k), tgt: [2114.3, SY + 2.6, 0.2], fov: 56, sun: SUN_HOOK, shadow: { c: [2114, SY, 0], r: 20 }, focus: 5.8, aper: 0.35,
        hud: { overlays: [{ k: "win", a: cl(lt / 0.1), y: -380 }], ...(lt >= 1.0 ? { price: ["189 ₽", "0 ₽"], priceY: 1460, priceS: E.outBack(pA), strike: cl((lt - 1.15) / 0.2) } : {}) } };
    } },
  { id: "K13", label: "Гигантский молоток на спавне: лут фонтаном на всех",
    run(lt, dur) {
      const gy = SPAWN_GY;
      placeHammer(5, 3, [GIANT_C[0] - 1.5, gy, GIANT_C[2] - 1.5]);
      goldMat.emissiveIntensity = 0.12 + 0.08 * Math.sin(lt * 8);
      const r = mulberry32(5);
      for (let i = 0; i < sprites.length; i++) {
        const s = sprites[i];
        const a = r() * Math.PI * 2, sp = 2 + r() * 5, up = 7 + r() * 6, born = r() * (dur + 0.6) - 0.6;
        const tt = lt - born;
        if (tt < 0 || tt > 2.2) continue;
        s.visible = true;
        s.position.set(GIANT_C[0] + Math.cos(a) * sp * tt, gy + 9.3 + up * tt - 9.8 * tt * tt * 0.5, GIANT_C[2] + Math.sin(a) * sp * tt);
        s.material.rotation = a + tt * 4;
        if (s.position.y < gy) s.visible = false;
      }
      sparkle(GIANT_C[0], gy + 9.6, GIANT_C[2], 160, 2.2, 91 + Math.floor(lt * 8), [2.2, 1.5, 0.5], 0.16);
      const run = [[31.5, 11.5, 200], [38.8, 13.8, 165], [28.0, 6.0, 245], [44.5, 9.5, 135], [26.0, 12.5, 215], [41.5, 16.5, 175]];
      extras.forEach((P, i) => {
        const [x0, z0, yaw] = run[i];
        const dx = -Math.sin(yaw * D2R), dz = Math.cos(yaw * D2R);
        const x = x0 + dx * lt * 3.2, z = z0 + dz * lt * 3.2;
        pose(P, x, groundY(x, z), z, yaw, { ...walkPose(0.15 + i * 0.37 + lt * 2.6, 1.15), tP: 0.2 });
      });
      const k = E.io2(cl(lt / dur));
      return { cam: L3([37, 90.5, 33], [36.6, 92.6, 28.5], k), tgt: [36, 91.5, 0], fov: 58, sun: SUN_SPAWN, shadow: { c: [36, 85, 6], r: 40 }, focus: 0 };
    } },
  { id: "K14", label: "Герой на вершине: «Подпишись»",
    run(lt, dur) {
      const gy = SPAWN_GY;
      placeHammer(5, 3, [GIANT_C[0] - 1.5, gy, GIANT_C[2] - 1.5]);
      const pT = MK.podpishis - SHOT_T0.K14;
      const pt = E.out3(cl((lt - pT + 0.1) / 0.25));
      pose(hero, GIANT_C[0], gy + 9, GIANT_C[2], -20, { aRx: -0.2 - 1.35 * pt, aRy: -0.15 * pt, hP: 0.05, hY: 0.1, aLz: -0.08 + 0.05 * Math.sin(lt * 3) });
      tag("dhelper", GIANT_C[0], gy + 9, GIANT_C[2]);
      sparkle(GIANT_C[0], gy + 9.4, GIANT_C[2], 60, 2.0, 101 + Math.floor(lt * 6), [2.0, 1.4, 0.5], 0.1);
      const k = E.out3(cl(lt / dur));
      const bt = lt - pT;
      return { cam: L3([GIANT_C[0] + 3.6, gy + 10.8, GIANT_C[2] + 7.4], [GIANT_C[0] + 3.0, gy + 10.6, GIANT_C[2] + 6.1], k), tgt: [GIANT_C[0] + 0.3, gy + 10.4, GIANT_C[2]], fov: 52, sun: SUN_SPAWN, shadow: { c: [36, gy, 0], r: 30 }, focus: 7, aper: 0.35,
        hud: bt > 0 ? { subscribe: [540, 1470, E.outBack(cl(bt / 0.25)), bt > 0.9 ? 1 : 0] } : {} };
    } },
  { id: "K15", label: "Финал: IP, /codes, «код спрятан в видео»",
    run(lt, dur) {
      const gy = SPAWN_GY;
      placeHammer(5, 3, [GIANT_C[0] - 1.5, gy, GIANT_C[2] - 1.5]);
      const k = E.out3(cl(lt / dur));
      return { cam: L3([54, 104, 36], [74, 118, 52], k), tgt: [8, 87, 0], fov: 50, sun: SUN_SPAWN, shadow: { c: [24, 86, 0], r: 110 }, focus: 0, fog: 0.0012,
        hud: { endcard: cl(lt / 0.3) } };
    } },
];
const SHOT_T0 = {};
for (const S of SHOTS) {
  const T = TLD.shots.find((x) => x.id === S.id);
  S.t0 = T.t0;
  S.t1 = T.t1;
  S.key = (T.t0 + T.t1) / 2;
  SHOT_T0[S.id] = T.t0;
}
let SPAWN_GY = groundY(GIANT_C[0], GIANT_C[2]);

function applyView(V, t) {
  camera.fov = V.fov || 50;
  camera.aspect = W / H;
  camera.updateProjectionMatrix();
  camera.position.copy(v3(V.cam));
  camera.lookAt(v3(V.tgt));
  camera.updateMatrixWorld();
  const sd = V.sun.clone();
  WU.uSunDir.value.copy(sd);
  WU.uFogDen.value = V.fog ?? 0.0018;
  const c = v3(V.shadow.c), r = V.shadow.r;
  sun.target.position.copy(c);
  sun.position.copy(c).addScaledVector(sd, 300);
  const sc = sun.shadow.camera;
  sc.left = -r; sc.right = r; sc.top = r; sc.bottom = -r; sc.near = 50; sc.far = 700;
  sc.updateProjectionMatrix();
  sun.target.updateMatrixWorld();
  sun.updateMatrixWorld();
  sky.place(camera, 1, 1);
  ents.update(camera, 1);
  WU.uTime.value = t;
  for (const k in tags) if (tags[k].visible) tags[k].quaternion.copy(camera.quaternion);
  if (panel.visible && panel.userData.face) panel.quaternion.copy(camera.quaternion);
  if (phone.visible && phone.userData.face) {
    hero.root.updateMatrixWorld(true);
    const wq = new THREE.Quaternion();
    phone.parent.getWorldQuaternion(wq);
    phone.quaternion.copy(wq.invert().multiply(camera.quaternion));
  }
  post.dof.uFocus.value = V.focus || 10;
  post.dof.uAper.value = V.focus ? V.aper || 0.4 : 0;
  post.dof.uMax.value = V.focus ? 10 : 0;
  const sp = camera.position.clone().addScaledVector(sd, 1000).project(camera);
  const inFront = sp.z < 1 && sp.x > -1.4 && sp.x < 1.4 && sp.y > -1.4 && sp.y < 1.4;
  post.rays.uSun.value.set(sp.x * 0.5 + 0.5, sp.y * 0.5 + 0.5);
  post.rays.uStr.value = inFront ? 0.75 : 0;
  post.bloom.strength = 0.36;
  post.bloom.radius = 0.6;
  post.bloom.threshold = 0.92;
  const G = post.grade;
  const desat = FX.rewind ? 0.3 : FX.freeze ? 0.22 : 1.14;
  G.uExpo.value = FX.rewind ? 0.82 : V.expo || 1.06;
  G.uSat.value = desat;
  G.uCon.value = 1.07;
  G.uVig.value = FX.freeze ? 0.75 : V.vig ?? 0.38;
  G.uTint.value.set(1.0, 0.98, 0.95);
  G.uShadow.value.set(0.92, 0.97, 1.06);
  G.uHigh.value.set(1.06, 1.0, 0.92);
  G.uFlash.value = FX.flash || 0;
  if (FX.flashCol) G.uFlashCol.value.set(...FX.flashCol);
  else G.uFlashCol.value.set(4, 3.6, 3);
  post.fin.uGrain.value = 0.02;
  post.fin.uCA.value = FX.rewind ? 0.003 : FX.freeze ? 0.0025 : 0.0006;
  post.fin.uGlitch.value = FX.rewind ? 0.06 : FX.freeze ? 0.04 : 0;
  post.fin.uHudOn.value = 1;
  // captions follow the voiceover word by word
  const st = { ...(V.hud || {}) };
  if (!st.noCaption) {
    const cap = TLD.captions.find((c) => t >= c.t0 && t < c.t1);
    if (cap) {
      st.caption = cap.words;
      st.capPop = cl((t - cap.t0) / 0.09);
    }
  }
  hud.draw(st);
}

function shotAt(t) {
  for (const S of SHOTS) if (t >= S.t0 && t < S.t1) return S;
  return SHOTS[SHOTS.length - 1];
}
function render(t) {
  const S = shotAt(t);
  hideAll();
  const V = S.run(t - S.t0, S.t1 - S.t0, t);
  pCommit();
  applyView(V, t);
  post.fin.uFrame.value = Math.floor(t * 30);
  post.render();
}

// plains ground: first cell from the top that the sky can't pass
function groundYP(x, z) {
  const { J, B } = LV[1];
  const ix = Math.floor(x) - J.x0, iz = Math.floor(z) - J.z0;
  if (ix < 0 || iz < 0 || ix >= J.nx || iz >= J.nz) return 64;
  for (let y = J.y0 + J.ny - 1; y > J.y0; y--) {
    const i = (((y - J.y0) * J.nz + iz) * J.nx + ix) * 2;
    if (B[i] === 0) return y + 1;
  }
  return 64;
}

window.__dbg = {
  renderer, scene, camera, post, hero, SHOTS, TLD, lightAt, groundY, groundYP, codeGroup, render,
  still(i) { render(SHOTS[i].key); return SHOTS[i].id; },
  async save(name) {
    const b = await new Promise((r) => renderer.domElement.toBlob(r, "image/png"));
    return (await fetch("/save?name=" + encodeURIComponent(name), { method: "POST", body: b })).status;
  },
  async strip(times, prefix) {
    for (const t of times) { render(t); await this.save(prefix + "_" + t.toFixed(2).replace(".", "_")); }
    return times.length;
  },
};
host.render = render;
render(0);
if (host.ready) host.ready();
