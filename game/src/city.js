/* Palm City — the city itself: a procedural grid of blocks, roads, beach and props.
   Generated once from a seed into plain data (buildings as rectangles with colours and window
   patterns, palms, lamps, parking stalls), then drawn visible-first each frame. Buildings are
   solid: colliders() feeds the player's and cars' collision checks. */
(function (PC) {
  'use strict';

  var C = PC.CONFIG, P = PC.PALETTE, U = PC.util;
  var CELL = C.CELL, ROAD = C.ROAD, GRID = C.GRID, CITY_W = C.CITY_W, CITY_H = C.CITY_H;
  var HALF_ROAD = ROAD / 2, BLOCK = CELL - ROAD, BEACH_TOP = CITY_H;

  var ROOF_COLORS = ['#c9a184', '#b98f74', '#d3b295', '#a9826b', '#c28f7e', '#9fb0a6', '#b7a58c', '#ccb39a'];
  var WALL_COLORS = ['#e8cfa8', '#f0dcc0', '#e3b7a0', '#d9c3a6', '#efe0c8', '#cfb79c', '#e9c6b4', '#dcd2bd'];
  var AWNINGS = ['#d9534f', '#3f8f8a', '#e0a03c', '#6b7fb0', '#c96a8a', '#4f9d6a'];
  var SIGN_TEXTS = ['HOTEL', 'CAFE', 'LIQUOR', 'DINER', 'PAWN', 'MOTEL', 'TACOS', 'GARAGE', 'SURF', 'CLUB', 'MARKET', 'BARBER', 'PHARMACY', 'ARCADE'];
  var ROOF_UNITS = 5;

  function blockAt(cx, cy) { return { x: cx * CELL, y: cy * CELL }; }

  /* ---------- generation ---------- */

  function generateCity(seed) {
    var rng = PC.makeRng(seed ^ 0x9e3779b9);
    var city = {
      blocks: [], buildings: [], palms: [], lamps: [], benches: [], umbrellas: [],
      parkingSpots: [], fountains: [], parkTrees: [], seed: seed
    };

    for (var gy = 0; gy < GRID; gy++) {
      for (var gx = 0; gx < GRID; gx++) {
        var bx = gx * CELL + HALF_ROAD;
        var by = gy * CELL + HALF_ROAD;
        var block = { gx: gx, gy: gy, x: bx, y: by, w: BLOCK, h: BLOCK, kind: 'shops', buildings: [], props: [] };

        // Distance from the beach drives density: towers near the water, sprawl inland.
        var beachDist = 1 - gy / (GRID - 1);
        var roll = rng();
        if (gy >= GRID - 3 && beachDist > 0.55 && roll < 0.55) block.kind = 'downtown';
        else if (roll < 0.10) block.kind = 'park';
        else if (roll < 0.20) block.kind = 'lot';
        else if (roll < 0.30) block.kind = 'residential';
        else if (roll < 0.36) block.kind = 'plaza';
        else block.kind = 'shops';

        // Keep the middle of the city a park so on-foot play has an open landmark.
        if (gx === 8 && gy === 8) block.kind = 'park';
        if (gx === 0 && gy === 0) block.kind = 'plaza';

        buildBlock(city, block, rng, gx, gy);
        city.blocks.push(block);
      }
    }

    buildStreets(city, rng);
    buildBeach(city, rng);
    return city;
  }

  function buildBlock(city, block, rng, gx, gy) {
    var pad = 12;
    var ix = block.x + pad, iy = block.y + pad;
    var iw = block.w - pad * 2, ih = block.h - pad * 2;

    if (block.kind === 'downtown') {
      var n = 1 + Math.floor(rng() * 2.4);
      if (n === 1) {
        city.buildings.push(makeBuilding(rng, ix, iy, iw, ih, 'tower', 0));
      } else {
        var split = [0.42 + rng() * 0.16, 0.44 + rng() * 0.18];
        city.buildings.push(makeBuilding(rng, ix, iy, iw * split[0] - 6, ih, 'tower', 0));
        city.buildings.push(makeBuilding(rng, ix + iw * split[0] + 2, iy, iw * (1 - split[0]) - 8, ih * split[1] - 6, 'tower', 1));
        city.buildings.push(makeBuilding(rng, ix + iw * split[0] + 2, iy + ih * split[1] + 2, iw * (1 - split[0]) - 8, ih * (1 - split[1]) - 8, 'tower', 2));
      }
      block.props.push({ kind: 'planters', x: ix + 6, y: iy + ih - 16 });
    } else if (block.kind === 'shops') {
      var shops = 2 + Math.floor(rng() * 2);
      var w = iw / shops;
      for (var i = 0; i < shops; i++) {
        city.buildings.push(makeBuilding(rng, ix + i * w + 2, iy + rng() * 18, w - 8, ih - 30 - rng() * 24, 'shop', i));
      }
      addBlockProps(city, block, rng, 3);
    } else if (block.kind === 'residential') {
      var cx = ix + iw * 0.5, cy = iy + ih * 0.5;
      var hw = iw * (0.34 + rng() * 0.12), hh = ih * (0.3 + rng() * 0.12);
      city.buildings.push(makeBuilding(rng, cx - hw, cy - hh, hw * 2, hh * 2, 'house', 0));
      city.buildings[city.buildings.length - 1].pool = rng() < 0.55;
      addBlockProps(city, block, rng, 4);
    } else if (block.kind === 'park') {
      block.props.push({ kind: 'grass', x: block.x + 6, y: block.y + 6, w: block.w - 12, h: block.h - 12 });
      for (var t = 0; t < 7; t++) {
        city.parkTrees.push({
          x: block.x + 26 + rng() * (block.w - 52),
          y: block.y + 26 + rng() * (block.h - 52),
          r: 15 + rng() * 9, sway: rng() * 6.28
        });
      }
      city.fountains.push({ x: block.x + block.w * 0.5, y: block.y + block.h * 0.55, r: 26 });
    } else if (block.kind === 'lot') {
      block.props.push({ kind: 'lot', x: block.x + 10, y: block.y + 10, w: block.w - 20, h: block.h - 20 });
      var stalls = 4;
      for (var s = 0; s < stalls; s++) {
        city.parkingSpots.push({ x: block.x + 34 + s * 40, y: block.y + 44, a: 0 });
        city.parkingSpots.push({ x: block.x + 34 + s * 40, y: block.y + block.h - 44, a: Math.PI });
      }
    } else if (block.kind === 'plaza') {
      block.props.push({ kind: 'plaza', x: block.x + 8, y: block.y + 8, w: block.w - 16, h: block.h - 16 });
      city.fountains.push({ x: block.x + block.w * 0.5, y: block.y + block.h * 0.5, r: 30 });
      addBlockProps(city, block, rng, 4);
    }
  }

  function addBlockProps(city, block, rng, count) {
    for (var i = 0; i < count; i++) {
      block.props.push({ kind: 'palm', x: block.x + 18 + rng() * (block.w - 36), y: block.y + 18 + rng() * (block.h - 36) });
    }
  }

  function makeBuilding(rng, x, y, w, h, style, index) {
    var tall = style === 'tower';
    var b = {
      x: Math.round(x), y: Math.round(y), w: Math.max(46, Math.round(w)), h: Math.max(46, Math.round(h)),
      style: style,
      roof: U.pick(rng, ROOF_COLORS),
      wall: U.pick(rng, WALL_COLORS),
      floors: tall ? 6 + Math.floor(rng() * 9) : 1 + Math.floor(rng() * 3),
      winSeed: Math.floor(rng() * 100000),
      awning: U.pick(rng, AWNINGS),
      sign: U.pick(rng, SIGN_TEXTS),
      unitCount: 1 + Math.floor(rng() * ROOF_UNITS),
      hasSign: rng() < (style === 'shop' ? 0.85 : 0.4),
      litRatio: tall ? 0.42 : 0.3
    };
    // Sub-roofs give towers a setback silhouette from above.
    if (tall && b.w > 90 && b.h > 90) {
      b.sets = [
        { x: b.x + b.w * 0.12, y: b.y + b.h * 0.12, w: b.w * 0.42, h: b.h * 0.38 },
        { x: b.x + b.w * 0.58, y: b.y + b.h * 0.52, w: b.w * 0.3, h: b.h * 0.3 }
      ];
    }
    return b;
  }

  /* ---------- streets ---------- */

  function buildStreets(city, rng) {
    city.lampRows = [];
    for (var i = 0; i <= GRID; i++) {
      var pos = i * CELL;
      if (i > 0 && i < GRID) {
        for (var j = 0; j < GRID; j++) {
          if ((j + i) % 3 === 0) {
            city.lamps.push({ x: pos + HALF_ROAD + 26, y: j * CELL + HALF_ROAD + 8, a: Math.PI });
            city.lamps.push({ x: pos - HALF_ROAD - 26, y: j * CELL + CELL - HALF_ROAD - 8, a: 0 });
          }
        }
      }
    }
    city.beachPromenade = { y: CITY_H - 30 };
  }

  function buildBeach(city, rng) {
    // boardwalk railing, towels, balls, surf racks, a lifeguard tower and two beach kiosks
    city.beachSet = { towels: [], balls: [], boards: [], towers: [], kiosks: [], nets: [], rocks: [] };
    var B = city.beachSet;
    for (var ti = 0; ti < 44; ti++) {
      B.towels.push({
        x: 40 + rng() * (CITY_W - 80), y: CITY_H + 128 + rng() * (C.BEACH_H - 240),
        a: (rng() - 0.5) * 0.8, color: U.pick(rng, ['#e4572e', '#f2c14e', '#2a9d8f', '#e76f51', '#7d5ba6', '#f6efe1', '#4b9fd4'])
      });
    }
    for (var bi = 0; bi < 26; bi++) {
      B.balls.push({
        x: 40 + rng() * (CITY_W - 80), y: CITY_H + 140 + rng() * (C.BEACH_H - 260),
        color: U.pick(rng, ['#f2c14e', '#e4572e', '#5aa9d6', '#f6efe1'])
      });
    }
    for (var si = 0; si < 16; si++) {
      B.boards.push({
        x: 60 + rng() * (CITY_W - 120), y: CITY_H + 90 + rng() * 90,
        a: (rng() - 0.5) * 0.6, color: U.pick(rng, ['#f2c14e', '#37d3cf', '#ff6f7d', '#f6efe1'])
      });
    }
    B.towers.push({ x: 2.2 * CELL, y: CITY_H + 272 }, { x: 13.5 * CELL, y: CITY_H + 300 });
    B.kiosks.push(
      { x: 4.6 * CELL, y: CITY_H + 96, w: 120, h: 76, sign: 'VERA\u2019S', tone: '#3f8f8a' },
      { x: 9.1 * CELL, y: CITY_H + 84, w: 96, h: 66, sign: 'SURF', tone: '#c05e8f' }
    );
    B.nets.push({ x: 6.6 * CELL, y: CITY_H + 300 }, { x: 11.4 * CELL, y: CITY_H + 236 });
    for (var ri = 0; ri < 26; ri++) {
      B.rocks.push({ x: 30 + rng() * (CITY_W - 60), y: CITY_H + C.BEACH_H - 40 + rng() * 30, r: 4 + rng() * 9 });
    }
    for (var i = 0; i < 54; i++) {
      city.palms.push({
        x: 40 + rng() * (CITY_W - 80),
        y: CITY_H + 92 + rng() * (C.BEACH_H - 170),
        h: 46 + rng() * 34,
        lean: (rng() - 0.5) * 26,
        sway: rng() * 6.28,
        scale: 0.8 + rng() * 0.55
      });
    }
    for (var u = 0; u < 16; u++) {
      city.umbrellas.push({
        x: 60 + rng() * (CITY_W - 120),
        y: CITY_H + 190 + rng() * (C.BEACH_H - 250),
        color: U.pick(rng, ['#e4572e', '#f2c14e', '#2a9d8f', '#e76f51', '#7d5ba6'])
      });
    }
    city.pier = { x: CITY_W * 0.62, y: CITY_H + C.BEACH_H - 40, w: 150, len: 470 };
  }

  /* ---------- queries: what is solid, what is road ---------- */

  var OUT = { kind: 'out' };

  function colliders(city, out) {
    out.length = 0;
    var bs = city.buildings;
    for (var i = 0; i < bs.length; i++) out.push(bs[i]);
    return out;
  }

  function collideCircle(city, x, y, r) {
    var bs = city.buildings;
    for (var i = 0; i < bs.length; i++) {
      var b = bs[i];
      if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return b;
    }
    return null;
  }

  function pointInBuilding(city, x, y) {
    var b = collideCircle(city, x, y, 0);
    return !!b;
  }

  function onRoad(x, y) {
    var mx = x % CELL, my = y % CELL;
    return mx < HALF_ROAD || mx > CELL - HALF_ROAD || my < HALF_ROAD || my > CELL - HALF_ROAD;
  }

  function onBeach(x, y) { return y > CITY_H - 18; }

  /* ---------- drawing ---------- */

  function viewW(cam) { return cam.w || C.VW; }
  function viewH(cam) { return cam.h || C.VH; }

  function visibleRange(cam) {
    return { x0: Math.max(0, Math.floor((cam.x - 80) / CELL)), x1: Math.min(GRID, Math.ceil((cam.x + viewW(cam) + 80) / CELL)),
             y0: Math.max(0, Math.floor((cam.y - 80) / CELL)), y1: Math.min(GRID, Math.ceil((cam.y + viewH(cam) + 80) / CELL)) };
  }

  function draw(city, ctx, cam, t) {
    // the caller has already put the context in world coordinates
    ctx.save();
    drawGround(city, ctx, cam, t);
    drawMarkings(city, ctx, cam);
    drawShadows(city, ctx, cam);
    drawBlocks(city, ctx, cam, t);
    drawPalms(city, ctx, cam, t);
    ctx.restore();
  }

  function drawGround(city, ctx, cam, t) {
    // Sand base everywhere: the city sits on it and the beach continues it to the water.
    ctx.fillStyle = P.sand;
    ctx.fillRect(cam.x - 400, cam.y - 400, viewW(cam) + 800, viewH(cam) + 800);

    var r = visibleRange(cam);
    // Blocks: sidewalk slab + interior ground.
    for (var gy = r.y0; gy < r.y1; gy++) {
      for (var gx = r.x0; gx < r.x1; gx++) {
        var block = city.blocks[gy * GRID + gx];
        if (!block) continue;
        ctx.fillStyle = P.sidewalk;
        ctx.fillRect(block.x - 6, block.y - 6, block.w + 12, block.h + 12);
        ctx.strokeStyle = P.sidewalkEdge;
        ctx.lineWidth = 2;
        ctx.strokeRect(block.x - 6, block.y - 6, block.w + 12, block.h + 12);
        // curb
        ctx.fillStyle = P.curb;
        ctx.fillRect(block.x - 7, block.y - 7, block.w + 14, 3);
      }
    }

    // Roads: asphalat bands between blocks.
    ctx.fillStyle = P.asphalt;
    for (var i = 0; i <= GRID; i++) {
      var p = i * CELL;
      ctx.fillRect(p - HALF_ROAD, Math.max(0, cam.y - 40), ROAD, Math.min(CITY_H, cam.y + viewH(cam) + 80) - Math.max(0, cam.y - 40));
      ctx.fillRect(Math.max(0, cam.x - 40), p - HALF_ROAD, Math.min(CITY_W, cam.x + viewW(cam) + 80) - Math.max(0, cam.x - 40), ROAD);
    }
    // Beach promenade, sand and sea.
    drawBeach(city, ctx, cam, t);
  }

  function drawBeach(city, ctx, cam, t) {
    var top = BEACH_TOP;
    if (cam.y + viewH(cam) < top - 60) return;

    // boardwalk band under the city edge
    ctx.fillStyle = P.sandDark;
    ctx.fillRect(0, top - 18, CITY_W, 46);
    ctx.fillStyle = P.sandWet;
    for (var i = 0; i < CITY_W; i += 26) ctx.fillRect(i, top - 12, 2, 34);
    // railing posts along the boardwalk
    ctx.fillStyle = 'rgba(120,95,70,0.55)';
    for (var rp = 0; rp < CITY_W; rp += 54) ctx.fillRect(rp, top - 20, 4, 10);

    // wet sand transition
    ctx.fillStyle = P.sandWet;
    ctx.fillRect(0, top + C.BEACH_H - 96, CITY_W, 52);

    // sea
    var seaTop = top + C.BEACH_H;
    var g = ctx.createLinearGradient(0, seaTop, 0, seaTop + 900);
    g.addColorStop(0, P.waterLight);
    g.addColorStop(0.12, P.water);
    g.addColorStop(1, P.waterDeep);
    ctx.fillStyle = g;
    ctx.fillRect(0, seaTop, CITY_W, C.WORLD_H - seaTop);

    // foam line and rolling wave hints
    ctx.strokeStyle = P.foam;
    ctx.globalAlpha = 0.85;
    ctx.lineWidth = 5;
    ctx.beginPath();
    for (var x = 0; x <= CITY_W; x += 40) {
      var yy = seaTop + Math.sin(x * 0.006) * 7;
      if (x === 0) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
    }
    ctx.stroke();
    ctx.globalAlpha = 0.22;
    ctx.lineWidth = 3;
    for (var w = 0; w < 5; w++) {
      var waveY = seaTop + 70 + w * 110;
      ctx.beginPath();
      for (var wx = 0; wx <= CITY_W; wx += 34) {
        var wy = waveY + Math.sin(wx * 0.004 + w) * 12;
        if (wx === 0) ctx.moveTo(wx, wy); else ctx.lineTo(wx, wy);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // beach furniture, drawn before the sea so nothing spills onto the water
    var B = city.beachSet;
    if (B) drawBeachSet(ctx, B, t, (t || 0), cam);

    // pier
    var pier = city.pier;
    ctx.fillStyle = '#a8835a';
    ctx.fillRect(pier.x, seaTop - 26, pier.w, pier.len);
    ctx.strokeStyle = '#8b6844';
    ctx.lineWidth = 3;
    for (var d = 0; d < pier.len; d += 26) ctx.strokeRect(pier.x, seaTop - 26 + d, pier.w, 4);
    ctx.fillStyle = 'rgba(0,0,0,0.16)';
    ctx.fillRect(pier.x + pier.w, seaTop - 26, 10, pier.len);
  }

  /* Towels, balls, surf racks, kiosks, lifeguard towers and volleyball nets: the life of the beach. */
  function drawBeachSet(ctx, B, t, time, cam) {
    var vw = cam.w || C.VW, vh = cam.h || C.VH;
    function vis(x, y, m) {
      m = m || 70;
      return x > cam.x - m && x < cam.x + vw + m && y > cam.y - m && y < cam.y + vh + m;
    }
    var i, o;
    for (i = 0; i < B.towels.length; i++) {
      o = B.towels[i];
      if (!vis(o.x, o.y)) continue;
      ctx.save(); ctx.translate(o.x, o.y); ctx.rotate(o.a);
      ctx.fillStyle = 'rgba(120,90,60,0.16)';
      ctx.fillRect(-12, -6, 28, 16);
      ctx.fillStyle = o.color;
      ctx.fillRect(-15, -10, 30, 19);
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.fillRect(-15, -8, 30, 3);
      ctx.fillRect(-15, 4, 30, 3);
      ctx.fillStyle = 'rgba(0,0,0,0.12)';
      ctx.fillRect(-15, 9, 30, 2);
      ctx.restore();
    }
    for (i = 0; i < B.balls.length; i++) {
      o = B.balls[i];
      if (!vis(o.x, o.y, 30)) continue;
      ctx.fillStyle = o.color;
      ctx.beginPath(); ctx.arc(o.x, o.y, 4.5, 0, 6.283); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.beginPath(); ctx.arc(o.x - 1.2, o.y - 1.4, 2, 0, 6.283); ctx.fill();
    }
    for (i = 0; i < B.boards.length; i++) {
      o = B.boards[i];
      if (!vis(o.x, o.y)) continue;
      ctx.save(); ctx.translate(o.x, o.y); ctx.rotate(o.a);
      ctx.fillStyle = 'rgba(120,90,60,0.16)';
      ctx.fillRect(-5, -10, 14, 34);
      ctx.fillStyle = o.color;
      U.roundRect(ctx, -4, -14, 8, 30, 4); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.fillRect(-1, -10, 2, 22);
      ctx.restore();
    }
    for (i = 0; i < B.nets.length; i++) {
      o = B.nets[i];
      if (!vis(o.x, o.y)) continue;
      ctx.strokeStyle = 'rgba(245,240,228,0.72)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(o.x - 46, o.y - 16, 92, 32);
      for (var nx = -46; nx <= 46; nx += 12) {
        ctx.beginPath(); ctx.moveTo(o.x + nx, o.y - 16); ctx.lineTo(o.x + nx, o.y + 16); ctx.stroke();
      }
      for (var ny = -16; ny <= 16; ny += 8) {
        ctx.beginPath(); ctx.moveTo(o.x - 46, o.y + ny); ctx.lineTo(o.x + 46, o.y + ny); ctx.stroke();
      }
      ctx.fillStyle = '#8d7a63';
      ctx.fillRect(o.x - 50, o.y - 20, 5, 5); ctx.fillRect(o.x + 45, o.y - 20, 5, 5);
    }
    for (i = 0; i < B.towers.length; i++) {
      o = B.towers[i];
      if (!vis(o.x, o.y)) continue;
      ctx.fillStyle = 'rgba(120,90,60,0.2)';
      ctx.fillRect(o.x - 24, o.y - 18, 52, 44);
      ctx.fillStyle = '#f6efe1';
      ctx.fillRect(o.x - 26, o.y - 24, 52, 40);
      ctx.fillStyle = '#e4572e';
      ctx.fillRect(o.x - 26, o.y - 24, 52, 9);
      ctx.fillStyle = '#9b8b74';
      ctx.fillRect(o.x - 20, o.y - 34, 40, 12);
      ctx.fillStyle = '#2b3a44';
      ctx.fillRect(o.x - 8, o.y - 13, 16, 10);
    }
    for (i = 0; i < B.kiosks.length; i++) {
      o = B.kiosks[i];
      if (!vis(o.x, o.y, 120)) continue;
      // awning shadow, deck, body, striped awning, sign board
      ctx.fillStyle = 'rgba(110,80,55,0.22)';
      ctx.fillRect(o.x + 10, o.y + 8, o.w, o.h + 14);
      ctx.fillStyle = '#cfa06f';
      ctx.fillRect(o.x - 6, o.y + o.h - 4, o.w + 12, 16);
      ctx.fillStyle = '#f3e6cd';
      ctx.fillRect(o.x, o.y, o.w, o.h);
      ctx.strokeStyle = 'rgba(90,68,48,0.4)';
      ctx.lineWidth = 2;
      ctx.strokeRect(o.x, o.y, o.w, o.h);
      // striped awning along the beach face
      for (var a = 0; a < o.w; a += 16) {
        ctx.fillStyle = a % 32 === 0 ? o.tone : '#f6efe1';
        ctx.fillRect(o.x + a, o.y + o.h - 12, 16, 14);
      }
      // counter window
      ctx.fillStyle = 'rgba(46,62,68,0.8)';
      ctx.fillRect(o.x + 12, o.y + 12, o.w - 24, 18);
      ctx.fillStyle = 'rgba(255,236,180,0.35)';
      ctx.fillRect(o.x + 14, o.y + 14, o.w - 28, 5);
      // sign
      ctx.fillStyle = 'rgba(28,22,18,0.85)';
      ctx.fillRect(o.x + o.w * 0.14, o.y - 16, o.w * 0.72, 18);
      ctx.fillStyle = '#ffe9a8';
      ctx.font = 'bold 12px "Arial Narrow", Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(o.sign, o.x + o.w / 2, o.y - 6);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
    }
    for (i = 0; i < B.rocks.length; i++) {
      o = B.rocks[i];
      if (!vis(o.x, o.y, 30)) continue;
      ctx.fillStyle = '#8e8678';
      ctx.beginPath(); ctx.ellipse(o.x, o.y, o.r, o.r * 0.7, 0.4, 0, 6.283); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.beginPath(); ctx.ellipse(o.x - o.r * 0.25, o.y - o.r * 0.25, o.r * 0.55, o.r * 0.35, 0.4, 0, 6.283); ctx.fill();
    }
  }

  function drawMarkings(city, ctx, cam) {
    ctx.save();
    ctx.strokeStyle = P.yellowLine;
    ctx.lineWidth = 3;
    ctx.setLineDash([26, 22]);
    for (var i = 1; i < GRID; i++) {
      var p = i * CELL;
      if (p > cam.x - 60 && p < cam.x + viewW(cam) + 60) {
        ctx.beginPath(); ctx.moveTo(p, Math.max(0, cam.y)); ctx.lineTo(p, Math.min(CITY_H, cam.y + viewH(cam))); ctx.stroke();
      }
      if (p > cam.y - 60 && p < cam.y + viewH(cam) + 60) {
        ctx.beginPath(); ctx.moveTo(Math.max(0, cam.x), p); ctx.lineTo(Math.min(CITY_W, cam.x + viewW(cam)), p); ctx.stroke();
      }
    }
    ctx.setLineDash([]);
    // crosswalks at each intersection edge
    ctx.fillStyle = 'rgba(232,225,205,0.85)';
    for (var gy = 0; gy <= GRID; gy++) {
      for (var gx = 0; gx <= GRID; gx++) {
        var cx = gx * CELL, cy = gy * CELL;
        if (cx < cam.x - 160 || cx > cam.x + viewW(cam) + 160 || cy < cam.y - 160 || cy > cam.y + viewH(cam) + 160) continue;
        for (var s = -HALF_ROAD + 10; s < HALF_ROAD - 6; s += 16) {
          ctx.fillRect(cx + s, cy - HALF_ROAD - 16, 9, 12);
          ctx.fillRect(cx + s, cy + HALF_ROAD + 4, 9, 12);
          ctx.fillRect(cx - HALF_ROAD - 16, cy + s, 12, 9);
          ctx.fillRect(cx + HALF_ROAD + 4, cy + s, 12, 9);
        }
      }
    }
    ctx.restore();
  }

  function drawShadows(city, ctx, cam) {
    // Long south-east shadows from every building, before props and roofs.
    for (var i = 0; i < city.buildings.length; i++) {
      var bd = city.buildings[i];
      if (bd.x + bd.w < cam.x - 120 || bd.x > cam.x + viewW(cam) + 120 || bd.y + bd.h < cam.y - 120 || bd.y > cam.y + viewH(cam) + 120) continue;
      var off = 16 + bd.floors * 4.5;
      // a long thrown shadow, then the building's own extruded walls sit on top of it
      ctx.fillRect(bd.x + off + 6, bd.y + off + 4, bd.w, bd.h);
      ctx.fillRect(bd.x + bd.w + off * 0.4, bd.y + off + 4, off * 1.3, bd.h);
      ctx.fillRect(bd.x, bd.y + bd.h + off * 0.4, bd.w + off * 1.3, off * 0.8);
    }
  }

  function drawBlocks(city, ctx, cam, t) {
    var r = visibleRange(cam);
    for (var gy = r.y0; gy < r.y1; gy++) {
      for (var gx = r.x0; gx < r.x1; gx++) {
        var block = city.blocks[gy * GRID + gx];
        if (!block) continue;
        for (var p = 0; p < block.props.length; p++) drawBlockProp(ctx, block.props[p], t);
      }
    }
    // park trees and fountains sit under the roofs, above the ground
    for (var i = 0; i < city.parkTrees.length; i++) {
      var tr = city.parkTrees[i];
      if (!inView(tr.x, tr.y, cam)) continue;
      drawTree(ctx, tr, t);
    }
    for (var f = 0; f < city.fountains.length; f++) {
      var fo = city.fountains[f];
      if (!inView(fo.x, fo.y, cam)) continue;
      drawFountain(ctx, fo, t);
    }
    // lots and plazas
    for (var b = 0; b < city.buildings.length; b++) {
      var bd = city.buildings[b];
      if (!inView(bd.x + bd.w / 2, bd.y + bd.h / 2, cam)) continue;
      drawBuilding(ctx, bd, t);
    }
  }

  function inView(x, y, cam) {
    return x > cam.x - 220 && x < cam.x + viewW(cam) + 220 && y > cam.y - 220 && y < cam.y + viewH(cam) + 220;
  }

  function drawBlockProp(ctx, p, t) {
    if (p.kind === 'grass') {
      ctx.fillStyle = P.grass;
      ctx.fillRect(p.x, p.y, p.w, p.h);
      ctx.strokeStyle = P.grassDark;
      ctx.lineWidth = 3;
      ctx.strokeRect(p.x + 10, p.y + 10, p.w - 20, p.h - 20);
      ctx.fillStyle = P.sand;
      ctx.fillRect(p.x + p.w / 2 - 14, p.y, 28, p.h);
    } else if (p.kind === 'lot') {
      ctx.fillStyle = P.asphaltDark;
      ctx.fillRect(p.x, p.y, p.w, p.h);
      ctx.strokeStyle = 'rgba(240,235,220,0.55)';
      ctx.lineWidth = 2;
      for (var x = p.x + 14; x < p.x + p.w - 6; x += 40) {
        ctx.beginPath(); ctx.moveTo(x, p.y + 14); ctx.lineTo(x, p.y + 74); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x, p.y + p.h - 74); ctx.lineTo(x, p.y + p.h - 14); ctx.stroke();
      }
    } else if (p.kind === 'plaza') {
      ctx.fillStyle = '#ddd2bd';
      ctx.fillRect(p.x, p.y, p.w, p.h);
      ctx.strokeStyle = '#c9bda5';
      ctx.lineWidth = 1;
      for (var px = p.x; px < p.x + p.w; px += 28) {
        ctx.beginPath(); ctx.moveTo(px, p.y); ctx.lineTo(px, p.y + p.h); ctx.stroke();
      }
      for (var py = p.y; py < p.y + p.h; py += 28) {
        ctx.beginPath(); ctx.moveTo(p.x, py); ctx.lineTo(p.x + p.w, py); ctx.stroke();
      }
    } else if (p.kind === 'planters') {
      ctx.fillStyle = '#9f8f76';
      ctx.fillRect(p.x, p.y, 90, 16);
      ctx.fillStyle = P.grass;
      ctx.fillRect(p.x + 4, p.y + 3, 82, 10);
    } else if (p.kind === 'palm') {
      drawPalm(ctx, { x: p.x, y: p.y, h: 54, lean: 6, sway: p.x * 0.01, scale: 0.9 }, t);
    }
  }

  function drawBuilding(ctx, b, t) {
    // The body, extruded toward the viewer: two facades plus the roof plate, so a top-down
    // city still reads as a city of volumes rather than a floor plan.
    var off = Math.min(30, 7 + b.floors * 3.2);
    var wallDark = shade(b.wall, -0.34);
    var wallMid = shade(b.wall, -0.1);
    // front (south) facade
    ctx.fillStyle = wallDark;
    ctx.beginPath();
    ctx.moveTo(b.x, b.y + b.h);
    ctx.lineTo(b.x + b.w, b.y + b.h);
    ctx.lineTo(b.x + b.w + off * 0.55, b.y + b.h + off);
    ctx.lineTo(b.x + off * 0.55, b.y + b.h + off);
    ctx.closePath(); ctx.fill();
    // side (east) facade
    ctx.fillStyle = wallMid;
    ctx.beginPath();
    ctx.moveTo(b.x + b.w, b.y);
    ctx.lineTo(b.x + b.w + off * 0.55, b.y + off);
    ctx.lineTo(b.x + b.w + off * 0.55, b.y + b.h + off);
    ctx.lineTo(b.x + b.w, b.y + b.h);
    ctx.closePath(); ctx.fill();
    // facade window rows on the two visible sides
    drawFacade(ctx, b, off, wallDark, wallMid);

    // wall band: the strip of facade you see between roof edge and street
    ctx.fillStyle = shade(b.wall, -0.18);
    ctx.fillRect(b.x, b.y, b.w, b.h);
    // roof deck
    ctx.fillStyle = b.roof;
    ctx.fillRect(b.x + 4, b.y + 4, b.w - 8, b.h - 8);

    // windows only around the rim, so the roof reads as a roof and the facade reads as lit rooms
    var rng = PC.makeRng(b.winSeed);
    var pad = 8, step = 15;
    var cols = Math.max(1, Math.floor((b.w - pad * 2) / step));
    var rows = Math.max(1, Math.floor((b.h - pad * 2) / step));
    for (var rx = 0; rx < cols; rx++) {
      for (var ry = 0; ry < rows; ry++) {
        var onRim = rx === 0 || ry === 0 || rx === cols - 1 || ry === rows - 1;
        if (!onRim) { rng(); rng(); continue; }
        var lit = rng() < b.litRatio;
        ctx.fillStyle = lit ? P.windowLit : P.windowDark;
        ctx.globalAlpha = lit ? 1 : 0.85;
        ctx.fillRect(b.x + pad + rx * step, b.y + pad + ry * step, step - 5, step - 5);
      }
    }
    ctx.globalAlpha = 1;

    // roof deck details: AC boxes, vents, a stair hut, a parapet line
    var inset = 22;
    if (b.w > 74 && b.h > 74) {
      ctx.fillStyle = shade(b.roof, -0.1);
      for (var u = 0; u < b.unitCount; u++) {
        var uw = 14 + (u % 3) * 6, uh = 11 + (u % 2) * 5;
        var ux = b.x + inset + ((u * 37) % Math.max(1, (b.w - inset * 2 - uw)));
        var uy = b.y + inset + ((u * 23) % Math.max(1, (b.h - inset * 2 - uh)));
        ctx.fillRect(ux, uy, uw, uh);
        ctx.strokeStyle = 'rgba(60,40,25,0.18)';
        ctx.lineWidth = 1;
        ctx.strokeRect(ux, uy, uw, uh);
      }
      if (b.style === 'tower' || b.style === 'house') {
        ctx.fillStyle = shade(b.roof, 0.12);
        ctx.fillRect(b.x + b.w * 0.55, b.y + b.h * 0.52, Math.min(28, b.w * 0.24), Math.min(24, b.h * 0.2));
      }
    }
    // parapet outline just inside the rim
    ctx.strokeStyle = shade(b.roof, -0.24);
    ctx.lineWidth = 2;
    ctx.strokeRect(b.x + 19, b.y + 19, b.w - 38, b.h - 38);

    // setback slabs give towers their stepped silhouette from above
    if (b.sets) {
      for (var s = 0; s < b.sets.length; s++) {
        var st = b.sets[s];
        ctx.fillStyle = shade(b.roof, s === 0 ? 0.14 : -0.05);
        ctx.fillRect(st.x, st.y, st.w, st.h);
        ctx.strokeStyle = 'rgba(50,35,22,0.22)';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(st.x, st.y, st.w, st.h);
      }
    }

    // shop awning along the street face and a hanging sign
    if (b.style === 'shop') {
      ctx.fillStyle = b.awning;
      ctx.fillRect(b.x + 3, b.y + b.h - 15, b.w - 6, 11);
      ctx.fillStyle = 'rgba(255,255,255,0.34)';
      for (var aw = b.x + 8; aw < b.x + b.w - 10; aw += 15) ctx.fillRect(aw, b.y + b.h - 15, 7, 11);
      if (b.hasSign) {
        var sw = Math.min(b.w - 18, 78);
        ctx.fillStyle = 'rgba(28,22,18,0.86)';
        ctx.fillRect(b.x + 9, b.y + 7, sw, 16);
        ctx.fillStyle = '#ffe9a8';
        ctx.font = 'bold 10px "Arial Narrow", Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(b.sign, b.x + 9 + sw / 2, b.y + 16);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
      }
    }

    // crisp roof edge
    ctx.strokeStyle = 'rgba(60,42,28,0.42)';
    ctx.lineWidth = 2;
    ctx.strokeRect(b.x + 0.5, b.y + 0.5, b.w - 1, b.h - 1);

    if (b.pool) {
      var px = b.x + b.w + 12, py = b.y + 14;
      if (px + 40 < b.x + b.w + 240) {
        ctx.fillStyle = '#6cc9d6';
        ctx.fillRect(px, py, 36, 22);
        ctx.strokeStyle = '#f1e9d8';
        ctx.lineWidth = 3;
        ctx.strokeRect(px, py, 36, 22);
      }
    }
  }

  /* Lit windows on the two visible facades, drawn as small quads following the extrusion. */
  function drawFacade(ctx, b, off, wallDark, wallMid) {
    var floors = Math.min(14, b.floors);
    var cols = Math.max(2, Math.min(9, Math.floor(b.w / 24)));
    var rng = PC.makeRng(b.winSeed + 7);
    for (var f = 0; f < floors; f++) {
      var fy = (f + 0.6) / floors * off;
      for (var c = 0; c < cols; c++) {
        var lit = rng() < b.litRatio;
        if (!lit && rng() < 0.5) continue;
        ctx.fillStyle = lit ? 'rgba(255,214,140,0.9)' : 'rgba(40,58,74,0.75)';
        var w = (b.w - 14) / cols * 0.62;
        var x = b.x + 7 + (b.w - 14) / cols * c + 2;
        ctx.fillRect(x, b.y + b.h + fy, w, Math.max(1.6, off * 0.055));
      }
    }
    // a couple of lit windows on the east facade too
    for (var f2 = 0; f2 < floors; f2 += 2) {
      var fx = (f2 + 0.5) / floors * off;
      ctx.fillStyle = 'rgba(255,206,130,0.55)';
      ctx.fillRect(b.x + b.w + fx, b.y + 12, Math.max(1.6, off * 0.05), Math.max(6, b.h * 0.2));
    }
  }

  function drawPalm(ctx, p, t) {
    var sway = Math.sin(t * 0.9 + p.sway) * 3;
    var x = p.x, y = p.y, h = p.h * p.scale;
    ctx.save();
    ctx.translate(x, y);
    // shadow on sand
    ctx.fillStyle = 'rgba(90,60,40,0.16)';
    ctx.beginPath(); ctx.ellipse(10, 6, h * 0.5, h * 0.22, 0.5, 0, 6.283); ctx.fill();
    // trunk
    ctx.strokeStyle = P.palmTrunk;
    ctx.lineWidth = Math.max(2, 4 * p.scale);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(p.lean * 0.4 + sway * 0.5, -h * 0.55, p.lean + sway, -h);
    ctx.stroke();
    // fronds
    var cx = p.lean + sway, cy = -h;
    ctx.fillStyle = P.palmFrond;
    for (var i = 0; i < 7; i++) {
      var a = -Math.PI / 2 + (i - 3) * 0.46;
      var len = h * 0.55;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.quadraticCurveTo(cx + Math.cos(a) * len * 0.6, cy + Math.sin(a) * len * 0.62 - 6,
        cx + Math.cos(a) * len, cy + Math.sin(a) * len * 0.55 + 10);
      ctx.quadraticCurveTo(cx + Math.cos(a) * len * 0.55, cy + Math.sin(a) * len * 0.5 + 12, cx, cy + 3);
      ctx.fill();
    }
    ctx.fillStyle = P.palmFrondLight;
    ctx.beginPath(); ctx.arc(cx, cy, 3.4 * p.scale, 0, 6.283); ctx.fill();
    ctx.restore();
  }

  function drawPalms(city, ctx, cam, t) {
    for (var i = 0; i < city.palms.length; i++) {
      var p = city.palms[i];
      if (!inView(p.x, p.y, cam)) continue;
      drawPalm(ctx, p, t);
    }
    for (var u = 0; u < city.umbrellas.length; u++) {
      var m = city.umbrellas[u];
      if (!inView(m.x, m.y, cam)) continue;
      ctx.fillStyle = 'rgba(90,60,40,0.14)';
      ctx.beginPath(); ctx.ellipse(m.x + 8, m.y + 6, 22, 10, 0.4, 0, 6.283); ctx.fill();
      ctx.fillStyle = m.color;
      ctx.beginPath(); ctx.arc(m.x, m.y, 18, 0, 6.283); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.beginPath(); ctx.arc(m.x, m.y, 18, 3.34, 4.6); ctx.fill();
      ctx.fillStyle = '#f7f2e6';
      ctx.beginPath(); ctx.arc(m.x, m.y, 3, 0, 6.283); ctx.fill();
    }
    // lamps on the road edges
    for (var l = 0; l < city.lamps.length; l++) {
      var lp = city.lamps[l];
      if (!inView(lp.x, lp.y, cam)) continue;
      ctx.fillStyle = 'rgba(90,60,40,0.2)';
      ctx.beginPath(); ctx.ellipse(lp.x + 6, lp.y + 4, 9, 4, 0.6, 0, 6.283); ctx.fill();
      ctx.fillStyle = '#7b7468';
      ctx.beginPath(); ctx.arc(lp.x, lp.y, 3.5, 0, 6.283); ctx.fill();
      ctx.fillStyle = 'rgba(255,220,150,0.9)';
      ctx.beginPath(); ctx.arc(lp.x, lp.y, 1.6, 0, 6.283); ctx.fill();
    }
  }

  function drawTree(ctx, tr, t) {
    ctx.fillStyle = 'rgba(60,40,30,0.18)';
    ctx.beginPath(); ctx.ellipse(tr.x + 6, tr.y + 6, tr.r * 1.05, tr.r * 0.6, 0.5, 0, 6.283); ctx.fill();
    ctx.fillStyle = '#5c8f5f';
    ctx.beginPath(); ctx.arc(tr.x, tr.y, tr.r, 0, 6.283); ctx.fill();
    ctx.fillStyle = '#74a875';
    ctx.beginPath(); ctx.arc(tr.x - tr.r * 0.3, tr.y - tr.r * 0.3, tr.r * 0.62, 0, 6.283); ctx.fill();
    ctx.fillStyle = '#8fbf8b';
    ctx.beginPath(); ctx.arc(tr.x - tr.r * 0.45, tr.y - tr.r * 0.45, tr.r * 0.3, 0, 6.283); ctx.fill();
  }

  function drawFountain(ctx, f, t) {
    ctx.fillStyle = '#cfc6b2';
    ctx.beginPath(); ctx.arc(f.x, f.y, f.r + 7, 0, 6.283); ctx.fill();
    ctx.fillStyle = '#5fb8c8';
    ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, 6.283); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 2;
    for (var i = 0; i < 3; i++) {
      var rr = f.r * (0.4 + i * 0.22);
      ctx.beginPath(); ctx.arc(f.x, f.y, rr + Math.sin(t * 2 + i) * 2, 0, 6.283); ctx.stroke();
    }
    ctx.fillStyle = 'rgba(230,250,255,0.9)';
    ctx.beginPath(); ctx.arc(f.x, f.y, 4, 0, 6.283); ctx.fill();
  }

  function shade(hex, amt) {
    var n = parseInt(hex.slice(1), 16);
    var r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    if (amt < 0) { r *= 1 + amt; g *= 1 + amt; b *= 1 + amt; }
    else { r += (255 - r) * amt; g += (255 - g) * amt; b += (255 - b) * amt; }
    return 'rgb(' + (r | 0) + ',' + (g | 0) + ',' + (b | 0) + ')';
  }

  PC.city = {
    generate: generateCity,
    collideCircle: collideCircle,
    pointInBuilding: pointInBuilding,
    onRoad: onRoad,
    onBeach: onBeach,
    draw: draw,
    drawPalm: drawPalm,
    shade: shade,
    blockAt: blockAt,
    OUT_OF_BOUNDS: OUT
  };
})(window.PC = window.PC || {});
