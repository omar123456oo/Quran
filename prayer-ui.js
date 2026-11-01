/**
 * Prayer Times, Qibla, Daily Tracker & Adhan Settings UI Controller (prayer-ui.js)
 * Renders the Islamic Prayer Experience dashboard, interactive SVG Qibla compass,
 * 7-day weekly timetable, daily prayer completion tracker, and calculation/Adhan settings.
 */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory(root.PrayerService, root.PrayerCalc, root.App);
    } else {
        root.PrayerUI = factory(root.PrayerService, root.PrayerCalc, root.App);
    }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (PrayerService, PrayerCalc, App) {
    'use strict';

    const PRAYER_META = [
        { key: 'fajr', icon: 'fa-cloud-moon', obligatory: true },
        { key: 'sunrise', icon: 'fa-sun', obligatory: false },
        { key: 'dhuhr', icon: 'fa-certificate', obligatory: true },
        { key: 'asr', icon: 'fa-cloud-sun', obligatory: true },
        { key: 'maghrib', icon: 'fa-mountain-sun', obligatory: true },
        { key: 'isha', icon: 'fa-moon', obligatory: true }
    ];

    const PrayerUI = {
        activeTab: 'dashboard', // 'dashboard' | 'qibla' | 'weekly' | 'settings'
        compassActive: false,
        deviceHeading: null,
        orientationHandler: null,
        initialized: false,

        /* ------------------------------------------------------------ init */
        init() {
            if (this.initialized) return;

            if (!PrayerService && typeof window !== 'undefined' && window.PrayerService) {
                PrayerService = window.PrayerService;
            }
            if (!PrayerCalc && typeof window !== 'undefined' && window.PrayerCalc) {
                PrayerCalc = window.PrayerCalc;
            }
            if (!App && typeof window !== 'undefined' && window.App) {
                App = window.App;
            }

            if (PrayerService) {
                PrayerService.init();
            }

            this.setupEventListeners();

            if (PrayerService) {
                PrayerService.subscribe((snap) => this.onStateUpdate(snap));
            }

            this.initialized = true;
        },

        show() {
            this.renderPage();
            if (PrayerService) {
                this.onStateUpdate(PrayerService.getSnapshot());
            }
        },

        /* --------------------------------------------- event delegation */
        setupEventListeners() {
            // Home teaser card navigation
            document.addEventListener('click', (e) => {
                const teaser = e.target.closest('[data-page-go="prayer"]');
                if (teaser) {
                    e.preventDefault();
                    if (App && typeof App.navigateToPage === 'function') {
                        App.navigateToPage('prayer');
                    }
                }
            });

            const page = document.getElementById('prayerPage');
            if (!page) return;

            page.addEventListener('click', async (e) => {
                // Sub-navigation tabs
                const tabBtn = e.target.closest('[data-prayer-tab]');
                if (tabBtn) {
                    const tab = tabBtn.getAttribute('data-prayer-tab');
                    this.activeTab = tab;
                    if (tab !== 'qibla' && this.compassActive) {
                        this.stopCompass();
                    }
                    this.renderPage();
                    return;
                }

                // GPS auto-detect button
                const gpsBtn = e.target.closest('#prayerDetectGpsBtn, #prayerHeroGpsBtn');
                if (gpsBtn) {
                    await this.handleGpsDetect(gpsBtn);
                    return;
                }

                // Toggle prayer completed in tracker
                const trackBtn = e.target.closest('[data-track-prayer]');
                if (trackBtn) {
                    const pKey = trackBtn.getAttribute('data-track-prayer');
                    if (PrayerService) {
                        PrayerService.togglePrayerCompleted(pKey);
                        this.renderPage();
                    }
                    return;
                }

                // Quick toggle notification mode on prayer card
                const quickAlertBtn = e.target.closest('[data-quick-alert]');
                if (quickAlertBtn) {
                    const pKey = quickAlertBtn.getAttribute('data-quick-alert');
                    if (PrayerService) {
                        const cur = PrayerService.prefs.prayerAlerts[pKey] || 'adhan';
                        const order = ['adhan', 'beep', 'silent', 'off'];
                        const next = order[(order.indexOf(cur) + 1) % order.length];
                        PrayerService.updateSettings({
                            notificationsEnabled: true,
                            prayerAlerts: { [pKey]: next }
                        });
                        this.renderPage();
                    }
                    return;
                }

                // Compass sensor toggle
                const compassBtn = e.target.closest('#qiblaCompassToggleBtn');
                if (compassBtn) {
                    await this.toggleCompass();
                    return;
                }

                // Request Browser Notification Permission
                const permBtn = e.target.closest('#prayerReqPermBtn');
                if (permBtn && PrayerService) {
                    const res = await PrayerService.requestNotificationPermission();
                    if (App && typeof App.showToast === 'function') {
                        const isEn = typeof I18n !== 'undefined' && I18n.getLanguage() === 'en';
                        if (res === 'granted') {
                            App.showToast(isEn ? 'Notifications enabled!' : 'تم تفعيل إشعارات مواقيت الصلاة بنجاح', 'success');
                        } else if (res === 'denied') {
                            App.showToast(isEn ? 'Notification permission denied by browser' : 'تم رفض إذن الإشعارات من المتصفح', 'error');
                        } else {
                            App.showToast(isEn ? 'Notifications unsupported in this browser' : 'الإشعارات غير مدعومة في هذا المتصفح', 'info');
                        }
                    }
                    this.renderPage();
                    return;
                }

                // Test / Stop Adhan audio button
                const testAdhanBtn = e.target.closest('#prayerTestAdhanBtn');
                if (testAdhanBtn && PrayerService) {
                    if (PrayerService.adhanPlaying) {
                        PrayerService.stopAdhan();
                    } else {
                        await PrayerService.playAdhan();
                    }
                    this.renderPage();
                    return;
                }

                // Save custom coordinates
                const saveCoordsBtn = e.target.closest('#prayerSaveCustomCoordsBtn');
                if (saveCoordsBtn && PrayerService) {
                    const latInput = document.getElementById('prayerCustomLat');
                    const lngInput = document.getElementById('prayerCustomLng');
                    if (latInput && lngInput) {
                        const ok = PrayerService.setCustomCoordinates(latInput.value, lngInput.value);
                        if (App && typeof App.showToast === 'function') {
                            const isEn = typeof I18n !== 'undefined' && I18n.getLanguage() === 'en';
                            App.showToast(
                                ok ? (isEn ? 'Coordinates updated' : 'تم تحديث الإحداثيات وحساب المواقيت')
                                   : (isEn ? 'Invalid coordinates' : 'يرجى إدخال خطوط طول وعرض صحيحة'),
                                ok ? 'success' : 'error'
                            );
                        }
                        this.renderPage();
                    }
                    return;
                }

                // Reset manual adjustments
                const resetAdjBtn = e.target.closest('#prayerResetAdjBtn');
                if (resetAdjBtn && PrayerService) {
                    PrayerService.updateSettings({
                        adjustments: { fajr: 0, sunrise: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0 }
                    });
                    this.renderPage();
                    return;
                }
            });

            page.addEventListener('change', (e) => {
                if (!PrayerService) return;
                const target = e.target;

                if (target.id === 'prayerCitySelect') {
                    PrayerService.selectCity(target.value);
                    this.renderPage();
                } else if (target.id === 'prayerMethodSelect') {
                    PrayerService.updateSettings({ method: target.value });
                    this.renderPage();
                } else if (target.id === 'prayerAsrSelect') {
                    PrayerService.updateSettings({ asrJuristic: target.value });
                    this.renderPage();
                } else if (target.id === 'prayerTimeFormatSelect') {
                    PrayerService.updateSettings({ timeFormat: target.value });
                    this.renderPage();
                } else if (target.id === 'prayerHijriOffsetSelect') {
                    PrayerService.updateSettings({ hijriOffset: Number(target.value) });
                    this.renderPage();
                } else if (target.id === 'prayerNotifToggle') {
                    PrayerService.updateSettings({ notificationsEnabled: target.checked });
                    if (target.checked) {
                        PrayerService.requestNotificationPermission().then(() => this.renderPage());
                    } else {
                        this.renderPage();
                    }
                } else if (target.id === 'prayerAdhanVoiceSelect') {
                    PrayerService.updateSettings({ adhanVoice: target.value });
                } else if (target.id === 'prayerReminderSelect') {
                    PrayerService.updateSettings({ reminderMinutesBefore: Number(target.value) });
                } else if (target.hasAttribute('data-alert-prayer')) {
                    const pKey = target.getAttribute('data-alert-prayer');
                    PrayerService.updateSettings({
                        prayerAlerts: { [pKey]: target.value }
                    });
                } else if (target.hasAttribute('data-adj-prayer')) {
                    const pKey = target.getAttribute('data-adj-prayer');
                    PrayerService.updateSettings({
                        adjustments: { [pKey]: Number(target.value) }
                    });
                    this.renderPage();
                }
            });
        },

        async handleGpsDetect(btn) {
            if (!PrayerService) return;
            const isEn = typeof I18n !== 'undefined' && I18n.getLanguage() === 'en';
            const origHtml = btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${isEn ? 'Locating…' : 'جارٍ تحديد الموقع…'}`;

            try {
                await PrayerService.detectLocation();
                if (App && typeof App.showToast === 'function') {
                    App.showToast(
                        isEn ? `Location updated: ${PrayerService.prefs.nameEn}` : `تم تحديد الموقع: ${PrayerService.prefs.nameAr}`,
                        'success'
                    );
                }
            } catch (err) {
                if (App && typeof App.showToast === 'function') {
                    App.showToast(
                        isEn
                            ? 'Location permission denied or unavailable. You can choose your city manually.'
                            : 'تعذر الوصول للموقع الجغرافي. يمكنك اختيار مدينتك يدويًا من القائمة.',
                        'error'
                    );
                }
            } finally {
                btn.disabled = false;
                btn.innerHTML = origHtml;
                this.renderPage();
            }
        },

        /* --------------------------------------------- Live Qibla Compass */
        async toggleCompass() {
            if (this.compassActive) {
                this.stopCompass();
                this.renderPage();
                return;
            }

            if (typeof window === 'undefined' || !('DeviceOrientationEvent' in window)) {
                if (App && typeof App.showToast === 'function') {
                    const isEn = typeof I18n !== 'undefined' && I18n.getLanguage() === 'en';
                    App.showToast(
                        isEn ? 'Orientation sensors are not available on this device.' : 'حساسات البوصلة غير متوفرة على هذا الجهاز، يتم عرض الاتجاه الجغرافي الثابت.',
                        'info'
                    );
                }
                return;
            }

            // iOS 13+ requires explicit permission
            if (typeof DeviceOrientationEvent.requestPermission === 'function') {
                try {
                    const state = await DeviceOrientationEvent.requestPermission();
                    if (state !== 'granted') {
                        if (App && typeof App.showToast === 'function') {
                            App.showToast('تم رفض إذن الوصول لحساسات الاتجاه', 'error');
                        }
                        return;
                    }
                } catch (e) {
                    return;
                }
            }

            this.compassActive = true;
            this.orientationHandler = (ev) => {
                let heading = null;
                if (typeof ev.webkitCompassHeading === 'number') {
                    heading = ev.webkitCompassHeading;
                } else if (typeof ev.alpha === 'number') {
                    heading = (360 - ev.alpha) % 360;
                }
                if (heading !== null) {
                    this.deviceHeading = Math.round(heading);
                    this.updateCompassDial();
                }
            };

            window.addEventListener('deviceorientationabsolute', this.orientationHandler, true);
            window.addEventListener('deviceorientation', this.orientationHandler, true);
            this.renderPage();
        },

        stopCompass() {
            this.compassActive = false;
            this.deviceHeading = null;
            if (this.orientationHandler && typeof window !== 'undefined') {
                window.removeEventListener('deviceorientationabsolute', this.orientationHandler, true);
                window.removeEventListener('deviceorientation', this.orientationHandler, true);
                this.orientationHandler = null;
            }
        },

        updateCompassDial() {
            const dial = document.getElementById('qiblaCompassDial');
            const headingLabel = document.getElementById('qiblaDeviceHeading');
            if (!dial || !PrayerService || !PrayerService.qibla) return;

            const rotation = this.deviceHeading !== null ? -this.deviceHeading : 0;
            dial.style.transform = `rotate(${rotation}deg)`;
            if (headingLabel) {
                headingLabel.textContent = this.deviceHeading !== null ? `${this.deviceHeading}°` : '--°';
            }
        },

        /* ---------------------------------------- Reactive State Updates */
        onStateUpdate(snap) {
            if (!snap || !snap.todaySchedule || !snap.countdownState) return;
            const isEn = typeof I18n !== 'undefined' && I18n.getLanguage() === 'en';

            // Update Home Page teaser badge if present
            const homeNextBadge = document.getElementById('homePrayerNextBadge');
            if (homeNextBadge && PrayerService) {
                const nextName = PrayerService.getPrayerName(snap.countdownState.nextPrayer, isEn ? 'en' : 'ar');
                const nextTimeObj = snap.todaySchedule.times[snap.countdownState.nextPrayer];
                const formattedTime = PrayerService.formatPrayerTime(nextTimeObj);
                homeNextBadge.textContent = `${nextName} · ${formattedTime} (${snap.countdownState.countdownFormatted})`;
            }

            // Fast DOM update of live countdown elements without re-rendering full page
            const countdownEl = document.getElementById('prayerLiveCountdown');
            const progressFill = document.getElementById('prayerProgressFill');
            const nextNameEl = document.getElementById('prayerNextName');
            const currentNameEl = document.getElementById('prayerCurrentName');

            if (countdownEl) {
                countdownEl.textContent = snap.countdownState.countdownFormatted;
            }
            if (progressFill) {
                progressFill.style.width = `${snap.countdownState.progressPct}%`;
            }
            if (nextNameEl && PrayerService) {
                nextNameEl.textContent = PrayerService.getPrayerName(snap.countdownState.nextPrayer, isEn ? 'en' : 'ar');
            }
            if (currentNameEl && PrayerService) {
                currentNameEl.textContent = PrayerService.getPrayerName(snap.countdownState.currentPrayer, isEn ? 'en' : 'ar');
            }
        },

        /* ---------------------------------------------------- Page Render */
        renderPage() {
            const page = document.getElementById('prayerPage');
            if (!page || !PrayerService) return;

            const snap = PrayerService.getSnapshot();
            const isEn = typeof I18n !== 'undefined' && I18n.getLanguage() === 'en';
            const t = (k, fb) => (typeof I18n !== 'undefined' ? I18n.t(k, fb) : fb);

            const cityDisplay = isEn ? `${snap.prefs.nameEn}, ${snap.prefs.countryEn}` : `${snap.prefs.nameAr}، ${snap.prefs.countryAr}`;
            const hijriDisplay = snap.dates ? (isEn ? snap.dates.hijriEn : snap.dates.hijriAr) : '';
            const gregDisplay = snap.dates ? (isEn ? snap.dates.gregorianEn : snap.dates.gregorianAr) : '';
            const nextPrayerName = PrayerService.getPrayerName(snap.countdownState.nextPrayer, isEn ? 'en' : 'ar');
            const currentPrayerName = PrayerService.getPrayerName(snap.countdownState.currentPrayer, isEn ? 'en' : 'ar');
            const nextPrayerTime = PrayerService.formatPrayerTime(snap.todaySchedule.times[snap.countdownState.nextPrayer]);

            page.innerHTML = `
                <div class="prayer-container">
                    <!-- Top Hero Dashboard -->
                    <section class="prayer-hero" aria-label="${t('prayer.title', 'مواقيت الصلاة')}">
                        <div class="prayer-hero-top">
                            <div class="prayer-location-pill">
                                <i class="fas fa-location-dot" aria-hidden="true"></i>
                                <span>${cityDisplay}</span>
                                <button type="button" class="prayer-gps-mini-btn" id="prayerHeroGpsBtn" title="${isEn ? 'Detect my location (GPS)' : 'تحديد موقعي الحالي (GPS)'}">
                                    <i class="fas fa-location-crosshairs" aria-hidden="true"></i>
                                </button>
                            </div>
                            <div class="prayer-dates-pill">
                                <span class="prayer-hijri-date"><i class="fas fa-moon" aria-hidden="true"></i> ${hijriDisplay}</span>
                                <span class="prayer-date-sep">•</span>
                                <span class="prayer-greg-date">${gregDisplay}</span>
                            </div>
                        </div>

                        <div class="prayer-hero-main">
                            <div class="prayer-current-tag">
                                <span class="prayer-pulse-dot" aria-hidden="true"></span>
                                <span>${isEn ? 'Current Prayer:' : 'الصلاة الحالية:'} <strong id="prayerCurrentName">${currentPrayerName}</strong></span>
                            </div>

                            <div class="prayer-next-label">
                                ${isEn ? 'Next Prayer:' : 'الصلاة القادمة:'} <strong id="prayerNextName">${nextPrayerName}</strong>
                                <span class="prayer-next-at">(${nextPrayerTime})</span>
                            </div>

                            <div class="prayer-countdown-clock" id="prayerLiveCountdown" dir="ltr">
                                ${snap.countdownState.countdownFormatted}
                            </div>

                            <div class="prayer-progress-wrap" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${snap.countdownState.progressPct}">
                                <div class="prayer-progress-fill" id="prayerProgressFill" style="width: ${snap.countdownState.progressPct}%"></div>
                            </div>
                        </div>

                        <!-- Sub-navigation Tabs -->
                        <nav class="prayer-subtabs" role="tablist" aria-label="${isEn ? 'Prayer Sections' : 'أقسام مواقيت الصلاة'}">
                            <button type="button" class="prayer-subtab ${this.activeTab === 'dashboard' ? 'active' : ''}" data-prayer-tab="dashboard" role="tab" aria-selected="${this.activeTab === 'dashboard'}">
                                <i class="fas fa-mosque" aria-hidden="true"></i>
                                <span>${isEn ? 'Prayer Times & Tracker' : 'المواقيت والمتابعة'}</span>
                            </button>
                            <button type="button" class="prayer-subtab ${this.activeTab === 'qibla' ? 'active' : ''}" data-prayer-tab="qibla" role="tab" aria-selected="${this.activeTab === 'qibla'}">
                                <i class="fas fa-compass" aria-hidden="true"></i>
                                <span>${isEn ? 'Qibla Direction' : 'اتجاه القبلة'}</span>
                            </button>
                            <button type="button" class="prayer-subtab ${this.activeTab === 'weekly' ? 'active' : ''}" data-prayer-tab="weekly" role="tab" aria-selected="${this.activeTab === 'weekly'}">
                                <i class="fas fa-calendar-week" aria-hidden="true"></i>
                                <span>${isEn ? 'Weekly Schedule' : 'الجدول الأسبوعي'}</span>
                            </button>
                            <button type="button" class="prayer-subtab ${this.activeTab === 'settings' ? 'active' : ''}" data-prayer-tab="settings" role="tab" aria-selected="${this.activeTab === 'settings'}">
                                <i class="fas fa-sliders" aria-hidden="true"></i>
                                <span>${isEn ? 'Settings & Adhan' : 'الإعدادات والأذان'}</span>
                            </button>
                        </nav>
                    </section>

                    <!-- Tab Content Body -->
                    <div class="prayer-tab-body">
                        ${this.renderActiveTab(snap, isEn)}
                    </div>
                </div>
            `;

            if (this.activeTab === 'qibla') {
                this.updateCompassDial();
            }
        },

        renderActiveTab(snap, isEn) {
            switch (this.activeTab) {
                case 'qibla':
                    return this.renderQiblaTab(snap, isEn);
                case 'weekly':
                    return this.renderWeeklyTab(snap, isEn);
                case 'settings':
                    return this.renderSettingsTab(snap, isEn);
                case 'dashboard':
                default:
                    return this.renderDashboardTab(snap, isEn);
            }
        },

        /* ---------------------------------------- Tab 1: Dashboard & Tracker */
        renderDashboardTab(snap, isEn) {
            const { todaySchedule, countdownState, tracking, prefs } = snap;
            const alertIcons = {
                adhan: { icon: 'fa-volume-high', labelAr: 'أذان كامل', labelEn: 'Full Adhan' },
                beep: { icon: 'fa-bell', labelAr: 'تنبيه صوتي', labelEn: 'Chime' },
                silent: { icon: 'fa-comment-dots', labelAr: 'إشعار صامت', labelEn: 'Silent' },
                off: { icon: 'fa-bell-slash', labelAr: 'متوقف', labelEn: 'Off' }
            };

            const cardsHtml = PRAYER_META.map(item => {
                const timeObj = todaySchedule.times[item.key];
                const formatted = PrayerService.formatPrayerTime(timeObj);
                const pName = PrayerService.getPrayerName(item.key, isEn ? 'en' : 'ar');
                const isCurrent = item.obligatory && countdownState.currentPrayer === item.key && !countdownState.isNextDayFajr;
                const isNext = item.obligatory && countdownState.nextPrayer === item.key;
                const isCompleted = item.obligatory && tracking.prayers[item.key];
                const alertMode = prefs.prayerAlerts[item.key] || 'adhan';
                const alertMeta = alertIcons[alertMode] || alertIcons.adhan;

                return `
                    <div class="prayer-card ${isCurrent ? 'is-current' : ''} ${isNext ? 'is-next' : ''} ${isCompleted ? 'is-completed' : ''}">
                        <div class="prayer-card-head">
                            <span class="prayer-card-icon"><i class="fas ${item.icon}" aria-hidden="true"></i></span>
                            <div class="prayer-card-titles">
                                <h3 class="prayer-card-name">${pName}</h3>
                                ${isNext ? `<span class="prayer-badge next">${isEn ? 'Next' : 'القادمة'}</span>` : ''}
                                ${isCurrent ? `<span class="prayer-badge current">${isEn ? 'Current' : 'الحالية'}</span>` : ''}
                            </div>
                            ${item.obligatory ? `
                                <button type="button" class="prayer-alert-chip ${alertMode === 'off' ? 'is-off' : ''}" data-quick-alert="${item.key}" title="${isEn ? alertMeta.labelEn : alertMeta.labelAr}">
                                    <i class="fas ${alertMeta.icon}" aria-hidden="true"></i>
                                </button>
                            ` : ''}
                        </div>

                        <div class="prayer-card-time" dir="ltr">${formatted}</div>

                        ${item.obligatory ? `
                            <button type="button" class="prayer-track-btn ${isCompleted ? 'checked' : ''}" data-track-prayer="${item.key}" aria-pressed="${isCompleted}">
                                <i class="fas ${isCompleted ? 'fa-circle-check' : 'fa-circle'}" aria-hidden="true"></i>
                                <span>${isCompleted ? (isEn ? 'Completed' : 'تمت الصلاة') : (isEn ? 'Mark as Prayed' : 'سجّل إتمام الصلاة')}</span>
                            </button>
                        ` : `
                            <div class="prayer-sunrise-note">
                                <i class="fas fa-sun" aria-hidden="true"></i>
                                <span>${isEn ? 'End of Fajr time / Duha follows' : 'انتهاء وقت الفجر وبداية الشروق'}</span>
                            </div>
                        `}
                    </div>
                `;
            }).join('');

            const methodObj = PrayerCalc.METHODS[prefs.method] || PrayerCalc.METHODS.EGYPT;
            const methodName = isEn ? methodObj.nameEn : methodObj.nameAr;

            return `
                <div class="prayer-grid">
                    ${cardsHtml}
                </div>

                <!-- Daily Prayer Completion Tracker Summary -->
                <section class="prayer-tracker-panel" aria-label="${isEn ? 'Daily Prayer Tracker' : 'متابعة الصلوات اليومية'}">
                    <div class="prayer-tracker-header">
                        <div>
                            <h3><i class="fas fa-list-check" aria-hidden="true"></i> ${isEn ? 'Daily Prayer Tracker' : 'متابعة الصلوات الخمس اليومية'}</h3>
                            <p>${isEn ? 'Keep track of your completed obligatory prayers today' : 'حافظ على صلواتك الخمس وسجّل ما أتممته اليوم'}</p>
                        </div>
                        <div class="prayer-tracker-score">
                            <strong>${tracking.completedCount} / 5</strong>
                            <span>(${tracking.percentage}%)</span>
                        </div>
                    </div>
                    <div class="prayer-tracker-bar">
                        <div class="prayer-tracker-bar-fill" style="width: ${tracking.percentage}%"></div>
                    </div>
                </section>

                <div class="prayer-method-footer">
                    <span><i class="fas fa-compass-drafting" aria-hidden="true"></i> ${isEn ? 'Calculation Method:' : 'طريقة الحساب المعتمدة:'} <strong>${methodName}</strong></span>
                    <span>•</span>
                    <span>${isEn ? 'Asr Method:' : 'مذهب العصر:'} <strong>${prefs.asrJuristic === 'HANAFI' ? (isEn ? 'Hanafi' : 'الحنفي') : (isEn ? 'Standard (Shafi\'i, Maliki, Hanbali)' : 'الجمهور (الشافعي، المالكي، الحنبلي)')}</strong></span>
                </div>
            `;
        },

        /* ---------------------------------------- Tab 2: Qibla Direction */
        renderQiblaTab(snap, isEn) {
            const { qibla, prefs } = snap;
            const bearing = qibla ? qibla.bearing : 136.1;
            const distKm = qibla ? qibla.distanceKm : 1280;
            const cardinal = qibla ? (isEn ? qibla.cardinalEn : qibla.cardinalAr) : '';

            return `
                <section class="qibla-panel">
                    <div class="qibla-header">
                        <h2><i class="fas fa-kaaba" aria-hidden="true"></i> ${isEn ? 'Qibla Direction toward Makkah' : 'اتجاه القبلة نحو الكعبة المشرفة'}</h2>
                        <p>${isEn
                            ? `Calculated from ${prefs.nameEn} (${prefs.lat}°, ${prefs.lng}°)`
                            : `محسوب بدقة فلكية من موقعك في ${prefs.nameAr} (${prefs.lat}°، ${prefs.lng}°)`}</p>
                    </div>

                    <div class="qibla-compass-wrapper">
                        <div class="qibla-compass-outer">
                            <div class="qibla-compass-dial" id="qiblaCompassDial">
                                <!-- SVG Compass Dial + Kaaba Pointer -->
                                <svg viewBox="0 0 260 260" class="qibla-svg" aria-label="${isEn ? 'Qibla Compass' : 'بوصلة القبلة'}">
                                    <circle cx="130" cy="130" r="120" fill="none" stroke="currentColor" stroke-width="2" opacity="0.2"/>
                                    <circle cx="130" cy="130" r="98" fill="none" stroke="currentColor" stroke-width="1" stroke-dasharray="4 4" opacity="0.3"/>

                                    <!-- Cardinal Labels -->
                                    <text x="130" y="26" text-anchor="middle" class="qibla-cardinal north">${isEn ? 'N' : 'ش'}</text>
                                    <text x="236" y="135" text-anchor="middle" class="qibla-cardinal">${isEn ? 'E' : 'شر'}</text>
                                    <text x="130" y="244" text-anchor="middle" class="qibla-cardinal">${isEn ? 'S' : 'ج'}</text>
                                    <text x="24" y="135" text-anchor="middle" class="qibla-cardinal">${isEn ? 'W' : 'غ'}</text>

                                    <!-- Qibla Bearing Group rotated by bearing degrees -->
                                    <g transform="rotate(${bearing} 130 130)">
                                        <line x1="130" y1="130" x2="130" y2="38" stroke="#c8a24a" stroke-width="4" stroke-linecap="round"/>
                                        <polygon points="130,24 121,46 139,46" fill="#c8a24a"/>
                                        <rect x="120" y="48" width="20" height="20" rx="3" fill="#1b1b1b" stroke="#c8a24a" stroke-width="2"/>
                                        <line x1="120" y1="54" x2="140" y2="54" stroke="#c8a24a" stroke-width="2"/>
                                    </g>

                                    <circle cx="130" cy="130" r="6" fill="#1e7b5f"/>
                                </svg>
                            </div>
                        </div>
                    </div>

                    <div class="qibla-stats-grid">
                        <div class="qibla-stat-box">
                            <span class="qibla-stat-label">${isEn ? 'Qibla Angle (from North)' : 'زاوية القبلة (من الشمال الحقيقي)'}</span>
                            <strong class="qibla-stat-val" dir="ltr">${bearing}°</strong>
                            <span class="qibla-stat-sub">${cardinal}</span>
                        </div>
                        <div class="qibla-stat-box">
                            <span class="qibla-stat-label">${isEn ? 'Distance to Kaaba' : 'المسافة إلى الكعبة المشرفة'}</span>
                            <strong class="qibla-stat-val">${distKm.toLocaleString()} ${isEn ? 'km' : 'كم'}</strong>
                            <span class="qibla-stat-sub">${isEn ? 'Great-circle distance' : 'مسافة القوس الأعظم'}</span>
                        </div>
                        <div class="qibla-stat-box">
                            <span class="qibla-stat-label">${isEn ? 'Device Compass Heading' : 'قراءة حساس البوصلة'}</span>
                            <strong class="qibla-stat-val" id="qiblaDeviceHeading" dir="ltr">${this.deviceHeading !== null ? `${this.deviceHeading}°` : '--°'}</strong>
                            <span class="qibla-stat-sub">${this.compassActive ? (isEn ? 'Sensor Active' : 'الحساس مفعّل') : (isEn ? 'Static Mode' : 'وضع الاتجاه الثابت')}</span>
                        </div>
                    </div>

                    <div class="qibla-actions">
                        <button type="button" class="btn btn-primary" id="qiblaCompassToggleBtn">
                            <i class="fas fa-compass" aria-hidden="true"></i>
                            <span>${this.compassActive
                                ? (isEn ? 'Stop Live Compass Sensor' : 'إيقاف حساس البوصلة الحي')
                                : (isEn ? 'Activate Mobile Compass Sensor' : 'تفعيل حساس البوصلة للهاتف')}</span>
                        </button>
                    </div>

                    <div class="qibla-calibration-note">
                        <i class="fas fa-circle-info" aria-hidden="true"></i>
                        <p>${isEn
                            ? 'Calibration Tip: On mobile devices, hold your phone flat away from magnetic cases or metal objects and move it in a figure-8 pattern. On desktop computers without magnetometer sensors, use the exact angle shown above relative to True North.'
                            : 'إرشادات المعايرة: في الهواتف الذكية، أمسك الهاتف بشكل أفقي بعيدًا عن المعادن أو الأغطية المغناطيسية وحرّكه على شكل رقم (8) لمعايرة الحساس. وفي أجهزة الكمبيوتر التي لا تحتوي على حساس بوصلة، يشير المؤشر الذهبي مباشرة إلى زاوية القبلة من اتجاه الشمال الحقيقي.'}</p>
                    </div>
                </section>
            `;
        },

        /* ---------------------------------------- Tab 3: Weekly Schedule */
        renderWeeklyTab(snap, isEn) {
            const days = PrayerService.getWeeklySchedule(new Date());
            const rowsHtml = days.map(d => `
                <tr class="${d.isToday ? 'is-today' : ''}">
                    <td>
                        <strong>${isEn ? d.gregorianEn : d.gregorianAr}</strong>
                        <div class="weekly-hijri">${isEn ? d.hijriEn : d.hijriAr}</div>
                    </td>
                    <td dir="ltr">${PrayerService.formatPrayerTime(d.times.fajr)}</td>
                    <td dir="ltr">${PrayerService.formatPrayerTime(d.times.sunrise)}</td>
                    <td dir="ltr">${PrayerService.formatPrayerTime(d.times.dhuhr)}</td>
                    <td dir="ltr">${PrayerService.formatPrayerTime(d.times.asr)}</td>
                    <td dir="ltr">${PrayerService.formatPrayerTime(d.times.maghrib)}</td>
                    <td dir="ltr">${PrayerService.formatPrayerTime(d.times.isha)}</td>
                </tr>
            `).join('');

            return `
                <section class="weekly-panel">
                    <div class="weekly-header">
                        <h3><i class="fas fa-calendar-days" aria-hidden="true"></i> ${isEn ? '7-Day Prayer Schedule' : 'جدول مواقيت الصلاة لمدة 7 أيام'}</h3>
                        <p>${isEn ? `Location: ${snap.prefs.nameEn}` : `حسب التوقيت المحلي لمدينة ${snap.prefs.nameAr}`}</p>
                    </div>
                    <div class="weekly-table-wrap">
                        <table class="weekly-table">
                            <thead>
                                <tr>
                                    <th>${isEn ? 'Day & Date' : 'اليوم والتاريخ'}</th>
                                    <th>${isEn ? 'Fajr' : 'الفجر'}</th>
                                    <th>${isEn ? 'Sunrise' : 'الشروق'}</th>
                                    <th>${isEn ? 'Dhuhr' : 'الظهر'}</th>
                                    <th>${isEn ? 'Asr' : 'العصر'}</th>
                                    <th>${isEn ? 'Maghrib' : 'المغرب'}</th>
                                    <th>${isEn ? 'Isha' : 'العشاء'}</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${rowsHtml}
                            </tbody>
                        </table>
                    </div>
                </section>
            `;
        },

        /* ---------------------------------------- Tab 4: Settings & Adhan */
        renderSettingsTab(snap, isEn) {
            const { prefs, adhanVoices, adhanPlaying } = snap;
            const citiesOptions = PrayerCalc.CITIES.map(c => `
                <option value="${c.id}" ${prefs.cityId === c.id ? 'selected' : ''}>
                    ${isEn ? `${c.nameEn} (${c.countryEn})` : `${c.nameAr} (${c.countryAr})`}
                </option>
            `).join('');

            const methodsOptions = Object.values(PrayerCalc.METHODS).map(m => `
                <option value="${m.id}" ${prefs.method === m.id ? 'selected' : ''}>
                    ${isEn ? m.nameEn : m.nameAr}
                </option>
            `).join('');

            const voicesOptions = adhanVoices.map(v => `
                <option value="${v.id}" ${prefs.adhanVoice === v.id ? 'selected' : ''}>
                    ${isEn ? v.nameEn : v.nameAr}
                </option>
            `).join('');

            const permState = (typeof window !== 'undefined' && 'Notification' in window)
                ? Notification.permission
                : 'unsupported';

            const obligatoryKeys = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];
            const perPrayerAlertRows = obligatoryKeys.map(pKey => {
                const pName = PrayerService.getPrayerName(pKey, isEn ? 'en' : 'ar');
                const curMode = prefs.prayerAlerts[pKey] || 'adhan';
                return `
                    <div class="prayer-setting-row">
                        <label>${pName}</label>
                        <select class="prayer-select" data-alert-prayer="${pKey}">
                            <option value="adhan" ${curMode === 'adhan' ? 'selected' : ''}>${isEn ? 'Adhan Audio + Notification' : 'صوت الأذان + إشعار'}</option>
                            <option value="beep" ${curMode === 'beep' ? 'selected' : ''}>${isEn ? 'Takbeer Chime + Notification' : 'نغمة تكبير + إشعار'}</option>
                            <option value="silent" ${curMode === 'silent' ? 'selected' : ''}>${isEn ? 'Silent Notification Only' : 'إشعار صامت فقط'}</option>
                            <option value="off" ${curMode === 'off' ? 'selected' : ''}>${isEn ? 'Disabled' : 'إيقاف'}</option>
                        </select>
                    </div>
                `;
            }).join('');

            const allKeys = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'];
            const manualAdjustInputs = allKeys.map(pKey => {
                const pName = PrayerService.getPrayerName(pKey, isEn ? 'en' : 'ar');
                const val = Number(prefs.adjustments[pKey]) || 0;
                return `
                    <div class="prayer-adj-item">
                        <label>${pName}</label>
                        <input type="number" min="-30" max="30" value="${val}" data-adj-prayer="${pKey}" class="prayer-input-num" dir="ltr">
                        <span class="prayer-adj-unit">${isEn ? 'min' : 'دقيقة'}</span>
                    </div>
                `;
            }).join('');

            return `
                <div class="prayer-settings-grid">
                    <!-- 1. Location Settings -->
                    <section class="prayer-settings-card">
                        <h3><i class="fas fa-location-dot" aria-hidden="true"></i> ${isEn ? 'Location & City' : 'الموقع الجغرافي والمدينة'}</h3>
                        <div class="prayer-setting-row">
                            <label for="prayerCitySelect">${isEn ? 'Select City' : 'اختر المدينة'}</label>
                            <select id="prayerCitySelect" class="prayer-select">
                                ${citiesOptions}
                            </select>
                        </div>

                        <div class="prayer-setting-actions">
                            <button type="button" class="btn btn-secondary" id="prayerDetectGpsBtn">
                                <i class="fas fa-location-crosshairs" aria-hidden="true"></i>
                                <span>${isEn ? 'Auto-Detect via GPS' : 'تحديد موقعي تلقائيًا (GPS)'}</span>
                            </button>
                        </div>

                        <hr class="prayer-divider">
                        <p class="prayer-sub-hint">${isEn ? 'Or enter custom coordinates:' : 'أو أدخل خطوط الطول والعرض يدويًا:'}</p>
                        <div class="prayer-coords-row">
                            <div>
                                <label for="prayerCustomLat">${isEn ? 'Latitude' : 'خط العرض (Lat)'}</label>
                                <input type="number" step="0.0001" id="prayerCustomLat" value="${prefs.lat}" class="prayer-input" dir="ltr">
                            </div>
                            <div>
                                <label for="prayerCustomLng">${isEn ? 'Longitude' : 'خط الطول (Lng)'}</label>
                                <input type="number" step="0.0001" id="prayerCustomLng" value="${prefs.lng}" class="prayer-input" dir="ltr">
                            </div>
                            <button type="button" class="btn btn-secondary" id="prayerSaveCustomCoordsBtn">
                                ${isEn ? 'Apply' : 'تطبيق'}
                            </button>
                        </div>
                    </section>

                    <!-- 2. Calculation & Calendar Settings -->
                    <section class="prayer-settings-card">
                        <h3><i class="fas fa-compass-drafting" aria-hidden="true"></i> ${isEn ? 'Calculation & Display' : 'طريقة الحساب والتقويم'}</h3>

                        <div class="prayer-setting-row">
                            <label for="prayerMethodSelect">${isEn ? 'Calculation Authority' : 'الهيئة المعتمدة للحساب'}</label>
                            <select id="prayerMethodSelect" class="prayer-select">
                                ${methodsOptions}
                            </select>
                        </div>

                        <div class="prayer-setting-row">
                            <label for="prayerAsrSelect">${isEn ? 'Asr Juristic Method' : 'المذهب الفقهي لصلاة العصر'}</label>
                            <select id="prayerAsrSelect" class="prayer-select">
                                <option value="STANDARD" ${prefs.asrJuristic === 'STANDARD' ? 'selected' : ''}>${isEn ? 'Standard (Shafi\'i, Maliki, Hanbali)' : 'الجمهور (الشافعي، المالكي، الحنبلي)'}</option>
                                <option value="HANAFI" ${prefs.asrJuristic === 'HANAFI' ? 'selected' : ''}>${isEn ? 'Hanafi' : 'المذهب الحنفي'}</option>
                            </select>
                        </div>

                        <div class="prayer-setting-row">
                            <label for="prayerTimeFormatSelect">${isEn ? 'Time Format' : 'تنسيق الوقت'}</label>
                            <select id="prayerTimeFormatSelect" class="prayer-select">
                                <option value="12h" ${prefs.timeFormat === '12h' ? 'selected' : ''}>${isEn ? '12-Hour (AM/PM)' : 'نظام 12 ساعة (ص / م)'}</option>
                                <option value="24h" ${prefs.timeFormat === '24h' ? 'selected' : ''}>${isEn ? '24-Hour (14:30)' : 'نظام 24 ساعة'}</option>
                            </select>
                        </div>

                        <div class="prayer-setting-row">
                            <label for="prayerHijriOffsetSelect">${isEn ? 'Hijri Date Adjustment' : 'تعديل التاريخ الهجري (أيام)'}</label>
                            <select id="prayerHijriOffsetSelect" class="prayer-select">
                                <option value="-2" ${prefs.hijriOffset === -2 ? 'selected' : ''}>-2</option>
                                <option value="-1" ${prefs.hijriOffset === -1 ? 'selected' : ''}>-1</option>
                                <option value="0" ${prefs.hijriOffset === 0 ? 'selected' : ''}>0 (${isEn ? 'Default' : 'افتراضي'})</option>
                                <option value="1" ${prefs.hijriOffset === 1 ? 'selected' : ''}>+1</option>
                                <option value="2" ${prefs.hijriOffset === 2 ? 'selected' : ''}>+2</option>
                            </select>
                        </div>
                    </section>

                    <!-- 3. Adhan & Notification Preferences -->
                    <section class="prayer-settings-card">
                        <h3><i class="fas fa-bell" aria-hidden="true"></i> ${isEn ? 'Adhan & Notifications' : 'تنبيهات الأذان والإشعارات'}</h3>

                        <div class="prayer-setting-row">
                            <label for="prayerNotifToggle">${isEn ? 'Enable Prayer Alerts' : 'تفعيل تنبيهات مواقيت الصلاة'}</label>
                            <input type="checkbox" id="prayerNotifToggle" ${prefs.notificationsEnabled ? 'checked' : ''}>
                        </div>

                        <div class="prayer-setting-row">
                            <span>${isEn ? 'Browser Permission:' : 'حالة إذن المتصفح:'} <strong>${permState}</strong></span>
                            <button type="button" class="btn btn-secondary" id="prayerReqPermBtn">
                                <i class="fas fa-shield-halved" aria-hidden="true"></i>
                                <span>${isEn ? 'Grant Permission' : 'تفعيل إذن الإشعارات'}</span>
                            </button>
                        </div>

                        <div class="prayer-setting-row">
                            <label for="prayerAdhanVoiceSelect">${isEn ? 'Adhan Audio Voice' : 'صوت الأذان المختار'}</label>
                            <select id="prayerAdhanVoiceSelect" class="prayer-select">
                                ${voicesOptions}
                            </select>
                        </div>

                        <div class="prayer-setting-actions">
                            <button type="button" class="btn btn-secondary" id="prayerTestAdhanBtn">
                                <i class="fas ${adhanPlaying ? 'fa-stop' : 'fa-play'}" aria-hidden="true"></i>
                                <span>${adhanPlaying ? (isEn ? 'Stop Adhan Preview' : 'إيقاف معاينة الأذان') : (isEn ? 'Test Adhan Sound' : 'تجربة صوت الأذان الآن')}</span>
                            </button>
                        </div>

                        <div class="prayer-setting-row">
                            <label for="prayerReminderSelect">${isEn ? 'Pre-Prayer Reminder' : 'تذكير قبل دخول وقت الصلاة'}</label>
                            <select id="prayerReminderSelect" class="prayer-select">
                                <option value="0" ${prefs.reminderMinutesBefore === 0 ? 'selected' : ''}>${isEn ? 'Off' : 'بدون تذكير مسبق'}</option>
                                <option value="5" ${prefs.reminderMinutesBefore === 5 ? 'selected' : ''}>5 ${isEn ? 'minutes before' : 'دقائق قبل الأذان'}</option>
                                <option value="10" ${prefs.reminderMinutesBefore === 10 ? 'selected' : ''}>10 ${isEn ? 'minutes before' : 'دقائق قبل الأذان'}</option>
                                <option value="15" ${prefs.reminderMinutesBefore === 15 ? 'selected' : ''}>15 ${isEn ? 'minutes before' : 'دقيقة قبل الأذان'}</option>
                                <option value="20" ${prefs.reminderMinutesBefore === 20 ? 'selected' : ''}>20 ${isEn ? 'minutes before' : 'دقيقة قبل الأذان'}</option>
                                <option value="30" ${prefs.reminderMinutesBefore === 30 ? 'selected' : ''}>30 ${isEn ? 'minutes before' : 'دقيقة قبل الأذان'}</option>
                            </select>
                        </div>

                        <hr class="prayer-divider">
                        <h4>${isEn ? 'Per-Prayer Alert Mode' : 'تخصيص التنبيه لكل صلاة'}</h4>
                        ${perPrayerAlertRows}

                        <div class="prayer-browser-notice">
                            <i class="fas fa-circle-info" aria-hidden="true"></i>
                            <small>${isEn
                                ? 'Browser Note: Web browsers allow Adhan audio and notifications while the application tab is open (in foreground or background). If the browser tab or app is completely closed by the operating system, background audio cannot play automatically without native OS alarms.'
                                : 'ملاحظة تقنية: تعمل تنبيهات الأذان والإشعارات طالما أن صفحة التطبيق مفتوحة في المتصفح (سواء في الواجهة أو في الخلفية). في حال إغلاق المتصفح بالكامل، تمنع أنظمة التشغيل تشغيل الصوت تلقائيًا في الخلفية.'}</small>
                        </div>
                    </section>

                    <!-- 4. Manual Minute Adjustments -->
                    <section class="prayer-settings-card">
                        <div class="flex items-center justify-between">
                            <h3><i class="fas fa-clock-rotate-left" aria-hidden="true"></i> ${isEn ? 'Manual Minute Adjustments' : 'الضبط اليدوي للدقائق (احتياط)'}</h3>
                            <button type="button" class="btn btn-secondary" id="prayerResetAdjBtn">${isEn ? 'Reset (0)' : 'إعادة الضبط (0)'}</button>
                        </div>
                        <p class="prayer-sub-hint">${isEn ? 'Add or subtract minutes (-30 to +30) to match your local mosque:' : 'أضف أو أنقص دقائق (-30 إلى +30) لمطابقة تقويم المسجد المحلي:'}</p>
                        <div class="prayer-adj-grid">
                            ${manualAdjustInputs}
                        </div>
                    </section>
                </div>
            `;
        }
    };

    return PrayerUI;
});

