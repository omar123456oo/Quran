# Quran Radio Integration Documentation (الإذاعة القرآنية المباركة)

## 1. Overview and Architecture

The Quran Radio feature provides continuous, high-fidelity live streaming of the Holy Quran from verified, authorized audio streams. The implementation is designed to blend seamlessly into the existing native HTML/CSS/JavaScript Quran application without external frameworks or heavy libraries.

### System Architecture

```
                          ┌────────────────────────────────┐
                          │          User Interface        │
                          │ ┌────────────┐ ┌─────────────┐ │
                          │ │ Radio Page │ │ Radio Mini  │ │
                          │ └──────┬─────┘ └──────┬──────┘ │
                          └────────┼──────────────┼────────┘
                                   │              │
                                   ▼              ▼
                          ┌────────────────────────────────┐
                          │            RadioUI             │
                          │   (DOM View & Event Binding)   │
                          └───────────────┬────────────────┘
                                          │ Pub/Sub
                                          ▼
                          ┌────────────────────────────────┐
                          │          RadioService          │
                          │    (Audio Engine Singleton)    │
                          │  • State model                 │
                          │  • Bounded reconnection        │
                          │  • MediaSession metadata       │
                          │  • Storage preferences         │
                          └───────┬────────────────┬───────┘
                                  │                │
            Inter-Source Audio    │                │ Stream Feeds
            Coordination Policy   ▼                ▼
     ┌──────────────────────────────┐    ┌──────────────────┐
     │         AudioPlayer          │    │  RadioStations   │
     │  (Quran Recitation Engine)   │    │ (Verified List)  │
     └──────────────────────────────┘    └──────────────────┘
```

---

## 2. Files Created and Modified

### New Files Created
1. `radio-stations.js`: Authoritative registry of verified, CORS-enabled, HTTPS live audio streams.
2. `radio-service.js`: Dedicated, centralized audio streaming engine with state management, bounded exponential-backoff retries, and Media Session API sync.
3. `radio-ui.js`: Presentation controller for the full radio screen, category filters, station search, and persistent mini-player.
4. `radio.css`: UI styles consistent with the Islamic design system, supporting both light and dark themes, animated equalizers, and responsive safe areas.
5. `tests/radio.test.js`: Automated test suite covering station verification, state transitions, audio coordination, retries, and preference persistence.
6. `docs/RADIO_INTEGRATION.md`: This comprehensive documentation file.

### Existing Files Modified
1. `index.html`:
   - Added `radio.css` stylesheet link in `<head>`.
   - Added "الإذاعة" entry in main navigation header.
   - Added Quran Radio teaser banner on the Home page (`#homePage`).
   - Added container `<div id="radioPage" class="page hidden">` inside main container.
   - Included `radio-stations.js`, `radio-service.js`, and `radio-ui.js` script tags.
2. `app.js`:
   - Added `RadioUI.init()` in `initModules()`.
   - Added `case 'radio'` in `navigateToPage()`.
   - Added call to update radio mini-player visibility on internal navigation changes.
3. `audio-player.js`:
   - Integrated mutual-exclusivity check in `safePlay()` to automatically pause active radio streams when Quran recitation starts.
4. `sw.js`:
   - Updated `VERSION` from `v4` to `v5`.
   - Added `radio.css`, `radio-stations.js`, `radio-service.js`, and `radio-ui.js` to `SHELL_FILES` precache list.
5. `www/`:
   - Synchronized build output generated via `npm run build`.

---

## 3. Radio Stations and Streaming Configuration

### Station Data Schema
Each station in `radio-stations.js` conforms to the following schema:
```javascript
{
    id: 'tarateel',                     // Unique station identifier
    name: 'إذاعة تراتيل قصيرة متميزة',  // Arabic display name
    nameEn: 'Short Quranic Recitations',// English label
    category: 'thematic',               // 'thematic' | 'reciter'
    categoryName: 'منوعات وتلاوات',     // Arabic category label
    streamUrl: 'https://...',           // Direct, verified stream URL
    format: 'audio/mpeg',               // MIME type ('audio/mpeg' / 'audio/aac')
    bitrate: 128,                       // Bitrate in kbps
    description: '...',                 // Descriptive text
    verified: true,                     // Operational verification status
    icon: 'fa-book-open-reader'         // FontAwesome icon class
}
```

### Verified Live Stations
The following stations are verified operational with HTTP/2 and CORS:
- **تراتيل قصيرة متميزة**: `https://qurango.net/radio/tarateel`
- **مشاري راشد العفاسي**: `https://qurango.net/radio/mishary_alafasi`
- **عبد الباسط عبد الصمد (المجوّد)**: `https://qurango.net/radio/abdulbasit_abdulsamad_mojawwad`
- **عبد الباسط عبد الصمد (المرتّل)**: `https://qurango.net/radio/abdulbasit_abdulsamad_warsh`
- **محمد صديق المنشاوي (المجوّد)**: `https://qurango.net/radio/mohammed_siddiq_alminshawi_mojawwad`
- **محمد صديق المنشاوي (المرتّل)**: `https://qurango.net/radio/mohammed_siddiq_alminshawi`
- **محمود خليل الحصري**: `https://qurango.net/radio/mahmoud_khalil_alhussary`
- **أحمد بن علي العجمي**: `https://qurango.net/radio/ahmad_alajmy`
- **سعود الشريم**: `https://qurango.net/radio/saud_alshuraim`
- **عبد الرحمن السديس**: `https://qurango.net/radio/abdulrahman_alsudaes`
- **ماهر المعيقلي**: `https://qurango.net/radio/maher_almuaiqly`
- **محمود علي البنا**: `https://qurango.net/radio/mahmoud_ali__albanna_mojawwad`
- **ياسر الدوسري**: `https://qurango.net/radio/yasser_aldosari`
- **خالد الجليل**: `https://qurango.net/radio/khalid_aljileel`
- **ناصر القطامي**: `https://qurango.net/radio/nasser_alqatami`
- **محمد جبريل**: `https://qurango.net/radio/mohammed_jibreel`
- **فارس عباد**: `https://qurango.net/radio/fares_abbad`
- **إدريس أبكر**: `https://qurango.net/radio/idrees_abkr`

### How to Add or Modify Stations
1. Open `radio-stations.js`.
2. Add a new object to the `STATIONS` array with a unique `id` and verified `streamUrl`.
3. Verify stream accessibility using curl:
   ```bash
   curl -I -s <STREAM_URL>
   ```
   Ensure the response returns `HTTP/1.1 200 OK` or `HTTP/2 200` with `content-type: audio/mpeg` or `audio/aac`.
4. Rebuild the web assets with `npm run build` and run `npm test`.

---

## 4. Shared Audio Engine & Coordination Policy

### State Model
`RadioService` enforces explicit state transitions:
- `idle`: Audio unloaded, ready.
- `loading`: Network connection initiated, awaiting first chunk.
- `playing`: Stream actively playing sound.
- `paused`: Playback suspended by user or coordinated pause.
- `reconnecting`: Network hiccup or stream dropped; bounded backoff retry active.
- `error`: Retries exhausted or unrecoverable error; manual retry button presented.

### Inter-Source Coordination
- **Mutual Exclusivity**: At any given time, only one audio source produces sound.
- **Quran Recitation Protection**: When radio starts, `AudioPlayer.pause()` is called without clearing current Surah, Ayah, queue position, or Mushaf reading state.
- **Radio Protection**: When Quran recitation starts (`AudioPlayer.safePlay()`), `RadioService.pause(false)` is invoked automatically.

---

## 5. Persistent Mini-Player

- **Behavior**: When radio playback is active (or paused during an active listening session) and the user navigates away from the Radio page (e.g. to read the Mushaf, read Adhkar, or search), `#radioMini` appears docked at the bottom of the screen.
- **Controls**:
  - Live indicator badge and station title.
  - Play/Pause toggle button.
  - Expand button (`fa-chevron-up`) to instantly return to the Radio page.
  - Dismiss button (`fa-xmark`) which hides the mini player without interrupting the background audio stream.
- **Safe Area Insets**: Positioned using `calc(12px + env(safe-area-inset-bottom))` ensuring compatibility with gesture navigation bars on modern mobile devices.

---

## 6. Background Playback & Lock-Screen Controls

### Media Session API Implementation
`RadioService.updateMediaSession()` registers:
- `title`: Current station display name.
- `artist`: 'الإذاعة القرآنية المباركة'.
- `album`: Station description / 'بث مباشر'.
- `artwork`: Application icons (`192x192` and `512x512`).
- Actions: `play`, `pause`, `stop`, `nexttrack`, `previoustrack`.

### Platform Compatibility & Limitations
1. **Desktop Browsers (Chrome, Edge, Firefox, Safari)**:
   - Plays continuously in background tabs.
   - Operating system media keys and desktop notification widgets control playback.
2. **Mobile Android (Chrome / Chromium PWA)**:
   - Background audio continues when switching apps and when screen is locked.
   - Android system notification media player displays station title and play/pause controls.
   - Note: Aggressive battery savers or OS memory pressure can occasionally suspend background WebViews after extended duration.
3. **Mobile iOS (Safari / WebKit)**:
   - Background playback works when initiated by user interaction.
   - Lock screen widget displays metadata and playback controls.
   - Note: iOS WebKit suspends audio if the device enters deep sleep or if Safari tab memory is reclaimed. For native background audio reliability on iOS, the existing Capacitor native project can wrap the stream with native background audio modes (`UIBackgroundModes: audio`).
4. **Capacitor Android / iOS App**:
   - Packaged with native webDir (`www/`). Capacitor native shell allows persistent background audio when background modes are declared in the native manifest/plist.

---

## 7. Testing & Verification Results

All 49 unit and integration tests passed:
```
✔ content: expected collections
✔ meta: 114 Surahs with 6236 ayahs, 604 page starts, 30 Juz starts
✔ layout: page 1 — header, then Al-Fatihah on lines 2–8
✔ validatePage: all fixture pages pass
✔ sequential playback follows exact playlist order and finishes
✔ radio stations: all stations have unique IDs, required fields, and valid formats
✔ radio service: opening radio does not start playback automatically
✔ radio service: play, playing, and pause state transitions
✔ radio service: network failure triggers bounded retry with backoff, then error
✔ radio service: switching stations stops previous and connects to new station
✔ radio service: starting recitation pauses radio, and starting radio pauses recitation
✔ radio service: saves and restores preferences cleanly without corruption
✔ radio service: volume clamping and handling of corrupted storage
✔ radio service: stop cancels any active retry timers and clears src
Total Tests: 49 | Passed: 49 | Failed: 0
```

