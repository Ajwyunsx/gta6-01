// Palm City — keyboard and mouse, read once per step into a small plain object. The rest
// of the game never listens for events itself.
(function (global) {
  'use strict';

  const PC = global.PC;

  function makeInput(canvas) {
    const keys = Object.create(null);
    const input = {
      keys,
      mouse: { x: 0, y: 0, down: false, clicked: false },
      wheel: 0,
      pressed: Object.create(null),   // edge-triggered keys, cleared each step
      anyKey: false,
    };

    const codeOf = (e) => e.code || e.key;

    global.addEventListener('keydown', (e) => {
      const code = codeOf(e);
      if (!keys[code]) input.pressed[code] = true;
      keys[code] = true;
      input.anyKey = true;
      // Stop the page scrolling under the game.
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(code)) e.preventDefault();
    });

    global.addEventListener('keyup', (e) => {
      keys[codeOf(e)] = false;
    });

    global.addEventListener('blur', () => {
      for (const k of Object.keys(keys)) keys[k] = false;
      input.mouse.down = false;
    });

    canvas.addEventListener('mousemove', (e) => {
      const rect = canvas.getBoundingClientRect();
      input.mouse.x = ((e.clientX - rect.left) / rect.width) * canvas.width;
      input.mouse.y = ((e.clientY - rect.top) / rect.height) * canvas.height;
    });

    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        input.mouse.down = true;
        input.mouse.clicked = true;
      }
    });

    global.addEventListener('mouseup', (e) => {
      if (e.button === 0) input.mouse.down = false;
    });

    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    canvas.addEventListener('wheel', (e) => {
      input.wheel += Math.sign(e.deltaY);
      e.preventDefault();
    }, { passive: false });

    input.endStep = function endStep() {
      for (const k of Object.keys(input.pressed)) delete input.pressed[k];
      input.mouse.clicked = false;
      input.wheel = 0;
      input.anyKey = false;
    };

    input.axis = function axis() {
      let x = 0;
      let y = 0;
      if (keys.KeyA || keys.ArrowLeft) x -= 1;
      if (keys.KeyD || keys.ArrowRight) x += 1;
      if (keys.KeyW || keys.ArrowUp) y -= 1;
      if (keys.KeyS || keys.ArrowDown) y += 1;
      return { x, y };
    };

    input.consumeKey = function consumeKey(code) {
      if (input.pressed[code]) {
        delete input.pressed[code];
        return true;
      }
      return false;
    };

    return input;
  }

  PC.Input = { makeInput };
})(window);
