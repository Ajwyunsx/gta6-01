// audio.js — every sound in the game is synthesised at runtime with the Web Audio API.
// No files: an engine hum that follows the car's speed, pistol cracks, sirens that
// sweep, pickup blips, and a slow synthwave loop under it all.

export class Sound {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.engine = null;
    this.siren = null;
    this.muted = false;
    this.musicTimer = 0;
    this.step = 0;
    this.started = false;
  }

  // Browsers require a gesture before audio may start, so main.js calls this on the
  // first click or keypress.
  ensure() {
    if (this.started) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.55;
    this.master.connect(this.ctx.destination);
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.32;
    this.musicGain.connect(this.master);
    this.started = true;
  }

  resume() {
    this.ensure();
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  setMuted(muted) {
    this.muted = muted;
    this.ensure();
    if (!this.master) return;
    this.master.gain.setTargetAtTime(muted ? 0 : 0.55, this.ctx.currentTime, 0.05);
  }

  noiseBuffer(seconds = 0.2) {
    const rate = this.ctx.sampleRate;
    const len = Math.floor(rate * seconds);
    const buffer = this.ctx.createBuffer(1, len, rate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  gunshot(volume = 1) {
    this.ensure();
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer(0.12);
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1800;
    bp.Q.value = 0.8;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.5 * volume, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.11);
    src.connect(bp).connect(g).connect(this.master);
    src.start(t);
    src.stop(t + 0.13);
    // A low thump under it.
    const osc = this.ctx.createOscillator();
    const og = this.ctx.createGain();
    osc.frequency.setValueAtTime(180, t);
    osc.frequency.exponentialRampToValueAtTime(50, t + 0.09);
    og.gain.setValueAtTime(0.28 * volume, t);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    osc.connect(og).connect(this.master);
    osc.start(t);
    osc.stop(t + 0.11);
  }

  pickup(kind = 'cash') {
    this.ensure();
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const freqs = kind === 'cash' ? [660, 990] : kind === 'health' ? [520, 780] : [440, 660];
    freqs.forEach((f, i) => {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = f;
      g.gain.setValueAtTime(0, t + i * 0.06);
      g.gain.linearRampToValueAtTime(0.22, t + i * 0.06 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.06 + 0.16);
      osc.connect(g).connect(this.master);
      osc.start(t + i * 0.06);
      osc.stop(t + i * 0.06 + 0.18);
    });
  }

  missionChime() {
    this.ensure();
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = f;
      g.gain.setValueAtTime(0, t + i * 0.09);
      g.gain.linearRampToValueAtTime(0.2, t + i * 0.09 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.09 + 0.5);
      osc.connect(g).connect(this.master);
      osc.start(t + i * 0.09);
      osc.stop(t + i * 0.09 + 0.55);
    });
  }

  explosion() {
    this.ensure();
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer(0.7);
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(900, t);
    lp.frequency.exponentialRampToValueAtTime(80, t + 0.6);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.5, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.7);
    src.connect(lp).connect(g).connect(this.master);
    src.start(t);
    src.stop(t + 0.75);
  }

  horn() {
    this.ensure();
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    for (const f of [392, 466]) {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.value = f;
      g.gain.setValueAtTime(0.12, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.34);
      osc.connect(g).connect(this.master);
      osc.start(t);
      osc.stop(t + 0.36);
    }
  }

  crash(strength = 1) {
    this.ensure();
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer(0.2);
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 1200;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.22 * strength, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    src.connect(hp).connect(g).connect(this.master);
    src.start(t);
    src.stop(t + 0.2);
  }

  // The engine is a running oscillator pair whose pitch follows speed; created once
  // and retuned every frame.
  startEngine() {
    this.ensure();
    if (!this.ctx || this.engine) return;
    const osc = this.ctx.createOscillator();
    const sub = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    sub.type = 'square';
    osc.frequency.value = 60;
    sub.frequency.value = 30;
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    filter.Q.value = 3;
    gain.gain.value = 0;
    osc.connect(filter);
    sub.connect(filter);
    filter.connect(gain).connect(this.master);
    osc.start();
    sub.start();
    this.engine = { osc, sub, filter, gain };
  }

  engineSpeed(speed, throttle) {
    if (!this.engine || !this.ctx) return;
    const t = this.ctx.currentTime;
    const s = Math.min(1, Math.abs(speed) / 620);
    const f = 52 + s * 150 + (throttle > 0 ? 12 : 0);
    this.engine.osc.frequency.setTargetAtTime(f, t, 0.08);
    this.engine.sub.frequency.setTargetAtTime(f * 0.5, t, 0.08);
    this.engine.filter.frequency.setTargetAtTime(320 + s * 900, t, 0.1);
    this.engine.gain.gain.setTargetAtTime(0.05 + s * 0.1, t, 0.1);
  }

  engineOff() {
    if (!this.engine || !this.ctx) return;
    this.engine.gain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.2);
  }

  updateSiren(active, phase) {
    this.ensure();
    if (!this.ctx) return;
    if (!active) {
      if (this.siren) {
        this.siren.gain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.2);
        this.siren = null;
      }
      return;
    }
    if (!this.siren) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 600;
      gain.gain.value = 0;
      osc.connect(gain).connect(this.master);
      osc.start();
      gain.gain.setTargetAtTime(0.09, this.ctx.currentTime, 0.3);
      this.siren = { osc, gain };
    }
    const t = this.ctx.currentTime;
    this.siren.osc.frequency.setTargetAtTime(560 + Math.sin(phase) * 140, t, 0.05);
  }

  // A slow synthwave bed: padded chords, a bass pulse and a lazy arpeggio.
  updateMusic(dt, intensity = 0) {
    this.ensure();
    if (!this.ctx || this.muted) return;
    this.musicTimer -= dt;
    if (this.musicTimer > 0) return;
    this.musicTimer = 0.62;
    const t = this.ctx.currentTime;
    const roots = [55, 43.65, 49, 41.2]; // A1 F1 G1 E1
    const chords = [
      [220, 261.63, 329.63],
      [174.61, 220, 261.63],
      [196, 246.94, 293.66],
      [164.81, 207.65, 246.94],
    ];
    const bar = Math.floor(this.step / 4) % 4;
    // Bass pulse on every beat.
    const bass = this.ctx.createOscillator();
    const bg = this.ctx.createGain();
    bass.type = 'sawtooth';
    bass.frequency.value = roots[bar];
    bg.gain.setValueAtTime(0, t);
    bg.gain.linearRampToValueAtTime(0.18 + intensity * 0.08, t + 0.02);
    bg.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 340;
    bass.connect(lp).connect(bg).connect(this.musicGain);
    bass.start(t);
    bass.stop(t + 0.55);

    // Arpeggio on the off-beats.
    const arp = chords[bar][this.step % 3];
    const lead = this.ctx.createOscillator();
    const lg = this.ctx.createGain();
    lead.type = 'triangle';
    lead.frequency.value = arp * 2;
    lg.gain.setValueAtTime(0, t);
    lg.gain.linearRampToValueAtTime(0.07, t + 0.03);
    lg.gain.exponentialRampToValueAtTime(0.001, t + 0.42);
    lead.connect(lg).connect(this.musicGain);
    lead.start(t);
    lead.stop(t + 0.45);

    // A pad now and then.
    if (this.step % 8 === 0) {
      for (const f of chords[bar]) {
        const pad = this.ctx.createOscillator();
        const pg = this.ctx.createGain();
        pad.type = 'sine';
        pad.frequency.value = f;
        pg.gain.setValueAtTime(0, t);
        pg.gain.linearRampToValueAtTime(0.035, t + 0.4);
        pg.gain.linearRampToValueAtTime(0, t + 2.4);
        pad.connect(pg).connect(this.musicGain);
        pad.start(t);
        pad.stop(t + 2.5);
      }
    }
    this.step++;
  }
}
