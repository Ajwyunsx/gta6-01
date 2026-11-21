// main.js — boots the game: one canvas, one renderer, one world, a fixed-step loop with an
// accumulator so the simulation never depends on the monitor's refresh, and the wiring for
// the keyboard, the mouse and the pause menu. Also reads ?shot=N to stage a deterministic
// scene for the screenshot pass (shots.js).
(function () {
  'use strict';
  var PC = window.PC;
  var CFG = PC.CFG;

  var canvas = document.getElementById('game');
  var renderer = new PC.Renderer(canvas);
  var world = new PC.World(canvas);
  world.renderer = renderer;
  var input = new PC.Input(canvas);

  document.title = 'Palm City';

  // Any key press or click unlocks the audio context (browser autoplay policy).
  function unlockAudio() {
    world.audio.start();
    world.audio.resume();
    window.removeEventListener('keydown', unlockAudio);
    window.removeEventListener('pointerdown', unlockAudio);
  }
  window.addEventListener('keydown', unlockAudio);
  window.addEventListener('pointerdown', unlockAudio);

  input.onKey = function (code) {
    if (world.ui.key(code)) {
      world.audio.uiClick();
      return;
    }
    // in-game shortcuts
    if (world.ui.screen !== 'playing') return;
    if (code === 'KeyE') input.state.interact = true;
    if (code === 'KeyM') world.hud.toast('Music ' + (world.audio.toggleMusic() ? 'on' : 'off'));
    if (code === 'KeyG') world.save() && world.hud.toast('Game saved');
  };

  window.addEventListener('resize', function () {
    renderer.resize();
  });

  // ---- the shot mode ---------------------------------------------------------
  var params = new URLSearchParams(window.location.search);
  var shotParam = params.get('shot');
  var shotFrames = Number(params.get('frames') || 90);
  var scripted = null;
  if (shotParam && window.PCShots) {
    scripted = window.PCShots.setup(world, input, Number(shotParam));
    if (scripted) {
      // cinematics: the world is already in the right place; just run the clock
      for (var warm = 0; warm < Math.min(shotFrames, 240); warm++) world.step(CFG.STEP, input);
      renderer.draw(world);
      window.__palmCityReady = true;
    }
  }

  // ---- fixed-step loop -------------------------------------------------------
  var last = 0;
  var acc = 0;
  var running = true;

  function frame(now) {
    if (!running) return;
    requestAnimationFrame(frame);
    if (!last) last = now;
    var delta = (now - last) / 1000;
    last = now;
    // A tab that comes back after a minute does not get a minute of simulation.
    if (delta > 0.25) delta = 0.25;

    if (scripted) {
      scripted(delta, world);
    } else {
      acc += delta;
      var steps = 0;
      while (acc >= CFG.STEP && steps < CFG.MAX_FRAME_STEPS) {
        world.step(CFG.STEP, input);
        input.consume();
        acc -= CFG.STEP;
        steps++;
      }
      if (steps === CFG.MAX_FRAME_STEPS) acc = 0;
    }

    renderer.draw(world);
    drawOverlays(world);
  }

  function drawOverlays(world) {
    var ctx = renderer.ctx;
    var w = renderer.w, h = renderer.h;
    ctx.setTransform(renderer.dpr, 0, 0, renderer.dpr, 0, 0);

    if (world.ui.screen === 'playing' || world.ui.screen === 'pause' || world.ui.screen === 'help') {
      world.hud.draw(ctx, w, h);
    }
    // the enter-car prompt, anchored over the car
    if (world.ui.screen === 'playing' && world.enterHint) {
      var cam = world.camera;
      var sx = (world.enterHint.x - cam.x) * cam.zoom + w / 2;
      var sy = (world.enterHint.y - cam.y) * cam.zoom + h / 2 - 46;
      ctx.save();
      ctx.font = '600 12px ui-sans-serif, system-ui, sans-serif';
      ctx.textAlign = 'center';
      var tw = ctx.measureText(world.enterHint.text).width;
      PC.U.roundRect(ctx, sx - tw / 2 - 12, sy - 16, tw + 24, 26, 13);
      ctx.fillStyle = 'rgba(12,10,18,0.72)';
      ctx.fill();
      ctx.fillStyle = CFG.colors.hudText;
      ctx.fillText(world.enterHint.text, sx, sy + 2);
      ctx.restore();
    }
    // the job briefing card pauses the street while it is up
    if (world.missions.briefing && world.ui.screen === 'playing') {
      world.ui.drawBriefing(ctx, w, h, world.missions.briefing);
    }
    if (world.ui.screen !== 'playing') {
      world.ui.draw(ctx, w, h);
    }
  }

  // The briefing card reacts to E (start) and to walking away (cancel).
  world.step = (function (original) {
    return function (dt, input) {
      original.call(world, dt, input);
      var brief = world.missions.briefing;
      if (brief && world.ui.screen === 'playing') {
        if (input.pressed.KeyE || input.state.interact) {
          input.state.interact = false;
          world.missions.begin();
        } else if (input.state.up || input.state.down || input.state.left || input.state.right) {
          world.missions.briefing = null;
          world.missions.state = 'idle';
          world.hud.toast('Job left for later');
        }
      }
    };
  })(world.step);

  requestAnimationFrame(frame);
  window.__palmCity = world;

  // Expose a deterministic frame-advance for the screenshot tool.
  window.__stepFrames = function (n) {
    for (var k = 0; k < n; k++) world.step(CFG.STEP, input);
    renderer.draw(world);
    drawOverlays(world);
  };
})();
