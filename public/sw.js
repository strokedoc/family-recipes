// V's Kitchen service worker: network-first shell + data, cached for offline.
//
// The HTML shell MUST be network-first. It names the content-hashed JS/CSS
// bundle, so serving a stale index.html pins the app to an old bundle — a new
// deploy then needs two reloads to appear, and on an installed iOS PWA that
// means force-quitting the app. Hashed assets are immutable, so they stay
// stale-while-revalidate; only the document that points at them is fetched
// fresh. Offline still works: every network-first path falls back to cache.
//
// Bump VERSION to invalidate old caches on deploy.
const VERSION = 'vs-kitchen-v2'

self.addEventListener('install', (e) => {
  // Precache the shell entry so offline reload works even if the runtime
  // cache never saw a navigation request.
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(['./', './manifest.webmanifest'])))
  self.skipWaiting()
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)

  // GitHub API: never intercept — sync logic owns its own errors.
  if (url.hostname === 'api.github.com') return

  // The app shell: network-first so a deploy is picked up on the next open,
  // cache fallback so it still launches offline.
  if (req.mode === 'navigate' || req.destination === 'document') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone()
          caches.open(VERSION).then((c) => c.put('./', copy))
          return res
        })
        .catch(() => caches.match('./').then((hit) => hit || caches.match(req))),
    )
    return
  }

  // Data files: network-first (freshness), cache fallback (offline reading).
  if (url.pathname.includes('/data/')) {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone()
          caches.open(VERSION).then((c) => c.put(stripQuery(req), copy))
          return res
        })
        .catch(() => caches.match(stripQuery(req))),
    )
    return
  }

  // Everything else (shell, assets, fonts): stale-while-revalidate.
  e.respondWith(
    caches.match(req).then((cached) => {
      const fresh = fetch(req)
        .then((res) => {
          if (res.ok || res.type === 'opaque') {
            const copy = res.clone()
            caches.open(VERSION).then((c) => c.put(req, copy))
          }
          return res
        })
        .catch(() => cached)
      return cached || fresh
    }),
  )
})

// Cache-busting query params would fragment the cache — key data by bare path.
function stripQuery(req) {
  const url = new URL(req.url)
  url.search = ''
  return url.href
}
