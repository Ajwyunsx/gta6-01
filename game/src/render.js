// Palm City — drawing the world. A top-down camera with a warm late-afternoon grade:
// long soft shadows, pastel facades with visible roofs, sea haze on the south shore, and
// headlight cones on the asphalt. Everything is drawn with canvas 2D primitives.
(function (global) {
  'use strict';

  const PC = global.PC;
  const P = PC.PALETTE;

  /** World-to-screen: the camera is centred, zoomed, and shaken. */
  function makeProjection(state, W, H) {
    const cam = state.camera;
    const fx = state.effects;
    return {
      ox: W / 2 - cam.x,
      oy: H / 2 - cam.y,
      sx: (x) => W / 2 + (x - cam.x) + (fx ? fx.shakeX : 0),
      sy: (y) => H / 2 + (y - cam.y) + (fx ? fx.shakeY : 0),
      ox2: W / 2 - cam.x + (fx ? fx.shakeX : 0),
      oy2: H / 2 - cam.y + (fx ? fx.shakeY : 0),
    };
  }

  /** The visible world rectangle, padded, for culling. */
  function viewRect(state, W, H) {
    const cam = state.camera;
    const pad = 260;
    return {
      x0: cam.x - W / 2 - pad,
      y0: cam.y - H / 2 - pad,
      x1: cam.x + W / 2 + pad,
      y1: cam.y + H / 2 + pad,
    };
  }

  // ---- ground ------------------------------------------------------------

  function drawGround(ctx, state, view, proj) {
    const city = state.city;

    // Sea, drawn first as the far south band.
    const seaY = proj.sy(city.waterTop);
    const g = ctx.createLinearGradient(0, seaY, 0, seaY + 600);
    g.addColorStop(0, P.waterLight);
    g.addColorStop(0.35, P.water);
    g.addColorStop(1, '#1d6478');
    ctx.fillStyle = g;
    ctx.fillRect(0, seaY, 2000, 2000);

    // Surf: a bright line with a foam ribbon.
    ctx.fillStyle = P.foam;
    ctx.globalAlpha = 0.85;
    ctx.fillRect(0, seaY - 5, 2000, 5);
    ctx.globalAlpha = 1;

    // Sand.
    ctx.fillStyle = P.sand;
    ctx.fillRect(0, proj.sy(city.beachTop), 2000, seaY - proj.sy(city.beachTop) + 8);
    // Damp sand near the water.
    ctx.fillStyle = P.sandDark;
    ctx.globalAlpha = 0.55;
    ctx.fillRect(0, seaY - 42, 2000, 42);
    ctx.globalAlpha = 1;

    // Asphalt: every road seam, drawn as one path.
    const cell = PC.CELL;
    const road = PC.ROAD;
    ctx.fillStyle = P.asphalt;
    const x0 = Math.max(0, view.x0);
    const x1 = Math.min(PC.WORLD, view.x1);
    const y0 = Math.max(0, view.y0);
    const y1 = Math.min(city.beachTop + cell * 0.5, view.y1);
    for (let i = 0; i <= PC.GRID; i++) {
      const cx = i * cell + cell / 2;
      ctx.fillRect(proj.sx(cx - road / 2), proj.sy(Math.max(0, y0)), road, proj.sy(y1) - proj.sy(y0));
      ctx.fillRect(proj.sx(x0), proj.sy(cx - road / 2), proj.sx(x1) - proj.sx(x0), road);
    }

    // Lane dashes.
    ctx.strokeStyle = P.lane;
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = 2;
    ctx.setLineDash([16, 18]);
    ctx.beginPath();
    for (let i = 0; i <= PC.GRID; i++) {
      const cx = i * cell + cell / 2;
      ctx.moveTo(proj.sx(cx), proj.sy(0));
      ctx.lineTo(proj.sx(cx), proj.sy(city.beachTop));
      ctx.moveTo(proj.sx(0), proj.sy(cx));
      ctx.lineTo(proj.sx(PC.WORLD), proj.sy(cx));
    }
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;

    // Kerbs and pavements: a slightly lighter frame around every block.
    for (const lot of city.lots) {
      if (lot.x > view.x1 || lot.y > view.y1 || lot.x + lot.w < view.x0 || lot.y + lot.h < view.y0) continue;
      ctx.fillStyle = P.pavement;
      ctx.fillRect(proj.sx(lot.x - PC.SIDEWALK), proj.sy(lot.y - PC.SIDEWALK), lot.w + PC.SIDEWALK * 2, lot.h + PC.SIDEWALK * 2);
      ctx.fillStyle = P.lot;
      ctx.fillRect(proj.sx(lot.x), proj.sy(lot.y), lot.w, lot.h);
      // Paving joints.
      ctx.strokeStyle = P.pavementLine;
      ctx.globalAlpha = 0.5;
      ctx.lineWidth = 1;
      ctx.strokeRect(proj.sx(lot.x - PC.SIDEWALK) + 0.5, proj.sy(lot.y - PC.SIDEWALK) + 0.5, lot.w + PC.SIDEWALK * 2 - 1, lot.h + PC.SIDEWALK * 2 - 1);
      ctx.globalAlpha = 1;
    }

    // Parks: soft green with a path.
    for (const park of city.parks) {
      ctx.fillStyle = P.grass;
      ctx.fillRect(proj.sx(park.x), proj.sy(park.y), park.w, park.h);
      ctx.fillStyle = P.grassDark;
      ctx.globalAlpha = 0.6;
      ctx.fillRect(proj.sx(park.x + park.w * 0.25), proj.sy(park.y + park.h * 0.42), park.w * 0.5, 12);
      ctx.globalAlpha = 1;
    }
  }

  // ---- buildings ---------------------------------------------------------

  /**
   * Buildings are drawn as a roof rectangle offset from the footprint by a pseudo-3D
   * extrusion toward the light, with a wall face and a lit window grid.
   */
  function drawBuildings(ctx, state, view, proj, time) {
    const city = state.city;
    const sorted = city.buildings;
    for (const b of sorted) {
      if (b.x > view.x1 || b.y > view.y1 || b.x + b.w < view.x0 || b.y + b.h < view.y0) continue;

      const sx = proj.sx(b.x);
      const sy = proj.sy(b.y);
      const h = b.height;

      // Long shadow toward the north-east, since the sun sits south-west.
      ctx.fillStyle = P.shadow;
      ctx.fillRect(sx + 4, sy + 6, b.w + h * 0.55, b.h + h * 0.32);

      // Wall: the front face, darker than the roof.
      ctx.fillStyle = b.wall;
      ctx.fillRect(sx, sy, b.w, b.h);

      // Roof plate offset up-left by the height: the top of the block.
      const rx = sx - h * 0.22;
      const ry = sy - h * 0.30;
      ctx.fillStyle = b.roof;
      ctx.fillRect(rx, ry, b.w, b.h);
      ctx.strokeStyle = 'rgba(0,0,0,0.16)';
      ctx.lineWidth = 1;
      ctx.strokeRect(rx + 0.5, ry + 0.5, b.w - 1, b.h - 1);

      // Trim band along the front edge.
      ctx.fillStyle = b.trim;
      ctx.fillRect(sx, sy + b.h - 5, b.w, 5);

      // Windows on the wall face, lit warm at dusk.
      for (const win of b.windows) {
        const wx = sx + (win.x - b.x) * 0.92;
        const wy = sy + (win.y - b.y) * 0.92;
        if (win.lit) {
          ctx.fillStyle = win.warm ? 'rgba(255,214,150,0.92)' : 'rgba(186,226,255,0.85)';
        } else {
          ctx.fillStyle = 'rgba(40,46,58,0.55)';
        }
        ctx.fillRect(wx, wy, win.w * 0.9, win.h * 0.9);
      }

      // Door.
      if (b.door) {
        ctx.fillStyle = 'rgba(30,30,38,0.75)';
        ctx.fillRect(sx + (b.door.x - b.x), sy + b.h - 6, b.door.w, 5);
      }

      // A neon sign over the door on some blocks.
      if (b.sign) {
        const glow = 0.55 + Math.sin(time * 2 + b.x * 0.01) * 0.2;
        ctx.globalAlpha = glow;
        ctx.fillStyle = b.trim;
        ctx.fillRect(sx + (b.sign.x - b.x), sy + (b.sign.y - b.y), Math.min(b.w - 20, 62), 12);
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#2a2430';
        ctx.font = '700 8px "Inter", system-ui, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(b.sign.text, sx + (b.sign.x - b.x) + 4, sy + (b.sign.y - b.y) + 9);
      }

      // Rooftop details: AC units and a water tank on the taller towers.
      if (b.floors > 5) {
        ctx.fillStyle = 'rgba(0,0,0,0.22)';
        ctx.fillRect(rx + b.w * 0.2, ry + b.h * 0.22, 18, 14);
        ctx.fillRect(rx + b.w * 0.62, ry + b.h * 0.6, 22, 16);
        ctx.strokeStyle = 'rgba(255,255,255,0.18)';
        ctx.beginPath();
        ctx.arc(rx + b.w * 0.48, ry + b.h * 0.45, 9, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }

  // ---- props -------------------------------------------------------------

  function drawPalm(ctx, x, y, s, tilt, time) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(tilt);
    const sway = Math.sin(time * 1.2 + x * 0.01) * 0.04;
    ctx.rotate(sway);

    // Shadow.
    ctx.fillStyle = 'rgba(20,30,40,0.28)';
    ctx.beginPath();
    ctx.ellipse(14 * s, 8 * s, 16 * s, 8 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    // Trunk.
    ctx.strokeStyle = '#9b7d55';
    ctx.lineWidth = 3.2 * s;
    ctx.beginPath();
    ctx.moveTo(0, 4 * s);
    ctx.quadraticCurveTo(-2 * s, -8 * s, -1 * s, -18 * s);
    ctx.stroke();

    // Fronds.
    ctx.strokeStyle = '#3f7d45';
    ctx.lineWidth = 2.6 * s;
    for (let i = 0; i < 7; i++) {
      const a = -Math.PI / 2 + (i - 3) * 0.42;
      ctx.beginPath();
      ctx.moveTo(-1 * s, -18 * s);
      ctx.quadraticCurveTo(
        Math.cos(a) * 10 * s,
        -18 * s + Math.sin(a) * 8 * s,
        Math.cos(a) * 17 * s,
        -18 * s + Math.sin(a) * 13 * s,
      );
      ctx.stroke();
    }
    ctx.fillStyle = '#4f9455';
    ctx.beginPath();
    ctx.arc(-1 * s, -18 * s, 3 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawProps(ctx, state, view, proj, time) {
    const city = state.city;

    for (const p of city.props) {
      if (p.x < view.x0 || p.x > view.x1 || p.y < view.y0 || p.y > view.y1) continue;
      const sx = proj.sx(p.x);
      const sy = proj.sy(p.y);
      if (p.type === 'bench') {
        ctx.fillStyle = 'rgba(20,30,40,0.24)';
        ctx.fillRect(sx - 16, sy - 2, 34, 10);
        ctx.fillStyle = '#a4713f';
        ctx.fillRect(sx - 15, sy - 5, 30, 7);
        ctx.fillStyle = '#7c5127';
        ctx.fillRect(sx - 15, sy + 1, 30, 2);
      } else if (p.type === 'umbrella') {
        ctx.fillStyle = 'rgba(20,30,40,0.22)';
        ctx.beginPath();
        ctx.ellipse(sx + 8, sy + 6, 18, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#e06a5a';
        ctx.beginPath();
        ctx.arc(sx, sy, 15, Math.PI, 0);
        ctx.fill();
        ctx.strokeStyle = '#f4e4c8';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(sx - 15, sy);
        ctx.lineTo(sx + 15, sy);
        ctx.stroke();
      } else if (p.type === 'lamp') {
        ctx.fillStyle = 'rgba(20,30,40,0.26)';
        ctx.fillRect(sx - 2, sy - 2, 6, 6);
        ctx.strokeStyle = '#4a4f58';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx, sy - 30);
        ctx.lineTo(sx + 10, sy - 32);
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,222,160,0.9)';
        ctx.beginPath();
        ctx.arc(sx + 11, sy - 32, 3.4, 0, Math.PI * 2);
        ctx.fill();
        const g = ctx.createRadialGradient(sx + 11, sy - 30, 0, sx + 11, sy - 30, 58);
        g.addColorStop(0, 'rgba(255,214,150,0.20)');
        g.addColorStop(1, 'rgba(255,214,150,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(sx + 11, sy - 30, 58, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === 'hydrant') {
        ctx.fillStyle = '#c94b3f';
        ctx.fillRect(sx - 3, sy - 6, 6, 8);
        ctx.fillStyle = '#e2695c';
        ctx.fillRect(sx - 4, sy - 8, 8, 3);
      } else if (p.type === 'bin') {
        ctx.fillStyle = 'rgba(20,30,40,0.24)';
        ctx.fillRect(sx - 5, sy - 4, 12, 10);
        ctx.fillStyle = '#4a5560';
        ctx.fillRect(sx - 5, sy - 7, 10, 9);
      }
    }

    for (const palm of city.palms) {
      if (palm.x < view.x0 || palm.x > view.x1 || palm.y < view.y0 || palm.y > view.y1) continue;
      drawPalm(ctx, proj.sx(palm.x), proj.sy(palm.y), palm.s, palm.tilt, time);
    }
  }

  // ---- actors ------------------------------------------------------------

  /** A person from above: head, shoulders, and a shadow that points away from the sun. */
  function drawPerson(ctx, a, proj, isPlayer) {
    const x = proj.sx(a.x);
    const y = proj.sy(a.y);

    ctx.fillStyle = 'rgba(20,26,40,0.30)';
    ctx.beginPath();
    ctx.ellipse(x + 7, y + 6, a.radius * 1.25, a.radius * 0.85, 0, 0, Math.PI * 2);
    ctx.fill();

    const bob = Math.sin(a.walkPhase) * 1.4;

    // Shoulders.
    ctx.save();
    ctx.translate(x, y + bob);
    ctx.rotate(a.facing + Math.PI / 2);
    ctx.fillStyle = a.shirt;
    ctx.beginPath();
    ctx.ellipse(0, 0, a.radius * 0.92, a.radius * 1.02, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = isPlayer ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.22)';
    ctx.lineWidth = isPlayer ? 1.6 : 1;
    ctx.stroke();
    ctx.restore();

    // Head.
    ctx.fillStyle = a.skin;
    ctx.beginPath();
    ctx.arc(x, y + bob - 1, a.radius * 0.56, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = a.hair;
    ctx.beginPath();
    ctx.arc(x, y + bob - 2.4, a.radius * 0.5, Math.PI * 1.05, Math.PI * 1.95);
    ctx.fill();

    // Police officers wear a visible cap.
    if (a.kind === 'cop') {
      ctx.fillStyle = '#1d2740';
      ctx.beginPath();
      ctx.arc(x, y + bob - 2, a.radius * 0.52, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#c9d6f0';
      ctx.beginPath();
      ctx.arc(x, y + bob - 2, a.radius * 0.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /** A car from above: body, roof, windscreen, lights and a headlight cone. */
  function drawCar(ctx, car, proj, time, isPlayerCar) {
    const x = proj.sx(car.x);
    const y = proj.sy(car.y);

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(car.angle);

    // Shadow.
    ctx.fillStyle = 'rgba(18,24,38,0.34)';
    ctx.fillRect(-car.length / 2 + 5, -car.width / 2 + 6, car.length, car.width);

    // Headlight cone, before the body so the body sits on top.
    if (car.headlights) {
      const g = ctx.createLinearGradient(car.length / 2, 0, car.length / 2 + 190, 0);
      g.addColorStop(0, 'rgba(255,236,190,0.28)');
      g.addColorStop(1, 'rgba(255,236,190,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(car.length / 2 - 4, -car.width / 2 + 3);
      ctx.lineTo(car.length / 2 + 190, -58);
      ctx.lineTo(car.length / 2 + 190, 58);
      ctx.lineTo(car.length / 2 - 4, car.width / 2 - 3);
      ctx.closePath();
      ctx.fill();
    }

    // Tyres.
    ctx.fillStyle = '#1b1d22';
    const l = car.length / 2;
    const w = car.width / 2;
    ctx.fillRect(-l + 6, -w - 2, 12, 4);
    ctx.fillRect(l - 18, -w - 2, 12, 4);
    ctx.fillRect(-l + 6, w - 2, 12, 4);
    ctx.fillRect(l - 18, w - 2, 12, 4);

    // Body.
    ctx.fillStyle = car.colour;
    roundRect(ctx, -l, -w, car.length, car.width, 5);
    ctx.fill();

    // Roof/cabin.
    ctx.fillStyle = 'rgba(20,26,36,0.42)';
    roundRect(ctx, -l * 0.34, -w * 0.78, car.length * 0.52, car.width * 0.78 * 2, 4);
    ctx.fill();
    ctx.fillStyle = 'rgba(190,225,240,0.55)';
    roundRect(ctx, l * 0.1, -w * 0.66, 7, car.width * 0.66, 2);
    ctx.fill();

    // Police livery.
    if (car.driver === 'police') {
      ctx.fillStyle = '#1e2b4d';
      ctx.fillRect(-l * 0.2, -w, car.length * 0.34, car.width * 0.28);
      ctx.fillRect(-l * 0.2, w - car.width * 0.28, car.length * 0.34, car.width * 0.28);
      // Light bar, alternating red and blue.
      const phase = Math.floor(car.lightPhase * 2) % 2 === 0;
      ctx.fillStyle = phase ? '#ff4d4d' : '#3f6dff';
      ctx.fillRect(-2, -w + 2, 5, car.width - 4);
      const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, 90);
      glow.addColorStop(0, phase ? 'rgba(255,70,70,0.30)' : 'rgba(70,110,255,0.30)');
      glow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(0, 0, 90, 0, Math.PI * 2);
      ctx.fill();
    }

    // Tail lights.
    ctx.fillStyle = 'rgba(230,70,60,0.9)';
    ctx.fillRect(-l + 1, -w + 3, 3, 5);
    ctx.fillRect(-l + 1, w - 8, 3, 5);
    // Headlights.
    ctx.fillStyle = 'rgba(255,245,214,0.95)';
    ctx.fillRect(l - 4, -w + 3, 3, 5);
    ctx.fillRect(l - 4, w - 8, 3, 5);

    // Player's car gets a subtle outline so it reads instantly.
    if (isPlayerCar) {
      ctx.strokeStyle = 'rgba(255,255,255,0.55)';
      ctx.lineWidth = 1.4;
      roundRect(ctx, -l - 1, -w - 1, car.length + 2, car.width + 2, 6);
      ctx.stroke();
    }

    ctx.restore();
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(x, y, w, h, r);
      return;
    }
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  // ---- markers, bullets, pickups -----------------------------------------

  function drawMarker(ctx, marker, proj, time) {
    const x = proj.sx(marker.x);
    const y = proj.sy(marker.y);
    const pulse = 0.75 + Math.sin(time * 3.4) * 0.25;

    // A ground disc with a spinning ring.
    ctx.save();
    const g = ctx.createRadialGradient(x, y, 0, x, y, marker.r * 1.4);
    g.addColorStop(0, `rgba(255,209,102,${0.30 * pulse})`);
    g.addColorStop(0.6, `rgba(255,209,102,${0.14 * pulse})`);
    g.addColorStop(1, 'rgba(255,209,102,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, marker.r * 1.4, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = `rgba(255,224,150,${0.9 * pulse})`;
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.arc(x, y, marker.r * 0.72, 0, Math.PI * 2);
    ctx.stroke();

    // A chevron bobbing above.
    const bob = Math.sin(time * 3) * 5;
    ctx.fillStyle = '#ffd166';
    ctx.beginPath();
    ctx.moveTo(x, y - 34 + bob);
    ctx.lineTo(x + 10, y - 20 + bob);
    ctx.lineTo(x + 4, y - 20 + bob);
    ctx.lineTo(x + 4, y - 8 + bob);
    ctx.lineTo(x - 4, y - 8 + bob);
    ctx.lineTo(x - 4, y - 20 + bob);
    ctx.lineTo(x - 10, y - 20 + bob);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawPickups(ctx, state, view, proj, time) {
    for (const p of state.pickups) {
      if (p.taken) continue;
      if (p.x < view.x0 || p.x > view.x1 || p.y < view.y0 || p.y > view.y1) continue;
      const x = proj.sx(p.x);
      const y = proj.sy(p.y) + Math.sin(p.bob) * 2.5;

      ctx.fillStyle = 'rgba(15,20,30,0.30)';
      ctx.beginPath();
      ctx.ellipse(x + 2, y + 9, 7, 3.4, 0, 0, Math.PI * 2);
      ctx.fill();

      const glow = ctx.createRadialGradient(x, y, 0, x, y, 22);
      const col = p.kind === 'health' ? '120,220,150' : p.kind === 'armour' ? '120,175,235' : '255,205,100';
      glow.addColorStop(0, `rgba(${col},0.45)`);
      glow.addColorStop(1, `rgba(${col},0)`);
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(x, y, 22, 0, Math.PI * 2);
      ctx.fill();

      if (p.kind === 'health') {
        ctx.fillStyle = '#eaf7ee';
        ctx.fillRect(x - 6, y - 2, 12, 4);
        ctx.fillRect(x - 2, y - 6, 4, 12);
      } else if (p.kind === 'armour') {
        ctx.fillStyle = '#cfe2f7';
        ctx.beginPath();
        ctx.moveTo(x, y - 7);
        ctx.lineTo(x + 6, y - 3);
        ctx.lineTo(x + 5, y + 5);
        ctx.lineTo(x, y + 8);
        ctx.lineTo(x - 5, y + 5);
        ctx.lineTo(x - 6, y - 3);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.fillStyle = '#ffd166';
        ctx.fillRect(x - 6, y - 5, 12, 10);
        ctx.fillStyle = '#a67c1a';
        ctx.fillRect(x - 2, y - 3, 4, 6);
      }
    }
  }

  function drawBullets(ctx, state, proj) {
    ctx.strokeStyle = 'rgba(255,226,150,0.85)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    for (const b of state.bullets) {
      const x = proj.sx(b.x);
      const y = proj.sy(b.y);
      const len = b.from === 'police' ? 12 : 16;
      const a = Math.atan2(b.vy, b.vx);
      ctx.moveTo(x, y);
      ctx.lineTo(x - Math.cos(a) * len, y - Math.sin(a) * len);
    }
    ctx.stroke();
  }

  // ---- frame -------------------------------------------------------------

  /** Draw everything but the HUD and menus. */
  function drawWorld(ctx, state, W, H) {
    const proj = makeProjection(state, W, H);
    const view = viewRect(state, W, H);

    // Base fill: the city's own warm ground.
    ctx.fillStyle = '#c9b998';
    ctx.fillRect(0, 0, W, H);

    drawGround(ctx, state, view, proj);
    state.effects.drawSkids(ctx);
    drawBuildings(ctx, state, view, proj, state.time);
    drawProps(ctx, state, view, proj, state.time);
    drawPickups(ctx, state, view, proj, state.time);

    if (state.missions.marker) drawMarker(ctx, state.missions.marker, proj, state.time);

    // Cars, sorted by y so a car in front overlaps one behind.
    const cars = state.cars().slice().sort((a, b) => a.y - b.y);
    const peds = state.peds.filter((p) => !p.dead || p.deadTimer < 20);

    // Merge people and cars into one painter's-order list so overlaps read right.
    const drawables = [];
    for (const c of cars) {
      if (c.x < view.x0 || c.x > view.x1 || c.y < view.y0 || c.y > view.y1) continue;
      drawables.push({ y: c.y, kind: 'car', obj: c });
    }
    for (const p of peds) {
      if (p.x < view.x0 || p.x > view.x1 || p.y < view.y0 || p.y > view.y1) continue;
      drawables.push({ y: p.y, kind: 'ped', obj: p });
    }
    for (const h of state.hostiles) {
      if (h.x < view.x0 || h.x > view.x1 || h.y < view.y0 || h.y > view.y1) continue;
      drawables.push({ y: h.y, kind: 'ped', obj: h });
    }
    if (!state.player.inCar) drawables.push({ y: state.player.y, kind: 'ped', obj: state.player, player: true });

    drawables.sort((a, b) => a.y - b.y);
    for (const d of drawables) {
      if (d.kind === 'car') drawCar(ctx, d.obj, proj, state.time, d.obj === state.player.inCar);
      else if (d.obj.dead) {
        // A body on the pavement.
        const x = proj.sx(d.obj.x);
        const y = proj.sy(d.obj.y);
        ctx.fillStyle = 'rgba(20,26,40,0.22)';
        ctx.beginPath();
        ctx.ellipse(x + 5, y + 4, 13, 7, 0.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = d.obj.shirt;
        ctx.beginPath();
        ctx.ellipse(x, y, 12, 6, 0.7, 0, Math.PI * 2);
        ctx.fill();
      } else {
        drawPerson(ctx, d.obj, proj, !!d.player);
      }
    }

    // Aim reticle on the ground where the mouse points.
    if (state.mode === 'playing' && !state.player.inCar) {
      const a = state.aim;
      const reach = 190;
      const rx = proj.sx(state.player.x + Math.cos(a) * reach);
      const ry = proj.sy(state.player.y + Math.sin(a) * reach);
      ctx.strokeStyle = 'rgba(255,255,255,0.32)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(proj.sx(state.player.x) + Math.cos(a) * 26, proj.sy(state.player.y) + Math.sin(a) * 26);
      ctx.lineTo(rx - Math.cos(a) * 8, ry - Math.sin(a) * 8);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.55)';
      ctx.beginPath();
      ctx.arc(rx, ry, 5, 0, Math.PI * 2);
      ctx.stroke();
    }

    drawBullets(ctx, state, proj);
    state.effects.draw(ctx);

    // Vignette and warm grade, drawn last so it sits over the world.
    const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.32, W / 2, H / 2, H * 0.92);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(14,10,24,0.42)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(255,150,90,0.05)';
    ctx.fillRect(0, 0, W, H);

    // Wanted flash at the screen edge.
    if (state.wanted.alert > 0 && state.wanted.stars > 0) {
      const a = state.wanted.alert * 0.32;
      const eg = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.95);
      eg.addColorStop(0, 'rgba(226,70,70,0)');
      eg.addColorStop(1, `rgba(226,70,70,${a})`);
      ctx.fillStyle = eg;
      ctx.fillRect(0, 0, W, H);
    }
  }

  PC.Render = { drawWorld, makeProjection, roundRect };
})(window);
