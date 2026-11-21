// Palm City — the invisible half of the feel: sparks, smoke, glass, tyres, camera shake and
// speed lines. Everything here is a short-lived particle with no gameplay effect.
(function (global) {
  'use strict';

  const PC = global.PC;

  function makeEffects() {
    const fx = {
      particles: [],
      shake: 0,
      shakeX: 0,
      shakeY: 0,
      skidMarks: [],
      flashes: [],
    };

    fx.clear = function clear() {
      fx.particles.length = 0;
      fx.skidMarks.length = 0;
      fx.flashes.length = 0;
      fx.shake = 0;
    };

    /** A burst of particles. `kind` picks the colour and behaviour. */
    fx.burst = function burst(x, y, kind, count, power) {
      const n = count ?? 8;
      const p = power ?? 1;
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const s = (40 + Math.random() * 160) * p;
        fx.particles.push({
          x,
          y,
          vx: Math.cos(a) * s,
          vy: Math.sin(a) * s,
          life: 0.25 + Math.random() * 0.55,
          max: 0.8,
          kind,
          size: kind === 'smoke' ? 3 + Math.random() * 5 : 1.2 + Math.random() * 2.4,
          spin: (Math.random() - 0.5) * 6,
          angle: Math.random() * Math.PI * 2,
        });
      }
    };

    fx.muzzle = function muzzle(x, y) {
      fx.flashes.push({ x, y, life: 0.07, max: 0.07 });
    };

    fx.addShake = function addShake(amount) {
      fx.shake = Math.min(14, fx.shake + amount);
    };

    /** A skid mark segment under a wheel. */
    fx.skid = function skid(x, y, angle, strength) {
      fx.skidMarks.push({ x, y, angle, strength, life: 8, max: 8 });
      if (fx.skidMarks.length > 900) fx.skidMarks.shift();
    };

    fx.update = function update(dt) {
      for (let i = fx.particles.length - 1; i >= 0; i--) {
        const p = fx.particles[i];
        p.life -= dt;
        if (p.life <= 0) {
          fx.particles.splice(i, 1);
          continue;
        }
        const drag = p.kind === 'smoke' ? 0.94 : 0.90;
        p.vx *= Math.pow(drag, dt * 60);
        p.vy *= Math.pow(drag, dt * 60);
        if (p.kind === 'spark') p.vy += 220 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.angle += p.spin * dt;
        if (p.kind === 'smoke') p.size += dt * 8;
      }

      for (let i = fx.flashes.length - 1; i >= 0; i--) {
        fx.flashes[i].life -= dt;
        if (fx.flashes[i].life <= 0) fx.flashes.splice(i, 1);
      }

      for (let i = fx.skidMarks.length - 1; i >= 0; i--) {
        fx.skidMarks[i].life -= dt;
        if (fx.skidMarks[i].life <= 0) fx.skidMarks.splice(i, 1);
      }

      fx.shake *= Math.pow(0.86, dt * 60);
      if (fx.shake < 0.15) fx.shake = 0;
      fx.shakeX = (Math.random() - 0.5) * fx.shake;
      fx.shakeY = (Math.random() - 0.5) * fx.shake;
    };

    /** Draw the marks on the road, under everything else. */
    fx.drawSkids = function drawSkids(ctx) {
      ctx.save();
      for (const m of fx.skidMarks) {
        ctx.globalAlpha = Math.min(0.42, (m.life / m.max) * 0.42) * m.strength;
        ctx.fillStyle = '#1d1f25';
        ctx.translate(m.x, m.y);
        ctx.rotate(m.angle);
        ctx.fillRect(-4, -1.6, 8, 3.2);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
      }
      ctx.restore();
    };

    fx.draw = function draw(ctx) {
      for (const p of fx.particles) {
        const k = p.life / p.max;
        if (p.kind === 'smoke') {
          ctx.globalAlpha = 0.20 * k;
          ctx.fillStyle = '#cfcac2';
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        } else if (p.kind === 'glass') {
          ctx.globalAlpha = 0.85 * k;
          ctx.fillStyle = '#d8f0f5';
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.angle);
          ctx.fillRect(-p.size, -p.size * 0.5, p.size * 2, p.size);
          ctx.restore();
        } else if (p.kind === 'blood') {
          ctx.globalAlpha = 0.75 * k;
          ctx.fillStyle = '#8e2b2b';
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // sparks
          ctx.globalAlpha = 0.9 * k;
          ctx.fillStyle = p.kind === 'muzzle' ? '#ffe9a8' : '#ffb257';
          ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
        }
      }
      ctx.globalAlpha = 1;

      for (const f of fx.flashes) {
        const k = f.life / f.max;
        const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, 26);
        g.addColorStop(0, `rgba(255,238,190,${0.85 * k})`);
        g.addColorStop(1, 'rgba(255,180,90,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(f.x, f.y, 26, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    return fx;
  }

  PC.Effects = { makeEffects };
})(window);
