/* Palm City — the HUD. Health and armour bars, money, the star row, the live weapon readout, the
   objective banner and a minimap drawn from the very same city data the world uses: blocks as
   blocks, roads as gaps, plus the player arrow, the police as flashing dots, the parking lots and
   the current mission marker. Everything is drawn in screen space over the world. */
(function (PC) {
  'use strict';

  var C = PC.CONFIG, P = PC.PALETTE, U = PC.util;

  function makeHud() {
    return {
      flashText: '', flashColor: '#fff', flashTimer: 0,
      bannerTitle: '', bannerSub: '', bannerTimer: 0,
      objectiveProgress: 0,
      mapShake: 0
    };
  }

  function flash(hud, text, color) {
    hud.flashText = text;
    hud.flashColor = color || '#fff';
    hud.flashTimer = 2.4;
  }

  function banner(hud, title, sub) {
    hud.bannerTitle = title;
    hud.bannerSub = sub || '';
    hud.bannerTimer = 3.2;
  }

  function update(hud, dt) {
    if (hud.flashTimer > 0) hud.flashTimer -= dt;
    if (hud.bannerTimer > 0) hud.bannerTimer -= dt;
  }

  /* ---------- main HUD ---------- */

  function draw(hud, ctx, world, t) {
    var W = C.VW, H = C.VH;
    drawBars(ctx, world, W, H);
    drawMoney(ctx, world, W);
    drawStars(ctx, world, W);
    drawWeapon(ctx, world, W, H);
    drawObjective(ctx, world, W, H);
    drawMinimap(ctx, world, W, H, t);
    drawFlash(ctx, hud, W, H);
    drawBanner(ctx, hud, W, H);
    if (world.player.inCar) drawSpeed(ctx, world, W, H);
  }

  function drawBars(ctx, world, W, H) {
    var pl = world.player;
    var x = 26, y = H - 62;
    ctx.save();
    // plate behind the readouts
    ctx.fillStyle = 'rgba(18,18,22,0.5)';
    U.roundRect(ctx, x - 12, y - 14, 300, 62, 10);
    ctx.fill();

    ctx.font = 'bold 11px "Arial Narrow", Arial, sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillText('HEALTH', x, y + 2);
    bar(ctx, x + 62, y - 4, 200, 10, pl.health / C.PLAYER.maxHealth, P.health);
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillText('ARMOR', x, y + 24);
    bar(ctx, x + 62, y + 18, 200, 10, pl.armor / C.PLAYER.maxArmor, P.armor);
    ctx.restore();
  }

  function bar(ctx, x, y, w, h, frac, color) {
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    U.roundRect(ctx, x, y, w, h, h / 2); ctx.fill();
    if (frac > 0) {
      ctx.fillStyle = color;
      U.roundRect(ctx, x, y, Math.max(h, w * U.clamp(frac, 0, 1)), h, h / 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      U.roundRect(ctx, x + 2, y + 1, Math.max(4, w * U.clamp(frac, 0, 1) - 4), 3, 2); ctx.fill();
    }
  }

  function drawMoney(ctx, world, W) {
    ctx.save();
    ctx.font = 'bold 30px "Trebuchet MS", Arial, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillText('$' + world.money.toLocaleString('en-US'), W - 26, 32);
    ctx.fillStyle = P.money;
    ctx.fillText('$' + world.money.toLocaleString('en-US'), W - 24, 30);
    ctx.font = 'bold 11px Arial, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fillText('PALM CITY BANK', W - 26, 64);
    ctx.restore();
  }

  function drawStars(ctx, world, W) {
    var heat = world.heat;
    var x = W - 24, y = 96;
    ctx.save();
    for (var i = 0; i < 5; i++) {
      drawStar(ctx, x - i * 30, y, 11, i < heat.stars ? (Math.sin(world.time * 6 + i) > 0 ? '#ff4b3e' : '#ff8f6b') : 'rgba(255,255,255,0.16)');
    }
    if (heat.stars > 0 && heat.decay > 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.font = '10px Arial, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText('HEAT', W - 24, y + 26);
    }
    ctx.restore();
  }

  function drawStar(ctx, x, y, r, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    for (var i = 0; i < 10; i++) {
      var rad = i % 2 === 0 ? r : r * 0.45;
      var a = -Math.PI / 2 + i * Math.PI / 5;
      var px = x + Math.cos(a) * rad, py = y + Math.sin(a) * rad;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath(); ctx.fill();
  }

  function drawWeapon(ctx, world, W, H) {
    var pl = world.player;
    if (pl.inCar) return;
    ctx.save();
    ctx.fillStyle = 'rgba(18,18,22,0.5)';
    U.roundRect(ctx, W - 152, H - 62, 128, 44, 9); ctx.fill();
    ctx.font = 'bold 20px "Courier New", monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = pl.ammo > 0 ? '#f4ead2' : '#ff6b5a';
    ctx.fillText(pl.reloading > 0 ? '…' : pl.ammo + ' / ' + pl.reserve, W - 34, H - 34);
    ctx.font = 'bold 10px Arial, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fillText('PISTOL', W - 34, H - 52);
    ctx.restore();
  }

  function drawObjective(ctx, world, W, H) {
    var ms = world.missions;
    var text = PC.missions.objectiveText(ms);
    if (!text) return;
    ctx.save();
    ctx.font = 'bold 13px "Trebuchet MS", Arial, sans-serif';
    var tw = ctx.measureText(text).width;
    var w = Math.min(520, tw + 34);
    ctx.fillStyle = 'rgba(18,18,22,0.55)';
    U.roundRect(ctx, 24, 24, w, 34, 8); ctx.fill();
    ctx.fillStyle = P.accent2;
    ctx.fillRect(24, 24, 4, 34);
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 38, 42);
    if (ms.state === 'active' && ms.job && ms.job.type === 'heist' && ms.safeTimer > 0) {
      bar(ctx, 24, 64, 160, 7, ms.safeTimer / 3, P.gold);
    }
    ctx.restore();
  }

  function drawSpeed(ctx, world, W, H) {
    var car = world.player.inCar;
    var kph = Math.round(Math.abs(car.speed) * 0.42);
    ctx.save();
    ctx.font = 'bold 26px "Trebuchet MS", Arial, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillText(kph, W - 165, H - 70);
    ctx.fillStyle = '#f4ead2';
    ctx.fillText(kph, W - 167, H - 72);
    ctx.font = 'bold 10px Arial, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fillText('KM/H', W - 167, H - 56);
    ctx.restore();
  }

  function drawFlash(ctx, hud, W, H) {
    if (hud.flashTimer <= 0) return;
    var a = Math.min(1, hud.flashTimer * 1.6);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.font = 'bold 15px "Trebuchet MS", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = hud.flashColor;
    ctx.fillText(hud.flashText, W / 2, 100);
    ctx.restore();
  }

  function drawBanner(ctx, hud, W, H) {
    if (hud.bannerTimer <= 0) return;
    var a = Math.min(1, hud.bannerTimer * 1.4);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(16,16,20,0.72)';
    U.roundRect(ctx, W / 2 - 200, H * 0.36, 400, 90, 12); ctx.fill();
    ctx.strokeStyle = P.gold;
    ctx.lineWidth = 2;
    U.roundRect(ctx, W / 2 - 200, H * 0.36, 400, 90, 12); ctx.stroke();
    ctx.textAlign = 'center';
    ctx.fillStyle = P.gold;
    ctx.font = 'bold 26px "Trebuchet MS", Arial, sans-serif';
    ctx.fillText(hud.bannerTitle, W / 2, H * 0.36 + 40);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = 'bold 15px "Trebuchet MS", Arial, sans-serif';
    ctx.fillText(hud.bannerSub, W / 2, H * 0.36 + 68);
    ctx.restore();
  }

  /* ---------- minimap ---------- */

  function drawMinimap(ctx, world, W, H) {
    var size = 168, pad = 24;
    var mx = W - size - pad, my = H - size - pad;
    var radius = size * 0.5;
    var t = world.time;
    var zoom = 0.055;
    ctx.save();
    // circular clip
    ctx.beginPath();
    ctx.arc(mx + radius, my + radius, radius, 0, 6.283);
    ctx.clip();
    ctx.fillStyle = '#1d2329';
    ctx.fillRect(mx, my, size, size);

    ctx.save();
    ctx.translate(mx + radius, my + radius);
    ctx.scale(zoom, zoom);
    ctx.translate(-world.player.x, -world.player.y);

    // beach band
    ctx.fillStyle = '#c9b48d';
    ctx.fillRect(-2000, C.CITY_H - 30, C.CITY_W + 4000, C.BEACH_H);
    ctx.fillStyle = '#2b8fa3';
    ctx.fillRect(-2000, C.CITY_H + C.BEACH_H, C.CITY_W + 4000, 1200);

    // roads: light grid on dark ground
    ctx.fillStyle = '#4a5057';
    for (var i = 0; i <= C.GRID; i++) {
      var p = i * C.CELL;
      ctx.fillRect(p - C.ROAD / 2, 0, C.ROAD, C.CITY_H + C.BEACH_H);
      ctx.fillRect(0, p - C.ROAD / 2, C.CITY_W, C.ROAD);
    }
    // blocks
    for (var b = 0; b < world.city.blocks.length; b++) {
      var blk = world.city.blocks[b];
      ctx.fillStyle = blk.kind === 'park' ? '#4d6b52' : blk.kind === 'downtown' ? '#8d8478' : '#6f6a61';
      ctx.fillRect(blk.x, blk.y, blk.w, blk.h);
    }
    // buildings a shade lighter for the tall ones
    ctx.fillStyle = '#9a9288';
    for (var bd = 0; bd < world.city.buildings.length; bd++) {
      var bu = world.city.buildings[bd];
      if (bu.style === 'tower') ctx.fillRect(bu.x, bu.y, bu.w, bu.h);
    }
    // mission marker
    var m = PC.missions.markerFor(world.missions, world);
    if (m) {
      var pulse = 0.7 + Math.sin(t * 4) * 0.3;
      ctx.fillStyle = m.kind === 'drop' || m.kind === 'npc' ? '#37d3cf' : '#ff6f7d';
      ctx.beginPath();
      ctx.arc(m.x, m.y, 90 * pulse, 0, 6.283);
      ctx.fill();
    }
    // police
    for (var c = 0; c < world.heat.cops.length; c++) {
      var cop = world.heat.cops[c];
      ctx.fillStyle = Math.sin(t * 10 + c) > 0 ? '#ff3b3b' : '#3b7bff';
      ctx.beginPath(); ctx.arc(cop.x, cop.y, 70, 0, 6.283); ctx.fill();
    }
    // traffic dots
    ctx.fillStyle = 'rgba(240,240,230,0.55)';
    for (var tc = 0; tc < world.traffic.length; tc++) {
      var car = world.traffic[tc];
      ctx.fillRect(car.x - 40, car.y - 40, 80, 80);
    }
    ctx.restore();

    // player arrow at the centre
    var pl = world.player;
    var pa = pl.inCar ? pl.inCar.angle : pl.angle;
    ctx.save();
    ctx.translate(mx + radius, my + radius);
    ctx.rotate(pa + Math.PI / 2);
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(0, -8); ctx.lineTo(6, 6); ctx.lineTo(0, 3); ctx.lineTo(-6, 6);
    ctx.closePath(); ctx.fill();
    ctx.restore();

    // frame and a north tick
    ctx.strokeStyle = 'rgba(255,255,255,0.28)';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(mx + radius, my + radius, radius - 1.5, 0, 6.283); ctx.stroke();
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath(); ctx.arc(mx + radius, my + 10, 12, 0, 6.283); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('N', mx + radius, my + 10);
    ctx.restore();
  }

  PC.hud = { make: makeHud, flash: flash, banner: banner, update: update, draw: draw };
})(window.PC = window.PC || {});
