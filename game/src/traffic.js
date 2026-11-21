/* Palm City — ambient traffic and parked cars. Every traffic car follows the grid: it drives
   toward the next intersection on its lane, and at the junction picks straight or a turn. Cars
   in front are avoided by easing off, so the streets keep moving without a stack of wrecks.
   Parked cars line the curb lanes and the beach lots, waiting to be stolen. */
(function (PC) {
  'use strict';

  var C = PC.CONFIG, U = PC.util, V = PC.vehicles;
  var HALF = C.ROAD / 2, LANE = C.LANE;

  function lanePoint(gx, gy, axis, dir) {
    // A point in the correct lane approaching intersection (gx, gy) along `axis`.
    var cx = gx * C.CELL, cy = gy * C.CELL;
    if (axis === 'x') return { x: cx, y: cy + dir * LANE };
    return { x: cx - dir * LANE, y: cy };
  }

  function makeTrafficCar(rng, gx, gy, axis, dir) {
    var car = V.makeCar(0, 0, 0, { rng: rng });
    car.traffic = true;
    car.axis = axis;
    car.dir = dir;
    car.gx = gx; car.gy = gy;
    var p = lanePoint(gx, gy, axis, dir);
    car.x = p.x; car.y = p.y;
    car.angle = axis === 'x' ? (dir > 0 ? 0 : Math.PI) : (dir > 0 ? Math.PI / 2 : -Math.PI / 2);
    car.cruise = C.TRAFFIC.speed + (rng() - 0.5) * C.TRAFFIC.speedJitter;
    car.speed = car.cruise * 0.6;
    return car;
  }

  function spawnTraffic(world, rng) {
    var tries = 0;
    while (tries++ < 14) {
      var gx = 1 + Math.floor(rng() * (C.GRID - 2));
      var gy = 1 + Math.floor(rng() * (C.GRID - 2));
      var axis = rng() < 0.5 ? 'x' : 'y';
      var dir = rng() < 0.5 ? 1 : -1;
      var p = lanePoint(gx, gy, axis, dir);
      if (U.dist2(p.x, p.y, world.player.x, world.player.y) < 420 * 420) continue;
      if (PC.city.collideCircle(world.city, p.x, p.y, 30)) continue;
      var car = makeTrafficCar(rng, gx, gy, axis, dir);
      world.traffic.push(car);
      return car;
    }
    return null;
  }

  function nextIntersection(car) {
    if (car.axis === 'x') car.gx += car.dir;
    else car.gy += car.dir;
    if (car.gx < 0) car.gx = 0; if (car.gx > C.GRID) car.gx = C.GRID;
    if (car.gy < 0) car.gy = 0; if (car.gy > C.GRID) car.gy = C.GRID;
    // bounce back off the map edge
    if (car.gx === 0 || car.gx === C.GRID) car.dir = car.axis === 'x' ? car.dir : car.dir;
  }

  function updateTrafficCar(car, dt, world, rng) {
    if (car.driver === 'player') return;
    if (car.police) return;
    if (car.frozen) return;
    // a car set to drive straight keeps its heading: used by the staged shots, and by a
    // car that has just been knocked off the grid and needs to clear the junction
    if (car.straight) {
      car.speed = U.approach(car.speed, car.cruise, 140 * dt);
      var sx = car.x + Math.cos(car.angle) * car.speed * dt;
      var sy = car.y + Math.sin(car.angle) * car.speed * dt;
      if (PC.city.collideCircle(world.city, sx, sy, car.wid * 0.5)) { car.speed *= 0.4; car.straight = false; }
      else { car.x = sx; car.y = sy; }
      return;
    }

    var target = lanePoint(car.gx, car.gy, car.axis, car.dir);
    var d = U.dist(car.x, car.y, target.x, target.y);
    if (d < 26) {
      // at the junction: straight most of the time, else turn onto the crossing road
      var newAxis = car.axis, newDir = car.dir;
      if (rng() < 0.3) {
        newAxis = car.axis === 'x' ? 'y' : 'x';
        newDir = rng() < 0.5 ? 1 : -1;
        car.axis = newAxis; car.dir = newDir;
      }
      nextIntersection(car);
      if (car.gx <= 0 || car.gx >= C.GRID) { car.dir = -car.dir; car.gx = U.clamp(car.gx, 1, C.GRID - 1); }
      if (car.gy <= 0 || car.gy >= C.GRID) { car.dir = -car.dir; car.gy = U.clamp(car.gy, 1, C.GRID - 1); }
      target = lanePoint(car.gx, car.gy, car.axis, car.dir);
      d = U.dist(car.x, car.y, target.x, target.y);
    }

    var wantAngle = Math.atan2(target.y - car.y, target.x - car.x);
    var diff = U.angleDiff(car.angle, wantAngle);

    // yield for a car directly ahead in the same lane
    var slow = 1;
    for (var i = 0; i < world.traffic.length; i++) {
      var o = world.traffic[i];
      if (o === car) continue;
      var ahead = Math.cos(car.angle) * (o.x - car.x) + Math.sin(car.angle) * (o.y - car.y);
      if (ahead > 0 && ahead < 62) {
        var side = Math.abs(-Math.sin(car.angle) * (o.x - car.x) + Math.cos(car.angle) * (o.y - car.y));
        if (side < 20) slow = 0.05;
      }
    }
    // and for the player on foot in the road
    var pAhead = Math.cos(car.angle) * (world.player.x - car.x) + Math.sin(car.angle) * (world.player.y - car.y);
    if (pAhead > 0 && pAhead < 70) {
      var pSide = Math.abs(-Math.sin(car.angle) * (world.player.x - car.x) + Math.cos(car.angle) * (world.player.y - car.y));
      if (pSide < 24) slow = Math.min(slow, 0.02);
    }

    var wanted = car.cruise * slow;
    var accel = wanted > car.speed ? C.CAR.accel * 0.6 : -C.CAR.brake;
    car.speed = U.approach(car.speed, wanted, Math.abs(accel) * dt);
    car.brake = wanted < car.speed - 4;

    car.steer = U.angleDiff(0, diff) * 2.2;
    car.angle += U.clamp(diff, -car.speed * dt / 26, car.speed * dt / 26);
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;

    // nudge a stuck car free
    if (car.speed < 6) {
      car.stuck = (car.stuck || 0) + dt;
      if (car.stuck > 4) { car.stuck = 0; nextIntersection(car); }
    } else car.stuck = 0;
  }

  /* Parked cars: a sprinkle along curb lanes and in the beach lot, a few already occupied. */
  function populateParked(world, rng) {
    var n = 0;
    for (var i = 0; i < 150 && n < 40; i++) {
      var gx = 1 + Math.floor(rng() * (C.GRID - 2));
      var gy = 1 + Math.floor(rng() * (C.GRID - 2));
      var axis = rng() < 0.5 ? 'x' : 'y';
      var dir = rng() < 0.5 ? 1 : -1;
      var side = rng() < 0.5 ? -1 : 1;
      var cx = gx * C.CELL + (axis === 'x' ? side * (HALF + 46) : 0);
      var cy = gy * C.CELL + (axis === 'y' ? side * (HALF + 46) : 0);
      if (axis === 'x') cy = gy * C.CELL + side * (HALF + 14); else cx = gx * C.CELL + side * (HALF + 14);
      var ang = axis === 'x' ? (side > 0 ? Math.PI : 0) : (side > 0 ? -Math.PI / 2 : Math.PI / 2);
      if (PC.city.collideCircle(world.city, cx, cy, 26)) continue;
      if (U.dist2(cx, cy, world.player.x, world.player.y) < 130 * 130) continue;
      var car = V.makeCar(cx, cy, ang, { rng: rng, parked: true });
      car.occupied = rng() < 0.12;
      world.parked.push(car); n++;
    }
    // the beach parking row, facing the water
    for (var b = 0; b < 8; b++) {
      var bx = C.CITY_W * 0.18 + b * 96, by = C.CITY_H + 40;
      var bc = V.makeCar(bx, by, Math.PI / 2, { rng: rng, parked: true });
      bc.occupied = rng() < 0.1;
      world.parked.push(bc);
    }
    world.trafficSpots = world.traffic.length;
  }

  PC.traffic = {
    spawn: spawnTraffic,
    update: updateTrafficCar,
    populateParked: populateParked,
    lanePoint: lanePoint
  };
})(window.PC = window.PC || {});
