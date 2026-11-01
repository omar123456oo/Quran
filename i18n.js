/**
 * Internationalization (i18n) Module
 * Handles language switching between Arabic (العربية) and English,
 * updating document direction (RTL/LTR), titles, navigation, and UI strings.
 */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.I18n = factory();
    }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    const translations = {
        ar: {
            app_title: 'القرآن الكريم - Qur\'an Kareem | المصحف الشريف كاملًا مع التلاوات والتفسير',
            logo: 'القرآن الكريم',
            search_placeholder: 'بحث في القرآن الكريم...',
            toggle_theme: 'تبديل الوضع',
            toggle_lang: 'English',
            lang_label: 'EN',
            close: 'إغلاق',

            // Navigation
            nav: {
                home: 'الرئيسية',
                surah: 'القراءة',
                mushaf: 'المصحف القارئ',
                radio: 'الإذاعة',
                explore: 'استكشف',
                playlists: 'القوائم',
                adhkar: 'الأذكار',
                bookmarks: 'المحفوظات',
                downloads: 'التنزيلات',
                resources: 'المصادر',
                settings: 'الإعدادات'
            },

            // Connectivity
            offline_msg: 'أنت غير متصل بالإنترنت — يمكنك قراءة صفحات المصحف والاستماع إلى السور المحمّلة.',
            offline_downloads: 'التنزيلات',

            // Home Page
            home: {
                title: 'القرآن الكريم',
                surah_count: '114 سورة',
                explore_title: 'استكشف القرآن الكريم',
                explore_desc: 'السور المكية والمدنية، قصص الأنبياء، ومعجزاتهم كما وردت في القرآن',
                radio_title: 'الإذاعة القرآنية المباركة',
                radio_live: 'مباشر',
                radio_desc: 'بث حي متواصل لأعذب التلاوات القرآنية بأصوات نخبة من كبار القراء',
                index_title: 'فهرس المصحف',
                tab_surahs: 'السور',
                tab_juzs: 'الأجزاء',
                tab_pages: 'الصفحات',
                ayah_suffix: 'آية',
                meccan: 'مكية',
                medinan: 'مدنية',
                juz: 'الجزء'
            },

            // Surah Reading Page
            reader: {
                back: 'العودة',
                back_to_ayah: 'العودة للآية الجارية',
                follow: 'تتبع التشغيل',
                tafseer: 'التفسير',
                translation: 'الترجمة',
                copy: 'نسخ الآية',
                bookmark: 'حفظ العلامة',
                play_ayah: 'استماع للآية'
            },

            // Radio Page
            radio: {
                header_title: 'الإذاعة القرآنية المباركة',
                header_subtitle: 'بث مباشر ومتواصل لأعذب التلاوات القرآنية على مدار الساعة',
                live: 'مباشر',
                ready: 'جاهز للاستماع',
                playing: 'البث المباشر يعمل الآن',
                loading: 'جارٍ الاتصال بالإذاعة…',
                reconnecting: 'جارٍ إعادة المحاولة…',
                error: 'تعذر الاتصال بالبث',
                retry: 'إعادة المحاولة',
                search_placeholder: 'ابحث عن محطة أو قارئ…',
                tab_all: 'الكل',
                tab_reciters: 'القراء',
                tab_thematic: 'تلاوات ومنوعات',
                mini_title: 'الإذاعة القرآنية',
                mini_live: 'بث مباشر متواصل',
                mini_hide: 'إخفاء المشغل',
                mini_toast: 'تم إخفاء المشغل المصغر (البث مستمر في الخلفية)'
            },

            // Adhkar Page
            adhkar: {
                title: 'الأذكار',
                subtitle: 'أذكار المسلم في جميع الأوقات',
                morning: 'أذكار الصباح',
                evening: 'أذكار المساء',
                sleep: 'أذكار النوم',
                prayer: 'أذكار الصلاة',
                general: 'أذكار عامة'
            },

            // Audio Player
            player: {
                reciter: 'القارئ',
                choose_reciter: 'اختيار القارئ',
                play: 'تشغيل',
                pause: 'إيقاف مؤقت',
                next: 'العنصر التالي',
                prev: 'العنصر السابق',
                repeat_off: 'التكرار متوقف',
                repeat_all: 'تكرار القائمة كاملة',
                repeat_one: 'تكرار السورة الحالية',
                shuffle: 'تشغيل عشوائي',
                volume: 'مستوى الصوت',
                locate: 'عرض في القارئ'
            },

            // Toasts & Alerts
            toast: {
                lang_changed: 'تم تبديل اللغة إلى العربية'
            }
        },

        en: {
            app_title: 'Holy Quran - Qur\'an Kareem | Complete Mushaf with Recitations & Tafseer',
            logo: 'Holy Quran',
            search_placeholder: 'Search the Holy Quran...',
            toggle_theme: 'Toggle Theme',
            toggle_lang: 'العربية',
            lang_label: 'عربي',
            close: 'Close',

            // Navigation
            nav: {
                home: 'Home',
                surah: 'Reader',
                mushaf: 'Digital Mushaf',
                radio: 'Radio',
                explore: 'Explore',
                playlists: 'Playlists',
                adhkar: 'Adhkar',
                bookmarks: 'Bookmarks',
                downloads: 'Downloads',
                resources: 'Resources',
                settings: 'Settings'
            },

            // Connectivity
            offline_msg: 'You are offline — you can still read cached pages and listen to downloaded surahs.',
            offline_downloads: 'Downloads',

            // Home Page
            home: {
                title: 'The Holy Quran',
                surah_count: '114 Surahs',
                explore_title: 'Explore the Holy Quran',
                explore_desc: 'Makki & Madani surahs, stories of the prophets, and their miracles',
                radio_title: 'Holy Quran Radio',
                radio_live: 'Live',
                radio_desc: 'Continuous live broadcasting of Quran recitations by renowned reciters',
                index_title: 'Quran Index',
                tab_surahs: 'Surahs',
                tab_juzs: 'Juzs',
                tab_pages: 'Pages',
                ayah_suffix: 'Verses',
                meccan: 'Meccan',
                medinan: 'Medinan',
                juz: 'Juz'
            },

            // Surah Reading Page
            reader: {
                back: 'Back',
                back_to_ayah: 'Back to current verse',
                follow: 'Follow playback',
                tafseer: 'Tafseer',
                translation: 'Translation',
                copy: 'Copy verse',
                bookmark: 'Bookmark',
                play_ayah: 'Play verse'
            },

            // Radio Page
            radio: {
                header_title: 'Holy Quran Radio',
                header_subtitle: 'Continuous 24/7 live streaming of the Holy Quran',
                live: 'LIVE',
                ready: 'Ready to play',
                playing: 'Live stream playing',
                loading: 'Connecting to stream…',
                reconnecting: 'Reconnecting…',
                error: 'Connection failed',
                retry: 'Retry',
                search_placeholder: 'Search stations or reciters…',
                tab_all: 'All',
                tab_reciters: 'Reciters',
                tab_thematic: 'Thematic Recitations',
                mini_title: 'Quran Radio',
                mini_live: 'Live stream active',
                mini_hide: 'Hide mini player',
                mini_toast: 'Mini player hidden (audio continues playing)'
            },

            // Adhkar Page
            adhkar: {
                title: 'Adhkar',
                subtitle: 'Daily supplications and remembrances',
                morning: 'Morning Adhkar',
                evening: 'Evening Adhkar',
                sleep: 'Sleep Adhkar',
                prayer: 'Prayer Adhkar',
                general: 'General Adhkar'
            },

            // Audio Player
            player: {
                reciter: 'Reciter',
                choose_reciter: 'Choose Reciter',
                play: 'Play',
                pause: 'Pause',
                next: 'Next Item',
                prev: 'Previous Item',
                repeat_off: 'Repeat Off',
                repeat_all: 'Repeat All',
                repeat_one: 'Repeat Surah',
                shuffle: 'Shuffle',
                volume: 'Volume',
                locate: 'Show in Reader'
            },

            // Toasts & Alerts
            toast: {
                lang_changed: 'Language switched to English'
            }
        }
    };

    const I18n = {
        currentLang: 'ar',
        listeners: new Set(),

        init(lang) {
            const chosen = lang || this.getStoredLanguage() || 'ar';
            this.setLanguage(chosen, false);
        },

        getStoredLanguage() {
            try {
                if (typeof localStorage === 'undefined') return 'ar';
                const settings = JSON.parse(localStorage.getItem('quran_settings'));
                if (settings && (settings.language === 'ar' || settings.language === 'en')) {
                    return settings.language;
                }
            } catch (e) {}
            return 'ar';
        },

        getLanguage() {
            return this.currentLang;
        },

        isRTL() {
            return this.currentLang === 'ar';
        },

        t(path, fallback = '') {
            const keys = path.split('.');
            let curr = translations[this.currentLang];
            for (const k of keys) {
                if (curr && typeof curr === 'object' && k in curr) {
                    curr = curr[k];
                } else {
                    // Fallback to Arabic if missing in English
                    let fb = translations.ar;
                    for (const fbk of keys) {
                        if (fb && typeof fb === 'object' && fbk in fb) fb = fb[fbk];
                        else { fb = null; break; }
                    }
                    return typeof fb === 'string' ? fb : fallback;
                }
            }
            return typeof curr === 'string' ? curr : fallback;
        },

        setLanguage(lang, showToast = true) {
            if (lang !== 'ar' && lang !== 'en') lang = 'ar';
            this.currentLang = lang;

            if (typeof document !== 'undefined') {
                document.documentElement.lang = lang;
                document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
                document.documentElement.setAttribute('data-lang', lang);
                document.title = this.t('app_title');

                this.updateDOM();
            }

            if (typeof App !== 'undefined' && App.settings) {
                App.settings.language = lang;
                try {
                    localStorage.setItem('quran_settings', JSON.stringify(App.settings));
                } catch (e) {}
                if (showToast && typeof App.showToast === 'function') {
                    App.showToast(this.t('toast.lang_changed'), 'success');
                }
            }

            // Re-render dependent dynamic components if available
            if (typeof RadioUI !== 'undefined' && RadioUI.initialized) {
                RadioUI.renderPage();
            }
            if (typeof QuranDisplay !== 'undefined' && QuranDisplay.surahs && QuranDisplay.surahs.length) {
                QuranDisplay.displaySurahs(QuranDisplay.surahs);
            }

            this.notify();
        },

        toggleLanguage() {
            const next = this.currentLang === 'ar' ? 'en' : 'ar';
            this.setLanguage(next, true);
        },

        updateDOM() {
            if (typeof document === 'undefined') return;

            // Update language toggle button label
            const langLabel = document.getElementById('langLabel');
            if (langLabel) {
                langLabel.textContent = this.t('lang_label');
            }
            const langToggle = document.getElementById('langToggle');
            if (langToggle) {
                const title = this.t('toggle_lang');
                langToggle.title = title;
                langToggle.setAttribute('aria-label', title);
            }

            // Elements with data-i18n
            document.querySelectorAll('[data-i18n]').forEach(el => {
                const key = el.getAttribute('data-i18n');
                const val = this.t(key);
                if (val) el.textContent = val;
            });

            // Elements with data-i18n-placeholder
            document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
                const key = el.getAttribute('data-i18n-placeholder');
                const val = this.t(key);
                if (val) el.placeholder = val;
            });

            // Elements with data-i18n-title
            document.querySelectorAll('[data-i18n-title]').forEach(el => {
                const key = el.getAttribute('data-i18n-title');
                const val = this.t(key);
                if (val) {
                    el.title = val;
                    el.setAttribute('aria-label', val);
                }
            });
        },

        subscribe(fn) {
            this.listeners.add(fn);
            return () => this.listeners.delete(fn);
        },

        notify() {
            this.listeners.forEach(fn => {
                try { fn(this.currentLang); } catch (e) {}
            });
        }
    };

    return I18n;
});

