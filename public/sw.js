// Service worker de Pousse : page hors ligne et rappels (notifications push sans contenu).
const CACHE = "pousse-v1";
const OFFLINE = "/hors-ligne";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll([OFFLINE, "/icon-192.png", "/badge-96.png"])));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

// Pages : toujours le réseau (données fraîches) ; la page hors ligne seulement si le réseau manque.
self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return;
  event.respondWith(fetch(event.request).catch(() => caches.match(OFFLINE)));
});

// La notification arrive vide : on va chercher le texte avec la session de la personne.
self.addEventListener("push", (event) => {
  event.waitUntil(
    (async () => {
      let msg = { title: "Pousse", body: "Tes quêtes du jour t'attendent.", url: "/fil" };
      try {
        const res = await fetch("/api/rappel", { credentials: "include", cache: "no-store" });
        if (res.ok) msg = { ...msg, ...(await res.json()) };
      } catch {
        /* hors ligne : texte par défaut */
      }
      if (self.navigator.setAppBadge) self.navigator.setAppBadge(1).catch(() => {});
      await self.registration.showNotification(msg.title, {
        body: msg.body,
        icon: "/icon-192.png",
        badge: "/badge-96.png",
        tag: "rappel-du-jour",
        lang: "fr",
        data: { url: msg.url },
      });
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/fil";
  event.waitUntil(
    (async () => {
      if (self.navigator.clearAppBadge) self.navigator.clearAppBadge().catch(() => {});
      const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const w of wins) {
        if (new URL(w.url).origin === self.location.origin) {
          await w.focus();
          return w.navigate(url);
        }
      }
      return self.clients.openWindow(url);
    })(),
  );
});
