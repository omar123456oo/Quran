const test = require('node:test');
const assert = require('node:assert/strict');
const PrayerCalc = require('../prayer-calc.js');
const PrayerService = require('../prayer-service.js');

const mockStorage = () => {
    let store = {};
    return {
        getItem: (k) => store[k] || null,
        setItem: (k, v) => { store[k] = String(v); },
        removeItem: (k) => { delete store[k]; },
        clear: () => { store = {}; }
    };
};

// 1. Multi-City Prayer Times & Chronological Order
test('prayer-calc: calculates chronologically valid prayer times across multiple global cities', () => {
    const fixedDate = new Date('2026-03-21T12:00:00Z'); // Equinox test date
    const sampleCities = ['cairo', 'makkah', 'london', 'newyork', 'jakarta', 'istanbul'];

    for (const cid of sampleCities) {
        const city = PrayerCalc.CITIES.find(c => c.id === cid);
        assert.ok(city, `City ${cid} must exist in catalog`);

        const res = PrayerCalc.calculatePrayerTimes(fixedDate, {
            lat: city.lat,
            lng: city.lng,
            tz: city.tz,
            method: city.method
        });

        const { fajr, sunrise, dhuhr, asr, maghrib, isha } = res.times;
        assert.ok(fajr.totalMinutes < sunrise.totalMinutes, `${cid}: Fajr (${fajr.time24}) must precede Sunrise (${sunrise.time24})`);
        assert.ok(sunrise.totalMinutes < dhuhr.totalMinutes, `${cid}: Sunrise (${sunrise.time24}) must precede Dhuhr (${dhuhr.time24})`);
        assert.ok(dhuhr.totalMinutes < asr.totalMinutes, `${cid}: Dhuhr (${dhuhr.time24}) must precede Asr (${asr.time24})`);
        assert.ok(asr.totalMinutes < maghrib.totalMinutes, `${cid}: Asr (${asr.time24}) must precede Maghrib (${maghrib.time24})`);
        assert.ok(maghrib.totalMinutes < isha.totalMinutes, `${cid}: Maghrib (${maghrib.time24}) must precede Isha (${isha.time24})`);
    }
});

// 2. Calculation Methods & Umm Al-Qura 90-min Isha Interval
test('prayer-calc: supports all 8 calculation methods and Makkah 90-min Isha interval', () => {
    const fixedDate = new Date('2026-05-15T12:00:00Z');
    const makkah = PrayerCalc.CITIES.find(c => c.id === 'makkah');

    const makkahRes = PrayerCalc.calculatePrayerTimes(fixedDate, {
        lat: makkah.lat,
        lng: makkah.lng,
        tz: makkah.tz,
        method: 'MAKKAH'
    });

    assert.equal(
        makkahRes.times.isha.totalMinutes - makkahRes.times.maghrib.totalMinutes,
        90,
        'Umm al-Qura Isha must be exactly 90 minutes after Maghrib'
    );

    // Compare EGYPT (Fajr 19.5°) vs ISNA (Fajr 15°) at Cairo
    const cairo = PrayerCalc.CITIES.find(c => c.id === 'cairo');
    const egyptRes = PrayerCalc.calculatePrayerTimes(fixedDate, {
        lat: cairo.lat,
        lng: cairo.lng,
        tz: cairo.tz,
        method: 'EGYPT'
    });
    const isnaRes = PrayerCalc.calculatePrayerTimes(fixedDate, {
        lat: cairo.lat,
        lng: cairo.lng,
        tz: cairo.tz,
        method: 'ISNA'
    });

    assert.ok(
        egyptRes.times.fajr.totalMinutes < isnaRes.times.fajr.totalMinutes,
        'EGYPT (19.5°) Fajr must be earlier than ISNA (15°) Fajr'
    );
});

// 3. Asr Juristic Methods (Standard vs Hanafi) & Manual Adjustments
test('prayer-calc: Hanafi Asr is later than Standard Asr and manual adjustments shift times accurately', () => {
    const fixedDate = new Date('2026-06-10T12:00:00Z');
    const cairo = PrayerCalc.CITIES[0];

    const std = PrayerCalc.calculatePrayerTimes(fixedDate, {
        lat: cairo.lat,
        lng: cairo.lng,
        tz: cairo.tz,
        method: 'EGYPT',
        asrJuristic: 'STANDARD'
    });

    const hanafi = PrayerCalc.calculatePrayerTimes(fixedDate, {
        lat: cairo.lat,
        lng: cairo.lng,
        tz: cairo.tz,
        method: 'EGYPT',
        asrJuristic: 'HANAFI'
    });

    assert.ok(
        hanafi.times.asr.totalMinutes > std.times.asr.totalMinutes + 25,
        `Hanafi Asr (${hanafi.times.asr.time24}) must be significantly later than Standard Asr (${std.times.asr.time24})`
    );

    const adjusted = PrayerCalc.calculatePrayerTimes(fixedDate, {
        lat: cairo.lat,
        lng: cairo.lng,
        tz: cairo.tz,
        method: 'EGYPT',
        adjustments: { fajr: 3, maghrib: -2 }
    });

    assert.equal(adjusted.times.fajr.totalMinutes, std.times.fajr.totalMinutes + 3);
    assert.equal(adjusted.times.maghrib.totalMinutes, std.times.maghrib.totalMinutes - 2);
});

// 4. Qibla Bearing & Distance Accuracy
test('prayer-calc: calculates accurate Qibla bearing and distance to Makkah', () => {
    // Cairo -> Makkah (~136.1° SE, ~1280 km)
    const cairoQibla = PrayerCalc.calculateQibla(30.0444, 31.2357);
    assert.ok(cairoQibla.bearing >= 135 && cairoQibla.bearing <= 137, `Cairo Qibla should be ~136.1°, got ${cairoQibla.bearing}`);
    assert.ok(cairoQibla.distanceKm > 1200 && cairoQibla.distanceKm < 1350);

    // London -> Makkah (~119° ESE)
    const londonQibla = PrayerCalc.calculateQibla(51.5074, -0.1278);
    assert.ok(londonQibla.bearing >= 118 && londonQibla.bearing <= 120, `London Qibla should be ~119°, got ${londonQibla.bearing}`);

    // New York -> Makkah (~58.5° NE)
    const nyQibla = PrayerCalc.calculateQibla(40.7128, -74.0060);
    assert.ok(nyQibla.bearing >= 57 && nyQibla.bearing <= 60, `New York Qibla should be ~58.5°, got ${nyQibla.bearing}`);
});

// 5. Countdown & Current/Next Prayer Resolution
test('prayer-calc: resolves current prayer, next prayer, and countdown accurately', () => {
    const fixedDate = new Date('2026-03-21T10:00:00Z');
    const sched = PrayerCalc.calculatePrayerTimes(fixedDate, {
        lat: 30.0444,
        lng: 31.2357,
        tzOffset: 2,
        method: 'EGYPT'
    });

    // Simulate 11:00 local time (before Dhuhr)
    const beforeDhuhr = new Date(2026, 2, 21, 11, 0, 0);
    const state1 = PrayerCalc.getCurrentAndNextPrayer(sched, beforeDhuhr, null);
    assert.equal(state1.currentPrayer, 'fajr');
    assert.equal(state1.nextPrayer, 'dhuhr');
    assert.ok(state1.remainingSeconds > 0);
    assert.match(state1.countdownFormatted, /^\d{2}:\d{2}:\d{2}$/);

    // Simulate 23:00 local time (after Isha -> next prayer is tomorrow's Fajr)
    const afterIsha = new Date(2026, 2, 21, 23, 0, 0);
    const state2 = PrayerCalc.getCurrentAndNextPrayer(sched, afterIsha, null);
    assert.equal(state2.currentPrayer, 'isha');
    assert.equal(state2.nextPrayer, 'fajr');
    assert.equal(state2.isNextDayFajr, true);
});

// 6. Hijri & Gregorian Date Formatting
test('prayer-calc: formats Hijri and Gregorian dates in Arabic and English with offset support', () => {
    const d = new Date('2026-03-20T12:00:00Z');
    const dates0 = PrayerCalc.formatDates(d, 0, 'Africa/Cairo');
    const datesPlus1 = PrayerCalc.formatDates(d, 1, 'Africa/Cairo');

    assert.ok(dates0.hijriAr.length > 0);
    assert.ok(dates0.hijriEn.length > 0);
    assert.ok(dates0.gregorianAr.length > 0);
    assert.ok(dates0.gregorianEn.length > 0);
    assert.notEqual(dates0.hijriEn, datesPlus1.hijriEn, 'Hijri day adjustment should shift Hijri date');
});

// 7. PrayerService State, Tracker, Offline Cache & Permission Denial
test('prayer-service: manages cities, daily prayer tracker, offline cache, and geolocation denial', async () => {
    global.localStorage = mockStorage();
    PrayerService.init({ force: true, disableTicker: true });

    // Default city is Cairo
    assert.equal(PrayerService.prefs.cityId, 'cairo');
    assert.ok(PrayerService.todaySchedule);
    assert.ok(PrayerService.cachedSchedule, 'Must persist schedule to offline cache');

    // Switch city to Makkah
    PrayerService.selectCity('makkah');
    assert.equal(PrayerService.prefs.cityId, 'makkah');
    assert.equal(PrayerService.prefs.method, 'MAKKAH');

    // Daily prayer completion tracking
    let track = PrayerService.getDayTracking();
    assert.equal(track.completedCount, 0);

    PrayerService.togglePrayerCompleted('fajr');
    PrayerService.togglePrayerCompleted('dhuhr');
    track = PrayerService.getDayTracking();
    assert.equal(track.completedCount, 2);
    assert.equal(track.percentage, 40);

    // Weekly schedule produces 7 days
    const weekly = PrayerService.getWeeklySchedule();
    assert.equal(weekly.length, 7);
    assert.equal(weekly[0].isToday, true);

    // Geolocation denial rejects gracefully without crashing state
    global.navigator = {
        geolocation: {
            getCurrentPosition: (_success, error) => {
                error(new Error('User denied Geolocation'));
            }
        }
    };
    await assert.rejects(() => PrayerService.detectLocation());
    assert.equal(PrayerService.prefs.cityId, 'makkah', 'Previous city remains intact when GPS permission is denied');
});

