// render.js — the look of Palm City. A top-down camera with a low sun that extrudes every
// building a little to the south-east, so the city reads as solid without a 3D engine:
// ground (sand, sea, asphalt, pavements, parks, lots), then skid marks, then shadows, then
// the extruded blocks sorted back to front, then cars, people, props, particles and the
// warm evening wash over everything. All of it 2D canvas.
(function () {
  'use strict';
  var PC = window.PC;
  var CFG = PC.CFG;
  var U = PC.U;
  var C = CFG.colors;

  var SUN = { dx: 0.40, dy: 0.30 };   // extrusion direction, in units of building height

  function Renderer(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.dpr = 1;
    this.w = 0;
    this.h = 0;
    this.resize();
  }

  Renderer.prototype.resize = function () {
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    var w = window.innerWidth;
    var h = window.innerHeight;
    this.dpr = dpr;
    this.w = w;
    this.h = h;
    this.canvas.width = Math.floor(w * dpr);
    this.canvas.height = Math.floor(h * dpr);
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
  };

  // ---- camera ---------------------------------------------------------------
  Renderer.prototype.camera = function (world) {
    var player = world.player;
    var fx = world.player.inCar ? player.inCar.x : player.x;
    var fy = world.player.inCar ? player.inCar.y : player.y;
    var cam = world.camera;
    // the camera leans toward where the player is moving or aiming
    var leadX = 0, leadY = 0;
    if (player.inCar && player.inCar.speed > 80) {
      leadX = Math.cos(player.inCar.angle) * CFG.tuning.lookAhead;
      leadY = Math.sin(player.inCar.angle) * CFG.tuning.lookAhead;
    } else if (world.aiming) {
      leadX = Math.cos(player.angle) * 34;
      leadY = Math.sin(player.angle) * 34;
    }
    var tx = fx + leadX;
    var ty = fy + leadY;
    var zoomTarget = player.inCar ? CFG.CAMERA_SCALE - Math.min(0.14, player.inCar.speed / 6000) : CFG.CAMERA_SCALE;
    if (world.shotCam) {
      tx = world.shotCam.x;
      ty = world.shotCam.y;
      zoomTarget = world.shotCam.zoom || CFG.CAMERA_SCALE;
    }
    cam.x = U.damp(cam.x, tx, CFG.tuning.cameraStiffness, 1 / 60);
    cam.y = U.damp(cam.y, ty, CFG.tuning.cameraStiffness, 1 / 60);
    cam.zoom = U.damp(cam.zoom, zoomTarget, 3, 1 / 60);
    // never show the void outside the world
    var viewW = this.w / cam.zoom;
    var viewH = this.h / cam.zoom;
    if (viewW < CFG.WORLD_W) cam.x = U.clamp(cam.x, viewW / 2, CFG.WORLD_W - viewW / 2);
    else cam.x = CFG.WORLD_W / 2;
    if (viewH < CFG.WORLD_H) cam.y = U.clamp(cam.y, viewH / 2, CFG.WORLD_H - viewH / 2);
    else cam.y = CFG.WORLD_H / 2;
    return cam;
  };

  // ---- main draw ------------------------------------------------------------
  Renderer.prototype.draw = function (world) {
    var ctx = this.ctx;
    var w = this.w, h = this.h;
    var cam = this.camera(world);
    var zoom = cam.zoom;

    var shakeX = 0, shakeY = 0;
    if (world.effects.shakeAmount > 0.1) {
      shakeX = (world.rng() - 0.5) * world.effects.shakeAmount;
      shakeY = (world.rng() - 0.5) * world.effects.shakeAmount;
    }

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    var view = {
      x: cam.x - w / (2 * zoom) - 200,
      y: cam.y - h / (2 * zoom) - 200,
      w: w / zoom + 400,
      h: h / zoom + 400,
    };

    // World -> screen helper, closed over the camera.
    var toScreenX = function (wx) { return (wx - cam.x) * zoom + w / 2 + shakeX; };
    var toScreenY = function (wy) { return (wy - cam.y) * zoom + h / 2 + shakeY; };

    ctx.save();
    ctx.translate(w / 2 + shakeX, h / 2 + shakeY);
    ctx.scale(zoom, zoom);
    ctx.translate(-cam.x, -cam.y);

    this.drawSea(ctx, world, view);
    this.drawLand(ctx, world, view);
    this.drawRoads(ctx, world, view);
    this.drawSkids(ctx, world);
    this.drawGroundProps(ctx, world, view);
    this.drawBuildings(ctx, world, view);
    this.drawPalms(ctx, world, view);
    this.drawMarkers(ctx, world, view);
    this.drawCars(ctx, world, view);
    this.drawPeds(ctx, world, view);
    this.drawStreets(ctx, world, view);
    this.drawHostiles(ctx, world, view);
    this.drawPoliceFoot(ctx, world, view);
    this.drawPlayer(ctx, world);
    this.drawAirFX(ctx, world, view);

    ctx.restore();

    // Screen-space light: a warm gradient plus a vignette, cheapest mood in the business.
    this.drawLight(ctx, world, w, h);
    void toScreenX;
    void toScreenY;
  };

  // ---- ground ---------------------------------------------------------------
  Renderer.prototype.drawSea = function (ctx, world, view) {
    var t = world.time;
    // deep field first
    ctx.fillStyle = C.oceanDeep;
    ctx.fillRect(0, 0, CFG.WORLD_W, CFG.WORLD_H);
    // land mass
    ctx.fillStyle = '#26313a';
    ctx.fillRect(0, 0, CFG.WATER_X, CFG.WORLD_H);

    // open water east of the beach: bands that creep with the clock
    var x0 = CFG.WATER_X;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x0, 0, CFG.WORLD_W - x0, CFG.WORLD_H);
    ctx.clip();
    var g = ctx.createLinearGradient(x0, 0, CFG.WORLD_W, 0);
    g.addColorStop(0, C.ocean);
    g.addColorStop(0.45, C.ocean);
    g.addColorStop(1, C.oceanDeep);
    ctx.fillStyle = g;
    ctx.fillRect(x0, 0, CFG.WORLD_W - x0, CFG.WORLD_H);
    // wave crests
    ctx.strokeStyle = 'rgba(219,246,246,0.30)';
    ctx.lineWidth = 2;
    for (var k = 0; k < 26; k++) {
      var wy = ((k * 137 + t * 9) % CFG.WORLD_H);
      var amp = 4 + (k % 3) * 2;
      ctx.beginPath();
      for (var sx = x0; sx < CFG.WORLD_W; sx += 26) {
        var yy = wy + Math.sin((sx + t * 40) / 60) * amp;
        if (sx === x0) ctx.moveTo(sx, yy);
        else ctx.lineTo(sx, yy);
      }
      ctx.stroke();
    }
    ctx.restore();

    // foam along the waterline
    ctx.save();
    ctx.strokeStyle = 'rgba(233,250,249,0.65)';
    ctx.lineWidth = 7;
    ctx.beginPath();
    for (var fy = 0; fy <= CFG.WORLD_H; fy += 24) {
      var fx = CFG.WATER_X + Math.sin(fy / 90 + t * 1.6) * 7 + Math.sin(fy / 31 - t) * 3;
      if (fy === 0) ctx.moveTo(fx, fy);
      else ctx.lineTo(fx, fy);
    }
    ctx.stroke();
    ctx.strokeStyle = 'rgba(233,250,249,0.28)';
    ctx.lineWidth = 14;
    ctx.stroke();
    ctx.restore();
    void view;
  };

  Renderer.prototype.drawLand = function (ctx, world, view) {
    var city = world.city;
    // sand
    ctx.fillStyle = C.sand;
    ctx.fillRect(CFG.SAND_X, 0, CFG.WATER_X - CFG.SAND_X, CFG.WORLD_H);
    // dune ripples
    ctx.save();
    ctx.beginPath();
    ctx.rect(CFG.SAND_X, 0, CFG.WATER_X - CFG.SAND_X, CFG.WORLD_H);
    ctx.clip();
    ctx.strokeStyle = 'rgba(190,155,110,0.30)';
    ctx.lineWidth = 3;
    for (var y = 0; y < CFG.WORLD_H; y += 46) {
      ctx.beginPath();
      for (var x = CFG.SAND_X; x < CFG.WATER_X; x += 30) {
        var yy = y + Math.sin(x / 54 + y / 70) * 7;
        if (x === CFG.SAND_X) ctx.moveTo(x, yy);
        else ctx.lineTo(x, yy);
      }
      ctx.stroke();
    }
    ctx.restore();

    // the boardwalk along the beach
    ctx.fillStyle = '#8a6f52';
    ctx.fillRect(city.boardwalk.x, 0, city.boardwalk.w, CFG.WORLD_H);
    ctx.strokeStyle = 'rgba(0,0,0,0.13)';
    ctx.lineWidth = 1.5;
    for (var by = 0; by < CFG.WORLD_H; by += 22) {
      ctx.beginPath();
      ctx.moveTo(city.boardwalk.x, by);
      ctx.lineTo(city.boardwalk.x + city.boardwalk.w, by);
      ctx.stroke();
    }

    // the city: blocks and their pavements
    for (var k = 0; k < city.blocks.length; k++) {
      var b = city.blocks[k];
      if (b.x > view.x + view.w || b.y > view.y + view.h || b.x + b.w < view.x || b.y + b.h < view.y) continue;
      // pavement ring
      ctx.fillStyle = b.park ? C.grass : b.lot ? C.asphaltAlt : C.sidewalk;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      if (b.park) {
        ctx.fillStyle = C.grassAlt;
        ctx.fillRect(b.x, b.y, b.w, b.h * 0.5);
      }
      // kerb line
      ctx.strokeStyle = 'rgba(0,0,0,0.18)';
      ctx.lineWidth = 3;
      ctx.strokeRect(b.x + 1.5, b.y + 1.5, b.w - 3, b.h - 3);
      // pavement tiles
      ctx.strokeStyle = b.park || b.lot ? 'rgba(0,0,0,0.06)' : 'rgba(0,0,0,0.10)';
      ctx.lineWidth = 1.2;
      for (var tx = b.x; tx < b.x + b.w; tx += 34) {
        ctx.beginPath();
        ctx.moveTo(tx, b.y);
        ctx.lineTo(tx, b.y + b.h);
        ctx.stroke();
      }
      for (var ty = b.y; ty < b.y + b.h; ty += 34) {
        ctx.beginPath();
        ctx.moveTo(b.x, ty);
        ctx.lineTo(b.x + b.w, ty);
        ctx.stroke();
      }
    }
  };

  Renderer.prototype.drawRoads = function (ctx, world, view) {
    var t = world.time;
    // asphalt
    ctx.fillStyle = C.asphalt;
    for (var k = 0; k <= CFG.GRID; k++) {
      var c = k * CFG.CELL;
      ctx.fillRect(c, 0, CFG.ROAD, CFG.WORLD_H);
      ctx.fillRect(0, c, CFG.CITY_W, CFG.ROAD);
    }
    // intersections get the lighter tone so crossroads read at a glance
    ctx.fillStyle = C.asphaltAlt;
    for (var i = 0; i <= CFG.GRID; i++) {
      for (var j = 0; j <= CFG.GRID; j++) {
        ctx.fillRect(i * CFG.CELL, j * CFG.CELL, CFG.ROAD, CFG.ROAD);
      }
    }

    // centre dashes
    ctx.strokeStyle = C.roadLineDim;
    ctx.lineWidth = 4;
    ctx.setLineDash([26, 26]);
    ctx.lineDashOffset = -t * 8;
    for (var m = 0; m <= CFG.GRID; m++) {
      var cc = m * CFG.CELL + CFG.ROAD / 2;
      ctx.beginPath();
      ctx.moveTo(cc, 0);
      ctx.lineTo(cc, CFG.WORLD_H);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, cc);
      ctx.lineTo(CFG.CITY_W, cc);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // kerb-side white lines
    ctx.strokeStyle = 'rgba(239,227,198,0.20)';
    ctx.lineWidth = 2.5;
    for (var n = 0; n <= CFG.GRID; n++) {
      var q = n * CFG.CELL;
      ctx.strokeRect(q + 8, 0, CFG.ROAD - 16, CFG.WORLD_H);
      ctx.strokeRect(0, q + 8, CFG.CITY_W, CFG.ROAD - 16);
    }

    // crosswalks at every junction
    ctx.fillStyle = C.crosswalk;
    for (var a = 0; a <= CFG.GRID; a++) {
      for (var b = 0; b <= CFG.GRID; b++) {
        var x = a * CFG.CELL, y = b * CFG.CELL;
        for (var s = 0; s < 6; s++) {
          ctx.fillRect(x + 12 + s * 16, y - 16, 9, 16);
          ctx.fillRect(x + 12 + s * 16, y + CFG.ROAD, 9, 16);
          ctx.fillRect(x - 16, y + 12 + s * 16, 16, 9);
          ctx.fillRect(x + CFG.ROAD, y + 12 + s * 16, 16, 9);
        }
      }
    }
    void view;
  };

  Renderer.prototype.drawSkids = function (ctx, world) {
    var skids = world.effects.skids;
    if (!skids.length) return;
    ctx.save();
    ctx.strokeStyle = 'rgba(22,20,26,0.30)';
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    for (var k = 0; k < skids.length; k++) {
      var s = skids[k];
      if (s.life < 1 && (k % 2)) continue;
      ctx.globalAlpha = U.clamp(s.life / 6.5, 0, 1) * 0.8;
      var dx = Math.cos(s.angle) * 12, dy = Math.sin(s.angle) * 12;
      ctx.beginPath();
      ctx.moveTo(s.x - dx, s.y - dy);
      ctx.lineTo(s.x + dx, s.y + dy);
      ctx.stroke();
    }
    ctx.restore();
  };

  // Flat props drawn before the buildings: lawns, lots, pools, piers.
  Renderer.prototype.drawGroundProps = function (ctx, world, view) {
    var props = world.city.props;
    for (var k = 0; k < props.length; k++) {
      var p = props[k];
      if (p.x > view.x + view.w || p.y > view.y + view.h) continue;
      if (p.type === 'asphalt') {
        ctx.fillStyle = 'rgba(58,62,73,0.92)';
        ctx.fillRect(p.x, p.y, p.w, p.h);
        ctx.strokeStyle = 'rgba(239,227,198,0.35)';
        ctx.lineWidth = 3;
        // bay stripes
        for (var sx = p.x + 20; sx < p.x + p.w; sx += 62) {
          ctx.beginPath();
          ctx.moveTo(sx, p.y + 8);
          ctx.lineTo(sx, p.y + p.h - 8);
          ctx.stroke();
        }
      } else if (p.type === 'lawn') {
        ctx.fillStyle = C.grass;
        U.roundRect(ctx, p.x, p.y, p.w, p.h, 16);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.05)';
        for (var i = 0; i < 5; i++) {
          ctx.fillRect(p.x + 20 + i * (p.w / 5), p.y + 20, 3, p.h - 40);
        }
      } else if (p.type === 'poolDeck') {
        ctx.fillStyle = '#cbb894';
        ctx.fillRect(p.x, p.y, p.w, p.h);
      } else if (p.type === 'pool') {
        ctx.fillStyle = '#3ec6d0';
        U.roundRect(ctx, p.x, p.y, p.w, p.h, 12);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.28)';
        ctx.fillRect(p.x + 10, p.y + 12, p.w - 20, 3);
        ctx.fillRect(p.x + 18, p.y + 28, p.w - 50, 2);
      } else if (p.type === 'stall') {
        ctx.fillStyle = 'rgba(30,26,24,0.16)';
        U.roundRect(ctx, p.x + 7, p.y + 9, 60, 38, 5);
        ctx.fill();
        ctx.fillStyle = '#e7dac0';
        ctx.fillRect(p.x, p.y, 60, 38);
        ctx.fillStyle = CFG.colors.neon[1];
        for (var st = 0; st < 5; st++) ctx.fillRect(p.x + st * 12, p.y, 12, 8);
        ctx.fillStyle = '#8a6f52';
        ctx.fillRect(p.x - 3, p.y + 34, 66, 5);
        ctx.fillStyle = '#c2703f';
        for (var cr = 0; cr < 3; cr++) ctx.fillRect(p.x + 10 + cr * 16, p.y + 18, 9, 9);
      } else if (p.type === 'bench') {
        ctx.fillStyle = 'rgba(40,30,20,0.18)';
        U.roundRect(ctx, p.x + 4, p.y + 6, 46, 16, 4);
        ctx.fill();
        ctx.fillStyle = '#8a6f52';
        U.roundRect(ctx, p.x, p.y, 46, 14, 3);
        ctx.fill();
        ctx.fillStyle = '#c8b48d';
        ctx.fillRect(p.x + 4, p.y + 10, 38, 4);
      } else if (p.type === 'lamp') {
        ctx.fillStyle = 'rgba(30,26,24,0.20)';
        ctx.beginPath();
        ctx.ellipse(p.x + 8, p.y + 9, 11, 5, 0, 0, 6.283);
        ctx.fill();
        ctx.fillStyle = '#3c3f4a';
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4, 0, 6.283);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,216,150,0.30)';
        ctx.beginPath();
        ctx.arc(p.x, p.y, 17, 0, 6.283);
        ctx.fill();
      } else if (p.type === 'bin') {
        ctx.fillStyle = 'rgba(30,26,24,0.18)';
        ctx.beginPath();
        ctx.ellipse(p.x + 3, p.y + 4, 8, 7, 0, 0, 6.283);
        ctx.fill();
        ctx.fillStyle = '#4a5150';
        ctx.beginPath();
        ctx.arc(p.x, p.y, 7, 0, 6.283);
        ctx.fill();
        ctx.fillStyle = '#2f3636';
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4.4, 0, 6.283);
        ctx.fill();
      } else if (p.type === 'hydrant') {
        ctx.fillStyle = 'rgba(30,26,24,0.16)';
        ctx.beginPath();
        ctx.ellipse(p.x + 3, p.y + 4, 6, 4, 0, 0, 6.283);
        ctx.fill();
        ctx.fillStyle = '#c14b3a';
        ctx.beginPath();
        ctx.arc(p.x, p.y, 6, 0, 6.283);
        ctx.fill();
        ctx.fillStyle = '#e2684f';
        ctx.fillRect(p.x - 8, p.y - 2, 16, 4);
      } else if (p.type === 'umbrella') {
        var uc = p.color || CFG.colors.neon[0];
        ctx.fillStyle = 'rgba(40,30,20,0.20)';
        ctx.beginPath();
        ctx.ellipse(p.x + 10, p.y + 12, 30, 26, 0, 0, 6.283);
        ctx.fill();
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot || 0);
        ctx.fillStyle = uc;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, 27, 0, 6.283);
        ctx.fill();
        ctx.fillStyle = '#f4ead4';
        for (var seg = 0; seg < 6; seg++) {
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.arc(0, 0, 27, (seg / 6) * 6.283, (seg / 6) * 6.283 + 0.24);
          ctx.fill();
        }
        ctx.fillStyle = '#6b4a33';
        ctx.beginPath();
        ctx.arc(0, 0, 3.4, 0, 6.283);
        ctx.fill();
        ctx.restore();
      } else if (p.type === 'lounger') {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot || 0);
        ctx.fillStyle = 'rgba(40,30,20,0.18)';
        U.roundRect(ctx, 4, 6, 42, 20, 4);
        ctx.fill();
        ctx.fillStyle = '#f0e4cb';
        U.roundRect(ctx, 0, 0, 40, 18, 3);
        ctx.fill();
        ctx.fillStyle = '#e2684f';
        U.roundRect(ctx, 0, 0, 40, 6, 3);
        ctx.fill();
        ctx.restore();
      } else if (p.type === 'boat') {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot || 0);
        ctx.fillStyle = 'rgba(20,40,50,0.22)';
        ctx.beginPath();
        ctx.ellipse(2, 5, 34, 14, 0, 0, 6.283);
        ctx.fill();
        ctx.fillStyle = '#f2e8d6';
        ctx.beginPath();
        ctx.ellipse(0, 0, 32, 13, 0, 0, 6.283);
        ctx.fill();
        ctx.fillStyle = '#2f9e96';
        ctx.beginPath();
        ctx.ellipse(0, 0, 24, 8, 0, 0, 6.283);
        ctx.fill();
        ctx.restore();
      } else if (p.type === 'fountain') {
        ctx.fillStyle = '#b9b1a2';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, 6.283);
        ctx.fill();
        ctx.fillStyle = '#4bb8c9';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * 0.72, 0, 6.283);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.beginPath();
        ctx.arc(p.x - 6, p.y - 6, p.r * 0.3, 0, 6.283);
        ctx.fill();
      }
    }
    // long palm shadows across the ground
    var palms = world.city.palms;
    ctx.save();
    ctx.fillStyle = 'rgba(70,52,36,0.11)';
    for (var pi = 0; pi < palms.length; pi++) {
      var pm = palms[pi];
      if (pm.x > view.x + view.w + 160 || pm.x < view.x - 160) continue;
      if (pm.y > view.y + view.h + 160 || pm.y < view.y - 160) continue;
      var pcx = pm.x + 40 * pm.s;
      var pcy = pm.y + 30 * pm.s;
      ctx.save();
      ctx.translate(pcx, pcy);
      ctx.rotate(pm.rot);
      ctx.beginPath();
      ctx.ellipse(0, 0, 30 * pm.s, 11 * pm.s, pm.rot * 0.6, 0, 6.283);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();

    // the pier
    var pier = world.city.pier;
    if (pier) {
      ctx.fillStyle = '#7a6046';
      ctx.fillRect(pier.x, pier.y, pier.w, pier.h);
      ctx.strokeStyle = 'rgba(0,0,0,0.18)';
      ctx.lineWidth = 1.5;
      for (var px = pier.x; px < pier.x + pier.w; px += 18) {
        ctx.beginPath();
        ctx.moveTo(px, pier.y);
        ctx.lineTo(px, pier.y + pier.h);
        ctx.stroke();
      }
      for (var post = 0; post <= 4; post++) {
        ctx.fillStyle = '#5b462f';
        ctx.fillRect(pier.x + post * (pier.w / 4) - 5, pier.y + pier.h - 8, 10, 14);
        ctx.fillRect(pier.x + post * (pier.w / 4) - 5, pier.y - 6, 10, 14);
      }
    }
  };

  // Buildings, extruded toward the sun's opposite and drawn back to front.
  Renderer.prototype.drawBuildings = function (ctx, world, view) {
    var city = world.city;
    var list = [];
    for (var k = 0; k < city.buildings.length; k++) {
      var b = city.buildings[k];
      if (b.x > view.x + view.w + 400 || b.y > view.y + view.h + 400) continue;
      if (b.x + b.w < view.x - 400 || b.y + b.h < view.y - 400) continue;
      list.push(b);
    }
    list.sort(function (a, b) { return a.y + a.h - (b.y + b.h); });

    for (var i = 0; i < list.length; i++) {
      var bl = list[i];
      this.drawBuilding(ctx, bl, world);
    }
  };

  Renderer.prototype.drawBuilding = function (ctx, b, world) {
    var hgt = b.hgt;
    var ox = hgt * SUN.dx;
    var oy = hgt * SUN.dy;
    // ground shadow, soft and long
    ctx.save();
    ctx.globalAlpha = 0.28;
    ctx.fillStyle = '#0d0b12';
    ctx.beginPath();
    ctx.moveTo(b.x + 6, b.y + b.h);
    ctx.lineTo(b.x + b.w + ox * 0.9, b.y + oy * 0.6);
    ctx.lineTo(b.x + b.w + ox, b.y + b.h + oy);
    ctx.lineTo(b.x + ox * 0.2, b.y + b.h + oy * 0.2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // the two visible walls (south and east) - darker sides catch less sun
    ctx.fillStyle = U.shade(b.color, -78);
    ctx.beginPath();
    ctx.moveTo(b.x, b.y + b.h);
    ctx.lineTo(b.x + b.w, b.y + b.h);
    ctx.lineTo(b.x + b.w + ox, b.y + b.h + oy);
    ctx.lineTo(b.x + ox, b.y + b.h + oy);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = U.shade(b.color, -46);
    ctx.beginPath();
    ctx.moveTo(b.x + b.w, b.y);
    ctx.lineTo(b.x + b.w, b.y + b.h);
    ctx.lineTo(b.x + b.w + ox, b.y + b.h + oy);
    ctx.lineTo(b.x + b.w + ox, b.y + oy);
    ctx.closePath();
    ctx.fill();

    // windows on the south wall: lit ones are the city's own light source
    if (b.floors > 0) {
      var rows = Math.max(1, Math.floor(b.floors * 1.8));
      var cols = Math.max(2, Math.floor(b.w / 26));
      var ww = (b.w - 16) / cols;
      var wh = (hgt * 0.42) / rows;
      var seed = b.windowSeed;
      for (var r = 0; r < rows; r++) {
        for (var c = 0; c < cols; c++) {
          var lit = pseudo(seed, r * 31 + c) < b.lit * 0.55;
          ctx.fillStyle = lit ? C.windowLit : 'rgba(24,30,40,0.62)';
          ctx.fillRect(
            b.x + 8 + c * ww + ww * 0.18,
            b.y + b.h - 6 + oy * 0.55 - (r + 1) * wh,
            ww * 0.62,
            wh * 0.56
          );
        }
      }
    }

    // roof slab, lifted by the extrusion
    ctx.fillStyle = b.roof;
    ctx.fillRect(b.x + ox, b.y + oy, b.w, b.h);
    // roof trim catches the light
    ctx.strokeStyle = 'rgba(255,240,214,0.24)';
    ctx.lineWidth = 1.6;
    ctx.strokeRect(b.x + ox + 0.8, b.y + oy + 0.8, b.w - 1.6, b.h - 1.6);
    // parapet
    ctx.strokeStyle = 'rgba(0,0,0,0.20)';
    ctx.lineWidth = 3;
    ctx.strokeRect(b.x + ox + 5, b.y + oy + 5, b.w - 10, b.h - 10);

    // roof clutter: AC units and a water tank
    for (var a = 0; a < b.ac.length; a++) {
      var u = b.ac[a];
      ctx.fillStyle = 'rgba(180,180,186,0.85)';
      ctx.fillRect(b.x + ox + u.x * b.w, b.y + oy + u.y * b.h, u.s, u.s * 0.8);
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.fillRect(b.x + ox + u.x * b.w, b.y + oy + u.y * b.h + u.s * 0.8, u.s, u.s * 0.22);
    }
    if (b.kind === 'office') {
      ctx.fillStyle = 'rgba(90,86,96,0.9)';
      ctx.beginPath();
      ctx.arc(b.x + ox + b.w * 0.72, b.y + oy + b.h * 0.3, 10, 0, 6.283);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.16)';
      ctx.beginPath();
      ctx.arc(b.x + ox + b.w * 0.72 - 3, b.y + oy + b.h * 0.3 - 3, 4, 0, 6.283);
      ctx.fill();
    }
    if (b.antenna) {
      ctx.strokeStyle = 'rgba(40,38,44,0.9)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(b.x + ox + b.w * 0.3, b.y + oy + b.h * 0.4);
      ctx.lineTo(b.x + ox + b.w * 0.3, b.y + oy + b.h * 0.4 - 26);
      ctx.stroke();
      ctx.fillStyle = '#ff5566';
      ctx.beginPath();
      ctx.arc(b.x + ox + b.w * 0.3, b.y + oy + b.h * 0.4 - 27, 2.4, 0, 6.283);
      ctx.fill();
    }

    // an awning over a shopfront
    if (b.awning) {
      ctx.fillStyle = b.awningColor;
      ctx.globalAlpha = 0.9;
      ctx.fillRect(b.x + ox, b.y + b.h + oy - 4, b.w, 9);
      ctx.globalAlpha = 1;
    }

    // the neon sign, drawn on the south wall face so it reads from the street
    if (b.sign) {
      this.drawSign(ctx, b, ox, oy, world);
    }
  };

  Renderer.prototype.drawSign = function (ctx, b, ox, oy, world) {
    var text = b.sign.toUpperCase();
    var pulse = 0.72 + Math.sin(world.time * 2.2 + b.windowSeed) * 0.16;
    var fontSize = Math.max(8, Math.min(15, b.w / (text.length * 0.62)));
    ctx.save();
    ctx.font = '800 ' + fontSize + 'px ui-sans-serif, system-ui, sans-serif';
    ctx.textAlign = 'center';
    var cx = b.x + b.w / 2 + ox * 0.5;
    var cy = b.y + b.h + oy * 0.5 - 10;
    // the box the sign sits in
    var tw = ctx.measureText(text).width;
    ctx.fillStyle = 'rgba(14,12,18,0.82)';
    U.roundRect(ctx, cx - tw / 2 - 6, cy - fontSize - 2, tw + 12, fontSize + 8, 4);
    ctx.fill();
    ctx.globalAlpha = pulse;
    ctx.fillStyle = neonFor(b);
    ctx.shadowColor = neonFor(b);
    ctx.shadowBlur = 10;
    ctx.fillText(text, cx, cy);
    ctx.restore();
  };

  function neonFor(b) {
    var n = C.neon;
    return n[b.windowSeed % n.length];
  }

  // deterministic 0..1 from two ints, for window lights
  function pseudo(a, b) {
    var x = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453;
    return x - Math.floor(x);
  }

  // ---- mission markers -------------------------------------------------------
  // Palms: a leaning trunk and a fan of fronds, drawn tall so they overhang the pavement.
  Renderer.prototype.drawPalms = function (ctx, world, view) {
    var list = world.city.palms;
    var t = world.time;
    for (var k = 0; k < list.length; k++) {
      var p = list[k];
      if (p.x > view.x + view.w + 160 || p.x < view.x - 160) continue;
      if (p.y > view.y + view.h + 160 || p.y < view.y - 160) continue;
      var s = p.s || 1;
      var sway = Math.sin(t * 1.1 + p.rot * 3) * 2.4;
      var topX = p.x + 26 * s + sway;
      var topY = p.y - 62 * s;
      // trunk, seen from above as a short curved stroke toward the canopy
      ctx.strokeStyle = C.palmTrunk;
      ctx.lineWidth = 7 * s;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.quadraticCurveTo(p.x + 8 * s, p.y - 34 * s, topX, topY);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,225,180,0.20)';
      ctx.lineWidth = 2.4 * s;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.quadraticCurveTo(p.x + 8 * s, p.y - 34 * s, topX, topY);
      ctx.stroke();
      // fronds
      ctx.save();
      ctx.translate(topX, topY);
      ctx.rotate(p.rot + sway * 0.02);
      for (var f = 0; f < 7; f++) {
        var a = (f / 7) * 6.283 + 0.35;
        var len = (30 + (f % 3) * 6) * s;
        ctx.fillStyle = f % 2 ? C.palm : C.palmHi;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(Math.cos(a - 0.4) * len * 0.7, Math.sin(a - 0.4) * len * 0.7,
          Math.cos(a) * len, Math.sin(a) * len);
        ctx.quadraticCurveTo(Math.cos(a + 0.35) * len * 0.72, Math.sin(a + 0.35) * len * 0.72, 0, 0);
        ctx.fill();
      }
      ctx.fillStyle = 'rgba(20,40,24,0.55)';
      ctx.beginPath();
      ctx.arc(0, 0, 4.6 * s, 0, 6.283);
      ctx.fill();
      ctx.restore();
    }
  };

  Renderer.prototype.drawMarkers = function (ctx, world, view) {
    var missions = world.missions;
    var mk = missions.markerPos();
    if (mk && missions.state !== 'active') {
      drawMarker(ctx, mk.x, mk.y, world.time, C.marker, 1);
    }
    if (missions.state === 'active') {
      var obj = missions.objectivePos();
      if (obj) drawMarker(ctx, obj.x, obj.y, world.time, C.markerHot, 1.3);
    }
    void view;
  };

  function drawMarker(ctx, x, y, t, color, scale) {
    var pulse = (Math.sin(t * 2.6) + 1) / 2;
    ctx.save();
    ctx.translate(x, y);
    // a soft column of light on the ground
    var g = ctx.createRadialGradient(0, 0, 4, 0, 0, 54 * scale);
    g.addColorStop(0, 'rgba(255,209,102,0.34)');
    g.addColorStop(1, 'rgba(255,209,102,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, 54 * scale, 0, 6.283);
    ctx.fill();
    // bouncing diamond
    var lift = -18 - pulse * 10;
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, lift - 10);
    ctx.lineTo(7, lift);
    ctx.lineTo(0, lift + 10);
    ctx.lineTo(-7, lift);
    ctx.closePath();
    ctx.fill();
    // ground ring
    ctx.globalAlpha = 0.55 + pulse * 0.3;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.ellipse(0, 6, 22 + pulse * 6, 8 + pulse * 2, 0, 0, 6.283);
    ctx.stroke();
    ctx.restore();
  }

  // ---- actors ---------------------------------------------------------------
  Renderer.prototype.drawCars = function (ctx, world, view) {
    var list = world.cars.list;
    for (var k = 0; k < list.length; k++) {
      var car = list[k];
      if (car.x < view.x - 120 || car.x > view.x + view.w + 120) continue;
      if (car.y < view.y - 120 || car.y > view.y + view.h + 120) continue;
      this.drawCar(ctx, car, world);
    }
  };

  Renderer.prototype.drawCar = function (ctx, car, world) {
    var L = car.len, W = car.wid;
    ctx.save();
    ctx.translate(car.x, car.y);
    // shadow
    ctx.save();
    ctx.rotate(car.angle);
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = '#0b0910';
    U.roundRect(ctx, -L / 2 + 3, -W / 2 + 5, L, W, 8);
    ctx.fill();
    ctx.restore();

    ctx.rotate(car.angle);
    // headlight spill: the car someone is driving is the one with its lights on
    if (car.driver === 'player' && car.speed > 8) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      var lg = ctx.createLinearGradient(L / 2, 0, L / 2 + 210, 0);
      lg.addColorStop(0, 'rgba(255,226,168,0.34)');
      lg.addColorStop(1, 'rgba(255,226,168,0)');
      ctx.fillStyle = lg;
      ctx.beginPath();
      ctx.moveTo(L / 2 - 6, -W / 2 + 6);
      ctx.lineTo(L / 2 + 210, -W / 2 - 44);
      ctx.lineTo(L / 2 + 210, W / 2 + 44);
      ctx.lineTo(L / 2 - 6, W / 2 - 6);
      ctx.closePath();
      ctx.fill();
      // speed streaks trailing off the tail — the cheapest way to say "moving fast"
      ctx.strokeStyle = 'rgba(255,244,214,0.20)';
      ctx.lineWidth = 2;
      for (var sk = 0; sk < 3; sk++) {
        var off = (sk - 1) * (W * 0.30);
        ctx.beginPath();
        ctx.moveTo(-L / 2 - 10, off);
        ctx.lineTo(-L / 2 - 58 - sk * 16, off * 1.6);
        ctx.stroke();
      }
      ctx.restore();
    }
    // body
    var body = car.paint;
    ctx.fillStyle = car.health < car.maxHealth * 0.4 ? U.shade(body, -18) : body;
    U.roundRect(ctx, -L / 2, -W / 2, L, W, 9);
    ctx.fill();
    // a highlight along the roof edge
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    U.roundRect(ctx, -L / 2 + 5, -W / 2 + 4, L - 10, 5, 3);
    ctx.fill();
    // roof / cabin
    ctx.fillStyle = U.shade(body, -34);
    U.roundRect(ctx, -L * 0.12, -W / 2 + 5, L * 0.4, W - 10, 5);
    ctx.fill();
    // windscreen
    ctx.fillStyle = 'rgba(150,214,232,0.55)';
    U.roundRect(ctx, L * 0.16, -W / 2 + 7, 8, W - 14, 3);
    ctx.fill();
    ctx.fillStyle = 'rgba(150,214,232,0.4)';
    U.roundRect(ctx, -L * 0.30, -W / 2 + 7, 6, W - 14, 3);
    ctx.fill();
    // headlights and tail lights
    ctx.fillStyle = '#ffe9b8';
    ctx.fillRect(L / 2 - 4, -W / 2 + 7, 3, 7);
    ctx.fillRect(L / 2 - 4, W / 2 - 14, 3, 7);
    ctx.fillStyle = car.brakeLight > 0.2 ? '#ff5a5a' : 'rgba(180,60,60,0.75)';
    ctx.fillRect(-L / 2 + 1, -W / 2 + 7, 3, 7);
    ctx.fillRect(-L / 2 + 1, W / 2 - 14, 3, 7);
    // wheels
    ctx.fillStyle = '#1c1a20';
    var wx = L * 0.28, wy = W / 2;
    ctx.fillRect(-wx - 6, -wy - 3, 13, 6);
    ctx.fillRect(wx - 7, -wy - 3, 13, 6);
    ctx.fillRect(-wx - 6, wy - 3, 13, 6);
    ctx.fillRect(wx - 7, wy - 3, 13, 6);
    // dented panels
    if (car.dent > 0.1) {
      ctx.fillStyle = 'rgba(20,18,24,' + Math.min(0.5, car.dent) + ')';
      ctx.fillRect(-L * 0.3, -W * 0.3, L * 0.24, W * 0.24);
    }
    ctx.restore();

    // a soft ring under the car you are driving, matching the on-foot ring
    if (car.driver === 'player') {
      ctx.save();
      ctx.translate(car.x, car.y);
      ctx.rotate(car.angle);
      ctx.strokeStyle = 'rgba(70,224,193,0.34)';
      ctx.lineWidth = 2;
      U.roundRect(ctx, -L / 2 - 7, -W / 2 - 7, L + 14, W + 14, 12);
      ctx.stroke();
      ctx.restore();
    }

    // police livery: blue half-doors, a crest on the rear quarter and a light bar that
    // actually flashes red and blue. Drawn in the car's frame so it stays put.
    if (car.driver === 'police') {
      var blink = Math.sin(world.time * 13) > 0;
      var beam = Math.sin(world.time * 13);
      ctx.save();
      ctx.translate(car.x, car.y);
      ctx.rotate(car.angle);

      // door panels
      ctx.fillStyle = '#243755';
      U.roundRect(ctx, -L * 0.16, -W / 2 + 1, L * 0.34, 9, 2);
      ctx.fill();
      U.roundRect(ctx, -L * 0.16, W / 2 - 10, L * 0.34, 9, 2);
      ctx.fill();
      // a cream stripe along the flanks so the shape reads as a cruiser, not a white box
      ctx.fillStyle = 'rgba(247,240,225,0.85)';
      ctx.fillRect(-L * 0.42, -W / 2 + 10, L * 0.30, 3);
      ctx.fillRect(-L * 0.42, W / 2 - 13, L * 0.30, 3);

      // light bar, straddling the roof
      ctx.fillStyle = '#1b1f2a';
      U.roundRect(ctx, -7, -W / 2 + 4, 16, W - 8, 3);
      ctx.fill();
      ctx.fillStyle = blink ? C.sirenRed : '#5c1f2a';
      ctx.fillRect(-6, -W / 2 + 6, 7, W - 12);
      ctx.fillStyle = blink ? '#20365e' : '#4fa8ff';
      ctx.fillRect(3, -W / 2 + 6, 7, W - 12);
      ctx.restore();

      // the splash of light on the road, swinging with the bar
      var on = Math.abs(beam) > 0.35;
      var glowCol = beam > 0 ? '255,59,78' : '63,139,255';
      if (on) {
        ctx.globalCompositeOperation = 'lighter';
        var grad = ctx.createRadialGradient(car.x, car.y, 6, car.x, car.y, 96);
        grad.addColorStop(0, 'rgba(' + glowCol + ',0.16)');
        grad.addColorStop(1, 'rgba(' + glowCol + ',0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(car.x, car.y, 96, 0, 6.283);
        ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
      }
    }
  };

  Renderer.prototype.drawPeds = function (ctx, world, view) {
    var list = world.peds.list;
    for (var k = 0; k < list.length; k++) {
      var p = list[k];
      if (p.x < view.x || p.x > view.x + view.w || p.y < view.y || p.y > view.y + view.h) continue;
      this.drawPerson(ctx, p.x, p.y, p.angle, p.stride, p.color, p.scale, p.alive, p.hitFlash, false);
    }
  };

  Renderer.prototype.drawStreets = function (ctx, world, view) {
    world.streets.draw(ctx, world, view);
  };

  // Mission crews: dark clothes, a red pip overhead, a drawn pistol.
  Renderer.prototype.drawHostiles = function (ctx, world, view) {
    for (var k = 0; k < world.hostiles.length; k++) {
      var h = world.hostiles[k];
      if (h.x < view.x || h.x > view.x + view.w || h.y < view.y || h.y > view.y + view.h) continue;
      if (!h.alive) {
        this.drawPerson(ctx, h.x, h.y, h.angle, 0, '#3a2f33', 1.05, false, 0, false);
        continue;
      }
      this.drawPerson(ctx, h.x, h.y, h.angle, h.stride, h.tough > 1.1 ? '#4a2230' : '#5b3a3e', 1.12, true, h.hitFlash, true);
      // a hostile ring in warning red, so a crew member is never mistaken for a pedestrian
      ctx.save();
      ctx.strokeStyle = 'rgba(255,86,102,0.55)';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(h.x, h.y, 16, 0, 6.283);
      ctx.stroke();
      ctx.restore();
      ctx.fillStyle = 'rgba(255,80,90,0.92)';
      ctx.beginPath();
      ctx.arc(h.x, h.y - 26, 2.9, 0, 6.283);
      ctx.fill();
      // a health pip over the crew's head when hurt
      if (h.health < h.maxHealth) {
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(h.x - 11, h.y - 31, 22, 3);
        ctx.fillStyle = '#ff5566';
        ctx.fillRect(h.x - 11, h.y - 31, 22 * (h.health / h.maxHealth), 3);
      }
    }
  };

  // Officers who have left the cruiser, in navy with the badge flash.
  Renderer.prototype.drawPoliceFoot = function (ctx, world, view) {
    for (var k = 0; k < world.police.units.length; k++) {
      var o = world.police.units[k].officer;
      if (!o) continue;
      if (o.x < view.x || o.x > view.x + view.w || o.y < view.y || o.y > view.y + view.h) continue;
      this.drawPerson(ctx, o.x, o.y, o.angle, o.stride, CFG.colors.copDark, 1.06, o.alive, o.hitFlash, true);
      if (o.alive) {
        ctx.fillStyle = Math.sin(world.time * 12) > 0 ? CFG.colors.sirenRed : CFG.colors.sirenBlue;
        ctx.beginPath();
        ctx.arc(o.x, o.y - 24, 2.4, 0, 6.283);
        ctx.fill();
      }
    }
  };

  Renderer.prototype.drawPlayer = function (ctx, world) {
    var p = world.player;
    if (p.inCar) return;
    if (!p.alive) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);
      ctx.fillStyle = 'rgba(70,224,193,0.5)';
      ctx.beginPath();
      ctx.ellipse(0, 0, 16, 8, 0, 0, 6.283);
      ctx.fill();
      ctx.restore();
      return;
    }
    // a thin rim light so the player never gets lost among the crowd
    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    ctx.beginPath();
    ctx.ellipse(p.x + 3, p.y + 4, 13, 9.5, 0, 0, 6.283);
    ctx.fill();
    ctx.restore();
    // the "you" ring: a soft teal halo under the feet, always readable in a crowd
    ctx.save();
    var ring = 0.5 + 0.5 * Math.sin(world.time * 3.4);
    ctx.strokeStyle = 'rgba(70,224,193,' + (0.26 + ring * 0.16).toFixed(3) + ')';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 15 + ring * 1.6, 0, 6.283);
    ctx.stroke();
    ctx.restore();
    this.drawPerson(ctx, p.x, p.y, p.angle, p.stride, C.player, 1.22, true, p.hitFlash, world.aiming);
    // aim line when aiming on foot, so the mouse aim is legible
    if (world.aiming) {
      var len = 70;
      ctx.save();
      ctx.strokeStyle = 'rgba(140,255,235,0.42)';
      ctx.lineWidth = 1.6;
      ctx.setLineDash([6, 8]);
      ctx.beginPath();
      ctx.moveTo(p.x + Math.cos(p.angle) * 18, p.y + Math.sin(p.angle) * 18);
      ctx.lineTo(p.x + Math.cos(p.angle) * len, p.y + Math.sin(p.angle) * len);
      ctx.stroke();
      ctx.restore();
    }
  };

  // A person from above. Long axis = facing direction (+x in the rotated frame): legs at the
  // back, a torso that is longer than it is wide, arms tucked along the flanks, and a head at
  // the front with a crescent of hair behind the face. Silhouette first, details second.
  Renderer.prototype.drawPerson = function (ctx, x, y, angle, stride, color, scale, alive, hitFlash, armed) {
    var s = scale || 1;
    ctx.save();
    ctx.translate(x, y);
    // shadow stretched along the body, nudged with the low sun
    ctx.save();
    ctx.rotate(angle);
    ctx.fillStyle = 'rgba(10,8,14,0.30)';
    ctx.beginPath();
    ctx.ellipse(1, 4, 15 * s, 7 * s, 0, 0, 6.283);
    ctx.fill();
    ctx.restore();

    ctx.rotate(angle);
    if (!alive) {
      ctx.fillStyle = 'rgba(118,108,118,0.72)';
      ctx.beginPath();
      ctx.ellipse(0, 0, 15 * s, 6.5 * s, 0, 0, 6.283);
      ctx.fill();
      ctx.restore();
      return;
    }
    var swing = Math.sin(stride) * 3 * s;
    var skin = hitFlash > 0 ? '#ffffff' : '#e8c8a6';
    var coat = hitFlash > 0 ? '#ffffff' : color;
    var dark = hitFlash > 0 ? '#ffffff' : U.shade(color, -52);

    // legs — two short bars trailing behind the coat
    ctx.fillStyle = dark;
    U.roundRect(ctx, -15 * s, -4.6 * s, 9 * s + swing, 3.8 * s, 1.9 * s);
    ctx.fill();
    U.roundRect(ctx, -15 * s, 0.8 * s, 9 * s - swing, 3.8 * s, 1.9 * s);
    ctx.fill();

    // arms — thin, hugging the flanks, swinging against the legs
    ctx.fillStyle = U.shade(color, -34);
    U.roundRect(ctx, -5 * s, -8.4 * s, 12 * s - swing * 0.5, 3 * s, 1.5 * s);
    ctx.fill();
    U.roundRect(ctx, -5 * s, 5.4 * s, 12 * s + swing * 0.5, 3 * s, 1.5 * s);
    ctx.fill();
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.arc(7.4 * s - swing * 0.5, -6.9 * s, 1.7 * s, 0, 6.283);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(7.4 * s + swing * 0.5, 6.9 * s, 1.7 * s, 0, 6.283);
    ctx.fill();

    // torso — an oval longer along the facing axis
    ctx.fillStyle = coat;
    ctx.beginPath();
    ctx.ellipse(-1 * s, 0, 11 * s, 6.6 * s, 0, 0, 6.283);
    ctx.fill();
    // shoulder shading and a collar seam
    ctx.fillStyle = 'rgba(0,0,0,0.16)';
    ctx.beginPath();
    ctx.ellipse(-5 * s, 0, 6 * s, 6 * s, 0, 0, 6.283);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    ctx.beginPath();
    ctx.ellipse(2 * s, -2.4 * s, 6 * s, 3 * s, 0.2, 0, 6.283);
    ctx.fill();

    // head: hair mass, then the face pushed forward out of it
    ctx.fillStyle = hitFlash > 0 ? '#ffffff' : '#241a18';
    ctx.beginPath();
    ctx.arc(8.4 * s, 0, 5 * s, 0, 6.283);
    ctx.fill();
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.arc(10.2 * s, 0, 3.9 * s, 0, 6.283);
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.14)';
    ctx.beginPath();
    ctx.arc(11.4 * s, 0, 2.6 * s, -1.3, 1.3);
    ctx.fill();

    if (armed) {
      ctx.fillStyle = '#1b1a20';
      ctx.fillRect(11 * s, -1.4 * s, 9 * s, 2.8 * s);
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.fillRect(11 * s, -1.4 * s, 9 * s, 0.9 * s);
    }
    ctx.restore();
  };

  // ---- air effects -----------------------------------------------------------
  Renderer.prototype.drawAirFX = function (ctx, world, view) {
    var fx = world.effects;
    var tracers = world.combat.tracers;
    // bullets
    ctx.save();
    ctx.lineCap = 'round';
    for (var k = 0; k < tracers.length; k++) {
      var t = tracers[k];
      var a = U.clamp(t.life / t.max, 0, 1);
      ctx.globalAlpha = a;
      ctx.strokeStyle = '#ffe9ae';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(t.x1, t.y1);
      ctx.lineTo(t.x2, t.y2);
      ctx.stroke();
    }
    ctx.restore();

    // particles
    for (var p = 0; p < fx.particles.length; p++) {
      var q = fx.particles[p];
      if (q.x < view.x || q.x > view.x + view.w || q.y < view.y || q.y > view.y + view.h) continue;
      var life = U.clamp(q.life / q.max, 0, 1);
      ctx.globalAlpha = life;
      ctx.fillStyle = q.color;
      ctx.beginPath();
      ctx.arc(q.x, q.y, q.size * (0.5 + life * 0.7), 0, 6.283);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    // rings
    for (var r = 0; r < fx.rings.length; r++) {
      var ring = fx.rings[r];
      ctx.globalAlpha = U.clamp(ring.life / ring.max, 0, 1);
      ctx.strokeStyle = ring.color;
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.arc(ring.x, ring.y, ring.r, 0, 6.283);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // pickups: little floating icons
    for (var i = 0; i < world.combat.pickups.length; i++) {
      var pu = world.combat.pickups[i];
      if (pu.x < view.x || pu.x > view.x + view.w) continue;
      var bob = Math.sin(world.time * 2.4 + pu.phase) * 3;
      var col = pu.kind === 'health' ? C.health : pu.kind === 'armour' ? C.armour : pu.kind === 'ammo' ? C.ammo : C.cash;
      ctx.save();
      ctx.translate(pu.x, pu.y + bob);
      ctx.fillStyle = 'rgba(12,10,18,0.5)';
      U.roundRect(ctx, -11, -11, 22, 22, 6);
      ctx.fill();
      ctx.fillStyle = col;
      U.roundRect(ctx, -8, -8, 16, 16, 4);
      ctx.fill();
      ctx.fillStyle = '#171219';
      ctx.font = '700 11px ui-sans-serif, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(pu.kind === 'health' ? '+' : pu.kind === 'armour' ? 'A' : pu.kind === 'ammo' ? '•' : '$', 0, 0.5);
      ctx.restore();
    }
  };

  // ---- screen-space light -----------------------------------------------------
  Renderer.prototype.drawLight = function (ctx, world, w, h) {
    // warm afternoon wash from the west
    var g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, 'rgba(255,170,110,0.10)');
    g.addColorStop(0.5, 'rgba(255,120,150,0.03)');
    g.addColorStop(1, 'rgba(40,20,60,0.13)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    // damage flash
    var p = world.player;
    if (p.hitFlash > 0) {
      ctx.fillStyle = 'rgba(190,30,40,' + (p.hitFlash * 0.3) + ')';
      ctx.fillRect(0, 0, w, h);
    }
    if (!p.alive) {
      ctx.fillStyle = 'rgba(90,10,20,0.16)';
      ctx.fillRect(0, 0, w, h);
    }

    // vignette
    var vg = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.34, w / 2, h / 2, Math.max(w, h) * 0.78);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(8,6,14,0.42)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, w, h);
  };

  PC.Renderer = Renderer;
})();
