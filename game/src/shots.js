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
    PC.render.resize(env.renderer);
    var world = PC.world.create(env.seed, input, audio);
    window.__shotDebug = {};
    var state = { screen: PC.ui.SCREEN_TITLE, world: world, renderer: env.renderer, input: input, audio: audio, time: 0 };

    if (index === 1) sceneCover(world);
    else if (index === 2) sceneOnFoot(world);
    else if (index === 3) scenePolice(world);
    else sceneMission(world);

    // simulate a little so traffic, peds and particles are in motion, then paint
    for (var i = 0; i < 40; i++) PC.world.step(world, C.STEP);
    // some scenes want the last word on the composition: hold the cast, then settle
    if (world.__post) world.__post(world);
    settleCamera(world);

    var painted = 0;
    function paint() {
      try {
        
        PC.render.draw(env.renderer, world, 2.2);
        if (index === 4) PC.ui.drawMissionCard(env.renderer.ctx, world, 2.2);
        else PC.ui.drawToast(env.renderer.ctx, world, 2.2);
        window.__shotError = '';
      } catch (err) {
        window.__shotError = String(err && err.message);
        throw err;
      }
      painted += 1;
      if (painted >= 2) window.__shotReady = true;
      // keep repainting: a still canvas can be composited blank by a headless capture
      requestAnimationFrame(paint);
    }
    requestAnimationFrame(paint);
    window.__palmCity = { state: state, world: world };
  }

  function settleCamera(world) {
    var cam = world.camera;
    cam.lock = true;   // hold the framing the scene asked for
    var bias = cam.bias || { x: 0, y: 0 };
    var pl = world.player;
    var tx = pl.x, ty = pl.y;
    if (pl.inCar) {
      tx += Math.cos(pl.inCar.angle) * Math.min(150, pl.inCar.speed * 0.42);
      ty += Math.sin(pl.inCar.angle) * Math.min(150, pl.inCar.speed * 0.42);
    } else {
      tx += Math.cos(pl.angle) * 40;
      ty += Math.sin(pl.angle) * 40;
    }
    var z = cam.shotZoom || cam.targetZoom, vw = C.VW / z, vh = C.VH / z;
    cam.zoom = z;
    cam.x = U.clamp(tx - vw / 2 + bias.x, 0, Math.max(0, C.CITY_W - vw));
    cam.y = U.clamp(ty - vh / 2 + bias.y, 0, Math.max(0, C.WORLD_H - vh));
  }

  /* 1 — the cover: at the wheel on the coast road at golden hour, the sea on one side and the
     towers on the other, traffic ahead, the HUD and minimap live. */
  function sceneCover(world) {
    var pl = world.player;
    world.traffic.length = 0;
    world.camera.bias = { x: 132, y: 84 };
    // the coast road runs east-west along the top edge of the beach
    var coastY = C.GRID * C.CELL - C.ROAD / 2 - 2;
    var car = PC.vehicles.makeCar(C.CELL * 6.2, coastY + C.LANE, 0, { rng: world.rng, type: 'coupe', paint: '#d94f4f' });
    car.driver = 'player';
    car.speed = 230;
    world.parked.push(car);
    pl.inCar = car;
    pl.x = car.x; pl.y = car.y;
    world.camera.targetZoom = 1.0;
    world.camera.zoom = 1.0;
    world.camera.shotZoom = 1.0;
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
    // traffic on the coast road, both directions
    for (var i = 0; i < 3; i++) {
      var tc = PC.vehicles.makeCar(car.x + 240 + i * 210, coastY - C.LANE, Math.PI, { rng: world.rng });
      tc.traffic = true; tc.straight = true; tc.angle = Math.PI; tc.speed = 132; tc.cruise = 132;
      world.traffic.push(tc);
    }
    var lead = PC.vehicles.makeCar(car.x + 150, coastY + C.LANE, 0, { rng: world.rng, type: 'van', paint: '#4b9fd4' });
    lead.traffic = true; lead.straight = true; lead.speed = 120; lead.cruise = 120;
    world.traffic.push(lead);
    var behind = PC.vehicles.makeCar(car.x - 180, coastY + C.LANE, 0, { rng: world.rng, type: 'sedan', paint: '#2f3b4a' });
    behind.traffic = true; behind.straight = true; behind.speed = 126; behind.cruise = 126;
    world.traffic.push(behind);
    // cars parked along the beach lot and under the palms
    for (var b = 0; b < 4; b++) {
      var pc = PC.vehicles.makeCar(C.CELL * 8.6 + b * 104, C.CITY_H + 40, Math.PI / 2, { rng: world.rng, parked: true });
      pc.occupied = b % 3 === 0;
      world.parked.push(pc);
    }
    // sunbathers and beachgoers
    for (var p = 0; p < 10; p++) {
      var ped = PC.entities.spawnPed(world.city, world.rng, C.CELL * 4.4 + p * 96, C.CITY_H + 150 + (p % 3) * 62);
      world.peds.push(ped);
    }
    world.hud.flashText = '';
    world.hud.flashTimer = 0;
  }

  /* 2 — on foot at the boardwalk café, peds and palms, objective marker in the near distance. */
  function sceneOnFoot(world) {
    var pl = world.player;
    var s = PC.missions.SPOTS.cafe;
    pl.x = s.x + 74; pl.y = C.CITY_H + 262;
    pl.angle = -1.85;
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
      var ped = PC.entities.spawnPed(world.city, world.rng, s.x - 210 + i * 74, C.CITY_H + 190 + (i % 3) * 56);
      ped.angle = i % 2 ? 0.2 : Math.PI - 0.2;
      ped.walk = i;
      world.peds.push(ped);
    }
    var parked = PC.vehicles.makeCar(s.x - 170, s.y + 66, Math.PI, { rng: world.rng, type: 'van', paint: '#4b9fd4', parked: true });
    parked.occupied = true;
    world.parked.push(parked);
    var parked2 = PC.vehicles.makeCar(s.x + 190, C.CITY_H + 126, 0, { rng: world.rng, type: 'pickup', paint: '#e8a13a', parked: true });
    world.parked.push(parked2);
    var beater = PC.vehicles.makeCar(s.x + 34, C.CITY_H + 176, 0.7, { rng: world.rng, type: 'compact', paint: '#c05e8f', parked: true });
    world.parked.push(beater);
    pl.weapon = 'pistol';
    pl.ammo = 12;
    // aim the reticle at something interesting
    world.input.mouse.active = true;
    world.input.mouse.x = 880; world.input.mouse.y = 300;
    world.input.mouse.wx = pl.x + 140;
    world.input.mouse.wy = pl.y - 30;
    world.camera.targetZoom = 1.0;
    world.camera.zoom = 1.0;
    world.camera.shotZoom = 1.0;
    world.hud.flash('Collect from the pawnbroker', '#ff6f7d');
    world.hud.flashTimer = 0;
  }

  /* 3 — wanted: three stars on the coast road. The player's car runs east along the beach
     front with two cruisers filling the mirror and a third cutting across the centre line
     head-on; a civilian car burns on the kerb, smoke laying over the tarmac. */
  function scenePolice(world) {
    var pl = world.player;
    var roadY = C.GRID * C.CELL - C.ROAD / 2;
    var laneY = roadY + C.LANE * 1.55;
    var onY = roadY - C.LANE * 1.55;
    var cx = C.CELL * 6.4;
    world.traffic.length = 0;
    world.camera.bias = { x: -26, y: -22 };
    world.camera.targetZoom = 1.46;
    world.camera.zoom = 1.46;
    world.camera.shotZoom = 1.46;

    var car = PC.vehicles.makeCar(cx, laneY, 0, { rng: world.rng, type: 'sedan', paint: '#3f8f8a' });
    car.driver = 'player';
    car.health = 54;
    world.parked.push(car);
    pl.inCar = car;
    pl.x = car.x; pl.y = car.y;
    pl.health = 62; pl.armor = 34;
    world.money = 2960;
    world.heat.stars = 3;
    world.heat.decay = 6;
    world.heat.cops.length = 0;

    var box = [
      PC.vehicles.makeCar(cx - 74, laneY - 3, 0.02, { rng: world.rng, police: true, paint: '#f2f0e8', type: 'sedan' }),
      PC.vehicles.makeCar(cx - 156, laneY + 10, 0.06, { rng: world.rng, police: true, paint: '#f2f0e8', type: 'sedan' }),
      PC.vehicles.makeCar(cx + 238, onY, Math.PI - 0.03, { rng: world.rng, police: true, paint: '#f2f0e8', type: 'coupe' })
    ];
    box.forEach(function (c) { c.speed = 0; c.cruise = 0; c.occupied = true; c.frozen = true; world.heat.cops.push(c); });

    var wreck = PC.vehicles.makeCar(cx - 186, roadY + C.ROAD * 0.46, 0.55, { rng: world.rng, type: 'van', paint: '#a2583d' });
    wreck.health = 0;
    world.parked.push(wreck);

    // civilian traffic further along, so this reads as a street, not a set
    [[cx + 262, laneY + 16, 0.02, 'compact', '#e0b23c'],
     [cx + 430, laneY + 4, 0.03, 'van', '#6f7f95'],
     [cx + 92, onY - 10, Math.PI, 'pickup', '#b8552f']].forEach(function (d) {
      var c = PC.vehicles.makeCar(d[0], d[1], d[2], { rng: world.rng, type: d[3], paint: d[4] });
      c.traffic = true; c.straight = true; c.speed = 96; c.cruise = 96;
      world.traffic.push(c);
    });

    world.missions.index = 4;
    world.missions.state = 'active';
    world.missions.job = PC.missions.JOBS[4];
    world.missions.step = 0;
    world.missions.targets = [
      { at: 'drop', x: PC.missions.SPOTS.pier.x, y: PC.missions.SPOTS.pier.y, label: 'Pier head', kind: 'drop' }
    ];
    world.audio.siren(true);

    world.__post = function (w) {
      car.x = cx; car.y = laneY; car.angle = 0; car.speed = 272;
      box[0].x = cx - 74; box[0].y = laneY - 3; box[0].angle = 0.02; box[0].speed = 268;
      box[1].x = cx - 156; box[1].y = laneY + 10; box[1].angle = 0.06; box[1].speed = 260;
      box[2].x = cx + 238; box[2].y = onY; box[2].angle = Math.PI - 0.03; box[2].speed = 286;
      wreck.x = cx - 186; wreck.y = roadY + C.ROAD * 0.46;
      for (var q = 0; q < w.effects.parts.length; q++) w.effects.parts[q].live = false;
      for (var s = 0; s < 15; s++) {
        var jz = (s * 37) % 11 - 5;
        w.effects.smoke(wreck.x + jz + s * 2.4, wreck.y - s * 9 - 4, 4);
      }
      w.effects.burst(wreck.x, wreck.y, 9, '#ff9a3c', 50);
      // guns out the windows of the two cars on the player's tail
      w.effects.burst(box[0].x + 30, box[0].y - 12, 7, '#ffd27a', 120);
      w.effects.burst(box[0].x + 40, box[0].y - 18, 4, '#fff3cf', 60);
      w.effects.burst(box[2].x - 32, box[2].y + 12, 7, '#ffd27a', 120);
      w.effects.burst(box[2].x - 42, box[2].y + 18, 4, '#fff3cf', 60);
      for (var t = 0; t < 9; t++) w.effects.puff(car.x - 26 - t * 6, car.y + 16 + (t % 2) * 7, 1.8);
      w.effects.shake(3);
      w.damageFlash = 0;
      w.hud.flash('Wanted: 3 stars', '#e0402f');
      w.hud.flashTimer = 0;
    };
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
    world.camera.targetZoom = 1.0;
    world.camera.zoom = 1.0;
    world.camera.shotZoom = 1.0;
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
