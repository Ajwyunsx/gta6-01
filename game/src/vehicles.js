/* Palm City — cars. One flat model for everything on wheels: a body rectangle, a heading, a
   speed along that heading and a steering angle. Pressing E beside a parked car or an occupied
   one puts the player in it; the owner may object, which is where the wanted level starts.
   Palettes and silhouettes are this city's own: candy-coloured compacts, low cruisers, panel vans. */
(function (PC) {
  'use strict';

  var C = PC.CONFIG, P = PC.PALETTE, U = PC.util;

  var BODY_TYPES = [
    { id: 'compact', len: 44, wid: 23, top: 172, mass: 1.0 },
    { id: 'sedan', len: 54, wid: 26, top: 200, mass: 1.15 },
    { id: 'coupe', len: 58, wid: 27, top: 250, mass: 1.05 },
    { id: 'van', len: 66, wid: 29, top: 140, mass: 1.5 },
    { id: 'pickup', len: 60, wid: 28, top: 165, mass: 1.35 }
  ];
  var PAINT = ['#d94f4f', '#e8a13a', '#4b9fd4', '#7bc6a1', '#e6e0d4', '#4a4e69', '#c05e8f', '#2f3b4a', '#f0d067', '#3f8f8a', '#a2583d'];
  var GLASS = '#2d3f49';

  function makeCar(x, y, angle, opts) {
    opts = opts || {};
    var rng = opts.rng || PC.makeRng(1);
    var type = opts.type ? findType(opts.type) : U.pick(rng, BODY_TYPES);
    var car = {
      x: x, y: y, angle: angle || 0,
      speed: 0, steer: 0,
      type: type.id, len: type.len, wid: type.wid, top: type.top, mass: type.mass,
      paint: opts.paint || U.pick(rng, PAINT),
      glass: GLASS,
      health: C.CAR.health,
      driver: null,          // 'player' when the player is at the wheel
      occupied: false,       // an NPC owns it (honks, gets angry when stolen)
      parked: !!opts.parked,
      police: !!opts.police,
      cruiserLights: 0,
      sirenOn: false,
      brake: false,
      wobble: 0,
      smoke: 0,
      id: Math.floor(rng() * 1e9)
    };
    return car;
  }

  function findType(id) {
    for (var i = 0; i < BODY_TYPES.length; i++) if (BODY_TYPES[i].id === id) return BODY_TYPES[i];
    return BODY_TYPES[1];
  }

  /* ---------- driving ---------- */

  function updateCar(car, input, dt, world, isPlayer) {
    var wantThrottle = 0, wantSteer = 0, wantBrake = false;
    if (isPlayer) {
      if (input.keys.up) wantThrottle += 1;
      if (input.keys.down) wantThrottle -= 1;
      if (input.keys.left) wantSteer -= 1;
      if (input.keys.right) wantSteer += 1;
      wantBrake = !!input.keys.brake;
    }
    applyDrive(car, wantThrottle, wantSteer, wantBrake, dt, world);
  }

  function applyDrive(car, throttle, steerIn, brake, dt, world) {
    var maxF = Math.min(car.top, C.CAR.maxSpeed) * (car.police ? 1.06 : 1);
    var accel = C.CAR.accel * (throttle > 0 ? 1 : 0.62);

    if (throttle > 0) {
      car.speed += accel * dt * throttle;
    } else if (throttle < 0) {
      if (car.speed > 4) car.speed -= C.CAR.brake * dt;     // braking with reverse held
      else car.speed += accel * 0.6 * dt * throttle;
    }
    if (brake) car.speed = U.approach(car.speed, 0, C.CAR.brake * 1.4 * dt);

    // drag and a top speed that reverses lower than forwards
    var top = car.speed >= 0 ? maxF : C.CAR.reverseMax;
    car.speed = U.clamp(car.speed, -C.CAR.reverseMax, top);
    if (throttle === 0) car.speed = U.approach(car.speed, 0, C.CAR.drag * dt * (car.speed > 0 ? 1 : -1));

    // steering is strongest at low speed and fades at the top end
    var grip = Math.min(1, Math.abs(car.speed) / 60);
    var rate = C.CAR.turnRate * grip * (1 - Math.min(0.55, Math.abs(car.speed) / maxF * 0.55));
    if (car.speed < 0) rate = -rate;
    car.steer = U.approach(car.steer, steerIn * rate, dt * 12);
    car.angle += car.steer * dt;

    car.brake = brake || (throttle < 0 && car.speed > 20);

    var nx = car.x + Math.cos(car.angle) * car.speed * dt;
    var ny = car.y + Math.sin(car.angle) * car.speed * dt;

    // Buildings stop a car hard: back off, kill most of the speed, add a wobble.
    if (PC.city.collideCircle(world.city, nx, ny, car.wid * 0.5)) {
      var impact = Math.abs(car.speed);
      car.speed *= -0.22;
      car.health = Math.max(0, car.health - impact * 0.09);
      car.wobble = Math.min(1, impact / 220);
      if (impact > 90) world.effects.burst(nx, ny, 8, '#cfc6b2', 160);
      nx = car.x; ny = car.y;
    } else {
      car.x = nx; car.y = ny;
    }

    var minX = 14, maxX = C.CITY_W - 14;
    var sea = C.CITY_H + C.BEACH_H - 40;
    if (car.x < minX) { car.x = minX; car.speed *= 0.4; }
    if (car.x > maxX) { car.x = maxX; car.speed *= 0.4; }
    if (car.y < 14) { car.y = 14; car.speed *= 0.4; }
    if (car.y > sea) { car.y = sea; car.speed *= 0.4; }

    if (car.wobble > 0) car.wobble = Math.max(0, car.wobble - dt * 2.4);
    if (car.health < 40) {
      car.smoke += dt;
      if (car.smoke > 0.12) {
        car.smoke = 0;
        world.effects.puff(car.x - Math.cos(car.angle) * car.len * 0.4, car.y - Math.sin(car.angle) * car.len * 0.4);
      }
    }
  }

  /* Coarse car-on-car separation so a pile-up is a shove, not a stack. */
  function separateCars(cars, dt) {
    for (var i = 0; i < cars.length; i++) {
      for (var j = i + 1; j < cars.length; j++) {
        var a = cars[i], b = cars[j];
        var dx = b.x - a.x, dy = b.y - a.y;
        var d2 = dx * dx + dy * dy;
        var minD = (a.wid + b.wid) * 0.6 + 6;
        if (d2 > minD * minD || d2 === 0) continue;
        var d = Math.sqrt(d2);
        var push = (minD - d) * 0.5;
        var ux = dx / d, uy = dy / d;
        a.x -= ux * push; a.y -= uy * push;
        b.x += ux * push; b.y += uy * push;
        var rel = Math.abs(a.speed - b.speed);
        a.speed *= 0.82; b.speed *= 0.82;
        if (rel > 120) { a.health -= rel * 0.05; b.health -= rel * 0.05; }
      }
    }
  }

  /* The car nearest the player that is close enough to enter. */
  function nearestEnterable(cars, x, y, range) {
    var best = null, bestD = range * range;
    for (var i = 0; i < cars.length; i++) {
      var c = cars[i];
      if (c.driver === 'player') continue;
      if (c.health <= 0) continue;
      var d2 = U.dist2(x, y, c.x, c.y);
      if (d2 < bestD) { bestD = d2; best = c; }
    }
    return best;
  }

  /* ---------- drawing ---------- */

  function drawCar(ctx, car, t) {
    var L = car.len, W = car.wid;
    ctx.save();
    ctx.translate(car.x, car.y);
    if (car.wobble > 0) ctx.rotate(Math.sin(t * 40) * car.wobble * 0.04);
    ctx.rotate(car.angle);
    // shadow
    ctx.fillStyle = 'rgba(50,35,25,0.25)';
    ctx.fillRect(-L / 2 + 4, -W / 2 + 5, L, W);
    // body
    ctx.fillStyle = car.paint;
    U.roundRect(ctx, -L / 2, -W / 2, L, W, W * 0.32);
    ctx.fill();
    // bonnet and boot shade
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.fillRect(-L / 2 + 4, -W / 2 + 2, L * 0.18, W - 4);
    ctx.fillRect(L / 2 - L * 0.16, -W / 2 + 2, L * 0.16 - 4, W - 4);
    // cabin / windscreen
    ctx.fillStyle = car.glass;
    U.roundRect(ctx, -L * 0.16, -W * 0.36, L * 0.4, W * 0.72, 5);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.fillRect(-L * 0.14, -W * 0.3, L * 0.08, W * 0.6);
    // roof highlight
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    ctx.fillRect(-L * 0.2, -W * 0.18, L * 0.36, W * 0.1);
    // headlights
    ctx.fillStyle = car.brake ? '#ff6b5a' : '#fff3cf';
    ctx.fillRect(L / 2 - 3, -W / 2 + 3, 3, 5);
    ctx.fillRect(L / 2 - 3, W / 2 - 8, 3, 5);
    ctx.fillStyle = '#c8453c';
    ctx.fillRect(-L / 2, -W / 2 + 3, 2.5, 4);
    ctx.fillRect(-L / 2, W / 2 - 7, 2.5, 4);
    // wheels
    ctx.fillStyle = '#1c1c1f';
    ctx.fillRect(L * 0.28, -W / 2 - 1, 7, 3);
    ctx.fillRect(L * 0.28, W / 2 - 2, 7, 3);
    ctx.fillRect(-L * 0.36, -W / 2 - 1, 7, 3);
    ctx.fillRect(-L * 0.36, W / 2 - 2, 7, 3);

    if (car.police) drawPoliceLivery(ctx, car, L, W, t);
    if (car.health <= 0) {
      ctx.fillStyle = 'rgba(30,20,15,0.5)';
      U.roundRect(ctx, -L / 2, -W / 2, L, W, W * 0.32);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawPoliceLivery(ctx, car, L, W, t) {
    ctx.fillStyle = '#f2f0e8';
    ctx.fillRect(-L / 2 + 3, -W / 2 + 3, L * 0.3, W - 6);
    ctx.fillStyle = '#1c2b45';
    ctx.fillRect(-L / 2 + 3, -1.8, L - 6, 3.6);
    // light bar
    var flash = Math.sin(t * 14 + car.id) > 0;
    ctx.fillStyle = flash ? '#ff3b3b' : '#3b7bff';
    ctx.fillRect(-L * 0.06, -W / 2 + 2, 8, W / 2 - 3);
    ctx.fillStyle = flash ? '#3b7bff' : '#ff3b3b';
    ctx.fillRect(-L * 0.06, 1, 8, W / 2 - 3);
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.beginPath(); ctx.arc(-L * 0.06 + 4, flash ? -W * 0.25 : W * 0.25, 7, 0, 6.283); ctx.fill();
  }

  PC.vehicles = {
    makeCar: makeCar,
    updateCar: updateCar,
    applyDrive: applyDrive,
    separateCars: separateCars,
    nearestEnterable: nearestEnterable,
    drawCar: drawCar,
    TYPES: BODY_TYPES,
    PAINT: PAINT
  };
})(window.PC = window.PC || {});
