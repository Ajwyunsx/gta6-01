// Palm City — guns and consequences: hitscan shots from the player, bullets in flight from
// the police, muzzle flashes, health and armour pickups, and the cash a body drops.
(function (global) {
  'use strict';

  const PC = global.PC;
  const K = PC.COMBAT;

  function makeBullet(x, y, angle, from, damage, speed) {
    const s = speed ?? PC.POLICE.bulletSpeed;
    return {
      x,
      y,
      vx: Math.cos(angle) * s,
      vy: Math.sin(angle) * s,
      life: 0.5,
      from,
      damage: damage ?? 8,
      trail: [],
    };
  }

  /**
   * A pistol shot: a hitscan line from the player's muzzle, with a little spread. The first
   * body or building on the line takes it.
   */
  function playerShoot(player, targets, city) {
    if (player.fireCooldown > 0) return null;
    if (player.ammo <= 0) return null;
    player.ammo -= 1;
    player.fireCooldown = K.playerFireRate;

    const angle = player.facing + (Math.random() - 0.5) * K.spread;
    const ox = player.x + Math.cos(angle) * 16;
    const oy = player.y + Math.sin(angle) * 16;

    // Ray-march to the first hit: cheap, and exact enough at these distances.
    const step = 6;
    let hit = null;
    let hitDist = K.playerRange;
    for (let d = 0; d < K.playerRange; d += step) {
      const x = ox + Math.cos(angle) * d;
      const y = oy + Math.sin(angle) * d;
      if (PC.City.hitsBuilding(city, x, y, 2)) {
        hitDist = d;
        break;
      }
      for (const t of targets) {
        if (t.dead || t === player) continue;
        if (PC.dist(x, y, t.x, t.y) < t.radius + 2) {
          hit = t;
          hitDist = d;
          break;
        }
      }
      if (hit) break;
    }

    return {
      angle,
      ox,
      oy,
      dist: hitDist,
      x: ox + Math.cos(angle) * hitDist,
      y: oy + Math.sin(angle) * hitDist,
      target: hit,
      damage: K.playerDamage,
    };
  }

  /** Advance police bullets, testing them against the player and buildings. */
  function updateBullets(bullets, player, city, dt) {
    const events = [];
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      b.life -= dt;
      const nx = b.x + b.vx * dt;
      const ny = b.y + b.vy * dt;

      let gone = b.life <= 0;

      if (!gone && PC.City.hitsBuilding(city, nx, ny, 2)) {
        events.push({ type: 'impact', x: nx, y: ny });
        gone = true;
      }

      if (!gone && b.from === 'police' && !player.inCar && PC.dist(nx, ny, player.x, player.y) < player.radius + 3) {
        events.push({ type: 'playerHit', damage: b.damage, x: nx, y: ny });
        gone = true;
      }

      b.x = nx;
      b.y = ny;
      if (gone) bullets.splice(i, 1);
    }
    return events;
  }

  /** Pickups: health, armour and cash scattered around the city. */
  function spawnPickups(city, count) {
    const rand = PC.rng(city.seed ^ 0x2545f491);
    const out = [];
    const kinds = ['health', 'armour', 'cash'];
    for (let i = 0; i < count; i++) {
      const kind = kinds[i % kinds.length];
      const col = rand.int(0, PC.GRID - 2);
      const row = rand.int(0, PC.GRID - 2);
      out.push({
        kind,
        x: col * PC.CELL + PC.ROAD / 2 + rand.range(-10, 10),
        y: row * PC.CELL + PC.CELL / 2 + rand.range(-10, 10),
        taken: false,
        value: kind === 'cash' ? rand.int(20, 90) : kind === 'health' ? 40 : 45,
        bob: rand.range(0, Math.PI * 2),
      });
    }
    return out;
  }

  /** Walk over a pickup and take it. */
  function tryPickup(pickups, player) {
    for (const p of pickups) {
      if (p.taken) continue;
      if (PC.dist(p.x, p.y, player.x, player.y) > 22) continue;
      if (p.kind === 'health') {
        if (player.health >= player.maxHealth) continue;
        player.health = Math.min(player.maxHealth, player.health + p.value);
      } else if (p.kind === 'armour') {
        if (player.armour >= PC.PLAYER_MAX_ARMOUR) continue;
        player.armour = Math.min(PC.PLAYER_MAX_ARMOUR, player.armour + p.value);
      } else {
        player.cash += p.value;
      }
      p.taken = true;
      p.respawn = 32;
      return p;
    }
    return null;
  }

  /** Put taken pickups back after a while so the city stays stocked. */
  function tickPickups(pickups, dt) {
    for (const p of pickups) {
      p.bob += dt * 2.4;
      if (p.taken) {
        p.respawn -= dt;
        if (p.respawn <= 0) p.taken = false;
      }
    }
  }

  PC.Combat = { makeBullet, playerShoot, updateBullets, spawnPickups, tryPickup, tickPickups };
})(window);
