// MoreCube twin: the real spawn (baked from world_spawn), its NPCs and holograms, a golden-hour "shader" look.
// render(t) picks a shot from SHOTS by whole seconds; window.__dbg.view() renders any custom camera for scouting.
import * as THREE from "./three.js";
import { clamp } from "./lib.js";
import { WU, loadWorld } from "./world.js";
import { buildSky, buildClouds } from "./sky.js";
import { makePost } from "./post.js";
import { loadEntities } from "./holo.js";
import { makePlayer, walkPose } from "./player.js";

const host = window.__world || (window.__world = {});
const W = 1080, H = 1920;
const BASE = "assets/data/";

const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById("world-canvas"), antialias: false, preserveDrawingBuffer: true, powerPreference: "high-performance" });
renderer.setPixelRatio(1);
renderer.setSize(W, H, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;

const loader = new THREE.TextureLoader();
const atlas = await loader.loadAsync(BASE + "atlas.png");
atlas.flipY = false;
atlas.colorSpace = THREE.SRGBColorSpace;
atlas.magFilter = THREE.NearestFilter;
atlas.minFilter = THREE.LinearMipmapLinearFilter;
atlas.anisotropy = renderer.capabilities.getMaxAnisotropy();
atlas.needsUpdate = true;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, W / H, 0.1, 3000);
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
const SUN0 = new THREE.Vector3(0.55, 0.42, 0.72).normalize();
const env = bakeEnv("#4677c9", "#f4c494", "#5d5048", SUN0);

const world = await loadWorld(BASE, atlas, env);
scene.add(world.group);
const sky = buildSky();
scene.add(sky.group);
const clouds = buildClouds();
scene.add(clouds.mesh);
const ents = await loadEntities(BASE, loader);
scene.add(ents.group);

const LJ = await (await fetch(BASE + "light.json", { cache: "no-cache" })).json();
const LB = new Uint8Array(await (await fetch(BASE + "light.bin", { cache: "no-cache" })).arrayBuffer());
function lightAt(x, y, z) {
  const ix = Math.floor(x) - LJ.x0, iy = Math.floor(y) - LJ.y0, iz = Math.floor(z) - LJ.z0;
  if (ix < 0 || iy < 0 || iz < 0 || ix >= LJ.nx || iy >= LJ.ny || iz >= LJ.nz) return [1, 0];
  const i = ((iy * LJ.nz + iz) * LJ.nx + ix) * 2;
  return [LB[i] / 15, LB[i + 1] / 15];
}
for (const n of ents.npcs) if (n.model) n.model.light(...lightAt(n.pos[0], n.pos[1] + 1.4, n.pos[2]));

const heroSkinPath = ents.E.npcs.find((n) => n.id === "тиктокер").skin;
const heroSkin = await loader.loadAsync(BASE + heroSkinPath);
const hero = makePlayer({ skin: heroSkin, slim: false });
scene.add(hero.root);
hero.set({ visible: false });

const hemi = new THREE.HemisphereLight(0xc4d6f5, 0x7a6252, 1.45);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffd2a0, 3.2);
sun.castShadow = true;
sun.shadow.mapSize.set(4096, 4096);
sun.shadow.bias = -0.0003;
sun.shadow.normalBias = 0.03;
sun.shadow.radius = 2;
scene.add(sun, sun.target);

/* ------------------------------------------------------------------ shots (one per second) */
const D2R = Math.PI / 180;
const SHOTS = [
  { name: "spawn_wide", cam: [74, 118, 52], tgt: [4, 86, 0], fov: 50, shadow: { c: [20, 86, 0], r: 110 }, focus: 0, fog: 0.0012 },
  { name: "npc_row", cam: [1.5, 87.6, 18.5], tgt: [-8.5, 87.4, 16.5], fov: 46, shadow: { c: [-6, 86, 14], r: 40 }, focus: 10, aper: 0.22 },
  { name: "donate_holo", cam: [19.6, 86.9, 6.8], tgt: [9.6, 87.3, 0.6], fov: 52, shadow: { c: [10, 86, 2], r: 40 }, focus: 11.6, aper: 0.25 },
  { name: "portal", cam: [61.5, 81.2, -21.5], tgt: [65.2, 80.4, -33.6], fov: 50, shadow: { c: [62, 80, -28], r: 45 }, focus: 12.5, aper: 0.25 },
  { name: "hero_codes", cam: [-2.4, 86.9, 1.9], tgt: [4.5, 86.4, 0.2], fov: 48, shadow: { c: [0, 85, 0], r: 40 }, focus: 2.9, aper: 0.5, hero: { x: 0.5, y: 85, z: 0.5, yaw: -90 } },
  { name: "hero_roulette", cam: [6.9, 86.3, 1.7], tgt: [3, 87.35, 0.5], fov: 48, shadow: { c: [3, 85, 0], r: 40 }, focus: 4.1, aper: 0.55, hero: { x: 3, y: 85, z: 0.5, yaw: -90 } },
];

const v3 = (a) => new THREE.Vector3(a[0], a[1], a[2]);
function applyShot(S, t) {
  camera.fov = S.fov || 50;
  camera.aspect = W / H;
  camera.near = 0.1;
  camera.far = 3000;
  camera.updateProjectionMatrix();
  camera.position.copy(v3(S.cam));
  camera.lookAt(v3(S.tgt));
  camera.updateMatrixWorld();
  const sd = S.sun ? v3(S.sun).normalize() : SUN0.clone();
  WU.uSunDir.value.copy(sd);
  const c = v3(S.shadow.c), r = S.shadow.r;
  sun.target.position.copy(c);
  sun.position.copy(c).addScaledVector(sd, 300);
  const sc = sun.shadow.camera;
  sc.left = -r; sc.right = r; sc.top = r; sc.bottom = -r; sc.near = 50; sc.far = 700;
  sc.updateProjectionMatrix();
  sun.target.updateMatrixWorld();
  sun.updateMatrixWorld();
  if (S.hero) {
    const h = S.hero;
    hero.set({ x: h.x, y: h.y, z: h.z, yaw: (-h.yaw * Math.PI) / 180, ...walkPose(0, 0), hP: h.hP || 0, hY: h.hY || 0 });
    hero.light(...lightAt(h.x, h.y + 1.4, h.z));
  } else hero.set({ visible: false });
  sky.place(camera, 1, 1);
  ents.update(camera, S.holoRange || 1);
  WU.uTime.value = t;
  WU.uFogDen.value = S.fog ?? 0.0022;
  // post
  post.dof.uFocus.value = S.focus || 10;
  post.dof.uAper.value = S.focus ? S.aper || 0.4 : 0;
  post.dof.uMax.value = S.focus ? 9 : 0;
  const sp = camera.position.clone().addScaledVector(sd, 1000).project(camera);
  const inFront = sp.z < 1 && sp.x > -1.3 && sp.x < 1.3 && sp.y > -1.3 && sp.y < 1.3;
  post.rays.uSun.value.set(sp.x * 0.5 + 0.5, sp.y * 0.5 + 0.5);
  post.rays.uStr.value = inFront ? 0.55 : 0;
  post.bloom.strength = 0.32;
  post.bloom.radius = 0.6;
  post.bloom.threshold = 0.95;
  const G = post.grade;
  G.uExpo.value = S.expo || 1.05;
  G.uSat.value = 1.12;
  G.uCon.value = 1.06;
  G.uVig.value = 0.35;
  G.uTint.value.set(1.0, 0.98, 0.95);
  G.uShadow.value.set(0.92, 0.97, 1.06);
  G.uHigh.value.set(1.06, 1.0, 0.92);
  post.fin.uGrain.value = 0.018;
  post.fin.uCA.value = 0.0006;
  post.fin.uHudOn.value = 0;
}

function render(t) {
  const i = clamp(Math.floor(t), 0, SHOTS.length - 1);
  applyShot(SHOTS[i], t);
  post.fin.uFrame.value = Math.floor(t * 30);
  post.render();
}

window.__dbg = {
  lightAt, renderer, scene, camera, post, world, ents, hero, SHOTS, sun,
  view(o) {
    applyShot({ ...SHOTS[0], ...o, shadow: o.shadow || { c: o.tgt, r: o.r || 60 } }, o.t || 0);
    post.render();
    return renderer.info.render;
  },
  shot(i) { render(i + 0.5); return SHOTS[i].name; },
  // POST the current frame to the dev server (data/shots/<name>.png)
  async save(name) {
    const b = await new Promise((r) => renderer.domElement.toBlob(r, "image/png"));
    const res = await fetch("/save?name=" + encodeURIComponent(name), { method: "POST", body: b });
    return res.status;
  },
};
host.render = render;
render(0);
if (host.ready) host.ready();
