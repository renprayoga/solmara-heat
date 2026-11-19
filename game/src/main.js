// main.js — SOLMARA HEAT boot + game loop.
// Wires city, player, vehicles, traffic, police, missions, combat, HUD, audio.
// ?shot=cover|street|drive|mission stages a deterministic screenshot scene.
// Exposes window.__solmara (state for tests) and window.__shotReady.
import * as THREE from 'three';
import { buildCity, makeBeacon, WORLD } from './city.js';
import { createPlayer, updatePlayer } from './player.js';
import { spawnCar, driveCar, carCamera, CAR_DEFS } from './vehicles.js';
import { createTraffic, updateTraffic } from './traffic.js';
import { createPolice, updatePolice, addWanted, spawnPoliceCar } from './police.js';
import { createMissions, startMission, updateMissions, advanceDialog, missionObjectivePos } from './missions.js';
import { createCombat, updateCombat, playerShoot, playerPunch, spawnThugs } from './combat.js';
import { createHud } from './hud.js';
import { createAudio } from './audio.js';
import { stageShot } from './shots.js';
import { clamp, dist2d } from './util.js';

const SAVE_KEY = 'solmara-heat-save-v1';
const params = new URLSearchParams(window.location.search);
const shotParam = params.get('shot');

// ---------- renderer / scene ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
document.getElementById('app').appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1200);
camera.position.set(-40, 8, 145);

// sunset lighting
const sun = new THREE.DirectionalLight(0xffb36b, 2.4);
sun.position.set(-180, 140, -220);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -200; sun.shadow.camera.right = 200;
sun.shadow.camera.top = 200; sun.shadow.camera.bottom = -200;
sun.shadow.camera.far = 700;
scene.add(sun);
scene.add(new THREE.HemisphereLight(0x8a6ab0, 0x3a2a1a, 1.25));
const amb = new THREE.AmbientLight(0xff9a5a, 0.4); scene.add(amb);

// ---------- world ----------
const city = buildCity(scene);
const colliders = city.colliders;
const buildings = [];
for (const b of colliders) buildings.push({ x: (b.minX + b.maxX) / 2, z: (b.minZ + b.maxZ) / 2 });

// ---------- game state ----------
const game = {
  state: 'menu', // menu | playing | paused | busted
  dialogOpen: false, shotReady: false, helpOpen: false,
  hud: createHud(), audio: createAudio(),
  player: null, police: null, missions: null, combat: null, traffic: null,
  parked: [], car: null, inCar: false,
  clock: 18 * 60 + 40, // 18:40 sunset
  particles: null, skidMarks: null,
  beacon: null,
};
game.player = createPlayer(scene);
game.police = createPolice(scene);
game.missions = createMissions(scene, game);
game.combat = createCombat(scene, game);
game.combat.spawnThugs = (x, z, n, k) => spawnThugs(game.combat, x, z, n, k);
game.traffic = createTraffic(scene, city);
game.particles = createParticles(scene);
game.skidMarks = createSkidMarks(scene);

// parked (stealable) cars along roads
const parkSpots = [
  [-30, 30, Math.PI / 2, 0], [30, -90, 0, 1], [-90, -30, -Math.PI / 2, 2],
  [90, 30, Math.PI / 2, 3], [-30, -90, Math.PI / 2, 4], [150, 90, 0, 5],
  [30, 18, Math.PI / 2, 1], [-150, 90, 0, 0],
];
for (const [x, z, yaw, di] of parkSpots) {
  game.parked.push(spawnCar(scene, CAR_DEFS[di], x, z, yaw));
}
// Rico NPC at the pier (mission 1)
const rico = makeNpc(scene, 0x2a4a8a, -40, 168);
const mara = makeNpc(scene, 0x6a1a3a, 0, 0); mara.group.visible = false;

function makeNpc(scene, color, x, z) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.85 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xd8a070, roughness: 0.8 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.05, 0.5), mat);
  body.position.y = 1.25; g.add(body);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.52, 0.46), skin);
  head.position.y = 2.05; g.add(head);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.85, 0.36),
    new THREE.MeshStandardMaterial({ color: 0x22222e }));
  legL.position.set(-0.22, 0.45, 0); g.add(legL);
  const legR = legL.clone(); legR.position.x = 0.22; g.add(legR);
  g.position.set(x, 0, z); scene.add(g);
  return { group: g, x, z };
}

// ---------- particles & skid marks ----------
function createParticles(scene) {
  const N = 120;
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(N * 3);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({ size: 0.7, color: 0xffcc66, transparent: true, opacity: 0.9, depthWrite: false });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false; scene.add(pts);
  const parts = Array.from({ length: N }, () => ({ life: 0, x: 0, y: -10, z: 0, vx: 0, vy: 0, vz: 0 }));
  return {
    burst(x, y, z, color, n = 12) {
      let c = 0;
      for (const p of parts) {
        if (p.life > 0) continue;
        p.life = 0.7; p.x = x; p.y = y; p.z = z;
        p.vx = (Math.random() - 0.5) * 7; p.vy = Math.random() * 5 + 1; p.vz = (Math.random() - 0.5) * 7;
        if (++c >= n) break;
      }
      mat.color.setHex(color);
    },
    update(dt) {
      for (let i = 0; i < N; i++) {
        const p = parts[i];
        if (p.life > 0) {
          p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.vy -= 12 * dt;
          if (p.y < 0.05) { p.y = 0.05; p.vy = 0; }
        }
        pos[i * 3] = p.x; pos[i * 3 + 1] = p.life > 0 ? p.y : -10; pos[i * 3 + 2] = p.z;
      }
      geo.attributes.position.needsUpdate = true;
    },
  };
}
function createSkidMarks(scene) {
  const marks = [];
  const mat = new THREE.MeshBasicMaterial({ color: 0x0a0a0a, transparent: true, opacity: 0.55 });
  return {
    add(x, z, yaw) {
      if (marks.length > 60) { const old = marks.shift(); scene.remove(old); }
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 1.6), mat);
      m.rotation.x = -Math.PI / 2; m.rotation.z = -yaw;
      m.position.set(x, 0.06, z); scene.add(m); marks.push(m);
    },
  };
}

// ---------- input ----------
const input = { keys: new Set(), jumpQueued: false, consumeJump() { const j = this.jumpQueued; this.jumpQueued = false; return j; } };
let dragging = false, lastMX = 0, lastMY = 0;
window.addEventListener('keydown', e => {
  if (e.code === 'Space') { input.jumpQueued = true; e.preventDefault(); }
  input.keys.add(e.code);
  if (e.code === 'KeyE') onInteract();
  if (e.code === 'KeyF') { if (game.state === 'playing' && !game.inCar) playerPunch(game.combat, game.player); }
  if (e.code === 'Digit1') { game.player.weapon = 'fist'; game.toast('Tinju'); }
  if (e.code === 'Digit2') { game.player.weapon = 'gun'; game.toast('Pistol — klik untuk menembak'); }
  if (e.code === 'KeyH') { toggleHelp(); return; }
  if (e.code === 'KeyM') { game.audio.muted = !game.audio.muted; if (game.audio.master) game.audio.master.gain.value = game.audio.muted ? 0 : 0.4; }
  if (e.code === 'KeyP' || e.code === 'Escape') {
    if (game.helpOpen) { closeHelp(); return; }
    togglePause();
  }
  if (e.code === 'Enter' && game.dialogOpen) advanceDialog(game.missions);
});
window.addEventListener('keyup', e => input.keys.delete(e.code));
renderer.domElement.addEventListener('mousedown', e => {
  if (game.state !== 'playing') return;
  if (game.dialogOpen) { advanceDialog(game.missions); return; }
  if (e.button === 0) {
    if (game.inCar) return;
    if (game.player.weapon === 'gun') playerShoot(game.combat, game.player, camera);
    else playerPunch(game.combat, game.player);
  }
  dragging = true; lastMX = e.clientX; lastMY = e.clientY;
});
window.addEventListener('mouseup', () => { dragging = false; });
window.addEventListener('mousemove', e => {
  if (!dragging || game.state !== 'playing') return;
  const dx = e.clientX - lastMX, dy = e.clientY - lastMY;
  lastMX = e.clientX; lastMY = e.clientY;
  game.player.camYaw -= dx * 0.004;
  game.player.camPitch = clamp(game.player.camPitch + dy * 0.003, -0.2, 0.9);
});
renderer.domElement.addEventListener('click', () => {
  if (game.state === 'playing' && !game.dialogOpen && document.pointerLockElement !== renderer.domElement) {
    renderer.domElement.requestPointerLock?.();
  }
});
document.addEventListener('pointerlockchange', () => {
  dragging = document.pointerLockElement === renderer.domElement;
});
document.addEventListener('mousemove', e => {
  if (document.pointerLockElement === renderer.domElement && game.state === 'playing') {
    game.player.camYaw -= e.movementX * 0.0028;
    game.player.camPitch = clamp(game.player.camPitch + e.movementY * 0.002, -0.2, 0.9);
  }
});
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---------- actions ----------
function nearestParked(maxD = 4) {
  let best = null, bd = maxD;
  for (const c of game.parked) {
    const d = dist2d(game.player.pos.x, game.player.pos.z, c.pos.x, c.pos.z);
    if (d < bd) { bd = d; best = c; }
  }
  return best;
}
function onInteract() {
  if (game.state !== 'playing') return;
  if (game.dialogOpen) { advanceDialog(game.missions); return; }
  if (game.inCar) { exitCar(); return; }
  const car = nearestParked();
  if (car) { enterCar(car); return; }
  // mission talk spots
  if (game.missions.active && game.missions.index === 0 && game.missions.stage === 0 &&
    dist2d(game.player.pos.x, game.player.pos.z, -40, 168) < 5) {
    // already handled by mission goto
  }
}
game.enterCar = function (car) { enterCar(car); };
game.spawnPoliceCar = (x, z, yaw) => spawnPoliceCar(game.police, scene, x, z, yaw);
function enterCar(car) {
  game.parked.splice(game.parked.indexOf(car), 1);
  game.car = car; game.inCar = true;
  game.player.group.visible = false;
  game.audio.playBlip();
  game.toast('Mobil dicuri: ' + car.def.name + ' — polisi tidak suka ini!');
  addWanted(game.police, 25, 'steal');
  game.hud.showWantedFlash(true);
  setTimeout(() => game.hud.showWantedFlash(false), 1200);
}
function exitCar() {
  if (!game.car) return;
  game.parked.push(game.car);
  game.player.pos.set(game.car.pos.x + 2.5, 0, game.car.pos.z);
  game.player.group.visible = true;
  game.car.speed = 0; game.car = null; game.inCar = false;
}
game.placeBeaconAt = function (x, z) {
  if (game.beacon) { scene.remove(game.beacon); game.beacon = null; }
  game.beacon = makeBeacon(0xffd23f);
  game.beacon.position.set(x, 0, z);
  scene.add(game.beacon);
};
game.toast = t => game.hud.toast(t);
game.saveGame = saveGame;
game.hud = game.hud;

function toggleHelp() {
  if (game.helpOpen) { closeHelp(); return; }
  if (game.state !== 'playing' && game.state !== 'paused') return;
  game.helpOpen = true;
  game.state = 'paused'; // freeze the world while the help overlay is open
  document.getElementById('pause-screen').classList.add('hidden');
  document.getElementById('help-overlay').classList.remove('hidden');
  document.exitPointerLock?.();
}
function closeHelp() {
  if (!game.helpOpen) return;
  game.helpOpen = false;
  document.getElementById('help-overlay').classList.add('hidden');
  if (game.state === 'paused') {
    game.state = 'playing';
    document.getElementById('pause-screen').classList.add('hidden');
  }
}
game.toggleHelp = toggleHelp;
game.closeHelp = closeHelp;

function togglePause() {
  if (game.state === 'playing') {
    game.state = 'paused';
    document.getElementById('pause-screen').classList.remove('hidden');
    document.getElementById('pause-stats').textContent =
      `Uang: $${Math.floor(game.player.money)} · Misi: ${game.missions.index + 1}/4 · Bintang: ${game.police.wanted} · Kesehatan: ${Math.ceil(game.player.health)}%`;
    document.exitPointerLock?.();
  } else if (game.state === 'paused') {
    game.state = 'playing';
    document.getElementById('pause-screen').classList.add('hidden');
  }
}

function onBusted(kind) {
  if (game.state !== 'playing') return;
  if (game.inCar) exitCar();
  game.state = 'busted';
  const fine = Math.min(200, Math.floor(game.player.money * 0.4));
  game.player.money -= fine;
  game.police.heat = 0; game.police.wanted = 0;
  game.player.health = 100;
  game.player.pos.set(-40, 0, 128);
  document.getElementById('end-title').textContent = kind === 'down' ? 'KAMU TUMBANG!' : 'TERTANGKAP!';
  document.getElementById('end-text').textContent = kind === 'down'
    ? `Dario dilarikan ke rumah sakit Solmara. Denda medis $${fine}. Bangkit dan lanjutkan misimu.`
    : `Polisi Solmara menangkapmu. Denda $${fine} dan mobil disita. Rico menjaminmu keluar — jangan ulangi.`;
  document.getElementById('end-screen').classList.remove('hidden');
  document.getElementById('hud').classList.add('hidden');
  document.exitPointerLock?.();
  saveGame();
}

function saveGame() {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({
      money: game.player.money, health: game.player.health,
      mission: game.missions.index, x: game.player.pos.x, z: game.player.pos.z,
      time: Date.now(),
    }));
    const el = document.getElementById('save-info');
    if (el) el.textContent = 'Save tersimpan.';
  } catch { /* storage off */ }
}
function loadSave() {
  try {
    const s = JSON.parse(window.localStorage.getItem(SAVE_KEY) || 'null');
    return s && typeof s.money === 'number' ? s : null;
  } catch { return null; }
}

function startGame(skipIntro) {
  game.audio.init(); game.audio.resume(); game.audio.startMusic();
  document.getElementById('start-screen').classList.add('hidden');
  document.getElementById('end-screen').classList.add('hidden');
  document.getElementById('hud').classList.remove('hidden');
  game.state = 'playing';
  if (!skipIntro && !game.missions.started) startMission(game.missions, 0);
  else if (!game.missions.started) {
    game.missions.started = true;
    game.hud.setObjective('JELAJAHI SOLMARA', 'Tekan E di dekat mobil untuk mencuri · kerjakan misi Rico');
  }
}
game.startGame = startGame;

// ---------- buttons ----------
document.getElementById('btn-help-close').addEventListener('click', closeHelp);
document.getElementById('btn-start').addEventListener('click', () => startGame(false));
document.getElementById('btn-resume').addEventListener('click', togglePause);
document.getElementById('btn-save').addEventListener('click', () => { saveGame(); game.toast('Game disimpan!'); });
document.getElementById('btn-restart').addEventListener('click', () => location.reload());
document.getElementById('btn-retry').addEventListener('click', () => {
  document.getElementById('end-screen').classList.add('hidden');
  document.getElementById('hud').classList.remove('hidden');
  game.state = 'playing';
});
const saved = loadSave();
if (saved) {
  const b = document.getElementById('btn-continue');
  b.classList.remove('hidden');
  document.getElementById('save-info').textContent =
    `Save ditemukan: $${Math.floor(saved.money)}, misi ${saved.mission + 1}/4.`;
  b.addEventListener('click', () => {
    game.player.money = saved.money; game.player.health = saved.health || 100;
    game.player.pos.set(saved.x, 0, saved.z);
    startGame(true);
    startMission(game.missions, Math.min(saved.mission, 3));
  });
}

// ---------- main loop ----------
let last = performance.now();
let minimapTick = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  const playing = game.state === 'playing';
  const frozen = game.dialogOpen || !playing;

  if (playing && !game.dialogOpen) {
    // clock advances (1 game-min per 2 real-sec)
    game.clock = (game.clock + dt * 0.5) % (24 * 60);
    if (game.inCar && game.car) {
      if (game.holdW) input.keys.add('KeyW'); // screenshot scenes keep accelerating
      const kmh = driveCar(game.car, input, dt, colliders, game.skidMarks);
      carCamera(game.car, camera, dt);
      game.audio.setEngine(game.car.engine, true);
      game.hud.setSpeed(kmh, true);
      game.hud.showCrosshair(false);
      // hitting pedestrians / traffic at speed raises wanted
      for (const p of game.traffic.peds) {
        if (dist2d(game.car.pos.x, game.car.pos.z, p.x, p.z) < 2 && Math.abs(game.car.speed) > 6) {
          p.panic = 3; addWanted(game.police, 15, 'hit');
        }
      }
    } else {
      updatePlayer(game.player, input, dt, colliders, camera);
      game.audio.setEngine(0, false);
      game.hud.setSpeed(0, false);
      game.hud.showCrosshair(game.player.weapon === 'gun');
    }
    updateTraffic(game.traffic, dt, colliders, game.inCar ? game.car.pos : game.player.pos,
      game.inCar ? Math.abs(game.car.speed) : game.player.speed);
    updatePolice(game.police, scene, dt, game.player, game.inCar, game.car, colliders, onBusted);
    updateMissions(game.missions, dt, { player: game.player, inCar: game.inCar, car: game.car, enemies: game.combat.enemies, game });
    updateCombat(game.combat, dt, game.player, game.inCar);
    game.particles.update(dt);
    // prompt: steal car / interact
    if (!game.inCar) {
      const car = nearestParked();
      if (car) game.hud.showPrompt(`Tekan E — curi ${car.def.name}`);
      else game.hud.hidePrompt();
    } else game.hud.hidePrompt();
    // health regen slowly when not wanted
    if (game.police.wanted === 0 && game.player.health < 100) game.player.health = Math.min(100, game.player.health + 2 * dt);
    if (game.player.health <= 0 && game.police.wanted === 0) onBusted('down');
    game.audio.setSiren(game.police.wanted > 0, game.police.sirenPhase);
    // tower beacon pulse
    const beacon = scene.getObjectByName('towerBeacon');
    if (beacon) beacon.material.color.setHex(Math.sin(now / 300) > 0 ? 0xff4040 : 0x881111);
  } else if (game.state === 'menu') {
    // slow cinematic orbit around the tower for the start screen backdrop
    const t = now / 1000;
    camera.position.set(Math.sin(t * 0.08) * 120, 45 + Math.sin(t * 0.05) * 8, Math.cos(t * 0.08) * 120);
    camera.lookAt(0, 20, 0);
    updateTraffic(game.traffic, dt, colliders, game.player.pos, 0);
  }

  // HUD refresh (cheap, every frame; minimap every ~150 ms)
  if (game.state !== 'menu') {
    game.hud.setStars(game.police.wanted);
    game.hud.setCash(game.player.money);
    game.hud.setHealth(game.player.health);
    game.hud.el.clock.textContent = fmtClock(game.clock);
    minimapTick += dt;
    if (minimapTick > 0.15) {
      minimapTick = 0;
      const obj = missionObjectivePos(game.missions);
      game.hud.drawMinimap({
        px: game.inCar ? game.car.pos.x : game.player.pos.x,
        pz: game.inCar ? game.car.pos.z : game.player.pos.z,
        yaw: game.inCar ? -game.car.yaw : -game.player.yaw,
        buildings, cars: [...game.traffic.cars, ...game.parked].map(c => ({ x: c.pos.x, z: c.pos.z })),
        police: game.police.cars.map(c => ({ x: c.pos.x, z: c.pos.z })),
        enemies: game.combat.enemies.map(e => ({ x: e.x, z: e.z })),
        objective: obj,
      });
      // objective arrow (screen-top compass)
      const arrow = game.hud.el.arrow;
      if (obj) {
        const dx = obj.x - game.player.pos.x, dz = obj.z - game.player.pos.z;
        const ang = Math.atan2(dx, dz) - game.player.camYaw;
        arrow.style.transform = `translateX(-50%) rotate(${ang}rad)`;
        arrow.style.display = 'block';
      } else arrow.style.display = 'none';
    }
  }
  renderer.render(scene, camera);
}
function fmtClock(mins) {
  const h = Math.floor(mins / 60) % 24, m = Math.floor(mins % 60);
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
}

// ---------- test hooks ----------
window.__solmara = game;
window.__shotReady = false;
Object.defineProperty(window, '__shotReady', {
  get() { return game.shotReady; },
  set(v) { game.shotReady = v; },
  configurable: true,
});

if (shotParam) {
  // deterministic screenshot scene: boot, stage, render
  stageShot(game, shotParam);
} else {
  // menu backdrop: render behind the start screen
  game.hud.el.hud.classList.add('hidden');
}
requestAnimationFrame(frame);
