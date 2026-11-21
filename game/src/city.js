// Palm City — the city itself: a seeded grid of blocks, a beach along the south shore,
// palms, lit windows and the street props a dense downtown needs.
//
// Nothing here is drawn: city.js builds a plain-data description of the world (roads,
// lots, buildings, props, parked cars, mission anchors) that every other module reads.
(function (global) {
  'use strict';

  const PC = global.PC;
  const { GRID, CELL, ROAD, SIDEWALK, BEACH_ROW, PALETTE, FACADES, CAR_COLOURS } = PC;

  /** Which cells are beach. The last row is sand; the second-to-last holds the promenade. */
  function isBeachCell(row) {
    return row >= BEACH_ROW;
  }

  /** A block's lot rectangle: the cell inset by the road and the sidewalk. */
  function lotRect(col, row) {
    const x = col * CELL + ROAD / 2 + SIDEWALK;
    const y = row * CELL + ROAD / 2 + SIDEWALK;
    const size = CELL - ROAD - SIDEWALK * 2;
    return { x, y, w: size, h: size };
  }

  /** The centre of the road seam between two columns, at a row's mid-height. */
  function seamX(col) {
    return col * CELL + CELL / 2;
  }
  function seamY(row) {
    return row * CELL + CELL / 2;
  }

  /**
   * Cut one lot into building footprints. Downtown (near the middle columns) gets tall
   * towers on a bigger footprint; the waterfront and the edges get low blocks and shops.
   */
  function subdivideLot(rand, lot, downtown) {
    const out = [];
    const count = downtown ? rand.int(1, 2) : rand.int(1, 3);
    if (count === 1) {
      out.push({ x: lot.x, y: lot.y, w: lot.w, h: lot.h });
      return out;
    }
    if (count === 2) {
      if (rand.chance(0.5)) {
        const cut = lot.w * rand.range(0.42, 0.58);
        out.push({ x: lot.x, y: lot.y, w: cut - 8, h: lot.h });
        out.push({ x: lot.x + cut + 8, y: lot.y, w: lot.w - cut - 8, h: lot.h });
      } else {
        const cut = lot.h * rand.range(0.42, 0.58);
        out.push({ x: lot.x, y: lot.y, w: lot.w, h: cut - 8 });
        out.push({ x: lot.x, y: lot.y + cut + 8, w: lot.w, h: lot.h - cut - 8 });
      }
      return out;
    }
    // Three: a wide block at the top and two shops under it.
    const cut = lot.h * rand.range(0.4, 0.55);
    out.push({ x: lot.x, y: lot.y, w: lot.w, h: cut - 8 });
    const half = lot.w / 2;
    out.push({ x: lot.x, y: lot.y + cut + 8, w: half - 6, h: lot.h - cut - 8 });
    out.push({ x: lot.x + half + 6, y: lot.y + cut + 8, w: half - 6, h: lot.h - cut - 8 });
    return out;
  }

  /** Lit windows: a deterministic grid of quads, some dark, some warm, some cool. */
  function buildWindows(rand, box, floors) {
    const wins = [];
    const cols = Math.max(2, Math.floor(box.w / 30));
    const rows = Math.max(2, floors);
    const pw = box.w / cols;
    const ph = box.h / rows;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const on = rand.chance(0.42);
        wins.push({
          x: box.x + c * pw + pw * 0.22,
          y: box.y + r * ph + ph * 0.22,
          w: pw * 0.56,
          h: ph * 0.5,
          lit: on,
          warm: rand.chance(0.72),
        });
      }
    }
    return wins;
  }

  /**
   * Build the whole city. `seed` makes it identical every run; the object returned is
   * read-only as far as the rest of the game is concerned.
   */
  function build(seed) {
    const rand = PC.rng(seed || 20261121);
    const buildings = [];
    const lots = [];
    const palms = [];
    const props = [];
    const parks = [];
    const parkedCars = [];
    const anchors = [];

    for (let row = 0; row < GRID; row++) {
      for (let col = 0; col < GRID; col++) {
        if (isBeachCell(row)) continue;
        const lot = lotRect(col, row);
        const cx = col - (GRID - 1) / 2;
        const cy = row - (GRID - 1) / 2;
        const downtown = Math.abs(cx) < 2.5 && Math.abs(cy) < 2.2;

        // A couple of blocks are pocket parks instead of buildings.
        if (!downtown && rand.chance(0.07)) {
          parks.push({ x: lot.x, y: lot.y, w: lot.w, h: lot.h, seed: rand.int(0, 9999) });
          for (let i = 0; i < 4; i++) {
            palms.push({
              x: lot.x + rand.range(20, lot.w - 20),
              y: lot.y + rand.range(20, lot.h - 20),
              s: rand.range(0.85, 1.15),
              tilt: rand.range(-0.18, 0.18),
            });
          }
          continue;
        }

        lots.push(lot);
        const parts = subdivideLot(rand, lot, downtown);
        for (const box of parts) {
          const facade = rand.pick(FACADES);
          const floors = downtown ? rand.int(6, 12) : rand.int(1, 4);
          const height = downtown ? rand.range(26, 54) : rand.range(8, 18);
          buildings.push({
            x: box.x,
            y: box.y,
            w: box.w,
            h: box.h,
            floors,
            height,
            wall: facade.wall,
            trim: facade.trim,
            roof: facade.roof,
            windows: buildWindows(rand, box, Math.min(floors + 2, 8)),
            door: rand.chance(0.6)
              ? { x: box.x + box.w * rand.range(0.3, 0.7), y: box.y + box.h - 6, w: 16, h: 6 }
              : null,
            sign: rand.chance(0.35)
              ? { text: rand.pick(['CAFÉ', 'LIQUOR', 'HOTEL', 'PAWN', 'TACOS', 'MOTEL', 'SURF', 'CLINIC']), x: box.x + 8, y: box.y + 8 }
              : null,
          });
        }
      }
    }

    // The promenade: palms and benches along the beach edge, plus umbrellas on the sand.
    const beachTop = BEACH_ROW * CELL;
    for (let col = 0; col < GRID; col++) {
      const baseX = col * CELL + CELL / 2;
      palms.push({ x: baseX + rand.range(-40, 40), y: beachTop + rand.range(10, 44), s: rand.range(0.95, 1.3), tilt: rand.range(-0.22, 0.22) });
      if (rand.chance(0.7)) {
        props.push({ type: 'bench', x: baseX + rand.range(-70, 70), y: beachTop + rand.range(46, 70), a: 0 });
      }
      if (rand.chance(0.5)) {
        props.push({ type: 'umbrella', x: baseX + rand.range(-80, 80), y: beachTop + rand.range(90, 150) });
      }
    }

    // Street props on the corner of every downtown block: lamps, hydrants, bins, crates.
    for (let row = 0; row < GRID - 1; row++) {
      for (let col = 0; col < GRID - 1; col++) {
        if (rand.chance(0.55)) {
          props.push({
            type: 'lamp',
            x: col * CELL + ROAD / 2 - 6,
            y: row * CELL + ROAD / 2 - 6,
          });
        }
        if (rand.chance(0.25)) {
          props.push({ type: 'hydrant', x: col * CELL + CELL - ROAD / 2 + 6, y: row * CELL + CELL - ROAD / 2 + 6 });
        }
        if (rand.chance(0.22)) {
          props.push({ type: 'bin', x: col * CELL + rand.range(20, CELL - 20), y: row * CELL + ROAD / 2 - 10 });
        }
      }
    }

    // Parked cars along the kerb, two per seam, facing the traffic direction.
    for (let row = 0; row < GRID; row++) {
      for (let col = 0; col < GRID; col++) {
        if (isBeachCell(row)) continue;
        if (rand.chance(0.34)) {
          const along = rand.chance(0.5);
          const x = along ? col * CELL + rand.range(30, CELL - 30) : col * CELL + ROAD / 2 - PC.CAR.width / 2 - 6;
          const y = along ? row * CELL + ROAD / 2 - PC.CAR.width / 2 - 6 : row * CELL + rand.range(30, CELL - 30);
          parkedCars.push({
            x,
            y,
            angle: along ? 0 : Math.PI / 2,
            colour: rand.pick(CAR_COLOURS),
          });
        }
      }
    }

    // Story anchors: seven fixed spots the mission chain visits.
    const mid = Math.floor(GRID / 2);
    anchors.push({ id: 'garage', x: seamX(mid) - 30, y: seamY(mid + 2), name: 'Rustline Garage' });
    anchors.push({ id: 'pier', x: CELL * (GRID - 3) + CELL / 2, y: beachTop + 120, name: 'Coral Pier' });
    anchors.push({ id: 'bank', x: seamX(mid - 2), y: seamY(mid - 2), name: 'Sunstate Bank' });
    anchors.push({ id: 'docks', x: CELL * 1 + CELL / 2, y: CELL * (GRID - 2) + 40, name: 'North Docks' });
    anchors.push({ id: 'club', x: seamX(mid + 3), y: seamY(mid - 1), name: 'Neon Flamingo Club' });
    anchors.push({ id: 'studio', x: CELL * (GRID - 2) + CELL / 2, y: seamY(1), name: 'Waveform Studios' });
    anchors.push({ id: 'villa', x: CELL * (GRID - 3) + CELL / 2, y: CELL * 2 + CELL / 2, name: 'Casa Marbella' });

    return {
      seed: seed || 20261121,
      buildings,
      lots,
      parks,
      palms,
      props,
      parkedCars,
      anchors,
      beachTop,
      waterTop: beachTop + CELL * 0.68,
    };
  }

  /** The nearest lane centre for a given axis, used by traffic and cop spawns. */
  function laneCoord(index, axisOffset) {
    return index * CELL + CELL / 2 + axisOffset;
  }

  /** True when a circle at (x, y) with radius r overlaps any building footprint. */
  function hitsBuilding(city, x, y, r) {
    for (const b of city.buildings) {
      const nx = PC.clamp(x, b.x, b.x + b.w);
      const ny = PC.clamp(y, b.y, b.y + b.h);
      const dx = x - nx;
      const dy = y - ny;
      if (dx * dx + dy * dy < r * r) return b;
    }
    return null;
  }

  /** True when (x, y) is on drivable asphalt (any road seam), within the map. */
  function onRoad(x, y) {
    if (x < 0 || y < 0 || x > GRID * CELL || y > GRID * CELL) return false;
    const mx = ((x % CELL) + CELL) % CELL;
    const my = ((y % CELL) + CELL) % CELL;
    const half = ROAD / 2;
    const nearSeamX = mx < half || mx > CELL - half;
    const nearSeamY = my < half || my > CELL - half;
    return nearSeamX || nearSeamY;
  }

  /** True when (x, y) is sand or sea, off the road grid. */
  function onBeach(city, y) {
    return y >= city.beachTop;
  }

  PC.City = { build, lotRect, subdivideLot, hitsBuilding, onRoad, onBeach, isBeachCell, laneCoord, seamX, seamY };
})(window);
