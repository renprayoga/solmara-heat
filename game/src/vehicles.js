// vehicles.js — original car models (box-built), stealing, arcade driving.
// Models: sedan, sport, taxi, van, police. No licensed or real-world cars.
import * as THREE from 'three';
import { clamp, hitsAny, angleLerp } from './util.js';

export const CAR_DEFS = [
  { name: 'Solmara Sedan', color: 0x3a7ad8, top: 22, accel: 16, max: 30, len: 4.4 },
  { name: 'Vortex GT', color: 0xd82a2a, top: 26, accel: 20, max: 38, len: 4.1, sport: true },
  { name: 'Taxi Kuning', color: 0xf2c200, top: 22, accel: 15, max: 29, len: 4.4, taxi: true },
  { name: 'Cargo Van', color: 0x7a8899, top: 20, accel: 12, max: 24, len: 5.2, van: true },
  { name: 'City Cruiser', color: 0x2fae6e, top: 24, accel: 17, max: 32, len: 4.3 },
  { name: 'Sunset Coupe', color: 0xe07020, top: 25, accel: 19, max: 35, len: 4.2, sport: true },
];

function buildCarMesh(def, isPolice = false) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({
    color: isPolice ? 0x1a1d24 : def.color, roughness: 0.35, metalness: 0.55 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x101c2a, roughness: 0.15, metalness: 0.7 });
  const tyreMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.95 });
  const L = def.len, W = 2.0;
  const body = new THREE.Mesh(new THREE.BoxGeometry(W, 0.7, L), bodyMat);
  body.position.y = 0.55; g.add(body);
  if (def.van) {
    const box = new THREE.Mesh(new THREE.BoxGeometry(W - 0.1, 1.3, L * 0.62), bodyMat);
    box.position.set(0, 1.45, -0.3); g.add(box);
    const shield = new THREE.Mesh(new THREE.BoxGeometry(W - 0.3, 0.8, 0.15), glassMat);
    shield.position.set(0, 1.35, L / 2 - 0.15); shield.rotation.x = -0.25; g.add(shield);
  } else {
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(W - 0.3, 0.62, L * 0.48), glassMat);
    cabin.position.set(0, 1.18, -L * 0.06); g.add(cabin);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(W - 0.25, 0.1, L * 0.42), bodyMat);
    roof.position.set(0, 1.52, -L * 0.06); g.add(roof);
  }
  if (def.sport) {
    const spoiler = new THREE.Mesh(new THREE.BoxGeometry(W - 0.2, 0.08, 0.35), bodyMat);
    spoiler.position.set(0, 1.15, -L / 2 + 0.1); g.add(spoiler);
  }
  if (def.taxi) {
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.22, 0.4),
      new THREE.MeshStandardMaterial({ color: 0xffe94a, emissive: 0x665500 }));
    sign.position.set(0, 1.62, -L * 0.06); g.add(sign);
  }
  if (isPolice) {
    const door = new THREE.Mesh(new THREE.BoxGeometry(W + 0.06, 0.45, L * 0.5),
      new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.4 }));
    door.position.y = 0.55; g.add(door);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.18, 0.3),
      new THREE.MeshStandardMaterial({ color: 0x222222 }));
    bar.position.set(0, 1.62, -L * 0.06); g.add(bar);
    const r = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.16, 0.28),
      new THREE.MeshBasicMaterial({ color: 0xff2020 }));
    r.position.set(-0.28, 1.75, -L * 0.06); g.add(r);
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.16, 0.28),
      new THREE.MeshBasicMaterial({ color: 0x2040ff }));
    b.position.set(0.28, 1.75, -L * 0.06); g.add(b);
    g.userData.lightR = r; g.userData.lightB = b;
  }
  // headlights + taillights
  const hl = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  const tl = new THREE.MeshBasicMaterial({ color: 0xff2a2a });
  for (const sx of [-0.65, 0.65]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.06), hl);
    h.position.set(sx, 0.6, L / 2 + 0.02); g.add(h);
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.16, 0.06), tl);
    t.position.set(sx, 0.6, -L / 2 - 0.02); g.add(t);
  }
  // wheels
  const wheels = [];
  for (const [wx, wz] of [[-0.95, L / 2 - 0.9], [0.95, L / 2 - 0.9], [-0.95, -L / 2 + 0.9], [0.95, -L / 2 + 0.9]]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.3, 12), tyreMat);
    w.rotation.z = Math.PI / 2; w.position.set(wx, 0.38, wz); g.add(w); wheels.push(w);
  }
  g.userData.wheels = wheels;
  return g;
}

export function spawnCar(scene, def, x, z, yaw, isPolice = false) {
  const mesh = buildCarMesh(def, isPolice);
  mesh.position.set(x, 0, z); mesh.rotation.y = yaw;
  scene.add(mesh);
  return {
    mesh, def, isPolice,
    pos: mesh.position, yaw, speed: 0, steer: 0,
    ai: null, // traffic AI state when set
    skid: 0, engine: 0,
  };
}

// Arcade driving: W accel, S brake/reverse, A/D steer. Returns speed km/h.
export function driveCar(car, input, dt, colliders, skidMarks) {
  const def = car.def;
  let throttle = 0;
  if (input.keys.has('KeyW')) throttle = 1;
  if (input.keys.has('KeyS')) throttle = -1;
  const steerIn = (input.keys.has('KeyA') ? 1 : 0) - (input.keys.has('KeyD') ? 1 : 0);
  const targetSteer = steerIn * 0.55 * clamp(Math.abs(car.speed) / 6, 0.25, 1);
  car.steer = lerp(car.steer, targetSteer, 1 - Math.pow(0.001, dt));
  if (throttle > 0) car.speed += def.accel * dt;
  else if (throttle < 0) car.speed -= (car.speed > 0.5 ? 26 : 10) * dt;
  else car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 8 * dt);
  car.speed = clamp(car.speed, -10, def.max);
  car.yaw += car.steer * (car.speed / def.max) * 1.9 * dt * (car.speed >= 0 ? 1 : -1);
  const nx = car.pos.x + Math.sin(car.yaw) * car.speed * dt;
  const nz = car.pos.z + Math.cos(car.yaw) * car.speed * dt;
  if (!hitsAny(nx, nz, 1.6, colliders)) { car.pos.x = nx; car.pos.z = nz; }
  else { car.speed *= 0.35; }
  car.mesh.rotation.y = car.yaw;
  car.mesh.position.set(car.pos.x, 0, car.pos.z);
  // wheel spin + body roll + skid marks when hard turning at speed
  for (const w of car.mesh.userData.wheels) w.rotation.x += car.speed * dt * 2.2;
  car.mesh.rotation.z = -car.steer * 0.06 * clamp(Math.abs(car.speed) / 10, 0, 1);
  if (Math.abs(car.steer) > 0.4 && Math.abs(car.speed) > 12 && skidMarks) {
    skidMarks.add(car.pos.x - Math.sin(car.yaw) * 1.8, car.pos.z - Math.cos(car.yaw) * 1.8, car.yaw);
  }
  car.engine = clamp(Math.abs(car.speed) / def.max, 0, 1);
  return Math.abs(car.speed) * 3.6;
}

// Chase camera behind the car.
export function carCamera(car, camera, dt) {
  const back = 10.5, up = 4.2;
  const tx = car.pos.x - Math.sin(car.yaw) * back;
  const tz = car.pos.z - Math.cos(car.yaw) * back;
  camera.position.x = lerp(camera.position.x, tx, 1 - Math.pow(0.0005, dt));
  camera.position.y = lerp(camera.position.y, up, 1 - Math.pow(0.001, dt));
  camera.position.z = lerp(camera.position.z, tz, 1 - Math.pow(0.0005, dt));
  camera.lookAt(car.pos.x + Math.sin(car.yaw) * 6, 1.4, car.pos.z + Math.cos(car.yaw) * 6);
}
function lerp(a, b, t) { return a + (b - a) * t; }
