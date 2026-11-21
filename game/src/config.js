// Palm City — shared namespace, tuning constants and the sun-soaked palette.
// Every module hangs off the single global PC object; the page loads them as classic
// scripts in a fixed order, so nothing here imports anything and nothing touches the net.
(function (global) {
  'use strict';

  const PC = (global.PC = global.PC || {});

  PC.VERSION = '1.0.0';
  PC.TITLE = 'Palm City';

  // ---- world geometry -----------------------------------------------------
  // The city is a square grid of blocks with a road on every seam and a beach along the
  // south shore. One cell is one block plus one road; the world is GRID cells across.
  PC.GRID = 13;
  PC.CELL = 256;                    // block pitch in pixels
  PC.ROAD = 72;                     // asphalt width, centred on every seam
  PC.WORLD = PC.GRID * PC.CELL;     // 3328 px square
  PC.SIDEWALK = 14;                 // kerb strip between asphalt and lot line
  PC.BEACH_ROW = PC.GRID - 1;       // the last block row is sand, palms and water

  // ---- simulation ---------------------------------------------------------
  PC.STEP = 1 / 60;                 // fixed step, seconds
  PC.MAX_STEPS = 5;                 // catch-up cap per frame

  // ---- on foot ------------------------------------------------------------
  PC.WALK_SPEED = 118;
  PC.RUN_SPEED = 205;
  PC.PLAYER_RADIUS = 9;
  PC.PLAYER_MAX_HEALTH = 100;
  PC.PLAYER_MAX_ARMOUR = 100;

  // ---- cars ---------------------------------------------------------------
  PC.CAR = {
    accel: 520,          // px/s^2 under throttle
    brake: 900,
    reverse: 260,
    maxSpeed: 430,
    maxReverse: 150,
    drag: 0.985,         // per step, rolling resistance
    grip: 7.5,           // lateral velocity bleed: higher is tighter
    steer: 2.9,          // rad/s at full lock, scaled by speed
    handbrakeGrip: 2.2,
    length: 58,
    width: 29,
    radius: 20,
  };

  // ---- traffic ------------------------------------------------------------
  PC.TRAFFIC = {
    count: 26,
    speed: 150,
    laneOffset: 20,      // right-hand drive: keep to the right of the centre line
    turnChance: 0.34,
    slowRadius: 120,
  };

  // ---- police -------------------------------------------------------------
  PC.POLICE = {
    maxStars: 5,
    heatPerStar: 100,
    coolRate: 5.2,          // heat lost per second with no cops in sight
    cruiserSpeed: 405,
    cruiserAccel: 460,
    spawnInterval: 3.2,
    maxCars: 6,
    shootRange: 300,
    bulletSpeed: 1150,
  };

  // ---- combat -------------------------------------------------------------
  PC.COMBAT = {
    playerFireRate: 0.16,
    playerDamage: 26,
    playerRange: 620,
    spread: 0.035,
    pedHealth: 60,
    copHealth: 85,
    armourAbsorb: 0.65,
  };

  // ---- look ---------------------------------------------------------------
  // Late afternoon on the coast: warm key light, violet shadows, sea haze.
  PC.PALETTE = {
    asphalt: '#4f5158',
    asphaltWorn: '#5a5c63',
    lane: '#e9dfc4',
    kerb: '#cfc4ad',
    pavement: '#dccfb4',
    pavementLine: '#c8b99b',
    sand: '#ead6a8',
    sandDark: '#dcc492',
    water: '#2b7f97',
    waterLight: '#3fa2b4',
    foam: '#e8f6f4',
    grass: '#7fae6a',
    grassDark: '#6b9a58',
    lot: '#bcb3a2',
    shadow: 'rgba(44,28,52,0.24)',
    sky: '#f6d9b0',
    hud: '#f7efe0',
    hudDim: 'rgba(247,239,224,0.55)',
    accent: '#ff8a5c',
    gold: '#ffd166',
    star: '#ffc94a',
    danger: '#ef5b5b',
    police: '#4d7fd6',
  };

  // Pastel facades, the city's own art direction: washed coral, mint, cream, lilac.
  PC.FACADES = [
    { wall: '#e8917a', trim: '#f6c3ae', roof: '#b96a56' },
    { wall: '#93cfb6', trim: '#c9e9d9', roof: '#5f9c85' },
    { wall: '#f2e0bd', trim: '#fbf1da', roof: '#c3a97f' },
    { wall: '#b8a5d6', trim: '#d8cbec', roof: '#8a789f' },
    { wall: '#83bccb', trim: '#bde0e8', roof: '#5a8f9c' },
    { wall: '#f0b184', trim: '#f9d6bb', roof: '#c08256' },
    { wall: '#e6daa2', trim: '#f5edc8', roof: '#b3a86f' },
    { wall: '#d3a3b8', trim: '#ecc9d7', roof: '#a1738a' },
  ];

  PC.CAR_COLOURS = ['#e9553f', '#f0c14b', '#4f8fd4', '#7dbb6a', '#efe6d5', '#3b4049', '#c86fae', '#57c6d8'];

  // ---- helpers ------------------------------------------------------------
  PC.clamp = function clamp(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
  };
  PC.lerp = function lerp(a, b, t) {
    return a + (b - a) * t;
  };
  PC.dist = function dist(ax, ay, bx, by) {
    const dx = bx - ax;
    const dy = by - ay;
    return Math.sqrt(dx * dx + dy * dy);
  };
  PC.angleDiff = function angleDiff(a, b) {
    let d = (b - a) % (Math.PI * 2);
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    return d;
  };
  PC.wrapAngle = function wrapAngle(a) {
    while (a > Math.PI) a -= Math.PI * 2;
    while (a < -Math.PI) a += Math.PI * 2;
    return a;
  };

  /** Mulberry32: a small deterministic PRNG so the city is the same on every machine. */
  PC.rng = function rng(seed) {
    let a = seed >>> 0;
    const next = function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    next.range = (lo, hi) => lo + next() * (hi - lo);
    next.int = (lo, hi) => Math.floor(lo + next() * (hi - lo + 1));
    next.pick = (arr) => arr[Math.floor(next() * arr.length)];
    next.chance = (p) => next() < p;
    return next;
  };

  PC.money = function money(n) {
    return '$' + Math.max(0, Math.round(n)).toLocaleString('en-US');
  };
})(window);
