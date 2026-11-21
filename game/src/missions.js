// missions.js — the story chain: seven jobs for Rio Calloway, from a courier run to the
// Buy-In at the marina. Each mission is a list of steps (drive somewhere, collect, chase,
// wipe out a crew, shake the cops); the manager walks the steps, spawns the markers and
// the thugs, and hands the HUD its objective line and the UI its dialogue.

import { makeCar } from './entities.js';
import { ROAD_X, ROAD_Y, WORLD } from './config.js';
import { angleTo, clamp, randomRange } from './random.js';
import { safePoint } from './city.js';

const CORAL_ROOM = { x: ROAD_X[1] + 360, y: ROAD_Y[1] - 250 };
const MARINA = { x: 3260, y: 2160 };
const DOCKS = { x: 760, y: 2180 };
const LOT = { x: ROAD_X[3] + 140, y: ROAD_Y[1] + 90 };

export const CAST = {
  rio: 'Rio Calloway',
  dessa: 'Dessa Marrow',
  pops: 'Pops Okonjo',
  bram: 'Bram Tulley',
};

export const MISSIONS = [
  {
    id: 'clock-in',
    title: 'Clock In',
    titleCard: 'JOB ONE',
    brief: 'Dessa Marrow runs the Coral Room and you owe her a favour. Take the package she left at the cab stand and get it to the club before it gets warm.',
    reward: 120,
    steps: [
      { type: 'goto', x: ROAD_X[0] + 60, y: ROAD_Y[1] - 40, title: 'Cab stand', text: 'Pick up the package at the cab stand.' },
      { type: 'goto', x: CORAL_ROOM.x, y: CORAL_ROOM.y, title: 'Coral Room', text: 'Deliver the package to the Coral Room.', radius: 60 },
    ],
    dialogue: [
      { who: 'dessa', text: 'You are late, Calloway. That is twice this week.' },
      { who: 'rio', text: 'Traffic on Kestrel. Somebody stacked a bus sideways.' },
      { who: 'dessa', text: 'I do not pay you to narrate. Package. Now.' },
      { who: 'rio', text: 'Charming as ever.' },
    ],
  },
  {
    id: 'wet-paint',
    title: 'Wet Paint',
    titleCard: 'JOB TWO',
    brief: 'Three people owe Dessa money and none of them are answering the phone. Go collect. Bring cash, not excuses.',
    reward: 220,
    steps: [
      { type: 'collect', count: 3, spread: [[ROAD_X[2] + 220, ROAD_Y[1] - 120], [ROAD_X[3] - 200, ROAD_Y[2] + 150], [ROAD_X[1] - 120, ROAD_Y[0] + 160]], title: 'Debts', text: 'Collect three debts around Palm City.' },
      { type: 'goto', x: CORAL_ROOM.x, y: CORAL_ROOM.y, title: 'Coral Room', text: 'Bring the money back to the Coral Room.', radius: 60 },
    ],
    dialogue: [
      { who: 'dessa', text: 'Three envelopes. People forget envelopes.' },
      { who: 'rio', text: 'And when they forget?' },
      { who: 'dessa', text: 'You remind them. Loudly. But tastefully.' },
    ],
  },
  {
    id: 'long-way',
    title: 'The Long Way',
    titleCard: 'JOB THREE',
    brief: "Bram Tulley's courier is carrying the ledger that says exactly how much Dessa owes him. Catch the car and take it. Do not let it reach the bridge.",
    reward: 320,
    steps: [
      { type: 'chase', title: 'Courier', text: "Chase down Bram's courier and stop the car.", start: [ROAD_X[2] + 60, ROAD_Y[1] + 40] },
      { type: 'goto', x: CORAL_ROOM.x, y: CORAL_ROOM.y, title: 'Coral Room', text: 'Take the ledger back to the Coral Room.', radius: 60 },
    ],
    dialogue: [
      { who: 'pops', text: 'That courier drives like the car is rented and the insurance is somebody else\'s.' },
      { who: 'rio', text: 'So do I.' },
      { who: 'pops', text: 'Yeah. That is what worries me.' },
    ],
  },
  {
    id: 'ledger',
    title: 'Coral Room Ledger',
    titleCard: 'JOB FOUR',
    brief: 'The ledger names a parking-lot lockup on Kestrel with the club\'s real books inside. Get in, get the case, and lose the cops on the way out.',
    reward: 450,
    steps: [
      { type: 'goto', x: LOT.x, y: LOT.y, title: 'Lockup', text: 'Get to the lockup in the Kestrel lot.' },
      { type: 'collect', count: 1, spread: [[LOT.x + 110, LOT.y + 60]], title: 'Ledger', text: 'Grab the ledger case.', wanted: 2 },
      { type: 'escape', title: 'Heat', text: 'Lose the cops. Get out of sight.' },
      { type: 'goto', x: CORAL_ROOM.x, y: CORAL_ROOM.y, title: 'Coral Room', text: 'Deliver the ledger to Dessa.', radius: 60 },
    ],
    dialogue: [
      { who: 'dessa', text: 'Tulley keeps two sets of books. One for the tax man, one for me.' },
      { who: 'rio', text: 'And the one for you is in a parking lot?' },
      { who: 'dessa', text: 'The one for me is in a parking lot because the one for the tax man is in a bank. Banks have cameras.' },
    ],
  },
  {
    id: 'static',
    title: 'Static',
    titleCard: 'JOB FIVE',
    brief: "Tulley's crew is leaning on the docks. Pops says four of them, maybe five. Go make the docks quiet again.",
    reward: 600,
    steps: [
      { type: 'goto', x: DOCKS.x, y: DOCKS.y, title: 'Docks', text: 'Drive to the Dockside warehouses.' },
      { type: 'kill', count: 4, title: 'Tulley crew', text: 'Clear out Tulley\'s crew.' },
      { type: 'escape', title: 'Heat', text: 'Lose the cops.' },
    ],
    dialogue: [
      { who: 'pops', text: 'Four of them. Maybe five. They have a van and no imagination.' },
      { who: 'rio', text: 'And me?' },
      { who: 'pops', text: 'You have a pistol and a bad attitude. Try to keep the warehouses standing.' },
    ],
  },
  {
    id: 'buy-in',
    title: 'The Buy-In',
    titleCard: 'THE BUY-IN',
    brief: 'The marina deal is tonight. Bram will be there with cash, product and at least one very large man. Take the briefcase and get it to Dessa — the whole city will be looking for you.',
    reward: 1200,
    steps: [
      { type: 'goto', x: MARINA.x, y: MARINA.y, title: 'Marina', text: 'Get to the marina before the deal closes.' },
      { type: 'kill', count: 3, title: 'Bram\'s men', text: 'Take out Bram\'s guards.' },
      { type: 'collect', count: 1, spread: [[MARINA.x + 40, MARINA.y - 60]], title: 'Briefcase', text: 'Take the briefcase.', wanted: 3 },
      { type: 'escape', title: 'Heat', text: 'Shake the cops with the briefcase.' },
      { type: 'goto', x: CORAL_ROOM.x, y: CORAL_ROOM.y, title: 'Coral Room', text: 'Deliver the briefcase to Dessa.', radius: 60 },
    ],
    dialogue: [
      { who: 'dessa', text: 'Tonight you stop being a courier and start being a problem for other people.' },
      { who: 'rio', text: 'That is the nicest thing you have ever said to me.' },
      { who: 'dessa', text: 'Do not get used to it. Bring me the case.' },
    ],
  },
  {
    id: 'sunrise',
    title: 'Sunrise',
    titleCard: 'EPILOGUE',
    brief: 'The Coral Room is yours to look after now, and Palm City is still open. Drive, race, collect, cause trouble. The night is not over.',
    reward: 0,
    steps: [],
    dialogue: [
      { who: 'dessa', text: 'The club is yours to mind. Do not burn it down.' },
      { who: 'rio', text: 'No promises.' },
      { who: 'pops', text: 'Come by the garage when you wreck that car. You will wreck that car.' },
    ],
  },
];

// --- thugs ------------------------------------------------------------------

class Thug {
  constructor(x, y, rng) {
    this.x = x;
    this.y = y;
    this.r = 11;
    this.hp = 60;
    this.heading = rng.float(0, Math.PI * 2);
    this.fireTimer = rng.float(0.6, 1.6);
    this.state = 'idle';
    this.moveTarget = { x, y };
    this.repathTimer = 0;
    this.skin = '#a2714f';
    this.shirt = '#38323f';
    this.down = false;
    this.bob = rng.float(0, 6);
  }
}

export class MissionManager {
  constructor(city, rng) {
    this.city = city;
    this.rng = rng;
    this.index = 0;
    this.step = 0;
    this.state = 'idle'; // idle | brief | active | complete
    this.markers = [];
    this.enemies = [];
    this.chaseCar = null;
    this.collected = 0;
    this.dialogue = [];
    this.dialogueIndex = 0;
    this.dialogueTimer = 0;
    this.objective = '';
    this.escaped = false;
    this.missionBanner = 0;
    this.flashStep = 0;
    // Snap every authored marker onto open ground for this city's block layout, so a
    // step never sends the player into the side of a tower.
    for (const mission of MISSIONS) {
      for (const step of mission.steps ?? []) {
        if (step.type === 'goto') Object.assign(step, safePoint(city, step.x, step.y));
        if (step.type === 'collect') {
          step.spread = step.spread.map(([x, y]) => {
            const p = safePoint(city, x, y);
            return [p.x, p.y];
          });
        }
        if (step.type === 'chase') {
          const p = safePoint(city, step.start[0], step.start[1]);
          step.start = [p.x, p.y];
        }
      }
    }
  }

  get mission() {
    return MISSIONS[this.index];
  }

  get finished() {
    return this.index >= MISSIONS.length - 1 && this.state === 'complete';
  }

  start(index) {
    this.index = clamp(index, 0, MISSIONS.length - 1);
    this.step = 0;
    this.state = 'brief';
    this.markers = [];
    this.enemies = [];
    this.chaseCar = null;
    this.collected = 0;
    this.dialogue = [...(this.mission.dialogue ?? [])];
    this.dialogueIndex = 0;
    this.dialogueTimer = 0;
    this.missionBanner = 3.2;
    this.flashStep = 0;
    this.objective = '';
  }

  // Called when the player closes the briefing card.
  begin() {
    if (this.state !== 'brief') return;
    this.state = 'active';
    this.setStep(0);
  }

  setStep(i) {
    this.step = i;
    this.markers = [];
    this.enemies = [];
    this.chaseCar = null;
    this.escaped = false;
    const step = this.mission?.steps?.[i];
    if (!step) {
      this.complete();
      return;
    }
    this.objective = step.text ?? '';
    this.flashStep = 2.4;
    if (step.type === 'goto') {
      this.markers.push({ x: step.x, y: step.y, r: step.radius ?? 54, kind: 'goto', label: step.title });
    } else if (step.type === 'collect') {
      for (let k = 0; k < step.count; k++) {
        const [x, y] = step.spread[k % step.spread.length];
        this.markers.push({ x, y, r: 38, kind: 'collect', label: step.title, taken: false });
      }
      this.collected = 0;
      if (step.wanted) this.pendingWanted = step.wanted;
    } else if (step.type === 'chase') {
      const [x, y] = step.start;
      const car = makeCar({ x, y, angle: Math.PI / 2, color: '#7a1f2e', kind: 'sport', driver: 'rival', w: 44, h: 88 });
      car.health = 140;
      car.rival = true;
      car.fleeTimer = 0;
      car.turnTimer = 0;
      this.chaseCar = car;
      this.markers.push({ x, y, r: 46, kind: 'chase', label: step.title });
    } else if (step.type === 'kill') {
      const base = this.markersBaseForKill();
      for (let k = 0; k < step.count; k++) {
        const a = (k / step.count) * Math.PI * 2;
        const raw = safePoint(this.city, base.x + Math.cos(a) * randomRange(90, 170), base.y + Math.sin(a) * randomRange(70, 150));
        this.enemies.push(new Thug(raw.x, raw.y, this.rng));
      }
      this.killCount = 0;
    } else if (step.type === 'escape') {
      this.markers.push({ x: this.mission.escapePoint?.x ?? 0, y: 0, r: 0, kind: 'none' });
      this.markers = [];
    }
  }

  markersBaseForKill() {
    if (this.mission.id === 'static') return safePoint(this.city, DOCKS.x, DOCKS.y);
    if (this.mission.id === 'buy-in') return safePoint(this.city, MARINA.x, MARINA.y);
    return { x: this.mission.steps[0].x ?? 0, y: this.mission.steps[0].y ?? 0 };
  }

  complete() {
    const m = this.mission;
    this.state = 'complete';
    this.objective = '';
    this.markers = [];
    this.enemies = [];
    this.chaseCar = null;
    this.onComplete?.(m);
  }

  next() {
    if (this.index < MISSIONS.length - 1) {
      this.index++;
      this.start(this.index);
    } else {
      this.state = 'idle';
    }
  }

  update(dt, world, effects, audio) {
    if (this.missionBanner > 0) this.missionBanner -= dt;
    if (this.flashStep > 0) this.flashStep -= dt;

    // Advance the dialogue queue on a timer.
    if (this.dialogueIndex < this.dialogue.length) {
      this.dialogueTimer += dt;
      if (this.dialogueTimer > 3.4) {
        this.dialogueTimer = 0;
        this.dialogueIndex++;
      }
    }

    if (this.state !== 'active') return;
    const p = world.player;
    const px = p.inCar ? p.inCar.x : p.x;
    const py = p.inCar ? p.inCar.y : p.y;
    const step = this.mission.steps[this.step];
    if (!step) return;

    if (step.type === 'goto') {
      const m = this.markers[0];
      if (m && Math.hypot(m.x - px, m.y - py) < m.r + 14) {
        effects.text(px, py - 40, 'OBJECTIVE COMPLETE', '#8ef2a0', 14);
        audio?.missionChime?.();
        this.nextStepOrComplete();
      }
    } else if (step.type === 'collect') {
      for (const m of this.markers) {
        if (m.taken) continue;
        if (Math.hypot(m.x - px, m.y - py) > m.r + 14) continue;
        m.taken = true;
        this.collected++;
        effects.text(m.x, m.y - 30, `+1 ${step.title.toUpperCase()}`, '#ffd76a', 13);
        audio?.pickup?.('cash');
        if (this.pendingWanted) {
          world.police.addHeat(p, 40 * this.pendingWanted);
          this.pendingWanted = 0;
          effects.whiteFlash(0.2);
        }
        if (this.collected >= step.count) {
          this.nextStepOrComplete();
          return;
        }
      }
    } else if (step.type === 'chase') {
      const car = this.chaseCar;
      if (!car) {
        this.nextStepOrComplete();
        return;
      }
      // The courier bolts: drive away from the player, preferring clear streets.
      this.driveRival(car, dt, world);
      this.markers[0].x = car.x;
      this.markers[0].y = car.y;
      const destroyed = car.health <= 0;
      const stopped = Math.abs(car.speed) < 24 && Math.hypot(car.x - px, car.y - py) < 110;
      if (destroyed || stopped) {
        effects.burst(car.x, car.y, 26, { speed: 240, life: 0.6, size: 3, colors: ['#ffb14a', '#ffe08a', '#c9c2d8'] });
        effects.addShake(0.6, 0.4);
        car.driver = null;
        effects.text(car.x, car.y - 40, 'COURIER STOPPED', '#8ef2a0', 14);
        audio?.explosion?.();
        this.chaseCar = null;
        this.nextStepOrComplete();
      }
    } else if (step.type === 'kill') {
      this.updateThugs(dt, world, effects, audio);
      const alive = this.enemies.filter((e) => !e.down).length;
      this.killCount = step.count - alive;
      this.objective = `Clear out Tulley's crew. ${this.killCount}/${step.count}`;
      if (alive === 0) {
        this.nextStepOrComplete();
      }
    } else if (step.type === 'escape') {
      if (p.stars > 0) {
        this.objective = 'Lose the cops. Break their line of sight.';
        return;
      }
      if (!this.escaped) {
        this.escaped = true;
        effects.text(px, py - 40, 'YOU LOST THEM', '#8ef2a0', 15);
        audio?.missionChime?.();
        this.nextStepOrComplete();
        return;
      }
    }
  }

  nextStepOrComplete() {
    if (this.step + 1 < (this.mission.steps?.length ?? 0)) this.setStep(this.step + 1);
    else this.complete();
  }

  driveRival(car, dt, world) {
    const p = world.player;
    const px = p.inCar ? p.inCar.x : p.x;
    const py = p.inCar ? p.inCar.y : p.y;
    // Flee: aim away from the player while steering roughly along the road grid.
    const away = angleTo(px, py, car.x, car.y);
    car.turnTimer -= dt;
    if (car.turnTimer <= 0) {
      car.turnTimer = randomRange(1.2, 2.4);
      car.escapeHeading = away + randomRange(-0.9, 0.9);
    }
    const desired = car.escapeHeading ?? away;
    const err = Math.atan2(Math.sin(desired - car.angle), Math.cos(desired - car.angle));
    const { driveCar } = world.vehicleApi;
    driveCar(car, { throttle: 0.95, steer: clamp(err * 2.2, -1, 1), handbrake: Math.abs(err) > 1.5 }, dt, this.city);
    if (car.x < 200 || car.y < 200 || car.x > WORLD.sandEndX - 200 || car.y > WORLD.sandEndY - 200) {
      car.escapeHeading = angleTo(car.x, car.y, WORLD.width / 2, WORLD.height / 2);
    }
  }

  updateThugs(dt, world, effects, audio) {
    const p = world.player;
    const px = p.inCar ? p.inCar.x : p.x;
    const py = p.inCar ? p.inCar.y : p.y;
    for (const thug of this.enemies) {
      if (thug.down) continue;
      const d = Math.hypot(px - thug.x, py - thug.y);
      thug.heading = Math.atan2(py - thug.y, px - thug.x);
      // Close in to a comfortable firing range, then hold it and shoot.
      if (d > 230) {
        thug.x += Math.cos(thug.heading) * 92 * dt;
        thug.y += Math.sin(thug.heading) * 92 * dt;
      } else if (d < 120) {
        thug.x -= Math.cos(thug.heading) * 48 * dt;
        thug.y -= Math.sin(thug.heading) * 48 * dt;
      }
      // Keep them on the map and out of buildings via a simple nudge back.
      thug.x = clamp(thug.x, 240, WORLD.sandEndX - 40);
      thug.y = clamp(thug.y, 240, WORLD.sandEndY - 40);
      thug.fireTimer -= dt;
      if (thug.fireTimer <= 0 && d < 430) {
        thug.fireTimer = randomRange(0.85, 1.7);
        world.combat.fireThug(world, thug, effects, audio);
      }
      // Player bullets were resolved by combat; hit reactions handled there.
      if (thug.hp <= 0) {
        thug.down = true;
        effects.burst(thug.x, thug.y, 12, { speed: 120, life: 0.5, size: 2.4, colors: ['#ff9fb2', '#c9c2d8'] });
      }
    }
    // Bullets that land on a thug are checked by the combat ray through world.thugs.
  }

  draw(ctx, camera, time) {
    this.drawMarkers(ctx, camera, time);
    this.drawEnemies(ctx, camera, time);
  }

  // Mission markers are drawn by main.js with the ground layer, so this half is often
  // called on its own.
  drawMarkers(ctx, camera, time) {
    for (const m of this.markers) {
      if (m.kind === 'none' || m.taken) continue;
      if (m.x < camera.x - 100 || m.y < camera.y - 100 || m.x > camera.x + camera.w + 100 || m.y > camera.y + camera.h + 100) continue;
      const color = m.kind === 'chase' ? '#ff4257' : m.kind === 'collect' ? '#ffd76a' : '#4fe3cd';
      drawMarker(ctx, m, color, time);
    }
  }

  // The crew spawned by a kill step. Each one is a small actor, so main.js asks for this
  // after the scene pass and before the effects.
  drawEnemies(ctx, camera, time) {
    for (const thug of this.enemies) {
      if (thug.x < camera.x - 60 || thug.y < camera.y - 60 || thug.x > camera.x + camera.w + 60 || thug.y > camera.y + camera.h + 60) continue;
      drawThug(ctx, thug, time);
    }
  }
}

function drawMarker(ctx, m, color, time) {
  const pulse = 0.55 + Math.sin(time * 3.4) * 0.18;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(m.x, m.y, 2, m.x, m.y, m.r * 1.9);
  g.addColorStop(0, hexA(color, 0.3 * pulse));
  g.addColorStop(0.65, hexA(color, 0.13 * pulse));
  g.addColorStop(1, hexA(color, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(m.x, m.y, m.r * 1.9, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = hexA(color, 0.85);
  ctx.lineWidth = 2.5;
  ctx.setLineDash([12, 9]);
  ctx.lineDashOffset = -time * 30;
  ctx.beginPath();
  ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  // Upward chevron so it reads as "come here" even at a glance.
  ctx.fillStyle = hexA(color, 0.9);
  const bob = Math.sin(time * 3) * 4;
  ctx.beginPath();
  ctx.moveTo(m.x, m.y - 20 + bob);
  ctx.lineTo(m.x - 9, m.y - 6 + bob);
  ctx.lineTo(m.x - 3, m.y - 6 + bob);
  ctx.lineTo(m.x - 3, m.y + 6 + bob);
  ctx.lineTo(m.x + 3, m.y + 6 + bob);
  ctx.lineTo(m.x + 3, m.y - 6 + bob);
  ctx.lineTo(m.x + 9, m.y - 6 + bob);
  ctx.closePath();
  ctx.fill();
}

function drawThug(ctx, thug, time) {
  ctx.save();
  ctx.translate(thug.x, thug.y);
  if (thug.down) {
    ctx.rotate(1.4);
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = '#3a3340';
    ctx.beginPath();
    ctx.ellipse(0, 0, 11, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }
  ctx.rotate(thug.heading + Math.PI / 2);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(1, 4, 10, 4.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#232029';
  ctx.fillRect(-4.6, 1, 3.2, 8);
  ctx.fillRect(1.4, 1, 3.2, 8);
  ctx.fillStyle = thug.shirt;
  ctx.beginPath();
  ctx.ellipse(0, -1, 6, 7.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#8f2f3d';
  ctx.fillRect(-6, -3.5, 12, 2.4);
  ctx.fillStyle = thug.skin;
  ctx.beginPath();
  ctx.arc(0, -8, 3.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1c1620';
  ctx.beginPath();
  ctx.arc(0, -9.2, 3.8, Math.PI, Math.PI * 2);
  ctx.fill();
  // gun arm
  ctx.fillStyle = '#2a2833';
  ctx.fillRect(4, -13, 3, 7);
  ctx.restore();
  // hp pip
  if (thug.hp < 60) {
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(thug.x - 12, thug.y - 24, 24, 3);
    ctx.fillStyle = '#ff5f7a';
    ctx.fillRect(thug.x - 12, thug.y - 24, 24 * (thug.hp / 60), 3);
  }
}

function hexA(color, a) {
  const n = parseInt(color.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
