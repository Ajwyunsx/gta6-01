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
    car.brakeLight = 0;
    propCar(world, x + 52, y - 95, Math.PI / 2, 1);
    propCar(world, x + 52, y + 185, Math.PI / 2, 6);
    propCar(world, x + 52, y + 400, Math.PI / 2, 2);
    propCar(world, x - 70, y + 300, 0, 4);
    crowd(world, CFG.SAND_X + 74, y - 30, 13, 175);
    crowd(world, x - 250, y + 150, 10, 135);
    world.city.props.push({ type: 'umbrella', x: CFG.SAND_X + 168, y: y - 132, rot: 0.35, color: CFG.colors.neon[0] });
    world.city.props.push({ type: 'umbrella', x: CFG.SAND_X + 214, y: y + 96, rot: -0.4, color: CFG.colors.neon[1] });
    world.city.props.push({ type: 'lounger', x: CFG.SAND_X + 132, y: y - 96, rot: 0.28 });
    world.city.props.push({ type: 'lounger', x: CFG.SAND_X + 178, y: y + 138, rot: -0.3 });
    world.police.units.length = 0;
    world.police.stars = 0;
    world.shotCam = { x: x + 66, y: y - 58, zoom: 1.44, follow: true, dx: 66, dy: -58 };
    world.camera.zoom = 1.44;
    world.camera.x = x + 66;
    world.camera.y = y - 58;
    world.hud.banner('PALM CITY', 'The strip at golden hour — seven jobs wait on the map');
    return true;
  };

  // 2 — ON FOOT. Mid-pavement in a shop block, pedestrians all round, the job marker ahead.
  SCENES[2] = function (world) {
    clearTraffic(world);
    // On foot in the middle of a downtown crossing: he is walking east across the paint, a
    // queue of cars waits at the light, the crowd crosses with him, towers lean overhead.
    var ix = CFG.CELL * 4 + CFG.ROAD / 2;   // the crossroads centre line, both ways
    var wx = ix - 34;
    var wy = ix + 26;

    world.player.inCar = null;
    world.player.x = wx;
    world.player.y = wy;
    world.player.angle = 0.02;
    world.player.vx = 62;
    world.player.vy = 6;
    world.player.stride = 3.2;
    world.player.health = 78;
    world.player.armour = 44;
    world.aiming = false;

    var mates = [
      [wx + 96, wy + 22, 0.1], [wx - 74, wy - 26, 3.1], [wx + 168, wy - 8, 2.9],
      [wx + 42, wy - 96, 1.6], [ix - 150, ix + 128, -0.4], [ix + 132, ix + 116, 2.6]
    ];
    for (var m = 0; m < mates.length; m++) {
      var ped = world.peds.spawnAt(mates[m][0], mates[m][1]);
      if (ped) ped.angle = mates[m][2];
    }
    // traffic held at the light: two lanes coming north, two going south
    propCar(world, ix - 26, ix + 200, -Math.PI / 2, 2);
    propCar(world, ix + 26, ix + 268, Math.PI / 2, 5);
    propCar(world, ix - 26, ix - 172, -Math.PI / 2, 1);
    propCar(world, ix + 26, ix - 236, Math.PI / 2, 6);
    propCar(world, ix + 210, ix - 26, Math.PI, 3);
    propCar(world, ix - 208, ix + 26, 0, 0);
    world.police.stars = 0;
    world.police.units.length = 0;
    world.shotCam = { x: wx + 46, y: wy + 16, zoom: 1.92 };
    world.camera.zoom = 1.92;
    world.camera.x = wx + 46;
    world.camera.y = wy + 16;
    world.hud.banner('ON FOOT', 'Downtown crossing — the strip on a Friday night');
    return true;
  }; SCENES[3] = function (world) {
    clearTraffic(world);
    // The bust: the player's coupe is stopped in the eastbound lane with a cruiser pulled up
    // nose-to-nose in front and a second one blocking behind. A third is slewing in across
    // the inside lane, and two officers are out of their cars on the tarmac with pistols up.
    // Tight camera so the light bars, the blue doors and the star row all read at once.
    var roadY = CFG.CELL * 4 + CFG.ROAD / 2;
    var laneS = roadY + 26;
    var laneN = roadY - 28;
    var cx = 1520;

    var pcar = parkCar(world, cx, laneS, 0, 0);
    pcar.speed = 0;

    var ahead = copCar(world, cx + 196, laneS + 4, Math.PI - 0.02);
    var behind = copCar(world, cx - 206, laneS + 4, 0.02);
    var cutting = copCar(world, cx + 148, laneN - 10, Math.PI - 0.86);
    var cops = [ahead, behind, cutting];
    for (var c = 0; c < cops.length; c++) {
      cops[c].speed = 0;
      cops[c].vx = 0;
      cops[c].vy = 0;
      world.police.units.push(new PC.CopUnit(cops[c], null, cops[c].x, cops[c].y));
    }

    // officers on foot, both on the ocean side of the player's car, out of the line of fire
    var offA = new PC.Officer(cx + 104, laneS + 56);
    offA.angle = Math.PI + 0.48;
    var offB = new PC.Officer(cx - 92, laneS + 62);
    offB.angle = Math.PI - 0.34;
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
    world.player.health = 58;
    world.player.armour = 30;
    crowd(world, cx - 60, roadY - 120, 8, 92);
    world.shotCam = { x: cx + 16, y: laneS - 34, zoom: 1.90, allowHeat: true };
    world.camera.zoom = 1.90;
    world.camera.x = cx + 16;
    world.camera.y = laneS - 34;
    world.hud.banner('WANTED', 'Three stars. Every cruiser on the strip is heading your way.');
    return true;
  };

  // 4 — MISSION. An active defend job with the crew closing in, a tracer in the air and the
  // objective on the HUD.
  SCENES[4] = function (world) {
    clearTraffic(world);
    // The defence outside the Sandbar Club: the player has his back to the sea, the crew is
    // coming at him down the side street, the club's pink sign is lit behind them. Tracer in
    // the air, muzzle flash on the tarmac, red pips over the shooters, job banner on top.
    var club = world.city.markers.club;
    var px = club.x + 24;
    var py = club.y + 208;            // on the road south of the club
    world.missions.index = 5;
    world.missions.state = 'active';
    world.missions.briefing = null;
    world.missions.kills = 2;
    world.missions.waveLeft = 1;
    world.player.inCar = null;
    world.player.x = px;
    world.player.y = py;
    world.player.angle = -Math.PI / 2 - 0.22;    // facing north, toward the club
    world.player.ammo = 14;
    world.player.health = 66;
    world.player.armour = 12;
    world.player.stride = 1.6;
    world.aiming = true;
    world.hostiles.length = 0;

    var arcs = [-0.66, -0.24, 0.1, 0.44, 0.78];
    for (var h = 0; h < arcs.length; h++) {
      var ha = -Math.PI / 2 + arcs[h];
      var dist = 126 + (h % 3) * 40;
      var hx = px + Math.cos(ha) * dist;
      var hy = py + Math.sin(ha) * dist;
      var hostile = world.spawnHostile(hx, hy, 1);
      hostile.angle = Math.atan2(py - hy, px - hx);
      hostile.fireClock = 0.4 + h * 0.24;
      hostile.stride = 0.9 + h * 0.28;
    }
    // cover: a car at his shoulder, another slewed in the near lane
    propCar(world, px + 92, py + 14, Math.PI / 2, 7);
    propCar(world, px - 156, py - 28, Math.PI / 2 + 0.14, 1);
    propCar(world, px + 30, py + 226, 0, 5);
    world.combat.tracers.push({ x1: px, y1: py - 6, x2: px + 30, y2: py - 182, life: 4, max: 4 });
    world.combat.tracers.push({ x1: px - 206, y1: py - 96, x2: px - 34, y2: py - 14, life: 4, max: 4 });
    world.effects.particles.push({ x: px + 10, y: py - 16, vx: 24, vy: -46, life: 4, max: 4, size: 6, color: '#ffd98a' });
    world.effects.particles.push({ x: px + 22, y: py - 24, vx: 40, vy: -70, life: 4, max: 4, size: 4, color: '#ffe9b5' });
    crowd(world, px - 190, py + 190, 7, 74);
    world.shotCam = { x: px + 10, y: club.y + 150, zoom: 1.60 };
    world.camera.zoom = 1.60;
    world.camera.x = px + 10;
    world.camera.y = club.y + 150;
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
