// Service worker for The Circle — handles Web Push notifications that fire
// even when the tab/app is closed (as long as the browser + OS allow
// background push, which is standard on Chrome/Edge/Firefox/Android and
// supported on iOS 16.4+ for installed/home-screen PWAs).

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: 'The Circle', body: event.data ? event.data.text() : 'You have a new update!' };
  }

  const title = data.title || '🔥 The Circle';
  const options = {
    body: data.body || 'You have a new update!',
    icon: 'https://cdn-icons-png.flaticon.com/512/2589/2589175.png',
    badge: 'https://cdn-icons-png.flaticon.com/512/2589/2589175.png',
    vibrate: [200, 100, 200],
    tag: 'circle-match'
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow('/');
    })
  );
});
