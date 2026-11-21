/* Palm City — particles and camera shake. One pooled particle list draws sparks, blood, tyre
   smoke, muzzle flashes, explosions and paper money; shake is a decaying offset the renderer
   applies so hits and crashes land. Nothing here allocates in the frame loop after warm-up. */
(function (PC) {
  'use strict';

  var U = PC.util;
  var POOL = 420;

  function makeEffects() {
    var parts = new Array(POOL);
    for (var i = 0; i < POOL; i++) parts[i] = { live: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, size: 2, color: '#fff', kind: 'dot', drag: 0.9 };
    return {
      parts: parts, next: 0, shakeAmt: 0, shakeT: 0, flash: 0,
      sx: 0, sy: 0
    };
  }

  function spawn(fx, x, y, vx, vy, life, size, color, kind, drag) {
    var p = fx.parts[fx.next];
    fx.next = (fx.next + 1) % POOL;
    p.live = true; p.x = x; p.y = y; p.vx = vx; p.vy = vy;
    p.life = life; p.max = life; p.size = size; p.color = color; p.kind = kind || 'dot';
    p.drag = drag === undefined ? 0.88 : drag;
  }

  function burst(fx, x, y, n, color, speed) {
    for (var i = 0; i < n; i++) {
      var a = Math.random() * 6.283, s = speed * (0.4 + Math.random() * 0.8);
      spawn(fx, x, y, Math.cos(a) * s, Math.sin(a) * s, 0.35 + Math.random() * 0.4, 2 + Math.random() * 3, color, 'dot');
    }
  }

  function spark(fx, x, y, color) {
    for (var i = 0; i < 5; i++) {
      var a = Math.random() * 6.283, s = 90 + Math.random() * 160;
      spawn(fx, x, y, Math.cos(a) * s, Math.sin(a) * s, 0.2 + Math.random() * 0.2, 1.6, color || '#ffd88c', 'streak');
    }
  }

  function impact(fx, x, y) {
    spawn(fx, x, y, 0, 0, 0.18, 7, 'rgba(240,232,210,0.85)', 'ring', 1);
  }

  function blood(fx, x, y, ang) {
    for (var i = 0; i < 12; i++) {
      var a = ang + (Math.random() - 0.5) * 1.5, s = 60 + Math.random() * 190;
      spawn(fx, x, y, Math.cos(a) * s, Math.sin(a) * s, 0.3 + Math.random() * 0.5, 2 + Math.random() * 3, '#9d2b2b', 'dot');
    }
    spawn(fx, x, y, 0, 0, 6, 15, 'rgba(120,25,25,0.4)', 'stain', 1);
  }

  function muzzle(fx, x, y, ang) {
    spawn(fx, x, y, Math.cos(ang) * 40, Math.sin(ang) * 40, 0.08, 12, 'rgba(255,232,170,0.95)', 'flash', 1);
    for (var i = 0; i < 4; i++) {
      var a = ang + (Math.random() - 0.5) * 0.5, s = 260 + Math.random() * 200;
      spawn(fx, x, y, Math.cos(a) * s, Math.sin(a) * s, 0.12, 2, '#ffe1a0', 'streak');
    }
  }

  function puff(fx, x, y) {
    spawn(fx, x, y, (Math.random() - 0.5) * 30, -20 - Math.random() * 30, 1.2, 8 + Math.random() * 8, 'rgba(70,70,75,0.45)', 'smoke', 0.97);
  }

  function smoke(fx, x, y, n) {
    for (var i = 0; i < (n || 1); i++) {
      spawn(fx, x + (Math.random() - 0.5) * 12, y + (Math.random() - 0.5) * 12, (Math.random() - 0.5) * 40, -30 - Math.random() * 40, 0.8 + Math.random() * 0.9, 6 + Math.random() * 8, 'rgba(60,58,62,0.5)', 'smoke', 0.96);
    }
  }

  function explode(fx, x, y) {
    spawn(fx, x, y, 0, 0, 0.3, 46, 'rgba(255,200,90,0.95)', 'flash', 1);
    for (var i = 0; i < 26; i++) {
      var a = Math.random() * 6.283, s = 90 + Math.random() * 300;
      spawn(fx, x, y, Math.cos(a) * s, Math.sin(a) * s, 0.5 + Math.random() * 0.7, 3 + Math.random() * 5, i % 2 ? '#ffb347' : '#e2574c', 'dot');
    }
    for (var j = 0; j < 10; j++) puff(fx, x + (Math.random() - 0.5) * 30, y + (Math.random() - 0.5) * 30);
    fx.shakeAmt = Math.max(fx.shakeAmt, 14);
  }

  function cash(fx, x, y, n) {
    for (var i = 0; i < (n || 8); i++) {
      spawn(fx, x, y, (Math.random() - 0.5) * 160, -80 - Math.random() * 120, 0.8 + Math.random() * 0.5, 4, '#8fd8a0', 'note', 0.97);
    }
  }

  function shake(fx, amount) { fx.shakeAmt = Math.max(fx.shakeAmt, amount); }

  function update(fx, dt) {
    for (var i = 0; i < POOL; i++) {
      var p = fx.parts[i];
      if (!p.live) continue;
      p.life -= dt;
      if (p.life <= 0) { p.live = false; continue; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      var d = Math.pow(p.drag, dt * 60);
      p.vx *= d; p.vy *= d;
      if (p.kind === 'smoke') p.vy -= 8 * dt;
      if (p.kind === 'note') { p.vy += 60 * dt; p.vx *= 0.99; }
    }
    if (fx.shakeAmt > 0) {
      fx.shakeAmt = Math.max(0, fx.shakeAmt - dt * 26);
      var a = fx.shakeAmt;
      fx.sx = (Math.random() - 0.5) * a;
      fx.sy = (Math.random() - 0.5) * a;
    } else { fx.sx = 0; fx.sy = 0; }
  }

  function draw(fx, ctx, cam) {
    ctx.save();
    ctx.translate(-cam.x, -cam.y);
    for (var i = 0; i < POOL; i++) {
      var p = fx.parts[i];
      if (!p.live) continue;
      var k = p.life / p.max;
      if (p.kind === 'ring') {
        ctx.strokeStyle = p.color;
        ctx.globalAlpha = k;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (1.6 - k), 0, 6.283); ctx.stroke();
      } else if (p.kind === 'flash') {
        ctx.globalAlpha = k * 0.9;
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size * k, 0, 6.283); ctx.fill();
      } else if (p.kind === 'streak') {
        ctx.globalAlpha = k;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 0.02, p.y - p.vy * 0.02);
        ctx.stroke();
      } else if (p.kind === 'stain') {
        ctx.globalAlpha = Math.min(0.45, k * 0.5);
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.ellipse(p.x, p.y, p.size, p.size * 0.65, 0.6, 0, 6.283); ctx.fill();
      } else if (p.kind === 'smoke') {
        ctx.globalAlpha = k * 0.55;
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (1.8 - k), 0, 6.283); ctx.fill();
      } else if (p.kind === 'note') {
        ctx.globalAlpha = Math.min(1, k * 2);
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - 3, p.y - 2, 6, 4);
      } else {
        ctx.globalAlpha = k;
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (0.4 + k * 0.6), 0, 6.283); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  PC.effects = {
    make: makeEffects, update: update, draw: draw,
    burst: burst, spark: spark, impact: impact, blood: blood, muzzle: muzzle,
    puff: puff, smoke: smoke, explode: explode, cash: cash, shake: shake
  };
})(window.PC = window.PC || {});
