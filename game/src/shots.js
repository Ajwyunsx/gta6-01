// shots.js — deterministic scene staging for the screenshots. ?shot=1..4 drops the game
// into a fixed, hand-composed moment (a different one per index) so the captures are
// repeatable: no waiting for random traffic to line up.

import { ROAD_X, ROAD_Y, WORLD } from './config.js';
import { makeCar, Ped } from './entities.js';
import { safePoint } from './city.js';

export function applyShot(world, index) {
  const p = world.player;
  const city = world.city;
  const n = Number(index) || 1;

  if (n === 1) {
    // Cover: on the coastal avenue heading north, sand and palms to the right, the
    // beachfront blocks to the left, traffic and a cruiser behind, HUD and minimap live.
    const avenue = ROAD_X[4];
    const car = makeCar({
      x: avenue + 30,
      y: 1560,
      angle: -Math.PI / 2,
      color: '#ff4f8f',
      kind: 'sport',
      driver: 'player',
      w: 44,
      h: 88,
    });
    // Caught at cruising speed: a still of a parked car reads as a parked car.
    car.speed = 330;
    car.vx = Math.cos(car.angle) * 330;
    car.vy = Math.sin(car.angle) * 330;
    car.stageAnchor = { x: car.x, y: car.y };
    world.cars.push(car);
    p.inCar = car;
    p.x = car.x;
    p.y = car.y;
    p.money = 1480;
    p.health = 88;
    p.armor = 55;
    p.heat = 40;
    world.police.addHeat(p, 0);
    p.stars = 2;
    world.missionManager.start(2);
    world.missionManager.state = 'active';
    world.missionManager.setStep(0);
    // Objective line only — the briefing box would eat half the frame in a still.
    world.missionManager.dialogueIndex = world.missionManager.dialogue.length;
    world.combat.addPickup(avenue + 112, 1466, 'cash', 60);
    // The hero is pinned at its mark; staged cars keep their own speed, so they're placed
    // where they'll be ~1.15 s after load rather than where they start. Both lanes carry
    // traffic: the avenue should read as a street in use, not a runway.
    addShotCars(world, [
      // Placed where the shutter sees them, and held there: a car given a velocity for
      // 1.15 s of load grace ends up half a block from where the shot was composed.
      [avenue + 30, 1300, -Math.PI / 2, '#8a7bd8'],
      [avenue - 30, 1382, Math.PI / 2, '#4f9fb8'],
      [avenue - 30, 1620, Math.PI / 2, '#d8b25f'],
    ]);
    for (const c of world.cars) {
      if (!c.staged) continue;
      c.vx = 0;
      c.vy = 0;
      c.stageHold = true;
    }
    addShotPeds(world, [
      [avenue + 96, 1620], [avenue + 120, 1440], [avenue - 98, 1600], [avenue + 92, 1360],
    ]);
    // Ambient traffic keeps spawning on its own schedule and was parking itself on top
    // of the hero. Keep only the staged cars and the hero inside the frame.
    world.cars = world.cars.filter((c) => c === car || c.staged);
    world.traffic.cars = world.cars.filter((c) => c.driver === 'traffic');
    world.traffic.target = 0;
    // No tutorial hint on the cover: it lands dead centre and cuts the hero car in half.
    world.hint = '';
    return { offset: { x: -10, y: 6 }, zoom: 1.2, stageSpeed: 330, lockCamera: true };
  }

  if (n === 2) {
    // On foot: the sidewalk in front of the Coral Room, the delivery marker glowing over
    // the door, pedestrians about, cash on the ground. The whole first job in one frame.
    const door = { x: ROAD_X[1] + 360, y: ROAD_Y[1] - 250 };
    const stand = safePoint(city, door.x - 14, door.y + 104);
    p.x = stand.x;
    p.y = stand.y;
    p.heading = -Math.PI / 2;
    p.aim = -Math.PI / 2 + 0.16;
    p.money = 620;
    p.health = 100;
    p.armor = 30;
    p.stars = 0;
    world.missionManager.start(0);
    world.missionManager.state = 'active';
    world.missionManager.setStep(1);
    world.combat.addPickup(p.x + 168, p.y - 34, 'cash', 120);
    world.combat.addPickup(p.x - 150, p.y - 90, 'health', 35);
    addShotPeds(world, [
      [p.x + 96, p.y - 96], [p.x - 74, p.y - 40], [p.x + 168, p.y + 70],
      [p.x - 186, p.y - 150], [p.x + 64, p.y - 230],
    ]);
    // Nothing parked in the hero's lap: a sedan below them draws later in the painter's
    // order (higher y) and used to cover the one figure the shot is about.
    addShotCars(world, [
      [p.x + 250, p.y + 96, 0, '#4f9fb8'],
      [p.x - 268, p.y + 96, 0, '#c8556f'],
      [p.x + 470, p.y + 96, 0, '#8a7bd8'],
    ]);
    world.hint = 'WASD to walk  ·  SHIFT to sprint  ·  click to fire';
    return { offset: { x: -4, y: -34 }, zoom: 1.8, lockCamera: true };
  }

  if (n === 3) {
    // Police chase: player in a car with four cruisers closing in, stars at 4.
    const car = makeCar({
      x: ROAD_X[2] + 30,
      y: ROAD_Y[1] + 150,
      angle: Math.PI / 2,
      color: '#c9a227',
      kind: 'sport',
      driver: 'player',
      w: 44,
      h: 88,
    });
    world.cars.push(car);
    p.inCar = car;
    p.x = car.x;
    p.y = car.y;
    // Rolling, so the chase reads as a chase rather than a stakeout.
    car.vx = Math.cos(car.angle) * 250;
    car.vy = Math.sin(car.angle) * 250;
    car.speed = 250;
    p.money = 2350;
    p.health = 62;
    p.armor = 20;
    p.heat = 70;
    world.police.addHeat(p, 0);
    p.stars = 4;
    // Frame the chase: the road ahead, the hero car low in the frame, and five cruisers
    // stacked up the lane behind it. police.stage holds the formation so the composition
    // survives the car rolling forward.
    world.police.stage = true;
    const slot = [
      [-104, -48], [104, -60], [-48, -104], [-152, -128], [132, -120],
    ];
    for (let i = 0; i < slot.length; i++) {
      const cop = world.police.spawnCop({ player: { x: car.x, y: car.y + slot[i][1], heading: Math.PI / 2 } });
      if (!cop) break;
      cop.x = car.x + slot[i][0];
      cop.y = car.y + slot[i][1];
      cop.angle = Math.PI / 2;
      cop.stageOffset = slot[i];
      cop.vx = 0;
      cop.vy = 260;
    }
    world.missionManager.start(4);
    world.missionManager.state = 'active';
    // The escape step, so the objective line reads like a chase rather than an errand.
    world.missionManager.setStep(2);
    world.missionManager.dialogueIndex = world.missionManager.dialogue.length;
    // Clear the lane around the player so the staged frame stays at speed instead of
    // braking for traffic, and so the cruisers read clearly.
    // Clear the corridor: traffic and parked cars in the lane would brake the hero car
    // mid-capture, and their headlights read as more cops. Nothing new spawns either,
    // so the frame stays the frame.
    world.cars = world.cars.filter((c) => c === car || c.driver === 'cop'
      || Math.abs(c.x - car.x) > 150 || c.y < car.y - 480 || c.y > car.y + 260);
    world.traffic.cars = world.cars.filter((c) => c.driver === 'traffic');
    world.traffic.target = 0;
    world.hint = 'WASD — drive  ·  SPACE — handbrake  ·  E — bail out';
    // Player a little below centre, the cruisers stacked up the frame above them, and
    // enough city either side that the shot reads as a street rather than a corridor.
    return { offset: { x: 0, y: 24 }, zoom: 1.5, autoThrottle: 0.55, lockCamera: true };
  }

  // 4 — mission briefing over the street.
  world.missionManager.start(5);
  world.missionManager.state = 'brief';
  const s = safePoint(city, ROAD_X[3] - 140, ROAD_Y[0] + 280);
  p.x = s.x;
  p.y = s.y;
  p.money = 3400;
  p.health = 92;
  p.armor = 60;
  p.stars = 0;
  // main.js honours this so the capture lands on the briefing card itself: the moment
  // every job actually begins, with the payout and the objective list on screen.
  return { offset: { x: 0, y: 0 }, zoom: 1.0, lockCamera: true, state: 'brief' };
}

function addShotCars(world, list) {
  for (const [x, y, angle, color] of list) {
    const car = makeCar({ x, y, angle, color, kind: 'sedan', driver: 'traffic' });
    // The route has to run the way the car is pointing: a northbound car given a
    // southbound target just U-turns on the spot and ends up diagonal across the lane.
    const tx = x + Math.cos(angle) * 600;
    const ty = y + Math.sin(angle) * 600;
    car.traffic = { lane: 1, dirX: 0, dirY: 0, nodeIndex: 0, route: [{ x, y: ty }], target: { x: tx, y: ty } };
    car.vx = Math.cos(angle) * 160;
    car.vy = Math.sin(angle) * 160;
    car.staged = true;
    world.cars.push(car);
  }
}

function addShotPeds(world, list) {
  for (const [x, y] of list) {
    const ped = new Ped(x, y, { float: (a, b) => (a + b) / 2, pick: (l) => l[0] });
    ped.heading = Math.random() * Math.PI * 2;
    ped.target = ped.heading;
    ped.moving = true;
    world.peds.push(ped);
  }
}
