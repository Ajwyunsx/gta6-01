// traffic.js — the ambient city: spawning and recycling traffic cars that loop along
// the road grid, and the pedestrians who scatter when a gun goes off nearby.

import { WORLD } from './config.js';
import { makeCar, Ped } from './entities.js';
import { steerTrafficCar, driveCar } from './vehicles.js';
import { buildTrafficRoute } from './vehicles.js';

const TRAFFIC_COLORS = ['#c8556f', '#4f9fb8', '#d8b25f', '#8a7bd8', '#d8d3e2', '#6f8f6a', '#b8484f', '#4a6fa8', '#c07a4a', '#9b6fb0'];

export class CityTraffic {
  constructor(city, rng) {
    this.city = city;
    this.rng = rng;
    this.cars = [];
    this.target = 22;
    this.spawnTimer = 0;
  }

  spawn() {
    const { city, rng } = this;
    for (let attempt = 0; attempt < 40; attempt++) {
      const vertical = rng.chance(0.5);
      const car = makeCar({
        color: rng.pick(TRAFFIC_COLORS),
        kind: rng.chance(0.15) ? 'sport' : 'sedan',
      });
      car.w = 42;
      car.h = 82;
      // Pick a spot somewhere along a road, with a lane offset.
      const lane = rng.chance(0.5) ? 1 : -1;
      if (vertical) {
        const rx = rng.pick(city.roadsX);
        car.x = rx + lane * 26;
        car.y = rng.float(260, city.height - 260);
        car.angle = lane > 0 ? Math.PI / 2 : -Math.PI / 2;
        car.traffic = { lane, dirX: 0, dirY: lane > 0 ? 1 : -1, nodeIndex: 0, route: [] };
      } else {
        const ry = rng.pick(city.roadsY);
        car.y = ry + lane * 26;
        car.x = rng.float(260, WORLD.sandEndX - 260);
        car.angle = lane > 0 ? 0 : Math.PI;
        car.traffic = { lane, dirX: lane > 0 ? 1 : -1, dirY: 0, nodeIndex: 0, route: [] };
      }
      car.driver = 'traffic';
      // Reject if it spawns on top of another car.
      let clear = true;
      for (const other of this.cars) {
        if (Math.hypot(other.x - car.x, other.y - car.y) < 120) {
          clear = false;
          break;
        }
      }
      if (!clear) continue;
      car.traffic.route = buildTrafficRoute(city, car, car.traffic);
      car.traffic.target = car.traffic.route[0];
      this.cars.push(car);
      return car;
    }
    return null;
  }

  update(dt) {
    this.spawnTimer -= dt;
    if (this.cars.length < this.target && this.spawnTimer <= 0) {
      this.spawn();
      this.spawnTimer = 0.6;
    }

    for (const car of this.cars) {
      if (car.driver !== 'traffic') continue;
      const controls = steerTrafficCar(car, dt, this.city);
      // Stop for a moment when something is right in front, so traffic doesn't pile through.
      controls.throttle = this.throttleFor(car, controls.throttle);
      driveCar(car, controls, dt, this.city);
      car.hornTime = Math.max(0, car.hornTime - dt);
    }

    // Recycle cars that wander off the map or get stuck in the sea.
    for (let i = this.cars.length - 1; i >= 0; i--) {
      const car = this.cars[i];
      if (car.driver !== 'traffic') continue;
      if (car.x < 120 || car.y < 120 || car.x > WORLD.sandEndX + 40 || car.y > WORLD.sandEndY + 40) {
        this.cars.splice(i, 1);
      }
    }
  }

  throttleFor(car, wanted) {
    const fx = Math.cos(car.angle);
    const fy = Math.sin(car.angle);
    for (const other of this.cars) {
      if (other === car) continue;
      const dx = other.x - car.x;
      const dy = other.y - car.y;
      const ahead = dx * fx + dy * fy;
      const side = Math.abs(-dx * fy + dy * fx);
      if (ahead > 0 && ahead < 110 && side < 34) return -0.6;
    }
    // Also yield to the player's car.
    return wanted;
  }
}

// Pedestrians who hear gunfire run for a bit. main.js calls this from combat.
export function scarePeds(peds, x, y, radius = 420) {
  for (const ped of peds) {
    if (ped.state !== 'walk') continue;
    const d = Math.hypot(ped.x - x, ped.y - y);
    if (d < radius) {
      ped.state = 'flee';
      ped.fleeTimer = 3 + Math.random() * 3;
    }
  }
}
