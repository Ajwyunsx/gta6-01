// Palm City — the screens around the game: title, pause, mission briefing, busted,
// save/load slots, and the small toasts that tell you what the city just did to you.
(function (global) {
  'use strict';

  const PC = global.PC;

  const SAVE_KEY = 'palmcity.save.v1';

  /** One-line toast queue: cash, pickups, arrests, job completions. */
  function makeToasts() {
    return [];
  }

  function toast(toasts, text, colour) {
    toasts.push({ text, colour: colour || PC.PALETTE.hud, life: 3.4, max: 3.4 });
  }

  function tickToasts(toasts, dt) {
    for (let i = toasts.length - 1; i >= 0; i--) {
      toasts[i].life -= dt;
      if (toasts[i].life <= 0) toasts.splice(i, 1);
    }
  }

  function drawToasts(ctx, toasts, W) {
    ctx.textAlign = 'left';
    ctx.font = '600 14px "Inter", "Segoe UI", system-ui, sans-serif';
    let y = 110;
    for (const t of toasts) {
      const alpha = Math.min(1, t.life / 0.6);
      ctx.globalAlpha = alpha;
      const w = ctx.measureText(t.text).width + 26;
      ctx.fillStyle = 'rgba(10,12,18,0.62)';
      ctx.fillRect(24, y - 16, w, 26);
      ctx.fillStyle = t.colour;
      ctx.fillRect(24, y - 16, 3, 26);
      ctx.fillStyle = t.colour;
      ctx.fillText(t.text, 38, y + 2);
      ctx.globalAlpha = 1;
      y += 32;
    }
  }

  /** A soft full-screen scrim with a centred panel; every menu uses it. */
  function panel(ctx, W, H, alpha) {
    ctx.fillStyle = `rgba(8,10,16,${alpha ?? 0.62})`;
    ctx.fillRect(0, 0, W, H);
  }

  function centred(ctx, W, H, w, h) {
    const x = (W - w) / 2;
    const y = (H - h) / 2;
    ctx.fillStyle = 'rgba(18,20,28,0.94)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = 'rgba(247,239,224,0.16)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    return { x, y, w, h };
  }

  /**
   * The title screen: the city behind it, a sun-washed logo, the story hook, and the
   * controls. The player presses Enter to begin.
   */
  function drawTitle(ctx, W, H, state) {
    // Warm wash over the live city.
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, 'rgba(255,196,140,0.42)');
    g.addColorStop(0.45, 'rgba(20,18,30,0.52)');
    g.addColorStop(1, 'rgba(10,10,18,0.86)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    ctx.textAlign = 'center';

    // Logo.
    ctx.save();
    ctx.shadowColor = 'rgba(255,120,60,0.55)';
    ctx.shadowBlur = 34;
    ctx.font = '800 86px "Inter", "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = '#fff4e2';
    ctx.fillText('PALM CITY', W / 2, H * 0.34);
    ctx.restore();

    ctx.font = '600 15px "Inter", "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,240,220,0.72)';
    ctx.fillText('S U N S T A T E   ·   T H R E E   M I L E S   O F   C O A S T', W / 2, H * 0.34 + 34);

    ctx.font = '400 17px "Inter", "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,246,232,0.86)';
    ctx.fillText('Seven jobs. One coast. Nobody leaves clean.', W / 2, H * 0.34 + 78);

    // Start prompt, pulsing.
    const pulse = 0.62 + Math.sin(state.time * 3) * 0.28;
    ctx.globalAlpha = pulse;
    ctx.font = '700 20px "Inter", "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = '#ffd9a8';
    ctx.fillText('PRESS  ENTER  TO  START', W / 2, H * 0.62);
    ctx.globalAlpha = 1;

    // Controls, in two tidy columns.
    ctx.textAlign = 'left';
    ctx.font = '500 13px "Inter", "Segoe UI", system-ui, sans-serif';
    const rows = [
      ['W A S D', 'walk / drive'],
      ['SHIFT', 'sprint'],
      ['E', 'steal / leave a car'],
      ['SPACE', 'handbrake'],
      ['MOUSE', 'aim'],
      ['LEFT CLICK', 'fire'],
      ['TAB', 'jobs'],
      ['ESC', 'pause / save'],
    ];
    const colWidth = 210;
    const startX = W / 2 - colWidth;
    const startY = H * 0.70;
    rows.forEach((row, i) => {
      const x = startX + (i % 2) * colWidth;
      const y = startY + Math.floor(i / 2) * 24;
      ctx.fillStyle = 'rgba(255,231,196,0.95)';
      ctx.fillText(row[0], x, y);
      ctx.fillStyle = 'rgba(255,246,232,0.55)';
      ctx.fillText(row[1], x + 92, y);
    });
  }

  function drawPause(ctx, W, H, sel) {
    panel(ctx, W, H, 0.66);
    const box = centred(ctx, W, H, 420, 300);
    ctx.textAlign = 'center';
    ctx.font = '800 30px "Inter", "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = PC.PALETTE.hud;
    ctx.fillText('PAUSED', W / 2, box.y + 56);

    const items = ['Resume', 'Save game', 'Load game', 'Quit to title'];
    ctx.font = '600 17px "Inter", "Segoe UI", system-ui, sans-serif';
    items.forEach((item, i) => {
      const y = box.y + 118 + i * 40;
      if (i === sel) {
        ctx.fillStyle = 'rgba(255,209,102,0.16)';
        ctx.fillRect(box.x + 60, y - 24, box.w - 120, 34);
        ctx.fillStyle = PC.PALETTE.gold;
      } else {
        ctx.fillStyle = 'rgba(247,239,224,0.72)';
      }
      ctx.fillText(item, W / 2, y);
    });

    ctx.font = '500 12px "Inter", system-ui, sans-serif';
    ctx.fillStyle = 'rgba(247,239,224,0.40)';
    ctx.fillText('↑ ↓  choose    ENTER  confirm    ESC  resume', W / 2, box.y + box.h - 24);
  }

  /** The mission briefing card: contact, job title, the pitch, and the objective. */
  function drawBriefing(ctx, W, H, job) {
    panel(ctx, W, H, 0.70);
    const box = centred(ctx, W, H, 760, 380);

    ctx.textAlign = 'left';
    ctx.font = '600 12px "Inter", system-ui, sans-serif';
    ctx.fillStyle = PC.PALETTE.accent;
    ctx.fillText(`JOB ${(PC.Missions.JOBS.indexOf(job) + 1)} OF ${PC.Missions.JOBS.length}  ·  ${job.contact.toUpperCase()}`, box.x + 44, box.y + 52);

    ctx.font = '800 34px "Inter", "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = PC.PALETTE.hud;
    ctx.fillText(job.title, box.x + 44, box.y + 96);

    // Wrap the pitch.
    ctx.font = '400 15px "Inter", "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = 'rgba(247,239,224,0.80)';
    const words = job.briefing.split(' ');
    let line = '';
    let y = box.y + 132;
    for (const word of words) {
      const test = line ? line + ' ' + word : word;
      if (ctx.measureText(test).width > box.w - 88) {
        ctx.fillText(line, box.x + 44, y);
        y += 23;
        line = word;
      } else {
        line = test;
      }
    }
    if (line) ctx.fillText(line, box.x + 44, y);

    // Objective and reward.
    const oy = box.y + box.h - 92;
    ctx.fillStyle = 'rgba(255,209,102,0.10)';
    ctx.fillRect(box.x + 40, oy - 26, box.w - 80, 56);
    ctx.font = '600 14px "Inter", "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = PC.PALETTE.gold;
    ctx.fillText(job.objective, box.x + 54, oy);
    ctx.font = '700 15px "Inter", system-ui, sans-serif';
    ctx.fillStyle = '#9ce0a8';
    ctx.textAlign = 'right';
    ctx.fillText(`PAYS ${PC.money(job.reward)}`, box.x + box.w - 54, oy);

    ctx.textAlign = 'center';
    ctx.font = '500 12px "Inter", system-ui, sans-serif';
    ctx.fillStyle = 'rgba(247,239,224,0.42)';
    ctx.fillText('ENTER  accept the job        ESC  not now', W / 2, box.y + box.h - 14);
  }

  function drawBusted(ctx, W, H, fade) {
    ctx.fillStyle = `rgba(6,8,14,${fade})`;
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.font = '800 74px "Inter", "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = '#dfe6f5';
    ctx.fillText('BUSTED', W / 2, H / 2);
    ctx.font = '500 15px "Inter", system-ui, sans-serif';
    ctx.fillStyle = 'rgba(223,230,245,0.66)';
    ctx.fillText('They took the cash. Keep the story.', W / 2, H / 2 + 38);
  }

  function drawWasted(ctx, W, H, fade) {
    ctx.fillStyle = `rgba(28,6,8,${fade})`;
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.font = '800 74px "Inter", "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = '#f3d7d7';
    ctx.fillText('WASTED', W / 2, H / 2);
    ctx.font = '500 15px "Inter", system-ui, sans-serif';
    ctx.fillStyle = 'rgba(243,215,215,0.7)';
    ctx.fillText('The coast does not forgive. Try again.', W / 2, H / 2 + 38);
  }

  /** Save/load: one slot each, in localStorage, with a readable stamp. */
  function saveGame(state) {
    const { player, missions, city, wanted } = state;
    const data = {
      v: 1,
      savedAt: new Date().toISOString(),
      cash: player.cash,
      health: player.health,
      armour: player.armour,
      ammo: player.ammo,
      x: player.x,
      y: player.y,
      jobIndex: missions.index,
      completed: missions.story.completed.slice(),
      seed: city.seed,
      heat: wanted.heat,
    };
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
      return true;
    } catch {
      return false;
    }
  }

  function loadGame() {
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

  function hasSave() {
    try {
      return localStorage.getItem(SAVE_KEY) !== null;
    } catch {
      return false;
    }
  }

  PC.UI = {
    makeToasts,
    toast,
    tickToasts,
    drawToasts,
    drawTitle,
    drawPause,
    drawBriefing,
    drawBusted,
    drawWasted,
    panel,
    saveGame,
    loadGame,
    hasSave,
  };
})(window);
