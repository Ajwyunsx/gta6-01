/* Palm City — people: the player on foot and the pedestrians on the sidewalks.
   Both are drawn from above as a head, shoulders and swinging arms, so they read at a glance and
   still turn to face where they are going. Pedestrians wander, panic at gunfire and get knocked
   aside by cars; the player's on-foot movement, collision and sprint live here too. */
(function (PC) {
  'use strict';

  var C = PC.CONFIG, P = PC.PALETTE, U = PC.util;

  var SHIRTS = ['#e4572e', '#f2c14e', '#2a9d8f', '#5b7db1', '#c96a8a', '#6d597a', '#e0a03c', '#7fa650', '#d9d9d9', '#3d405b'];
  var PANTS = ['#39424e', '#5b5148', '#2f3a45', '#6f6357', '#4a4e69'];
  var SKINS = ['#e8b48c', '#c98d63', '#8d5b3f', '#f0c8a0', '#6b4430'];
  var HAIR = ['#2b2118', '#4b3621', '#141414', '#8a6a4b', '#c9a227'];

  /* ---------- player ---------- */

  function makePlayer(x, y) {
    return {
      x: x, y: y, vx: 0, vy: 0, angle: -Math.PI / 2,
      health: C.PLAYER.maxHealth, armor: 0,
      inCar: null, walk: 0, recoil: 0, hurt: 0,
      alive: true, weapon: 'pistol', ammo: 12, reserve: 96,
      reloading: 0, fireTimer: 0, lastShot: -99,
      shirt: '#f2efe6', pants: '#3b4252', skin: '#d9a172', hair: '#241a12'
    };
  }

  function updatePlayer(pl, input, dt, world) {
    if (!pl.alive) return;
    if (pl.hurt > 0) pl.hurt = Math.max(0, pl.hurt - dt);
    if (pl.recoil > 0) pl.recoil = Math.max(0, pl.recoil - dt * 6);
    if (pl.fireTimer > 0) pl.fireTimer -= dt;
    if (pl.reloading > 0) {
      pl.reloading -= dt;
      if (pl.reloading <= 0) {
        var need = C.COMBAT.clipSize - pl.ammo;
        var take = Math.min(need, pl.reserve);
        pl.ammo += take; pl.reserve -= take;
      }
    }

    if (pl.inCar) { driveOnFootSkip(pl, input, world); return; }

    var ax = 0, ay = 0;
    if (input.keys.left) ax -= 1;
    if (input.keys.right) ax += 1;
    if (input.keys.up) ay -= 1;
    if (input.keys.down) ay += 1;
    var len = Math.hypot(ax, ay);
    var speed = input.keys.sprint ? C.PLAYER.sprint : C.PLAYER.speed;
    if (len > 0) {
      ax /= len; ay /= len;
      pl.vx = U.approach(pl.vx, ax * speed, 1500 * dt);
      pl.vy = U.approach(pl.vy, ay * speed, 1500 * dt);
      pl.walk += dt * (speed > 250 ? 13 : 9);
    } else {
      pl.vx = U.approach(pl.vx, 0, 2200 * dt);
      pl.vy = U.approach(pl.vy, 0, 2200 * dt);
      pl.walk += dt * 2.2;
    }

    // aim with the mouse; a keyboard-only player keeps the last facing
    var m = input.mouse;
    if (m && m.active) {
      pl.angle = Math.atan2(m.wy - pl.y, m.wx - pl.x);
    } else if (len > 0) {
      pl.angle = Math.atan2(ay, ax);
    }

    moveWithCollision(pl, pl.vx * dt, pl.vy * dt, world.city, C.PLAYER.radius);
  }

  function driveOnFootSkip(pl, input, world) {
    // In a car the body rides along; the camera and the driving physics are the car's.
    pl.x = pl.inCar.x; pl.y = pl.inCar.y; pl.vx = 0; pl.vy = 0;
  }

  /* Circle against building rectangles, one axis at a time so a slide along a wall feels right. */
  function moveWithCollision(ent, dx, dy, city, radius) {
    var r = radius;
    ent.x += dx;
    var hit = PC.city.collideCircle(city, ent.x, ent.y, r);
    if (hit) ent.x -= dx;
    ent.y += dy;
    hit = PC.city.collideCircle(city, ent.x, ent.y, r);
    if (hit) ent.y -= dy;

    var maxX = C.CITY_W - 12, maxY = C.CITY_H + C.BEACH_H - 26;
    if (ent.x < 12) ent.x = 12; if (ent.x > maxX) ent.x = maxX;
    if (ent.y < 12) ent.y = 12; if (ent.y > maxY) ent.y = maxY;
    // the sea is a wall: the hotel strip and beach are walkable, the water is not
    var sea = C.CITY_H + C.BEACH_H - 26;
    if (ent.y > sea) ent.y = sea;
  }

  /* ---------- pedestrians ---------- */

  function spawnPed(city, rng, x, y) {
    var ped = {
      x: x, y: y, vx: 0, vy: 0, angle: rng() * 6.283,
      speed: 34 + rng() * 34, walk: rng() * 10,
      shirt: U.pick(rng, SHIRTS), pants: U.pick(rng, PANTS),
      skin: U.pick(rng, SKINS), hair: U.pick(rng, HAIR),
      panic: 0, target: null, timer: 0, hurt: 0, dead: false,
      slide: 0, slideAng: 0, bag: rng() < 0.3
    };
    pickPedTarget(ped, city, rng);
    return ped;
  }

  function pickPedTarget(ped, city, rng) {
    // Sidewalk corners are the natural waypoints: pick a point along a road edge.
    var gx = Math.floor(ped.x / C.CELL), gy = Math.floor(ped.y / C.CELL);
    gx = U.clamp(gx, 0, C.GRID - 1); gy = U.clamp(gy, 0, C.GRID - 1);
    var edge = Math.floor(rng() * 4);
    var bx = gx * C.CELL + C.ROAD / 2, by = gy * C.CELL + C.ROAD / 2;
    var inner = C.CELL - C.ROAD;
    var px = bx + 18 + rng() * (inner - 36);
    var py = by + 18 + rng() * (inner - 36);
    if (edge === 0) { px = bx + 12; py = by + rng() * inner; }
    else if (edge === 1) { px = bx + inner - 12; py = by + rng() * inner; }
    else if (edge === 2) { px = bx + rng() * inner; py = by + 12; }
    else { px = bx + rng() * inner; py = by + inner - 12; }
    if (ped.y > C.CITY_H) { px = ped.x + (rng() - 0.5) * 260; py = C.CITY_H + 40 + rng() * (C.BEACH_H - 120); }
    ped.target = { x: px, y: py };
    ped.timer = 6 + rng() * 8;
  }

  function updatePed(ped, dt, world, rng) {
    if (ped.dead) return;
    if (ped.hurt > 0) ped.hurt = Math.max(0, ped.hurt - dt);
    if (ped.slide > 0) {
      ped.slide -= dt;
      ped.x += Math.cos(ped.slideAng) * 260 * dt;
      ped.y += Math.sin(ped.slideAng) * 260 * dt;
      moveWithCollision(ped, 0, 0, world.city, 7);
      return;
    }
    ped.timer -= dt;

    var px = world.player.x, py = world.player.y;
    var d = U.dist(ped.x, ped.y, px, py);
    if (ped.panic > 0) ped.panic -= dt;
    if (d < 230 && world.noise > 0) ped.panic = Math.max(ped.panic, 1.6);

    var tx, ty, sp = ped.speed;
    if (ped.panic > 0) {
      var run = d < 1 ? 0 : 1;
      tx = ped.x + (ped.x - px) / Math.max(1, d) * 120;
      ty = ped.y + (ped.y - py) / Math.max(1, d) * 120;
      sp = 150 + (run ? 0 : 0);
      if (ped.timer <= 0) { ped.timer = 2.2 + rng() * 2; }
    } else {
      if (!ped.target || ped.timer <= 0) pickPedTarget(ped, world.city, rng);
      tx = ped.target.x; ty = ped.target.y;
      if (U.dist2(ped.x, ped.y, tx, ty) < 400) pickPedTarget(ped, world.city, rng);
    }

    var ang = Math.atan2(ty - ped.y, tx - ped.x);
    ped.angle += U.angleDiff(ped.angle, ang) * Math.min(1, dt * 5);
    ped.x += Math.cos(ped.angle) * sp * dt;
    ped.y += Math.sin(ped.angle) * sp * dt;
    ped.walk += dt * sp * 0.09;
    // keep them out of buildings
    if (PC.city.collideCircle(world.city, ped.x, ped.y, 7)) {
      ped.x -= Math.cos(ped.angle) * sp * dt;
      ped.y -= Math.sin(ped.angle) * sp * dt;
      ped.angle += 1.7;
      ped.target = null;
    }
  }

  /* ---------- drawing ---------- */

  function drawPlayer(ctx, pl, t) {
    if (pl.inCar) return;
    drawPerson(ctx, pl.x, pl.y, pl.angle, pl.walk, pl.shirt, pl.pants, pl.skin, pl.hair, 1, pl.hurt, false, pl.bag);
    if (pl.weapon === 'pistol') {
      var hx = pl.x + Math.cos(pl.angle) * 11, hy = pl.y + Math.sin(pl.angle) * 11;
      ctx.save();
      ctx.translate(hx, hy);
      ctx.rotate(pl.angle);
      ctx.fillStyle = '#2a2a2e';
      ctx.fillRect(0, -2.2, 10 - pl.recoil * 2, 4.4);
      ctx.restore();
    }
  }

  function drawPerson(ctx, x, y, angle, walk, shirt, pants, skin, hair, scale, hurt, isCop, bag) {
    var bob = Math.sin(walk) * 1.2;
    ctx.save();
    ctx.translate(x, y + bob * 0.3);
    // shadow
    ctx.fillStyle = 'rgba(60,40,30,0.2)';
    ctx.beginPath(); ctx.ellipse(4, 4, 10 * scale, 7 * scale, 0.4, 0, 6.283); ctx.fill();

    ctx.rotate(angle + Math.PI / 2);
    var arm = Math.sin(walk) * 4;
    // legs / trousers
    ctx.fillStyle = pants;
    ctx.fillRect(-5.5 * scale, 4 * scale, 4 * scale, 6 * scale);
    ctx.fillRect(1.5 * scale, 4 * scale, 4 * scale, 6 * scale);
    // torso
    ctx.fillStyle = shirt;
    U.roundRect(ctx, -6.5 * scale, -8 * scale, 13 * scale, 15 * scale, 4 * scale);
    ctx.fill();
    // arms
    ctx.fillStyle = shirt;
    ctx.fillRect(-9.5 * scale, -6 * scale + arm, 3.4 * scale, 9 * scale);
    ctx.fillRect(6.1 * scale, -6 * scale - arm, 3.4 * scale, 9 * scale);
    // hands
    ctx.fillStyle = skin;
    ctx.beginPath(); ctx.arc(-7.8 * scale, 3.2 * scale + arm, 1.7 * scale, 0, 6.283); ctx.fill();
    ctx.beginPath(); ctx.arc(7.8 * scale, 3.2 * scale - arm, 1.7 * scale, 0, 6.283); ctx.fill();
    // head
    ctx.fillStyle = hair;
    ctx.beginPath(); ctx.arc(0, -8 * scale, 5.4 * scale, 0, 6.283); ctx.fill();
    ctx.fillStyle = skin;
    ctx.beginPath(); ctx.arc(0, -8.4 * scale, 4.1 * scale, 0, 6.283); ctx.fill();
    // cap brim for police, hair fringe for others
    if (isCop) {
      ctx.fillStyle = '#1c2b45';
      ctx.beginPath(); ctx.arc(0, -8.4 * scale, 4.6 * scale, 0, 6.283); ctx.fill();
      ctx.fillStyle = '#e8c268';
      ctx.fillRect(-2 * scale, -13.6 * scale, 4 * scale, 2 * scale);
    } else {
      ctx.fillStyle = hair;
      ctx.beginPath(); ctx.arc(0, -9.6 * scale, 3.6 * scale, Math.PI * 0.05, Math.PI * 0.95, true); ctx.fill();
    }
    if (bag) {
      ctx.fillStyle = '#8b5a3c';
      ctx.fillRect(5 * scale, -2 * scale, 5 * scale, 6 * scale);
    }
    if (hurt) {
      ctx.fillStyle = 'rgba(226,87,76,' + Math.min(0.7, hurt) + ')';
      ctx.beginPath(); ctx.arc(0, 0, 9 * scale, 0, 6.283); ctx.fill();
    }
    ctx.restore();
  }

  function drawPed(ctx, ped) {
    if (ped.dead) {
      ctx.save();
      ctx.translate(ped.x, ped.y);
      ctx.rotate(ped.angle);
      ctx.fillStyle = 'rgba(140,30,30,0.35)';
      ctx.beginPath(); ctx.ellipse(0, 0, 14, 8, 0, 0, 6.283); ctx.fill();
      ctx.fillStyle = ped.shirt;
      ctx.fillRect(-8, -3, 16, 6);
      ctx.restore();
      return;
    }
    drawPerson(ctx, ped.x, ped.y, ped.angle, ped.walk, ped.shirt, ped.pants, ped.skin, ped.hair, 0.92, ped.hurt, ped.isCop, ped.bag);
  }

  PC.entities = {
    makePlayer: makePlayer,
    updatePlayer: updatePlayer,
    moveWithCollision: moveWithCollision,
    spawnPed: spawnPed,
    updatePed: updatePed,
    drawPlayer: drawPlayer,
    drawPed: drawPed,
    drawPerson: drawPerson
  };
})(window.PC = window.PC || {});
