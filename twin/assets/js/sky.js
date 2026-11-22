// Sky dome (gradient + sun glow), the square sun with its halo, and flat Minecraft clouds lit by the low sun.
import * as THREE from "./three.js";
import { noise3 } from "./lib.js";
import { WU, patchWorld } from "./world.js";

export function buildSky() {
  const U = {
    uZen: { value: new THREE.Color("#3e6fbf") }, uHor: { value: new THREE.Color("#f3c79a") }, uGround: { value: new THREE.Color("#6b5a52") },
    uSunDir: WU.uSunDir, uSunCol: { value: new THREE.Color(1, 0.72, 0.42) }, uGlow: { value: 1 },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms: U,
    side: THREE.BackSide,
    depthWrite: false,
    vertexShader: `varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uZen, uHor, uGround, uSunDir, uSunCol; uniform float uGlow; varying vec3 vDir;
      void main(){
        vec3 d = normalize(vDir);
        float h = d.y;
        vec3 col = mix(uHor, uZen, pow(clamp(h, 0.0, 1.0), 0.5));
        col = mix(col, uGround, smoothstep(0.0, -0.3, h));
        float s = clamp(dot(d, uSunDir), 0.0, 1.0);
        col += uSunCol * (s * s * s * s * 0.25 + pow(s, 24.0) * 0.6 + pow(s, 400.0) * 1.5) * uGlow;
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(1500, 48, 24), mat);
  dome.renderOrder = -10;
  dome.frustumCulled = false;
  const sun = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: new THREE.Color(7, 5.4, 3.4), depthWrite: false, transparent: true, fog: false }));
  sun.renderOrder = -9;
  const hc = document.createElement("canvas");
  hc.width = hc.height = 128;
  const g = hc.getContext("2d");
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, "rgba(255,255,255,1)");
  gr.addColorStop(0.2, "rgba(255,255,255,0.4)");
  gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr;
  g.fillRect(0, 0, 128, 128);
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(hc), color: new THREE.Color(1.2, 0.78, 0.42), depthWrite: false, transparent: true, blending: THREE.AdditiveBlending, fog: false }));
  halo.renderOrder = -9;
  const group = new THREE.Group();
  group.add(dome, sun, halo);
  const place = (camera, vis = 1, size = 1) => {
    dome.position.copy(camera.position);
    const d = WU.uSunDir.value;
    sun.position.copy(camera.position).addScaledVector(d, 1200);
    sun.lookAt(camera.position);
    sun.scale.setScalar(60 * size);
    halo.position.copy(sun.position);
    halo.quaternion.copy(sun.quaternion);
    halo.scale.setScalar(520 * size);
    sun.visible = halo.visible = vis > 0.001;
    sun.material.opacity = halo.material.opacity = vis;
  };
  return { group, U, place, sun, halo };
}

export function buildClouds(Y = 262) {
  const C = 12, N = 120, T = 4;
  const on = (i, j) => {
    if (i < 0 || j < 0 || i >= N || j >= N) return false;
    const x = (i - N / 2) * C, z = (j - N / 2) * C;
    return noise3(x * 0.006, 1.3, z * 0.006, 4) * 0.7 + noise3(x * 0.02, 5.1, z * 0.02, 8) * 0.3 > 0.22;
  };
  const P = [], Nn = [], Cc = [], I = [];
  const quad = (pts, n, l) => {
    const v0 = P.length / 3;
    for (const p of pts) {
      P.push(p[0], p[1], p[2]);
      Nn.push(n[0], n[1], n[2]);
      Cc.push(l, l, l);
    }
    I.push(v0, v0 + 1, v0 + 2, v0, v0 + 2, v0 + 3);
  };
  for (let j = 0; j < N; j++)
    for (let i = 0; i < N; i++) {
      if (!on(i, j)) continue;
      const x0 = (i - N / 2) * C, z0 = (j - N / 2) * C, x1 = x0 + C, z1 = z0 + C, y0 = Y, y1 = Y + T;
      quad([[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]], [0, 1, 0], 1.0);
      quad([[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], [0, -1, 0], 0.7);
      if (!on(i + 1, j)) quad([[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]], [1, 0, 0], 0.86);
      if (!on(i - 1, j)) quad([[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]], [-1, 0, 0], 0.86);
      if (!on(i, j + 1)) quad([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], [0, 0, 1], 0.9);
      if (!on(i, j - 1)) quad([[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]], [0, 0, -1], 0.9);
    }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(P, 3));
  geo.setAttribute("normal", new THREE.Float32BufferAttribute(Nn, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(Cc, 3));
  geo.setIndex(new THREE.Uint32BufferAttribute(I, 1));
  const mat = patchWorld(new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 1, transparent: true, opacity: 0.78, depthWrite: false, emissive: 0xffe2c8, emissiveIntensity: 0.22 }), "clouds", { wave: false, local: 1, lit: false });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = -5;
  mesh.frustumCulled = false;
  return { mesh, mat };
}
