// Minecraft player model from a 64x64 skin (classic 4 px or slim 3 px arms) with the overlay layer and a
// face rig drawn over the skin (blink, brows, pupils, mouth) on a separate front-of-head layer.
import * as THREE from "./three.js";
import { WU, LIGHT_GLSL } from "./world.js";

// characters take the same light model as the blocks; sky/block levels come from the baked light volume
function patchChar(mat, U, key) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uSkyL = U.uSkyL;
    sh.uniforms.uBlkL = U.uBlkL;
    sh.uniforms.uBlockCol = WU.uBlockCol;
    sh.uniforms.uBlockK = WU.uBlockK;
    sh.uniforms.uSkyMin = WU.uSkyMin;
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", `#include <common>
uniform float uSkyL, uBlkL, uBlockK, uSkyMin; uniform vec3 uBlockCol;
#define vSky uSkyL
#define vBlk uBlkL`)
      .replace("#include <lights_fragment_end>", `#include <lights_fragment_end>
${LIGHT_GLSL}`);
  };
  mat.customProgramCacheKey = () => key;
}

export const PX = 0.9375 / 16; // one model pixel in metres (the player is 1.8 m tall)

export function skinTex(tex) {
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// box of w*h*d px (+inflate on every side), UVs from the skin unfolding at (u, v)
export function boxGeo(w, h, d, u, v, tw = 64, th = 64, inflate = 0) {
  const hx = (w / 2 + inflate) * PX, hy = (h / 2 + inflate) * PX, hz = (d / 2 + inflate) * PX;
  const P = [], N = [], U = [], I = [];
  const face = (corners, n, rx, ry, rw, rh) => {
    const v0 = P.length / 3;
    const uvs = [[rx, ry + rh], [rx + rw, ry + rh], [rx + rw, ry], [rx, ry]];
    corners.forEach((c, k) => {
      P.push(c[0], c[1], c[2]);
      N.push(n[0], n[1], n[2]);
      U.push(uvs[k][0] / tw, 1 - uvs[k][1] / th);
    });
    I.push(v0, v0 + 1, v0 + 2, v0, v0 + 2, v0 + 3);
  };
  face([[-hx, -hy, hz], [hx, -hy, hz], [hx, hy, hz], [-hx, hy, hz]], [0, 0, 1], u + d, v + d, w, h); // front
  face([[hx, -hy, -hz], [-hx, -hy, -hz], [-hx, hy, -hz], [hx, hy, -hz]], [0, 0, -1], u + 2 * d + w, v + d, w, h); // back
  face([[-hx, -hy, -hz], [-hx, -hy, hz], [-hx, hy, hz], [-hx, hy, -hz]], [-1, 0, 0], u, v + d, d, h); // right side
  face([[hx, -hy, hz], [hx, -hy, -hz], [hx, hy, -hz], [hx, hy, hz]], [1, 0, 0], u + d + w, v + d, d, h); // left side
  face([[-hx, hy, hz], [hx, hy, hz], [hx, hy, -hz], [-hx, hy, -hz]], [0, 1, 0], u + d, v, w, d); // top
  face([[-hx, -hy, -hz], [hx, -hy, -hz], [hx, -hy, hz], [-hx, -hy, hz]], [0, -1, 0], u + d + w, v, w, d); // bottom
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(N, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(U, 2));
  g.setIndex(I);
  return g;
}

let charId = 0;
export function makePlayer({ skin, slim = false, face = null }) {
  const id = charId++;
  skinTex(skin);
  const U = { uSkyL: { value: 1 }, uBlkL: { value: 0 } };
  const base = new THREE.MeshStandardMaterial({ map: skin, roughness: 0.8, metalness: 0, alphaTest: 0.5 });
  const over = base.clone();
  over.side = THREE.DoubleSide;
  patchChar(base, U, "char-base");
  patchChar(over, U, "char-over");
  const root = new THREE.Group();
  const tilt = new THREE.Group();
  root.add(tilt);
  const hips = new THREE.Group();
  hips.position.y = 12 * PX;
  tilt.add(hips);
  const torso = new THREE.Group();
  hips.add(torso);
  const part = (parent, w, h, d, u, v, ou, ov, pos, inflate) => {
    const m = new THREE.Mesh(boxGeo(w, h, d, u, v), base);
    m.position.set(pos[0] * PX, pos[1] * PX, pos[2] * PX);
    m.castShadow = m.receiveShadow = true;
    parent.add(m);
    if (ou !== null) {
      const o = new THREE.Mesh(boxGeo(w, h, d, ou, ov, 64, 64, inflate), over);
      o.position.copy(m.position);
      o.castShadow = true;
      o.receiveShadow = true;
      parent.add(o);
    }
    return m;
  };
  part(torso, 8, 12, 4, 16, 16, 16, 32, [0, 6, 0], 0.25);
  const head = new THREE.Group();
  head.position.y = 12 * PX;
  torso.add(head);
  part(head, 8, 8, 8, 0, 0, 32, 0, [0, 4, 0], 0.5);
  const aw = slim ? 3 : 4, ao = slim ? 0.5 : 1;
  const armR = new THREE.Group();
  armR.position.set(-5 * PX, 10 * PX, 0);
  torso.add(armR);
  part(armR, aw, 12, 4, 40, 16, 40, 32, [-ao, -4, 0], 0.25);
  const armL = new THREE.Group();
  armL.position.set(5 * PX, 10 * PX, 0);
  torso.add(armL);
  part(armL, aw, 12, 4, 32, 48, 48, 48, [ao, -4, 0], 0.25);
  const legR = new THREE.Group();
  legR.position.set(-1.9 * PX, 0, 0);
  hips.add(legR);
  part(legR, 4, 12, 4, 0, 16, 0, 32, [0, -6, 0], 0.25);
  const legL = new THREE.Group();
  legL.position.set(1.9 * PX, 0, 0);
  hips.add(legL);
  part(legL, 4, 12, 4, 16, 48, 0, 48, [0, -6, 0], 0.25);
  const hand = new THREE.Group();
  hand.position.set(-ao * PX, -10.5 * PX, 0.6 * PX);
  armR.add(hand);

  // face rig: a canvas painted per frame on a plane just in front of the head (8x8 skin pixels)
  let faceCtl = null;
  if (face) {
    const c = document.createElement("canvas");
    c.width = c.height = 8;
    const tex = new THREE.CanvasTexture(c);
    skinTex(tex);
    const fm = new THREE.MeshStandardMaterial({ map: tex, transparent: true, alphaTest: 0.5, roughness: 0.8, polygonOffset: true, polygonOffsetFactor: -2 });
    patchChar(fm, U, "char-face");
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(8 * PX, 8 * PX), fm);
    plane.position.set(0, 4 * PX, 4.02 * PX);
    head.add(plane);
    const g = c.getContext("2d");
    faceCtl = { c, g, tex, plane, def: face };
  }

  const P = {
    id, root, tilt, hips, torso, head, armR, armL, legR, legL, hand, mats: [base, over], faceCtl, U,
    light(sky, blk) {
      U.uSkyL.value = sky;
      U.uBlkL.value = blk;
    },
    set(p) {
      root.visible = p.visible !== false;
      root.position.set(p.x || 0, p.y || 0, p.z || 0);
      root.rotation.set(0, p.yaw || 0, 0);
      tilt.rotation.set(p.pitch || 0, 0, p.roll || 0);
      hips.position.y = (12 - (p.crouch || 0) * 1.6) * PX;
      torso.rotation.set(p.tP || 0, p.tY || 0, 0, "YXZ");
      head.rotation.set(p.hP || 0, p.hY || 0, 0, "YXZ");
      armR.rotation.set(p.aRx || 0, p.aRy || 0, p.aRz || 0, "ZYX");
      armL.rotation.set(p.aLx || 0, p.aLy || 0, p.aLz || 0, "ZYX");
      legR.rotation.set(p.lR || 0, 0, p.lRz || 0);
      legL.rotation.set(p.lL || 0, 0, p.lLz || 0);
      if (p.crouch) {
        torso.rotation.x += 0.5 * p.crouch;
        legR.position.z = legL.position.z = -4 * PX * p.crouch;
      } else legR.position.z = legL.position.z = 0;
      if (faceCtl && p.face) {
        faceCtl.g.clearRect(0, 0, 8, 8);
        faceCtl.def(faceCtl.g, p.face);
        faceCtl.tex.needsUpdate = true;
      }
      if (faceCtl) faceCtl.plane.visible = !!p.face;
    },
  };
  return P;
}

// classic walk cycle (phase in cycles), amplitude 0..1
export function walkPose(ph, amp = 1) {
  const s = Math.sin(ph * Math.PI * 2) * amp;
  return { lR: s * 0.75, lL: -s * 0.75, aRx: -s * 0.6, aLx: s * 0.6 };
}
