// city.js — builds Palm City: a road grid, blocks of towers and low-rise motels,
// parking lots, a palm-lined beach on the east and south, and the collision data
// the rest of the game queries. Nothing here draws; render.js reads it.

import { WORLD, GRID, ROAD_X, ROAD_Y, COLORS } from './config.js';
import { makeRng, hashFloat } from './random.js';

const TOWER_TINTS = ['#2b2a3d', '#323046', '#262638', '#38334a', '#2e2a3a', '#343140'];
const LOW_TINTS = ['#3d3140', '#453645', '#3a3346', '#4a3a44', '#40354a', '#4b4147'];

// The city is generated once from the seed and never mutated afterwards, so the
// same ?seed= always opens the same Palm City.
export function buildCity(seed = 1) {
  const rng = makeRng(seed);
  const city = {
    seed,
    width: WORLD.width,
    height: WORLD.height,
    roadsX: ROAD_X,
    roadsY: ROAD_Y,
    roadWidth: GRID.road,
    sidewalks: [],
    buildings: [],
    lots: [],
    props: [],
    parkingSpots: [],
    districts: [],
    water: [
      { x: WORLD.sandEndX, y: 0, w: WORLD.width - WORLD.sandEndX, h: WORLD.height },
      { x: 0, y: WORLD.sandEndY, w: WORLD.width, h: WORLD.height - WORLD.sandEndY },
    ],
    sand: { x: WORLD.beachX, y: 0, w: WORLD.sandEndX - WORLD.beachX, h: WORLD.sandEndY },
  };

  const cols = GRID.cols;
  const rows = GRID.rows;

  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      const x0 = ROAD_X[c] + GRID.road / 2;
      const y0 = ROAD_Y[r] + GRID.road / 2;
      const x1 = ROAD_X[c + 1] - GRID.road / 2;
      const y1 = ROAD_Y[r + 1] - GRID.road / 2;
      const block = { x: x0, y: y0, w: x1 - x0, h: y1 - y0, col: c, row: r };
      const nearBeach = c >= cols - 1 || r >= rows - 1;
      const downtown = c >= 1 && c <= 3 && r <= 1;
      block.kind = pickBlockKind(rng, c, r, nearBeach, downtown);
      block.tint = nearBeach ? '#2a2733' : downtown ? '#242333' : '#272533';
      city.sidewalks.push(block);

      if (block.kind === 'park') buildPark(city, block, rng);
      else if (block.kind === 'parking') buildParkingLot(city, block, rng);
      else buildBlockBuildings(city, block, rng, { nearBeach, downtown });

      decorateBlockEdges(city, block, rng, nearBeach);
    }
  }

  // Palm trees along the sand and the beach promenade, plus lamp posts up the avenues.
  scatterPalms(city, rng);
  scatterStreetProps(city);

  city.districts = [
    { name: 'Kestrel Heights', x: ROAD_X[1], y: ROAD_Y[0], w: ROAD_X[4] - ROAD_X[1], h: ROAD_Y[2] - ROAD_Y[0], tone: 'towers' },
    { name: 'Neon Row', x: ROAD_X[0], y: ROAD_Y[2], w: ROAD_X[3] - ROAD_X[0], h: ROAD_Y[4] - ROAD_Y[2], tone: 'nightlife' },
    { name: 'Marisol Beach', x: ROAD_X[4], y: ROAD_Y[0], w: WORLD.width - ROAD_X[4], h: WORLD.height, tone: 'beach' },
    { name: 'Dockside', x: ROAD_X[0], y: ROAD_Y[3], w: ROAD_X[3] - ROAD_X[0], h: WORLD.height - ROAD_Y[3], tone: 'industrial' },
  ];

  city.minimap = buildMinimapImage(city);
  city.grid = buildCollisionGrid(city);
  return city;
}

function pickBlockKind(rng, c, r, nearBeach, downtown) {
  if (downtown) return rng.chance(0.82) ? 'buildings' : 'plaza';
  if (c === 2 && r === 2) return 'park';
  if (nearBeach) return rng.chance(0.55) ? 'buildings' : 'parking';
  if (rng.chance(0.24)) return 'parking';
  if (rng.chance(0.1)) return 'park';
  return 'buildings';
}

function buildBlockBuildings(city, block, rng, opts) {
  const pad = 26;
  const x = block.x + pad;
  const y = block.y + pad;
  const w = block.w - pad * 2;
  const h = block.h - pad * 2;

  // Split the block into one to four lots, then one tall or two short buildings a lot.
  const splitX = rng.chance(0.55) ? 1 : 2;
  const splitY = rng.chance(0.5) ? 1 : 2;
  for (let cx = 0; cx < splitX; cx++) {
    for (let cy = 0; cy < splitY; cy++) {
      const lw = w / splitX;
      const lh = h / splitY;
      const lx = x + cx * lw + 5;
      const ly = y + cy * lh + 5;
      const innerW = lw - 10;
      const innerH = lh - 10;
      const towers = opts.downtown ? rng.chance(0.72) : rng.chance(0.2);
      if (towers) {
        const bw = innerW * rng.float(0.6, 0.95);
        const bh = innerH * rng.float(0.6, 0.95);
        addBuilding(city, lx + rng.float(0, innerW - bw), ly + rng.float(0, innerH - bh), bw, bh, rng, {
          tall: true,
          tint: rng.pick(TOWER_TINTS),
        });
      } else {
        const rows2 = rng.chance(0.45) ? 2 : 1;
        for (let k = 0; k < rows2; k++) {
          const bw = innerW * rng.float(0.55, 0.92);
          const bh = (innerH / rows2) * rng.float(0.55, 0.88);
          addBuilding(city, lx + rng.float(0, innerW - bw), ly + (innerH / rows2) * k + 4, bw, bh, rng, {
            tall: false,
            tint: rng.pick(LOW_TINTS),
          });
        }
      }
      if (rng.chance(0.3)) {
        city.lots.push({ x: lx, y: ly, w: innerW, h: innerH, kind: 'yard' });
        city.parkingSpots.push({ x: lx + innerW - 46, y: ly + innerH * 0.4, facing: Math.PI / 2 });
      }
    }
  }
}

function addBuilding(city, x, y, w, h, rng, opts) {
  if (w < 40 || h < 40) return;
  const b = {
    x,
    y,
    w,
    h,
    tint: opts.tint,
    tower: opts.tall,
    lit: 0.35 + rng.float(0, 0.4),
    seed: rng.int(1, 99999),
    neon: rng.chance(opts.tall ? 0.55 : 0.3) ? rng.pick(['#ff5f9e', '#4fe3cd', '#ffc061', '#7a5cff']) : null,
    roof: rng.chance(0.5) ? '#1d1b27' : '#22202d',
  };
  city.buildings.push(b);
}

function buildPark(city, block, rng) {
  city.lots.push({ x: block.x + 22, y: block.y + 22, w: block.w - 44, h: block.h - 44, kind: 'park' });
  const cx = block.x + block.w / 2;
  const cy = block.y + block.h / 2;
  for (let i = 0; i < 10; i++) {
    const a = rng.float(0, Math.PI * 2);
    const r = rng.float(60, Math.min(block.w, block.h) * 0.38);
    city.props.push({
      kind: 'palm',
      x: cx + Math.cos(a) * r,
      y: cy + Math.sin(a) * r * 0.8,
      size: rng.float(0.85, 1.25),
      sway: rng.float(0, 6.28),
    });
  }
  city.props.push({ kind: 'fountain', x: cx, y: cy, size: 1 });
  city.props.push({ kind: 'bench', x: cx - 90, y: cy + 70, rot: 0 });
  city.props.push({ kind: 'bench', x: cx + 90, y: cy + 70, rot: Math.PI });
}

function buildParkingLot(city, block, rng) {
  const x = block.x + 30;
  const y = block.y + 30;
  const w = block.w - 60;
  const h = block.h - 60;
  city.lots.push({ x, y, w, h, kind: 'parking' });
  const stallW = 46;
  const stallH = 96;
  const cols = Math.max(1, Math.floor(w / stallW) - 1);
  const rowsN = Math.max(1, Math.floor(h / (stallH * 2 + 30)));
  for (let k = 0; k < rowsN; k++) {
    for (let i = 0; i < cols; i++) {
      if (rng.chance(0.42)) continue;
      city.parkingSpots.push({
        x: x + 30 + i * stallW,
        y: y + 40 + k * (stallH * 2 + 34),
        facing: k % 2 === 0 ? Math.PI / 2 : -Math.PI / 2,
      });
    }
  }
  // A little kiosk in one corner so the lot is not empty of architecture.
  addBuilding(city, x + w - 120, y + h - 100, 100, 80, rng, { tall: false, tint: '#3c3040' });
}

function decorateBlockEdges(city, block, rng, nearBeach) {
  // Street lamps on the sidewalk corners of each block.
  const inset = 12;
  city.props.push({ kind: 'lamp', x: block.x + inset, y: block.y + inset, rot: 0 });
  city.props.push({ kind: 'lamp', x: block.x + block.w - inset, y: block.y + inset, rot: 0 });
  if (rng.chance(0.5)) city.props.push({ kind: 'lamp', x: block.x + inset, y: block.y + block.h - inset, rot: 0 });
  if (nearBeach && rng.chance(0.6)) {
    city.props.push({ kind: 'palmsign', x: block.x + block.w * 0.5, y: block.y + 6, text: rng.pick(['HOTEL', 'MOTEL', 'TIKI', 'SURF', 'BAR']) });
  }
  if (rng.chance(0.35)) city.props.push({ kind: 'hydrant', x: block.x + block.w * 0.5 + rng.float(-80, 80), y: block.y + 8 });
  if (rng.chance(0.4)) city.props.push({ kind: 'bin', x: block.x + 40 + rng.float(0, 60), y: block.y + block.h - 14 });
}

function scatterPalms(city, rng) {
  // Palms line the beach band and the promenade road on its west side.
  for (let y = 120; y < WORLD.sandEndY - 40; y += rng.float(70, 120)) {
    city.props.push({ kind: 'palm', x: WORLD.beachX + rng.float(20, 80), y, size: rng.float(0.9, 1.35), sway: rng.float(0, 6.28) });
    if (rng.chance(0.6)) city.props.push({ kind: 'palm', x: WORLD.beachX + rng.float(180, 320), y: y + rng.float(-30, 30), size: rng.float(0.7, 1.1), sway: rng.float(0, 6.28) });
  }
  for (let x = 120; x < WORLD.sandEndX - 40; x += rng.float(80, 130)) {
    city.props.push({ kind: 'palm', x, y: WORLD.beachY + rng.float(20, 80), size: rng.float(0.9, 1.3), sway: rng.float(0, 6.28) });
  }
  // A few palms in the middle of town, in the park block's neighbours.
  for (const lot of city.lots) {
    if (lot.kind === 'park') continue;
    if (rng.chance(0.18)) {
      city.props.push({ kind: 'palm', x: lot.x + rng.float(0, lot.w), y: lot.y + rng.float(0, lot.h), size: rng.float(0.6, 0.9), sway: rng.float(0, 6.28) });
    }
  }
}

function scatterStreetProps(city) {
  // Crosswalk stripes and stop lines are drawn from the road grid itself in render.js;
  // here we only add a few manhole covers and newspaper boxes as ground detail.
  for (let i = 0; i < 40; i++) {
    city.props.push({ kind: 'manhole', x: 400 + hashFloat(i, 7, 3) * 4200, y: 300 + hashFloat(i, 11, 5) * 2600 });
  }
}

// --- collision -------------------------------------------------------------

function buildCollisionGrid(city) {
  const cell = 200;
  const cols = Math.ceil(city.width / cell);
  const rows = Math.ceil(city.height / cell);
  const cells = new Array(cols * rows);
  for (let i = 0; i < cells.length; i++) cells[i] = [];
  city.buildings.forEach((b, index) => {
    const c0 = Math.floor(b.x / cell);
    const c1 = Math.floor((b.x + b.w) / cell);
    const r0 = Math.floor(b.y / cell);
    const r1 = Math.floor((b.y + b.h) / cell);
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        if (r < 0 || c < 0 || r >= rows || c >= cols) continue;
        cells[r * cols + c].push(index);
      }
    }
  });
  return { cell, cols, rows, cells };
}

// Returns the building a circle overlaps, or null.
export function buildingAt(city, x, y, radius = 0) {
  const g = city.grid;
  const c = Math.floor(x / g.cell);
  const r = Math.floor(y / g.cell);
  if (c < 0 || r < 0 || c >= g.cols || r >= g.rows) return null;
  const list = g.cells[r * g.cols + c];
  for (let i = 0; i < list.length; i++) {
    const b = city.buildings[list[i]];
    const nx = Math.max(b.x, Math.min(x, b.x + b.w));
    const ny = Math.max(b.y, Math.min(y, b.y + b.h));
    const dx = x - nx;
    const dy = y - ny;
    if (dx * dx + dy * dy < radius * radius) return b;
  }
  return null;
}

export function insideWater(x, y, radius = 0) {
  if (x + radius > WORLD.sandEndX) return true;
  if (y + radius > WORLD.sandEndY) return true;
  return false;
}

// True when a circle may stand at (x, y): inside the world, off the water, out of buildings.
export function walkable(city, x, y, radius = 10) {
  if (x - radius < 20 || y - radius < 20 || x + radius > city.width - 20 || y + radius > city.height - 20) return false;
  if (insideWater(x, y, radius)) return false;
  return !buildingAt(city, x, y, radius);
}

// True for road surface (used by traffic and by the wanted-cooling rule).
export function onRoad(city, x, y) {
  const half = city.roadWidth / 2;
  for (const rx of city.roadsX) if (Math.abs(x - rx) < half) return true;
  for (const ry of city.roadsY) if (Math.abs(y - ry) < half) return true;
  return false;
}

// --- minimap base image ----------------------------------------------------

function buildMinimapImage(city) {
  const scale = 0.05;
  const w = Math.ceil(city.width * scale);
  const h = Math.ceil(city.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext('2d');
  g.fillStyle = '#141220';
  g.fillRect(0, 0, w, h);
  g.fillStyle = '#0f2b37';
  g.fillRect(WORLD.sandEndX * scale, 0, w, h);
  g.fillRect(0, WORLD.sandEndY * scale, w, h);
  g.fillStyle = '#4a3b3f';
  g.fillRect(WORLD.beachX * scale, 0, (WORLD.sandEndX - WORLD.beachX) * scale, WORLD.sandEndY * scale);
  g.fillRect(0, WORLD.beachY * scale, WORLD.sandEndX * scale, (WORLD.sandEndY - WORLD.beachY) * scale);
  g.fillStyle = '#3a3548';
  for (const rx of city.roadsX) g.fillRect(rx * scale - 3, 0, 6, h);
  for (const ry of city.roadsY) g.fillRect(0, ry * scale - 3, w, 6);
  g.fillStyle = '#57506b';
  for (const b of city.buildings) g.fillRect(b.x * scale, b.y * scale, Math.max(1, b.w * scale), Math.max(1, b.h * scale));
  g.fillStyle = '#2b4438';
  for (const lot of city.lots) if (lot.kind === 'park') g.fillRect(lot.x * scale, lot.y * scale, lot.w * scale, lot.h * scale);
  return canvas;
}

// A safe spawn on a sidewalk corner near downtown.
export function findSpawn(city) {
  const b = city.sidewalks.find((s) => s.col === 2 && s.row === 2) ?? city.sidewalks[0];
  return { x: b.x + b.w / 2, y: b.y + b.h / 2 };
}
