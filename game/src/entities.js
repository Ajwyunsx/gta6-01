// entities.js — the living things: the player (on foot and behind the wheel),
// pedestrians who walk the sidewalks and flee gunfire, and the plain car record
// every system hands around (parked, stolen, driven by traffic or by the police).

import { PLAYER, PED, CAR, COLORS } from './config.js';
import { walkable, buildingAt, insideWater } from './city.js';
import { clamp, randomRange, angleTo } from './random.js';

let nextId = 1;

export function makeCar(props = {}) {
  return {
    id: nextId++,
    x: props.x ?? 0,
    y: props.y ?? 0,
    angle: props.angle ?? 0,
    vx: 0,
    vy: 0,
    speed: 0,
    w: props.w ?? 42,
    h: props.h ?? 82,
    color: props.color ?? '#c8c2d4',
    kind: props.kind ?? 'sedan',
    health: 100,
    driver: props.driver ?? null, // 'traffic' | 'cop' | 'player' | null (parked)
    lane: props.lane ?? null,
    traffic: props.traffic ?? null,
    siren: props.siren ?? false,
    braking: false,
    hornTime: 0,
    lastHit: 0,
  };
}

const SKINS = ['#c98d6b', '#8f5f45', '#e3b18f', '#6f452f', '#d9a179', '#a2714f'];
const SHIRTS = ['#d2568a', '#3f9b91', '#d4ae5c', '#7b68bd', '#c05a4c', '#5b8fc0', '#c9c3d6', '#6fa96a', '#a8558c', '#8a8fa8', '#b5764c'];

export class Ped {
  constructor(x, y, rng) {
    this.id = nextId++;
    this.x = x;
    this.y = y;
    this.r = PED.radius;
    this.speed = rng.float(0.8, 1.2);
    this.heading = rng.float(0, Math.PI * 2);
    this.target = rng.float(0, Math.PI * 2);
    this.moving = true;
    this.skin = rng.pick(SKINS);
    this.shirt = rng.pick(SHIRTS);
    this.state = 'walk'; // walk | flee | down
    this.fleeTimer = 0;
    this.downTimer = 0;
    this.bob = rng.float(0, 6);
  }

  update(dt, city, world) {
    if (this.state === 'down') {
      this.downTimer -= dt;
      this.moving = false;
      if (this.downTimer <= 0) {
        this.state = 'walk';
        this.moving = true;
      }
      return;
    }

    if (this.state === 'flee') {
      this.fleeTimer -= dt;
      // Run away from the player, roughly.
      const p = world.player;
      this.target = angleTo(p.x, p.y, this.x, this.y) + randomRange(-0.4, 0.4);
      if (this.fleeTimer <= 0) this.state = 'walk';
    }

    let speed = PED.walk * this.speed;
    if (this.state === 'flee') speed = PED.run;

    // Steer gently toward the target heading, then walk forward with collision.
    const diff = Math.atan2(Math.sin(this.target - this.heading), Math.cos(this.target - this.heading));
    this.heading += clamp(diff, -3.2 * dt, 3.2 * dt);

    const step = speed * dt;
    const nx = this.x + Math.cos(this.heading) * step;
    const ny = this.y + Math.sin(this.heading) * step;
    if (walkable(city, nx, ny, this.r)) {
      this.x = nx;
      this.y = ny;
      this.moving = true;
    } else {
      // Blocked: turn a quarter and try again next frame.
      this.target = this.heading + (Math.random() < 0.5 ? 1 : -1) * randomRange(0.8, 2.2);
      this.moving = false;
    }

    // Keep peds out of the player's face when walking.
    const p = world.player;
    const dx = this.x - p.x;
    const dy = this.y - p.y;
    const d2 = dx * dx + dy * dy;
    if (d2 < 26 * 26 && d2 > 0.01) {
      const d = Math.sqrt(d2);
      this.x += (dx / d) * (26 - d) * 0.5;
      this.y += (dy / d) * (26 - d) * 0.5;
    }
  }
}

export function spawnPedestrians(city, count, rng) {
  const peds = [];
  let guard = 0;
  while (peds.length < count && guard++ < count * 40) {
    const block = rng.pick(city.sidewalks);
    const x = block.x + rng.float(10, block.w - 10);
    const y = block.y + rng.float(10, block.h - 10);
    if (!walkable(city, x, y, 12)) continue;
    peds.push(new Ped(x, y, rng));
  }
  return peds;
}

// --- player -----------------------------------------------------------------

export class Player {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.r = PLAYER.radius;
    this.heading = 0;
    this.aim = 0;
    this.vx = 0;
    this.vy = 0;
    this.speed = 0;
    this.moving = false;
    this.health = PLAYER.health;
    this.armor = 0;
    this.money = 240;
    this.inCar = null;
    this.fireCooldown = 0;
    this.lastShot = 0;
    this.recoil = 0;
    this.alive = true;
    this.wanted = 0;
    this.heat = 0;
    this.cool = 0;
    this.stars = 0;
    this.deathTimer = 0;
    this.enterCooldown = 0;
  }

  reset(x, y) {
    this.x = x;
    this.y = y;
    this.heading = 0;
    this.aim = 0;
    this.vx = 0;
    this.vy = 0;
    this.health = PLAYER.health;
    this.armor = 0;
    this.inCar = null;
    this.alive = true;
    this.wanted = 0;
    this.heat = 0;
    this.stars = 0;
    this.deathTimer = 0;
  }

  // On-foot movement with axis-separated collision, so sliding along walls feels right.
  updateOnFoot(dt, city, input, aimAngle) {
    let ax = 0;
    let ay = 0;
    if (input.left) ax -= 1;
    if (input.right) ax += 1;
    if (input.up) ay -= 1;
    if (input.down) ay += 1;
    const len = Math.hypot(ax, ay);
    const sprinting = input.sprint && len > 0;
    const max = sprinting ? PLAYER.sprint : PLAYER.walk;

    if (len > 0) {
      ax /= len;
      ay /= len;
      this.heading = Math.atan2(ay, ax);
      this.moving = true;
    } else {
      this.moving = false;
    }

    // Accelerate toward the wanted velocity, with a little inertia.
    const targetVx = ax * max;
    const targetVy = ay * max;
    const accel = len > 0 ? 14 : 18;
    this.vx += (targetVx - this.vx) * Math.min(1, accel * dt);
    this.vy += (targetVy - this.vy) * Math.min(1, accel * dt);
    this.speed = Math.hypot(this.vx, this.vy);
    this.aim = aimAngle;

    const nx = this.x + this.vx * dt;
    if (walkable(city, nx, this.y, this.r)) this.x = nx;
    else this.vx *= -0.1;
    const ny = this.y + this.vy * dt;
    if (walkable(city, this.x, ny, this.r)) this.y = ny;
    else this.vy *= -0.1;

    this.fireCooldown = Math.max(0, this.fireCooldown - dt);
    this.recoil = Math.max(0, this.recoil - dt * 6);
    this.enterCooldown = Math.max(0, this.enterCooldown - dt);
  }

  heal(amount) {
    this.health = Math.min(PLAYER.health, this.health + amount);
  }

  damage(amount) {
    let left = amount;
    if (this.armor > 0) {
      const absorbed = Math.min(this.armor, left * 0.7);
      this.armor -= absorbed;
      left -= absorbed;
    }
    this.health -= left;
    if (this.health <= 0) {
      this.health = 0;
      this.alive = false;
    }
  }
}

// --- parked cars ------------------------------------------------------------

const PARKED_COLORS = ['#c8556f', '#4f9fb8', '#d8b25f', '#8a7bd8', '#d8d3e2', '#6f8f6a', '#b8484f', '#4a6fa8', '#c07a4a'];

export function spawnParkedCars(city, rng) {
  const cars = [];
  for (const spot of city.parkingSpots) {
    if (rng.chance(0.25)) continue;
    const car = makeCar({
      x: spot.x,
      y: spot.y,
      angle: spot.facing,
      color: rng.pick(PARKED_COLORS),
      kind: rng.chance(0.2) ? 'sport' : 'sedan',
    });
    if (car.kind === 'sport') {
      car.color = rng.pick(['#ff5f9e', '#4fe3cd', '#c9a227']);
      car.h = 86;
    }
    cars.push(car);
  }
  // A handful of cars pulled up along the curbs, where a thief would expect them.
  for (let i = 0; i < 26; i++) {
    const rx = rng.pick(city.roadsX);
    const y = rng.float(300, city.height - 300);
    const car = makeCar({
      x: rx + (rng.chance(0.5) ? 34 : -34),
      y,
      angle: Math.PI / 2,
      color: rng.pick(PARKED_COLORS),
    });
    if (buildingAt(city, car.x, car.y, 30)) continue;
    if (insideWater(car.x, car.y, 30)) continue;
    cars.push(car);
  }
  return cars;
}
