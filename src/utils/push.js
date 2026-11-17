// Web Push opt-in for this device. The service worker side lives in public/push-sw.js.
import { crmApi } from '../api/crmApi';

const isIOS = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;

const pushSupported = () =>
  'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

function urlBase64ToUint8Array(base64) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

async function getRegistration() {
  // navigator.serviceWorker.ready never resolves if no worker registers, so cap the wait.
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise((_, reject) => setTimeout(() => reject(new Error('Service worker not ready')), 10000)),
  ]);
}

/**
 * 'unsupported'       – browser has no Web Push
 * 'ios-needs-install' – iPhone/iPad in a browser tab: must be added to the Home Screen first
 * 'denied'            – user blocked notifications (only fixable in phone/browser settings)
 * 'off'               – can be enabled
 * 'on'                – this device is subscribed
 */
export async function getPushState() {
  if (isIOS() && !isStandalone()) return 'ios-needs-install';
  if (!pushSupported()) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  try {
    const reg = await getRegistration();
    const sub = await reg.pushManager.getSubscription();
    return sub && Notification.permission === 'granted' ? 'on' : 'off';
  } catch {
    return 'off';
  }
}

// Must be called from a tap/click (iOS rejects permission prompts that aren't user-initiated).
export async function enablePush() {
  if (!pushSupported()) throw new Error('This browser does not support push notifications.');

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    return permission === 'denied' ? 'denied' : 'off';
  }

  const { publicKey } = await crmApi.getPushPublicKey();
  const reg = await getRegistration();
  const key = urlBase64ToUint8Array(publicKey);

  let sub = await reg.pushManager.getSubscription();
  // If the server's key changed, the old subscription can't be used.
  if (sub && sub.options?.applicationServerKey) {
    const current = new Uint8Array(sub.options.applicationServerKey);
    if (current.length !== key.length || current.some((b, i) => b !== key[i])) {
      await sub.unsubscribe();
      sub = null;
    }
  }
  if (!sub) {
    sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
  }

  const json = sub.toJSON();
  await crmApi.subscribePush({ endpoint: json.endpoint, keys: { p256dh: json.keys.p256dh, auth: json.keys.auth } });
  return 'on';
}

export async function disablePush() {
  if (!pushSupported()) return 'unsupported';
  const reg = await getRegistration();
  const sub = await reg.pushManager.getSubscription();
  if (sub) {
    try {
      await crmApi.unsubscribePush(sub.endpoint);
    } finally {
      await sub.unsubscribe();
    }
  }
  return 'off';
}

// Called on logout so a shared phone stops receiving the previous user's alerts. Never throws.
export async function unsubscribeOnLogout() {
  try {
    if (!pushSupported()) return;
    const reg = await Promise.race([
      navigator.serviceWorker.getRegistration(),
      new Promise((resolve) => setTimeout(() => resolve(null), 3000)),
    ]);
    const sub = await reg?.pushManager.getSubscription();
    if (!sub) return;
    try {
      await crmApi.unsubscribePush(sub.endpoint);
    } catch {
      /* token may already be invalid; the browser-side unsubscribe below still stops delivery */
    }
    await sub.unsubscribe();
  } catch (err) {
    console.warn('Push unsubscribe on logout failed:', err);
  }
}
