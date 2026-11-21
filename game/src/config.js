// config.js — palm city's tuning numbers and palette in one place.
// Everything the game measures (speeds, sizes, colours) is named here so city.js,
// render.js and the HUD all agree on one set of values.

export const WORLD = {
  width: 6000,
  height: 3800,
  beachX: 5000, // sand starts here on the east
  sandEndX: 5360, // sea starts here on the east
  beachY: 3240, // sand starts here in the south
  sandEndY: 3540, // sea starts here in the south
};

export const GRID = {
  x0: 260,
  y0: 200,
  dx: 780,
  dy: 680,
  cols: 6,
  rows: 4,
  road: 104,
  walk: 18,
};

export const ROAD_X = [];
export const ROAD_Y = [];
for (let i = 0; i <= GRID.cols; i++) ROAD_X.push(GRID.x0 + i * GRID.dx);
for (let j = 0; j <= GRID.rows; j++) ROAD_Y.push(GRID.y0 + j * GRID.dy);

export const PLAYER = {
  walk: 172,
  sprint: 258,
  radius: 11,
  health: 100,
  armor: 100,
  fireDelay: 0.15,
  bulletSpeed: 1080,
};

export const CAR = {
  accel: 360,
  brake: 760,
  maxSpeed: 640,
  reverse: 200,
  turnRate: 3.0,
  grip: 9.5,
  driftGrip: 2.2,
  drag: 0.55,
};

export const PED = {
  walk: 46,
  run: 130,
  radius: 10,
  count: 26,
};

export const WANTED = {
  maxStars: 5,
  coolTime: 8.5, // seconds out of sight before a star drops
  spawnDelay: 3.2,
};

export const COLORS = {
  void: '#0d0c14',
  asphalt: '#1a1924',
  asphaltLight: '#211f2c',
  lane: '#8a7f92',
  walk: '#2e2b3b',
  walkEdge: '#3b3749',
  curb: '#4a4459',
  grass: '#22352f',
  grassLight: '#2b4438',
  sand: '#4a3b3f',
  sandLight: '#5b4849',
  water: '#0f2b37',
  waterDeep: '#0a1f2b',
  pink: '#ff5f9e',
  hotPink: '#ff2f7d',
  teal: '#4fe3cd',
  tealDim: '#2a9c92',
  amber: '#ffc061',
  warm: '#ffd9a3',
  sun: '#ff8f5e',
  purple: '#7a5cff',
  red: '#ff4257',
  blue: '#4f8bff',
  white: '#f2ecf5',
  money: '#7ff08a',
};

export const UI = {
  money: '#8ef2a0',
  health: '#ff4f66',
  armor: '#54c8ff',
  star: '#ffcf4d',
  dim: '#6d6478',
};
