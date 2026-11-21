// traffic.js — cars that drive the city by themselves: they hold their lane, brake for
// whatever is in front of them, take a random turn at an intersection (drawn as a quadratic
// bezier so the turn is smooth) and are recycled when they leave the player's neighbourhood.
//
// A traffic car is described by three things and nothing else: the axis it travels on
// ('v' for an avenue, 'h' for a street), its direction (+1 / -1) and the index of the road
// it is on. Position along the axis lives on the car itself.
(function () {
  'use strict';
  var PC = window.PC;
  var CFG = PC.CFG;
  var U = PC.U;

  var LANE = 26;       // lane centre offset from the avenue's middle
  var REACH = 52;      // how far past the junction a turn exits
  var LOOK = 138;      // braking look-ahead

  function laneOffset(axis, dir) {
    // right-hand traffic: on a north-south avenue, northbound keeps to +x
    if (axis === 'v') return dir > 0 ? LANE : -LANE;
    return dir > 0 ? -LANE : LANE;
  }

  function roadCentre(k) {
    return k * CFG.CELL + CFG.ROAD / 2;
  }

  function TrafficCar(car, axis, dir, line) {
    this.car = car;
    this.axis = axis;
    this.dir = dir;
    this.line = line;
    this.turn = null;
    this.turnT = 0;
    this.turnLen = 1;
    this.lastJunction = -99;
    this.cruise = U.randRange(car.rng, 170, 290);
    this.patience = 0;
    this.placeOnLane();
    car.angle = axis === 'v' ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI);
    car.vx = Math.cos(car.angle) * this.cruise;
    car.vy = Math.sin(car.angle) * this.cruise;
  }

  TrafficCar.prototype.placeOnLane = function () {
    var car = this.car;
    if (this.axis === 'v') car.x = roadCentre(this.line) + laneOffset('v', this.dir);
    else car.y = roadCentre(this.line) + laneOffset('h', this.dir);
  };

  TrafficCar.prototype.forward = function () {
    if (this.axis === 'v') return { x: 0, y: this.dir };
    return { x: this.dir, y: 0 };
  };

  // Look for the next junction. If it is close and we roll a turn, start one.
  TrafficCar.prototype.planIntersection = function () {
    var car = this.car;
    var along = this.axis === 'v' ? car.y : car.x;
    var j = Math.round((along - CFG.ROAD / 2) / CFG.CELL);
    if (j < 0 || j > CFG.GRID) return;
    if (j === this.lastJunction) return;
    var gap = (roadCentre(j) - along) * this.dir;
    if (gap < -8 || gap > REACH + 74) return;
    this.lastJunction = j;
    if (car.rng() > 0.44) return;   // most cars go straight on

    var right = car.rng() < 0.5;
    var nAxis = this.axis === 'v' ? 'h' : 'v';
    // Turning right when heading +, left when heading -, and the other way round the other way.
    var nDir;
    if (this.axis === 'v') nDir = this.dir > 0 ? (right ? 1 : -1) : (right ? -1 : 1);
    else nDir = this.dir > 0 ? (right ? -1 : 1) : (right ? 1 : -1);

    var ix = this.axis === 'v' ? car.x : roadCentre(j);
    var iy = this.axis === 'v' ? roadCentre(j) : car.y;

    var ex, ey, nLine;
    if (nAxis === 'h') {
      nLine = j;
      ex = ix + nDir * REACH;
      ey = roadCentre(nLine) + laneOffset('h', nDir);
    } else {
      nLine = j;
      ey = iy + nDir * REACH;
      ex = roadCentre(nLine) + laneOffset('v', nDir);
    }
    // control point sits on the inside corner of the junction
    var cx = U.lerp(ix, ex, 0.62);
    var cy = U.lerp(iy, ey, 0.62);
    var span = Math.max(40, Math.hypot(ex - ix, ey - iy));
    this.turn = {
      sx: ix, sy: iy, cx: cx, cy: cy, ex: ex, ey: ey,
      nAxis: nAxis, nDir: nDir, nLine: nLine,
    };
    this.turnLen = U.clamp(span / Math.max(90, car.speed), 0.4, 2.2);
    this.turnT = 0;
  };

  TrafficCar.prototype.steerPath = function (dt) {
    var car = this.car;
    var t = (this.turnT = Math.min(1, this.turnT + dt / this.turnLen));
    var u = 1 - t;
    var px = u * u * this.turn.sx + 2 * u * t * this.turn.cx + t * t * this.turn.ex;
    var py = u * u * this.turn.sy + 2 * u * t * this.turn.cy + t * t * this.turn.ey;
    var dx = 2 * u * (this.turn.cx - this.turn.sx) + 2 * t * (this.turn.ex - this.turn.cx);
    var dy = 2 * u * (this.turn.cy - this.turn.sy) + 2 * t * (this.turn.ey - this.turn.cy);
    car.vx = (px - car.x) / Math.max(0.0001, dt);
    car.vy = (py - car.y) / Math.max(0.0001, dt);
    car.x = px;
    car.y = py;
    car.angle = Math.atan2(dy, dx);
    car.speed = Math.hypot(car.vx, car.vy);
    if (t >= 1) {
      this.axis = this.turn.nAxis;
      this.dir = this.turn.nDir;
      this.line = this.turn.nLine;
      this.lastJunction = Math.round(((this.axis === 'v' ? car.y : car.x) - CFG.ROAD / 2) / CFG.CELL);
      this.turn = null;
      var f = this.forward();
      car.vx = f.x * this.cruise;
      car.vy = f.y * this.cruise;
      car.angle = Math.atan2(f.y, f.x);
      car.speed = this.cruise;
    }
  };

  TrafficCar.prototype.update = function (dt, world) {
    var car = this.car;
    var city = world.city;

    if (this.turn) {
      this.steerPath(dt);
      car.drive(dt, { steer: 0, throttle: 0 }, city);
      car.occupied = true;
      car.driver = 'traffic';
      return;
    }

    this.planIntersection();
    var f = this.forward();

    // What is in the way?
    var blocked = 0;
    var playerCar = world.playerCar();
    if (playerCar) {
      var rel = (playerCar.x - car.x) * f.x + (playerCar.y - car.y) * f.y;
      var side = Math.abs(-(playerCar.x - car.x) * f.y + (playerCar.y - car.y) * f.x);
      if (rel > 6 && rel < LOOK + 46 && side < 48) blocked = Math.max(blocked, 0.9 - rel / (LOOK + 46));
    }
    var others = world.traffic.list;
    for (var k = 0; k < others.length; k++) {
      var o = others[k];
      if (o === this) continue;
      var oc = o.car;
      var rel2 = (oc.x - car.x) * f.x + (oc.y - car.y) * f.y;
      if (rel2 <= 0 || rel2 > LOOK) continue;
      var side2 = Math.abs(-(oc.x - car.x) * f.y + (oc.y - car.y) * f.x);
      if (side2 > 44) continue;
      blocked = Math.max(blocked, 1 - rel2 / LOOK);
    }
    var lookX = car.x + f.x * LOOK * 0.45;
    var lookY = car.y + f.y * LOOK * 0.45;
    if (world.peds.nearest(lookX, lookY, 42, true)) blocked = Math.max(blocked, 0.85);
    if (world.player.wanted > 0 && U.dist(car.x, car.y, world.player.x, world.player.y) < 360) {
      blocked = Math.max(blocked, 0.35);
    }

    if (blocked > 0.2) {
      this.patience += dt;
      car.drive(dt, { brake: true }, city);
    } else {
      this.patience = 0;
      var want = U.clamp((this.cruise - car.speed) / 220, 0.2, 1);
      car.drive(dt, { throttle: want }, city);
    }
    car.occupied = true;
    car.driver = 'traffic';
  };

  // ---- manager ---------------------------------------------------------------
  function TrafficManager(city, carManager, rng) {
    this.city = city;
    this.cars = carManager;
    this.rng = rng;
    this.list = [];
    this.spawnClock = 0;
  }

  TrafficManager.prototype.spawnOne = function (world) {
    var axis = this.rng() < 0.5 ? 'v' : 'h';
    var dir = this.rng() < 0.5 ? 1 : -1;
    var line = Math.floor(this.rng() * (CFG.GRID + 1));
    var along = this.rng() * (axis === 'v' ? CFG.CITY_H : CFG.CITY_W);
    var x = axis === 'v' ? roadCentre(line) + laneOffset('v', dir) : along;
    var y = axis === 'v' ? along : roadCentre(line) + laneOffset('h', dir);
    if (U.dist(x, y, world.player.x, world.player.y) < 660) return null;
    if (this.city.hitBuilding(x, y, 30)) return null;
    var model = PC.CAR_MODELS[Math.floor(this.rng() * PC.CAR_MODELS.length)];
    var car = new PC.Car(x, y, 0, model, this.rng);
    car.driver = 'traffic';
    car.headlights = Math.floor(this.rng() * 2);
    this.cars.list.push(car);
    var t = new TrafficCar(car, axis, dir, line);
    this.list.push(t);
    return t;
  };

  TrafficManager.prototype.update = function (dt, world) {
    this.spawnClock -= dt;
    if (this.spawnClock <= 0) {
      if (this.list.length < CFG.tuning.trafficTarget) this.spawnOne(world);
      this.spawnClock = 0.5;
    }
    for (var k = this.list.length - 1; k >= 0; k--) {
      var t = this.list[k];
      var idx = this.cars.list.indexOf(t.car);
      if (t.car.health <= 0) {
        world.effects.burst(t.car.x, t.car.y, '#ffb347', 16);
        if (idx >= 0) this.cars.list.splice(idx, 1);
        this.list.splice(k, 1);
        continue;
      }
      if (U.dist(t.car.x, t.car.y, world.player.x, world.player.y) > 2500) {
        if (idx >= 0) this.cars.list.splice(idx, 1);
        this.list.splice(k, 1);
        continue;
      }
      t.update(dt, world);
    }
  };

  TrafficManager.prototype.clear = function () {
    for (var k = 0; k < this.list.length; k++) {
      var i = this.cars.list.indexOf(this.list[k].car);
      if (i >= 0) this.cars.list.splice(i, 1);
    }
    this.list.length = 0;
  };

  PC.TrafficCar = TrafficCar;
  PC.TrafficManager = TrafficManager;
  PC.laneOffset = laneOffset;
  PC.roadCentre = roadCentre;
})();
