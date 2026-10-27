/**
 * Quran Display Module
 * Handles displaying Surahs, Ayahs, and navigation
 */

const QuranDisplay = {
    surahs: [],
    currentSurah: null,
    currentView: 'surah', // 'surah', 'juz', or 'page'
    // Quranic text always comes from this single edition, independent of the selected reciter.
    TEXT_EDITION: 'quran-uthmani',
    selectedAyah: null,   // { surah, ayah } chosen by the user in the reader (distinct from the playing ayah)
    highlightedKey: null,

    /**
     * Initialize the module
     */
    async init() {
        console.log('Initializing Quran Display...');
        this.setupPlaybackSync();

        try {
            App.showLoading();

            // Load all Surahs metadata; offline, fall back to the bundled verified list.
            try {
                this.surahs = await APIService.getSurahs();
            } catch (e) {
                this.surahs = MushafMeta.surahs.map((s, i) => ({
                    number: i + 1, name: s[0], englishName: s[1], numberOfAyahs: s[2], revelationType: s[3]
                }));
            }

            // Display Surah list
            this.displaySurahList();

            // Setup tab navigation
            this.setupTabs();

            PlaybackStore.emit(['meta']);

            App.hideLoading();
        } catch (error) {
            console.error('Error initializing Quran Display:', error);
            App.showToast('حدث خطأ في تحميل البيانات', 'error');
            App.hideLoading();
        }
    },

    /**
     * Setup navigation tabs (Surah/Juz/Page)
     */
    setupTabs() {
        const surahTab = document.getElementById('surahTab');
        const juzTab = document.getElementById('juzTab');
        const pageTab = document.getElementById('pageTab');

        if (surahTab) {
            surahTab.addEventListener('click', () => {
                this.switchView('surah');
                this.setActiveTab(surahTab);
            });
        }

        if (juzTab) {
            juzTab.addEventListener('click', () => {
                this.switchView('juz');
                this.setActiveTab(juzTab);
            });
        }

        if (pageTab) {
            pageTab.addEventListener('click', () => {
                this.switchView('page');
                this.setActiveTab(pageTab);
            });
        }
    },

    /**
     * Set active tab
     */
    setActiveTab(activeTab) {
        const tabs = [
            document.getElementById('surahTab'),
            document.getElementById('juzTab'),
            document.getElementById('pageTab')
        ];

        tabs.forEach(tab => {
            if (tab) {
                tab.classList.remove('active');
            }
        });

        if (activeTab) {
            activeTab.classList.add('active');
        }
    },

    /**
     * Switch between different views
     */
    switchView(view) {
        this.currentView = view;

        switch (view) {
            case 'surah':
                this.displaySurahList();
                break;
            case 'juz':
                this.displayJuzList();
                break;
            case 'page':
                this.displayPageList();
                break;
        }
    },

    /**
     * Display Surah list
     */
    displaySurahList() {
        const container = document.getElementById('surahList');
        if (!container) return;

        container.innerHTML = '';

        this.surahs.forEach(surah => {
            const card = this.createSurahCard(surah);
            container.appendChild(card);
        });
    },

    /**
     * Create Surah card element
     */
    createSurahCard(surah) {
        const card = document.createElement('div');
        card.className = 'surah-card';
        card.onclick = () => this.loadSurah(surah.number);

        const revelationType = surah.revelationType === 'Meccan' ? 'مكية' : 'مدنية';

        card.innerHTML = `
            <div class="surah-header">
                <div class="surah-number">${surah.number}</div>
                <div class="surah-info">
                    <div class="surah-name-arabic">${surah.name}</div>
                    <div class="surah-name-transliteration">${surah.englishName}</div>
                </div>
            </div>
            <div class="surah-meta">
                <span><i class="fas fa-book-open"></i> ${surah.numberOfAyahs} آية</span>
                <span><i class="fas fa-map-marker-alt"></i> ${revelationType}</span>
                ${typeof Downloads !== 'undefined' ? Downloads.cardButton(surah.number) : ''}
            </div>
        `;

        return card;
    },

    /**
     * Display Juz list
     */
    displayJuzList() {
        const container = document.getElementById('surahList');
        if (!container) return;

        container.innerHTML = '';

        for (let i = 1; i <= 30; i++) {
            const card = document.createElement('div');
            card.className = 'surah-card';
            card.onclick = () => this.loadJuz(i);

            card.innerHTML = `
                <div class="surah-header">
                    <div class="surah-number">${i}</div>
                    <div class="surah-info">
                        <div class="surah-name-arabic">الجزء ${this.getArabicNumber(i)}</div>
                        <div class="surah-name-transliteration">Juz ${i}</div>
                    </div>
                </div>
            `;

            container.appendChild(card);
        }
    },

    /**
     * Display Page list
     */
    displayPageList() {
        const container = document.getElementById('surahList');
        if (!container) return;

        container.innerHTML = '';

        // Display all 604 pages
        for (let i = 1; i <= 604; i++) {
            const card = document.createElement('div');
            card.className = 'surah-card';
            card.onclick = () => this.loadPage(i);

            card.innerHTML = `
                <div class="surah-header">
                    <div class="surah-number">${i}</div>
                    <div class="surah-info">
                        <div class="surah-name-arabic">صفحة ${this.getArabicNumber(i)}</div>
                        <div class="surah-name-transliteration">Page ${i}</div>
                    </div>
                </div>
                <div class="surah-meta">
                    <span><i class="fas fa-file-alt"></i> صفحة ${i}</span>
                </div>
            `;

            container.appendChild(card);
        }
    },

    /**
     * Load and display a Surah
     */
    async loadSurah(surahNumber, focusAyah) {
        try {
            App.showLoading();

            // Get Surah data with Arabic text
            const surahData = await APIService.getSurah(surahNumber, this.TEXT_EDITION);

            // Get translation if enabled
            let translationData = null;
            if (App.settings.showTranslation) {
                translationData = await APIService.getSurah(surahNumber, App.settings.defaultTranslation);
            }

            this.currentSurah = {
                arabic: surahData,
                translation: translationData
            };

            // Display the Surah
            this.displaySurah(surahData, translationData);

            // Navigate to Surah page
            App.showReader();

            // Save as last read position (the user's reading position, not the playback position)
            Bookmarks.saveLastRead(surahNumber, 1);
            const first = surahData.ayahs[0];
            PlaybackStore.setReading({ surah: surahNumber, ayah: 1, page: first ? first.page : null });

            if (focusAyah) this.scrollToAyah(surahNumber, focusAyah, false);
            else window.scrollTo({ top: 0 });

            App.hideLoading();
        } catch (error) {
            console.error('Error loading Surah:', error);
            App.showToast('حدث خطأ في تحميل السورة', 'error');
            App.hideLoading();
        }
    },

    /**
     * Display Surah content
     */
    displaySurah(arabicData, translationData) {
        const container = document.getElementById('surahContent');
        if (!container) return;

        const surah = arabicData;
        const revelationType = surah.revelationType === 'Meccan' ? 'مكية' : 'مدنية';

        let html = `
            <div class="card mb-4">
                <div class="text-center">
                    <h2 class="arabic-text" style="font-size: var(--text-4xl);">${surah.name}</h2>
                    <h3>${surah.englishName} - ${surah.englishNameTranslation}</h3>
                    <div class="surah-meta" style="justify-content: center;">
                        <span><i class="fas fa-book-open"></i> ${surah.numberOfAyahs} آية</span>
                        <span><i class="fas fa-map-marker-alt"></i> ${revelationType}</span>
                    </div>
                    ${this.playActions('surah', surah.number, 'تشغيل السورة كاملة')}
                </div>
            </div>
        `;

        // The source text of the first ayah may already begin with the Bismillah; never show it twice
        // and never edit the source text.
        const firstText = (surah.ayahs[0] && surah.ayahs[0].text || '').replace(/^\uFEFF/, '');
        const textHasBismillah = firstText.startsWith('بِسْمِ');
        if (surah.number !== 1 && surah.number !== 9 && !textHasBismillah) {
            html += `
                <div class="card mb-4 text-center">
                    <div class="arabic-text" style="font-size: var(--text-3xl);">
                        بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
                    </div>
                </div>
            `;
        }

        // Display each Ayah
        surah.ayahs.forEach((ayah, index) => {
            const translation = translationData ? translationData.ayahs[index] : null;
            html += this.createAyahElement(ayah, translation, surah.number);
        });

        container.innerHTML = html;

        // Setup Ayah interactions
        this.setupAyahInteractions();
    },

    /**
     * Create Ayah element
     */
    createAyahElement(ayah, translation, surahNumber) {
        // معلومات الجزء والصفحة متوفرة في بيانات الآية من API
        const juzNumber = ayah.juz || '';
        const pageNumber = ayah.page || '';
        const hizbQuarter = ayah.hizbQuarter || '';
        
        return `
            <div class="ayah-container" tabindex="-1" data-ayah="${ayah.number}" data-surah="${surahNumber}" data-number-in-surah="${ayah.numberInSurah}" data-juz="${juzNumber}" data-page="${pageNumber}">
                <!-- معلومات الجزء والصفحة -->
                <div class="ayah-meta" style="display: flex; gap: 8px; margin-bottom: 8px; flex-wrap: wrap;">
                    ${juzNumber ? `
                        <span class="meta-badge" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600; display: inline-flex; align-items: center; gap: 4px;">
                            <i class="fas fa-bookmark" style="font-size: 10px;"></i>
                            الجزء ${this.getArabicNumber(juzNumber)}
                        </span>
                    ` : ''}
                    ${pageNumber ? `
                        <span class="meta-badge" style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600; display: inline-flex; align-items: center; gap: 4px;">
                            <i class="fas fa-file-alt" style="font-size: 10px;"></i>
                            صفحة ${this.getArabicNumber(pageNumber)}
                        </span>
                    ` : ''}
                    ${hizbQuarter ? `
                        <span class="meta-badge" style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); color: white; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600; display: inline-flex; align-items: center; gap: 4px;">
                            <i class="fas fa-layer-group" style="font-size: 10px;"></i>
                            حزب ${this.getArabicNumber(hizbQuarter)}
                        </span>
                    ` : ''}
                </div>

                <div class="ayah-arabic">
                    ${QuranUtil.esc(ayah.text)} <span class="ayah-number" aria-label="آية ${ayah.numberInSurah}">﴿${QuranUtil.toArabicDigits(ayah.numberInSurah)}﴾</span>
                </div>

                ${translation ? `
                    <div class="ayah-translation">
                        ${QuranUtil.esc(translation.text)}
                    </div>
                ` : ''}
                
                <div class="ayah-controls">
                    <button class="btn btn-icon play-ayah-btn" title="استماع" aria-label="استماع إلى الآية ${ayah.numberInSurah}">
                        <i class="fas fa-play"></i>
                    </button>
                    <button class="btn btn-icon tafseer-btn" title="التفسير">
                        <i class="fas fa-book"></i>
                    </button>
                    <button class="btn btn-icon bookmark-btn" title="إضافة إلى المحفوظات">
                        <i class="far fa-bookmark"></i>
                    </button>
                    <button class="btn btn-icon share-btn" title="مشاركة">
                        <i class="fas fa-share-alt"></i>
                    </button>
                </div>
            </div>
        `;
    },

    /**
     * Setup Ayah interactions (play, tafseer, bookmark, etc.)
     */
    setupAyahInteractions() {
        // Select an ayah (reading position) by clicking its text area
        document.querySelectorAll('.ayah-container').forEach(container => {
            container.addEventListener('click', (e) => {
                if (e.target.closest('button')) return;
                this.selectAyah(container);
            });
        });
        this.highlightedKey = null;
        this.applyPlaybackHighlight();

        // Play buttons
        document.querySelectorAll('.play-ayah-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const container = e.target.closest('.ayah-container');
                const surahNum = container.dataset.surah;
                const ayahNum = container.dataset.numberInSurah;
                AudioPlayer.playAyah(surahNum, ayahNum);
            });
        });

        // Tafseer buttons
        document.querySelectorAll('.tafseer-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const container = e.target.closest('.ayah-container');
                const surahNum = container.dataset.surah;
                const ayahNum = container.dataset.numberInSurah;
                Tafseer.showTafseer(surahNum, ayahNum);
            });
        });

        // Bookmark buttons
        document.querySelectorAll('.bookmark-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const container = e.target.closest('.ayah-container');
                const surahNum = container.dataset.surah;
                const ayahNum = container.dataset.numberInSurah;
                const ayahText = container.querySelector('.ayah-arabic').textContent.trim();
                Bookmarks.addBookmark(surahNum, ayahNum, ayahText);

                // Toggle icon
                const icon = e.target.closest('button').querySelector('i');
                icon.classList.toggle('far');
                icon.classList.toggle('fas');
            });
        });

        // Share buttons
        document.querySelectorAll('.share-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const container = e.target.closest('.ayah-container');
                const ayahText = container.querySelector('.ayah-arabic').textContent;

                if (navigator.share) {
                    navigator.share({
                        title: 'آية من القرآن الكريم',
                        text: ayahText
                    });
                } else {
                    navigator.clipboard.writeText(ayahText);
                    App.showToast('تم نسخ الآية', 'success');
                }
            });
        });
    },

    /**
     * Load Juz
     */
    async loadJuz(juzNumber) {
        try {
            App.showLoading();
            
            // Load Juz data
            const juzData = await APIService.getJuz(juzNumber, this.TEXT_EDITION);
            
            // Get translation if enabled
            let translationData = null;
            if (App.settings.showTranslation) {
                translationData = await APIService.getJuz(juzNumber, App.settings.defaultTranslation);
            }

            this.currentSurah = {
                arabic: juzData,
                translation: translationData,
                type: 'juz'
            };

            // Display the Juz
            this.displayJuz(juzData, translationData, juzNumber);

            // Navigate to Surah page
            App.showReader();

            App.hideLoading();
        } catch (error) {
            console.error('Error loading Juz:', error);
            App.showToast('حدث خطأ في تحميل الجزء', 'error');
            App.hideLoading();
        }
    },

    /**
     * Display Juz content
     */
    displayJuz(arabicData, translationData, juzNumber) {
        const container = document.getElementById('surahContent');
        if (!container) return;

        let html = `
            <div class="card mb-4">
                <div class="text-center">
                    <h2 class="arabic-text" style="font-size: var(--text-4xl);">الجزء ${this.getArabicNumber(juzNumber)}</h2>
                    <h3>Juz ${juzNumber}</h3>
                    <div class="surah-meta" style="justify-content: center;">
                        <span><i class="fas fa-book-open"></i> ${arabicData.ayahs.length} آية</span>
                    </div>
                    ${this.playActions('juz', juzNumber, 'تشغيل الجزء كاملاً')}
                </div>
            </div>
        `;

        // Group ayahs by Surah
        const ayahsBySurah = {};
        arabicData.ayahs.forEach((ayah, index) => {
            const surahNum = ayah.surah.number;
            if (!ayahsBySurah[surahNum]) {
                ayahsBySurah[surahNum] = {
                    surah: ayah.surah,
                    ayahs: []
                };
            }
            ayahsBySurah[surahNum].ayahs.push({
                arabic: ayah,
                translation: translationData ? translationData.ayahs[index] : null
            });
        });

        // Display ayahs grouped by Surah
        Object.values(ayahsBySurah).forEach(group => {
            const revelationType = group.surah.revelationType === 'Meccan' ? 'مكية' : 'مدنية';
            
            html += `
                <div class="card mb-4" style="border-right: 4px solid var(--color-accent);">
                    <div style="background: var(--color-bg-light); padding: 15px; border-radius: var(--radius-md); margin-bottom: 15px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap;">
                            <h3 class="arabic-text" style="color: var(--color-accent); margin: 0;">${group.surah.name}</h3>
                            <div class="surah-meta">
                                <span><i class="fas fa-sort-numeric-down"></i> سورة ${group.surah.number}</span>
                                <span><i class="fas fa-map-marker-alt"></i> ${revelationType}</span>
                            </div>
                        </div>
                    </div>
                    
                    ${group.ayahs.map(({arabic, translation}) => 
                        this.createAyahElement(arabic, translation, group.surah.number)
                    ).join('')}
                </div>
            `;
        });

        container.innerHTML = html;

        // Setup Ayah interactions
        this.setupAyahInteractions();
    },

    /**
     * Load Page
     */
    async loadPage(pageNumber) {
        try {
            App.showLoading();
            
            // Load Page data
            const pageData = await APIService.getPage(pageNumber, this.TEXT_EDITION);
            
            // Get translation if enabled
            let translationData = null;
            if (App.settings.showTranslation) {
                translationData = await APIService.getPage(pageNumber, App.settings.defaultTranslation);
            }

            this.currentSurah = {
                arabic: pageData,
                translation: translationData,
                type: 'page'
            };

            // Display the Page
            this.displayPage(pageData, translationData, pageNumber);

            // Navigate to Surah page
            App.showReader();
            PlaybackStore.setReading({ page: pageNumber });

            App.hideLoading();
        } catch (error) {
            console.error('Error loading Page:', error);
            App.showToast('حدث خطأ في تحميل الصفحة', 'error');
            App.hideLoading();
        }
    },

    /**
     * Display Page content
     */
    displayPage(arabicData, translationData, pageNumber) {
        const container = document.getElementById('surahContent');
        if (!container) return;

        let html = `
            <div class="card mb-4">
                <div class="text-center">
                    <h2 class="arabic-text" style="font-size: var(--text-4xl);">صفحة ${this.getArabicNumber(pageNumber)}</h2>
                    <h3>Page ${pageNumber}</h3>
                    <div class="surah-meta" style="justify-content: center;">
                        <span><i class="fas fa-book-open"></i> ${arabicData.ayahs.length} آية</span>
                    </div>
                    ${this.playActions('page', pageNumber, 'تشغيل الصفحة كاملة')}
                </div>
            </div>
        `;

        // Group ayahs by Surah
        const ayahsBySurah = {};
        arabicData.ayahs.forEach((ayah, index) => {
            const surahNum = ayah.surah.number;
            if (!ayahsBySurah[surahNum]) {
                ayahsBySurah[surahNum] = {
                    surah: ayah.surah,
                    ayahs: []
                };
            }
            ayahsBySurah[surahNum].ayahs.push({
                arabic: ayah,
                translation: translationData ? translationData.ayahs[index] : null
            });
        });

        // Display ayahs grouped by Surah
        Object.values(ayahsBySurah).forEach(group => {
            const revelationType = group.surah.revelationType === 'Meccan' ? 'مكية' : 'مدنية';
            
            html += `
                <div class="card mb-4" style="border-right: 4px solid var(--color-accent);">
                    <div style="background: var(--color-bg-light); padding: 15px; border-radius: var(--radius-md); margin-bottom: 15px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap;">
                            <h3 class="arabic-text" style="color: var(--color-accent); margin: 0;">${group.surah.name}</h3>
                            <div class="surah-meta">
                                <span><i class="fas fa-sort-numeric-down"></i> سورة ${group.surah.number}</span>
                                <span><i class="fas fa-map-marker-alt"></i> ${revelationType}</span>
                            </div>
                        </div>
                    </div>
                    
                    ${group.ayahs.map(({arabic, translation}) => 
                        this.createAyahElement(arabic, translation, group.surah.number)
                    ).join('')}
                </div>
            `;
        });

        container.innerHTML = html;

        // Setup Ayah interactions
        this.setupAyahInteractions();
    },

    /**
     * HTML for the play / play next / queue / playlist actions of a Surah, page or Juz.
     */
    playActions(kind, ref, playLabel) {
        const sel = `data-kind="${kind}" data-ref="${ref}"`;
        return `
            <div class="play-actions" role="group" aria-label="خيارات التشغيل">
                <button class="btn btn-primary" ${sel} onclick="AudioPlayer.playNow(this.dataset.kind, +this.dataset.ref)">
                    <i class="fas fa-play-circle" aria-hidden="true"></i> ${playLabel}
                </button>
                <button class="btn btn-secondary" ${sel} onclick="AudioPlayer.playNextItem(this.dataset.kind, +this.dataset.ref)">
                    <i class="fas fa-forward-step" aria-hidden="true"></i> تشغيل التالي
                </button>
                <button class="btn btn-secondary" ${sel} onclick="AudioPlayer.addToQueue(this.dataset.kind, +this.dataset.ref)">
                    <i class="fas fa-list-ol" aria-hidden="true"></i> إلى الطابور
                </button>
                ${kind === 'surah' ? `<button class="btn btn-secondary" onclick="PlaylistsUI.addSurahToSelected(${ref})">
                    <i class="fas fa-folder-plus" aria-hidden="true"></i> إلى قائمة تشغيل
                </button>` : ''}
            </div>`;
    },

    /** Mark an ayah as the user's selected ayah (does not affect playback). */
    selectAyah(container) {
        document.querySelectorAll('.ayah-container.ayah-selected').forEach(el => el.classList.remove('ayah-selected'));
        container.classList.add('ayah-selected');
        const surah = parseInt(container.dataset.surah, 10);
        const ayah = parseInt(container.dataset.numberInSurah, 10);
        const page = parseInt(container.dataset.page, 10) || null;
        this.selectedAyah = { surah, ayah };
        PlaybackStore.setReading({ surah, ayah, page });
        Bookmarks.saveLastRead(surah, ayah);
    },

    /** Keep the reader in step with playback. Subscribed once. */
    setupPlaybackSync() {
        if (this._syncBound) return;
        this._syncBound = true;
        PlaybackStore.subscribe((state, keys) => {
            if (keys.includes('ayah') || keys.includes('surah') || keys.includes('itemId') || keys.includes('meta')) {
                this.applyPlaybackHighlight(true);
            }
            if (keys.includes('itemId') || keys.includes('status') || keys.includes('ayah')) this.updateJumpButton();
        });
        const follow = document.getElementById('followPlaybackToggle');
        if (follow) {
            follow.checked = PlayerState.prefs.followPlayback;
            follow.addEventListener('change', () => {
                PlayerState.prefs.followPlayback = follow.checked;
                PlayerState.persist();
            });
        }
        const jump = document.getElementById('jumpToPlayingBtn');
        if (jump) jump.addEventListener('click', () => this.jumpToPlaying());
        this.updateJumpButton();
    },

    /** Highlight the playing ayah (class only — the selected ayah keeps its own style). */
    applyPlaybackHighlight(scroll) {
        const s = PlaybackStore.get();
        const active = s.status === 'playing' || s.status === 'buffering' || s.status === 'loading' || s.status === 'paused';
        const key = active && s.surah && s.ayah ? `${s.surah}:${s.ayah}` : null;
        const changed = key !== this.highlightedKey;
        document.querySelectorAll('.ayah-container.ayah-playing').forEach(el => el.classList.remove('ayah-playing'));
        this.highlightedKey = key;
        if (!key) return;
        const el = document.querySelector(`.ayah-container[data-surah="${s.surah}"][data-number-in-surah="${s.ayah}"]`);
        if (!el) return;
        el.classList.add('ayah-playing');
        const readerVisible = !document.getElementById('surahPage').classList.contains('hidden');
        if (scroll && changed && readerVisible && PlayerState.prefs.followPlayback && s.status !== 'paused') {
            const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
            el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
        }
    },

    scrollToAyah(surah, ayah, smooth) {
        const el = document.querySelector(`.ayah-container[data-surah="${surah}"][data-number-in-surah="${ayah}"]`);
        if (!el) return false;
        const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
        el.scrollIntoView({ behavior: smooth && !reduce ? 'smooth' : 'auto', block: 'center' });
        return true;
    },

    /** Go to the reader at the ayah that is currently playing (loads its Surah if needed). */
    async jumpToPlaying() {
        const s = PlaybackStore.get();
        if (!s.surah) {
            App.showToast('لا يوجد تشغيل حالي', 'info');
            return;
        }
        const el = document.querySelector(`.ayah-container[data-surah="${s.surah}"][data-number-in-surah="${s.ayah}"]`);
        if (el) {
            App.showReader();
            this.scrollToAyah(s.surah, s.ayah, true);
        } else {
            await this.loadSurah(s.surah, s.ayah);
        }
        this.applyPlaybackHighlight();
    },

    updateJumpButton() {
        const btn = document.getElementById('jumpToPlayingBtn');
        if (!btn) return;
        const s = PlaybackStore.get();
        btn.hidden = !s.surah || s.status === 'idle';
    },

    /**
     * Get Arabic number
     */
    getArabicNumber(num) {
        const arabicNums = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
        return num.toString().split('').map(d => arabicNums[parseInt(d)]).join('');
    }
};

window.QuranDisplay = QuranDisplay;
