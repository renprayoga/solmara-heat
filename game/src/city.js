// city.js — Solmara: a procedural sun-soaked coastal city.
// Grid of road blocks with varied buildings, sidewalks, lamps, palms, a beach,
// sea and a pier. All geometry is generated from a seeded RNG: same city every run.
import * as THREE from 'three';
import { mulberry32 } from './util.js';

export const WORLD = {
  block: 46, road: 14, blocks: 5, // 5x5 blocks
  get half() { return (this.blocks * (this.block + this.road)) / 2; },
  beachZ: 0, // filled in by buildCity
};
export const ROAD_Y = 0.02;

function windowTexture(rng, base, lit) {
  const c = document.createElement('canvas'); c.width = 128; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, 128, 256);
  for (let y = 8; y < 248; y += 18) for (let x = 8; x < 120; x += 18) {
    const on = rng() < lit;
    g.fillStyle = on ? '#ffd98a' : (rng() < 0.5 ? '#20283a' : '#2c3a55');
    g.fillRect(x, y, 12, 12);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function buildCity(scene) {
  const rng = mulberry32(20261118);
  const colliders = [];   // {minX,maxX,minZ,maxZ} building footprints
  const roads = [];       // road centre lines for traffic: {x,z,axis:'x'|'z',len}
  const sidewalks = [];   // pedestrian walk paths
  const group = new THREE.Group();
  scene.add(group);

  const W = WORLD;
  const pitch = W.block + W.road;
  const half = W.half;
  const beachStart = half + 6; // sand begins south of the grid
  W.beachZ = beachStart;

  // --- ground: asphalt base, grass/sand handled by overlay planes ---
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(half * 2 + 260, half * 2 + 260),
    new THREE.MeshStandardMaterial({ color: 0x3a3f47, roughness: 0.95 }));
  ground.rotation.x = -Math.PI / 2; ground.position.set(0, 0, 60); group.add(ground);

  // --- beach + sea (south, +Z) ---
  const sand = new THREE.Mesh(new THREE.PlaneGeometry(half * 2 + 260, 90),
    new THREE.MeshStandardMaterial({ color: 0xe8cf9a, roughness: 1 }));
  sand.rotation.x = -Math.PI / 2; sand.position.set(0, 0.03, beachStart + 45); group.add(sand);
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(half * 2 + 260, 220),
    new THREE.MeshStandardMaterial({ color: 0x1d7fa8, roughness: 0.25, metalness: 0.1 }));
  sea.rotation.x = -Math.PI / 2; sea.position.set(0, 0.05, beachStart + 200); group.add(sea);

  // --- pier ---
  const pierMat = new THREE.MeshStandardMaterial({ color: 0x8a6b4a, roughness: 0.9 });
  for (let i = 0; i < 14; i++) {
    const plank = new THREE.Mesh(new THREE.BoxGeometry(10, 0.4, 6), pierMat);
    plank.position.set(-40, 0.6, beachStart + 60 + i * 6.5); group.add(plank);
  }
  for (const sx of [-44.5, -35.5]) for (let i = 0; i < 8; i++) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 2.4, 6), pierMat);
    post.position.set(sx, 0.4, beachStart + 62 + i * 13); group.add(post);
  }

  // --- roads: strips + dashed centre lines ---
  const roadMat = new THREE.MeshStandardMaterial({ color: 0x2b2f36, roughness: 0.95 });
  const lineMat = new THREE.MeshBasicMaterial({ color: 0xd8d8c0 });
  const sidewalkMat = new THREE.MeshStandardMaterial({ color: 0x9aa0a8, roughness: 0.9 });
  for (let i = 0; i <= W.blocks; i++) {
    const c = -half + i * pitch; // road centre on the grid line
    // vertical road (along Z)
    const rv = new THREE.Mesh(new THREE.PlaneGeometry(W.road, half * 2 + W.road), roadMat);
    rv.rotation.x = -Math.PI / 2; rv.position.set(c, ROAD_Y, 0); group.add(rv);
    const rh = new THREE.Mesh(new THREE.PlaneGeometry(half * 2 + W.road, W.road), roadMat);
    rh.rotation.x = -Math.PI / 2; rh.position.set(0, ROAD_Y, c); group.add(rh);
    roads.push({ x: c, z: 0, axis: 'z', len: half * 2 });
    roads.push({ x: 0, z: c, axis: 'x', len: half * 2 });
    // dashed lines
    for (let d = -half; d < half; d += 8) {
      const dv = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 3.4), lineMat);
      dv.rotation.x = -Math.PI / 2; dv.position.set(c, ROAD_Y + 0.01, d); group.add(dv);
      const dh = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 0.5), lineMat);
      dh.rotation.x = -Math.PI / 2; dh.position.set(d, ROAD_Y + 0.01, c); group.add(dh);
    }
  }

  // --- buildings per block ---
  const palette = ['#c96f4a', '#d8a05a', '#7fa8c9', '#a8b8c8', '#e8dcc8', '#8a9ab0', '#c9b18a', '#6a8a7a', '#b0708a', '#e0c060'];
  const facadeTex = [
    windowTexture(rng, '#b0603f', 0.35), windowTexture(rng, '#c89050', 0.3),
    windowTexture(rng, '#6a8aa8', 0.4), windowTexture(rng, '#8a96a8', 0.3),
    windowTexture(rng, '#c8b898', 0.35),
  ];
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x4a4a52, roughness: 1 });
  for (let bi = 0; bi < W.blocks; bi++) for (let bj = 0; bj < W.blocks; bj++) {
    const bx = -half + pitch / 2 + bi * pitch;
    const bz = -half + pitch / 2 + bj * pitch;
    // sidewalk slab for the block
    const sw = new THREE.Mesh(new THREE.BoxGeometry(W.block + 4, 0.3, W.block + 4), sidewalkMat);
    sw.position.set(bx, 0.15, bz); group.add(sw);
    sidewalks.push({ x: bx, z: bz, half: W.block / 2 + 1 });
    // 1-4 buildings per block
    const n = 1 + Math.floor(rng() * 3);
    const slots = [[-0.22, -0.22], [0.22, -0.22], [-0.22, 0.22], [0.22, 0.22]];
    for (let s = 0; s < n; s++) {
      const [ox, oz] = slots[s];
      const w = 12 + rng() * 8, d = 12 + rng() * 8, h = 10 + rng() * rng() * 42;
      const cx = bx + ox * W.block, cz = bz + oz * W.block;
      const tex = facadeTex[Math.floor(rng() * facadeTex.length)];
      const mat = new THREE.MeshStandardMaterial({ map: tex, color: palette[Math.floor(rng() * palette.length)], roughness: 0.85 });
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      b.position.set(cx, h / 2 + 0.3, cz); group.add(b);
      const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 0.6, 0.6, d + 0.6), roofMat);
      roof.position.set(cx, h + 0.6, cz); group.add(roof);
      // rooftop AC box on tall towers
      if (h > 30) {
        const ac = new THREE.Mesh(new THREE.BoxGeometry(3, 2, 3),
          new THREE.MeshStandardMaterial({ color: 0x707880 }));
        ac.position.set(cx + w / 4, h + 1.6, cz); group.add(ac);
      }
      colliders.push({ minX: cx - w / 2 - 0.3, maxX: cx + w / 2 + 0.3, minZ: cz - d / 2 - 0.3, maxZ: cz + d / 2 + 0.3 });
    }
    // palm trees on block corners
    for (const [px, pz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      if (rng() < 0.55) makePalm(group, bx + px * (W.block / 2 - 2), bz + pz * (W.block / 2 - 2), rng);
    }
  }

  // --- street lamps along roads ---
  const lampMat = new THREE.MeshStandardMaterial({ color: 0x2a2f38, roughness: 0.6, metalness: 0.4 });
  const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  for (let i = 0; i <= W.blocks; i++) {
    const c = -half + i * pitch;
    for (let d = -half + 20; d < half; d += 40) {
      for (const [lx, lz] of [[c - W.road / 2 - 1, d], [c + W.road / 2 + 1, d + 20]]) {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 7, 6), lampMat);
        pole.position.set(lx, 3.5, lz); group.add(pole);
        const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.45, 8, 6), bulbMat);
        bulb.position.set(lx, 7.1, lz); group.add(bulb);
      }
    }
  }

  // --- landmark: Solmara Tower (tallest, centre) + harbour cranes ---
  const tower = new THREE.Mesh(new THREE.BoxGeometry(20, 68, 20),
    new THREE.MeshStandardMaterial({ map: facadeTex[2], color: 0x9fc0e0, roughness: 0.7 }));
  tower.position.set(0, 34.3, 0); group.add(tower);
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8),
    new THREE.MeshBasicMaterial({ color: 0xff4040 }));
  beacon.position.set(0, 69.5, 0); beacon.name = 'towerBeacon'; group.add(beacon);
  colliders.push({ minX: -10.3, maxX: 10.3, minZ: -10.3, maxZ: 10.3 });

  // harbour crates + cranes near the pier (west side of beach)
  const crateMat = new THREE.MeshStandardMaterial({ color: 0xb0703a, roughness: 0.9 });
  const crateMat2 = new THREE.MeshStandardMaterial({ color: 0x3a7a8a, roughness: 0.9 });
  for (let i = 0; i < 10; i++) {
    const cr = new THREE.Mesh(new THREE.BoxGeometry(4, 3, 4), i % 2 ? crateMat : crateMat2);
    cr.position.set(-95 + (i % 5) * 6, 1.8, beachStart + 8 + Math.floor(i / 5) * 6);
    cr.rotation.y = rng() * 0.6; group.add(cr);
    colliders.push({ minX: cr.position.x - 2.4, maxX: cr.position.x + 2.4, minZ: cr.position.z - 2.4, maxZ: cr.position.z + 2.4 });
  }

  // --- sky: sunset gradient dome + sun + fog ---
  const skyGeo = new THREE.SphereGeometry(900, 16, 12);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color(0x2a1a5e) }, mid: { value: new THREE.Color(0xff7a3d) }, bot: { value: new THREE.Color(0xffc46b) } },
    vertexShader: 'varying vec3 vP; void main(){ vP=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: 'varying vec3 vP; uniform vec3 top,mid,bot; void main(){ float h=normalize(vP).y; vec3 c=h>0.25?mix(mid,top,smoothstep(0.25,0.8,h)):mix(bot,mid,smoothstep(-0.05,0.25,h)); gl_FragColor=vec4(c,1.0); }',
  });
  const sky = new THREE.Mesh(skyGeo, skyMat); scene.add(sky);
  const sun = new THREE.Mesh(new THREE.CircleGeometry(34, 24),
    new THREE.MeshBasicMaterial({ color: 0xffd27a, fog: false }));
  sun.position.set(-320, 120, -620); sun.lookAt(0, 40, 0); scene.add(sun);
  scene.fog = new THREE.Fog(0xe08a4a, 220, 700);

  return { group, colliders, roads, sidewalks, rng };
}

function makePalm(group, x, z, rng) {
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.45, 6.5, 6),
    new THREE.MeshStandardMaterial({ color: 0x7a5a38, roughness: 1 }));
  trunk.position.set(x, 3.25, z); trunk.rotation.z = (rng() - 0.5) * 0.16; group.add(trunk);
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x2f8a4a, roughness: 0.9, side: THREE.DoubleSide });
  for (let i = 0; i < 6; i++) {
    const leaf = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 1.1), leafMat);
    const a = (i / 6) * Math.PI * 2;
    leaf.position.set(x + Math.cos(a) * 1.6, 6.6, z + Math.sin(a) * 1.6);
    leaf.rotation.set(-0.5, -a + Math.PI / 2, 0.3);
    leaf.rotation.order = 'YXZ'; group.add(leaf);
  }
}

// Objective beacon: a glowing pillar + ring at a target position.
export function makeBeacon(color = 0xffd23f) {
  const g = new THREE.Group();
  const pillar = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 30, 12, 1, true),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false }));
  pillar.position.y = 15; g.add(pillar);
  const ring = new THREE.Mesh(new THREE.RingGeometry(2.2, 3.4, 24),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.15; g.add(ring);
  const arrow = new THREE.Mesh(new THREE.ConeGeometry(1.1, 2.6, 4),
    new THREE.MeshBasicMaterial({ color }));
  arrow.position.y = 9; arrow.rotation.y = Math.PI / 4; g.add(arrow);
  g.userData = { pillar, ring, arrow };
  return g;
}
