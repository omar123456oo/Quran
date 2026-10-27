/**
 * API Service Layer
 * Handles all communication with Al Quran Cloud API
 */

const APIService = {
    baseURL: 'https://api.alquran.cloud/v1',
    cache: new Map(),
    
    /**
     * Generic fetch wrapper with error handling and caching
     */
    async fetch(endpoint, useCache = true) {
        const cacheKey = endpoint;
        
        // Check cache first
        if (useCache && this.cache.has(cacheKey)) {
            console.log(`Cache hit for: ${endpoint}`);
            return this.cache.get(cacheKey);
        }
        
        try {
            const response = await fetch(`${this.baseURL}${endpoint}`);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.code !== 200) {
                throw new Error(data.status || 'API request failed');
            }
            
            // Cache the result
            if (useCache) {
                this.cache.set(cacheKey, data.data);
            }
            
            return data.data;
        } catch (error) {
            console.error(`API Error for ${endpoint}:`, error);
            if (window.App && typeof window.App.showToast === 'function') {
                window.App.showToast('تعذر الاتصال بالخادم. حاول مرة أخرى', 'error');
            }
            throw error;
        }
    },
    
    /**
     * Get all Surahs metadata
     */
    async getSurahs() {
        return await this.fetch('/surah');
    },
    
    /**
     * Get a specific Surah with edition (reciter or translation)
     * @param {number} surahNumber - Surah number (1-114)
     * @param {string} edition - Edition identifier (e.g., 'ar.alafasy', 'en.sahih')
     */
    async getSurah(surahNumber, edition = 'ar.alafasy') {
        return await this.fetch(`/surah/${surahNumber}/${edition}`);
    },
    
    /**
     * Get a specific Ayah
     * @param {string} reference - Ayah reference (e.g., '1:1' for first ayah of first surah)
     * @param {string} edition - Edition identifier
     */
    async getAyah(reference, edition = 'ar.alafasy') {
        return await this.fetch(`/ayah/${reference}/${edition}`);
    },
    
    /**
     * Get Tafseer for a specific Ayah
     * @param {string} reference - Ayah reference
     * @param {string} tafseer - Tafseer source (e.g., 'ar.muyassar', 'ar.jalalayn')
     */
    async getTafseer(reference, tafseer = 'ar.muyassar') {
        return await this.fetch(`/ayah/${reference}/${tafseer}`);
    },
    
    /**
     * Search in the Quran
     * @param {string} query - Search term
     * @param {string} surah - Surah number or 'all'
     * @param {string} edition - Edition to search in
     */
    async search(query, surah = 'all', edition = 'ar.alafasy') {
        return await this.fetch(`/search/${encodeURIComponent(query)}/${surah}/${edition}`, false);
    },
    
    /**
     * Get all available editions (reciters, translations, tafseer)
     */
    async getEditions() {
        return await this.fetch('/edition');
    },
    
    /**
     * Get Juz (part) data
     * @param {number} juzNumber - Juz number (1-30)
     * @param {string} edition - Edition identifier
     */
    async getJuz(juzNumber, edition = 'ar.alafasy') {
        return await this.fetch(`/juz/${juzNumber}/${edition}`);
    },
    
    /**
     * Get page data
     * @param {number} pageNumber - Page number (1-604)
     * @param {string} edition - Edition identifier
     */
    async getPage(pageNumber, edition = 'ar.alafasy') {
        return await this.fetch(`/page/${pageNumber}/${edition}`);
    },
    
    /**
     * Clear cache
     */
    clearCache() {
        this.cache.clear();
        console.log('Cache cleared');
    }
};

// Export for use in other modules
window.APIService = APIService;
