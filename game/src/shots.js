// shots.js — deterministic staged scenes for screenshots (?shot=cover|street|drive|mission).
// Each stages the real game state (player, wanted, traffic, objective) so the
// screenshot can be retaken exactly. Called by main.js after boot.

export function stageShot(game, shot) {
  const g = game;
  g.startGame(true); // skip start screen, no save prompt
  const set = (x, z, yaw, camYaw) => {
    g.player.pos.set(x, 0, z);
    g.player.yaw = yaw; g.player.camYaw = camYaw;
  };
  if (shot === 'cover') {
    // chase: wanted 3, driving the sport car, police on the tail, objective ahead
    g.holdW = true;
    g.enterCar(g.parked.find(c => c.def.name === 'Vortex GT') || g.parked[0]);
    g.car.pos.set(-30, 0, 60); g.car.yaw = Math.PI; g.car.speed = 18;
    g.spawnPoliceCar(-24, 35, Math.PI); // interceptor ahead-left, visible in frame
    g.player.camYaw = Math.PI;
    g.police.heat = 55; g.police.wanted = 3;
    g.missions.index = 1; g.missions.stage = 1; g.missions.active = true; g.missions.started = true;
    g.hud.setObjective('MISI 2 — KABUR DARI POLISI', 'Kabur! Hilangkan bintang buronanmu');
    g.hud.setDistance('Bintang: 3');
    g.toast('KEJAR-KEJARAN DI SOLMARA!');
  } else if (shot === 'street') {
    set(-20, 30, Math.PI * 0.9, Math.PI * 0.9);
    g.missions.index = 0; g.missions.stage = 0; g.missions.active = true; g.missions.started = true;
    g.hud.setObjective('MISI 1 — PAKET UNTUK RICO', 'Temui Rico di dermaga');
    g.hud.setDistance('142 m');
    g.placeBeaconAt(-40, 168);
    g.toast('Selamat datang di Solmara!');
  } else if (shot === 'drive') {
    g.holdW = true;
    g.enterCar(g.parked.find(c => c.def.name === 'Sunset Coupe') || g.parked[0]);
    g.car.pos.set(30, 0, -60); g.car.yaw = 0; g.car.speed = 22;
    g.player.camYaw = 0;
    g.hud.setObjective('JELAJAHI SOLMARA', 'Bebas — curi mobil, kabur, kerjakan misi');
    g.hud.setDistance('');
    g.toast('Sunset Coupe — 132 km/jam!');
  } else if (shot === 'mission') {
    // mission 3 fight at the tower car park, thugs + objective beacon
    g.player.weapon = 'gun';
    // face the thugs (-z): player yaw PI, camera behind at +z so camYaw is 0
    set(30, 44, Math.PI, 0);
    g.missions.index = 2; g.missions.stage = 1; g.missions.active = true; g.missions.started = true;
    g.missions.fightSpawned = true; g.missions.fightTotal = 2;
    g.combat.spawnThugs(30, 30, 2, 'guard');
    g.placeBeaconAt(30, 30);
    g.hud.setObjective('MISI 3 — MOBIL UNTUK MARA', 'Hadapi penjaga parkiran (klik / F untuk menyerang)');
    g.hud.setDistance('0 / 2 dikalahkan');
    g.toast('Penjaga parkiran menghadang!');
  }
  // let the world settle a couple of frames, then mark ready for the screenshot
  g.shotReady = false;
  setTimeout(() => { g.shotReady = true; }, 1200);
  window.__solmaraShot = shot;
}
