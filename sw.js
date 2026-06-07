/* Service Worker – Offline-Betrieb (PWA).
   Strategie: network-first mit Cache-Fallback.
   So bekommt das Gerät online stets aktuelle Fragen, funktioniert aber offline weiter,
   sobald die Seite einmal geladen wurde. Bei Inhalts-Updates CACHE-Version erhöhen. */
const CACHE = "quiz-turnier-v1";
const ASSETS = [
  "./", "index.html", "styles.css", "app.js", "data.js",
  "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png"
];

self.addEventListener("install", (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).catch(() => {}));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(e.request).then((hit) => hit || caches.match("index.html")))
  );
});
