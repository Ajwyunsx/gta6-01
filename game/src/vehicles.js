// Palm City — vehicles on the road: arcade physics for the car the player is driving,
// parked cars you can steal, and the shared car body every system reads.
(function (global) {
  'use strict';

  const PC = global.PC;
  const C = PC.CAR;

  function makeCar(x, y, angle, colour) {
    return {
      x,
      y,
      angle: angle ?? 0,
      vx: 0,
      vy: 0,
      speed: 0,            // signed forward speed, px/s
      steer: 0,
      colour: colour || '#e9553f',
      length: C.length,
      width: C.width,
      radius: C.radius,
      health: 100,
      occupied: false,
      driver: null,        // 'player' | 'traffic' | 'police' | null
      siren: false,
      headlights: true,
      wobble: 0,
    };
  }

  /**
   * Arcade car physics. Throttle is -1..1 (1 forward), steer is -1..1. The car moves along
   * its facing with a lateral grip term so it slides a little at speed without ever
   * feeling like it is on ice.
   */
  function drive(car, throttle, steer, handbrake, dt) {
    const forward = { x: Math.cos(car.angle), y: Math.sin(car.angle) };
    const right = { x: -forward.y, y: forward.x };

    // Decompose world velocity into the car's frame.
    let vLong = car.vx * forward.x + car.vy * forward.y;
    let vLat = car.vx * right.x + car.vy * right.y;

    if (throttle > 0) vLong += C.accel * throttle * dt;
    else if (throttle < 0) vLong += (vLong > 0 ? -C.brake : C.reverse) * throttle * dt;
    else vLong *= Math.pow(C.drag, dt * 60);

    if (handbrake) vLong *= Math.pow(0.93, dt * 60);

    vLong = PC.clamp(vLong, -C.maxReverse, C.maxSpeed);

    // Steering turns the body; the faster you go the less the wheels bite, so full lock at
    // speed is a wide arc rather than a spin.
    const grip = handbrake ? C.handbrakeGrip : C.grip;
    const speedFactor = Math.min(1, Math.abs(vLong) / 140);
    car.angle += steer * C.steer * speedFactor * Math.sign(vLong || 1) * dt;

    // Lateral velocity bleeds off with grip: that is what makes the car feel planted.
    vLat *= Math.pow(1 / (1 + grip * dt), 1);

    const nf = { x: Math.cos(car.angle), y: Math.sin(car.angle) };
    const nr = { x: -nf.y, y: nf.x };
    car.vx = nf.x * vLong + nr.x * vLat;
    car.vy = nf.y * vLong + nr.y * vLat;
    car.speed = vLong;

    car.x += car.vx * dt;
    car.y += car.vy * dt;

    if (Math.abs(vLat) > 40) car.wobble = Math.min(1, Math.abs(vLat) / 120);
    else car.wobble *= 0.9;
  }

  /** Stop a car dead (used when it hits a wall). */
  function crash(car, factor) {
    const k = factor ?? -0.28;
    car.vx *= k;
    car.vy *= k;
    car.speed *= k;
    car.wobble = 1;
  }

  /**
   * Keep a car out of buildings: push it back along the collision normal and bleed speed.
   * Returns true when it hit something this step.
   */
  function collideWithCity(car, city) {
    let hit = false;
    const r = car.radius;
    for (const b of city.buildings) {
      const nx = PC.clamp(car.x, b.x, b.x + b.w);
      const ny = PC.clamp(car.y, b.y, b.y + b.h);
      const dx = car.x - nx;
      const dy = car.y - ny;
      const d2 = dx * dx + dy * dy;
      if (d2 < r * r) {
        const d = Math.sqrt(d2) || 0.001;
        const push = (r - d) / d;
        car.x += dx * push;
        car.y += dy * push;
        crash(car, -0.2);
        car.health = Math.max(0, car.health - 1.2);
        hit = true;
      }
    }
    // The sea is a wall too.
    if (car.y > city.waterTop - 20) {
      car.y = city.waterTop - 20;
      crash(car, -0.15);
    }
    car.x = PC.clamp(car.x, 12, PC.WORLD - 12);
    car.y = PC.clamp(car.y, 12, PC.WORLD - 12);
    return hit;
  }

  /** Player steals a car: park them in the driver's seat. */
  function playerEnter(player, car) {
    if (car.driver) return false;
    player.inCar = car;
    car.driver = 'player';
    car.occupied = true;
    player.x = car.x;
    player.y = car.y;
    return true;
  }

  function playerExit(player, car) {
    if (!car) return;
    const side = car.angle + Math.PI / 2;
    player.x = car.x + Math.cos(side) * (car.width / 2 + 14);
    player.y = car.y + Math.sin(side) * (car.width / 2 + 14);
    player.facing = car.angle;
    player.inCar = null;
    car.driver = null;
    car.occupied = false;
  }

  /** The nearest car within reach of a point, for the "steal" prompt and the cops. */
  function nearestCar(cars, x, y, maxDist) {
    let best = null;
    let bestD = maxDist ?? 1e9;
    for (const c of cars) {
      if (c.driver === 'player') continue;
      const d = PC.dist(x, y, c.x, c.y);
      if (d < bestD) {
        bestD = d;
        best = c;
      }
    }
    return best;
  }

  /** Skid marks: the rear wheels leave a trail when the car slides. */
  function skidAmount(car) {
    return Math.min(1, Math.abs(car.wobble) * 1.4);
  }

  PC.Vehicles = { makeCar, drive, crash, collideWithCity, playerEnter, playerExit, nearestCar, skidAmount };
})(window);
