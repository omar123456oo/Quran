# Project Folder Reorganization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the flat QURAN kareem project root into `src/`, `css/`, `docs/`, `tests/` folders, update every path reference that breaks as a result, and remove the stale duplicate `js/` folder.

**Architecture:** This is a mechanical file-move + reference-fix task, not new logic. All 16 app `.js` files move into `src/`, all 3 `.css` files move into `css/`, all 8 report/doc files (`.md` + the one `.html` report) move into `docs/`. `index.html` stays at the project root (the dev server and the browser tests depend on `GET /index.html` at the root). The stale `js/` folder (older, unused duplicates of 10 of the 16 files, confirmed byte-different and not referenced by `index.html`) is deleted. Every task ends with a verification step (`npm test`, a grep for dangling old-path references, or a manual page load) so a broken reference is caught immediately rather than discovered later.

**Tech Stack:** Static HTML/CSS/JS app, Node's built-in `node:test` runner, a small CDP-based browser test harness in `tests/browser/`.

**Spec:** This plan's Goal/Architecture sections above serve as the spec; the user approved scope via a clarifying question ("Full reorganization: restructure into src/, css/, docs/, tests/ style folders and update index.html references accordingly").

## Global Constraints

- `index.html` must remain at the project root (dev server `python3 -m http.server 8000` and all `tests/browser/*.js` scripts do `goto('http://127.0.0.1:8000/index.html')`).
- Script load order in `index.html` must be preserved exactly — several scripts depend on globals defined by earlier `<script>` tags.
- `npm test` (`node --test tests/*.test.js`) must pass after the move.
- No file content changes other than path references — this is a move, not a rewrite.
- The stale `js/` folder is deleted, not merged — it is confirmed unused and out of date (verified via `diff` against the root copies and absence from `index.html`'s script tags).

## Review Focus

- A script tag path updated to the wrong subfolder (e.g. a `.css` file pointed at `src/` instead of `css/`) — the page loads with no styling; caught by Task 4's manual page-load check.
- `tests/queue.test.js`'s two `require(...)` calls not updated to the new `src/` path — `npm test` fails immediately with `MODULE_NOT_FOUND`; caught by Task 3's verification step.
- `playlists.js`'s internal `require('./play-queue.js')` breaking because the two files end up in different folders — avoided by moving all `src/` files together in one `git mv` batch (Task 2) rather than one at a time.
- A leftover reference to the deleted `js/` folder in `.vscode/` or `package.json` causing a silent stale-file load — checked by Task 1's grep before deletion.
- Case- or extension-sensitive path typo in the rewritten `index.html` `<script src>`/`<link href>` attributes (e.g. `Css/` or missing `.js`) — caught by Task 4's browser smoke check, since a 404 on a `<script>` tag fails silently in the console, not visibly on the page.

---

### Task 1: Verify and remove the stale `js/` folder

**Files:**
- Delete: `js/api-service.js`, `js/app.js`, `js/audio-player.js`, `js/bookmarks.js`, `js/islamic-resources.js`, `js/quran-display.js`, `js/search.js`, `js/settings.js`, `js/tafseer.js`, `js/translation.js`

**Interfaces:** None — this folder is not referenced by any other file.

- [ ] **Step 1: Confirm nothing references the `js/` folder**

Run: `grep -rn "js/" --include="*.html" --include="*.json" --include="*.js" . --exclude-dir=.git --exclude-dir=node_modules`
Expected: no hits pointing at the `js/` subfolder as a load path (historical mentions inside `FINAL_REPORT.md`/`SUMMARY.md` prose are fine and untouched — they're a dated record of a past fix, not a live reference).

- [ ] **Step 2: Delete the folder**

Run: `git rm -r js/`

- [ ] **Step 3: Commit**

```bash
git commit -m "chore: remove stale duplicate js/ folder"
```

### Task 2: Move app scripts into `src/` and styles into `css/`

**Files:**
- Create dir: `src/`, `css/`
- Move: `api-service.js`, `app.js`, `audio-player.js`, `bookmarks.js`, `digital-mushaf.js`, `islamic-resources.js`, `play-queue.js`, `playback-store.js`, `playlists.js`, `playlists-ui.js`, `quran-display.js`, `search.js`, `settings.js`, `tafseer.js`, `translation.js`, `adhkar.js` → `src/`
- Move: `styles.css`, `adhkar-mushaf-styles.css`, `player-styles.css` → `css/`

**Interfaces:**
- Produces: all app JS now lives at `src/<name>.js`; all CSS now lives at `css/<name>.css`. `playlists.js`'s internal `require('./play-queue.js')` keeps working unchanged because both land in `src/` together in the same move.

- [ ] **Step 1: Move all JS files in one batch**

Run: `git mv api-service.js app.js audio-player.js bookmarks.js digital-mushaf.js islamic-resources.js play-queue.js playback-store.js playlists.js playlists-ui.js quran-display.js search.js settings.js tafseer.js translation.js adhkar.js src/`

- [ ] **Step 2: Move all CSS files in one batch**

Run: `git mv styles.css adhkar-mushaf-styles.css player-styles.css css/`

- [ ] **Step 3: Verify `playlists.js`'s internal require still resolves**

Run: `node -e "require('./src/playlists.js')"`
Expected: no `MODULE_NOT_FOUND` error.

- [ ] **Step 4: Commit**

```bash
git commit -m "chore: move app scripts into src/ and stylesheets into css/"
```

### Task 3: Fix `tests/queue.test.js` require paths and verify the test suite

**Files:**
- Modify: `tests/queue.test.js:3-4`

**Interfaces:**
- Consumes: `src/play-queue.js`, `src/playlists.js` (produced by Task 2).

- [ ] **Step 1: Update the two require paths**

In `tests/queue.test.js`, change:
```js
const PlayQueue = require('../play-queue.js');
const PlaylistStore = require('../playlists.js');
```
to:
```js
const PlayQueue = require('../src/play-queue.js');
const PlaylistStore = require('../src/playlists.js');
```

- [ ] **Step 2: Run the test suite**

Run: `npm test`
Expected: PASS (same pass/fail counts as before the move).

- [ ] **Step 3: Commit**

```bash
git add tests/queue.test.js
git commit -m "test: update queue.test.js require paths for src/ move"
```

### Task 4: Rewrite `index.html` references and smoke-test the page

**Files:**
- Modify: `index.html` (the `<link href="...">` and `<script src="...">` tags listed in the Architecture section)

**Interfaces:**
- Consumes: `css/styles.css`, `css/adhkar-mushaf-styles.css`, `css/player-styles.css`, and the 19 script tags' targets now under `src/` (from Task 2), in their existing order.

- [ ] **Step 1: Rewrite the 3 stylesheet `<link>` tags**

Change `href="styles.css"` → `href="css/styles.css"`, `href="adhkar-mushaf-styles.css"` → `href="css/adhkar-mushaf-styles.css"`, `href="player-styles.css"` → `href="css/player-styles.css"`. Leave the Font Awesome CDN `<link>` untouched.

- [ ] **Step 2: Rewrite every local `<script src="...">` tag**

Prefix each of the 16 local script `src` values (`api-service.js`, `app.js`, `quran-display.js`, `play-queue.js`, `playlists.js`, `playback-store.js`, `audio-player.js`, `tafseer.js`, `translation.js`, `search.js`, `bookmarks.js`, `settings.js`, `islamic-resources.js`, `adhkar.js`, `digital-mushaf.js`, `playlists-ui.js`) with `src/`, keeping their existing order unchanged.

- [ ] **Step 3: Grep for any remaining unprefixed reference**

Run: `grep -nE 'src="[a-z-]+\.js"|href="[a-z-]+\.css"' index.html`
Expected: no output (every local `.js`/`.css` reference now starts with `src/` or `css/`).

- [ ] **Step 4: Start the dev server and load the page**

Run: `npm start` (background), then `curl -s http://127.0.0.1:8000/index.html | grep -oE 'src="[^"]+\.js"|href="[^"]+\.css"'` to confirm the rewritten paths, and open `http://127.0.0.1:8000/index.html` in a browser (or run `npm run test:browser`) to confirm the page renders styled and without console 404s on scripts.
Expected: page loads with styling applied and no failed network requests for `.js`/`.css`.

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "chore: point index.html at the new src/ and css/ paths"
```

### Task 5: Move report/doc files into `docs/`

**Files:**
- Move: `ADHKAR_MUSHAF_DOCS.md`, `FINAL_REPORT.md`, `NEW_FEATURES.md`, `PLAYBACK.md`, `SUMMARY.md`, `TEST_TAFSEER.md`, `TAFSEER_FIX_REPORT.html` → `docs/`

**Interfaces:** None — these are standalone reports with no inbound code references (confirmed in Task 1's grep scope / prior investigation).

- [ ] **Step 1: Move the files**

Run: `git mv ADHKAR_MUSHAF_DOCS.md FINAL_REPORT.md NEW_FEATURES.md PLAYBACK.md SUMMARY.md TEST_TAFSEER.md TAFSEER_FIX_REPORT.html docs/`

- [ ] **Step 2: Verify nothing else linked to them**

Run: `grep -rn "FINAL_REPORT\|NEW_FEATURES\|PLAYBACK\.md\|SUMMARY\.md\|TEST_TAFSEER\|TAFSEER_FIX_REPORT\|ADHKAR_MUSHAF_DOCS" index.html package.json src/ css/ tests/ 2>/dev/null`
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git commit -m "docs: move report files into docs/"
```

### Task 6: Final whole-tree verification

**Files:** None (verification only).

- [ ] **Step 1: Confirm root listing matches the target layout**

Run: `ls -1` at the project root.
Expected: `index.html`, `package.json`, `package-lock.json`, `src/`, `css/`, `docs/`, `tests/`, `.vscode/`, `.git/` — no stray `.js`/`.css`/`.md` files left at the root.

- [ ] **Step 2: Run the full automated test suite one more time**

Run: `npm test`
Expected: PASS.

- [ ] **Step 3: Run the browser test suite**

Run: `npm run test:browser`
Expected: all 5 scripts exit 0 (requires Chrome/Chromium available to `tests/browser/cdp.js`; if unavailable in this environment, note that explicitly instead of claiming success).
