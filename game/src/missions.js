// missions.js — the story of Palm City, told in seven jobs. Each job has a giver standing at
// a marker, a briefing card, an objective the HUD can show, and a payout. The chain is linear:
// finish one and the next marker lights up somewhere across town.
(function () {
  'use strict';
  var PC = window.PC;
  var CFG = PC.CFG;
  var U = PC.U;

  var JOBS = [
    {
      id: 'rent',
      title: 'Rent Is Due',
      giver: 'Rosa at the Sandbox Diner',
      where: 'diner',
      brief:
        'Rosa has kept your tab open for three months and she is done being nice. ' +
        'Her ex left a duffel in a lock-up on Neon Pike. Bring it back and the tab is square.',
      objective: 'Drive to the lock-up on Neon Pike and collect the duffel',
      target: 'depot',
      need: 'reach',
      payout: 380,
      outro: 'Rosa counts the cash twice, sighs, and pushes a plate of fries at you. "You eat. You look like a ghost."',
    },
    {
      id: 'pawn',
      title: 'The Pawn Ticket',
      giver: 'Marco at Pelican Pawn',
      where: 'pawn',
      brief:
        'Marco bought a watch he should not have bought. The seller wants it back, and he is ' +
        'bringing friends. Stand in front of the counter until they lose their nerve.',
      objective: 'Hold the pawn shop on Banyan Row against the collectors',
      target: 'pawn',
      need: 'defend',
      wave: 3,
      payout: 520,
      outro: '"You are hired," Marco says, and immediately looks like he regrets saying it.',
    },
    {
      id: 'marina',
      title: 'Low Tide',
      giver: 'Ines on the boardwalk',
      where: 'marina',
      brief:
        'Ines runs the marina office and someone has been cutting moorings at night. ' +
        'Her boat is next. Sit on the dock until the cutter shows up, then make him regret it.',
      objective: 'Patrol the marina docks — find whoever is cutting the lines',
      target: 'marina',
      need: 'defend',
      wave: 4,
      payout: 640,
      outro: 'Ines hands you a key on a cork float. "Berth nine. Do not tell anyone I gave you this."',
    },
    {
      id: 'arcade',
      title: 'High Score',
      giver: 'Dex at Sunset Arcade',
      where: 'arcade',
      brief:
        'Dex skims the arcade machines for a crew that does not exist on paper. Tonight the ' +
        'pickup goes wrong and the money walks. Chase the runner down Sunset Strip before he reaches the bridge.',
      objective: 'Chase down the runner before he reaches the bridge',
      target: 'bridge',
      need: 'chase',
      payout: 760,
      outro: 'Dex splits the take without being asked. "You are faster than you look. That is a compliment."',
    },
    {
      id: 'hotel',
      title: 'Room 402',
      giver: 'Nadia at the Heron Hotel',
      where: 'hotel',
      brief:
        'Nadia has a guest in 402 who pays in envelopes and never opens the curtains. ' +
        'She wants him gone before the convention crowd arrives. He will not go quietly.',
      objective: 'Clear room 402 at the Heron Hotel',
      target: 'hotel',
      need: 'defend',
      wave: 5,
      payout: 900,
      outro: 'Nadia takes the envelope, tucks it into her jacket, and books you a room for the night. "On the house."',
    },
    {
      id: 'club',
      title: 'Last Call',
      giver: 'Bram at the Sandbar Club',
      where: 'club',
      brief:
        'Bram owes the wrong people a favour and they have come to collect it at closing time. ' +
        'Get everyone out, keep the bar standing, and do not let them take the register.',
      objective: 'Defend the Sandbar Club until closing time',
      target: 'club',
      need: 'defend',
      wave: 6,
      payout: 1150,
      outro: 'Bram pours two glasses of something expensive and slides one across the bar. "Same time next month?"',
    },
    {
      id: 'harbour',
      title: 'The Long Pier',
      giver: 'Ines, by radio',
      where: 'marina',
      brief:
        'Every thread leads to the harbour depot: the watch, the moorings, the envelopes. ' +
        'Whoever is running it is loading a container tonight. Go and end this.',
      objective: 'Take the harbour depot and end it',
      target: 'depot',
      need: 'defend',
      wave: 8,
      payout: 2400,
      finale: true,
      outro:
        'The container is full of nothing but old chairs. Somebody has been laughing at all of you for months. ' +
        'Ines is quiet on the radio for a long moment. "Well," she says. "At least the city is ours now."',
    },
  ];

  function Missions(world) {
    this.world = world;
    this.jobs = JOBS;
    this.index = 0;
    this.state = 'idle';       // idle | offered | active | done | complete
    this.timer = 0;
    this.kills = 0;
    this.waveLeft = 0;
    this.waveClock = 0;
    this.targetCar = null;
    this.briefing = null;
    this.bannerClock = 0;
    this.lastResult = null;
    this.spawned = [];
    this.hint = '';
  }

  Missions.prototype.current = function () {
    return this.jobs[Math.min(this.index, this.jobs.length - 1)];
  };

  Missions.prototype.markerPos = function () {
    var job = this.current();
    if (!job) return null;
    var m = this.world.city.markers[job.where];
    if (!m) return null;
    return m;
  };

  Missions.prototype.objectivePos = function () {
    var job = this.current();
    if (!job || this.state !== 'active') return null;
    var city = this.world.city;
    if (job.need === 'chase' && this.targetCar) return { x: this.targetCar.x, y: this.targetCar.y };
    var t = city.markers[job.target] || city.markers[job.where];
    return t;
  };

  Missions.prototype.update = function (dt) {
    var world = this.world;
    var player = world.player;
    if (this.bannerClock > 0) this.bannerClock -= dt;

    // the briefing card waits for the player to press E or walk away
    if (this.state === 'offered') {
      if (this.briefing && this.briefing.autoIn !== undefined) {
        this.briefing.autoIn -= dt;
        if (this.briefing.autoIn <= 0) this.begin();
      }
      return;
    }
    if (this.state === 'idle') {
      var mk = this.markerPos();
      if (mk && U.dist(mk.x, mk.y, player.x, player.y) < 46 && !player.inCar) {
        this.offer();
      }
      return;
    }
    if (this.state !== 'active') return;

    var job = this.current();
    this.timer += dt;

    if (job.need === 'reach') {
      var tgt = world.city.markers[job.target];
      if (tgt && U.dist(tgt.x, tgt.y, player.x, player.y) < 70) {
        this.complete();
      }
      return;
    }

    if (job.need === 'chase') {
      if (!this.targetCar) this.spawnRunner();
      if (this.targetCar) {
        var d = U.dist(this.targetCar.x, this.targetCar.y, player.x, player.y);
        var bridge = world.city.markers.bridge;
        if (bridge && U.dist(this.targetCar.x, this.targetCar.y, bridge.x, bridge.y) < 90) {
          this.fail('The runner reached the bridge and vanished into traffic.');
          return;
        }
        if (d < 70 || this.targetCar.health <= 0) {
          this.complete();
          return;
        }
        if (d > 2400) {
          // keep the chase honest: the runner waits at the light for you
          this.targetCar.vx *= 0.4;
          this.targetCar.vy *= 0.4;
        }
      }
      return;
    }

    if (job.need === 'defend') {
      this.updateDefend(dt, job);
      return;
    }
  };

  // ---- defend jobs -----------------------------------------------------------
  Missions.prototype.updateDefend = function (dt, job) {
    var world = this.world;
    var player = world.player;
    var site = world.city.markers[job.target] || world.city.markers[job.where];
    this.waveClock -= dt;

    if (this.waveLeft <= 0 && this.kills < job.wave) {
      if (this.waveClock <= 0) {
        this.spawnAttacker(site, job);
        this.waveLeft--;
        this.waveClock = U.randRange(world.rng, 1.4, 2.6);
      }
    }
    // any live attacker close to the site is a threat the HUD mentions
    var threats = 0;
    for (var k = 0; k < world.hostiles.length; k++) {
      if (world.hostiles[k].alive) threats++;
    }
    if (threats === 0 && this.kills >= job.wave) {
      this.complete();
      return;
    }
    // wandering too far off the site abandons the fight
    if (site && U.dist(site.x, site.y, player.x, player.y) > 1400) {
      this.fail('You left the site. The job fell apart without you.');
    }
  };

  Missions.prototype.spawnAttacker = function (site, job) {
    var world = this.world;
    var rng = world.rng;
    for (var tries = 0; tries < 18; tries++) {
      var ang = rng() * 6.28;
      var dist = U.randRange(rng, 300, 520);
      var x = U.clamp(site.x + Math.cos(ang) * dist, 30, CFG.CITY_W - 30);
      var y = U.clamp(site.y + Math.sin(ang) * dist, 30, CFG.CITY_H - 30);
      if (world.city.hitBuilding(x, y, 16)) continue;
      world.spawnHostile(x, y, job.finale ? 1.3 : 1);
      return;
    }
  };

  // ---- flow ------------------------------------------------------------------
  Missions.prototype.offer = function () {
    var job = this.current();
    this.state = 'offered';
    this.briefing = { job: job, t: 0, autoIn: undefined };
    this.world.audio.missionPing();
    this.world.hud.banner('JOB: ' + job.title.toUpperCase(), job.giver);
  };

  Missions.prototype.begin = function () {
    var job = this.current();
    this.state = 'active';
    this.timer = 0;
    this.kills = 0;
    this.waveLeft = 0;
    this.waveClock = 0.8;
    this.briefing = null;
    this.spawned.length = 0;
    this.world.hostiles.length = 0;
    if (job.need === 'chase') this.spawnRunner();
    this.world.hud.banner(job.title.toUpperCase(), job.objective);
    this.world.audio.missionStart();
  };

  Missions.prototype.spawnRunner = function () {
    var world = this.world;
    var city = world.city;
    var job = this.current();
    var start = city.markers[job.where];
    var startCar = new PC.Car(start.x + 60, start.y + 40, 0, {
      name: 'Courier Coupe', body: '#e7dac0', trim: '#2a2630',
      len: 92, wid: 46, top: 620, accel: 720, handling: 1.05, seats: 2,
    }, world.rng);
    startCar.driver = 'runner';
    world.cars.list.push(startCar);
    this.targetCar = startCar;
    // head for the bridge marker at speed
    var bridge = city.markers.bridge || { x: CFG.CITY_W, y: CFG.CITY_H };
    startCar.angle = Math.atan2(bridge.y - startCar.y, bridge.x - startCar.x);
    startCar.vx = Math.cos(startCar.angle) * 300;
    startCar.vy = Math.sin(startCar.angle) * 300;
    // the runner is its own little chase system, in world.js
    world.runner = { car: startCar, target: bridge, loot: true };
  };

  Missions.prototype.complete = function () {
    var job = this.current();
    var world = this.world;
    this.state = 'done';
    this.lastResult = { ok: true, job: job, timer: this.timer };
    world.player.cash += job.payout;
    world.stats.cash += job.payout;
    world.stats.jobs++;
    this.index++;
    this.targetCar = null;
    world.runner = null;
    world.hostiles.length = 0;
    world.audio.missionComplete();
    world.hud.banner('JOB COMPLETE', U.money(job.payout) + ' paid — ' + job.outro);
    if (this.index >= this.jobs.length) {
      this.state = 'complete';
      world.hud.banner('PALM CITY IS YOURS', 'Seven jobs. One city. Nothing left to prove.');
    } else {
      this.state = 'idle';
      this.briefing = null;
    }
    world.save();
  };

  Missions.prototype.fail = function (reason) {
    var world = this.world;
    this.state = 'idle';
    this.lastResult = { ok: false, reason: reason };
    this.targetCar = null;
    world.runner = null;
    world.hostiles.length = 0;
    world.hud.banner('JOB FAILED', reason);
    world.audio.missionFail();
  };

  Missions.prototype.onHostileDown = function () {
    this.kills++;
    this.waveLeft = 0;
  };

  Missions.prototype.reset = function () {
    this.index = 0;
    this.state = 'idle';
    this.briefing = null;
    this.targetCar = null;
    this.world.runner = null;
  };

  Missions.prototype.hudObjective = function () {
    if (this.state === 'active') {
      var job = this.current();
      if (job.need === 'defend') return job.objective + ' (' + Math.min(this.kills, job.wave) + '/' + job.wave + ')';
      return job.objective;
    }
    if (this.state === 'idle' && this.index < this.jobs.length) {
      var m = this.markerPos();
      return 'Next job: ' + this.current().title + (m ? ' — ' + m.name : '');
    }
    if (this.state === 'complete') return 'All seven jobs complete';
    return '';
  };

  PC.Missions = Missions;
  PC.JOBS = JOBS;
})();
