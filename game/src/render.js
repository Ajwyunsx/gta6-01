// Palm City — drawing the world. A top-down camera with a warm late-afternoon grade:
// long soft shadows, pastel facades with visible roofs, sea haze on the south shore, and
// headlight cones on the asphalt. Everything is drawn with canvas 2D primitives.
//
// The world pass runs inside one canvas transform (centre, zoom, camera offset), so every
// shape below is drawn in world coordinates and the camera costs nothing per object.
(function (global) {
  'use strict';

  const PC = global.PC;
  const P = PC.PALETTE;

  /** The visible world rectangle, padded, for culling. */
  function viewRect(state, W, H) {
    const cam = state.camera;
    const z = cam.zoom || 1;
    const pad = 180;
    return {
      x0: cam.x - W / (2 * z) - pad,
      y0: cam.y - H / (2 * z) - pad,
      x1: cam.x + W / (2 * z) + pad,
      y1: cam.y + H / (2 * z) + pad,
    };
  }

  /** Screen position of a world point, for the HUD-ish overlays drawn outside the transform. */
  function toScreen(state, W, H, x, y) {
    const cam = state.camera;
    const z = cam.zoom || 1;
    return { x: W / 2 + (x - cam.x) * z, y: H / 2 + (y - cam.y) * z };
  }

  // ---- ground ------------------------------------------------------------

  function drawGround(ctx, state, view) {
    const city = state.city;

    // Sea: the whole south band, with a surf line and a foam ribbon at the shore.
    const seaGrad = ctx.createLinearGradient(0, city.waterTop, 0, PC.WORLD + 900);
    seaGrad.addColorStop(0, '#57b9c6');
    seaGrad.addColorStop(0.22, P.waterLight);
    seaGrad.addColorStop(1, '#155d72');
    ctx.fillStyle = seaGrad;
    ctx.fillRect(-400, city.waterTop, PC.WORLD + 800, PC.WORLD + 900);

    // Waves: a few long, low-contrast arcs.
    ctx.strokeStyle = 'rgba(232,246,244,0.30)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < 14; i++) {
      const y = city.waterTop + 34 + i * 42;
      ctx.moveTo(-200, y);
      for (let x = -200; x < PC.WORLD + 200; x += 60) {
        ctx.quadraticCurveTo(x + 30, y - 5, x + 60, y);
      }
    }
    ctx.stroke();

    // Surf.
    ctx.fillStyle = P.foam;
    ctx.globalAlpha = 0.9;
    ctx.fillRect(-200, city.waterTop - 7, PC.WORLD + 400, 7);
    ctx.globalAlpha = 1;

    // Sand.
    ctx.fillStyle = P.sand;
    ctx.fillRect(-200, city.sandStart, PC.WORLD + 400, city.waterTop - city.sandStart);
    // Damp sand near the water.
    ctx.fillStyle = P.sandDark;
    ctx.globalAlpha = 0.5;
    ctx.fillRect(-200, city.waterTop - 48, PC.WORLD + 400, 48);
    ctx.globalAlpha = 1;

    // Loungers and towels scattered on the sand, deterministic so they never shimmer.
    for (let i = 0; i < 16; i++) {
      const x = 60 + ((i * 197) % (PC.WORLD - 120));
      const y = city.sandStart + 34 + ((i * 71) % 74);
      ctx.fillStyle = 'rgba(30,40,50,0.13)';
      ctx.fillRect(x + 2, y + 2, 16, 9);
      ctx.fillStyle = i % 3 === 0 ? '#e07a63' : i % 3 === 1 ? '#5aa4c4' : '#e8d9b4';
      ctx.fillRect(x, y, 15, 8);
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.fillRect(x, y, 15, 2);
    }

    // Asphalt: every road seam, drawn as one path.
    const cell = PC.CELL;
    const road = PC.ROAD;
    const y1 = city.beachTop + cell * 0.5;
    ctx.fillStyle = P.asphalt;
    for (let i = 0; i <= PC.GRID; i++) {
      const cx = i * cell;
      if (cx + road < view.x0 || cx - road > view.x1) continue;
      ctx.fillRect(cx - road / 2, 0, road, y1);
    }
    for (let i = 0; i <= PC.GRID; i++) {
      const cy = i * cell;
      if (cy > y1 || cy + road < view.y0 || cy - road > view.y1) continue;
      ctx.fillRect(0, cy - road / 2, PC.WORLD, road);
    }

    // A worn centre strip on each road, so the asphalt is not flat.
    ctx.fillStyle = P.asphaltWorn;
    ctx.globalAlpha = 0.55;
    for (let i = 0; i <= PC.GRID; i++) {
      const cx = i * cell;
      if (cx < view.x0 - 60 || cx > view.x1 + 60) continue;
      ctx.fillRect(cx - road * 0.18, 0, road * 0.36, y1);
    }
    for (let i = 0; i <= PC.GRID; i++) {
      const cy = i * cell;
      if (cy > y1 || cy < view.y0 - 60 || cy > view.y1 + 60) continue;
      ctx.fillRect(0, cy - road * 0.18, PC.WORLD, road * 0.36);
    }
    ctx.globalAlpha = 1;

    // Lane dashes.
    ctx.strokeStyle = P.lane;
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 2.5;
    ctx.setLineDash([18, 22]);
    ctx.beginPath();
    for (let i = 1; i < PC.GRID; i++) {
      const c = i * cell;
      ctx.moveTo(c, 0);
      ctx.lineTo(c, city.beachTop);
      ctx.moveTo(0, c);
      ctx.lineTo(PC.WORLD, c);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;

    // Kerbs and pavements: a slightly lighter frame around every block.
    for (const lot of city.lots) {
      if (lot.x > view.x1 || lot.y > view.y1 || lot.x + lot.w < view.x0 || lot.y + lot.h < view.y0) continue;
      const k = PC.SIDEWALK;
      ctx.fillStyle = P.pavement;
      ctx.fillRect(lot.x - k, lot.y - k, lot.w + k * 2, lot.h + k * 2);
      ctx.fillStyle = P.lot;
      ctx.fillRect(lot.x, lot.y, lot.w, lot.h);
      ctx.strokeStyle = P.pavementLine;
      ctx.globalAlpha = 0.55;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(lot.x - k + 0.5, lot.y - k + 0.5, lot.w + k * 2 - 1, lot.h + k * 2 - 1);
      // Paving joints across the sidewalk strip.
      ctx.globalAlpha = 0.30;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let px = lot.x - k; px < lot.x + lot.w + k; px += 26) {
        ctx.moveTo(px, lot.y - k);
        ctx.lineTo(px, lot.y);
        ctx.moveTo(px, lot.y + lot.h);
        ctx.lineTo(px, lot.y + lot.h + k);
      }
      for (let py = lot.y - k; py < lot.y + lot.h + k; py += 26) {
        ctx.moveTo(lot.x - k, py);
        ctx.lineTo(lot.x, py);
        ctx.moveTo(lot.x + lot.w, py);
        ctx.lineTo(lot.x + lot.w + k, py);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // Parks: soft green with a path.
    for (const park of city.parks) {
      ctx.fillStyle = P.grass;
      ctx.fillRect(park.x, park.y, park.w, park.h);
      ctx.fillStyle = P.grassDark;
      ctx.globalAlpha = 0.55;
      ctx.fillRect(park.x + park.w * 0.22, park.y + park.h * 0.45, park.w * 0.56, 14);
      ctx.globalAlpha = 1;
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.fillRect(park.x + 8, park.y + 8, park.w - 16, park.h - 16);
    }

    // Crosswalks at the mouth of every junction: worn bars laid across the carriageway,
    // drawn last so no pavement pass can cover them.
    ctx.fillStyle = 'rgba(236,230,209,0.42)';
    for (let iy = 0; iy <= PC.GRID; iy++) {
      for (let ix = 0; ix <= PC.GRID; ix++) {
        const jx = ix * cell;
        const jy = iy * cell;
        if (jx < view.x0 - 60 || jx > view.x1 + 60 || jy > y1 + 60 || jy < view.y0 - 60) continue;
        if (jy > city.beachTop) continue;
        const inner = road / 2 - 4;
        for (let b = 0; b < 4; b++) {
          const o = -inner + 5 + b * 15;
          // East and west mouths (crossing the horizontal road).
          ctx.fillRect(jx + inner + 2, jy + o, 12, 9);
          ctx.fillRect(jx - inner - 14, jy + o, 12, 9);
          // North and south mouths (crossing the vertical road).
          ctx.fillRect(jx + o, jy + inner + 2, 9, 12);
          ctx.fillRect(jx + o, jy - inner - 14, 9, 12);
        }
      }
    }

    // A promenade line along the beach, so the shore reads as a place you walk.
    ctx.strokeStyle = 'rgba(255,255,255,0.20)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, city.beachTop + 26);
    ctx.lineTo(PC.WORLD, city.beachTop + 26);
    ctx.stroke();
  }

  // ---- buildings ---------------------------------------------------------

  /**
   * A building from above: the footprint as the sunlit roof, a lip of wall on the south and
   * east edges, lit windows along that lip, and rooftop plant. Read as a block of buildings
   * rather than a diagram of one, which is what makes the streets legible at a glance.
   */
  function drawBuildings(ctx, state, view, time) {
    const city = state.city;
    for (const b of city.buildings) {
      if (b.x > view.x1 || b.y > view.y1 || b.x + b.w < view.x0 || b.y + b.h < view.y0) continue;
      const h = b.height;

      // Long shadow toward the north-east: the sun sits low in the south-west.
      ctx.fillStyle = 'rgba(32,28,50,0.24)';
      ctx.fillRect(b.x + 6 + h * 0.1, b.y + 8 + h * 0.08, b.w, b.h);

      // The wall block: footprint, wall colour.
      ctx.fillStyle = b.wall;
      ctx.fillRect(b.x, b.y, b.w, b.h);

      // Roof plate, inset and nudged away from the sun: the lip left behind is the facade.
      const lip = 9;
      const rx = b.x + lip * 0.35;
      const ry = b.y + lip * 0.55;
      const rw = b.w - lip;
      const rh = b.h - lip;
      ctx.fillStyle = b.roof;
      ctx.fillRect(rx, ry, rw, rh);

      // Roof texture: tar seams, a lighter north-west slope, edge shading.
      ctx.save();
      ctx.beginPath();
      ctx.rect(rx, ry, rw, rh);
      ctx.clip();
      ctx.fillStyle = 'rgba(255,255,255,0.07)';
      ctx.fillRect(rx, ry, rw, rh * 0.42);
      ctx.strokeStyle = 'rgba(0,0,0,0.07)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let yy = ry + 16; yy < ry + rh; yy += 22) {
        ctx.moveTo(rx, yy);
        ctx.lineTo(rx + rw, yy);
      }
      ctx.stroke();
      ctx.fillStyle = 'rgba(0,0,0,0.10)';
      ctx.fillRect(rx, ry + rh - 5, rw, 5);
      ctx.fillRect(rx + rw - 5, ry, 5, rh);
      ctx.restore();

      // Roof seams and a parapet edge.
      ctx.strokeStyle = 'rgba(0,0,0,0.14)';
      ctx.lineWidth = 1.2;
      ctx.strokeRect(rx + 0.5, ry + 0.5, rw - 1, rh - 1);
      ctx.strokeStyle = 'rgba(255,255,255,0.16)';
      ctx.beginPath();
      ctx.moveTo(rx + 4, ry + rh - 4);
      ctx.lineTo(rx + rw - 4, ry + rh - 4);
      ctx.stroke();

      // Lit windows in the facade lip: two rows of small warm rectangles.
      if (b.floors > 0) {
        const step = 15;
        const lit = b.windows;
        let k = 0;
        for (let x = b.x + 8; x < b.x + b.w - 10; x += step) {
          const w = lit[k % lit.length];
          k += 1;
          if (!w || !w.lit) continue;
          ctx.fillStyle = w.warm ? 'rgba(255,206,138,0.95)' : 'rgba(178,224,255,0.9)';
          ctx.fillRect(x, b.y + b.h - lip + 1.5, 6, 4.5);
        }
        // A couple down the east side too.
        ctx.save();
        ctx.translate(b.x + b.w - lip + 2.5, b.y + 10);
        ctx.rotate(Math.PI / 2);
        for (let x = 0; x < b.h - 22; x += 17) {
          const w = lit[(x / 17 | 0) % lit.length];
          if (!w || !w.lit) continue;
          ctx.fillStyle = w.warm ? 'rgba(255,206,138,0.8)' : 'rgba(178,224,255,0.75)';
          ctx.fillRect(x, 0, 6, 4);
        }
        ctx.restore();
      }

      // Door on the street side, with a small awning.
      if (b.door) {
        ctx.fillStyle = 'rgba(28,26,34,0.8)';
        ctx.fillRect(b.door.x, b.y + b.h - lip + 1, 14, 5);
        ctx.fillStyle = b.trim;
        ctx.fillRect(b.door.x - 3, b.y + b.h - lip - 2, 20, 3);
      }

      // Rooftop plant: AC units, a stair head, and a water tank on the towers.
      const acCount = b.floors > 5 ? 3 : 1 + (b.floors % 2);
      for (let i = 0; i < acCount; i++) {
        const ax = rx + rw * (0.22 + 0.28 * i);
        const ay = ry + rh * (i % 2 === 0 ? 0.24 : 0.62);
        ctx.fillStyle = 'rgba(40,44,54,0.28)';
        ctx.fillRect(ax + 2, ay + 2, 18, 13);
        ctx.fillStyle = 'rgba(214,214,206,0.75)';
        ctx.fillRect(ax, ay, 18, 13);
        ctx.strokeStyle = 'rgba(0,0,0,0.25)';
        ctx.lineWidth = 1;
        ctx.strokeRect(ax + 0.5, ay + 0.5, 17, 12);
      }
      if (b.floors > 5) {
        ctx.fillStyle = 'rgba(60,64,74,0.35)';
        ctx.beginPath();
        ctx.arc(rx + rw * 0.62, ry + rh * 0.36, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.22)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        // Antenna.
        ctx.strokeStyle = 'rgba(40,40,48,0.6)';
        ctx.beginPath();
        ctx.moveTo(rx + rw * 0.34, ry + rh * 0.72);
        ctx.lineTo(rx + rw * 0.34, ry + rh * 0.72 - 16);
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,90,80,0.9)';
        ctx.beginPath();
        ctx.arc(rx + rw * 0.34, ry + rh * 0.72 - 17, 1.8, 0, Math.PI * 2);
        ctx.fill();
      }

      // A neon sign facing the street.
      if (b.sign) {
        const glow = 0.62 + Math.sin(time * 2 + b.x * 0.01) * 0.16;
        ctx.globalAlpha = glow;
        ctx.fillStyle = b.trim;
        const sw = Math.min(b.w * 0.42, 64);
        ctx.fillRect(b.x + 10, b.y + b.h - lip - 14, sw, 11);
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#2a2430';
        ctx.font = '700 8px "Inter", "Segoe UI", system-ui, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(b.sign.text, b.x + 14, b.y + b.h - lip - 5.5);
      }
    }
  }

  // ---- props -------------------------------------------------------------

  function drawPalm(ctx, x, y, s, tilt, time) {
    ctx.save();
    ctx.translate(x, y);

    // A long palm shadow across the pavement.
    ctx.fillStyle = 'rgba(24,34,44,0.26)';
    ctx.beginPath();
    ctx.ellipse(20 * s, 10 * s, 26 * s, 9 * s, -0.35, 0, Math.PI * 2);
    ctx.fill();

    ctx.rotate(tilt + Math.sin(time * 1.1 + x * 0.01) * 0.03);

    // Trunk.
    ctx.strokeStyle = '#9d7f57';
    ctx.lineWidth = 3.4 * s;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 3 * s);
    ctx.quadraticCurveTo(-2 * s, -9 * s, -1 * s, -20 * s);
    ctx.stroke();

    // Fronds.
    ctx.strokeStyle = '#38743f';
    ctx.lineWidth = 2.8 * s;
    for (let i = 0; i < 8; i++) {
      const a = -Math.PI / 2 + (i - 3.5) * 0.4;
      ctx.beginPath();
      ctx.moveTo(-1 * s, -20 * s);
      ctx.quadraticCurveTo(
        -1 * s + Math.cos(a) * 11 * s,
        -20 * s + Math.sin(a) * 7 * s,
        -1 * s + Math.cos(a) * 19 * s,
        -20 * s + Math.sin(a) * 14 * s,
      );
      ctx.stroke();
    }
    ctx.fillStyle = '#57a05d';
    ctx.beginPath();
    ctx.arc(-1 * s, -20 * s, 3.4 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawProps(ctx, state, view, time) {
    const city = state.city;

    for (const p of city.props) {
      if (p.x < view.x0 || p.x > view.x1 || p.y < view.y0 || p.y > view.y1) continue;
      const x = p.x;
      const y = p.y;
      if (p.type === 'bench') {
        ctx.fillStyle = 'rgba(20,30,40,0.22)';
        ctx.fillRect(x - 16, y - 1, 36, 11);
        ctx.fillStyle = '#a4713f';
        ctx.fillRect(x - 15, y - 5, 30, 8);
        ctx.fillStyle = '#7c5127';
        ctx.fillRect(x - 15, y + 2, 30, 2.5);
      } else if (p.type === 'umbrella') {
        ctx.fillStyle = 'rgba(20,30,40,0.20)';
        ctx.beginPath();
        ctx.ellipse(x + 9, y + 7, 19, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#e06a5a';
        ctx.beginPath();
        ctx.arc(x, y, 16, Math.PI, 0);
        ctx.fill();
        ctx.strokeStyle = '#f6e8cc';
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.moveTo(x - 16, y);
        ctx.lineTo(x + 16, y);
        ctx.stroke();
      } else if (p.type === 'lamp') {
        ctx.fillStyle = 'rgba(20,30,40,0.24)';
        ctx.fillRect(x - 1, y - 1, 7, 7);
        ctx.strokeStyle = '#4a4f58';
        ctx.lineWidth = 2.6;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, y - 32);
        ctx.lineTo(x + 11, y - 34);
        ctx.stroke();
        const g = ctx.createRadialGradient(x + 12, y - 30, 0, x + 12, y - 30, 64);
        g.addColorStop(0, 'rgba(255,216,152,0.26)');
        g.addColorStop(1, 'rgba(255,216,152,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x + 12, y - 30, 64, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,238,196,0.95)';
        ctx.beginPath();
        ctx.arc(x + 12, y - 34, 3.6, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === 'hydrant') {
        ctx.fillStyle = '#c94b3f';
        ctx.fillRect(x - 3, y - 6, 6, 9);
        ctx.fillStyle = '#e2695c';
        ctx.fillRect(x - 4.5, y - 8, 9, 3.4);
      } else if (p.type === 'bin') {
        ctx.fillStyle = 'rgba(20,30,40,0.22)';
        ctx.fillRect(x - 4, y - 2, 12, 10);
        ctx.fillStyle = '#4a5560';
        ctx.fillRect(x - 5, y - 8, 10, 10);
        ctx.fillStyle = '#5e6b78';
        ctx.fillRect(x - 5, y - 9, 10, 2.4);
      }
    }

    for (const palm of city.palms) {
      if (palm.x < view.x0 || palm.x > view.x1 || palm.y < view.y0 || palm.y > view.y1) continue;
      drawPalm(ctx, palm.x, palm.y, palm.s, palm.tilt, time);
    }
  }

  // ---- actors ------------------------------------------------------------

  /** A person from above: head, shoulders, and a shadow that points away from the sun. */
  function drawPerson(ctx, a) {
    const x = a.x;
    const y = a.y;

    ctx.fillStyle = 'rgba(20,26,40,0.28)';
    ctx.beginPath();
    ctx.ellipse(x + 8, y + 7, a.radius * 1.25, a.radius * 0.85, 0, 0, Math.PI * 2);
    ctx.fill();

    const bob = Math.sin(a.walkPhase) * 1.5;

    ctx.save();
    ctx.translate(x, y + bob);
    ctx.rotate(a.facing + Math.PI / 2);
    ctx.fillStyle = a.shirt;
    ctx.beginPath();
    ctx.ellipse(0, 0, a.radius * 0.9, a.radius * 1.04, 0, 0, Math.PI * 2);
    ctx.fill();
    // The player wears a light shirt: an ink outline, not a white one, keeps him crisp
    // against pale pavement without turning into a glowing blob.
    ctx.strokeStyle = a.isPlayer ? 'rgba(24,30,46,0.72)' : 'rgba(0,0,0,0.22)';
    ctx.lineWidth = a.isPlayer ? 2.1 : 1;
    ctx.stroke();
    // Arms: two small caps at the shoulders, swinging with the gait.
    ctx.fillStyle = a.shirt;
    const swing = Math.sin(a.walkPhase) * 2.6;
    ctx.beginPath();
    ctx.arc(-a.radius * 0.72, swing, 2.6, 0, Math.PI * 2);
    ctx.arc(a.radius * 0.72, -swing, 2.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Head and hair.
    ctx.fillStyle = a.skin;
    ctx.beginPath();
    ctx.arc(x, y + bob - 1, a.radius * 0.56, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = a.hair;
    ctx.beginPath();
    ctx.arc(x, y + bob - 2.4, a.radius * 0.5, Math.PI * 1.05, Math.PI * 1.95);
    ctx.fill();

    // Officers: pale blue shirt, a high-visibility cap and a badge that catches the light.
    if (a.kind === 'cop') {
      ctx.fillStyle = '#cfd9ea';
      ctx.beginPath();
      ctx.arc(x, y + bob - 1, a.radius * 0.62, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1d2740';
      ctx.beginPath();
      ctx.arc(x, y + bob - 1, a.radius * 0.54, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#f2d478';
      ctx.beginPath();
      ctx.arc(x, y + bob - 1, a.radius * 0.24, 0, Math.PI * 2);
      ctx.fill();
      // A short pistol held out in front of the right shoulder.
      ctx.strokeStyle = '#1a1c22';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(a.facing + 0.4) * 5, y + bob + Math.sin(a.facing + 0.4) * 5);
      ctx.lineTo(x + Math.cos(a.facing + 0.4) * 15, y + bob + Math.sin(a.facing + 0.4) * 15);
      ctx.stroke();
    }
    // Thugs get a dark hood instead.
    if (a.kind === 'thug') {
      ctx.fillStyle = '#23262e';
      ctx.beginPath();
      ctx.arc(x, y + bob - 2, a.radius * 0.52, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /** A car from above: body, cabin, lights, a headlight cone and the police light bar. */
  function drawCar(ctx, car, time, isPlayerCar) {
    const x = car.x;
    const y = car.y;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(car.angle);

    // Shadow, offset toward the sun's opposite.
    ctx.fillStyle = 'rgba(18,24,38,0.32)';
    ctx.fillRect(-car.length / 2 + 6, -car.width / 2 + 7, car.length, car.width);

    // Headlight cone: short, soft, and only for the cars that are running.
    if (car.headlights && (car.driver === 'player' || car.driver === 'police' || car.driver === 'traffic')) {
      const g = ctx.createLinearGradient(car.length / 2, 0, car.length / 2 + 130, 0);
      g.addColorStop(0, 'rgba(255,240,200,0.22)');
      g.addColorStop(1, 'rgba(255,240,200,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(car.length / 2 - 4, -car.width / 2 + 4);
      ctx.lineTo(car.length / 2 + 130, -40);
      ctx.lineTo(car.length / 2 + 130, 40);
      ctx.lineTo(car.length / 2 - 4, car.width / 2 - 4);
      ctx.closePath();
      ctx.fill();
    }

    const l = car.length / 2;
    const w = car.width / 2;

    // Tyres.
    ctx.fillStyle = '#191b20';
    ctx.fillRect(-l + 5, -w - 2.5, 13, 4.5);
    ctx.fillRect(l - 18, -w - 2.5, 13, 4.5);
    ctx.fillRect(-l + 5, w - 2, 13, 4.5);
    ctx.fillRect(l - 18, w - 2, 13, 4.5);

    // Body.
    ctx.fillStyle = car.colour;
    roundRect(ctx, -l, -w, car.length, car.width, 6);
    ctx.fill();
    // A bright edge along the driver's side: the sun catches every car.
    ctx.strokeStyle = 'rgba(255,255,255,0.28)';
    ctx.lineWidth = 1.2;
    roundRect(ctx, -l + 1, -w + 1, car.length - 2, car.width - 2, 5);
    ctx.stroke();

    // Cabin.
    ctx.fillStyle = car.driver === 'police' ? 'rgba(30,40,58,0.62)' : 'rgba(22,28,38,0.45)';
    roundRect(ctx, -l * 0.3, -w * 0.74, car.length * 0.46, car.width * 1.48 * 0.74, 4);
    ctx.fill();
    // Windscreen.
    ctx.fillStyle = 'rgba(198,232,244,0.62)';
    roundRect(ctx, l * 0.14, -w * 0.62, 8, car.width * 0.62, 2);
    ctx.fill();

    if (car.driver === 'police') {
      // Livery: dark front doors, a white door panel with a badge, and a light bar.
      ctx.fillStyle = '#2a3a5e';
      ctx.fillRect(-l * 0.16, -w, car.length * 0.26, car.width * 0.22);
      ctx.fillRect(-l * 0.16, w - car.width * 0.22, car.length * 0.26, car.width * 0.22);
      ctx.fillStyle = '#e8eef8';
      ctx.fillRect(-l * 0.16, -w + car.width * 0.24, car.length * 0.26, car.width * 0.16);
      ctx.fillRect(-l * 0.16, w - car.width * 0.40, car.length * 0.26, car.width * 0.16);

      // The light bar: two lamps, one lit, with a beam thrown onto the tarmac beside the car.
      const phase = Math.floor(car.lightPhase * 2.4) % 2 === 0;
      const glowColour = phase ? '255,78,78' : '80,120,255';
      const beam = ctx.createRadialGradient(-4, 0, car.width * 0.3, -4, 0, 210);
      beam.addColorStop(0, `rgba(${glowColour},0.55)`);
      beam.addColorStop(0.45, `rgba(${glowColour},0.22)`);
      beam.addColorStop(1, `rgba(${glowColour},0)`);
      ctx.fillStyle = beam;
      ctx.beginPath();
      ctx.arc(-4, 0, 210, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#161a22';
      roundRect(ctx, -9, -w * 0.94, 12, w * 1.88, 2);
      ctx.fill();
      ctx.fillStyle = phase ? '#ff5252' : '#3b4a6a';
      ctx.fillRect(-8, -w * 0.9, 10, w * 0.82);
      ctx.fillStyle = phase ? '#3b4a6a' : '#5b86ff';
      ctx.fillRect(-8, w * 0.08, 10, w * 0.82);
    }

    // Tail lights and headlights.
    ctx.fillStyle = 'rgba(226,66,56,0.9)';
    ctx.fillRect(-l + 1, -w + 3.5, 3, 5);
    ctx.fillRect(-l + 1, w - 8.5, 3, 5);
    ctx.fillStyle = 'rgba(255,246,216,0.96)';
    ctx.fillRect(l - 4, -w + 3.5, 3, 5);
    ctx.fillRect(l - 4, w - 8.5, 3, 5);

    if (isPlayerCar) {
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 1.6;
      roundRect(ctx, -l - 1.5, -w - 1.5, car.length + 3, car.width + 3, 7);
      ctx.stroke();
    }

    ctx.restore();
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') {
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

  function drawMarker(ctx, marker, time) {
    const x = marker.x;
    const y = marker.y;
    const pulse = 0.78 + Math.sin(time * 3.4) * 0.22;

    const g = ctx.createRadialGradient(x, y, 0, x, y, marker.r * 1.5);
    g.addColorStop(0, `rgba(255,209,102,${0.34 * pulse})`);
    g.addColorStop(0.62, `rgba(255,209,102,${0.15 * pulse})`);
    g.addColorStop(1, 'rgba(255,209,102,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, marker.r * 1.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = `rgba(255,226,158,${0.92 * pulse})`;
    ctx.lineWidth = 2.8;
    ctx.beginPath();
    ctx.arc(x, y, marker.r * 0.7, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = `rgba(255,226,158,${0.4 * pulse})`;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(x, y, marker.r * 0.95, 0, Math.PI * 2);
    ctx.stroke();

    // A chevron bobbing above the disc.
    const bob = Math.sin(time * 3) * 5;
    ctx.fillStyle = '#ffd166';
    ctx.beginPath();
    ctx.moveTo(x, y - 42 + bob);
    ctx.lineTo(x + 11, y - 26 + bob);
    ctx.lineTo(x + 4.5, y - 26 + bob);
    ctx.lineTo(x + 4.5, y - 12 + bob);
    ctx.lineTo(x - 4.5, y - 12 + bob);
    ctx.lineTo(x - 4.5, y - 26 + bob);
    ctx.lineTo(x - 11, y - 26 + bob);
    ctx.closePath();
    ctx.fill();
  }

  function drawPickups(ctx, state, view, time) {
    for (const p of state.pickups) {
      if (p.taken) continue;
      if (p.x < view.x0 || p.x > view.x1 || p.y < view.y0 || p.y > view.y1) continue;
      const x = p.x;
      const y = p.y + Math.sin(p.bob) * 2.5;

      ctx.fillStyle = 'rgba(15,20,30,0.28)';
      ctx.beginPath();
      ctx.ellipse(x + 2, y + 10, 8, 3.6, 0, 0, Math.PI * 2);
      ctx.fill();

      const col = p.kind === 'health' ? '120,220,150' : p.kind === 'armour' ? '120,175,235' : '255,205,100';
      const glow = ctx.createRadialGradient(x, y, 0, x, y, 24);
      glow.addColorStop(0, `rgba(${col},0.5)`);
      glow.addColorStop(1, `rgba(${col},0)`);
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(x, y, 24, 0, Math.PI * 2);
      ctx.fill();

      if (p.kind === 'health') {
        ctx.fillStyle = '#eaf7ee';
        ctx.fillRect(x - 7, y - 2.4, 14, 4.8);
        ctx.fillRect(x - 2.4, y - 7, 4.8, 14);
      } else if (p.kind === 'armour') {
        ctx.fillStyle = '#cfe2f7';
        ctx.beginPath();
        ctx.moveTo(x, y - 8);
        ctx.lineTo(x + 7, y - 3.5);
        ctx.lineTo(x + 5.6, y + 5.5);
        ctx.lineTo(x, y + 9);
        ctx.lineTo(x - 5.6, y + 5.5);
        ctx.lineTo(x - 7, y - 3.5);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.fillStyle = '#ffd166';
        ctx.fillRect(x - 7, y - 5.5, 14, 11);
        ctx.fillStyle = '#a67c1a';
        ctx.fillRect(x - 2, y - 3.4, 4, 6.8);
      }
    }
  }

  function drawBullets(ctx, state) {
    ctx.strokeStyle = 'rgba(255,226,150,0.9)';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    for (const b of state.bullets) {
      const len = b.from === 'police' ? 13 : 17;
      const a = Math.atan2(b.vy, b.vx);
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(b.x - Math.cos(a) * len, b.y - Math.sin(a) * len);
    }
    ctx.stroke();
  }

  // ---- frame -------------------------------------------------------------

  /** Draw everything but the HUD and menus, in one camera transform. */
  function drawWorld(ctx, state, W, H) {
    const cam = state.camera;
    const z = cam.zoom || 1;
    const fx = state.effects;
    const view = viewRect(state, W, H);

    // Base fill: the city's own warm ground, in screen space.
    ctx.fillStyle = '#c9b998';
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    ctx.translate(W / 2 + fx.shakeX, H / 2 + fx.shakeY);
    ctx.scale(z, z);
    ctx.translate(-cam.x, -cam.y);

    drawGround(ctx, state, view);
    fx.drawSkids(ctx);
    drawBuildings(ctx, state, view, state.time);
    drawProps(ctx, state, view, state.time);
    drawPickups(ctx, state, view, state.time);

    if (state.missions.marker) drawMarker(ctx, state.missions.marker, state.time);

    // Merge cars and people into one painter's-order list so overlaps read right.
    const drawables = [];
    for (const c of state.cars()) {
      if (c.x < view.x0 || c.x > view.x1 || c.y < view.y0 || c.y > view.y1) continue;
      drawables.push({ y: c.y, kind: 'car', obj: c });
    }
    for (const p of state.peds) {
      if (p.dead && p.deadTimer > 18) continue;
      if (p.x < view.x0 || p.x > view.x1 || p.y < view.y0 || p.y > view.y1) continue;
      drawables.push({ y: p.y, kind: p.dead ? 'body' : 'ped', obj: p });
    }
    for (const h of state.hostiles) {
      if (h.x < view.x0 || h.x > view.x1 || h.y < view.y0 || h.y > view.y1) continue;
      drawables.push({ y: h.y, kind: h.dead ? 'body' : 'ped', obj: h });
    }
    if (!state.player.inCar) drawables.push({ y: state.player.y, kind: 'ped', obj: state.player });

    drawables.sort((a, b) => a.y - b.y);
    for (const d of drawables) {
      if (d.kind === 'car') {
        drawCar(ctx, d.obj, state.time, d.obj === state.player.inCar);
      } else if (d.kind === 'body') {
        const x = d.obj.x;
        const y = d.obj.y;
        ctx.fillStyle = 'rgba(20,26,40,0.20)';
        ctx.beginPath();
        ctx.ellipse(x + 6, y + 5, 15, 8, 0.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = d.obj.shirt;
        ctx.beginPath();
        ctx.ellipse(x, y, 13, 6.5, 0.7, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = d.obj.skin;
        ctx.beginPath();
        ctx.arc(x - 11, y - 4, 4, 0, Math.PI * 2);
        ctx.fill();
      } else {
        drawPerson(ctx, d.obj);
      }
    }

    // A soft ring under the player so you can always find yourself in a busy street.
    if (!state.player.inCar) {
      const p = state.player;
      const pulse = 0.55 + Math.sin(state.time * 2.4) * 0.12;
      ctx.strokeStyle = `rgba(255,214,130,${0.30 * pulse})`;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(p.x, p.y + 3, 15, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = `rgba(255,214,130,${0.12 * pulse})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(p.x, p.y + 3, 21, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Aim line and reticle, in world space.
    if (state.mode === 'playing' && !state.player.inCar) {
      const a = state.aim;
      const p = state.player;
      const reach = 190;
      ctx.strokeStyle = 'rgba(255,255,255,0.30)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(p.x + Math.cos(a) * 26, p.y + Math.sin(a) * 26);
      ctx.lineTo(p.x + Math.cos(a) * (reach - 8), p.y + Math.sin(a) * (reach - 8));
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(p.x + Math.cos(a) * reach, p.y + Math.sin(a) * reach, 5, 0, Math.PI * 2);
      ctx.stroke();
    }

    drawBullets(ctx, state);
    fx.draw(ctx);

    ctx.restore();

    // Grade: late sun from the north-west, then a warm vignette. The sun wash is a big
    // off-canvas radial, so the top-left of the frame glows and the far corner cools off
    // instead of the whole image sitting under a sepia filter.
    const sun = ctx.createRadialGradient(-W * 0.12, -H * 0.2, H * 0.1, -W * 0.12, -H * 0.2, W * 1.05);
    sun.addColorStop(0, 'rgba(255,186,120,0.17)');
    sun.addColorStop(0.42, 'rgba(255,168,110,0.075)');
    sun.addColorStop(1, 'rgba(255,150,96,0.015)');
    ctx.fillStyle = sun;
    ctx.fillRect(0, 0, W, H);
    const shade = ctx.createRadialGradient(W * 1.05, H * 1.15, H * 0.1, W * 1.05, H * 1.15, W * 0.85);
    shade.addColorStop(0, 'rgba(96,104,150,0.12)');
    shade.addColorStop(1, 'rgba(96,104,150,0)');
    ctx.fillStyle = shade;
    ctx.fillRect(0, 0, W, H);
    const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.36, W / 2, H / 2, H * 0.98);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(30,16,26,0.34)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);

    // Wanted flash at the screen edge.
    if (state.wanted.alert > 0 && state.wanted.stars > 0) {
      const a = state.wanted.alert * 0.34;
      const eg = ctx.createRadialGradient(W / 2, H / 2, H * 0.36, W / 2, H / 2, H * 0.96);
      eg.addColorStop(0, 'rgba(226,70,70,0)');
      eg.addColorStop(1, `rgba(226,70,70,${a})`);
      ctx.fillStyle = eg;
      ctx.fillRect(0, 0, W, H);
    }
  }

  PC.Render = { drawWorld, viewRect, toScreen, roundRect };
})(window);
