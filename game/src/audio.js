// Palm City — the sound of the city, synthesised on the fly with WebAudio. No files, no
// network: every engine, siren, gunshot and pickup is built from oscillators and noise.
(function (global) {
  'use strict';

  const PC = global.PC;

  function makeAudio() {
    const A = {
      ctx: null,
      master: null,
      muted: false,
      engine: null,
      siren: null,
      ready: false,
    };

    A.start = function start() {
      if (A.ctx) {
        if (A.ctx.state === 'suspended') A.ctx.resume();
        return;
      }
      const Ctx = global.AudioContext || global.webkitAudioContext;
      if (!Ctx) return;
      A.ctx = new Ctx();
      A.master = A.ctx.createGain();
      A.master.gain.value = 0.5;
      A.master.connect(A.ctx.destination);
      A.ready = true;
      A.buildLoops();
    };

    /** A noise buffer, reused by gunshots and impacts. */
    function noiseBuffer(seconds) {
      const len = Math.floor(A.ctx.sampleRate * seconds);
      const buf = A.ctx.createBuffer(1, len, A.ctx.sampleRate);
      const data = buf.getChannelData(0);
      let last = 0;
      for (let i = 0; i < len; i++) {
        const white = Math.random() * 2 - 1;
        last = (last + 0.02 * white) / 1.02;
        data[i] = last * 3.2;
      }
      return buf;
    }

    /** Engine and siren run as continuous voices whose pitch the game steers. */
    A.buildLoops = function buildLoops() {
      if (!A.ready) return;
      // Engine: two saws an octave apart through a low-pass.
      const eg = A.ctx.createGain();
      eg.gain.value = 0;
      const filter = A.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 620;
      const o1 = A.ctx.createOscillator();
      o1.type = 'sawtooth';
      o1.frequency.value = 60;
      const o2 = A.ctx.createOscillator();
      o2.type = 'square';
      o2.frequency.value = 30;
      const g2 = A.ctx.createGain();
      g2.gain.value = 0.35;
      o1.connect(filter);
      o2.connect(g2).connect(filter);
      filter.connect(eg).connect(A.master);
      o1.start();
      o2.start();
      A.engine = { gain: eg, filter, osc: o1, osc2: o2 };

      // Siren: a triangle sweeping between two tones, gated by gain.
      const sg = A.ctx.createGain();
      sg.gain.value = 0;
      const so = A.ctx.createOscillator();
      so.type = 'triangle';
      so.frequency.value = 720;
      const lfo = A.ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = 0.9;
      const lfoGain = A.ctx.createGain();
      lfoGain.gain.value = 210;
      lfo.connect(lfoGain).connect(so.frequency);
      so.connect(sg).connect(A.master);
      so.start();
      lfo.start();
      A.siren = { gain: sg, osc: so, lfo };
    };

    /** Steer the engine note from the car's speed; 0 gain when on foot. */
    A.engineLevel = function engineLevel(speed01, audible) {
      if (!A.ready || !A.engine) return;
      const t = A.ctx.currentTime;
      const target = audible ? 0.055 + speed01 * 0.075 : 0;
      A.engine.gain.gain.setTargetAtTime(target, t, 0.12);
      A.engine.osc.frequency.setTargetAtTime(52 + speed01 * 130, t, 0.1);
      A.engine.osc2.frequency.setTargetAtTime(26 + speed01 * 62, t, 0.1);
      A.engine.filter.frequency.setTargetAtTime(500 + speed01 * 1400, t, 0.1);
    };

    /** Siren on when a cruiser is near and lit. */
    A.sirenLevel = function sirenLevel(level) {
      if (!A.ready || !A.siren) return;
      const t = A.ctx.currentTime;
      A.siren.gain.gain.setTargetAtTime(level * 0.05, t, 0.2);
      A.siren.lfo.frequency.setTargetAtTime(0.7 + level * 0.5, t, 0.2);
    };

    /** A gunshot: a short noise burst with a fast decay and a low thump under it. */
    A.shot = function shot(strength) {
      if (!A.ready || A.muted) return;
      const t = A.ctx.currentTime;
      const src = A.ctx.createBufferSource();
      src.buffer = noiseBuffer(0.18);
      const bp = A.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 1500;
      bp.Q.value = 0.9;
      const g = A.ctx.createGain();
      g.gain.setValueAtTime(0.34 * (strength ?? 1), t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
      src.connect(bp).connect(g).connect(A.master);
      src.start(t);
      src.stop(t + 0.2);

      const thump = A.ctx.createOscillator();
      thump.type = 'sine';
      thump.frequency.setValueAtTime(180, t);
      thump.frequency.exponentialRampToValueAtTime(50, t + 0.1);
      const tg = A.ctx.createGain();
      tg.gain.setValueAtTime(0.22, t);
      tg.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
      thump.connect(tg).connect(A.master);
      thump.start(t);
      thump.stop(t + 0.14);
    };

    /** A pickup chime: two bright notes, rising. */
    A.pickup = function pickup(kind) {
      if (!A.ready || A.muted) return;
      const t = A.ctx.currentTime;
      const notes = kind === 'cash' ? [880, 1320] : kind === 'health' ? [660, 990] : [520, 780];
      notes.forEach((f, i) => {
        const o = A.ctx.createOscillator();
        o.type = 'triangle';
        o.frequency.value = f;
        const g = A.ctx.createGain();
        g.gain.setValueAtTime(0.0001, t + i * 0.07);
        g.gain.exponentialRampToValueAtTime(0.16, t + i * 0.07 + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.07 + 0.22);
        o.connect(g).connect(A.master);
        o.start(t + i * 0.07);
        o.stop(t + i * 0.07 + 0.24);
      });
    };

    /** Job done: a warm three-note cadence. */
    A.success = function success() {
      if (!A.ready || A.muted) return;
      const t = A.ctx.currentTime;
      [523.25, 659.25, 783.99].forEach((f, i) => {
        const o = A.ctx.createOscillator();
        o.type = 'sine';
        o.frequency.value = f;
        const g = A.ctx.createGain();
        g.gain.setValueAtTime(0.0001, t + i * 0.1);
        g.gain.exponentialRampToValueAtTime(0.13, t + i * 0.1 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.1 + 0.5);
        o.connect(g).connect(A.master);
        o.start(t + i * 0.1);
        o.stop(t + i * 0.1 + 0.55);
      });
    };

    /** A dull hit: body, car, wall. */
    A.impact = function impact(strength) {
      if (!A.ready || A.muted) return;
      const t = A.ctx.currentTime;
      const o = A.ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(140, t);
      o.frequency.exponentialRampToValueAtTime(48, t + 0.12);
      const g = A.ctx.createGain();
      g.gain.setValueAtTime(0.2 * (strength ?? 1), t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
      o.connect(g).connect(A.master);
      o.start(t);
      o.stop(t + 0.16);
    };

    /** Tyre squeal while the car slides. */
    A.skid = function skid(level) {
      if (!A.ready || A.muted) return;
      if (level < 0.15) return;
      const t = A.ctx.currentTime;
      const o = A.ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = 1850 + Math.random() * 120;
      const g = A.ctx.createGain();
      g.gain.setValueAtTime(0.02 * level, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
      const bp = A.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 2200;
      o.connect(bp).connect(g).connect(A.master);
      o.start(t);
      o.stop(t + 0.2);
    };

    A.setMuted = function setMuted(m) {
      A.muted = m;
      if (A.master) A.master.gain.setTargetAtTime(m ? 0 : 0.5, A.ctx.currentTime, 0.05);
    };

    return A;
  }

  // One shared instance, so any module can make a noise without holding a reference:
  // PC.Audio.shot(), PC.Audio.impact(), PC.Audio.engineLevel(...) and so on all forward to
  // the instance main.js started (and do nothing before it exists).
  PC.Audio = { makeAudio, current: null };
  for (const name of ['start', 'engineLevel', 'sirenLevel', 'shot', 'pickup', 'success', 'impact', 'skid', 'setMuted']) {
    PC.Audio[name] = function forwarded(...args) {
      const a = PC.Audio.current;
      return a ? a[name](...args) : undefined;
    };
  }
})(window);
