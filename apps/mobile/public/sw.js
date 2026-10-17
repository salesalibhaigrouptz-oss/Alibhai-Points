const CACHE_NAME = "alibhai-points-shell-v1";
const APP_SHELL = ["/", "/manifest.json"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const shellResponse = await fetch("/");
      if (!shellResponse.ok) {
        throw new Error("Unable to fetch the application shell");
      }

      const html = await shellResponse.clone().text();
      await cache.put("/", shellResponse);

      const shellAssets = [...html.matchAll(/(?:src|href)=["']([^"']+)["']/g)]
        .map((match) => new URL(match[1], self.location.origin))
        .filter(
          (url) =>
            url.origin === self.location.origin &&
            (url.pathname.startsWith("/_expo/") ||
              url.pathname.startsWith("/assets/") ||
              url.pathname === "/manifest.json")
        )
        .map((url) => url.pathname + url.search);

      await cache.addAll([...new Set([...APP_SHELL, ...shellAssets])]);
      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("alibhai-points-shell-") && key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (
    request.method !== "GET" ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith("/api/")
  ) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => {
        const shell = await caches.match("/");
        if (shell) return shell;
        throw new Error("The application shell is not available offline");
      })
    );
    return;
  }

  if (
    APP_SHELL.includes(url.pathname) ||
    url.pathname.startsWith("/_expo/") ||
    url.pathname.startsWith("/assets/")
  ) {
    event.respondWith(
      caches.match(request).then(async (cached) => {
        if (cached) return cached;
        const response = await fetch(request);
        if (response.ok) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put(request, response.clone());
        }
        return response;
      })
    );
  }
});
