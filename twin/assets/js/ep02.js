// Episode 2 «Рилик против MoreCube»: a 4-round match. The invented «рилик» parody plaza (rain, grey stone, a gold
// throne, the caricature ВЛАДЕЛЕЦ with a ban hammer) against MoreCube (the spawn twin + the plains hill).
// EtoLikos (skin of the account cherepaxa) is always seen from the outside. Every shot is run(lt, dur, t) of its
// local time; the «там → тут» switch inside a round comes from the timeline marks. window.__dbg.still(i) shows shot i.
import * as THREE from "./three.js";
import { E, mulberry32 } from "./lib.js";
import { WU, loadWorld } from "./world.js";
import { buildSky, buildClouds } from "./sky.js";
import { makePost } from "./post.js";
import { loadEntities } from "./holo.js";
import { makePlayer, walkPose, PX } from "./player.js";
import { makeHud } from "./hud.js";

const host = window.__world || (window.__world = {});
const W = 1080, H = 1920;
const BASE = "assets/data/";
const EP = BASE + "ep02/";
const EP1 = BASE + "ep01/";

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

function bakeEnv(zen, hor, gnd, sunDir, sunK = 7) {
  const s = new THREE.Scene();
  s.add(new THREE.Mesh(new THREE.SphereGeometry(100, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: { uZen: { value: new THREE.Color(zen) }, uHor: { value: new THREE.Color(hor) }, uGnd: { value: new THREE.Color(gnd) }, uSun: { value: sunDir.clone().normalize() }, uK: { value: sunK } },
    vertexShader: `varying vec3 vD; void main(){ vD = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform vec3 uZen, uHor, uGnd, uSun; uniform float uK; varying vec3 vD; void main(){ vec3 d = normalize(vD); vec3 c = mix(uHor, uZen, pow(clamp(d.y, 0.0, 1.0), 0.5)); c = mix(c, uGnd, smoothstep(0.0, -0.25, d.y)); c += vec3(1.0, 0.7, 0.4) * pow(clamp(dot(d, uSun), 0.0, 1.0), 48.0) * uK; gl_FragColor = vec4(c, 1.0); }`,
  })));
  const pm = new THREE.PMREMGenerator(renderer);
  const rt = pm.fromScene(s, 0, 0.1, 200);
  pm.dispose();
  return rt.texture;
}
const SUN_SPAWN = new THREE.Vector3(0.55, 0.42, 0.72).normalize();
const SUN_HILL = new THREE.Vector3(0.55, 0.2, 0.81).normalize();
const SUN_RW = new THREE.Vector3(-0.35, 0.8, 0.5).normalize();
const envMC = bakeEnv("#4677c9", "#f4c494", "#5d5048", SUN_SPAWN);
const envRW = bakeEnv("#232a36", "#4d5462", "#222228", SUN_RW, 0.3);

const [spawnAtlas, plainsAtlas, rwAtlas] = await Promise.all([atlasTex(BASE + "atlas.png"), atlasTex(BASE + "plains/atlas.png"), atlasTex(BASE + "rw/atlas.png")]);
const spawn = await loadWorld(BASE, spawnAtlas, envMC);
const plains = await loadWorld(BASE + "plains/", plainsAtlas, envMC);
const rw = await loadWorld(BASE + "rw/", rwAtlas, envRW);
scene.add(spawn.group, plains.group, rw.group);
const sky = buildSky();
scene.add(sky.group);
const clouds = buildClouds();
scene.add(clouds.mesh);
const ents = await loadEntities(BASE, loader);
scene.add(ents.group);

async function lightVol(base) {
  const J = await (await fetch(base + "light.json", { cache: "no-cache" })).json();
  const B = new Uint8Array(await (await fetch(base + "light.bin", { cache: "no-cache" })).arrayBuffer());
  return { J, B };
}
const LV = [await lightVol(BASE), await lightVol(BASE + "plains/"), await lightVol(BASE + "rw/")];
function lightAt(x, y, z) {
  for (const { J, B } of LV) {
    const ix = Math.floor(x) - J.x0, iy = Math.floor(y) - J.y0, iz = Math.floor(z) - J.z0;
    if (ix < 0 || iy < 0 || iz < 0 || ix >= J.nx || iy >= J.ny || iz >= J.nz) continue;
    const i = ((iy * J.nz + iz) * J.nx + ix) * 2;
    return [B[i] / 15, B[i + 1] / 15];
  }
  return [1, 0];
}
for (const n of ents.npcs) if (n.model) n.model.light(...lightAt(n.pos[0], n.pos[1] + 1.4, n.pos[2]));

/* ------------------------------------------------------------------ characters */
const E_ = ents.E;
const hero = makePlayer({ skin: await loader.loadAsync(EP + "skin_cherepaxa.png"), slim: false });
const villain = makePlayer({ skin: await loader.loadAsync(EP + "skin_owner.png"), slim: false });
const pog = makePlayer({ skin: await loader.loadAsync(BASE + E_.npcs.find((n) => n.id === "тиктокер").skin), slim: false });
scene.add(hero.root, villain.root, pog.root);
const extraSkins = ["барыга", "киллер", "фри", "аукцион", "рынок", "шахтер"].map((id) => E_.npcs.find((n) => n.id === id)).filter(Boolean);
const extras = [];
for (const n of extraSkins) {
  const P = makePlayer({ skin: await loader.loadAsync(BASE + n.skin), slim: n.slim });
  scene.add(P.root);
  extras.push(P);
}
const CHARS = [hero, villain, pog, ...extras];
// the owner «зажрался»: a wider, deeper body with the arms and legs pushed out
function setFat(P, k) {
  for (const m of [P.torso.children[0], P.torso.children[1]]) m.scale.set(1 + 0.8 * k, 1 + 0.03 * k, 1 + 1.1 * k);
  P.armR.position.x = -(5 + 3.2 * k) * PX;
  P.armL.position.x = (5 + 3.2 * k) * PX;
  P.legR.position.x = -(1.9 + 1.5 * k) * PX;
  P.legL.position.x = (1.9 + 1.5 * k) * PX;
}

/* ------------------------------------------------------------------ props */
const T = {};
for (const k of ["gold_block", "diamond", "golden_apple", "emerald", "gold_ingot", "chest_item", "particle_star", "netherite_ingot", "totem"])
  T[k] = await pix(EP1 + "tex/" + k + ".png");
const box = new THREE.BoxGeometry(1, 1, 1);
const goldMat = new THREE.MeshStandardMaterial({ map: T.gold_block, metalness: 0.55, roughness: 0.3, envMap: envMC, envMapIntensity: 1.15, emissive: new THREE.Color(1.0, 0.62, 0.1), emissiveIntensity: 0.06 });
const blocks = [];
for (let i = 0; i < 6; i++) {
  const m = new THREE.Mesh(box, goldMat);
  m.castShadow = m.receiveShadow = true;
  scene.add(m);
  blocks.push(m);
}
function planeTex(tex, w, h, opts = {}) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false, depthWrite: false, side: THREE.DoubleSide, ...opts }));
  m.renderOrder = 6;
  return m;
}
// floating /codes panel (the real menu from ep01) + tooltip + glow
const panelTex = { plain: await pix(EP1 + "panel_codes_full.png"), free: await pix(EP1 + "panel_codes_free_full.png") };
const tipTex = await pix(EP1 + "tip_free.png");
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
const tipPlane = planeTex(tipTex, 1.0 * (796 / 616), 1.0);
panel.add(glow, panelPlane, tipPlane);
scene.add(panel);

// billboards: nametags, hologram price tags, chat lines
const bills = [];
async function bill(path, hMeters) {
  const t = await pix(path);
  const m = planeTex(t, (t.image.width / t.image.height) * hMeters, hMeters);
  scene.add(m);
  bills.push(m);
  return m;
}
const tags = { hero: await bill(EP + "tag_hero.png", 0.3), heroD: await bill(EP + "tag_hero_dhelper.png", 0.3), pog: await bill(EP + "tag_pog_owner.png", 0.3),
  villain: await bill(EP + "tag_villain.png", 0.3), cmd: await bill(EP + "cmd_codes.png", 0.34), hello: await bill(EP + "cmd_hello.png", 0.34) };
const prices = {};
for (const k of ["diamond", "air", "exit", "bench", "unban", "priv"]) prices[k] = await bill(EP + "price_" + k + ".png", 0.42);
const chats = { hello: await bill(EP + "chat_hello.png", 0.34), owner: await bill(EP + "chat_owner.png", 0.34), ban: await bill(EP + "chat_ban.png", 0.34) };
function showBill(m, x, y, z, s = 1, k = 1) {
  if (k <= 0.001) return;
  m.visible = true;
  m.position.set(x, y, z);
  m.scale.setScalar(Math.max(0.01, s * E.outBack(Math.min(1, k))));
}
// tag over a character's head (feet at y)
function tagOver(which, x, y, z, s = 1, k = 1, scale = 1) {
  showBill(tags[which], x, y + 2.15 * scale, z, s * scale, k);
}

// oak signs: the owner's price board and the «T» sign by the throne
const oakTex = await pix(EP + "sign_oak.png");
const oakSide = oakTex.clone();
oakSide.repeat.set(2 / 64, 12 / 32);
oakSide.offset.set(0, 1 - 14 / 32);
oakSide.needsUpdate = true;
function makeSign(front, withPost) {
  const g = new THREE.Group();
  const side = new THREE.MeshStandardMaterial({ map: oakSide, roughness: 0.85 });
  const fr = new THREE.MeshStandardMaterial({ map: front, roughness: 0.85, emissive: 0xffffff, emissiveMap: front, emissiveIntensity: 0.12 });
  const board = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.5, 0.083), [side, side, side, side, fr, side]);
  board.position.y = withPost ? 0.83 : 0;
  board.castShadow = true;
  g.add(board);
  if (withPost) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.083, 0.58, 0.083), side);
    p.position.y = 0.29;
    p.castShadow = true;
    g.add(p);
  }
  scene.add(g);
  return g;
}
const signPriv = makeSign(await pix(EP + "sign_priv.png"), false);
const signT = makeSign(await pix(EP + "sign_t.png"), true);

// the ban hammer: a voxel item (16x22 px), red head with «BAN», iron caps, wooden handle; pivot at the grip
const HS = 0.25;
const hammer = new THREE.Group();
{
  const Wd = 16, Hd = 22;
  const grid = Array.from({ length: Hd }, () => Array(Wd).fill("."));
  for (let y = 0; y <= 6; y++) for (let x = 0; x < Wd; x++) grid[y][x] = x < 2 || x > 13 ? "I" : y === 0 || y === 6 ? "D" : "R";
  const glyph = (L, x0) => L.forEach((row, ry) => [...row].forEach((c, rx) => { if (c === "W") grid[1 + ry][x0 + rx] = "W"; }));
  glyph(["WW.", "W.W", "WW.", "W.W", "WW."], 2);
  glyph([".W.", "W.W", "WWW", "W.W", "W.W"], 6);
  glyph(["W..W", "WW.W", "W.WW", "W..W", "W..W"], 10);
  for (let y = 7; y < Hd; y++) for (const x of [7, 8]) grid[y][x] = y === Hd - 1 ? "I" : y >= 14 ? "G" : "H";
  const PAL = { I: 0x6a6a78, D: 0x7a1016, R: 0xc81e26, W: 0xffffff, H: 0x7d5630, G: 0x3c2818 };
  const cells = [];
  grid.forEach((row, y) => row.forEach((c, x) => { if (c !== ".") cells.push([x, y, c]); }));
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.42, metalness: 0.2, envMap: envRW, envMapIntensity: 0.8, emissive: 0x200404, emissiveIntensity: 1 });
  const inst = new THREE.InstancedMesh(box, mat, cells.length);
  const M4 = new THREE.Matrix4(), col = new THREE.Color();
  cells.forEach(([x, y, c], i) => {
    const d = y <= 6 ? 6 : 2;
    M4.makeScale(HS, HS, HS * d);
    M4.setPosition((x - 7.5) * HS, (Hd - 1 - y + 0.5) * HS, 0);
    inst.setMatrixAt(i, M4);
    inst.setColorAt(i, col.setHex(PAL[c]));
  });
  inst.castShadow = inst.receiveShadow = true;
  hammer.add(inst);
  scene.add(hammer);
}
const HAM_HEAD = 18.5 * HS; // grip -> head centre (unscaled)
const HAM_HALF = 3.5 * HS;  // head half height

// MOLOTOK letters made of glowing gold cubes (5x7)
const FONT5 = {
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"], O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"], T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
};
const letterMat = new THREE.MeshStandardMaterial({ color: 0xffd34d, emissive: 0xffa21a, emissiveIntensity: 0.85, metalness: 0.35, roughness: 0.32 });
const LET = {};
for (const ch of Object.keys(FONT5)) {
  const cells = [];
  FONT5[ch].forEach((row, ry) => [...row].forEach((v, rx) => { if (v === "1") cells.push([rx, 6 - ry]); }));
  const inst = new THREE.InstancedMesh(box, letterMat, cells.length);
  const M4 = new THREE.Matrix4();
  cells.forEach(([x, y], i) => { M4.makeTranslation(x - 2, y - 3, 0); inst.setMatrixAt(i, M4); });
  inst.castShadow = true;
  const g = new THREE.Group();
  g.add(inst);
  scene.add(g);
  LET[ch] = g;
}

// item sprites (apples, emeralds, cases, loot)
function sprite(tex, crop) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, alphaTest: 0.3 }));
  if (crop) {
    s.material.map = tex.clone();
    s.material.map.repeat.set(crop[2], crop[3]);
    s.material.map.offset.set(crop[0], crop[1]);
    s.material.map.needsUpdate = true;
  }
  scene.add(s);
  return s;
}
const CASE_CROP = [14 / 64, 1 - (19 + 14) / 64, 14 / 64, 14 / 64];
const apples = [0, 1].map(() => sprite(T.golden_apple));
const gems = Array.from({ length: 70 }, (_, i) => sprite(i % 3 === 2 ? T.gold_ingot : T.emerald));
for (const g of gems) g.material.color.setRGB(1.5, 1.5, 1.5);
const cases = Array.from({ length: 8 }, () => sprite(T.chest_item, CASE_CROP));
const SPRITES = [...apples, ...gems, ...cases];

// rain streaks around the camera, deterministic in time
const NR = 2600;
const rainGeo = new THREE.BufferGeometry();
const rainPos = new Float32Array(NR * 6);
rainGeo.setAttribute("position", new THREE.BufferAttribute(rainPos, 3));
const rain = new THREE.LineSegments(rainGeo, new THREE.LineBasicMaterial({ color: 0xa6b6cc, transparent: true, opacity: 0.4, depthWrite: false }));
rain.frustumCulled = false;
scene.add(rain);
const RS = [];
{
  const r = mulberry32(77);
  for (let i = 0; i < NR; i++) RS.push([r(), r(), r(), 0.75 + r() * 0.6]);
}
function rainUpdate(t, c, heavy = 1) {
  rain.visible = true;
  rain.material.opacity = 0.32 + 0.14 * heavy;
  const B = 16, Hh = 16, sp = 15;
  for (let i = 0; i < NR; i++) {
    const [a, b, cc, v] = RS[i];
    const x = c.x + (a - 0.5) * B * 2, z = c.z + (b - 0.5) * B * 2;
    const y = c.y - 6 + ((((cc * Hh - t * sp * v) % Hh) + Hh) % Hh);
    const L = 0.5 * v;
    rainPos[i * 6] = x; rainPos[i * 6 + 1] = y; rainPos[i * 6 + 2] = z;
    rainPos[i * 6 + 3] = x + 0.05; rainPos[i * 6 + 4] = y + L; rainPos[i * 6 + 5] = z + 0.03;
  }
  rainGeo.attributes.position.needsUpdate = true;
}
// speed lines for the flight
const NSL = 260;
const slGeo = new THREE.BufferGeometry();
const slPos = new Float32Array(NSL * 6);
slGeo.setAttribute("position", new THREE.BufferAttribute(slPos, 3));
const speedLines = new THREE.LineSegments(slGeo, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, depthWrite: false }));
speedLines.frustumCulled = false;
scene.add(speedLines);
const SL = [];
{
  const r = mulberry32(5);
  for (let i = 0; i < NSL; i++) SL.push([r(), r(), r(), 0.6 + r()]);
}
function speedUpdate(t, c, dir) {
  speedLines.visible = true;
  for (let i = 0; i < NSL; i++) {
    const [a, b, cc, v] = SL[i];
    const along = ((((cc * 60 - t * 90 * v) % 60) + 60) % 60) - 30;
    const ox = (a - 0.5) * 14, oy = (b - 0.5) * 14;
    const p = c.clone().addScaledVector(dir, along).add(new THREE.Vector3(0, oy, 0)).add(new THREE.Vector3(-dir.z, 0, dir.x).multiplyScalar(ox));
    const q = p.clone().addScaledVector(dir, 2.2 * v);
    slPos.set([p.x, p.y, p.z, q.x, q.y, q.z], i * 6);
  }
  slGeo.attributes.position.needsUpdate = true;
}

// glow particles (sparkles, dust, fireworks, moths, crumbs)
const NP = 2400;
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

/* ------------------------------------------------------------------ HUD + timeline */
const hud = await makeHud(W, H, {
  ban: EP + "title_ban.png", ban2: EP + "title_ban2.png", built: EP1 + "title_built.png", roulette: EP1 + "title_roulette.png", win: EP1 + "title_win.png",
  sub_hydra: EP1 + "sub_hydra.png", sub_tiger: EP1 + "sub_tiger.png", sub_case: EP1 + "sub_case.png", sub_r300: EP1 + "sub_r300.png",
  sub_vampire: EP1 + "sub_vampire.png", sub_bunny: EP1 + "sub_bunny.png", sub_rabbit: EP1 + "sub_rabbit.png",
}, { variant: "ep02" });
post.fin.tHud.value = hud.tex;
const TLD = await (await fetch(EP + "timeline.json", { cache: "no-cache" })).json();
const MK = TLD.marks;

/* ------------------------------------------------------------------ helpers */
const v3 = (a) => new THREE.Vector3(a[0], a[1], a[2]);
const D2R = Math.PI / 180;
const cl = (x) => Math.max(0, Math.min(1, x));
const sm = (x) => { const k = cl(x); return k * k * (3 - 2 * k); };
const L3 = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
const add3 = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const fadeA = (lt, tin, tout, fi = 0.1, fo = 0.15) => cl((lt - tin) / fi) * (1 - cl((lt - tout) / fo));
const SUBS = ["sub_tiger", "sub_bunny", "sub_vampire", "sub_rabbit", "sub_hydra", "sub_case", "sub_r300"];
// MoreCube places
const SPAWN_Y = 85;
const SITE = [2112, 73, 0];
const SY = SITE[1];
const HAMMER5 = [[-1, 0], [0, 0], [1, 0], [0, 1], [0, 2]];
const HERO_SITE = [2114.3, 73, 0.6];
// the parody plaza
const GY = 64;
const SEAT = [3064, -16];
const SEAT_TOP = 68;
const VSC = 2.5; // the owner's size
let FX = {};
let MOOD = "mc";

function hideAll() {
  for (const P of CHARS) {
    P.set({ visible: false });
    P.root.scale.setScalar(1);
  }
  setFat(villain, 0);
  for (const b of blocks) { b.visible = false; b.scale.setScalar(1); b.rotation.set(0, 0, 0); }
  panel.visible = false;
  panel.scale.set(1, 1, 1);
  tipPlane.visible = false;
  for (const m of bills) { m.visible = false; m.scale.setScalar(1); }
  for (const s of SPRITES) s.visible = false;
  for (const k in LET) LET[k].visible = false;
  signPriv.visible = signT.visible = false;
  hammer.visible = false;
  hammer.scale.setScalar(1);
  rain.visible = speedLines.visible = false;
  FX = {};
  np = 0;
}
function pose(P, x, y, z, yawMC, extra = {}) {
  P.set({ x, y, z, yaw: -yawMC * D2R, ...extra });
  P.light(...lightAt(x, y + 1.4, z));
}
function sparkle(cx, cy, cz, n, rad, seed, col = [1.6, 1.2, 0.5], size = 0.12) {
  const r = mulberry32(seed);
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2, u = r() * 2 - 1, d = rad * Math.cbrt(r());
    const s = Math.sqrt(1 - u * u);
    pAdd(cx + Math.cos(a) * s * d, cy + u * d, cz + Math.sin(a) * s * d, col[0], col[1], col[2], size * (0.5 + r()));
  }
}
function dust(cx, cy, cz, s, seed, n = 46, col = [0.9, 0.82, 0.62], spread = 1) {
  if (s < 0 || s > 1.2) return;
  const r = mulberry32(seed);
  const f = Math.exp(-s * 3.2);
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2, up = r() * 0.6, sp = (0.6 + r() * 2.2) * spread;
    pAdd(cx + Math.cos(a) * sp * E.out3(cl(s / 0.8)), cy + up * s * 1.5 - 0.45, cz + Math.sin(a) * sp * E.out3(cl(s / 0.8)), col[0] * f, col[1] * f, col[2] * f, 0.1 + r() * 0.08);
  }
}
function firework(cx, cy, cz, t, seed, col) {
  if (t < -0.45) return;
  if (t < 0) {
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
const ANCH = [];
function anchorLetter(ch, nx, ny, dist, s, k, seed) { if (k > 0) ANCH.push({ L: ch, nx, ny, dist, s, k, seed }); }
function anchorBill(m, nx, ny, dist, s = 1, k = 1) { if (k > 0.001) ANCH.push({ m, nx, ny, dist, s, k }); }
function resolveAnchors() {
  for (const a of ANCH) {
    const p = new THREE.Vector3(a.nx, a.ny, 0.5).unproject(camera).sub(camera.position).normalize().multiplyScalar(a.dist).add(camera.position);
    if (a.L) letter(a.L, p.x, p.y, p.z, a.s, a.k, a.seed);
    else showBill(a.m, p.x, p.y, p.z, a.s, a.k);
  }
  ANCH.length = 0;
}
function letter(ch, x, y, z, s, k, seed) {
  if (k <= 0) return;
  const g = LET[ch];
  g.visible = true;
  g.position.set(x, y + 0.06 * Math.sin(k * 5), z);
  g.userData.face = true;
  g.scale.setScalar(s * E.outBack(cl(k / 0.35)));
  if (k < 0.7) sparkle(x, y, z, 46, s * 6, seed + Math.floor(k * 24), [2.2, 1.7, 0.6], 0.09);
}
function placeHammer5(n, center = SITE) {
  for (let i = 0; i < 5; i++) {
    const b = blocks[i];
    if (i >= n) { b.visible = false; continue; }
    const [dx, dy] = HAMMER5[i];
    b.visible = true;
    b.position.set(center[0] + dx + 0.5, center[1] + dy + 0.5, center[2] + 0.5);
  }
}
function absorb(k) {
  for (let i = 0; i < 5; i++) {
    const [dx, dy] = HAMMER5[i];
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
// the owner on his throne (fat 0..1); extra = pose overrides
function seatOwner(fat, extra = {}) {
  const y = SEAT_TOP - 10 * PX * VSC + 0.02;
  pose(villain, SEAT[0], y, SEAT[1] - 0.25, 0, { lR: -1.45, lL: -1.45, lRz: 0.1, lLz: -0.1, ...extra });
  villain.root.scale.setScalar(VSC);
  setFat(villain, fat);
  villain.light(0.85, 0.55);
  showBill(tags.villain, SEAT[0], y + 32 * PX * VSC + 0.45 + (extra.tagUp || 0), SEAT[1] - 0.25, 1.9);
}
// right shoulder of the seated owner in world space
function ownerShoulder() {
  villain.root.updateMatrixWorld(true);
  const p = new THREE.Vector3();
  villain.armR.getWorldPosition(p);
  return p;
}
// hammer in the owner's right hand at swing angle th (0 = straight up, +: forward/down towards +z)
function swingHammer(th, s = 1.45) {
  const sh = ownerShoulder();
  const dir = new THREE.Vector3(0, Math.cos(th), Math.sin(th));
  hammer.visible = true;
  hammer.scale.setScalar(s);
  hammer.position.copy(sh).addScaledVector(dir, 1.35);
  hammer.rotation.set(th, 0, 0);
  return hammer.position.clone().addScaledVector(dir, HAM_HEAD * s);
}
// hammer dropping head-first from the sky onto (x, groundY, z); k: 0 = high, 1 = impact
function dropHammer(x, gy, z, k, s = 1.45, tilt = 0.12, hgt = 28) {
  hammer.visible = true;
  hammer.scale.setScalar(s);
  const headBottomOffset = (HAM_HEAD + HAM_HALF) * s; // grip -> bottom edge of the head when hanging head-down
  const y = gy + headBottomOffset + (1 - E.in2(k)) * hgt;
  hammer.position.set(x, y, z);
  hammer.rotation.set(Math.PI + tilt, 0, 0.08);
}

/* ------------------------------------------------------------------ shots (times come from the voiceover) */
const SHOT_T0 = {};
const HERO_K1 = [3063.15, GY, -9.85];
const SPAWN_LAND = [3.0, SPAWN_Y, 2.5];

const SHOTS = [
  { id: "K1", label: "Бан: банхаммер владельца, EtoLikos сплющивает и уносит в небо",
    run(lt, dur) {
      const hit = MK.zabanili + 0.04;
      // the swing: accelerating from above to the hit, a recoil, then resting high while the owner laughs
      let th;
      if (lt < hit) th = 0.9 + (2.17 - 0.9) * E.in3(cl(lt / hit));
      else if (lt < hit + 0.45) th = 2.17 - 0.08 * Math.sin((lt - hit) * 14) * Math.exp(-(lt - hit) * 6);
      else th = 2.17 + (0.55 - 2.17) * E.io2(cl((lt - hit - 0.45) / 0.5));
      const laugh = lt > hit + 0.9 ? Math.sin((lt - hit) * 16) * 0.12 : 0;
      seatOwner(0.3, { aRx: th - Math.PI, aRz: 0.08, aLx: -0.35 + laugh, aLz: -0.2, hP: lt > hit + 0.9 ? -0.32 + laugh : 0.25, hY: 0 });
      swingHammer(th);
      // the hero: looks up, raises the arms, gets flattened, then flies off with a «boing»
      const [hx, hy, hz] = HERO_K1;
      if (lt < hit) {
        const cover = sm((lt - 0.12) / 0.15);
        pose(hero, hx, hy, hz, 180, { hP: -0.55, aRx: -2.5 * cover, aLx: -2.5 * cover, aRz: 0.3 * cover, aLz: -0.3 * cover });
        showBill(tags.hero, hx, hy + 2.15, hz, 1);
      } else if (lt < hit + 0.38) {
        pose(hero, hx, hy, hz, 180, { aRz: 1.4, aLz: -1.4 });
        hero.root.scale.set(1.55, 0.22, 1.55);
      } else {
        const f = lt - hit - 0.38;
        const s = E.outBack(cl(f / 0.12));
        pose(hero, hx + f * 2.5, hy + f * 15 - f * f * 3, hz + f * 7.5, 180 - f * 720, { aRz: 1.2, aLz: -1.2, lRz: 0.4, lLz: -0.4, roll: f * 3 });
        hero.root.scale.set(1.55 - 0.55 * s, 0.22 + 0.78 * s, 1.55 - 0.55 * s);
      }
      if (lt >= hit) {
        dust(hx, hy + 0.5, hz, (lt - hit) * 1.3, 11, 70, [0.55, 0.58, 0.64], 1.6);
        if (lt < hit + 0.05) FX.impact = 1;
        else FX.lightning = Math.max(0, 1 - (lt - hit - 0.05) * 4) * 0.8;
      }
      FX.lightning = Math.max(FX.lightning || 0, Math.max(0, 1 - Math.abs(lt - 2.95) * 6) * 0.4);
      const titleA = fadeA(lt, MK.prichina - 0.05, dur + 1, 0.12, 0.2);
      const k = E.out3(cl(lt / dur));
      const cam = add3(L3([3066.4, 66.8, -0.8], [3066.1, 66.9, -1.6], k), shake(lt, hit, 0.28));
      return { mood: "rw", world: "rw", cam, tgt: [3063.6, 68.8 + 0.3 * k, -12.5], fov: 55, sun: SUN_RW, shadow: { c: [3064, GY, -10], r: 30 }, focus: 0,
        hud: { overlays: titleA > 0 ? [{ k: "ban", a: titleA, y: -120 }] : [], noCaption: titleA > 0.05 } };
    } },
  { id: "K2", label: "Полёт через закатное небо и приземление на спавн MoreCube; табло 0:0, VS, буква M",
    run(lt, dur, t) {
      const land = MK.land - SHOT_T0.K2;
      if (lt < land - 0.25) { // flight over the plains at sunset
        const f = lt;
        const p = [2040 + f * 26, 112 - f * 4, -36];
        pose(hero, ...p, -90, { pitch: 1.35, aRx: -3.0, aLx: -3.0, aRz: 0.08, aLz: -0.08, hP: -1.1 });
        speedUpdate(t, v3(p), new THREE.Vector3(-1, 0, 0));
        sparkle(p[0] - 1.2, p[1], p[2], 30, 0.9, 3 + Math.floor(f * 30), [1.6, 1.4, 1.0], 0.08);
        return { mood: "mc", world: "plains", cam: [p[0] + 3.0, p[1] + 0.8, p[2] + 3.4], tgt: [p[0] + 0.9, p[1] + 0.15, p[2]], fov: 58, sun: SUN_HILL, shadow: { c: [2100, 70, 0], r: 40 }, focus: 0, fog: 0.0011 };
      }
      const [lx, ly, lz] = SPAWN_LAND;
      if (lt < land) { // falling into the spawn
        const k = (lt - (land - 0.25)) / 0.25;
        pose(hero, lx, ly + (1 - k) * 9, lz, -40, { aRx: -2.6, aLx: -2.6, aRz: 0.5, aLz: -0.5, lR: -0.5, lL: 0.3 });
      } else {
        const l2 = lt - land;
        const rise = sm((l2 - 0.35) / 0.45);
        const crouch = 1 - rise;
        const look = l2 > 1.0 ? Math.sin((l2 - 1.0) * 2.4) * 0.5 : 0;
        pose(hero, lx, ly, lz, -40, { crouch, aRx: -0.9 * crouch, aRz: 0.2 + 0.6 * crouch, aLx: 0.3 * crouch, aLz: -0.3, hP: 0.25 * crouch - 0.1 * rise, hY: look });
        showBill(tags.hero, lx, ly + 2.15 - 0.3 * crouch, lz, 1, cl((l2 - 0.3) / 0.2));
        dust(lx, ly + 0.45, lz, l2 * 1.2, 21, 60, [0.95, 0.85, 0.62], 1.2);
        if (l2 < 0.06) FX.flash = 0.25;
        anchorLetter("M", -0.45, 0.2, 5.5, 0.11, (t - (SHOT_T0.K2 + 2.45)) / 1.0, 61);
      }
      const k = cl(lt / dur);
      const cam = add3(L3([0.2, 86.7, -3.6], [0.55, 86.75, -2.95], E.out3(k)), shake(lt, land, 0.12));
      return { mood: "mc", world: "spawn", cam, tgt: [4.6, 86.5, 4.2], fov: 52, sun: SUN_SPAWN, shadow: { c: [4, 85, 4], r: 30 }, focus: 7.2, aper: 0.25 };
    } },
  { id: "K3", label: "Раунд 1 · Донат: табличка «ПРИВИЛЕГИЯ 99 999 ₽» → /codes бесплатно, D.HELPER, буква O",
    run(lt, dur, t) {
      const tut = MK.tut1 - SHOT_T0.K3;
      if (lt < tut) {
        seatOwner(0.4, { aRx: -1.25, aRz: 0.15, aLx: -0.2, hP: 0.12 + 0.05 * Math.sin(lt * 9), hY: 0.1 });
        signPriv.visible = true;
        signPriv.position.set(3062.9, 69.35, -14.1);
        signPriv.rotation.set(-0.1, 0.47, 0.03);
        signPriv.scale.setScalar(3.0 * E.outBack(cl(lt / 0.25)));
        const pockets = sm((lt - 0.55) / 0.25);
        pose(hero, 3064.9, GY, -10.4, 175, { aRz: 0.15 + 1.0 * pockets, aLz: -0.15 - 1.0 * pockets, aRx: -0.2 * pockets, aLx: -0.2 * pockets, hP: -0.35, hY: 0.15 });
        showBill(tags.hero, 3064.9, GY + 2.15, -10.4, 1);
        if (lt > 0.6) { // moths out of empty pockets
          const r = mulberry32(5);
          for (let i = 0; i < 6; i++) {
            const a = r() * 6.28, f = (lt - 0.6) * (0.6 + r() * 0.6);
            pAdd(3064.9 + Math.cos(a) * 0.4 + Math.sin(f * 9 + i) * 0.15, GY + 0.9 + f * 1.4, -10.4 + Math.sin(a) * 0.4, 0.55, 0.55, 0.5, 0.11);
          }
        }
        const k = E.out3(cl(lt / tut));
        return { mood: "rw", world: "rw", cam: L3([3067.4, 65.3, -5.2], [3067.0, 65.5, -5.8], k), tgt: [3063.6, 68.8, -14.2], fov: 52, sun: SUN_RW, shadow: { c: [3064, GY, -12], r: 26 }, focus: 0 };
      }
      const l = lt - tut;
      const up = sm((l - 0.05) / 0.4);
      pose(hero, 0.5, SPAWN_Y, 0.5, -60, { aRx: -0.2 - 1.9 * up * (1 - sm((l - 1.6) / 0.4)), aRy: 0.15, aRz: 0.1, hP: -0.4 * sm(l / 0.4), hY: 0.1 });
      showBill(tags.cmd, 0.5, SPAWN_Y + 2.57, 0.5, 1, cl(l / 0.22));
      const dT = MK.kodes + 0.1 - MK.tut1;
      if (l < dT) showBill(tags.hero, 0.5, SPAWN_Y + 2.15, 0.5, 1);
      else {
        showBill(tags.heroD, 0.5, SPAWN_Y + 2.15, 0.5, 1, cl((l - dT) / 0.25));
        sparkle(0.5, SPAWN_Y + 2.15, 0.5, 70, 0.4 + 0.6 * cl((l - dT) / 0.3), 41 + Math.floor(l * 8), [2.0, 1.8, 0.4], 0.07);
        FX.flash = Math.max(0, 0.11 * Math.exp(-(l - dT) * 9));
      }
      const u = E.outBack(cl((l - 0.25) / 0.4));
      panel.visible = l > 0.25;
      panel.scale.set(1, Math.max(0.02, u), 1);
      panel.position.set(1.7, SPAWN_Y + 3.15, 0.9);
      panel.userData.face = true;
      const hovT = MK.besplatno - MK.tut1 - 0.12;
      panelPlane.material.map = l >= hovT ? panelTex.free : panelTex.plain;
      tipPlane.visible = l >= hovT;
      tipPlane.position.set(0.62, -1.25, 0.06);
      tipPlane.scale.setScalar(0.95 * E.outBack(cl((l - hovT) / 0.2)));
      sparkle(1.7, SPAWN_Y + 3.15, 0.9, 30, 1.6, 31 + Math.floor(l * 6), [1.6, 1.0, 0.4], 0.08);
      anchorLetter("O", 0.52, -0.05, 5.0, 0.09, (l - 1.05) / 1.0, 71);
      const k = E.out3(cl(l / (dur - tut)));
      return { mood: "mc", world: "spawn", cam: L3([4.9, 86.5, 7.1], [4.4, 86.65, 6.3], k), tgt: [1.35, 87.55, 0.6], fov: 56, sun: SUN_SPAWN, shadow: { c: [1, 85, 0], r: 25 }, focus: 6.6, aper: 0.25 };
    } },
  { id: "K4", label: "Раунд 2 · Призы: ценники на всём (алмаз, воздух, постоять) → молоток, рулетка, приз, буква L",
    run(lt, dur, t) {
      const tut = MK.tut2 - SHOT_T0.K4;
      if (lt < tut) {
        const shrug = sm((lt - 0.7) / 0.3);
        pose(hero, 3078.0, GY, 0.8, 70, { hY: 0.25 - 0.5 * sm((lt - 0.2) / 0.3) * (1 - shrug), aRz: 0.1 + 0.6 * shrug, aLz: -0.1 - 0.6 * shrug, aRx: -0.35 * shrug, aLx: -0.35 * shrug, hP: -0.05 });
        showBill(tags.hero, 3078.0, GY + 2.15, 0.8, 1);
        anchorBill(prices.diamond, 0.22, 0.3, 8.5, 0.9, (lt - 0.2) / 0.22);
        anchorBill(prices.air, -0.3, -0.06, 6.5, 0.75, (lt - 0.42) / 0.22);
        anchorBill(prices.bench, 0.0, -0.52, 6.0, 0.7, (lt - 0.64) / 0.22);
        const k = E.out3(cl(lt / tut));
        return { mood: "rw", world: "rw", cam: L3([3071.6, 65.7, 3.6], [3072.0, 65.8, 2.9], k), tgt: [3079.4, 65.7, -0.9], fov: 52, sun: SUN_RW, shadow: { c: [3078, GY, -2], r: 22 }, focus: 0 };
      }
      const l = lt - tut;
      const tm = MK.molotok - MK.tut2;
      const tp = MK.priz - MK.tut2;
      if (l < tm + 0.05) {
        const n = Math.min(4, Math.floor((l - 0.25) / 0.22) + 1);
        placeHammer5(Math.max(0, n));
        if (l >= tm) placeHammer5(5);
        pose(hero, ...HERO_SITE, 35, { aRx: -0.9 - 0.5 * Math.abs(Math.sin(l * 9)), aRz: 0.15, hP: 0.25, hY: 0.45 });
        showBill(tags.hero, HERO_SITE[0], SY + 2.15, HERO_SITE[2], 1);
        if (n >= 3) anchorLetter("L", -0.5, 0.28, 6.0, 0.1, (l - 0.25 - 2 * 0.22) / 1.0, 81);
        const k = E.out3(cl(l / tm));
        return { mood: "mc", world: "plains", cam: L3([2118.1, SY + 2.3, 8.2], [2117.5, SY + 2.2, 7.5], k), tgt: [2112.6, SY + 1.2, -0.1], fov: 54, sun: SUN_HILL, shadow: { c: [2112, SY, 0], r: 22 }, focus: 6.4, aper: 0.22 };
      }
      const la = l - tm;
      const kA = cl(la / 0.85);
      absorb(E.in2(kA));
      pose(hero, ...HERO_SITE, 35, { hP: -0.25, hY: 0.45, aRx: -0.3 - 0.45 * kA, aLx: -0.3 - 0.45 * kA, aRz: 0.35 + 0.35 * kA, aLz: -0.35 - 0.35 * kA });
      sparkle(HERO_SITE[0], SY + 1.3, HERO_SITE[2], 30 + Math.floor(70 * kA), 0.6 + 0.6 * kA, 9 + Math.floor(la * 9), [2.0, 1.4, 0.6], 0.09);
      const ov = [];
      const titleA = fadeA(la, 0.08, 0.68, 0.08, 0.1);
      if (titleA > 0) ov.push({ k: "built", a: titleA, y: -150 });
      const won = l >= tp;
      if (la >= 0.7 && !won) {
        const nn = Math.floor((la - 0.7) / 0.08);
        ov.push({ k: "roulette", a: 1, y: -330 }, { k: SUBS[nn % SUBS.length], a: 1, y: -330 });
      }
      if (won) {
        ov.push({ k: "win", a: 1, y: -260 });
        for (let j = 0; j < 3; j++) firework(HERO_SITE[0] - 3 + j * 3, SY + 7 + j, HERO_SITE[2] - 4, l - tp - 0.1 - j * 0.25, 90 + j, [[2.2, 1.4, 0.4], [0.6, 1.8, 2.2], [2.2, 0.6, 1.6]][j]);
      }
      const k = E.io2(cl(la / (dur - tut - tm)));
      return { mood: "mc", world: "plains", cam: L3([2117.4, SY + 1.0, 6.2], [2116.6, SY + 1.15, 5.2], k), tgt: [2113.8, SY + 1.75, 0.4], fov: 50, sun: SUN_HILL, shadow: { c: [2113, SY, 0], r: 22 },
        focus: 6.4, aper: 0.3, hud: { overlays: ov, noCaption: ov.length > 0 } };
    } },
  { id: "K5", label: "Раунд 3 · Баны: «привет» → банхаммер с неба; на MoreCube _pogostik_ отвечает «привет!» и кидает кейс, буква O",
    run(lt, dur, t) {
      const tut = MK.tut3 - SHOT_T0.K5;
      if (lt < tut) {
        const imp = MK.privet1 + 0.3 - SHOT_T0.K5;
        const hx = 3064.2, hz = 3.0;
        if (lt < imp) {
          const typing = lt > 0.15 && lt < 0.6;
          pose(hero, hx, GY, hz, 165, { aRx: typing ? -1.0 + 0.15 * Math.sin(lt * 40) : -0.3, hP: lt > imp - 0.35 ? -0.7 : 0.15, hY: -0.15 });
          showBill(tags.hello, hx, GY + 2.57, hz, 1, cl((lt - 0.12) / 0.2));
          showBill(chats.hello, hx - 1.45, GY + 2.9, hz + 0.2, 1, cl((lt - 0.45) / 0.2));
          showBill(tags.hero, hx, GY + 2.15, hz, 1);
          dropHammer(hx, GY, hz, cl((lt - (imp - 0.5)) / 0.5), 1.1, 0.12, 13);
        } else {
          pose(hero, hx, GY, hz, 165, { aRz: 1.4, aLz: -1.4 });
          hero.root.scale.set(1.55, 0.22, 1.55);
          dropHammer(hx, GY, hz, 1, 1.1);
          if (lt < imp + 0.05) FX.impact = 1;
          else FX.lightning = Math.max(0, 1 - (lt - imp - 0.05) * 4) * 0.7;
          dust(hx, GY + 0.5, hz, (lt - imp) * 1.3, 33, 60, [0.55, 0.58, 0.64], 1.5);
        }
        const titleA = fadeA(lt, imp + 0.05, tut + 1, 0.1, 0.2);
        const cam = add3([3070.5, 64.9, 9.6], shake(lt, imp, 0.25));
        return { mood: "rw", world: "rw", cam, tgt: [3064.3, 67.6, 2.6], fov: 58, sun: SUN_RW, shadow: { c: [3064, GY, 3], r: 24 }, focus: 0,
          hud: { overlays: titleA > 0 ? [{ k: "ban2", a: titleA, y: -60 }] : [], noCaption: titleA > 0.05 } };
      }
      const l = lt - tut;
      const hx = 2.65, hz = 3.9, px = 4.15, pz = 2.9;
      const rep = MK.privet2 - MK.tut3;
      const typing = l > 0.1 && l < 0.6;
      const caught = l > rep + 0.75;
      pose(hero, hx, SPAWN_Y, hz, -124, { aRx: typing ? -1.0 + 0.15 * Math.sin(l * 40) : caught ? -1.2 : -0.2, aLx: caught ? -1.2 : 0, hP: 0.05, hY: 0.1 });
      showBill(tags.hello, hx, SPAWN_Y + 2.57, hz, 1, cl((l - 0.08) / 0.2) * (1 - cl((l - rep) / 0.2)));
      showBill(tags.hero, hx, SPAWN_Y + 2.15, hz, 1);
      showBill(chats.hello, hx - 0.2, SPAWN_Y + 3.15, hz - 0.2, 1, cl((l - 0.35) / 0.2));
      const wave = l > rep - 0.05 ? Math.sin((l - rep) * 14) * 0.35 : 0;
      const throwK = cl((l - rep - 0.35) / 0.4);
      pose(pog, px, SPAWN_Y, pz, 56, { aRx: l > rep - 0.05 ? -2.7 + 0.6 * throwK : -0.1, aRz: 0.2 + wave, hP: 0.0, hY: -0.1 });
      showBill(tags.pog, px, SPAWN_Y + 2.15, pz, 1);
      showBill(chats.owner, px + 0.1, SPAWN_Y + 3.15, pz + 0.1, 1, cl((l - rep) / 0.2));
      if (throwK > 0 && !caught) {
        const c = cases[0];
        c.visible = true;
        const p = L3([px - 0.2, SPAWN_Y + 1.6, pz - 0.3], [hx + 0.3, SPAWN_Y + 1.3, hz + 0.3], throwK);
        c.position.set(p[0], p[1] + Math.sin(throwK * Math.PI) * 1.2, p[2]);
        c.scale.setScalar(0.5);
      }
      if (caught) {
        const c = cases[0];
        c.visible = true;
        c.position.set(hx + 0.25, SPAWN_Y + 1.25, hz + 0.3);
        c.scale.setScalar(0.5);
        sparkle(hx + 0.25, SPAWN_Y + 1.25, hz + 0.3, 30, 0.5, 51 + Math.floor(l * 8), [2.0, 1.6, 0.6], 0.08);
      }
      anchorLetter("O", 0.0, 0.3, 6.0, 0.09, (l - 0.95) / 1.0, 91);
      const k = E.out3(cl(l / (dur - tut)));
      return { mood: "mc", world: "spawn", cam: L3([0.1, 86.6, -1.6], [0.35, 86.65, -1.1], k), tgt: [3.4, 86.45, 3.4], fov: 52, sun: SUN_SPAWN, shadow: { c: [3, 85, 3], r: 25 }, focus: 5.6, aper: 0.45 };
    } },
  { id: "K6", label: "Раунд 4 · Владелец: толстый владелец жуёт яблоки под дождём изумрудов, табличка T → _pogostik_ раздаёт кейсы толпе",
    run(lt, dur, t) {
      const tut = MK.tut4 - SHOT_T0.K6;
      if (lt < tut) {
        const fat = 0.6 + 0.4 * sm(lt / tut);
        const chew = Math.sin(lt * 17) * 0.06;
        const bite = 0.5 + 0.5 * Math.sin(lt * 7.5);
        const burpT = MK.zazhralsya + 0.55 - SHOT_T0.K6;
        const burp = Math.max(0, 1 - Math.abs(lt - burpT - 0.1) * 5);
        seatOwner(fat, { aRx: -1.35 - 0.55 * bite, aRy: 0.35, aRz: 0.25, aLx: -0.9, aLz: -0.35, hP: 0.1 + chew - 0.45 * burp, hY: 0.08, tagUp: 0.25 });
        // golden apple in the hand, near the mouth
        const sh = ownerShoulder();
        const a = apples[0];
        a.visible = true;
        a.position.set(SEAT[0] - 0.35 + 0.2 * (1 - bite), 70.25, SEAT[1] + 0.55 + 0.5 * (1 - bite));
        a.scale.setScalar(0.85);
        if (burp > 0.2) sparkle(SEAT[0], 72.4, SEAT[1] + 0.9, 26, 0.7, 7 + Math.floor(lt * 20), [0.5, 1.4, 0.4], 0.14);
        // emeralds and gold raining around the throne
        const r = mulberry32(9);
        for (let i = 0; i < gems.length; i++) {
          const g = gems[i];
          const x0 = SEAT[0] + (r() - 0.5) * 9, z0 = SEAT[1] + 2 + (r() - 0.5) * 6, ph = r() * 6, sp = 5 + r() * 3;
          const y = GY + 1 + ((((ph * 3 - lt * sp) % 10) + 10) % 10);
          g.visible = true;
          g.position.set(x0, y, z0);
          g.scale.setScalar(0.45);
        }
        anchorLetter("T", 0.5, 0.12, 7.0, 0.11, (lt - 0.85) / 1.0, 101);
        const k = E.out3(cl(lt / tut));
        return { mood: "rw", world: "rw", cam: L3([3066.1, 65.3, -3.6], [3065.6, 65.6, -4.6], k), tgt: [3063.7, 69.2, -15.3], fov: 47, sun: SUN_RW, shadow: { c: [3064, GY, -14], r: 24 }, focus: 0 };
      }
      const l = lt - tut;
      // _pogostik_ throws cases into a cheering crowd
      const px = 0.5, pz = 0.5;
      const thr = (l * 2.6) % 1;
      pose(pog, px, SPAWN_Y, pz, -10, { aRx: -2.5 + 1.6 * E.out2(thr), aRz: 0.25, hP: -0.15 });
      showBill(tags.pog, px, SPAWN_Y + 2.15, pz, 1);
      const ring = [[3.2, -0.2], [3.6, 1.6], [2.4, 3.2], [0.6, 3.8], [-1.2, 3.2], [-2.2, 1.8]];
      extras.forEach((P, i) => {
        const [ex, ez] = ring[i];
        const j = Math.max(0, Math.sin(l * 9 + i * 1.3)) * 0.35;
        const yaw = Math.atan2(px - ex, pz - ez) / D2R;
        pose(P, px + ex, SPAWN_Y + j, pz + ez, -yaw, { aRx: -2.8, aLx: -2.6 + 0.2 * Math.sin(l * 8 + i), aRz: 0.2, aLz: -0.2, hP: -0.3 });
      });
      const hj = Math.max(0, Math.sin(l * 9 + 4)) * 0.35;
      pose(hero, -1.5, SPAWN_Y + hj, -0.7, -59, { aRx: -2.8, aLx: -2.8, aRz: 0.2, aLz: -0.2, hP: -0.35 });
      showBill(tags.heroD, -1.5, SPAWN_Y + 2.15 + hj, -0.7, 1);
      for (let i = 0; i < 4; i++) {
        const k = cl((l - 0.1 - i * 0.38) / 0.55);
        if (k <= 0 || k >= 1) continue;
        const [ex, ez] = ring[(i * 2 + 1) % 6];
        const c = cases[1 + i];
        c.visible = true;
        const p = L3([px, SPAWN_Y + 2.0, pz], [px + ex, SPAWN_Y + 2.2, pz + ez], k);
        c.position.set(p[0], p[1] + Math.sin(k * Math.PI) * 1.6, p[2]);
        c.scale.setScalar(0.5);
        sparkle(c.position.x, c.position.y, c.position.z, 8, 0.25, 111 + i + Math.floor(l * 10), [2.0, 1.6, 0.6], 0.07);
      }
      const k = E.out3(cl(l / (dur - tut)));
      return { mood: "mc", world: "spawn", cam: L3([-3.6, 88.4, -4.8], [-3.1, 88.2, -4.2], k), tgt: [1.4, 86.0, 1.9], fov: 52, sun: SUN_SPAWN, shadow: { c: [1, 85, 2], r: 25 }, focus: 0 };
    } },
  { id: "K7", label: "Финал: «4 : 0», владелец один под дождём, буква O",
    run(lt, dur, t) {
      seatOwner(1.0, { aRx: -0.1, aLx: -0.1, aRz: 0.15, aLz: -0.15, hP: 0.5, hY: 0.1 });
      const lightning = MK.chetyre + 0.05 - SHOT_T0.K7;
      FX.lightning = Math.max(0, 1 - Math.abs(lt - lightning) * 5);
      anchorLetter("O", -0.55, 0.32, 8.0, 0.1, (lt - (MK.nol + 0.2 - SHOT_T0.K7)) / 0.8, 121);
      const k = E.out3(cl(lt / dur));
      return { mood: "rw", world: "rw", rainHeavy: 1.6, cam: L3([3071.5, 71.2, 4.2], [3071.0, 70.8, 3.2], k), tgt: [3064, 67.4, -12.5], fov: 50, sun: SUN_RW, shadow: { c: [3064, GY, -10], r: 30 }, focus: 0,
        hud: { bigScore: cl((t - MK.chetyre + 0.03) / 0.5), noCaption: true } };
    } },
  { id: "K8", label: "IP, код по буквам, петля: EtoLikos машет на холме, сверху снова летит банхаммер",
    run(lt, dur, t) {
      const loopT = dur - 0.62;
      const card = cl((t - MK.aypi + 0.05) / 0.25) * (1 - cl((lt - loopT) / 0.15));
      const slots = cl((t - MK.kod - 0.25) / 0.84);
      const fk = t > MK.bukvam + 0.05 && t < MK.bukvam + 0.95 ? (Math.floor((t - MK.bukvam) * 8) % 2 === 0 ? 1 : 0.35) : 0;
      if (lt < loopT) {
        const wave = Math.sin(lt * 9) * 0.45;
        pose(hero, ...HERO_SITE, 200, { aRx: -2.9, aRz: 0.3 + wave, aLz: -0.08, hP: -0.1, hY: 0.1 });
        showBill(tags.heroD, HERO_SITE[0], SY + 2.15, HERO_SITE[2], 1);
        anchorLetter("K", 0.45, 0.3, 6.0, 0.09, (t - MK.bukvam - 0.05) / 1.2, 131);
        const k = E.out3(cl(lt / loopT));
        return { mood: "mc", world: "plains", cam: L3([2115.6, 74.6, 9.5], [2115.5, 74.55, 8.9], k), tgt: [2114.5, 73.45, 0.6], fov: 50, sun: SUN_HILL, shadow: { c: [2114, SY, 0], r: 22 },
          focus: 6.0, aper: 0.18, hud: { endcard2: card, slots, flashK: fk, noCaption: card > 0.05 } };
      }
      // the loop: looking up, the ban hammer is falling again
      const l = lt - loopT;
      pose(hero, ...HERO_SITE, 200, { hP: -0.9, aRx: -2.3 * sm(l / 0.3), aLx: -2.3 * sm(l / 0.3) });
      dropHammer(HERO_SITE[0], SY, HERO_SITE[2], 0.45 + 0.4 * (l / 0.62), 1.45, 0.25);
      return { mood: "mc", world: "plains", cam: [HERO_SITE[0] + 2.6, SY + 0.9, HERO_SITE[2] + 3.4], tgt: [HERO_SITE[0] - 0.4, SY + 9, HERO_SITE[2] - 0.6], fov: 60, sun: SUN_HILL,
        shadow: { c: [2114, SY, 0], r: 22 }, focus: 0, hud: { endcard2: card, slots, flashK: 0, noCaption: true } };
    } },
];
for (const S of SHOTS) {
  const T_ = TLD.shots.find((x) => x.id === S.id);
  S.t0 = T_.t0;
  S.t1 = T_.t1;
  S.key = (T_.t0 + T_.t1) / 2;
  SHOT_T0[S.id] = T_.t0;
}

/* ------------------------------------------------------------------ view: mood, light, post, HUD */
const SKY_MC = { zen: new THREE.Color("#3e6fbf"), hor: new THREE.Color("#f3c79a"), gnd: new THREE.Color("#6b5a52"), sun: new THREE.Color(1, 0.72, 0.42) };
const SKY_RW = { zen: new THREE.Color("#1d2430"), hor: new THREE.Color("#454c5a"), gnd: new THREE.Color("#26262b"), sun: new THREE.Color(0.45, 0.5, 0.6) };
function scoreState(t) {
  const pts = [MK.pt1, MK.pt2, MK.pt3, MK.pt4];
  let l = 0, pulse = 0, plus = 0;
  for (const p of pts) if (t >= p) {
    l++;
    const d = t - p;
    if (d < 0.6) pulse = Math.max(pulse, Math.exp(-d * 6));
    if (d < 0.8) plus = d / 0.8;
  }
  const rounds = [[MK.r1, "РАУНД 1 · ДОНАТ"], [MK.r2, "РАУНД 2 · ПРИЗЫ"], [MK.r3, "РАУНД 3 · БАНЫ"], [MK.r4, "РАУНД 4 · ВЛАДЕЛЕЦ"]];
  let round = null, roundA = 0;
  for (const [r0, txt] of rounds) if (t >= r0 - 0.05 && t < r0 + 1.6) { round = txt; roundA = cl((t - r0 + 0.05) / 0.2) * (1 - cl((t - r0 - 1.3) / 0.3)); }
  const sIn = cl((t - (MK.land + 0.1)) / 0.35);
  const out = t >= SHOT_T0.K8 ? cl((t - SHOT_T0.K8) / 0.25) : 0;
  const vs = t >= MK.rilik - 0.15 && t < MK.rilik + 1.2 ? cl((t - MK.rilik + 0.15) / 0.5) * (1 - cl((t - MK.rilik - 0.85) / 0.3)) : 0;
  return { l, r: 0, pulseA: pulse, plus, round, roundA, slide: 1 - E.out3(sIn), a: (1 - out) * (t < MK.land ? 0 : 1), vs };
}
function applyView(V, t) {
  const rwM = V.mood === "rw";
  MOOD = V.mood;
  spawn.group.visible = V.world === "spawn";
  ents.group.visible = V.world === "spawn";
  plains.group.visible = V.world === "plains";
  rw.group.visible = V.world === "rw";
  camera.fov = V.fov || 50;
  camera.aspect = W / H;
  camera.updateProjectionMatrix();
  camera.position.copy(v3(V.cam));
  camera.lookAt(v3(V.tgt));
  camera.updateMatrixWorld();
  resolveAnchors();
  const sd = V.sun.clone();
  WU.uSunDir.value.copy(sd);
  const lf = FX.lightning || 0;
  if (rwM) {
    WU.uFogCol.value.setRGB(0.3 + 0.4 * lf, 0.34 + 0.4 * lf, 0.42 + 0.45 * lf);
    WU.uFogSun.value.setRGB(0.34, 0.38, 0.46);
    WU.uFogDen.value = V.fog ?? 0.011;
    WU.uBlockK.value = 1.9;
    hemi.color.setHex(0x7d8aa0);
    hemi.groundColor.setHex(0x2b2b31);
    hemi.intensity = 1.55 + 1.4 * lf;
    sun.color.setHex(0x9fb2d0);
    sun.intensity = 1.3 + 2.0 * lf;
    sky.U.uZen.value.copy(SKY_RW.zen).lerp(new THREE.Color("#8fa4c8"), lf * 0.7);
    sky.U.uHor.value.copy(SKY_RW.hor).lerp(new THREE.Color("#c8d4ea"), lf * 0.7);
    sky.U.uGround.value.copy(SKY_RW.gnd);
    sky.U.uSunCol.value.copy(SKY_RW.sun);
    sky.U.uGlow.value = 0.05;
    clouds.mesh.visible = false;
  } else {
    WU.uFogCol.value.setRGB(0.75, 0.62, 0.55);
    WU.uFogSun.value.setRGB(1.0, 0.7, 0.42);
    WU.uFogDen.value = V.fog ?? 0.0018;
    WU.uBlockK.value = 1.25;
    hemi.color.setHex(0xc4d6f5);
    hemi.groundColor.setHex(0x7a6252);
    hemi.intensity = 1.45;
    sun.color.setHex(0xffcf98);
    sun.intensity = 3.3;
    sky.U.uZen.value.copy(SKY_MC.zen);
    sky.U.uHor.value.copy(SKY_MC.hor);
    sky.U.uGround.value.copy(SKY_MC.gnd);
    sky.U.uSunCol.value.copy(SKY_MC.sun);
    sky.U.uGlow.value = 1;
    clouds.mesh.visible = true;
  }
  const c = v3(V.shadow.c), r = V.shadow.r;
  sun.target.position.copy(c);
  sun.position.copy(c).addScaledVector(sd, 300);
  const sc = sun.shadow.camera;
  sc.left = -r; sc.right = r; sc.top = r; sc.bottom = -r; sc.near = 50; sc.far = 700;
  sc.updateProjectionMatrix();
  sun.target.updateMatrixWorld();
  sun.updateMatrixWorld();
  sky.place(camera, rwM ? 0 : 1, 1);
  if (V.world === "spawn") ents.update(camera, 1);
  WU.uTime.value = t;
  if (rwM) rainUpdate(t, camera.position, V.rainHeavy ?? 1);
  for (const m of bills) if (m.visible) m.quaternion.copy(camera.quaternion);
  if (panel.visible && panel.userData.face) panel.quaternion.copy(camera.quaternion);
  for (const k in LET) {
    const g = LET[k];
    if (g.visible) g.rotation.set(0, Math.atan2(camera.position.x - g.position.x, camera.position.z - g.position.z), 0);
  }
  post.dof.uFocus.value = V.focus || 10;
  post.dof.uAper.value = V.focus ? V.aper || 0.4 : 0;
  post.dof.uMax.value = V.focus ? 10 : 0;
  const sp = camera.position.clone().addScaledVector(sd, 1000).project(camera);
  const inFront = sp.z < 1 && sp.x > -1.4 && sp.x < 1.4 && sp.y > -1.4 && sp.y < 1.4;
  post.rays.uSun.value.set(sp.x * 0.5 + 0.5, sp.y * 0.5 + 0.5);
  post.rays.uStr.value = inFront && !rwM ? 0.75 : 0;
  post.bloom.strength = rwM ? 0.42 : 0.36;
  post.bloom.radius = 0.6;
  post.bloom.threshold = rwM ? 0.8 : 0.92;
  const G = post.grade;
  if (rwM) {
    G.uExpo.value = (V.expo || 1.15) + 0.3 * lf;
    G.uSat.value = 0.5;
    G.uKeepWarm.value = 1;
    G.uCon.value = 1.12;
    G.uVig.value = V.vig ?? 0.55;
    G.uTint.value.set(0.9, 0.95, 1.07);
    G.uShadow.value.set(0.84, 0.93, 1.14);
    G.uHigh.value.set(1.0, 1.0, 1.04);
  } else {
    G.uExpo.value = V.expo || 1.06;
    G.uSat.value = 1.14;
    G.uKeepWarm.value = 0;
    G.uCon.value = 1.07;
    G.uVig.value = V.vig ?? 0.38;
    G.uTint.value.set(1.0, 0.98, 0.95);
    G.uShadow.value.set(0.92, 0.97, 1.06);
    G.uHigh.value.set(1.06, 1.0, 0.92);
  }
  G.uFlash.value = Math.max(FX.flash || 0, lf * 0.22);
  if (lf > (FX.flash || 0)) G.uFlashCol.value.set(2.4, 2.8, 3.6);
  else G.uFlashCol.value.set(4, 3.6, 3);
  G.uImpact.value = FX.impact || 0;
  post.fin.uGrain.value = 0.02;
  post.fin.uCA.value = FX.impact ? 0.004 : 0.0006;
  post.fin.uGlitch.value = 0;
  post.fin.uHudOn.value = 1;
  const st = { ...(V.hud || {}) };
  const sc_ = scoreState(t);
  if (sc_.a > 0.01) st.score = sc_;
  if (t >= MK.rilik + 0.5 && t < SHOT_T0.K3 + 0.2) st.codeHint = cl((t - MK.rilik - 0.5) / 0.2) * (1 - cl((t - SHOT_T0.K3) / 0.2));
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
  applyView(V, t);
  pCommit();
  post.fin.uFrame.value = Math.floor(t * 30);
  post.render();
}

window.__dbg = {
  renderer, scene, camera, post, hero, villain, pog, hammer, SHOTS, TLD, MK, lightAt, render,
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
