// Palm City — staged scenes for the four screenshots. ?shot=1..4 sets the world up so each
// still shows a different slice of the game: the city from a car, the player on foot, a
// police chase, and a mission in progress.
(function (global) {
  'use strict';

  const PC = global.PC;

  /** Put the player at a road position facing an angle, camera snapped behind them. */
  function place(state, x, y, facing) {
    const p = state.player;
    p.x = x;
    p.y = y;
    p.facing = facing;
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

  /**
   * Shot 1: the cover. A boulevard downtown at dusk, seen from a convertible heading
   * north: traffic in both directions, palms, lit windows, the sea beyond the blocks.
   */
  function cover(state) {
    const mid = Math.floor(PC.GRID / 2);
    const x = mid * PC.CELL + PC.CELL / 2 - 17;
    const y = (mid + 2.6) * PC.CELL;
    const car = seat(state, x, y, -Math.PI / 2, '#e9553f');
    car.speed = 210;
    car.vx = 0;
    car.vy = -210;

    state.mode = 'playing';
    state.wanted.stars = 0;
    state.missions.state = 'idle';
    state.missions.marker = null;
    state.toasts.length = 0;
    PC.UI.toast(state.toasts, 'Palm City · seven jobs on the coast', PC.PALETTE.gold);

    // A few pedestrians walking the crossing in front of the camera.
    state.peds.length = 0;
    for (let i = 0; i < 9; i++) {
      const px = x + (i - 4) * 42 + (i % 2) * 16;
      const py = y - 160 - (i % 3) * 54;
      const ped = PC.Entities.makeActor(px, py, { speed: 46 });
      ped.facing = i % 2 === 0 ? 0 : Math.PI;
      state.peds.push(ped);
    }
  }

  /**
   * Shot 2: on foot, downtown crossing. The player stands at a kerb with the minimap and
   * bars up, a pick-up glinting nearby, traffic waiting at the light.
   */
  function onFoot(state) {
    const mid = Math.floor(PC.GRID / 2);
    const x = mid * PC.CELL + PC.CELL / 2 + 26;
    const y = (mid + 1) * PC.CELL + 34;
    place(state, x, y, -Math.PI / 2 + 0.25);
    state.mode = 'playing';
    state.player.cash = 1240;
    state.player.health = 84;
    state.player.armour = 52;
    state.player.ammo = 96;
    state.player.inCar = null;
    state.wanted.stars = 0;

    // A pick-up on the pavement so the HUD has something to point at.
    state.pickups.push({ kind: 'cash', x: x + 92, y: y - 46, taken: false, value: 60, bob: 0.6 });

    state.peds.length = 0;
    for (let i = 0; i < 12; i++) {
      const px = x + (i % 4) * 64 - 96;
      const py = y - 90 - Math.floor(i / 4) * 58;
      const ped = PC.Entities.makeActor(px, py, { speed: 42 });
      ped.facing = i % 3 === 0 ? Math.PI / 2 : -Math.PI / 2;
      state.peds.push(ped);
    }

    // A parked car by the kerb to make the "steal" prompt plausible.
    const car = PC.Vehicles.makeCar(x - 74, y - 26, -Math.PI / 2, '#4f8fd4');
    state.parked.push(car);
  }

  /**
   * Shot 3: the heat. Three stars, a cruiser on the player's tail with the light bar going,
   * officers on foot, the player firing from behind a parked car.
   */
  function police(state) {
    const mid = Math.floor(PC.GRID / 2);
    const x = mid * PC.CELL + PC.CELL / 2 + 6;
    const y = (mid + 1) * PC.CELL + 40;
    place(state, x, y, -Math.PI / 2);
    state.mode = 'playing';
    state.player.cash = 3480;
    state.player.health = 62;
    state.player.armour = 28;
    state.player.inCar = null;
    state.player.ammo = 71;

    state.wanted.stars = 3;
    state.wanted.heat = 300;
    state.wanted.alert = 0.9;

    state.cruisers.length = 0;
    const c1 = PC.Police.makeCruiser(x + 30, y - 250, Math.PI / 2);
    c1.lightPhase = 0.4;
    const c2 = PC.Police.makeCruiser(x - 190, y - 120, 0.35);
    c2.lightPhase = 1.2;
    state.cruisers.push(c1, c2);

    state.hostiles.length = 0;
    const cop1 = PC.Police.makeOfficer(x + 96, y - 150, Math.PI / 2 + 0.4);
    const cop2 = PC.Police.makeOfficer(x - 70, y - 176, Math.PI / 2 - 0.5);
    state.hostiles.push(cop1, cop2);

    // Muzzle flash and a couple of sparks so the frame has action in it.
    state.effects.muzzle(x + 14, y - 18);
    state.effects.burst(x + 60, y - 120, 'spark', 8, 0.8);
    state.effects.addShake(3);
    state.bullets.push(PC.Combat.makeBullet(x + 20, y - 30, -Math.PI / 2 + 0.1, 'player', 26));

    state.peds.length = 0;
    for (let i = 0; i < 6; i++) {
      const ped = PC.Entities.makeActor(x + 120 + i * 34, y - 40 - (i % 2) * 40, { speed: 60 });
      ped.panic = 2.5;
      ped.facing = Math.PI / 2;
      state.peds.push(ped);
    }

    // The player's cover.
    const cover = PC.Vehicles.makeCar(x - 12, y - 70, 0, '#efe6d5');
    state.parked.push(cover);
  }

  /**
   * Shot 4: a mission. The briefing has been accepted, the marker sits across the street,
   * the objective is on the HUD and the player is walking toward it with a gun up.
   */
  function mission(state) {
    const anchor = PC.Missions.anchorOf(state.city, 'bank');
    const x = anchor.x + 40;
    const y = anchor.y + 140;
    place(state, x, y, -Math.PI / 2 - 0.2);
    state.mode = 'playing';
    state.player.cash = 2150;
    state.player.health = 96;
    state.player.armour = 40;
    state.player.inCar = null;
    state.player.ammo = 88;
    state.wanted.stars = 0;

    state.missions.index = 1;             // Counter Service
    state.missions.state = 'active';
    state.missions.phase = 'rob';
    state.missions.timer = 0;
    state.missions.marker = { x: anchor.x, y: anchor.y, r: 52, label: 'Sunstate Bank' };

    // A guard outside the bank, and a customer on the pavement.
    state.hostiles.length = 0;
    const guard = PC.Police.makeOfficer(anchor.x + 26, anchor.y - 26, Math.PI / 2);
    guard.kind = 'thug';
    guard.shirt = '#3b4250';
    state.hostiles.push(guard);

    state.peds.length = 0;
    for (let i = 0; i < 7; i++) {
      const ped = PC.Entities.makeActor(anchor.x - 130 + i * 44, anchor.y + 64 + (i % 2) * 30, { speed: 40 });
      ped.facing = i % 2 ? 0 : Math.PI;
      state.peds.push(ped);
    }

    PC.UI.toast(state.toasts, 'Counter Service · Sunstate Bank', PC.PALETTE.gold);
  }

  /** Apply a shot by number; 1 is the cover. */
  function apply(state, n, W, H) {
    state.camera.w = W;
    state.camera.h = H;
    // Give the traffic a moment of life before the still is taken.
    if (n === 1) cover(state);
    else if (n === 2) onFoot(state);
    else if (n === 3) police(state);
    else mission(state);
  }

  /** Let staged scenes drift a little so nothing is frozen mid-swing. */
  function tick(state, dt) {
    // Traffic and pedestrians already move inside World.step; here we only keep the
    // mission clock honest so the HUD shows a live objective on the still.
    if (state.missions.state === 'active') state.missions.timer += dt * 0;
  }

  PC.Shots = { apply, tick };
})(window);
