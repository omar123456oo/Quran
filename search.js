/**
 * Search Module
 * Handles searching within the Quran
 */

const Search = {
    searchResults: [],
    currentQuery: '',

    /**
     * Initialize search module
     */
    init() {
        console.log('Search module initialized');
    },

    /**
     * Normalize Arabic text by removing diacritics/tashkeel and normalizing Alef variations
     */
    normalizeArabic(text) {
        if (!text) return '';

        // Remove Arabic diacritics (tashkeel)
        let normalized = text.replace(/[ً-ْ۔ٰٴە-ۭ]/g, '');

        // Normalize Alef variations to regular Alef
        // ٱ (Alef Wasla U+0671), أ (Alef with Hamza above U+0623), إ (Alef with Hamza below U+0625), آ (Alef with Madda U+0622)
        normalized = normalized.replace(/[ٱأإآ]/g, 'ا');

        // Normalize Teh Marbuta to Heh
        normalized = normalized.replace(/ة/g, 'ه');

        // Normalize Yeh variations
        normalized = normalized.replace(/[ىي]/g, 'ي');

        return normalized.trim();
    },

    /**
     * Perform search
     */
    async performSearch(query) {
        if (!query || query.length < 1) {
            App.showToast('الرجاء إدخال كلمة البحث', 'warning');
            return;
        }

        try {
            App.showLoading();
            this.currentQuery = query;
            this.searchResults = [];

            // Get all surahs metadata first (this is cached and lightweight)
            const surahs = await APIService.getSurahs();

            // First, check if the query matches any Surah name (Arabic or English)
            const normalizedQuery = this.normalizeArabic(query.toLowerCase());
            
            // Helper function to remove common Arabic prefixes from English names
            const removePrefix = (name) => {
                return name.replace(/^(al-|an-|as-|at-|ar-)/i, '').trim();
            };
            
            const matchingSurahs = surahs.filter(surah => {
                const normalizedArabicName = this.normalizeArabic(surah.name.toLowerCase());
                const englishName = surah.englishName.toLowerCase();
                const englishTranslation = surah.englishNameTranslation.toLowerCase();
                
                // Remove prefixes for more flexible matching
                const englishNameNoPrefix = removePrefix(englishName);
                const queryNoPrefix = removePrefix(query.toLowerCase());
                
                return normalizedArabicName.includes(normalizedQuery) ||
                       englishName.includes(query.toLowerCase()) ||
                       englishNameNoPrefix.includes(queryNoPrefix) ||
                       englishTranslation.includes(query.toLowerCase());
            });

            // If Surah names match, navigate directly or show surah list
            if (matchingSurahs.length > 0) {
                // If only one match and query is short (likely a surah name), load that surah directly
                if (matchingSurahs.length === 1 && query.length < 15) {
                    App.hideLoading();
                    QuranDisplay.loadSurah(matchingSurahs[0].number);
                    App.showToast(`تم العثور على: ${matchingSurahs[0].name}`, 'success');
                    return;
                } else {
                    // Show matching surahs as results
                    matchingSurahs.forEach(surah => {
                        this.searchResults.push({
                            text: `${surah.name} - ${surah.englishName}`,
                            numberInSurah: 1,
                            isSurahResult: true,
                            surah: {
                                number: surah.number,
                                name: surah.name,
                                englishName: surah.englishName,
                                englishNameTranslation: surah.englishNameTranslation,
                                revelationType: surah.revelationType,
                                numberOfAyahs: surah.numberOfAyahs
                            }
                        });
                    });
                }
            }

            // Only search in verse text if query is longer (more specific search)
            // and if we don't have enough Surah results
            if (query.length >= 3 && this.searchResults.length < 5) {
                try {
                    App.showToast('جاري البحث في آيات القرآن...', 'info');
                    
                    // Use the API's search endpoint for verse text
                    const searchResults = await APIService.search(query, 'all', 'quran-uthmani');
                    
                    if (searchResults && searchResults.matches) {
                        searchResults.matches.forEach(match => {
                            // Find the surah info from our cached list
                            const surahInfo = surahs.find(s => s.number === match.surah.number);
                            
                            this.searchResults.push({
                                text: match.text,
                                numberInSurah: match.numberInSurah,
                                isSurahResult: false,
                                surah: {
                                    number: match.surah.number,
                                    name: match.surah.name,
                                    englishName: match.surah.englishName || surahInfo?.englishName,
                                    englishNameTranslation: match.surah.englishNameTranslation || surahInfo?.englishNameTranslation,
                                    revelationType: match.surah.revelationType || surahInfo?.revelationType
                                }
                            });
                        });
                    }
                } catch (searchError) {
                    // If API search fails (e.g., CORS), show surah results only
                    console.warn('Verse text search failed (this is expected with file:// protocol):', searchError);
                    if (this.searchResults.length > 0) {
                        App.showToast('تم العثور على نتائج في أسماء السور فقط', 'info');
                    }
                }
            }

            // Display results
            this.displayResults();

            // Navigate to search page only if we have results or attempted a search
            if (this.searchResults.length > 0 || query.length >= 3) {
                App.navigateToPage('search');
            }

            App.hideLoading();
        } catch (error) {
            console.error('Search error:', error);
            App.showToast('حدث خطأ في البحث. الرجاء استخدام خادم محلي لبحث أفضل.', 'warning');
            App.hideLoading();
        }
    },

    /**
     * Display search results
     */
    displayResults() {
        const container = document.getElementById('searchResults');
        if (!container) return;

        if (this.searchResults.length === 0) {
            container.innerHTML = `
                <div class="card text-center">
                    <i class="fas fa-search" style="font-size: 3rem; color: var(--color-text-light); margin-bottom: 1rem;"></i>
                    <h3>لا توجد نتائج</h3>
                    <p style="color: var(--color-text-gray);">لم يتم العثور على نتائج للبحث عن "${this.currentQuery}"</p>
                </div>
            `;
            return;
        }

        let html = `
            <div class="mb-4">
                <h3>نتائج البحث عن "${this.currentQuery}"</h3>
                <p style="color: var(--color-text-gray);">وجدت ${this.searchResults.length} نتيجة</p>
            </div>
        `;

        this.searchResults.forEach(result => {
            html += this.createResultCard(result);
        });

        container.innerHTML = html;

        // Setup click handlers
        this.setupResultHandlers();
    },

    /**
     * Create result card
     */
    createResultCard(result) {
        const surah = result.surah;
        
        // Handle Surah name results differently
        if (result.isSurahResult) {
            return `
                <div class="card mb-4 search-result-card" data-surah="${surah.number}" data-ayah="1" style="cursor: pointer;">
                    <div class="flex items-center justify-between mb-3">
                        <div>
                            <span class="text-lg arabic-text" style="color: var(--color-primary); font-weight: 600;">
                                ${surah.name}
                            </span>
                        </div>
                        <span class="text-sm" style="color: var(--color-text-gray);">
                            ${surah.numberOfAyahs} آية
                        </span>
                    </div>
                    
                    <div style="font-size: var(--text-md); color: var(--color-text-gray);">
                        ${surah.englishName} - ${surah.englishNameTranslation}
                    </div>
                    
                    <div class="mt-3 flex gap-4">
                        <button class="btn btn-primary btn-sm goto-result-btn">
                            <i class="fas fa-book-open"></i>
                            فتح السورة
                        </button>
                        <button class="btn btn-secondary btn-sm play-surah-full-btn">
                            <i class="fas fa-play-circle"></i>
                            تشغيل السورة كاملة
                        </button>
                    </div>
                </div>
            `;
        }
        
        // Handle regular ayah results
        const highlightedText = this.highlightSearchTerm(result.text, this.currentQuery);

        return `
            <div class="card mb-4 search-result-card" data-surah="${surah.number}" data-ayah="${result.numberInSurah}" style="cursor: pointer;">
                <div class="flex items-center justify-between mb-3">
                    <div>
                        <span class="text-sm" style="color: var(--color-primary); font-weight: 600;">
                            ${surah.name} - ${surah.englishName}
                        </span>
                    </div>
                    <span class="text-sm" style="color: var(--color-text-gray);">
                        آية ${result.numberInSurah}
                    </span>
                </div>
                
                <div class="arabic-text" style="font-size: var(--text-xl);">
                    ${highlightedText}
                </div>
                
                <div class="mt-3 flex gap-4">
                    <button class="btn btn-secondary btn-sm play-result-btn">
                        <i class="fas fa-play"></i>
                        استماع
                    </button>
                    <button class="btn btn-secondary btn-sm tafseer-result-btn">
                        <i class="fas fa-book"></i>
                        التفسير
                    </button>
                    <button class="btn btn-secondary btn-sm goto-result-btn">
                        <i class="fas fa-arrow-left"></i>
                        الذهاب للآية
                    </button>
                </div>
            </div>
        `;
    },

    /**
     * Highlight search term in text
     */
    highlightSearchTerm(text, term) {
        if (!term) return text;

        const regex = new RegExp(`(${term})`, 'gi');
        return text.replace(regex, '<mark style="background: var(--color-accent-light); padding: 2px 4px; border-radius: 3px;">$1</mark>');
    },

    /**
     * Setup result card handlers
     */
    setupResultHandlers() {
        // Play buttons
        document.querySelectorAll('.play-result-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const card = e.target.closest('.search-result-card');
                const surah = card.dataset.surah;
                const ayah = card.dataset.ayah;
                AudioPlayer.playAyah(surah, ayah);
            });
        });

        // Play full surah buttons (for surah results)
        document.querySelectorAll('.play-surah-full-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const card = e.target.closest('.search-result-card');
                const surah = card.dataset.surah;
                AudioPlayer.playFullSurah(parseInt(surah));
            });
        });

        // Tafseer buttons
        document.querySelectorAll('.tafseer-result-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const card = e.target.closest('.search-result-card');
                const surah = card.dataset.surah;
                const ayah = card.dataset.ayah;
                Tafseer.showTafseer(surah, ayah);
            });
        });

        // Go to Ayah buttons (and card click)
        const goToAyah = (card) => {
            const surah = card.dataset.surah;
            const ayah = card.dataset.ayah;
            QuranDisplay.loadSurah(parseInt(surah));

            // After a brief delay, scroll to the specific ayah
            setTimeout(() => {
                const ayahElement = document.querySelector(`.ayah-container[data-surah="${surah}"][data-number-in-surah="${ayah}"]`);
                if (ayahElement) {
                    ayahElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    ayahElement.style.background = 'linear-gradient(90deg, rgba(212, 175, 55, 0.2), transparent)';
                }
            }, 500);
        };

        document.querySelectorAll('.goto-result-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const card = e.target.closest('.search-result-card');
                goToAyah(card);
            });
        });

        document.querySelectorAll('.search-result-card').forEach(card => {
            card.addEventListener('click', () => {
                goToAyah(card);
            });
        });
    }
};

window.Search = Search;
