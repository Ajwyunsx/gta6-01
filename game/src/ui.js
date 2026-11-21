/* Palm City — the screens around the game: title card, pause menu, save and load, and the bust
   and wasted cards. All drawn on the same canvas so the game has no DOM overlays to desync. The
   title is the city seen through sunglasses: a skyline strip, the wordmark, and one clear prompt. */
(function (PC) {
  'use strict';

  var C = PC.CONFIG, P = PC.PALETTE, U = PC.util;
  var R = PC.render;

  var SCREEN_TITLE = 'title', SCREEN_PLAY = 'play', SCREEN_PAUSED = 'paused', SCREEN_SLEEP = 'sleep';

  function drawTitle(ctx, state, t) {
    drawBackdrop(ctx, state, t, 0.55);
    // skyline silhouette
    drawSkyline(ctx, t);

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    // wordmark: PALM / CITY with a sun behind it
    ctx.save();
    ctx.translate(C.VW / 2 - 8, 250);
    var sunG = ctx.createRadialGradient(0, 0, 20, 0, 0, 220);
    sunG.addColorStop(0, 'rgba(255,214,130,0.45)');
    sunG.addColorStop(1, 'rgba(255,150,90,0)');
    ctx.fillStyle = sunG;
    ctx.beginPath(); ctx.arc(0, 0, 220, 0, 6.283); ctx.fill();
    ctx.fillStyle = '#f6efe1';
    ctx.font = 'bold 118px "Trebuchet MS", "Arial Black", Arial, sans-serif';
    ctx.fillText('PALM CITY', 0, 8);
    ctx.strokeStyle = 'rgba(34,28,26,0.55)';
    ctx.lineWidth = 3;
    ctx.strokeText('PALM CITY', 0, 8);
    // accent slash under the wordmark
    ctx.fillStyle = P.accent;
    ctx.fillRect(-250, 32, 500, 6);
    ctx.fillStyle = P.accent2;
    ctx.fillRect(-180, 42, 360, 3);
    ctx.restore();

    ctx.font = 'bold 17px "Trebuchet MS", Arial, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillText('Seven jobs, one sun-bleached city, and the police on your tail.', C.VW / 2, 352);

    // prompt with a slow blink
    var blink = 0.55 + Math.sin(t * 3) * 0.4;
    ctx.globalAlpha = blink;
    ctx.fillStyle = P.gold;
    ctx.font = 'bold 22px "Trebuchet MS", Arial, sans-serif';
    ctx.fillText('PRESS ENTER TO START', C.VW / 2, 428);
    ctx.globalAlpha = 1;

    // a save present? offer it under the prompt
    if (state && state.hasSave) {
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.font = 'bold 14px "Trebuchet MS", Arial, sans-serif';
      ctx.fillText('Press L to load your last save', C.VW / 2, 462);
    }

    // controls legend in two columns
    var lines = [
      ['WASD / Arrows', 'Move · drive'],
      ['Shift', 'Sprint'],
      ['E', 'Enter / leave car'],
      ['Mouse', 'Aim · left click fires'],
      ['R', 'Reload'],
      ['Space', 'Handbrake'],
      ['Esc', 'Pause · save'],
      ['M', 'Toggle music']
    ];
    ctx.textAlign = 'left';
    ctx.font = 'bold 12px "Trebuchet MS", Arial, sans-serif';
    for (var i = 0; i < lines.length; i++) {
      var col = i < 4 ? 0 : 1, row = i % 4;
      var lx = C.VW / 2 - 250 + col * 260, ly = 512 + row * 22;
      ctx.fillStyle = P.gold;
      ctx.fillText(lines[i][0], lx, ly);
      ctx.fillStyle = 'rgba(255,255,255,0.66)';
      ctx.fillText(lines[i][1], lx + 108, ly);
    }
    ctx.restore();

    // footer
    ctx.save();
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,255,255,0.42)';
    ctx.font = '11px "Trebuchet MS", Arial, sans-serif';
    ctx.fillText('An original open-world crime sandbox · made for make.fun', C.VW / 2, C.VH - 26);
    ctx.restore();
  }

  function drawBackdrop(ctx, state, t, alpha) {
    // the world is behind the title only while a game is loaded; otherwise a painted sky
    if (state && state.world) {
      PC.render.draw(state.renderer, state.world, t);
      ctx.fillStyle = 'rgba(24,16,10,' + alpha + ')';
      ctx.fillRect(0, 0, C.VW, C.VH);
      return;
    }
    var g = ctx.createLinearGradient(0, 0, 0, C.VH);
    g.addColorStop(0, '#f5c98a');
    g.addColorStop(0.4, '#e8a87c');
    g.addColorStop(0.7, '#b4786d');
    g.addColorStop(1, '#3c3b52');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, C.VW, C.VH);
    var sun = ctx.createRadialGradient(C.VW / 2, 300, 10, C.VW / 2, 300, 320);
    sun.addColorStop(0, 'rgba(255,240,200,0.9)');
    sun.addColorStop(1, 'rgba(255,200,120,0)');
    ctx.fillStyle = sun;
    ctx.beginPath(); ctx.arc(C.VW / 2, 300, 320, 0, 6.283); ctx.fill();
  }

  function drawSkyline(ctx, t) {
    ctx.save();
    ctx.fillStyle = 'rgba(46,38,52,0.55)';
    var seed = 7;
    function r() { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; }
    var x = -20;
    while (x < C.VW + 40) {
      var w = 30 + r() * 74, h = 40 + r() * 170;
      ctx.fillRect(x, C.VH - 130 - h, w, h + 130);
      // lit windows
      ctx.fillStyle = 'rgba(255,206,128,0.4)';
      for (var wy = C.VH - 120 - h; wy < C.VH - 140; wy += 16) {
        for (var wx = x + 6; wx < x + w - 6; wx += 12) {
          if (r() < 0.3) ctx.fillRect(wx, wy, 5, 7);
        }
      }
      ctx.fillStyle = 'rgba(46,38,52,0.55)';
      x += w + 8 + r() * 20;
    }
    ctx.fillStyle = 'rgba(40,32,46,0.75)';
    ctx.fillRect(0, C.VH - 132, C.VW, 132);
    ctx.restore();
  }

  function drawPause(ctx, world, t) {
    ctx.fillStyle = 'rgba(14,10,8,0.66)';
    ctx.fillRect(0, 0, C.VW, C.VH);
    R.card(ctx, C.VW / 2 - 220, 170, 440, 340, 0.9);
    ctx.save();
    ctx.textAlign = 'center';
    ctx.fillStyle = P.gold;
    ctx.font = 'bold 34px "Trebuchet MS", Arial, sans-serif';
    ctx.fillText('PAUSED', C.VW / 2, 226);
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font = 'bold 13px "Trebuchet MS", Arial, sans-serif';
    ctx.fillText('Job ' + Math.min(world.missions.index + 1, PC.missions.JOBS.length) + ' of ' + PC.missions.JOBS.length +
      ' · $' + world.money.toLocaleString('en-US'), C.VW / 2, 254);
    ctx.restore();

    var items = ['Resume', 'Save game', 'Load game', 'Music: ' + (world.audio.state.musicOn ? 'on' : 'off'), 'Quit to title'];
    for (var i = 0; i < items.length; i++) {
      R.button(ctx, C.VW / 2 - 150, 286 + i * 42, 300, 34, items[i], false);
    }
    ctx.save();
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.font = '11px "Trebuchet MS", Arial, sans-serif';
    ctx.fillText('Click a button, or press Esc to resume', C.VW / 2, 494);
    ctx.restore();
    // keep the pause menu hit areas on the object for the click handler
    world.pausedButtons = { y0: 286, h: 42, count: items.length };
  }

  function clickPause(world, mx, my) {
    var b = world.pausedButtons;
    if (!b) return 'resume';
    if (mx < C.VW / 2 - 150 || mx > C.VW / 2 + 150) return 'resume';
    var idx = Math.floor((my - b.y0) / b.h);
    if (idx < 0 || idx >= b.count) return 'resume';
    switch (idx) {
      case 0: return 'resume';
      case 1: return 'save';
      case 2: return 'load';
      case 3: return 'music';
      case 4: return 'quit';
    }
    return 'resume';
  }

  function drawMissionCard(ctx, world, t) {
    var ms = world.missions;
    if (ms.state !== 'brief' || !ms.job) return;
    var job = ms.job;
    var a = Math.min(1, ms.briefTime * 1.4);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(14,10,8,0.72)';
    ctx.fillRect(0, 0, C.VW, C.VH);
    R.card(ctx, 130, 150, 540, 350, 0.94);

    // a thin colour bar with the job's order in the chain
    ctx.fillStyle = P.accent;
    ctx.fillRect(130, 150, 540, 6);
    ctx.textAlign = 'left';
    ctx.fillStyle = P.accent2;
    ctx.font = 'bold 12px "Trebuchet MS", Arial, sans-serif';
    ctx.fillText('JOB ' + (ms.index + 1) + ' OF ' + PC.missions.JOBS.length + ' · ' + job.type.toUpperCase(), 158, 190);
    ctx.fillStyle = '#f6efe1';
    ctx.font = 'bold 40px "Trebuchet MS", Arial, sans-serif';
    ctx.fillText(job.title, 158, 240);
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.font = 'bold 14px "Trebuchet MS", Arial, sans-serif';
    ctx.fillText('from ' + job.giver, 158, 266);

    wrapText(ctx, job.brief, 158, 300, 480, 20, '15px "Trebuchet MS", Arial, sans-serif', 'rgba(255,255,255,0.85)');

    ctx.fillStyle = P.gold;
    ctx.font = 'bold 15px "Trebuchet MS", Arial, sans-serif';
    ctx.fillText('Objective: ' + job.line, 158, 404);
    ctx.fillStyle = P.money;
    ctx.font = 'bold 18px "Trebuchet MS", Arial, sans-serif';
    ctx.fillText('$' + job.cash + ' on completion', 158, 448);

    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = 'bold 12px "Trebuchet MS", Arial, sans-serif';
    ctx.fillText('Click or wait to begin', 640, 478);
    ctx.restore();
  }

  function wrapText(ctx, text, x, y, maxW, lineH, font, color) {
    ctx.save();
    ctx.font = font;
    ctx.fillStyle = color;
    ctx.textAlign = 'left';
    var words = text.split(' ');
    var line = '';
    var ly = y;
    for (var i = 0; i < words.length; i++) {
      var test = line ? line + ' ' + words[i] : words[i];
      if (ctx.measureText(test).width > maxW && line) {
        ctx.fillText(line, x, ly);
        line = words[i];
        ly += lineH;
      } else line = test;
    }
    if (line) ctx.fillText(line, x, ly);
    ctx.restore();
    return ly;
  }

  function drawStoryCard(ctx, world, t) {
    if (!world.storyDone) return;
    var a = Math.min(1, (world.time - world.storyAt) * 0.8);
    if (a <= 0) return;
    ctx.save();
    ctx.globalAlpha = a * 0.92;
    ctx.fillStyle = 'rgba(10,8,6,0.6)';
    ctx.fillRect(0, 0, C.VW, C.VH);
    ctx.globalAlpha = a;
    ctx.textAlign = 'center';
    ctx.fillStyle = P.gold;
    ctx.font = 'bold 54px "Trebuchet MS", Arial, sans-serif';
    ctx.fillText('THE CITY IS YOURS', C.VW / 2, C.VH / 2 - 30);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = 'bold 16px "Trebuchet MS", Arial, sans-serif';
    ctx.fillText('Seven jobs settled. ' + world.missions.completed + ' completed · $' + world.money.toLocaleString('en-US') + ' banked', C.VW / 2, C.VH / 2 + 12);
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = 'bold 13px "Trebuchet MS", Arial, sans-serif';
    ctx.fillText('Free roam is open — press Esc to save.', C.VW / 2, C.VH / 2 + 40);
    ctx.restore();
  }

  function drawToast(ctx, world, t) {
    // contextual prompts: enter a car, reload, save hint
    var pl = world.player;
    var msg = null;
    if (!pl.inCar) {
      var near = PC.vehicles.nearestEnterable(world.parked.concat(world.traffic), pl.x, pl.y, C.PLAYER.carEnterRange);
      if (near) msg = 'Press E to get in';
      if (pl.ammo <= 0 && pl.reserve > 0) msg = 'Press R to reload';
    }
    if (!msg) return;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = 'bold 13px "Trebuchet MS", Arial, sans-serif';
    var w = ctx.measureText(msg).width + 30;
    ctx.fillStyle = 'rgba(16,14,12,0.66)';
    U.roundRect(ctx, C.VW / 2 - w / 2, C.VH - 128, w, 30, 8); ctx.fill();
    ctx.fillStyle = '#f4ead2';
    ctx.fillText(msg, C.VW / 2, C.VH - 108);
    ctx.restore();
  }

  PC.ui = {
    SCREEN_TITLE: SCREEN_TITLE, SCREEN_PLAY: SCREEN_PLAY, SCREEN_PAUSED: SCREEN_PAUSED,
    drawTitle: drawTitle, drawPause: drawPause, clickPause: clickPause,
    drawMissionCard: drawMissionCard, drawStoryCard: drawStoryCard, drawToast: drawToast,
    wrapText: wrapText
  };
})(window.PC = window.PC || {});
