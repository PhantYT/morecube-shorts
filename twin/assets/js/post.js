// The "shaders": MSAA render with depth -> depth of field (bokeh gather) -> sun shafts -> bloom -> grade
// (split toning, contrast, hurt flash, vignette) -> tone map + sRGB -> final pass (titles, glitch, grain).
import * as THREE from "./three.js";
import { EffectComposer } from "https://cdn.jsdelivr.net/npm/three@0.184.0/examples/jsm/postprocessing/EffectComposer.js/+esm";
import { UnrealBloomPass } from "https://cdn.jsdelivr.net/npm/three@0.184.0/examples/jsm/postprocessing/UnrealBloomPass.js/+esm";
import { ShaderPass } from "https://cdn.jsdelivr.net/npm/three@0.184.0/examples/jsm/postprocessing/ShaderPass.js/+esm";
import { OutputPass } from "https://cdn.jsdelivr.net/npm/three@0.184.0/examples/jsm/postprocessing/OutputPass.js/+esm";
import { TexturePass } from "https://cdn.jsdelivr.net/npm/three@0.184.0/examples/jsm/postprocessing/TexturePass.js/+esm";

const VS = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

const DofShader = {
  uniforms: { tDiffuse: { value: null }, tDepth: { value: null }, uRes: { value: new THREE.Vector2() }, uNear: { value: 0.05 }, uFar: { value: 2000 }, uFocus: { value: 4 }, uAper: { value: 0.5 }, uMax: { value: 12 }, uFarR: { value: 0 }, uNearR: { value: 0.4 } },
  vertexShader: VS,
  fragmentShader: /* glsl */ `
    #include <packing>
    uniform sampler2D tDiffuse, tDepth; uniform vec2 uRes; uniform float uNear, uFar, uFocus, uAper, uMax, uFarR, uNearR; varying vec2 vUv;
    float dist(vec2 uv){ return -perspectiveDepthToViewZ(texture2D(tDepth, uv).x, uNear, uFar); }
    float coc(float d){ float dd = d > uFocus ? max(0.0, d - uFocus - uFarR) : max(0.0, uFocus - d - uNearR); return clamp(uAper * dd / max(d, 0.01), 0.0, 1.0) * uMax; }
    void main(){
      vec4 base = texture2D(tDiffuse, vUv);
      float d0 = dist(vUv);
      float c0 = coc(d0);
      if (uMax < 0.5 || c0 < 0.6) { gl_FragColor = base; return; }
      vec3 acc = base.rgb; float ws = 1.0;
      for (int i = 0; i < 48; i++) {
        float fi = float(i) + 0.5;
        float r = sqrt(fi / 48.0) * c0;
        float a = fi * 2.39996323;
        vec2 suv = vUv + vec2(cos(a), sin(a)) * r / uRes;
        float sd = dist(suv);
        float w = sd < d0 - 0.4 ? smoothstep(0.0, 1.0, coc(sd) / max(r, 0.5)) : 1.0;
        vec3 s = texture2D(tDiffuse, suv).rgb;
        w *= 1.0 + 1.5 * clamp(dot(s, vec3(0.333)) - 1.2, 0.0, 4.0);
        acc += s * w; ws += w;
      }
      gl_FragColor = vec4(acc / ws, base.a);
    }`,
};

const RaysShader = {
  uniforms: { tDiffuse: { value: null }, tDepth: { value: null }, uSun: { value: new THREE.Vector2(0.5, 0.5) }, uStr: { value: 0 }, uLen: { value: 0.75 }, uDecay: { value: 0.965 }, uCol: { value: new THREE.Color(1, 0.8, 0.55) }, uAsp: { value: 16 / 9 } },
  vertexShader: VS,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse, tDepth; uniform vec2 uSun; uniform float uStr, uLen, uDecay, uAsp; uniform vec3 uCol; varying vec2 vUv;
    void main(){
      vec4 base = texture2D(tDiffuse, vUv);
      if (uStr < 0.001) { gl_FragColor = base; return; }
      vec2 dir = uSun - vUv;
      vec2 stp = dir * uLen / 44.0;
      vec2 uv = vUv; float ill = 1.0, acc = 0.0;
      for (int i = 0; i < 44; i++) {
        uv += stp;
        if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) { ill *= uDecay; continue; }
        float sky = step(0.99985, texture2D(tDepth, uv).x);
        float l = dot(texture2D(tDiffuse, uv).rgb, vec3(0.3, 0.5, 0.2));
        acc += sky * smoothstep(0.35, 1.6, l) * ill;
        ill *= uDecay;
      }
      acc /= 44.0;
      float fall = exp(-length(dir * vec2(uAsp, 1.0)) * 1.1);
      gl_FragColor = vec4(base.rgb + uCol * acc * uStr * fall, base.a);
    }`,
};

const GradeShader = {
  uniforms: {
    tDiffuse: { value: null }, uExpo: { value: 1 }, uSat: { value: 1 }, uCon: { value: 1 }, uVig: { value: 0.4 }, uHurt: { value: 0 }, uFlash: { value: 0 },
    uTint: { value: new THREE.Color(1, 1, 1) }, uShadow: { value: new THREE.Color(1, 1, 1) }, uHigh: { value: new THREE.Color(1, 1, 1) }, uFlashCol: { value: new THREE.Color(4, 3.6, 3) },
    uImpact: { value: 0 }, uKeepWarm: { value: 0 },
  },
  vertexShader: VS,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse; uniform float uExpo, uSat, uCon, uVig, uHurt, uFlash, uImpact, uKeepWarm; uniform vec3 uTint, uShadow, uHigh, uFlashCol; varying vec2 vUv;
    void main(){
      vec3 col = max(texture2D(tDiffuse, vUv).rgb, 0.0) * uExpo * uTint;
      float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
      float warm = clamp((col.r - col.b) / max(col.r, 1e-3) * 2.2 - 0.35, 0.0, 1.0);
      col = max(mix(vec3(l), col, mix(uSat, max(uSat, 1.2), warm * uKeepWarm)), 0.0);
      float lt = clamp(l / (l + 0.35), 0.0, 1.0);
      col *= mix(uShadow, uHigh, lt);
      col = pow(col / 0.18 + 1e-6, vec3(uCon)) * 0.18;
      vec2 c = vUv - 0.5;
      float r = length(c * vec2(1.0, 0.72));
      col = mix(col, col * vec3(1.45, 0.38, 0.32) + vec3(0.22, 0.0, 0.0), clamp(uHurt, 0.0, 1.0) * 0.6);
      col += vec3(1.1, 0.02, 0.02) * uHurt * smoothstep(0.22, 0.72, r);
      col = mix(col, uFlashCol, clamp(uFlash, 0.0, 1.0));
      col *= mix(1.0, smoothstep(0.92, 0.18, r), uVig);
      // impact frame: a contrasty photographic negative (shapes stay readable, dark -> bright)
      vec3 tm = col / (col + 0.35);
      float li = dot(1.0 - tm, vec3(0.2126, 0.7152, 0.0722));
      vec3 inv = vec3(smoothstep(0.35, 0.85, li));
      inv = mix(inv, inv * vec3(1.0, 0.82, 0.8), 0.5);
      col = mix(col, inv / max(1.0 - inv * 0.97, 0.03) * 0.35, clamp(uImpact, 0.0, 1.0));
      gl_FragColor = vec4(col, 1.0);
    }`,
};

const FinalShader = {
  uniforms: {
    tDiffuse: { value: null }, tHud: { value: null }, uHudOn: { value: 0 }, uGlitch: { value: 0 }, uFrame: { value: 0 }, uGrain: { value: 0.02 }, uCA: { value: 0.0007 }, uBlack: { value: 0 },
    uRes: { value: new THREE.Vector2(1080, 1920) },
  },
  vertexShader: VS,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse, tHud; uniform float uHudOn, uGlitch, uFrame, uGrain, uCA, uBlack; uniform vec2 uRes; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main(){
      vec2 uv = vUv;
      float fr = uFrame, g = uGlitch;
      if (g > 0.001) {
        float row = floor(uv.y * 22.0);
        float tear = step(1.0 - 0.5 * g, h(vec2(row, floor(fr / 2.0))));
        uv.x += tear * (h(vec2(row, fr)) - 0.5) * 0.2 * g;
        uv.x += (h(vec2(floor(uv.y * 540.0), fr)) - 0.5) * 0.006 * g;
        vec2 bc = floor(uv * vec2(16.0, 9.0));
        float bb = step(1.0 - 0.22 * g * g, h(bc + fr * 0.37));
        uv += bb * (vec2(h(bc + 1.0), h(bc + 2.0)) - 0.5) * 0.09 * g;
        float px = 1.0 + 22.0 * step(0.9, h(vec2(fr, 7.0))) * g;
        uv = px > 1.5 ? (floor(uv * uRes / px) + 0.5) * px / uRes : uv;
      }
      float ca = uCA + g * 0.014;
      vec3 col = vec3(texture2D(tDiffuse, uv + vec2(ca, 0.0)).r, texture2D(tDiffuse, uv).g, texture2D(tDiffuse, uv - vec2(ca, 0.0)).b);
      if (uHudOn > 0.5) {
        vec4 hd = texture2D(tHud, uv);
        float sp = ca * 1.6;
        float hr = texture2D(tHud, uv + vec2(sp, 0.0)).a, hb = texture2D(tHud, uv - vec2(sp, 0.0)).a;
        col = mix(col, hd.rgb, hd.a);
        col += g * vec3(hr * 0.9, 0.0, hb * 0.9) * (1.0 - hd.a);
      }
      if (g > 0.001) {
        col *= 1.0 - g * 0.22 * step(0.5, fract(vUv.y * 270.0));
        float band = step(0.985 - 0.06 * g, h(vec2(floor(vUv.y * 60.0), fr)));
        col = mix(col, vec3(h(vUv * 999.0 + fr)), band * g * 0.55);
        if (h(vec2(fr, 3.3)) > 1.0 - 0.18 * g) col = col.gbr;
        if (h(vec2(fr, 5.1)) > 1.0 - 0.07 * g) col = vec3(1.0) - col;
      }
      col += uGrain * (h(vUv * 1000.0 + fr * 7.13) - 0.5);
      col *= 1.0 - uBlack;
      gl_FragColor = vec4(col, 1.0);
    }`,
};

// The scene renders into its own MSAA target (colour + depth); the composer works on plain targets,
// because bloom blending back into a multisampled buffer blacks out parts of the frame.
export function makePost(renderer, scene, camera, W, H) {
  const depth = new THREE.DepthTexture(W, H);
  const msaa = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples: 4, depthTexture: depth });
  const rt = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType });
  const composer = new EffectComposer(renderer, rt);
  composer.setPixelRatio(1);
  composer.setSize(W, H);
  composer.addPass(new TexturePass(msaa.texture));
  const dof = new ShaderPass(DofShader);
  dof.uniforms.tDepth.value = depth;
  dof.uniforms.uRes.value.set(W, H);
  composer.addPass(dof);
  const rays = new ShaderPass(RaysShader);
  rays.uniforms.tDepth.value = depth;
  composer.addPass(rays);
  const bloom = new UnrealBloomPass(new THREE.Vector2(W / 2, H / 2), 0.5, 0.55, 1.0);
  composer.addPass(bloom);
  const grade = new ShaderPass(GradeShader);
  composer.addPass(grade);
  composer.addPass(new OutputPass());
  const fin = new ShaderPass(FinalShader);
  fin.uniforms.uRes.value.set(W, H);
  rays.uniforms.uAsp.value = W / H;
  composer.addPass(fin);
  const render = () => {
    dof.uniforms.uNear.value = camera.near;
    dof.uniforms.uFar.value = camera.far;
    renderer.setRenderTarget(msaa);
    renderer.clear();
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    composer.render();
  };
  return { composer, dof: dof.uniforms, rays: rays.uniforms, bloom, grade: grade.uniforms, fin: fin.uniforms, render };
}
