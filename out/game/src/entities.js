// entities.js — the people of Palm City: the player on foot and the pedestrians who wander
// the pavements, the parks and the sand. Pedestrians have moods (wander, flee) and react to
// gunfire and to a speeding car; draw calls live in render.js, this file only moves them.
(function () {
  'use strict';
  var PC = window.PC;
  var CFG = PC.CFG;
  var U = PC.U;

  function Player(x, y) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.angle = -Math.PI / 2;
    this.speed = 0;
    this.stride = 0;
    this.health = CFG.tuning.pedHealth;
    this.maxHealth = CFG.tuning.pedHealth;
    this.armour = 0;
    this.maxArmour = 100;
    this.cash = CFG.tuning.startCash;
    this.ammo = 24;
    this.radius = CFG.tuning.playerRadius;
    this.inCar = null;
    this.alive = true;
    this.hitFlash = 0;
    this.invuln = 0;
    this.recoil = 0;
    this.lastDamageFrom = null;
    this.wanted = 0;
    this.heat = 0;          // 0..1 running meter toward the next star
    this.heatClock = 0;      // seconds since the wanted level last rose
    this.assist = 0;
  }

  Player.prototype.reset = function (x, y) {
    this.x = x;
    this.y = y;
    this.vx = this.vy = 0;
    this.speed = 0;
    this.health = this.maxHealth;
    this.armour = this.maxArmour * 0.4;
    this.alive = true;
    this.hitFlash = 0;
    this.invuln = 1;
    this.recoil = 0;
    this.wanted = 0;
    this.heat = 0;
    if (this.inCar) this.inCar = null;
  };

  // Movement is one function for both modes: aim a heading, walk or sprint.
  Player.prototype.updateFoot = function (dt, input, city) {
    var T = CFG.tuning;
    var ax = 0, ay = 0;
    if (input.left) ax -= 1;
    if (input.right) ax += 1;
    if (input.up) ay -= 1;
    if (input.down) ay += 1;
    var len = Math.hypot(ax, ay);
    var sprint = input.sprint && !input.aim;
    var target = sprint ? T.sprintSpeed : T.walkSpeed;
    if (input.aim) target *= 0.62;
    if (this.hitFlash > 0) target *= 0.8;

    if (len > 0) {
      ax /= len;
      ay /= len;
      var desiredVx = ax * target;
      var desiredVy = ay * target;
      this.vx = U.damp(this.vx, desiredVx, T.footAccel / 120, dt);
      this.vy = U.damp(this.vy, desiredVy, T.footAccel / 120, dt);
      this.angle = Math.atan2(ay, ax);
      this.stride += Math.hypot(this.vx, this.vy) * dt * 0.05;
    } else {
      this.vx = U.damp(this.vx, 0, T.footFriction, dt);
      this.vy = U.damp(this.vy, 0, T.footFriction, dt);
    }
    // facing follows the mouse when aiming
    if (input.aim && input.aimAngle !== undefined) this.angle = input.aimAngle;

    var nx = this.x + this.vx * dt;
    var ny = this.y + this.vy * dt;
    var fixed = city.resolveCircle(nx, ny, this.radius);
    // A blocked axis kills that component so the player slides along walls.
    if (Math.abs(fixed.x - nx) > 0.01) this.vx *= 0.2;
    if (Math.abs(fixed.y - ny) > 0.01) this.vy *= 0.2;
    this.x = U.clamp(fixed.x, 6, CFG.WORLD_W - 6);
    this.y = U.clamp(fixed.y, 6, CFG.WORLD_H - 6);
    this.speed = Math.hypot(this.vx, this.vy);
    if (this.hitFlash > 0) this.hitFlash -= dt * 3;
    if (this.invuln > 0) this.invuln -= dt;
    if (this.recoil > 0) this.recoil = Math.max(0, this.recoil - dt * 8);
  };

  Player.prototype.damage = function (amount, from) {
    if (!this.alive) return false;
    if (this.invuln > 0) return false;
    if (this.armour > 0) {
      var absorbed = Math.min(this.armour, amount * 0.62);
      this.armour -= absorbed;
      amount -= absorbed;
    }
    this.health -= amount;
    this.hitFlash = 1;
    if (from) this.lastDamageFrom = from;
    this.invuln = 0.25;
    if (this.health <= 0) {
      this.health = 0;
      this.alive = false;
      return true;
    }
    return false;
  };

  // ---- pedestrians -----------------------------------------------------------
  function Ped(x, y, rng, kind) {
    this.x = x;
    this.y = y;
    this.homeX = x;
    this.homeY = y;
    this.vx = 0;
    this.vy = 0;
    this.angle = rng() * 6.28;
    this.targetAngle = this.angle;
    this.rng = rng;
    this.radius = 11;
    this.speed = U.randRange(rng, 46, 78);
    this.kind = kind || 0;
    this.color = U.pick(rng, CFG.colors.ped);
    this.stride = rng() * 6;
    this.state = 'wander';
    this.timer = U.randRange(rng, 2, 7);
    this.flee = 0;
    this.alive = true;
    this.health = CFG.tuning.pedHealth;
    this.hitFlash = 0;
    this.armour = 0;
    this.scale = U.randRange(rng, 0.9, 1.12);
  }

  Ped.prototype.update = function (dt, world) {
    if (!this.alive) return;
    var T = CFG.tuning;
    var px = world.player.x, py = world.player.y;
    var dPlayer = U.dist(this.x, this.y, px, py);

    // Being run over is a bad day: pick a new heading fast and keep moving.
    if (this.flee > 0) this.flee -= dt;
    if (world.playerInCar() && dPlayer < 120 && world.playerCar().speed > 260) {
      this.flee = Math.max(this.flee, 1.2);
    }

    this.timer -= dt;
    if (this.timer <= 0) {
      this.timer = U.randRange(this.rng, 2.4, 6.5);
      if (this.flee > 0) {
        this.targetAngle = Math.atan2(this.y - py, this.x - px) + (this.rng() - 0.5) * 0.6;
      } else {
        this.targetAngle = this.rng() < 0.18
          ? this.angle + Math.PI
          : this.angle + (this.rng() - 0.5) * 1.9;
      }
    }
    if (this.flee > 0) {
      this.targetAngle = Math.atan2(this.y - py, this.x - px) + (this.rng() - 0.5) * 0.5;
    }

    // Stay near home so the pavement keeps a crowd rather than a traffic jam of humans.
    if (U.dist(this.x, this.y, this.homeX, this.homeY) > 260) {
      this.targetAngle = Math.atan2(this.homeY - this.y, this.homeX - this.x);
    }

    this.angle = U.turnToward(this.angle, this.targetAngle, dt * (this.flee > 0 ? 6 : 2.4));
    var spd = this.speed * (this.flee > 0 ? 1.9 : 1);
    var nx = this.x + Math.cos(this.angle) * spd * dt;
    var ny = this.y + Math.sin(this.angle) * spd * dt;
    var fixed = world.city.resolveCircle(nx, ny, this.radius);
    if (Math.abs(fixed.x - nx) > 0.01 || Math.abs(fixed.y - ny) > 0.01) {
      this.targetAngle += 1.1;
      this.angle += 0.4;
    }
    this.x = U.clamp(fixed.x, 8, CFG.WORLD_W - 8);
    this.y = U.clamp(fixed.y, 8, CFG.WORLD_H - 8);
    this.stride += spd * dt * (this.flee > 0 ? 0.09 : 0.05);
    if (this.hitFlash > 0) this.hitFlash -= dt * 3;
    if (this.health <= 0) this.alive = false;
  };

  Ped.prototype.damage = function (amount, world) {
    this.health -= amount;
    this.hitFlash = 1;
    this.flee = 3.2;
    if (this.health <= 0 && this.alive) {
      this.alive = false;
      this.dead = true;
      world.effects.burst(this.x, this.y, this.color, 10);
    }
    return !this.alive;
  };

  // ---- spawning pools --------------------------------------------------------
  function PedManager(city, rng) {
    this.city = city;
    this.rng = rng;
    this.list = [];
    this.spawnClock = 0;
  }

  PedManager.prototype.spawnAt = function (x, y) {
    var p = new Ped(x, y, this.rng, Math.floor(this.rng() * 4));
    this.list.push(p);
    return p;
  };

  PedManager.prototype.update = function (dt, world) {
    var target = CFG.tuning.pedTarget;
    this.spawnClock -= dt;
    if (this.spawnClock <= 0 && this.list.length < target) {
      this.spawnClock = 0.35;
      // spawn just off screen, on a pavement, and let them walk in
      var cam = world.camera;
      for (var tries = 0; tries < 8; tries++) {
        var seed = U.pick(this.rng, this.city.pedSpawns);
        var ang = this.rng() * 6.28;
        var dist = Math.max(cam.w, cam.h) * 0.62;
        var sx = U.clamp(cam.x + Math.cos(ang) * dist, 20, CFG.WORLD_W - 20);
        var sy = U.clamp(cam.y + Math.sin(ang) * dist, 20, CFG.WORLD_H - 20);
        if (world.city.hitBuilding(sx, sy, 14)) continue;
        if (U.dist(sx, sy, world.player.x, world.player.y) < 260) continue;
        var p = new Ped(sx, sy, this.rng, Math.floor(this.rng() * 4));
        if (seed) { p.homeX = seed.x; p.homeY = seed.y; }
        this.list.push(p);
        break;
      }
    }
    for (var k = this.list.length - 1; k >= 0; k--) {
      var ped = this.list[k];
      ped.update(dt, world);
      // far away and not interesting: recycle
      if (U.dist(ped.x, ped.y, world.player.x, world.player.y) > 2200) {
        this.list.splice(k, 1);
      }
    }
  };

  PedManager.prototype.nearest = function (x, y, maxDist, requireAlive) {
    var best = null, bd = maxDist * maxDist;
    for (var k = 0; k < this.list.length; k++) {
      var p = this.list[k];
      if (requireAlive && !p.alive) continue;
      var d = U.dist2(p.x, p.y, x, y);
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  };

  PC.Player = Player;
  PC.Ped = Ped;
  PC.PedManager = PedManager;
})();
