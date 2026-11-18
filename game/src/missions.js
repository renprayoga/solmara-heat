// missions.js — story: 4 chained missions for Dario Voss in Solmara.
// Rico Marlowe (fixer), Mara Kade (harbour boss), the Solmara crew.
// Each mission: dialogue -> objective(s) -> reward. Progression: cash + unlocks.
import * as THREE from 'three';
import { dist2d } from './util.js';
import { makeBeacon } from './city.js';

export const MISSIONS = [
  {
    id: 1, title: 'MISI 1 — PAKET UNTUK RICO',
    brief: 'Rico menunggumu di dermaga. Ambil paketnya, antar ke gudang pelabuhan.',
    dialog: [
      ['RICO MARLOWE', 'Dario! Akhirnya bebas juga. Dengar — paket ini harus sampai ke gudang pelabuhan sebelum matahari tenggelam. Jangan bikin keributan.'],
      ['DARIO VOSS', 'Santai, Rico. Aku cuma kurir. Paket apa ini, sih?'],
      ['RICO MARLOWE', 'Yang kamu tidak perlu tahu. Jalan kaki saja, mobil menarik perhatian. Marker kuning di minimap — ikuti itu.'],
    ],
    stages: [
      { type: 'goto', text: 'Temui Rico di dermaga', pos: [-40, 168], radius: 4 },
      { type: 'goto', text: 'Antar paket ke gudang pelabuhan', pos: [-60, 170], radius: 5 },
    ],
    reward: 400,
  },
  {
    id: 2, title: 'MISI 2 — KABUR DARI POLISI',
    brief: 'Paket itu milik Mara Kade — dan polisi sudah menciummu. Curi mobil dan kabur!',
    dialog: [
      ['RICO MARLOWE', 'Sial. Seseorang memberi tahu polisi. Mereka sudah dalam perjalanan!'],
      ['DARIO VOSS', 'Aku baru keluar penjara, Rico. Aku tidak akan kembali ke sana.'],
      ['RICO MARLOWE', 'Curi mobil apa pun di jalan — tekan E di dekat mobil. Lalu kabur sampai bintangmu hilang. Aku menunggumu di taman kota.'],
    ],
    stages: [
      { type: 'steal', text: 'Curi sebuah mobil (tekan E di dekat mobil)', pos: null, radius: 0 },
      { type: 'escape', text: 'Kabur! Hilangkan bintang buronanmu', pos: null, radius: 0 },
      { type: 'goto', text: 'Temui Rico di taman kota', pos: [90, -30], radius: 5 },
    ],
    reward: 600,
  },
  {
    id: 3, title: 'MISI 3 — MOBIL UNTUK MARA',
    brief: 'Mara Kade ingin Vortex GT oranye di parkiran menara. Ambil — paksa kalau perlu.',
    dialog: [
      ['MARA KADE', 'Jadi ini Dario yang terkenal itu. Aku butuh Vortex GT oranye di parkiran Menara Solmara. Pemiliknya tidak akan menyerah begitu saja.'],
      ['DARIO VOSS', 'Dan kalau dia melawan?'],
      ['MARA KADE', 'Maka dia belajar. Bawa mobilnya ke bengkelku di ujung barat. Lakukan dengan bersih.'],
    ],
    stages: [
      { type: 'goto', text: 'Ke parkiran Menara Solmara', pos: [30, 30], radius: 6 },
      { type: 'fight', text: 'Hadapi penjaga parkiran (klik / F untuk menyerang)', pos: [30, 30], radius: 0, count: 2 },
      { type: 'deliver', text: 'Bawa Vortex GT ke bengkel Mara', pos: [-150, 90], radius: 6, needCar: 'Vortex GT' },
    ],
    reward: 900,
  },
  {
    id: 4, title: 'MISI 4 — PERTEMUAN TERAKHIR DI ATAP',
    brief: 'Mara mengkhianatimu. Naik ke atap menara, hadapi anak buahnya, akhiri ini.',
    dialog: [
      ['RICO MARLOWE', 'Dario, jangan pergi! Mara yang memberi tahu polisi soal paket itu. Dia menjebakmu sejak awal!'],
      ['DARIO VOSS', 'Kalau begitu aku akhiri malam ini. Di atap menara. Dia atau aku.'],
      ['MARA KADE', 'Kamu datang juga. Anak buahku menunggumu di tangga atap. Mari lihat seberapa hebat kurir jalanan ini.'],
    ],
    stages: [
      { type: 'goto', text: 'Ke pintu Menara Solmara', pos: [30, 0], radius: 5 },
      { type: 'fight', text: 'Kalahkan anak buah Mara di atap', pos: [30, 0], radius: 0, count: 3 },
      { type: 'goto', text: 'Hadapi Mara di atap menara', pos: [30, -30], radius: 5 },
    ],
    reward: 1500,
  },
];

export function createMissions(scene, game) {
  return {
    index: 0, stage: 0, active: false, started: false,
    beacon: null, dialogQueue: [], dialogIdx: 0, dialogCb: null,
    fightSpawned: false, fightKills: 0, fightTotal: 0,
    escapeTimer: 0, stolen: false,
    scene, game,
  };
}

export function startMission(m, idx) {
  const def = MISSIONS[idx];
  m.index = idx; m.stage = 0; m.active = true; m.started = true;
  m.fightSpawned = false; m.fightKills = 0; m.escapeTimer = 0; m.stolen = false;
  showDialog(m, def.dialog, () => setStage(m));
  m.game.toast(def.title);
  m.game.audio.playJingle();
}

function showDialog(m, lines, cb) {
  m.dialogQueue = lines; m.dialogIdx = 0; m.dialogCb = cb;
  m.game.hud.showDialog(lines[0][0], lines[0][1]);
  m.game.dialogOpen = true;
}
export function advanceDialog(m) {
  m.dialogIdx++;
  if (m.dialogIdx >= m.dialogQueue.length) {
    m.game.hud.hideDialog(); m.game.dialogOpen = false;
    const cb = m.dialogCb; m.dialogCb = null; if (cb) cb();
  } else {
    const [name, text] = m.dialogQueue[m.dialogIdx];
    m.game.hud.showDialog(name, text);
  }
}

function setStage(m) {
  const def = MISSIONS[m.index], st = def.stages[m.stage];
  if (m.beacon) { m.scene.remove(m.beacon); m.beacon = null; }
  if (st && st.pos) {
    m.beacon = makeBeacon(0xffd23f);
    m.beacon.position.set(st.pos[0], 0, st.pos[1]);
    m.scene.add(m.beacon);
  }
  m.game.hud.setObjective(def.title, st ? st.text : 'Selesai!');
}

export function missionObjectivePos(m) {
  const def = MISSIONS[m.index];
  if (!m.active || !def) return null;
  const st = def.stages[m.stage];
  return st && st.pos ? { x: st.pos[0], z: st.pos[1] } : null;
}

export function updateMissions(m, dt, ctx) {
  // ctx: {player, inCar, car, enemies, game}
  if (!m.active) return;
  const def = MISSIONS[m.index];
  const st = def.stages[m.stage];
  if (!st) return;
  const p = ctx.player;
  // effective position: the car when driving, the player on foot otherwise
  const pp = ctx.inCar && ctx.car ? ctx.car.pos : p.pos;
  if (m.beacon) {
    m.beacon.userData.arrow.rotation.y += dt * 2;
    m.beacon.userData.ring.scale.setScalar(1 + Math.sin(performance.now() / 300) * 0.12);
  }
  if (st.type === 'goto') {
    const d = dist2d(pp.x, pp.z, st.pos[0], st.pos[1]);
    m.game.hud.setDistance(Math.round(d) + ' m');
    if (d < st.radius) completeStage(m, ctx);
  } else if (st.type === 'steal') {
    m.game.hud.setDistance('');
    if (ctx.inCar && !m.stolen) { m.stolen = true; completeStage(m, ctx); }
  } else if (st.type === 'escape') {
    m.game.hud.setDistance(ctx.game.police.wanted > 0 ? 'Bintang: ' + ctx.game.police.wanted : 'Bersih!');
    if (ctx.game.police.wanted === 0 && m.stolen) {
      m.escapeTimer += dt;
      if (m.escapeTimer > 2) completeStage(m, ctx);
    } else m.escapeTimer = 0;
  } else if (st.type === 'fight') {
    if (!m.fightSpawned) {
      m.fightSpawned = true; m.fightTotal = st.count;
      ctx.game.combat.spawnThugs(st.pos[0], st.pos[1], st.count, m.index === 3 ? 'mara' : 'guard');
      m.game.toast('Musuh datang! Kalahkan ' + st.count + ' orang!');
    }
    m.game.hud.setDistance(m.fightKills + ' / ' + m.fightTotal + ' dikalahkan');
    if (m.fightKills >= m.fightTotal) completeStage(m, ctx);
  } else if (st.type === 'deliver') {
    const d = ctx.inCar ? dist2d(ctx.car.pos.x, ctx.car.pos.z, st.pos[0], st.pos[1]) : 9999;
    m.game.hud.setDistance(ctx.inCar ? Math.round(d) + ' m' : 'Butuh mobil!');
    if (ctx.inCar && d < st.radius) {
      if (!st.needCar || ctx.car.def.name === st.needCar) completeStage(m, ctx);
      else m.game.toast('Mara mau ' + st.needCar + ', bukan mobil ini!');
    }
  }
}

function completeStage(m, ctx) {
  m.stage++;
  m.game.audio.playBlip();
  const def = MISSIONS[m.index];
  if (m.stage >= def.stages.length) {
    completeMission(m, ctx);
  } else {
    m.fightSpawned = false;
    setStage(m);
  }
}

function completeMission(m, ctx) {
  const def = MISSIONS[m.index];
  if (m.beacon) { m.scene.remove(m.beacon); m.beacon = null; }
  m.active = false;
  ctx.player.money += def.reward;
  m.game.saveGame();
  m.game.toast('MISI SELESAI! +' + def.reward + ' $');
  m.game.audio.playJingle();
  showDialog(m, [['RICO MARLOWE', missionEndLine(m.index)]], () => {
    if (m.index + 1 < MISSIONS.length) startMission(m, m.index + 1);
    else {
      m.game.hud.setObjective('SOLMARA HEAT — TAMAT', 'Kamu bebas. Solmara milikmu sekarang.');
      showDialog(m, [['DARIO VOSS', 'Mara tumbang. Rico tersenyum. Matahari terbenam di Solmara — dan untuk pertama kalinya, kota ini terasa seperti rumah.']], null);
    }
  });
}

function missionEndLine(i) {
  return [
    'Paket sampai. Mara senang — untuk sekarang. Istirahatlah, besok ada pekerjaan lain.',
    'Kamu lolos! Polisi kehilangan jejakmu. Mara mulai percaya padamu.',
    'Mobilnya sudah di bengkel. Mara bilang kamu "punya nyali". Hati-hati, Dario — itu bukan pujian.',
    'Selesai. Mara tidak akan mengganggumu lagi. Solmara akhirnya milikmu, Dario.',
  ][i];
}
