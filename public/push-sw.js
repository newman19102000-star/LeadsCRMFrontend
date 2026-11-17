// Web Push handlers, imported into the Workbox-generated service worker (see vite.config.js → workbox.importScripts).
// iOS revokes push permission if a push arrives without a visible notification, so a notification is ALWAYS shown.

self.addEventListener('push', (event) => {
  let data;
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : '' };
  }

  const title = data.title || 'Buildesk CRM';
  const options = {
    body: data.body || 'You have a new update.',
    tag: data.tag || 'crm-notification',
    renotify: true,
    icon: '/pwa-192x192.png',
    badge: '/pwa-64x64.png',
    vibrate: [200, 100, 200],
    data: { url: data.url || '/' },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'dismiss') return;

  const target = new URL(event.notification.data?.url || '/', self.location.origin).href;

  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const existing = windows.find((c) => new URL(c.url).origin === self.location.origin);
    if (existing) {
      try {
        await existing.focus();
      } catch {
        /* focus can be refused; still open the lead in the existing window */
      }
      // The open app handles this message and opens the lead without a full reload.
      existing.postMessage({ type: 'OPEN_URL', url: target });
      return;
    }
    await self.clients.openWindow(target);
  })());
});
