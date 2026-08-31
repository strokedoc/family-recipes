// V's Kitchen service worker: offline-first app shell, network-first data.
// Bump VERSION to invalidate old caches on deploy.
const VERSION = 'vs-kitchen-v1'

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
