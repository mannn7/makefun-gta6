// Keyboard and mouse input. WASD moves, mouse drag orbits the camera (pointer lock
// when the player clicks the canvas), Space jumps / handbrakes, Shift runs, E enters
// and exits cars, F punches, 1/2 swap weapons, M mutes, Esc pauses. `pressed(code)`
// is true only on the frame the key went down; `held(code)` while it is down.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;

export function createInput(canvas) {
  const keys = new Set();
  const justPressed = new Set();
  let mouseDX = 0;
  let mouseDY = 0;
  let mouseDown = false;
  let lastX = 0;
  let lastY = 0;
  let locked = false;

  function onKeyDown(event) {
    if (event.repeat) return;
    keys.add(event.code);
    justPressed.add(event.code);
    if (event.code === 'Space') event.preventDefault();
  }
  function onKeyUp(event) {
    keys.delete(event.code);
  }
  function onMouseMove(event) {
    if (locked) {
      mouseDX += event.movementX;
      mouseDY += event.movementY;
    } else if (mouseDown) {
      mouseDX += event.clientX - lastX;
      mouseDY += event.clientY - lastY;
      lastX = event.clientX;
      lastY = event.clientY;
    }
  }
  function onMouseDown(event) {
    mouseDown = true;
    justPressed.add('MouseClick');
    lastX = event.clientX;
    lastY = event.clientY;
    if (document.pointerLockElement !== canvas) {
      try {
        canvas.requestPointerLock();
      } catch {
        // Pointer lock can be refused (headless, iframes): drag still orbits.
      }
    }
  }
  function onMouseUp() {
    mouseDown = false;
  }
  function onLockChange() {
    locked = document.pointerLockElement === canvas;
  }
  function onBlur() {
    keys.clear();
    mouseDown = false;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);
  window.addEventListener('blur', onBlur);
  document.addEventListener('pointerlockchange', onLockChange);

  return {
    held(code) {
      return keys.has(code);
    },
    pressed(code) {
      return justPressed.has(code);
    },
    /** WASD as x (strafe) and y (forward), each -1..1. */
    moveAxis() {
      let x = 0;
      let y = 0;
      if (keys.has('KeyA')) x -= 1;
      if (keys.has('KeyD')) x += 1;
      if (keys.has('KeyW')) y += 1;
      if (keys.has('KeyS')) y -= 1;
      return { x, y };
    },
    /** Mouse movement since the last frame, then cleared. */
    takeMouse() {
      const out = { dx: mouseDX, dy: mouseDY };
      mouseDX = 0;
      mouseDY = 0;
      return out;
    },
    takeActions() {
      let actions = 0;
      if (justPressed.has('Enter') || justPressed.has('Space')) actions |= ACTION_CONFIRM;
      if (justPressed.has('Escape')) actions |= ACTION_PAUSE;
      return actions;
    },
    /** Clear the just-pressed set; call once per frame. */
    endFrame() {
      justPressed.clear();
    },
    isLocked() {
      return locked;
    },
  };
}
