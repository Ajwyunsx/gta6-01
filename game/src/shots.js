/* Palm City — screenshot staging. ?shot=1..4&seed=N builds the world, fast-forwards it into the
   scene the shot wants (in car on a boulevard, on foot at the café, a wanted chase, a job
   briefing) and paints it twice, then sets window.__shotReady. The staging runs the same
   simulation the game runs, so what the camera sees is real play, not a painted mock-up. */
(function (PC) {
  'use strict';

  var C = PC.CONFIG, U = PC.util;

  function stage(name, env) {
    var index = Number.parseInt(name, 10) || 1;
    var input = PC.input.create(env.canvas);
    var audio = PC.audio.make();
    var world = PC.world.create(env.seed, input, audio);
    var state = { screen: PC.ui.SCREEN_TITLE, world: world, renderer: env.renderer, input: input, audio: audio, time: 0 };

    if (index === 1) sceneCover(world);
    else if (index === 2) sceneOnFoot(world);
    else if (index === 3) scenePolice(world);
    else sceneMission(world);

    // simulate a little so traffic, peds and particles are in motion, then paint
    for (var i = 0; i < 40; i++) PC.world.step(world, C.STEP);
    settleCamera(world);

    var painted = 0;
    function paint() {
      PC.render.draw(env.renderer, world, 2.2);
      if (index === 4) PC.ui.drawMissionCard(env.renderer.ctx, world, 2.2);
      else PC.ui.drawToast(env.renderer.ctx, world, 2.2);
      painted += 1;
      if (painted < 2) requestAnimationFrame(paint);
      else window.__shotReady = true;
    }
    requestAnimationFrame(paint);
    window.__palmCity = { state: state, world: world };
  }

  function settleCamera(world) {
    var cam = world.camera;
    var pl = world.player;
    var tx = pl.x, ty = pl.y;
    if (pl.inCar) {
      tx += Math.cos(pl.inCar.angle) * Math.min(150, pl.inCar.speed * 0.42);
      ty += Math.sin(pl.inCar.angle) * Math.min(150, pl.inCar.speed * 0.42);
    } else {
      tx += Math.cos(pl.angle) * 40;
      ty += Math.sin(pl.angle) * 40;
    }
    var z = cam.targetZoom, vw = C.VW / z, vh = C.VH / z;
    cam.zoom = z;
    cam.x = U.clamp(tx - vw / 2, 0, Math.max(0, C.CITY_W - vw));
    cam.y = U.clamp(ty - vh / 2, 0, Math.max(0, C.CITY_H + C.BEACH_H - vh));
  }

  /* 1 — the cover: at the wheel on a downtown boulevard, traffic ahead, the HUD and minimap live. */
  function sceneCover(world) {
    var pl = world.player;
    // put the player in a red coupe on the central avenue heading north
    var avenue = C.CELL * 8;
    var car = PC.vehicles.makeCar(avenue + C.LANE, C.CELL * 12, -Math.PI / 2, { rng: world.rng, type: 'coupe', paint: '#d94f4f' });
    car.driver = 'player';
    car.speed = 210;
    world.parked.push(car);
    pl.inCar = car;
    pl.x = car.x; pl.y = car.y;
    world.camera.targetZoom = 0.86;
    world.camera.zoom = 0.86;
    world.money = 1840;
    pl.health = 92; pl.armor = 64;
    world.missions.index = 3;
    world.missions.state = 'active';
    world.missions.job = PC.missions.JOBS[3];
    world.missions.step = 1;
    world.missions.targets = [
      { at: 'pickup', x: PC.missions.SPOTS.marina.x, y: PC.missions.SPOTS.marina.y, label: 'White coupe', kind: 'steal' },
      { at: 'drop', x: PC.missions.SPOTS.garage.x, y: PC.missions.SPOTS.garage.y, label: 'Garage', kind: 'drop' }
    ];
    world.hud.flash('Wheels for the Job', '#ff6f7d');
    world.hud.flashTimer = 2.2;
    seedTrafficAround(world, avenue, C.CELL * 11.4, 6);
    // a few parked cars along the avenue so the street is dressed
    for (var i = 0; i < 5; i++) {
      var pc = PC.vehicles.makeCar(avenue - C.LANE * 2.4, C.CELL * (9.2 + i * 1.05), -Math.PI / 2, { rng: world.rng, parked: true });
      pc.occupied = i % 2 === 0;
      world.parked.push(pc);
    }
    world.hud.flashTimer = 0;
    world.hud.flashText = '';
  }

  /* 2 — on foot at the boardwalk café, peds and palms, objective marker in the near distance. */
  function sceneOnFoot(world) {
    var pl = world.player;
    var s = PC.missions.SPOTS.cafe;
    pl.x = s.x + 96; pl.y = s.y + 34;
    pl.angle = -0.5;
    pl.health = 84; pl.armor = 30;
    world.money = 1240;
    world.missions.index = 1;
    world.missions.state = 'active';
    world.missions.job = PC.missions.JOBS[1];
    world.missions.step = 0;
    world.missions.targets = [
      { at: 'm1', x: PC.missions.SPOTS.pawn.x, y: PC.missions.SPOTS.pawn.y, label: 'Pawnbroker', kind: 'pickup' },
      { at: 'drop', x: s.x, y: s.y, label: 'Vera', kind: 'drop' }
    ];
    // people on the promenade and a car idling at the curb
    for (var i = 0; i < 7; i++) {
      var ped = PC.entities.spawnPed(world.city, world.rng, s.x - 60 + i * 34, s.y + 6 + (i % 3) * 22);
      ped.angle = i % 2 ? 0.2 : Math.PI - 0.2;
      ped.walk = i;
      world.peds.push(ped);
    }
    var parked = PC.vehicles.makeCar(s.x - 150, s.y + 62, 0, { rng: world.rng, type: 'van', paint: '#4b9fd4', parked: true });
    parked.occupied = true;
    world.parked.push(parked);
    var parked2 = PC.vehicles.makeCar(s.x + 210, s.y + 62, Math.PI, { rng: world.rng, type: 'pickup', paint: '#e8a13a', parked: true });
    world.parked.push(parked2);
    pl.weapon = 'pistol';
    pl.ammo = 12;
    // aim the reticle at something interesting
    world.input.mouse.active = true;
    world.input.mouse.x = 880; world.input.mouse.y = 300;
    world.input.mouse.wx = pl.x + 140;
    world.input.mouse.wy = pl.y - 30;
    world.camera.targetZoom = 1;
    world.hud.flash('Collect from the pawnbroker', '#ff6f7d');
    world.hud.flashTimer = 0;
  }

  /* 3 — wanted: three stars, cruisers closing, sirens, smoke from a wreck. */
  function scenePolice(world) {
    var pl = world.player;
    var avenue = C.CELL * 9;
    var car = PC.vehicles.makeCar(avenue + C.LANE * 0.6, C.CELL * 10.2, -Math.PI / 2, { rng: world.rng, type: 'sedan', paint: '#3f8f8a' });
    car.driver = 'player';
    car.speed = 260;
    car.health = 62;
    world.parked.push(car);
    pl.inCar = car;
    pl.x = car.x; pl.y = car.y;
    pl.health = 68; pl.armor = 40;
    world.money = 2960;
    world.heat.stars = 3;
    world.heat.decay = 6;
    world.camera.targetZoom = 0.84;
    world.camera.zoom = 0.84;

    // three cruisers behind and beside, nose-in on the chase
    var c1 = PC.vehicles.makeCar(car.x - 30, car.y + 150, -Math.PI / 2 + 0.08, { rng: world.rng, police: true, paint: '#f2f0e8', type: 'sedan' });
    c1.speed = 250; c1.occupied = true;
    var c2 = PC.vehicles.makeCar(car.x + 96, car.y + 240, -Math.PI / 2 - 0.16, { rng: world.rng, police: true, paint: '#f2f0e8', type: 'sedan' });
    c2.speed = 235; c2.occupied = true;
    var c3 = PC.vehicles.makeCar(car.x - 110, car.y + 340, -Math.PI / 2 + 0.22, { rng: world.rng, police: true, paint: '#f2f0e8', type: 'coupe' });
    c3.speed = 244; c3.occupied = true;
    world.heat.cops.push(c1, c2, c3);

    // a burning civilian car ahead, smoke rising
    var wreck = PC.vehicles.makeCar(car.x + 210, car.y - 90, 0.4, { rng: world.rng, type: 'van', paint: '#a2583d' });
    wreck.health = 0;
    world.parked.push(wreck);
    for (var s = 0; s < 6; s++) world.effects.smoke(wreck.x, wreck.y, 3);
    world.effects.explode(wreck.x, wreck.y);
    world.hud.flash('Wanted: 3 stars', '#e0402f');
    world.hud.flashTimer = 0;

    world.missions.index = 4;
    world.missions.state = 'active';
    world.missions.job = PC.missions.JOBS[4];
    world.missions.step = 0;
    world.missions.targets = [
      { at: 'pickup', x: PC.missions.SPOTS.cafe.x + 30, y: PC.missions.SPOTS.cafe.y - 30, label: 'Clear', kind: 'escape' },
      { at: 'drop', x: PC.missions.SPOTS.pier.x, y: PC.missions.SPOTS.pier.y, label: 'Pier head', kind: 'drop' }
    ];
    world.audio.siren(true);
    seedTrafficAround(world, avenue - C.LANE * 3.2, C.CELL * 9.2, 3);
  }

  /* 4 — the briefing: job card over the city, the marker and a car waiting. */
  function sceneMission(world) {
    var pl = world.player;
    var s = PC.missions.SPOTS.cafe;
    pl.x = s.x + 60; pl.y = s.y + 20;
    pl.angle = -1.2;
    pl.health = 100; pl.armor = 72;
    world.money = 3420;
    world.missions.index = 5;
    world.missions.job = PC.missions.JOBS[5];
    world.missions.state = 'brief';
    world.missions.briefTime = 3.4;
    world.missions.step = 0;
    world.missions.targets = [
      { at: 'pickup', x: PC.missions.SPOTS.bank.x, y: PC.missions.SPOTS.bank.y, label: 'Office', kind: 'pickup' },
      { at: 'crack', x: PC.missions.SPOTS.bank.x + 26, y: PC.missions.SPOTS.bank.y + 20, label: 'Safe', kind: 'crack' },
      { at: 'drop', x: s.x, y: s.y, label: 'Café', kind: 'drop' }
    ];
    // a getaway coupe at the curb
    var coupe = PC.vehicles.makeCar(s.x + 150, s.y + 58, Math.PI, { rng: world.rng, type: 'coupe', paint: '#2f3b4a', parked: true });
    coupe.occupied = false;
    world.parked.push(coupe);
    for (var i = 0; i < 5; i++) {
      var ped = PC.entities.spawnPed(world.city, world.rng, s.x - 40 + i * 40, s.y + 2 + (i % 2) * 26);
      world.peds.push(ped);
    }
    world.camera.targetZoom = 1;
    world.hud.flash('The Check Cashing Job', '#f2c14e');
    world.hud.flashTimer = 0;
  }

  function seedTrafficAround(world, x, y, n) {
    for (var i = 0; i < n; i++) {
      var car = PC.vehicles.makeCar(x + (world.rng() - 0.5) * 60, y - i * 96, -Math.PI / 2, { rng: world.rng });
      car.traffic = true;
      car.axis = 'y'; car.dir = -1;
      car.gx = Math.round(x / C.CELL); car.gy = Math.round((y - i * 96) / C.CELL);
      car.cruise = 120 + world.rng() * 20;
      car.speed = 120;
      world.traffic.push(car);
    }
  }

  PC.shots = { stage: stage };
})(window.PC = window.PC || {});
