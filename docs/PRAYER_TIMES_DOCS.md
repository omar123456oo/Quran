# Prayer Times, Qibla & Islamic Prayer Experience Documentation (مواقيت الصلاة والقبلة)

## 1. Architecture Overview

The Prayer Times system is architected into three modular, zero-dependency files that integrate seamlessly with the existing Quran Web Application:

1. **`prayer-calc.js` (Astronomical & Spherical Math Engine)**:
   - Pure mathematical engine implementing Jean Meeus solar position equations.
   - Calculates daily Fajr, Sunrise, Dhuhr, Asr, Maghrib, and Isha times locally without external API calls.
   - Computes Great-Circle Qibla bearing and Haversine distance to the Holy Kaaba in Makkah.
   - Formats Hijri (Umm al-Qura calendar) and Gregorian dates in both Arabic and English.

2. **`prayer-service.js` (State, Storage, Tracker & Adhan Engine)**:
   - Manages user preferences (`quran_prayer_prefs_v1`), offline schedule cache (`quran_prayer_cache_v1`), and daily prayer tracker (`quran_prayer_tracker_v1`) in `localStorage`.
   - Runs a single managed 1-second ticker that updates the live countdown and checks for pre-prayer reminders and Adhan alerts.
   - Coordinates with `AudioPlayer` and `RadioService` to pause active Quran recitation or live radio before playing Adhan.
   - Provides a built-in Web Audio API harmonic Takbeer chime fallback so alerts work 100% offline.

3. **`prayer-ui.js` & `prayer.css` (Dashboard, Qibla Compass, Weekly Table & Settings UI)**:
   - Renders the 4-tab Islamic Prayer Experience inside `#prayerPage` and updates the live next-prayer badge on the Home page teaser card.

---

## 2. How Prayer Time Calculations Work

### Solar Position (Jean Meeus Equations)
For a given Gregorian date $(Y, M, D)$ and geographical coordinates $(\phi, \lambda)$:
1. Compute the Julian Date $JD$ at local noon.
2. Compute the number of days since J2000.0: $d = JD - 2451545.0$.
3. Calculate mean solar anomaly $g$, mean longitude $q$, ecliptic longitude $L$, and obliquity of the ecliptic $\epsilon$.
4. Derive **Solar Declination ($\delta$)** and **Equation of Time ($EqT$)**.

### Daily Prayer Formulas
- **Dhuhr (Solar Noon)**:
  $$\text{Dhuhr} = 12 - EqT + \text{TZ} - \frac{\lambda}{15} + \frac{1}{60}$$
  (including a 1-minute precaution after meridian transit).
- **Hour Angle Function $T(\alpha)$** for altitude angle $\alpha$ below the horizon:
  $$T(\alpha) = \frac{1}{15}\arccos\left(\frac{-\sin\alpha - \sin\phi\sin\delta}{\cos\phi\cos\delta}\right)$$
- **Fajr**: $\text{SolarNoon} - T(\alpha_{\text{Fajr}})$
- **Sunrise / Maghrib**: $\text{SolarNoon} \mp T(0.833^\circ)$ (accounting for solar semi-diameter and atmospheric refraction).
- **Asr**:
  $$A(n) = \frac{1}{15}\arccos\left(\frac{\sin(\operatorname{arccot}(n + \tan|\phi - \delta|)) - \sin\phi\sin\delta}{\cos\phi\cos\delta}\right)$$
  where $n = 1$ for Majority/Standard (Shafi'i, Maliki, Hanbali) and $n = 2$ for Hanafi.
- **Isha**: Either $\text{SolarNoon} + T(\alpha_{\text{Isha}})$ or $\text{Maghrib} + 90\text{ min}$ (Umm al-Qura / Qatar).

### Qibla Bearing Formula
Using the Kaaba coordinates $(\phi_K = 21.422487^\circ\text{ N}, \lambda_K = 39.826206^\circ\text{ E})$ and user coordinates $(\phi, \lambda)$:
$$\theta = \operatorname{atan2}\big(\sin(\lambda_K - \lambda),\ \cos\phi\tan\phi_K - \sin\phi\cos(\lambda_K - \lambda)\big)$$
normalized to $[0^\circ, 360^\circ)$ clockwise from True North.

---

## 3. Browser & OS Limitations (Background Notifications & Autoplay)

1. **Web Notifications**:
   - Require explicit user consent via `Notification.requestPermission()`.
   - Deliver visual system notifications when the browser tab is open in the foreground or background.
2. **Adhan Audio Autoplay**:
   - Modern browsers block uninitiated audio playback until the user has interacted with the page.
   - When the application tab is open, `PrayerService` plays the selected Adhan MP3 (or falls back to the offline Web Audio harmonic chime if offline).
   - If the browser application or tab is completely terminated by the user or mobile OS memory manager, web timers cannot run in the background without native OS alarm scheduling (such as Capacitor Local Notifications in the native Android/iOS build).
3. **Device Orientation Sensors (Qibla Compass)**:
   - Mobile devices with magnetometers support live compass rotation via `DeviceOrientationEvent` (requiring explicit permission on iOS 13+).
   - Desktops and laptops without magnetometers automatically display the exact static Qibla angle relative to True North.

