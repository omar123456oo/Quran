# Mobile Testing

Date: 2026-10-22. Status of every test category run or attempted during the migration — automated results are real tool output, not claimed; "not tested" items name the exact blocker.

## Automated tests

| Suite | Command | Result |
|---|---|---|
| Unit tests (play-queue/playlist logic) | `npm test` | **19/19 PASS**, re-verified after every source change in this migration |
| Browser smoke tests (CDP-driven) | `npm run test:browser` | **Not run** — no Chrome/Chromium binary installed on this machine (pre-existing gap, not caused by this migration; see audit §5) |
| Android Gradle build | `./gradlew assembleDebug` | **BUILD SUCCESSFUL** — verified artifact at `android/app/build/outputs/apk/debug/app-debug.apk` (4.3MB), contents checked with `unzip -l` for `classes.dex`, `AndroidManifest.xml`, and the web assets including `capacitor-bootstrap.js` |
| iOS build | — | **Not attempted** — this is a Linux machine; no Xcode/macOS available. See `docs/mobile-build-and-release.md` for the documented path. |

## Manual / runtime tests — run on a real emulator

An Android emulator was set up after the initial build pass (API 34, `google_apis` x86_64 image, AVD name `qurankareem`, hardware-accelerated via this machine's working KVM). The debug APK was installed (`adb install -r`) and driven via `adb shell input`/`screencap`, with results read from actual screenshots and `adb logcat`, not assumed:

| Item | How it was tested | Result |
|---|---|---|
| Hardware back button navigates the SPA's page stack, not exit-on-first-press | Opened Al-Faatiha (non-home page), pressed `KEYCODE_BACK`, screenshotted — landed back on Home. Pressed `KEYCODE_BACK` again — `dumpsys activity` showed `mFocusedApp` switch to the launcher, confirming the app exited | **PASS** |
| Outbound resource links (8 sites in "المصادر") open in the system browser | Tapped "زيارة الموقع" on the Quran.com resource card; `dumpsys activity` showed `mFocusedApp` become `com.android.chrome`, and `logcat` showed `Browser.open` called with `url: https://quran.com/` | **PASS** |
| Offline / API-failure feedback | `adb shell svc wifi disable && adb shell svc data disable` while the app was open — red "لا يوجد اتصال بالإنترنت" toast appeared (screenshot captured); re-enabled both — green "تم استعادة الاتصال بالإنترنت" toast appeared | **PASS** |
| Status bar / notch overlap | Visual inspection of the header and sticky audio player across 6 screenshots at different app states — no overlap with the status bar or system UI | **PASS** (this emulator profile has no physical notch to test against; `env(safe-area-inset-*)` behavior on a real notched device is still unverified) |
| Audio actually plays | Not an original Review Focus item, tested anyway since it's the app's core feature: tapped "تشغيل السورة كاملة" on Al-Faatiha — the sticky player showed the live reciter name (مشاري راشد العفاسي), ayah counter (١/٧), an advancing timer, and a pause icon, confirming real HTTPS audio streaming from the API works inside the Capacitor WebView | **PASS** |
| Audio survives/recovers from interruption (phone call, another app) | Not tested — would need a second app/call simulated mid-playback on the emulator, not done in this pass | **Not tested** |

### One real finding from `adb logcat`

Twice at every cold app launch, Capacitor's own native-bridge-injected script (not `capacitor-bootstrap.js` or any other app file — confirmed by grepping the repo for the error's text) throws and logs:
```
E Capacitor/Console: File:  - Line 6 - Msg: Error injecting safe area CSS: TypeError: Cannot read properties of null (reading 'style')
```
This is Capacitor 8.5.3's own built-in safe-area-inset CSS injection (separate from the `env(safe-area-inset-*)` rules this migration added manually to `styles.css`) running before `document.documentElement` exists yet. It did not block rendering, did not appear in any functional test above, and the app's own safe-area CSS (confirmed visually, see the status-bar-overlap row above) was unaffected — logged here as an observed, non-blocking upstream Capacitor behavior, not fixed, since fixing it would mean patching `node_modules`.

## Explicit not-tested list

- iOS runtime behavior of any kind (no Mac in this environment).
- Audio interruption recovery (phone call / other app mid-playback).
- Real notched-device safe-area rendering (this AVD profile has no notch).
- `tests/browser/*.js` CDP smoke suite (no Chromium binary).
- Playlists, queue, bookmarks, Adhkar, digital Mushaf, search, and settings pages — only the back-button/external-link/offline/audio paths above were exercised on-device; the rest rely on the unit test suite and the unchanged source code.

No test result in this document or elsewhere in the migration docs is asserted without the command/output or screenshot that produced it.
