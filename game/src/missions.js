/* Palm City — the story. Seven jobs in one chain for Vera Okafor, who runs a courier desk out of
   a café on the beach strip: fetch and deliver, collect debts, outrun a tail, steal a car, shake a
   tail off, rob a check-cashing office and leave town clean. Each job hands over a marker on the
   map, a briefing card, a live objective line and a cash reward; the chain ends with a payout and
   the keys to the city. */
(function (PC) {
  'use strict';

  var C = PC.CONFIG, P = PC.PALETTE, U = PC.util;

  var JOBS = [
    {
      id: 'courier', type: 'deliver', title: 'Special Delivery', giver: 'Vera Okafor', cash: 140,
      brief: 'A sealed envelope has to reach the Solaria front desk before the manager does. No questions, no peek.',
      line: 'Pick up the envelope at the bay-side kiosk.',
      steps: [
        { at: 'pickup', text: 'Take the envelope from the kiosk clerk' },
        { at: 'drop', text: 'Deliver it to the Solaria hotel front desk' }
      ]
    },
    {
      id: 'debts', type: 'collect', title: 'Three Small Debts', giver: 'Vera Okafor', cash: 180,
      brief: 'Three people owe Vera money and all three are ducking her. Lean on them. Not too hard, the car needs to run after.',
      line: 'Collect from three marks, then bring the cash back.',
      steps: [
        { at: 'm1', text: 'Collect from the pawnbroker' },
        { at: 'm2', text: 'Collect from the motel clerk' },
        { at: 'm3', text: 'Collect from the arcade owner' },
        { at: 'drop', text: 'Return the cash to Vera at the café' }
      ]
    },
    {
      id: 'tail', type: 'chase', title: 'The Tail', giver: 'Vera Okafor', cash: 220,
      brief: 'Someone has been sitting on the café all morning in a green coupe. Follow it home before it follows you.',
      line: 'Stay on the green coupe until it stops.',
      steps: [
        { at: 'pickup', text: 'Get in a car and pick up the coupe' },
        { at: 'drop', text: 'Keep the coupe in sight until it parks' }
      ]
    },
    {
      id: 'wheels', type: 'steal', title: 'Wheels for the Job', giver: 'Marco Ruiz', cash: 260,
      brief: 'We need something fast and forgettable for Friday. The marina lot has a white coupe with the keys inside.',
      line: 'Steal the white coupe from the marina lot.',
      steps: [
        { at: 'pickup', text: 'Steal the white coupe in the marina lot' },
        { at: 'drop', text: 'Park it in the garage behind the café' }
      ]
    },
    {
      id: 'shake', type: 'escape', title: 'Lose the Blue', giver: 'Marco Ruiz', cash: 300,
      brief: 'The job left a trail and the trail has a cruiser on it. Get the stars off your back and get to the pier.',
      line: 'Lose the police, then reach the pier.',
      steps: [
        { at: 'pickup', text: 'Get the heat off you' },
        { at: 'drop', text: 'Reach the pier head' }
      ]
    },
    {
      id: 'heist', type: 'heist', title: 'The Check Cashing Job', giver: 'Marco Ruiz', cash: 520,
      brief: 'Friday, 9 p.m. The office on Delacroix keeps its float in a safe. In, out, and the crew splits it on the sand.',
      line: 'Hit the check-cashing office and get clear.',
      steps: [
        { at: 'pickup', text: 'Reach the office door' },
        { at: 'crack', text: 'Crack the safe (hold position)' },
        { at: 'drop', text: 'Get away and lose the heat' }
      ]
    },
    {
      id: 'leave', type: 'finale', title: 'Leave Town Clean', giver: 'Vera Okafor', cash: 900,
      brief: 'One last run: take the money to the pier, hand Vera the keys and walk away. That is the whole job.',
      line: 'Bring the take to the pier and walk away.',
      steps: [
        { at: 'pickup', text: 'Collect the take from the café' },
        { at: 'drop', text: 'Meet Vera at the pier head' }
      ]
    }
  ];

  /* Anchor points, all on the beach strip or the first two rows of town so the chain reads well. */
  var SPOTS = {
    cafe: { x: 5.2 * C.CELL, y: C.CITY_H + 128 },
    kiosk: { x: 3.4 * C.CELL, y: C.CITY_H + 108 },
    solaria: { x: 9.6 * C.CELL, y: 9.4 * C.CELL },
    pawn: { x: 2.6 * C.CELL, y: 12.4 * C.CELL },
    motel: { x: 12.4 * C.CELL, y: 13.6 * C.CELL },
    arcade: { x: 7.2 * C.CELL, y: 11.2 * C.CELL },
    marina: { x: 14.2 * C.CELL, y: C.CITY_H + 62 },
    garage: { x: 5.8 * C.CELL, y: 14.4 * C.CELL },
    pier: { x: C.CITY_W * 0.62 + 75, y: C.CITY_H + C.BEACH_H + 200 },
    bank: { x: 10.6 * C.CELL, y: 8.2 * C.CELL }
  };

  function makeMissions(world) {
    return {
      jobs: JOBS,
      spots: SPOTS,
      index: 0,
      state: 'idle',         // idle | brief | active | done
      job: null,
      step: 0,
      marker: null,
      markerKind: 'pickup',
      targets: [],
      timer: 0,
      clubTimer: 0,
      briefTime: 0,
      chaseTarget: null,
      safeTimer: 0,
      safeOpen: false,
      completed: 0,
      log: []
    };
  }

  function startChain(ms) {
    ms.index = 0;
    ms.state = 'idle';
    ms.completed = 0;
    ms.log.length = 0;
  }

  function beginJob(ms, world) {
    var job = ms.jobs[ms.index];
    if (!job) return;
    ms.job = job;
    ms.state = 'brief';
    ms.briefTime = 4.6;
    ms.step = 0;
    ms.safeOpen = false;
    ms.safeTimer = 0;
    ms.targets = [];
    ms.chaseTarget = null;
    buildTargets(ms, job, world);
    world.audio.sting();
    world.hud.flash(job.title, P.accent);
  }

  function buildTargets(ms, job, world) {
    var s = SPOTS;
    var rng = world.rng;
    if (job.id === 'courier') {
      ms.targets = [
        { at: 'pickup', x: s.kiosk.x, y: s.kiosk.y, label: 'Kiosk', kind: 'pickup' },
        { at: 'drop', x: s.solaria.x, y: s.solaria.y, label: 'Solaria', kind: 'drop' }
      ];
    } else if (job.id === 'debts') {
      ms.targets = [
        { at: 'm1', x: s.pawn.x, y: s.pawn.y, label: 'Pawnbroker', kind: 'pickup' },
        { at: 'm2', x: s.motel.x, y: s.motel.y, label: 'Motel', kind: 'pickup' },
        { at: 'm3', x: s.arcade.x, y: s.arcade.y, label: 'Arcade', kind: 'pickup' },
        { at: 'drop', x: s.cafe.x, y: s.cafe.y, label: 'Vera', kind: 'drop' }
      ];
    } else if (job.id === 'tail') {
      ms.targets = [{ at: 'pickup', x: s.cafe.x + 40, y: s.cafe.y, label: 'Coupe', kind: 'chase' }];
      ms.chaseTarget = spawnChaseTarget(world, s.cafe.x + 120, s.cafe.y - 10, rng);
    } else if (job.id === 'wheels') {
      var spot = world.marineCoupe;
      ms.targets = [
        { at: 'pickup', x: spot.x, y: spot.y, label: 'White coupe', kind: 'steal' },
        { at: 'drop', x: s.garage.x, y: s.garage.y, label: 'Garage', kind: 'drop' }
      ];
    } else if (job.id === 'shake') {
      ms.targets = [
        { at: 'pickup', x: s.cafe.x + 30, y: s.cafe.y - 30, label: 'Clear', kind: 'escape' },
        { at: 'drop', x: s.pier.x, y: s.pier.y, label: 'Pier head', kind: 'drop' }
      ];
    } else if (job.id === 'heist') {
      ms.targets = [
        { at: 'pickup', x: s.bank.x, y: s.bank.y, label: 'Office', kind: 'pickup' },
        { at: 'crack', x: s.bank.x + 26, y: s.bank.y + 20, label: 'Safe', kind: 'crack' },
        { at: 'drop', x: s.cafe.x, y: s.cafe.y, label: 'Café', kind: 'drop' }
      ];
    } else if (job.id === 'leave') {
      ms.targets = [
        { at: 'pickup', x: s.cafe.x, y: s.cafe.y, label: 'Vera', kind: 'pickup' },
        { at: 'drop', x: s.pier.x, y: s.pier.y, label: 'Pier head', kind: 'drop' }
      ];
    }
  }

  function spawnChaseTarget(world, x, y, rng) {
    var car = PC.vehicles.makeCar(x, y, Math.PI, { rng: rng, type: 'coupe', paint: '#3f7d5c' });
    car.traffic = true;
    car.axis = 'x'; car.dir = -1; car.gx = Math.round(x / C.CELL); car.gy = 0;
    car.cruise = 170;
    car.speed = 0;
    car.chaseScripted = true;
    world.parked.push(car);
    return car;
  }

  function currentTarget(ms) {
    if (!ms.job || ms.state !== 'active') return null;
    return ms.targets[ms.step] || null;
  }

  function update(ms, world, dt) {
    if (ms.state === 'brief') {
      ms.briefTime -= dt;
      if (ms.briefTime <= 0) ms.state = 'active';
    }
    if (ms.state === 'idle') {
      // Vera waits at the café; walking into her marker begins the next job.
      if (ms.index < ms.jobs.length) {
        var c = SPOTS.cafe;
        if (U.dist2(world.player.x, world.player.y, c.x, c.y) < 46 * 46) beginJob(ms, world);
      }
      return;
    }
    if (ms.state !== 'active') return;

    var tgt = currentTarget(ms);
    if (!tgt) return;

    if (ms.job.id === 'tail' && ms.chaseTarget) updateChaseScript(ms, world, dt);
    if (ms.job.id === 'shake') {
      // the job seeds the heat once
      if (!ms.heatSeeded) { ms.heatSeeded = true; world.heat.stars = Math.max(world.heat.stars, 2); }
    }
    if (ms.job.id === 'heist' && tgt.kind === 'crack') {
      var d2 = U.dist2(world.player.x, world.player.y, tgt.x, tgt.y);
      if (d2 < 46 * 46 && !world.player.inCar) {
        ms.safeTimer += dt;
        world.hud.objectiveProgress = ms.safeTimer / 3;
        if (ms.safeTimer >= 3) { ms.safeTimer = 0; ms.step++; ms.safeOpen = true; world.hud.flash('Safe cracked', P.gold); world.audio.sting(); }
        return;
      } else { ms.safeTimer = Math.max(0, ms.safeTimer - dt); world.hud.objectiveProgress = ms.safeTimer / 3; }
    }

    var pass = false;
    if (tgt.kind === 'chase') {
      pass = reachedChaseEnd(ms, world, tgt);
    } else if (tgt.kind === 'escape') {
      pass = world.heat.stars === 0;
    } else if (tgt.kind === 'steal') {
      pass = world.player.inCar && world.player.inCar.stolenWhite;
    } else {
      pass = U.dist2(world.player.x, world.player.y, tgt.x, tgt.y) < 40 * 40;
    }

    if (pass) advance(ms, world);
  }

  function reachedChaseEnd(ms, world, tgt) {
    var c = ms.chaseTarget;
    if (!c) return true;
    if (c.driver === 'player') return true;
    return c.arrived;
  }

  function updateChaseScript(ms, world, dt) {
    var c = ms.chaseTarget;
    if (!c || c.driver === 'player') return;
    ms.clubTimer += dt;
    // drive in a lazy loop around the block for a while, then park
    if (ms.clubTimer > 14 && !c.arrived) {
      c.speed = U.approach(c.speed, 0, 200 * dt);
      if (c.speed < 2) c.arrived = true;
      return;
    }
    c.speed = U.approach(c.speed, 175, 140 * dt);
    c.angle += Math.sin(ms.clubTimer * 0.9) * 0.016;
    c.x += Math.cos(c.angle) * c.speed * dt;
    c.y += Math.sin(c.angle) * c.speed * dt;
    if (PC.city.collideCircle(world.city, c.x, c.y, 20)) {
      c.angle += 1.4;
      c.x -= Math.cos(c.angle) * c.speed * dt;
      c.y -= Math.sin(c.angle) * c.speed * dt;
    }
  }

  function advance(ms, world) {
    ms.step += 1;
    if (ms.step >= ms.targets.length) {
      completeJob(ms, world);
    } else {
      world.hud.flash('Objective cleared', P.accent2);
      world.audio.pickup();
    }
  }

  function completeJob(ms, world) {
    var job = ms.job;
    ms.state = 'done';
    ms.completed += 1;
    world.money += job.cash;
    world.stats.jobs += 1;
    ms.log.push(job.title);
    world.hud.flash(job.title + ' — $' + job.cash, P.money);
    world.hud.banner('Job complete', '$' + job.cash + ' paid');
    world.audio.cash();
    world.effects.cash(world.player.x, world.player.y, 14);
    if (ms.job.id === 'wheels' && world.player.inCar) world.player.inCar.stolenWhite = false;
    ms.job = null;
    ms.index += 1;
    ms.heatSeeded = false;
    ms.clubTimer = 0;
    if (ms.index >= ms.jobs.length) {
      ms.state = 'finished';
      world.onStoryComplete();
    } else {
      ms.state = 'idle';
      ms.timer = 2.5;
      ms.chaseTarget = null;
    }
  }

  function objectiveText(ms) {
    if (ms.state === 'finished') return 'All jobs done. The city is yours.';
    if (ms.state === 'idle' || ms.state === 'brief') {
      if (ms.state === 'idle') return 'See Vera at the café for work (' + (ms.index + 1) + '/' + ms.jobs.length + ')';
    }
    if (!ms.job) return '';
    var tgt = ms.targets[ms.step];
    return tgt ? tgt.label + ' — ' + (ms.job.steps[ms.step] ? ms.job.steps[ms.step].text : '') : ms.job.line;
  }

  /* What the map marker should be right now: Vera's café between jobs, else the live objective. */
  function markerFor(ms, world) {
    if (ms.state === 'active') {
      var tgt = currentTarget(ms);
      if (tgt) return { x: tgt.kind === 'chase' && ms.chaseTarget ? ms.chaseTarget.x : tgt.x, y: tgt.kind === 'chase' && ms.chaseTarget ? ms.chaseTarget.y : tgt.y, kind: tgt.kind };
    }
    if (ms.state === 'idle' || ms.state === 'brief') {
      if (ms.state === 'idle') return { x: SPOTS.cafe.x, y: SPOTS.cafe.y, kind: 'npc' };
    }
    return null;
  }

  function drawMarkers(ms, ctx, cam, t) {
    var m = markerFor(ms, null);
    if (!m) return;
    var vw = cam.w || C.VW, vh = cam.h || C.VH;
    if (m.x < cam.x - 60 || m.x > cam.x + vw + 60 || m.y < cam.y - 60 || m.y > cam.y + vh + 60) return;
    var pulse = 1 + Math.sin(t * 3.4) * 0.12;
    ctx.save();
    ctx.translate(m.x, m.y);
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = m.kind === 'drop' ? P.accent2 : P.accent;
    ctx.beginPath(); ctx.arc(0, 0, 34 * pulse, 0, 6.283); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = m.kind === 'drop' ? P.accent2 : P.accent;
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, 0, 22 * pulse, 0, 6.283); ctx.stroke();
    // a downward chevron bouncing above the ring
    var bob = Math.abs(Math.sin(t * 3.4)) * 6;
    ctx.fillStyle = m.kind === 'drop' ? P.accent2 : P.accent;
    ctx.beginPath();
    ctx.moveTo(0, -34 - bob); ctx.lineTo(-8, -46 - bob); ctx.lineTo(8, -46 - bob);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  PC.missions = {
    make: makeMissions,
    startChain: startChain,
    beginJob: beginJob,
    update: update,
    objectiveText: objectiveText,
    markerFor: markerFor,
    drawMarkers: drawMarkers,
    JOBS: JOBS,
    SPOTS: SPOTS
  };
})(window.PC = window.PC || {});
