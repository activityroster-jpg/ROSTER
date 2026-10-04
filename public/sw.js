/*
 * ActivityRoster offline support (audit A11-1, Part E phase 4).
 * Only one job: when the instructor's schedule can't load because there is no
 * signal, show /offline.html, which reads the week the app saved on this phone
 * the last time it was online. No signed-in page is ever cached here.
 */
const CACHE = "ar-offline-v1";
const SHELL = ["/offline.html", "/offline.js"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET" || req.mode !== "navigate") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith("/portal")) return;
  event.respondWith(
    fetch(req).catch(() => caches.match("/offline.html").then((r) => r || new Response("You're offline.", { headers: { "Content-Type": "text/plain" } }))),
  );
});
