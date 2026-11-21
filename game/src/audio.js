/* Palm City — sound, all synthesised. No audio files: WebAudio oscillators and noise buffers build
   the engine drone that follows the car's revs, the two-tone siren that rises with the star count,
   the pistol crack, the pickup chime, the cash riff and a slow surf-and-synth loop for the city.
   The context starts on the first key press, as browsers require. */
(function (PC) {
  'use strict';

  var U = PC.util;

  function makeAudio() {
    var ctx = null, master = null, musicGain = null, sfxGain = null;
    var engine = null, siren = null, noiseBuf = null, started = false;
    var state = { on: true, musicOn: true, heat: 0, sirenOn: false, engineOn: false };

    function boot() {
      if (started) return;
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
      sfxGain = ctx.createGain(); sfxGain.gain.value = 0.8; sfxGain.connect(master);
      musicGain = ctx.createGain(); musicGain.gain.value = 0.16; musicGain.connect(master);
      noiseBuf = buildNoise(ctx);
      started = true;
      startMusic();
    }

    function buildNoise(ac) {
      var len = Math.floor(ac.sampleRate * 1.5);
      var buf = ac.createBuffer(1, len, ac.sampleRate);
      var d = buf.getChannelData(0);
      for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      return buf;
    }

    function env(gainNode, t0, attack, hold, release, peak) {
      var g = gainNode.gain;
      g.cancelScheduledValues(t0);
      g.setValueAtTime(0.0001, t0);
      g.linearRampToValueAtTime(peak, t0 + attack);
      g.setValueAtTime(peak, t0 + attack + hold);
      g.exponentialRampToValueAtTime(0.0001, t0 + attack + hold + release);
    }

    function tone(freq, dur, type, peak, slideTo) {
      if (!started || !state.on) return;
      var t0 = ctx.currentTime;
      var osc = ctx.createOscillator();
      var g = ctx.createGain();
      osc.type = type || 'square';
      osc.frequency.setValueAtTime(freq, t0);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
      env(g, t0, 0.005, dur * 0.5, dur * 0.5, peak || 0.2);
      osc.connect(g); g.connect(sfxGain);
      osc.start(t0); osc.stop(t0 + dur + 0.05);
    }

    function noiseHit(dur, peak, filterHz, type) {
      if (!started || !state.on) return;
      var t0 = ctx.currentTime;
      var src = ctx.createBufferSource(); src.buffer = noiseBuf;
      var f = ctx.createBiquadFilter(); f.type = type || 'bandpass'; f.frequency.value = filterHz; f.Q.value = 0.9;
      var g = ctx.createGain();
      env(g, t0, 0.001, dur * 0.3, dur * 0.7, peak);
      src.connect(f); f.connect(g); g.connect(sfxGain);
      src.start(t0); src.stop(t0 + dur + 0.05);
    }

    /* ---- engine: a sawtooth whose pitch follows speed, plus filtered noise for grit ---- */
    function startEngine() {
      if (!started || engine) return;
      var osc = ctx.createOscillator(); osc.type = 'sawtooth'; osc.frequency.value = 60;
      var osc2 = ctx.createOscillator(); osc2.type = 'square'; osc2.frequency.value = 42;
      var f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 700;
      var g = ctx.createGain(); g.gain.value = 0.0001;
      var ns = ctx.createBufferSource(); ns.buffer = noiseBuf; ns.loop = true;
      var nf = ctx.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = 180;
      var ng = ctx.createGain(); ng.gain.value = 0.05;
      osc.connect(f); osc2.connect(f); f.connect(g); g.connect(sfxGain);
      ns.connect(nf); nf.connect(ng); ng.connect(sfxGain);
      osc.start(); osc2.start(); ns.start();
      engine = { osc: osc, osc2: osc2, gain: g, filter: f, noiseGain: ng };
    }

    function stopEngine() {
      if (!engine) return;
      var e = engine; engine = null;
      e.gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.2);
      setTimeout(function () { try { e.osc.stop(); e.osc2.stop(); } catch (err) { /* already stopped */ } }, 260);
    }

    function setEngine(speed, throttle) {
      if (!engine) return;
      var abs = Math.abs(speed);
      var target = 0.05 + Math.min(0.12, abs / 2400);
      engine.gain.gain.setTargetAtTime(target, ctx.currentTime, 0.08);
      engine.osc.frequency.setTargetAtTime(52 + abs * 0.62, ctx.currentTime, 0.05);
      engine.osc2.frequency.setTargetAtTime(38 + abs * 0.4, ctx.currentTime, 0.05);
      engine.filter.frequency.setTargetAtTime(520 + abs * 3.4 + (throttle ? 300 : 0), ctx.currentTime, 0.08);
      engine.noiseGain.gain.setTargetAtTime(0.02 + abs / 9000, ctx.currentTime, 0.1);
    }

    /* ---- siren: two detuned tones warbling, louder with heat ---- */
    function setSiren(on) {
      state.sirenOn = on;
      if (!started) return;
      if (on && !siren) {
        var a = ctx.createOscillator(); a.type = 'triangle'; a.frequency.value = 720;
        var b = ctx.createOscillator(); b.type = 'triangle'; b.frequency.value = 960;
        var lfo = ctx.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 2.2;
        var lfoGain = ctx.createGain(); lfoGain.gain.value = 180;
        lfo.connect(lfoGain); lfoGain.connect(a.frequency); lfoGain.connect(b.frequency);
        var g = ctx.createGain(); g.gain.value = 0.045;
        a.connect(g); b.connect(g); g.connect(sfxGain);
        a.start(); b.start(); lfo.start();
        siren = { a: a, b: b, g: g, lfo: lfo };
      } else if (!on && siren) {
        var s = siren; siren = null;
        s.g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.5);
        setTimeout(function () { try { s.a.stop(); s.b.stop(); s.lfo.stop(); } catch (err) { /* stopped */ } }, 600);
      }
    }

    /* ---- one-shot cues ---- */
    function gunshot(vol, pitch) {
      noiseHit(0.16, 0.5 * (vol || 1), 1200 * (pitch || 1), 'bandpass');
      tone(160 * (pitch || 1), 0.09, 'square', 0.24, 60);
    }
    function thud() { tone(90, 0.12, 'sine', 0.22, 40); noiseHit(0.1, 0.14, 400, 'lowpass'); }
    function hurt() { tone(220, 0.18, 'sawtooth', 0.16, 120); }
    function pickup() { tone(660, 0.07, 'triangle', 0.16); setTimeout(function () { tone(990, 0.09, 'triangle', 0.14); }, 70); }
    function cash() {
      var notes = [523.25, 659.25, 783.99, 1046.5];
      notes.forEach(function (f, i) { setTimeout(function () { tone(f, 0.13, 'triangle', 0.13); }, i * 85); });
    }
    function sting() { tone(392, 0.22, 'triangle', 0.14); setTimeout(function () { tone(523.25, 0.3, 'triangle', 0.13); }, 130); }
    function reload() { noiseHit(0.05, 0.12, 2200); setTimeout(function () { noiseHit(0.07, 0.16, 1400); }, 140); }
    function explosion() { noiseHit(0.6, 0.7, 240, 'lowpass'); tone(70, 0.5, 'sawtooth', 0.3, 28); }
    function horn() { tone(310, 0.28, 'square', 0.13); tone(392, 0.28, 'square', 0.1); }
    function busted() { tone(300, 0.5, 'sawtooth', 0.2, 90); }
    function wasted() { tone(180, 0.8, 'sine', 0.24, 50); }

    /* ---- the loop: a lazy surf-pop progression with a kick and a shaker ---- */
    function startMusic() {
      if (!started) return;
      var chordProg = [
        [261.63, 329.63, 392.0],   // C
        [220.0, 261.63, 329.63],   // Am
        [174.61, 220.0, 261.63],   // F
        [196.0, 246.94, 293.66]    // G
      ];
      var step = 0;
      var beatMs = 480;
      function tick() {
        if (!started) return;
        var chord = chordProg[Math.floor(step / 8) % chordProg.length];
        var t0 = ctx.currentTime;
        // pad chord every bar
        if (step % 8 === 0) {
          chord.forEach(function (f) {
            var osc = ctx.createOscillator(); osc.type = 'triangle'; osc.frequency.value = f;
            var g = ctx.createGain(); g.gain.value = 0.0001;
            var f2 = ctx.createBiquadFilter(); f2.type = 'lowpass'; f2.frequency.value = 1400;
            osc.connect(f2); f2.connect(g); g.connect(musicGain);
            g.gain.linearRampToValueAtTime(0.055, t0 + 0.4);
            g.gain.linearRampToValueAtTime(0.0001, t0 + beatMs * 8 / 1000);
            osc.start(t0); osc.stop(t0 + beatMs * 8 / 1000 + 0.1);
          });
        }
        // bass on the offbeat
        if (step % 4 === 2) {
          var b = ctx.createOscillator(); b.type = 'sine'; b.frequency.value = chord[0] / 2;
          var bg = ctx.createGain(); bg.gain.value = 0.0001;
          b.connect(bg); bg.connect(musicGain);
          bg.gain.linearRampToValueAtTime(0.08, t0 + 0.02);
          bg.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.35);
          b.start(t0); b.stop(t0 + 0.4);
        }
        // kick + shaker
        if (step % 8 === 0 || step % 8 === 5) {
          var k = ctx.createOscillator(); k.type = 'sine'; k.frequency.setValueAtTime(120, t0);
          k.frequency.exponentialRampToValueAtTime(45, t0 + 0.14);
          var kg = ctx.createGain(); kg.gain.setValueAtTime(0.12, t0);
          kg.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.2);
          k.connect(kg); kg.connect(musicGain); k.start(t0); k.stop(t0 + 0.22);
        }
        if (step % 2 === 1) {
          var s = ctx.createBufferSource(); s.buffer = noiseBuf;
          var sf = ctx.createBiquadFilter(); sf.type = 'highpass'; sf.frequency.value = 5200;
          var sg = ctx.createGain(); sg.gain.setValueAtTime(0.035, t0);
          sg.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.08);
          s.connect(sf); sf.connect(sg); sg.connect(musicGain);
          s.start(t0); s.stop(t0 + 0.1);
        }
        step = (step + 1) % 32;
      }
      tick();
      state.musicTimer = setInterval(tick, beatMs);
    }

    function setMusic(on) {
      state.musicOn = on;
      if (!started || !musicGain) return;
      musicGain.gain.setTargetAtTime(on ? 0.16 : 0.0001, ctx.currentTime, 0.2);
    }

    function heat(stars) {
      state.heat = stars;
      if (siren) siren.g.gain.setTargetAtTime(0.02 + stars * 0.012, ctx.currentTime, 0.3);
    }

    function resume() { if (ctx && ctx.state === 'suspended') ctx.resume(); }

    return {
      boot: boot, resume: resume,
      gunshot: gunshot, thud: thud, hurt: hurt, pickup: pickup, cash: cash,
      sting: sting, reload: reload, explosion: explosion, horn: horn,
      busted: busted, wasted: wasted, heat: heat,
      siren: setSiren, setEngine: setEngine, startEngine: startEngine, stopEngine: stopEngine,
      setMusic: setMusic, state: state,
      get ready() { return started; }
    };
  }

  PC.audio = { make: makeAudio };
})(window.PC = window.PC || {});
