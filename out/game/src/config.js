// config.js — every number and colour the city runs on, plus the seeded RNG and small maths helpers.
// Nothing here draws or updates anything: it is the tuning sheet for the whole game.
(function () {
  'use strict';
  var PC = (window.PC = window.PC || {});

  // The city grid. Blocks are 340 units square, roads 110 wide, 7 x 7 blocks, so the
  // built city is 3260 x 3260; the sand and the ocean run east of the last avenue.
  var CFG = {
    SEED: 20261121,
    BLOCK: 340,
    ROAD: 110,
    GRID: 7,
    CELL: 450,
    CITY_W: 3260,
    CITY_H: 3260,
    SAND_X: 3260,
    WATER_X: 3620,
    WORLD_W: 3980,
    WORLD_H: 3260,
    SIDEWALK: 22,
    // Fixed simulation step. Every system assumes these seconds.
    STEP: 1 / 60,
    MAX_FRAME_STEPS: 4,
    CAMERA_SCALE: 0.92,
  };

  CFG.colors = {
    asphalt: '#3a3e49',
    asphaltAlt: '#353945',
    asphaltWet: '#31343f',
    roadLine: '#efe3c6',
    roadLineDim: 'rgba(239,227,198,0.30)',
    crosswalk: 'rgba(239,227,198,0.55)',
    sidewalk: '#8b8377',
    sidewalkAlt: '#948b7e',
    sidewalkEdge: '#6f685e',
    kerb: '#a49a8a',
    sand: '#e3c495',
    sandAlt: '#d8b787',
    sandWet: '#c6a274',
    ocean: '#17788f',
    oceanDeep: '#0f5f77',
    oceanHi: '#2fa9bd',
    foam: '#dcf4f2',
    grass: '#5f8c5c',
    grassAlt: '#517a52',
    shadow: 'rgba(20,16,26,0.34)',
    night: 'rgba(28,20,48,0.16)',
    building: ['#e2684f', '#e7dac0', '#2f9e96', '#5a4b72', '#c9603f', '#98a49c', '#d9a35a', '#8d4a63'],
    buildingTop: ['#c9553f', '#d6c9ae', '#25867f', '#4a3d5f', '#ad5030', '#7f8b84', '#bf8a45', '#763b51'],
    windowLit: '#ffd98a',
    windowDark: '#26303c',
    windowGlow: 'rgba(255,214,130,0.30)',
    neon: ['#ff5fa2', '#57f0ff', '#ffd166', '#9d7bff', '#6cf0a0'],
    palm: '#2f6b46',
    palmHi: '#3d8556',
    palmTrunk: '#6b4a33',
    player: '#46e0c1',
    playerDark: '#1d8f7c',
    cop: '#3f6fd8',
    copDark: '#274a99',
    sirenRed: '#ff3b4e',
    sirenBlue: '#3f8bff',
    ped: ['#f2c14e', '#e26d5c', '#6ec1e4', '#b48ad8', '#8ed08a', '#f0a6ca', '#f3e2b8'],
    cash: '#8ef0a0',
    health: '#ff7373',
    armour: '#6cb6ff',
    ammo: '#ffcf6b',
    marker: '#ffd166',
    markerHot: '#fff2c4',
    hudPanel: 'rgba(16,14,22,0.74)',
    hudPanelSoft: 'rgba(16,14,22,0.46)',
    hudText: '#f7f0e1',
    hudDim: 'rgba(247,240,225,0.55)',
    gold: '#ffcb52',
    danger: '#ff5566',
    ui: {
      ink: '#141019',
      cream: '#f7f0e1',
      coral: '#e2684f',
      teal: '#35c9b4',
      pink: '#ff5fa2',
      cyan: '#57f0ff',
    },
  };

  CFG.tuning = {
    // on foot
    walkSpeed: 186,
    sprintSpeed: 312,
    footAccel: 1900,
    footFriction: 12,
    playerRadius: 13,
    // cars
    carMaxSpeed: 660,
    carReverseMax: 210,
    carAccel: 700,
    carBrake: 1500,
    carDrag: 0.72,
    carGrip: 7.4,
    carSteerRate: 2.5,
    carRadius: 26,
    carEnterRange: 78,
    // damage
    pedHealth: 100,
    copHealth: 130,
    carHealth: 320,
    bulletDamage: 34,
    // heat
    heatDecayDelay: 9,
    heatDecayRate: 0.55,
    sirenRange: 1100,
    // traffic density
    trafficTarget: 26,
    pedTarget: 46,
    // economy
    startCash: 120,
    jobPayout: 700,
    // camera
    lookAhead: 70,
    cameraStiffness: 6.2,
    shakeDecay: 6,
  };

  // ---- maths -----------------------------------------------------------------
  var U = (PC.U = {});

  U.clamp = function (v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
  };
  U.lerp = function (a, b, t) {
    return a + (b - a) * t;
  };
  // Frame-rate independent smoothing toward a target.
  U.damp = function (a, b, lambda, dt) {
    return U.lerp(a, b, 1 - Math.exp(-lambda * dt));
  };
  U.dist = function (ax, ay, bx, by) {
    var dx = ax - bx,
      dy = ay - by;
    return Math.sqrt(dx * dx + dy * dy);
  };
  U.dist2 = function (ax, ay, bx, by) {
    var dx = ax - bx,
      dy = ay - by;
    return dx * dx + dy * dy;
  };
  U.wrapAngle = function (a) {
    while (a > Math.PI) a -= Math.PI * 2;
    while (a < -Math.PI) a += Math.PI * 2;
    return a;
  };
  U.turnToward = function (from, to, maxStep) {
    var d = U.wrapAngle(to - from);
    if (d > maxStep) d = maxStep;
    if (d < -maxStep) d = -maxStep;
    return from + d;
  };
  U.pointInRect = function (x, y, r) {
    return x >= r.x && y >= r.y && x <= r.x + r.w && y <= r.y + r.h;
  };
  U.randRange = function (rng, lo, hi) {
    return lo + (hi - lo) * rng();
  };
  U.pick = function (rng, list) {
    return list[Math.floor(rng() * list.length) % list.length];
  };
  U.shade = function (hex, amount) {
    var n = parseInt(hex.slice(1), 16);
    var r = U.clamp(((n >> 16) & 255) + amount, 0, 255);
    var g = U.clamp(((n >> 8) & 255) + amount, 0, 255);
    var b = U.clamp((n & 255) + amount, 0, 255);
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  };
  U.money = function (n) {
    return '$' + Math.max(0, Math.round(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  };
  U.roundRect = function (ctx, x, y, w, h, r) {
    var rr = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
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
  };

  // mulberry32: tiny, deterministic, good enough for a city.
  U.makeRng = function (seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  // Road helpers used by city, traffic and the minimap.
  CFG.roadSpan = function (k) {
    return k * CFG.CELL;
  };

  PC.CFG = CFG;
})();
