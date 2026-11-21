// shots.js — four deterministic scenes for the screenshot pass. Each one plants the world in
// an exact state (?shot=N), warms it up a fixed number of steps and lets the normal renderer
// draw it. Nothing here invents art: every pixel comes from the same draw path the player sees.
(function () {
  'use strict';
  var PC = window.PC;
  var CFG = PC.CFG;
  var U = PC.U;

  // Place the player car exactly, kill its speed and point it down a named heading.
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

  // A few static cars parked in frame, at exact spots.
  function propCar(world, x, y, angle, modelIndex) {
    var model = PC.CAR_MODELS[modelIndex % PC.CAR_MODELS.length];
    var car = new PC.Car(x, y, angle, model, world.rng);
    car.parked = true;
    world.cars.list.push(car);
    return car;
  }

  function cops(world, n, cx, cy) {
    for (var k = 0; k < n; k++) {
      var ang = (k / n) * 6.283 + 0.4;
      var x = cx + Math.cos(ang) * 230;
      var y = cy + Math.sin(ang) * 230;
      var car = new PC.Car(x, y, Math.atan2(cy - y, cx - x), {
        name: 'Marlowe Cruiser', body: '#f2f0e6', trim: '#2b3a5e',
        len: 104, wid: 50, top: 700, accel: 760, handling: 1.0, seats: 4,
      }, world.rng);
      car.driver = 'police';
      car.occupied = true;
      car.siren = true;
      world.cars.list.push(car);
      var unit = new PC.CopUnit(car, null, x, y);
      world.police.units.push(unit);
      world.police.cruisers.push(car);
    }
    world.police.sirenOn = true;
  }

  function crowd(world, cx, cy, n, radius) {
    for (var k = 0; k < n; k++) {
      var a = (k / n) * 6.283;
      var r = radius * (0.5 + (k % 3) * 0.25);
      world.peds.spawnAt(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    }
  }

  function laneCars(world) {
    // a couple of traffic cars planted in lane so the street is not empty
    var defs = [
      [CFG.CELL * 3 + 55, 700, Math.PI / 2, 3],
      [CFG.CELL * 3 + 55, 1500, Math.PI / 2, 1],
      [CFG.CELL * 3 + 55, 2200, -Math.PI / 2, 6],
      [600, CFG.CELL * 3 + 55, 0, 2],
      [1700, CFG.CELL * 3 + 55, Math.PI, 4],
    ];
    for (var k = 0; k < defs.length; k++) {
      var d = defs[k];
      var car = new PC.Car(d[0], d[1], d[2], PC.CAR_MODELS[d[3] % PC.CAR_MODELS.length], world.rng);
      car.driver = 'traffic';
      car.occupied = true;
      car.vx = Math.cos(d[2]) * 200;
      car.vy = Math.sin(d[2]) * 200;
      world.cars.list.push(car);
    }
  }

  function setup(world, input, n) {
    world.ui.screen = 'playing';
    world.player.cash = 4820;
    world.player.ammo = 32;
    world.player.health = 78;
    world.player.armour = 62;

    var AX = CFG.CELL * 3 + CFG.ROAD / 2;   // the central avenue

    if (n === 1) {
      // cover: in a car on the main avenue, neon and traffic around, HUD and minimap live
      clearTraffic(world);
      var x = AX + 26, y = 1180;
      var car = parkCar(world, x, y, -Math.PI / 2, 0);
      car.vx = -140;
      car.vy = 0;
      laneCars(world);
      propCar(world, AX - 190, y + 210, -Math.PI / 2, 3);
      crowd(world, AX + 180, y + 60, 9, 90);
      world.player.wanted = 0;
      world.camera.zoom = 0.86;
      world.camera.x = x + 40;
      world.camera.y = y - 120;
      world.shotCam = { x: x + 30, y: y - 150, zoom: 0.86 };
      world.hud.banner('PALM CITY', 'The strip at golden hour — seven jobs wait on the map');
      return warm;
    }
    if (n === 2) {
      // on foot: player mid-pavement in a shop block, peds, a marker ahead
      clearTraffic(world);
      var bx = CFG.CELL * 2 + CFG.ROAD;
      var by = CFG.CELL * 3 + CFG.ROAD;
      world.player.inCar = null;
      world.player.x = bx + 150;
      world.player.y = by + CFG.BLOCK - 34;
      world.player.angle = -Math.PI / 2;
      world.player.vx = 40;
      world.player.vy = -60;
      crowd(world, bx + 170, by + CFG.BLOCK - 60, 12, 120);
      for (var k = 0; k < 3; k++) {
        propCar(world, bx + 40 + k * 120, by + CFG.BLOCK + 60, 0, k + 2);
      }
      world.police.stars = 0;
      world.shotCam = { x: bx + 150, y: by + CFG.BLOCK - 160, zoom: 1.05 };
      world.camera.zoom = 1.05;
      world.hud.banner('ON FOOT', 'Coral Heights — the pavement is busier than it looks');
      return warm;
    }
    if (n === 3) {
      // police: three stars, cruisers closing, one officer on foot with a drawn pistol
      clearTraffic(world);
      var px = AX - 26, py = 1560;
      var pcar = parkCar(world, px, py, -Math.PI / 2, 7);
      pcar.vx = -60;
      world.police.stars = 3;
      world.police.heat = 3;
      world.player.wanted = 3;
      cops(world, 3, px, py - 220);
      var officer = new PC.Officer(px + 120, py - 150);
      officer.angle = Math.atan2(py - officer.y, px - officer.x);
      world.police.units.push(new PC.CopUnit(null, officer, officer.x, officer.y));
      world.police.units[world.police.units.length - 1].state = 'foot';
      world.police.sirenOn = true;
      crowd(world, px + 240, py + 40, 6, 70);
      world.shotCam = { x: px + 40, y: py - 130, zoom: 0.92 };
      world.camera.zoom = 0.92;
      world.hud.banner('WANTED', 'Three stars. Every cruiser on the strip is heading your way.');
      return warm;
    }
    if (n === 4) {
      // mission: an active defend job with a crew closing in and the objective on the HUD
      clearTraffic(world);
      var site = world.city.markers.club;
      world.missions.index = 5;
      world.missions.state = 'active';
      world.missions.briefing = null;
      world.missions.kills = 2;
      world.missions.waveLeft = 1;
      world.player.inCar = null;
      world.player.x = site.x + 40;
      world.player.y = site.y + 70;
      world.player.angle = -1.2;
      world.player.ammo = 14;
      world.player.health = 64;
      world.aiming = true;
      for (var h = 0; h < 4; h++) {
        var ha = 0.6 + h * 0.42;
        var hx = site.x + Math.cos(ha) * (220 + h * 30);
        var hy = site.y + Math.sin(ha) * (220 + h * 30);
        var hostile = world.spawnHostile(hx, hy, 1);
        hostile.angle = Math.atan2(world.player.y - hy, world.player.x - hx);
        hostile.fireClock = 0.6 + h * 0.3;
      }
      crowd(world, site.x - 140, site.y + 120, 8, 90);
      world.camera.zoom = 0.98;
      world.shotCam = { x: site.x + 10, y: site.y + 40, zoom: 0.98 };
      world.combat.tracers.push({ x1: site.x + 40, y1: site.y + 70, x2: site.x + 200, y2: site.y + 10, life: 0.5, max: 0.5 });
      world.hud.banner('LAST CALL', 'Defend the Sandbar Club (2/6)');
      return warm;
    }
    return null;
  }

  function warm(dt, world) {
    // hold the staged camera and let particles settle for a beat
    world.camera.x = world.shotCam.x;
    world.camera.y = world.shotCam.y;
    world.camera.zoom = world.shotCam.zoom;
    void dt;
  }

  window.PCShots = { setup: setup };
})();
