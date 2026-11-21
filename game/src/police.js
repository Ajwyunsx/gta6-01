// Palm City — the heat: a five-star wanted level, cruisers that spawn off-road and hunt
// you, officers who get out and shoot, and the cool-down when you break line of sight.
(function (global) {
  'use strict';

  const PC = global.PC;
  const P = PC.POLICE;

  function makeWanted() {
    return {
      heat: 0,            // 0..500; every 100 is a star
      stars: 0,
      decayDelay: 0,      // seconds of quiet before the heat starts dropping
      lastCrime: 0,
      busted: false,
      alert: 0,           // 0..1, drives the screen edge flash
    };
  }

  function addHeat(wanted, amount) {
    wanted.heat = PC.clamp(wanted.heat + amount, 0, P.maxStars * P.heatPerStar);
    wanted.decayDelay = 9;
    wanted.lastCrime = 0;
    const stars = Math.min(P.maxStars, Math.floor(wanted.heat / P.heatPerStar));
    if (stars > wanted.stars) wanted.alert = 1;
    wanted.stars = stars;
  }

  function clearWanted(wanted) {
    wanted.heat = 0;
    wanted.stars = 0;
    wanted.decayDelay = 0;
    wanted.alert = 0;
  }

  function makeCruiser(x, y, angle) {
    const car = PC.Vehicles.makeCar(x, y, angle, '#f2f4f8');
    car.driver = 'police';
    car.occupied = true;
    car.siren = true;
    car.lightPhase = 0;
    car.officers = 2;
    return car;
  }

  /** Find a road point off-camera to spawn a cruiser at, so cops arrive rather than appear. */
  function spawnPoint(player, camera, city) {
    const rand = Math.random;
    for (let attempt = 0; attempt < 24; attempt++) {
      const row = Math.floor(rand() * (PC.GRID - 1));
      const col = Math.floor(rand() * PC.GRID);
      const horizontal = rand() < 0.5;
      const x = horizontal ? col * PC.CELL + PC.CELL / 2 : rand() * PC.WORLD;
      const y = horizontal ? rand() * city.beachTop : row * PC.CELL + PC.CELL / 2;
      const sx = (x - camera.x) / camera.w;
      const sy = (y - camera.y) / camera.h;
      const onScreen = sx > -0.05 && sx < 1.05 && sy > -0.05 && sy < 1.05;
      const d = PC.dist(x, y, player.x, player.y);
      if (!onScreen && d > 380 && d < 1500) return { x, y };
    }
    return { x: player.x + 520, y: player.y + 520 };
  }

  /**
   * Per-step police logic: spawn cruisers up to the star count, drive them at the player,
   * have officers bail out when close and shoot, and cool the heat down when nobody is
   * near for a while.
   */
  function update(state, dt) {
    const { wanted, player, cruisers, city, camera, bullets } = state;
    if (wanted.alert > 0) wanted.alert = Math.max(0, wanted.alert - dt * 0.7);

    if (wanted.stars === 0) {
      // No stars: send the remaining cruisers home.
      for (const c of cruisers) c.leaving = true;
      wanted.decayDelay = 0;
      return;
    }

    // Cool-down only when no cruiser is close enough to see the player.
    let seen = false;
    for (const c of cruisers) {
      if (PC.dist(c.x, c.y, player.x, player.y) < 620) seen = true;
    }
    if (!seen && wanted.decayDelay > 0) wanted.decayDelay -= dt;
    if (wanted.decayDelay <= 0 && !seen) {
      wanted.heat = Math.max(0, wanted.heat - P.coolRate * (1 + wanted.stars * 0.2) * dt);
      const stars = Math.min(P.maxStars, Math.floor(wanted.heat / P.heatPerStar));
      if (stars !== wanted.stars) {
        wanted.stars = stars;
        state.onStarsChanged?.(stars);
      }
    }

    // Spawn.
    wanted.spawnTimer = (wanted.spawnTimer || 0) - dt;
    const target = Math.min(P.maxCars, 1 + wanted.stars);
    if (wanted.spawnTimer <= 0 && cruisers.length < target) {
      const pt = spawnPoint(player, camera, city);
      const angle = Math.atan2(player.y - pt.y, player.x - pt.x);
      const cruiser = makeCruiser(pt.x, pt.y, angle);
      cruisers.push(cruiser);
      wanted.spawnTimer = Math.max(1.2, P.spawnInterval - wanted.stars * 0.35);
    }

    for (let i = cruisers.length - 1; i >= 0; i--) {
      const c = cruisers[i];
      c.lightPhase += dt * 7;

      if (c.leaving) {
        PC.Vehicles.drive(c, 1, 0, false, dt);
        PC.Vehicles.collideWithCity(c, city);
        if (PC.dist(c.x, c.y, player.x, player.y) > 1400) cruisers.splice(i, 1);
        continue;
      }

      // A staged still holds the cruisers exactly where the scene put them; without this
      // they drive themselves out of frame during the settle and the shot is a random crop.
      if (c.staged) continue;

      // Chase: drive toward the player, braking when close so they can bail out.
      const dx = player.x - c.x;
      const dy = player.y - c.y;
      const d = Math.hypot(dx, dy) || 1;
      const want = Math.atan2(dy, dx);
      const diff = PC.angleDiff(c.angle, want);
      const steer = PC.clamp(diff * 1.9, -1, 1);
      let throttle = 1;
      if (d < 150 && Math.abs(diff) > 1.0) throttle = -0.4;
      if (d < 90) throttle = -0.5;

      PC.Vehicles.drive(c, throttle, steer, false, dt);
      PC.Vehicles.collideWithCity(c, city);
      c.speed = Math.min(c.speed, P.cruiserSpeed);

      // Officers bail out and shoot when the cruiser is close and slow.
      if (d < 260 && Math.abs(c.speed) < 120 && c.officers > 0) {
        c.bailTimer = (c.bailTimer || 0) - dt;
        if (c.bailTimer <= 0) {
          const angle = Math.atan2(dy, dx) + (Math.random() - 0.5) * 1.4;
          state.spawnOfficer(
            c.x + Math.cos(angle) * 26,
            c.y + Math.sin(angle) * 26,
            angle,
          );
          c.officers -= 1;
          c.bailTimer = 0.55;
        }
      }

      // Drive-by fire at high stars.
      if (wanted.stars >= 3 && d < P.shootRange && Math.random() < dt * (0.55 + wanted.stars * 0.1)) {
        const angle = Math.atan2(dy, dx) + (Math.random() - 0.5) * 0.22;
        bullets.push({
          x: c.x + Math.cos(angle) * 26,
          y: c.y + Math.sin(angle) * 26,
          vx: Math.cos(angle) * P.bulletSpeed,
          vy: Math.sin(angle) * P.bulletSpeed,
          life: 0.5,
          from: 'police',
          damage: 7,
        });
      }
    }
  }

  /** An officer on foot: walks toward the player, fires in bursts. */
  function makeOfficer(x, y, facing) {
    const a = PC.Entities.makeActor(x, y, {
      kind: 'cop',
      health: PC.COMBAT.copHealth,
      speed: 96,
      radius: 9,
      shirt: '#2f3d5c',
      hair: '#2b2018',
    });
    a.facing = facing;
    a.burst = 1;
    a.burstTimer = 0.4;
    return a;
  }

  function updateOfficer(cop, player, dt, bullets) {
    if (cop.dead) return;
    const d = PC.dist(cop.x, cop.y, player.x, player.y);
    const want = Math.atan2(player.y - cop.y, player.x - cop.x);
    cop.facing = PC.wrapAngle(cop.facing + PC.angleDiff(cop.facing, want) * Math.min(1, dt * 6));

    if (d > 230) {
      // Close the gap.
      cop.x += Math.cos(want) * cop.speed * dt;
      cop.y += Math.sin(want) * cop.speed * dt;
      cop.walkPhase += dt * 5;
    } else if (d < 110) {
      // Back off a little while firing.
      cop.x -= Math.cos(want) * cop.speed * 0.5 * dt;
      cop.y -= Math.sin(want) * cop.speed * 0.5 * dt;
    }

    cop.burstTimer -= dt;
    if (d < PC.POLICE.shootRange && cop.burstTimer <= 0) {
      const angle = want + (Math.random() - 0.5) * 0.16;
      bullets.push({
        x: cop.x + Math.cos(angle) * 14,
        y: cop.y + Math.sin(angle) * 14,
        vx: Math.cos(angle) * PC.POLICE.bulletSpeed,
        vy: Math.sin(angle) * PC.POLICE.bulletSpeed,
        life: 0.45,
        from: 'police',
        damage: 8,
      });
      cop.burst -= 1;
      cop.burstTimer = cop.burst > 0 ? 0.13 : 1.1 + Math.random() * 0.9;
      if (cop.burst <= 0) cop.burst = 3;
    }
  }

  PC.Police = { makeWanted, addHeat, clearWanted, update, makeCruiser, makeOfficer, updateOfficer, spawnPoint };
})(window);
