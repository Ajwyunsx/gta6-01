// effects.js — particles, camera shake, skid marks and the little flashes that make a hit
// read as a hit. The world keeps one Effects object; render.js draws whatever is in its lists.
(function () {
  'use strict';
  var PC = window.PC;
  var CFG = PC.CFG;
  var U = PC.U;

  function Effects(rng) {
    this.rng = rng;
    this.particles = [];
    this.rings = [];
    this.skids = [];
    this.shakeAmount = 0;
    this.smokeClock = 0;
  }
  Effects.prototype.burst = function (x, y, color, count) {
    var rng = this.rng;
    for (var k = 0; k < count; k++) {
      var a = rng() * 6.283;
      var sp = U.randRange(rng, 40, 260);
      this.particles.push({
        x: x, y: y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: U.randRange(rng, 0.22, 0.6),
        max: 0.6,
        size: U.randRange(rng, 1.6, 4.2),
        color: color,
        drag: 3.2,
      });
    }
  };

  Effects.prototype.muzzle = function (x, y, angle) {
    var rng = this.rng;
    for (var k = 0; k < 4; k++) {
      var a = angle + (rng() - 0.5) * 0.7;
      var sp = U.randRange(rng, 120, 320);
      this.particles.push({
        x: x, y: y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: U.randRange(rng, 0.05, 0.13), max: 0.13,
        size: U.randRange(rng, 1.4, 3), color: '#ffe9a8', drag: 8,
      });
    }
    this.rings.push({ x: x, y: y, r: 2, maxR: 20, life: 0.12, max: 0.12, color: 'rgba(255,225,150,0.7)' });
  };

  Effects.prototype.explode = function (x, y) {
    var rng = this.rng;
    for (var k = 0; k < 54; k++) {
      var a = rng() * 6.283;
      var sp = U.randRange(rng, 80, 620);
      this.particles.push({
        x: x, y: y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: U.randRange(rng, 0.3, 1.1), max: 1.1,
        size: U.randRange(rng, 2.5, 7),
        color: rng() < 0.45 ? '#ffd166' : rng() < 0.6 ? '#ff7b39' : '#4a4a52',
        drag: 1.6,
      });
    }
    this.rings.push({ x: x, y: y, r: 8, maxR: 120, life: 0.5, max: 0.5, color: 'rgba(255,190,90,0.75)' });
    this.shake(16);
  };

  Effects.prototype.smoke = function (x, y, angle) {
    var rng = this.rng;
    this.particles.push({
      x: x + Math.cos(angle) * 34 + (rng() - 0.5) * 10,
      y: y + Math.sin(angle) * 34 + (rng() - 0.5) * 10,
      vx: (rng() - 0.5) * 26, vy: -30 - rng() * 40,
      life: U.randRange(rng, 0.7, 1.4), max: 1.4,
      size: U.randRange(rng, 5, 11), color: 'rgba(90,88,96,0.6)', drag: 0.5,
    });
  };

  Effects.prototype.skid = function (x, y, angle) {
    var list = this.skids;
    list.push({ x: x, y: y, angle: angle, life: 6.5 });
    if (list.length > 220) list.shift();
  };

  Effects.prototype.shake = function (amount) {
    this.shakeAmount = Math.min(26, this.shakeAmount + amount);
  };

  Effects.prototype.update = function (dt) {
    var k;
    for (k = this.particles.length - 1; k >= 0; k--) {
      var p = this.particles[k];
      p.life -= dt;
      if (p.life <= 0) { this.particles.splice(k, 1); continue; }
      var damp = 1 - Math.min(1, p.drag * dt);
      p.vx *= damp;
      p.vy *= damp;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    for (k = this.rings.length - 1; k >= 0; k--) {
      var r = this.rings[k];
      r.life -= dt;
      r.r = U.lerp(r.r, r.maxR, 1 - Math.exp(-9 * dt));
      if (r.life <= 0) this.rings.splice(k, 1);
    }
    for (k = this.skids.length - 1; k >= 0; k--) {
      this.skids[k].life -= dt;
      if (this.skids[k].life <= 0) this.skids.splice(k, 1);
    }
    this.shakeAmount = Math.max(0, this.shakeAmount - this.shakeAmount * Math.min(1, 7 * dt) - dt * 2);
  };

  Effects.prototype.clear = function () {
    this.particles.length = 0;
    this.rings.length = 0;
    this.skids.length = 0;
    this.shakeAmount = 0;
  };

  PC.Effects = Effects;
})();
