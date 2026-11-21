// hud.js — the screen furniture the player reads while playing: a circular minimap drawn
// live from the city grid and the moving blips, the health/armour bars, the cash counter,
// the wanted stars, the current objective, and short banners for events.
(function () {
  'use strict';
  var PC = window.PC;
  var CFG = PC.CFG;
  var U = PC.U;
  var C = CFG.colors;

  var MAP_R = 104;        // minimap radius on screen
  var MAP_CELL = 0.115;   // world units -> minimap pixels at 1x

  function HUD(world) {
    this.world = world;
    this.flashes = {};
    this.bannerLines = null;
    this.bannerClock = 0;
    this.toasts = [];
    this.wantedPulse = 0;
    this.clock = 0;
  }

  HUD.prototype.flash = function (kind) {
    this.flashes[kind] = 1;
  };

  HUD.prototype.banner = function (title, sub) {
    this.bannerLines = { title: title, sub: sub || '' };
    this.bannerClock = 4.6;
  };

  HUD.prototype.toast = function (text) {
    this.toasts.unshift({ text: text, life: 4.4 });
    if (this.toasts.length > 4) this.toasts.pop();
  };

  HUD.prototype.update = function (dt) {
    this.clock += dt;
    for (var k in this.flashes) {
      if (this.flashes[k] > 0) this.flashes[k] -= dt * 2.2;
    }
    if (this.bannerClock > 0) this.bannerClock -= dt;
    for (var i = this.toasts.length - 1; i >= 0; i--) {
      this.toasts[i].life -= dt;
      if (this.toasts[i].life <= 0) this.toasts.splice(i, 1);
    }
    if (this.world.player.wanted > 0) this.wantedPulse += dt * 3;
  };

  // ---- drawing ---------------------------------------------------------------
  HUD.prototype.draw = function (ctx, w, h) {
    var world = this.world;
    var player = world.player;

    this.drawMinimap(ctx, w, h);
    this.drawStars(ctx, w, h);
    this.drawStatus(ctx, w, h);
    this.drawObjective(ctx, w, h);
    this.drawCash(ctx, w, h);
    this.drawSpeed(ctx, w, h);
    this.drawToasts(ctx, w, h);
    this.drawBanner(ctx, w, h);
    this.drawCrosshair(ctx, w, h);
    void player;
    void C;
  };

  // The minimap is a rotating disc: north is up, the player sits at the centre,
  // streets and buildings are redrawn each frame from the city's own rectangles.
  HUD.prototype.drawMinimap = function (ctx, w, h) {
    var world = this.world;
    var player = world.player;
    var cx = w - MAP_R - 34;
    var cy = h - MAP_R - 34;
    var r = MAP_R;

    ctx.save();
    // plate
    ctx.beginPath();
    ctx.arc(cx, cy, r + 9, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(12,10,18,0.55)';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(247,240,225,0.28)';
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.save();
    ctx.clip();

    // sea first, then the land grid
    ctx.fillStyle = '#0e5b70';
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    ctx.fillStyle = '#1b2230';
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);

    var scale = MAP_CELL * (r / MAP_R);
    var toMap = function (wx, wy) {
      return { x: cx + (wx - player.x) * scale, y: cy + (wy - player.y) * scale };
    };

    // blocks: pavement grey, buildings a lighter slab, parks green, sand tan
    for (var b = 0; b < world.city.blocks.length; b++) {
      var bl = world.city.blocks[b];
      var p = toMap(bl.x, bl.y);
      var pw = bl.w * scale, ph = bl.h * scale;
      if (p.x > cx + r || p.y > cy + r || p.x + pw < cx - r || p.y + ph < cy - r) continue;
      ctx.fillStyle = bl.park ? '#3d6b45' : bl.lot ? '#2b303c' : '#4a4f5e';
      ctx.fillRect(p.x, p.y, pw, ph);
    }
    // roads come from the grid, not from the blocks
    ctx.strokeStyle = '#7c8496';
    ctx.lineWidth = Math.max(1.6, CFG.ROAD * scale);
    ctx.beginPath();
    for (var k = 0; k <= CFG.GRID; k++) {
      var cpos = k * CFG.CELL + CFG.ROAD / 2;
      var a = toMap(cpos, 0), bb = toMap(cpos, CFG.CITY_H);
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(bb.x, bb.y);
      var c2 = toMap(0, cpos), d2 = toMap(CFG.CITY_W, cpos);
      ctx.moveTo(c2.x, c2.y);
      ctx.lineTo(d2.x, d2.y);
    }
    ctx.stroke();

    // beach and sea
    var sand = toMap(CFG.SAND_X, 0);
    ctx.fillStyle = '#c9a878';
    ctx.fillRect(sand.x, cy - r, (CFG.WATER_X - CFG.SAND_X) * scale, r * 2);
    var water = toMap(CFG.WATER_X, 0);
    ctx.fillStyle = '#0e5b70';
    ctx.fillRect(water.x, cy - r, r * 2, r * 2);

    // mission blips
    var mk = world.missions.objectivePos() || (world.missions.state === 'idle' ? world.missions.markerPos() : null);
    if (mk) {
      var mp = toMap(mk.x, mk.y);
      var ddx = mp.x - cx, ddy = mp.y - cy;
      var dd = Math.hypot(ddx, ddy);
      var edge = false;
      if (dd > r - 10) {
        mp.x = cx + (ddx / dd) * (r - 12);
        mp.y = cy + (ddy / dd) * (r - 12);
        edge = true;
      }
      ctx.save();
      ctx.translate(mp.x, mp.y);
      ctx.rotate(Math.PI / 4 + (edge ? 0 : this.clock));
      ctx.fillStyle = world.missions.state === 'active' ? C.markerHot : C.marker;
      ctx.fillRect(-3.4, -3.4, 6.8, 6.8);
      ctx.restore();
    }

    // police cruisers
    for (var pc = 0; pc < world.police.units.length; pc++) {
      var u = world.police.units[pc];
      var ux = u.car ? u.car.x : u.officer ? u.officer.x : null;
      var uy = u.car ? u.car.y : u.officer ? u.officer.y : null;
      if (ux === null) continue;
      var up = toMap(ux, uy);
      if (U.dist(up.x, up.y, cx, cy) > r) continue;
      var blink = Math.sin(this.clock * 14) > 0;
      ctx.fillStyle = blink ? C.sirenRed : C.sirenBlue;
      ctx.beginPath();
      ctx.arc(up.x, up.y, 3.1, 0, 6.283);
      ctx.fill();
    }
    // the runner in a chase
    if (world.runner && world.runner.car) {
      var rp = toMap(world.runner.car.x, world.runner.car.y);
      if (U.dist(rp.x, rp.y, cx, cy) < r) {
        ctx.fillStyle = '#ff8a3d';
        ctx.beginPath();
        ctx.arc(rp.x, rp.y, 3.4, 0, 6.283);
        ctx.fill();
      }
    }

    ctx.restore();

    // player wedge, always centred and pointing where the player faces
    var heading = player.inCar ? player.inCar.angle : player.angle;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(heading + Math.PI / 2);
    ctx.fillStyle = '#8ffbe4';
    ctx.beginPath();
    ctx.moveTo(0, -7.5);
    ctx.lineTo(5.4, 6);
    ctx.lineTo(0, 3);
    ctx.lineTo(-5.4, 6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // north tick and rim
    ctx.fillStyle = 'rgba(247,240,225,0.75)';
    ctx.font = '600 10px ui-sans-serif, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('N', cx, cy - r + 12);

    ctx.restore();

    // district name under the disc
    var district = world.city.districtAt(player.x, player.y);
    ctx.save();
    ctx.font = '600 11px ui-sans-serif, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(247,240,225,0.62)';
    ctx.fillText(district.toUpperCase(), cx, cy + r + 24);
    ctx.restore();
  };

  HUD.prototype.drawStars = function (ctx, w, h) {
    var stars = this.world.player.wanted;
    if (stars <= 0) return;
    var x = 30;
    var y = 92;
    ctx.save();
    for (var k = 0; k < 5; k++) {
      var on = k < stars;
      var pulse = on ? 1 + Math.sin(this.wantedPulse + k) * 0.06 : 1;
      ctx.save();
      ctx.translate(x + k * 26, y);
      ctx.scale(pulse, pulse);
      drawStar(ctx, 0, 0, 11, 5);
      if (on) {
        ctx.fillStyle = C.gold;
        ctx.fill();
        ctx.strokeStyle = 'rgba(90,60,10,0.55)';
        ctx.lineWidth = 1.2;
        ctx.stroke();
      } else {
        ctx.strokeStyle = 'rgba(247,240,225,0.26)';
        ctx.lineWidth = 1.6;
        ctx.stroke();
      }
      ctx.restore();
    }
    ctx.restore();
  };

  function drawStar(ctx, cx, cy, r, _sides) {
    ctx.beginPath();
    for (var i = 0; i < 10; i++) {
      var rad = i % 2 === 0 ? r : r * 0.44;
      var a = -Math.PI / 2 + (i * Math.PI) / 5;
      var px = cx + Math.cos(a) * rad;
      var py = cy + Math.sin(a) * rad;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
  }

  // Health, armour and ammo, top-left, in a smoked panel.
  HUD.prototype.drawStatus = function (ctx, w, h) {
    var player = this.world.player;
    var x = 24, y = 22;
    ctx.save();
    U.roundRect(ctx, x, y, 232, 58, 12);
    ctx.fillStyle = C.hudPanel;
    ctx.fill();
    ctx.strokeStyle = 'rgba(247,240,225,0.12)';
    ctx.lineWidth = 1;
    ctx.stroke();

    bar(ctx, x + 12, y + 13, 208, 10, player.health / player.maxHealth, C.health, this.flashes.health);
    bar(ctx, x + 12, y + 31, 156, 8, player.armour / player.maxArmour, C.armour, this.flashes.armour);

    ctx.font = '600 11px ui-sans-serif, system-ui, sans-serif';
    ctx.fillStyle = C.hudDim;
    ctx.textAlign = 'right';
    ctx.fillText(player.ammo + ' RDS', x + 220, y + 40);
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(247,240,225,0.82)';
    ctx.font = '700 10px ui-sans-serif, system-ui, sans-serif';
    ctx.fillText('HP', x + 12, y + 51);
    ctx.fillStyle = C.hudDim;
    ctx.fillText('ARMOUR', x + 40, y + 51);
    ctx.restore();
  };

  function bar(ctx, x, y, w, h, v, color, flash) {
    v = U.clamp(v, 0, 1);
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    U.roundRect(ctx, x, y, w, h, h / 2);
    ctx.fill();
    if (v > 0) {
      ctx.fillStyle = color;
      U.roundRect(ctx, x, y, Math.max(h, w * v), h, h / 2);
      ctx.fill();
    }
    if (flash && flash > 0) {
      ctx.globalAlpha = U.clamp(flash, 0, 1) * 0.7;
      ctx.fillStyle = '#ffffff';
      U.roundRect(ctx, x, y, Math.max(h, w * v), h, h / 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  HUD.prototype.drawCash = function (ctx, w, h) {
    var player = this.world.player;
    ctx.save();
    ctx.textAlign = 'right';
    ctx.font = '700 27px ui-sans-serif, system-ui, sans-serif';
    ctx.fillStyle = C.cash;
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 6;
    ctx.fillText(U.money(player.cash), w - 32, 54);
    ctx.shadowBlur = 0;
    ctx.font = '600 10px ui-sans-serif, system-ui, sans-serif';
    ctx.fillStyle = C.hudDim;
    ctx.fillText('CASH', w - 32, 68);
    ctx.restore();
  };

  HUD.prototype.drawObjective = function (ctx, w, h) {
    var text = this.world.missions.hudObjective();
    if (!text) return;
    ctx.save();
    ctx.font = '600 12.5px ui-sans-serif, system-ui, sans-serif';
    var tw = ctx.measureText(text).width;
    var x = w / 2 - tw / 2 - 16;
    var y = 22;
    U.roundRect(ctx, x, y, tw + 32, 30, 15);
    ctx.fillStyle = C.hudPanelSoft;
    ctx.fill();
    ctx.fillStyle = C.marker;
    ctx.beginPath();
    ctx.arc(x + 15, y + 15, 3.4, 0, 6.283);
    ctx.fill();
    ctx.fillStyle = C.hudText;
    ctx.textAlign = 'left';
    ctx.fillText(text, x + 25, y + 19.5);
    ctx.restore();
  };

  // Speedometer in a car: an arc from 0 to the model's top speed.
  HUD.prototype.drawSpeed = function (ctx, w, h) {
    var car = this.world.player.inCar;
    if (!car) return;
    var cx = w - MAP_R - 34;
    var cy = h - MAP_R - 34;
    var top = car.model.top;
    var v = U.clamp(car.speed / top, 0, 1);
    var r = MAP_R + 26;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, Math.PI * 1.18, Math.PI * 1.82);
    ctx.lineWidth = 5;
    ctx.strokeStyle = 'rgba(247,240,225,0.18)';
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, r, Math.PI * 1.18, Math.PI * 1.18 + Math.PI * 0.64 * v);
    ctx.lineWidth = 5;
    ctx.strokeStyle = v > 0.85 ? C.danger : C.player;
    ctx.stroke();
    ctx.font = '700 13px ui-sans-serif, system-ui, sans-serif';
    ctx.fillStyle = 'rgba(247,240,225,0.85)';
    ctx.textAlign = 'center';
    ctx.fillText(Math.round(car.speed * 0.19) + ' MP/H', cx, cy - MAP_R - 36);
    ctx.font = '500 10px ui-sans-serif, system-ui, sans-serif';
    ctx.fillStyle = 'rgba(247,240,225,0.5)';
    ctx.fillText(car.model.name.toUpperCase(), cx, cy - MAP_R - 20);
    ctx.restore();
    void h;
  };

  HUD.prototype.drawToasts = function (ctx, w, h) {
    var x = 24;
    var y = h - 40;
    ctx.save();
    ctx.font = '600 12px ui-sans-serif, system-ui, sans-serif';
    ctx.textAlign = 'left';
    for (var k = 0; k < this.toasts.length; k++) {
      var t = this.toasts[k];
      var alpha = U.clamp(t.life, 0, 1);
      ctx.globalAlpha = alpha;
      var tw = ctx.measureText(t.text).width;
      U.roundRect(ctx, x, y - 20, tw + 24, 24, 12);
      ctx.fillStyle = 'rgba(12,10,18,0.62)';
      ctx.fill();
      ctx.fillStyle = C.hudText;
      ctx.fillText(t.text, x + 12, y - 4);
      y -= 30;
    }
    ctx.restore();
  };

  HUD.prototype.drawBanner = function (ctx, w, h) {
    if (!this.bannerLines || this.bannerClock <= 0) return;
    var b = this.bannerLines;
    var a = U.clamp(this.bannerClock / 0.8, 0, 1);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.textAlign = 'center';
    var bandY = h * 0.2;
    var grad = ctx.createLinearGradient(0, bandY - 46, 0, bandY + 62);
    grad.addColorStop(0, 'rgba(12,10,18,0)');
    grad.addColorStop(0.5, 'rgba(12,10,18,0.68)');
    grad.addColorStop(1, 'rgba(12,10,18,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, bandY - 46, w, 108);
    ctx.fillStyle = C.gold;
    ctx.font = '800 30px ui-sans-serif, system-ui, sans-serif';
    ctx.fillText(b.title, w / 2, bandY + 4);
    ctx.fillStyle = 'rgba(247,240,225,0.82)';
    ctx.font = '500 13.5px ui-sans-serif, system-ui, sans-serif';
    wrapText(ctx, b.sub, w / 2, bandY + 30, w * 0.56, 19, 2);
    ctx.restore();
  };

  HUD.prototype.drawCrosshair = function (ctx, w, h) {
    var player = this.world.player;
    if (!this.world.aiming || player.inCar) return;
    var s = 9 + player.recoil * 9;
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(w / 2 - s, h / 2);
    ctx.lineTo(w / 2 - 3, h / 2);
    ctx.moveTo(w / 2 + 3, h / 2);
    ctx.lineTo(w / 2 + s, h / 2);
    ctx.moveTo(w / 2, h / 2 - s);
    ctx.lineTo(w / 2, h / 2 - 3);
    ctx.moveTo(w / 2, h / 2 + 3);
    ctx.lineTo(w / 2, h / 2 + s);
    ctx.stroke();
    ctx.restore();
  };

  function wrapText(ctx, text, cx, y, maxW, lineH, maxLines) {
    if (!text) return;
    var words = String(text).split(' ');
    var line = '';
    var lines = [];
    for (var i = 0; i < words.length; i++) {
      var test = line ? line + ' ' + words[i] : words[i];
      if (ctx.measureText(test).width > maxW && line) {
        lines.push(line);
        line = words[i];
        if (lines.length === maxLines) break;
      } else {
        line = test;
      }
    }
    if (lines.length < maxLines && line) lines.push(line);
    for (var k = 0; k < lines.length; k++) ctx.fillText(lines[k], cx, y + k * lineH);
  }

  HUD.wrapText = wrapText;
  PC.HUD = HUD;
})();
