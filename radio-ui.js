/**
 * Quran Radio UI Controller
 * Manages the dedicated Radio screen, station grid, filtering,
 * animated visualizer, mute/reconnect controls, and persistent Radio Mini-Player.
 */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory(root.RadioService, root.RadioStations, root.App);
    } else {
        root.RadioUI = factory(root.RadioService, root.RadioStations, root.App);
    }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (RadioService, RadioStations, App) {
    'use strict';

    const RadioUI = {
        currentCategory: 'all',
        searchQuery: '',
        initialized: false,

        /* ------------------------------------------------------------ init */
        init() {
            if (this.initialized) return;

            // Resolve dependencies if late loaded
            if (!RadioService && typeof window !== 'undefined' && window.RadioService) {
                RadioService = window.RadioService;
            }
            if (!RadioStations && typeof window !== 'undefined' && window.RadioStations) {
                RadioStations = window.RadioStations;
            }
            if (!App && typeof window !== 'undefined' && window.App) {
                App = window.App;
            }

            if (RadioService) {
                RadioService.init();
            }

            this.buildMiniPlayer();
            this.setupEventListeners();

            if (RadioService) {
                RadioService.subscribe((snapshot) => this.render(snapshot));
            }

            this.initialized = true;
        },

        /* ---------------------------------------------------- show & route */
        show() {
            this.renderPage();
            if (RadioService) {
                this.render(RadioService.getSnapshot());
            }
        },

        /* ------------------------------------------------ build mini player */
        buildMiniPlayer() {
            if (document.getElementById('radioMini')) return;

            const mini = document.createElement('div');
            mini.className = 'radio-mini';
            mini.id = 'radioMini';
            mini.setAttribute('role', 'region');
            mini.setAttribute('aria-label', 'مشغّل إذاعة القرآن الكريم المصغّر');
            mini.hidden = true;

            mini.innerHTML = `
                <button type="button" class="radio-mini-main" id="radioMiniOpenBtn" aria-label="فتح صفحة إذاعة القرآن الكريم">
                    <span class="radio-mini-thumb" aria-hidden="true"><i class="fas fa-tower-broadcast"></i></span>
                    <span class="radio-mini-text">
                        <span class="radio-mini-title" id="radioMiniTitle">إذاعة القرآن الكريم من القاهرة</span>
                        <span class="radio-mini-sub" id="radioMiniSub">
                            <span class="radio-live-dot" aria-hidden="true"></span>
                            <span id="radioMiniStatus">بث مباشر</span>
                        </span>
                    </span>
                </button>
                <button type="button" class="radio-mini-btn play-btn" id="radioMiniPlayBtn" aria-label="تشغيل الإذاعة" title="تشغيل">
                    <i class="fas fa-play" aria-hidden="true"></i>
                </button>
                <button type="button" class="radio-mini-btn" id="radioMiniMuteBtn" aria-label="كتم الصوت" title="كتم الصوت">
                    <i class="fas fa-volume-up" aria-hidden="true"></i>
                </button>
                <button type="button" class="radio-mini-btn" id="radioMiniExpandBtn" aria-label="فتح صفحة الإذاعة" title="تكبير">
                    <i class="fas fa-chevron-up" aria-hidden="true"></i>
                </button>
                <button type="button" class="radio-mini-btn" id="radioMiniCloseBtn" aria-label="إخفاء المشغل المصغر" title="إخفاء المشغل">
                    <i class="fas fa-xmark" aria-hidden="true"></i>
                </button>
                <span class="radio-mini-bar" aria-hidden="true"></span>
            `;

            document.body.appendChild(mini);

            const openRadio = () => {
                if (App && typeof App.navigateToPage === 'function') {
                    App.navigateToPage('radio');
                }
            };

            document.getElementById('radioMiniOpenBtn')?.addEventListener('click', openRadio);
            document.getElementById('radioMiniExpandBtn')?.addEventListener('click', openRadio);

            document.getElementById('radioMiniPlayBtn')?.addEventListener('click', (e) => {
                e.stopPropagation();
                if (RadioService) RadioService.togglePlay();
            });

            document.getElementById('radioMiniMuteBtn')?.addEventListener('click', (e) => {
                e.stopPropagation();
                if (RadioService) RadioService.toggleMute();
            });

            document.getElementById('radioMiniCloseBtn')?.addEventListener('click', (e) => {
                e.stopPropagation();
                if (RadioService) {
                    RadioService.setMiniPlayerVisible(false);
                    if (App && typeof App.showToast === 'function') {
                        const msg = typeof I18n !== 'undefined'
                            ? I18n.t('radio.mini_toast', 'تم إخفاء المشغل المصغر (البث مستمر في الخلفية)')
                            : 'تم إخفاء المشغل المصغر (البث مستمر في الخلفية)';
                        App.showToast(msg, 'info');
                    }
                }
            });
        },

        /* --------------------------------------------- setup event listeners */
        setupEventListeners() {
            // Teaser card on home page
            document.addEventListener('click', (e) => {
                const teaser = e.target.closest('[data-page-go="radio"]');
                if (teaser) {
                    e.preventDefault();
                    if (App && typeof App.navigateToPage === 'function') {
                        App.navigateToPage('radio');
                    }
                }
            });

            // Delegate page-level controls inside #radioPage
            const page = document.getElementById('radioPage');
            if (!page) return;

            page.addEventListener('click', (e) => {
                const playBtn = e.target.closest('#radioHeroPlayBtn');
                if (playBtn) {
                    if (RadioService) RadioService.togglePlay();
                    return;
                }

                const prevBtn = e.target.closest('#radioHeroPrevBtn');
                if (prevBtn) {
                    if (RadioService) RadioService.previousStation();
                    return;
                }

                const nextBtn = e.target.closest('#radioHeroNextBtn');
                if (nextBtn) {
                    if (RadioService) RadioService.nextStation();
                    return;
                }

                const reconnectBtn = e.target.closest('#radioReconnectBtn, #radioRetryBtn');
                if (reconnectBtn) {
                    if (RadioService) RadioService.retry();
                    return;
                }

                const muteBtn = e.target.closest('#radioMuteBtn');
                if (muteBtn) {
                    if (RadioService) RadioService.toggleMute();
                    return;
                }

                const catTab = e.target.closest('[data-radio-cat]');
                if (catTab) {
                    this.currentCategory = catTab.getAttribute('data-radio-cat');
                    this.renderStations();
                    return;
                }

                const stationCard = e.target.closest('[data-station-id]');
                if (stationCard) {
                    const sid = stationCard.getAttribute('data-station-id');
                    if (RadioService) {
                        const cur = RadioService.station;
                        if (cur && cur.id === sid) {
                            RadioService.togglePlay();
                        } else {
                            RadioService.setStation(sid, true);
                        }
                    }
                    return;
                }
            });

            page.addEventListener('input', (e) => {
                if (e.target.id === 'radioSearchInput') {
                    this.searchQuery = e.target.value.trim().toLowerCase();
                    this.renderStations();
                } else if (e.target.id === 'radioVolumeSlider') {
                    if (RadioService) {
                        RadioService.setVolume(Number(e.target.value) / 100);
                    }
                }
            });
        },

        /* ------------------------------------------------------- render page */
        renderPage() {
            const page = document.getElementById('radioPage');
            if (!page) return;

            const t = (k, fb) => (typeof I18n !== 'undefined' ? I18n.t(k, fb) : fb);

            page.innerHTML = `
                <div class="radio-page-container">
                    <header class="page-header text-center">
                        <h1>${t('radio.header_title', 'إذاعة القرآن الكريم من القاهرة')}</h1>
                        <p class="text-lg" style="color: var(--color-text-gray);">${t('radio.header_subtitle', 'بث مباشر ومتواصل لأعذب التلاوات القرآنية على مدار الساعة')}</p>
                    </header>

                    <!-- Hero Active Station Player -->
                    <section class="radio-hero" id="radioHero" role="region" aria-label="محطة الإذاعة الحالية">
                        <div class="radio-hero-badges">
                            <span class="radio-live-tag" id="radioLiveTag">
                                <span class="radio-live-dot"></span>
                                <span id="radioLiveLabel">${t('radio.live', 'مباشر')}</span>
                            </span>
                            <div class="radio-eq" id="radioEq" aria-hidden="true">
                                <span></span><span></span><span></span><span></span>
                            </div>
                            <span class="radio-format-badge" id="radioFormatBadge">MP3 · 128 kbps</span>
                        </div>

                        <div class="radio-art-container" id="radioArt">
                            <i class="fas fa-tower-broadcast" id="radioArtIcon" aria-hidden="true"></i>
                        </div>

                        <div class="radio-meta">
                            <h2 class="radio-station-title" id="radioHeroTitle">إذاعة القرآن الكريم من القاهرة</h2>
                            <p class="radio-station-desc" id="radioHeroDesc">البث المباشر لإذاعة القرآن الكريم من القاهرة — تلاوات كبار قراء مصر والعالم الإسلامي على مدار الساعة</p>
                        </div>

                        <!-- Animated Audio Soundwave Visualization -->
                        <div class="radio-wave-visualizer" id="radioWaveVisualizer" aria-hidden="true">
                            <span></span><span></span><span></span><span></span><span></span><span></span>
                            <span></span><span></span><span></span><span></span><span></span><span></span>
                            <span></span><span></span><span></span><span></span>
                        </div>

                        <div class="radio-status-banner" id="radioStatusBanner" role="status" aria-live="polite">
                            <span class="radio-status-dot" id="radioStatusDot" aria-hidden="true"></span>
                            <span id="radioStatusText">${t('radio.ready', 'جاهز للاستماع — اضغط تشغيل لبدء البث المباشر')}</span>
                            <button type="button" class="radio-retry-btn" id="radioRetryBtn" hidden>
                                <i class="fas fa-rotate-right"></i> ${t('radio.retry', 'إعادة الاتصال')}
                            </button>
                        </div>

                        <div class="radio-controls">
                            <button type="button" class="radio-btn-round" id="radioHeroPrevBtn" aria-label="${t('radio.prev_station', 'المحطة السابقة')}" title="${t('radio.prev_station', 'المحطة السابقة')}">
                                <i class="fas fa-forward-step" aria-hidden="true"></i>
                            </button>
                            <button type="button" class="radio-btn-play" id="radioHeroPlayBtn" aria-label="تشغيل الإذاعة" title="تشغيل">
                                <i class="fas fa-play" aria-hidden="true"></i>
                            </button>
                            <button type="button" class="radio-btn-round" id="radioHeroNextBtn" aria-label="${t('radio.next_station', 'المحطة التالية')}" title="${t('radio.next_station', 'المحطة التالية')}">
                                <i class="fas fa-backward-step" aria-hidden="true"></i>
                            </button>
                            <button type="button" class="radio-btn-round" id="radioReconnectBtn" aria-label="${t('radio.reconnect', 'إعادة الاتصال بالبث')}" title="${t('radio.reconnect', 'إعادة الاتصال بالبث')}">
                                <i class="fas fa-rotate-right" aria-hidden="true"></i>
                            </button>
                        </div>

                        <div class="radio-volume-row">
                            <button type="button" class="radio-mute-btn" id="radioMuteBtn" aria-label="${t('radio.mute', 'كتم الصوت')}" title="${t('radio.mute', 'كتم الصوت')}">
                                <i class="fas fa-volume-up" id="radioMuteIcon" aria-hidden="true"></i>
                            </button>
                            <input type="range" id="radioVolumeSlider" min="0" max="100" value="80" aria-label="مستوى صوت الإذاعة">
                            <span class="radio-volume-pct" id="radioVolumePct">80%</span>
                        </div>
                    </section>

                    <!-- Search and Category Filters -->
                    <section class="radio-filter-section">
                        <div class="radio-search-box">
                            <i class="fas fa-search radio-search-icon" aria-hidden="true"></i>
                            <input type="search" class="radio-search-input" id="radioSearchInput" placeholder="${t('radio.search_placeholder', 'ابحث عن محطة أو قارئ…')}" aria-label="بحث في المحطات">
                        </div>

                        <div class="radio-cat-tabs" id="radioCatTabs" role="tablist" aria-label="أقسام الإذاعات">
                            <button type="button" class="radio-tab-btn active" data-radio-cat="all" role="tab" aria-selected="true">${t('radio.tab_all', 'الكل')}</button>
                            <button type="button" class="radio-tab-btn" data-radio-cat="thematic" role="tab" aria-selected="false">${t('radio.tab_thematic', 'البث العام والتلاوات')}</button>
                            <button type="button" class="radio-tab-btn" data-radio-cat="reciter" role="tab" aria-selected="false">${t('radio.tab_reciters', 'القراء')}</button>
                        </div>
                    </section>

                    <!-- Station Grid -->
                    <section class="radio-grid" id="radioGrid" role="list" aria-label="قائمة المحطات الإذاعية">
                    </section>
                </div>
            `;

            this.renderStations();
        },

        /* ------------------------------------------------- render stations */
        renderStations() {
            const grid = document.getElementById('radioGrid');
            if (!grid || !RadioStations) return;

            let stations = RadioStations.getAll();

            // Filter by category
            if (this.currentCategory !== 'all') {
                stations = stations.filter(s => s.category === this.currentCategory);
            }

            // Filter by search query
            if (this.searchQuery) {
                stations = stations.filter(s =>
                    s.name.toLowerCase().includes(this.searchQuery) ||
                    (s.nameEn && s.nameEn.toLowerCase().includes(this.searchQuery)) ||
                    (s.description && s.description.toLowerCase().includes(this.searchQuery))
                );
            }

            // Update category active tab states
            document.querySelectorAll('#radioCatTabs .radio-tab-btn').forEach(btn => {
                const cat = btn.getAttribute('data-radio-cat');
                const active = cat === this.currentCategory;
                btn.classList.toggle('active', active);
                btn.setAttribute('aria-selected', String(active));
            });

            if (stations.length === 0) {
                grid.innerHTML = `
                    <div style="grid-column: 1 / -1; text-align: center; padding: 40px var(--space-4); color: var(--color-text-gray);">
                        <i class="fas fa-radio" style="font-size: 2rem; margin-bottom: 8px; opacity: 0.5;" aria-hidden="true"></i>
                        <p>لا توجد محطات تطابق بحثك</p>
                    </div>
                `;
                return;
            }

            const activeStationId = RadioService && RadioService.station ? RadioService.station.id : null;
            const isPlaying = RadioService ? RadioService.isPlaying() : false;
            const isEn = typeof I18n !== 'undefined' && I18n.getLanguage() === 'en';

            grid.innerHTML = stations.map(s => {
                const isActive = s.id === activeStationId;
                const playIcon = isActive && isPlaying ? 'fa-pause' : (isActive && (RadioService.state === 'loading' || RadioService.state === 'reconnecting') ? 'fa-spinner fa-spin' : 'fa-play');
                const title = isEn && s.nameEn ? s.nameEn : s.name;
                const subtitle = isEn
                    ? (s.descriptionEn || (s.category === 'reciter' ? 'Reciter Radio' : 'Live Broadcast'))
                    : (s.description || s.categoryName);

                return `
                    <button type="button" class="radio-card ${isActive ? 'is-active' : ''}" data-station-id="${s.id}" role="listitem" aria-label="${title}">
                        <div class="radio-card-icon">
                            <i class="fas ${s.icon || 'fa-radio'}" aria-hidden="true"></i>
                        </div>
                        <div class="radio-card-body">
                            <span class="radio-card-title">${title}</span>
                            <span class="radio-card-sub">${subtitle}</span>
                        </div>
                        <div class="radio-card-play-state">
                            <i class="fas ${playIcon}" aria-hidden="true"></i>
                        </div>
                    </button>
                `;
            }).join('');
        },

        /* ---------------------------------------------------- render state */
        render(snapshot) {
            if (!snapshot) return;

            const { state, station, errorMessage, volume, muted, isPlaying, miniPlayerVisible } = snapshot;
            const isEn = typeof I18n !== 'undefined' && I18n.getLanguage() === 'en';
            const t = (k, fb) => (typeof I18n !== 'undefined' ? I18n.t(k, fb) : fb);

            // Render Hero Section
            const hero = document.getElementById('radioHero');
            const playBtn = document.getElementById('radioHeroPlayBtn');
            const heroTitle = document.getElementById('radioHeroTitle');
            const heroDesc = document.getElementById('radioHeroDesc');
            const statusText = document.getElementById('radioStatusText');
            const statusBanner = document.getElementById('radioStatusBanner');
            const retryBtn = document.getElementById('radioRetryBtn');
            const liveTag = document.getElementById('radioLiveTag');
            const volumeSlider = document.getElementById('radioVolumeSlider');
            const volumePct = document.getElementById('radioVolumePct');
            const muteBtn = document.getElementById('radioMuteBtn');
            const muteIcon = document.getElementById('radioMuteIcon');
            const formatBadge = document.getElementById('radioFormatBadge');
            const art = document.getElementById('radioArt');
            const artIcon = document.getElementById('radioArtIcon');

            if (hero) {
                hero.classList.toggle('is-playing', isPlaying);
            }
            if (art) {
                art.classList.toggle('is-playing', isPlaying);
            }
            if (liveTag) {
                liveTag.classList.toggle('is-active', isPlaying);
            }

            if (station) {
                if (heroTitle) heroTitle.textContent = isEn && station.nameEn ? station.nameEn : station.name;
                if (heroDesc) heroDesc.textContent = isEn && station.descriptionEn ? station.descriptionEn : (station.description || '');
                if (formatBadge) formatBadge.textContent = `${station.format === 'audio/mpeg' ? 'MP3' : 'Audio'} · ${station.bitrate} kbps`;
                if (artIcon) artIcon.className = `fas ${station.icon || 'fa-tower-broadcast'}`;
            }

            if (playBtn) {
                const icon = playBtn.querySelector('i');
                if (icon) {
                    icon.className = state === 'loading' || state === 'reconnecting'
                        ? 'fas fa-spinner fa-spin'
                        : (isPlaying ? 'fas fa-pause' : 'fas fa-play');
                }
                const label = isPlaying ? t('player.pause', 'إيقاف مؤقت') : t('player.play', 'تشغيل');
                playBtn.title = label;
                playBtn.setAttribute('aria-label', label);
            }

            if (statusBanner && statusText) {
                statusBanner.className = 'radio-status-banner';
                if (state === 'playing') {
                    statusText.textContent = t('radio.playing', 'البث المباشر متصل ويعمل الآن');
                    statusBanner.classList.add('is-playing');
                } else if (state === 'loading') {
                    statusText.textContent = errorMessage || t('radio.loading', 'جارٍ الاتصال بالبث المباشر…');
                    statusBanner.classList.add('is-loading');
                } else if (state === 'reconnecting') {
                    statusText.textContent = errorMessage || t('radio.reconnecting', 'جارٍ إعادة الاتصال بالبث…');
                    statusBanner.classList.add('is-loading');
                } else if (state === 'error') {
                    statusText.textContent = errorMessage || t('radio.error', 'تعذر الاتصال بالبث المباشر');
                    statusBanner.classList.add('is-error');
                } else {
                    statusText.textContent = t('radio.ready', 'جاهز للاستماع — اضغط تشغيل لبدء البث المباشر');
                }

                if (retryBtn) {
                    retryBtn.hidden = state !== 'error';
                }
            }

            const effectiveVol = muted ? 0 : Math.round(volume * 100);
            if (volumeSlider) {
                volumeSlider.value = String(effectiveVol);
            }
            if (volumePct) {
                volumePct.textContent = `${effectiveVol}%`;
            }
            if (muteIcon) {
                muteIcon.className = muted || effectiveVol === 0
                    ? 'fas fa-volume-xmark'
                    : (effectiveVol < 50 ? 'fas fa-volume-low' : 'fas fa-volume-up');
            }
            if (muteBtn) {
                const muteLabel = muted ? t('radio.unmute', 'إلغاء كتم الصوت') : t('radio.mute', 'كتم الصوت');
                muteBtn.title = muteLabel;
                muteBtn.setAttribute('aria-label', muteLabel);
                muteBtn.classList.toggle('is-muted', !!muted);
            }

            // Update mini player
            this.renderMiniPlayer(snapshot);

            // Synchronize active card icons in the grid
            this.syncStationCards(snapshot);
        },

        /* --------------------------------------------- sync station cards */
        syncStationCards(snapshot) {
            const { station, state, isPlaying } = snapshot;
            if (!station) return;

            document.querySelectorAll('#radioGrid .radio-card').forEach(card => {
                const sid = card.getAttribute('data-station-id');
                const isCur = sid === station.id;
                card.classList.toggle('is-active', isCur);

                const stateIcon = card.querySelector('.radio-card-play-state i');
                if (stateIcon) {
                    if (isCur) {
                        stateIcon.className = state === 'loading' || state === 'reconnecting'
                            ? 'fas fa-spinner fa-spin'
                            : (isPlaying ? 'fas fa-pause' : 'fas fa-play');
                    } else {
                        stateIcon.className = 'fas fa-play';
                    }
                }
            });
        },

        /* ---------------------------------------------- render mini player */
        renderMiniPlayer(snapshot) {
            const mini = document.getElementById('radioMini');
            if (!mini) return;

            const { station, state, muted, isPlaying, miniPlayerVisible } = snapshot;
            const onRadioPage = App && App.currentPage === 'radio';
            const isEn = typeof I18n !== 'undefined' && I18n.getLanguage() === 'en';
            const t = (k, fb) => (typeof I18n !== 'undefined' ? I18n.t(k, fb) : fb);

            // Show mini player if:
            // 1. Radio is either playing, loading, reconnecting, or paused after session start
            // 2. Not currently on the full radio page
            // 3. User hasn't dismissed it
            const shouldShow = (state === 'playing' || state === 'loading' || state === 'reconnecting' || state === 'paused')
                && !onRadioPage
                && miniPlayerVisible
                && state !== 'idle';

            mini.hidden = !shouldShow;
            mini.classList.toggle('is-playing', isPlaying);
            document.body.classList.toggle('has-radio-mini', shouldShow);

            if (!shouldShow) return;

            const titleEl = document.getElementById('radioMiniTitle');
            const subEl = document.getElementById('radioMiniStatus');
            const playBtn = document.getElementById('radioMiniPlayBtn');
            const muteBtn = document.getElementById('radioMiniMuteBtn');

            if (titleEl && station) {
                titleEl.textContent = isEn && station.nameEn ? station.nameEn : station.name;
            }

            if (subEl) {
                subEl.textContent = state === 'playing' ? t('radio.mini_live', 'بث مباشر متواصل')
                    : state === 'loading' ? t('radio.loading', 'جارٍ الاتصال…')
                    : state === 'reconnecting' ? t('radio.reconnecting', 'جارٍ إعادة الاتصال…')
                    : state === 'error' ? t('radio.error', 'تعذر الاتصال') : t('player.pause', 'متوقف مؤقتًا');
            }

            if (playBtn) {
                const icon = playBtn.querySelector('i');
                if (icon) {
                    icon.className = state === 'loading' || state === 'reconnecting'
                        ? 'fas fa-spinner fa-spin'
                        : (isPlaying ? 'fas fa-pause' : 'fas fa-play');
                }
                const label = isPlaying ? t('player.pause', 'إيقاف مؤقت') : t('player.play', 'تشغيل');
                playBtn.title = label;
                playBtn.setAttribute('aria-label', label);
            }

            if (muteBtn) {
                const icon = muteBtn.querySelector('i');
                if (icon) {
                    icon.className = muted ? 'fas fa-volume-xmark' : 'fas fa-volume-up';
                }
                const muteLabel = muted ? t('radio.unmute', 'إلغاء كتم الصوت') : t('radio.mute', 'كتم الصوت');
                muteBtn.title = muteLabel;
                muteBtn.setAttribute('aria-label', muteLabel);
            }
        }
    };

    return RadioUI;
});
