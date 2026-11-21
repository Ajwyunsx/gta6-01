// Palm City — people: the player on foot, pedestrians who walk the sidewalks, and the
// shared actor shape (position, facing, velocity, health, a small hit radius).
(function (global) {
  'use strict';

  const PC = global.PC;

  let nextId = 1;
  const id = () => nextId++;

  const SHIRTS = ['#e4614f', '#4f8fd4', '#7dbb6a', '#f0c14b', '#b8a5d6', '#efe6d5', '#e08fb0', '#57c6d8', '#3f4a5a'];
  const SKINS = ['#e8c19a', '#c9905f', '#8d5a35', '#f2d6ba', '#6b4229'];
  const HAIR = ['#2b2018', '#5a3a20', '#14100c', '#b8843f', '#8a8a8a'];

  /** A person: used for the player and for every pedestrian. */
  function makeActor(x, y, opts) {
    const o = opts || {};
    return {
      id: id(),
      kind: o.kind || 'ped',
      x,
      y,
      vx: 0,
      vy: 0,
      facing: o.facing ?? 0,
      radius: o.radius ?? 8,
      health: o.health ?? PC.COMBAT.pedHealth,
      maxHealth: o.health ?? PC.COMBAT.pedHealth,
      armour: 0,
      speed: o.speed ?? 52,
      walkPhase: Math.random() * Math.PI * 2,
      shirt: o.shirt || SHIRTS[(Math.random() * SHIRTS.length) | 0],
      skin: o.skin || SKINS[(Math.random() * SKINS.length) | 0],
      hair: o.hair || HAIR[(Math.random() * HAIR.length) | 0],
      panic: 0,
      dead: false,
      deadTimer: 0,
      target: null,
      waitTimer: 0,
      // Path of waypoints a pedestrian walks between (sidewalk corners).
      route: o.route || null,
      routeIndex: 0,
      isPlayer: false,
    };
  }

  /** The player: a bit faster, with health, armour, cash and a gun. */
  function makePlayer(x, y) {
    const p = makeActor(x, y, {
      kind: 'player',
      radius: PC.PLAYER_RADIUS,
      health: PC.PLAYER_MAX_HEALTH,
      speed: PC.WALK_SPEED,
    });
    p.isPlayer = true;
    p.armour = 0;
    p.cash = 0;
    p.facing = -Math.PI / 2;
    p.inCar = null;
    p.weapon = 'pistol';
    p.ammo = 120;
    p.fireCooldown = 0;
    p.breath = 0;
    p.shirt = '#eef2f8';
    p.hair = '#2b2018';
    return p;
  }

  /**
   * Pedestrians: they walk a loop of sidewalk waypoints, pause at corners, and bolt when
   * they hear gunfire or see a body.
   */
  /**
   * Pedestrians walk the sidewalk ring around a block: four corners, in order, so they
   * trace the kerb like people actually do instead of wandering through living rooms.
   */
  function spawnPedestrians(city, count) {
    const peds = [];
    const rand = PC.rng(city.seed ^ 0x9e3779b9);
    for (let i = 0; i < count; i++) {
      const lot = rand.pick(city.lots);
      if (!lot) break;
      const k = 8;
      const ring = [
        { x: lot.x - k, y: lot.y - k },
        { x: lot.x + lot.w + k, y: lot.y - k },
        { x: lot.x + lot.w + k, y: lot.y + lot.h + k },
        { x: lot.x - k, y: lot.y + lot.h + k },
      ];
      const corner = rand.int(0, 3);
      const ped = makeActor(ring[corner].x, ring[corner].y, {
        speed: rand.range(38, 64),
        route: ring,
      });
      ped.routeIndex = corner;
      ped.walkPhase = rand.range(0, 6.28);
      peds.push(ped);
    }
    return peds;
  }

  /** Walk an actor toward (tx, ty) at its own speed; returns true when it arrives. */
  function stepToward(a, tx, ty, dt, speed) {
    const dx = tx - a.x;
    const dy = ty - a.y;
    const d = Math.hypot(dx, dy);
    if (d < 6) return true;
    const s = speed ?? a.speed;
    const nx = dx / d;
    const ny = dy / d;
    a.x += nx * s * dt;
    a.y += ny * s * dt;
    a.facing = Math.atan2(ny, nx);
    a.walkPhase += dt * (s / 22);
    return false;
  }

  /**
   * Pedestrian AI: follow the route, pause at each corner, and scatter away from gunfire
   * for a couple of seconds before settling back into a walk.
   */
  function updatePedestrian(ped, city, dt, noise) {
    if (ped.dead) {
      ped.deadTimer += dt;
      return;
    }
    // Panic overrides the route: run directly away from the nearest scare.
    if (noise && noise.x !== undefined) {
      const d = PC.dist(ped.x, ped.y, noise.x, noise.y);
      if (d < noise.radius) {
        ped.panic = Math.max(ped.panic, 2.6);
        const away = Math.atan2(ped.y - noise.y, ped.x - noise.x);
        ped.x += Math.cos(away) * ped.speed * 2.1 * dt;
        ped.y += Math.sin(away) * ped.speed * 2.1 * dt;
        ped.facing = away;
        ped.walkPhase += dt * 7;
        return;
      }
    }
    if (ped.panic > 0) {
      ped.panic -= dt;
      ped.x += Math.cos(ped.facing) * ped.speed * 1.6 * dt;
      ped.y += Math.sin(ped.facing) * ped.speed * 1.6 * dt;
      ped.walkPhase += dt * 6;
      return;
    }

    if (!ped.route || ped.route.length === 0) return;
    const wp = ped.route[ped.routeIndex % ped.route.length];
    if (ped.waitTimer > 0) {
      ped.waitTimer -= dt;
      return;
    }
    if (stepToward(ped, wp.x, wp.y, dt)) {
      ped.routeIndex = (ped.routeIndex + 1) % ped.route.length;
      ped.waitTimer = 0.4 + Math.random() * 1.2;
    }

    // Keep pedestrians out of buildings and inside the map.
    const hit = PC.City.hitsBuilding(city, ped.x, ped.y, ped.radius);
    if (hit) {
      ped.x -= Math.cos(ped.facing) * 60 * dt;
      ped.y -= Math.sin(ped.facing) * 60 * dt;
      ped.routeIndex = (ped.routeIndex + 1) % ped.route.length;
    }
    ped.x = PC.clamp(ped.x, 8, PC.WORLD - 8);
    ped.y = PC.clamp(ped.y, 8, city.beachTop - 4);
  }

  /** Damage an actor; armour eats a share of it. Returns true when it kills. */
  function damage(a, amount) {
    if (a.dead) return false;
    let left = amount;
    if (a.armour > 0) {
      const absorbed = Math.min(a.armour, left * PC.COMBAT.armourAbsorb);
      a.armour -= absorbed;
      left -= absorbed;
    }
    a.health -= left;
    if (a.health <= 0) {
      a.health = 0;
      a.dead = true;
      a.deadTimer = 0;
      return true;
    }
    return false;
  }

  PC.Entities = { makeActor, makePlayer, spawnPedestrians, stepToward, updatePedestrian, damage };
})(window);
