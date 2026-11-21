/* Palm City — the world: everything that lives between two frames. It owns the city, the player,
   the cars, the people, the heat, the jobs and the effects, and it advances them in one fixed step.
   main.js owns screens and input; this file owns the simulation, plus save and load. */
(function (PC) {
  'use strict';

  var C = PC.CONFIG, P = PC.PALETTE, U = PC.util, V = PC.vehicles;

  function createWorld(seed, input, audio) {
    var rng = PC.makeRng(seed);
    var city = PC.city.generate(seed);

    var world = {
      seed: seed, rng: rng, city: city, input: input, audio: audio,
      player: null, traffic: [], parked: [], peds: [], pickups: [], heat: null, missions: null,
      effects: PC.effects.make(), hud: PC.hud.make(),
      time: 0, money: C.START_MONEY, noise: 0,
      stats: { jobs: 0, killed: 0, knocked: 0, damageTaken: 0, distance: 0, jacked: 0 },
      over: false, overKind: '', overTimer: 0, storyDone: false,
      marineCoupe: null, camera: { x: 0, y: 0, zoom: 1, targetZoom: 1 },
      tutorial: { step: 0, timer: 0 }
    };

    world.heat = PC.police.makeHeat();
    world.missions = PC.missions.make(world);

    // the player starts on the beach promenade in front of Vera's café
    var start = PC.missions.SPOTS.cafe;
    world.player = PC.entities.makePlayer(start.x + 46, start.y + 40);
    world.player.angle = -Math.PI / 2;

    PC.traffic.populateParked(world, rng);
    for (var i = 0; i < 12; i++) PC.traffic.spawn(world, rng);
    for (var p = 0; p < 22; p++) {
      var ped = spawnPedNear(world, rng);
      world.peds.push(ped);
    }

    // a white coupe waiting in the marina lot for job four
    var marina = PC.missions.SPOTS.marina;
    world.marineCoupe = V.makeCar(marina.x, marina.y, 0, { rng: rng, type: 'coupe', paint: '#efe9dc', parked: true });
    world.parked.push(world.marineCoupe);

    world.camera.x = world.player.x - C.VW / 2;
    world.camera.y = world.player.y - C.VH / 2;

    world.onBusted = function () { triggerOver(world, 'busted'); };
    world.onWasted = function () { triggerOver(world, 'wasted'); };
    world.onStoryComplete = function () {
      world.storyDone = true;
      world.hud.banner('Palm City is yours', 'Seven jobs. One city. Keep the engine warm.');
      world.audio.cash();
    };

    return world;
  }

  function spawnPedNear(world, rng) {
    for (var tries = 0; tries < 24; tries++) {
      var ang = rng() * 6.283, d = 120 + rng() * 520;
      var x = world.player.x + Math.cos(ang) * d;
      var y = world.player.y + Math.sin(ang) * d;
      if (x < 30 || y < 30 || x > C.CITY_W - 30 || y > C.CITY_H + C.BEACH_H - 60) continue;
      if (PC.city.collideCircle(world.city, x, y, 10)) continue;
      if (PC.city.onRoad(x, y)) continue;
      return PC.entities.spawnPed(world.city, rng, x, y);
    }
    return PC.entities.spawnPed(world.city, rng, world.player.x + 90, world.player.y);
  }

  /* ---------- the fixed step ---------- */

  function step(world, dt) {
    if (world.over) {
      world.overTimer += dt;
      PC.effects.update(world.effects, dt);
      return;
    }
    world.time += dt;
    if (world.noise > 0) world.noise = Math.max(0, world.noise - dt * 1.4);

    var pl = world.player;
    var prevX = pl.x, prevY = pl.y;

    // --- on foot: enter and leave cars, fire, reload
    handleEnterExit(world);

    if (pl.inCar) {
      V.updateCar(pl.inCar, world.input, dt, world, true);
      var car = pl.inCar;
      // the thing you drive can hurt people and property
      for (var pi = 0; pi < world.peds.length; pi++) {
        var ped = world.peds[pi];
        if (ped.dead) continue;
        if (U.dist2(ped.x, ped.y, car.x, car.y) < 30 * 30 && Math.abs(car.speed) > 40) {
          ped.slide = 0.7; ped.slideAng = car.angle;
          ped.hurt = 1;
          world.effects.burst(ped.x, ped.y, 8, '#b23a3a', 120);
          world.audio.thud();
          PC.police.commit(world.heat, 'hitPed', world);
          world.effects.shake(4);
        }
      }
      if (!car.stolenSilent) {
        // driving into a cruiser is a crime too
        for (var ci = 0; ci < world.heat.cops.length; ci++) {
          var cop = world.heat.cops[ci];
          if (U.dist2(cop.x, cop.y, car.x, car.y) < 40 * 40 && Math.abs(car.speed) > 90) {
            PC.police.commit(world.heat, 'ram', world);
            car.stolenSilent = true;
            break;
          }
        }
      }
      world.stats.distance += Math.abs(car.speed) * dt * 0.02;
      if (world.audio.ready) {
        world.audio.startEngine();
        world.audio.setEngine(car.speed, world.input.keys.up);
      }
      world.camera.targetZoom = 1.04;
    } else {
      PC.entities.updatePlayer(pl, world.input, dt, world);
      if (world.input.mouse.down && !world.input.mouse.wasDown) {
        if (pl.ammo <= 0) PC.combat.startReload(pl, world);
      }
      if (world.input.mouse.down && pl.fireTimer <= 0) PC.combat.tryShoot(pl, world);
      if (world.input.pressed('reload')) PC.combat.startReload(pl, world);
      if (world.audio.ready) world.audio.stopEngine();
      world.camera.targetZoom = 1.24;
    }
    world.input.mouse.wasDown = world.input.mouse.down;

    // --- the rest of the city
    for (var ti = 0; ti < world.parked.length; ti++) {
      var pk = world.parked[ti];
      if (pk.driver === 'player') continue;
      // parked cars sit still unless a chase script is driving them
    }
    for (var c2 = 0; c2 < world.traffic.length; c2++) PC.traffic.update(world.traffic[c2], dt, world, world.rng);

    var all = world.traffic.concat(world.parked, world.heat.cops);
    if (pl.inCar) all.push(pl.inCar);
    V.separateCars(all, dt);

    for (var pi2 = 0; pi2 < world.peds.length; pi2++) PC.entities.updatePed(world.peds[pi2], dt, world, world.rng);
    PC.police.update(world.heat, dt, world);
    PC.missions.update(world.missions, world, dt);
    PC.combat.updatePickups(world, dt);
    PC.effects.update(world.effects, dt);
    world.hud.update(dt);

    // --- top up the street population around the player
    if (world.traffic.length < C.TRAFFIC.max) {
      world.spawnClock = (world.spawnClock || 0) + dt;
      if (world.spawnClock > C.TRAFFIC.spawnEvery) { world.spawnClock = 0; PC.traffic.spawn(world, world.rng); }
    }
    // drop traffic far behind and respawn nearer: the streets stay busy where the player is
    for (var t3 = world.traffic.length - 1; t3 >= 0; t3--) {
      var tc = world.traffic[t3];
      if (tc.driver === 'player') continue;
      if (U.dist2(tc.x, tc.y, pl.x, pl.y) > 1800 * 1800) world.traffic.splice(t3, 1);
    }
    if (world.peds.length < C.PEDS.max) {
      world.pedClock = (world.pedClock || 0) + dt;
      if (world.pedClock > 0.7) { world.pedClock = 0; world.peds.push(spawnPedNear(world, world.rng)); }
    }
    for (var p3 = world.peds.length - 1; p3 >= 0; p3--) {
      var pd = world.peds[p3];
      if (!pd.dead && U.dist2(pd.x, pd.y, pl.x, pl.y) > 1500 * 1500) world.peds.splice(p3, 1);
    }

    updateCamera(world, dt);
    world.hud.objectiveProgress = 0;
  }

  function handleEnterExit(world) {
    var pl = world.player;
    if (world.input.pressed('enter')) {
      if (pl.inCar) {
        var car = pl.inCar;
        pl.inCar = null;
        pl.x = car.x + Math.cos(car.angle + Math.PI / 2) * (car.wid * 0.7 + 16);
        pl.y = car.y + Math.sin(car.angle + Math.PI / 2) * (car.wid * 0.7 + 16);
        pl.vx = pl.vy = 0;
        if (PC.city.collideCircle(world.city, pl.x, pl.y, 9)) {
          pl.x = car.x - Math.cos(car.angle + Math.PI / 2) * (car.wid * 0.7 + 16);
          pl.y = car.y - Math.sin(car.angle + Math.PI / 2) * (car.wid * 0.7 + 16);
        }
        car.driver = null;
        car.speed *= 0.2;
        world.audio.horn();
      } else {
        var pool = world.parked.concat(world.traffic);
        var target = V.nearestEnterable(pool, pl.x, pl.y, C.PLAYER.carEnterRange);
        if (target) {
          var wasOccupied = target.occupied;
          target.driver = 'player';
          target.speed = 0;
          pl.inCar = target;
          pl.x = target.x; pl.y = target.y;
          if (wasOccupied) {
            PC.police.commit(world.heat, 'carjack', world);
            world.stats.jacked += 1;
            world.hud.flash('Grand theft auto', P.heat);
          } else {
            world.hud.flash('Hotwired', P.accent2);
          }
          if (target === world.marineCoupe) target.stolenWhite = true;
          world.audio.horn();
        }
      }
    }
    if (pl.inCar && world.input.pressed('horn')) world.audio.horn();
  }

  function updateCamera(world, dt) {
    var pl = world.player;
    var cam = world.camera;
    var tx = pl.x, ty = pl.y;
    if (pl.inCar) {
      // lead the camera a little in the direction of travel
      tx += Math.cos(pl.inCar.angle) * Math.min(150, pl.inCar.speed * 0.42);
      ty += Math.sin(pl.inCar.angle) * Math.min(150, pl.inCar.speed * 0.42);
    } else {
      tx += Math.cos(pl.angle) * 40;
      ty += Math.sin(pl.angle) * 40;
    }
    var z = U.lerp(cam.zoom, cam.targetZoom, Math.min(1, dt * 3));
    cam.zoom = z;
    var vw = C.VW / z, vh = C.VH / z;
    var wantX = tx - vw / 2, wantY = ty - vh / 2;
    var k = Math.min(1, dt * 6.5);
    cam.x = U.lerp(cam.x, wantX, k);
    cam.y = U.lerp(cam.y, wantY, k);
    cam.x = U.clamp(cam.x, 0, Math.max(0, C.CITY_W - vw));
    cam.y = U.clamp(cam.y, 0, Math.max(0, C.CITY_H + C.BEACH_H - vh));
  }

  function triggerOver(world, kind) {
    if (world.over) return;
    world.over = true;
    world.overKind = kind;
    world.overTimer = 0;
    world.hud.banner(kind === 'busted' ? 'BUSTED' : 'WASTED', kind === 'busted' ? 'Booked and released. The city keeps your cash.' : 'The beach hospital patches you up.');
    if (kind === 'busted') world.audio.busted(); else world.audio.wasted();
  }

  /* Recover from a bust or a wipe: keep progression, take a cut of the cash. */
  function respawn(world) {
    var pl = world.player;
    world.over = false;
    world.overKind = '';
    world.overTimer = 0;
    world.money = Math.max(0, Math.floor(world.money * 0.85));
    pl.health = C.PLAYER.maxHealth;
    pl.armor = 0;
    pl.alive = true;
    pl.ammo = C.COMBAT.clipSize;
    pl.reserve = 96;
    pl.reloading = 0;
    if (pl.inCar) { pl.inCar.driver = null; pl.inCar = null; }
    var s = PC.missions.SPOTS.cafe;
    pl.x = s.x + 40; pl.y = s.y + 30;
    pl.vx = pl.vy = 0;
    PC.police.clear(world.heat, world);
    world.missions.state = 'idle';
    world.missions.job = null;
    world.missions.step = 0;
    world.hud.flash('Patched up. Get back to work.', P.accent2);
  }

  /* ---------- save and load ---------- */

  var SAVE_KEY = 'palm-city.save.v1';

  function save(world) {
    var pl = world.player;
    var data = {
      v: 1, seed: world.seed, money: world.money, storyDone: world.storyDone,
      jobIndex: world.missions.index, completed: world.missions.completed,
      log: world.missions.log.slice(),
      player: { x: pl.x, y: pl.y, health: pl.health, armor: pl.armor, ammo: pl.ammo, reserve: pl.reserve },
      stats: world.stats, time: world.time
    };
    try { window.localStorage.setItem(SAVE_KEY, JSON.stringify(data)); return true; } catch (e) { return false; }
  }

  function hasSave() {
    try { return !!window.localStorage.getItem(SAVE_KEY); } catch (e) { return false; }
  }

  function load(world) {
    var raw;
    try { raw = window.localStorage.getItem(SAVE_KEY); } catch (e) { return false; }
    if (!raw) return false;
    var data;
    try { data = JSON.parse(raw); } catch (e) { return false; }
    if (!data || data.v !== 1) return false;
    world.money = data.money || 0;
    world.storyDone = !!data.storyDone;
    world.stats = data.stats || world.stats;
    world.missions.index = Math.min(data.jobIndex || 0, PC.missions.JOBS.length);
    world.missions.completed = data.completed || 0;
    world.missions.log = data.log || [];
    world.missions.state = world.missions.index >= PC.missions.JOBS.length ? 'finished' : 'idle';
    var p = world.player;
    if (data.player) {
      p.x = data.player.x; p.y = data.player.y;
      p.health = data.player.health; p.armor = data.player.armor;
      p.ammo = data.player.ammo; p.reserve = data.player.reserve;
    }
    if (p.inCar) { p.inCar.driver = null; p.inCar = null; }
    PC.police.clear(world.heat, world);
    world.camera.x = p.x - C.VW / 2;
    world.camera.y = p.y - C.VH / 2;
    world.hud.flash('Loaded', P.accent2);
    return true;
  }

  PC.world = {
    create: createWorld, step: step, save: save, load: load,
    hasSave: hasSave, respawn: respawn, SAVE_KEY: SAVE_KEY
  };
})(window.PC = window.PC || {});
