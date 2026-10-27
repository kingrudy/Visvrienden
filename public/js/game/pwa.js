// Installeren als app (PWA): service worker registreren en de installatieknop tonen als de browser dat aanbiedt.
import { toast } from './hud.js';
import { $, G, isTouch } from './state.js';

let deferred = null;
export function initPwa() {
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('/sw.js').catch(e => console.warn('service worker', e));
  }
  addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferred = e;
    setInstallable(true);
  });
  addEventListener('appinstalled', () => {
    deferred = null;
    setInstallable(false);
    toast('📲 Visvrienden staat nu als app op je apparaat!', 'good');
  });
  // iPhone/iPad: geen installatieprompt, wel uitleg via het deelmenu
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) && !matchMedia('(display-mode: standalone)').matches;
  if (ios && isTouch) setInstallable(true);
  $('btnInstall').onclick = installApp;
}
function setInstallable(on) {
  G.canInstall = on;
  $('btnInstall').classList.toggle('hidden', !on);
}
export async function installApp() {
  if (deferred) {
    deferred.prompt();
    const r = await deferred.userChoice.catch(() => null);
    if (r?.outcome === 'accepted') setInstallable(false);
    deferred = null;
    return;
  }
  toast('Tik op de deelknop (vierkantje met pijl) en kies "Zet op beginscherm".', 'info');
}
