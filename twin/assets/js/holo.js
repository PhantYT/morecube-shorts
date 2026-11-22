// Spawn NPCs (ZNPCsPlus) with their skins and hologram lines, and DecentHolograms holograms: line PNGs rendered
// by tools/bake_npcs.py with the real font, shown as camera-facing nametag planes (0.025 m per font pixel),
// hidden beyond the hologram's display range like in the client.
import * as THREE from "./three.js";
import { makePlayer } from "./player.js";

const FPX = 0.025;

function lineMesh(tex, img) {
  const w = (img.width / 4) * FPX, h = (img.height / 4) * FPX;
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false, fog: false })
  );
  m.renderOrder = 5;
  return m;
}

export async function loadEntities(base, loader) {
  const E = await (await fetch(base + "entities.json", { cache: "no-cache" })).json();
  const group = new THREE.Group();
  const lines = [];
  const npcs = [];
  const texCache = {};
  const tex = async (p) => {
    if (!texCache[p]) {
      const t = await loader.loadAsync(base + p);
      t.magFilter = THREE.NearestFilter;
      t.minFilter = THREE.LinearMipmapLinearFilter;
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 8;
      texCache[p] = t;
    }
    return texCache[p];
  };
  for (const n of E.npcs) {
    const rec = { id: n.id, pos: n.pos, yaw: n.yaw, model: null };
    if (n.type === "player" && n.skin) {
      const skin = (await tex(n.skin)).clone();
      skin.needsUpdate = true;
      const P = makePlayer({ skin, slim: n.slim });
      P.set({ x: n.pos[0], y: n.pos[1], z: n.pos[2], yaw: (-n.yaw * Math.PI) / 180, hP: ((n.pitch || 0) * Math.PI) / 180 });
      group.add(P.root);
      rec.model = P;
    }
    const L = n.lines || [];
    for (let i = 0; i < L.length; i++) {
      if (!L[i]) continue;
      const t = await tex(L[i].png);
      const m = lineMesh(t, t.image);
      m.position.set(n.pos[0], n.pos[1] + 2.15 + (L.length - 1 - i) * E.line_spacing, n.pos[2]);
      group.add(m);
      lines.push({ m, range: 32, owner: n.id });
    }
    npcs.push(rec);
  }
  for (const h of E.holos) {
    let y = h.pos[1];
    for (const l of h.lines) {
      if (l.img) {
        const t = await tex(l.img.png);
        const m = lineMesh(t, t.image);
        m.position.set(h.pos[0], y, h.pos[2]);
        group.add(m);
        lines.push({ m, range: h.id === "donateList_1" ? 32 : 24, owner: h.id });
      }
      y -= l.h;
    }
  }
  const update = (camera, rangeMul = 1) => {
    for (const L of lines) {
      L.m.quaternion.copy(camera.quaternion);
      L.m.visible = L.m.position.distanceTo(camera.position) < L.range * rangeMul;
    }
  };
  return { group, lines, npcs, update, E };
}
