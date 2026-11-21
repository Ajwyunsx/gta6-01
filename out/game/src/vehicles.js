// vehicles.js — cars: parked cars to steal, arcade driving physics, and the car the player is in.
// A car is a box that grips the road when rolling and slides when it isn't; steering rotates the
// heading and the velocity is bent toward it. Damage comes from collisions and bullets.
(function () {
  'use strict';
  var PC = window.PC;
  var CFG = PC.CFG;
  var U = PC.U;

  var MODELS = [
    { name: 'Coral GT', body: '#e2684f', trim: '#f6e5c8', len: 92, wid: 46, top: 700, accel: 760, handling: 1.08, seats: 2 },
    { name: 'Tide Runner', body: '#2f9e96', trim: '#dff2ee', len: 96, wid: 48, top: 660, accel: 700, handling: 1.0, seats: 4 },
    { name: 'Palmetto Van', body: '#e7dac0', trim: '#8b8377', len: 118, wid: 56, top: 560, accel: 560, handling: 0.78, seats: 4 },
    { name: 'Night Heron', body: '#5a4b72', trim: '#c9c0dd', len: 94, wid: 47, top: 720, accel: 780, handling: 1.14, seats: 2 },
    { name: 'Dune Buggy', body: '#d9a35a', trim: '#4a3d2f', len: 84, wid: 50, top: 620, accel: 720, handling: 1.2, seats: 2 },
    { name: 'Harbour Pickup', body: '#98a49c', trim: '#6f685e', len: 112, wid: 54, top: 590, accel: 620, handling: 0.86, seats: 2 },
    { name: 'Neon Pike Cab', body: '#ffcb52', trim: '#2a2630', len: 100, wid: 48, top: 640, accel: 660, handling: 0.94, seats: 4 },
    { name: 'Saltwater Coupe', body: '#8d4a63', trim: '#f0d6df', len: 88, wid: 45, top: 740, accel: 800, handling: 1.18, seats: 2 },
  ];

  function Car(x, y, angle, model, rng) {
    this.x = x;
    this.y = y;
    this.angle = angle;
    this.vx = 0;
    this.vy = 0;
    this.speed = 0;
    this.steer = 0;
    this.model = model || MODELS[0];
    this.len = this.model.len;
    this.wid = this.model.wid;
    this.radius = this.wid * 0.62;
    this.health = CFG.tuning.carHealth;
    this.maxHealth = CFG.tuning.carHealth;
    this.driver = null;          // 'player' | 'traffic' | 'police' | null
    this.occupied = false;
    this.siren = false;
    this.paint = this.model.body;
    this.rng = rng || Math.random;
    this.smoke = 0;
    this.wheelTurn = 0;
    this.nose = 0;
    this.dent = 0;
    this.brakeLight = 0;
    this.horn = 0;
  }

  Car.prototype.forward = function () {
    return { x: Math.cos(this.angle), y: Math.sin(this.angle) };
  };

  // Arcade physics: throttle along the heading, grip pulls velocity toward it,
  // and the handbrake lets the tail slide. Collisions cost speed and paint.
  Car.prototype.drive = function (dt, controls, city) {
    var T = CFG.tuning;
    var m = this.model;
    var throttle = controls.throttle || 0;
    var steerInput = controls.steer || 0;
    var maxSpeed = m.top * (controls.boost ? 1.12 : 1);

    this.steer = U.damp(this.steer, steerInput, 9, dt);
    this.wheelTurn = this.steer;

    var fx = Math.cos(this.angle), fy = Math.sin(this.angle);
    var along = this.vx * fx + this.vy * fy;

    // throttle is engine force; reverse is weaker and only when nearly stopped
    var accel = m.accel * m.handling;
    if (throttle > 0) {
      if (along < maxSpeed) along += accel * throttle * dt;
    } else if (throttle < 0) {
      if (along > -T.carReverseMax) along += accel * 0.5 * throttle * dt;
    }
    if (controls.brake) {
      along = U.damp(along, 0, T.carBrake / 120, dt);
      this.brakeLight = 1;
    } else {
      this.brakeLight = Math.max(0, this.brakeLight - dt * 6);
    }
    // rolling drag, plus extra when coasting
    along *= 1 - Math.min(1, (controls.brake ? 0.6 : 0.28) * dt);
    along = U.clamp(along, -T.carReverseMax, maxSpeed);

    // steering only bites while rolling, and reverses when going backwards
    var dirSign = along < -1 ? -1 : 1;
    var grip = controls.handbrake ? 1.4 : T.carGrip;
    var turnSpeed = (Math.abs(along) / maxSpeed) * T.carSteerRate * m.handling * dirSign;
    this.angle += this.steer * turnSpeed * dt;

    // velocity is rebuilt as: mostly along the new heading, some sideways slip retained
    var nfx = Math.cos(this.angle), nfy = Math.sin(this.angle);
    var slipX = this.vx - nfx * (this.vx * nfx + this.vy * nfy);
    var slipY = this.vy - nfy * (this.vx * nfx + this.vy * nfy);
    var slipKeep = controls.handbrake ? 0.94 : Math.max(0, 1 - grip * dt * 0.55);
    this.vx = nfx * along + slipX * slipKeep;
    this.vy = nfy * along + slipY * slipKeep;

    var nx = this.x + this.vx * dt;
    var ny = this.y + this.vy * dt;

    // keep the car out of buildings: split the push so it slides along the wall
    var hit = city.hitBuilding(nx, ny, this.radius * 0.8);
    if (hit) {
      var before = Math.hypot(this.vx, this.vy);
      var fixed = city.resolveCircle(nx, ny, this.radius * 0.8);
      nx = fixed.x;
      ny = fixed.y;
      var after = Math.hypot(this.vx, this.vy);
      if (before > 120) {
        this.damage(before * 0.055);
        this.vx *= 0.35;
        this.vy *= 0.35;
        this.dent = Math.min(1, this.dent + before * 0.0012);
      }
      if (after > 0) {
        // scrub the velocity into the resolve direction
        var used = Math.hypot(nx - this.x, ny - this.y) / Math.max(0.0001, dt);
        var scale = Math.min(1, used / Math.max(1, before));
        this.vx *= scale;
        this.vy *= scale;
      }
    }

    // the sea and the sand edge: a soft wall at the waterline
    if (nx > CFG.WATER_X - 30) {
      nx = CFG.WATER_X - 30;
      this.vx = Math.min(0, this.vx) * 0.5;
    }
    this.x = U.clamp(nx, 10, CFG.WORLD_W - 10);
    this.y = U.clamp(ny, 10, CFG.WORLD_H - 10);
    this.speed = Math.hypot(this.vx, this.vy);

    // engine smoke when the car is nearly dead
    if (this.health < this.maxHealth * 0.28 && this.speed > 0.5) {
      this.smoke += dt;
    }
  };

  Car.prototype.damage = function (amount) {
    this.health = Math.max(0, this.health - amount);
    return this.health <= 0;
  };

  Car.prototype.stop = function () {
    this.vx = 0;
    this.vy = 0;
    this.speed = 0;
    this.steer = 0;
  };

  // Bounding radius used for bullets and collisions with people.
  Car.prototype.hitTest = function (x, y, pad) {
    var dx = x - this.x, dy = y - this.y;
    var c = Math.cos(-this.angle), s = Math.sin(-this.angle);
    var lx = dx * c - dy * s;
    var ly = dx * s + dy * c;
    return Math.abs(lx) < this.len / 2 + (pad || 0) && Math.abs(ly) < this.wid / 2 + (pad || 0);
  };

  // ---- the car pool ----------------------------------------------------------
  function CarManager(city, rng) {
    this.city = city;
    this.rng = rng;
    this.list = [];
    this.spawnClock = 0;
  }

  CarManager.prototype.spawnParked = function (x, y, angle, modelIndex) {
    var model = MODELS[modelIndex !== undefined ? modelIndex : Math.floor(this.rng() * MODELS.length)];
    var car = new Car(x, y, angle, model, this.rng);
    car.parked = true;
    this.list.push(car);
    return car;
  };

  // Fill every marked parking bay and line the kerbs with a few cars.
  CarManager.prototype.seedParked = function () {
    var rng = this.rng;
    for (var k = 0; k < this.city.parkingSpaces.length; k++) {
      var s = this.city.parkingSpaces[k];
      if (rng() < 0.22) continue;
      var car = this.spawnParked(s.x, s.y, s.angle);
      s.taken = true;
      s.car = car;
    }
    // kerbside cars on quiet blocks
    for (var b = 0; b < this.city.blocks.length; b++) {
      var bl = this.city.blocks[b];
      if (rng() < 0.45) continue;
      var edge = Math.floor(rng() * 4);
      var x, y, ang;
      var inset = 16;
      if (edge === 0) { x = bl.x + 40 + rng() * (bl.w - 80); y = bl.y - inset; ang = 0; }
      else if (edge === 1) { x = bl.x + bl.w + inset; y = bl.y + 40 + rng() * (bl.h - 80); ang = Math.PI / 2; }
      else if (edge === 2) { x = bl.x + 40 + rng() * (bl.w - 80); y = bl.y + bl.h + inset; ang = 0; }
      else { x = bl.x - inset; y = bl.y + 40 + rng() * (bl.h - 80); ang = Math.PI / 2; }
      this.spawnParked(x, y, ang);
    }
  };

  CarManager.prototype.nearest = function (x, y, maxDist, skipPlayer) {
    var best = null, bd = maxDist * maxDist;
    for (var k = 0; k < this.list.length; k++) {
      var c = this.list[k];
      if (skipPlayer && c.driver === 'player') continue;
      if (this.city.hitBuilding(c.x, c.y, 4)) continue;
      var d = U.dist2(c.x, c.y, x, y);
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  };

  CarManager.prototype.updateDrivers = function (dt, world) {
    // every car that is not the player still needs physics so the street looks alive
    for (var k = 0; k < this.list.length; k++) {
      var c = this.list[k];
      if (c.driver === 'player') continue;
      if (c.driver === 'traffic' || c.driver === 'police') continue; // handled by their managers
      if (c.speed > 0.4 || c.vx || c.vy) {
        c.drive(dt, {}, this.city);
      }
      c.occupied = false;
    }
  };

  Car.models = MODELS;
  PC.Car = Car;
  PC.CarManager = CarManager;
  PC.CAR_MODELS = MODELS;
})();
