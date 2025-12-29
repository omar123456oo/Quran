/**
 * Quran Display Module
 * Handles displaying Surahs, Ayahs, and navigation
 */

const QuranDisplay = {
    surahs: [],
    currentSurah: null,
    currentView: 'surah', // 'surah', 'juz', or 'page'

    /**
     * Initialize the module
     */
    async init() {
        console.log('Initializing Quran Display...');

        try {
            App.showLoading();

            // Load all Surahs metadata
            this.surahs = await APIService.getSurahs();

            // Display Surah list
            this.displaySurahList();

            // Setup tab navigation
            this.setupTabs();

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
    async loadSurah(surahNumber) {
        try {
            App.showLoading();

            // Get Surah data with Arabic text
            const surahData = await APIService.getSurah(surahNumber, 'ar.alafasy');

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
            document.getElementById('homePage').classList.add('hidden');
            document.getElementById('surahPage').classList.remove('hidden');

            // Save as last read position
            Bookmarks.saveLastRead(surahNumber, 1);

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
                    <button class="btn btn-primary mt-4" onclick="AudioPlayer.playFullSurah(${surah.number})" style="display: inline-flex; align-items: center; gap: 8px;">
                        <i class="fas fa-play-circle"></i>
                        تشغيل السورة كاملة
                    </button>
                </div>
            </div>
        `;

        // Display Bismillah for all surahs except Al-Tawbah (Surah 9)
        if (surah.number !== 1 && surah.number !== 9) {
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
            <div class="ayah-container" data-ayah="${ayah.number}" data-surah="${surahNumber}" data-number-in-surah="${ayah.numberInSurah}" data-juz="${juzNumber}" data-page="${pageNumber}">
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
                    ${ayah.text} <span style="color: var(--color-accent); font-weight: 700;">(${ayah.numberInSurah})</span>
                </div>

                ${translation ? `
                    <div class="ayah-translation">
                        ${translation.text}
                    </div>
                ` : ''}
                
                <div class="ayah-controls">
                    <button class="btn btn-icon play-ayah-btn" title="استماع">
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
            const juzData = await APIService.getJuz(juzNumber, 'ar.alafasy');
            
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
            document.getElementById('homePage').classList.add('hidden');
            document.getElementById('surahPage').classList.remove('hidden');

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
                    <button class="btn btn-primary mt-4" onclick="AudioPlayer.playFullJuz(${juzNumber})" style="display: inline-flex; align-items: center; gap: 8px;">
                        <i class="fas fa-play-circle"></i>
                        تشغيل الجزء كاملاً
                    </button>
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
            const pageData = await APIService.getPage(pageNumber, 'ar.alafasy');
            
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
            document.getElementById('homePage').classList.add('hidden');
            document.getElementById('surahPage').classList.remove('hidden');

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
                    <button class="btn btn-primary mt-4" onclick="AudioPlayer.playFullPage(${pageNumber})" style="display: inline-flex; align-items: center; gap: 8px;">
                        <i class="fas fa-play-circle"></i>
                        تشغيل الصفحة كاملة
                    </button>
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
     * Get Arabic number
     */
    getArabicNumber(num) {
        const arabicNums = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
        return num.toString().split('').map(d => arabicNums[parseInt(d)]).join('');
    }
};

window.QuranDisplay = QuranDisplay;
