/**
 * Quran Radio UI Controller
 * Manages the dedicated Radio screen, station grid, filtering,
 * and persistent Radio Mini-Player.
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
            mini.setAttribute('aria-label', 'مشغّل الإذاعة القرآنية المصغّر');
            mini.hidden = true;

            mini.innerHTML = `
                <button type="button" class="radio-mini-main" id="radioMiniOpenBtn" aria-label="فتح صفحة الإذاعة القرآنية">
                    <span class="radio-mini-thumb" aria-hidden="true"><i class="fas fa-radio"></i></span>
                    <span class="radio-mini-text">
                        <span class="radio-mini-title" id="radioMiniTitle">الإذاعة القرآنية</span>
                        <span class="radio-mini-sub" id="radioMiniSub">
                            <span class="radio-live-dot" aria-hidden="true"></span>
                            <span id="radioMiniStatus">بث مباشر</span>
                        </span>
                    </span>
                </button>
                <button type="button" class="radio-mini-btn play-btn" id="radioMiniPlayBtn" aria-label="تشغيل الإذاعة" title="تشغيل">
                    <i class="fas fa-play" aria-hidden="true"></i>
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

            document.getElementById('radioMiniCloseBtn')?.addEventListener('click', (e) => {
                e.stopPropagation();
                if (RadioService) {
                    RadioService.setMiniPlayerVisible(false);
                    if (App && typeof App.showToast === 'function') {
                        App.showToast('تم إخفاء المشغل المصغر (البث مستمر في الخلفية)', 'info');
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

                const retryBtn = e.target.closest('#radioRetryBtn');
                if (retryBtn) {
                    if (RadioService) RadioService.retry();
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
                        <h1>${t('radio.header_title', 'الإذاعة القرآنية المباركة')}</h1>
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
                            <i class="fas fa-radio" aria-hidden="true"></i>
                        </div>

                        <div class="radio-meta">
                            <h2 class="radio-station-title" id="radioHeroTitle">إذاعة تراتيل قصيرة</h2>
                            <p class="radio-station-desc" id="radioHeroDesc">تلاوات خاشعة ومختارة بعناية لأعذب الأصوات</p>
                        </div>

                        <div class="radio-status-banner" id="radioStatusBanner" role="status" aria-live="polite">
                            <span id="radioStatusText">${t('radio.ready', 'جاهز للاستماع')}</span>
                            <button type="button" class="radio-retry-btn" id="radioRetryBtn" hidden>
                                <i class="fas fa-rotate-right"></i> ${t('radio.retry', 'إعادة المحاولة')}
                            </button>
                        </div>

                        <div class="radio-controls">
                            <button type="button" class="radio-btn-round" id="radioHeroPrevBtn" aria-label="المحطة السابقة" title="المحطة السابقة">
                                <i class="fas fa-forward-step" aria-hidden="true"></i>
                            </button>
                            <button type="button" class="radio-btn-play" id="radioHeroPlayBtn" aria-label="تشغيل الإذاعة" title="تشغيل">
                                <i class="fas fa-play" aria-hidden="true"></i>
                            </button>
                            <button type="button" class="radio-btn-round" id="radioHeroNextBtn" aria-label="المحطة التالية" title="المحطة التالية">
                                <i class="fas fa-backward-step" aria-hidden="true"></i>
                            </button>
                        </div>

                        <div class="radio-volume-row">
                            <i class="fas fa-volume-up" aria-hidden="true"></i>
                            <input type="range" id="radioVolumeSlider" min="0" max="100" value="80" aria-label="مستوى صوت الإذاعة">
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
                            <button type="button" class="radio-tab-btn" data-radio-cat="reciter" role="tab" aria-selected="false">${t('radio.tab_reciters', 'القراء')}</button>
                            <button type="button" class="radio-tab-btn" data-radio-cat="thematic" role="tab" aria-selected="false">${t('radio.tab_thematic', 'تلاوات ومنوعات')}</button>
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
                const playIcon = isActive && isPlaying ? 'fa-pause' : (isActive && RadioService.state === 'loading' ? 'fa-spinner fa-spin' : 'fa-play');
                const title = isEn && s.nameEn ? s.nameEn : s.name;
                const subtitle = isEn ? (s.category === 'reciter' ? 'Reciter Radio' : 'Selected Recitations') : (s.description || s.categoryName);

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

            const { state, station, errorMessage, volume, isPlaying, miniPlayerVisible } = snapshot;

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
            const formatBadge = document.getElementById('radioFormatBadge');
            const art = document.getElementById('radioArt');

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
                if (heroTitle) heroTitle.textContent = station.name;
                if (heroDesc) heroDesc.textContent = station.description || '';
                if (formatBadge) formatBadge.textContent = `${station.format === 'audio/mpeg' ? 'MP3' : 'Audio'} · ${station.bitrate} kbps`;
            }

            if (playBtn) {
                const icon = playBtn.querySelector('i');
                if (icon) {
                    icon.className = state === 'loading' || state === 'reconnecting'
                        ? 'fas fa-spinner fa-spin'
                        : (isPlaying ? 'fas fa-pause' : 'fas fa-play');
                }
                const label = isPlaying ? 'إيقاف مؤقت' : 'تشغيل';
                playBtn.title = label;
                playBtn.setAttribute('aria-label', label);
            }

            if (statusBanner && statusText) {
                statusBanner.className = 'radio-status-banner';
                if (state === 'playing') {
                    statusText.textContent = 'البث المباشر يعمل الآن';
                    statusBanner.classList.add('is-playing');
                } else if (state === 'loading') {
                    statusText.textContent = errorMessage || 'جارٍ الاتصال بالإذاعة…';
                    statusBanner.classList.add('is-loading');
                } else if (state === 'reconnecting') {
                    statusText.textContent = errorMessage || 'جارٍ إعادة المحاولة…';
                    statusBanner.classList.add('is-loading');
                } else if (state === 'error') {
                    statusText.textContent = errorMessage || 'تعذر الاتصال بالبث';
                    statusBanner.classList.add('is-error');
                } else {
                    statusText.textContent = 'جاهز للاستماع';
                }

                if (retryBtn) {
                    retryBtn.hidden = state !== 'error';
                }
            }

            if (volumeSlider) {
                volumeSlider.value = String(Math.round(volume * 100));
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

            const { station, state, isPlaying, miniPlayerVisible } = snapshot;
            const onRadioPage = App && App.currentPage === 'radio';

            // Show mini player if:
            // 1. Radio is either playing, loading, reconnecting, or was started
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

            if (titleEl && station) {
                titleEl.textContent = station.name;
            }

            if (subEl) {
                subEl.textContent = state === 'playing' ? 'بث مباشر متواصل'
                    : state === 'loading' ? 'جارٍ الاتصال…'
                    : state === 'reconnecting' ? 'جارٍ إعادة الاتصال…'
                    : state === 'error' ? 'تعذر الاتصال' : 'متوقف مؤقتًا';
            }

            if (playBtn) {
                const icon = playBtn.querySelector('i');
                if (icon) {
                    icon.className = state === 'loading' || state === 'reconnecting'
                        ? 'fas fa-spinner fa-spin'
                        : (isPlaying ? 'fas fa-pause' : 'fas fa-play');
                }
                const label = isPlaying ? 'إيقاف مؤقت' : 'تشغيل';
                playBtn.title = label;
                playBtn.setAttribute('aria-label', label);
            }
        }
    };

    return RadioUI;
});

