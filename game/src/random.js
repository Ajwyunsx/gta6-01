// random.js — one small seeded generator. The city and the traffic are drawn from
// it so a given seed always builds the same Palm City.

export function makeRng(seed) {
  let s = (seed >>> 0) || 1;
  const next = () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    float: (a = 0, b = 1) => a + next() * (b - a),
    int: (a, b) => Math.floor(a + next() * (b - a + 1)),
    pick: (list) => list[Math.floor(next() * list.length)],
    chance: (p) => next() < p,
    sign: () => (next() < 0.5 ? -1 : 1),
  };
}

// A cheap deterministic hash for per-building details (lit windows, roof clutter).
export function hash2(x, y, salt = 0) {
  let h = Math.imul((x | 0) ^ 0x9e3779b9, 0x85ebca6b);
  h ^= Math.imul((y | 0) + 0x165667b1, 0xc2b2ae35);
  h ^= Math.imul((salt | 0) + 0x27d4eb2f, 0x27d4eb2f);
  h = (h ^ (h >>> 15)) >>> 0;
  return h;
}

export function hashFloat(x, y, salt = 0) {
  return hash2(x, y, salt) / 4294967296;
}

export function randomRange(a, b) {
  return a + Math.random() * (b - a);
}

export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function dist(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

export function angleTo(ax, ay, bx, by) {
  return Math.atan2(by - ay, bx - ax);
}

export function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

export function approachAngle(a, b, step) {
  const d = wrapAngle(b - a);
  return a + clamp(d, -step, step);
}
