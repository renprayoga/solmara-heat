// player.js — Dario Voss on foot: third-person character, WASD + mouse camera,
// run, jump, punch. Built from boxes; no external assets.
import * as THREE from 'three';
import { clamp, tryMove, angleLerp } from './util.js';

export function createPlayer(scene) {
  const g = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: 0xc98a5e, roughness: 0.8 });
  const shirt = new THREE.MeshStandardMaterial({ color: 0xd84a2a, roughness: 0.85 });
  const pants = new THREE.MeshStandardMaterial({ color: 0x2a3550, roughness: 0.9 });
  const hair = new THREE.MeshStandardMaterial({ color: 0x1a1210, roughness: 1 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.85, 1.05, 0.45), shirt);
  body.position.y = 1.25; g.add(body);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.45), skin);
  head.position.y = 2.05; g.add(head);
  const hairM = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.18, 0.48), hair);
  hairM.position.y = 2.32; g.add(hairM);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.85, 0.36), pants);
  legL.position.set(-0.22, 0.45, 0); g.add(legL);
  const legR = legL.clone(); legR.position.x = 0.22; g.add(legR);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.9, 0.3), shirt);
  armL.position.set(-0.58, 1.25, 0); g.add(armL);
  const armR = armL.clone(); armR.position.x = 0.58; g.add(armR);
  scene.add(g);
  return {
    group: g, legL, legR, armL, armR,
    pos: new THREE.Vector3(-40, 0, 128), // near the pier / beach start
    vel: new THREE.Vector3(),
    yaw: Math.PI, camYaw: Math.PI, camPitch: 0.32,
    onGround: true, vy: 0, speed: 0, walkPhase: 0,
    health: 100, money: 250, weapon: 'fist', // 'fist' | 'gun'
    punchTimer: 0, punchCooldown: 0,
  };
}

export function updatePlayer(p, input, dt, colliders, camera) {
  const run = input.keys.has('ShiftLeft') || input.keys.has('ShiftRight');
  const base = run ? 9.5 : 5.2;
  let fx = 0, fz = 0;
  if (input.keys.has('KeyW')) fz -= 1;
  if (input.keys.has('KeyS')) fz += 1;
  if (input.keys.has('KeyA')) fx -= 1;
  if (input.keys.has('KeyD')) fx += 1;
  const moving = fx !== 0 || fz !== 0;
  // movement is relative to camera yaw
  const sin = Math.sin(p.camYaw), cos = Math.cos(p.camYaw);
  const mx = (fx * cos - fz * sin), mz = (fx * sin + fz * cos);
  const len = Math.hypot(mx, mz) || 1;
  const tx = (mx / len) * base * (moving ? 1 : 0);
  const tz = (mz / len) * base * (moving ? 1 : 0);
  p.vel.x = lerp(p.vel.x, tx, 1 - Math.pow(0.0001, dt));
  p.vel.z = lerp(p.vel.z, tz, 1 - Math.pow(0.0001, dt));
  tryMove(p.pos, p.vel.x * dt, p.vel.z * dt, 0.6, colliders);
  p.speed = Math.hypot(p.vel.x, p.vel.z);
  if (moving) {
    p.yaw = angleLerp(p.yaw, Math.atan2(p.vel.x, p.vel.z), 1 - Math.pow(0.001, dt));
    p.walkPhase += dt * p.speed * 1.6;
  }
  // jump
  if (input.consumeJump() && p.onGround) { p.vy = 7.5; p.onGround = false; }
  if (!p.onGround) {
    p.vy -= 22 * dt; p.pos.y += p.vy * dt;
    if (p.pos.y <= 0) { p.pos.y = 0; p.vy = 0; p.onGround = true; }
  }
  p.group.position.copy(p.pos);
  p.group.rotation.y = p.yaw;
  // walk swing
  const sw = moving ? Math.sin(p.walkPhase) * 0.55 : 0;
  p.legL.rotation.x = sw; p.legR.rotation.x = -sw;
  p.armL.rotation.x = -sw * 0.8; p.armR.rotation.x = sw * 0.8;
  // punch animation
  if (p.punchTimer > 0) {
    p.punchTimer -= dt;
    p.armR.rotation.x = -1.6 * Math.sin((p.punchTimer / 0.28) * Math.PI);
  }
  p.punchCooldown = Math.max(0, p.punchCooldown - dt);
  // third-person camera
  const camDist = 7.5, camH = 3.2;
  const cx = p.pos.x + Math.sin(p.camYaw) * camDist;
  const cz = p.pos.z + Math.cos(p.camYaw) * camDist;
  const cy = p.pos.y + camH + Math.sin(p.camPitch) * 5;
  camera.position.set(cx, cy, cz);
  camera.lookAt(p.pos.x, p.pos.y + 1.8, p.pos.z);
}
function lerp(a, b, t) { return a + (b - a) * t; }
