// The baked MoreCube spawn: chunked binary meshes (tools/bake_world.py) on one atlas. Every layer shares one
// patched MeshStandardMaterial family: vertex AO x tint in colour, emissive blocks, waving leaves/plants,
// sunset fog. Positions are int16 in 1/128 block units relative to each chunk origin.
import * as THREE from "./three.js";

export const WU = {
  uTime: { value: 0 }, uWind: { value: 1 }, uEmi: { value: 1.8 },
  uFogCol: { value: new THREE.Color(0.75, 0.62, 0.55) }, uFogSun: { value: new THREE.Color(1.0, 0.7, 0.42) },
  uFogDen: { value: 0.0045 }, uFogY: { value: 70 }, uSunDir: { value: new THREE.Vector3(0, 1, 0) },
  uBlockCol: { value: new THREE.Color(1.0, 0.74, 0.46) }, uBlockK: { value: 1.25 }, uSkyMin: { value: 0.05 },
};

// Minecraft-like light model shared by the world and the characters: ambient scaled by sky light (vanilla curve),
// sun hidden where the sky can't reach, warm block light (lanterns, glowstone...) as emission.
export const LIGHT_GLSL = `
  {
    float sc = vSky / (4.0 - 3.0 * vSky);
    float bc = vBlk / (4.0 - 3.0 * vBlk);
    float sunVis = smoothstep(0.6, 0.97, vSky);
    reflectedLight.indirectDiffuse *= (uSkyMin + (1.0 - uSkyMin) * sc);
    reflectedLight.indirectSpecular *= (0.15 + 0.85 * sc);
    reflectedLight.directDiffuse *= sunVis;
    reflectedLight.directSpecular *= sunVis;
    totalEmissiveRadiance += diffuseColor.rgb * uBlockCol * bc * uBlockK;
  }`;

export function patchWorld(mat, key, { wave = true, water = false, local = 128, lit = true } = {}) {
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, WU);
    sh.vertexShader = sh.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
        attribute float aEmi; attribute vec4 aAux;
        uniform float uTime, uWind;
        varying float vEmi; varying vec3 vWPos; varying float vKind; varying float vSky, vBlk;`
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        vEmi = aEmi; vKind = aAux.y; vSky = ${lit ? "aAux.z / 255.0" : "1.0"}; vBlk = ${lit ? "aAux.w / 255.0" : "0.0"};
        ${wave ? `
        if (aAux.x > 0.5) {
          vec3 p0 = (modelMatrix * vec4(position, 1.0)).xyz;
          float ph = uTime * 1.6 + p0.x * 0.41 + p0.z * 0.33 + p0.y * 0.2;
          float amp = (aAux.x > 1.5 ? 0.07 : 0.025) * uWind;
          transformed.x += sin(ph) * amp * ${local.toFixed(1)};
          transformed.z += cos(ph * 0.83) * amp * 0.8 * ${local.toFixed(1)};
          transformed.y += sin(ph * 1.31) * amp * 0.2 * ${local.toFixed(1)};
        }` : ""}`
      )
      .replace(
        "#include <worldpos_vertex>",
        `#include <worldpos_vertex>
        vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;`
      );
    sh.fragmentShader = sh.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
        uniform float uEmi, uFogDen, uFogY, uTime, uBlockK, uSkyMin; uniform vec3 uFogCol, uFogSun, uSunDir, uBlockCol;
        varying float vEmi; varying vec3 vWPos; varying float vKind; varying float vSky, vBlk;`
      )
      .replace("#include <lights_fragment_end>", `#include <lights_fragment_end>
${LIGHT_GLSL}`)
      .replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
        {
          float l = dot(diffuseColor.rgb, vec3(0.3, 0.55, 0.15));
          totalEmissiveRadiance += diffuseColor.rgb * vEmi * uEmi * (0.35 + 0.65 * smoothstep(0.15, 0.7, l));
        }`
      )
      .replace(
        "#include <opaque_fragment>",
        `#include <opaque_fragment>
        {
          vec3 vd = vWPos - cameraPosition;
          float dist = length(vd);
          float fq = uFogDen * dist;
          float f = 1.0 - exp(-fq * fq);
          f *= mix(1.0, 0.55, clamp((vWPos.y - uFogY) / 80.0, 0.0, 1.0));
          float sunA = pow(clamp(dot(vd / max(dist, 1e-3), uSunDir), 0.0, 1.0), 5.0);
          gl_FragColor.rgb = mix(gl_FragColor.rgb, mix(uFogCol, uFogSun, sunA), f);
        }`
      );
    if (water) {
      sh.fragmentShader = sh.fragmentShader.replace(
        "#include <normal_fragment_maps>",
        `#include <normal_fragment_maps>
        {
          vec2 q = vWPos.xz;
          float t = uTime;
          vec2 g = vec2(cos(q.x * 1.9 + t * 1.3) + 0.6 * cos(q.x * 3.7 - q.y * 1.1 + t * 2.1),
                        sin(q.y * 2.3 - t * 1.1) + 0.6 * sin(q.y * 4.1 + q.x * 0.9 + t * 1.7)) * 0.045;
          vec3 wn = normalize(vec3(-g.x, 1.0, -g.y));
          normal = normalize((viewMatrix * vec4(wn, 0.0)).xyz);
        }`
      );
    }
  };
  mat.customProgramCacheKey = () => key;
  return mat;
}

export async function loadWorld(base, atlas, env) {
  const index = await (await fetch(base + "world.json", { cache: "no-cache" })).json();
  const group = new THREE.Group();
  let maxQ = 0;
  for (const L of Object.values(index.layers)) for (const c of L.chunks) maxQ = Math.max(maxQ, c.nq);
  const idx = new Uint32Array(maxQ * 6);
  for (let q = 0; q < maxQ; q++) {
    const v = q * 4, i = q * 6;
    idx[i] = v; idx[i + 1] = v + 1; idx[i + 2] = v + 2; idx[i + 3] = v; idx[i + 4] = v + 2; idx[i + 5] = v + 3;
  }
  const indexAttr = new THREE.BufferAttribute(idx, 1);
  const mats = {
    solid: patchWorld(new THREE.MeshStandardMaterial({ map: atlas, vertexColors: true, roughness: 0.92, metalness: 0 }), "w-solid"),
    cutout: patchWorld(new THREE.MeshStandardMaterial({ map: atlas, vertexColors: true, roughness: 0.9, metalness: 0, alphaTest: 0.5, side: THREE.DoubleSide, alphaToCoverage: true }), "w-cutout"),
    trans: patchWorld(new THREE.MeshStandardMaterial({ map: atlas, vertexColors: true, roughness: 0.15, metalness: 0, transparent: true, depthWrite: false, side: THREE.DoubleSide, envMap: env, envMapIntensity: 0.6 }), "w-trans", { wave: false }),
    water: patchWorld(new THREE.MeshStandardMaterial({ map: atlas, vertexColors: true, roughness: 0.06, metalness: 0.0, transparent: true, opacity: 0.82, depthWrite: false, envMap: env, envMapIntensity: 1.1 }), "w-water", { wave: false, water: true }),
  };
  const meshes = [];
  for (const [name, L] of Object.entries(index.layers)) {
    const buf = await (await fetch(base + L.file, { cache: "no-cache" })).arrayBuffer();
    const nV = L.quads * 4;
    const pos = new Int16Array(buf, L.offs[0], nV * 4);
    const nrm = new Int8Array(buf, L.offs[1], nV * 4);
    const uv = new Uint16Array(buf, L.offs[2], nV * 2);
    const col = new Uint8Array(buf, L.offs[3], nV * 4);
    const aux = new Uint8Array(buf, L.offs[4], nV * 4);
    if (name === "entity" && !mats.entity) {
      const t = await new THREE.TextureLoader().loadAsync(base + L.atlas);
      t.flipY = false;
      t.colorSpace = THREE.SRGBColorSpace;
      t.magFilter = THREE.NearestFilter;
      t.minFilter = THREE.NearestMipmapLinearFilter;
      t.needsUpdate = true;
      mats.entity = patchWorld(new THREE.MeshStandardMaterial({ map: t, vertexColors: true, roughness: 0.85, metalness: 0, alphaTest: 0.1, side: THREE.DoubleSide }), "w-entity", { wave: false });
    }
    const mat = mats[name];
    for (const c of L.chunks) {
      const v0 = c.q0 * 4, vn = c.nq * 4;
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.InterleavedBufferAttribute(new THREE.InterleavedBuffer(pos.subarray(v0 * 4, (v0 + vn) * 4), 4), 3, 0, false));
      g.setAttribute("normal", new THREE.InterleavedBufferAttribute(new THREE.InterleavedBuffer(nrm.subarray(v0 * 4, (v0 + vn) * 4), 4), 3, 0, true));
      g.setAttribute("uv", new THREE.BufferAttribute(uv.subarray(v0 * 2, (v0 + vn) * 2), 2, true));
      const ic = new THREE.InterleavedBuffer(col.subarray(v0 * 4, (v0 + vn) * 4), 4);
      g.setAttribute("color", new THREE.InterleavedBufferAttribute(ic, 3, 0, true));
      g.setAttribute("aEmi", new THREE.InterleavedBufferAttribute(ic, 1, 3, true));
      g.setAttribute("aAux", new THREE.BufferAttribute(aux.subarray(v0 * 4, (v0 + vn) * 4), 4, false));
      g.setIndex(indexAttr);
      g.setDrawRange(0, c.nq * 6);
      const o = c.o;
      const mn = new THREE.Vector3((c.min[0] - o[0]) * 128, (c.min[1] - o[1]) * 128, (c.min[2] - o[2]) * 128);
      const mx = new THREE.Vector3((c.max[0] - o[0]) * 128, (c.max[1] - o[1]) * 128, (c.max[2] - o[2]) * 128);
      g.boundingBox = new THREE.Box3(mn.clone().subScalar(64), mx.clone().addScalar(64));
      g.boundingSphere = g.boundingBox.getBoundingSphere(new THREE.Sphere());
      const m = new THREE.Mesh(g, mat);
      m.position.set(o[0], o[1], o[2]);
      m.scale.setScalar(1 / 128);
      m.castShadow = name === "solid" || name === "cutout" || name === "entity";
      m.receiveShadow = true;
      m.matrixAutoUpdate = false;
      m.updateMatrix();
      if (name === "trans") m.renderOrder = 2;
      if (name === "water") m.renderOrder = 3;
      m.userData.layer = name;
      group.add(m);
      meshes.push(m);
    }
  }
  return { group, mats, meshes, index };
}
