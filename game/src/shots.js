// Palm City — staged scenes for the four screenshots.
//
// ?shot=1..4 puts the world into a fixed, hand-composed state so each still shows a
// different slice of the game: the city from behind the wheel, the player on foot, a
// three-star firefight, and a job in progress. Nothing here runs during normal play.
//
// The scenes are composed, not simulated. Every actor, car and prop is placed by hand,
// the camera is snapped and leaned by hand, and the loop is told how many frames to settle
// before the screenshot is taken. That is why the numbers below are oddly specific: they
// are framing values, tuned against 1280x720 renders.
(function (global) {
  'use strict';

  const PC = global.PC;

  // ---- helpers ------------------------------------------------------------

  /** A point on a road seam, nudged into the right-hand lane for a heading. */
  function lane(seamCol, seamRow, dirAngle, along) {
    const fx = Math.cos(dirAngle);
    const fy = Math.sin(dirAngle);
    const rx = -fy;                    // right of travel
    const ry = fx;
    const sx = seamCol * PC.CELL;
    const sy = seamRow * PC.CELL;
    return along === 'x'
      ? { x: sx, y: sy + 20 * Math.sign(ry || 1) }
      : { x: sx + 20 * Math.sign(rx || 1), y: sy };
  }

  /** Stand the player somewhere, facing an angle, camera snapped onto them. */
  function place(state, x, y, facing) {
    const p = state.player;
    p.x = x;
    p.y = y;
    p.facing = facing;
    p.inCar = null;
    state.camera.x = x;
    state.camera.y = y;
  }

  /** Park a car and hand the keys over; the camera rides with it. */
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

  /** A pedestrian, standing on a given heading. */
  function ped(state, x, y, facing, speed) {
    const a = PC.Entities.makeActor(x, y, { speed: speed || 44 });
    a.facing = facing;
    state.peds.push(a);
    return a;
  }

  // ---- shot 1: the cover ---------------------------------------------------

  /**
   * The cover. Driving north up the coast boulevard, low sun behind the camera, lane
   * traffic both ways, palms, lit windows, and the beach and the sea filling the bottom
   * third of the frame. The car is held still: this is a composition, not a drive.
   */
  function cover(state) {
    const mid = Math.floor(PC.GRID / 2);
    const x = mid * PC.CELL + 20;
    const y = state.city.beachTop - 96;      // one road's width off the sand
    const car = seat(state, x, y, -Math.PI / 2, '#e9553f');
    car.staged = true;                       // world.js holds the player with the car
    car.speed = 64;                          // but the speedo should read like a boulevard
    state.camera.y = y + 44;                 // lean south, so the shore sits low in frame
    state.hint = 'Cruise the coast · the gold marker is a job';

    state.mode = 'playing';
    state.wanted.stars = 0;
    state.wanted.heat = 0;
    state.wanted.alert = 0;
    state.missions.state = 'idle';
    state.missions.marker = null;
    state.player.cash = 1840;
    state.player.health = 88;
    state.player.armour = 24;
    state.player.ammo = 120;
    state.toasts.length = 0;

    // Beachgoers on the sand, in loose pairs, so the shore is alive but not a crowd.
    state.peds.length = 0;
    for (let i = 0; i < 10; i++) {
      const px = mid * PC.CELL - 140 + (i % 5) * 66;
      const py = state.city.sandStart + 52 + Math.floor(i / 5) * 38 + (i % 3) * 6;
      ped(state, px, py, i % 2 ? 0 : Math.PI, 32);
    }
    // Two people on the promenade, clear of the lane the camera is in.
    ped(state, mid * PC.CELL - PC.ROAD / 2 - 18, state.city.beachTop - 62, -Math.PI / 2, 44);
    ped(state, mid * PC.CELL + PC.ROAD / 2 + 18, state.city.beachTop - 96, Math.PI / 2, 44);

    // Cars by both kerbs ahead: blue on the west side, amber on the east.
    state.parked.push(PC.Vehicles.makeCar(mid * PC.CELL - PC.ROAD / 2 - 22, state.city.beachTop - 210, -Math.PI / 2, '#4f8fd4'));
    state.parked.push(PC.Vehicles.makeCar(mid * PC.CELL + PC.ROAD / 2 + 22, state.city.beachTop - 330, Math.PI / 2, '#f0c14b'));

  }

  // ---- shot 2: on foot -----------------------------------------------------

  /**
   * On foot at a downtown block. The eye should land on the player first — he is the only
   * figure on the near pavement, outlined in ink — then follow his aim line across the
   * street to the gold marker on the storefront.
   */
  function onFoot(state) {
    const mid = Math.floor(PC.GRID / 2);
    const lot = PC.City.lotRect(mid, mid + 1);
    const x = lot.x + lot.w * 0.5 - 6;
    const y = lot.y + lot.h + 8;             // south pavement
    place(state, x, y, -Math.PI / 2 + 0.1);

    state.mode = 'playing';
    state.player.cash = 1240;
    state.player.health = 84;
    state.player.armour = 52;
    state.player.ammo = 96;
    state.wanted.stars = 0;
    state.wanted.heat = 0;
    state.wanted.alert = 0;
    state.missions.state = 'idle';
    state.missions.marker = { x: x + 4, y: lot.y + lot.h - 30, r: 46, label: 'The job' };
    state.hint = 'The gold marker is a job · walk onto it';
    state.toasts.length = 0;

    state.pickups.push({ kind: 'cash', x: lot.x - 40, y: y - 96, taken: false, value: 60, bob: 0.6 });

    // Shoppers on the far pavement, a couple on the near one, one crossing — never a roof.
    state.peds.length = 0;
    ped(state, lot.x + lot.w + 24, lot.y + 40, -Math.PI / 2, 40);
    ped(state, lot.x + lot.w + 30, lot.y + 96, Math.PI / 2, 36);
    ped(state, lot.x + lot.w + 22, lot.y + 148, -Math.PI / 2, 42);
    ped(state, lot.x - 24, y + 40, Math.PI / 2, 38);
    ped(state, lot.x - 86, y + 2, -Math.PI / 2 + 0.1, 44);
    ped(state, lot.x + lot.w + 92, y - 60, Math.PI / 2, 44);

    // A car idling at the kerb, one lane over: the obvious thing to steal.
    state.parked.push(PC.Vehicles.makeCar(lot.x - PC.ROAD / 2 - 34, y - 132, -Math.PI / 2, '#4f8fd4'));
  }

  // ---- shot 3: the heat ----------------------------------------------------

  /**
   * Three stars at a crossroads, framed tight. Two cruisers have the junction boxed — one
   * down the north approach with its lamps going, one slewed in broadside from the east —
   * and the officers are out of the cars between them. The player's own car sits abandoned
   * across the crossing. Everything stands on tarmac: no car parked in a flowerbed.
   */
  function police(state) {
    const mid = Math.floor(PC.GRID / 2);
    const sx = mid * PC.CELL;                // junction centre, x
    const sy = (mid + 3) * PC.CELL;          // junction centre, y
    place(state, sx, sy + 16, -Math.PI / 2 + 0.04);
    state.camera.y -= 6;                    // lean the frame north, into the ambush

    state.mode = 'playing';
    state.player.cash = 3480;
    state.player.health = 62;
    state.player.armour = 28;
    state.player.ammo = 71;

    state.wanted.stars = 3;
    state.wanted.heat = 300;
    state.wanted.alert = 0.42;

    state.missions.state = 'idle';
    state.missions.marker = null;
    state.hint = 'Lose the cops · break line of sight';
    state.toasts.length = 0;

    // The player's car, abandoned across the crossing with the door hanging open.
    state.parked.push(PC.Vehicles.makeCar(sx + 96, sy - 26, 0.62, '#8e2f36'));

    // Cruiser one: stopped dead on the north approach, headlights full on the player.
    state.cruisers.length = 0;
    const c1 = PC.Police.makeCruiser(sx - 34, sy - 118, Math.PI / 2 + 0.02);
    c1.lightPhase = 0.4;
    c1.staged = true;
    // Cruiser two: slewed in from the east, broadside across the far side of the junction.
    const c2 = PC.Police.makeCruiser(sx + 148, sy + 44, Math.PI - 0.16);
    c2.lightPhase = 1.2;
    c2.staged = true;
    state.cruisers.push(c1, c2);

    // Skid marks running south out of the junction: the stop was not gentle.
    for (let i = 0; i < 7; i++) {
      state.effects.skid(sx - 30, sy + 60 + i * 22, 0.02, 0.85 - i * 0.09);
      state.effects.skid(sx - 6, sy + 60 + i * 22, 0.02, 0.85 - i * 0.09);
    }

    // Officers out of both cars, guns up.
    state.hostiles.length = 0;
    const cop1 = PC.Police.makeOfficer(sx + 62, sy - 44, Math.PI / 2 + 0.26);
    const cop2 = PC.Police.makeOfficer(sx - 74, sy - 26, Math.PI / 2 - 0.30);
    const cop3 = PC.Police.makeOfficer(sx + 2, sy - 88, Math.PI / 2 + 0.04);
    state.hostiles.push(cop1, cop2, cop3);

    // The exchange, frozen a frame after the trigger.
    state.effects.muzzle(state.player.x + 2, state.player.y - 16);
    state.effects.burst(sx + 4, sy - 56, 'spark', 11, 0.9);
    state.effects.burst(cop1.x + 5, cop1.y - 4, 'spark', 3, 0.5);
    state.effects.addShake(5);
    state.bullets.push(PC.Combat.makeBullet(state.player.x + 2, state.player.y - 22, -Math.PI / 2 + 0.02, 'player', 26));
    state.bullets.push(PC.Combat.makeBullet(cop1.x, cop1.y - 6, Math.PI / 2 - 0.16, 'police', 8));
    state.bullets.push(PC.Combat.makeBullet(cop2.x, cop2.y - 6, Math.PI / 2 + 0.18, 'police', 8));

    // Pedestrians bolting down the pavements, on the kerb strip, clear of the firing line.
    state.peds.length = 0;
    for (let i = 0; i < 3; i++) {
      const p = ped(state, sx + 43, sy + 78 + i * 42, Math.PI / 2, 70);
      p.panic = 3;
    }
    ped(state, sx - 43, sy + 122, -Math.PI / 2, 64).panic = 3;
    ped(state, sx - 43, sy + 30, -Math.PI / 2, 64).panic = 3;

    PC.UI.toast(state.toasts, 'Three stars · coast patrol inbound', PC.PALETTE.danger);
  }

  // ---- shot 4: a job in progress -------------------------------------------

  /**
   * Counter Service accepted. Sunstate Bank owns the corner, the gold arrow hangs over its
   * door, a guard is out front, and the street is clearing behind the player. The panel on
   * the left carries the job name and the wanted line the mission actually set.
   */
  function mission(state) {
    const mid = Math.floor(PC.GRID / 2);
    const lot = PC.City.lotRect(mid - 2, mid - 2);
    const doorX = lot.x + lot.w * 0.52;
    const doorY = lot.y + lot.h - 26;
    const x = doorX - 10;
    const y = lot.y + lot.h + 12;
    place(state, x, y, -Math.PI / 2 + 0.04);

    state.mode = 'playing';
    state.player.cash = 2150;
    state.player.health = 96;
    state.player.armour = 40;
    state.player.ammo = 88;
    state.wanted.stars = 0;
    state.wanted.heat = 0;
    state.toasts.length = 0;

    state.missions.index = 1;
    state.missions.state = 'active';
    state.missions.phase = 'rob';
    state.missions.timer = 3.1;
    state.missions.marker = { x: doorX, y: doorY, r: 52, label: 'Sunstate Bank' };
    state.hint = 'Rob Sunstate Bank: reach the counter, take the cash, and get clear.';

    // A guard at the door and one covering the pavement.
    state.hostiles.length = 0;
    const guard = PC.Police.makeOfficer(doorX + 26, doorY - 4, Math.PI / 2 + 0.4);
    guard.kind = 'thug';
    guard.shirt = '#333a48';
    state.hostiles.push(guard);
    const guard2 = PC.Police.makeOfficer(lot.x + 22, y - 18, 0.2);
    guard2.kind = 'thug';
    guard2.shirt = '#3c4152';
    state.hostiles.push(guard2);

    // Civilians spilling off the pavement, away from the door.
    state.peds.length = 0;
    for (let i = 0; i < 5; i++) {
      const px = lot.x + lot.w + 24 + (i % 2) * 22;
      const py = doorY + 14 + i * 26;
      const p = ped(state, px, py, Math.PI / 2, 60);
      p.panic = 3;
    }
    ped(state, lot.x - 70, y + 2, Math.PI / 2, 58).panic = 3;

    // The getaway car at the kerb, facing north, engine running.
    state.parked.push(PC.Vehicles.makeCar(x - 58, y - 116, -Math.PI / 2 + 0.03, '#20242e'));

    // A tracer into the doorway: the job has just started.
    state.effects.muzzle(x + 2, y - 18);
    state.bullets.push(PC.Combat.makeBullet(x + 4, y - 26, -Math.PI / 2 + 0.03, 'player', 26));
    state.effects.burst(doorX + 4, doorY + 6, 'spark', 5, 0.7);

    PC.UI.toast(state.toasts, 'Counter Service · Sunstate Bank', PC.PALETTE.gold);
  }

  // ---- entry points -------------------------------------------------------

  /**
   * Apply a shot by number; 1 is the cover. Zoom is per-shot: the cover is pulled back so
   * the frame reads as a city, the action shots are pushed in so the figures read.
   */
  function apply(state, n, W, H) {
    state.camera.w = W;
    state.camera.h = H;
    state.shot = n;
    state.camera.zoom = n === 1 ? 1.24 : n === 3 ? 1.95 : 1.55;
    if (n === 1) cover(state);
    else if (n === 2) onFoot(state);
    else if (n === 3) police(state);
    else mission(state);
  }

  /**
   * Top the scene up while it settles. Muzzle flashes live 70 ms and particles under a
   * second, so a scene captured 40 frames in would otherwise show a firefight with no
   * gunfire in it. Only shot 3 needs this.
   */
  function tick(state, dt) {
    if (state.missions.state === 'active' && state.shot === 4) state.missions.timer += dt * 0.02;
    if (state.shot !== 3) return;

    const fx = state.effects;
    const p = state.player;
    if (fx.flashes.length === 0) fx.muzzle(p.x + 2, p.y - 16);
    if (fx.particles.length < 40) fx.burst(p.x + 2, p.y - 56, 'spark', 7, 0.8);
    if (state.bullets.length < 3) {
      state.bullets.push(PC.Combat.makeBullet(p.x + 2, p.y - 22, -Math.PI / 2 + 0.02, 'player', 26));
    }
  }

  PC.Shots = { apply, tick, lane };
})(window);
