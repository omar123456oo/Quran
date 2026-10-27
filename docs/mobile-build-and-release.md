# Mobile Build and Release

## Toolchain (already installed on this machine, user-local, no sudo)

- JDK 21 (Eclipse Temurin): `~/android-toolchain/jdk-21`
- Android SDK: `~/Android/Sdk` (platform-tools, `platforms;android-34/35/36`, `build-tools;34.0.0/35.0.0/36.1.0`)
- Env file: `~/android-toolchain/env.sh` — source it before any Android/Gradle command:
  ```bash
  source ~/android-toolchain/env.sh
  ```

To reproduce this toolchain on another machine (no sudo required anywhere):

```bash
# JDK 21
curl -sSL -o /tmp/jdk21.tar.gz -L "https://api.adoptium.net/v3/binary/latest/21/ga/linux/x64/jdk/hotspot/normal/eclipse?project=jdk"
mkdir -p ~/android-toolchain && tar -xzf /tmp/jdk21.tar.gz -C ~/android-toolchain
mv ~/android-toolchain/jdk-21* ~/android-toolchain/jdk-21   # flatten the versioned dir name

# Android SDK command-line tools
curl -sSL -o /tmp/cmdline-tools.zip "https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip"
mkdir -p ~/Android/Sdk/cmdline-tools && unzip -q /tmp/cmdline-tools.zip -d ~/Android/Sdk/cmdline-tools
mv ~/Android/Sdk/cmdline-tools/cmdline-tools ~/Android/Sdk/cmdline-tools/latest

export JAVA_HOME=~/android-toolchain/jdk-21
export PATH="$JAVA_HOME/bin:$HOME/Android/Sdk/cmdline-tools/latest/bin:$PATH"
yes | sdkmanager --licenses --sdk_root="$HOME/Android/Sdk"
sdkmanager --sdk_root="$HOME/Android/Sdk" "platform-tools" "platforms;android-36" "build-tools;36.1.0"
```

(Match the `platforms;android-NN`/`build-tools;NN` versions to whatever `android/variables.gradle`'s `compileSdkVersion`/`targetSdkVersion` currently say — this project generated at API 36.)

## Day-to-day commands

```bash
npm run build          # copies index.html + root *.js/*.css into www/
npx cap sync           # pushes www/ + plugin registrations into android/ and ios/
npx cap open android    # opens the project in Android Studio, if installed
```

## Android debug build (verified working in this environment)

```bash
source ~/android-toolchain/env.sh
npm run build && npx cap sync android
cd android
./gradlew assembleDebug
```

Output: `android/app/build/outputs/apk/debug/app-debug.apk`. Install on a connected device/emulator with `adb install -r android/app/build/outputs/apk/debug/app-debug.apk`.

**An emulator is now set up and was used to verify the build**: AVD `qurankareem` (API 34, `google_apis` x86_64, `pixel_6` device profile), hardware-accelerated via this machine's KVM. It was left running headless after verification. To relaunch it in a future session:

```bash
source ~/android-toolchain/env.sh
nohup ~/Android/Sdk/emulator/emulator -avd qurankareem -no-window -no-audio -no-boot-anim > ~/android-toolchain/emulator.log 2>&1 &
disown
adb wait-for-device
adb shell getprop sys.boot_completed   # poll until this prints 1
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
adb shell am start -n com.example.qurankareem/.MainActivity
```

To create it from scratch elsewhere:

```bash
sdkmanager --sdk_root="$HOME/Android/Sdk" "system-images;android-34;google_apis;x86_64" "emulator"
avdmanager create avd -n qurankareem -k "system-images;android-34;google_apis;x86_64" --device "pixel_6"
```

## Android release build (not yet done — needs a real signing key)

1. Generate a keystore (**do this once, back it up — losing it means you can never update the app on an existing Play Store listing**):
   ```bash
   keytool -genkey -v -keystore release.keystore -alias qurankareem -keyalg RSA -keysize 2048 -validity 10000
   ```
2. **Never commit `release.keystore` or its passwords to git.** Keep them outside the repo or reference them via Gradle properties sourced from environment variables / a local, gitignored `keystore.properties`.
3. Configure a `signingConfigs.release` block in `android/app/build.gradle` referencing that keystore, then:
   ```bash
   ./gradlew bundleRelease   # produces an .aab for Play Store upload
   ```
4. Before any store submission: replace the placeholder `appId`/`applicationId` (`com.example.qurankareem`) everywhere it appears (`capacitor.config.json`, `android/app/build.gradle`'s `namespace`/`applicationId`, `ios/App/App.xcodeproj`) with your real, permanent reverse-domain identifier — it cannot be changed after the first store listing.

## iOS (requires a Mac — not buildable on this Linux machine)

Everything that doesn't require Xcode is already done: the `ios/` Capacitor project exists, `capacitor.config.json`'s `appId`/`appName` apply to it identically, and all 5 plugins resolved their `Package.swift` entries during `npx cap sync` (confirmed in the sync log — no missing-plugin errors).

On a Mac, with Xcode installed:

```bash
npm run build && npx cap sync ios
npx cap open ios
```

Then in Xcode: select a Development Team under Signing & Capabilities (requires an Apple Developer account), choose a device/simulator, Build & Run for local testing, or Product → Archive for a store submission. No native iOS permission entries are needed beyond Capacitor's defaults — the app audit found no camera/location/contacts/etc. usage (see `docs/mobile-migration-audit.md`), so `Info.plist` needs no added usage-description strings.

A Mac-less alternative is a cloud macOS CI service (e.g. a hosted Mac CI runner) running the same two commands above plus an `xcodebuild archive` step — not set up here since it requires an account/service the user hasn't provisioned.

## Known, documented limitations

- Debug APK build is verified; release signing is not configured (no keystore exists yet — intentionally, since generating one is a one-way, consequential action the user should trigger themselves).
- No runtime verification on any Android device/emulator (none available here).
- No iOS build of any kind (no Mac).
- `npm audit` reports 3 moderate-severity findings, all in `uuid`→`xcode`→`@capacitor/cli`'s *build-time-only* dependency chain (never shipped in the app bundle) — see `docs/mobile-migration-audit.md` §6 note and the plan's Task 2.
