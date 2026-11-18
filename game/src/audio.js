// audio.js — 100% synthesised WebAudio: engine hum, gunshot, punch, siren,
// jingles and a sunset bass-line loop. No audio files, no network.
export function createAudio() {
  const a = {
    ctx: null, master: null, muted: false, musicOn: false,
    engineOsc: null, engineGain: null, sirenOsc: null, sirenGain: null,
    init() {
      if (this.ctx) return;
      try {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.master = this.ctx.createGain(); this.master.gain.value = 0.4;
        this.master.connect(this.ctx.destination);
        // engine: sawtooth + lowpass, pitch follows speed
        this.engineOsc = this.ctx.createOscillator(); this.engineOsc.type = 'sawtooth';
        this.engineOsc.frequency.value = 55;
        const lp = this.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420;
        this.engineGain = this.ctx.createGain(); this.engineGain.gain.value = 0;
        this.engineOsc.connect(lp); lp.connect(this.engineGain); this.engineGain.connect(this.master);
        this.engineOsc.start();
        // siren: two-tone triangle
        this.sirenOsc = this.ctx.createOscillator(); this.sirenOsc.type = 'triangle';
        this.sirenOsc.frequency.value = 720;
        this.sirenGain = this.ctx.createGain(); this.sirenGain.gain.value = 0;
        this.sirenOsc.connect(this.sirenGain); this.sirenGain.connect(this.master);
        this.sirenOsc.start();
      } catch (e) { /* audio unavailable: game stays silent */ }
    },
    resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); },
    setEngine(level, driving) {
      if (!this.ctx) return;
      this.engineGain.gain.value = driving ? 0.05 + level * 0.09 : 0;
      this.engineOsc.frequency.value = 55 + level * 130;
    },
    setSiren(on, phase) {
      if (!this.ctx) return;
      this.sirenGain.gain.value = on ? 0.035 : 0;
      this.sirenOsc.frequency.value = Math.sin(phase) > 0 ? 720 : 960;
    },
    blip(freq, dur, type = 'sine', vol = 0.15) {
      if (!this.ctx) return;
      const o = this.ctx.createOscillator(), g = this.ctx.createGain();
      o.type = type; o.frequency.value = freq;
      g.gain.setValueAtTime(vol, this.ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
      o.connect(g); g.connect(this.master);
      o.start(); o.stop(this.ctx.currentTime + dur);
    },
    noise(dur, vol, freq = 1200) {
      if (!this.ctx) return;
      const len = Math.floor(this.ctx.sampleRate * dur);
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = this.ctx.createBufferSource(); src.buffer = buf;
      const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq;
      const g = this.ctx.createGain(); g.gain.value = vol;
      src.connect(f); f.connect(g); g.connect(this.master); src.start();
    },
    playShot() { this.noise(0.14, 0.5, 3200); this.blip(160, 0.1, 'square', 0.2); },
    playPunch() { this.noise(0.08, 0.3, 500); },
    playThud() { this.blip(90, 0.25, 'sine', 0.25); },
    playBlip() { this.blip(880, 0.12, 'sine', 0.18); },
    playJingle() {
      if (!this.ctx) return;
      [523, 659, 784, 1046].forEach((f, i) =>
        setTimeout(() => this.blip(f, 0.22, 'triangle', 0.2), i * 110));
    },
    playSkid() { this.noise(0.2, 0.08, 900); },
    startMusic() {
      if (!this.ctx || this.musicOn) return;
      this.musicOn = true;
      // sunset groove: Am – F – C – G bass line, 96 BPM, soft triangle bass + hat ticks
      const bass = [55, 43.65, 65.41, 49];
      let step = 0;
      const tick = () => {
        if (!this.ctx) return;
        const bar = Math.floor(step / 8) % 4;
        if (step % 2 === 0) this.blip(bass[bar] * 2, 0.22, 'triangle', 0.12);
        if (step % 4 === 2) this.noise(0.03, 0.05, 6000);
        step++;
        setTimeout(tick, 312);
      };
      tick();
    },
  };
  return a;
}
