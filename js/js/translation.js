/**
 * Translation Module
 * Handles Quranic translations in multiple languages
 */

const Translation = {
    availableTranslations: [
        { id: 'en.sahih', name: 'Sahih International', language: 'English' },
        { id: 'en.yusufali', name: 'Yusuf Ali', language: 'English' },
        { id: 'en.pickthall', name: 'Pickthall', language: 'English' },
        { id: 'id.indonesian', name: 'Indonesian', language: 'Indonesian' },
        { id: 'ur.jalandhry', name: 'Jalandhry', language: 'Urdu' },
        { id: 'fr.hamidullah', name: 'Hamidullah', language: 'French' },
        { id: 'de.bubenheim', name: 'Bubenheim & Elyas', language: 'German' },
        { id: 'tr.diyanet', name: 'Diyanet', language: 'Turkish' },
        { id: 'es.cortes', name: 'Julio Cortes', language: 'Spanish' },
        { id: 'ru.kuliev', name: 'Kuliev', language: 'Russian' }
    ],

    /**
     * Get translation for specific Ayah
     */
    async getTranslation(surahNumber, ayahNumber, translationId) {
        try {
            const reference = `${surahNumber}:${ayahNumber}`;
            return await APIService.getAyah(reference, translationId);
        } catch (error) {
            console.error('Error getting translation:', error);
            return null;
        }
    },

    /**
     * Get translation for entire Surah
     */
    async getSurahTranslation(surahNumber, translationId) {
        try {
            return await APIService.getSurah(surahNumber, translationId);
        } catch (error) {
            console.error('Error getting Surah translation:', error);
            return null;
        }
    },

    /**
     * Change default translation language
     */
    changeDefaultTranslation(translationId) {
        App.settings.defaultTranslation = translationId;
        App.saveSettings();

        const translation = this.availableTranslations.find(t => t.id === translationId);
        App.showToast(`تم اختيار ترجمة ${translation ? translation.name : translationId}`, 'success');
    }
};

window.Translation = Translation;
