/* Palm City — the frame painter. The world draws in its own coordinates; this module owns the
   camera transform, the warm golden-hour light pass, the layers in depth order (ground, shadows,
   props, cars, people, effects, markers), and the screen-space HUD on top. Nothing here changes
   the simulation: it is given a world and draws it. */
(function (PC) {
  'use strict';

  var C = PC.CONFIG, P = PC.PALETTE, U = PC.util;

  function makeRenderer(canvas) {
    var ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    return { canvas: canvas, ctx: ctx };
  }

  function resize(renderer) {
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    var w = window.innerWidth, h = window.innerHeight;
    renderer.canvas.width = Math.round(w * dpr);
    renderer.canvas.height = Math.round(h * dpr);
    renderer.canvas.style.width = w + 'px';
    renderer.canvas.style.height = h + 'px';
    renderer.scale = Math.min(renderer.canvas.width / C.VW, renderer.canvas.height / C.VH);
  }

  function draw(renderer, world, t) {
    var ctx = renderer.ctx, cam = world.camera;
    var cv = renderer.canvas;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#20180f';
    ctx.fillRect(0, 0, cv.width, cv.height);

    // fit the 1280x720 logical field into the window, letterboxed
    var scale = renderer.scale;
    var ox = (cv.width - C.VW * scale) / 2;
    var oy = (cv.height - C.VH * scale) / 2;
    ctx.setTransform(scale, 0, 0, scale, ox, oy);

    // the shake offset and camera zoom
    var fx = world.effects;
    var z = cam.zoom;
    // the camera holds the visible rect's top-left in world units; zoom scales about the middle
    var vw = C.VW / z, vh = C.VH / z;
    ctx.save();
    ctx.translate(C.VW / 2 + fx.sx, C.VH / 2 + fx.sy);
    ctx.scale(z, z);
    ctx.translate(-vw / 2 - cam.x, -vh / 2 - cam.y);

    // visible rect in world space for culling
    var view = { x: cam.x, y: cam.y, w: vw, h: vh };

    PC.city.draw(world.city, ctx, view, t);

    // cars under people so a passenger reads as inside
    drawCars(world, ctx, view, t);
    drawPeople(world, ctx, view, t);
    PC.missions.drawMarkers(world.missions, ctx, view, t);
    PC.effects.draw(fx, ctx, view);

    // traffic cones, bullet casings and the objective progress ring are all particles now
    ctx.restore();

    drawLight(ctx, world, view);
    drawVignette(ctx);
    world.hud.draw(ctx, world, t);
    if (world.over) drawOver(ctx, world);
  }

  function drawCars(world, ctx, view, t) {
    var all = [];
    for (var i = 0; i < world.parked.length; i++) all.push(world.parked[i]);
    for (var j = 0; j < world.traffic.length; j++) all.push(world.traffic[j]);
    for (var k = 0; k < world.heat.cops.length; k++) all.push(world.heat.cops[k]);
    if (world.player.inCar) all.push(world.player.inCar);

    var drawn = 0;
    for (var c = 0; c < all.length; c++) {
      var car = all[c];
      if (car.x < view.x - 120 || car.x > view.x + view.w + 120) continue;
      if (car.y < view.y - 120 || car.y > view.y + view.h + 120) continue;
      PC.vehicles.drawCar(ctx, car, t);
      drawn++;
      if (car.driver === 'player') drawDriverGlow(ctx, car, t);
    }
    if (window.__shotDebug) window.__shotDebug.carsDrawn = drawn;
  }

  function drawDriverGlow(ctx, car, t) {
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    ctx.fillStyle = 'rgba(255,236,180,' + (0.10 + Math.sin(t * 3) * 0.03) + ')';
    ctx.beginPath(); ctx.arc(0, 0, car.wid * 0.62, 0, 6.283); ctx.fill();
    ctx.restore();
  }

  function drawPeople(world, ctx, view, t) {
    for (var i = 0; i < world.peds.length; i++) {
      var p = world.peds[i];
      if (p.x < view.x - 40 || p.x > view.x + view.w + 40) continue;
      if (p.y < view.y - 40 || p.y > view.y + view.h + 40) continue;
      PC.entities.drawPed(ctx, p);
    }
    PC.entities.drawPlayer(ctx, world.player, t);
    // the courier envelope in hand
    var pl = world.player;
    if (pl.carrying && !pl.inCar) {
      ctx.fillStyle = '#f6efe1';
      ctx.fillRect(pl.x + Math.cos(pl.angle) * 12 - 5, pl.y + Math.sin(pl.angle) * 12 - 3, 10, 7);
      ctx.strokeStyle = 'rgba(90,70,50,0.6)';
      ctx.lineWidth = 1;
      ctx.strokeRect(pl.x + Math.cos(pl.angle) * 12 - 5, pl.y + Math.sin(pl.angle) * 12 - 3, 10, 7);
    }
    // weapon-ready reticle near the pointer
    var m = world.input.mouse;
    if (m && m.active && !pl.inCar) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(m.wx, m.wy, 9, 0, 6.283); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(m.wx - 14, m.wy); ctx.lineTo(m.wx - 5, m.wy);
      ctx.moveTo(m.wx + 5, m.wy); ctx.lineTo(m.wx + 14, m.wy);
      ctx.moveTo(m.wx, m.wy - 14); ctx.lineTo(m.wx, m.wy - 5);
      ctx.moveTo(m.wx, m.wy + 5); ctx.lineTo(m.wx, m.wy + 14);
      ctx.stroke();
      ctx.restore();
    }
  }

  /* Warm light: a soft golden overlay from the north-west plus a blue shadow lift, so the city
     reads as late afternoon rather than flat. */
  function drawLight(ctx, world, view) {
    ctx.save();
    var g = ctx.createLinearGradient(0, 0, C.VW, C.VH);
    g.addColorStop(0, 'rgba(255,196,110,0.16)');
    g.addColorStop(0.45, 'rgba(255,220,150,0.05)');
    g.addColorStop(1, 'rgba(60,50,90,0.12)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, C.VW, C.VH);
    ctx.restore();
  }

  function drawVignette(ctx) {
    var g = ctx.createRadialGradient(C.VW / 2, C.VH / 2, C.VH * 0.42, C.VW / 2, C.VH / 2, C.VH * 0.95);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(20,12,6,0.42)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, C.VW, C.VH);
  }

  function drawOver(ctx, world) {
    var a = Math.min(0.72, world.overTimer * 0.9);
    ctx.save();
    ctx.fillStyle = 'rgba(18,10,8,' + a + ')';
    ctx.fillRect(0, 0, C.VW, C.VH);
    ctx.globalAlpha = Math.min(1, world.overTimer * 1.6);
    ctx.textAlign = 'center';
    ctx.font = 'bold ' + (world.overKind === 'busted' ? 62 : 62) + 'px "Trebuchet MS", Arial, sans-serif';
    ctx.fillStyle = world.overKind === 'busted' ? '#5aa9d6' : '#e2574c';
    ctx.fillText(world.overKind === 'busted' ? 'BUSTED' : 'WASTED', C.VW / 2, C.VH / 2 - 10);
    ctx.font = 'bold 16px "Trebuchet MS", Arial, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.fillText('Press Enter to get back out there', C.VW / 2, C.VH / 2 + 34);
    ctx.restore();
  }

  /* Screen-space helpers the menus reuse: a paper card and a two-tone button. */
  function card(ctx, x, y, w, h, alpha) {
    ctx.fillStyle = 'rgba(16,14,12,' + (alpha === undefined ? 0.86 : alpha) + ')';
    U.roundRect(ctx, x, y, w, h, 14); ctx.fill();
    ctx.strokeStyle = 'rgba(242,193,78,0.5)';
    ctx.lineWidth = 2;
    U.roundRect(ctx, x, y, w, h, 14); ctx.stroke();
  }

  function button(ctx, x, y, w, h, label, hot) {
    ctx.fillStyle = hot ? 'rgba(242,193,78,0.95)' : 'rgba(255,255,255,0.1)';
    U.roundRect(ctx, x, y, w, h, 8); ctx.fill();
    ctx.strokeStyle = hot ? '#f2c14e' : 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1.5;
    U.roundRect(ctx, x, y, w, h, 8); ctx.stroke();
    ctx.fillStyle = hot ? '#241c10' : '#f4ead2';
    ctx.font = 'bold 15px "Trebuchet MS", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x + w / 2, y + h / 2 + 1);
  }

  PC.render = {
    make: makeRenderer, resize: resize, draw: draw, card: card, button: button
  };
})(window.PC = window.PC || {});
