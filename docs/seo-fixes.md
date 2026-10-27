# SEO Fixes

Date: 2026-10-27. Triggered by an external SEO audit tool's report on the live site (`https://omar.qimacore.com/`), which flagged the issues below. This covers what was fixed, what's a hard architectural limit of the current app, and what "top ranking" would actually require beyond these fixes.

## What the audit flagged, and what was done

| Finding | Severity | Fix |
|---|---|---|
| Only very few internal links found; page "seems to be an entry page" | Error | The 8 nav links (`<a class="nav-link">`) had **no `href` at all** — not even `#` — so crawlers saw them as non-links. Added real `href="#<page>"` to each, plus `e.preventDefault()` in `app.js`'s click handler so in-app navigation behavior is unchanged (verified: unit tests still 19/19 pass, logic unchanged otherwise). |
| Reduce number of CSS/JS files | Error | **Attempted, then reverted.** `scripts/build-web.js` initially bundled the local CSS/JS files for the `www/` production output, and this was verified working on a real Android build. It was reverted after merging in a separately-developed offline-download feature (see `docs/mobile-migration-audit.md`'s changelog / git history): that feature's service worker (`sw.js`) precaches every JS/CSS file individually by filename via `cache.addAll()`, which fails entirely (breaking all offline support) if any single named file is missing — exactly what bundling would do. Correctness for the offline feature took priority over this file-count nicety. The 19 local file requests remain as individual `<link>`/`<script>` tags. |
| Page title doesn't match content closely enough | Warning | Title changed from the generic `Qur'an Kareem - القرآن الكريم` to `القرآن الكريم - Qur'an Kareem | المصحف الشريف كاملًا مع التلاوات والتفسير`, matching the H1 and the page's actual content (recitation, tafseer). `<meta name="description">` and Open Graph tags updated to match (previously English-only; the site is Arabic-first, `lang="ar" dir="rtl"`). |
| Only 77 words on the page; "use at least 250" | Error | Added a real, genuine 3-paragraph description of the app's actual features (recitation, tafseer sources, translations, digital Mushaf, Adhkar, search) directly in `index.html`'s home page — static text visible without JS, not keyword-stuffed filler. An `<h2 class="sr-only">` groups it for document structure without visual clutter (a `.sr-only` utility class was added to `styles.css`). |
| No paragraphs detected | Warning | Fixed by the same content addition above (real `<p>` tags). |

## Also added, not explicitly flagged but standard technical SEO

- `robots.txt` (allows all, points to the sitemap) and `sitemap.xml` — neither existed before.
- `<link rel="canonical">` pointing at `https://omar.qimacore.com/`.
- `<meta name="robots" content="index, follow">`.
- JSON-LD `WebApplication` structured data (name, description, free-offer, language).
- `scripts/build-web.js` now also copies `robots.txt`/`sitemap.xml` into `www/`, since that directory is the production deploy output, not just Capacitor's webDir.

## Hard limit this doesn't fix: it's still a single-page app

Every fix above is a real, legitimate improvement, but none of them change the fundamental shape of the app: **one URL, one HTML document, all Quran text/tafseer/translations fetched and rendered client-side via JavaScript after page load.** This is the actual ceiling on "top ranking" potential:

- The sitemap lists exactly one URL, because there's only one. A site like quran.com ranks per-surah, per-ayah, and per-topic because it has hundreds of thousands of individually indexable, individually pre-rendered pages with full Arabic text, translations, and tafseer already in the HTML. This app has none of that — a crawler either executes the JS (Google can, but unreliably and not instantly; most other crawlers/AI answer engines don't) or sees an app shell with three paragraphs of description text and nothing else.
- Competing for high-value queries (e.g. "سورة البقرة", "تفسير آية الكرسي") would require the app to have real, separate, pre-rendered URLs per surah/ayah with the actual Quran text server-rendered into the HTML — a genuine architecture change (static-site generation from the Al Quran Cloud API at build time, or a server-rendering layer), not a configuration fix. That's a significant, separate project, not something folded into this pass.
- None of this is implemented here — flagging it so "SEO is fixed" isn't read as "this will out-rank quran.com," which it won't, on its current architecture.

## Verification

- `npm test` — 19/19 unit tests pass (unchanged by any of these edits).
- At the time bundling was still in place: `node --check` passed on the generated bundle, and a real Android debug build + install + launch showed it executing correctly per `adb logcat` (clean init sequence, correct in-bundle line numbers, no new errors). Kept as evidence the approach itself worked — it just didn't survive contact with the offline feature's requirements.
- Post-revert: `npm run build` produces a flat `www/` again; `npm test` (34/34, including the merged offline test suite) and `npm run verify:mushaf` (604/604 pages) both still pass.
- Not verified: rendered appearance of the new home-page paragraphs and the rewritten `<head>` in an actual browser (no Chromium/`chromium-cli` available in this environment — same gap noted in `docs/mobile-testing.md`). Recommend a quick visual check after deploy.
- Not verified: the live site's actual Lighthouse/Core Web Vitals scores, or re-running the same third-party audit tool against the fixes — those require the fixes to actually be deployed to `https://omar.qimacore.com/` first, which is outside this repo/session.
