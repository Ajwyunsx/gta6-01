// Palm City — the world: one state object and the fixed step that moves every system
// forward in order (input, player, cars, traffic, police, combat, missions, effects).
(function (global) {
  'use strict';

  const PC = global.PC;

  /** Build a fresh world for a seed, with the player dropped on a downtown street. */
  function create(seed) {
    const city = PC.City.build(seed);
    const startAnchor = PC.Missions.anchorOf(city, 'garage');
    const player = PC.Entities.makePlayer(startAnchor.x + 60, startAnchor.y + 30);

    const traffic = PC.Traffic.spawnTraffic(city, PC.TRAFFIC.count);

    // Parked cars are real, stealable cars, so the street feels stocked.
    const parked = city.parkedCars.map((p) => {
      const car = PC.Vehicles.makeCar(p.x, p.y, p.angle, p.colour);
      car.parked = true;
      return car;
    });

    const state = {
      seed: city.seed,
      city,
      player,
      traffic,
      parked,
      cruisers: [],
      peds: PC.Entities.spawnPedestrians(city, 34),
      hostiles: [],
      bullets: [],
      pickups: PC.Combat.spawnPickups(city, 15),
      effects: PC.Effects.makeEffects(),
      wanted: PC.Police.makeWanted(),
      missions: PC.Missions.makeMissions(city),
      toasts: PC.UI.makeToasts(),
      camera: { x: player.x, y: player.y, w: 1280, h: 720, zoom: 1.15 },
      time: 0,
      mode: 'title',            // title | playing | briefing | paused | busted | wasted
      paused: false,
      missionCar: null,
      aim: 0,
      noise: null,
      lastShot: null,
      bustedTimer: 0,
      wastedTimer: 0,
      stats: { shotsFired: 0, kills: 0, carsStolen: 0, jobsDone: 0, distance: 0 },
      messageTimer: 0,
    };

    // The pier car for the first job: a bright yellow coupe waiting on the sand.
    const pier = PC.Missions.anchorOf(city, 'pier');
    state.missionCar = PC.Vehicles.makeCar(pier.x + 40, pier.y + 10, -Math.PI / 2, '#f0c14b');
    state.missionCar.mission = true;
    state.missionCar.driver = null;
    state.missionCar.occupied = false;
    state.parked.push(state.missionCar);

    state.cars = () => state.parked.concat(state.traffic, state.cruisers);

    state.onCrime = (amount, label) => {
      PC.Police.addHeat(state.wanted, amount);
      if (label) PC.UI.toast(state.toasts, `Wanted: ${label}`, PC.PALETTE.danger);
    };

    state.onMissionDone = (job) => {
      state.stats.jobsDone += 1;
      PC.UI.toast(state.toasts, `Job complete · ${job.title} · ${PC.money(job.reward)}`, '#9ce0a8');
      PC.Audio.success();
    };

    state.spawnOfficer = (x, y, facing) => {
      const cop = PC.Police.makeOfficer(x, y, facing);
      state.hostiles.push(cop);
      return cop;
    };

    state.spawnRaid = (x, y) => {
      const cop = PC.Police.makeOfficer(x, y, Math.atan2(state.player.y - y, state.player.x - x));
      cop.health = 120;
      state.hostiles.push(cop);
      return cop;
    };

    state.camera.w = 1280;
    state.camera.h = 720;
    PC.Missions.begin(state.missions, city);
    state.missions.state = 'idle';
    state.missions.marker = null;
    return state;
  }

  /** Respawn the player at the garage after a bust, keeping the story but not the heat. */
  function respawn(state, keepCash) {
    const anchor = PC.Missions.anchorOf(state.city, 'garage');
    const p = state.player;
    p.x = anchor.x + 60;
    p.y = anchor.y + 30;
    p.health = p.maxHealth;
    p.armour = 0;
    p.dead = false;
    p.inCar = null;
    p.facing = -Math.PI / 2;
    if (!keepCash) p.cash = Math.floor(p.cash * 0.85);
    PC.Police.clearWanted(state.wanted);
    state.cruisers.length = 0;
    state.hostiles.length = 0;
    state.bullets.length = 0;
    state.effects.clear();
    state.mode = 'playing';
    state.camera.x = p.x;
    state.camera.y = p.y;

    // Put the mission back at its start so the job can be retried.
    const job = PC.Missions.current(state.missions);
    state.missions.state = 'idle';
    state.missions.marker = { x: PC.Missions.anchorOf(state.city, job.anchor).x, y: PC.Missions.anchorOf(state.city, job.anchor).y, r: 44, label: job.title };
    state.missions.phase = undefined;
    state.missions.timer = 0;
  }

  /** Aim angle from the player to the mouse, in world space. */
  function aimAngle(state, mouse, W, H) {
    const cam = state.camera;
    const wx = cam.x + (mouse.x - W / 2) / cam.zoom;
    const wy = cam.y + (mouse.y - H / 2) / cam.zoom;
    return Math.atan2(wy - state.player.y, wx - state.player.x);
  }

  /** Walk or drive the player from the input, one fixed step. */
  function movePlayer(state, input, dt) {
    const p = state.player;
    const keys = input.keys;

    if (p.inCar) {
      const car = p.inCar;
      if (car.staged) {
        // A staged scene holds the player's car still: the camera is the composition.
        p.x = car.x;
        p.y = car.y;
        return;
      }
      const throttle = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);
      const steer = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
      const handbrake = !!keys.Space;
      PC.Vehicles.drive(car, throttle, steer, handbrake, dt);

      if (PC.Vehicles.collideWithCity(car, state.city)) {
        state.effects.addShake(2.2);
        state.effects.burst(car.x, car.y, 'spark', 5, 0.7);
        PC.Audio.impact(0.5);
      }

      // Run over pedestrians: rough but it is the genre.
      for (const ped of state.peds) {
        if (ped.dead) continue;
        if (PC.dist(car.x, car.y, ped.x, ped.y) < car.radius + ped.radius && Math.abs(car.speed) > 120) {
          PC.Entities.damage(ped, 200);
          state.effects.burst(ped.x, ped.y, 'blood', 7, 0.8);
          state.onCrime(30, 'hit and run');
        }
      }

      if (PC.Vehicles.skidAmount(car) > 0.3 && Math.abs(car.speed) > 90) {
        const back = car.angle + Math.PI;
        state.effects.skid(car.x + Math.cos(back) * 14, car.y + Math.sin(back) * 14, car.angle, PC.Vehicles.skidAmount(car));
        if (Math.random() < dt * 12) state.effects.burst(car.x, car.y, 'smoke', 1, 0.35);
      }
      p.x = car.x;
      p.y = car.y;
      return;
    }

    const ax = input.axis();
    const sprint = keys.ShiftLeft || keys.ShiftRight;
    const speed = sprint ? PC.RUN_SPEED : PC.WALK_SPEED;
    if (ax.x !== 0 || ax.y !== 0) {
      const len = Math.hypot(ax.x, ax.y);
      p.x += (ax.x / len) * speed * dt;
      p.y += (ax.y / len) * speed * dt;
      p.walkPhase += dt * (sprint ? 11 : 7);
      state.stats.distance += speed * dt;
    } else {
      p.walkPhase += dt * 1.2;
    }

    // Face the aim.
    if (input.mouse) p.facing = state.aim;

    // Building collision: slide around the corner rather than stop dead.
    const hit = PC.City.hitsBuilding(state.city, p.x, p.y, p.radius);
    if (hit) {
      const nx = PC.clamp(p.x, hit.x, hit.x + hit.w);
      const ny = PC.clamp(p.y, hit.y, hit.y + hit.h);
      let dx = p.x - nx;
      let dy = p.y - ny;
      if (dx === 0 && dy === 0) {
        // Inside: push out the nearest face.
        const left = p.x - hit.x;
        const right = hit.x + hit.w - p.x;
        const top = p.y - hit.y;
        const bottom = hit.y + hit.h - p.y;
        const m = Math.min(left, right, top, bottom);
        if (m === left) p.x = hit.x - p.radius;
        else if (m === right) p.x = hit.x + hit.w + p.radius;
        else if (m === top) p.y = hit.y - p.radius;
        else p.y = hit.y + hit.h + p.radius;
      } else {
        const d = Math.hypot(dx, dy) || 1;
        p.x = nx + (dx / d) * (p.radius + 0.5);
        p.y = ny + (dy / d) * (p.radius + 0.5);
      }
    }

    p.x = PC.clamp(p.x, 10, PC.WORLD - 10);
    p.y = PC.clamp(p.y, 10, state.city.waterTop - 24);
  }

  /** Pedestrians react to gunfire and the player's crimes. */
  function updatePeds(state, dt) {
    for (const ped of state.peds) {
      PC.Entities.updatePedestrian(ped, state.city, dt, state.noise);
      if (ped.dead) {
        if (ped.deadTimer > 24) {
          // Clean the street after a while.
          const anchor = PC.Missions.anchorOf(state.city, 'garage');
          ped.dead = false;
          ped.health = ped.maxHealth;
          ped.x = anchor.x + Math.random() * 300 - 150;
          ped.y = anchor.y + Math.random() * 300 - 150;
        }
      }
    }
    state.noise = null;
  }

  /** Police on foot: step, shoot, and clear the dead. */
  function updateHostiles(state, dt) {
    for (let i = state.hostiles.length - 1; i >= 0; i--) {
      const h = state.hostiles[i];
      if (h.dead) {
        if (h.deadTimer > 20) state.hostiles.splice(i, 1);
        else h.deadTimer += dt;
        continue;
      }
      if (h.kind === 'cop' || h.kind === 'thug') {
        PC.Police.updateOfficer(h, state.player, dt, state.bullets);
        // Keep them out of buildings.
        const hit = PC.City.hitsBuilding(state.city, h.x, h.y, h.radius);
        if (hit) {
          h.x -= Math.cos(h.facing) * 40 * dt;
          h.y -= Math.sin(h.facing) * 40 * dt;
        }
      }
    }
  }

  /**
   * One fixed step of everything. Order matters: input, player, then the world that
   * reacts to the player, then the things that kill the player.
   */
  function step(state, input, dt, W, H) {
    state.time += dt;

    if (state.mode !== 'playing' && state.mode !== 'briefing') {
      // Menus still animate the world a little so the background breathes.
      state.effects.update(dt);
      PC.UI.tickToasts(state.toasts, dt);
      return;
    }

    state.aim = aimAngle(state, input.mouse, W, H);

    movePlayer(state, input, dt);

    // Traffic and parked cars.
    for (const car of state.traffic) PC.Traffic.updateTraffic(car, state.traffic, dt, state.city);

    // Police.
    PC.Police.update(state, dt);
    updateHostiles(state, dt);

    // Fire.
    if (state.mode === 'playing' && input.mouse.down && !state.player.inCar) {
      const shot = PC.Combat.playerShoot(state.player, state.hostiles.concat(state.peds), state.city);
      if (shot) {
        state.stats.shotsFired += 1;
        state.lastShot = shot;
        state.effects.muzzle(shot.ox, shot.oy);
        state.effects.burst(shot.x, shot.y, 'spark', 3, 0.5);
        state.effects.addShake(1.5);
        PC.Audio.shot(0.9);
        const targets = [
          ...state.hostiles.map((h) => ({ actor: h, hostile: true })),
          ...state.peds.map((p) => ({ actor: p, hostile: false })),
        ];
        let best = null;
        let bestD = Infinity;
        for (const t of targets) {
          if (t.actor.dead) continue;
          const d = PC.dist(shot.x, shot.y, t.actor.x, t.actor.y);
          if (d < 26 && d < bestD) {
            best = t;
            bestD = d;
          }
        }
        if (best) {
          const killed = PC.Entities.damage(best.actor, shot.damage);
          state.effects.burst(best.actor.x, best.actor.y, 'blood', 6, 0.7);
          if (killed) {
            state.stats.kills += 1;
            state.player.cash += best.hostile ? 45 : 22;
            PC.UI.toast(state.toasts, best.hostile ? 'Suspect down · $45' : 'Civilian down', best.hostile ? '#9ce0a8' : PC.PALETTE.danger);
          }
          state.onCrime(best.hostile ? 18 : 45, best.hostile ? 'shots fired' : 'civilian shot');
        } else {
          state.onCrime(8, 'gunfire');
        }
        state.noise = { x: shot.ox, y: shot.oy, radius: 340 };
      }
    }

    // Bullets in flight.
    const events = PC.Combat.updateBullets(state.bullets, state.player, state.city, dt);
    for (const e of events) {
      if (e.type === 'playerHit') {
        PC.Entities.damage(state.player, e.damage);
        state.effects.burst(e.x, e.y, 'spark', 3, 0.4);
        state.effects.addShake(2);
      } else {
        state.effects.burst(e.x, e.y, 'spark', 2, 0.4);
      }
    }

    // Pickups.
    PC.Combat.tickPickups(state.pickups, dt);
    const got = PC.Combat.tryPickup(state.pickups, state.player);
    if (got) {
      PC.UI.toast(
        state.toasts,
        got.kind === 'cash' ? `Picked up ${PC.money(got.value)}` : got.kind === 'health' ? 'Health restored' : 'Armour up',
        got.kind === 'cash' ? PC.PALETTE.gold : '#9ce0a8',
      );
      PC.Audio.pickup(got.kind);
    }

    // Missions.
    PC.Missions.update(state.missions, state, dt);

    // Dead check.
    if (state.player.health <= 0 && state.mode === 'playing') {
      state.mode = 'wasted';
      state.wastedTimer = 0;
      state.player.dead = true;
      if (state.player.inCar) PC.Vehicles.playerExit(state.player, state.player.inCar);
    }

    // Busted: standing still in a cop's face with no car.
    if (state.mode === 'playing' && state.wanted.stars > 0 && !state.player.inCar) {
      let nearCop = false;
      for (const h of state.hostiles) {
        if (!h.dead && h.kind === 'cop' && PC.dist(h.x, h.y, state.player.x, state.player.y) < 40) nearCop = true;
      }
      state.bustedGauge = nearCop ? (state.bustedGauge || 0) + dt : 0;
      if (state.bustedGauge > 1.6) {
        state.mode = 'busted';
        state.bustedTimer = 0;
      }
    }

    updatePeds(state, dt);
    state.effects.update(dt);
    PC.UI.tickToasts(state.toasts, dt);

    // Camera: lead the player a little in the direction they face when on foot.
    const cam = state.camera;
    const lead = state.player.inCar ? state.player.inCar.angle : state.player.facing;
    const leadX = state.player.inCar ? 0 : Math.cos(lead) * 46;
    const leadY = state.player.inCar ? 0 : Math.sin(lead) * 46;
    cam.x = PC.lerp(cam.x, state.player.x + leadX, 1 - Math.pow(0.0016, dt));
    cam.y = PC.lerp(cam.y, state.player.y + leadY, 1 - Math.pow(0.0016, dt));

    // Sound.
    const car = state.player.inCar;
    PC.Audio.engineLevel(car ? Math.min(1, Math.abs(car.speed) / PC.CAR.maxSpeed) : 0, !!car);
    let nearestSiren = 0;
    for (const c of state.cruisers) {
      const d = PC.dist(c.x, c.y, state.player.x, state.player.y);
      nearestSiren = Math.max(nearestSiren, PC.clamp(1 - d / 900, 0, 1));
    }
    PC.Audio.sirenLevel(nearestSiren * (state.wanted.stars > 0 ? 1 : 0));
  }

  /** Progressive wanted level from crimes, kept for the HUD flashes. */
  function tickWantedFlash(state, dt) {
    if (state.wanted.alert > 0) state.wanted.alert = Math.max(0, state.wanted.alert - dt * 0.8);
  }

  PC.World = { create, step, respawn, aimAngle, tickWantedFlash };
})(window);
