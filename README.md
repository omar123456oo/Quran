# Qur'an Kareem

A static HTML/CSS/JavaScript Qur'an reading, listening, and study app — Surah/Juz/page browsing, a digital Mushaf, audio recitation with playlists and a queue, tafseer, translations, Adhkar, bookmarks, and search. No backend of its own; all Quran content comes from the public [Al Quran Cloud API](https://alquran.cloud/api).

## Development

```bash
npm start
```

Serves the app at `http://127.0.0.1:8000/index.html` via `python3 -m http.server` — no build step, no bundler. Every script/stylesheet is loaded directly from the project root in `index.html`.

```bash
npm test             # unit tests (node:test) for play-queue/playlist logic
npm run test:browser # CDP-driven browser smoke tests (requires a local Chrome/Chromium binary)
```

## Mobile (Android/iOS)

The app is wrapped for Android and iOS with [Capacitor](https://capacitorjs.com/), without rewriting any of the web app above — see `docs/mobile-architecture.md` for how it fits together, `docs/mobile-testing.md` for what's been verified (including on-device emulator testing), and `docs/mobile-build-and-release.md` for every build/release command and the known environment limitations (no iOS build on Linux, release signing not yet set up).

Quick start:

```bash
npm run build        # copies index.html + root *.js/*.css into www/ (Capacitor's webDir)
npx cap sync         # pushes www/ + plugin config into android/ and ios/
npx cap open android # open in Android Studio (requires it to be installed)
```

Building a debug APK from the command line (requires the JDK 21 + Android SDK toolchain documented in `docs/mobile-build-and-release.md`):

```bash
source ~/android-toolchain/env.sh
npm run build && npx cap sync android
cd android && ./gradlew assembleDebug
```

The Android `appId`/iOS bundle identifier is currently the placeholder `com.example.qurankareem` — replace it everywhere (see `docs/mobile-build-and-release.md`) before any real store submission.

### Troubleshooting

- **Blank app / 404s on load**: run `npm run build` again — `www/` is a generated, gitignored copy and goes stale if you edit a root `.js`/`.css` file without rebuilding.
- **`cap sync` doesn't pick up a plugin change**: it only re-copies `www/`; if you changed `capacitor.config.json`, re-run `npx cap sync`, not just `npm run build`.
- **Gradle build fails on a missing SDK platform**: check `android/variables.gradle`'s `compileSdkVersion`/`targetSdkVersion` and install the matching `platforms;android-NN` / `build-tools;NN` via `sdkmanager` (exact commands in `docs/mobile-build-and-release.md`).
