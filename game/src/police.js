/* Palm City — the heat system. Crimes add stars; stars bring cruisers that spawn just out of
   sight, chase the player and try to box them in. Out of sight and out of trouble the stars cool
   off one at a time, newest first. Busting happens when a cruiser pins the player on foot. */
(function (PC) {
  'use strict';

  var C = PC.CONFIG, P = PC.PALETTE, U = PC.util, V = PC.vehicles;

  var CRIMES = {
    carjack: { stars: 2, label: 'Grand theft auto' },
    shooting: { stars: 2, label: 'Discharge of a firearm' },
    assault: { stars: 1, label: 'Assault' },
    hitPed: { stars: 1, label: 'Hit and run' },
    hitCop: { stars: 3, label: 'Assaulting an officer' },
    ram: { stars: 2, label: 'Reckless driving' },
    property: { stars: 1, label: 'Vandalism' }
  };

  function makeHeat() {
    return {
      stars: 0, max: 5, decay: 0, seen: 0,
      cops: [], wantedSince: -1, busted: false, bustTimer: 0,
      lastCrime: null, crimeTimer: 0, spawnTimer: 0
    };
  }

  function commit(heat, crime, world) {
    var c = CRIMES[crime] || CRIMES.assault;
    heat.stars = Math.min(heat.max, Math.max(heat.stars + 1, (heat.stars === 0 ? c.stars : heat.stars + 1)));
    heat.decay = C.POLICE.heatDecayDelay;
    heat.lastCrime = c.label;
    heat.crimeTimer = 3.2;
    heat.busted = false;
    heat.bustTimer = 0;
    if (heat.wantedSince < 0) heat.wantedSince = world.time;
    world.audio.siren(true);
    world.hud.flash(heat.lastCrime, P.heat);
  }

  function updateHeat(heat, dt, world) {
    if (heat.crimeTimer > 0) heat.crimeTimer -= dt;

    // cool-down: no crime and no cruiser within sight for a while
    var copSeen = 0;
    for (var i = 0; i < heat.cops.length; i++) {
      var cop = heat.cops[i];
      if (U.dist(cop.x, cop.y, world.player.x, world.player.y) < 560) copSeen++;
    }
    if (heat.stars > 0) {
      if (copSeen > 0) heat.decay = Math.max(heat.decay, 2.5);
      else heat.decay -= dt;
      if (heat.decay <= 0) {
        heat.stars -= 1;
        heat.decay = C.POLICE.heatDecayDelay * 0.7;
        if (heat.stars <= 0) {
          heat.stars = 0;
          heat.wantedSince = -1;
          world.audio.siren(false);
          world.hud.flash('You lost the cops', P.accent2);
          recallCops(heat, world);
        }
      }
    }

    if (heat.stars > 0) {
      heat.spawnTimer -= dt;
      var want = Math.min(C.POLICE.maxCars, 1 + heat.stars);
      if (heat.cops.length < want && heat.spawnTimer <= 0) {
        spawnCruiser(heat, world);
        heat.spawnTimer = 1.5;
      }
      driveCops(heat, dt, world);
      checkBusted(heat, dt, world);
      world.audio.heat(heat.stars);
    } else {
      recallCops(heat, world);
    }
  }

  function spawnCruiser(heat, world) {
    var rng = world.rng;
    for (var tries = 0; tries < 20; tries++) {
      var ang = rng() * Math.PI * 2;
      var dist = C.POLICE.spawnRange + rng() * 240;
      var x = world.player.x + Math.cos(ang) * dist;
      var y = world.player.y + Math.sin(ang) * dist;
      if (x < 40 || y < 40 || x > C.CITY_W - 40 || y > C.CITY_H + C.BEACH_H - 60) continue;
      if (PC.city.collideCircle(world.city, x, y, 30)) continue;
      var cop = V.makeCar(x, y, ang + Math.PI, { rng: rng, police: true, paint: '#f2f0e8', type: 'sedan' });
      cop.occupied = true;
      cop.officers = 2;
      cop.sirenOn = true;
      heat.cops.push(cop);
      return cop;
    }
    return null;
  }

  function recallCops(heat, world) {
    // no stars: cruisers drive off and leave the world once they are far away
    for (var i = heat.cops.length - 1; i >= 0; i--) {
      var cop = heat.cops[i];
      if (cop.driver === 'player') continue;
      if (U.dist(cop.x, cop.y, world.player.x, world.player.y) > 900) {
        heat.cops.splice(i, 1);
      }
    }
  }

  function driveCops(heat, dt, world) {
    var pl = world.player;
    for (var i = heat.cops.length - 1; i >= 0; i--) {
      var cop = heat.cops[i];
      if (cop.health <= 0) { heat.cops.splice(i, 1); continue; }
      if (cop.driver === 'player') continue;

      var dx = pl.x - cop.x, dy = pl.y - cop.y;
      var dist = Math.sqrt(dx * dx + dy * dy) || 1;
      var wantAngle = Math.atan2(dy, dx);
      var diff = U.angleDiff(cop.angle, wantAngle);
      var sp = C.POLICE.speed;

      // simple rubber-band: faster when far, brake when right on top of the target
      var throttle = dist > 260 ? 1 : dist > 120 ? 0.4 : -0.6;
      var steerIn = U.clamp(diff * 1.6, -1, 1);
      if (diff > 2.2 || diff < -2.2) { throttle = Math.min(throttle, 0.35); steerIn = diff > 0 ? 1 : -1; }

      V.applyDrive(cop, throttle, steerIn, false, dt, world);
      // keep them roughly at the chase speed rather than the player's top speed
      if (cop.speed > sp) cop.speed = U.approach(cop.speed, sp, 500 * dt);

      // contact: ram the player's car, or pin them on foot
      if (dist < C.POLICE.ramRange) {
        if (pl.inCar) {
          pl.inCar.speed += (Math.abs(cop.speed) * 0.12 + 40);
          cop.speed *= 0.6;
          world.effects.shake(5);
          world.audio.thud();
        } else {
          cop.pinning = (cop.pinning || 0) + dt;
        }
      } else cop.pinning = 0;

      // officers shoot when the player is on foot and in range
      if (!pl.inCar && dist < C.POLICE.shootRange) {
        cop.fireTimer = (cop.fireTimer || 0) - dt;
        if (cop.fireTimer <= 0) {
          cop.fireTimer = C.POLICE.shootEvery;
          shootAtPlayer(cop, world);
        }
      }
    }
  }

  function shootAtPlayer(cop, world) {
    var pl = world.player;
    var d = U.dist(cop.x, cop.y, pl.x, pl.y);
    var hitChance = U.clamp(1 - d / C.POLICE.shootRange, 0.12, 0.72);
    world.effects.muzzle(cop.x + Math.cos(cop.angle) * 20, cop.y + Math.sin(cop.angle) * 20, cop.angle);
    world.audio.gunshot(0.5, 0.9);
    world.effects.shake(3);
    if (world.rng() < hitChance) {
      PC.combat.damagePlayer(pl, 7 + world.rng() * 7, world);
    } else {
      world.effects.impact(cop.x + Math.cos(cop.angle) * 40, cop.y + Math.sin(cop.angle) * 40);
    }
  }

  function checkBusted(heat, dt, world) {
    var pl = world.player;
    if (pl.inCar) { heat.busted = false; heat.bustTimer = 0; return; }
    var pinned = false;
    for (var i = 0; i < heat.cops.length; i++) {
      var cop = heat.cops[i];
      if (cop.pinning > 0.35 && U.dist(cop.x, cop.y, pl.x, pl.y) < C.POLICE.ramRange) { pinned = true; break; }
    }
    if (pinned) {
      heat.bustTimer += dt;
      if (heat.bustTimer > 1.1) {
        heat.busted = true;
        world.onBusted();
      }
    } else {
      heat.bustTimer = Math.max(0, heat.bustTimer - dt * 2);
    }
  }

  function clear(heat, world) {
    heat.stars = 0; heat.decay = 0; heat.busted = false; heat.wantedSince = -1;
    heat.cops.length = 0;
    world.audio.siren(false);
  }

  PC.police = {
    makeHeat: makeHeat,
    commit: commit,
    update: updateHeat,
    clear: clear,
    spawnCruiser: spawnCruiser,
    CRIMES: CRIMES
  };
})(window.PC = window.PC || {});
