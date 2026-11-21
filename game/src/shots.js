// Palm City — staged scenes for the four screenshots. ?shot=1..4 sets the world up so each
// still shows a different slice of the game: the city from a car, the player on foot, a
// police chase, and a mission in progress.
(function (global) {
  'use strict';

  const PC = global.PC;

  /** A point on a road seam, offset to the right-hand lane for a heading. */
  function lane(seamCol, seamRow, dirAngle, along) {
    const fx = Math.cos(dirAngle);
    const fy = Math.sin(dirAngle);
    // Right of travel.
    const rx = -fy;
    const ry = fx;
    const sx = seamCol * PC.CELL;
    const sy = seamRow * PC.CELL;
    return along === 'x'
      ? { x: sx, y: sy + 20 * Math.sign(ry || 1) }
      : { x: sx + 20 * Math.sign(rx || 1), y: sy };
  }

  /** Put the player at a spot facing an angle, camera snapped to them. */
  function place(state, x, y, facing) {
    const p = state.player;
    p.x = x;
    p.y = y;
    p.facing = facing;
    p.inCar = null;
    state.camera.x = x;
    state.camera.y = y;
  }

  /** Park a car at a spot and hand the keys to the player. */
  function seat(state, x, y, angle, colour) {
    const car = PC.Vehicles.makeCar(x, y, angle, colour || '#e9553f');
    car.driver = 'player';
    car.occupied = true;
    state.parked.push(car);
    state.player.inCar = car;
    state.player.x = car.x;
    state.player.y = car.y;
    state.camera.x = car.x;
    state.camera.y = car.y;
    return car;
  }

  /** A pedestrian standing or walking on the pavement. */
  function ped(state, x, y, facing, speed) {
    const a = PC.Entities.makeActor(x, y, { speed: speed || 44 });
    a.facing = facing;
    state.peds.push(a);
    return a;
  }

  /**
   * Shot 1: the cover. Driving north up the main avenue at dusk: lane traffic both ways,
   * crosswalks, palms, lit windows and the beach ahead.
   */
  function cover(state) {
    const mid = Math.floor(PC.GRID / 2);
    const x = mid * PC.CELL + 20;
    const y = state.city.beachTop - 190;
    const car = seat(state, x, y, -Math.PI / 2, '#e9553f');
    car.staged = true;          // held still: the still is composed, not driven
    car.speed = 0;

    state.mode = 'playing';
    state.wanted.stars = 0;
    state.wanted.heat = 0;
    state.missions.state = 'idle';
    state.missions.marker = null;
    state.player.cash = 1840;
    state.player.health = 88;
    state.toasts.length = 0;
    PC.UI.toast(state.toasts, 'Palm City · seven jobs on the coast', PC.PALETTE.gold);

    // Beachgoers on the sand and pedestrians on the promenade, so the shore is alive.
    state.peds.length = 0;
    for (let i = 0; i < 10; i++) {
      const px = mid * PC.CELL - 140 + (i % 5) * 66;
      const py = state.city.sandStart + 52 + Math.floor(i / 5) * 38 + (i % 3) * 6;
      ped(state, px, py, i % 2 ? 0 : Math.PI, 32);
    }
    // Two people on the promenade, well clear of the lane the camera is in.
    ped(state, mid * PC.CELL - PC.ROAD / 2 - 18, state.city.beachTop - 62, -Math.PI / 2, 44);
    ped(state, mid * PC.CELL + PC.ROAD / 2 + 18, state.city.beachTop - 96, Math.PI / 2, 44);

    // A parked car by the kerb ahead.
    const parked = PC.Vehicles.makeCar(mid * PC.CELL - PC.ROAD / 2 - 22, state.city.beachTop - 210, -Math.PI / 2, '#4f8fd4');
    state.parked.push(parked);
    // And a second, red, further up the boulevard.
    state.parked.push(PC.Vehicles.makeCar(mid * PC.CELL + PC.ROAD / 2 + 22, state.city.beachTop - 330, Math.PI / 2, '#f0c14b'));
  }

  /**
   * Shot 2: on foot at a downtown crossing. HUD up, a cash pickup glinting on the pavement,
   * traffic stopped at the light, a car by the kerb to steal.
   */
  function onFoot(state) {
    const mid = Math.floor(PC.GRID / 2);
    const lot = PC.City.lotRect(mid, mid + 1);
    const x = lot.x - 12;
    const y = lot.y + lot.h * 0.55;
    place(state, x, y, -Math.PI / 2 + 0.22);

    state.mode = 'playing';
    state.player.cash = 1240;
    state.player.health = 84;
    state.player.armour = 52;
    state.player.ammo = 96;
    state.wanted.stars = 0;
    state.wanted.heat = 0;
    state.missions.state = 'idle';
    state.missions.marker = { x: lot.x + lot.w * 0.5, y: lot.y + 40, r: 46, label: 'The job' };

    state.pickups.push({ kind: 'cash', x: x - 8, y: y - 78, taken: false, value: 60, bob: 0.6 });

    state.peds.length = 0;
    // People across the street, on the far pavement, so the player reads as alone on this one.
    for (let i = 0; i < 6; i++) {
      ped(state, lot.x + lot.w + 22, lot.y + 30 + i * 26, i % 2 ? Math.PI / 2 : -Math.PI / 2, 38);
    }
    ped(state, lot.x + 40, lot.y + lot.h - 16, Math.PI, 40);
    ped(state, lot.x + 108, lot.y + lot.h - 16, 0, 40);

    // A car idling at the kerb, one lane over.
    const car = PC.Vehicles.makeCar(lot.x - PC.ROAD / 2 - 30, y + 52, -Math.PI / 2, '#4f8fd4');
    state.parked.push(car);
  }

  /**
   * Shot 3: the heat. Three stars, a cruiser closing with the light bar going, officers on
   * foot behind their doors, the player firing over a parked car.
   */
  function police(state) {
    // Straight up the middle of a north-south avenue: buildings wall both sides, cruisers
    // closing from the junction, officers out of the cars. This is the shot that has to
    // read as "the police are after you" in a thumbnail.
    const mid = Math.floor(PC.GRID / 2);
    const sx = mid * PC.CELL;                 // road centre line
    const sy = (mid + 3) * PC.CELL;           // a few blocks up from the beach
    const x = sx + 22;                        // east side of the road
    const y = sy + 120;
    place(state, x, y, -Math.PI / 2);

    state.mode = 'playing';
    state.player.cash = 3480;
    state.player.health = 62;
    state.player.armour = 28;
    state.player.ammo = 71;

    state.wanted.stars = 3;
    state.wanted.heat = 300;
    state.wanted.alert = 0.85;

    state.missions.state = 'idle';
    state.missions.marker = null;

    state.cruisers.length = 0;
    const c1 = PC.Police.makeCruiser(sx - 20, y - 118, Math.PI / 2);
    c1.lightPhase = 0.4;
    c1.staged = true;
    const c2 = PC.Police.makeCruiser(sx + 20, y - 236, Math.PI / 2);
    c2.lightPhase = 1.2;
    c2.staged = true;
    state.cruisers.push(c1, c2);

    state.hostiles.length = 0;
    const cop1 = PC.Police.makeOfficer(sx + 58, y - 86, Math.PI / 2 + 0.2);
    const cop2 = PC.Police.makeOfficer(sx - 60, y - 96, Math.PI / 2 - 0.22);
    const cop3 = PC.Police.makeOfficer(sx - 4, y - 168, Math.PI / 2);
    state.hostiles.push(cop1, cop2, cop3);

    // The exchange, frozen: muzzle flash, tracers, sparks off the near cruiser.
    state.effects.muzzle(x - 2, y - 20);
    state.effects.burst(x - 30, y - 110, 'spark', 11, 0.9);
    state.effects.burst(cop1.x, cop1.y - 4, 'spark', 3, 0.5);
    state.effects.addShake(4);
    state.effects.skid(sx - 44, y - 96, 0.06, 0.9);
    state.effects.skid(sx - 36, y - 92, 0.06, 0.9);
    state.bullets.push(PC.Combat.makeBullet(x - 4, y - 26, -Math.PI / 2 + 0.05, 'player', 26));
    state.bullets.push(PC.Combat.makeBullet(cop2.x, cop2.y - 6, -Math.PI / 2 + 0.24, 'police', 8));
    state.bullets.push(PC.Combat.makeBullet(cop1.x, cop1.y - 6, -Math.PI / 2 - 0.14, 'police', 8));

    // A few pedestrians sprinting out of the line of fire.
    state.peds.length = 0;
    for (let i = 0; i < 4; i++) {
      const p = ped(state, sx + 78 + (i % 2) * 16, y - 30 + i * 44, Math.PI / 2, 66);
      p.panic = 3;
    }

    // The player's cover: a car left in the lane.
    state.parked.push(PC.Vehicles.makeCar(sx + 24, y - 54, -Math.PI / 2 + 0.02, '#efe6d5'));
    PC.UI.toast(state.toasts, 'Three stars · coast patrol inbound', PC.PALETTE.danger);
  }

  /**
   * Shot 4: a mission in progress. Counter Service accepted, the marker on the bank across
   * the street, a guard outside, the objective on the HUD.
   */
  function mission(state) {
    const mid = Math.floor(PC.GRID / 2);
    const lot = PC.City.lotRect(mid - 2, mid - 2);
    const bank = { x: lot.x + lot.w * 0.5, y: lot.y + lot.h * 0.62 };
    const x = lot.x - 16;
    const y = lot.y + lot.h * 0.8;
    place(state, x, y, -Math.PI / 2 - 0.16);

    state.mode = 'playing';
    state.player.cash = 2150;
    state.player.health = 96;
    state.player.armour = 40;
    state.player.ammo = 88;
    state.wanted.stars = 0;
    state.wanted.heat = 0;

    state.missions.index = 1;
    state.missions.state = 'active';
    state.missions.phase = 'rob';
    state.missions.timer = 3.1;
    state.missions.marker = { x: bank.x, y: bank.y, r: 54, label: 'Sunstate Bank' };

    state.hostiles.length = 0;
    const guard = PC.Police.makeOfficer(bank.x + 34, bank.y + 26, Math.PI / 2 + 0.5);
    guard.kind = 'thug';
    guard.shirt = '#333a48';
    state.hostiles.push(guard);

    state.peds.length = 0;
    for (let i = 0; i < 8; i++) {
      ped(state, lot.x + 16 + (i % 4) * 42, lot.y + lot.h - 14 - Math.floor(i / 4) * 34, i % 2 ? 0 : Math.PI, 38);
    }

    PC.UI.toast(state.toasts, 'Counter Service · Sunstate Bank', PC.PALETTE.gold);
  }

  /** Apply a shot by number; 1 is the cover. Each sets the camera's own zoom. */
  function apply(state, n, W, H) {
    state.camera.w = W;
    state.camera.h = H;
    state.camera.zoom = n === 1 ? 1.15 : 1.55;
    if (n === 1) cover(state);
    else if (n === 2) onFoot(state);
    else if (n === 3) police(state);
    else mission(state);
  }

  /** Let staged scenes settle for a beat before the still is taken. */
  function tick(state, dt) {
    if (state.missions.state === 'active') state.missions.timer += dt * 0.02;
  }

  PC.Shots = { apply, tick, lane };
})(window);
