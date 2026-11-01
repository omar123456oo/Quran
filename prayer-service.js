/**
 * Prayer Times, Tracker, Qibla & Adhan Notification Service (prayer-service.js)
 * Coordinates location management, offline caching, daily prayer completion tracking,
 * live countdown timer, browser notifications, and Adhan audio playback.
 */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        const PC = root.PrayerCalc || (typeof require === 'function' ? require('./prayer-calc.js') : null);
        module.exports = factory(PC);
    } else {
        root.PrayerService = factory(root.PrayerCalc);
    }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (PrayerCalc) {
    'use strict';

    const PREFS_KEY = 'quran_prayer_prefs_v1';
    const TRACKER_KEY = 'quran_prayer_tracker_v1';
    const CACHE_KEY = 'quran_prayer_cache_v1';

    const ADHAN_VOICES = [
        {
            id: 'makkah',
            nameAr: 'أذان الحرم المكي الشريف',
            nameEn: 'Makkah Grand Mosque Adhan',
            url: 'https://www.islamcan.com/audio/adhan/azan1.mp3'
        },
        {
            id: 'madinah',
            nameAr: 'أذان المسجد النبوي الشريف',
            nameEn: 'Madinah Prophet\'s Mosque Adhan',
            url: 'https://www.islamcan.com/audio/adhan/azan2.mp3'
        },
        {
            id: 'cairo',
            nameAr: 'أذان القاهرة — مدرسة القراء المصريين',
            nameEn: 'Cairo Traditional Adhan',
            url: 'https://www.islamcan.com/audio/adhan/azan3.mp3'
        },
        {
            id: 'chime',
            nameAr: 'نغمة تكبير هادئة (تعمل دون إنترنت)',
            nameEn: 'Harmonic Takbeer Chime (100% Offline)',
            url: ''
        }
    ];

    const OBLIGATORY_PRAYERS = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];

    function defaultPreferences() {
        return {
            cityId: 'cairo',
            locationMode: 'city', // 'city' | 'gps' | 'custom'
            nameAr: 'القاهرة',
            nameEn: 'Cairo',
            countryAr: 'مصر',
            countryEn: 'Egypt',
            lat: 30.0444,
            lng: 31.2357,
            tz: 'Africa/Cairo',
            method: 'EGYPT',
            asrJuristic: 'STANDARD', // 'STANDARD' | 'HANAFI'
            timeFormat: '12h', // '12h' | '24h'
            hijriOffset: 0, // -2 to +2 days
            adjustments: {
                fajr: 0,
                sunrise: 0,
                dhuhr: 0,
                asr: 0,
                maghrib: 0,
                isha: 0
            },
            notificationsEnabled: false,
            adhanVoice: 'makkah',
            reminderMinutesBefore: 10, // 0 = disabled, 5, 10, 15, 20, 30
            prayerAlerts: {
                fajr: 'adhan',    // 'adhan' | 'beep' | 'silent' | 'off'
                dhuhr: 'adhan',
                asr: 'adhan',
                maghrib: 'adhan',
                isha: 'adhan'
            }
        };
    }

    const PrayerService = {
        prefs: defaultPreferences(),
        tracker: {},
        cachedSchedule: null,
        todaySchedule: null,
        countdownState: null,
        qibla: null,
        dates: null,
        adhanAudio: null,
        adhanPlaying: false,
        tickTimer: null,
        triggeredEvents: new Set(),
        listeners: new Set(),
        initialized: false,

        /* ------------------------------------------------------------ init */
        init(options = {}) {
            if (this.initialized && !options.force) return;

            if (!PrayerCalc) {
                if (typeof window !== 'undefined' && window.PrayerCalc) {
                    PrayerCalc = window.PrayerCalc;
                } else if (typeof require === 'function') {
                    try { PrayerCalc = require('./prayer-calc.js'); } catch (e) {}
                }
            }

            this.stopTicker();
            this.prefs = defaultPreferences();
            this.tracker = {};
            this.triggeredEvents.clear();
            this.adhanPlaying = false;

            this.loadPreferences();
            this.loadTracker();
            this.loadCachedSchedule();
            this.recalculate(options.now || new Date());

            if (!options.disableTicker && typeof window !== 'undefined') {
                this.startTicker();
            }

            this.initialized = true;
            this.notify();
        },

        /* --------------------------------------------- storage & persistence */
        loadPreferences() {
            try {
                if (typeof localStorage === 'undefined') return;
                const raw = localStorage.getItem(PREFS_KEY);
                if (!raw) return;
                const parsed = JSON.parse(raw);
                if (parsed && typeof parsed === 'object') {
                    const def = defaultPreferences();
                    this.prefs = Object.assign({}, def, parsed, {
                        adjustments: Object.assign({}, def.adjustments, parsed.adjustments || {}),
                        prayerAlerts: Object.assign({}, def.prayerAlerts, parsed.prayerAlerts || {})
                    });
                }
            } catch (e) {
                this.prefs = defaultPreferences();
            }
        },

        savePreferences() {
            try {
                if (typeof localStorage === 'undefined') return;
                localStorage.setItem(PREFS_KEY, JSON.stringify(this.prefs));
            } catch (e) {}
        },

        loadTracker() {
            try {
                if (typeof localStorage === 'undefined') return;
                const raw = localStorage.getItem(TRACKER_KEY);
                if (!raw) return;
                const parsed = JSON.parse(raw);
                if (parsed && typeof parsed === 'object') {
                    this.tracker = parsed;
                }
            } catch (e) {
                this.tracker = {};
            }
        },

        saveTracker() {
            try {
                if (typeof localStorage === 'undefined') return;
                localStorage.setItem(TRACKER_KEY, JSON.stringify(this.tracker));
            } catch (e) {}
        },

        loadCachedSchedule() {
            try {
                if (typeof localStorage === 'undefined') return;
                const raw = localStorage.getItem(CACHE_KEY);
                if (!raw) return;
                this.cachedSchedule = JSON.parse(raw);
            } catch (e) {
                this.cachedSchedule = null;
            }
        },

        saveCachedSchedule() {
            try {
                if (typeof localStorage === 'undefined') return;
                const payload = {
                    savedAt: Date.now(),
                    todaySchedule: this.todaySchedule,
                    qibla: this.qibla,
                    dates: this.dates
                };
                localStorage.setItem(CACHE_KEY, JSON.stringify(payload));
                this.cachedSchedule = payload;
            } catch (e) {}
        },

        /* ---------------------------------------------------- calculation */
        recalculate(now = new Date()) {
            if (!PrayerCalc) return;

            this.todaySchedule = PrayerCalc.calculatePrayerTimes(now, {
                lat: this.prefs.lat,
                lng: this.prefs.lng,
                tz: this.prefs.tz,
                method: this.prefs.method,
                asrJuristic: this.prefs.asrJuristic,
                adjustments: this.prefs.adjustments
            });

            this.countdownState = PrayerCalc.getCurrentAndNextPrayer(this.todaySchedule, now, this.prefs.tz);
            this.qibla = PrayerCalc.calculateQibla(this.prefs.lat, this.prefs.lng);
            this.dates = PrayerCalc.formatDates(now, this.prefs.hijriOffset, this.prefs.tz);

            this.saveCachedSchedule();
            this.notify();
        },

        /**
         * Generate a 7-day weekly prayer schedule starting from startDate
         */
        getWeeklySchedule(startDate = new Date()) {
            if (!PrayerCalc) return [];
            const days = [];
            for (let i = 0; i < 7; i++) {
                const d = new Date(startDate.getTime() + i * 86400000);
                const sched = PrayerCalc.calculatePrayerTimes(d, {
                    lat: this.prefs.lat,
                    lng: this.prefs.lng,
                    tz: this.prefs.tz,
                    method: this.prefs.method,
                    asrJuristic: this.prefs.asrJuristic,
                    adjustments: this.prefs.adjustments
                });
                const formattedDates = PrayerCalc.formatDates(d, this.prefs.hijriOffset, this.prefs.tz);
                days.push({
                    dateKey: sched.dateKey,
                    isToday: i === 0,
                    gregorianAr: formattedDates.gregorianAr,
                    gregorianEn: formattedDates.gregorianEn,
                    hijriAr: formattedDates.hijriAr,
                    hijriEn: formattedDates.hijriEn,
                    times: sched.times
                });
            }
            return days;
        },

        /* ------------------------------------------ location & settings API */
        selectCity(cityId) {
            if (!PrayerCalc) return false;
            const city = PrayerCalc.CITIES.find(c => c.id === cityId);
            if (!city) return false;

            this.prefs.cityId = city.id;
            this.prefs.locationMode = 'city';
            this.prefs.nameAr = city.nameAr;
            this.prefs.nameEn = city.nameEn;
            this.prefs.countryAr = city.countryAr;
            this.prefs.countryEn = city.countryEn;
            this.prefs.lat = city.lat;
            this.prefs.lng = city.lng;
            this.prefs.tz = city.tz;
            if (city.method) {
                this.prefs.method = city.method;
            }

            this.savePreferences();
            this.recalculate();
            return true;
        },

        setCustomCoordinates(lat, lng, nameAr = 'موقع مخصص', nameEn = 'Custom Location') {
            const numLat = Number(lat);
            const numLng = Number(lng);
            if (!Number.isFinite(numLat) || !Number.isFinite(numLng) || numLat < -90 || numLat > 90 || numLng < -180 || numLng > 180) {
                return false;
            }

            const nearest = PrayerCalc ? PrayerCalc.findNearestCity(numLat, numLng) : null;
            this.prefs.locationMode = 'custom';
            this.prefs.lat = Math.round(numLat * 10000) / 10000;
            this.prefs.lng = Math.round(numLng * 10000) / 10000;

            if (nearest && nearest.isCloseMatch) {
                this.prefs.cityId = nearest.city.id;
                this.prefs.nameAr = nearest.city.nameAr;
                this.prefs.nameEn = nearest.city.nameEn;
                this.prefs.countryAr = nearest.city.countryAr;
                this.prefs.countryEn = nearest.city.countryEn;
                this.prefs.tz = nearest.city.tz;
            } else {
                this.prefs.cityId = 'custom';
                this.prefs.nameAr = nameAr;
                this.prefs.nameEn = nameEn;
                this.prefs.countryAr = `${this.prefs.lat}°, ${this.prefs.lng}°`;
                this.prefs.countryEn = `${this.prefs.lat}°, ${this.prefs.lng}°`;
                try {
                    this.prefs.tz = Intl.DateTimeFormat().resolvedOptions().timeZone || null;
                } catch (e) {
                    this.prefs.tz = null;
                }
            }

            this.savePreferences();
            this.recalculate();
            return true;
        },

        /**
         * Detect user's coordinates via Browser Geolocation API
         */
        detectLocation() {
            return new Promise((resolve, reject) => {
                if (typeof navigator === 'undefined' || !navigator.geolocation) {
                    reject(new Error('GEOLOCATION_UNSUPPORTED'));
                    return;
                }

                navigator.geolocation.getCurrentPosition(
                    (pos) => {
                        const lat = pos.coords.latitude;
                        const lng = pos.coords.longitude;
                        const nearest = PrayerCalc ? PrayerCalc.findNearestCity(lat, lng) : null;

                        this.prefs.locationMode = 'gps';
                        this.prefs.lat = Math.round(lat * 10000) / 10000;
                        this.prefs.lng = Math.round(lng * 10000) / 10000;

                        if (nearest && nearest.isCloseMatch) {
                            this.prefs.cityId = nearest.city.id;
                            this.prefs.nameAr = nearest.city.nameAr;
                            this.prefs.nameEn = nearest.city.nameEn;
                            this.prefs.countryAr = nearest.city.countryAr;
                            this.prefs.countryEn = nearest.city.countryEn;
                            this.prefs.tz = nearest.city.tz;
                            this.prefs.method = nearest.city.method || this.prefs.method;
                        } else {
                            this.prefs.cityId = 'gps';
                            this.prefs.nameAr = 'موقعي الحالي (GPS)';
                            this.prefs.nameEn = 'Current Location (GPS)';
                            this.prefs.countryAr = `${this.prefs.lat}°, ${this.prefs.lng}°`;
                            this.prefs.countryEn = `${this.prefs.lat}°, ${this.prefs.lng}°`;
                            try {
                                this.prefs.tz = Intl.DateTimeFormat().resolvedOptions().timeZone || null;
                            } catch (e) {
                                this.prefs.tz = null;
                            }
                        }

                        this.savePreferences();
                        this.recalculate();
                        resolve(this.prefs);
                    },
                    (err) => {
                        reject(err);
                    },
                    { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
                );
            });
        },

        updateSettings(partial) {
            if (!partial || typeof partial !== 'object') return;
            if (partial.method && PrayerCalc && PrayerCalc.METHODS[partial.method]) {
                this.prefs.method = partial.method;
            }
            if (partial.asrJuristic === 'STANDARD' || partial.asrJuristic === 'HANAFI') {
                this.prefs.asrJuristic = partial.asrJuristic;
            }
            if (partial.timeFormat === '12h' || partial.timeFormat === '24h') {
                this.prefs.timeFormat = partial.timeFormat;
            }
            if (typeof partial.hijriOffset === 'number') {
                this.prefs.hijriOffset = Math.max(-2, Math.min(2, Math.round(partial.hijriOffset)));
            }
            if (partial.adjustments && typeof partial.adjustments === 'object') {
                for (const k of ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha']) {
                    if (k in partial.adjustments) {
                        const val = Number(partial.adjustments[k]);
                        if (Number.isFinite(val)) {
                            this.prefs.adjustments[k] = Math.max(-30, Math.min(30, Math.round(val)));
                        }
                    }
                }
            }
            if (typeof partial.notificationsEnabled === 'boolean') {
                this.prefs.notificationsEnabled = partial.notificationsEnabled;
            }
            if (partial.adhanVoice && ADHAN_VOICES.some(v => v.id === partial.adhanVoice)) {
                this.prefs.adhanVoice = partial.adhanVoice;
            }
            if (typeof partial.reminderMinutesBefore === 'number') {
                this.prefs.reminderMinutesBefore = Math.max(0, Math.min(60, Math.round(partial.reminderMinutesBefore)));
            }
            if (partial.prayerAlerts && typeof partial.prayerAlerts === 'object') {
                for (const p of OBLIGATORY_PRAYERS) {
                    if (partial.prayerAlerts[p]) {
                        this.prefs.prayerAlerts[p] = partial.prayerAlerts[p];
                    }
                }
            }

            this.savePreferences();
            this.recalculate();
        },

        /* -------------------------------------------- Daily Prayer Tracker */
        getTodayDateKey() {
            return this.todaySchedule ? this.todaySchedule.dateKey : new Date().toISOString().slice(0, 10);
        },

        getDayTracking(dateKey = this.getTodayDateKey()) {
            const entry = this.tracker[dateKey] || {};
            const result = {};
            let completedCount = 0;
            for (const p of OBLIGATORY_PRAYERS) {
                result[p] = !!entry[p];
                if (result[p]) completedCount++;
            }
            return {
                dateKey,
                prayers: result,
                completedCount,
                totalCount: 5,
                percentage: Math.round((completedCount / 5) * 100)
            };
        },

        togglePrayerCompleted(prayerKey, dateKey = this.getTodayDateKey()) {
            if (!OBLIGATORY_PRAYERS.includes(prayerKey)) return null;
            if (!this.tracker[dateKey]) {
                this.tracker[dateKey] = {};
            }
            this.tracker[dateKey][prayerKey] = !this.tracker[dateKey][prayerKey];
            this.saveTracker();
            this.notify();
            return this.getDayTracking(dateKey);
        },

        /* ------------------------------------ Ticker & Adhan Notifications */
        startTicker() {
            this.stopTicker();
            this.tickTimer = setInterval(() => {
                this.tick();
            }, 1000);
            if (this.tickTimer && typeof this.tickTimer.unref === 'function') {
                this.tickTimer.unref();
            }
        },

        stopTicker() {
            if (this.tickTimer) {
                clearInterval(this.tickTimer);
                this.tickTimer = null;
            }
        },

        tick(now = new Date()) {
            if (!PrayerCalc || !this.todaySchedule) return;

            // Check if date rolled over past midnight
            const parts = PrayerCalc.calculatePrayerTimes(now, {
                lat: this.prefs.lat,
                lng: this.prefs.lng,
                tz: this.prefs.tz,
                method: this.prefs.method,
                asrJuristic: this.prefs.asrJuristic,
                adjustments: this.prefs.adjustments
            });
            if (parts.dateKey !== this.todaySchedule.dateKey) {
                this.triggeredEvents.clear();
                this.recalculate(now);
                return;
            }

            this.countdownState = PrayerCalc.getCurrentAndNextPrayer(this.todaySchedule, now, this.prefs.tz);
            this.checkPrayerAlerts(now);
            this.notify();
        },

        checkPrayerAlerts(now = new Date()) {
            if (!this.prefs.notificationsEnabled || !this.todaySchedule) return;

            const nowTotalMinutes = now.getHours() * 60 + now.getMinutes();
            const nowSeconds = now.getSeconds();
            if (nowSeconds > 15) return; // Only trigger within the first 15s of the minute

            const dateKey = this.todaySchedule.dateKey;
            const reminderOffset = Number(this.prefs.reminderMinutesBefore) || 0;

            for (const p of OBLIGATORY_PRAYERS) {
                const mode = this.prefs.prayerAlerts[p] || 'off';
                if (mode === 'off') continue;

                const pTime = this.todaySchedule.times[p];
                if (!pTime) continue;

                // 1. Pre-prayer reminder check
                if (reminderOffset > 0 && nowTotalMinutes === pTime.totalMinutes - reminderOffset) {
                    const remKey = `${dateKey}:${p}:reminder`;
                    if (!this.triggeredEvents.has(remKey)) {
                        this.triggeredEvents.add(remKey);
                        this.fireReminderNotification(p, reminderOffset);
                    }
                }

                // 2. Exact prayer time check
                if (nowTotalMinutes === pTime.totalMinutes) {
                    const adhanKey = `${dateKey}:${p}:adhan`;
                    if (!this.triggeredEvents.has(adhanKey)) {
                        this.triggeredEvents.add(adhanKey);
                        this.firePrayerAlert(p, mode);
                    }
                }
            }
        },

        getPrayerName(prayerKey, lang = 'ar') {
            const names = {
                fajr: { ar: 'الفجر', en: 'Fajr' },
                sunrise: { ar: 'الشروق', en: 'Sunrise' },
                dhuhr: { ar: 'الظهر', en: 'Dhuhr' },
                asr: { ar: 'العصر', en: 'Asr' },
                maghrib: { ar: 'المغرب', en: 'Maghrib' },
                isha: { ar: 'العشاء', en: 'Isha' }
            };
            return (names[prayerKey] && names[prayerKey][lang]) || prayerKey;
        },

        async requestNotificationPermission() {
            if (typeof window === 'undefined' || !('Notification' in window)) {
                return 'unsupported';
            }
            if (Notification.permission === 'granted') {
                this.updateSettings({ notificationsEnabled: true });
                return 'granted';
            }
            try {
                const permission = await Notification.requestPermission();
                if (permission === 'granted') {
                    this.updateSettings({ notificationsEnabled: true });
                }
                return permission;
            } catch (e) {
                return 'denied';
            }
        },

        fireReminderNotification(prayerKey, minutesBefore) {
            const pNameAr = this.getPrayerName(prayerKey, 'ar');
            const title = `اقترب موعد صلاة ${pNameAr}`;
            const body = `متبقي ${minutesBefore} دقائق على أذان ${pNameAr} في ${this.prefs.nameAr}`;

            this.sendBrowserNotification(title, body);
            if (typeof window !== 'undefined' && window.App && typeof window.App.showToast === 'function') {
                window.App.showToast(`${title} (${minutesBefore} د)`, 'info');
            }
        },

        firePrayerAlert(prayerKey, mode) {
            const pNameAr = this.getPrayerName(prayerKey, 'ar');
            const title = `حان الآن موعد أذان ${pNameAr}`;
            const body = `حي على الصلاة — حان وقت صلاة ${pNameAr} حسب توقيت ${this.prefs.nameAr}`;

            this.sendBrowserNotification(title, body);
            if (typeof window !== 'undefined' && window.App && typeof window.App.showToast === 'function') {
                window.App.showToast(title, 'success');
            }

            if (mode === 'adhan') {
                this.playAdhan();
            } else if (mode === 'beep') {
                this.playHarmonicTakbeerChime();
            }
        },

        sendBrowserNotification(title, body) {
            if (typeof window === 'undefined' || !('Notification' in window)) return;
            if (Notification.permission === 'granted') {
                try {
                    new Notification(title, {
                        body,
                        icon: 'icons/icon-192.png',
                        badge: 'icons/icon-192.png'
                    });
                } catch (e) {}
            }
        },

        /**
         * Coordinate with Quran recitation and Radio so Adhan never overlaps other audio
         */
        pauseOtherAudioSources() {
            if (typeof window !== 'undefined') {
                if (window.AudioPlayer && typeof window.AudioPlayer.pause === 'function') {
                    const st = window.PlaybackStore ? window.PlaybackStore.get().status : null;
                    if (!st || st === 'playing' || st === 'buffering') {
                        window.AudioPlayer.pause();
                    }
                }
                if (window.RadioService && typeof window.RadioService.isPlaying === 'function' && window.RadioService.isPlaying()) {
                    window.RadioService.pause(false);
                }
            }
        },

        /**
         * Play selected Adhan voice with fallback to offline WebAudio harmonic chime
         */
        async playAdhan(voiceId = this.prefs.adhanVoice) {
            this.stopAdhan();
            this.pauseOtherAudioSources();

            const voice = ADHAN_VOICES.find(v => v.id === voiceId) || ADHAN_VOICES[0];
            if (!voice.url || voice.id === 'chime' || typeof Audio === 'undefined') {
                this.playHarmonicTakbeerChime();
                return;
            }

            this.adhanPlaying = true;
            this.notify();

            try {
                this.adhanAudio = new Audio(voice.url);
                this.adhanAudio.volume = 0.9;
                this.adhanAudio.addEventListener('ended', () => {
                    this.adhanPlaying = false;
                    this.notify();
                });
                this.adhanAudio.addEventListener('error', () => {
                    this.adhanPlaying = false;
                    this.playHarmonicTakbeerChime();
                    this.notify();
                });
                await this.adhanAudio.play();
            } catch (e) {
                this.adhanPlaying = false;
                this.playHarmonicTakbeerChime();
                this.notify();
            }
        },

        stopAdhan() {
            if (this.adhanAudio) {
                try {
                    this.adhanAudio.pause();
                    this.adhanAudio.removeAttribute('src');
                } catch (e) {}
                this.adhanAudio = null;
            }
            this.adhanPlaying = false;
            this.notify();
        },

        /**
         * Synthesize a serene, spiritual harmonic chime using Web Audio API (works 100% offline)
         */
        playHarmonicTakbeerChime() {
            if (typeof window === 'undefined') return;
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (!AudioCtx) return;

            try {
                const ctx = new AudioCtx();
                const notes = [440, 554.37, 659.25, 880]; // A4 major spiritual chord progression
                notes.forEach((freq, idx) => {
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.35);

                    gain.gain.setValueAtTime(0.001, ctx.currentTime + idx * 0.35);
                    gain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + idx * 0.35 + 0.08);
                    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + idx * 0.35 + 1.6);

                    osc.connect(gain);
                    gain.connect(ctx.destination);
                    osc.start(ctx.currentTime + idx * 0.35);
                    osc.stop(ctx.currentTime + idx * 0.35 + 1.65);
                });
            } catch (e) {}
        },

        /* --------------------------------------------------- formatting */
        formatPrayerTime(timeObj) {
            if (!timeObj) return '--:--';
            if (this.prefs.timeFormat === '24h') {
                return timeObj.time24;
            }
            const isEn = typeof I18n !== 'undefined' && I18n.getLanguage() === 'en';
            return isEn ? timeObj.time12En : timeObj.time12Ar;
        },

        /* --------------------------------------------------- pub/sub */
        subscribe(fn) {
            this.listeners.add(fn);
            try { fn(this.getSnapshot()); } catch (e) {}
            return () => this.listeners.delete(fn);
        },

        notify() {
            const snap = this.getSnapshot();
            this.listeners.forEach(fn => {
                try { fn(snap); } catch (e) {}
            });
        },

        getSnapshot() {
            return {
                prefs: this.prefs,
                todaySchedule: this.todaySchedule,
                countdownState: this.countdownState,
                qibla: this.qibla,
                dates: this.dates,
                tracking: this.getDayTracking(),
                adhanPlaying: this.adhanPlaying,
                adhanVoices: ADHAN_VOICES
            };
        }
    };

    return PrayerService;
});

