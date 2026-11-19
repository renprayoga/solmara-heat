// police.js — wanted level (1–5 stars) + police AI.
// Crimes raise wanted; police cars chase and ram, foot cops chase on foot.
// Getting caught (busted) costs cash and resets wanted. Hiding lowers it.
import * as THREE from 'three';
import { clamp, dist2d, angleLerp } from './util.js';
import { spawnCar } from './vehicles.js';

const POLICE_DEF = { name: 'Interceptor Patroli', color: 0x1a1d24, top: 26, accel: 20, max: 36, len: 4.4 };

export function createPolice(scene) {
  return {
    wanted: 0, heat: 0, // heat 0..100 feeds the star count
    cars: [], cops: [],
    bustTimer: 0, hideTimer: 0, sirenPhase: 0,
    spawnCooldown: 0,
  };
}

export function spawnPoliceCar(pol, scene, x, z, yaw) {
  const car = spawnCar(scene, POLICE_DEF, x, z, yaw, true);
  car.ai = { chase: true };
  pol.cars.push(car);
  return car;
}

export function addWanted(pol, amount, reason) {
  pol.heat = clamp(pol.heat + amount, 0, 100);
  const stars = Math.ceil(pol.heat / 20);
  if (stars > pol.wanted) {
    pol.wanted = stars;
    return stars;
  }
  pol.wanted = stars;
  return stars;
}

export function updatePolice(pol, scene, dt, player, inCar, playerCar, colliders, onBusted) {
  const target = inCar ? playerCar.pos : player.pos;
  const speed = inCar ? Math.abs(playerCar.speed) : player.speed;
  // heat decay while hidden (slow and far from police, or in a car at low speed)
  const nearest = pol.cars.length ? Math.min(...pol.cars.map(c => dist2d(c.pos.x, c.pos.z, target.x, target.z))) : 999;
  if (pol.wanted > 0) {
    if (nearest > 60 && speed < 3) pol.hideTimer += dt; else pol.hideTimer = 0;
    if (pol.hideTimer > 6) { pol.heat = Math.max(0, pol.heat - dt * 6); pol.wanted = Math.ceil(pol.heat / 20); if (pol.wanted === 0) pol.hideTimer = 0; }
  }
  pol.sirenPhase += dt * 6;
  // spawn police cars to match wanted level (max 1 + stars/2)
  const wantCars = pol.wanted === 0 ? 0 : Math.min(4, 1 + Math.floor(pol.wanted / 2));
  pol.spawnCooldown -= dt;
  if (pol.cars.length < wantCars && pol.spawnCooldown <= 0) {
    pol.spawnCooldown = 2.5;
    const a = Math.random() * Math.PI * 2;
    const car = spawnCar(scene, POLICE_DEF, target.x + Math.sin(a) * 55, target.z + Math.cos(a) * 55,
      Math.atan2(target.x - (target.x + Math.sin(a) * 55), target.z - (target.z + Math.cos(a) * 55)), true);
    car.ai = { chase: true };
    pol.cars.push(car);
  }
  // chase behaviour
  for (const car of pol.cars) {
    const dx = target.x - car.pos.x, dz = target.z - car.pos.z;
    const d = Math.hypot(dx, dz) || 1;
    const wantYaw = Math.atan2(dx, dz);
    car.yaw = angleLerp(car.yaw, wantYaw, 1 - Math.pow(0.05, dt));
    const accel = d > 12 ? 22 : (d > 5 ? 8 : -6);
    car.speed = clamp(car.speed + accel * dt, -6, 34);
    const nx = car.pos.x + Math.sin(car.yaw) * car.speed * dt;
    const nz = car.pos.z + Math.cos(car.yaw) * car.speed * dt;
    if (!hits(nx, nz, 1.6, colliders)) { car.pos.x = nx; car.pos.z = nz; }
    else car.speed *= 0.4;
    car.mesh.position.set(car.pos.x, 0, car.pos.z);
    car.mesh.rotation.y = car.yaw;
    for (const w of car.mesh.userData.wheels) w.rotation.x += car.speed * dt * 2.2;
    // flashing light bar
    const on = Math.sin(pol.sirenPhase) > 0;
    if (car.mesh.userData.lightR) {
      car.mesh.userData.lightR.material.color.setHex(on ? 0xff2020 : 0x550000);
      car.mesh.userData.lightB.material.color.setHex(on ? 0x000055 : 0x2040ff);
    }
    // ram the player car
    if (inCar && d < 3.2 && Math.abs(car.speed) > 4) {
      playerCar.speed *= 0.82;
      if (player.health !== undefined) player.health = Math.max(0, player.health - 1);
    }
  }
  // remove police cars when wanted is gone
  if (pol.wanted === 0) {
    for (const c of pol.cars) { scene.remove(c.mesh); }
    pol.cars.length = 0;
  }
  // foot cops at wanted >= 2: spawn near player, chase on foot
  const wantCops = pol.wanted >= 2 ? Math.min(3, pol.wanted - 1) : 0;
  if (pol.cops.length < wantCops && pol.spawnCooldown <= 0) {
    pol.spawnCooldown = 2;
    const g = makeCop(scene);
    const a = Math.random() * Math.PI * 2;
    g.position.set(target.x + Math.sin(a) * 22, 0, target.z + Math.cos(a) * 22);
    pol.cops.push({ group: g, x: g.position.x, z: g.position.z, yaw: 0, phase: 0 });
  }
  for (const cop of pol.cops) {
    const dx = target.x - cop.x, dz = target.z - cop.z;
    const d = Math.hypot(dx, dz) || 1;
    cop.yaw = angleLerp(cop.yaw, Math.atan2(dx, dz), 1 - Math.pow(0.01, dt));
    const sp = d > 2 ? 6.5 : 0;
    cop.x += Math.sin(cop.yaw) * sp * dt; cop.z += Math.cos(cop.yaw) * sp * dt;
    cop.phase += dt * 9;
    cop.group.position.set(cop.x, 0, cop.z);
    cop.group.rotation.y = cop.yaw;
    cop.group.userData.legL.rotation.x = Math.sin(cop.phase) * 0.6;
    cop.group.userData.legR.rotation.x = -Math.sin(cop.phase) * 0.6;
    // caught on foot: player slow and cop touching -> busted
    if (!inCar && d < 1.6 && player.speed < 2) {
      pol.bustTimer += dt;
      if (pol.bustTimer > 1.2) { onBusted('cop'); pol.bustTimer = 0; }
    } else {
      pol.bustTimer = 0;
      if (!inCar && d < 1.6) player.health = Math.max(0, player.health - 12 * dt);
    }
  }
  if (pol.wanted === 0) {
    for (const c of pol.cops) scene.remove(c.group);
    pol.cops.length = 0;
  }
  if (pol.wanted > 0 && player.health <= 0) onBusted('down');
}

function makeCop(scene) {
  const g = new THREE.Group();
  const navy = new THREE.MeshStandardMaterial({ color: 0x1a2a4a, roughness: 0.8 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xc98a5e, roughness: 0.8 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.85, 1.05, 0.45), navy);
  body.position.y = 1.25; g.add(body);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.45), skin);
  head.position.y = 2.05; g.add(head);
  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.14, 0.5),
    new THREE.MeshStandardMaterial({ color: 0x0e1a30 }));
  cap.position.y = 2.32; g.add(cap);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.85, 0.36), navy);
  legL.position.set(-0.22, 0.45, 0); g.add(legL);
  const legR = legL.clone(); legR.position.x = 0.22; g.add(legR);
  g.userData.legL = legL; g.userData.legR = legR;
  scene.add(g);
  return g;
}
function hits(x, z, r, boxes) {
  for (const b of boxes) {
    const cx = clamp(x, b.minX, b.maxX), cz = clamp(z, b.minZ, b.maxZ);
    const dx = x - cx, dz = z - cz;
    if (dx * dx + dz * dz < r * r) return true;
  }
  return false;
}
