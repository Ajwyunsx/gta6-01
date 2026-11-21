// police.js — the wanted system and the police who answer it. Heat rises with crimes,
// cools after a quiet spell; each star adds cruisers. Cruisers drive to the player,
// then the officers get out and fight on foot. Losing them for long enough clears it.
(function () {
  'use strict';
  var PC = window.PC;
  var CFG = PC.CFG;
  var U = PC.U;

  var STAR_CRIME = {
    assault: 0.28,
    pedestrian: 1,
    gunshot: 0.22,
    cars: 0.55,
    police: 2,
  };

  function CopUnit(car, officer, x, y) {
    this.car = car || null;
    this.officer = officer || null;
    this.state = car ? 'drive' : 'foot';
    this.x = x;
    this.y = y;
    this.angle = 0;
    this.health = CFG.tuning.copHealth;
    this.maxHealth = CFG.tuning.copHealth;
    this.fireClock = U.randRange(Math.random, 0.3, 1.4);
    this.target = null;
    this.alive = true;
    this.hitFlash = 0;
    this.stride = 0;
    this.reload = 0;
    this.callCooldown = 0;
    this.radio = 0;
  }

  function Officer(x, y, colour) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.angle = 0;
    this.radius = 12;
    this.health = CFG.tuning.copHealth;
    this.maxHealth = CFG.tuning.copHealth;
    this.alive = true;
    this.hitFlash = 0;
    this.stride = 0;
    this.color = colour || '#2b3a5e';
    this.kind = 'cop';
    this.armour = 0;
    this.reload = 0;
    this.cover = 0;
  }

  // ---- the police department -------------------------------------------------
  function Police(city, carManager, rng) {
    this.city = city;
    this.cars = carManager;
    this.rng = rng;
    this.units = [];
    this.cruisers = [];
    this.heat = 0;            // continuous 0..6
    this.stars = 0;           // whole stars, 0..5
    this.quietClock = 0;
    this.sirenOn = false;
    this.spawnClock = 0;
    this.lastKnown = null;
    this.bustClock = 0;
    this.wantedFlash = 0;
  }

  Police.prototype.addHeat = function (amount) {
    if (amount <= 0) return;
    this.heat = Math.min(6, this.heat + amount);
    var s = Math.floor(this.heat);
    if (s > this.stars) {
      this.stars = s;
      this.wantedFlash = 1;
      this.spawnClock = 0;
    }
    this.quietClock = 0;
    // wanted level never decays below what the crimes set until the meter empties
    this.heat = Math.max(this.heat, this.stars);
  };

  Police.prototype.clear = function () {
    this.heat = 0;
    this.stars = 0;
    this.quietClock = 0;
    this.lastKnown = null;
    this.sirenOn = false;
    for (var k = 0; k < this.units.length; k++) {
      var u = this.units[k];
      if (u.car) {
        var i = this.cars.list.indexOf(u.car);
        if (i >= 0) this.cars.list.splice(i, 1);
      }
    }
    this.units.length = 0;
    this.cruisers.length = 0;
  };

  Police.prototype.crime = function (kind, x, y) {
    this.addHeat(STAR_CRIME[kind] || 0.2);
    if (x !== undefined) this.lastKnown = { x: x, y: y };
  };

  Police.prototype.maxUnits = function () {
    return Math.min(8, 1 + this.stars * 2);
  };

  // ---- spawning --------------------------------------------------------------
  Police.prototype.spawnCruiser = function (world, nearPlayer) {
    var px = world.player.x, py = world.player.y;
    for (var tries = 0; tries < 26; tries++) {
      var ang = this.rng() * 6.28;
      var dist = nearPlayer ? 520 + this.rng() * 260 : 1800 + this.rng() * 700;
      var x = U.clamp(px + Math.cos(ang) * dist, 40, CFG.CITY_W - 40);
      var y = U.clamp(py + Math.sin(ang) * dist, 40, CFG.CITY_H - 40);
      if (this.city.hitBuilding(x, y, 34)) continue;
      var road = this.city.nearestRoad(x, y);
      var car = new PC.Car(road.x, road.y, 0, {
        name: 'Marlowe Cruiser', body: '#f2f0e6', trim: '#2b3a5e',
        len: 104, wid: 50, top: 700, accel: 760, handling: 1.0, seats: 4,
      }, this.rng);
      car.driver = 'police';
      car.siren = true;
      car.occupied = true;
      this.cars.list.push(car);
      var unit = new CopUnit(car, null, road.x, road.y);
      unit.state = 'drive';
      this.units.push(unit);
      this.cruisers.push(car);
      // the car heads for the player at once
      car.angle = Math.atan2(py - road.y, px - road.x);
      car.vx = Math.cos(car.angle) * 300;
      car.vy = Math.sin(car.angle) * 300;
      return unit;
    }
    return null;
  };

  // ---- per-frame -------------------------------------------------------------
  Police.prototype.update = function (dt, world) {
    var T = CFG.tuning;
    var player = world.player;

    // In a staged screenshot scene the department holds still: the cars are placed by hand.
    if (world.shotCam) {
      this.sirenOn = this.stars > 0;
      return;
    }

    // quiet time only counts while the player is out of sight, or when heat is low
    var near = false;
    for (var k = 0; k < this.units.length; k++) {
      var u = this.units[k];
      var ux = u.car ? u.car.x : u.x;
      var uy = u.car ? u.car.y : u.y;
      if (U.dist(ux, uy, player.x, player.y) < 620) { near = true; break; }
    }
    if (near) this.quietClock = 0;
    else this.quietClock += dt;

    if (this.stars > 0 && this.quietClock > T.heatDecayDelay) {
      this.heat -= T.heatDecayRate * dt;
      if (this.heat < this.stars) {
        this.stars = Math.max(0, Math.ceil(this.heat) - 1);
      }
      if (this.heat <= 0) {
        this.heat = 0;
        this.stars = 0;
        this.clearUnits();
      }
    }

    // spawn cruisers to match the stars
    this.spawnClock -= dt;
    var wanted = this.stars > 0 ? this.maxUnits() : 0;
    if (this.spawnClock <= 0 && this.units.length < wanted) {
      this.spawnClock = 2.6;
      this.spawnCruiser(world, this.quietClock < 4 || this.units.length > 0);
    }

    // each unit: chase in the car, bail out when close, fight on foot
    for (var i = 0; i < this.units.length; i++) {
      var unit = this.units[i];
      if (unit.car) {
        if (!unit.car.driver) unit.car.driver = 'police';
        var carDist = U.dist(unit.car.x, unit.car.y, player.x, player.y);
        var targetX = player.x, targetY = player.y;
        if (player.inCar && player.inCar.speed > 380 && carDist > 260) {
          // cut ahead of a speeding car by aiming at where it will be
          targetX = player.x + player.inCar.vx * 0.35;
          targetY = player.y + player.inCar.vy * 0.35;
        }
        var wantAngle = Math.atan2(targetY - unit.car.y, targetX - unit.car.x);
        var diff = U.wrapAngle(wantAngle - unit.car.angle);
        var throttle = carDist > 180 ? 1 : carDist > 90 ? 0.55 : 0.2;
        var steer = U.clamp(diff * 1.9, -1, 1);
        if (unit.car.speed > 340 && Math.abs(diff) < 0.5) steer *= 0.6;
        unit.car.drive(dt, { throttle: throttle, steer: steer, brake: carDist < 90 }, this.city);
        unit.car.occupied = true;
        unit.car.driver = 'police';
        unit.car.siren = this.stars > 0;
        this.sirenOn = true;

        if (carDist < 150 && unit.car.speed < 210 && this.stars > 0) {
          // bail out and draw
          unit.car.driver = null;
          unit.car.siren = true;
          unit.car.stop();
          var off = new Officer(
            unit.car.x + Math.cos(unit.car.angle + Math.PI / 2) * 30,
            unit.car.y + Math.sin(unit.car.angle + Math.PI / 2) * 30
          );
          unit.officer = off;
          unit.state = 'foot';
          unit.car = null;
        } else if (carDist > 3000) {
          this.removeUnit(i);
          i--;
          continue;
        }
      }

      if (unit.officer) {
        var o = unit.officer;
        if (!o.alive) {
          this.removeUnit(i);
          i--;
          continue;
        }
        var d = U.dist(o.x, o.y, player.x, player.y);
        // officers close in, then hold and shoot when they have a line
        var goal = this.stars >= 3 ? 40 : 90;
        var move = d > goal + 40 ? 1 : d < goal ? -0.7 : 0;
        var a = Math.atan2(player.y - o.y, player.x - o.x);
        if (move !== 0) {
          var sp = 132 * move;
          var desiredX = o.x + Math.cos(a) * sp * dt;
          var desiredY = o.y + Math.sin(a) * sp * dt;
          var fixed = this.city.resolveCircle(desiredX, desiredY, o.radius);
          o.x = U.clamp(fixed.x, 10, CFG.WORLD_W - 10);
          o.y = U.clamp(fixed.y, 10, CFG.WORLD_H - 10);
          o.stride += Math.abs(sp) * dt * 0.06;
        }
        o.angle = a;
        o.fireClock -= dt;
        if (o.fireClock <= 0 && d < 620 && this.hasLine(o.x, o.y, player.x, player.y)) {
          o.fireClock = U.randRange(this.rng, 0.7, 1.6) - this.stars * 0.05;
          var spread = this.stars > 2 ? 0.09 : 0.16;
          var ang = a + (this.rng() - 0.5) * spread * 2;
          var hit = this.aimAt(o.x, o.y, ang, d, player);
          world.combat.copShot(o.x, o.y, ang, d, hit, o);
        }
        if (o.hitFlash > 0) o.hitFlash -= dt * 3;
        unit.x = o.x;
        unit.y = o.y;
      }
    }

    // get close and stand still, or shoot from a stop: you are busted
    if (this.stars > 0 && !player.inCar) {
      var arrested = null;
      for (var m = 0; m < this.units.length; m++) {
        var uu = this.units[m];
        if (!uu.officer || !uu.officer.alive) continue;
        if (U.dist(uu.officer.x, uu.officer.y, player.x, player.y) < 46) { arrested = uu; break; }
      }
      if (arrested) {
        this.bustClock += dt;
        if (this.bustClock > 0.45) {
          this.bustClock = 0;
          world.busted();
          return;
        }
      } else {
        this.bustClock = Math.max(0, this.bustClock - dt);
      }
    } else if (player.inCar && player.inCar.speed < 22) {
      var surrounded = 0;
      for (var n = 0; n < this.units.length; n++) {
        var un = this.units[n];
        var ox = un.car ? un.car.x : un.officer ? un.officer.x : 99999;
        var oy = un.car ? un.car.y : un.officer ? un.officer.y : 99999;
        if (U.dist(ox, oy, player.x, player.y) < 110) surrounded++;
      }
      if (surrounded >= 2) {
        this.bustClock += dt;
        if (this.bustClock > 1.1) {
          this.bustClock = 0;
          world.busted();
          return;
        }
      } else this.bustClock = Math.max(0, this.bustClock - dt);
    }

    if (this.wantedFlash > 0) this.wantedFlash -= dt * 1.6;
    this.sirenOn = this.stars > 0 && this.units.length > 0;
  };

  Police.prototype.hasLine = function (ax, ay, bx, by) {
    var steps = Math.max(2, Math.floor(U.dist(ax, ay, bx, by) / 46));
    for (var k = 1; k < steps; k++) {
      var t = k / steps;
      if (this.city.hitBuilding(U.lerp(ax, bx, t), U.lerp(ay, by, t), 6)) return false;
    }
    return true;
  };

  // Does a cop's shot land? Aim error rises with range and falls with stars.
  Police.prototype.aimAt = function (ox, oy, ang, d, player) {
    var base = 0.34 - this.stars * 0.045;
    var chance = U.clamp(0.62 - d / 1400 - base * 0.6, 0.16, 0.8);
    if (player.inCar) chance *= 0.72;
    return this.rng() < chance;
  };

  Police.prototype.removeUnit = function (index) {
    var u = this.units[index];
    if (u.car) {
      var i = this.cars.list.indexOf(u.car);
      if (i >= 0) this.cars.list.splice(i, 1);
      var j = this.cruisers.indexOf(u.car);
      if (j >= 0) this.cruisers.splice(j, 1);
    }
    this.units.splice(index, 1);
  };

  Police.prototype.clearUnits = function () {
    for (var k = this.units.length - 1; k >= 0; k--) this.removeUnit(k);
    this.units.length = 0;
    this.sirenOn = false;
  };

  // Killing an officer is a serious business.
  Police.prototype.onOfficerDown = function (unit) {
    this.addHeat(1.4);
  };

  PC.Police = Police;
  PC.CopUnit = CopUnit;
  PC.Officer = Officer;
  PC.STAR_CRIME = STAR_CRIME;
})();
