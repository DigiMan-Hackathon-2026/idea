const SHELL_CACHE = "yeogiseoul-shell-v9";
const OFFLINE_URL = "/offline";
const SUBWAY_OFFLINE_URL = "/subway-offline.html";
const SUBWAY_OFFLINE_SCRIPT = "/subway-offline.js";
// Static screens that read quest text the visitor saved in localStorage.
// Quest HTML itself is never put in Cache Storage.
const QUEST_OFFLINE_URL = "/quest-offline.html";
const QUEST_OFFLINE_SCRIPT = "/quest-offline.js";
const CACHED_SCRIPTS = [SUBWAY_OFFLINE_SCRIPT, QUEST_OFFLINE_SCRIPT];
const SHELL_URLS = [
  OFFLINE_URL,
  SUBWAY_OFFLINE_URL,
  SUBWAY_OFFLINE_SCRIPT,
  QUEST_OFFLINE_URL,
  QUEST_OFFLINE_SCRIPT,
  "/icon.svg",
  "/pwa-icon-192",
  "/pwa-icon-512",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_URLS)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (key) =>
                (key.startsWith("digiman-shell-") ||
                  key.startsWith("yeogiseoul-shell-")) &&
                key !== SHELL_CACHE,
            )
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || event.request.method !== "GET") return;

  if (CACHED_SCRIPTS.includes(url.pathname)) {
    event.respondWith(
      caches.open(SHELL_CACHE).then(async (cache) =>
        (await cache.match(url.pathname)) || fetch(event.request),
      ),
    );
    return;
  }
  if (event.request.mode !== "navigate") return;

  event.respondWith(
    fetch(event.request).catch(async () => {
      const cache = await caches.open(SHELL_CACHE);
      const isSubway = url.pathname === "/subway" || url.pathname === SUBWAY_OFFLINE_URL;
      const isQuestPage = url.pathname.startsWith("/quests/") || url.pathname === QUEST_OFFLINE_URL;
      const offlineUrl = isSubway ? SUBWAY_OFFLINE_URL : isQuestPage ? QUEST_OFFLINE_URL : OFFLINE_URL;
      return (await cache.match(offlineUrl)) || (await cache.match(OFFLINE_URL)) || Response.error();
    }),
  );
});
