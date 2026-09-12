/* ================================================================
   Mindfulness Play — offline "memory" (service worker)
   ----------------------------------------------------------------
   What this does, in plain words:
   • The FIRST time the app is opened with a connection, it quietly
     saves the whole app + every picture onto the phone.
   • After that, the app opens and plays with NO internet at all —
     on a plane, in the mountains, in a waiting room. This is the
     "works fully offline" selling point.

   How updates reach players (so your future changes aren't stuck):
   • The app CODE (index.html) is fetched fresh whenever the phone
     is online, and only falls back to the saved copy when offline.
     So editing index.html and publishing = players get it next time
     they open online. No version bump needed for code-only changes.
   • The PICTURES are saved once and never re-downloaded (fast + low
     data). So if you ever CHANGE or ADD an image, bump CACHE_VERSION
     below by one (v1 -> v2). That, and only that, tells every phone
     to refresh its saved pictures. Code-only changes need no bump.
   ================================================================ */

/* 👉 Bump this ONLY when card/interface images change or are added. */
const CACHE_VERSION = 'v1';
const CACHE_NAME = 'cozy-cat-' + CACHE_VERSION;

/* The app shell — the few files needed to show *something* offline.
   These are cached strictly on install; if one fails the install fails,
   so keep this list small and essential. */
const APP_SHELL = [
  './',
  'index.html',
  'manifest.webmanifest',
  'assets/fonts/quicksand-latin.woff2',
  'assets/interface/meditating-cat.png',   // welcome screen
  'assets/interface/loading-mouse.png',    // loading screen
  'assets/background/background-1-600dpi.jpg',
];

/* Everything else — saved in the background, best-effort. A single
   missing file here never breaks the install. */
const ASSETS = [
  'assets/buttons/button-appearance.png',
  'assets/buttons/button-hint.png',
  'assets/buttons/button-paw.png',
  'assets/buttons/button-play.png',
  'assets/buttons/button-undo.png',
  'assets/buttons/new-game-blank-watercolor.png',
  'assets/buttons/popup-done.png',
  'assets/buttons/popup-new-game.png',
  'assets/buttons/popup-return.png',
  'assets/card-back/card-back2.png',
  'assets/cards/02-clubs.png','assets/cards/02-diamonds.png','assets/cards/02-hearts.png','assets/cards/02-spades.png',
  'assets/cards/03-clubs.png','assets/cards/03-diamonds.png','assets/cards/03-hearts.png','assets/cards/03-spades.png',
  'assets/cards/04-clubs.png','assets/cards/04-diamonds.png','assets/cards/04-hearts.png','assets/cards/04-spades.png',
  'assets/cards/05-clubs.png','assets/cards/05-diamonds.png','assets/cards/05-hearts.png','assets/cards/05-spades.png',
  'assets/cards/06-clubs.png','assets/cards/06-diamonds.png','assets/cards/06-hearts.png','assets/cards/06-spades.png',
  'assets/cards/07-clubs.png','assets/cards/07-diamonds.png','assets/cards/07-hearts.png','assets/cards/07-spades.png',
  'assets/cards/08-clubs.png','assets/cards/08-diamonds.png','assets/cards/08-hearts.png','assets/cards/08-spades.png',
  'assets/cards/09-clubs.png','assets/cards/09-diamonds.png','assets/cards/09-hearts.png','assets/cards/09-spades.png',
  'assets/cards/10-clubs.png','assets/cards/10-diamonds.png','assets/cards/10-hearts.png','assets/cards/10-spades.png',
  'assets/cards/ace-of-clubs.png','assets/cards/ace-of-diamonds.png','assets/cards/ace-of-hearts.png','assets/cards/ace-of-spades.png',
  'assets/cards/jack-of-clubs.png','assets/cards/jack-of-diamonds.png','assets/cards/jack-of-hearts.png','assets/cards/jack-of-spades.png',
  'assets/cards/queen-of-clubs.png','assets/cards/queen-of-diamonds.png','assets/cards/queen-of-hearts.png','assets/cards/queen-of-spades.png',
  'assets/cards/king-of-clubs.png','assets/cards/king-of-diamonds.png','assets/cards/king-of-hearts.png','assets/cards/king-of-spades.png',
  'assets/icon/apple-touch-icon.png',
  'assets/icon/favicon-32.png',
  'assets/icon/icon-192.png',
  'assets/icon/icon-512.png',
  'assets/interface/after-losing-cat.png',
  'assets/interface/foundation-paw.png',
  'assets/interface/newgame-cat.png',
  'assets/interface/paw-licking-cat.png',
  'assets/interface/prompt-cat.png',
  'assets/interface/prompt-mouse.png',
  'assets/interface/stretching-cat.png',
];

/* ---- install: save the app onto the phone ---- */
self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    // Essential shell must all succeed.
    await cache.addAll(APP_SHELL);
    // The rest is best-effort: never let one missing file abort install.
    await Promise.allSettled(ASSETS.map((url) => cache.add(url)));
    // Take over as soon as we're ready.
    self.skipWaiting();
  })());
});

/* ---- activate: throw away any older saved version ---- */
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(
      names.filter((n) => n.startsWith('cozy-cat-') && n !== CACHE_NAME)
           .map((n) => caches.delete(n))
    );
    await self.clients.claim();
  })());
});

/* ---- fetch: serve the app, online or off ----
   • The page itself (navigation): try the network first so a freshly
     published app reaches players, fall back to the saved copy offline.
   • Everything else (pictures, font): use the saved copy first (instant,
     no data), fall back to the network the first time it's needed. */
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // don't touch other sites

  const isPage = req.mode === 'navigate' ||
                 (req.headers.get('accept') || '').includes('text/html');

  if (isPage) {
    // Network-first for the app code, with a fast fallback to cache.
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        const cache = await caches.open(CACHE_NAME);
        cache.put('index.html', fresh.clone());
        return fresh;
      } catch (e) {
        const cache = await caches.open(CACHE_NAME);
        return (await cache.match(req)) ||
               (await cache.match('index.html')) ||
               (await cache.match('./'));
      }
    })());
    return;
  }

  // Cache-first for pictures / font.
  event.respondWith((async () => {
    const cached = await caches.match(req);
    if (cached) return cached;
    try {
      const fresh = await fetch(req);
      if (fresh && fresh.ok) {
        const cache = await caches.open(CACHE_NAME);
        cache.put(req, fresh.clone());
      }
      return fresh;
    } catch (e) {
      return cached; // undefined if truly unavailable
    }
  })());
});
