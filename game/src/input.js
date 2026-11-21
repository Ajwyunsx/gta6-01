/* Palm City — the keyboard and mouse. One object holds the key states the game asks about and
   the pointer mapped into world coordinates each frame; pressed-this-frame edges are kept so an
   action (enter car, fire, pause) fires once per press, not once per frame. */
(function (PC) {
  'use strict';

  var BIND = {
    KeyW: 'up', ArrowUp: 'up',
    KeyS: 'down', ArrowDown: 'down',
    KeyA: 'left', ArrowLeft: 'left',
    KeyD: 'right', ArrowRight: 'right',
    ShiftLeft: 'sprint', ShiftRight: 'sprint',
    Space: 'brake',
    KeyE: 'enter',
    KeyF: 'fire',
    KeyR: 'reload',
    KeyM: 'map',
    Escape: 'pause',
    KeyH: 'horn',
    Enter: 'confirm',
    KeyQ: 'mission'
  };

  function createInput(canvas) {
    var state = {
      keys: { up: false, down: false, left: false, right: false, sprint: false, brake: false },
      edge: {},
      mouse: { x: 640, y: 360, wx: 0, wy: 0, active: false, down: false, clicked: false },
      anyKey: false
    };

    function set(name, val, e) {
      if (name === 'up' || name === 'down' || name === 'left' || name === 'right' || name === 'sprint' || name === 'brake') {
        state.keys[name] = val;
      }
      if (val && !state.edge[name]) state.edge[name] = true;
      if (e && (name === 'brake' || name === 'enter' || name === 'fire')) e.preventDefault();
      state.anyKey = true;
    }

    window.addEventListener('keydown', function (e) {
      var name = BIND[e.code];
      if (!name) return;
      if (name === 'pause' || name === 'brake' || name === 'enter') e.preventDefault();
      set(name, true, e);
    });
    window.addEventListener('keyup', function (e) {
      var name = BIND[e.code];
      if (!name) return;
      set(name, false);
    });
    window.addEventListener('blur', function () {
      state.keys.up = state.keys.down = state.keys.left = state.keys.right = false;
      state.keys.sprint = state.keys.brake = false;
    });

    canvas.addEventListener('mousemove', function (e) {
      var r = canvas.getBoundingClientRect();
      state.mouse.x = (e.clientX - r.left) / r.width * canvas.width;
      state.mouse.y = (e.clientY - r.top) / r.height * canvas.height;
      state.mouse.active = true;
    });
    canvas.addEventListener('mousedown', function (e) {
      if (e.button === 0) { state.mouse.down = true; state.mouse.clicked = true; }
      e.preventDefault();
    });
    window.addEventListener('mouseup', function (e) {
      if (e.button === 0) state.mouse.down = false;
    });
    canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });

    state.pressed = function (name) {
      if (state.edge[name]) { state.edge[name] = false; return true; }
      return false;
    };
    state.clearEdges = function () { state.edge = {}; state.mouse.clicked = false; };
    return state;
  }

  PC.input = { create: createInput, BIND: BIND };
})(window.PC = window.PC || {});
