/**
 * Search Module
 * Handles searching within the Quran with support for Arabic, English, and Franco-Arabic
 */

const Search = {
    searchResults: [],
    currentQuery: '',
    currentPage: 1,
    resultsPerPage: 10,
    totalPages: 1,
    handlersSetup: false,
    paginationHandler: null,
    resultHandler: null,

    /**
     * Initialize search module
     */
    init() {
        console.log('Search module initialized');
        this.currentPage = 1;
        this.searchResults = [];
        this.currentQuery = '';
        this.totalPages = 1;
    },

    /**
     * Convert Franco-Arabic (Arabic written in Latin script) to Arabic
     */
    francoToArabic(franco) {
        if (!franco) return '';
        
        const francoMap = {
            // Common words/phrases (longest first)
            'allah': 'الله', 'bismillah': 'بسم الله', 'inshallah': 'إن شاء الله',
            'mashallah': 'ما شاء الله', 'alhamdulillah': 'الحمد لله',
            'subhanallah': 'سبحان الله', 'astaghfirullah': 'أستغفر الله',
            'wa': 'و', 'fi': 'في', 'min': 'من', 'ila': 'إلى', 'ala': 'على',
            'li': 'ل', 'bi': 'ب', 'ana': 'أنا', 'anta': 'أنت', 'anti': 'أنت',
            'huwa': 'هو', 'hiya': 'هي', 'nahnu': 'نحن', 'antum': 'أنتم', 'hum': 'هم',
            'ma': 'ما', 'la': 'لا', 'kif': 'كيف', 'ayn': 'أين', 'mata': 'متى',
            // Letter combinations (longest first)
            'sh': 'ش', 'th': 'ث', 'kh': 'خ', 'dh': 'ذ', 'gh': 'غ',
            // Single letters with numbers
            '2': 'أ', '3': 'ع', '5': 'خ', '7': 'ح', '8': 'غ', '9': 'ق',
            // Single letters
            'a': 'ا', 'b': 'ب', 't': 'ت', 'j': 'ج', 'h': 'ح',
            'd': 'د', 'r': 'ر', 'z': 'ز', 's': 'س', 'f': 'ف',
            'q': 'ق', 'k': 'ك', 'l': 'ل', 'm': 'م', 'n': 'ن',
            'w': 'و', 'y': 'ي'
        };

        let arabic = franco.toLowerCase().trim();
        
        // Replace common Franco-Arabic patterns (longest matches first)
        const sortedKeys = Object.keys(francoMap).sort((a, b) => b.length - a.length);
        
        sortedKeys.forEach(key => {
            // Use word boundaries for longer keys to avoid partial matches
            if (key.length > 2) {
                const regex = new RegExp(`\\b${this.escapeRegex(key)}\\b`, 'gi');
                arabic = arabic.replace(regex, francoMap[key]);
            } else {
                const regex = new RegExp(this.escapeRegex(key), 'gi');
                arabic = arabic.replace(regex, francoMap[key]);
            }
        });

        return arabic;
    },

    /**
     * Detect if text is Arabic, English, or Franco-Arabic
     */
    detectLanguage(text) {
        if (!text) return 'unknown';
        
        // Check if contains Arabic characters
        const arabicRegex = /[\u0600-\u06FF]/;
        if (arabicRegex.test(text)) {
            return 'arabic';
        }
        
        // Check if it's Franco-Arabic (Latin script with numbers like 3, 7, 9, etc. commonly used in Franco)
        const francoPattern = /[a-z]+[23789]|[23789][a-z]+/i;
        if (francoPattern.test(text) || /[a-z]+(?:allah|wa|fi|min|ila|ana|anta|huwa)/i.test(text)) {
            return 'franco';
        }
        
        // Otherwise, assume English
        return 'english';
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
     * Escape special regex characters
     */
    escapeRegex(str) {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    },

    /**
     * Perform search with multi-language support
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
            this.currentPage = 1;

            // Detect language and prepare search terms
            const language = this.detectLanguage(query);
            let arabicQuery = query;
            let englishQuery = query.toLowerCase();

            // Convert Franco-Arabic to Arabic if needed
            if (language === 'franco') {
                arabicQuery = this.francoToArabic(query);
                // Also search in original Franco format
            }

            // Normalize Arabic query
            if (language === 'arabic' || language === 'franco') {
                arabicQuery = this.normalizeArabic(arabicQuery);
            }

            // Get all surahs metadata first
            const surahs = await APIService.getSurahs();

            // Validate surahs data
            if (!surahs || !Array.isArray(surahs) || surahs.length === 0) {
                throw new Error('Failed to load surahs data');
            }

            // Show progress toast
            const searchType = language === 'english' ? 'English translations' : 
                              language === 'franco' ? 'Franco-Arabic & Arabic' : 'Arabic';
            App.showToast(`جاري البحث في ${searchType}...`, 'info');

            // Get default translation for English search
            const defaultTranslation = (App.settings && App.settings.defaultTranslation) || 'en.sahih';

            // Process surahs in batches for better performance
            const batchSize = 10;
            for (let i = 0; i < surahs.length; i += batchSize) {
                const batch = surahs.slice(i, Math.min(i + batchSize, surahs.length));

                // Search surahs in parallel within the batch
                await Promise.all(batch.map(async (surah) => {
                    try {
                        // Validate surah object
                        if (!surah || !surah.number) {
                            console.warn('Invalid surah object:', surah);
                            return;
                        }

                        // Fetch surah with Arabic text
                        const surahData = await APIService.getSurah(surah.number, 'quran-uthmani');
                        
                        // Validate surah data
                        if (!surahData || !surahData.ayahs) {
                            console.warn(`Invalid surah data for surah ${surah.number}`);
                            return;
                        }
                        
                        // For English search, also fetch translation
                        let translationData = null;
                        if (language === 'english') {
                            try {
                                translationData = await APIService.getSurah(surah.number, defaultTranslation);
                            } catch (err) {
                                console.warn(`Could not fetch translation for surah ${surah.number}`);
                            }
                        }

                        // Search in each ayah
                        if (surahData.ayahs && Array.isArray(surahData.ayahs)) {
                            surahData.ayahs.forEach((ayah, index) => {
                                if (!ayah || !ayah.text) return;
                                
                                let matchFound = false;
                                let matchText = ayah.text;
                                let matchType = 'arabic';
                                let translationMatch = false;

                                // Search in Arabic text
                                if (language === 'arabic' || language === 'franco') {
                                    const normalizedAyah = this.normalizeArabic(ayah.text);
                                    if (normalizedAyah && arabicQuery && normalizedAyah.includes(arabicQuery)) {
                                        matchFound = true;
                                        matchType = 'arabic';
                                    }
                                }

                                // Search in English translation
                                if (language === 'english' && translationData && translationData.ayahs && 
                                    translationData.ayahs[index] && translationData.ayahs[index].text) {
                                    const translationText = translationData.ayahs[index].text.toLowerCase();
                                    if (translationText && englishQuery && translationText.includes(englishQuery)) {
                                        matchFound = true;
                                        matchType = 'english';
                                        translationMatch = true;
                                    }
                                }

                                // Also search in Arabic even for English queries (comprehensive search)
                                if (language === 'english' && !matchFound) {
                                    const normalizedAyah = this.normalizeArabic(ayah.text);
                                    const normalizedQuery = this.normalizeArabic(query);
                                    if (normalizedAyah && normalizedQuery && normalizedAyah.includes(normalizedQuery)) {
                                        matchFound = true;
                                        matchType = 'both';
                                    }
                                }

                                if (matchFound) {
                                    const result = {
                                        text: matchText,
                                        numberInSurah: ayah.numberInSurah || index + 1,
                                        matchType: matchType,
                                        surah: {
                                            number: surahData.number || surah.number,
                                            name: surahData.name || surah.name || '',
                                            englishName: surahData.englishName || surah.englishName || '',
                                            englishNameTranslation: surahData.englishNameTranslation || surah.englishNameTranslation || '',
                                            revelationType: surahData.revelationType || surah.revelationType || ''
                                        }
                                    };

                                    // Add translation if available and it was matched
                                    if (translationData && translationData.ayahs && translationData.ayahs[index] && 
                                        translationData.ayahs[index].text && (translationMatch || language === 'english')) {
                                        result.translation = translationData.ayahs[index].text;
                                    }

                                    this.searchResults.push(result);
                                }
                            });
                        }
                    } catch (error) {
                        console.error(`Error searching surah ${surah.number}:`, error);
                    }
                }));

                // Update progress
                const progress = Math.round(((i + batch.length) / surahs.length) * 100);
                console.log(`Search progress: ${progress}%`);
            }

            // Calculate total pages (ensure at least 1 page even with 0 results)
            this.totalPages = Math.max(1, Math.ceil(this.searchResults.length / this.resultsPerPage));

            // Display results
            this.displayResults();

            // Navigate to search page
            App.navigateToPage('search');

            App.hideLoading();
        } catch (error) {
            console.error('Search error:', error);
            App.showToast('حدث خطأ في البحث', 'error');
            App.hideLoading();
        }
    },

    /**
     * Get paginated results
     */
    getPaginatedResults() {
        if (!this.searchResults || this.searchResults.length === 0) {
            return [];
        }
        
        const startIndex = Math.max(0, (this.currentPage - 1) * this.resultsPerPage);
        const endIndex = Math.min(startIndex + this.resultsPerPage, this.searchResults.length);
        return this.searchResults.slice(startIndex, endIndex);
    },

    /**
     * Display search results with pagination
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

        // Get paginated results
        const paginatedResults = this.getPaginatedResults();
        const startResult = (this.currentPage - 1) * this.resultsPerPage + 1;
        const endResult = Math.min(this.currentPage * this.resultsPerPage, this.searchResults.length);

        let html = `
            <div class="mb-4">
                <h3>نتائج البحث عن "${this.currentQuery}"</h3>
                <p style="color: var(--color-text-gray);">
                    عرض ${startResult}-${endResult} من ${this.searchResults.length} نتيجة
                </p>
            </div>
        `;

        // Display paginated results
        paginatedResults.forEach(result => {
            html += this.createResultCard(result);
        });

        // Add pagination controls
        html += this.createPaginationControls();

        container.innerHTML = html;

        // Setup click handlers
        this.setupResultHandlers();
        this.setupPaginationHandlers();
    },

    /**
     * Create pagination controls
     */
    createPaginationControls() {
        if (this.totalPages <= 1) return '';

        let html = '<div class="pagination-container" style="margin-top: 2rem; display: flex; justify-content: center; align-items: center; gap: 1rem; flex-wrap: wrap;">';
        
        // Previous button
        html += `
            <button class="btn btn-secondary pagination-btn" data-page="prev" ${this.currentPage === 1 ? 'disabled' : ''}>
                <i class="fas fa-chevron-right"></i>
                السابق
            </button>
        `;

        // Page numbers
        const maxVisiblePages = 5;
        let startPage = Math.max(1, this.currentPage - Math.floor(maxVisiblePages / 2));
        let endPage = Math.min(this.totalPages, startPage + maxVisiblePages - 1);
        
        if (endPage - startPage < maxVisiblePages - 1) {
            startPage = Math.max(1, endPage - maxVisiblePages + 1);
        }

        if (startPage > 1) {
            html += `<button class="btn btn-secondary pagination-btn" data-page="1">1</button>`;
            if (startPage > 2) {
                html += `<span style="padding: 0 0.5rem;">...</span>`;
            }
        }

        for (let i = startPage; i <= endPage; i++) {
            html += `
                <button class="btn pagination-btn ${i === this.currentPage ? 'btn-primary' : 'btn-secondary'}" data-page="${i}">
                    ${i}
                </button>
            `;
        }

        if (endPage < this.totalPages) {
            if (endPage < this.totalPages - 1) {
                html += `<span style="padding: 0 0.5rem;">...</span>`;
            }
            html += `<button class="btn btn-secondary pagination-btn" data-page="${this.totalPages}">${this.totalPages}</button>`;
        }

        // Next button
        html += `
            <button class="btn btn-secondary pagination-btn" data-page="next" ${this.currentPage === this.totalPages ? 'disabled' : ''}>
                التالي
                <i class="fas fa-chevron-left"></i>
            </button>
        `;

        html += '</div>';
        return html;
    },

    /**
     * Setup pagination handlers (using event delegation to avoid duplicate listeners)
     */
    setupPaginationHandlers() {
        const container = document.getElementById('searchResults');
        if (!container) return;

        // Remove existing handler if it exists
        if (this.paginationHandler) {
            container.removeEventListener('click', this.paginationHandler);
        }

        // Create and store the handler
        this.paginationHandler = (e) => {
            const btn = e.target.closest('.pagination-btn');
            if (!btn) return;

            e.preventDefault();
            e.stopPropagation();

            const page = btn.dataset.page;
            
            if (page === 'prev' && this.currentPage > 1) {
                this.currentPage--;
            } else if (page === 'next' && this.currentPage < this.totalPages) {
                this.currentPage++;
            } else if (!isNaN(page)) {
                this.currentPage = parseInt(page);
            } else {
                return; // Invalid page value
            }

            // Scroll to top of results
            if (container) {
                container.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }

            // Re-display results
            this.displayResults();
        };

        // Add the handler
        container.addEventListener('click', this.paginationHandler);
    },

    /**
     * Create result card
     */
    createResultCard(result) {
        const surah = result.surah;
        const highlightedText = this.highlightSearchTerm(result.text, this.currentQuery);
        const translationHtml = result.translation ? `
            <div class="mt-2" style="color: var(--color-text-gray); font-size: var(--text-base); border-top: 1px solid var(--color-border); padding-top: 0.75rem;">
                <strong>Translation:</strong> ${this.highlightSearchTerm(result.translation, this.currentQuery)}
            </div>
        ` : '';

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
                
                ${translationHtml}
                
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
        if (!term || !text) return text;

        // Escape special regex characters
        const escapedTerm = this.escapeRegex(term);
        
        // For Arabic text, normalize both text and term for highlighting
        const language = this.detectLanguage(term);
        let searchPattern = escapedTerm;
        
        if (language === 'arabic' || language === 'franco') {
            // Normalize for Arabic search
            const normalizedText = this.normalizeArabic(text);
            const normalizedTerm = language === 'franco' ? this.normalizeArabic(this.francoToArabic(term)) : this.normalizeArabic(term);
            
            if (normalizedText.includes(normalizedTerm)) {
                // Find the position in original text (approximate)
                searchPattern = normalizedTerm;
            }
        }

        try {
            const regex = new RegExp(`(${escapedTerm})`, 'gi');
            return text.replace(regex, '<mark style="background: var(--color-accent-light); padding: 2px 4px; border-radius: 3px;">$1</mark>');
        } catch (e) {
            // Fallback if regex fails
            return text.replace(new RegExp(escapedTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), 
                '<mark style="background: var(--color-accent-light); padding: 2px 4px; border-radius: 3px;">$&</mark>');
        }
    },

    /**
     * Setup result card handlers (using event delegation to avoid duplicate listeners)
     */
    setupResultHandlers() {
        const container = document.getElementById('searchResults');
        if (!container) return;

        // Remove existing handler if it exists
        if (this.resultHandler) {
            container.removeEventListener('click', this.resultHandler);
        }

        // Create and store the handler
        this.resultHandler = (e) => {
            // Skip if clicking on pagination buttons
            if (e.target.closest('.pagination-btn')) {
                return;
            }

            // Handle play button
            if (e.target.closest('.play-result-btn')) {
                e.preventDefault();
                e.stopPropagation();
                const card = e.target.closest('.search-result-card');
                if (!card) return;
                const surah = card.dataset.surah;
                const ayah = card.dataset.ayah;
                if (surah && ayah && typeof AudioPlayer !== 'undefined' && AudioPlayer.playAyah) {
                    AudioPlayer.playAyah(surah, ayah);
                }
                return;
            }

            // Handle tafseer button
            if (e.target.closest('.tafseer-result-btn')) {
                e.preventDefault();
                e.stopPropagation();
                const card = e.target.closest('.search-result-card');
                if (!card) return;
                const surah = card.dataset.surah;
                const ayah = card.dataset.ayah;
                if (surah && ayah && typeof Tafseer !== 'undefined' && Tafseer.showTafseer) {
                    Tafseer.showTafseer(surah, ayah);
                }
                return;
            }

            // Handle goto button or card click
            const gotoBtn = e.target.closest('.goto-result-btn');
            const card = e.target.closest('.search-result-card');
            
            if (gotoBtn || (card && !e.target.closest('button'))) {
                e.preventDefault();
                e.stopPropagation();
                
                if (!card) return;
                
                const surah = card.dataset.surah;
                const ayah = card.dataset.ayah;
                
                if (surah && ayah && typeof QuranDisplay !== 'undefined' && QuranDisplay.loadSurah) {
                    QuranDisplay.loadSurah(parseInt(surah));

                    // After a brief delay, scroll to the specific ayah
                    setTimeout(() => {
                        const ayahElement = document.querySelector(`.ayah-container[data-surah="${surah}"][data-number-in-surah="${ayah}"]`);
                        if (ayahElement) {
                            ayahElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            ayahElement.style.background = 'linear-gradient(90deg, rgba(212, 175, 55, 0.2), transparent)';
                            
                            // Remove highlight after 3 seconds
                            setTimeout(() => {
                                ayahElement.style.background = '';
                            }, 3000);
                        }
                    }, 500);
                }
            }
        };

        // Add the handler
        container.addEventListener('click', this.resultHandler);
    }
};

window.Search = Search;
