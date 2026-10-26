// Invoer: toetsenbord, muis (pointer lock), touch-joystick en -knoppen, gamepad en de chatregel.
import { BAITS } from '../shared.js';
import * as A from '../audio.js';
import { actDown, actUp, cancelLine, decideCatch } from './fishing.js';
import { updateHotbar } from './hud.js';
import { cycleBait, interact, toggleBoat, toggleVehicle } from './interact.js';
import { closePanel, openPanel } from './panels.js';
import { endPhoto, startPhoto } from './photo.js';
import { $, G, clamp, isTouch, me, send } from './state.js';

/* ------------------------------------------------------------------ invoer: toetsenbord, muis, touch, gamepad */
export const stick = { x: 0, y: 0 };
let padState = { act: false, use: false, cancel: false, lb: false, rb: false };
export function pad() {
  const gp = navigator.getGamepads && [...navigator.getGamepads()].find(g => g);
  if (!gp) return null;
  const dz = v => (Math.abs(v) < 0.18 ? 0 : v);
  const ax = i => dz(gp.axes[i] || 0),
    b = i => !!gp.buttons[i]?.pressed;
  me.yaw -= ax(2) * 0.04 * (G.settings.sens / 100) * 2;
  me.pitch = clamp(me.pitch - ax(3) * 0.03 * (G.settings.sens / 100) * 2, -1.2, 0.7);
  const act = b(0) || b(7),
    use = b(2),
    cancel = b(1),
    lb = b(4),
    rb = b(5);
  if (act && !padState.act) actDown();
  if (!act && padState.act) actUp();
  if (use && !padState.use) interact();
  if (cancel && !padState.cancel) cancelLine();
  if (lb && !padState.lb) cycleBait(-1);
  if (rb && !padState.rb) cycleBait(1);
  padState = { act, use, cancel, lb, rb };
  return { mx: ax(0), mz: -ax(1) };
}
addEventListener('keydown', e => {
  if (!G.inGame) return;
  if (G.chatOpen) {
    if (e.key === 'Enter') {
      const t = $('chatin').value.trim();
      if (t) send({ t: 'say', text: t });
      closeChat();
    } else if (e.key === 'Escape') closeChat();
    return;
  }
  if (e.code === 'Escape') {
    if (G.photo) return endPhoto();
    if (G.panel) return closePanel();
    openPanel('settings');
    return;
  }
  if (G.panel) {
    const map = { KeyI: 'bag', KeyJ: 'book', KeyO: 'quests', KeyM: 'map', KeyT: 'talents', KeyH: 'players' };
    if (map[e.code] && G.panel.name === map[e.code]) closePanel();
    return;
  }
  if (G.photo) return;
  A.unlock();
  if (e.code === 'Enter') {
    e.preventDefault();
    openChat();
    return;
  }
  G.keys.add(e.code);
  if (e.repeat) return;
  switch (e.code) {
    case 'Space':
      e.preventDefault();
      actDown();
      break;
    case 'KeyE':
      interact();
      break;
    case 'KeyX':
      cancelLine();
      break;
    case 'KeyB':
      toggleBoat();
      break;
    case 'KeyV':
      toggleVehicle();
      break;
    case 'KeyZ':
      send({ t: 'emote', k: 'wave' });
      break;
    case 'KeyN':
      send({ t: 'emote', k: 'laugh' });
      break;
    case 'KeyK':
      send({ t: 'emote', k: 'thumb' });
      break;
    case 'KeyL':
      send({ t: 'emote', k: 'fish' });
      break;
    case 'KeyF':
      decideCatch(true);
      break;
    case 'KeyG':
      decideCatch(false);
      break;
    case 'BracketLeft':
      cycleBait(-1);
      break;
    case 'BracketRight':
      cycleBait(1);
      break;
    case 'KeyI':
      openPanel('bag');
      break;
    case 'KeyJ':
      openPanel('book');
      break;
    case 'KeyO':
      openPanel('quests');
      break;
    case 'KeyM':
      openPanel('map');
      break;
    case 'KeyT':
      openPanel('talents');
      break;
    case 'KeyH':
      openPanel('players');
      break;
    case 'KeyP':
      startPhoto();
      break;
  }
  if (e.code.startsWith('Digit')) {
    const i = +e.code.slice(5) - 1,
      list = BAITS.filter(b => (G.save.baits[b.id] | 0) > 0 || b.id === G.save.bait);
    if (list[i]) {
      send({ t: 'bait', id: list[i].id });
      G.save.bait = list[i].id;
      updateHotbar();
    }
  }
});
addEventListener('keyup', e => {
  G.keys.delete(e.code);
  if (e.code === 'Space') actUp();
});
addEventListener('blur', () => {
  G.keys.clear();
  G.actHeld = false;
});
function openChat() {
  G.chatOpen = true;
  G.keys.clear();
  $('chatrow').classList.remove('hidden');
  $('chatin').value = '';
  $('chatin').focus();
}
function closeChat() {
  G.chatOpen = false;
  $('chatrow').classList.add('hidden');
  $('chatin').blur();
}
export const cv = $('cv');
let dragging = false,
  lastX = 0,
  lastY = 0;
cv.addEventListener('mousedown', e => {
  if (!G.inGame || G.panel) return;
  A.unlock();
  if (G.photo) {
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
    return;
  }
  if (!document.pointerLockElement && !isTouch) {
    cv.requestPointerLock?.();
    if (e.button === 0) return;
  }
  if (e.button === 0) actDown();
  else if (e.button === 2) {
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
  }
});
addEventListener('mouseup', e => {
  if (e.button === 0) actUp();
  dragging = false;
});
addEventListener('mousemove', e => {
  if (!G.inGame || G.panel) return;
  const k = (0.0022 * G.settings.sens) / 100;
  if (document.pointerLockElement === cv) {
    me.yaw -= e.movementX * k;
    me.pitch = clamp(me.pitch - e.movementY * k, -1.2, 0.7);
  } else if (dragging) {
    me.yaw -= (e.clientX - lastX) * k * 1.4;
    me.pitch = clamp(me.pitch - (e.clientY - lastY) * k * 1.4, -1.2, 0.7);
    lastX = e.clientX;
    lastY = e.clientY;
  }
});
cv.addEventListener('contextmenu', e => e.preventDefault());
cv.addEventListener(
  'wheel',
  e => {
    me.dist = clamp(me.dist + e.deltaY * 0.004, 2.5, 10);
  },
  { passive: true },
);
// touch
const sEl = $('stick');
let stickId = null,
  lookId = null,
  lookX = 0,
  lookY = 0;
sEl.addEventListener(
  'touchstart',
  e => {
    const t = e.changedTouches[0];
    stickId = t.identifier;
    e.preventDefault();
    A.unlock();
    stickMove(t);
  },
  { passive: false },
);
sEl.addEventListener(
  'touchmove',
  e => {
    for (const t of e.changedTouches) if (t.identifier === stickId) stickMove(t);
    e.preventDefault();
  },
  { passive: false },
);
const stickEnd = e => {
  for (const t of e.changedTouches)
    if (t.identifier === stickId) {
      stickId = null;
      stick.x = stick.y = 0;
      sEl.firstElementChild.style.transform = '';
    }
};
sEl.addEventListener('touchend', stickEnd);
sEl.addEventListener('touchcancel', stickEnd);
function stickMove(t) {
  const r = sEl.getBoundingClientRect(),
    cx = r.left + r.width / 2,
    cy = r.top + r.height / 2;
  let dx = (t.clientX - cx) / (r.width / 2),
    dy = (t.clientY - cy) / (r.height / 2);
  const l = Math.hypot(dx, dy);
  if (l > 1) {
    dx /= l;
    dy /= l;
  }
  stick.x = dx;
  stick.y = dy;
  sEl.firstElementChild.style.transform = `translate(${dx * 38}px,${dy * 38}px)`;
}
cv.addEventListener(
  'touchstart',
  e => {
    if (G.panel) return;
    for (const t of e.changedTouches)
      if (lookId === null) {
        lookId = t.identifier;
        lookX = t.clientX;
        lookY = t.clientY;
      }
    A.unlock();
  },
  { passive: true },
);
cv.addEventListener(
  'touchmove',
  e => {
    for (const t of e.changedTouches)
      if (t.identifier === lookId) {
        const k = (0.005 * G.settings.sens) / 100;
        me.yaw -= (t.clientX - lookX) * k;
        me.pitch = clamp(me.pitch - (t.clientY - lookY) * k, -1.2, 0.7);
        lookX = t.clientX;
        lookY = t.clientY;
      }
    if (G.photo) e.preventDefault();
  },
  { passive: false },
);
const lookEnd = e => {
  for (const t of e.changedTouches) if (t.identifier === lookId) lookId = null;
};
cv.addEventListener('touchend', lookEnd);
cv.addEventListener('touchcancel', lookEnd);
const hold = (id, down, up) => {
  const el = $(id);
  el.addEventListener(
    'touchstart',
    e => {
      e.preventDefault();
      A.unlock();
      down();
    },
    { passive: false },
  );
  el.addEventListener('touchend', e => {
    e.preventDefault();
    up && up();
  });
  el.addEventListener('mousedown', e => {
    e.preventDefault();
    down();
  });
  el.addEventListener('mouseup', () => up && up());
};
hold('tbAct', actDown, actUp);
hold('tbUse', interact);
hold('tbCancel', cancelLine);
hold('tbVeh', toggleVehicle);
hold('tbBoat', toggleBoat);
hold('tbBait', () => cycleBait(1));
