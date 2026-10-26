// Fotomodus: HUD verbergen en een foto met onderschrift opslaan.
import * as S from '../shared.js';
import { PONDS, SP } from '../shared.js';
import * as UI from '../ui/html.js';
import { toast } from './hud.js';
import { renderFrame } from './scene.js';
import { $, G, R, isTouch, me, nearPond, phase } from './state.js';

/* ------------------------------------------------------------------ foto's */
export function startPhoto() {
  G.photo = true;
  $('hud')
    .querySelectorAll('#tl,#tr,#quests,#feed,#menubar,#hotbar,#touch,#sonar,#reticle,#status')
    .forEach(e => {
      e.dataset.hid = e.style.display;
      e.style.display = 'none';
    });
  $('photoUI').classList.remove('hidden');
  G.photoDist = me.dist;
  me.dist = 6;
}
export function endPhoto() {
  G.photo = false;
  $('hud')
    .querySelectorAll('[data-hid]')
    .forEach(e => {
      e.style.display = e.dataset.hid;
      delete e.dataset.hid;
    });
  $('photoUI').classList.add('hidden');
  me.dist = G.photoDist || 5.2;
  if (isTouch) $('touch').classList.remove('hidden');
}
$('photoExit').onclick = endPhoto;
$('photoSnap').onclick = () => takePhoto(null);
export function takePhoto(c) {
  renderFrame();
  const src = R.renderer.domElement,
    cv = document.createElement('canvas');
  cv.width = src.width;
  cv.height = src.height;
  const x = cv.getContext('2d');
  x.drawImage(src, 0, 0);
  const w = cv.width,
    h = cv.height,
    u = h / 700;
  x.fillStyle = 'rgba(0,20,28,.55)';
  x.fillRect(0, h - 90 * u, w, 90 * u);
  x.fillStyle = '#fff';
  x.font = `bold ${30 * u}px system-ui`;
  x.textAlign = 'left';
  const sp = c ? SP[c.fish.sp] : null;
  x.fillText(sp ? `${sp.name} · ${S.fmtKg(c.fish.w)}` : 'Visvrienden', 24 * u, h - 52 * u);
  x.font = `${20 * u}px system-ui`;
  x.fillStyle = '#bfe8ee';
  x.fillText(
    `${G.name} · ${PONDS[nearPond()].name} · ${S.clockStr(phase())} · ${new Date().toLocaleDateString('nl-NL')}`,
    24 * u,
    h - 22 * u,
  );
  if (sp) {
    const img = new Image();
    img.onload = () => {
      x.drawImage(img, w - 260 * u, h - 160 * u, 240 * u, 130 * u);
      save();
    };
    img.src = UI.fishImg(sp.id);
  } else save();
  function save() {
    const a = document.createElement('a');
    a.download = `visvrienden-${Date.now()}.png`;
    a.href = cv.toDataURL('image/png');
    a.click();
    toast('📸 Foto opgeslagen!', 'good');
    $('flash').style.transition = 'none';
    $('flash').style.opacity = 0.8;
    requestAnimationFrame(() => {
      $('flash').style.transition = 'opacity .4s';
      $('flash').style.opacity = 0;
    });
  }
}
