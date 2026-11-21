// world.js — the simulation glue. It owns every system (city, cars, traffic, people, police,
// combat, missions, effects, hud, ui, audio), runs one fixed step of each in the right order,
// and carries the small connective tissue: entering and leaving cars, the runner in a chase,
// hostile crews, noise, notifications, saving and respawning.
(function () {
  'use strict';
  var PC = window.PC;
  var CFG = PC.CFG;
  var U = PC.U;

  var SAVE_KEY = 'palmcity.save.v1';

  function World(canvas) {
    this.canvas = canvas;
    this.rng = U.makeRng(CFG.SEED ^ 0x5f3759df);
    this.time = 0;
    this.fixedStep = CFG.STEP;

    this.city = new PC.City();
    this.player = new PC.Player(CFG.CELL + CFG.ROAD + 60, CFG.CELL + CFG.ROAD + 60);
    this.cars = new PC.CarManager(this.city, U.makeRng(CFG.SEED + 7));
    this.cars.seedParked();
    this.traffic = new PC.TrafficManager(this.city, this.cars, U.makeRng(CFG.SEED + 11));
    this.peds = new PC.PedManager(this.city, U.makeRng(CFG.SEED + 13));
    this.streets = new PC.Streets(this.city, U.makeRng(CFG.SEED + 23));
    this.police = new PC.Police(this.city, this.cars, U.makeRng(CFG.SEED + 17));
    this.effects = new PC.Effects(U.makeRng(CFG.SEED + 19));
    this.combat = new PC.Combat(this);
    this.missions = new PC.Missions(this);
    this.hud = new PC.HUD(this);
    this.ui = new PC.UI(this);
    this.audio = new PC.AudioEngine();

    this.camera = { x: this.player.x, y: this.player.y, zoom: CFG.CAMERA_SCALE };
    this.hostiles = [];
    this.runner = null;
    this.aiming = false;
    this.enterHint = null;
    this.stats = { cash: 0, jobs: 0, peds: 0, cops: 0, cars: 0, distance: 0 };
    this.shotCam = null;
    this.clock = 0;
    this.lastCrash = 0;
    this.distanceClock = 0;

    this.combat.seedPickups(this.city);
    this.seedPeds();
  }

  World.prototype.seedPeds = function () {
    for (var k = 0; k < 26; k++) {
      var seed = this.city.pedSpawns[Math.floor(this.rng() * this.city.pedSpawns.length)];
      if (!seed) continue;
      this.peds.spawnAt(seed.x + (this.rng() - 0.5) * 30, seed.y + (this.rng() - 0.5) * 30);
    }
  };

  // ---- game flow -------------------------------------------------------------
  World.prototype.startNewGame = function () {
    var spawn = this.city.markers.diner;
    this.player.reset(spawn.x + 40, spawn.y + 46);
    this.player.cash = CFG.tuning.startCash;
    this.player.ammo = 24;
    this.player.armour = 30;
    this.missions.reset();
    this.police.clear();
    this.hostiles.length = 0;
    this.runner = null;
    this.effects.clear();
    this.camera.x = this.player.x;
    this.camera.y = this.player.y;
    this.stats = { cash: 0, jobs: 0, peds: 0, cops: 0, cars: 0, distance: 0 };
    this.hud.banner('PALM CITY', 'Find Rosa at the Sandbox Diner — the gold marker on the map');
    this.ui.screen = 'playing';
    this.audio.start();
    this.save();
  };

  World.prototype.respawn = function () {
    var hospital = this.city.markers.park;
    this.player.reset(hospital.x, hospital.y + 60);
    this.player.health = this.player.maxHealth;
    this.player.cash = Math.max(0, this.player.cash - 150);
    this.police.clear();
    this.hostiles.length = 0;
    this.runner = null;
    this.missions.state = this.missions.index >= this.missions.jobs.length ? 'complete' : 'idle';
    this.missions.briefing = null;
    this.ui.screen = 'playing';
    this.hud.toast('Hospital bill: $150');
  };

  World.prototype.wasted = function () {
    if (this.ui.screen === 'dead') return;
    this.audio.explosion();
    this.effects.shake(18);
    this.player.alive = false;
    this.ui.dead('WASTED');
  };

  World.prototype.busted = function () {
    if (this.ui.screen === 'dead') return;
    var car = this.player.inCar;
    if (car) car.driver = null;
    this.player.inCar = null;
    this.audio.missionFail();
    this.ui.dead('BUSTED');
  };

  World.prototype.save = function () {
    try {
      var data = {
        v: 1,
        x: this.player.x, y: this.player.y,
        health: this.player.health, armour: this.player.armour,
        cash: this.player.cash, ammo: this.player.ammo,
        job: this.missions.index,
        wanted: this.player.wanted,
        stats: this.stats,
      };
      window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
      return true;
    } catch (e) {
      return false;
    }
  };

  World.prototype.load = function () {
    var raw = null;
    try {
      raw = window.localStorage.getItem(SAVE_KEY);
    } catch (e) {
      raw = null;
    }
    if (!raw) return false;
    var data;
    try {
      data = JSON.parse(raw);
    } catch (e) {
      return false;
    }
    if (!data || data.v !== 1) return false;
    this.player.reset(data.x, data.y);
    this.player.health = U.clamp(data.health || 100, 1, this.player.maxHealth);
    this.player.armour = U.clamp(data.armour || 0, 0, this.player.maxArmour);
    this.player.cash = data.cash || 0;
    this.player.ammo = data.ammo || 0;
    this.missions.index = U.clamp(data.job || 0, 0, this.missions.jobs.length);
    this.missions.state = this.missions.index >= this.missions.jobs.length ? 'complete' : 'idle';
    this.missions.briefing = null;
    this.missions.targetCar = null;
    this.police.clear();
    this.hostiles.length = 0;
    this.runner = null;
    if (data.stats) this.stats = data.stats;
    this.camera.x = this.player.x;
    this.camera.y = this.player.y;
    this.ui.screen = 'playing';
    this.hud.banner('WELCOME BACK', 'Job ' + Math.min(this.missions.index + 1, 7) + ' of 7 — the marker is on your map');
    return true;
  };

  // ---- helpers ---------------------------------------------------------------
  World.prototype.playerInCar = function () {
    return !!this.player.inCar;
  };

  World.prototype.playerCar = function () {
    return this.player.inCar || null;
  };

  World.prototype.notify = function (text) {
    this.hud.toast(text);
  };

  // A loud noise pulls the police toward it even without a direct sighting.
  World.prototype.noise = function (x, y, radius) {
    if (!this.police.stars) return;
    var d = U.dist(x, y, this.player.x, this.player.y);
    if (d < radius) this.police.lastKnown = { x: x, y: y };
  };

  World.prototype.spawnHostile = function (x, y, tough) {
    var h = {
      x: x, y: y, angle: 0, stride: 0,
      health: 90 * (tough || 1), maxHealth: 90 * (tough || 1),
      alive: true, hitFlash: 0, radius: 12,
      fireClock: U.randRange(this.rng, 0.4, 1.8),
      speed: 96 + this.rng() * 40,
      tough: tough || 1,
    };
    this.hostiles.push(h);
    return h;
  };

  // ---- one fixed step --------------------------------------------------------
  World.prototype.step = function (dt, input) {
    this.time += dt;
    this.clock += dt;
    var player = this.player;
    var ui = this.ui;

    this.audio.update(dt, this);
    this.effects.update(dt);
    this.hud.update(dt);

    if (ui.screen !== 'playing') {
      ui.update(dt);
      this.updateIdleWorld(dt, input);
      return;
    }

    var aimAngle = input.mouseAngle(this.renderer ? this.renderer.w : window.innerWidth, this.renderer ? this.renderer.h : window.innerHeight, player.angle);
    this.aiming = input.state.aim && !player.inCar;
    input.state.aimAngle = aimAngle;
    if (this.aiming) player.angle = aimAngle;

    // ---- on foot or in a car ------------------------------------------------
    if (player.inCar) {
      this.drivePlayer(dt, input);
    } else {
      player.updateFoot(dt, input.state, this.city);
      // entering a car
      if (input.pressed.KeyE || input.state.interact) {
        var car = this.cars.nearest(player.x, player.y, CFG.tuning.carEnterRange, true);
        if (car && car.health > 0) this.enterCar(car);
      }
      // punching
      if (input.state.aim === false && input.state.action && !input.state.fire) this.combat.punch();
    }
    input.state.interact = false;

    // ---- weapons -----------------------------------------------------------
    if (input.state.fire) {
      if (player.inCar) this.combat.playerShot(player.inCar.angle, true);
      else this.combat.playerShot(aimAngle, false);
    }

    // ---- world systems -----------------------------------------------------
    this.cars.updateDrivers(dt, this);
    this.traffic.update(dt, this);
    this.peds.update(dt, this);
    this.streets.update(dt, this);
    this.police.update(dt, this);
    this.combat.update(dt);
    this.updateHostiles(dt);
    this.updateRunner(dt);
    this.missions.update(dt);
    this.updateEnterHint();

    // ---- collision with people --------------------------------------------
    this.crushCheck(dt);

    // ---- eigenbookkeeping --------------------------------------------------
    player.wanted = this.police.stars;
    if (player.inCar) {
      this.distanceClock += player.inCar.speed * dt;
      if (this.distanceClock > 400) {
        this.stats.distance += 0.1;
        this.distanceClock = 0;
      }
    }
    if (player.health <= 0 && player.alive) {
      player.alive = false;
      this.wasted();
    }
    if (this.clock > 2 && (this.clock % 30) < dt) this.save();

    ui.update(dt);
  };

  // The world keeps breathing behind the title and pause screens, just slower.
  World.prototype.updateIdleWorld = function (dt, input) {
    this.traffic.update(dt, this);
    this.peds.update(dt, this);
    this.streets.update(dt, this);
    this.effects.update(dt);
    if (this.ui.screen === 'title' && !this.player.inCar) {
      // a slow drift of the player's gaze so the title backdrop is alive
      this.player.angle += dt * 0.06;
    }
    void input;
  };

  World.prototype.drivePlayer = function (dt, input) {
    var car = this.player.inCar;
    var prevSpeed = car.speed;
    var throttle = 0;
    if (input.state.up) throttle += 1;
    if (input.state.down) throttle -= 1;
    // A/D steer; with the mouse held the car also leans toward the cursor
    var steer = 0;
    if (input.state.left) steer -= 1;
    if (input.state.right) steer += 1;
    if (input.state.aim && !steer) {
      var aim = input.state.aimAngle || car.angle;
      var diff = U.wrapAngle(aim - car.angle);
      steer = U.clamp(diff * 1.4, -1, 1);
    }
    if (steer === 0) {
      var d2 = U.wrapAngle((input.state.aimAngle || car.angle) - car.angle);
      if (input.state.aim && Math.abs(d2) < 0.5) steer = U.clamp(d2 * 1.6, -1, 1);
    }
    car.drive(dt, {
      throttle: throttle,
      steer: steer,
      brake: input.state.action,
      handbrake: input.state.action && input.state.sprint,
      boost: input.state.sprint,
    }, this.city);
    this.player.x = car.x;
    this.player.y = car.y;
    this.player.angle = car.angle;

    // leave the car
    if (input.pressed.KeyE || input.state.interact) {
      this.exitCar();
      input.state.interact = false;
      return;
    }

    // crash sounds and skid marks
    if (prevSpeed - car.speed > 120 && this.clock - this.lastCrash > 0.25) {
      this.lastCrash = this.clock;
      this.audio.crash(prevSpeed - car.speed);
      this.effects.shake(6);
    }
    if (Math.abs(steer) > 0.6 && car.speed > 300) {
      this.effects.skid(car.x - Math.cos(car.angle + 1.57) * 20, car.y - Math.sin(car.angle + 1.57) * 20, car.angle);
      this.effects.skid(car.x + Math.cos(car.angle + 1.57) * 20, car.y + Math.sin(car.angle + 1.57) * 20, car.angle);
    }
    // honking for the fun of it
    if (input.pressed.KeyH) this.audio.horn();
    input.state.interact = false;
  };

  World.prototype.enterCar = function (car) {
    var player = this.player;
    car.driver = 'player';
    car.occupied = true;
    car.stop();
    player.inCar = car;
    player.vx = player.vy = 0;
    this.audio.start();
    this.notify('Stole a ' + car.model.name);
    if (car.parked) {
      this.police.crime('cars', car.x, car.y);
      car.parked = false;
    }
    this.stats.cars++;
    this.audio.uiClick();
  };

  World.prototype.exitCar = function () {
    var car = this.player.inCar;
    if (!car) return;
    car.driver = null;
    car.stop();
    var side = car.angle + Math.PI / 2;
    var x = U.clamp(car.x + Math.cos(side) * (car.wid / 2 + 26), 12, CFG.WORLD_W - 12);
    var y = U.clamp(car.y + Math.sin(side) * (car.wid / 2 + 26), 12, CFG.WORLD_H - 12);
    var fixed = this.city.resolveCircle(x, y, this.player.radius);
    this.player.x = fixed.x;
    this.player.y = fixed.y;
    this.player.inCar = null;
    this.player.angle = car.angle;
  };

  World.prototype.updateEnterHint = function () {
    if (this.shotCam) { this.enterHint = null; return; }
    if (this.player.inCar) {
      this.enterHint = { text: 'E — get out', x: this.player.x, y: this.player.y };
      return;
    }
    var near = this.cars.nearest(this.player.x, this.player.y, CFG.tuning.carEnterRange, true);
    if (near) {
      this.enterHint = { text: 'E — steal the ' + near.model.name, x: near.x, y: near.y };
    } else {
      this.enterHint = null;
    }
  };

  // People under a moving car get hurt; this is the whole point of a car.
  World.prototype.crushCheck = function (dt) {
    var player = this.player;
    if (!player.inCar) return;
    var car = player.inCar;
    if (car.speed < 130) return;
    for (var k = 0; k < this.peds.list.length; k++) {
      var p = this.peds.list[k];
      if (!p.alive) continue;
      if (U.dist(p.x, p.y, car.x, car.y) < car.len * 0.5) {
        var dead = p.damage(140, this);
        this.effects.burst(p.x, p.y, '#c8354a', 8);
        this.effects.shake(4);
        car.vx *= 0.92;
        car.vy *= 0.92;
        car.damage(6);
        this.police.crime('pedestrian', car.x, car.y);
        if (dead) this.stats.peds++;
      }
    }
    // officers too
    for (var u = 0; u < this.police.units.length; u++) {
      var o = this.police.units[u].officer;
      if (!o || !o.alive) continue;
      if (U.dist(o.x, o.y, car.x, car.y) < car.len * 0.5) {
        o.health -= 120;
        o.hitFlash = 1;
        this.police.crime('police', car.x, car.y);
        if (o.health <= 0) {
          o.alive = false;
          this.notify('Officer down — this is going to get loud');
          this.stats.cops++;
        }
      }
    }
    void dt;
  };

  // ---- hostiles (mission crews) ---------------------------------------------
  World.prototype.updateHostiles = function (dt) {
    var player = this.player;
    for (var k = this.hostiles.length - 1; k >= 0; k--) {
      var h = this.hostiles[k];
      if (!h.alive) {
        // gone from the list once the body has been down a moment
        h.corpse = (h.corpse || 0) + dt;
        if (h.corpse > 3) this.hostiles.splice(k, 1);
        continue;
      }
      if (h.hitFlash > 0) h.hitFlash -= dt * 3;
      var d = U.dist(h.x, h.y, player.x, player.y);
      var a = Math.atan2(player.y - h.y, player.x - h.x);
      h.angle = a;
      if (d > 150) {
        var nx = h.x + Math.cos(a) * h.speed * dt;
        var ny = h.y + Math.sin(a) * h.speed * dt;
        var fixed = this.city.resolveCircle(nx, ny, h.radius);
        h.x = fixed.x;
        h.y = fixed.y;
        h.stride += h.speed * dt * 0.06;
      }
      h.fireClock -= dt;
      if (h.fireClock <= 0 && d < 560) {
        h.fireClock = U.randRange(this.rng, 1.0, 2.0);
        var hits = this.rng() < 0.42;
        this.combat.copShot(h.x, h.y, a, d, hits, h);
      }
    }
    // the player's own shots damage hostiles through the combat trace
    for (var t = 0; t < this.combat.tracers.length; t++) void t;
  };

  World.prototype.hostileHit = function (x, y, radius) {
    for (var k = 0; k < this.hostiles.length; k++) {
      var h = this.hostiles[k];
      if (!h.alive) continue;
      if (U.dist(h.x, h.y, x, y) < radius) return h;
    }
    return null;
  };

  World.prototype.hostileAt = function (x, y, radius) {
    return this.hostileHit(x, y, radius);
  };

  // ---- the chase runner -----------------------------------------------------
  World.prototype.updateRunner = function (dt) {
    if (!this.runner || !this.runner.car) return;
    var car = this.runner.car;
    var tgt = this.runner.target;
    car.driver = 'runner';
    var a = Math.atan2(tgt.y - car.y, tgt.x - car.x);
    var diff = U.wrapAngle(a - car.angle);
    car.drive(dt, {
      throttle: 1,
      steer: U.clamp(diff * 2.0, -1, 1),
      brake: Math.abs(diff) > 1.2 && car.speed > 380,
    }, this.city);
    car.occupied = true;
    // the runner keeps a head start but never gets away for free
    if (car.health <= 0) {
      this.effects.burst(car.x, car.y, '#ffb347', 20);
      this.effects.shake(10);
      this.audio.explosion();
      this.runner.car = null;
      this.missions.targetCar = null;
      this.missions.complete();
    }
  };

  PC.World = World;
  PC.SAVE_KEY = SAVE_KEY;
})();
