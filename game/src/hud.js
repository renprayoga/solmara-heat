// hud.js — DOM HUD: stars, cash, health, minimap canvas, objective, prompts,
// toasts, dialogue, damage flash. The minimap is a 2D canvas (no extra assets).
export function createHud() {
  const $ = id => document.getElementById(id);
  return {
    el: { stars: $('stars'), cash: $('cash'), healthBar: $('health-bar'), healthNum: $('health-num'),
      minimap: $('minimap'), clock: $('clock'), missionTitle: $('mission-title'),
      missionObj: $('mission-obj'), missionDist: $('mission-dist'), speedo: $('speedo'),
      speedNum: $('speed-num'), crosshair: $('crosshair'), toast: $('toast'),
      prompt: $('prompt'), arrow: $('objective-arrow'), wantedFlash: $('wanted-flash'),
      dialog: $('dialog'), dialogName: $('dialog-name'), dialogText: $('dialog-text'),
      hud: $('hud') },
    toastTimer: 0,
    setStars(n) {
      let s = '';
      for (let i = 0; i < 5; i++) s += i < n ? '★' : '<span class="dim">★</span>';
      this.el.stars.innerHTML = s;
    },
    setCash(m) { this.el.cash.textContent = '$' + Math.floor(m).toLocaleString('en-US'); },
    setHealth(h) {
      this.el.healthBar.style.width = Math.max(0, h) + '%';
      this.el.healthNum.textContent = Math.ceil(Math.max(0, h));
      this.el.healthBar.style.background = h > 50 ? 'linear-gradient(90deg,#4aff7a,#a8ff5a)'
        : h > 25 ? 'linear-gradient(90deg,#ffb52e,#ff7a3d)' : 'linear-gradient(90deg,#ff3b3b,#ff7a3d)';
    },
    setObjective(title, text) { this.el.missionTitle.textContent = title; this.el.missionObj.textContent = text; },
    setDistance(t) { this.el.missionDist.textContent = t; },
    setSpeed(kmh, driving) {
      this.el.speedo.classList.toggle('hidden', !driving);
      if (driving) this.el.speedNum.textContent = Math.round(kmh);
    },
    showCrosshair(on) { this.el.crosshair.classList.toggle('hidden', !on); },
    showPrompt(text) { this.el.prompt.textContent = text; this.el.prompt.style.display = 'block'; },
    hidePrompt() { this.el.prompt.style.display = 'none'; },
    toast(text, ms = 2600) {
      this.el.toast.textContent = text;
      this.el.toast.style.opacity = '1';
      clearTimeout(this.toastTimer);
      this.toastTimer = setTimeout(() => { this.el.toast.style.opacity = '0'; }, ms);
    },
    showDialog(name, text) {
      this.el.dialog.classList.remove('hidden');
      this.el.dialogName.textContent = name;
      this.el.dialogText.textContent = text;
    },
    hideDialog() { this.el.dialog.classList.add('hidden'); },
    flashDamage() {
      document.body.style.boxShadow = 'inset 0 0 120px rgba(255,0,0,.55)';
      setTimeout(() => { document.body.style.boxShadow = ''; }, 180);
    },
    showWantedFlash(on) { this.el.wantedFlash.classList.toggle('hidden', !on); },
    // Minimap: roads grid, beach, player arrow, cars, police, objective, north.
    drawMinimap(state) {
      const c = this.el.minimap.getContext('2d');
      const S = 200, R = 170; // world radius shown
      c.clearRect(0, 0, S, S);
      c.save();
      c.beginPath(); c.arc(100, 100, 98, 0, Math.PI * 2); c.clip();
      c.fillStyle = '#0c1a2e'; c.fillRect(0, 0, S, S);
      const px = x => 100 + (x - state.px) * (S / 2 / R);
      const py = z => 100 + (z - state.pz) * (S / 2 / R);
      // beach + sea
      c.fillStyle = '#e8cf9a'; c.fillRect(0, py(156), S, S);
      c.fillStyle = '#1d7fa8'; c.fillRect(0, py(201), S, S);
      // roads
      c.strokeStyle = '#5a6270'; c.lineWidth = 7;
      for (let i = 0; i <= 5; i++) {
        const cc = -150 + i * 60;
        c.beginPath(); c.moveTo(px(cc), 0); c.lineTo(px(cc), S); c.stroke();
        c.beginPath(); c.moveTo(0, py(cc)); c.lineTo(S, py(cc)); c.stroke();
      }
      // buildings as dots
      c.fillStyle = '#8a96a8';
      for (const b of state.buildings) c.fillRect(px(b.x) - 2, py(b.z) - 2, 4, 4);
      // objective beacon
      if (state.objective) {
        c.fillStyle = '#ffd23f';
        c.beginPath(); c.arc(px(state.objective.x), py(state.objective.z), 7, 0, Math.PI * 2); c.fill();
        c.strokeStyle = '#ffd23f'; c.lineWidth = 2;
        c.beginPath(); c.arc(px(state.objective.x), py(state.objective.z), 11, 0, Math.PI * 2); c.stroke();
      }
      // traffic cars (white), police (blue/red), enemies (red)
      for (const car of state.cars) { c.fillStyle = '#fff'; c.fillRect(px(car.x) - 2, py(car.z) - 2, 4, 4); }
      for (const car of state.police) { c.fillStyle = '#4080ff'; c.beginPath(); c.arc(px(car.x), py(car.z), 4, 0, Math.PI * 2); c.fill(); }
      for (const e of state.enemies) { c.fillStyle = '#ff4030'; c.beginPath(); c.arc(px(e.x), py(e.z), 3, 0, Math.PI * 2); c.fill(); }
      // player arrow (rotates with facing)
      c.save();
      c.translate(100, 100); c.rotate(state.yaw);
      c.fillStyle = '#ffd23f';
      c.beginPath(); c.moveTo(0, -9); c.lineTo(6, 7); c.lineTo(0, 3); c.lineTo(-6, 7); c.closePath(); c.fill();
      c.restore();
      c.restore();
      // north arrow
      c.fillStyle = '#fff'; c.font = 'bold 13px sans-serif'; c.textAlign = 'center';
      c.fillText('U', 100, 14);
      c.beginPath(); c.moveTo(100, 28); c.lineTo(96, 20); c.lineTo(104, 20); c.closePath(); c.fill();
    },
  };
}
