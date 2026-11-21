// config.js — palm city's tuning numbers and palette in one place.
// Everything the game measures (speeds, sizes, colours) is named here so city.js,
// render.js and the HUD all agree on one set of values.

export const WORLD = {
  width: 4400,
  height: 2760,
  beachX: 3360, // the promenade and sand start just east of the coastal avenue
  sandEndX: 3760, // the sea starts here on the east
  beachY: 2040, // sand starts here in the south, past the docks road
  sandEndY: 2440, // the sea starts here in the south
};

export const GRID = {
  x0: 240,
  y0: 190,
  dx: 760,
  dy: 590,
  cols: 4,
  rows: 3,
  road: 126,
  walk: 22,
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
  count: 24,
};

export const WANTED = {
  maxStars: 5,
  coolTime: 8.5, // seconds out of sight before a star drops
  spawnDelay: 3.2,
};

export const COLORS = {
  void: '#0d0c14',
  asphalt: '#2b2836',
  asphaltLight: '#332f42',
  lane: '#bcb0c0',
  walk: '#4a4459',
  walkEdge: '#544d64',
  curb: '#6b6279',
  grass: '#25443a',
  grassLight: '#2f5443',
  sand: '#7a6059',
  sandLight: '#8d7166',
  water: '#12455e',
  waterDeep: '#0a2a3d',
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
