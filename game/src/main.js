// main.js — the game's spine: fixed canvas, the loop, the state machine (title, briefing,
// play, pause, busted, wasted), the smooth camera, and the wiring between the systems
// city.js, entities.js, traffic.js, police.js, combat.js and missions.js build.

import { buildCity, walkable, findSpawn } from './city.js';
import { createInput } from './input.js';
import { Effects } from './effects.js';
import { Player, spawnPedestrians, spawnParkedCars, Ped } from './entities.js';
import { CityTraffic, scarePeds } from './traffic.js';
import { Police } from './police.js';
import { Combat } from './combat.js';
import { MissionManager, MISSIONS } from './missions.js';
import { driveCar, enterCar, exitCar, nearestCar, resolveCarCollisions } from './vehicles.js';
import { Sound } from './audio.js';
import { makeRng, clamp, angleTo, randomRange } from './random.js';
import { drawScene, drawGroundMarker } from './render.js';
import { drawHud } from './hud.js';
import { drawTitle, drawBriefing, drawEndScreen, drawPauseMenu, saveGame, loadGame, hasSave, applySave, drawSaveToast } from './ui.js';
import { applyShot } from './shots.js';
import { PED, WANTED, COLORS } from './config.js';

const WIDTH = 1280;
const HEIGHT = 720;

const params = new URLSearchParams(location.search);
const seed = Number(params.get('seed') ?? 7);
const shot = params.get('shot');

const canvas = document.getElementById('game');
canvas.width = WIDTH;
canvas.height = HEIGHT;
const ctx = canvas.getContext('2d', { alpha: false });

const input = createInput(canvas);
const sound = new Sound();
const effects = new Effects();
const rng = makeRng(seed * 7919 + 13);

const city = buildCity(seed);
const spawn = findSpawn(city);

const world = {
  city,
  player: new Player(spawn.x, spawn.y),
  peds: [],
  cars: [],
  police: new Police(city),
  combat: new Combat(city),
  missionManager: new MissionManager(city, rng),
  stats: { missions: 0, timesBusted: 0, timesWasted: 0, distance: 0 },
  hint: '',
  hintTimer: 0,
  vehicleApi: { driveCar },
  scarePeds: (x, y, r) => scarePeds(world.peds, x, y, r),
  onBusted: () => busted(),
  toast: '',
  toastTimer: 0,
};

world.peds = spawnPedestrians(city, PED.count, rng);
world.cars = spawnParkedCars(city, rng);
world.traffic = new CityTraffic(city, rng);
for (let i = 0; i < 14; i++) world.traffic.spawn();
world.combat.scatterPickups(city, rng, 30);
world.thugs = world.missionManager.enemies;

world.missionManager.onComplete = (mission) => {
  if (mission.reward) {
    world.player.money += mission.reward;
    effects.text(world.player.x, world.player.y - 50, `$${mission.reward}`, '#8ef2a0', 22);
  }
  world.stats.missions = Math.max(world.stats.missions, world.missionManager.index + 1);
  const isLast = world.missionManager.index >= MISSIONS.length - 1;
  world.toast = isLast ? 'THE CITY IS YOURS' : `${mission.title.toUpperCase()} — DONE`;
  world.toastTimer = 4;
  sound.missionChime();
  if (isLast) {
    state = 'ending';
    return;
  }
  setTimeout(() => {
    if (state !== 'play') return;
    world.missionManager.index++;
    world.missionManager.start(world.missionManager.index);
    state = 'brief';
  }, isLast ? 0 : 5200);
};

let state = 'title';
let pauseIndex = 0;
let clock = 0;
let camera = { x: 0, y: 0, w: WIDTH, h: HEIGHT };
let shotConfig = null;
let endKind = 'wasted';
let endTimer = 0;
let camZoom = 1;

// --- boot -------------------------------------------------------------------

if (shot) {
  state = 'play';
  shotConfig = applyShot(world, shot);
  if (shotConfig) {
    camera.x = shotConfig.focus.x - WIDTH / 2;
    camera.y = shotConfig.focus.y - HEIGHT / 2;
    camZoom = shotConfig.zoom ?? 1;
  }
  document.title = 'Palm City — ' + (Number(shot) || 1);
} else {
  document.title = 'Palm City';
}

function centerCameraOn(x, y) {
  camera.x = clamp(x - WIDTH / 2, 0, city.width - WIDTH);
  camera.y = clamp(y - HEIGHT / 2, 0, city.height - HEIGHT);
}
centerCameraOn(world.player.x, world.player.y);
world.traffic.target = 18;

// --- state transitions ------------------------------------------------------

function startGame(load = false) {
  sound.resume();
  const saved = load ? loadGame() : null;
  if (saved) {
    applySave(world, saved);
    state = 'play';
    world.toast = 'SAVED NIGHT LOADED';
    world.toastTimer = 3;
  } else {
    state = 'brief';
    world.missionManager.start(world.missionManager.index);
  }
  world.player.alive = true;
  centerCameraOn(world.player.x, world.player.y);
}

function busted() {
  const p = world.player;
  if (state !== 'play') return;
  const fine = Math.min(p.money, 250);
  p.money -= fine;
  world.stats.timesBusted++;
  endKind = 'busted';
  endTimer = 0;
  state = 'busted';
  world.police.reset();
  sound.engineOff();
  sound.updateSiren(false, 0);
  // The player is dropped back at the cab stand with the stars cleared.
  const s = findSpawn(city);
  p.inCar = null;
  p.x = s.x;
  p.y = s.y;
  p.health = 70;
  p.armor = 0;
  p.stars = 0;
  p.heat = 0;
  p.alive = true;
  world.missionManager.enemies = [];
  world.thugs = world.missionManager.enemies;
}

function wasted() {
  if (state !== 'play') return;
  const p = world.player;
  p.money = Math.max(0, p.money - 100);
  world.stats.timesWasted++;
  endKind = 'wasted';
  endTimer = 0;
  state = 'wasted';
  world.police.reset();
  sound.engineOff();
  sound.updateSiren(false, 0);
  p.inCar = null;
  p.x = spawn.x;
  p.y = spawn.y;
  p.health = 100;
  p.armor = 0;
  p.stars = 0;
  p.heat = 0;
  p.alive = true;
  world.missionManager.enemies = [];
  world.thugs = world.missionManager.enemies;
}

function togglePause(on) {
  if (on && state === 'play') {
    state = 'pause';
    pauseIndex = 0;
    sound.engineOff();
  } else if (!on && state === 'pause') {
    state = 'play';
  }
}

// --- per-frame update -------------------------------------------------------

function update(dt) {
  clock += dt;

  // Menu / overlay states handle their own input and skip the simulation.
  if (state === 'title') {
    if (input.wasPressed('confirm') || input.wasPressed('shoot')) startGame(false);
    else if (input.wasPressed('restart') || (input.map && hasSave())) startGame(true);
    input.endFrame();
    return;
  }
  if (state === 'ending') {
    if (input.wasPressed('confirm') || input.wasPressed('shoot')) {
      state = 'title';
      world.missionManager.state = 'idle';
    }
    input.endFrame();
    return;
  }
  if (state === 'busted' || state === 'wasted') {
    endTimer += dt;
    if (endTimer > 0.9 && (input.wasPressed('confirm') || input.wasPressed('shoot'))) {
      state = 'play';
      if (world.missionManager.state === 'active') {
        world.missionManager.state = 'brief';
        world.missionManager.start(world.missionManager.index);
      }
      centerCameraOn(world.player.x, world.player.y);
    }
    input.endFrame();
    return;
  }
  if (state === 'brief') {
    if (input.wasPressed('confirm') || input.wasPressed('shoot')) {
      sound.resume();
      world.missionManager.begin();
      state = 'play';
      world.hint = 'Follow the marker on the map';
      world.hintTimer = 4;
    }
    input.endFrame();
    return;
  }
  if (state === 'pause') {
    if (input.wasPressed('pause')) togglePause(false);
    else if (input.wasPressed('up')) pauseIndex = (pauseIndex + 3) % 3;
    else if (input.wasPressed('down')) pauseIndex = (pauseIndex + 1) % 3;
    else if (input.wasPressed('confirm')) {
      if (pauseIndex === 0) togglePause(false);
      else if (pauseIndex === 1) {
        if (saveGame(world)) {
          world.toast = 'SAVED';
          world.toastTimer = 2;
        }
        togglePause(false);
      } else {
        state = 'title';
        world.missionManager.state = 'idle';
        sound.engineOff();
      }
    }
    input.endFrame();
    return;
  }

  // --- state === 'play' ---
  if (input.wasPressed('pause')) {
    togglePause(true);
    input.endFrame();
    return;
  }
  if (input.wasPressed('mute')) {
    sound.resume();
    sound.setMuted(!sound.muted);
    world.toast = sound.muted ? 'SOUND OFF' : 'SOUND ON';
    world.toastTimer = 1.6;
  }
  if (input.wasPressed('restart') && !shot) {
    if (saveGame(world)) {
      world.toast = 'SAVED';
      world.toastTimer = 1.8;
    }
  }

  const p = world.player;

  if (!p.inCar) {
    p.updateOnFoot(dt, city, input, aimAngle());
  } else {
    updateDriving(dt);
  }

  // Enter / exit a car.
  if (input.wasPressed('use') && p.enterCooldown <= 0) {
    if (p.inCar) {
      if (exitCar(p, city, walkable)) sound.engineOff();
    } else {
      const car = nearestCar(p, world.cars);
      if (car) {
        enterCar(p, car);
        car.traffic = null;
        sound.resume();
        sound.startEngine();
        world.toast = 'HOT WIRE';
        world.toastTimer = 1.2;
      }
    }
  }

  // Shoot.
  if (input.mouseDown || input.wasPressed('shoot')) {
    world.combat.playerShoot(world, effects, sound);
  }

  // Horn.
  if (input.wasPressed('horn') && p.inCar) sound.horn();

  // Peds + traffic.
  for (const ped of world.peds) ped.update(dt, city, world);
  world.traffic.update(dt);
  world.cars.push(...world.traffic.cars.splice(0));
  // Keep traffic cars in the same pool as parked cars, so stealing one is the same act.
  world.traffic.cars = world.cars.filter((c) => c.driver === 'traffic');
  harvestTraffic();
  resolveCarCollisions(world.cars, effects);

  // Police.
  world.thugs = world.missionManager.enemies;
  world.police.update(dt, world, effects, sound);
  for (const cop of world.police.cars) {
    if (cop.siren) sound.updateSiren(true, clock * 4);
  }
  if (world.police.cars.length === 0) sound.updateSiren(false, 0);

  // Combat, missions, effects.
  world.combat.update(dt);
  world.combat.updatePickups(dt, world, effects, sound);
  world.missionManager.update(dt, world, effects, sound);
  effects.update(dt);

  // Audio beds.
  if (p.inCar) sound.engineSpeed(p.inCar.speed, input.up ? 1 : 0);
  else sound.engineOff();
  sound.updateMusic(dt, p.stars / 5);

  // Camera: smooth follow with a look-ahead in the direction of travel.
  updateCamera(dt);

  // Timers.
  if (world.hintTimer > 0) {
    world.hintTimer -= dt;
    if (world.hintTimer <= 0) world.hint = '';
  }
  if (world.toastTimer > 0) world.toastTimer -= dt;
  if (!p.alive && state === 'play') wasted();

  input.endFrame();
}

function updateDriving(dt) {
  const p = world.player;
  const car = p.inCar;
  const throttle = (input.up ? 1 : 0) - (input.down ? 1 : 0);
  const steer = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  driveCar(car, { throttle, steer, handbrake: input.handbrake }, dt, city);
  p.x = car.x;
  p.y = car.y;
  p.aim = car.angle;
  if (Math.abs(car.speed) > 520 && Math.random() < 0.3) {
    effects.smoke(car.x - Math.cos(car.angle) * 36, car.y - Math.sin(car.angle) * 36, car.angle + Math.PI, 0.7);
  }
  if (input.handbrake && Math.abs(car.speed) > 120 && Math.random() < 0.6) {
    effects.smoke(car.x - Math.cos(car.angle) * 34, car.y - Math.sin(car.angle) * 34, car.angle + Math.PI / 2, 0.9);
    effects.smoke(car.x - Math.cos(car.angle) * 34, car.y - Math.sin(car.angle) * 34, car.angle - Math.PI / 2, 0.9);
  }
  if (car.crash) {
    sound.crash(car.crash);
    effects.sparks(car.x, car.y, car.angle, 4);
  }
  // Driving badly near people scares them.
  if (Math.abs(car.speed) > 300) scarePeds(world.peds, car.x, car.y, 180);
}

// Traffic cars that were stolen must stop being traffic, and the pool must stay in sync.
function harvestTraffic() {
  for (const car of world.cars) {
    if (car.driver === 'traffic' && !world.traffic.cars.includes(car)) world.traffic.cars.push(car);
  }
}

function aimAngle() {
  const p = world.player;
  const wx = camera.x + (input.mouseX / WIDTH) * camera.w / camZoom;
  const wy = camera.y + (input.mouseY / HEIGHT) * camera.h / camZoom;
  return Math.atan2(wy - p.y, wx - p.x);
}

function updateCamera(dt) {
  const p = world.player;
  const target = p.inCar
    ? { x: p.inCar.x + Math.cos(p.inCar.angle) * Math.min(150, Math.abs(p.inCar.speed) * 0.28), y: p.inCar.y + Math.sin(p.inCar.angle) * Math.min(150, Math.abs(p.inCar.speed) * 0.28) }
    : { x: p.x + Math.cos(p.aim) * 26, y: p.y + Math.sin(p.aim) * 26 };
  const zoomTarget = p.inCar ? 1.0 : 1.42;
  camZoom += (zoomTarget - camZoom) * Math.min(1, dt * 2.2);
  const viewW = WIDTH / camZoom;
  const viewH = HEIGHT / camZoom;
  const desiredX = clamp(target.x - viewW / 2, 0, city.width - viewW);
  const desiredY = clamp(target.y - viewH / 2, 0, city.height - viewH);
  const k = Math.min(1, dt * 5.2);
  camera.x += (desiredX - camera.x) * k;
  camera.y += (desiredY - camera.y) * k;
  camera.w = viewW;
  camera.h = viewH;
}

// --- draw -------------------------------------------------------------------

function draw() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (state === 'title') {
    drawTitle(ctx, WIDTH, HEIGHT, clock, hasSave());
    return;
  }
  if (state === 'brief') {
    // Draw the world dimmed behind the card.
    drawWorldFrame();
    drawBriefing(ctx, WIDTH, HEIGHT, world.missionManager.mission, clock);
    return;
  }

  drawWorldFrame();

  if (state === 'pause') {
    drawPauseMenu(ctx, WIDTH, HEIGHT, clock, pauseIndex, hasSave());
    return;
  }
  if (state === 'busted' || state === 'wasted') {
    drawEndScreen(ctx, WIDTH, HEIGHT, endKind, {
      missions: world.stats.missions,
      money: world.player.money,
      timesBusted: world.stats.timesBusted,
    }, clock);
    return;
  }
  if (state === 'ending') {
    drawEnding(ctx, clock);
    return;
  }

  if (world.toastTimer > 0) drawSaveToast(ctx, WIDTH, HEIGHT, world.toast, world.toastTimer);
}

function drawWorldFrame() {
  const p = world.player;
  // Camera shake from collisions and gunfire.
  const shakeX = (Math.random() - 0.5) * effects.shake * 9;
  const shakeY = (Math.random() - 0.5) * effects.shake * 9;
  const cam = { x: camera.x + shakeX, y: camera.y + shakeY, w: camera.w, h: camera.h };

  ctx.save();
  ctx.translate(WIDTH / 2, HEIGHT / 2);
  ctx.scale(camZoom, camZoom);
  ctx.translate(-WIDTH / 2, -HEIGHT / 2);

  drawScene(ctx, {
    city,
    camera: cam,
    w: WIDTH,
    h: HEIGHT,
    cameraH: camera.h,
    time: clock,
    actors: {
      player: p.inCar ? { ...p, inCar: p.inCar, x: p.inCar.x, y: p.inCar.y } : p,
      peds: world.peds,
      cars: world.cars.filter((c) => c.driver !== 'player'),
      cops: world.police.cars,
      bullets: world.combat.bullets,
    },
  });

  // Ground layer for gameplay: markers and pickups, drawn in world space over the city.
  for (const m of world.missionManager.markers) {
    if (m.kind === 'none' || m.taken) continue;
    if (m.x < cam.x - 120 || m.y < cam.y - 120 || m.x > cam.x + cam.w + 120 || m.y > cam.y + cam.h + 120) continue;
    drawGroundMarker(ctx, m.x, m.y, m.r, m.kind === 'chase' ? COLORS.red : COLORS.teal, clock, m.label);
  }
  world.combat.draw(ctx, cam, clock);
  effects.draw(ctx, cam);
  ctx.restore();

  if (params.get('debug')) {
    ctx.fillStyle = '#00ff88';
    ctx.font = '700 14px monospace';
    ctx.fillText(`p ${p.x.toFixed(0)},${p.y.toFixed(0)} car=${!!p.inCar} cam=${camera.x.toFixed(0)},${camera.y.toFixed(0)} z=${camZoom.toFixed(2)}`, 20, HEIGHT - 60);
    ctx.strokeStyle = '#00ff88';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(WIDTH / 2, HEIGHT / 2, 30, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Screen-space HUD.
  drawHud(ctx, { w: WIDTH, h: HEIGHT, world, time: clock });

  if (effects.flash > 0) {
    ctx.fillStyle = `rgba(255,240,220,${effects.flash * 0.5})`;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
  }
}

function drawEnding(ctx, time) {
  drawWorldFrame();
  ctx.fillStyle = 'rgba(8,6,14,0.78)';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.textAlign = 'center';
  ctx.font = '900 62px ui-sans-serif, system-ui, sans-serif';
  const g = ctx.createLinearGradient(WIDTH / 2 - 300, 240, WIDTH / 2 + 300, 380);
  g.addColorStop(0, '#ffd9a3');
  g.addColorStop(0.5, '#ff5f9e');
  g.addColorStop(1, '#7a5cff');
  ctx.fillStyle = g;
  ctx.shadowColor = 'rgba(255,95,158,0.7)';
  ctx.shadowBlur = 28;
  ctx.fillText('THE BUY-IN IS IN', WIDTH / 2, 300);
  ctx.shadowBlur = 0;
  ctx.font = '400 16px ui-sans-serif, system-ui, sans-serif';
  ctx.fillStyle = 'rgba(242,236,245,0.8)';
  ctx.fillText('Seven jobs. One city. The Coral Room is still standing, and so are you.', WIDTH / 2, 344);
  ctx.fillText(`Cash on hand: $${world.player.money.toLocaleString('en-US')}`, WIDTH / 2, 376);
  const blink = 0.55 + Math.sin(time * 3) * 0.35;
  ctx.font = '800 14px ui-sans-serif, system-ui, sans-serif';
  ctx.fillStyle = `rgba(255,255,255,${blink})`;
  ctx.fillText('PRESS ENTER — KEEP DRIVING', WIDTH / 2, 440);
}

// --- loop -------------------------------------------------------------------

let last = performance.now();
const maxFrames = Number(params.get('frames') ?? 0);
let framesDrawn = 0;
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  update(dt);
  draw();
  framesDrawn++;
  // ?frames=N stops the loop after N frames, so a headless capture can take its
  // screenshot without racing a continuously animating page.
  if (maxFrames && framesDrawn >= maxFrames) {
    window.__palmcityReady = true;
    return;
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Expose a tiny handle for headless screenshot runs and for anyone who wants to peek.
window.__palmcity = {
  world,
  get state() {
    return state;
  },
  get camera() {
    return camera;
  },
  shot: shot ? Number(shot) : null,
};
