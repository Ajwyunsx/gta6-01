/* Palm City — boot and the one loop. Keys are read every frame; the world advances in fixed 1/60 s
   steps (several in a slow frame, none in a fast one); the renderer paints what is there. The game
   sits on three screens: title, play, paused. ?shot=N (with ?seed=N) stages one of the four
   screenshots instead of running the loop. */
(function (PC) {
  'use strict';

  var C = PC.CONFIG, U = PC.util;
  var MAX_FRAME = 0.25;

  function boot() {
    var params = new URLSearchParams(window.location.search);
    var shot = params.get('shot');
    var seedParam = Number.parseInt(params.get('seed') || '', 10);
    var seed = Number.isInteger(seedParam) ? seedParam : C.DEFAULT_SEED;

    var canvas = document.getElementById('game');
    var status = document.getElementById('status');
    var renderer = PC.render.make(canvas);
    PC.render.resize(renderer);
    window.addEventListener('resize', function () { PC.render.resize(renderer); });

    if (shot) {
      PC.shots.stage(shot, { canvas: canvas, renderer: renderer, seed: seed });
      return;
    }

    var input = PC.input.create(canvas);
    var audio = PC.audio.make();
    var world = PC.world.create(seed, input, audio);

    var state = {
      screen: PC.ui.SCREEN_TITLE,
      world: world, renderer: renderer, input: input, audio: audio,
      hasSave: PC.world.hasSave(),
      time: 0
    };

    // the mouse in world coordinates, refreshed each frame from the camera
    function syncMouse() {
      var m = input.mouse;
      var zoom = world.camera.zoom;
      m.wx = world.camera.x + (m.x - C.VW / 2) / zoom + C.VW / 2;
      m.wy = world.camera.y + (m.y - C.VH / 2) / zoom + C.VH / 2;
    }

    function start() {
      world.player.alive = true;
      state.screen = PC.ui.SCREEN_PLAY;
      announce('Palm City. Find Vera at the café on the beach to start your first job.');
    }

    function announce(text) { if (status) status.textContent = text; }

    canvas.addEventListener('mousedown', function (e) {
      var r = canvas.getBoundingClientRect();
      var mx = (e.clientX - r.left) / r.width * C.VW;
      var my = (e.clientY - r.top) / r.height * C.VH;
      if (state.screen === PC.ui.SCREEN_PAUSED) {
        var action = PC.ui.clickPause(world, mx, my);
        if (action === 'resume') { state.screen = PC.ui.SCREEN_PLAY; }
        else if (action === 'save') { toast(world, PC.world.save(world) ? 'Game saved' : 'Could not save'); }
        else if (action === 'load') { if (PC.world.load(world)) state.screen = PC.ui.SCREEN_PLAY; else toast(world, 'No save found'); }
        else if (action === 'music') { audio.setMusic(!audio.state.musicOn); }
        else if (action === 'quit') { state.screen = PC.ui.SCREEN_TITLE; state.hasSave = PC.world.hasSave(); }
        return;
      }
      if (state.screen === PC.ui.SCREEN_PLAY && world.missions.state === 'brief') {
        world.missions.briefTime = 0;
      }
    });

    function toast(w, text) { w.hud.flash(text, '#f2c14e'); }

    window.addEventListener('keydown', function (e) {
      if (!audio.ready) { audio.boot(); audio.resume(); }
      if (state.screen === PC.ui.SCREEN_TITLE) {
        if (e.code === 'Enter' || e.code === 'NumpadEnter') { start(); }
        else if (e.code === 'KeyL' && state.hasSave) {
          if (PC.world.load(world)) start();
        }
      } else if (state.screen === PC.ui.SCREEN_PLAY) {
        if (e.code === 'Escape') { state.screen = PC.ui.SCREEN_PAUSED; return; }
        if (e.code === 'KeyM') { audio.setMusic(!audio.state.musicOn); }
        if (world.missions.state === 'brief' && (e.code === 'Enter' || e.code === 'Space')) world.missions.briefTime = 0;
        if (world.over && (e.code === 'Enter' || e.code === 'Space')) {
          PC.world.respawn(world);
        }
      } else if (state.screen === PC.ui.SCREEN_PAUSED) {
        if (e.code === 'Escape') state.screen = PC.ui.SCREEN_PLAY;
        if (e.code === 'Enter') state.screen = PC.ui.SCREEN_PLAY;
      }
    });

    // touch of a tutorial line so a first player knows where to go
    world.tutorial.text = 'Vera waits by the café on the boardwalk.';

    var acc = 0, last = performance.now();
    function frame(now) {
      var dt = Math.min(MAX_FRAME, (now - last) / 1000);
      last = now;
      state.time += dt;

      if (state.screen === PC.ui.SCREEN_PLAY) {
        acc += dt;
        var steps = 0;
        while (acc >= C.STEP && steps < 5) {
          syncMouse();
          PC.world.step(world, C.STEP);
          acc -= C.STEP;
          steps++;
        }
        if (world.over && world.overTimer > 3.2) {
          // the card has been up long enough; wait for Enter (a click also works on the canvas)
        }
        syncMouse();
        PC.render.draw(renderer, world, state.time);
        PC.ui.drawMissionCard(renderer.ctx, world, state.time);
        PC.ui.drawStoryCard(renderer.ctx, world, state.time);
        if (!world.over) PC.ui.drawToast(renderer.ctx, world, state.time);
      } else if (state.screen === PC.ui.SCREEN_PAUSED) {
        PC.render.draw(renderer, world, state.time);
        PC.ui.drawPause(renderer.ctx, world, state.time);
      } else {
        PC.ui.drawTitle(renderer.ctx, state, state.time);
      }

      input.clearEdges();
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);

    // expose for the screenshot script and for debugging from the console
    window.__palmCity = { state: state, world: world, start: start };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window.PC = window.PC || {});
