/* Palm City — shooting and health. A pistol hitscan with a cooldown and a reload, a melee-free
   punch for when it runs dry, damage that peels armour before health, and the pickups that put
   you back together: cash, health kits, armour plates and ammo crates. */
(function (PC) {
  'use strict';

  var C = PC.CONFIG, P = PC.PALETTE, U = PC.util;

  function canShoot(pl) {
    return !pl.inCar && pl.alive && pl.reloading <= 0 && pl.fireTimer <= 0 && pl.ammo > 0;
  }

  function tryShoot(pl, world) {
    var m = world.input.mouse;
    if (!m || !m.active) return false;
    if (pl.ammo <= 0) { startReload(pl, world); return false; }
    if (!canShoot(pl)) return false;

    pl.ammo -= 1;
    pl.fireTimer = C.COMBAT.pistolCooldown;
    pl.recoil = 1;
    pl.angle = Math.atan2(m.wy - pl.y, m.wx - pl.x);
    var ang = pl.angle + (world.rng() - 0.5) * 0.035;
    var range = C.COMBAT.pistolRange;
    var ox = pl.x + Math.cos(ang) * 12, oy = pl.y + Math.sin(ang) * 12;

    world.effects.muzzle(ox, oy, ang);
    world.effects.shake(3.5);
    world.audio.gunshot(1, 1);
    world.noise = 0.8;

    // the first thing the ray meets: a building wall, a pedestrian, a cop, or nothing
    var wallT = rayBuilding(world.city, ox, oy, ang, range);
    var hitPed = nearestPedOnRay(world, ox, oy, ang, Math.min(range, wallT));
    var hitCop = nearestCopOnRay(world, ox, oy, ang, Math.min(range, wallT));

    if (hitCop && (!hitPed || hitCop.t < hitPed.t)) {
      var cop = hitCop.car;
      cop.health -= C.COMBAT.pistolDamage;
      world.effects.impact(hitCop.x, hitCop.y);
      world.effects.spark(hitCop.x, hitCop.y, '#ffd88c');
      if (cop.health <= 0) {
        world.effects.explode(cop.x, cop.y);
        world.audio.explosion();
        PC.police.commit(world.heat, 'hitCop', world);
      } else {
        PC.police.commit(world.heat, 'shooting', world);
      }
      return true;
    }
    if (hitPed) {
      hitPed.ped.hurt = 1;
      hitPed.ped.dead = true;
      world.effects.blood(hitPed.x, hitPed.y, ang);
      world.audio.thud();
      PC.police.commit(world.heat, 'assault', world);
      world.stats.knocked += 1;
      return true;
    }
    if (wallT < range) {
      var wx = ox + Math.cos(ang) * wallT, wy = oy + Math.sin(ang) * wallT;
      world.effects.spark(wx, wy, '#e8e1cd');
      world.effects.impact(wx, wy);
      world.audio.thud();
    }
    return true;
  }

  function startReload(pl, world) {
    if (pl.reloading > 0 || pl.reserve <= 0 || pl.ammo >= C.COMBAT.clipSize) return;
    pl.reloading = C.COMBAT.reload;
    world.audio.reload();
  }

  /* March along the ray to the first building edge. */
  function rayBuilding(city, x, y, ang, range) {
    var step = 6;
    var cx = Math.cos(ang), cy = Math.sin(ang);
    for (var t = step; t < range; t += step) {
      if (PC.city.collideCircle(city, x + cx * t, y + cy * t, 0)) return t;
    }
    return range;
  }

  function nearestPedOnRay(world, x, y, ang, maxT) {
    var best = null;
    var cx = Math.cos(ang), cy = Math.sin(ang);
    for (var i = 0; i < world.peds.length; i++) {
      var p = world.peds[i];
      if (p.dead) continue;
      var relx = p.x - x, rely = p.y - y;
      var t = relx * cx + rely * cy;
      if (t <= 0 || t > maxT) continue;
      var perp = Math.abs(-rely * cx + relx * cy);
      if (perp < 11 && (!best || t < best.t)) best = { ped: p, t: t, x: p.x, y: p.y };
    }
    return best;
  }

  function nearestCopOnRay(world, x, y, ang, maxT) {
    var best = null;
    var cx = Math.cos(ang), cy = Math.sin(ang);
    for (var i = 0; i < world.heat.cops.length; i++) {
      var c = world.heat.cops[i];
      var relx = c.x - x, rely = c.y - y;
      var t = relx * cx + rely * cy;
      if (t <= 0 || t > maxT) continue;
      var perp = Math.abs(-rely * cx + relx * cy);
      if (perp < 26 && (!best || t < best.t)) best = { car: c, t: t, x: c.x, y: c.y };
    }
    return best;
  }

  function damagePlayer(pl, amount, world) {
    if (!pl.alive) return;
    if (pl.armor > 0) {
      var soak = Math.min(pl.armor, amount * 0.65);
      pl.armor -= soak;
      amount -= soak;
    }
    pl.health -= amount;
    pl.hurt = 1;
    world.effects.shake(6);
    world.audio.hurt();
    world.stats.damageTaken += amount;
    if (pl.health <= 0) {
      pl.health = 0;
      pl.alive = false;
      world.onWasted();
    }
  }

  function heal(pl, amount) { pl.health = Math.min(C.PLAYER.maxHealth, pl.health + amount); }
  function addArmor(pl, amount) { pl.armor = Math.min(C.PLAYER.maxArmor, pl.armor + amount); }

  /* ---------- pickups ---------- */

  var PICKUP_DEFS = {
    cash: { color: '#7fc98b', label: '+$', radius: 12 },
    health: { color: '#e2574c', label: '+', radius: 12 },
    armor: { color: '#5aa9d6', label: 'A', radius: 12 },
    ammo: { color: '#f2c14e', label: 'AMMO', radius: 11 }
  };

  function makePickup(kind, x, y, amount) {
    return { kind: kind, x: x, y: y, amount: amount || 0, t: 0, taken: false, def: PICKUP_DEFS[kind] };
  }

  function updatePickups(world, dt) {
    var pl = world.player;
    for (var i = 0; i < world.pickups.length; i++) {
      var pk = world.pickups[i];
      pk.t += dt;
      if (pk.taken) continue;
      if (U.dist2(pk.x, pk.y, pl.x, pl.y) < 26 * 26 && !pl.inCar) {
        applyPickup(pk, pl, world);
        pk.taken = true;
        world.audio.pickup();
        world.effects.burst(pk.x, pk.y, 10, pk.def.color, 120);
      }
    }
    // prune
    for (var j = world.pickups.length - 1; j >= 0; j--) {
      if (world.pickups[j].taken) world.pickups.splice(j, 1);
    }
  }

  function applyPickup(pk, pl, world) {
    if (pk.kind === 'cash') { world.money += pk.amount; world.hud.flash('+$' + pk.amount, P.money); }
    else if (pk.kind === 'health') { heal(pl, pk.amount); world.hud.flash('Health +' + Math.round(pk.amount), P.health); }
    else if (pk.kind === 'armor') { addArmor(pl, pk.amount); world.hud.flash('Armor +' + Math.round(pk.amount), P.armor); }
    else if (pk.kind === 'ammo') {
      pl.reserve = Math.min(240, pl.reserve + pk.amount);
      world.hud.flash('Ammo +' + pk.amount, P.gold);
    }
  }

  function drawPickup(ctx, pk, t) {
    var d = pk.def;
    var bob = Math.sin(t * 3 + pk.x * 0.05) * 2.5;
    ctx.save();
    ctx.translate(pk.x, pk.y + bob);
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.beginPath(); ctx.arc(0, 0, d.radius + 5, 0, 6.283); ctx.fill();
    ctx.fillStyle = d.color;
    ctx.beginPath(); ctx.arc(0, 0, d.radius, 0, 6.283); ctx.fill();
    ctx.strokeStyle = 'rgba(30,25,20,0.5)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = '#2a2118';
    ctx.font = 'bold 10px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(d.label, 0, 0.5);
    ctx.restore();
  }

  PC.combat = {
    tryShoot: tryShoot,
    startReload: startReload,
    damagePlayer: damagePlayer,
    heal: heal,
    addArmor: addArmor,
    makePickup: makePickup,
    updatePickups: updatePickups,
    drawPickup: drawPickup,
    rayBuilding: rayBuilding
  };
})(window.PC = window.PC || {});
