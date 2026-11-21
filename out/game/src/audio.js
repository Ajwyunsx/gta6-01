// audio.js — every sound in the game is synthesised at run time with the Web Audio API:
// the engine note follows the car's speed, the siren sweeps between two pitches, gunfire is
// a noise burst through a filter, and the bassline is scheduled on a fixed pattern.
// No audio files, no network: if the browser has no Web Audio the whole module goes quiet.
(function () {
  'use strict';
  var PC = window.PC;
  var U = PC.U;

  function AudioEngine() {
    this.ctx = null;
    this.master = null;
    this.engine = null;
    this.siren = null;
    this.musicOn = true;
    this.sfxOn = true;
    this.started = false;
    this.nextBeat = 0;
    this.beat = 0;
    this.engineGain = null;
    this.sirenGain = null;
    this.musicGain = null;
    this.sirenPhase = 0;
    this.pending = [];
  }

  AudioEngine.prototype.start = function () {
    if (this.started) return;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      this.ctx = new AC();
    } catch (e) {
      this.ctx = null;
      return;
    }
    var ctx = this.ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0.9;
    this.master.connect(ctx.destination);

    this.musicGain = ctx.createGain();
    this.musicGain.gain.value = 0.0;
    this.musicGain.connect(this.master);

    // engine: two detuned saws through a lowpass, gain driven by speed
    this.engineGain = ctx.createGain();
    this.engineGain.gain.value = 0;
    var engineFilter = ctx.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 700;
    engineFilter.Q.value = 3;
    this.engineFilter = engineFilter;
    var osc1 = ctx.createOscillator();
    var osc2 = ctx.createOscillator();
    osc1.type = 'sawtooth';
    osc2.type = 'square';
    osc1.frequency.value = 60;
    osc2.frequency.value = 90;
    osc1.connect(engineFilter);
    osc2.connect(engineFilter);
    engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.master);
    osc1.start();
    osc2.start();
    this.engineOscs = [osc1, osc2];

    // siren: one oscillator, we retune it on the beat
    this.sirenGain = ctx.createGain();
    this.sirenGain.gain.value = 0;
    var sirenFilter = ctx.createBiquadFilter();
    sirenFilter.type = 'bandpass';
    sirenFilter.frequency.value = 900;
    sirenFilter.Q.value = 6;
    var sirenOsc = ctx.createOscillator();
    sirenOsc.type = 'triangle';
    sirenOsc.frequency.value = 700;
    sirenOsc.connect(sirenFilter);
    sirenFilter.connect(this.sirenGain);
    this.sirenGain.connect(this.master);
    sirenOsc.start();
    this.sirenOsc = sirenOsc;

    this.started = true;
    this.nextBeat = ctx.currentTime + 0.4;
    for (var k = 0; k < this.pending.length; k++) this.play(this.pending[k]);
    this.pending.length = 0;
  };

  AudioEngine.prototype.resume = function () {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  };

  // ---- one-shot sounds -------------------------------------------------------
  // Each effect builds its own nodes and lets them die; nothing is cached.
  AudioEngine.prototype.play = function (spec) {
    if (!this.ctx) { this.pending.push(spec); return; }
    if (!this.sfxOn) return;
    var ctx = this.ctx;
    var t = ctx.currentTime;
    var g = ctx.createGain();
    g.connect(this.master);
    if (spec.noise) {
      var len = Math.floor(ctx.sampleRate * spec.dur);
      var buf = ctx.createBuffer(1, len, ctx.sampleRate);
      var data = buf.getChannelData(0);
      var decay = spec.decay || 1;
      for (var i = 0; i < len; i++) {
        var p = i / len;
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - p, decay);
      }
      var src = ctx.createBufferSource();
      src.buffer = buf;
      var filt = ctx.createBiquadFilter();
      filt.type = spec.filter || 'bandpass';
      filt.frequency.setValueAtTime(spec.freq || 1200, t);
      if (spec.freqEnd) filt.frequency.exponentialRampToValueAtTime(spec.freqEnd, t + spec.dur);
      filt.Q.value = spec.q || 1;
      src.connect(filt);
      filt.connect(g);
      g.gain.setValueAtTime(spec.gain || 0.3, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + spec.dur);
      src.start(t);
      src.stop(t + spec.dur + 0.02);
    } else {
      var osc = ctx.createOscillator();
      osc.type = spec.type || 'sine';
      osc.frequency.setValueAtTime(spec.freq || 440, t);
      if (spec.freqEnd) osc.frequency.exponentialRampToValueAtTime(spec.freqEnd, t + spec.dur);
      if (spec.detune) osc.detune.value = spec.detune;
      g.gain.setValueAtTime(spec.gain || 0.2, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + spec.dur);
      osc.connect(g);
      osc.start(t);
      osc.stop(t + spec.dur + 0.02);
    }
    void U;
  };

  AudioEngine.prototype.gunshot = function () {
    this.play({ noise: true, dur: 0.16, freq: 2400, freqEnd: 380, q: 1.2, gain: 0.34, decay: 2 });
    this.play({ noise: true, dur: 0.32, freq: 420, freqEnd: 90, q: 0.8, gain: 0.18, filter: 'lowpass', decay: 3 });
  };
  AudioEngine.prototype.copShot = function () {
    this.play({ noise: true, dur: 0.13, freq: 1700, freqEnd: 300, q: 1.4, gain: 0.2, decay: 2 });
  };
  AudioEngine.prototype.dryFire = function () {
    this.play({ noise: true, dur: 0.05, freq: 3200, q: 4, gain: 0.08 });
  };
  AudioEngine.prototype.punch = function () {
    this.play({ noise: true, dur: 0.11, freq: 300, freqEnd: 90, filter: 'lowpass', gain: 0.22, decay: 3 });
  };
  AudioEngine.prototype.explosion = function () {
    this.play({ noise: true, dur: 1.1, freq: 900, freqEnd: 60, filter: 'lowpass', q: 0.6, gain: 0.5, decay: 2 });
    this.play({ type: 'sine', freq: 90, freqEnd: 32, dur: 0.7, gain: 0.35 });
  };
  AudioEngine.prototype.pickup = function (kind) {
    var base = kind === 'cash' ? 620 : kind === 'health' ? 520 : 440;
    this.play({ type: 'triangle', freq: base, freqEnd: base * 1.9, dur: 0.13, gain: 0.16 });
    this.play({ type: 'sine', freq: base * 1.5, freqEnd: base * 2.6, dur: 0.18, gain: 0.1 });
  };
  AudioEngine.prototype.missionPing = function () {
    this.play({ type: 'triangle', freq: 660, dur: 0.14, gain: 0.16 });
    this.play({ type: 'triangle', freq: 990, dur: 0.2, gain: 0.12 });
  };
  AudioEngine.prototype.missionStart = function () {
    this.play({ type: 'sawtooth', freq: 180, freqEnd: 420, dur: 0.34, gain: 0.13 });
    this.play({ type: 'square', freq: 90, freqEnd: 180, dur: 0.4, gain: 0.1 });
  };
  AudioEngine.prototype.missionComplete = function () {
    var notes = [523, 659, 784, 1046];
    for (var k = 0; k < notes.length; k++) {
      this.play({ type: 'triangle', freq: notes[k], dur: 0.18, gain: 0.13, detune: 0 });
    }
  };
  AudioEngine.prototype.missionFail = function () {
    var notes = [392, 330, 262];
    for (var k = 0; k < notes.length; k++) {
      this.play({ type: 'sawtooth', freq: notes[k], freqEnd: notes[k] * 0.94, dur: 0.26, gain: 0.1 });
    }
  };
  AudioEngine.prototype.uiClick = function () {
    this.play({ type: 'square', freq: 880, dur: 0.045, gain: 0.06 });
  };
  AudioEngine.prototype.crash = function (strength) {
    this.play({ noise: true, dur: 0.26, freq: 700, freqEnd: 120, filter: 'lowpass', gain: Math.min(0.4, 0.1 + strength * 0.0016), decay: 2 });
  };
  AudioEngine.prototype.horn = function () {
    this.play({ type: 'square', freq: 330, dur: 0.28, gain: 0.1 });
    this.play({ type: 'square', freq: 415, dur: 0.28, gain: 0.08 });
  };

  // ---- continuous: engine and siren -----------------------------------------
  AudioEngine.prototype.update = function (dt, world) {
    if (!this.ctx) return;
    var ctx = this.ctx;
    var now = ctx.currentTime;

    var car = world.player.inCar;
    if (car && world.ui.screen === 'playing') {
      var load = U.clamp(car.speed / car.model.top, 0, 1);
      var rpm = 58 + load * 150 + (car.speed < 4 ? 0 : 12);
      this.engineOscs[0].frequency.setTargetAtTime(rpm, now, 0.06);
      this.engineOscs[1].frequency.setTargetAtTime(rpm * 1.5, now, 0.06);
      this.engineFilter.frequency.setTargetAtTime(420 + load * 1500, now, 0.08);
      this.engineGain.gain.setTargetAtTime(0.12 + load * 0.1, now, 0.1);
    } else {
      this.engineGain.gain.setTargetAtTime(0.0, now, 0.16);
    }

    // siren: sweep a triangle wave while the police are on the player
    var siren = world.police.sirenOn && world.ui.screen === 'playing';
    if (siren) {
      this.sirenPhase += dt * 1.9;
      var tri = Math.abs(((this.sirenPhase % 1) * 2) - 1);
      this.sirenOsc.frequency.setTargetAtTime(560 + tri * 480, now, 0.02);
      var near = 0;
      for (var k = 0; k < world.police.units.length; k++) {
        var u = world.police.units[k];
        var ux = u.car ? u.car.x : u.officer ? u.officer.x : 0;
        var uy = u.car ? u.car.y : u.officer ? u.officer.y : 0;
        var d = U.dist(ux, uy, world.player.x, world.player.y);
        if (d < 900) near = Math.max(near, 1 - d / 900);
      }
      this.sirenGain.gain.setTargetAtTime(0.03 + near * 0.1, now, 0.1);
    } else {
      this.sirenGain.gain.setTargetAtTime(0.0, now, 0.2);
    }

    if (this.musicOn && world.ui.screen === 'playing') {
      this.musicGain.gain.setTargetAtTime(0.16, now, 0.5);
      this.scheduleMusic();
    } else {
      this.musicGain.gain.setTargetAtTime(0.0, now, 0.4);
    }
  };

  // A slow, warm two-chord bass loop — the city at night, not a boss fight.
  var BASS = [55, 55, 82.4, 55, 73.4, 73.4, 98, 73.4];
  AudioEngine.prototype.scheduleMusic = function () {
    var ctx = this.ctx;
    if (!ctx) return;
    var now = ctx.currentTime;
    while (this.nextBeat < now + 0.4) {
      var freq = BASS[this.beat % BASS.length];
      var t = this.nextBeat;
      var osc = ctx.createOscillator();
      var g = ctx.createGain();
      osc.type = this.beat % 4 === 0 ? 'triangle' : 'sine';
      osc.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.55, t + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.42);
      osc.connect(g);
      g.connect(this.musicGain);
      osc.start(t);
      osc.stop(t + 0.46);
      // a soft hi-hat on the off beat
      if (this.beat % 2 === 1) {
        var len = Math.floor(ctx.sampleRate * 0.05);
        var buf = ctx.createBuffer(1, len, ctx.sampleRate);
        var d = buf.getChannelData(0);
        for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
        var src = ctx.createBufferSource();
        src.buffer = buf;
        var hg = ctx.createGain();
        hg.gain.value = 0.12;
        var hp = ctx.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.value = 5200;
        src.connect(hp);
        hp.connect(hg);
        hg.connect(this.musicGain);
        src.start(t);
      }
      this.nextBeat += 0.46;
      this.beat++;
    }
  };

  AudioEngine.prototype.toggleMusic = function () {
    this.musicOn = !this.musicOn;
    return this.musicOn;
  };

  PC.AudioEngine = AudioEngine;
})();
