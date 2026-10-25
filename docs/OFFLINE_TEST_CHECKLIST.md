# Offline Test Checklist

✅ = verified by an automated test run on 2026-10-25 (Linux, Chrome 155, headless) · 📝 = manual step, not yet run on that platform.

## Automated results (2026-10-25)

| Suite | Command | Result |
|---|---|---|
| Unit: queue, playlists, offline helpers, page layout & validation | `npm test` | 34 / 34 pass |
| All 604 live pages through the app's validator + font signatures | `npm run verify:mushaf` | 604 / 604 valid, fonts 48.0 MB |
| Metadata generator (page starts vs alquran.cloud, line layout) | `npm run build:mushaf-meta` | 604 pages verified, 0 mismatches |
| Reciter mirror equivalence (2:255 and 112:1, audio frames SHA-256) | see audit | 7 / 7 reciters identical |
| Browser 01–04: playlists, queue sync, repeat, failures/persistence | `node tests/browser/0N-*.js` | all pass (unchanged behaviour) |
| Browser 05: Mushaf play/sync, keyboard, Juz/page audio | `node tests/browser/05-mushaf-juz-page.js` | all pass on the new reader |
| Browser 06: offline end to end (real network cut-off, restart, server down) | `node tests/browser/06-offline.js` | 33 / 33 pass |
| Browser 07: responsive (8 sizes × reader, special pages, downloads, home) | `node tests/browser/07-responsive.js` | 102 / 102 pass |
| Browser 08: Downloads UI, reader panels, swipe, backup | `node tests/browser/08-downloads-ui.js` | 24 / 24 pass |

How test 06 cuts the network: Chrome is relaunched on the same profile with `--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1` (every external host fails DNS, including requests from the service worker) and the page is emulated offline (`navigator.onLine === false`). For the last session the local web server is stopped as well.

## Offline audio

- ✅ Download one Surah while connected (via the Surah card button) — status complete, 4/4 files stored, sizes re-checked
- ✅ Disconnect; play the downloaded Surah — plays from a `blob:` URL of the stored file
- ✅ Pause, resume, seek within the local file
- ✅ Continues to the next ayah; next Surah (downloaded) plays offline
- ✅ Undownloaded Surah offline → "… غير محمّلة للاستماع دون اتصال بهذا القارئ"
- ✅ Cancel a download → record and partial files removed
- ✅ One file blocked → Surah marked *failed*, never *complete*; retry → complete
- ✅ Delete a downloaded Surah → record and files removed
- ✅ Restart the browser → download records intact; interrupted downloads shown as failed
- ✅ Download/play/delete from the Downloads page; play switches to the record's reciter
- ✅ Reciters without a verified source are disabled (form) and marked on cards
- 📝 Download a long Surah (Al-Baqarah, 286 files) on a slow mobile connection and watch progress
- 📝 Fill the storage quota (e.g. small-disk device) and confirm the "not enough space" message

## Offline Mushaf

- ✅ Download a page range (+ page 1) and a single page from the reader panel
- ✅ Disconnect; reopen app → last-read page restored and rendered from the device
- ✅ No request to Quran.com / qurancdn while rendering downloaded pages
- ✅ Previous/next between downloaded pages; undownloaded page → clear message + "nearest downloaded page"
- ✅ Bookmark restored after restart
- ✅ Page 604 shows its three Surah headers; page 1 renders its 8-line layout
- ✅ App shell, Mushaf page and audio all work with the web server stopped (service worker)
- ✅ Juz (30 → page 582) and Surah (Al-Kahf → page 293) navigation from bundled metadata
- ✅ Delete a page; summary and badges update
- 📝 Download the full Mushaf (≈ 52 MB) on a phone, then airplane mode and browse at random

## Quran integrity

- ✅ Page boundaries: first verse of all 604 pages identical in Quran.com and alquran.cloud
- ✅ Every page: contiguous verses, no missing word (positions 1…n), one end marker per verse, correct last verse
- ✅ Every empty line explained by a Surah header/basmala (incl. the 21 pages whose next-Surah header is printed on line 15)
- ✅ Validator rejects a page with a missing word, missing end marker, missing line, missing glyph, or wrong page number (unit tests)
- ✅ Visual review of pages 1, 50, 187, 604 at phone and desktop sizes: glyphs from the page font, header frames, short lines centred, no clipping (screenshots in `$TMPDIR/quran-responsive`)
- 📝 Side-by-side comparison of a sample of pages (e.g. 1, 2, 50, 76, 77, 187, 293, 582, 604) with a printed KFGQPC Madinah Mushaf by a qualified reviewer

## Responsive

- ✅ 320×568, 375×812, 430×932, 812×375 (phone landscape), 768×1024, 1024×768, 1440×900, 1920×1080
- ✅ No horizontal overflow (reader, downloads, home); page aspect ratio 0.618 kept; no line overflows; touch targets ≥ 40 px
- ✅ Desktop: page never wider than 700 px; fit-to-screen shows the whole page on 1080 px-tall screens; focus/fullscreen shows the whole page at every size ≥ 600 px wide
- ✅ Swipe right/left turns pages; vertical drag does not
- 📝 Browser zoom 200% on desktop; Android font scaling

## Browsers (manual)

| Browser | Status |
|---|---|
| Chrome desktop (Linux) | ✅ automated (headless) |
| Chrome on Android | 📝 not run — check install prompt, offline audio with screen off |
| Safari on iOS | 📝 not run — check Add to Home Screen, focus mode (no element fullscreen), storage eviction after 7 days unused |
| Edge desktop | 📝 not run (Chromium; expected as Chrome) |
| Firefox desktop | 📝 not run — check `persist()` prompt, FontFace with stored fonts |
