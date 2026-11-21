// effects.js — particles, muzzle flashes, tyre smoke, screen shake and the small
// floating texts (+$120, BUSTED) that give the world its feedback. Pure presentation;
// nothing here changes game state.

import { randomRange } from './random.js';

export class Effects {
  constructor() {
    this.particles = [];
    this.texts = [];
    this.shake = 0;
    this.shakeTime = 0;
    this.flash = 0;
  }

  burst(x, y, count, opts = {}) {
    const {
      speed = 90,
      life = 0.5,
      size = 3,
      colors = ['#fff2c8'],
      spread = Math.PI * 2,
      dir = 0,
      gravity = 0,
      drag = 2.4,
    } = opts;
    for (let i = 0; i < count; i++) {
      const a = dir + randomRange(-spread / 2, spread / 2);
      const s = speed * randomRange(0.35, 1.15);
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: life * randomRange(0.6, 1.3),
        maxLife: life,
        size: size * randomRange(0.6, 1.4),
        color: colors[Math.floor(Math.random() * colors.length)],
        gravity,
        drag,
        kind: 'dot',
      });
    }
  }

  smoke(x, y, angle, strength = 1) {
    this.particles.push({
      x,
      y,
      vx: Math.cos(angle) * 20 + randomRange(-24, 24),
      vy: Math.sin(angle) * 20 + randomRange(-24, 24),
      life: 0.7 * strength,
      maxLife: 0.7 * strength,
      size: 7 * strength,
      color: '#b9b3c6',
      gravity: -8,
      drag: 1.2,
      kind: 'smoke',
    });
  }

  flashAt(x, y, angle, scale = 1) {
    this.particles.push({
      x,
      y,
      vx: 0,
      vy: 0,
      life: 0.07,
      maxLife: 0.07,
      size: 16 * scale,
      color: '#ffe9a8',
      gravity: 0,
      drag: 0,
      kind: 'flash',
      angle,
    });
  }

  sparks(x, y, angle, count = 8) {
    this.burst(x, y, count, {
      speed: 210,
      life: 0.28,
      size: 2.2,
      colors: ['#ffe08a', '#ffb14a', '#fff6d8'],
      spread: 1.4,
      dir: angle,
      gravity: 60,
    });
  }

  text(x, y, text, color = '#ffe9a8', size = 14) {
    this.texts.push({ x, y, text, color, size, life: 1.1, maxLife: 1.1 });
  }

  addShake(amount, time = 0.25) {
    this.shake = Math.max(this.shake, amount);
    this.shakeTime = Math.max(this.shakeTime, time);
  }

  whiteFlash(a = 0.35) {
    this.flash = Math.max(this.flash, a);
  }

  update(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const drag = Math.exp(-p.drag * dt);
      p.vx *= drag;
      p.vy *= drag;
      p.vy += p.gravity * dt;
    }
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i];
      t.life -= dt;
      t.y -= 22 * dt;
      if (t.life <= 0) this.texts.splice(i, 1);
    }
    if (this.shakeTime > 0) {
      this.shakeTime -= dt;
      if (this.shakeTime <= 0) this.shake = 0;
    }
    this.flash = Math.max(0, this.flash - dt * 2.2);
  }

  draw(ctx, camera) {
    ctx.save();
    for (const p of this.particles) {
      const a = Math.max(0, p.life / p.maxLife);
      if (p.kind === 'flash') {
        ctx.globalAlpha = a;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalCompositeOperation = 'lighter';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 1.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
      } else if (p.kind === 'smoke') {
        ctx.globalAlpha = a * 0.4;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (1.6 - a * 0.6), 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.globalAlpha = a;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (0.5 + a * 0.5), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();

    ctx.save();
    for (const t of this.texts) {
      const a = Math.min(1, t.life / t.maxLife * 1.6);
      ctx.globalAlpha = a;
      ctx.font = `800 ${t.size}px ui-sans-serif, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillText(t.text, t.x + 1, t.y + 1);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x, t.y);
    }
    ctx.restore();
  }
}
