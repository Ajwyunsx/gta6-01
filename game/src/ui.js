// ui.js — the furniture around the game: the title screen, the pause menu, the save/load
// slate, the busted and wasted screens, and the job briefing card. Everything is drawn on
// the same canvas with the same palette, so no page reload ever happens.
(function () {
  'use strict';
  var PC = window.PC;
  var CFG = PC.CFG;
  var U = PC.U;
  var C = CFG.colors;
  var UI = C.ui;

  var MENU_ITEMS = [
    { id: 'resume', label: 'Resume', hint: 'back to the street' },
    { id: 'save', label: 'Save game', hint: 'the garage remembers' },
    { id: 'load', label: 'Load game', hint: 'pick up where you left' },
    { id: 'help', label: 'Controls', hint: 'keys and mouse' },
    { id: 'restart', label: 'New game', hint: 'start the story again' },
  ];

  function UI_(world) {
    this.world = world;
    this.screen = 'title';           // title | playing | pause | help | mapping | dead | brief
    this.selection = 0;
    this.helpFrom = 'title';
    this.deadTimer = 0;
    this.deadReason = '';
    this.clock = 0;
    this.tipIndex = 0;
    this.tipClock = 0;
    this.confirm = null;
    this.titleSelection = 0;
  }

  UI_.prototype.openTitle = function () {
    this.screen = 'title';
    this.titleSelection = 0;
  };

  UI_.prototype.openPause = function () {
    this.screen = 'pause';
    this.selection = 0;
  };

  UI_.prototype.openHelp = function () {
    this.helpFrom = this.screen;
    this.screen = 'help';
  };

  UI_.prototype.closeHelp = function () {
    this.screen = this.helpFrom === 'title' ? 'title' : 'pause';
  };

  UI_.prototype.dead = function (reason) {
    this.screen = 'dead';
    this.deadReason = reason;
    this.deadTimer = 0;
  };

  UI_.prototype.update = function (dt) {
    this.clock += dt;
    if (this.screen === 'dead') {
      this.deadTimer += dt;
    }
    this.tipClock += dt;
    if (this.tipClock > 9) {
      this.tipClock = 0;
      this.tipIndex = (this.tipIndex + 1) % TIPS.length;
    }
  };

  // ---- input -----------------------------------------------------------------
  UI_.prototype.key = function (code) {
    var world = this.world;
    if (this.screen === 'title') {
      if (code === 'ArrowDown' || code === 'KeyS') this.titleSelection = (this.titleSelection + 1) % 2;
      if (code === 'ArrowUp' || code === 'KeyW') this.titleSelection = (this.titleSelection + 1) % 2;
      if (code === 'Enter' || code === 'Space') {
        if (this.titleSelection === 0) {
          world.startNewGame();
          this.screen = 'playing';
        } else {
          this.screen = 'mapping';
        }
      }
      return true;
    }
    if (this.screen === 'mapping') {
      if (world.load()) this.screen = 'playing';
      else this.screen = 'title';
      return true;
    }
    if (this.screen === 'help') {
      if (code === 'Escape' || code === 'Enter' || code === 'KeyH') this.closeHelp();
      return true;
    }
    if (this.screen === 'dead') {
      if (this.deadTimer > 1.2 && (code === 'Enter' || code === 'Space')) {
        world.respawn();
        this.screen = 'playing';
      }
      return true;
    }
    if (this.screen === 'pause') {
      if (code === 'Escape' || code === 'KeyP') { this.screen = 'playing'; return true; }
      if (code === 'ArrowDown' || code === 'KeyS') this.selection = (this.selection + 1) % MENU_ITEMS.length;
      if (code === 'ArrowUp' || code === 'KeyW') this.selection = (this.selection + MENU_ITEMS.length - 1) % MENU_ITEMS.length;
      if (code === 'Enter' || code === 'Space') this.activate(MENU_ITEMS[this.selection].id);
      return true;
    }
    if (this.screen === 'playing') {
      if (code === 'Escape' || code === 'KeyP') { this.openPause(); return true; }
      if (code === 'KeyH') { this.openHelp(); return true; }
    }
    return false;
  };

  UI_.prototype.activate = function (id) {
    var world = this.world;
    if (id === 'resume') this.screen = 'playing';
    else if (id === 'save') {
      world.save();
      world.hud.toast('Game saved');
      this.screen = 'playing';
    } else if (id === 'load') {
      if (world.load()) {
        this.screen = 'playing';
        world.hud.toast('Game loaded');
      } else {
        world.hud.toast('No save found');
      }
    } else if (id === 'help') this.openHelp();
    else if (id === 'restart') {
      world.startNewGame();
      this.screen = 'playing';
    }
  };

  // ---- drawing ---------------------------------------------------------------
  UI_.prototype.draw = function (ctx, w, h) {
    if (this.screen === 'title') this.drawTitle(ctx, w, h);
    else if (this.screen === 'pause') this.drawPause(ctx, w, h);
    else if (this.screen === 'help') this.drawHelp(ctx, w, h);
    else if (this.screen === 'dead') this.drawDead(ctx, w, h);
    else if (this.screen === 'mapping') this.drawMapping(ctx, w, h);
  };

  UI_.prototype.drawTitle = function (ctx, w, h) {
    var grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, 'rgba(10,8,16,0.78)');
    grad.addColorStop(0.55, 'rgba(22,14,30,0.42)');
    grad.addColorStop(1, 'rgba(10,8,16,0.86)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // sun disc behind the wordmark — the one piece of art the title screen owns
    ctx.save();
    var sunX = w * 0.72, sunY = h * 0.34, sunR = h * 0.3;
    var sg = ctx.createRadialGradient(sunX, sunY, sunR * 0.2, sunX, sunY, sunR);
    sg.addColorStop(0, 'rgba(255,142,110,0.75)');
    sg.addColorStop(0.55, 'rgba(255,95,162,0.28)');
    sg.addColorStop(1, 'rgba(255,95,162,0)');
    ctx.fillStyle = sg;
    ctx.beginPath();
    ctx.arc(sunX, sunY, sunR, 0, 6.283);
    ctx.fill();
    // horizontal retro bands cut through the disc
    ctx.globalCompositeOperation = 'destination-out';
    for (var i = 0; i < 7; i++) {
      var by = sunY + sunR * 0.12 + i * (sunR * 0.115);
      ctx.fillRect(sunX - sunR, by, sunR * 2, sunR * 0.045 + i * 0.8);
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.restore();

    ctx.save();
    ctx.textAlign = 'left';
    var x = w * 0.085;
    var y = h * 0.34;
    ctx.fillStyle = UI.cream;
    ctx.font = '800 ' + Math.round(h * 0.115) + 'px ui-sans-serif, system-ui, sans-serif';
    ctx.shadowColor = 'rgba(0,0,0,0.55)';
    ctx.shadowBlur = 22;
    ctx.fillText('PALM', x, y);
    ctx.fillText('CITY', x, y + h * 0.115);
    ctx.shadowBlur = 0;
    ctx.fillStyle = UI.coral;
    ctx.fillRect(x + 4, y + h * 0.137, Math.round(w * 0.14), 5);

    ctx.fillStyle = 'rgba(247,240,225,0.72)';
    ctx.font = '500 ' + Math.round(h * 0.021) + 'px ui-sans-serif, system-ui, sans-serif';
    ctx.fillText('An open-world crime story on the Gulf coast.', x + 2, y + h * 0.175);
    ctx.fillText('Seven jobs. One city. Nobody is coming to help.', x + 2, y + h * 0.205);

    // menu
    var my = h * 0.66;
    var items = ['New game', 'Continue'];
    for (var k = 0; k < items.length; k++) {
      var selected = k === this.titleSelection;
      var iy = my + k * 42;
      if (selected) {
        ctx.fillStyle = 'rgba(255,95,162,0.16)';
        U.roundRect(ctx, x - 10, iy - 24, 240, 34, 8);
        ctx.fill();
        ctx.fillStyle = UI.pink;
        ctx.fillRect(x - 10, iy - 24, 3, 34);
      }
      ctx.fillStyle = selected ? UI.cream : 'rgba(247,240,225,0.55)';
      ctx.font = (selected ? '700 ' : '500 ') + Math.round(h * 0.026) + 'px ui-sans-serif, system-ui, sans-serif';
      ctx.fillText(items[k], x + 6, iy);
    }

    // footer: controls and the tip line
    ctx.fillStyle = 'rgba(247,240,225,0.45)';
    ctx.font = '500 ' + Math.round(h * 0.016) + 'px ui-sans-serif, system-ui, sans-serif';
    ctx.fillText('WASD walk · SHIFT sprint · click/SPACE no — E to enter a car · F to fire · ESC pause', x + 2, h - 54);
    ctx.fillStyle = 'rgba(247,240,225,0.30)';
    ctx.fillText(TIPS[this.tipIndex], x + 2, h - 30);
    ctx.restore();
  };

  UI_.prototype.drawPause = function (ctx, w, h) {
    ctx.save();
    ctx.fillStyle = 'rgba(10,8,16,0.66)';
    ctx.fillRect(0, 0, w, h);
    var pw = 340, ph = 60 + MENU_ITEMS.length * 46;
    var px = w / 2 - pw / 2, py = h / 2 - ph / 2;
    U.roundRect(ctx, px, py, pw, ph, 16);
    ctx.fillStyle = 'rgba(20,16,25,0.94)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(247,240,225,0.14)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.textAlign = 'left';
    ctx.fillStyle = UI.coral;
    ctx.font = '700 12px ui-sans-serif, system-ui, sans-serif';
    ctx.fillText('PAUSED', px + 26, py + 34);
    ctx.fillStyle = UI.cream;
    ctx.font = '800 22px ui-sans-serif, system-ui, sans-serif';
    ctx.fillText('Palm City', px + 26, py + 58);

    for (var k = 0; k < MENU_ITEMS.length; k++) {
      var item = MENU_ITEMS[k];
      var iy = py + 92 + k * 46;
      var sel = k === this.selection;
      if (sel) {
        ctx.fillStyle = 'rgba(255,95,162,0.14)';
        U.roundRect(ctx, px + 18, iy - 22, pw - 36, 34, 8);
        ctx.fill();
      }
      ctx.fillStyle = sel ? UI.cream : 'rgba(247,240,225,0.6)';
      ctx.font = (sel ? '700 ' : '500 ') + '15px ui-sans-serif, system-ui, sans-serif';
      ctx.fillText(item.label, px + 32, iy);
      ctx.fillStyle = 'rgba(247,240,225,0.34)';
      ctx.font = '500 11px ui-sans-serif, system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(item.hint, px + pw - 32, iy);
      ctx.textAlign = 'left';
    }
    ctx.fillStyle = 'rgba(247,240,225,0.35)';
    ctx.font = '500 11px ui-sans-serif, system-ui, sans-serif';
    ctx.fillText('ESC resume · ↑↓ choose · ENTER select', px + 26, py + ph - 18);
    ctx.restore();
  };

  UI_.prototype.drawHelp = function (ctx, w, h) {
    ctx.save();
    ctx.fillStyle = 'rgba(10,8,16,0.86)';
    ctx.fillRect(0, 0, w, h);
    var rows = [
      ['W A S D', 'walk'],
      ['SHIFT', 'sprint'],
      ['E', 'enter / leave a car, start a job'],
      ['F / click', 'fire (hold to keep firing)'],
      ['SPACE', 'handbrake in a car, punch on foot'],
      ['MOUSE', 'aim and steer the camera'],
      ['ESC / P', 'pause, save and load'],
      ['H', 'this screen'],
    ];
    var pw = Math.min(760, w - 120);
    var px = w / 2 - pw / 2;
    var py = h / 2 - 220;
    ctx.fillStyle = UI.cream;
    ctx.font = '800 26px ui-sans-serif, system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Controls', px, py);
    ctx.fillStyle = UI.coral;
    ctx.fillRect(px, py + 12, 60, 4);

    for (var k = 0; k < rows.length; k++) {
      var y = py + 54 + k * 34;
      ctx.fillStyle = 'rgba(247,240,225,0.94)';
      ctx.font = '700 13px ui-monospace, monospace';
      ctx.fillText(rows[k][0], px, y);
      ctx.fillStyle = 'rgba(247,240,225,0.6)';
      ctx.font = '500 13px ui-sans-serif, system-ui, sans-serif';
      ctx.fillText(rows[k][1], px + 150, y);
    }
    ctx.fillStyle = 'rgba(247,240,225,0.4)';
    ctx.font = '500 12px ui-sans-serif, system-ui, sans-serif';
    ctx.fillText('Press ESC to go back.', px, py + 54 + rows.length * 34 + 16);
    ctx.restore();
  };

  UI_.prototype.drawDead = function (ctx, w, h) {
    var a = U.clamp(this.deadTimer / 0.7, 0, 1);
    ctx.save();
    ctx.fillStyle = 'rgba(72,10,18,' + (0.72 * a) + ')';
    ctx.fillRect(0, 0, w, h);
    ctx.textAlign = 'center';
    ctx.globalAlpha = a;
    ctx.fillStyle = '#ffe9e9';
    ctx.font = '800 62px ui-sans-serif, system-ui, sans-serif';
    ctx.fillText(this.deadReason || 'WASTED', w / 2, h / 2 - 10);
    ctx.fillStyle = 'rgba(255,233,233,0.7)';
    ctx.font = '500 16px ui-sans-serif, system-ui, sans-serif';
    ctx.fillText(this.deadReason === 'BUSTED' ? 'The city keeps the car. You keep the record.' : 'The heat cools. The story does not.', w / 2, h / 2 + 28);
    if (this.deadTimer > 1.2) {
      ctx.fillStyle = 'rgba(255,233,233,' + (0.5 + Math.sin(this.clock * 4) * 0.3) + ')';
      ctx.font = '600 14px ui-sans-serif, system-ui, sans-serif';
      ctx.fillText('ENTER to get back up', w / 2, h / 2 + 82);
    }
    ctx.restore();
  };

  UI_.prototype.drawMapping = function (ctx, w, h) {
    ctx.save();
    ctx.fillStyle = 'rgba(10,8,16,0.9)';
    ctx.fillRect(0, 0, w, h);
    ctx.textAlign = 'center';
    ctx.fillStyle = UI.cream;
    ctx.font = '800 30px ui-sans-serif, system-ui, sans-serif';
    ctx.fillText('No save to continue', w / 2, h / 2 - 10);
    ctx.fillStyle = 'rgba(247,240,225,0.6)';
    ctx.font = '500 14px ui-sans-serif, system-ui, sans-serif';
    ctx.fillText('Press ENTER to start a new game.', w / 2, h / 2 + 26);
    ctx.restore();
  };

  // The job briefing card, drawn over the game while it is paused.
  UI_.prototype.drawBriefing = function (ctx, w, h, briefing) {
    if (!briefing) return;
    var job = briefing.job;
    ctx.save();
    ctx.fillStyle = 'rgba(10,8,16,0.34)';
    ctx.fillRect(0, 0, w, h);
    var pw = Math.min(560, w - 80);
    var px = w / 2 - pw / 2;
    var py = h / 2 - 190;
    U.roundRect(ctx, px, py, pw, 380, 18);
    ctx.fillStyle = 'rgba(20,16,25,0.96)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,203,82,0.35)';
    ctx.lineWidth = 1.4;
    ctx.stroke();

    ctx.textAlign = 'left';
    ctx.fillStyle = UI.gold || '#ffcb52';
    ctx.font = '700 11px ui-sans-serif, system-ui, sans-serif';
    ctx.fillText('JOB ' + (this.world.missions.index + 1) + ' OF 7', px + 30, py + 36);
    ctx.fillStyle = UI.cream;
    ctx.font = '800 32px ui-sans-serif, system-ui, sans-serif';
    ctx.fillText(job.title, px + 30, py + 74);
    ctx.fillStyle = UI.coral;
    ctx.fillRect(px + 30, py + 90, 52, 4);

    ctx.fillStyle = 'rgba(247,240,225,0.55)';
    ctx.font = '600 12px ui-sans-serif, system-ui, sans-serif';
    ctx.fillText(job.giver, px + 30, py + 118);

    ctx.fillStyle = 'rgba(247,240,225,0.86)';
    ctx.font = '500 14px ui-sans-serif, system-ui, sans-serif';
    wrap(ctx, job.brief, px + 30, py + 150, pw - 60, 21, 5);

    ctx.fillStyle = UI.teal;
    ctx.font = '700 13px ui-sans-serif, system-ui, sans-serif';
    ctx.fillText(job.objective.toUpperCase(), px + 30, py + 286);

    ctx.fillStyle = 'rgba(247,240,225,0.8)';
    ctx.font = '700 16px ui-sans-serif, system-ui, sans-serif';
    ctx.fillText('Pays ' + U.money(job.payout), px + 30, py + 322);

    ctx.fillStyle = 'rgba(247,240,225,' + (0.45 + Math.sin(this.clock * 4) * 0.25) + ')';
    ctx.font = '600 12px ui-sans-serif, system-ui, sans-serif';
    ctx.fillText('E to start · WALK AWAY to think about it', px + 30, py + 354);
    ctx.restore();
  };

  function wrap(ctx, text, x, y, maxW, lineH, maxLines) {
    var words = String(text).split(' ');
    var line = '';
    var lines = [];
    for (var i = 0; i < words.length; i++) {
      var test = line ? line + ' ' + words[i] : words[i];
      if (ctx.measureText(test).width > maxW && line) {
        lines.push(line);
        line = words[i];
        if (lines.length === maxLines) break;
      } else line = test;
    }
    if (lines.length < maxLines && line) lines.push(line);
    for (var k = 0; k < lines.length; k++) ctx.fillText(lines[k], x, y + k * lineH);
  }

  var TIPS = [
    'Pedestrians mind their own business until a car comes through. Then they scatter.',
    'Steal a car and drive it into the sea: the police still count it as yours.',
    'Every star is another cruiser. Five stars is a conversation you will not enjoy.',
    'Jobs pay in cash. Cash is not a score. Cash is a lifestyle.',
    'The minimap is drawn from the city itself: what you see is what is there.',
    'Lose the police by getting out of sight and staying quiet. Nine seconds of peace begins it.',
    'The beach has no speed limit enforcement. The beach also has no road.',
  ];

  PC.UI = UI_;
  PC.UI_MENU = MENU_ITEMS;
})();
