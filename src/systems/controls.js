// Unified input: keyboard + on-screen touch pad -> abstract actions.
// A focus stack guarantees only the top-most UI element reacts to a press
// (e.g. an open menu blocks overworld movement underneath it).
const KEYMAP = {
  ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
  ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
  Enter: 'confirm', Space: 'confirm', KeyZ: 'confirm', NumpadEnter: 'confirm',
  Escape: 'cancel', KeyX: 'cancel', Backspace: 'cancel',
  KeyM: 'menu', KeyP: 'menu',
  ShiftLeft: 'run', ShiftRight: 'run',
};
const DIRS = new Set(['up', 'down', 'left', 'right']);

const held = new Set();
const stack = []; // [{ id, handler }]
let nextId = 1;
let installed = false;

function typingInInput(e) {
  const t = e.target;
  return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA');
}

export function press(action) {
  const top = stack[stack.length - 1];
  if (top) top.handler(action);
}

export function hold(action, down) {
  if (action === 'cancel') { if (down) held.add('run'); else held.delete('run'); }   // B doubles as run
  if (down) {
    if (!held.has(action)) { held.add(action); press(action); }
  } else held.delete(action);
}

export function installControls() {
  if (installed) return;
  installed = true;
  window.addEventListener('keydown', (e) => {
    if (typingInInput(e)) return;
    const a = KEYMAP[e.code];
    if (!a) return;
    e.preventDefault();
    if (a === 'cancel') held.add('run');       // hold B (X) to run, like the handhelds
    if (!held.has(a)) { held.add(a); press(a); } else if (e.repeat && DIRS.has(a)) press(a);
  });
  window.addEventListener('keyup', (e) => {
    const a = KEYMAP[e.code];
    if (a) held.delete(a);
    if (a === 'cancel') held.delete('run');
  });
  window.addEventListener('blur', () => held.clear());
  installTouchPad();
  blockBrowserGestures();
}

/** Stop mobile browsers treating game taps as page gestures: double-tap zoom,
 *  pinch zoom, the long-press magnifier / text selection, and context menus.
 *  Text inputs (name, wallet) keep their normal behaviour. */
function blockBrowserGestures() {
  const isField = (e) => e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA');
  const stop = (e) => { if (!isField(e)) e.preventDefault(); };
  let lastEnd = 0;
  document.addEventListener('touchend', (e) => {
    const now = Date.now();
    if (now - lastEnd < 350) stop(e);           // second tap of a double-tap
    lastEnd = now;
  }, { passive: false });
  document.addEventListener('touchstart', (e) => { if (e.touches.length > 1) stop(e); }, { passive: false });
  document.addEventListener('touchmove', stop, { passive: false });
  for (const ev of ['dblclick', 'gesturestart', 'gesturechange', 'gestureend', 'contextmenu', 'selectstart']) {
    document.addEventListener(ev, stop, { passive: false });
  }
}

export function isHeld(action) { return held.has(action); }

/** Currently held direction (last one wins isn't tracked; priority order is fine). */
export function heldDirection() {
  for (const d of ['up', 'down', 'left', 'right']) if (held.has(d)) return d;
  return null;
}

/** Push a handler; returns a release function. Auto-released when `scene` shuts down. */
export function pushFocus(handler, scene = null) {
  const id = nextId++;
  stack.push({ id, handler });
  const release = () => {
    const i = stack.findIndex((s) => s.id === id);
    if (i >= 0) stack.splice(i, 1);
  };
  scene?.events.once('shutdown', release);
  return release;
}

/** Token-based focus used by the overworld (polls held keys each frame). */
export function pushFocusToken(handler = () => {}, scene = null) {
  const token = {};
  const id = nextId++;
  stack.push({ id, handler, token });
  scene?.events.once('shutdown', () => {
    const i = stack.findIndex((s) => s.id === id);
    if (i >= 0) stack.splice(i, 1);
  });
  return {
    token,
    isTop: () => stack[stack.length - 1]?.token === token,
    release: () => {
      const i = stack.findIndex((s) => s.id === id);
      if (i >= 0) stack.splice(i, 1);
    },
  };
}

function installTouchPad() {
  const touch = window.matchMedia?.('(pointer: coarse)').matches || 'ontouchstart' in window;
  const pad = document.getElementById('touchpad');
  if (!pad) return;
  if (!touch) { pad.remove(); return; }
  pad.style.display = 'block';
  pad.querySelectorAll('[data-act]').forEach((el) => {
    const act = el.dataset.act;
    const down = (e) => { e.preventDefault(); hold(act, true); el.classList.add('on'); };
    const up = (e) => { e.preventDefault(); hold(act, false); el.classList.remove('on'); };
    // touch events too: preventing them is what stops iOS zooming / magnifying
    el.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
    el.addEventListener('touchend', (e) => e.preventDefault(), { passive: false });
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('pointerleave', up);
  });
}
