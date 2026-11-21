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
    world.combat.addPickup(avenue + 120, 1460, 'cash', 60);
    addShotCars(world, [
      [avenue - 30, 1700, Math.PI / 2, '#4f9fb8'],
      [avenue - 30, 1830, Math.PI / 2, '#d8b25f'],
      [avenue + 30, 1300, -Math.PI / 2, '#8a7bd8'],
      [avenue - 30, 1170, Math.PI / 2, '#c9a227'],
    ]);
    addShotPeds(world, [
      [avenue + 96, 1620], [avenue + 118, 1440], [avenue - 96, 1660], [avenue + 90, 1360],
    ]);
    for (let i = 0; i < 3; i++) {
      const cop = world.police.spawnCop({ player: { x: car.x, y: car.y + 320, heading: -Math.PI / 2 } });
      if (!cop) break;
      cop.x = avenue + (i % 2 === 0 ? -30 : 30);
      cop.y = car.y + 260 + i * 110;
      cop.angle = -Math.PI / 2;
      cop.vx = 0;
      cop.vy = -220;
    }
    world.hint = 'E — get out  ·  SPACE — handbrake';
    return { offset: { x: 0, y: 6 }, zoom: 1.0, autoThrottle: 0.42, lockCamera: true };
  }

  if (n === 2) {
    // On foot: a lit street corner, pedestrians about, pickups and the mission marker.
    const spot = city.sidewalks.find((b) => b.col === 1 && b.row === 1) ?? city.sidewalks[0];
    p.x = spot.x + spot.w * 0.5;
    p.y = spot.y + spot.h - 30;
    p.heading = -Math.PI / 2;
    p.aim = -Math.PI / 2 - 0.15;
    p.money = 620;
    p.health = 100;
    p.armor = 30;
    p.stars = 0;
    world.missionManager.start(0);
    world.missionManager.state = 'active';
    world.missionManager.setStep(1);
    world.combat.addPickup(p.x + 96, p.y - 50, 'cash', 120);
    world.combat.addPickup(p.x - 86, p.y - 100, 'health', 35);
    addShotPeds(world, [
      [p.x + 60, p.y - 120], [p.x - 70, p.y - 60], [p.x + 130, p.y + 20],
      [p.x - 140, p.y - 140], [p.x + 40, p.y - 210],
    ]);
    addShotCars(world, [
      [spot.x + 40, spot.y + spot.h + 74, 0, '#4f9fb8'],
      [spot.x + 210, spot.y + spot.h + 74, 0, '#c8556f'],
    ]);
    world.hint = 'WASD to walk  ·  SHIFT to sprint  ·  click to fire';
    return { offset: { x: 0, y: -40 }, zoom: 1.5, lockCamera: true };
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
      [-78, -155], [96, -200], [-16, -245], [-132, -292], [110, -338],
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
      || Math.abs(c.x - car.x) > 130 || c.y < car.y - 560 || c.y > car.y + 300);
    world.traffic.cars = world.cars.filter((c) => c.driver === 'traffic');
    world.traffic.target = 0;
    world.hint = 'WASD — drive  ·  SPACE — handbrake  ·  E — bail out';
    return { offset: { x: 0, y: -165 }, zoom: 0.95, autoThrottle: 0.55, lockCamera: true };
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
  return { offset: { x: 0, y: 0 }, zoom: 1.0, lockCamera: true };
}

function addShotCars(world, list) {
  for (const [x, y, angle, color] of list) {
    const car = makeCar({ x, y, angle, color, kind: 'sedan', driver: 'traffic' });
    car.traffic = { lane: 1, dirX: 0, dirY: 1, nodeIndex: 0, route: [{ x, y: y + 600 }], target: { x, y: y + 600 } };
    car.vx = Math.cos(angle) * 60;
    car.vy = Math.sin(angle) * 60;
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
