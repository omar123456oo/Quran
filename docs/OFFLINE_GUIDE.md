# Offline Guide — القراءة والاستماع دون اتصال

How the offline features work, how to run and install the app, and what browsers can and cannot guarantee. Findings that led to these choices are in [OFFLINE_AUDIT.md](OFFLINE_AUDIT.md); test steps and results are in [OFFLINE_TEST_CHECKLIST.md](OFFLINE_TEST_CHECKLIST.md).

## What works offline

| Feature | Offline? | Condition |
|---|---|---|
| App interface (all pages, settings, playlists, Adhkar) | Yes | After one visit over HTTPS or `localhost` (service worker installed) |
| Surah list (home), Surah/Juz → page navigation in the Mushaf | Yes | Built into `mushaf-meta.js` |
| Mushaf pages | Yes | Pages downloaded from the reader or the Downloads page |
| Surah audio | Yes | Surah downloaded for that reciter |
| Page/Juz audio ("play this page") | Yes | Every Surah covering that page/Juz downloaded for the reciter |
| Bookmarks, last-read page and ayah, reading settings | Yes | Stored on the device (localStorage) |
| Text reader (القراءة), search, tafseer, translations | No | Need the network; a clear error is shown |

## Using it

**Download a Surah for listening**
- On the home page, every Surah card has a download button for the *currently selected reciter*. Press it and confirm. The button shows progress (%), then a check mark. Press it while downloading to cancel, or after a failure to retry.
- Or open **التنزيلات** (Downloads) → *السور الصوتية*, choose Surah and reciter, press *تنزيل*.
- Downloaded Surahs play automatically from the device, online or offline. *تشغيل* in the Downloads list switches to that Surah's reciter.
- Delete from the Downloads list. Cancel deletes partial files; a failed download keeps finished files so *retry* resumes.
- Not downloadable: **محمود علي البنا** (only available as whole-Surah files on a server without CORS) and **سعد الغامدي** (the API has no audio for this reciter at all — it also cannot be streamed; see the audit).

**Download Mushaf pages**
- In the reader, press <i>download</i> (⬇) for: this page, this Juz, or the whole Mushaf (≈ 52 MB). The size is shown before you confirm.
- Downloads page → *صفحات المصحف*: whole Mushaf, a Juz, a Surah's pages, or a page range; delete a Juz, a range, or everything.
- Page 1 is always stored with any download: its font draws the basmala on every Surah start.
- A page that is not downloaded shows a message (never a blank page) with a button to the nearest downloaded page.

**Reading**
- Next/previous: buttons, side arrows on wide screens, ← / → keys (or PageDown / PageUp), horizontal swipe on touch screens (swipe right = next page, as in a right-to-left book). Swipes are ignored while text is selected, while zoomed in, or on buttons.
- Index (☰): Surahs, Juz, bookmarks, go to page. Bookmark (🔖) toggles the current page.
- Reading settings (⚙): fit to screen / fill width, page tone, show/hide the play bar, highlight the ayah being recited.
- Fullscreen (⛶ or the F key). On iPhone Safari, which has no element fullscreen, a focus mode hides the site chrome instead.
- Selecting and copying words copies their Uthmani text (not the font's private glyph codes).

**Backup** — Downloads → *نسخة احتياطية*: export bookmarks, last-read positions and reading settings to a JSON file; import it on another browser/device. Downloaded files are not part of the backup.

## Storage strategy

| Data | Where | Key |
|---|---|---|
| Ayah MP3 files | Cache API `quran-audio-v1` | mirror URL, e.g. `https://everyayah.com/data/Alafasy_128kbps/112001.mp3` |
| Audio download records (status, sizes, ayah list) | IndexedDB `quran-offline` → `resources` | `audio:<reciter>:<surah>` |
| Mushaf page fonts (KFGQPC V1, WOFF2) | Cache API `quran-mushaf-v1` | font URL |
| Mushaf page layout (glyph codes, Uthmani text, lines) | IndexedDB `quran-offline` → `pages` | page number |
| App shell (HTML/CSS/JS/icons) | Cache API `quran-shell-v1` | — |
| UI fonts (Font Awesome, Amiri) | Cache API `quran-static-v1` | — |
| Surah list / meta API responses | Cache API `quran-api-v1` | — |
| Bookmarks, last read, reading settings, player state | localStorage | existing keys |

Binary files are stored as `Blob`s in the Cache API — never as JSON or Base64. Audio plays from a `blob:` URL created from the stored file (revoked when the next ayah starts), and page fonts are loaded with the `FontFace` API from stored bytes, so **offline playback and reading do not depend on the service worker**.

**Integrity rules**
- Audio: each file must return HTTP 200, an audio content type, a body whose length equals `Content-Length`, and an MP3 signature; the API's own file number must equal the expected global ayah number. After all files are stored, every file is read back from the cache and its size compared before the Surah is marked *complete*. A failed or interrupted download is never marked complete; on next start, interrupted downloads show as failed.
- Mushaf: each page must pass `MushafCore.validatePage` — correct first and last verse for that page number, no gaps between verses, every verse's words numbered 1…n with one end-of-verse marker last, every empty line explained by a Surah header/basmala. The font must be a WOFF2 file of the advertised size, re-read from the cache, before the page record is written.
- At startup the app re-checks that "complete" items still exist (browsers can evict storage) and downgrades any that do not.

**Service worker (`sw.js`)** — precaches the shell; same-origin requests are network-first with the cached copy as fallback (so updates arrive immediately when online); icon/UI fonts are cache-first; only the Surah list and meta API responses are cached. It never stores audio or Mushaf data and never deletes the download caches. **When you deploy changed files, bump `VERSION` in `sw.js`** so the new shell is precached and old shell caches are removed.

## Running, installing, and testing the PWA

```bash
npm start                 # python3 -m http.server 8000  → http://localhost:8000
npm test                  # unit tests (queue, playlists, offline helpers, page layout/validation)
npm run test:browser      # Chrome-driven tests 01–08 (needs `npm start` running and internet access)
npm run verify:mushaf     # validate all 604 live pages with the app's validator
npm run build:mushaf-meta # regenerate mushaf-meta.js from the sources (verifies all pages)
```

- Service workers need a **secure context**: `https://…` in production, or `http://localhost` / `http://127.0.0.1` in development. On a plain `http://` LAN address the app still works online, and downloads still work, but the app shell is not available offline. The Downloads page shows whether offline mode is active.
- Install: Chrome/Edge (desktop & Android) show an install button in the address bar / menu; iOS Safari: Share → *Add to Home Screen*.
- Manual offline test: load the app once online, download something, then use DevTools → Network → *Offline* (or airplane mode) and reload. The automated test `tests/browser/06-offline.js` does this for real: it restarts Chrome with every external host unresolvable and finally with the local server stopped.

## Sources, edition and attribution

- **Mushaf:** King Fahd Glorious Qur'an Printing Complex (مجمع الملك فهد لطباعة المصحف الشريف), Madinah Mushaf, Ḥafṣ ʿan ʿĀṣim, 1405 AH layout — 604 pages, 15 lines (8 on pages 1–2). Page layout and glyph codes from the Quran.com API v4 (`code_v1`); fonts: KFGQPC V1 page fonts served by Quran.com (`static.qurancdn.com`). The page is drawn word by word from these glyphs on the printed lines — it is not reflowed text. Surah header frames and the page frame are app decoration around the text.
- **Page numbers** are those of this edition; other editions number pages differently.
- **Audio:** recitations as published by alquran.cloud / Islamic Network; offline copies come from everyayah.com (identical audio frames, verified per reciter — see the audit).
- **Licensing:** the KFGQPC fonts are distributed by the Complex for free use without modification; Quran.com and everyayah.com content is used as published. Review each provider's current terms before a commercial or high-traffic deployment. Quran.com now offers an authenticated Content API; the public v4 endpoint used here may change.

## Browser limitations

- Browser storage is **not permanent**. Browsers may evict it under storage pressure (Safari can remove data of sites not used for ~7 days unless the app is installed to the home screen) and users can clear it. *طلب حماية التنزيلات* asks for persistent storage (`navigator.storage.persist()`); Chrome grants it silently based on engagement, Firefox asks the user, Safari mostly ignores it.
- Downloads are stored inside the browser, not as files you can see in a file manager, and are per browser/profile.
- Downloads run only while the page is open; there is no background download. Closing the tab marks an active download as interrupted (retry resumes).
- Background audio with the screen off depends on the platform (works in Chrome Android; iOS may pause web audio).
- Quotas differ widely (Chrome: a share of free disk; Safari: smaller, may prompt). The app checks `navigator.storage.estimate()` before downloading and reports "not enough space" on quota errors.
- Private/incognito windows may block or wipe storage when closed.
