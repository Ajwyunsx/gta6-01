// Palm City — the loop: a canvas, a fixed step, and the mode machine that moves between
// the title, the briefing, play, pause, busted and wasted. Also where saving happens.
(function (global) {
  'use strict';

  const PC = global.PC;

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d', { alpha: false });
  let W = 1280;
  let H = 720;

  function resize() {
    const dpr = Math.min(2, global.devicePixelRatio || 1);
    const rect = canvas.getBoundingClientRect();
    W = Math.max(960, Math.round(rect.width));
    H = Math.max(540, Math.round(rect.height));
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  const input = PC.Input.makeInput(canvas);
  const audio = PC.Audio.makeAudio();

  let state = PC.World.create(20261121);
  state.camera.w = W;
  state.camera.h = H;

  let menuSel = 0;
  let fade = 0;
  let briefingJob = null;

  const params = new URLSearchParams(location.search);
  const shotMode = params.has('shot');
  const shotFrames = Number(params.get('frames') || 0);

  /** Start a fresh game from the title, from a save, or fresh. */
  function startGame(fromSave) {
    const seed = fromSave && fromSave.seed ? fromSave.seed : 20261121;
    state = PC.World.create(seed);
    state.camera.w = W;
    state.camera.h = H;

    if (fromSave) {
      const p = state.player;
      p.cash = fromSave.cash ?? 0;
      p.health = fromSave.health ?? p.maxHealth;
      p.armour = fromSave.armour ?? 0;
      p.ammo = fromSave.ammo ?? 120;
      p.x = fromSave.x ?? p.x;
      p.y = fromSave.y ?? p.y;
      state.missions.index = Math.min(fromSave.jobIndex ?? 0, state.missions.jobs.length - 1);
      state.missions.story.completed = fromSave.completed ?? [];
      state.wanted.heat = fromSave.heat ?? 0;
      state.camera.x = p.x;
      state.camera.y = p.y;
    }

    state.mode = 'playing';
    // Offer the current job.
    const job = PC.Missions.current(state.missions);
    briefingJob = job;
    state.mode = 'briefing';
    audio.start();
  }

  function acceptBriefing() {
    state.mode = 'playing';
    PC.Missions.begin(state.missions, state.city);
    briefingJob = null;
  }

  function quitToTitle() {
    PC.World.respawn(state, true);
    state.mode = 'title';
    briefingJob = null;
    audio.engineLevel(0, false);
    audio.sirenLevel(0);
  }

  // ---- per-step input for the menus --------------------------------------

  function stepMenus() {
    if (state.mode === 'title') {
      if (input.consumeKey('Enter') || input.consumeKey('NumpadEnter')) {
        startGame(null);
      } else if (input.consumeKey('KeyL') && PC.UI.hasSave()) {
        const s = PC.UI.loadGame();
        if (s) startGame(s);
      }
      return;
    }

    if (state.mode === 'briefing') {
      if (input.consumeKey('Enter') || input.consumeKey('NumpadEnter')) acceptBriefing();
      else if (input.consumeKey('Escape')) {
        state.mode = 'playing';
        briefingJob = null;
        PC.UI.toast(state.toasts, 'Job declined — the marker stays', PC.PALETTE.hudDim);
      }
      return;
    }

    if (state.mode === 'paused') {
      if (input.consumeKey('ArrowUp') || input.consumeKey('KeyW')) menuSel = (menuSel + 3) % 4;
      if (input.consumeKey('ArrowDown') || input.consumeKey('KeyS')) menuSel = (menuSel + 1) % 4;
      if (input.consumeKey('Escape')) {
        state.mode = 'playing';
        return;
      }
      if (input.consumeKey('Enter') || input.consumeKey('NumpadEnter')) {
        if (menuSel === 0) state.mode = 'playing';
        else if (menuSel === 1) {
          if (PC.UI.saveGame(state)) PC.UI.toast(state.toasts, 'Game saved', '#9ce0a8');
        } else if (menuSel === 2) {
          const s = PC.UI.loadGame();
          if (s) startGame(s);
          else PC.UI.toast(state.toasts, 'No save found', PC.PALETTE.danger);
        } else {
          quitToTitle();
        }
        return;
      }
      return;
    }

    if (state.mode === 'busted' || state.mode === 'wasted') {
      state.bustedTimer += PC.STEP;
      state.wastedTimer += PC.STEP;
      if (input.consumeKey('Enter') || input.consumeKey('NumpadEnter') || input.consumeKey('Space')) {
        PC.World.respawn(state, true);
      }
      return;
    }
  }

  // ---- the frame ---------------------------------------------------------

  let acc = 0;
  let last = 0;
  let frames = 0;

  function frame(now) {
    if (!last) last = now;
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.25) dt = 0.25;

    // Esc toggles pause, but never from the title.
    if (state.mode === 'playing' && input.consumeKey('Escape')) {
      state.mode = 'paused';
      menuSel = 0;
    }

    // Steal / leave a car.
    if (state.mode === 'playing' && input.consumeKey('KeyE')) {
      const p = state.player;
      if (p.inCar) {
        PC.Vehicles.playerExit(p, p.inCar);
      } else {
        const car = PC.Vehicles.nearestCar(state.cars(), p.x, p.y, 46);
        if (car) {
          if (car.driver === 'police' || car.driver === 'traffic') {
            state.onCrime(40, 'grand theft auto');
            state.stats.carsStolen += 1;
            PC.UI.toast(state.toasts, 'Car stolen', PC.PALETTE.danger);
          } else if (car.mission) {
            PC.UI.toast(state.toasts, 'That is Rook\'s car', PC.PALETTE.gold);
          }
          PC.Vehicles.playerEnter(p, car);
          car.driver = 'player';
          audio.impact(0.4);
        }
      }
    }

    stepMenus();

    if (state.mode === 'playing') {
      acc += dt;
      let steps = 0;
      while (acc >= PC.STEP && steps < PC.MAX_STEPS) {
        PC.World.step(state, input, PC.STEP, W, H);
        acc -= PC.STEP;
        steps += 1;
        input.endStep();
      }
      if (steps === PC.MAX_STEPS) acc = 0;
    } else {
      // Menus: advance the clock and toasts only.
      state.time += dt;
      PC.UI.tickToasts(state.toasts, dt);
      state.effects.update(dt);
      input.endStep();
    }

    draw();
    frames += 1;
    global.requestAnimationFrame(frame);
  }

  function draw() {
    ctx.save();

    if (state.mode === 'title') {
      // Draw the city behind the logo so the title screen is a real render.
      PC.Render.drawWorld(ctx, state, W, H);
      PC.UI.drawTitle(ctx, W, H, state);
      ctx.restore();
      return;
    }

    PC.Render.drawWorld(ctx, state, W, H);
    PC.Hud.draw(ctx, state, W, H);
    PC.UI.drawToasts(ctx, state.toasts, W);

    if (state.mode === 'briefing' && briefingJob) {
      PC.UI.drawBriefing(ctx, W, H, briefingJob);
    } else if (state.mode === 'paused') {
      PC.UI.drawPause(ctx, W, H, menuSel);
    } else if (state.mode === 'busted') {
      fade = Math.min(0.82, state.bustedTimer * 0.9);
      PC.UI.drawBusted(ctx, W, H, fade);
      if (state.bustedTimer > 1.2) {
        ctx.textAlign = 'center';
        ctx.font = '600 14px "Inter", system-ui, sans-serif';
        ctx.fillStyle = 'rgba(223,230,245,0.8)';
        ctx.fillText('ENTER  get back out there', W / 2, H / 2 + 92);
      }
    } else if (state.mode === 'wasted') {
      fade = Math.min(0.80, state.wastedTimer * 0.9);
      PC.UI.drawWasted(ctx, W, H, fade);
      if (state.wastedTimer > 1.2) {
        ctx.textAlign = 'center';
        ctx.font = '600 14px "Inter", system-ui, sans-serif';
        ctx.fillStyle = 'rgba(243,215,215,0.8)';
        ctx.fillText('ENTER  try again', W / 2, H / 2 + 92);
      }
    }

    ctx.restore();
  }

  // ---- boot --------------------------------------------------------------

  global.addEventListener('resize', resize);
  resize();

  // A first click anywhere unlocks WebAudio in Chrome.
  global.addEventListener('pointerdown', () => audio.start(), { once: true });

  // Staged screenshots: ?shot=N runs a fixed scenario, so the four stills show the world
  // at its best without me puppeting a keyboard.
  if (shotMode) {
    PC.Shots.apply(state, Number(params.get('shot') || 1), W, H);
    const target = shotFrames || 90;
    let n = 0;
    const staged = (now) => {
      if (n === 0) last = now;
      const dt = 1 / 60;
      PC.World.step(state, input, dt, W, H);
      PC.Shots.tick(state, dt);
      state.time += dt;
      n += 1;
      draw();
      if (n < target) global.requestAnimationFrame(staged);
      else document.body.dataset.shotReady = '1';
    };
    global.requestAnimationFrame(staged);
    return;
  }

  global.requestAnimationFrame(frame);

  // Expose a tiny hook for debugging in the console; harmless at runtime.
  global.PalmCity = { state: () => state, start: startGame };
})(window);
