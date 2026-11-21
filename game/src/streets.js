// streets.js — the pavement's own little theatre. A busker with a guitar case open, a pair
// arguing outside a bar, someone walking a dog that keeps stopping, a skater circling the
// fountain. They are not gameplay: they are the reason a block looks lived in. Update is a
// clock per scene; draw is a handful of shapes each.
(function () {
  'use strict';
  var PC = window.PC;
  var CFG = PC.CFG;
  var U = PC.U;

  var KINDS = ['busker', 'argument', 'dogwalk', 'skater'];

  function Streets(city, rng) {
    this.city = city;
    this.rng = rng;
    this.scenes = [];
    this.spawnClock = 0.4;
    this.scan = 0;
  }

  Streets.prototype.pickSpot = function () {
    var rng = this.rng;
    var seed = this.city.pedSpawns[Math.floor(rng() * this.city.pedSpawns.length)];
    if (!seed) return null;
    var x = seed.x + (rng() - 0.5) * 120;
    var y = seed.y + (rng() - 0.5) * 120;
    if (this.city.hitBuilding(x, y, 26)) return null;
    return { x: x, y: y };
  };

  Streets.prototype.add = function (x, y, kind) {
    var rng = this.rng;
    this.scenes.push({
      x: x, y: y, kind: kind,
      t: rng() * 6,
      life: U.randRange(rng, 26, 70),
      angle: rng() * 6.283,
      phase: rng() * 6.283,
      size: U.randRange(rng, 0.92, 1.14),
      pitch: U.randRange(rng, 0.7, 1.3),
      dogX: 0,
      dogY: 0,
    });
  };

  Streets.prototype.update = function (dt, world) {
    var px = world.player.x, py = world.player.y;
    this.spawnClock -= dt;
    if (this.spawnClock <= 0) {
      this.spawnClock = U.randRange(this.rng, 1.4, 3.2);
      if (this.scenes.length < 7) {
        this.scan += 1;
        var spot = this.pickSpot();
        if (spot && U.dist(spot.x, spot.y, px, py) > 220) {
          this.add(spot.x, spot.y, KINDS[this.scan % KINDS.length]);
        }
      }
    }
    for (var k = this.scenes.length - 1; k >= 0; k--) {
      var s = this.scenes[k];
      s.t += dt;
      s.life -= dt;
      if (s.life <= 0 || U.dist(s.x, s.y, px, py) > 2500) {
        this.scenes.splice(k, 1);
      }
    }
  };

  Streets.prototype.draw = function (ctx, world, view) {
    for (var k = 0; k < this.scenes.length; k++) {
      var s = this.scenes[k];
      if (s.x < view.x - 80 || s.x > view.x + view.w + 80) continue;
      if (s.y < view.y - 80 || s.y > view.y + view.h + 80) continue;
      if (s.kind === 'busker') this.drawBusker(ctx, s, world);
      else if (s.kind === 'argument') this.drawArgument(ctx, s, world);
      else if (s.kind === 'dogwalk') this.drawDogwalk(ctx, s, world);
      else this.drawSkater(ctx, s, world);
    }
  };

  Streets.prototype.drawBusker = function (ctx, s, world) {
    var bob = Math.sin(world.time * 3.1 * s.pitch) * 1.6;
    ctx.save();
    ctx.translate(s.x, s.y - bob);
    // guitar case on the pavement, open with a few coins in it
    ctx.fillStyle = '#4a3324';
    U.roundRect(ctx, 16, 8, 34, 15, 4);
    ctx.fill();
    ctx.fillStyle = '#20242c';
    U.roundRect(ctx, 19, 10, 28, 11, 3);
    ctx.fill();
    ctx.fillStyle = '#ffd166';
    for (var c = 0; c < 3; c++) {
      ctx.beginPath();
      ctx.arc(27 + c * 6, 15, 1.7, 0, 6.283);
      ctx.fill();
    }
    // the player of the guitar: body, head, and the instrument
    ctx.fillStyle = '#8d4a63';
    U.roundRect(ctx, -8, -9, 16, 18, 6);
    ctx.fill();
    ctx.fillStyle = '#e8c9a8';
    ctx.beginPath();
    ctx.arc(2, -12, 5, 0, 6.283);
    ctx.fill();
    ctx.save();
    ctx.rotate(-0.5 + Math.sin(world.time * 2.4) * 0.06);
    ctx.fillStyle = '#c58a3f';
    ctx.beginPath();
    ctx.ellipse(10, 2, 9, 6.5, 0, 0, 6.283);
    ctx.fill();
    ctx.fillStyle = '#2a2118';
    ctx.fillRect(14, -1, 14, 3);
    ctx.restore();
    // a couple of musical notes drifting up
    ctx.fillStyle = 'rgba(255,240,220,0.55)';
    ctx.font = '600 12px ui-sans-serif, system-ui, sans-serif';
    ctx.fillText('♪', 24, -18 - (world.time * 18 % 26));
    ctx.restore();
  };

  Streets.prototype.drawArgument = function (ctx, s, world) {
    var wob = Math.sin(world.time * 5.4) * 2.2;
    ctx.save();
    ctx.translate(s.x, s.y);
    // two people facing each other, gesturing
    ctx.fillStyle = '#e26d5c';
    U.roundRect(ctx, -26, -8 + wob * 0.2, 15, 16, 5);
    ctx.fill();
    ctx.fillStyle = '#e8c9a8';
    ctx.beginPath();
    ctx.arc(-18, -13 + wob * 0.2, 4.6, 0, 6.283);
    ctx.fill();
    ctx.fillStyle = '#6ec1e4';
    U.roundRect(ctx, 12, -8 - wob * 0.2, 15, 16, 5);
    ctx.fill();
    ctx.fillStyle = '#e8c9a8';
    ctx.beginPath();
    ctx.arc(20, -13 - wob * 0.2, 4.6, 0, 6.283);
    ctx.fill();
    // the raised hand of whoever is losing the argument
    ctx.fillStyle = '#e8c9a8';
    ctx.beginPath();
    ctx.arc(-4, -14 + wob, 3.4, 0, 6.283);
    ctx.fill();
    ctx.restore();
  };

  Streets.prototype.drawDogwalk = function (ctx, s, world) {
    var walk = Math.sin(world.time * 0.9 + s.phase) * 34;
    var stop = Math.sin(world.time * 0.55 + s.phase) > 0.6 ? 0 : 1;
    var hx = s.x + walk * stop;
    var hy = s.y + Math.cos(world.time * 0.9 + s.phase) * 12 * stop;
    ctx.save();
    // lead
    ctx.strokeStyle = 'rgba(240,235,225,0.7)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(hx, hy);
    ctx.lineTo(hx + 26 * stop + 12, hy + 8);
    ctx.stroke();
    // the dog: body, head, tail
    var dx = hx + 26 * stop + 12;
    var dy = hy + 8;
    ctx.fillStyle = '#b48ad8';
    U.roundRect(ctx, dx - 5, dy - 4, 14, 8, 4);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(dx + 10, dy - 2, 4, 0, 6.283);
    ctx.fill();
    ctx.strokeStyle = '#b48ad8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(dx - 5, dy - 1);
    ctx.lineTo(dx - 11, dy - 5 - Math.sin(world.time * 9) * 2);
    ctx.stroke();
    // the walker
    ctx.fillStyle = '#f2c14e';
    U.roundRect(ctx, hx - 7, hy - 8, 15, 17, 5);
    ctx.fill();
    ctx.fillStyle = '#e8c9a8';
    ctx.beginPath();
    ctx.arc(hx + 1, hy - 13, 4.8, 0, 6.283);
    ctx.fill();
    ctx.restore();
  };

  Streets.prototype.drawSkater = function (ctx, s, world) {
    // circles an invisible little bowl, leaning into the turn
    var a = world.time * 1.5 + s.phase;
    var r = 34;
    var x = s.x + Math.cos(a) * r;
    var y = s.y + Math.sin(a) * r * 0.62;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(a + Math.PI / 2);
    ctx.fillStyle = 'rgba(10,8,14,0.28)';
    ctx.beginPath();
    ctx.ellipse(3, 5, 13, 5, 0, 0, 6.283);
    ctx.fill();
    ctx.fillStyle = '#2b2b33';
    ctx.fillRect(-11, -3, 22, 6);
    ctx.fillStyle = '#f0a6ca';
    U.roundRect(ctx, -6, -10, 12, 13, 4);
    ctx.fill();
    ctx.fillStyle = '#e8c9a8';
    ctx.beginPath();
    ctx.arc(0, -14, 4.4, 0, 6.283);
    ctx.fill();
    ctx.restore();
  };

  PC.Streets = Streets;
})();
