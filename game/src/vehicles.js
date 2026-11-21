// vehicles.js — arcade driving: throttle, braking, steering that loses grip with speed,
// the handbrake drift, and collisions against the city and other cars. Also the
// enter/exit car handoff and the traffic-car steering that follows a lane.

import { CAR, WORLD } from './config.js';
import { buildingAt } from './city.js';
import { clamp, wrapAngle } from './random.js';

// Drive one car for one frame. `controls` is {throttle:-1..1, steer:-1..1, handbrake}
// and is the same shape whether a human or the traffic brain fills it in.
export function driveCar(car, controls, dt, city) {
  const throttle = clamp(controls.throttle ?? 0, -1, 1);
  const steer = clamp(controls.steer ?? 0, -1, 1);
  const handbrake = !!controls.handbrake;

  const fx = Math.cos(car.angle);
  const fy = Math.sin(car.angle);
  const rx = -fy;
  const ry = fx;

  // Split the world velocity into forward and sideways parts.
  let forward = car.vx * fx + car.vy * fy;
  let lateral = car.vx * rx + car.vy * ry;

  // Engine and brakes.
  if (throttle > 0) forward += CAR.accel * throttle * dt;
  else if (throttle < 0) {
    if (forward > 10) forward -= CAR.brake * -throttle * dt;
    else forward += CAR.accel * 0.6 * throttle * dt;
  }

  // Drag and the speed cap.
  forward -= forward * CAR.drag * dt;
  const cap = throttle < 0 && forward < 0 ? CAR.reverse : CAR.maxSpeed;
  forward = clamp(forward, -cap, cap);
  car.braking = throttle < 0 && forward > 10;

  // Sideways grip: low grip while the handbrake is held, so the tail steps out.
  const grip = handbrake ? CAR.driftGrip : CAR.grip;
  lateral *= Math.exp(-grip * dt);

  car.vx = fx * forward + rx * lateral;
  car.vy = fy * forward + ry * lateral;
  car.speed = forward;

  // Steering scales with speed so a parked car does not spin on the spot.
  const speedFactor = clamp(Math.abs(forward) / 140, 0, 1);
  if (speedFactor > 0.02) {
    const turn = steer * CAR.turnRate * speedFactor * dt * Math.sign(forward || 1);
    car.angle = wrapAngle(car.angle + turn);
  }

  // Move, with a wall check that stops the car instead of letting it slide through.
  const nx = car.x + car.vx * dt;
  const ny = car.y + car.vy * dt;
  if (carHitsCity(city, nx, car.y, car)) {
    car.vx *= -0.24;
    car.speed *= -0.24;
    car.crash = 1;
  } else {
    car.x = nx;
  }
  if (carHitsCity(city, car.x, ny, car)) {
    car.vy *= -0.24;
    car.speed *= -0.24;
    car.crash = 1;
  } else {
    car.y = ny;
  }
  car.crash = Math.max(0, (car.crash ?? 0) - dt * 3);

  const margin = 30;
  if (car.x < margin) { car.x = margin; car.vx = Math.abs(car.vx) * 0.3; }
  if (car.y < margin) { car.y = margin; car.vy = Math.abs(car.vy) * 0.3; }
  if (car.x > WORLD.sandEndX - 10) { car.x = WORLD.sandEndX - 10; car.vx = -Math.abs(car.vx) * 0.3; }
  if (car.y > WORLD.sandEndY - 10) { car.y = WORLD.sandEndY - 10; car.vy = -Math.abs(car.vy) * 0.3; }
}

// Cheap oriented-box test against buildings: check the four corners and the middle.
export function carHitsCity(city, x, y, car) {
  const hw = (car.w ?? 42) / 2;
  const hh = (car.h ?? 82) / 2;
  const fx = Math.cos(car.angle);
  const fy = Math.sin(car.angle);
  const rx = -fy;
  const ry = fx;
  const probes = [
    [ 1, 1 ], [ 1, -1 ], [ -1, 1 ], [ -1, -1 ], [ 0, 0 ], [ 1, 0 ], [ -1, 0 ], [ 0, 1 ], [ 0, -1 ],
  ];
  for (const [a, b] of probes) {
    const px = x + fx * hh * a + rx * hw * b;
    const py = y + fy * hh * a + ry * hw * b;
    if (buildingAt(city, px, py, 2)) return true;
  }
  return false;
}

// Push two cars apart after a collision, using circle approximations at their centres.
export function resolveCarCollisions(cars, effects) {
  for (let i = 0; i < cars.length; i++) {
    const a = cars[i];
    for (let j = i + 1; j < cars.length; j++) {
      const b = cars[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const ra = (a.h ?? 82) * 0.34;
      const rb = (b.h ?? 82) * 0.34;
      const min = ra + rb;
      const d2 = dx * dx + dy * dy;
      if (d2 > min * min || d2 < 0.0001) continue;
      const d = Math.sqrt(d2);
      const overlap = (min - d) * 0.5;
      const nx = dx / d;
      const ny = dy / d;
      a.x -= nx * overlap;
      a.y -= ny * overlap;
      b.x += nx * overlap;
      b.y += ny * overlap;

      // Exchange a portion of the closing velocity for a small bounce.
      const rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
      if (rel < 0) {
        const imp = rel * 0.55;
        a.vx += nx * imp;
        a.vy += ny * imp;
        b.vx -= nx * imp;
        b.vy -= ny * imp;
        if (effects && rel < -120) {
          effects.sparks((a.x + b.x) / 2, (a.y + b.y) / 2, Math.atan2(ny, nx), 6);
          effects.addShake(0.25, 0.18);
        }
      }
      a.speed *= 0.86;
      b.speed *= 0.86;
    }
  }
}

// --- traffic steering -------------------------------------------------------

// Traffic follows the road grid: it keeps its lane offset, aims for the next
// intersection, and turns at corners. The lattice is forgiving, so this is enough
// to read as a living city.
export function steerTrafficCar(car, dt, city) {
  const t = car.traffic;
  if (!t) return { throttle: 0, steer: 0 };

  const target = t.target;
  if (!target) return { throttle: 0.5, steer: 0 };

  const dx = target.x - car.x;
  const dy = target.y - car.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 48) {
    // Pick the next node: continue along the current axis, or turn at random.
    t.nodeIndex++;
    if (t.nodeIndex >= t.route.length) t.route = buildTrafficRoute(city, car, t);
    t.nodeIndex = 0;
    t.target = t.route[t.nodeIndex];
    return { throttle: 0.45, steer: 0 };
  }

  const desired = Math.atan2(dy, dx);
  let err = wrapAngle(desired - car.angle);
  // Slow down for a sharp turn.
  const throttle = Math.abs(err) > 0.5 ? 0.25 : 0.55;
  const steer = clamp(err * 1.8, -1, 1);
  return { throttle, steer };
}

// A simple route: go straight until the road ends or a coin flip says turn.
export function buildTrafficRoute(city, car, traffic) {
  const route = [];
  const onVertical = Math.abs(Math.cos(car.angle)) < 0.7;
  const stepX = traffic.dirX * (city.roadsX[1] - city.roadsX[0]);
  const stepY = traffic.dirY * (city.roadsY[1] - city.roadsY[0]);
  if (onVertical) {
    route.push({ x: car.x, y: clamp(car.y + stepY, 260, WORLD.height - 260) });
  } else {
    route.push({ x: clamp(car.x + stepX, 260, WORLD.width - 260), y: car.y });
  }
  return route;
}

// --- enter / exit -----------------------------------------------------------

export function nearestCar(player, cars, maxDist = 62) {
  let best = null;
  let bestD = maxDist;
  for (const car of cars) {
    const d = Math.hypot(car.x - player.x, car.y - player.y);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  return best;
}

export function enterCar(player, car) {
  if (!car || player.inCar) return false;
  car.driver = 'player';
  car.traffic = null;
  player.inCar = car;
  player.x = car.x;
  player.y = car.y;
  player.enterCooldown = 0.35;
  return true;
}

export function exitCar(player, city, walkableFn) {
  const car = player.inCar;
  if (!car) return false;
  // Step out on whichever side has room.
  const sides = [Math.PI / 2, -Math.PI / 2, Math.PI, 0];
  for (const offset of sides) {
    const a = car.angle + offset;
    const x = car.x + Math.cos(a) * 34;
    const y = car.y + Math.sin(a) * 34;
    if (walkableFn(city, x, y, 12)) {
      player.x = x;
      player.y = y;
      player.heading = a;
      car.driver = null;
      player.inCar = null;
      player.vx = 0;
      player.vy = 0;
      player.enterCooldown = 0.35;
      return true;
    }
  }
  return false;
}
