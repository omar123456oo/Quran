# Mobile Architecture

## Overview

```
Existing web app (index.html + root-level *.js/*.css, unchanged)
        │
        │  npm run build  (scripts/build-web.js — flat copy, no bundling)
        ▼
      www/   (generated, gitignored — Capacitor's webDir)
        │
        │  npx cap sync
        ▼
  android/ (Capacitor Android project)     ios/ (Capacitor iOS project)
        │                                        │
   ./gradlew assembleDebug                  Xcode (needs a Mac — see
        │                                   mobile-build-and-release.md)
        ▼
  app-debug.apk
```

The existing app is never edited to "become mobile" — it is wrapped. Every source file (`index.html`, the 16 root `*.js` files, the 3 `*.css` files) keeps its original path and content. `npm run build` only *copies* those files into `www/`; nothing in that step rewrites them. The one deliberate exception is `index.html` itself, which gained a 19th `<script>` tag (`capacitor-bootstrap.js`, appended last) and a `viewport-fit=cover` addition to its existing viewport meta tag — both additive, both inert in a plain browser.

## The one backend dependency

The app has no backend of its own. All Quran text, tafseer, translations, search, and reciter/edition data come from the public **Al Quran Cloud API** (`https://api.alquran.cloud/v1`, hardcoded in `api-service.js`). Audio files are streamed from whatever HTTPS URL that same API returns per ayah — never a second hardcoded CDN. This is identical in the web app and the Capacitor-wrapped app; nothing about the API integration changes for mobile, because there is no cookie/session/CORS coupling to begin with (see `docs/mobile-migration-audit.md` §3 for the full audit).

## Why these 4 plugins, and no others

The audit (§4 of the audit doc) found exactly four native gaps a plain WebView doesn't cover, and the app uses no feature (camera, geolocation, push, biometrics, deep links, file upload) that would justify any other plugin:

| Plugin | Existing feature it serves | Where it's wired |
|---|---|---|
| `@capacitor/app` | Hardware Android back button must navigate the SPA's own page stack (`App.navigateToPage`), not exit the WebView | `capacitor-bootstrap.js` `backButton` listener |
| `@capacitor/browser` | The 8 outbound links in `islamic-resources.js` (`target="_blank"`) must open in the system browser, not trap the user inside the app's WebView | `capacitor-bootstrap.js` click interceptor |
| `@capacitor/status-bar` | The app already supports a light/dark theme (`Settings.setTheme`, `data-theme` attribute); the status bar icon color should follow it | `capacitor-bootstrap.js` `MutationObserver` on `data-theme` |
| `@capacitor/splash-screen` | Avoid a blank white flash before `index.html`'s own content/styles finish loading | `capacitor-bootstrap.js` `window.load` + `launchAutoHide: false` in `capacitor.config.json` |
| `@capacitor/network` | `api-service.js` previously only `console.error`'d on a failed fetch — no user-facing offline state existed | `capacitor-bootstrap.js` `networkStatusChange` listener + `api-service.js` catch block, both reusing `App.showToast` |

## No-bundler plugin access

This app has no bundler (no webpack/rollup/esbuild/vite) — plain `<script>` tags only. Capacitor's npm plugin packages ship UMD files (`node_modules/@capacitor/*/dist/plugin.js`) meant to be `import`ed by a bundler alongside the native bridge; loading them standalone via `<script>` would double-register against the bridge the native layer already injects. Instead, `capacitor-bootstrap.js` reaches plugins through `Capacitor.Plugins.<Name>` — the registry Capacitor's native Android/iOS runtime auto-injects into the WebView before any page script runs, which is the documented access path for apps without a build step. The whole file is wrapped in `if (!Capacitor?.isNativePlatform()) return;`, so it is a complete no-op — not even parsed into action — when the same `index.html` is opened in a desktop/mobile browser.

## Placeholder identity

`capacitor.config.json`'s `appId` is `com.example.qurankareem` and the Android `applicationId`/`namespace` in `android/app/build.gradle` match it — a placeholder, consistently applied, documented here and in the plan/build docs as something to replace with a real reverse-domain ID before any store submission (per the user's explicit choice to defer picking a permanent one).
