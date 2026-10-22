# Mobile Testing

Date: 2026-10-22. Status of every test category run or attempted during the migration — automated results are real tool output, not claimed; "not tested" items name the exact blocker.

## Automated tests

| Suite | Command | Result |
|---|---|---|
| Unit tests (play-queue/playlist logic) | `npm test` | **19/19 PASS**, re-verified after every source change in this migration |
| Browser smoke tests (CDP-driven) | `npm run test:browser` | **Not run** — no Chrome/Chromium binary installed on this machine (pre-existing gap, not caused by this migration; see audit §5) |
| Android Gradle build | `./gradlew assembleDebug` | **BUILD SUCCESSFUL** — verified artifact at `android/app/build/outputs/apk/debug/app-debug.apk` (4.3MB), contents checked with `unzip -l` for `classes.dex`, `AndroidManifest.xml`, and the web assets including `capacitor-bootstrap.js` |
| iOS build | — | **Not attempted** — this is a Linux machine; no Xcode/macOS available. See `docs/mobile-build-and-release.md` for the documented path. |

## Manual / runtime tests

**Not run** — no Android emulator or physical device was available in this environment (`adb devices` returned empty, no AVD configured). The machine does have working hardware virtualization (`/dev/kvm` present, CPU reports `vmx`/`svm`), so a hardware-accelerated emulator is a viable next step if the user wants one set up — not done here since it requires another non-trivial system-image download that wasn't part of the original toolchain approval.

The Review Focus items below (from `docs/mobile-migration-plan.md`) are the manual test matrix for whoever next runs this on a device/emulator:

| Item | How to test | Status |
|---|---|---|
| Hardware back button navigates the SPA's page stack, not exit-on-first-press | Open any non-home page, press the Android back gesture/button, confirm it returns to Home; press again on Home, confirm the app exits | **Blocked** — no device/emulator |
| Outbound resource links (8 sites in "المصادر") open in the system browser | Tap a resource link, confirm Chrome/system browser opens (not an in-app WebView with no way back) | **Blocked** — no device/emulator |
| Offline / API-failure feedback | Toggle airplane mode while the app is open; confirm the "لا يوجد اتصال بالإنترنت" toast appears, and a success toast on reconnect; confirm a failed API call also surfaces a toast | **Blocked** — no device/emulator |
| Audio survives/recovers from interruption (phone call, another app) | Start playback, trigger an interrupting call/notification, confirm playback state doesn't get stuck | **Blocked** — no device/emulator |
| Status bar / notch overlap | Visually inspect the header and sticky audio player on an edge-to-edge device/emulator | **Blocked** — no device/emulator (verified only via browser responsive-mode approximation, which has no real status bar to check against) |

## Explicit not-tested list

- iOS runtime behavior of any kind (no Mac in this environment).
- Any of the 5 manual Review Focus items above (no Android device/emulator).
- `tests/browser/*.js` CDP smoke suite (no Chromium binary).
- Real-device audio background/lock-screen behavior (requires a device, separate from the interruption test above).

No test result in this document or elsewhere in the migration docs is asserted without the command/output that produced it.
