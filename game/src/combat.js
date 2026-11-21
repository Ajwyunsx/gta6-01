// combat.js — bullets, fists, health and armour, pickups. Shots are hitscan rays traced
// against cars, people and walls; each one draws a tracer and a muzzle flash. Pickups
// lie on the pavement and are vacuumed up when the player walks over them.
(function () {
  'use strict';
  var PC = window.PC;
  var CFG = PC.CFG;
  var U = PC.U;

  function Combat(world) {
    this.world = world;
    this.tracers = [];
    this.pickups = [];
    this.clock = 0;
    this.fireCooldown = 0;
  }

  // Ray against the city, people and cars. Returns where it stopped.
  Combat.prototype.trace = function (x, y, ang, maxDist, ignoreCar) {
    var world = this.world;
    var step = 12;
    var cos = Math.cos(ang), sin = Math.sin(ang);
    var best = maxDist;
    var hitKind = null;
    var hitObj = null;

    for (var d = 12; d < maxDist; d += step) {
      var px = x + cos * d;
      var py = y + sin * d;
      if (px < 0 || py < 0 || px > CFG.WORLD_W || py > CFG.WORLD_H) { best = d; break; }
      if (world.city.hitBuilding(px, py, 4)) { best = d; hitKind = 'wall'; break; }
      // pedestrians
      var ped = world.peds.nearest(px, py, 12, true);
      if (ped && ped.alive) { best = d; hitKind = 'ped'; hitObj = ped; break; }
      // police on foot
      for (var k = 0; k < world.police.units.length; k++) {
        var o = world.police.units[k].officer;
        if (!o || !o.alive) continue;
        if (U.dist(px, py, o.x, o.y) < 13) { best = d; hitKind = 'cop'; hitObj = o; break; }
      }
      if (hitKind) break;
      // cars
      for (var c = 0; c < world.cars.list.length; c++) {
        var car = world.cars.list[c];
        if (car === ignoreCar) continue;
        if (car.hitTest(px, py, 2)) { best = d; hitKind = 'car'; hitObj = car; break; }
      }
      if (hitKind) break;
    }
    return { dist: best, x: x + cos * best, y: y + sin * best, kind: hitKind, obj: hitObj };
  };

  // The player's shot: from the muzzle, straight down the aim line with a little bloom.
  Combat.prototype.playerShot = function (ang, fromCar) {
    var world = this.world;
    var player = world.player;
    if (this.fireCooldown > 0) return;
    if (player.ammo <= 0) {
      world.audio.dryFire();
      this.fireCooldown = 0.35;
      return;
    }
    player.ammo--;
    this.fireCooldown = fromCar ? 0.16 : 0.13;
    player.recoil = 1;

    var spread = fromCar ? 0.05 : 0.028;
    var a = ang + (world.rng() - 0.5) * spread;
    var muzzleX = player.x + Math.cos(ang) * 22;
    var muzzleY = player.y + Math.sin(ang) * 22;
    var res = this.trace(muzzleX, muzzleY, a, fromCar ? 900 : 760, fromCar || null);

    this.tracers.push({ x1: muzzleX, y1: muzzleY, x2: res.x, y2: res.y, life: 0.09, max: 0.09 });
    world.effects.muzzle(muzzleX, muzzleY, a);
    world.effects.shake(2.4);
    world.audio.gunshot();
    world.noise(muzzleX, muzzleY, 700);

    if (res.kind === 'ped' && res.obj) {
      var dead = res.obj.damage(CFG.tuning.bulletDamage * 1.6, world);
      world.effects.burst(res.x, res.y, '#c84a4a', 7);
      if (dead) {
        world.police.crime('pedestrian', res.x, res.y);
        world.notify('Civilian down — the heat is on');
        world.stats.peds++;
      } else {
        world.police.crime('assault', res.x, res.y);
      }
    } else if (res.kind === 'cop' && res.obj) {
      res.obj.health -= CFG.tuning.bulletDamage * 1.25;
      res.obj.hitFlash = 1;
      world.effects.burst(res.x, res.y, '#5c7bd6', 6);
      world.police.crime('police', res.x, res.y);
      if (res.obj.health <= 0) {
        res.obj.alive = false;
        world.notify('Officer down — this is going to get loud');
        world.stats.cops++;
        world.police.addHeat(1.2);
      }
    } else if (res.kind === 'car' && res.obj) {
      var car = res.obj;
      car.damage(CFG.tuning.bulletDamage * 1.1);
      world.effects.burst(res.x, res.y, '#ffd98a', 5);
      if (car.health <= 0 && !car.exploded) this.explodeCar(car);
    } else if (res.kind === 'wall') {
      world.effects.burst(res.x, res.y, '#cfc6b4', 5);
    }
  };

  // A cop's shot: aimed with a chance to hit, resolved as damage or a miss tracer.
  Combat.prototype.copShot = function (ox, oy, ang, d, hits, cop) {
    var world = this.world;
    var player = world.player;
    var muzzleX = ox + Math.cos(ang) * 16;
    var muzzleY = oy + Math.sin(ang) * 16;
    var endX, endY;
    if (hits) {
      endX = player.x + (world.rng() - 0.5) * 8;
      endY = player.y + (world.rng() - 0.5) * 8;
    } else {
      eend: {
        endX = player.x + Math.cos(ang + (world.rng() - 0.5) * 0.9) * 900;
        endY = player.y + Math.sin(ang + (world.rng() - 0.5) * 0.9) * 900;
      }
      var traced = this.trace(muzzleX, muzzleY, ang, 900, null);
      endX = traced.x;
      endY = traced.y;
    }
    this.tracers.push({ x1: muzzleX, y1: muzzleY, x2: endX, y2: endY, life: 0.09, max: 0.09 });
    world.effects.muzzle(muzzleX, muzzleY, ang);
    world.audio.copShot();
    world.noise(muzzleX, muzzleY, 500);
    if (hits) {
      var killed = player.damage(11 + world.police.stars * 1.6, cop);
      world.effects.shake(6);
      world.effects.burst(player.x, player.y, '#ff6b6b', 5);
      if (killed) world.wasted();
    }
    void d;
  };

  // Melee: a shove that hurts, for when the ammo runs out.
  Combat.prototype.punch = function () {
    var world = this.world;
    var player = world.player;
    if (this.fireCooldown > 0 || player.inCar) return;
    this.fireCooldown = 0.32;
    player.recoil = 0.8;
    var ang = player.angle;
    var tx = player.x + Math.cos(ang) * 40;
    var ty = player.y + Math.sin(ang) * 40;
    var ped = world.peds.nearest(tx, ty, 44, true);
    world.audio.punch();
    world.effects.shake(2);
    if (ped) {
      var dead = ped.damage(46, world);
      world.effects.burst(ped.x, ped.y, '#f2d7b0', 5);
      if (dead) {
        world.police.crime('pedestrian', ped.x, ped.y);
        world.stats.peds++;
      } else world.police.crime('assault', ped.x, ped.y);
      return;
    }
    for (var k = 0; k < world.police.units.length; k++) {
      var o = world.police.units[k].officer;
      if (!o || !o.alive) continue;
      if (U.dist(o.x, o.y, tx, ty) < 46) {
        o.health -= 26;
        o.hitFlash = 1;
        world.police.crime('police', o.x, o.y);
        world.effects.burst(o.x, o.y, '#8ea6f0', 4);
        if (o.health <= 0) {
          o.alive = false;
          world.stats.cops++;
          world.notify('Officer down — this is going to get loud');
        }
        return;
      }
    }
  };

  Combat.prototype.explodeCar = function (car) {
    var world = this.world;
    car.exploded = true;
    world.effects.explode(car.x, car.y);
    world.audio.explosion();
    world.effects.shake(14);
    world.noise(car.x, car.y, 900);
    if (U.dist(car.x, car.y, world.player.x, world.player.y) < 96) {
      if (world.player.damage(42, null)) world.wasted();
    }
    for (var k = 0; k < world.peds.list.length; k++) {
      var p = world.peds.list[k];
      if (p.alive && U.dist(p.x, p.y, car.x, car.y) < 88) p.damage(120, world);
    }
    for (var u = 0; u < world.police.units.length; u++) {
      var o = world.police.units[u].officer;
      if (o && o.alive && U.dist(o.x, o.y, car.x, car.y) < 88) {
        o.health = 0;
        o.alive = false;
      }
    }
    world.police.crime('cars', car.x, car.y);
    // the wreck burns for a while, then is cleared
    car.burn = 7;
  };

  // ---- pickups ---------------------------------------------------------------
  Combat.prototype.dropPickup = function (x, y, kind, amount) {
    this.pickups.push({ x: x, y: y, kind: kind, amount: amount, phase: 0, taken: false });
  };

  Combat.prototype.seedPickups = function (city) {
    var rng = this.world.rng;
    var kinds = [
      { kind: 'health', amount: 45 },
      { kind: 'ammo', amount: 18 },
      { kind: 'armour', amount: 40 },
      { kind: 'cash', amount: 120 },
    ];
    // a handful of supply crates in the parks and the beach
    for (var k = 0; k < 16; k++) {
      var spot = city.pedSpawns[Math.floor(rng() * city.pedSpawns.length)];
      var kindObj = kinds[Math.floor(rng() * kinds.length)];
      this.dropPickup(spot.x + (rng() - 0.5) * 40, spot.y + (rng() - 0.5) * 40, kindObj.kind, kindObj.amount);
    }
  };

  Combat.prototype.update = function (dt) {
    var world = this.world;
    var player = world.player;
    if (this.fireCooldown > 0) this.fireCooldown -= dt;
    for (var t = this.tracers.length - 1; t >= 0; t--) {
      var tr = this.tracers[t];
      tr.life -= dt;
      if (tr.life <= 0) this.tracers.splice(t, 1);
    }
    for (var k = this.pickups.length - 1; k >= 0; k--) {
      var p = this.pickups[k];
      p.phase += dt;
      if (p.taken) { this.pickups.splice(k, 1); continue; }
      if (U.dist(p.x, p.y, player.x, player.y) < 28 && !player.inCar) {
        this.applyPickup(p);
        p.taken = true;
        world.effects.burst(p.x, p.y, '#ffe08a', 8);
        world.audio.pickup(p.kind);
        world.hud.flash(p.kind);
      }
    }
    // burning wrecks leave a fire trail and clear out
    for (var c = world.cars.list.length - 1; c >= 0; c--) {
      var car = world.cars.list[c];
      if (car.burn > 0) {
        car.burn -= dt;
        if (world.rng() < 0.4) world.effects.smoke(car.x, car.y, car.angle);
        if (car.burn <= 0) {
          var i = world.cars.list.indexOf(car);
          if (i >= 0) world.cars.list.splice(i, 1);
        }
      }
    }
  };

  Combat.prototype.applyPickup = function (p) {
    var player = this.world.player;
    if (p.kind === 'health') player.health = Math.min(player.maxHealth, player.health + p.amount);
    else if (p.kind === 'armour') player.armour = Math.min(player.maxArmour, player.armour + p.amount);
    else if (p.kind === 'ammo') player.ammo += p.amount;
    else if (p.kind === 'cash') {
      player.cash += p.amount;
      this.world.stats.cash += p.amount;
    }
  };

  PC.Combat = Combat;
})();
