// traffic.js — AI traffic cars on road loops + pedestrians on sidewalks.
// Cars follow the road grid; pedestrians stroll block edges and cross at corners.
import * as THREE from 'three';
import { mulberry32, clamp, angleLerp } from './util.js';
import { spawnCar, CAR_DEFS } from './vehicles.js';

export function createTraffic(scene, city, count = 14) {
  const rng = mulberry32(777);
  const cars = [];
  const roadsX = city.roads.filter(r => r.axis === 'x');
  const roadsZ = city.roads.filter(r => r.axis === 'z');
  for (let i = 0; i < count; i++) {
    const def = CAR_DEFS[Math.floor(rng() * CAR_DEFS.length)];
    const useX = rng() < 0.5;
    const road = useX ? roadsX[Math.floor(rng() * roadsX.length)] : roadsZ[Math.floor(rng() * roadsZ.length)];
    const along = (rng() * 2 - 1) * (road.len / 2 - 10);
    const lane = (rng() < 0.5 ? -3.2 : 3.2);
    const x = useX ? along : road.x + lane;
    const z = useX ? road.z + lane : along;
    const yaw = useX ? (lane < 0 ? Math.PI / 2 : -Math.PI / 2) : (lane < 0 ? Math.PI : 0);
    const car = spawnCar(scene, def, x, z, yaw);
    car.ai = { useX, road, lane, speed: 7 + rng() * 4, dir: lane < 0 ? 1 : -1, stuck: 0 };
    cars.push(car);
  }
  const peds = [];
  const pedMat = new THREE.MeshStandardMaterial({ color: 0xe8b060, roughness: 0.8 });
  const shirtCols = [0x4a90d8, 0xd84a8a, 0x7ac94a, 0xe8e8e8, 0x8a5ad8, 0xd8a04a];
  for (let i = 0; i < 16; i++) {
    const g = new THREE.Group();
    const shirt = new THREE.MeshStandardMaterial({ color: shirtCols[i % shirtCols.length], roughness: 0.85 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.9, 0.4), shirt);
    body.position.y = 1.15; g.add(body);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.4), pedMat);
    head.position.y = 1.85; g.add(head);
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.7, 0.3),
      new THREE.MeshStandardMaterial({ color: 0x2a2a3a }));
    legL.position.set(-0.18, 0.35, 0); g.add(legL);
    const legR = legL.clone(); legR.position.x = 0.18; g.add(legR);
    scene.add(g);
    const sw = city.sidewalks[Math.floor(rng() * city.sidewalks.length)];
    const px = sw.x + (rng() * 2 - 1) * (sw.half - 1);
    const pz = sw.z + (rng() < 0.5 ? -sw.half : sw.half) * (rng() < 0.5 ? 1 : 1);
    peds.push({ group: g, legL, legR, x: px, z: pz, yaw: rng() * Math.PI * 2,
      speed: 1.1 + rng() * 0.7, phase: rng() * 6, target: null, panic: 0 });
  }
  return { cars, peds, rng };
}

export function updateTraffic(t, dt, colliders, playerPos, playerSpeed) {
  // --- AI cars: drive along their road, turn at the grid edge, slow for the player ---
  for (const car of t.cars) {
    const ai = car.ai;
    const fwdX = Math.sin(car.yaw), fwdZ = Math.cos(car.yaw);
    // obstacle ahead: player car / player on foot
    const dx = playerPos.x - car.pos.x, dz = playerPos.z - car.pos.z;
    const ahead = dx * fwdX + dz * fwdZ;
    const distP = Math.hypot(dx, dz);
    let target = ai.speed;
    if (ahead > 0 && ahead < 9 && distP < 9) target = 0; // yield
    car.speed = lerp(car.speed, target, 1 - Math.pow(0.01, dt));
    car.pos.x += fwdX * car.speed * dt;
    car.pos.z += fwdZ * car.speed * dt;
    car.mesh.position.set(car.pos.x, 0, car.pos.z);
    for (const w of car.mesh.userData.wheels) w.rotation.x += car.speed * dt * 2.2;
    // reached the end of the road -> U-turn and drive back
    const along = ai.useX ? car.pos.x : car.pos.z;
    const half = 150;
    if (Math.abs(along) > half) {
      car.yaw += Math.PI;
      car.pos.x = clamp(car.pos.x, -half, half);
      car.pos.z = clamp(car.pos.z, -half, half);
    }
    if (hitsAny(car.pos.x, car.pos.z, 1.6, colliders)) { car.speed = 0; car.yaw += Math.PI / 2; }
  }
  // --- pedestrians: wander sidewalk edges, flee from a fast player/car ---
  for (const p of t.peds) {
    const d = Math.hypot(playerPos.x - p.x, playerPos.z - p.z);
    if (d < 6 && playerSpeed > 4) p.panic = 2.5;
    if (p.panic > 0) {
      p.panic -= dt;
      const ax = (p.x - playerPos.x) / (d || 1), az = (p.z - playerPos.z) / (d || 1);
      p.x += ax * 4.5 * dt; p.z += az * 4.5 * dt;
      p.yaw = Math.atan2(ax, az);
    } else {
      if (!p.target || Math.hypot(p.target.x - p.x, p.target.z - p.z) < 1.5) {
        const a = t.rng() * Math.PI * 2, r = 12 + t.rng() * 30;
        p.target = { x: clamp(p.x + Math.cos(a) * r, -150, 150), z: clamp(p.z + Math.sin(a) * r, -150, 150) };
      }
      const dx = p.target.x - p.x, dz = p.target.z - p.z;
      const len = Math.hypot(dx, dz) || 1;
      p.x += (dx / len) * p.speed * dt; p.z += (dz / len) * p.speed * dt;
      p.yaw = angleLerp(p.yaw, Math.atan2(dx, dz), 1 - Math.pow(0.01, dt));
    }
    p.phase += dt * 6;
    p.group.position.set(p.x, 0, p.z);
    p.group.rotation.y = p.yaw;
    p.legL.rotation.x = Math.sin(p.phase) * 0.5;
    p.legR.rotation.x = -Math.sin(p.phase) * 0.5;
  }
}
function lerp(a, b, t) { return a + (b - a) * t; }
function hitsAny(x, z, r, boxes) {
  for (const b of boxes) {
    const cx = Math.max(b.minX, Math.min(x, b.maxX)), cz = Math.max(b.minZ, Math.min(z, b.maxZ));
    const dx = x - cx, dz = z - cz;
    if (dx * dx + dz * dz < r * r) return true;
  }
  return false;
}
