# Audit: Offline Audio & Mushaf (Phase 1)

Date: 2026-10-25. Scope: the existing app as of commit `588bf0f`, before the offline work.

## Architecture as found

- Single-page app: `index.html` + 16 global-script modules (no bundler, no framework). `App` (app.js) routes between `.page` sections; modules are plain objects on `window`.
- Data: `APIService` (api-service.js) wraps `https://api.alquran.cloud/v1` with an in-memory `Map` cache only (lost on reload).
- Audio: `AudioPlayer` (audio-player.js) is a solid engine — one `<audio>`, a load-token guard against stale async results, de-duplicated `ended`, one retry, failure skipping. It plays **one MP3 per ayah** from `cdn.islamic.network`; a queue item (Surah / page / Juz) is resolved to a list of ayah files. State lives in `PlaybackStore` (pub/sub) and `PlayerState` (localStorage `quran_player_v1`). 19 unit tests (`tests/queue.test.js`) and 5 CDP browser scripts cover it.
- Mushaf: `DigitalMushaf` (digital-mushaf.js) shows one remote page image per page and fetches the page's ayahs from alquran.cloud for the header. Bookmarks (`mushaf_bookmarks`) and the last page (`mushaf_last_page`) are in localStorage.
- No `manifest.json`, no service worker, no IndexedDB, no offline handling of any kind.

## Defects and limitations found

| # | Finding | Evidence |
|---|---------|----------|
| 1 | **All three Mushaf page image sources return HTTP 404.** The reader always ends in its fallback: a plain reflowed text list, not a Mushaf page. | `curl -I` on searchtruth.com, surahquran.com, quranwbw.com URLs from `getPageImageUrl()` |
| 2 | **Reciter "سعد الغامدي" (`ar.saadalghamadi`) can never play.** It is not an audio edition in the API; the API silently returns a text edition with no `audio` field. | `GET /v1/ayah/2:255/ar.saadalghamadi` → edition `quran-uthmani-quran-academy`; absent from `/v1/edition?format=audio` |
| 3 | The audio CDN `cdn.islamic.network` sends **no CORS headers** (preflight → 403). A page cannot read or verify those bytes with `fetch()`, so they cannot be stored as verified offline files. Opaque (no-cors) caching is unusable: unverifiable, and Chrome pads each opaque entry to ~7 MB of quota. | `curl -H Origin: …` on GET and OPTIONS |
| 4 | Every Mushaf page load and every Surah/Juz jump needs the network (alquran.cloud); there is no offline mapping of Surah/Juz → page. | digital-mushaf.js `displayPage`, `goToSurahPage`, `goToJuzPage` |
| 5 | Mushaf markup is almost entirely inline styles; `min-height: 800px` on the page container and fixed-width controls hurt small screens. | digital-mushaf.js |
| 6 | Stale duplicate `js/` folder (older copies of 10 modules) not referenced by `index.html`. | `diff`, `index.html` script tags |

## Source verification done for the new design

**Audio mirror (same recordings, CORS-enabled).** `everyayah.com/data/<folder>/SSSAAA.mp3` sends `Access-Control-Allow-Origin: *`. For each of the 7 verse-by-verse reciters, 2:255 and 112:1 were downloaded from both the app's current URL and the mirror; after stripping ID3 tags the audio frames are **byte-identical** (SHA-256):

| App edition | Mirror folder |
|---|---|
| ar.alafasy | Alafasy_128kbps |
| ar.abdulbasitmurattal | Abdul_Basit_Murattal_192kbps |
| ar.minshawi | Minshawy_Murattal_128kbps |
| ar.husary | Husary_128kbps |
| ar.shaatree | Abu_Bakr_Ash-Shaatree_128kbps |
| ar.abdurrahmaansudais | Abdurrahmaan_As-Sudais_192kbps |
| ar.mahermuaiqly | Maher_AlMuaiqly_64kbps (the app's "128" URL already serves this 64 kbps encoding) |

Online streaming keeps using the original URLs; the mirror is used only for downloads. Not downloadable (no verified CORS source): `ar.mahmoudalialbanna` (one file per Surah on the non-CORS CDN) and `ar.saadalghamadi` (finding 2).

**Mushaf source.** King Fahd Glorious Qur'an Printing Complex (KFGQPC) Madinah Mushaf, Hafs ʿan ʿĀṣim, 1405 AH layout, 604 pages × 15 lines, as published by Quran.com:
- layout + glyph codes: `api.quran.com/api/v4/verses/by_page/N` (`code_v1`, `line_number`, `text_uthmani`) — CORS `*`
- per-page KFGQPC V1 fonts: `static.qurancdn.com/fonts/quran/hafs/v1/woff2/pN.woff2` — CORS `*`

Each word is drawn with its own glyph from that page's font, on the line where it appears in print, so the page is reproduced rather than reflowed. A full sweep of all 604 pages (script: `tools/build-mushaf-meta.py`) found:
- the first verse of every page is identical in Quran.com and alquran.cloud (0 mismatches), so "play this page" audio and the displayed page agree;
- every empty line is a Surah header or basmala. On 21 pages (76, 207, 331, …, 594) the next Surah's header sits on line 15 and its basmala on line 1 of the next page, as in print;
- full Mushaf download ≈ 48.0 MB of fonts + ≈ 29.3 MB of page data (uncompressed).

Quran.com's image set (`files.quran.app`) and KSU images send no CORS headers, so they were not used.

## Decisions

1. Audio files: Cache API (`quran-audio-v1`), keyed by the mirror URL; metadata in IndexedDB. Playback uses `blob:` object URLs, so offline audio does not depend on the service worker.
2. Mushaf: compact page data in IndexedDB, fonts in Cache API (`quran-mushaf-v1`), loaded with the `FontFace` API.
3. Service worker only for the app shell and two small API responses (Surah list, meta). It never caches audio/fonts on its own and never deletes download caches.
4. Small existing state (bookmarks, last page) stays in localStorage — it already works offline; an export/import backup is added.
