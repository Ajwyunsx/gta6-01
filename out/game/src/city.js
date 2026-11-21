// city.js — builds the whole of Palm City from one seed: a 7x7 block grid of avenues,
// an east beach and ocean, towers downtown, shops and bars along the strip, parks, parking
// lots, palms, lamp posts and the signs that name the place. Data only; render.js draws it.
(function () {
  'use strict';
  var PC = window.PC;
  var CFG = PC.CFG;
  var U = PC.U;

  var SHOPS = [
    'Tide Mart', 'Palmetto Pizza', 'Coco Loco', 'Riptide Records', 'Driftwood Bar',
    'Sea Grape Cafe', 'Marina Supply', 'Sunset Arcade', 'Pelican Pawn', 'Banyan Books',
    'Flamingo Flats', 'Gold Coast Gym', 'Mango Motel', 'Coral Club', 'Neon Pike',
    'Salt & Lime', 'Heron Hotel', 'Vine & Vice', 'Sandbox Diner', 'Blue Buoy Deli',
  ];
  var DISTRICTS = [
    'Coral Heights', 'Neon Pike', 'Marina Flats', 'Banyan Row', 'Sunset Strip',
    'Coconut Grove', 'Saltwater', 'Old Harbour',
  ];

  function City() {
    this.rng = U.makeRng(CFG.SEED);
    this.buildings = [];
    this.palms = [];
    this.props = [];
    this.blocks = [];
    this.lots = [];
    this.lanes = [];
    this.parkingSpaces = [];
    this.pedSpawns = [];
    this.markers = {};
    this.pier = null;
    this.districtNames = DISTRICTS.slice();
    this.build();
  }

  City.prototype.blockRect = function (i, j) {
    var x = i * CFG.CELL + CFG.ROAD;
    var y = j * CFG.CELL + CFG.ROAD;
    return { x: x, y: y, w: CFG.BLOCK, h: CFG.BLOCK };
  };

  City.prototype.build = function () {
    var rng = this.rng;
    var i, j;
    for (j = 0; j < CFG.GRID; j++) {
      for (i = 0; i < CFG.GRID; i++) {
        var rect = this.blockRect(i, j);
        var centre = Math.abs(i - 3) + Math.abs(j - 3);
        var kind;
        if (i === CFG.GRID - 1 && (j === 1 || j === 4)) kind = 'beachclub';
        else if (centre <= 1) kind = rng() < 0.72 ? 'tower' : 'midrise';
        else if (centre <= 3) kind = rng() < 0.44 ? 'midrise' : rng() < 0.78 ? 'row' : 'park';
        else kind = rng() < 0.22 ? 'park' : rng() < 0.52 ? 'lot' : rng() < 0.80 ? 'row' : 'midrise';
        var block = {
          i: i, j: j, x: rect.x, y: rect.y, w: rect.w, h: rect.h, kind: kind,
          district: DISTRICTS[(i + j * 2) % DISTRICTS.length],
        };
        this.blocks.push(block);
        if (kind === 'tower') this.makeTower(block);
        else if (kind === 'midrise') this.makeMidrise(block);
        else if (kind === 'row') this.makeRow(block);
        else if (kind === 'park') this.makePark(block);
        else if (kind === 'lot') this.makeLot(block);
        else if (kind === 'beachclub') this.makeBeachClub(block);
      }
    }
    this.makeBeach();
    this.makeStreetFurniture();
    this.makeLanes();
    this.pickMarkers();
  };

  // ---- buildings -------------------------------------------------------------
  City.prototype.addBuilding = function (x, y, w, h, floors, kind, sign) {
    var rng = this.rng;
    var hgt = 44 + floors * 36 + rng() * 18;
    var palette = CFG.colors.building;
    var tops = CFG.colors.buildingTop;
    var pick = Math.floor(rng() * palette.length);
    var b = {
      x: x, y: y, w: w, h: h,
      cx: x + w / 2, cy: y + h / 2,
      hgt: hgt, floors: floors, kind: kind,
      color: palette[pick],
      roof: tops[pick],
      sign: sign || null,
      signSide: rng() < 0.5 ? 's' : 'w',
      lit: 0.25 + rng() * 0.5,
      windowSeed: Math.floor(rng() * 99999),
      antenna: kind === 'office' && rng() < 0.5,
      ac: [],
    };
    var acCount = Math.floor(rng() * 3);
    for (var k = 0; k < acCount; k++) {
      b.ac.push({
        x: U.randRange(rng, 0.15, 0.7), y: U.randRange(rng, 0.15, 0.7),
        s: U.randRange(rng, 8, 16), r: rng() < 0.5,
      });
    }
    this.buildings.push(b);
    return b;
  };

  City.prototype.makeTower = function (block) {
    var pad = 34;
    var x = block.x + pad, y = block.y + pad, w = block.w - pad * 2, h = block.h - pad * 2;
    var rng = this.rng;
    if (rng() < 0.5) {
      this.addBuilding(x, y, w, h, 4 + Math.floor(rng() * 5), 'office', null);
    } else {
      var gap = 26;
      var wa = (w - gap) * (0.42 + rng() * 0.1);
      this.addBuilding(x, y, wa, h, 5 + Math.floor(rng() * 6), 'office', null);
      this.addBuilding(x + wa + gap, y, w - wa - gap, h, 3 + Math.floor(rng() * 4), 'office', null);
    }
    this.palmsOnRing(block, 3);
  };

  City.prototype.makeMidrise = function (block) {
    var pad = 34;
    var rng = this.rng;
    var x = block.x + pad, y = block.y + pad, w = block.w - pad * 2, h = block.h - pad * 2;
    var horizontal = rng() < 0.55;
    var gap = 20;
    if (horizontal) {
      var hh = (h - gap) * U.randRange(rng, 0.4, 0.55);
      this.addBuilding(x, y, w, hh, 2 + Math.floor(rng() * 3), 'apartment', U.pick(rng, SHOPS));
      this.addBuilding(x, y + hh + gap, w, h - hh - gap, 2 + Math.floor(rng() * 2), 'apartment', rng() < 0.4 ? U.pick(rng, SHOPS) : null);
    } else {
      var ww = (w - gap) * U.randRange(rng, 0.4, 0.55);
      this.addBuilding(x, y, ww, h, 2 + Math.floor(rng() * 3), 'apartment', U.pick(rng, SHOPS));
      this.addBuilding(x + ww + gap, y, w - ww - gap, h, 2 + Math.floor(rng() * 3), 'apartment', rng() < 0.4 ? U.pick(rng, SHOPS) : null);
    }
    this.palmsOnRing(block, 2);
  };

  // A street of small shops facing the pavement, with an alley between them.
  City.prototype.makeRow = function (block) {
    var rng = this.rng;
    var pad = 30;
    var shopH = 96 + rng() * 18;
    var n = 3 + Math.floor(rng() * 2);
    var total = block.w - pad * 2;
    var slice = total / n;
    for (var k = 0; k < n; k++) {
      var w = slice - 14;
      var h = shopH * U.randRange(rng, 0.86, 1.14);
      var x = block.x + pad + k * slice + 7;
      var y = block.y + pad;
      var sign = SHOPS[(Math.floor(rng() * SHOPS.length) + k) % SHOPS.length];
      var b = this.addBuilding(x, y, w, h, 1 + Math.floor(rng() * 2), 'shop', sign);
      b.awning = true;
      b.awningColor = U.pick(rng, CFG.colors.neon);
      // the back of the lot: a yard and a low shed
      if (h + pad * 2 < block.h - 90) {
        this.addBuilding(x + 8, y + h + 40, w - 16, 62 + rng() * 20, 0, 'shed', null);
      }
    }
    // paving between the shopfront and the kerb
    this.props.push({ type: 'planter', x: block.x + 52, y: block.y + block.h - 30, rot: 0 });
    this.props.push({ type: 'bench', x: block.x + block.w - 66, y: block.y + block.h - 30, rot: 0 });
    this.palms.push({ x: block.x + block.w - 40, y: block.y + block.h - 44, s: 1, rot: rng() * 6.28 });
    this.palms.push({ x: block.x + 40, y: block.y + block.h - 44, s: 1, rot: rng() * 6.28 });
  };

  City.prototype.makePark = function (block) {
    var rng = this.rng;
    block.park = true;
    var pad = 40;
    this.props.push({ type: 'lawn', x: block.x + pad, y: block.y + pad, w: block.w - pad * 2, h: block.h - pad * 2 });
    // a fountain in the middle of the bigger parks
    if (block.w > 300) {
      this.props.push({ type: 'fountain', x: block.x + block.w / 2, y: block.y + block.h / 2, r: 44 });
    }
    var n = 5 + Math.floor(rng() * 4);
    for (var k = 0; k < n; k++) {
      this.palms.push({
        x: block.x + pad + rng() * (block.w - pad * 2),
        y: block.y + pad + rng() * (block.h - pad * 2),
        s: U.randRange(rng, 0.85, 1.25), rot: rng() * 6.28,
      });
    }
    for (var m = 0; m < 4; m++) {
      this.props.push({
        type: 'bench',
        x: block.x + pad + 30 + rng() * (block.w - pad * 2 - 60),
        y: block.y + pad + 30 + rng() * (block.h - pad * 2 - 60),
        rot: Math.floor(rng() * 4) * Math.PI / 2,
      });
    }
    this.props.push({ type: 'stall', x: block.x + block.w - 90, y: block.y + 64, rot: 0 });
  };

  City.prototype.makeLot = function (block) {
    var rng = this.rng;
    block.lot = true;
    var pad = 36;
    this.props.push({ type: 'asphalt', x: block.x + pad, y: block.y + pad, w: block.w - pad * 2, h: block.h - pad * 2 });
    // two rows of nose-in spaces facing each other across a drive lane
    var lx = block.x + pad, ly = block.y + pad;
    var lw = block.w - pad * 2, lh = block.h - pad * 2;
    var cols = Math.max(3, Math.floor(lw / 62));
    var slotW = lw / cols;
    var midY = ly + lh / 2;
    for (var c = 0; c < cols; c++) {
      for (var row = 0; row < 2; row++) {
        var sx = lx + c * slotW + slotW / 2;
        var sy = row === 0 ? ly + 34 : ly + lh - 34;
        this.parkingSpaces.push({ x: sx, y: sy, angle: row === 0 ? Math.PI / 2 : -Math.PI / 2 });
      }
    }
    // a low building at the back and a kiosk
    this.addBuilding(lx + 6, ly + 8, Math.min(120, lw * 0.34), 54, 0, 'shed', 'Park & Pay');
    for (var k = 0; k < 3; k++) {
      this.props.push({ type: 'lamp', x: lx + 20 + rng() * (lw - 40), y: midY + (k % 2 ? 20 : -20), rot: 0 });
    }
    this.palms.push({ x: block.x + block.w - 44, y: block.y + block.h - 44, s: 1, rot: rng() * 6.28 });
    this.palms.push({ x: block.x + 44, y: block.y + block.h - 44, s: 1, rot: rng() * 6.28 });
    this.lots.push({ x: lx, y: ly, w: lw, h: lh });
  };

  City.prototype.makeBeachClub = function (block) {
    var rng = this.rng;
    var x = block.x + 40, y = block.y + 40;
    var b = this.addBuilding(x, y, block.w - 200, 120, 1, 'shop', 'Sandbar Club');
    b.awning = true;
    b.awningColor = CFG.colors.neon[0];
    this.props.push({ type: 'poolDeck', x: block.x + 40, y: block.y + 190, w: block.w - 80, h: block.h - 250 });
    this.props.push({ type: 'pool', x: block.x + 90, y: block.y + 230, w: 150, h: 90 });
    for (var k = 0; k < 7; k++) {
      this.props.push({
        type: 'lounger',
        x: block.x + 60 + rng() * (block.w - 120),
        y: block.y + block.h - 90 + rng() * 40,
        rot: 0,
      });
    }
    for (var p = 0; p < 4; p++) {
      this.palms.push({
        x: block.x + 20 + p * (block.w - 40) / 3, y: block.y + block.h - 24,
        s: U.randRange(rng, 1, 1.25), rot: rng() * 6.28,
      });
    }
  };

  City.prototype.palmsOnRing = function (block, n) {
    var rng = this.rng;
    for (var k = 0; k < n; k++) {
      var edge = k % 4;
      var x, y;
      if (edge === 0) { x = block.x + 24 + rng() * (block.w - 48); y = block.y + 18; }
      else if (edge === 1) { x = block.x + block.w - 18; y = block.y + 24 + rng() * (block.h - 48); }
      else if (edge === 2) { x = block.x + 24 + rng() * (block.w - 48); y = block.y + block.h - 18; }
      else { x = block.x + 18; y = block.y + 24 + rng() * (block.h - 48); }
      this.palms.push({ x: x, y: y, s: U.randRange(rng, 0.9, 1.2), rot: rng() * 6.28 });
    }
  };

  // ---- beach and sea ---------------------------------------------------------
  City.prototype.makeBeach = function () {
    var rng = this.rng;
    this.beach = {
      x: CFG.SAND_X, y: 0, w: CFG.WATER_X - CFG.SAND_X, h: CFG.WORLD_H,
      waterX: CFG.WATER_X, worldW: CFG.WORLD_W,
    };
    // the boardwalk runs along the sand's inland edge
    this.boardwalk = { x: CFG.SAND_X + 20, y: 0, w: 46, h: CFG.WORLD_H };
    // the pier pushes into the sea
    this.pier = { x: CFG.WATER_X - 40, y: 1500, w: 260, h: 44 };
    for (var k = 0; k < 44; k++) {
      this.palms.push({
        x: CFG.SAND_X + 96 + rng() * (CFG.WATER_X - CFG.SAND_X - 170),
        y: 60 + rng() * (CFG.WORLD_H - 120),
        s: U.randRange(rng, 0.8, 1.35), rot: rng() * 6.28,
      });
    }
    for (var b = 0; b < 12; b++) {
      this.props.push({
        type: 'umbrella',
        x: CFG.SAND_X + 130 + rng() * (CFG.WATER_X - CFG.SAND_X - 240),
        y: 100 + rng() * (CFG.WORLD_H - 200),
        rot: rng() * 6.28,
        color: U.pick(rng, CFG.colors.neon),
      });
    }
    for (var t = 0; t < 6; t++) {
      this.props.push({
        type: 'boat', x: CFG.WATER_X + 60 + rng() * 200,
        y: 300 + t * 480 + rng() * 120, rot: rng() * 0.4 - 0.2,
      });
    }
  };

  // ---- street furniture ------------------------------------------------------
  City.prototype.makeStreetFurniture = function () {
    var rng = this.rng;
    // lamps and bins along every block's pavement ring
    for (var bi = 0; bi < this.blocks.length; bi++) {
      var bl = this.blocks[bi];
      var inset = 12;
      this.props.push({ type: 'lamp', x: bl.x + inset, y: bl.y + inset, rot: 0 });
      this.props.push({ type: 'lamp', x: bl.x + bl.w - inset, y: bl.y + bl.h - inset, rot: 0 });
      this.props.push({ type: 'lamp', x: bl.x + bl.w - inset, y: bl.y + inset, rot: 0 });
      this.props.push({ type: 'lamp', x: bl.x + inset, y: bl.y + bl.h - inset, rot: 0 });
      if (rng() < 0.7) {
        this.props.push({ type: 'bin', x: bl.x + 22, y: bl.y + bl.h * U.randRange(rng, 0.3, 0.7), rot: 0 });
      }
      if (rng() < 0.5) {
        this.props.push({ type: 'hydrant', x: bl.x + bl.w - 20, y: bl.y + bl.h * U.randRange(rng, 0.3, 0.7), rot: 0 });
      }
      // pedestrian spawn seeds, on the pavement
      this.pedSpawns.push({ x: bl.x + 8, y: bl.y + bl.h / 2, dir: -Math.PI / 2 });
      this.pedSpawns.push({ x: bl.x + bl.w / 2, y: bl.y + bl.h - 8, dir: 0 });
    }
  };

  // ---- lane graph for traffic ------------------------------------------------
  City.prototype.makeLanes = function () {
    // Four lanes per avenue: two each way, offset from the centre line.
    var half = CFG.ROAD / 2;
    for (var k = 0; k <= CFG.GRID; k++) {
      var c = k * CFG.CELL + half;
      // vertical avenue: northbound on the +x side, southbound on the -x side
      this.lanes.push({ axis: 'v', pos: c - 26, dir: -1, from: 0, to: CFG.CITY_H });
      this.lanes.push({ axis: 'v', pos: c + 26, dir: 1, from: 0, to: CFG.CITY_H });
      // horizontal street
      this.lanes.push({ axis: 'h', pos: c - 26, dir: -1, from: 0, to: CFG.CITY_W });
      this.lanes.push({ axis: 'h', pos: c + 26, dir: 1, from: 0, to: CFG.CITY_W });
    }
  };

  // ---- named places for the story -------------------------------------------
  City.prototype.pickMarkers = function () {
    // Job sites are chosen by district so the story walks the player across the map.
    this.markers.diner = { x: this.blocks[6].x + 90, y: this.blocks[6].y + 210, name: 'Sandbox Diner' };
    this.markers.pawn = { x: this.blocks[2].x + 120, y: this.blocks[2].y + 190, name: 'Pelican Pawn' };
    this.markers.marina = { x: CFG.SAND_X + 60, y: 1600, name: 'Marina Flats' };
    this.markers.arcade = { x: this.blocks[24].x + 150, y: this.blocks[24].y + 120, name: 'Sunset Arcade' };
    this.markers.hotel = { x: this.blocks[40].x + 110, y: this.blocks[40].y + 180, name: 'Heron Hotel' };
    this.markers.club = { x: this.blocks[13].x + 120, y: this.blocks[13].y + 140, name: 'Sandbar Club' };
    this.markers.depot = { x: this.blocks[45].x + 160, y: this.blocks[45].y + 150, name: 'Harbour Depot' };
    this.markers.park = { x: this.blocks[16].x + 160, y: this.blocks[16].y + 160, name: 'Banyan Park' };
    this.markers.bridge = { x: CFG.CITY_W - 80, y: CFG.CITY_H - 120, name: 'the Harbour Bridge' };
  };

  // ---- queries ---------------------------------------------------------------
  City.prototype.isRoad = function (x, y) {
    if (x < 0 || y < 0 || x > CFG.WORLD_W || y > CFG.WORLD_H) return false;
    if (x >= CFG.CITY_W && y > 0) return x > CFG.SAND_X ? false : true;
    var mx = x % CFG.CELL, my = y % CFG.CELL;
    return mx < CFG.ROAD || my < CFG.ROAD;
  };

  City.prototype.isSand = function (x, y) {
    return x >= CFG.SAND_X && x < CFG.WATER_X && y >= 0 && y < CFG.WORLD_H;
  };

  City.prototype.isWater = function (x, y) {
    return x >= CFG.WATER_X && y >= 0 && y < CFG.WORLD_H;
  };

  City.prototype.isOpenGround = function (x, y) {
    return this.isRoad(x, y) || this.isSand(x, y) || this.blocks.some(function (b) {
      return U.pointInRect(x, y, b) && (b.park || b.lot);
    });
  };

  // Circle-vs-building test used by walking, driving and bullets.
  City.prototype.hitBuilding = function (x, y, r) {
    for (var k = 0; k < this.buildings.length; k++) {
      var b = this.buildings[k];
      var nx = U.clamp(x, b.x, b.x + b.w);
      var ny = U.clamp(y, b.y, b.y + b.h);
      var dx = x - nx, dy = y - ny;
      if (dx * dx + dy * dy < r * r) return b;
    }
    return null;
  };

  // Slide a moving circle out of buildings; returns the corrected position.
  City.prototype.resolveCircle = function (x, y, r) {
    for (var pass = 0; pass < 2; pass++) {
      for (var k = 0; k < this.buildings.length; k++) {
        var b = this.buildings[k];
        if (x + r < b.x || x - r > b.x + b.w || y + r < b.y || y - r > b.y + b.h) continue;
        var nx = U.clamp(x, b.x, b.x + b.w);
        var ny = U.clamp(y, b.y, b.y + b.h);
        var dx = x - nx, dy = y - ny;
        var d2 = dx * dx + dy * dy;
        if (d2 >= r * r) continue;
        if (d2 > 0.0001) {
          var d = Math.sqrt(d2);
          x = nx + (dx / d) * r;
          y = ny + (dy / d) * r;
        } else {
          // centre inside the box: push out along the shallowest axis
          var left = x - b.x, right = b.x + b.w - x, top = y - b.y, bottom = b.y + b.h - y;
          var m = Math.min(left, right, top, bottom);
          if (m === left) x = b.x - r;
          else if (m === right) x = b.x + b.w + r;
          else if (m === top) y = b.y - r;
          else y = b.y + b.h + r;
        }
      }
    }
    return { x: x, y: y };
  };

  // Nearest point on a road centre line, for spawning and for the minimap.
  City.prototype.nearestRoad = function (x, y) {
    var half = CFG.ROAD / 2;
    var kx = U.clamp(Math.round((x - half) / CFG.CELL), 0, CFG.GRID);
    var ky = U.clamp(Math.round((y - half) / CFG.CELL), 0, CFG.GRID);
    var rx = kx * CFG.CELL + half;
    var ry = ky * CFG.CELL + half;
    var dx = Math.abs(x - rx), dy = Math.abs(y - ry);
    if (dx < dy) return { x: rx, y: U.clamp(y, 0, CFG.CITY_H) };
    return { x: U.clamp(x, 0, CFG.CITY_W), y: ry };
  };

  City.prototype.districtAt = function (x, y) {
    var i = U.clamp(Math.floor(x / CFG.CELL), 0, CFG.GRID - 1);
    var j = U.clamp(Math.floor(y / CFG.CELL), 0, CFG.GRID - 1);
    if (x >= CFG.SAND_X) return 'Saltwater';
    return this.districtNames[(i + j * 2) % this.districtNames.length];
  };

  City.prototype.randomRoadPoint = function (rng, avoid) {
    for (var tries = 0; tries < 40; tries++) {
      var k = Math.floor(rng() * (CFG.GRID + 1));
      var along = rng();
      var x, y;
      if (rng() < 0.5) { x = k * CFG.CELL + CFG.ROAD / 2; y = along * CFG.CITY_H; }
      else { y = k * CFG.CELL + CFG.ROAD / 2; x = along * CFG.CITY_W; }
      if (!avoid || U.dist(x, y, avoid.x, avoid.y) > avoid.r) return { x: x, y: y };
    }
    return { x: CFG.CITY_W / 2, y: CFG.CITY_H / 2 };
  };

  City.prototype.parkingSpaceNear = function (x, y, maxDist) {
    var best = null, bestD = maxDist * maxDist;
    for (var k = 0; k < this.parkingSpaces.length; k++) {
      var s = this.parkingSpaces[k];
      var d = U.dist2(s.x, s.y, x, y);
      if (d < bestD && !s.taken) { bestD = d; best = s; }
    }
    return best;
  };

  PC.City = City;
})();
