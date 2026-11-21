// input.js — keyboard, mouse and pointer lock, plus a deterministic replay mode the shot
// scenes use. Everything downstream reads the flat `state` object; nothing reads events.
(function () {
  'use strict';
  var PC = window.PC;

  function Input(canvas) {
    this.canvas = canvas;
    this.state = {
      up: false, down: false, left: false, right: false,
      sprint: false, aim: false, fire: false, action: false,
      handbrake: false, mouseX: 0, mouseY: 0, aimAngle: 0,
      clicked: false, wheel: 0,
    };
    this.pressed = {};          // edge-triggered keys, cleared by the world each step
    this.locked = false;
    this.scripted = null;       // a function(dt, state) used by the shot scenes
    this.bind();
  }

  Input.prototype.bind = function () {
    var self = this;
    var canvas = this.canvas;
    var map = {
      KeyW: 'up', ArrowUp: 'up',
      KeyS: 'down', ArrowDown: 'down',
      KeyA: 'left', ArrowLeft: 'left',
      KeyD: 'right', ArrowRight: 'right',
      ShiftLeft: 'sprint', ShiftRight: 'sprint',
      Space: 'action',
      KeyE: 'interact',
      KeyF: 'fire',
    };
    window.addEventListener('keydown', function (e) {
      if (map[e.code]) {
        self.state[map[e.code]] = true;
        if (e.code === 'Space') self.state.aim = false;
      }
      if (e.code === 'Space') e.preventDefault();
      self.pressed[e.code] = true;
      if (self.onKey) self.onKey(e.code, e);
    });
    window.addEventListener('keyup', function (e) {
      if (map[e.code]) self.state[map[e.code]] = false;
    });
    window.addEventListener('blur', function () {
      self.state.up = self.state.down = self.state.left = self.state.right = false;
      self.state.fire = false;
      self.state.action = false;
      self.state.sprint = false;
    });

    canvas.addEventListener('mousemove', function (e) {
      var rect = self.canvas.getBoundingClientRect();
      self.state.mouseX = e.clientX - rect.left;
      self.state.mouseY = e.clientY - rect.top;
      self.state.aim = true;
      if (self.locked) {
        self.state.aimAngle += e.movementX * 0.0022;
      }
    });
    canvas.addEventListener('mousedown', function (e) {
      self.state.fire = true;
      self.state.clicked = true;
      self.state.aim = true;
      if (self.onClick) self.onClick(e);
    });
    window.addEventListener('mouseup', function () {
      self.state.fire = false;
    });
    canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    canvas.addEventListener('wheel', function (e) {
      self.state.wheel += Math.sign(e.deltaY);
      e.preventDefault();
    }, { passive: false });

    canvas.addEventListener('click', function () {
      if (!self.locked && canvas.requestPointerLock) {
        try { canvas.requestPointerLock(); } catch (err) { void err; }
      }
    });
    document.addEventListener('pointerlockchange', function () {
      self.locked = document.pointerLockElement === canvas;
    });
  };

  // Convert a mouse position to an aim angle from the screen centre.
  Input.prototype.mouseAngle = function (w, h, fallback) {
    var dx = this.state.mouseX - w / 2;
    var dy = this.state.mouseY - h / 2;
    if (Math.abs(dx) + Math.abs(dy) < 6) return fallback;
    return Math.atan2(dy, dx);
  };

  Input.prototype.consume = function () {
    this.pressed = {};
    this.state.clicked = false;
    this.state.wheel = 0;
  };

  Input.prototype.applyScript = function (dt) {
    if (this.scripted) this.scripted(dt, this.state);
  };

  // A helper for shot scenes: press keys between times.
  Input.scriptPress = function (state, from, to, keys) {
    for (var k = 0; k < keys.length; k++) state[keys[k]] = true;
    void from; void to;
  };

  PC.Input = Input;
})();
