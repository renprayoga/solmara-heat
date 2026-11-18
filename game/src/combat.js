// combat.js — punch + pistol combat vs thug enemies (guards / Mara's crew).
// Enemies chase and attack; the player shoots (click) or punches (F).
import * as THREE from 'three';
import { clamp, dist2d, angleLerp } from './util.js';

export function createCombat(scene, game) {
  return { scene, game, enemies: [], bullets: [], muzzle: 0, shootCooldown: 0 };
}

export function spawnThugs(c, x, z, count, kind) {
  for (let i = 0; i < count; i++) {
    const g = new THREE.Group();
    const shirt = new THREE.MeshStandardMaterial({ color: kind === 'mara' ? 0x1a1a22 : 0x5a4a2a, roughness: 0.85 });
    const skin = new THREE.MeshStandardMaterial({ color: 0xb07a4e, roughness: 0.8 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.05, 0.5), shirt);
    body.position.y = 1.25; g.add(body);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.52, 0.46), skin);
    head.position.y = 2.05; g.add(head);
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.85, 0.36),
      new THREE.MeshStandardMaterial({ color: 0x22222e }));
    legL.position.set(-0.22, 0.45, 0); g.add(legL);
    const legR = legL.clone(); legR.position.x = 0.22; g.add(legR);
    const armL = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.9, 0.3), shirt);
    armL.position.set(-0.6, 1.25, 0); g.add(armL);
    const armR = armL.clone(); armR.position.x = 0.6; g.add(armR);
    // HP bar sprite above head
    const hpBg = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.16),
      new THREE.MeshBasicMaterial({ color: 0x330000, transparent: true, opacity: 0.8 }));
    hpBg.position.y = 2.6; g.add(hpBg);
    const hpFg = new THREE.Mesh(new THREE.PlaneGeometry(1.36, 0.12),
      new THREE.MeshBasicMaterial({ color: 0x40ff60 }));
    hpFg.position.set(0, 2.6, 0.01); g.add(hpFg);
    g.position.set(x + (Math.random() * 8 - 4), 0, z + (Math.random() * 8 - 4));
    c.scene.add(g);
    c.enemies.push({ group: g, legL, legR, armR, hpFg, hp: 100, maxHp: 100,
      x: g.position.x, z: g.position.z, yaw: 0, phase: Math.random() * 6,
      attackCd: 0, kind });
  }
}

// Player attacks: click shoots (gun), F punches.
export function playerShoot(c, player, camera) {
  if (c.shootCooldown > 0 || player.weapon !== 'gun') return;
  c.shootCooldown = 0.28;
  c.muzzle = 0.08;
  c.game.audio.playShot();
  // Shoot flat from the player's chest toward where the camera faces:
  // the camera looks down at the player, so its raw ray would pass under enemies.
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  dir.y = 0; dir.normalize();
  const origin = new THREE.Vector3(player.pos.x, player.pos.y + 1.5, player.pos.z);
  // hitscan: nearest enemy within a generous cone of the aim direction
  let best = null, bestD = 60;
  for (const e of c.enemies) {
    const to = new THREE.Vector3(e.x - origin.x, 0, e.z - origin.z);
    const d = to.length();
    if (d > 60 || d < 0.5) continue;
    const ang = to.normalize().angleTo(dir);
    if (ang < 0.3 && d < bestD) { best = e; bestD = d; }
  }
  if (best) damageEnemy(c, best, 34);
  // tracer line
  const end = best ? new THREE.Vector3(best.x, 1.4, best.z)
    : origin.clone().add(dir.clone().multiplyScalar(50));
  const geo = new THREE.BufferGeometry().setFromPoints([origin, end]);
  const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe9a0, transparent: true, opacity: 0.9 }));
  c.scene.add(line);
  c.bullets.push({ line, life: 0.09 });
}

export function playerPunch(c, player) {
  if (player.punchCooldown > 0) return;
  player.punchCooldown = 0.45; player.punchTimer = 0.28;
  c.game.audio.playPunch();
  for (const e of [...c.enemies]) {
    const d = dist2d(player.pos.x, player.pos.z, e.x, e.z);
    if (d < 2.2) damageEnemy(c, e, 25);
  }
}

function damageEnemy(c, e, dmg) {
  e.hp -= dmg;
  e.group.position.y = 0.15; // hit jolt
  c.game.particles.burst(e.x, 1.5, e.z, 0xff5040, 10);
  if (e.hp <= 0) {
    c.scene.remove(e.group);
    c.enemies.splice(c.enemies.indexOf(e), 1);
    c.game.missions.fightKills++;
    c.game.audio.playThud();
    c.game.toast('Musuh tumbang!');
  }
}

export function updateCombat(c, dt, player, inCar) {
  c.shootCooldown = Math.max(0, c.shootCooldown - dt);
  c.muzzle = Math.max(0, c.muzzle - dt);
  for (const b of [...c.bullets]) {
    b.life -= dt;
    if (b.life <= 0) { c.scene.remove(b.line); c.bullets.splice(c.bullets.indexOf(b), 1); }
  }
  // enemies chase the player and punch when close
  for (const e of c.enemies) {
    const dx = player.pos.x - e.x, dz = player.pos.z - e.z;
    const d = Math.hypot(dx, dz) || 1;
    e.yaw = angleLerp(e.yaw, Math.atan2(dx, dz), 1 - Math.pow(0.01, dt));
    let sp = 0;
    if (!inCar) sp = d > 1.6 ? 4.6 : 0;
    e.x += Math.sin(e.yaw) * sp * dt;
    e.z += Math.cos(e.yaw) * sp * dt;
    e.phase += dt * 8;
    e.group.position.set(e.x, 0, e.z);
    e.group.rotation.y = e.yaw;
    e.legL.rotation.x = Math.sin(e.phase) * 0.55;
    e.legR.rotation.x = -Math.sin(e.phase) * 0.55;
    e.armR.rotation.x = d < 2 ? -1.4 : 0;
    e.hpFg.scale.x = clamp(e.hp / e.maxHp, 0, 1);
    e.hpFg.position.x = -(1.36 * (1 - e.hp / e.maxHp)) / 2;
    e.hpFg.material.color.setHex(e.hp > 50 ? 0x40ff60 : e.hp > 25 ? 0xffc040 : 0xff4030);
    e.attackCd -= dt;
    if (d < 1.9 && e.attackCd <= 0 && !inCar) {
      e.attackCd = 0.9;
      player.health = Math.max(0, player.health - 8);
      c.game.audio.playPunch();
      c.game.hud.flashDamage();
    }
  }
}
