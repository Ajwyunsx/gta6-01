// shots.js — four deterministic scenes for the screenshot pass. Each one plants the world in
// an exact state (?shot=N), warms it up a fixed number of steps and lets the normal renderer
// draw it. Nothing here invents art: every pixel comes from the same draw path the player sees.
(function () {
  'use strict';
  var PC = window.PC;
  var CFG = PC.CFG;

  var AVENUE = CFG.GRID * CFG.CELL + CFG.ROAD / 2;   // the beach-side avenue's centre line

  function copCar(world, x, y, angle) {
    var car = new PC.Car(x, y, angle, {
      name: 'Marlowe Cruiser', body: '#f2f0e6', trim: '#2b3a5e',
      len: 104, wid: 50, top: 700, accel: 760, handling: 1.0, seats: 4,
    }, world.rng);
    car.driver = 'police';
    car.occupied = true;
    car.siren = true;
    world.cars.list.push(car);
    return car;
  }

  // Place the player in a car exactly, at rest and facing a held heading.
  function parkCar(world, x, y, angle, modelIndex) {
    var model = PC.CAR_MODELS[modelIndex % PC.CAR_MODELS.length];
    var car = new PC.Car(x, y, angle, model, world.rng);
    car.driver = 'player';
    car.occupied = true;
    world.cars.list.push(car);
    world.player.inCar = car;
    world.player.x = x;
    world.player.y = y;
    world.player.angle = angle;
    world.camera.x = x;
    world.camera.y = y;
    return car;
  }

  function clearTraffic(world) {
    world.traffic.clear();
  }

  // A parked car at an exact spot; used to compose a street.
  function propCar(world, x, y, angle, modelIndex) {
    var model = PC.CAR_MODELS[modelIndex % PC.CAR_MODELS.length];
    var car = new PC.Car(x, y, angle, model, world.rng);
    car.parked = true;
    world.cars.list.push(car);
    return car;
  }

  function crowd(world, cx, cy, n, radius) {
    for (var k = 0; k < n; k++) {
      var a = (k / n) * 6.283;
      var rr = radius * (0.34 + (k % 4) * 0.19);
      world.peds.spawnAt(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
    }
  }

  var SCENES = {};

  // 1 — COVER. In a car on the beach avenue: ocean and pier on the right, neon shop row on
  // the left, oncoming traffic, pedestrians on the sand. HUD, minimap and speedometer are
  // all live, and a job marker sits on the map.
  SCENES[1] = function (world) {
    clearTraffic(world);
    var x = AVENUE - 26;
    var y = 1980;
    var car = parkCar(world, x, y, -Math.PI / 2, 0);
    car.vx = 0;
    car.vy = -170;
    car.speed = 170;
    propCar(world, x + 52, y - 95, Math.PI / 2, 1);
    propCar(world, x + 52, y + 185, Math.PI / 2, 6);
    propCar(world, x + 52, y + 400, Math.PI / 2, 2);
    propCar(world, x - 70, y + 300, 0, 4);
    crowd(world, CFG.SAND_X + 74, y - 30, 13, 175);
    crowd(world, x - 250, y + 150, 10, 135);
    world.police.units.length = 0;
    world.police.stars = 0;
    world.shotCam = { x: x, y: y - 120, zoom: 0.92, follow: true, dx: 4, dy: -120 };
    world.camera.zoom = 0.92;
    world.camera.x = x;
    world.camera.y = y - 120;
    world.hud.banner('PALM CITY', 'The strip at golden hour — seven jobs wait on the map');
    return true;
  };

  // 2 — ON FOOT. Mid-pavement in a shop block, pedestrians all round, the job marker ahead.
  SCENES[2] = function (world) {
    clearTraffic(world);
    var bx = CFG.CELL * 2 + CFG.ROAD;
    var by = CFG.CELL * 3 + CFG.ROAD;
    world.player.inCar = null;
    world.player.x = bx + 190;
    world.player.y = by + CFG.BLOCK - 30;
    world.player.angle = -Math.PI / 2;
    world.player.vx = 26;
    world.player.vy = -70;
    world.player.stride = 2.1;
    world.player.health = 82;
    world.player.armour = 48;
    crowd(world, bx + 210, by + CFG.BLOCK - 76, 13, 130);
    for (var k = 0; k < 3; k++) {
      propCar(world, bx + 40 + k * 118, by + CFG.BLOCK + 62, 0, k + 2);
    }
    world.police.stars = 0;
    world.police.units.length = 0;
    world.shotCam = { x: bx + 190, y: by + CFG.BLOCK - 170, zoom: 1.06 };
    world.camera.zoom = 1.06;
    world.camera.x = bx + 190;
    world.camera.y = by + CFG.BLOCK - 170;
    world.hud.banner('ON FOOT', 'Coral Heights — the pavement is busier than it looks');
    return true;
  };

  // 3 — POLICE. Three stars; cruisers box the player's car on the avenue and officers are
  // out on foot with pistols drawn. Stars, siren glow and minimap all show the chase.
  SCENES[3] = function (world) {
    clearTraffic(world);
    var px = AVENUE - 26;             // player's lane, southbound
    var ox = AVENUE + 28;             // the oncoming lane, three metres away
    var py = 1480;
    var pcar = parkCar(world, px, py, -Math.PI / 2, 7);
    pcar.vy = -40;

    // the roadblock: one cruiser nose-to-nose, another pulled up alongside, a third
    // cutting in behind with its light bar already turning
    var blockA = copCar(world, px, py - 176, Math.PI / 2);
    var blockB = copCar(world, ox, py - 22, Math.PI / 2);
    var blockC = copCar(world, ox, py + 196, Math.PI / 2 - 0.16);
    blockA.speed = 0;
    blockB.speed = 0;
    blockC.speed = 0;
    world.police.units.push(new PC.CopUnit(blockA, null, blockA.x, blockA.y));
    world.police.units.push(new PC.CopUnit(blockB, null, blockB.x, blockB.y));
    world.police.units.push(new PC.CopUnit(blockC, null, blockC.x, blockC.y));

    // two officers out of their cars, pistols up, one on each flank
    var offA = new PC.Officer(px + 44, py - 104);
    offA.angle = Math.atan2(py - offA.y, px - offA.x);
    var offB = new PC.Officer(px - 46, py + 44);
    offB.angle = Math.atan2(py - offB.y, px - offB.x) - 0.12;
    var uA = new PC.CopUnit(null, offA, offA.x, offA.y);
    var uB = new PC.CopUnit(null, offB, offB.x, offB.y);
    uA.state = 'foot';
    uB.state = 'foot';
    world.police.units.push(uA);
    world.police.units.push(uB);

    world.police.stars = 3;
    world.police.heat = 3;
    world.player.wanted = 3;
    world.police.sirenOn = true;
    crowd(world, px - 210, py + 150, 6, 80);
    world.shotCam = { x: px + 12, y: py - 78, zoom: 1.16, allowHeat: true };
    world.camera.zoom = 1.16;
    world.camera.x = px + 12;
    world.camera.y = py - 78;
    world.hud.banner('WANTED', 'Three stars. Every cruiser on the strip is heading your way.');
    return true;
  };

  // 4 — MISSION. An active defend job with the crew closing in, a tracer in the air and the
  // objective on the HUD.
  SCENES[4] = function (world) {
    clearTraffic(world);
    var site = world.city.markers.club;
    world.missions.index = 5;
    world.missions.state = 'active';
    world.missions.briefing = null;
    world.missions.kills = 2;
    world.missions.waveLeft = 1;
    world.player.inCar = null;
    world.player.x = site.x + 30;
    world.player.y = site.y + 96;
    world.player.angle = -1.15;
    world.player.ammo = 14;
    world.player.health = 66;
    world.player.armour = 12;
    world.player.stride = 1.4;
    world.aiming = true;
    world.hostiles.length = 0;
    for (var h = 0; h < 5; h++) {
      var ha = 0.35 + h * 0.52;
      var hx = site.x + Math.cos(ha) * (210 + h * 26);
      var hy = site.y + Math.sin(ha) * (210 + h * 26);
      var hostile = world.spawnHostile(hx, hy, 1);
      hostile.angle = Math.atan2(world.player.y - hy, world.player.x - hx);
      hostile.fireClock = 0.5 + h * 0.28;
      hostile.stride = 0.9 + h * 0.3;
    }
    crowd(world, site.x - 150, site.y + 130, 9, 95);
    propCar(world, site.x - 90, site.y + 200, 0, 3);
    world.combat.tracers.push({ x1: site.x + 30, y1: site.y + 96, x2: site.x + 210, y2: site.y - 10, life: 0.5, max: 0.5 });
    world.shotCam = { x: site.x + 10, y: site.y + 46, zoom: 0.96 };
    world.camera.zoom = 0.96;
    world.camera.x = site.x + 10;
    world.camera.y = site.y + 46;
    world.hud.banner('LAST CALL', 'Defend the Sandbar Club (2/6)');
    return true;
  };

  function setup(world, input, n) {
    world.ui.screen = 'playing';
    world.player.cash = 4820;
    world.player.ammo = 32;
    world.player.health = 78;
    world.player.armour = 62;
    var scene = SCENES[n];
    if (!scene) return null;
    scene(world);
    return warm;
  }

  // Every step of the shot pass pins the camera to the scene's composition; scene 1 rides
  // along with the car so the shot shows the car where the arithmetic put it.
  function warm(dt, world) {
    var cam = world.shotCam;
    if (!cam) return;
    if (!cam.allowHeat) {
      // the staged streets are not a crime scene unless the scene says so
      world.police.stars = 0;
      world.police.heat = 0;
      world.player.wanted = 0;
      if (world.police.units.length === 0) world.police.sirenOn = false;
    }
    if (cam.follow) {
      cam.x = world.player.x + (cam.dx || 0);
      cam.y = world.player.y + (cam.dy || 0);
    }
    world.camera.x = cam.x;
    world.camera.y = cam.y;
    world.camera.zoom = cam.zoom;
    void dt;
  }

  window.PCShots = { setup: setup };
})();
