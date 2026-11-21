// Palm City — the HUD: health and armour bars, cash, wanted stars, the objective line,
// and a live circular minimap that turns with the player.
(function (global) {
  'use strict';

  const PC = global.PC;

  const MINIMAP_RADIUS = 96;

  /**
   * Draw the minimap in a circle: roads as pale lines, buildings as dark blocks, the beach
   * as sand, then blips for the player, cops, traffic and the mission marker. North is up
   * until you are driving, when it turns with the car.
   */
  function drawMinimap(ctx, state, cx, cy) {
    const { city, player, wanted, cruisers, traffic, missions } = state;
    const scale = 0.29;              // world px per minimap px
    const rot = player.inCar ? -player.inCar.angle - Math.PI / 2 : 0;
    const px = player.x;
    const py = player.y;

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, MINIMAP_RADIUS, 0, Math.PI * 2);
    ctx.clip();

    // Ground.
    ctx.fillStyle = '#20262f';
    ctx.fillRect(cx - MINIMAP_RADIUS, cy - MINIMAP_RADIUS, MINIMAP_RADIUS * 2, MINIMAP_RADIUS * 2);

    ctx.translate(cx, cy);
    ctx.rotate(rot);
    ctx.scale(scale, scale);
    ctx.translate(-px, -py);

    // Sand and sea.
    ctx.fillStyle = PC.PALETTE.sand;
    ctx.fillRect(-px, city.sandStart, PC.WORLD * 2, city.waterTop - city.sandStart);
    ctx.fillStyle = PC.PALETTE.water;
    ctx.fillRect(-px, city.waterTop, PC.WORLD * 2, PC.WORLD);

    // Road grid.
    ctx.strokeStyle = '#4a525f';
    ctx.lineWidth = PC.ROAD;
    ctx.beginPath();
    for (let i = 0; i <= PC.GRID; i++) {
      const p = i * PC.CELL;
      ctx.moveTo(p, 0);
      ctx.lineTo(p, city.beachTop);
      ctx.moveTo(0, p);
      ctx.lineTo(PC.WORLD, p);
    }
    ctx.stroke();

    // Buildings.
    ctx.fillStyle = '#39414d';
    for (const b of city.buildings) ctx.fillRect(b.x, b.y, b.w, b.h);

    // Blips.
    const blip = (x, y, r, colour) => {
      ctx.fillStyle = colour;
      ctx.beginPath();
      ctx.arc(x, y, r / scale, 0, Math.PI * 2);
      ctx.fill();
    };

    for (const c of traffic) blip(c.x, c.y, 3, '#8f9aab');
    for (const c of cruisers) {
      if (Math.floor(state.time * 6) % 2 === 0) blip(c.x, c.y, 3.6, '#5f8ce8');
      else blip(c.x, c.y, 3.6, '#e8564f');
    }
    for (const h of state.hostiles) if (!h.dead) blip(h.x, h.y, 3.2, '#e0674f');

    if (missions.marker) {
      const pulse = 1 + Math.sin(state.time * 4) * 0.18;
      ctx.strokeStyle = PC.PALETTE.gold;
      ctx.lineWidth = 3 / scale;
      ctx.beginPath();
      ctx.arc(missions.marker.x, missions.marker.y, (14 * pulse) / scale, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,209,102,0.35)';
      ctx.fill();
    }

    ctx.restore();

    // Player arrow, always upright in the circle.
    ctx.save();
    ctx.translate(cx, cy);
    const heading = player.inCar ? player.inCar.angle : player.facing;
    ctx.rotate(heading + Math.PI / 2 + rot);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, -8);
    ctx.lineTo(6, 7);
    ctx.lineTo(0, 4);
    ctx.lineTo(-6, 7);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Rim.
    ctx.save();
    ctx.strokeStyle = 'rgba(10,12,18,0.85)';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(cx, cy, MINIMAP_RADIUS + 3, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(247,239,224,0.55)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, MINIMAP_RADIUS + 3, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  /** A slanted bar with a hard edge and a thin highlight, drawn from the left. */
  function bar(ctx, x, y, w, h, value, max, colour, back) {
    ctx.fillStyle = back || 'rgba(12,14,20,0.62)';
    ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
    ctx.fillStyle = colour;
    ctx.fillRect(x, y, Math.max(0, (w * PC.clamp(value / max, 0, 1)) | 0), h);
    ctx.fillStyle = 'rgba(255,255,255,0.20)';
    ctx.fillRect(x, y, Math.max(0, (w * PC.clamp(value / max, 0, 1)) | 0), 2);
  }

  function star(ctx, x, y, r, filled) {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const rad = i % 2 === 0 ? r : r * 0.45;
      ctx.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad);
    }
    ctx.closePath();
    if (filled) {
      ctx.fillStyle = PC.PALETTE.star;
      ctx.fill();
      ctx.strokeStyle = 'rgba(60,40,0,0.55)';
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.13)';
      ctx.strokeStyle = 'rgba(255,255,255,0.30)';
    }
    ctx.lineWidth = 1.4;
    ctx.stroke();
  }

  /**
   * The whole HUD: bars bottom-left, cash top-right, stars under it, the objective at the
   * top centre and the minimap bottom-right.
   */
  function draw(ctx, state, W, H) {
    const { player, wanted, missions } = state;

    // Health and armour.
    const bx = 28;
    const by = H - 92;
    ctx.fillStyle = 'rgba(10,12,18,0.45)';
    ctx.fillRect(bx - 12, by - 26, 252, 66);
    bar(ctx, bx, by, 220, 11, player.health, player.maxHealth, '#67c98a');
    bar(ctx, bx, by + 24, 220, 11, player.armour, PC.PLAYER_MAX_ARMOUR, '#6aa7e8');
    ctx.font = '600 11px "Inter", "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = PC.PALETTE.hudDim;
    ctx.textAlign = 'left';
    ctx.fillText('HEALTH', bx, by - 8);
    ctx.fillText('ARMOUR', bx, by + 16);

    // A dark plate behind the top-right block so building signs never fight the numbers.
    const plate = ctx.createLinearGradient(W - 250, 0, W, 0);
    plate.addColorStop(0, 'rgba(10,12,18,0)');
    plate.addColorStop(1, 'rgba(10,12,18,0.62)');
    ctx.fillStyle = plate;
    ctx.fillRect(W - 250, 0, 250, 132);

    // Cash.
    ctx.textAlign = 'right';
    ctx.font = '700 30px "Inter", "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = '#eaf3e0';
    ctx.shadowColor = 'rgba(0,0,0,0.55)';
    ctx.shadowBlur = 8;
    ctx.fillText(PC.money(player.cash), W - 30, 52);
    ctx.shadowBlur = 0;

    // Ammo.
    ctx.font = '600 13px "Inter", "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = PC.PALETTE.hudDim;
    ctx.fillText(`${player.ammo} ROUNDS`, W - 30, 74);

    // Wanted stars.
    for (let i = 0; i < PC.POLICE.maxStars; i++) {
      const sx = W - 30 - (PC.POLICE.maxStars - i) * 26 + 13;
      star(ctx, sx, 104, 11, i < wanted.stars);
    }

    // Objective line.
    const job = PC.Missions.current(missions);
    if (missions.state === 'active' || missions.state === 'idle') {
      ctx.textAlign = 'center';
      ctx.font = '600 13px "Inter", "Segoe UI", system-ui, sans-serif';
      // A staged scene may override the objective line (shots.js sets state.hint).
      const text = state.hint || (missions.state === 'active' ? job.objective : 'Find the gold marker to start a job');
      const w = ctx.measureText(text).width + 40;
      ctx.fillStyle = 'rgba(10,12,18,0.62)';
      ctx.fillRect(W / 2 - w / 2, 18, w, 34);
      ctx.fillStyle = PC.PALETTE.gold;
      ctx.fillRect(W / 2 - w / 2, 18, 3, 34);
      ctx.fillStyle = PC.PALETTE.hud;
      ctx.fillText(text, W / 2, 40);
      if (missions.state === 'active' && job.id === 'last-call') {
        ctx.font = '700 12px "Inter", system-ui, sans-serif';
        ctx.fillStyle = PC.PALETTE.gold;
        ctx.fillText(`${Math.max(0, 95 - missions.timer).toFixed(0)}s`, W / 2, 66);
      }
    }

    // Minimap.
    drawMinimap(ctx, state, W - 30 - MINIMAP_RADIUS, H - 30 - MINIMAP_RADIUS);

    // Speed, when driving.
    if (player.inCar) {
      const kph = Math.abs(player.inCar.speed) * 0.42;
      ctx.textAlign = 'left';
      ctx.font = '700 26px "Inter", "Segoe UI", system-ui, sans-serif';
      ctx.fillStyle = 'rgba(247,239,224,0.9)';
      ctx.fillText(`${kph.toFixed(0)}`, bx + 2, by + 74);
      ctx.font = '600 11px "Inter", system-ui, sans-serif';
      ctx.fillStyle = PC.PALETTE.hudDim;
      ctx.fillText('KPH', bx + 46, by + 74);
    }
  }

  PC.Hud = { draw, drawMinimap };
})(window);
