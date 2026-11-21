// render.js — all the drawing. Ground, roads and crosswalks, extruded buildings with
// lit windows, palm silhouettes, the sea, light pools from street lamps, and the
// per-frame actors handed in by main.js. No game logic lives here.

import { WORLD, COLORS, GRID } from './config.js';

const VIEW_PAD = 260;

export function drawScene(ctx, view) {
  const { city, camera, actors, time } = view;
  drawSky(ctx, view);
  ctx.save();
  ctx.translate(-camera.x, -camera.y);
  drawGround(ctx, city, camera, time);
  drawRoads(ctx, city, camera);
  drawLampPools(ctx, city, camera, time);
  const drawables = collectDrawables(view);
  drawables.sort((a, b) => a.depth - b.depth);
  for (const d of drawables) d.draw(ctx, time);
  drawActors(ctx, actors, city, time, camera);
  ctx.restore();
  drawVignette(ctx, view);
}

function drawSky(ctx, view) {
  const { w, h, camera } = view;
  // A dusk sky that shifts slowly with the camera's place in the city, so the
  // horizon feels like it sits beyond the streets.
  const g = ctx.createLinearGradient(0, 0, 0, h);
  const t = Math.min(1, Math.max(0, (camera.y + view.cameraH / 2) / WORLD.height));
  g.addColorStop(0, mixColor('#2a1a3d', '#37203f', t));
  g.addColorStop(0.45, mixColor('#6b2d5a', '#7d3455', t));
  g.addColorStop(0.75, '#c45a72');
  g.addColorStop(1, '#f08a63');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

function mixColor(a, b, t) {
  const pa = hex(a);
  const pb = hex(b);
  return `rgb(${Math.round(pa[0] + (pb[0] - pa[0]) * t)},${Math.round(pa[1] + (pb[1] - pa[1]) * t)},${Math.round(pa[2] + (pb[2] - pa[2]) * t)})`;
}

function hex(c) {
  const n = parseInt(c.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function inView(camera, x, y, pad = VIEW_PAD) {
  return x > camera.x - pad && y > camera.y - pad && x < camera.x + camera.w + pad && y < camera.y + camera.h + pad;
}

function drawGround(ctx, city, camera, time) {
  const x0 = Math.max(0, camera.x - 200);
  const y0 = Math.max(0, camera.y - 200);
  const x1 = Math.min(city.width, camera.x + camera.w + 200);
  const y1 = Math.min(city.height, camera.y + camera.h + 200);

  // Base blocks: asphalt-ish city floor under the sidewalks.
  ctx.fillStyle = COLORS.asphalt;
  ctx.fillRect(x0, y0, x1 - x0, y1 - y0);

  // Sidewalk slabs, one per city block.
  for (const b of city.sidewalks) {
    if (!inView(camera, b.x, b.y, 100) || b.x > x1 || b.y > y1) continue;
    ctx.fillStyle = COLORS.walk;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    // Tile seams, cheap and subtle.
    ctx.strokeStyle = 'rgba(255,255,255,0.035)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let gx = b.x + 40; gx < b.x + b.w; gx += 40) {
      ctx.moveTo(gx, b.y);
      ctx.lineTo(gx, b.y + b.h);
    }
    for (let gy = b.y + 40; gy < b.y + b.h; gy += 40) {
      ctx.moveTo(b.x, gy);
      ctx.lineTo(b.x + b.w, gy);
    }
    ctx.stroke();
  }

  // Parks and parking lots.
  for (const lot of city.lots) {
    if (!inView(camera, lot.x, lot.y, 100)) continue;
    if (lot.kind === 'park') drawParkGround(ctx, lot, time);
    else if (lot.kind === 'parking') drawParkingGround(ctx, lot);
  }

  // Beach sand with ripple bands.
  drawSand(ctx, camera, time);
  drawWater(ctx, camera, time);
}

function drawParkGround(ctx, lot, time) {
  ctx.fillStyle = COLORS.grass;
  ctx.fillRect(lot.x, lot.y, lot.w, lot.h);
  ctx.fillStyle = COLORS.grassLight;
  ctx.globalAlpha = 0.5;
  for (let i = 0; i < 7; i++) {
    const px = lot.x + ((i * 137.5) % lot.w);
    const py = lot.y + ((i * 89.3) % lot.h);
    ctx.beginPath();
    ctx.ellipse(px, py, 60, 30, (i * 0.7) % 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  // Paths crossing the park.
  ctx.strokeStyle = '#4a4152';
  ctx.lineWidth = 16;
  ctx.beginPath();
  ctx.moveTo(lot.x, lot.y + lot.h / 2);
  ctx.lineTo(lot.x + lot.w, lot.y + lot.h / 2);
  ctx.moveTo(lot.x + lot.w / 2, lot.y);
  ctx.lineTo(lot.x + lot.w / 2, lot.y + lot.h);
  ctx.stroke();
}

function drawParkingGround(ctx, lot) {
  ctx.fillStyle = '#201e2a';
  ctx.fillRect(lot.x, lot.y, lot.w, lot.h);
  ctx.strokeStyle = 'rgba(220,220,235,0.22)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let x = lot.x + 20; x < lot.x + lot.w; x += 46) {
    ctx.moveTo(x, lot.y + 20);
    ctx.lineTo(x, lot.y + 110);
    ctx.moveTo(x, lot.y + lot.h - 110);
    ctx.lineTo(x, lot.y + lot.h - 20);
  }
  ctx.stroke();
}

function drawRoads(ctx, city, camera) {
  const half = city.roadWidth / 2;

  for (const rx of city.roadsX) {
    if (!inView(camera, rx, camera.y + camera.h / 2)) continue;
    ctx.fillStyle = COLORS.asphalt;
    ctx.fillRect(rx - half, 0, city.roadWidth, city.height);
    // dashed centre line
    ctx.strokeStyle = COLORS.lane;
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 3;
    ctx.setLineDash([26, 30]);
    ctx.beginPath();
    ctx.moveTo(rx, 0);
    ctx.lineTo(rx, city.height);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  }
  for (const ry of city.roadsY) {
    if (!inView(camera, camera.x + camera.w / 2, ry)) continue;
    ctx.fillStyle = COLORS.asphalt;
    ctx.fillRect(0, ry - half, city.width, city.roadWidth);
    ctx.strokeStyle = COLORS.lane;
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 3;
    ctx.setLineDash([26, 30]);
    ctx.beginPath();
    ctx.moveTo(0, ry);
    ctx.lineTo(city.width, ry);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  }

  // Crosswalks and stop lines at every intersection in view.
  for (const rx of city.roadsX) {
    for (const ry of city.roadsY) {
      if (!inView(camera, rx, ry, 140)) continue;
      drawCrosswalk(ctx, rx, ry, city.roadWidth);
    }
  }
}

function drawCrosswalk(ctx, rx, ry, road) {
  const half = road / 2;
  ctx.fillStyle = 'rgba(235,232,245,0.55)';
  for (let i = -3; i <= 3; i++) {
    const off = i * 11;
    // north & south crossings (stripes run vertically)
    ctx.fillRect(rx + off - 3, ry - half - 22, 6, 18);
    ctx.fillRect(rx + off - 3, ry + half + 4, 6, 18);
    // east & west crossings
    ctx.fillRect(rx - half - 22, ry + off - 3, 18, 6);
    ctx.fillRect(rx + half + 4, ry + off - 3, 18, 6);
  }
}

function drawSand(ctx, camera, time) {
  const sx = WORLD.beachX;
  const sy = WORLD.beachY;
  const ex = WORLD.sandEndX;
  const ey = WORLD.sandEndY;
  if (camera.x + camera.w < sx && camera.y + camera.h < sy) return;
  ctx.fillStyle = COLORS.sand;
  ctx.fillRect(sx, 0, ex - sx, ey);
  ctx.fillRect(0, sy, ex, ey - sy);
  ctx.fillStyle = COLORS.sandLight;
  ctx.globalAlpha = 0.35;
  for (let i = 0; i < 40; i++) {
    const off = (i * 47 + Math.sin(time * 0.4 + i) * 12) % 260;
    ctx.fillRect(sx + 20 + off, 0, 3, ey);
  }
  ctx.globalAlpha = 1;
  // Wet-sand band along the water's edge.
  ctx.fillStyle = '#3f3439';
  ctx.fillRect(ex - 26, 0, 26, ey);
  ctx.fillRect(0, ey - 26, ex, 26);
}

function drawWater(ctx, camera, time) {
  const g = ctx.createLinearGradient(WORLD.sandEndX, 0, WORLD.width, WORLD.height);
  g.addColorStop(0, COLORS.water);
  g.addColorStop(1, COLORS.waterDeep);
  ctx.fillStyle = g;
  ctx.fillRect(WORLD.sandEndX, 0, WORLD.width - WORLD.sandEndX, WORLD.height);
  ctx.fillRect(0, WORLD.sandEndY, WORLD.width, WORLD.height - WORLD.sandEndY);

  // The moonlight path on the sea, a stack of soft ripples.
  ctx.save();
  ctx.globalAlpha = 0.22;
  ctx.strokeStyle = '#7fd8ff';
  ctx.lineWidth = 2;
  for (let i = 0; i < 26; i++) {
    const y = 200 + i * 62 + Math.sin(time * 0.6 + i) * 6;
    const x = WORLD.sandEndX + 60 + ((i * 71 + time * 14) % 240);
    const len = 40 + Math.sin(time + i) * 26;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + len, y);
    ctx.stroke();
  }
  ctx.globalAlpha = 0.14;
  for (let i = 0; i < 14; i++) {
    const x = 140 + i * 120 + Math.sin(time * 0.5 + i) * 10;
    const y = WORLD.sandEndY + 50 + ((i * 37 + time * 10) % 200);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 60, y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawLampPools(ctx, city, camera, time) {
  // Soft warm pools under each lamp post; additively blended so they read as light.
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const p of city.props) {
    if (p.kind !== 'lamp') continue;
    if (!inView(camera, p.x, p.y, 160)) continue;
    const flicker = 0.82 + Math.sin(time * 2.2 + p.x * 0.01) * 0.06;
    const g = ctx.createRadialGradient(p.x, p.y + 6, 4, p.x, p.y + 6, 118);
    g.addColorStop(0, `rgba(255,190,120,${0.24 * flicker})`);
    g.addColorStop(0.5, `rgba(255,150,90,${0.09 * flicker})`);
    g.addColorStop(1, 'rgba(255,140,90,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(p.x, p.y + 6, 118, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function collectDrawables(view) {
  const { city, camera } = view;
  const list = [];

  for (const p of city.props) {
    if (!inView(camera, p.x, p.y, 140)) continue;
    if (p.kind === 'palm') list.push({ depth: p.y, draw: (ctx, t) => drawPalm(ctx, p, t) });
    else if (p.kind === 'lamp') list.push({ depth: p.y, draw: (ctx) => drawLamp(ctx, p) });
    else if (p.kind === 'fountain') list.push({ depth: p.y, draw: (ctx, t) => drawFountain(ctx, p, t) });
    else if (p.kind === 'bench') list.push({ depth: p.y, draw: (ctx) => drawBench(ctx, p) });
    else if (p.kind === 'hydrant') list.push({ depth: p.y, draw: (ctx) => drawHydrant(ctx, p) });
    else if (p.kind === 'bin') list.push({ depth: p.y, draw: (ctx) => drawBin(ctx, p) });
    else if (p.kind === 'palmsign') list.push({ depth: p.y, draw: (ctx) => drawPalmSign(ctx, p) });
    else if (p.kind === 'manhole') list.push({ depth: p.y, draw: (ctx) => drawManhole(ctx, p) });
  }

  for (const b of city.buildings) {
    if (!inView(camera, b.x + b.w / 2, b.y + b.h / 2, 320)) continue;
    list.push({ depth: b.y + b.h, draw: (ctx) => drawBuilding(ctx, b) });
  }

  return list;
}

// --- props -----------------------------------------------------------------

function drawPalm(ctx, p, time) {
  const s = p.size ?? 1;
  const sway = Math.sin(time * 0.9 + p.sway) * 4 * s;
  // shadow
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.beginPath();
  ctx.ellipse(p.x + 10 * s, p.y + 6 * s, 26 * s, 10 * s, 0.3, 0, Math.PI * 2);
  ctx.fill();
  // trunk
  ctx.strokeStyle = '#3a2b2c';
  ctx.lineWidth = 6 * s;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(p.x, p.y);
  ctx.quadraticCurveTo(p.x + sway * 0.6, p.y - 40 * s, p.x + sway, p.y - 78 * s);
  ctx.stroke();
  // fronds
  const cx = p.x + sway;
  const cy = p.y - 78 * s;
  ctx.strokeStyle = '#1f4a3c';
  ctx.lineWidth = 3.4 * s;
  for (let i = 0; i < 7; i++) {
    const a = -Math.PI + (i / 6) * Math.PI + Math.sin(time * 0.8 + i + p.sway) * 0.05;
    const len = (34 + (i % 2) * 12) * s;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.quadraticCurveTo(cx + Math.cos(a) * len * 0.6, cy + Math.sin(a) * len * 0.6 - 8 * s, cx + Math.cos(a) * len, cy + Math.sin(a) * len + 10 * s);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(120,255,205,0.10)';
  ctx.beginPath();
  ctx.arc(cx, cy, 22 * s, 0, Math.PI * 2);
  ctx.fill();
}

function drawLamp(ctx, p) {
  ctx.strokeStyle = '#3b3548';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(p.x, p.y);
  ctx.lineTo(p.x, p.y - 34);
  ctx.stroke();
  ctx.fillStyle = '#ffd9a0';
  ctx.beginPath();
  ctx.arc(p.x, p.y - 36, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,205,140,0.35)';
  ctx.beginPath();
  ctx.arc(p.x, p.y - 36, 10, 0, Math.PI * 2);
  ctx.fill();
}

function drawFountain(ctx, p, time) {
  ctx.fillStyle = '#3b3446';
  ctx.beginPath();
  ctx.arc(p.x, p.y, 46, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1b4b5c';
  ctx.beginPath();
  ctx.arc(p.x, p.y, 34, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(160,240,255,0.55)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 12 + i * 8 + Math.sin(time * 2 + i) * 3, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawBench(ctx, p) {
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.rot);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(-22, -4, 46, 12);
  ctx.fillStyle = '#4a3a34';
  ctx.fillRect(-24, -8, 48, 10);
  ctx.fillStyle = '#5c4a40';
  ctx.fillRect(-24, -12, 48, 5);
  ctx.restore();
}

function drawHydrant(ctx, p) {
  ctx.fillStyle = '#8a2f3b';
  ctx.fillRect(p.x - 4, p.y - 12, 8, 13);
  ctx.fillStyle = '#b23c46';
  ctx.fillRect(p.x - 6, p.y - 8, 12, 4);
}

function drawBin(ctx, p) {
  ctx.fillStyle = '#2f3a35';
  ctx.fillRect(p.x - 6, p.y - 12, 12, 13);
  ctx.fillStyle = '#3f4d46';
  ctx.fillRect(p.x - 7, p.y - 14, 14, 3);
}

function drawManhole(ctx, p) {
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.beginPath();
  ctx.arc(p.x, p.y, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(180,175,200,0.12)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

function drawPalmSign(ctx, p) {
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.fillStyle = 'rgba(10,8,16,0.6)';
  ctx.fillRect(-34, -16, 68, 22);
  ctx.strokeStyle = '#ff5f9e';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(-34, -16, 68, 22);
  ctx.fillStyle = '#ffd9ec';
  ctx.font = '700 12px ui-sans-serif, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(p.text, 0, 0);
  ctx.restore();
}

// --- buildings --------------------------------------------------------------

function drawBuilding(ctx, b) {
  const lift = b.tower ? Math.min(150, 48 + b.h * 0.16) : 16;
  const dx = lift * 0.24;
  const dy = lift * 0.62;

  // Ground shadow toward the south-east, as if a low sun sits behind the camera.
  ctx.fillStyle = 'rgba(0,0,0,0.34)';
  ctx.fillRect(b.x + dx + 10, b.y + dy + 12, b.w, b.h);

  // South wall
  ctx.fillStyle = shade(b.tint, -0.4);
  ctx.fillRect(b.x, b.y + b.h - 2, b.w, dy + 2);
  // East wall
  ctx.fillStyle = shade(b.tint, -0.26);
  ctx.beginPath();
  ctx.moveTo(b.x + b.w, b.y);
  ctx.lineTo(b.x + b.w + dx, b.y + dy);
  ctx.lineTo(b.x + b.w + dx, b.y + b.h + dy);
  ctx.lineTo(b.x + b.w, b.y + b.h);
  ctx.closePath();
  ctx.fill();

  // Wall windows: rows of small lit rectangles on the south face.
  const rows = Math.max(1, Math.floor(dy / 12));
  for (let r = 0; r < rows; r++) {
    for (let x = b.x + 8; x < b.x + b.w - 8; x += 14) {
      const lit = pseudo(x, r, b.seed) < b.lit;
      ctx.fillStyle = lit ? 'rgba(120,240,225,0.55)' : 'rgba(30,28,42,0.6)';
      ctx.fillRect(x, b.y + b.h + 2 + r * 11, 7, 6);
    }
  }

  // Roof
  ctx.fillStyle = b.tint;
  ctx.fillRect(b.x, b.y, b.w, b.h);
  ctx.fillStyle = b.roof;
  ctx.fillRect(b.x + 6, b.y + 6, b.w - 12, b.h - 12);

  // Roof windows / skylights: little teal lights on the roof.
  const cell = 26;
  for (let gy = b.y + 10; gy < b.y + b.h - 12; gy += cell) {
    for (let gx = b.x + 10; gx < b.x + b.w - 12; gx += cell) {
      const v = pseudo(gx, gy, b.seed);
      if (v > b.lit) continue;
      ctx.fillStyle = v > b.lit - 0.12 ? 'rgba(255,215,160,0.75)' : 'rgba(90,230,210,0.5)';
      ctx.fillRect(gx, gy, 9, 6);
    }
  }

  // Roof lip and AC units.
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 2;
  ctx.strokeRect(b.x + 0.5, b.y + 0.5, b.w - 1, b.h - 1);
  ctx.fillStyle = 'rgba(20,18,28,0.8)';
  for (let i = 0; i < 3; i++) {
    const v = pseudo(b.x + i * 31, b.y, b.seed + 5);
    ctx.fillRect(b.x + 16 + v * (b.w - 40), b.y + 16 + ((v * 97) % Math.max(1, b.h - 40)), 16, 12);
  }

  // Neon sign band on some towers.
  if (b.neon) {
    ctx.fillStyle = b.neon;
    ctx.globalAlpha = 0.85;
    ctx.fillRect(b.x + 4, b.y + b.h - 6, b.w - 8, 4);
    ctx.fillRect(b.x + b.w - 6, b.y + 8, 4, b.h - 16);
    ctx.globalAlpha = 0.18;
    ctx.fillRect(b.x - 8, b.y + b.h - 14, b.w + 16, 20);
    ctx.globalAlpha = 1;
  }

  // Tall towers get a crown of antenna and a red beacon.
  if (b.tower && b.h > 260) {
    ctx.strokeStyle = '#4b4458';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(b.x + b.w * 0.5, b.y + 10);
    ctx.lineTo(b.x + b.w * 0.5, b.y - 26);
    ctx.stroke();
    ctx.fillStyle = '#ff4257';
    ctx.beginPath();
    ctx.arc(b.x + b.w * 0.5, b.y - 28, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

function pseudo(x, y, seed) {
  let h = Math.imul((x | 0) ^ 0x9e3779b9, 0x85ebca6b);
  h ^= Math.imul((y | 0) + 0x165667b1, 0xc2b2ae35);
  h ^= Math.imul(seed | 0, 0x27d4eb2f);
  h = (h ^ (h >>> 15)) >>> 0;
  return h / 4294967296;
}

function shade(color, amt) {
  const [r, g, b] = hex(color);
  const f = (v) => Math.max(0, Math.min(255, Math.round(v * (1 + amt))));
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}

// --- actors -----------------------------------------------------------------

function drawActors(ctx, actors, city, time, camera) {
  if (!actors) return;
  const list = [];
  for (const p of actors.peds) if (inView(camera, p.x, p.y, 80)) list.push({ d: p.y, f: () => drawPed(ctx, p, time) });
  for (const c of actors.cars) if (inView(camera, c.x, c.y, 160)) list.push({ d: c.y, f: () => drawCar(ctx, c, time) });
  for (const c of actors.cops) if (inView(camera, c.x, c.y, 200)) list.push({ d: c.y, f: () => drawCopCar(ctx, c, time) });
  const player = actors.player;
  if (player) list.push({ d: player.y + 4, f: () => (player.inCar ? drawCar(ctx, player.inCar, time, true) : drawPlayer(ctx, player, time)) });
  list.sort((a, b) => a.d - b.d);
  for (const item of list) item.f();
  // Bullets, tracers and particles on top of everyone.
  for (const b of actors.bullets) drawTracer(ctx, b);
}

function drawShadowEllipse(ctx, x, y, rx, ry, a = 0.3) {
  ctx.fillStyle = `rgba(0,0,0,${a})`;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawPed(ctx, p, time) {
  const bob = p.moving ? Math.sin(time * 9 + p.x * 0.1) * 1.4 : 0;
  drawShadowEllipse(ctx, p.x + 2, p.y + 4, 9, 4, 0.28);
  ctx.save();
  ctx.translate(p.x, p.y + bob);
  ctx.rotate(p.heading + Math.PI / 2);
  // legs
  const step = p.moving ? Math.sin(time * 10 + p.x) * 3 : 0;
  ctx.fillStyle = '#20202c';
  ctx.fillRect(-4, 2 + step, 3, 7);
  ctx.fillRect(1, 2 - step, 3, 7);
  // torso
  ctx.fillStyle = p.shirt;
  ctx.beginPath();
  ctx.ellipse(0, -1, 5.4, 6.6, 0, 0, Math.PI * 2);
  ctx.fill();
  // head
  ctx.fillStyle = p.skin;
  ctx.beginPath();
  ctx.arc(0, -6.5, 3.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawPlayer(ctx, p, time) {
  const bob = p.moving ? Math.sin(time * 11) * 1.6 : 0;
  drawShadowEllipse(ctx, p.x + 2, p.y + 4, 10, 4.5, 0.34);
  ctx.save();
  ctx.translate(p.x, p.y + bob);
  ctx.rotate(p.aim - Math.PI / 2);
  const step = p.moving ? Math.sin(time * 11) * 3.4 : 0;
  // legs
  ctx.fillStyle = '#1c1a26';
  ctx.fillRect(-5, 1 + step, 3.4, 8);
  ctx.fillRect(1.6, 1 - step, 3.4, 8);
  // jacket
  ctx.fillStyle = '#e8e3f0';
  ctx.beginPath();
  ctx.ellipse(0, -1.5, 6, 7.4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ff5f9e';
  ctx.fillRect(-6, -4, 12, 3);
  // arms + pistol pointing along aim
  ctx.strokeStyle = '#dcd6e6';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-4, -2);
  ctx.lineTo(-6, 4);
  ctx.moveTo(4, -2);
  ctx.lineTo(5, -7);
  ctx.stroke();
  ctx.fillStyle = '#2a2833';
  ctx.fillRect(3.4, -13, 3.2, 7);
  // head + hair
  ctx.fillStyle = '#c98d6b';
  ctx.beginPath();
  ctx.arc(0, -8, 3.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#241d2a';
  ctx.beginPath();
  ctx.arc(0, -9.4, 3.8, Math.PI, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawCar(ctx, c, time, isPlayer = false) {
  const w = c.w ?? 42;
  const h = c.h ?? 80;
  drawShadowEllipse(ctx, c.x + 3, c.y + 6, w * 0.55, h * 0.42, 0.32);
  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.rotate(c.angle + Math.PI / 2);
  // body
  ctx.fillStyle = c.color;
  roundRect(ctx, -w / 2, -h / 2, w, h, 7);
  ctx.fill();
  // bonnet / roof shading
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  roundRect(ctx, -w / 2 + 3, -h / 2 + 3, w - 6, h * 0.3, 5);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.10)';
  roundRect(ctx, -w / 2 + 4, -h * 0.02, w - 8, h * 0.24, 4);
  ctx.fill();
  // windows
  ctx.fillStyle = 'rgba(70,210,200,0.34)';
  roundRect(ctx, -w / 2 + 5, -h * 0.14, w - 10, h * 0.2, 3);
  ctx.fill();
  ctx.fillStyle = 'rgba(70,210,200,0.22)';
  roundRect(ctx, -w / 2 + 5, -h * 0.44, w - 10, h * 0.13, 3);
  ctx.fill();
  // lights
  ctx.fillStyle = c.braking ? '#ff4257' : '#ffe9c4';
  ctx.fillRect(-w / 2 + 4, -h / 2 + 1, 8, 3);
  ctx.fillRect(w / 2 - 12, -h / 2 + 1, 8, 3);
  ctx.fillStyle = c.braking ? '#ff8a95' : '#ff5a5a';
  ctx.fillRect(-w / 2 + 4, h / 2 - 4, 8, 3);
  ctx.fillRect(w / 2 - 12, h / 2 - 4, 8, 3);
  if (isPlayer) {
    ctx.strokeStyle = 'rgba(255,95,158,0.7)';
    ctx.lineWidth = 1.6;
    roundRect(ctx, -w / 2 - 1, -h / 2 - 1, w + 2, h + 2, 8);
    ctx.stroke();
  }
  ctx.restore();
}

function drawCopCar(ctx, c, time) {
  drawCar(ctx, c, time);
  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.rotate(c.angle + Math.PI / 2);
  const w = c.w ?? 42;
  const h = c.h ?? 80;
  // White doors on the dark liveried body.
  ctx.fillStyle = 'rgba(240,240,250,0.82)';
  ctx.fillRect(-w / 2, -h * 0.16, w, h * 0.2);
  // Light bar, alternating blue and red.
  const phase = Math.sin(time * 12 + c.x) > 0;
  ctx.fillStyle = phase ? '#4f8bff' : '#20306a';
  ctx.fillRect(-w / 2 + 4, -h * 0.5 + 4, w / 2 - 6, 5);
  ctx.fillStyle = phase ? '#662030' : '#ff4257';
  ctx.fillRect(1, -h * 0.5 + 4, w / 2 - 5, 5);
  ctx.restore();
  // Glow
  const r = 90 + Math.sin(time * 10) * 10;
  const g = ctx.createRadialGradient(c.x, c.y, 8, c.x, c.y, r);
  const col = Math.sin(time * 12 + c.x) > 0 ? '80,140,255' : '255,60,90';
  g.addColorStop(0, `rgba(${col},0.16)`);
  g.addColorStop(1, `rgba(${col},0)`);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
  ctx.fill();
}

function drawTracer(ctx, b) {
  ctx.strokeStyle = 'rgba(255,225,150,0.9)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(b.x, b.y);
  ctx.lineTo(b.x - b.vx * 0.02, b.y - b.vy * 0.02);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,200,120,0.5)';
  ctx.beginPath();
  ctx.arc(b.x, b.y, 3, 0, Math.PI * 2);
  ctx.fill();
}

export function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function drawVignette(ctx, view) {
  const { w, h } = view;
  const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.72);
  g.addColorStop(0, 'rgba(8,6,14,0)');
  g.addColorStop(1, 'rgba(8,6,14,0.55)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

// Ground markers: mission markers and the wanted ring sit under the actors but over the
// ground, so main.js calls these between the two passes.
export function drawGroundMarker(ctx, x, y, r, color, time, label) {
  const pulse = 0.6 + Math.sin(time * 3) * 0.2;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(x, y, r * 0.2, x, y, r);
  g.addColorStop(0, hexToRgba(color, 0.34 * pulse));
  g.addColorStop(0.7, hexToRgba(color, 0.16 * pulse));
  g.addColorStop(1, hexToRgba(color, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = hexToRgba(color, 0.75);
  ctx.lineWidth = 2;
  ctx.setLineDash([10, 10]);
  ctx.lineDashOffset = -time * 24;
  ctx.beginPath();
  ctx.arc(x, y, r * 0.72, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  if (label) {
    ctx.fillStyle = color;
    ctx.font = '700 12px ui-sans-serif, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(label, x, y - r * 0.72 - 8);
  }
}

export function hexToRgba(color, a) {
  if (color.startsWith('#')) {
    const [r, g, b] = hex(color);
    return `rgba(${r},${g},${b},${a})`;
  }
  return color;
}
