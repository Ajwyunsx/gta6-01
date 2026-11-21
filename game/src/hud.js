// hud.js — the in-game heads-up display: health and armour bars, the money counter,
// the wanted stars, the mission objective panel, and the round minimap in the top
// right with live blips for the player, cops, mission markers and pickups.

import { UI, COLORS, PLAYER } from './config.js';
import { roundRect, hexToRgba } from './render.js';

const MAP_SIZE = 208;
const MAP_RANGE = 1500; // world units across the minimap

export function drawHud(ctx, view) {
  const { w, h, world, time } = view;
  const player = world.player;

  drawBars(ctx, 30, 30, player);
  drawMoney(ctx, 30, 96, player.money);
  drawStars(ctx, w - 30, 30, player.stars, player.cool, time);
  drawMinimap(ctx, w - MAP_SIZE - 28, 76, world, player, time);
  drawObjective(ctx, w, h, world, time);
  drawSpeedo(ctx, w, h, player);
  drawWantedRing(ctx, view, player);
  if (world.missionManager) drawDialogue(ctx, w, h, world.missionManager);
  drawHint(ctx, w, h, world);
}

function drawBars(ctx, x, y, player) {
  const barW = 210;
  const barH = 14;
  panel(ctx, x - 12, y - 10, barW + 24, 74);
  // Health
  ctx.fillStyle = 'rgba(255,255,255,0.10)';
  roundRect(ctx, x, y, barW, barH, 4);
  ctx.fill();
  const hp = Math.max(0, player.health) / PLAYER.health;
  const hg = ctx.createLinearGradient(x, y, x + barW, y);
  hg.addColorStop(0, '#ff2f56');
  hg.addColorStop(1, '#ff8a6b');
  ctx.fillStyle = hg;
  roundRect(ctx, x, y, barW * hp, barH, 4);
  ctx.fill();
  // Armour
  ctx.fillStyle = 'rgba(255,255,255,0.10)';
  roundRect(ctx, x, y + 24, barW, 10, 3);
  ctx.fill();
  if (player.armor > 0) {
    ctx.fillStyle = UI.armor;
    roundRect(ctx, x, y + 24, barW * (player.armor / 100), 10, 3);
    ctx.fill();
  }
  ctx.font = '700 10px ui-sans-serif, system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.textAlign = 'left';
  ctx.fillText('HEALTH', x + 2, y - 2);
  ctx.fillText('ARMOUR', x + 2, y + 22);
  ctx.textAlign = 'right';
  ctx.fillStyle = '#ffd9dd';
  ctx.fillText(`${Math.ceil(player.health)}`, x + barW - 2, y - 2);
}

function drawMoney(ctx, x, y, money) {
  panel(ctx, x - 12, y - 8, 190, 42);
  ctx.font = '800 26px ui-sans-serif, system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillStyle = UI.money;
  ctx.fillText(`$${money.toLocaleString('en-US')}`, x + 2, y + 22);
  ctx.fillStyle = '#6d6478';
  ctx.font = '700 9px ui-sans-serif, system-ui, sans-serif';
  ctx.fillText('CASH', x + 118, y + 22);
}

function drawStars(ctx, x, y, stars, cool, time) {
  for (let i = 0; i < 5; i++) {
    const sx = x - i * 30 - 14;
    const on = 5 - i <= stars;
    drawStar(ctx, sx, y + 12, 11, on ? UI.star : 'rgba(255,255,255,0.13)', on);
  }
  // A thin cooling line under the stars, showing progress toward dropping one.
  if (stars > 0 && cool > 0) {
    const pct = Math.min(1, cool / 8.5);
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    roundRect(ctx, x - 146, y + 30, 146, 4, 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    roundRect(ctx, x - 146, y + 30, 146 * (1 - pct), 4, 2);
    ctx.fill();
  }
}

function drawStar(ctx, x, y, r, color, glow) {
  if (glow) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(x, y, 2, x, y, r * 2.4);
    g.addColorStop(0, 'rgba(255,207,77,0.35)');
    g.addColorStop(1, 'rgba(255,207,77,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r * 2.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rad = i % 2 === 0 ? r : r * 0.44;
    const px = x + Math.cos(a) * rad;
    const py = y + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
}

function drawMinimap(ctx, x, y, world, player, time) {
  const { city } = world;
  panel(ctx, x - 6, y - 6, MAP_SIZE + 12, MAP_SIZE + 12);
  ctx.save();
  ctx.beginPath();
  roundRect(ctx, x, y, MAP_SIZE, MAP_SIZE, 6);
  ctx.clip();

  const px = player.inCar ? player.inCar.x : player.x;
  const py = player.inCar ? player.inCar.y : player.y;
  const scale = MAP_SIZE / MAP_RANGE;
  ctx.fillStyle = '#12101c';
  ctx.fillRect(x, y, MAP_SIZE, MAP_SIZE);
  ctx.save();
  ctx.translate(x + MAP_SIZE / 2, y + MAP_SIZE / 2);
  ctx.scale(scale, scale);
  ctx.rotate(0);
  ctx.translate(-px, -py);
  // Base image, drawn scaled up from its 5% resolution.
  const img = city.minimap;
  const iw = img.width / 0.05;
  const ih = img.height / 0.05;
  ctx.drawImage(img, 0, 0, iw, ih);

  // Mission markers
  if (world.missionManager) {
    for (const m of world.missionManager.markers) {
      if (m.taken) continue;
      ctx.fillStyle = m.kind === 'chase' ? '#ff4257' : '#ffd76a';
      ctx.beginPath();
      ctx.arc(m.x, m.y, 46, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Cops
  for (const cop of world.police.cars) {
    ctx.fillStyle = Math.sin(time * 10) > 0 ? '#4f8bff' : '#ff4257';
    ctx.beginPath();
    ctx.arc(cop.x, cop.y, 34, 0, Math.PI * 2);
    ctx.fill();
  }
  // Pickups (only cash, so the map stays readable)
  for (const it of world.combat.pickups) {
    if (it.kind !== 'cash') continue;
    ctx.fillStyle = 'rgba(127,240,138,0.8)';
    ctx.beginPath();
    ctx.arc(it.x, it.y, 18, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // Player arrow, always centred.
  const cx = x + MAP_SIZE / 2;
  const cy = y + MAP_SIZE / 2;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((player.inCar ? player.inCar.angle : player.aim) + Math.PI / 2);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(0, -7);
  ctx.lineTo(5, 6);
  ctx.lineTo(0, 3);
  ctx.lineTo(-5, 6);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Wanted ring around the map's edge, drawn on top of the clip.
  if (player.stars > 0) {
    const pulse = 0.5 + Math.sin(time * 6) * 0.25;
    ctx.strokeStyle = `rgba(255,66,87,${0.35 + pulse * 0.4})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, MAP_SIZE * 0.31 + player.stars * 4, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Compass letter.
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = '800 10px ui-sans-serif, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('N', cx, y + 14);
  ctx.restore();

  // District label.
  const district = districtAt(world.city, px, py);
  ctx.font = '700 10px ui-sans-serif, system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.fillText(district.toUpperCase(), x + 4, y + MAP_SIZE + 2);
}

function districtAt(city, x, y) {
  for (const d of city.districts) {
    if (x > d.x - 260 && y > d.y - 200 && x < d.x + d.w && y < d.y + d.h) return d.name;
  }
  return 'Palm City';
}

function drawObjective(ctx, w, h, world, time) {
  const mm = world.missionManager;
  if (!mm) return;
  const text = mm.state === 'active' ? mm.objective : null;
  if (!text) return;
  const y = h - 92;
  ctx.font = '700 15px ui-sans-serif, system-ui, sans-serif';
  const tw = Math.min(460, ctx.measureText(text).width + 44);
  panel(ctx, w / 2 - tw / 2, y, tw, 40);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#4fe3cd';
  ctx.beginPath();
  ctx.arc(w / 2 - tw / 2 + 18, y + 20, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f2ecf5';
  ctx.fillText(text, w / 2 + 8, y + 25);
}

function drawSpeedo(ctx, w, h, player) {
  if (!player.inCar) return;
  const speed = Math.abs(Math.round(player.inCar.speed / 12));
  const x = w - 132;
  const y = h - 78;
  panel(ctx, x - 14, y - 14, 118, 62);
  ctx.textAlign = 'right';
  ctx.fillStyle = '#fff';
  ctx.font = '900 34px ui-sans-serif, system-ui, sans-serif';
  ctx.fillText(String(speed), x + 62, y + 24);
  ctx.font = '700 9px ui-sans-serif, system-ui, sans-serif';
  ctx.fillStyle = '#6d6478';
  ctx.fillText('MPH', x + 62, y + 38);
}

function drawWantedRing(ctx, view, player) {
  // A dim red wash at the screen's edge when the cops are closing in.
  if (player.stars <= 0) return;
  const { w, h } = view;
  const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.38, w / 2, h / 2, Math.max(w, h) * 0.75);
  g.addColorStop(0, 'rgba(255,40,70,0)');
  g.addColorStop(1, `rgba(255,40,70,${0.1 + player.stars * 0.035})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

function drawDialogue(ctx, w, h, mm) {
  if (mm.dialogueIndex >= mm.dialogue.length) return;
  const line = mm.dialogue[mm.dialogueIndex];
  const name = line.who === 'dessa' ? 'DESSA MARROW' : line.who === 'pops' ? 'POPS OKONJO' : line.who === 'bram' ? 'BRAM TULLEY' : 'RIO CALLOWAY';
  const color = line.who === 'dessa' ? '#ff5f9e' : line.who === 'pops' ? '#ffc061' : line.who === 'bram' ? '#ff4257' : '#4fe3cd';
  const boxW = 560;
  const x = w / 2 - boxW / 2;
  const y = h - 190;
  panel(ctx, x, y, boxW, 74, 0.88);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, 4, 74);
  ctx.textAlign = 'left';
  ctx.font = '800 11px ui-sans-serif, system-ui, sans-serif';
  ctx.fillStyle = color;
  ctx.fillText(name, x + 18, y + 22);
  ctx.font = '400 14px ui-sans-serif, system-ui, sans-serif';
  ctx.fillStyle = '#e8e3f0';
  wrapText(ctx, line.text, x + 18, y + 44, boxW - 36, 18);
}

function drawHint(ctx, w, h, world) {
  const hint = world.hint;
  if (!hint) return;
  ctx.font = '700 12px ui-sans-serif, system-ui, sans-serif';
  const tw = ctx.measureText(hint).width + 30;
  panel(ctx, w / 2 - tw / 2, h - 252, tw, 30, 0.8);
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.fillText(hint, w / 2, h - 232);
}

export function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = String(text).split(' ');
  let line = '';
  let cy = y;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, cy);
      line = word;
      cy += lineHeight;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, cy);
}

export function panel(ctx, x, y, w, h, alpha = 0.72, radius = 8) {
  ctx.save();
  ctx.fillStyle = `rgba(12,10,20,${alpha})`;
  roundRect(ctx, x, y, w, h, radius);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
}

export function drawPausedOverlay(ctx, w, h, time) {
  ctx.fillStyle = 'rgba(8,6,14,0.72)';
  ctx.fillRect(0, 0, w, h);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#f2ecf5';
  ctx.font = '900 46px ui-sans-serif, system-ui, sans-serif';
  ctx.fillText('PAUSED', w / 2, h / 2 - 40);
  ctx.font = '400 15px ui-sans-serif, system-ui, sans-serif';
  ctx.fillStyle = 'rgba(242,236,245,0.65)';
  ctx.fillText('Esc — resume     P — save     L — load     M — mute', w / 2, h / 2 + 6);
  ctx.fillText('Quit to menu: press Q', w / 2, h / 2 + 32);
}
