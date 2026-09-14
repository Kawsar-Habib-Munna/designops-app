// FLOW 53 — ইচ্ছাকৃতভাবে ন্যূনতম service worker। শুধু push notification আর
// notification click হ্যান্ডল করে — কোনো offline asset caching নেই, যাতে
// পুরনো JS/CSS ব্রাউজারে আটকে থেকে stale ডিপ্লয়মেন্ট দেখানোর ক্লাসিক PWA
// সমস্যাটা এড়ানো যায়।

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let data = { title: 'FLOW 53', body: '', link: '/dashboard' };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch {
    // JSON না হলে টেক্সট হিসেবেই দেখানো হবে
    if (event.data) data.body = event.data.text();
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/flow53-logo.svg',
      badge: '/flow53-logo.svg',
      data: { link: data.link },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const link = event.notification.data?.link || '/dashboard';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(link) && 'focus' in client) return client.focus();
      }
      for (const client of clientList) {
        if ('focus' in client && 'navigate' in client) {
          client.focus();
          return client.navigate(link);
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(link);
    }),
  );
});
