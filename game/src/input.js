// input.js — keyboard and mouse, collected into one small state object main.js reads.
// Keys are tracked by physical code so WASD works on any layout; the mouse position is
// kept in screen space and converted to world space by the caller.

const KEY_ACTIONS = {
  KeyW: 'up',
  ArrowUp: 'up',
  KeyS: 'down',
  ArrowDown: 'down',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
  ShiftLeft: 'sprint',
  ShiftRight: 'sprint',
  Space: 'handbrake',
  KeyE: 'use',
  KeyM: 'mute',
  Escape: 'pause',
  Enter: 'confirm',
  KeyR: 'restart',
  KeyH: 'horn',
  Tab: 'map',
};

export function createInput(canvas) {
  const state = {
    up: false,
    down: false,
    left: false,
    right: false,
    sprint: false,
    handbrake: false,
    use: false,
    mute: false,
    pause: false,
    confirm: false,
    restart: false,
    horn: false,
    map: false,
    mouseX: 640,
    mouseY: 360,
    mouseDown: false,
    clicked: false,
    mouseWorldX: 0,
    mouseWorldY: 0,
    wheel: 0,
    pressed: new Set(),
  };

  const onKey = (event, down) => {
    const action = KEY_ACTIONS[event.code];
    if (!action) return;
    // Let the browser keep its own shortcuts, but stop arrows/space from scrolling the page.
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab'].includes(event.code)) event.preventDefault();
    if (down && !state[action]) state.pressed.add(action);
    state[action] = down;
  };

  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    onKey(event, true);
  });
  window.addEventListener('keyup', (event) => onKey(event, false));

  const setMouse = (event) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    state.mouseX = (event.clientX - rect.left) * scaleX;
    state.mouseY = (event.clientY - rect.top) * scaleY;
  };
  canvas.addEventListener('mousemove', setMouse);
  canvas.addEventListener('mousedown', (event) => {
    setMouse(event);
    if (event.button === 0) {
      state.mouseDown = true;
      state.pressed.add('shoot');
    }
  });
  window.addEventListener('mouseup', (event) => {
    if (event.button === 0) state.mouseDown = false;
  });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());
  canvas.addEventListener('wheel', (event) => {
    event.preventDefault();
    state.wheel += Math.sign(event.deltaY);
  }, { passive: false });

  window.addEventListener('blur', () => {
    for (const key of Object.keys(state)) if (typeof state[key] === 'boolean') state[key] = false;
  });

  state.wasPressed = (action) => state.pressed.has(action);
  state.endFrame = () => {
    state.pressed.clear();
    state.wheel = 0;
  };
  return state;
}
