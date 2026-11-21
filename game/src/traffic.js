// Palm City — lane traffic: cars that keep to their side of the road, turn at junctions,
// brake for whatever is ahead of them, and can be stolen by the player.
(function (global) {
  'use strict';

  const PC = global.PC;
  const T = PC.TRAFFIC;

  const DIRS = [
    { dx: 0, dy: -1, angle: -Math.PI / 2 },  // north
    { dx: 1, dy: 0, angle: 0 },              // east
    { dx: 0, dy: 1, angle: Math.PI / 2 },    // south
    { dx: -1, dy: 0, angle: Math.PI },       // west
  ];

  function laneTarget(car, dir) {
    // Aim at the lane centre on the right-hand side of the carriageway.
    return {
      x: car.x + dir.dx * 120 - dir.dy * T.laneOffset,
      y: car.y + dir.dy * 120 + dir.dx * T.laneOffset,
    };
  }

  function makeTrafficCar(rand, city) {
    const horizontal = rand.chance(0.5);
    const line = rand.int(0, PC.GRID - 1);
    const dirIndex = horizontal ? (rand.chance(0.5) ? 1 : 3) : rand.chance(0.5) ? 2 : 0;
    const along = rand.range(PC.CELL * 1.5, PC.WORLD - PC.CELL * 1.5);
    const dir = DIRS[dirIndex];
    const x = horizontal ? along : line * PC.CELL + PC.CELL / 2 - dir.dy * T.laneOffset;
    const y = horizontal ? line * PC.CELL + PC.CELL / 2 - dir.dx * T.laneOffset : along;
    const car = PC.Vehicles.makeCar(x, y, dir.angle, rand.pick(PC.CAR_COLOURS));
    car.driver = 'traffic';
    car.occupied = true;
    car.dir = dir;
    car.laneLine = line;
    car.cruise = T.speed * rand.range(0.8, 1.25);
    car.turnCooldown = rand.range(3, 9);
    return car;
  }

  function spawnTraffic(city, count) {
    const rand = PC.rng(city.seed ^ 0x51ed270b);
    const cars = [];
    for (let i = 0; i < count; i++) cars.push(makeTrafficCar(rand, city));
    return cars;
  }

  /** Is a slower body in front of this car, within braking distance of its lane? */
  function blockedAhead(car, others) {
    const fx = Math.cos(car.angle);
    const fy = Math.sin(car.angle);
    for (const o of others) {
      if (o === car) continue;
      const dx = o.x - car.x;
      const dy = o.y - car.y;
      const ahead = dx * fx + dy * fy;
      if (ahead <= 0 || ahead > T.slowRadius) continue;
      const side = Math.abs(dx * -fy + dy * fx);
      if (side < 26) return true;
    }
    return false;
  }

  /**
   * One traffic step: steer toward the lane centre, keep a cruise speed, brake for the car
   * ahead, and occasionally pick a new direction at a junction.
   */
  function updateTraffic(car, cars, dt, city) {
    if (car.driver !== 'traffic') return;

    car.turnCooldown -= dt;
    if (car.turnCooldown <= 0) {
      const mx = car.x % PC.CELL;
      const my = car.y % PC.CELL;
      const atJunction =
        (mx < PC.ROAD * 0.7 || mx > PC.CELL - PC.ROAD * 0.7) &&
        (my < PC.ROAD * 0.7 || my > PC.CELL - PC.ROAD * 0.7);
      if (atJunction && Math.random() < T.turnChance) {
        car.dir = DIRS[(DIRS.indexOf(car.dir) + (Math.random() < 0.5 ? 1 : 3)) % 4];
        car.angle = car.dir.angle;
      }
      car.turnCooldown = 2.5 + Math.random() * 5;
    }

    const target = laneTarget(car, car.dir);
    const want = Math.atan2(target.y - car.y, target.x - car.x);
    const diff = PC.angleDiff(car.angle, want);
    const steer = PC.clamp(diff * 1.6, -1, 1);

    const blocked = blockedAhead(car, cars);
    let throttle = 1;
    if (blocked && car.speed > 30) throttle = -0.6;
    else if (blocked) throttle = 0;

    // Keep back from the pavement: steer home if we drift onto it.
    PC.Vehicles.drive(car, throttle, steer, false, dt);
    PC.Vehicles.collideWithCity(car, city);

    // Recycle a car that wanders off the grid or gets stuck on the sand.
    if (car.x < 40 || car.x > PC.WORLD - 40 || car.y < 40 || car.y > city.beachTop - 40) {
      respawnTraffic(car, city);
    }
  }

  function respawnTraffic(car, city) {
    const line = Math.floor(Math.random() * (PC.GRID - 1));
    const dir = DIRS[(Math.random() * 4) | 0];
    car.x = line * PC.CELL + PC.CELL / 2 - dir.dy * T.laneOffset;
    car.y = Math.min(PC.CELL / 2 - dir.dx * T.laneOffset, (city ? city.beachTop : PC.WORLD) - 80);
    car.angle = dir.angle;
    car.dir = dir;
    car.speed = 0;
    car.vx = 0;
    car.vy = 0;
    car.laneLine = line;
  }

  PC.Traffic = { spawnTraffic, updateTraffic, respawnTraffic, DIRS };
})(window);
