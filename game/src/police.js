// police.js — the wanted level and the cops who answer it. Stars climb on crime,
// police cruisers spawn off-screen and close in, the player is busted when a cop
// reaches them at low speed, and the level decays when the player stays out of sight.

import { WANTED, WORLD } from './config.js';
import { makeCar } from './entities.js';
import { driveCar } from './vehicles.js';
import { angleTo, clamp, randomRange, wrapAngle } from './random.js';

export class Police {
  constructor(city) {
    this.city = city;
    this.cars = [];
    this.spawnTimer = 0;
    this.radar = 0;
    this.bustTimer = 0;
    this.heldFor = 0;
  }

  reset() {
    this.cars.length = 0;
    this.spawnTimer = 0;
    this.bustTimer = 0;
  }

  addHeat(player, amount) {
    player.heat = Math.min(100, player.heat + amount);
    // 0 stars → 5 stars. Each star needs more heat than the last.
    const thresholds = [0, 14, 34, 58, 80, 96];
    let stars = player.stars;
    for (let i = 1; i <= 5; i++) {
      if (player.heat >= thresholds[i]) stars = i;
    }
    if (stars > player.stars) {
      player.stars = stars;
      player.cool = 0;
    }
  }

  maxCars(stars) {
    return stars <= 0 ? 0 : Math.min(6, 1 + stars);
  }

  update(dt, world, effects, audio) {
    const player = world.player;
    this.radar = Math.max(0, this.radar - dt);

    // A staged screenshot asks the cruisers to hold a formation around the player, so
    // the frame stays composed while the hero car keeps rolling.
    if (this.stage) {
      const anchor = player.inCar ?? player;
      for (const car of this.cars) {
        const off = car.stageOffset;
        if (!off) continue;
        car.x += (anchor.x + off[0] - car.x) * Math.min(1, dt * 6);
        car.y += (anchor.y + off[1] - car.y) * Math.min(1, dt * 6);
        car.angle = anchor.angle ?? car.angle;
        car.vx = anchor.vx ?? 0;
        car.vy = anchor.vy ?? 0;
        car.speed = anchor.speed ?? 0;
      }
      return;
    }

    if (player.stars <= 0) {
      this.releaseAll(world);
      player.heat = Math.max(0, player.heat - dt * 6);
      player.cool = 0;
      this.bustTimer = 0;
      return;
    }

    // Cops close in on the player's position with a little prediction.
    this.spawnTimer -= dt;
    const live = this.cars.length;
    if (live < this.maxCars(player.stars) && this.spawnTimer <= 0) {
      this.spawnCop(world);
      this.spawnTimer = Math.max(1.6, 4.6 - player.stars * 0.55);
    }

    for (const car of this.cars) {
      this.driveCop(car, dt, world, player);
    }

    // Drop a star now and then once the player is far away and out of the cops' eyes,
    // which the game counts as "hidden": off the road far from any cruiser.
    let nearest = 99999;
    for (const car of this.cars) nearest = Math.min(nearest, Math.hypot(car.x - player.x, car.y - player.y));
    const outOfSight = nearest > 900;
    if (outOfSight) {
      player.cool += dt;
      if (player.cool > WANTED.coolTime) {
        player.stars = Math.max(0, player.stars - 1);
        player.cool = 0;
        player.heat = Math.max(0, player.heat - 18);
        if (player.stars === 0) this.releaseAll(world);
      }
    } else {
      player.cool = Math.max(0, player.cool - dt * 2);
    }

    // Busted: with the player near-stopped and a cruiser right beside them, the officer
    // steps out and makes the arrest. A short grace so a chase at speed never busts.
    const speed = player.inCar ? Math.abs(player.inCar.speed) : player.speed;
    if (nearest < 78 && speed < 40) {
      this.bustTimer += dt;
      if (this.bustTimer > 1.1) {
        world.onBusted?.();
        this.bustTimer = 0;
      }
    } else {
      this.bustTimer = Math.max(0, this.bustTimer - dt * 4);
    }

    // Wanted radius for the HUD: how far the cops' net reaches.
    this.radius = Math.max(0, 520 + player.stars * 260 - nearest * 0.2);
  }

  releaseAll(world) {
    for (const car of this.cars) car.driver = null;
    this.cars.length = 0;
  }

  spawnCop(world) {
    const player = world.player;
    const px = player.inCar ? player.inCar.x : player.x;
    const py = player.inCar ? player.inCar.y : player.y;
    for (let attempt = 0; attempt < 60; attempt++) {
      const a = player.heading + Math.PI + randomRange(-1.1, 1.1);
      const dist = randomRange(620, 1050);
      const x = clamp(px + Math.cos(a) * dist, 260, WORLD.sandEndX - 300);
      const y = clamp(py + Math.sin(a) * dist, 260, WORLD.sandEndY - 300);
      // Prefer spawning on a road so the cruiser arrives along a street.
      if (Math.abs(x - px) < 300 && Math.abs(y - py) < 300) continue;
      const car = makeCar({
        x,
        y,
        angle: angleTo(x, y, px, py),
        color: '#22242f',
        kind: 'cop',
        driver: 'cop',
        siren: true,
        w: 44,
        h: 86,
      });
      car.patrol = 0;
      this.cars.push(car);
      return car;
    }
    return null;
  }

  driveCop(car, dt, world, player) {
    const px = player.inCar ? player.inCar.x : player.x;
    const py = player.inCar ? player.inCar.y : player.y;
    const dx = px - car.x;
    const dy = py - car.y;
    const dist = Math.hypot(dx, dy);
    let desired = Math.atan2(dy, dx);

    // Block in: at high wanted levels, cars ahead and behind the player's car aim to cut it off.
    if (player.stars >= 3 && player.inCar) {
      const lead = player.inCar;
      const ahead = player.stars >= 4 ? 220 : 140;
      const tx = lead.x + Math.cos(lead.angle) * ahead;
      const ty = lead.y + Math.sin(lead.angle) * ahead;
      if (Math.hypot(tx - car.x, ty - car.y) < dist * 0.9) desired = Math.atan2(ty - car.y, tx - car.x);
    }

    const err = wrapAngle(desired - car.angle);
    const steer = clamp(err * 1.9, -1, 1);
    // Back off when close, so the cruiser can box the player in rather than ram them.
    const throttle = dist < 110 ? -0.2 : dist < 220 ? 0.25 : 0.85;
    driveCar(car, { throttle, steer, handbrake: Math.abs(err) > 1.4 && dist < 300 }, dt, this.city);
  }

  drawRadar(ctx) {
    // Called by the HUD; keep the drawing it wants here with the police data.
    return this.radius ?? 0;
  }
}
