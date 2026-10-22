# Mobile Migration Audit

Date: 2026-10-22
Scope: Phase One audit prior to Capacitor conversion of the existing web app to Android/iOS.

## 1. Project type and entry point

- Plain static HTML/CSS/JavaScript app. No bundler, no framework, no build step.
- Entry point: `index.html` at the project root. All 16 app scripts and 3 stylesheets are loaded directly via `<script src="...">` / `<link href="...">` tags, in a fixed order that later files depend on (globals set by earlier scripts).
- Dev server: `npm start` → `python3 -m http.server 8000`. No compilation, minification, or asset pipeline exists today.
- `package.json` is minimal and had one leftover issue: a `"git": "^0.1.5"` npm dependency that is never `require`d anywhere, was never installed (`node_modules/` does not exist), and `package-lock.json`'s root `name` is literally `"OLD version"` — a pre-existing artifact unrelated to this migration. Flagged for removal when `package.json` is next touched (not yet removed as of this audit).
- Node v22.23.1 / npm 12.1.0 are available on this machine. No Java, no Android SDK, no Xcode (expected on Linux) were present before this migration (now being installed separately for the Android build, see §9).

## 2. Screens, navigation, and workflows

Single-page app; `app.js` swaps `.page` divs, no URL routing (no `history.pushState`, no hash routing). Pages, all defined in `index.html`:

1. **Home** (`homePage`) — Surah / Juz / Page tab list.
2. **Surah reading** (`surahPage`) — Quran text, verse-by-verse, with follow-playback toggle.
3. **Digital Mushaf** (`mushafPage`) — paginated Quran page images (`digital-mushaf.js`).
4. **Playlists & queue** (`playlistsPage`) — now-playing, queue, playlists, picker (`playlists.js`, `playlists-ui.js`, `play-queue.js`).
5. **Adhkar** (`adhkarPage`) — categorized remembrance texts (`adhkar.js`).
6. **Bookmarks** (`bookmarksPage`) — saved ayahs (`bookmarks.js`).
7. **Islamic resources** (`resourcesPage`) — outbound links to external sites (`islamic-resources.js`).
8. **Settings** (`settingsPage`) — reciter/translation/tafseer defaults, theme (`settings.js`).
9. **Search** (`searchPage`) — full-Quran text search (`search.js`).

Sticky bottom audio player (`audioPlayerContainer`) persists across all pages, plus two modals (Tafseer, Reciter selection).

**No authentication, no login, no user accounts, no session, no backend of its own anywhere in the app.** This is a fully anonymous, public-content app. This materially simplifies the API-integration phase — there is no token/session/logout/unauthorized-handling work needed because none of that exists.

## 3. API integration

- Single backend dependency: the public **Al Quran Cloud API**, `https://api.alquran.cloud/v1`, hardcoded in `api-service.js:7` as `baseURL`. Used for Surah/Ayah/Juz/Page text, tafseer, translations, search, and the list of editions (reciters/translations/tafseer sources).
- All requests are plain `fetch()` GETs, already HTTPS, no API key, no custom headers, no credentials. In-memory `Map` cache only (cleared on reload).
- **Audio** (`audio-player.js`) does not hardcode a CDN URL — it plays whatever `audio` URL the Al Quran Cloud API returns for a given ayah/edition, and defensively validates it with `/^https:\/\//.test(...)` before ever assigning it to `<audio>.src` (`audio-player.js:187,202`). No mixed-content risk.
- `digital-mushaf.js` hardcodes three *image* CDNs for mushaf page scans, all already `https://` (quranwbw.com, searchtruth.com, surahquran.com) — no action needed for HTTPS, but these are third-party, non-API-contracted image hosts with no documented SLA; existing defect (not migration-caused), worth noting for future resilience work.
- `islamic-resources.js` renders outbound `<a target="_blank" rel="noopener noreferrer">` links to 8 external Islamic websites — simple browser navigation, not API calls.
- No CORS issue exists or will exist: this API has no cookie/credential coupling and is designed for arbitrary client consumption; a Capacitor WebView origin (`https://localhost` or `capacitor://localhost` depending on platform) talking to `api.alquran.cloud` is the same shape of cross-origin public GET any browser already does today. **No backend changes are required.**

## 4. Browser-specific APIs / mobile-WebView risk areas

- `localStorage` used in `app.js`, `settings.js`, `bookmarks.js`, `digital-mushaf.js`, `playback-store.js` — all for local preferences, bookmarks, and playback/queue state. No sensitive data (no tokens/credentials exist to store). Capacitor's WebView supports `localStorage` identically; no migration needed, but see §7 for persistence-survives-reinstall caveats.
- `sessionStorage`: not used anywhere (grep found none beyond the two storage greps above returning the same five files, which are all `localStorage`).
- Native `<audio>` element drives all playback — works in Capacitor's WebView, but background/lock-screen audio behavior, and interruption handling (phone calls, other apps) needs on-device verification; this is the one real estate-review item.
- `window.open` / `target="_blank"`: used only for the 8 outbound resource links. Inside a Capacitor WebView these will try to open as if navigating the app's own WebView unless intercepted — needs a `Browser` plugin (system browser) handler so users aren't trapped in-app on an external site with no way back except the OS back gesture.
- No `window.location`-based auth redirects, no cookies set by this app anywhere (grep for `document.cookie` found none), no file upload/download code paths exist in the app.
- No hardcoded `localhost`/dev-only API URLs exist — the only `baseURL` is the production public API, already used in dev and would stay identical in a shipped app. Nothing to parameterize per-environment.

## 5. Tests and existing build

- `npm test` → `node --test tests/*.test.js`: **19/19 passing** (play-queue/playlist logic, pure unit tests, no DOM/network).
- `npm run test:browser` → 5 CDP-driven browser smoke scripts under `tests/browser/`. **Not runnable on this machine**: no Chrome/Chromium binary is installed (`which chromium chromium-browser google-chrome` → none found). Pre-existing environment gap, not caused by this migration; flagged, not fixed, unless the user wants a Chromium install added to the toolchain work already underway for Android.
- No existing CI config found in the repo.

## 6. Secrets / security scan

- No API keys, tokens, secrets, or credentials found anywhere in the client code (expected — the Al Quran Cloud API requires none).
- No `eval(`, no dynamic `<script>` injection, no `innerHTML` assignment of unsanitized remote content was specifically checked yet in depth for XSS during the audit pass (API responses are inserted into the DOM for Quran/tafseer text) — called out as a security-review item in the plan, not confirmed broken, just not yet verified safe.
- `rel="noopener noreferrer"` is already correctly set on the one place external links render (`islamic-resources.js`) — good existing practice.

## 7. Pre-existing defects noted (not migration-caused)

Recorded separately per the audit brief, left as-is unless the user asks otherwise:

1. `package.json`/`package-lock.json` carry a dead `"git": "^0.1.5"` dependency (never installed, never required). Will be removed when `package.json` is next edited for Capacitor deps.
2. `digital-mushaf.js` depends on three unaffiliated third-party image hosts for page scans with no fallback-failure UX beyond the existing `catch` chain — fine today, but worth a backlog note.
3. No Chromium/Chrome on this dev machine, so `npm run test:browser` has presumably never been run in this exact environment.
4. An earlier, unexecuted reorg plan existed at `docs/superpowers/plans/2026-10-22-project-reorganization.md` (move JS→`src/`, CSS→`css/`, docs→`docs/`). Per user decision, that reorg is **not** being executed as part of this migration — only its one safe, already-verified sub-step (deleting the stale duplicate `js/` folder) was applied, independently, as a zero-risk cleanup (commit `41e641d`).

## 8. Environment for Android/iOS build

- Android: no Java/Android SDK was present; installation (user-local, no sudo, JDK 21 + SDK platform 34/35 + build-tools) is in progress in parallel with this audit.
- iOS: this is a Linux machine. No Xcode, no macOS. iOS platform/config work can be fully prepared (bundle ID, `Info.plist`-level settings via Capacitor config, permissions docs) but cannot be built, simulated, signed, or archived here. That requires a Mac or a cloud Mac build service, documented in `docs/mobile-build-and-release.md`.
