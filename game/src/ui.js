// ui.js — the screens around the game: the title with its own hand-drawn logotype,
// the mission briefing card, the pause menu, the busted and wasted screens, and the
// save/load plumbing on top of localStorage.

import { COLORS, UI, PLAYER } from './config.js';
import { roundRect } from './render.js';
import { wrapText, panel } from './hud.js';

const SAVE_KEY = 'palmcity.save.v1';

export function drawTitle(ctx, w, h, time, hasSave) {
  drawTitleBackdrop(ctx, w, h, time);

  // Logotype: PALM CITY in wide letterspaced caps, with a neon palm behind it.
  const cx = w / 2;
  const baseY = h * 0.34;
  drawNeonPalm(ctx, cx, baseY + 6, time);

  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.font = '900 92px ui-sans-serif, system-ui, sans-serif';
  const grad = ctx.createLinearGradient(cx - 260, baseY - 80, cx + 260, baseY + 10);
  grad.addColorStop(0, '#ffd9a3');
  grad.addColorStop(0.42, '#ff5f9e');
  grad.addColorStop(1, '#7a5cff');
  ctx.shadowColor = 'rgba(255,95,158,0.85)';
  ctx.shadowBlur = 34;
  ctx.fillStyle = grad;
  ctx.fillText('PALM CITY', cx, baseY);
  ctx.shadowBlur = 0;
  // Thin double outline, like a printed poster.
  ctx.strokeStyle = 'rgba(255,236,245,0.5)';
  ctx.lineWidth = 1.4;
  ctx.strokeText('PALM CITY', cx, baseY);
  ctx.restore();

  ctx.textAlign = 'center';
  ctx.font = '700 15px ui-sans-serif, system-ui, sans-serif';
  ctx.fillStyle = COLORS.teal;
  ctx.fillText('B  R  I  N  G     T  H  E     N  I  G  H  T', cx, baseY + 32);
  ctx.font = '400 13px ui-sans-serif, system-ui, sans-serif';
  ctx.fillStyle = 'rgba(242,236,245,0.5)';
  ctx.fillText('a crime story in seven jobs — Marisol Beach, 1989', cx, baseY + 56);

  // Start prompts.
  const blink = 0.55 + Math.sin(time * 2.6) * 0.35;
  ctx.font = '800 18px ui-sans-serif, system-ui, sans-serif';
  ctx.fillStyle = `rgba(255,255,255,${blink})`;
  ctx.fillText('CLICK OR PRESS ENTER TO CLOCK IN', cx, h * 0.62);
  if (hasSave) {
    ctx.font = '600 12px ui-sans-serif, system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,207,77,0.75)';
    ctx.fillText('press L to load your last save', cx, h * 0.62 + 26);
  }

  drawControlsCard(ctx, w, h);
  ctx.textAlign = 'left';
  ctx.font = '600 10px ui-sans-serif, system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.28)';
  ctx.fillText('An original game by the make.fun build. City, characters, art and music are its own.', 24, h - 18);
}

function drawTitleBackdrop(ctx, w, h, time) {
  // The same dusk as the city, bigger; a sun going down behind the water and a
  // silhouette of palms along the bottom of the frame.
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#160f22');
  g.addColorStop(0.28, '#3a1c44');
  g.addColorStop(0.52, '#8b3159');
  g.addColorStop(0.72, '#e0645f');
  g.addColorStop(0.86, '#ffa05f');
  g.addColorStop(1, '#ffd9a3');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  // Sun
  const sunY = h * 0.58;
  const sunG = ctx.createRadialGradient(w / 2, sunY, 10, w / 2, sunY, 190);
  sunG.addColorStop(0, 'rgba(255,240,190,0.9)');
  sunG.addColorStop(0.5, 'rgba(255,170,110,0.35)');
  sunG.addColorStop(1, 'rgba(255,140,90,0)');
  ctx.fillStyle = sunG;
  ctx.beginPath();
  ctx.arc(w / 2, sunY, 190, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffe8b0';
  ctx.beginPath();
  ctx.arc(w / 2, sunY, 62, 0, Math.PI * 2);
  ctx.fill();

  // Sun bands, the classic dusk cut, drawn our own way.
  ctx.fillStyle = 'rgba(90,28,52,0.55)';
  for (let i = 0; i < 5; i++) {
    const y = sunY + 8 + i * 15;
    ctx.fillRect(w / 2 - 90 + i * 4, y, 180 - i * 8, 4 + i);
  }

  // Sea horizon
  ctx.fillStyle = '#2a1630';
  ctx.fillRect(0, h * 0.66, w, h * 0.34);
  ctx.fillStyle = 'rgba(255,140,110,0.20)';
  for (let i = 0; i < 24; i++) {
    const y = h * 0.66 + i * 9;
    const len = 40 + Math.sin(time * 0.6 + i) * 22;
    ctx.fillRect(w / 2 - len / 2 + Math.sin(i) * 30, y, len, 2);
  }

  // City silhouette on the horizon.
  ctx.fillStyle = '#1a1024';
  for (let i = 0; i < 30; i++) {
    const bx = (i * 97) % w;
    const bw = 26 + ((i * 53) % 46);
    const bh = 30 + ((i * 71) % 110);
    ctx.fillRect(bx, h * 0.66 - bh, bw, bh);
  }
  // Lit windows on the skyline.
  ctx.fillStyle = 'rgba(90,230,220,0.4)';
  for (let i = 0; i < 180; i++) {
    const bx = (i * 61) % w;
    const by = h * 0.66 - 14 - ((i * 37) % 90);
    ctx.fillRect(bx, by, 2, 2);
  }

  // Palms framing the left and right of the frame.
  drawSilhouettePalm(ctx, w * 0.09, h * 1.02, 1.5, -0.12, time);
  drawSilhouettePalm(ctx, w * 0.94, h * 1.04, 1.7, 0.1, time);
  drawSilhouettePalm(ctx, w * 0.78, h * 1.06, 1.1, 0.05, time);
}

function drawSilhouettePalm(ctx, x, y, scale, lean, time) {
  const sway = Math.sin(time * 0.7 + x) * 6 * scale;
  ctx.strokeStyle = '#120a1a';
  ctx.lineWidth = 16 * scale;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.quadraticCurveTo(x + lean * 160 * scale + sway * 0.4, y - 200 * scale, x + lean * 300 * scale + sway, y - 400 * scale);
  ctx.stroke();
  const cx = x + lean * 300 * scale + sway;
  const cy = y - 400 * scale;
  ctx.lineWidth = 9 * scale;
  for (let i = 0; i < 9; i++) {
    const a = -Math.PI * 0.95 + (i / 8) * Math.PI * 0.9;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.quadraticCurveTo(cx + Math.cos(a) * 90 * scale, cy + Math.sin(a) * 60 * scale, cx + Math.cos(a) * 170 * scale, cy + Math.sin(a) * 120 * scale + 40 * scale);
    ctx.stroke();
  }
}

function drawNeonPalm(ctx, cx, cy, time) {
  // A small neon palm tucked behind the logotype, breathing in time with the music.
  const glow = 0.45 + Math.sin(time * 1.6) * 0.2;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = `rgba(79,227,205,${glow})`;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx - 210, cy + 46);
  ctx.quadraticCurveTo(cx - 244, cy - 20, cx - 232, cy - 74);
  ctx.stroke();
  for (let i = 0; i < 6; i++) {
    const a = -Math.PI * 0.9 + (i / 5) * Math.PI * 0.8;
    ctx.beginPath();
    ctx.moveTo(cx - 232, cy - 74);
    ctx.quadraticCurveTo(cx - 232 + Math.cos(a) * 40, cy - 74 + Math.sin(a) * 26, cx - 232 + Math.cos(a) * 70, cy - 74 + Math.sin(a) * 44 + 10);
    ctx.stroke();
  }
  ctx.strokeStyle = `rgba(255,95,158,${glow * 0.8})`;
  ctx.beginPath();
  ctx.moveTo(cx + 214, cy + 46);
  ctx.quadraticCurveTo(cx + 246, cy - 16, cx + 236, cy - 66);
  ctx.stroke();
  for (let i = 0; i < 6; i++) {
    const a = -Math.PI * 0.9 + (i / 5) * Math.PI * 0.8;
    ctx.beginPath();
    ctx.moveTo(cx + 236, cy - 66);
    ctx.quadraticCurveTo(cx + 236 + Math.cos(a) * 36, cy - 66 + Math.sin(a) * 22, cx + 236 + Math.cos(a) * 62, cy - 66 + Math.sin(a) * 38 + 10);
    ctx.stroke();
  }
  ctx.restore();
}

function drawControlsCard(ctx, w, h) {
  const cw = Math.min(660, w - 120);
  const x = w / 2 - cw / 2;
  const y = h * 0.69;
  panel(ctx, x, y, cw, 158, 0.78, 10);
  const cols = [
    ['WASD', 'walk · drive'],
    ['MOUSE', 'aim · click to shoot'],
    ['E', 'enter / exit car'],
    ['SHIFT', 'sprint'],
    ['SPACE', 'handbrake'],
    ['H', 'horn'],
    ['ESC', 'pause · save · load'],
    ['M', 'mute'],
  ];
  ctx.textAlign = 'left';
  const colW = cw / 2;
  cols.forEach(([key, label], i) => {
    const col = i >= 4 ? 1 : 0;
    const row = i % 4;
    const kx = x + 28 + col * colW;
    const ky = y + 34 + row * 30;
    ctx.font = '800 11px ui-sans-serif, system-ui, sans-serif';
    ctx.fillStyle = COLORS.teal;
    ctx.fillText(key, kx, ky);
    ctx.font = '400 13px ui-sans-serif, system-ui, sans-serif';
    ctx.fillStyle = 'rgba(242,236,245,0.8)';
    ctx.fillText(label, kx + 62, ky);
  });
}

// --- briefing ---------------------------------------------------------------

export function drawBriefing(ctx, w, h, mission, time) {
  ctx.fillStyle = 'rgba(8,6,14,0.82)';
  ctx.fillRect(0, 0, w, h);
  const bw = Math.min(720, w - 140);
  const bh = 380;
  const x = w / 2 - bw / 2;
  const y = h / 2 - bh / 2;

  ctx.save();
  ctx.strokeStyle = 'rgba(79,227,205,0.5)';
  ctx.lineWidth = 1;
  roundRect(ctx, x, y, bw, bh, 12);
  ctx.stroke();
  ctx.fillStyle = 'rgba(14,11,22,0.94)';
  ctx.fill();
  ctx.restore();

  // Header band
  ctx.save();
  ctx.beginPath();
  roundRect(ctx, x, y, bw, 84, 12);
  ctx.clip();
  const g = ctx.createLinearGradient(x, y, x + bw, y);
  g.addColorStop(0, 'rgba(255,95,158,0.24)');
  g.addColorStop(1, 'rgba(122,92,255,0.10)');
  ctx.fillStyle = g;
  ctx.fillRect(x, y, bw, 84);
  ctx.restore();

  ctx.textAlign = 'left';
  ctx.font = '800 11px ui-sans-serif, system-ui, sans-serif';
  ctx.fillStyle = COLORS.pink;
  ctx.fillText(mission.titleCard ?? 'JOB', x + 32, y + 30);
  ctx.font = '900 34px ui-sans-serif, system-ui, sans-serif';
  ctx.fillStyle = '#fff';
  ctx.fillText(mission.title, x + 32, y + 66);
  ctx.textAlign = 'right';
  ctx.font = '800 15px ui-sans-serif, system-ui, sans-serif';
  ctx.fillStyle = UI.money;
  ctx.fillText(mission.reward ? `$${mission.reward}` : '', x + bw - 32, y + 50);
  ctx.font = '600 10px ui-sans-serif, system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.fillText(mission.reward ? 'PAYOUT' : '', x + bw - 32, y + 64);

  ctx.textAlign = 'left';
  ctx.font = '400 15px ui-sans-serif, system-ui, sans-serif';
  ctx.fillStyle = 'rgba(242,236,245,0.86)';
  wrapText(ctx, mission.brief, x + 32, y + 122, bw - 64, 23);

  // Objectives list
  let oy = y + 210;
  ctx.font = '800 10px ui-sans-serif, system-ui, sans-serif';
  ctx.fillStyle = COLORS.teal;
  ctx.fillText('ON THE LIST', x + 32, oy - 16);
  ctx.font = '400 13px ui-sans-serif, system-ui, sans-serif';
  for (const step of mission.steps.slice(0, 5)) {
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.fillRect(x + 34, oy - 5, 6, 6);
    ctx.fillStyle = 'rgba(242,236,245,0.72)';
    ctx.fillText(step.text, x + 50, oy);
    oy += 24;
  }

  const blink = 0.55 + Math.sin(time * 3) * 0.35;
  ctx.textAlign = 'center';
  ctx.font = '800 13px ui-sans-serif, system-ui, sans-serif';
  ctx.fillStyle = `rgba(255,255,255,${blink})`;
  ctx.fillText('PRESS ENTER TO START', w / 2, y + bh - 28);
}

// --- game over / busted -----------------------------------------------------

export function drawEndScreen(ctx, w, h, kind, stats, time) {
  ctx.fillStyle = kind === 'busted' ? 'rgba(10,16,30,0.86)' : 'rgba(30,6,12,0.86)';
  ctx.fillRect(0, 0, w, h);
  ctx.textAlign = 'center';

  // Distance-marched bands behind the word, a slow vertical fall.
  ctx.save();
  ctx.globalAlpha = 0.18;
  for (let i = 0; i < 18; i++) {
    const y = ((i * 46 + time * 26) % (h + 60)) - 30;
    ctx.fillStyle = kind === 'busted' ? '#4f8bff' : '#ff4257';
    ctx.fillRect(0, y, w, 2);
  }
  ctx.restore();

  ctx.font = '900 82px ui-sans-serif, system-ui, sans-serif';
  ctx.fillStyle = kind === 'busted' ? '#9fc4ff' : '#ff6b7d';
  ctx.shadowColor = kind === 'busted' ? 'rgba(80,140,255,0.8)' : 'rgba(255,66,87,0.8)';
  ctx.shadowBlur = 30;
  ctx.fillText(kind === 'busted' ? 'BUSTED' : 'WASTED', w / 2, h / 2 - 30);
  ctx.shadowBlur = 0;

  ctx.font = '400 15px ui-sans-serif, system-ui, sans-serif';
  ctx.fillStyle = 'rgba(242,236,245,0.72)';
  ctx.fillText(kind === 'busted' ? 'The Palm City PD had a busy night. They took your cash and your gun.' : 'Somewhere in this city, somebody is telling this story wrong.', w / 2, h / 2 + 20);

  if (stats) {
    ctx.font = '700 13px ui-sans-serif, system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillText(`jobs done ${stats.missions}  ·  cash $${stats.money}  ·  busted ${stats.timesBusted}`, w / 2, h / 2 + 52);
  }

  const blink = 0.55 + Math.sin(time * 3) * 0.35;
  ctx.font = '800 14px ui-sans-serif, system-ui, sans-serif';
  ctx.fillStyle = `rgba(255,255,255,${blink})`;
  ctx.fillText('PRESS ENTER TO GET BACK OUT THERE', w / 2, h / 2 + 110);
}

// --- pause ------------------------------------------------------------------

export function drawPauseMenu(ctx, w, h, time, index, hasSave) {
  ctx.fillStyle = 'rgba(8,6,14,0.74)';
  ctx.fillRect(0, 0, w, h);
  const bw = 360;
  const x = w / 2 - bw / 2;
  const y = h / 2 - 150;
  panel(ctx, x, y, bw, 300, 0.9, 12);
  ctx.textAlign = 'center';
  ctx.font = '900 30px ui-sans-serif, system-ui, sans-serif';
  ctx.fillStyle = '#fff';
  ctx.fillText('PAUSED', w / 2, y + 48);

  const items = ['Resume', hasSave ? 'Load last save' : 'Save game', 'Quit to title'];
  ctx.font = '700 14px ui-sans-serif, system-ui, sans-serif';
  items.forEach((item, i) => {
    const iy = y + 100 + i * 46;
    const on = i === index;
    if (on) {
      ctx.fillStyle = 'rgba(255,95,158,0.16)';
      roundRect(ctx, x + 28, iy - 22, bw - 56, 36, 8);
      ctx.fill();
      ctx.fillStyle = COLORS.pink;
      ctx.fillRect(x + 28, iy - 22, 3, 36);
    }
    ctx.fillStyle = on ? '#fff' : 'rgba(242,236,245,0.55)';
    ctx.fillText(item, w / 2, iy + 2);
  });

  ctx.font = '400 11px ui-sans-serif, system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillText('↑↓ choose · Enter select · Esc resume', w / 2, y + 268);
}

// --- save / load ------------------------------------------------------------

export function saveGame(world) {
  try {
    const mm = world.missionManager;
    const p = world.player;
    const data = {
      v: 1,
      time: Date.now(),
      player: {
        x: p.x,
        y: p.y,
        heading: p.heading,
        health: p.health,
        armor: p.armor,
        money: p.money,
        stars: p.stars,
        heat: p.heat,
      },
      missionIndex: mm.index,
      missionState: mm.state,
      missionStep: mm.step,
      stats: world.stats,
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.v !== 1) return null;
    return data;
  } catch {
    return null;
  }
}

export function hasSave() {
  try {
    return !!localStorage.getItem(SAVE_KEY);
  } catch {
    return false;
  }
}

export function applySave(world, data) {
  const p = world.player;
  p.x = data.player.x;
  p.y = data.player.y;
  p.heading = data.player.heading;
  p.health = data.player.health;
  p.armor = data.player.armor;
  p.money = data.player.money;
  p.stars = data.player.stars ?? 0;
  p.heat = data.player.heat ?? 0;
  p.inCar = null;
  p.alive = true;
  world.stats = data.stats ?? world.stats;
  world.missionManager.index = data.missionIndex ?? 0;
  world.missionManager.state = 'idle';
  world.missionManager.markers = [];
  world.missionManager.enemies = [];
}

export function drawSaveToast(ctx, w, h, text, life) {
  if (life <= 0) return;
  const a = Math.min(1, life * 2);
  ctx.globalAlpha = a;
  ctx.textAlign = 'center';
  ctx.font = '800 13px ui-sans-serif, system-ui, sans-serif';
  const tw = ctx.measureText(text).width + 36;
  panel(ctx, w / 2 - tw / 2, h - 270, tw, 34, 0.85);
  ctx.fillStyle = UI.money;
  ctx.fillText(text, w / 2, h - 248);
  ctx.globalAlpha = 1;
}
