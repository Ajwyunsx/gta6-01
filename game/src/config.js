/* Palm City — configuration: world metrics, palette, tuning, math helpers and a seeded RNG.
   Everything the other modules need to agree on lives here, so a number is changed once. */
(function (PC) {
  'use strict';

  var CELL = 320;          // one city block plus its roads, in world pixels
  var ROAD = 108;          // road width; two driving lanes and two parking strips
  var GRID = 17;           // blocks per side: a 5440 px city
  var CITY_W = CELL * GRID;
  var CITY_H = CELL * GRID;
  var BEACH_H = 430;

  PC.CONFIG = {
    VW: 1280,
    VH: 720,
    STEP: 1 / 60,
    CELL: CELL,
    ROAD: ROAD,
    GRID: GRID,
    CITY_W: CITY_W,
    CITY_H: CITY_H,
    BEACH_H: BEACH_H,
    WORLD_W: CITY_W,
    WORLD_H: CITY_H + BEACH_H + 1500,
    LANE: 20,              // lane centre offset from a road's centre line
    ZOOM: 1,

    PLAYER: {
      radius: 9,
      speed: 208,
      sprint: 322,
      maxHealth: 100,
      maxArmor: 100,
      carEnterRange: 62
    },

    CAR: {
      length: 54,
      width: 26,
      maxSpeed: 372,
      reverseMax: 132,
      accel: 340,
      brake: 620,
      drag: 92,
      turnRate: 2.55,
      grip: 7.2,
      health: 100
    },

    TRAFFIC: {
      max: 30,
      speed: 116,
      speedJitter: 34,
      spawnEvery: 0.45
    },

    POLICE: {
      maxCars: 6,
      speed: 392,
      accel: 400,
      ramRange: 54,
      shootRange: 330,
      shootEvery: 0.85,
      heatDecayDelay: 9,
      heatDecay: 0.16,
      spawnRange: 780
    },

    PEDS: { max: 46, speed: 62 },

    COMBAT: {
      pistolDamage: 26,
      pistolRange: 760,
      pistolCooldown: 0.16,
      clipSize: 15,
      reload: 1.4
    },

    MISSION_REWARD_BASE: 120,
    START_MONEY: 480
  };

  /* The art direction: a sun-bleached art-deco seaside city at golden hour — warm sand,
     turquoise water, pastel stucco and long shadows thrown south-east. */
  PC.PALETTE = {
    sand: '#f6dfb6',
    sandLight: '#fbeccb',
    sandDark: '#e6c795',
    sandWet: '#dcbf90',
    water: '#2ba7b6',
    waterDeep: '#1a7e94',
    waterLight: '#63cfd2',
    foam: '#e8fbf8',
    asphalt: '#4d5058',
    asphaltDark: '#3b3e45',
    asphaltLine: '#e8e1cd',
    yellowLine: '#e8c268',
    sidewalk: '#e3d8c3',
    sidewalkEdge: '#cdbfa7',
    curb: '#b3a691',
    grass: '#8eb98b',
    grassDark: '#75a274',
    palmFrond: '#3a7d55',
    palmFrondLight: '#4c9668',
    palmTrunk: '#8a6a4b',
    windowLit: '#ffd88c',
    windowDark: '#39505e',
    shadow: 'rgba(72, 46, 30, 0.26)',
    ink: '#221c1a',
    paper: '#f6efe1',
    money: '#7fc98b',
    health: '#e2574c',
    armor: '#5aa9d6',
    heat: '#e0402f',
    accent: '#ff6f7d',
    accent2: '#37d3cf',
    gold: '#f2c14e'
  };

  PC.util = {
    clamp: function (v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; },
    lerp: function (a, b, t) { return a + (b - a) * t; },
    dist: function (ax, ay, bx, by) { var dx = bx - ax, dy = by - ay; return Math.sqrt(dx * dx + dy * dy); },
    dist2: function (ax, ay, bx, by) { var dx = bx - ax, dy = by - ay; return dx * dx + dy * dy; },
    angleDiff: function (a, b) {
      var d = (b - a) % (Math.PI * 2);
      if (d > Math.PI) d -= Math.PI * 2;
      if (d < -Math.PI) d += Math.PI * 2;
      return d;
    },
    approach: function (v, target, step) {
      if (v < target) return Math.min(v + step, target);
      return Math.max(v - step, target);
    },
    rand: function (rng, lo, hi) { return lo + rng() * (hi - lo); },
    pick: function (rng, arr) { return arr[Math.floor(rng() * arr.length) % arr.length]; },
    roundRect: function (ctx, x, y, w, h, r) {
      var rr = Math.min(r, w / 2, h / 2);
      ctx.beginPath();
      ctx.moveTo(x + rr, y);
      ctx.lineTo(x + w - rr, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
      ctx.lineTo(x + w, y + h - rr);
      ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
      ctx.lineTo(x + rr, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
      ctx.lineTo(x, y + rr);
      ctx.quadraticCurveTo(x, y, x + rr, y);
      ctx.closePath();
    }
  };

  /* mulberry32: small, fast and identical between runs, so ?seed= reproduces a city and a shot. */
  PC.makeRng = function (seed) {
    var s = seed >>> 0;
    return function () {
      s = (s + 0x6D2B79F5) >>> 0;
      var t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  PC.CONFIG.DEFAULT_SEED = 20261121;
})(window.PC = window.PC || {});
