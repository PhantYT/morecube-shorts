// Episode 3 «Не заходи на копии рилика»: EtoLikos (skin cherepaxa) picks servers from a floating Minecraft
// multiplayer list and tours four parody «копии рилика» on a cheap floating island — dead online with a sleeping
// admin, lag with rubber-banding, a price for every jump, a scam that crumbles block by block — then the «рилик»
// owner's ban hammer (ep02), then MoreCube with a crowd and an explicit «как зайти» (add server -> /code PODAROK).
// Every shot is run(lt, dur, t); window.__dbg.still(i) renders shot i at its key time.
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
const EP = BASE + "ep03/", EP2 = BASE + "ep02/", EP1 = BASE + "ep01/";

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
const SUN_K7 = new THREE.Vector3(-0.45, 0.55, -0.7).normalize();  // behind the K7/K8 cameras
const SUN_RW = new THREE.Vector3(-0.35, 0.8, 0.5).normalize();
const SUN_COPY = new THREE.Vector3(0.45, 0.62, 0.64).normalize();
const envMC = bakeEnv("#4677c9", "#f4c494", "#5d5048", SUN_SPAWN);
const envRW = bakeEnv("#232a36", "#4d5462", "#222228", SUN_RW, 0.3);

const [spawnAtlas, rwAtlas, copyAtlas] = await Promise.all([atlasTex(BASE + "atlas.png"), atlasTex(BASE + "rw/atlas.png"), atlasTex(BASE + "copy/atlas.png")]);
const spawn = await loadWorld(BASE, spawnAtlas, envMC);
const rw = await loadWorld(BASE + "rw/", rwAtlas, envRW);
const copy = await loadWorld(BASE + "copy/", copyAtlas, envMC);
scene.add(spawn.group, rw.group, copy.group);
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
const LV = [await lightVol(BASE), await lightVol(BASE + "rw/"), await lightVol(BASE + "copy/")];
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
const hero = makePlayer({ skin: await loader.loadAsync(EP2 + "skin_cherepaxa.png"), slim: false });
const villain = makePlayer({ skin: await loader.loadAsync(EP2 + "skin_owner.png"), slim: false });
const pog = makePlayer({ skin: await loader.loadAsync(BASE + E_.npcs.find((n) => n.id === "тиктокер").skin), slim: false });
const npcIds = ["барыга", "киллер", "фри", "аукцион", "рынок", "шахтер"];
const npcSkins = [];
for (const id of npcIds) {
  const n = E_.npcs.find((x) => x.id === id);
  if (n) npcSkins.push({ tex: await loader.loadAsync(BASE + n.skin), slim: n.slim });
}
const admin = makePlayer({ skin: npcSkins[0].tex, slim: npcSkins[0].slim });
const CROWD_SKINS = ["05ef3a43b5b5", "060342c3f951", "0c3a8a19d801", "14c00408cb57", "14c40a676fa4", "1eeb5c1cb554", "340d442409e4", "3ace461c8bc5", "423edd85eb5f",
  "55fbd6cbdc75", "6db054e96026", "7c8c656d71ee", "88d33dbfbd92", "88e3fe73a160", "9ea377c922f5", "dc464db0c1a2", "ed58c7b48bfa", "2c8a2de19073"];
const pogSkin = E_.npcs.find((n) => n.id === "тиктокер").skin;
const slimOf = {};
for (const n of E_.npcs) if (n.skin) slimOf[n.skin] = !!n.slim;
const crowdSkins = [];
for (const h of CROWD_SKINS) {
  const p = "skins/" + h + ".png";
  if (p !== pogSkin) crowdSkins.push({ tex: await loader.loadAsync(BASE + p), slim: slimOf[p] ?? false });
}
const crowd = [];
for (let i = 0; i < 30; i++) {
  const s = crowdSkins[(i * 7) % crowdSkins.length];
  crowd.push(makePlayer({ skin: s.tex, slim: s.slim }));
}
const CHARS = [hero, villain, pog, admin, ...crowd];
for (const P of CHARS) scene.add(P.root);
function setFat(P, k) {
  for (const m of [P.torso.children[0], P.torso.children[1]]) m.scale.set(1 + 0.8 * k, 1 + 0.03 * k, 1 + 1.1 * k);
  P.armR.position.x = -(5 + 3.2 * k) * PX;
  P.armL.position.x = (5 + 3.2 * k) * PX;
  P.legR.position.x = -(1.9 + 1.5 * k) * PX;
  P.legL.position.x = (1.9 + 1.5 * k) * PX;
}

/* ------------------------------------------------------------------ props */
const box = new THREE.BoxGeometry(1, 1, 1);
function planeTex(tex, w, h, opts = {}) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false, depthWrite: false, side: THREE.DoubleSide, ...opts }));
  m.renderOrder = 6;
  scene.add(m);
  return m;
}
const glowC = document.createElement("canvas");
glowC.width = glowC.height = 128;
{
  const g = glowC.getContext("2d");
  const gr = g.createRadialGradient(64, 64, 8, 64, 64, 64);
  gr.addColorStop(0, "rgba(255,255,255,0.85)");
  gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr;
  g.fillRect(0, 0, 128, 128);
}
const glowTex = new THREE.CanvasTexture(glowC);
function glowPlane(w, h, color) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: glowTex, color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, opacity: 0.5 }));
  m.renderOrder = 5;
  scene.add(m);
  return m;
}
// floating GUI panels (server list, screens, dialog, tab list, shop)
const srvTex = [await pix(EP + "srv_list.png")];
for (let i = 1; i <= 5; i++) srvTex.push(await pix(EP + `srv_list_sel${i}.png`));
const SRV_AR = 252 / 320;
const srv = planeTex(srvTex[0], 4.4, 4.4 * SRV_AR);
const srvGlow = glowPlane(6.4, 5.4, new THREE.Color(0.75, 0.55, 1.0));
const connectTex = await pix(EP + "screen_connect.png");
const lostTex = await pix(EP + "screen_lost.png");
const addTex = [];
for (let n = 0; n <= 15; n++) addTex.push(await pix(EP + `addsrv_${String(n).padStart(2, "0")}.png`));
const addPanel = planeTex(addTex[0], 2.6, 2.6 * 156 / 240);
const tabPanel = planeTex(await pix(EP + "tab_copy1.png"), 2.4, 2.4 * 62 / 128);
const shopPanel = planeTex(await pix(EP + "shop_scam.png"), 2.5, 2.5 * 76 / 190);
const lostPanel = planeTex(lostTex, 2.8, 2.8 * 132 / 240);
// full-screen overlay in front of the camera (connecting screen between servers)
const overlay = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: connectTex, transparent: true, toneMapped: false, depthTest: false, depthWrite: false }));
overlay.renderOrder = 20;
scene.add(overlay);
const PANELS = [srv, srvGlow, addPanel, tabPanel, shopPanel, lostPanel, overlay];

// billboards
const bills = [];
async function bill(path, hMeters) {
  const t = await pix(path);
  const m = planeTex(t, (t.image.width / t.image.height) * hMeters, hMeters);
  bills.push(m);
  return m;
}
const B_ = {
  hero: await bill(EP + "tag_hero.png", 0.3), admin: await bill(EP + "tag_admin.png", 0.3), pog: await bill(EP + "tag_pog_owner.png", 0.3),
  welcome: await bill(EP + "holo_welcome.png", 0.34), tps: await bill(EP + "fl_tps.png", 0.36), ping: await bill(EP + "fl_ping.png", 0.36),
  pJump: await bill(EP + "price_jump.png", 0.4), pCraft: await bill(EP + "price_craft.png", 0.36), pSit: await bill(EP + "price_sit.png", 0.36), pSky: await bill(EP + "price_sky.png", 0.7),
  hi: await bill(EP + "chat_hi.png", 0.32), buy: await bill(EP + "chat_buy.png", 0.3), code: await bill(EP + "cmd_code.png", 0.36), ban: await bill(EP + "ban_msg.png", 0.29), reward: await bill(EP + "chat_reward.png", 0.31),
};
const minus = [await bill(EP + "fl_minus10.png", 0.42), await bill(EP + "fl_minus10.png", 0.42)];
for (const m of [B_.pJump, B_.pSit, B_.pSky, B_.tps, B_.ping, B_.ban, ...minus]) { m.material.depthTest = false; m.renderOrder = 8; }
for (const m of [B_.hero, B_.pog]) { m.material.depthTest = false; m.renderOrder = 9; }
const zzz = [await bill(EP + "fl_zzz.png", 0.3), await bill(EP + "fl_zzz.png", 0.3), await bill(EP + "fl_zzz.png", 0.3)];
const crowdTags = [];
for (let i = 0; i < crowd.length; i++) crowdTags.push(await bill(EP + `tag_c${String(i).padStart(2, "0")}.png`, 0.28));
// chat lines over a few players in the crowd (crowd indices in BUB)
const BUB = [11, 15, 19];
const bub = [await bill(EP + "bub_1.png", 0.34), await bill(EP + "bub_2.png", 0.34), await bill(EP + "bub_3.png", 0.34)];
// the MoreCube crowd around EtoLikos (l = seconds since he landed); a gap toward the camera keeps him in view
function crowdScene(l, hx, hz, bubbles = true) {
  const r = mulberry32(5);
  crowd.forEach((P, i) => {
    const a = -1.35 + (i / (crowd.length - 1)) * (Math.PI * 2 - 1.6), rad = 2.6 + r() * 4.6;
    const x = 2.6 + Math.cos(a) * rad, z = 3.4 + Math.sin(a) * rad;
    const kind = i % 3, w = Math.sin(l * 9 + i);
    const j = kind === 2 ? Math.max(0, Math.sin(l * 8 + i * 1.7)) * 0.45 : Math.max(0, Math.sin(l * 6 + i * 2.3)) * 0.12;
    const arms = kind === 0 ? { aRx: -2.6 + 0.3 * w, aLx: -2.5 - 0.3 * w, aRz: 0.25, aLz: -0.25 }
      : kind === 1 ? { aRx: -2.7, aRz: 0.3 + 0.45 * w, aLx: 0, aLz: -0.1 } : { aRx: -0.4, aLx: -0.4, aRz: 0.15, aLz: -0.15 };
    pose(P, x, SPAWN_Y + j, z, Math.atan2(-(hx - x), hz - z) / D2R, { ...arms, hP: -0.2 });
    showBill(crowdTags[i], x, SPAWN_Y + 2.15 + j, z, 1);
    const b = BUB.indexOf(i);
    if (bubbles && b >= 0) showBill(bub[b], x, SPAWN_Y + 2.62 + 0.22 * (b % 2) + j, z, 1, cl((l - 0.5 - b * 0.35) / 0.15));
  });
}

// the ban hammer (voxel, from ep02): red head with «BAN», pivot at the grip
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
const HAM_HEAD = 18.5 * HS;

// the copy island as separate blocks, for crumbling (copy/blocks.json)
const CB = await (await fetch(BASE + "copy/blocks.json", { cache: "no-cache" })).json();
const blockTex = {};
for (const k of ["cobble", "mossy", "dirt", "planks", "gravel"]) blockTex[k] = await pix(EP + "tex/" + k + ".png");
const crumble = [];
{
  const types = ["cobble", "mossy", "dirt", "planks", "gravel"];
  const byType = types.map(() => []);
  for (const b of CB.blocks) byType[b[3]].push(b);
  types.forEach((k, ti) => {
    const list = byType[ti];
    if (!list.length) return;
    const mat = new THREE.MeshStandardMaterial({ map: blockTex[k], roughness: 0.9, color: k === "dirt" ? new THREE.Color(0.85, 0.95, 0.75) : 0xffffff });
    const inst = new THREE.InstancedMesh(box, mat, list.length);
    inst.castShadow = true;
    inst.frustumCulled = false;
    inst.userData.list = list;
    scene.add(inst);
    crumble.push(inst);
  });
}
const crumbleM = new THREE.Matrix4(), crumbleQ = new THREE.Quaternion(), crumbleE = new THREE.Euler(), crumbleS = new THREE.Vector3(1, 1, 1);
function crumbleAt(k, cx, cz) { // k = seconds since the crash
  const r = mulberry32(3);
  for (const inst of crumble) {
    inst.visible = true;
    inst.userData.list.forEach((b, i) => {
      const dx = b[0] + 0.5 - cx, dz = b[2] + 0.5 - cz;
      const d = Math.hypot(dx, dz) + 0.01;
      const delay = d / 16 + r() * 0.12;
      const t = Math.max(0, k - delay);
      const out = 1.5 + r() * 3.5, up = 1.5 + r() * 4;
      const p = new THREE.Vector3(b[0] + 0.5 + (dx / d) * out * t, b[1] + 0.5 + up * t - 6.5 * t * t, b[2] + 0.5 + (dz / d) * out * t);
      crumbleE.set(t * (r() * 6 - 3), t * (r() * 6 - 3), t * (r() * 6 - 3));
      crumbleQ.setFromEuler(crumbleE);
      crumbleS.setScalar(t > 0 ? Math.max(0.05, 1 - t * 0.25) : 1);
      crumbleM.compose(p, crumbleQ, crumbleS);
      inst.setMatrixAt(i, crumbleM);
    });
    inst.instanceMatrix.needsUpdate = true;
  }
}

// tumbleweed: a dead bush cross rolling across the empty copy
const tumble = new THREE.Group();
{
  const t = await pix(EP + "tex/dead_bush.png");
  for (let i = 0; i < 6; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), new THREE.MeshStandardMaterial({ map: t, alphaTest: 0.4, side: THREE.DoubleSide, color: 0xffe6c0, emissive: 0x3a2a16, emissiveMap: t }));
    if (i < 3) m.rotation.y = (i * Math.PI) / 3;
    else m.rotation.set(Math.PI / 4, ((i - 3) * 2 * Math.PI) / 3 + 0.5, 0, "YXZ");
    m.castShadow = true;
    tumble.add(m);
  }
  scene.add(tumble);
}
// the reward case
const chestTex = await pix(EP + "tex/chest_item.png");
const caseSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: chestTex.clone(), transparent: true, alphaTest: 0.3 }));
caseSprite.material.map.repeat.set(14 / 64, 14 / 64);
caseSprite.material.map.offset.set(14 / 64, 1 - (19 + 14) / 64);
caseSprite.material.map.needsUpdate = true;
scene.add(caseSprite);

// rain for the «рилик» shot
const NR = 2200;
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
function rainUpdate(t, c) {
  rain.visible = true;
  for (let i = 0; i < NR; i++) {
    const [a, b, cc, v] = RS[i];
    const x = c.x + (a - 0.5) * 32, z = c.z + (b - 0.5) * 32;
    const y = c.y - 6 + ((((cc * 16 - t * 15 * v) % 16) + 16) % 16);
    rainPos[i * 6] = x; rainPos[i * 6 + 1] = y; rainPos[i * 6 + 2] = z;
    rainPos[i * 6 + 3] = x + 0.05; rainPos[i * 6 + 4] = y + 0.5 * v; rainPos[i * 6 + 5] = z + 0.03;
  }
  rainGeo.attributes.position.needsUpdate = true;
}

// glow particles
const T = { star: await pix(EP1 + "tex/particle_star.png") };
const NP = 2400;
const pGeo = new THREE.BufferGeometry();
const pPos = new Float32Array(NP * 3), pCol = new Float32Array(NP * 3), pSize = new Float32Array(NP);
pGeo.setAttribute("position", new THREE.BufferAttribute(pPos, 3));
pGeo.setAttribute("color", new THREE.BufferAttribute(pCol, 3));
pGeo.setAttribute("aSize", new THREE.BufferAttribute(pSize, 1));
const pMat = new THREE.ShaderMaterial({
  uniforms: { uTex: { value: T.star }, uScale: { value: H / 2 } },
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
const hud = await makeHud(W, H, { ban: EP2 + "title_ban.png" }, { variant: "ep03" });
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
let FX = {};
const SPAWN_Y = 85;
const CC = CB.center; // copy island centre [x, top, z]
const CY = CC[1];
const LOBBY = [5104, 70, 2];
const GY = 64;
const SEAT = [3064, -16], SEAT_TOP = 68, VSC = 2.5;

function hideAll() {
  for (const P of CHARS) { P.set({ visible: false }); P.root.scale.setScalar(1); }
  setFat(villain, 0);
  for (const m of PANELS) { m.visible = false; m.scale.setScalar(1); }
  for (const m of bills) { m.visible = false; m.scale.setScalar(1); }
  for (const c of crumble) c.visible = false;
  tumble.visible = false;
  hammer.visible = false;
  caseSprite.visible = false;
  rain.visible = false;
  FX = {};
  np = 0;
}
function pose(P, x, y, z, yawMC, extra = {}) {
  P.set({ x, y, z, yaw: -yawMC * D2R, ...extra });
  P.light(...lightAt(x, y + 1.4, z));
}
function showBill(m, x, y, z, s = 1, k = 1) {
  if (k <= 0.001) return;
  m.visible = true;
  m.position.set(x, y, z);
  m.scale.setScalar(Math.max(0.01, s * E.outBack(Math.min(1, k))));
}
function panelAt(m, x, y, z, s = 1, k = 1, op = 1) {
  if (k <= 0.001) return;
  m.visible = true;
  m.position.set(x, y, z);
  m.scale.set(s, Math.max(0.02, s * E.outBack(Math.min(1, k))), s);
  m.material.opacity = op;
  m.userData.face = true;
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
function seatOwner(fat, extra = {}) {
  const y = SEAT_TOP - 10 * PX * VSC + 0.02;
  pose(villain, SEAT[0], y, SEAT[1] - 0.25, 0, { lR: -1.45, lL: -1.45, lRz: 0.1, lLz: -0.1, ...extra });
  villain.root.scale.setScalar(VSC);
  setFat(villain, fat);
  villain.light(0.85, 0.55);
}
function swingHammer(th, s = 1.45) {
  villain.root.updateMatrixWorld(true);
  const sh = new THREE.Vector3();
  villain.armR.getWorldPosition(sh);
  const dir = new THREE.Vector3(0, Math.cos(th), Math.sin(th));
  hammer.visible = true;
  hammer.scale.setScalar(s);
  hammer.position.copy(sh).addScaledVector(dir, 1.35);
  hammer.rotation.set(th, 0, 0);
}
// the lobby: hero next to the floating server list; sel = highlighted entry (0 = none)
function lobby(lt, sel, point) {
  const [lx, ly, lz] = LOBBY;
  pose(hero, lx + 0.05, ly, lz + 1.0, 192, { aRx: -2.65 * point, aRz: 0.12 * point, hY: -0.25, hP: -0.5 });
  showBill(B_.hero, lx + 0.05, ly + 2.15, lz + 1.0, 1);
  srv.material.map = srvTex[sel];
  panelAt(srv, lx - 0.41, ly + 4.68, lz - 3.61, 1.208, cl(lt / 0.3));
  panelAt(srvGlow, lx - 0.41, ly + 4.68, lz - 3.67, 1.208, cl(lt / 0.3), 0.45);
  sparkle(lx - 0.41, ly + 4.68, lz - 3.61, 30, 3.0, 7 + Math.floor(lt * 6), [1.2, 0.9, 1.8], 0.09);
}
function inView(cam, tgt, fwd, up = 0, right = 0) {
  const c = v3(cam), f = v3(tgt).sub(c).normalize();
  const r = new THREE.Vector3().crossVectors(f, new THREE.Vector3(0, 1, 0)).normalize();
  const u = new THREE.Vector3().crossVectors(r, f);
  return c.addScaledVector(f, fwd).addScaledVector(u, up).addScaledVector(r, right);
}
// a connecting screen covering the view, fading with a (1 = opaque)
function connectOverlay(a, tex = connectTex) {
  if (a <= 0.001) return;
  overlay.visible = true;
  overlay.material.map = tex;
  overlay.material.opacity = a;
  overlay.userData.cover = true;
}
const COPY_LABEL = { K2: "КОПИЯ №1 · «ОНЛАЙН 1000+»", K3: "КОПИЯ №2 · «БЕЗ ЛАГОВ!!!»", K4: "КОПИЯ №3 · «ДОНАТ ОТ 9 999 ₽»", K5: "КОПИЯ №4 · «ДОНАТ x10»", K6: "РИЛИК · «БАН ПРОСТО ТАК»" };

/* ------------------------------------------------------------------ shots */
const SHOT_T0 = {};
const SHOTS = [
  { id: "K1", label: "Хук: меню «Сетевая игра» в воздухе, штамп «НЕ ЗАХОДИ!», EtoLikos выбирает копию №1",
    run(lt, dur, t) {
      const click = MK.click1 - SHOT_T0.K1;
      lobby(lt, lt >= click ? 1 : 0, sm((lt - 0.3) / 0.3));
      const zoom = E.in3(cl((lt - click - 0.05) / (dur - click - 0.05)));
      connectOverlay(cl((lt - (dur - 0.25)) / 0.2));
      const [lx, ly, lz] = LOBBY;
      const cam = L3(L3([lx + 2.2, ly + 3.0, lz + 6.4], [lx + 2.0, ly + 3.05, lz + 5.9], E.out3(cl(lt / dur))), [lx - 0.41, ly + 5.91, lz - 1.41], zoom * 0.9);
      return { mood: "lobby", world: "copy", cam, tgt: L3([lx, ly + 3.5, lz - 2.0], [lx - 0.41, ly + 5.91, lz - 3.61], zoom), fov: 56, sun: SUN_COPY, shadow: { c: [lx, ly, lz], r: 12 }, focus: 0,
        hud: { warn: fadeA(lt, 0.2, click - 0.1, 0.25, 0.25) } };
    } },
  { id: "K2", label: "Копия №1: пустой спавн, перекати-поле, в таблице двое — EtoLikos и спящий Админ",
    run(lt, dur) {
      connectOverlay(1 - cl(lt / 0.3));
      const hx = CC[0] - 2.8, hz = CC[2] + 4.4;
      const look = Math.sin(lt * 2.2) * 0.6;
      const shrug = sm((lt - 1.8) / 0.3);
      pose(hero, hx, CY, hz, 160, { hY: look, hP: -0.05, aRz: 0.1 + 0.7 * shrug, aLz: -0.1 - 0.7 * shrug, aRx: -0.3 * shrug, aLx: -0.3 * shrug });
      showBill(B_.hero, hx, CY + 2.15, hz, 1);
      const tabT = MK.tab - SHOT_T0.K2;   // «привет?» on arrival — nobody answers — then the tab list shows only two players
      showBill(B_.hi, hx + 1.0, CY + 2.75, hz - 0.4, 0.9, cl((lt - 0.25) / 0.2) * (1 - cl((lt - tabT) / 0.15)));
      const ax = CC[0] + 0.4, az = CC[2] + 3.6;
      pose(admin, ax, CY + 0.1, az, 90, { pitch: -1.5, aRz: 0.2, aLz: -0.2 });
      showBill(B_.admin, ax + 1.5, CY + 0.75, az, 1);
      zzz.forEach((m, i) => {
        const ph = (lt * 0.7 + i / 3) % 1;
        m.material.opacity = Math.sin(ph * Math.PI);
        showBill(m, ax + 1.6 + ph * 0.4, CY + 1.0 + ph * 1.1, az + 0.1, 0.7 + ph * 0.6);
      });
      const cam2 = L3([CC[0] - 7.4, CY + 1.7, CC[2] + 10.6], [CC[0] - 6.9, CY + 1.75, CC[2] + 9.8], E.out3(cl(lt / dur))), tgt2 = [CC[0] + 0.2, CY + 1.0, CC[2] + 3.0];
      const pt = inView(cam2, tgt2, 4.0, 0.76, 0.41);
      panelAt(tabPanel, pt.x, pt.y, pt.z, 0.51, cl((lt - tabT) / 0.25), 1 - cl((lt - dur + 0.25) / 0.2));
      const k = lt / dur;
      tumble.visible = true;
      tumble.position.set(CC[0] - 6 + 12 * k, CY + 0.45 + Math.abs(Math.sin(k * 11)) * 0.3, CC[2] + 5.6);
      tumble.rotation.set(0, 0, -k * 13);
      return { mood: "c1", world: "copy", cam: cam2, tgt: tgt2, fov: 52, sun: SUN_COPY,
        shadow: { c: [CC[0], CY, CC[2]], r: 16 }, focus: 0, label: "K2" };
    } },
  { id: "K3", label: "Копия №2: лаги — EtoLikos идёт рывками, его откидывает назад, TPS 2 · ПИНГ 999",
    run(lt, dur, t) {
      connectOverlay(1 - cl(lt / 0.25));
      const rub = MK.rubber - SHOT_T0.K3;
      const tq = Math.floor(lt * 3.2) / 3.2;
      const back = lt >= rub && lt < rub + 0.12;
      const prog = lt < rub ? tq / rub : (tq - rub) / (dur - rub) * 0.6;
      const p0 = [CC[0] - 6.0, CY, CC[2] + 7.0], p1 = [CC[0] + 2.5, CY, CC[2] + 1.5];
      const p = L3(p0, p1, Math.min(1, prog * 0.85));
      pose(hero, p[0], p[1], p[2], -55, { ...walkPose(tq * 1.7, 1), hP: -0.05 });
      showBill(B_.hero, p[0], CY + 2.15, p[2], 1);
      const cam3 = [CC[0] - 9.4, CY + 1.9, CC[2] + 11.0], tgt3 = [CC[0] - 1.5, CY + 1.0, CC[2] + 3.5];
      const jt = Math.floor(lt * 3.2), jx = Math.sin(jt * 12.99) * 0.025, jy = Math.cos(jt * 7.31) * 0.02;
      const pT = inView(cam3, tgt3, 4.0, 0.89 + jy, -0.49 + jx), pP = inView(cam3, tgt3, 4.0, 0.73 - jy, 0.47 - jx);
      showBill(B_.tps, pT.x, pT.y, pT.z, 0.52, cl((lt - 0.3) / 0.2));
      showBill(B_.ping, pP.x, pP.y, pP.z, 0.52, cl((lt - 0.55) / 0.2));
      FX.glitch = (Math.floor(lt * 3.2) !== Math.floor((lt - 1 / 60) * 3.2) ? 0.06 : 0.015) + (back ? 0.08 : 0);
      if (back) FX.flash = 0.04;
      return { mood: "c2", world: "copy", cam: [CC[0] - 9.4, CY + 1.9, CC[2] + 11.0], tgt: [CC[0] - 1.5, CY + 1.0, CC[2] + 3.5], fov: 52, sun: SUN_COPY,
        shadow: { c: [CC[0], CY, CC[2]], r: 16 }, focus: 0, label: "K3" };
    } },
  { id: "K4", label: "Копия №3: ценники на всём, EtoLikos прыгает — «ПРЫЖОК — 10 ₽», «−10 ₽»",
    run(lt, dur, t) {
      connectOverlay(1 - cl(lt / 0.25));
      const hx = CC[0] - 1.6, hz = CC[2] + 4.0;
      const jumps = [MK.jump1 - SHOT_T0.K4, MK.jump2 - SHOT_T0.K4];
      let jy = 0, jp = 0;
      jumps.forEach((j, i) => {
        const u = (lt - j) / 0.5;
        if (u > 0 && u < 1) { jy = Math.sin(u * Math.PI) * 1.05; jp = 1; }
        const m = minus[i];
        const v = (lt - j - 0.3) / 0.9;
        if (v > 0 && v < 1) {
          m.material.opacity = 1 - v;
          showBill(m, hx - 1.4, CY + 1.5 + v * 0.9, hz + 0.3, 1.1);
          if (v < 0.3) sparkle(hx, CY + 2.2, hz, 30, 0.6, 61 + i * 7 + Math.floor(v * 30), [2.0, 1.6, 0.4], 0.07);
        }
        if (lt > j - 0.05 && lt < j + 0.6) showBill(B_.pJump, hx, CY + 2.75 + jy, hz + 0.05, 0.8, cl((lt - j + 0.05) / 0.15));
      });
      pose(hero, hx, CY + jy, hz, 175, { aRx: -0.4 * jp, aLx: -0.4 * jp, aRz: 0.2 + 0.4 * jp, aLz: -0.2 - 0.4 * jp, lR: -0.4 * jp, lL: 0.3 * jp, hP: -0.1 });
      showBill(B_.hero, hx, CY + 2.15 + jy, hz, 1);
      showBill(B_.pSit, CC[0] + 0.93, CY + 1.34, CC[2] + 2.34, 0.75, cl((lt - 0.2) / 0.2));
      showBill(B_.pSky, CC[0] - 0.64, CY + 4.64, CC[2] - 1.39, 0.78, cl((lt - 0.4) / 0.2));
      return { mood: "c3", world: "copy", cam: L3([CC[0] - 5.6, CY + 1.45, CC[2] + 10.4], [CC[0] - 5.2, CY + 1.5, CC[2] + 9.6], E.out3(cl(lt / dur))), tgt: [CC[0] - 0.4, CY + 2.0, CC[2] + 2.0], fov: 54, sun: SUN_COPY,
        shadow: { c: [CC[0], CY, CC[2]], r: 16 }, focus: 0, label: "K4" };
    } },
  { id: "K5", label: "Копия №4: «ГИДРА x10 — 499 ₽», купил — и мир рассыпается, «Соединение потеряно»",
    run(lt, dur, t) {
      connectOverlay(1 - cl(lt / 0.25));
      const buy = MK.buy - SHOT_T0.K5, crash = MK.crash - SHOT_T0.K5;
      const hx = CC[0] - 1.2, hz = CC[2] + 3.8;
      const k = lt - crash;
      if (lt < crash) {
        const press = lt > buy - 0.15 && lt < buy + 0.2 ? 1 : 0;
        pose(hero, hx, CY, hz, -160, { aRx: -1.4 - 0.25 * press, aRz: 0.1, hP: -0.05, hY: 0.3 });
        showBill(B_.hero, hx, CY + 2.15, hz, 1);
        const ps = inView([CC[0] - 6.6, CY + 1.8, CC[2] + 10.0], [CC[0] - 2.0, CY + 1.6, CC[2] + 2.8], 4.4, 0.75, -0.26);
        panelAt(shopPanel, ps.x, ps.y, ps.z, 0.65, cl(lt / 0.25), 1 - cl((lt - buy - 0.1) / 0.12));
        if (lt >= buy) {
          showBill(B_.buy, ps.x, ps.y, ps.z, 1, cl((lt - buy - 0.12) / 0.15));
          sparkle(ps.x, ps.y - 0.3, ps.z, 30, 0.7, 77 + Math.floor(lt * 20), [1.8, 1.6, 0.4], 0.08);
        }
      } else {
        crumbleAt(k, hx, hz);
        const fall = 0.5 * 9.8 * k * k;
        pose(hero, hx, CY - fall, hz, -160 + k * 90, { aRx: -2.8, aLx: -2.8, aRz: 0.4, aLz: -0.4, lR: 0.4, lL: -0.4, hP: -0.6 });
        if (k < 0.08) FX.flash = 0.35;
        FX.flashCol = [3.2, 0.5, 0.4];
        FX.shake = k;
      }
      const sh = lt >= crash ? shake(lt, crash, 0.25, 3) : [0, 0, 0];
      const fallT = lt >= crash ? Math.min(3.5, 0.5 * 9.8 * k * k) * 0.6 : 0;
      const cam5 = add3([CC[0] - 6.6, CY + 1.8, CC[2] + 10.0], sh), tgt5 = [CC[0] - 2.0, CY + 1.6 - fallT, CC[2] + 2.8];
      if (lt >= crash) {
        const p = inView(cam5, tgt5, 4.2, 0.27, 0);
        panelAt(lostPanel, p.x, p.y, p.z, 0.73, cl((k - 0.55) / 0.25));
      }
      return { mood: lt < crash ? "c4" : "void", world: lt < crash ? "copy" : "none", cam: cam5, tgt: tgt5, fov: 54,
        sun: SUN_COPY, shadow: { c: [CC[0], CY, CC[2]], r: 16 }, focus: 0, label: "K5" };
    } },
  { id: "K6", label: "Рилик: владелец бьёт банхаммером («бан просто так»)",
    run(lt, dur, t) {
      const hit = MK.hit - SHOT_T0.K6;
      let th;
      if (lt < hit) th = 0.9 + (2.17 - 0.9) * E.in3(cl(lt / hit));
      else th = 2.17 - 0.08 * Math.sin((lt - hit) * 14) * Math.exp(-(lt - hit) * 6);
      seatOwner(0.35, { aRx: th - Math.PI, aRz: 0.08, aLx: -0.35, aLz: -0.2, hP: lt > hit + 0.4 ? -0.3 : 0.25 });
      swingHammer(th);
      const hx = 3063.15, hz = -9.85;
      if (lt < hit) pose(hero, hx, GY, hz, 180, { hP: -0.55, aRx: -2.5 * sm((lt - 0.1) / 0.15), aLx: -2.5 * sm((lt - 0.1) / 0.15) });
      else {
        pose(hero, hx, GY, hz, 180, { aRz: 1.4, aLz: -1.4 });
        hero.root.scale.set(1.55, 0.22, 1.55);
        if (lt < hit + 0.05) FX.impact = 1;
        else FX.lightning = Math.max(0, 1 - (lt - hit - 0.05) * 4) * 0.8;
        dust(hx, GY + 0.5, hz, (lt - hit) * 1.3, 11, 70, [0.55, 0.58, 0.64], 1.6);
      }
      const k = E.out3(cl(lt / dur));
      const cam6 = add3(L3([3066.4, 66.8, -0.8], [3066.1, 66.9, -1.6], k), shake(lt, hit, 0.28)), tgt6 = [3063.6, 68.8 + 0.3 * k, -12.5];
      if (lt >= hit + 0.2) {
        const pb = inView(cam6, tgt6, 4.0, -0.15, 0);
        showBill(B_.ban, pb.x, pb.y, pb.z, 1, cl((lt - hit - 0.2) / 0.15));
      }
      return { mood: "rw", world: "rw", cam: cam6, tgt: tgt6, fov: 55, sun: SUN_RW,
        shadow: { c: [3064, GY, -10], r: 30 }, focus: 0, label: "K6" };
    } },
  { id: "K7", label: "MoreCube: в меню светится MoreCube, клик — тёплый спавн, толпа игроков, салют, _pogostik_ машет",
    run(lt, dur, t) {
      const land = MK.k7land - SHOT_T0.K7;
      if (lt < land) {
        lobby(lt + 1, 5, 1);
        const zoom = E.in3(cl((lt - 0.3) / (land - 0.3)));
        connectOverlay(cl((lt - (land - 0.2)) / 0.18));
        const [lx, ly, lz] = LOBBY;
        return { mood: "lobby", world: "copy", cam: L3([lx + 2.0, ly + 3.05, lz + 5.9], [lx - 0.41, ly + 3.52, lz - 1.41], zoom * 0.9), tgt: L3([lx, ly + 3.5, lz - 2.0], [lx - 0.41, ly + 3.52, lz - 3.61], zoom),
          fov: 56, sun: SUN_COPY, shadow: { c: [lx, ly, lz], r: 12 }, focus: 0, label: "K7" };
      }
      const l = lt - land;
      connectOverlay(1 - cl(l / 0.25));
      const crouch = 1 - sm((l - 0.2) / 0.4);
      const hx = 2.4, hz = 2.0;
      pose(hero, hx, SPAWN_Y, hz, -40, { crouch, aRx: -2.6 * sm((l - 0.6) / 0.3), aLx: -2.6 * sm((l - 0.6) / 0.3), aRz: 0.3, aLz: -0.3, hP: -0.2 });
      showBill(B_.hero, hx, SPAWN_Y + 2.15 - 0.3 * crouch, hz, 1);
      dust(hx, SPAWN_Y + 0.45, hz, l * 1.2, 21, 50, [0.95, 0.85, 0.62], 1.1);
      const wave = Math.sin(l * 10) * 0.4;
      pose(pog, 4.8, SPAWN_Y, 3.8, 150, { aRx: -2.8, aRz: 0.3 + wave, hP: -0.05 });
      showBill(B_.pog, 4.8, SPAWN_Y + 2.15, 3.8, 1);
      crowdScene(l, hx, hz);
      for (let j = 0; j < 4; j++) firework(-1 + j * 3.2, SPAWN_Y + 9 + (j % 2) * 2, 9 - j, l - 0.3 - j * 0.3, 140 + j, [[2.2, 1.4, 0.4], [0.6, 1.8, 2.2], [2.2, 0.6, 1.6], [0.8, 2.2, 0.8]][j]);
      if (l < 0.06) FX.flash = 0.2;
      const k = E.out3(cl(l / (dur - land)));
      return { mood: "mc", world: "spawn", cam: L3([-2.4, 88.1, -4.4], [-1.9, 87.95, -3.7], k), tgt: [3.5, 86.25, 2.3], fov: 60, sun: SUN_K7, shadow: { c: [3, 85, 3], r: 25 }, focus: 0, label: "K7" };
    } },
  { id: "K8", label: "Как зайти: «Добавить сервер» печатает pog.morecube.ru, /code PODAROK, кейс с донатом",
    run(lt, dur, t) {
      const ty = MK.type0 - SHOT_T0.K8, code = MK.code - SHOT_T0.K8, rew = MK.reward - SHOT_T0.K8, how = MK.how - SHOT_T0.K8;
      const hx = 2.4, hz = 2.0;
      const typing = lt >= ty && lt < ty + 1.6;
      pose(hero, hx, SPAWN_Y, hz, -40, { aRx: typing || (lt > code - 0.1 && lt < code + 0.5) ? -1.0 + 0.12 * Math.sin(lt * 40) : -0.25, aLx: lt > rew ? -1.3 : 0, hP: -0.05 });
      showBill(B_.hero, hx, SPAWN_Y + 2.15, hz, 1);
      crowdScene(t - MK.k7land, hx, hz, false);
      const n = Math.max(0, Math.min(15, Math.floor((lt - ty) / 0.085)));
      addPanel.material.map = addTex[n];
      const cam8 = L3([-0.6, 86.7, -3.8], [-0.2, 86.75, -3.2], E.out3(cl(lt / dur))), tgt8 = [3.0, 86.9, 3.2];
      const pd = inView(cam8, tgt8, 5.0, 0.45, -0.05);
      panelAt(addPanel, pd.x, pd.y, pd.z, 0.95, cl((lt - ty + 0.15) / 0.2) * (1 - cl((lt - code + 0.3) / 0.2)));
      B_.code.material.opacity = 1 - cl((lt - rew) / 0.15);
      B_.reward.material.opacity = 1 - cl((lt - how) / 0.25);
      if (lt >= code) showBill(B_.code, hx, SPAWN_Y + 2.57, hz, 1, cl((lt - code) / 0.15));
      if (lt >= rew) {
        const pr = inView(cam8, tgt8, 4.0, 0.64, 0);
        showBill(B_.reward, pr.x, pr.y, pr.z, 1, cl((lt - rew - 0.05) / 0.15));
        caseSprite.visible = true;
        caseSprite.position.set(hx - 1.05, SPAWN_Y + 1.25 + 0.08 * Math.sin(lt * 6), hz - 0.1);
        caseSprite.scale.setScalar(0.8 * E.outBack(cl((lt - rew) / 0.25)));
        sparkle(hx - 1.05, SPAWN_Y + 1.25, hz - 0.1, 60, 0.7, 91 + Math.floor(lt * 12), [2.2, 1.8, 0.5], 0.08);
        for (let j = 0; j < 3; j++) firework(hx - 3 + j * 3, SPAWN_Y + 8 + j, hz + 5, lt - rew - 0.1 - j * 0.3, 170 + j, [[2.2, 1.4, 0.4], [0.6, 1.8, 2.2], [0.8, 2.2, 0.8]][j]);
      }
      const hk = cl((lt - how) / 0.3);
      const step = Math.max(0, (lt - how) / 0.45);
      const k = E.out3(cl(lt / dur));
      return { mood: "mc", world: "spawn", cam: L3([-0.6, 86.7, -3.8], [-0.2, 86.75, -3.2], k), tgt: [3.0, 86.9, 3.2], fov: 54, sun: SUN_K7, shadow: { c: [3, 85, 3], r: 25 }, focus: 0,
        hud: { howTo: hk, howStep: step, noCaption: hk > 0.05 } };
    } },
];
for (const S of SHOTS) {
  const T_ = TLD.shots.find((x) => x.id === S.id);
  S.t0 = T_.t0;
  S.t1 = T_.t1;
  S.key = (T_.t0 + T_.t1) / 2;
  SHOT_T0[S.id] = T_.t0;
}

/* ------------------------------------------------------------------ moods and view */
const MOODS = {
  mc: { zen: "#3e6fbf", hor: "#f3c79a", gnd: "#6b5a52", sunCol: [1, 0.72, 0.42], glow: 1, sunVis: 1, fog: [0.75, 0.62, 0.55], fogSun: [1, 0.7, 0.42], fogDen: 0.0018, hemi: [0xc4d6f5, 0x7a6252, 1.45], sun: [0xffcf98, 3.3],
    g: { expo: 1.06, sat: 1.14, con: 1.07, vig: 0.38, tint: [1, 0.98, 0.95], sh: [0.92, 0.97, 1.06], hi: [1.06, 1, 0.92], warm: 0 }, clouds: true },
  rw: { zen: "#1d2430", hor: "#454c5a", gnd: "#26262b", sunCol: [0.45, 0.5, 0.6], glow: 0.05, sunVis: 0, fog: [0.3, 0.34, 0.42], fogSun: [0.34, 0.38, 0.46], fogDen: 0.011, hemi: [0x7d8aa0, 0x2b2b31, 1.55], sun: [0x9fb2d0, 1.3],
    g: { expo: 1.15, sat: 0.5, con: 1.12, vig: 0.55, tint: [0.9, 0.95, 1.07], sh: [0.84, 0.93, 1.14], hi: [1, 1, 1.04], warm: 1 }, rain: true, blockK: 1.9 },
  lobby: { zen: "#120a24", hor: "#3a1d54", gnd: "#0a0612", sunCol: [0.6, 0.4, 0.9], glow: 0, sunVis: 0, fog: [0.14, 0.07, 0.22], fogSun: [0.2, 0.1, 0.3], fogDen: 0.003, hemi: [0x9a88cc, 0x241a34, 1.4], sun: [0xc8b8ff, 1.3],
    g: { expo: 1.12, sat: 1.15, con: 1.1, vig: 0.5, tint: [1, 0.97, 1.05], sh: [0.9, 0.9, 1.15], hi: [1.05, 1, 1.05], warm: 0 } },
  c1: { zen: "#4b5360", hor: "#8a8d92", gnd: "#3a3a3d", sunCol: [0.7, 0.7, 0.72], glow: 0.1, sunVis: 0, fog: [0.5, 0.52, 0.56], fogSun: [0.55, 0.56, 0.6], fogDen: 0.006, hemi: [0xa9b0bc, 0x4a4a4a, 1.5], sun: [0xd7dae0, 1.5],
    g: { expo: 1.05, sat: 0.42, con: 1.08, vig: 0.5, tint: [0.96, 0.98, 1.02], sh: [0.92, 0.95, 1.04], hi: [1, 1, 1], warm: 0 } },
  c2: { zen: "#3b4a2a", hor: "#a2b268", gnd: "#2e3320", sunCol: [0.8, 0.9, 0.5], glow: 0.3, sunVis: 1, fog: [0.55, 0.62, 0.38], fogSun: [0.7, 0.75, 0.4], fogDen: 0.006, hemi: [0xb5c890, 0x4a5030, 1.4], sun: [0xe6f0a0, 2.0],
    g: { expo: 1.03, sat: 0.85, con: 1.08, vig: 0.5, tint: [0.95, 1.05, 0.85], sh: [0.9, 1.02, 0.86], hi: [1.02, 1.04, 0.9], warm: 0 } },
  c3: { zen: "#2a0e44", hor: "#e07a3a", gnd: "#2a1630", sunCol: [1, 0.6, 0.3], glow: 0.6, sunVis: 1, fog: [0.6, 0.3, 0.45], fogSun: [1, 0.6, 0.35], fogDen: 0.005, hemi: [0xc090ff, 0x4a2a40, 1.5], sun: [0xffb070, 2.6],
    g: { expo: 1.05, sat: 1.3, con: 1.12, vig: 0.45, tint: [1.03, 0.97, 1.03], sh: [0.95, 0.88, 1.1], hi: [1.08, 0.98, 0.9], warm: 0 } },
  c4: { zen: "#3a0508", hor: "#b03018", gnd: "#200406", sunCol: [1, 0.35, 0.2], glow: 0.4, sunVis: 1, fog: [0.45, 0.08, 0.06], fogSun: [0.8, 0.25, 0.12], fogDen: 0.006, hemi: [0xff8a80, 0x3a0a0a, 1.3], sun: [0xff9a7a, 2.2],
    g: { expo: 1.04, sat: 1.1, con: 1.1, vig: 0.55, tint: [1.06, 0.92, 0.9], sh: [1.0, 0.86, 0.86], hi: [1.08, 0.96, 0.9], warm: 0 } },
  void: { zen: "#160204", hor: "#3a0606", gnd: "#050001", sunCol: [1, 0.3, 0.2], glow: 0, sunVis: 0, fog: [0.08, 0.01, 0.01], fogSun: [0.15, 0.02, 0.02], fogDen: 0.003, hemi: [0xff7060, 0x200404, 1.2], sun: [0xff8a70, 1.8],
    g: { expo: 1.05, sat: 1.1, con: 1.15, vig: 0.65, tint: [1.08, 0.9, 0.9], sh: [1.0, 0.85, 0.85], hi: [1.08, 0.95, 0.9], warm: 0 } },
};
const _c = new THREE.Color();
function applyView(V, t) {
  const M = MOODS[V.mood];
  spawn.group.visible = ents.group.visible = V.world === "spawn";
  rw.group.visible = V.world === "rw";
  copy.group.visible = V.world === "copy";
  camera.fov = V.fov || 50;
  camera.aspect = W / H;
  camera.updateProjectionMatrix();
  camera.position.copy(v3(V.cam));
  camera.lookAt(v3(V.tgt));
  camera.updateMatrixWorld();
  const sd = V.sun.clone();
  WU.uSunDir.value.copy(sd);
  const lf = FX.lightning || 0;
  WU.uFogCol.value.setRGB(...M.fog);
  WU.uFogSun.value.setRGB(...M.fogSun);
  WU.uFogDen.value = M.fogDen;
  WU.uBlockK.value = M.blockK ?? 1.25;
  hemi.color.setHex(M.hemi[0]);
  hemi.groundColor.setHex(M.hemi[1]);
  hemi.intensity = M.hemi[2] + 1.4 * lf;
  sun.color.setHex(M.sun[0]);
  sun.intensity = M.sun[1] + 2.0 * lf;
  sky.U.uZen.value.set(M.zen).lerp(_c.setRGB(0.56, 0.64, 0.78), lf * 0.7);
  sky.U.uHor.value.set(M.hor).lerp(_c.setRGB(0.78, 0.83, 0.92), lf * 0.7);
  sky.U.uGround.value.set(M.gnd);
  sky.U.uSunCol.value.setRGB(...M.sunCol);
  sky.U.uGlow.value = M.glow;
  clouds.mesh.visible = !!M.clouds;
  const c = v3(V.shadow.c), r = V.shadow.r;
  sun.target.position.copy(c);
  sun.position.copy(c).addScaledVector(sd, 300);
  const sc = sun.shadow.camera;
  sc.left = -r; sc.right = r; sc.top = r; sc.bottom = -r; sc.near = 50; sc.far = 700;
  sc.updateProjectionMatrix();
  sun.target.updateMatrixWorld();
  sun.updateMatrixWorld();
  sky.place(camera, M.sunVis, 1);
  if (V.world === "spawn") ents.update(camera, 1);
  WU.uTime.value = t;
  if (M.rain) rainUpdate(t, camera.position);
  for (const m of bills) if (m.visible) m.quaternion.copy(camera.quaternion);
  for (const m of PANELS) if (m.visible && m.userData.face) m.quaternion.copy(camera.quaternion);
  if (overlay.visible) {
    const d = 0.5;
    const hh = 2 * Math.tan((camera.fov * D2R) / 2) * d;
    overlay.position.copy(camera.position).addScaledVector(camera.getWorldDirection(new THREE.Vector3()), d);
    overlay.quaternion.copy(camera.quaternion);
    overlay.scale.set(hh * (W / H) * 1.02, hh * 1.02, 1);
  }
  post.dof.uFocus.value = V.focus || 10;
  post.dof.uAper.value = V.focus ? V.aper || 0.4 : 0;
  post.dof.uMax.value = V.focus ? 10 : 0;
  const sp = camera.position.clone().addScaledVector(sd, 1000).project(camera);
  const inFront = sp.z < 1 && sp.x > -1.4 && sp.x < 1.4 && sp.y > -1.4 && sp.y < 1.4;
  post.rays.uSun.value.set(sp.x * 0.5 + 0.5, sp.y * 0.5 + 0.5);
  post.rays.uStr.value = inFront && M.sunVis ? 0.7 : 0;
  post.bloom.strength = 0.38;
  post.bloom.radius = 0.6;
  post.bloom.threshold = 0.9;
  const G = post.grade;
  G.uExpo.value = M.g.expo + 0.3 * lf;
  G.uSat.value = M.g.sat;
  G.uCon.value = M.g.con;
  G.uVig.value = M.g.vig;
  G.uTint.value.set(...M.g.tint);
  G.uShadow.value.set(...M.g.sh);
  G.uHigh.value.set(...M.g.hi);
  G.uKeepWarm.value = M.g.warm;
  G.uFlash.value = Math.max(FX.flash || 0, lf * 0.22);
  if (FX.flashCol) G.uFlashCol.value.set(...FX.flashCol);
  else if (lf > (FX.flash || 0)) G.uFlashCol.value.set(2.4, 2.8, 3.6);
  else G.uFlashCol.value.set(4, 3.6, 3);
  G.uImpact.value = FX.impact || 0;
  post.fin.uGrain.value = 0.02;
  post.fin.uCA.value = FX.impact ? 0.004 : FX.glitch ? 0.003 : 0.0006;
  post.fin.uGlitch.value = FX.glitch || 0;
  post.fin.uHudOn.value = 1;
  const st = { ...(V.hud || {}) };
  if (V.label && COPY_LABEL[V.label]) {
    const S = SHOTS.find((s) => s.id === V.label);
    const a = cl((t - S.t0 - 0.15) / 0.2) * (1 - cl((t - S.t1 + 0.15) / 0.15));
    st.copyLabel = { text: COPY_LABEL[V.label], a };
  } else if (V.label === "K7") {
    const S = SHOTS.find((s) => s.id === "K7");
    const a = cl((t - MK.k7land - 0.2) / 0.2) * (1 - cl((t - S.t1 + 0.15) / 0.15));
    st.copyLabel = { text: "MORECUBE ✓ · ДОНАТ БЕСПЛАТНО", a, good: true };
  }
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
  renderer, scene, camera, post, hero, SHOTS, TLD, MK, lightAt, render,
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
