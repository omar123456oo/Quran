# Home Experience — Player Views, Makki/Madani Explorer, Stories & Miracles

What was added on the home screen, how it fits the existing architecture, where every piece of data comes from, and what still needs a human decision.

## Architecture (unchanged foundations)

Vanilla JS single-page app; modules are global objects routed by `App.navigateToPage()`. Nothing in the stack was replaced.

| Piece | Role | Relation to existing code |
|---|---|---|
| `AudioPlayer` (audio-player.js) | the only audio engine and `<audio>` element | + `canStepAyah()`, `stepAyah()`, `nextAyah()`, `previousAyah()`; `showPlayer/hidePlayer` notify the views |
| `PlaybackStore` (playback-store.js) | single source of truth for playback state | unchanged; + `QuranUtil.splitBasmala()` |
| `PlayerViews` (player-views.js) | **new** presentation only: expanded dialog, compact player, docked bar switch | subscribes once to `PlaybackStore`; every action calls `AudioPlayer` |
| `Explore`, `ContentStore` (explore.js) | **new** home band, explorer page, collections, reading page | reuses `APIService`, `QuranDisplay.loadSurah`, `AudioPlayer.playNow/playAyah`, `MushafMeta` |
| `content/stories.json`, `content/miracles.json` | **new** editable content (references, explanations, lessons) | lazy-loaded with `fetch`; precached by the service worker |
| `home-experience.css` | **new** styles | uses the existing design tokens and dark theme |
| `tools/verify-content.py` | **new** content verification against the Quran dataset | run before publishing content changes |

## Explore page (استكشف)

All three features live on one page, `#explorePage`, opened from the navbar link **استكشف** or the entry card on Home. It has:
- a header and jump links (مكية ومدنية / قصص الأنبياء ٩ / معجزات الأنبياء ١٢);
- the two Makki/Madani cards;
- one search box that filters stories and miracles together (prophet, title, intro, Surah names);
- full card grids, each with its own empty state.

Reading pages and the Makki/Madani list return to it with *العودة*. The header gives the navbar its own row up to 1360px wide, so 10 links never wrap.

**Content loading:** `content/stories.js` and `content/miracles.js` are generated from the JSON by `npm run verify:content` and loaded with a `<script>` tag. That way they also load when `index.html` is opened directly from disk (`file://`), where `fetch()` of JSON is blocked; this was the cause of "تعذر تحميل قصص الأنبياء". Edit the JSON and never the generated `.js`.

## Player views

- **Expanded** (`#pvExpanded`): opens automatically once per queue item when playback *starts* while the user is on Home, the Makki/Madani page, a collection or a reading page. It shows the Surah, the reciter, the playing verse with its number, progress/seek, previous/next verse, play/pause, *open in reader*, and *full controls*. The background is blurred and made `inert`, so it can't be clicked or tabbed into; focus moves to Play. Escape, the minimize button, or tapping outside minimizes.
- **Compact** (`#pvMini`, the default): floating at the bottom on every page, with thumbnail, Surah, verse number, play/pause, expand, and close. Close stops playback and hides the player; it is the only control that stops audio.
- **Docked** (original `#audioPlayerContainer`): every existing control (shuffle, repeat, volume, queue, reciter…) is one tap away via *عناصر التحكم الكاملة*, and its new minimize button returns to compact. The choice is remembered (`localStorage.quran_player_view`).
- **Verse accuracy:** the app plays one MP3 per ayah, so the verse shown is the ayah whose file is playing, never estimated from time. Reciters that only publish whole-Surah files (محمود علي البنا) show "verse not identifiable for this reciter" and disable verse stepping.
- **Basmala:** the API prefixes ayah 1 of most Surahs with the basmala. `QuranUtil.splitBasmala` shows it on its own line (in the dataset's own characters) instead of as part of the ayah. It is used by the expanded player, the docked bar, and story passages.
- Minimize/expand only toggle CSS classes; they never touch the `<audio>` element, so playback is not restarted (verified in test 09).

## Makki / Madani explorer

- **Data:** `revelationType` already bundled in `mushaf-meta.js` from alquran.cloud (Tanzil data), cross-checked against Quran.com `revelation_place`: identical for all 114 Surahs (86 Makki, 28 Madani), same verse counts.
- **Convention:** Makki = revealed before the Hijrah, Madani = after it, regardless of place; this is the classification printed in the Madinah Mushaf. Scholars differ on a small number of Surahs; the app uses this source as published and says so on the page.
- **UI:** the two cards on Home open `#revelationPage`, which has Makki/Madani tabs (arrow-key switchable), number, name, type, verse count, *read* (existing reader) and *listen* (existing engine).

## Stories & Miracles

**Content model** (both files share it):

```json
{ "id": "yunus", "prophet": "…", "title": "…", "icon": "fa-fish", "intro": "…",
  "sections": [ { "title": "…",
                  "refs": [ { "s": 21, "from": 87, "to": 88, "expect": ["ذا النون"] } ],
                  "text": "simplified explanation of the cited verses only",
                  "hadith": { "text": "…", "source": "…", "grade": "…" } } ],
  "lessons": ["…"], "related": ["nuh"], "minutes": 3 }
```

Miracles add `basis` (`quran` | `quran+hadith`) and `relatedStories`. `minutes` is written by the verifier, computed from the actual explanation text plus the referenced verses (130 words/min).

**Integrity rules (enforced):**
- No Quranic text is stored in content files, only references. A unit test fails if Uthmani-script characters appear in them.
- At display time the passage is fetched from the same Quran API as the reader, checked to be exactly the requested ayahs (Surah, count, numbers), and shown unchanged. Test 09 rebuilds the API text from what is displayed.
- `tools/verify-content.py` checks every reference: the Surah exists, the range is inside it, and every `expect` phrase occurs in those verses (diacritic-insensitive, against `quran-simple-clean`). A wrong or shifted reference fails. Last run: **21 items, 101 references, 0 problems**; a planted wrong reference is rejected.
- Quran text (*قال الله تعالى — سورة …*), explanation (*شرح مبسّط*) and hadith (*من السنة النبوية*, with source and grading) are visually separate blocks.
- Explanations restate only what the cited verses say. Where a detail is not in the Quran (e.g. how Ṣāliḥ's she-camel appeared), the text says so instead of filling it in. The son in the sacrifice story is described as unnamed in the verses, with the well-known scholarly view (Ismāʿīl) attributed as such.
- Hadith used: two only, both in Ṣaḥīḥ al-Bukhārī and Muslim: the beginning of revelation (Bukhārī no. 3) and the splitting of the moon (Ibn Masʿūd). Both are summarised, not quoted verbatim.
- No figurative images: icons and patterns only (book, ship, fish, dove, kaaba, mosque, wind…).

**To edit or add content:** edit the JSON, add `expect` phrases for every reference, run `npm run verify:content` (rewrites `minutes` and regenerates `content/*.js`), then `npm test`, then bump `VERSION` in `sw.js`.

## Reciter: ياسر الدوسري (Yasser Al-Dosari)

- alquran.cloud only has whole-Surah files for him (`ar.yasseraldossari`), which would mean no verse sync, no page/Juz playback and no offline download. The app instead uses his per-ayah recording on everyayah.com (`Yasser_Ad-Dussary_128kbps`): CORS-enabled, the same host as the other offline downloads, with ID3 tags naming the reciter (source: VerseByVerseQuran / quranicaudio.com).
- Reciter id `yasser.aldossari` (`mirrorOnly` in `audio-player.js`, `MIRROR_ONLY` in `offline-audio.js`). The ayah list, text, page and Juz come from the app's Quran text edition, and only the audio URL comes from the mirror.
- Verified: all 6,236 ayah files exist and are audio (HEAD sweep). Test `tests/browser/10-yasser-aldossari.js` covers selection, playback, verse stepping, page playback, download, and offline play.
- Unlike the other seven reciters, there is no alquran.cloud per-ayah copy to compare bytes against, so the reciter's identity rests on the provider's catalogue and the files' tags.

## ⚠️ Needs your approval

1. **Scholarly review of the explanatory text.** The references are machine-verified, but the explanations, lessons, and hadith summaries were written by the AI assistant. Both files carry `"review": { "status": "pending-scholarly-review" }`. Have a qualified reviewer read them, then record the reviewer and date there.
2. **The compact player is now the default** on every page, replacing the large docked bar (which used 220–300 px of screen height). All controls remain available via *full controls*. If you prefer the docked bar as the default, change `view: 'compact'` in `player-views.js`.
3. **Auto-opening:** the expanded player opens once per new item started from Home or the new pages, and never in the reader or Mushaf. Tell me if you want an opt-out setting.
4. **Placement:** the discover band sits between the page title and the Surah index. Putting it after the index would place it below 114 cards.
5. **Reciter سعد الغامدي** still cannot play (the API has no audio for it; see docs/OFFLINE_AUDIT.md). The expanded player shows a clear error. Removing it from the list is a decision for you.

## Tests

| Suite | Result (2026-10-27) |
|---|---|
| `npm test` (incl. new `tests/content.test.js`) | 40 / 40 |
| `npm run verify:content` | 101 / 101 references |
| `tests/browser/09-home-experience.js` | 62 / 62: player flows, no audio restart, one media element, explorer data, all 21 reading pages, basmala, responsive 320/375/768/1280 |
| browser suites 01–08 (existing + offline) | all pass |

Not tested: real iOS/Android devices, screen readers (VoiceOver/TalkBack) — the dialog uses `role="dialog"`, `aria-modal`, `inert`, labelled controls and a live status region, but should be checked with a real screen reader.
