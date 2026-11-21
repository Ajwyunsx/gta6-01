// combat.js — bullets, hits and the pickups scattered through the city. Shooting is a
// hitscan ray per shot: it finds the nearest thing in the line of fire and stops there.
// The player's shots can hit people and cars; cop shots only hit the player.

import { PLAYER } from './config.js';
import { buildingAt } from './city.js';

export class Combat {
  constructor(city) {
    this.city = city;
    this.bullets = [];
    this.pickups = [];
    this.recent = [];
  }

  reset() {
    this.bullets.length = 0;
  }

  // One shot from (x, y) along angle, reaching maxRange. Returns the thing it hit.
  fire(world, x, y, angle, opts = {}) {
    const { owner = 'player', damage = 18, range = 900, spread = 0 } = opts;
    const a = angle + (Math.random() - 0.5) * spread;
    const maxLen = range;
    const step = 12;
    let hit = null;
    let hx = x + Math.cos(a) * maxLen;
    let hy = y + Math.sin(a) * maxLen;
    for (let d = 20; d < maxLen; d += step) {
      const px = x + Math.cos(a) * d;
      const py = y + Math.sin(a) * d;
      if (buildingAt(this.city, px, py, 3)) {
        hx = px;
        hy = py;
        hit = { kind: 'wall', x: px, y: py };
        break;
      }
      if (owner === 'player') {
        const target = this.nearestTarget(world, px, py, 24);
        if (target) {
          hit = target;
          hx = px;
          hy = py;
          break;
        }
      } else {
        const p = world.player;
        const px2 = p.inCar ? p.inCar.x : p.x;
        const py2 = p.inCar ? p.inCar.y : p.y;
        if (Math.hypot(px - px2, py - py2) < (p.inCar ? 34 : 16)) {
          hit = { kind: 'player', x: px, y: py };
          hx = px;
          hy = py;
          break;
        }
      }
    }

    // Tracer: a short-lived streak from the muzzle to where it stopped.
    this.bullets.push({
      x: hx,
      y: hy,
      ox: x,
      oy: y,
      vx: Math.cos(a),
      vy: Math.sin(a),
      life: 0.09,
      maxLife: 0.09,
      owner,
    });
    return { hit, x: hx, y: hy, angle: a };
  }

  nearestTarget(world, x, y, r) {
    let best = null;
    let bestD = r;
    if (world.thugs) {
      for (const thug of world.thugs) {
        if (thug.down) continue;
        const d = Math.hypot(thug.x - x, thug.y - y);
        if (d < bestD) {
          bestD = d;
          best = { kind: 'thug', thug };
        }
      }
    }
    for (const ped of world.peds) {
      const d = Math.hypot(ped.x - x, ped.y - y);
      if (d < bestD) {
        bestD = d;
        best = { kind: 'ped', ped };
      }
    }
    for (const car of world.cars) {
      const d = Math.hypot(car.x - x, car.y - y);
      if (d < bestD + 10) {
        bestD = d;
        best = { kind: 'car', car };
      }
    }
    for (const cop of world.police.cars) {
      const d = Math.hypot(cop.x - x, cop.y - y);
      if (d < bestD + 10) {
        bestD = d;
        best = { kind: 'copcar', car: cop };
      }
    }
    return best;
  }

  applyHit(world, result, effects, audio) {
    const { hit } = result;
    if (!hit) return;
    if (hit.kind === 'wall') {
      effects.sparks(hit.x, hit.y, result.angle + Math.PI, 6);
      effects.burst(hit.x, hit.y, 4, { speed: 60, life: 0.3, size: 2, colors: ['#c9c2d8', '#8f889e'] });
      return;
    }
    if (hit.kind === 'ped') {
      const ped = hit.ped;
      ped.state = 'down';
      ped.downTimer = 2.2 + Math.random() * 2;
      ped.moving = false;
      effects.sparks(hit.x, hit.y, result.angle, 5);
      effects.text(ped.x, ped.y - 28, 'DOWN', '#ff9fb2', 12);
      // Shooting a civilian is the loudest way to get noticed.
      world.police.addHeat(world.player, 22);
      world.scarePeds(hit.x, hit.y, 420);
      audio?.gunshot?.(0.5);
      return;
    }
    if (hit.kind === 'thug') {
      hit.thug.hp -= 22;
      effects.sparks(hit.x, hit.y, result.angle, 5);
      effects.burst(hit.x, hit.y, 4, { speed: 80, life: 0.35, size: 2.2, colors: ['#ff9fb2'] });
      if (hit.thug.hp <= 0) {
        hit.thug.down = true;
        effects.text(hit.thug.x, hit.thug.y - 26, 'CLEAR', '#8ef2a0', 12);
      }
      return;
    }
    if (hit.kind === 'car' || hit.kind === 'copcar') {
      const car = hit.car;
      car.health = Math.max(0, car.health - 6);
      effects.sparks(hit.x, hit.y, result.angle, 8);
      // A stolen car taking hits rattles the driver.
      if (car.driver === 'player') effects.addShake(0.2, 0.15);
      return;
    }
    if (hit.kind === 'player') {
      const p = world.player;
      p.damage(9);
      effects.sparks(hit.x, hit.y, result.angle, 4);
      effects.addShake(0.4, 0.2);
      effects.text(p.x, p.y - 34, '-9', '#ff6b7d', 13);
      world.police.addHeat(p, 4);
    }
  }

  playerShoot(world, effects, audio) {
    const p = world.player;
    if (p.fireCooldown > 0 || !p.alive) return;
    p.fireCooldown = PLAYER.fireDelay;
    const originX = p.inCar ? p.inCar.x : p.x;
    const originY = p.inCar ? p.inCar.y : p.y;
    const angle = p.inCar ? p.inCar.angle : p.aim;
    const muzzleX = originX + Math.cos(angle) * (p.inCar ? 30 : 16);
    const muzzleY = originY + Math.sin(angle) * (p.inCar ? 30 : 16);
    effects.flashAt(muzzleX, muzzleY, angle, p.inCar ? 0.8 : 1);
    const result = this.fire(world, muzzleX, muzzleY, angle, { owner: 'player', spread: 0.035 });
    this.applyHit(world, result, effects, audio);
    p.recoil = 1;
    effects.addShake(p.inCar ? 0.12 : 0.18, 0.1);
    audio?.gunshot?.(1);
    if (!p.inCar) world.scarePeds(p.x, p.y, 300);
  }

  copShoot(world, cop, effects, audio) {
    // Called from main.js's police fire logic; kept here so all shooting lives in one file.
    const p = world.player;
    const px = p.inCar ? p.inCar.x : p.x;
    const py = p.inCar ? p.inCar.y : p.y;
    const angle = Math.atan2(py - cop.y, px - cop.x);
    const result = this.fire(world, cop.x + Math.cos(angle) * 24, cop.y + Math.sin(angle) * 24, angle, {
      owner: 'cop',
      damage: 9,
      spread: 0.16,
    });
    effects.flashAt(cop.x + Math.cos(angle) * 26, cop.y + Math.sin(angle) * 26, angle, 0.7);
    this.applyHit(world, result, effects, audio);
    audio?.gunshot?.(0.4);
  }

  // A thug's shot at the player: same ray, shorter reach, less damage.
  fireThug(world, thug, effects, audio) {
    const p = world.player;
    const px = p.inCar ? p.inCar.x : p.x;
    const py = p.inCar ? p.inCar.y : p.y;
    const angle = Math.atan2(py - thug.y, px - thug.x);
    const result = this.fire(world, thug.x + Math.cos(angle) * 18, thug.y + Math.sin(angle) * 18, angle, {
      owner: 'thug',
      range: 520,
      spread: 0.12,
    });
    effects.flashAt(thug.x + Math.cos(angle) * 20, thug.y + Math.sin(angle) * 20, angle, 0.6);
    // Thug bullets hurt the player; walls just spark.
    if (result.hit && result.hit.kind === 'player') {
      p.damage(8);
      effects.addShake(0.35, 0.18);
      effects.text(px, py - 34, '-8', '#ff6b7d', 13);
    } else if (result.hit && result.hit.kind === 'wall') {
      effects.sparks(result.x, result.y, angle + Math.PI, 4);
    }
    audio?.gunshot?.(0.35);
  }

  // --- pickups ---------------------------------------------------------------

  addPickup(x, y, kind, amount = 20) {
    this.pickups.push({ id: Math.random(), x, y, kind, amount, bob: Math.random() * 6 });
  }

  scatterPickups(city, rng, count = 26) {
    for (let i = 0; i < count; i++) {
      const block = rng.pick(city.sidewalks);
      const x = block.x + rng.float(18, block.w - 18);
      const y = block.y + rng.float(18, block.h - 18);
      const roll = rng.next();
      if (roll < 0.45) this.addPickup(x, y, 'cash', rng.pick([20, 40, 60, 120]));
      else if (roll < 0.75) this.addPickup(x, y, 'health', 35);
      else this.addPickup(x, y, 'armor', 40);
    }
  }

  updatePickups(dt, world, effects, audio) {
    const p = world.player;
    const px = p.inCar ? p.inCar.x : p.x;
    const py = p.inCar ? p.inCar.y : p.y;
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const it = this.pickups[i];
      it.bob += dt * 3;
      if (Math.hypot(it.x - px, it.y - py) > 34) continue;
      if (it.kind === 'cash') {
        p.money += it.amount;
        effects.text(it.x, it.y - 20, `+$${it.amount}`, '#8ef2a0', 14);
        audio?.pickup?.('cash');
      } else if (it.kind === 'health') {
        if (p.health >= PLAYER.health) continue;
        p.heal(it.amount);
        effects.text(it.x, it.y - 20, `+${it.amount} HP`, '#ff7f92', 13);
        audio?.pickup?.('health');
      } else {
        if (p.armor >= 100) continue;
        p.armor = Math.min(100, p.armor + it.amount);
        effects.text(it.x, it.y - 20, `+${it.amount} ARM`, '#7fc4ff', 13);
        audio?.pickup?.('armor');
      }
      effects.burst(it.x, it.y, 8, { speed: 90, life: 0.4, size: 2.4, colors: ['#ffe9a8'] });
      this.pickups.splice(i, 1);
    }
  }

  draw(ctx, camera, time) {
    // Bullets are drawn with the actors in render.js; pickups lie on the ground.
    for (const it of this.pickups) {
      if (it.x < camera.x - 40 || it.y < camera.y - 40 || it.x > camera.x + camera.w + 40 || it.y > camera.y + camera.h + 40) continue;
      const bob = Math.sin(it.bob) * 3;
      ctx.save();
      ctx.translate(it.x, it.y + bob);
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.ellipse(2, 8 - bob, 13, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      const color = it.kind === 'cash' ? '#7ff08a' : it.kind === 'health' ? '#ff5f7a' : '#54c8ff';
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.16;
      ctx.beginPath();
      ctx.arc(0, 0, 22, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = color;
      if (it.kind === 'cash') {
        ctx.fillRect(-7, -5, 14, 10);
        ctx.fillStyle = '#123a1a';
        ctx.font = '800 9px ui-sans-serif, system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('$', 0, 3);
      } else if (it.kind === 'health') {
        ctx.fillRect(-3, -8, 6, 16);
        ctx.fillRect(-8, -3, 16, 6);
      } else {
        ctx.beginPath();
        ctx.moveTo(0, -9);
        ctx.lineTo(8, -4);
        ctx.lineTo(8, 5);
        ctx.lineTo(0, 10);
        ctx.lineTo(-8, 5);
        ctx.lineTo(-8, -4);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }
  }

  drawBullets(ctx, bullets) {
    for (const b of this.bullets) {
      const a = b.life / b.maxLife;
      ctx.strokeStyle = b.owner === 'player' ? `rgba(255,225,150,${a})` : `rgba(150,200,255,${a})`;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(b.x - b.vx * 90 * a, b.y - b.vy * 90 * a);
      ctx.stroke();
    }
  }

  update(dt) {
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.life -= dt;
      if (b.life <= 0) this.bullets.splice(i, 1);
    }
  }
}
