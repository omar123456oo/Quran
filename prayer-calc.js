/**
 * Prayer Times & Qibla Astronomical Calculation Engine (prayer-calc.js)
 * Pure, dependency-free JavaScript implementation of standard solar position
 * equations (Jean Meeus) for accurate Islamic prayer times, Qibla direction,
 * great-circle distance to Makkah, and Hijri/Gregorian calendar formatting.
 */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.PrayerCalc = factory();
    }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    const DEG2RAD = Math.PI / 180;
    const RAD2DEG = 180 / Math.PI;

    // Coordinates of the Holy Kaaba in Makkah
    const KAABA_LAT = 21.422487;
    const KAABA_LNG = 39.826206;

    /**
     * Standard Islamic Calculation Methods
     */
    const METHODS = {
        EGYPT: {
            id: 'EGYPT',
            nameAr: 'الهيئة المصرية العامة للمساحة',
            nameEn: 'Egyptian General Authority of Survey',
            fajrAngle: 19.5,
            ishaAngle: 17.5,
            ishaInterval: 0,
            maghribOffset: 0
        },
        MAKKAH: {
            id: 'MAKKAH',
            nameAr: 'تقويم أم القرى — مكة المكرمة',
            nameEn: 'Umm al-Qura University, Makkah',
            fajrAngle: 18.5,
            ishaAngle: 0,
            ishaInterval: 90, // 90 minutes after Maghrib
            maghribOffset: 0
        },
        MWL: {
            id: 'MWL',
            nameAr: 'رابطة العالم الإسلامي',
            nameEn: 'Muslim World League (MWL)',
            fajrAngle: 18,
            ishaAngle: 17,
            ishaInterval: 0,
            maghribOffset: 0
        },
        KARACHI: {
            id: 'KARACHI',
            nameAr: 'جامعة العلوم الإسلامية بكراتشي',
            nameEn: 'University of Islamic Sciences, Karachi',
            fajrAngle: 18,
            ishaAngle: 18,
            ishaInterval: 0,
            maghribOffset: 0
        },
        ISNA: {
            id: 'ISNA',
            nameAr: 'الجمعية الإسلامية لأمريكا الشمالية (ISNA)',
            nameEn: 'Islamic Society of North America (ISNA)',
            fajrAngle: 15,
            ishaAngle: 15,
            ishaInterval: 0,
            maghribOffset: 0
        },
        DUBAI: {
            id: 'DUBAI',
            nameAr: 'دائرة الشؤون الإسلامية والعمل الخيري بدبي',
            nameEn: 'Dubai / UAE IACAD',
            fajrAngle: 18.2,
            ishaAngle: 18.2,
            ishaInterval: 0,
            maghribOffset: 0
        },
        KUWAIT: {
            id: 'KUWAIT',
            nameAr: 'وزارة الأوقاف والشؤون الإسلامية — الكويت',
            nameEn: 'Kuwait Ministry of Awqaf',
            fajrAngle: 18,
            ishaAngle: 17.5,
            ishaInterval: 0,
            maghribOffset: 0
        },
        QATAR: {
            id: 'QATAR',
            nameAr: 'دار التقويم القطري',
            nameEn: 'Qatar Calendar House',
            fajrAngle: 18,
            ishaAngle: 0,
            ishaInterval: 90,
            maghribOffset: 0
        }
    };

    /**
     * Curated catalog of major cities with coordinates, IANA timezones, and default calculation methods.
     */
    const CITIES = [
        { id: 'cairo', nameAr: 'القاهرة', nameEn: 'Cairo', countryAr: 'مصر', countryEn: 'Egypt', lat: 30.0444, lng: 31.2357, tz: 'Africa/Cairo', method: 'EGYPT' },
        { id: 'alexandria', nameAr: 'الإسكندرية', nameEn: 'Alexandria', countryAr: 'مصر', countryEn: 'Egypt', lat: 31.2001, lng: 29.9187, tz: 'Africa/Cairo', method: 'EGYPT' },
        { id: 'giza', nameAr: 'الجيزة', nameEn: 'Giza', countryAr: 'مصر', countryEn: 'Egypt', lat: 30.0131, lng: 31.2089, tz: 'Africa/Cairo', method: 'EGYPT' },
        { id: 'mansoura', nameAr: 'المنصورة', nameEn: 'Mansoura', countryAr: 'مصر', countryEn: 'Egypt', lat: 31.0409, lng: 31.3785, tz: 'Africa/Cairo', method: 'EGYPT' },
        { id: 'tanta', nameAr: 'طنطا', nameEn: 'Tanta', countryAr: 'مصر', countryEn: 'Egypt', lat: 30.7865, lng: 31.0004, tz: 'Africa/Cairo', method: 'EGYPT' },
        { id: 'asyut', nameAr: 'أسيوط', nameEn: 'Asyut', countryAr: 'مصر', countryEn: 'Egypt', lat: 27.1783, lng: 31.1859, tz: 'Africa/Cairo', method: 'EGYPT' },
        { id: 'luxor', nameAr: 'الأقصر', nameEn: 'Luxor', countryAr: 'مصر', countryEn: 'Egypt', lat: 25.6872, lng: 32.6396, tz: 'Africa/Cairo', method: 'EGYPT' },
        { id: 'aswan', nameAr: 'أسوان', nameEn: 'Aswan', countryAr: 'مصر', countryEn: 'Egypt', lat: 24.0889, lng: 32.8998, tz: 'Africa/Cairo', method: 'EGYPT' },
        { id: 'portsaid', nameAr: 'بورسعيد', nameEn: 'Port Said', countryAr: 'مصر', countryEn: 'Egypt', lat: 31.2653, lng: 32.3019, tz: 'Africa/Cairo', method: 'EGYPT' },
        { id: 'suez', nameAr: 'السويس', nameEn: 'Suez', countryAr: 'مصر', countryEn: 'Egypt', lat: 29.9668, lng: 32.5498, tz: 'Africa/Cairo', method: 'EGYPT' },
        { id: 'makkah', nameAr: 'مكة المكرمة', nameEn: 'Makkah', countryAr: 'السعودية', countryEn: 'Saudi Arabia', lat: 21.4225, lng: 39.8262, tz: 'Asia/Riyadh', method: 'MAKKAH' },
        { id: 'madinah', nameAr: 'المدينة المنورة', nameEn: 'Madinah', countryAr: 'السعودية', countryEn: 'Saudi Arabia', lat: 24.4672, lng: 39.6112, tz: 'Asia/Riyadh', method: 'MAKKAH' },
        { id: 'riyadh', nameAr: 'الرياض', nameEn: 'Riyadh', countryAr: 'السعودية', countryEn: 'Saudi Arabia', lat: 24.7136, lng: 46.6753, tz: 'Asia/Riyadh', method: 'MAKKAH' },
        { id: 'jeddah', nameAr: 'جدة', nameEn: 'Jeddah', countryAr: 'السعودية', countryEn: 'Saudi Arabia', lat: 21.5433, lng: 39.1728, tz: 'Asia/Riyadh', method: 'MAKKAH' },
        { id: 'dammam', nameAr: 'الدمام', nameEn: 'Dammam', countryAr: 'السعودية', countryEn: 'Saudi Arabia', lat: 26.4207, lng: 50.0888, tz: 'Asia/Riyadh', method: 'MAKKAH' },
        { id: 'jerusalem', nameAr: 'القدس الشريف', nameEn: 'Al-Quds (Jerusalem)', countryAr: 'فلسطين', countryEn: 'Palestine', lat: 31.7780, lng: 35.2354, tz: 'Asia/Jerusalem', method: 'MWL' },
        { id: 'dubai', nameAr: 'دبي', nameEn: 'Dubai', countryAr: 'الإمارات', countryEn: 'UAE', lat: 25.2048, lng: 55.2708, tz: 'Asia/Dubai', method: 'DUBAI' },
        { id: 'abudhabi', nameAr: 'أبو ظبي', nameEn: 'Abu Dhabi', countryAr: 'الإمارات', countryEn: 'UAE', lat: 24.4539, lng: 54.3773, tz: 'Asia/Dubai', method: 'DUBAI' },
        { id: 'kuwait', nameAr: 'الكويت', nameEn: 'Kuwait City', countryAr: 'الكويت', countryEn: 'Kuwait', lat: 29.3759, lng: 47.9774, tz: 'Asia/Kuwait', method: 'KUWAIT' },
        { id: 'doha', nameAr: 'الدوحة', nameEn: 'Doha', countryAr: 'قطر', countryEn: 'Qatar', lat: 25.2854, lng: 51.5310, tz: 'Asia/Qatar', method: 'QATAR' },
        { id: 'manama', nameAr: 'المنامة', nameEn: 'Manama', countryAr: 'البحرين', countryEn: 'Bahrain', lat: 26.2285, lng: 50.5860, tz: 'Asia/Bahrain', method: 'MAKKAH' },
        { id: 'muscat', nameAr: 'مسقط', nameEn: 'Muscat', countryAr: 'عُمان', countryEn: 'Oman', lat: 23.5880, lng: 58.3829, tz: 'Asia/Muscat', method: 'MAKKAH' },
        { id: 'amman', nameAr: 'عمّان', nameEn: 'Amman', countryAr: 'الأردن', countryEn: 'Jordan', lat: 31.9454, lng: 35.9284, tz: 'Asia/Amman', method: 'MWL' },
        { id: 'beirut', nameAr: 'بيروت', nameEn: 'Beirut', countryAr: 'لبنان', countryEn: 'Lebanon', lat: 33.8938, lng: 35.5018, tz: 'Asia/Beirut', method: 'MWL' },
        { id: 'damascus', nameAr: 'دمشق', nameEn: 'Damascus', countryAr: 'سوريا', countryEn: 'Syria', lat: 33.5138, lng: 36.2765, tz: 'Asia/Damascus', method: 'MWL' },
        { id: 'baghdad', nameAr: 'بغداد', nameEn: 'Baghdad', countryAr: 'العراق', countryEn: 'Iraq', lat: 33.3152, lng: 44.3661, tz: 'Asia/Baghdad', method: 'MWL' },
        { id: 'khartoum', nameAr: 'الخرطوم', nameEn: 'Khartoum', countryAr: 'السودان', countryEn: 'Sudan', lat: 15.5007, lng: 32.5599, tz: 'Africa/Khartoum', method: 'EGYPT' },
        { id: 'tripoli', nameAr: 'طرابلس', nameEn: 'Tripoli', countryAr: 'ليبيا', countryEn: 'Libya', lat: 32.8872, lng: 13.1913, tz: 'Africa/Tripoli', method: 'EGYPT' },
        { id: 'tunis', nameAr: 'تونس', nameEn: 'Tunis', countryAr: 'تونس', countryEn: 'Tunisia', lat: 36.8065, lng: 10.1815, tz: 'Africa/Tunis', method: 'MWL' },
        { id: 'algiers', nameAr: 'الجزائر', nameEn: 'Algiers', countryAr: 'الجزائر', countryEn: 'Algeria', lat: 36.7538, lng: 3.0588, tz: 'Africa/Algiers', method: 'MWL' },
        { id: 'casablanca', nameAr: 'الدار البيضاء', nameEn: 'Casablanca', countryAr: 'المغرب', countryEn: 'Morocco', lat: 33.5731, lng: -7.5898, tz: 'Africa/Casablanca', method: 'MWL' },
        { id: 'istanbul', nameAr: 'إسطنبول', nameEn: 'Istanbul', countryAr: 'تركيا', countryEn: 'Turkey', lat: 41.0082, lng: 28.9784, tz: 'Europe/Istanbul', method: 'MWL' },
        { id: 'london', nameAr: 'لندن', nameEn: 'London', countryAr: 'المملكة المتحدة', countryEn: 'United Kingdom', lat: 51.5074, lng: -0.1278, tz: 'Europe/London', method: 'MWL' },
        { id: 'paris', nameAr: 'باريس', nameEn: 'Paris', countryAr: 'فرنسا', countryEn: 'France', lat: 48.8566, lng: 2.3522, tz: 'Europe/Paris', method: 'MWL' },
        { id: 'berlin', nameAr: 'برلين', nameEn: 'Berlin', countryAr: 'ألمانيا', countryEn: 'Germany', lat: 52.5200, lng: 13.4050, tz: 'Europe/Berlin', method: 'MWL' },
        { id: 'newyork', nameAr: 'نيويورك', nameEn: 'New York', countryAr: 'الولايات المتحدة', countryEn: 'United States', lat: 40.7128, lng: -74.0060, tz: 'America/New_York', method: 'ISNA' },
        { id: 'chicago', nameAr: 'شيكاغو', nameEn: 'Chicago', countryAr: 'الولايات المتحدة', countryEn: 'United States', lat: 41.8781, lng: -87.6298, tz: 'America/Chicago', method: 'ISNA' },
        { id: 'toronto', nameAr: 'تورونتو', nameEn: 'Toronto', countryAr: 'كندا', countryEn: 'Canada', lat: 43.6532, lng: -79.3832, tz: 'America/Toronto', method: 'ISNA' },
        { id: 'kualalumpur', nameAr: 'كوالالمبور', nameEn: 'Kuala Lumpur', countryAr: 'ماليزيا', countryEn: 'Malaysia', lat: 3.1390, lng: 101.6869, tz: 'Asia/Kuala_Lumpur', method: 'MWL' },
        { id: 'jakarta', nameAr: 'جاكرتا', nameEn: 'Jakarta', countryAr: 'إندونيسيا', countryEn: 'Indonesia', lat: -6.2088, lng: 106.8456, tz: 'Asia/Jakarta', method: 'MWL' }
    ];

    /* -------------------------------------------------- Math Helpers */
    function dsin(d) { return Math.sin(d * DEG2RAD); }
    function dcos(d) { return Math.cos(d * DEG2RAD); }
    function dtan(d) { return Math.tan(d * DEG2RAD); }
    function darcsin(x) { return Math.asin(Math.max(-1, Math.min(1, x))) * RAD2DEG; }
    function darccos(x) { return Math.acos(Math.max(-1, Math.min(1, x))) * RAD2DEG; }
    function darctan2(y, x) { return Math.atan2(y, x) * RAD2DEG; }
    function darccot(x) { return Math.atan(1 / x) * RAD2DEG; }

    function fixAngle(a) {
        return a - 360 * Math.floor(a / 360);
    }

    function fixHour(h) {
        return h - 24 * Math.floor(h / 24);
    }

    /**
     * Calculate Julian Date for a given Gregorian year, month (1-12), day (1-31)
     */
    function julianDate(year, month, day) {
        let y = year;
        let m = month;
        if (m <= 2) {
            y -= 1;
            m += 12;
        }
        const A = Math.floor(y / 100);
        const B = 2 - A + Math.floor(A / 4);
        return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + day + B - 1524.5;
    }

    /**
     * Compute Sun's Declination (deg) and Equation of Time (hours) for Julian Date jd
     */
    function sunPosition(jd) {
        const D = jd - 2451545.0;
        const g = fixAngle(357.529 + 0.98560028 * D);
        const q = fixAngle(280.459 + 0.98564736 * D);
        const L = fixAngle(q + 1.915 * dsin(g) + 0.020 * dsin(2 * g));

        const e = 23.439 - 0.00000036 * D;
        const RA = darctan2(dcos(e) * dsin(L), dcos(L)) / 15;
        const eqt = q / 15 - fixHour(RA);
        const decl = darcsin(dsin(e) * dsin(L));

        return { declination: decl, equation: eqt };
    }

    /**
     * Get timezone UTC offset in hours (e.g. +2 for Africa/Cairo in winter, +3 in DST)
     * for a specific date and optional IANA timeZone string.
     */
    function getTimezoneOffsetHours(date, timeZone) {
        if (timeZone) {
            try {
                // Format date in UTC and target timezone to compute exact offset including DST
                const utcDate = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
                const tzDate = new Date(date.toLocaleString('en-US', { timeZone }));
                const diffMinutes = Math.round((tzDate.getTime() - utcDate.getTime()) / 60000);
                return diffMinutes / 60;
            } catch (e) {
                // Fallback to system timezone offset
            }
        }
        return -date.getTimezoneOffset() / 60;
    }

    /**
     * Extract local year, month, day in the target timezone
     */
    function getDatePartsInTz(date, timeZone) {
        if (timeZone) {
            try {
                const parts = new Intl.DateTimeFormat('en-US', {
                    timeZone,
                    year: 'numeric',
                    month: 'numeric',
                    day: 'numeric'
                }).formatToParts(date);
                const map = {};
                parts.forEach(p => { map[p.type] = p.value; });
                return {
                    year: Number(map.year),
                    month: Number(map.month),
                    day: Number(map.day)
                };
            } catch (e) {}
        }
        return {
            year: date.getFullYear(),
            month: date.getMonth() + 1,
            day: date.getDate()
        };
    }

    /**
     * Calculate hour angle for a given sun altitude angle below horizon
     */
    function sunAngleTime(angle, lat, decl, direction) {
        const term = (-dsin(angle) - dsin(lat) * dsin(decl)) / (dcos(lat) * dcos(decl));
        // High latitude guard: clamp if sun does not reach angle
        const clamped = Math.max(-1, Math.min(1, term));
        const t = darccos(clamped) / 15;
        return direction === 'ccw' ? -t : t;
    }

    /**
     * Calculate Asr time offset from solar noon
     * shadowFactor = 1 (Standard: Shafi'i, Maliki, Hanbali) or 2 (Hanafi)
     */
    function asrTimeOffset(shadowFactor, lat, decl) {
        const angle = -darccot(shadowFactor + dtan(Math.abs(lat - decl)));
        return sunAngleTime(angle, lat, decl, 'cw');
    }

    /**
     * Format fractional hours (0..24) to HH:MM (24h) or h:MM AM/PM (12h) and total minutes from midnight
     */
    function hoursToTimeObject(fractionalHours, adjustmentsMin = 0) {
        let totalMinutes = Math.round(fractionalHours * 60) + (Number(adjustmentsMin) || 0);
        totalMinutes = ((totalMinutes % 1440) + 1440) % 1440;
        const hours24 = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        const time24 = `${String(hours24).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;

        const periodAr = hours24 >= 12 ? 'م' : 'ص';
        const periodEn = hours24 >= 12 ? 'PM' : 'AM';
        const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
        const time12Ar = `${hours12}:${String(minutes).padStart(2, '0')} ${periodAr}`;
        const time12En = `${hours12}:${String(minutes).padStart(2, '0')} ${periodEn}`;

        return {
            hours24,
            minutes,
            totalMinutes,
            time24,
            time12Ar,
            time12En
        };
    }

    /**
     * Calculate all daily prayer times for a given date and options.
     * @param {Date} date - Date object
     * @param {Object} options
     *   - lat: number (latitude)
     *   - lng: number (longitude)
     *   - tz: string (optional IANA timezone e.g. 'Africa/Cairo')
     *   - tzOffset: number (optional explicit UTC offset in hours)
     *   - method: string ('EGYPT', 'MAKKAH', 'MWL', 'KARACHI', 'ISNA', 'DUBAI', 'KUWAIT', 'QATAR')
     *   - asrJuristic: string ('STANDARD' | 'HANAFI')
     *   - adjustments: { fajr, sunrise, dhuhr, asr, maghrib, isha } in minutes
     */
    function calculatePrayerTimes(date = new Date(), options = {}) {
        const lat = Number.isFinite(Number(options.lat)) ? Number(options.lat) : 30.0444;
        const lng = Number.isFinite(Number(options.lng)) ? Number(options.lng) : 31.2357;
        const methodObj = METHODS[options.method] || METHODS.EGYPT;
        const shadowFactor = options.asrJuristic === 'HANAFI' ? 2 : 1;
        const adj = Object.assign({ fajr: 0, sunrise: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0 }, options.adjustments || {});

        const parts = getDatePartsInTz(date, options.tz);
        const tzOffset = typeof options.tzOffset === 'number'
            ? options.tzOffset
            : getTimezoneOffsetHours(date, options.tz);

        const jd = julianDate(parts.year, parts.month, parts.day) - lng / (15 * 24);
        const sun = sunPosition(jd + 0.5); // solar position at local noon
        const decl = sun.declination;
        const eqt = sun.equation;

        // Solar Noon (Dhuhr) in local standard time (hours)
        const noon = fixHour(12 - eqt + tzOffset - lng / 15);

        // Sunrise & Sunset angle accounts for solar semi-diameter + atmospheric refraction (0.833 deg)
        const sunriseAngle = 0.833;
        const fajrRaw = noon + sunAngleTime(methodObj.fajrAngle, lat, decl, 'ccw');
        const sunriseRaw = noon + sunAngleTime(sunriseAngle, lat, decl, 'ccw');
        // Add 1 minute precaution after astronomical meridian transit for Dhuhr
        const dhuhrRaw = noon + (1 / 60);
        const asrRaw = noon + asrTimeOffset(shadowFactor, lat, decl);
        const sunsetRaw = noon + sunAngleTime(sunriseAngle, lat, decl, 'cw');
        const maghribRaw = sunsetRaw + (methodObj.maghribOffset || 0) / 60;

        let ishaRaw;
        if (methodObj.ishaInterval && methodObj.ishaInterval > 0) {
            ishaRaw = maghribRaw + methodObj.ishaInterval / 60;
        } else {
            ishaRaw = noon + sunAngleTime(methodObj.ishaAngle, lat, decl, 'cw');
        }

        const times = {
            fajr: hoursToTimeObject(fajrRaw, adj.fajr),
            sunrise: hoursToTimeObject(sunriseRaw, adj.sunrise),
            dhuhr: hoursToTimeObject(dhuhrRaw, adj.dhuhr),
            asr: hoursToTimeObject(asrRaw, adj.asr),
            maghrib: hoursToTimeObject(maghribRaw, adj.maghrib),
            isha: hoursToTimeObject(ishaRaw, adj.isha)
        };

        return {
            dateKey: `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`,
            parts,
            tzOffset,
            method: methodObj.id,
            asrJuristic: options.asrJuristic === 'HANAFI' ? 'HANAFI' : 'STANDARD',
            times
        };
    }

    /**
     * Determine current and next obligatory prayer given a schedule and current time in the target timezone.
     */
    function getCurrentAndNextPrayer(schedule, now = new Date(), timeZone = null) {
        const PRAYERS_ORDER = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];
        let nowHours = now.getHours();
        let nowMinutes = now.getMinutes();
        let nowSeconds = now.getSeconds();

        if (timeZone) {
            try {
                const parts = new Intl.DateTimeFormat('en-US', {
                    timeZone,
                    hour: 'numeric',
                    minute: 'numeric',
                    second: 'numeric',
                    hour12: false
                }).formatToParts(now);
                const map = {};
                parts.forEach(p => { map[p.type] = p.value; });
                nowHours = Number(map.hour) % 24;
                nowMinutes = Number(map.minute);
                nowSeconds = Number(map.second);
            } catch (e) {}
        }

        const currentSecondsOfDay = nowHours * 3600 + nowMinutes * 60 + nowSeconds;

        let currentPrayer = 'isha';
        let nextPrayer = 'fajr';
        let isNextDayFajr = false;

        for (let i = 0; i < PRAYERS_ORDER.length; i++) {
            const pKey = PRAYERS_ORDER[i];
            const pSec = schedule.times[pKey].totalMinutes * 60;
            if (currentSecondsOfDay < pSec) {
                nextPrayer = pKey;
                currentPrayer = i === 0 ? 'isha' : PRAYERS_ORDER[i - 1];
                break;
            }
            if (i === PRAYERS_ORDER.length - 1) {
                // Past Isha: current is Isha, next is tomorrow's Fajr
                currentPrayer = 'isha';
                nextPrayer = 'fajr';
                isNextDayFajr = true;
            }
        }

        const nextPrayerMinutes = schedule.times[nextPrayer].totalMinutes;
        const prevPrayerMinutes = schedule.times[currentPrayer].totalMinutes;

        let remainingSeconds;
        let totalWindowSeconds;

        if (isNextDayFajr) {
            remainingSeconds = (1440 * 60 - currentSecondsOfDay) + nextPrayerMinutes * 60;
            totalWindowSeconds = (1440 - prevPrayerMinutes + nextPrayerMinutes) * 60;
        } else if (nextPrayer === 'fajr' && currentSecondsOfDay < nextPrayerMinutes * 60) {
            // After midnight, before Fajr
            remainingSeconds = nextPrayerMinutes * 60 - currentSecondsOfDay;
            totalWindowSeconds = (1440 - prevPrayerMinutes + nextPrayerMinutes) * 60;
        } else {
            remainingSeconds = nextPrayerMinutes * 60 - currentSecondsOfDay;
            totalWindowSeconds = Math.max(60, (nextPrayerMinutes - prevPrayerMinutes) * 60);
        }

        const elapsedSeconds = Math.max(0, totalWindowSeconds - remainingSeconds);
        const progressPct = Math.max(0, Math.min(100, Math.round((elapsedSeconds / totalWindowSeconds) * 100)));

        const remHours = Math.floor(remainingSeconds / 3600);
        const remMins = Math.floor((remainingSeconds % 3600) / 60);
        const remSecs = remainingSeconds % 60;
        const countdownFormatted = `${String(remHours).padStart(2, '0')}:${String(remMins).padStart(2, '0')}:${String(remSecs).padStart(2, '0')}`;

        return {
            currentPrayer,
            nextPrayer,
            isNextDayFajr,
            remainingSeconds,
            progressPct,
            countdownFormatted
        };
    }

    /**
     * Calculate Qibla direction (degrees clockwise from True North [0, 360))
     * and great-circle distance in km to the Kaaba in Makkah.
     */
    function calculateQibla(lat, lng) {
        const phi1 = Number(lat) * DEG2RAD;
        const phi2 = KAABA_LAT * DEG2RAD;
        const deltaLambda = (KAABA_LNG - Number(lng)) * DEG2RAD;

        const y = Math.sin(deltaLambda);
        const x = Math.cos(phi1) * Math.tan(phi2) - Math.sin(phi1) * Math.cos(deltaLambda);
        let bearing = Math.atan2(y, x) * RAD2DEG;
        bearing = ((bearing % 360) + 360) % 360;

        // Haversine distance to Kaaba in km
        const dPhi = phi2 - phi1;
        const a = Math.sin(dPhi / 2) ** 2 + Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) ** 2;
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const distanceKm = Math.round(6371 * c);

        const directionsAr = ['الشمال (N)', 'الشمال الشرقي (NE)', 'الشرق (E)', 'الجنوب الشرقي (SE)', 'الجنوب (S)', 'الجنوب الغربي (SW)', 'الغرب (W)', 'الشمال الغربي (NW)'];
        const directionsEn = ['North (N)', 'Northeast (NE)', 'East (E)', 'Southeast (SE)', 'South (S)', 'Southwest (SW)', 'West (W)', 'Northwest (NW)'];
        const dirIdx = Math.round(bearing / 45) % 8;

        return {
            bearing: Math.round(bearing * 10) / 10,
            distanceKm,
            cardinalAr: directionsAr[dirIdx],
            cardinalEn: directionsEn[dirIdx]
        };
    }

    /**
     * Format Hijri and Gregorian dates for a given Date object and optional day adjustment (-2..+2)
     */
    function formatDates(date = new Date(), hijriAdjustmentDays = 0, timeZone = null) {
        const adjMs = (Number(hijriAdjustmentDays) || 0) * 86400000;
        const adjustedDate = new Date(date.getTime() + adjMs);
        const tzOpts = timeZone ? { timeZone } : {};

        let hijriAr = '';
        let hijriEn = '';
        try {
            hijriAr = new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura', Object.assign({
                day: 'numeric',
                month: 'long',
                year: 'numeric'
            }, tzOpts)).format(adjustedDate);
        } catch (e) {
            hijriAr = adjustedDate.toLocaleDateString('ar');
        }

        try {
            hijriEn = new Intl.DateTimeFormat('en-US-u-ca-islamic-umalqura', Object.assign({
                day: 'numeric',
                month: 'long',
                year: 'numeric'
            }, tzOpts)).format(adjustedDate);
        } catch (e) {
            hijriEn = adjustedDate.toLocaleDateString('en-US');
        }

        let gregorianAr = '';
        let gregorianEn = '';
        try {
            gregorianAr = new Intl.DateTimeFormat('ar-EG', Object.assign({
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric'
            }, tzOpts)).format(date);
            gregorianEn = new Intl.DateTimeFormat('en-US', Object.assign({
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric'
            }, tzOpts)).format(date);
        } catch (e) {
            gregorianAr = date.toDateString();
            gregorianEn = date.toDateString();
        }

        return {
            hijriAr,
            hijriEn,
            gregorianAr,
            gregorianEn
        };
    }

    /**
     * Find the nearest curated city to given (lat, lng) coordinates
     */
    function findNearestCity(lat, lng) {
        let best = CITIES[0];
        let bestDist = Infinity;
        for (const c of CITIES) {
            const dLat = c.lat - lat;
            const dLng = c.lng - lng;
            const dist = dLat * dLat + dLng * dLng;
            if (dist < bestDist) {
                bestDist = dist;
                best = c;
            }
        }
        // Approx distance in degrees
        const degDist = Math.sqrt(bestDist);
        return {
            city: best,
            isCloseMatch: degDist < 1.2 // Within ~120km of curated city
        };
    }

    return {
        METHODS,
        CITIES,
        KAABA_LAT,
        KAABA_LNG,
        calculatePrayerTimes,
        getCurrentAndNextPrayer,
        calculateQibla,
        formatDates,
        findNearestCity
    };
});

