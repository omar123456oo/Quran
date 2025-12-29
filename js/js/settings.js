/**
 * Settings Module
 * Handles user preferences and customization
 */

const Settings = {
    /**
     * Initialize settings module
     */
    init() {
        console.log('Settings module initialized');
    },

    /**
     * Load settings page
     */
    loadSettings() {
        const container = document.getElementById('settingsContent');
        if (!container) return;

        const settings = App.settings;

        let html = `
            <!-- Display Settings -->
            <div class="card mb-4">
                <h3 class="mb-4"><i class="fas fa-eye"></i> إعدادات العرض</h3>
                
                <div class="mb-4">
                    <label class="text-sm" style="color: var(--color-text-gray); display: block; margin-bottom: 0.5rem;">
                        حجم الخط
                    </label>
                    <div class="flex gap-4">
                        <button class="btn ${settings.fontSize === 'small' ? 'btn-primary' : 'btn-secondary'}" onclick="Settings.setFontSize('small')">صغير</button>
                        <button class="btn ${settings.fontSize === 'medium' ? 'btn-primary' : 'btn-secondary'}" onclick="Settings.setFontSize('medium')">متوسط</button>
                        <button class="btn ${settings.fontSize === 'large' ? 'btn-primary' : 'btn-secondary'}" onclick="Settings.setFontSize('large')">كبير</button>
                        <button class="btn ${settings.fontSize === 'xlarge' ? 'btn-primary' : 'btn-secondary'}" onclick="Settings.setFontSize('xlarge')">كبير جداً</button>
                    </div>
                </div>
                
                <div class="mb-4">
                    <label class="text-sm" style="color: var(--color-text-gray); display: block; margin-bottom: 0.5rem;">
                        المظهر
                    </label>
                    <div class="flex gap-4">
                        <button class="btn ${settings.theme === 'light' ? 'btn-primary' : 'btn-secondary'}" onclick="Settings.setTheme('light')">
                            <i class="fas fa-sun"></i>
                            فاتح
                        </button>
                        <button class="btn ${settings.theme === 'dark' ? 'btn-primary' : 'btn-secondary'}" onclick="Settings.setTheme('dark')">
                            <i class="fas fa-moon"></i>
                            داكن
                        </button>
                    </div>
                </div>
                
                <div class="mb-4">
                    <label class="text-sm" style="color: var(--color-text-gray); display: block; margin-bottom: 0.5rem;">
                        عرض الترجمة
                    </label>
                    <label class="flex items-center gap-4" style="cursor: pointer;">
                        <input type="checkbox" id="showTranslationToggle" ${settings.showTranslation ? 'checked' : ''} onchange="Settings.toggleTranslation()" style="width: 20px; height: 20px;">
                        <span>عرض الترجمة مع النص العربي</span>
                    </label>
                </div>
            </div>
            
            <!-- Audio Settings -->
            <div class="card mb-4">
                <h3 class="mb-4"><i class="fas fa-volume-up"></i> إعدادات الصوت</h3>
                
                <div class="mb-4">
                    <label class="text-sm" style="color: var(--color-text-gray); display: block; margin-bottom: 0.5rem;">
                        القارئ الافتراضي
                    </label>
                    <select id="defaultReciterSelect" class="search-input" onchange="Settings.setDefaultReciter(this.value)">
                        ${AudioPlayer.reciters.map(r => `
                            <option value="${r.id}" ${settings.defaultReciter === r.id ? 'selected' : ''}>
                                ${r.name}
                            </option>
                        `).join('')}
                    </select>
                </div>
                
                <div class="mb-4">
                    <label class="flex items-center gap-4" style="cursor: pointer;">
                        <input type="checkbox" id="autoPlayToggle" ${settings.autoPlay ? 'checked' : ''} onchange="Settings.toggleAutoPlay()" style="width: 20px; height: 20px;">
                        <span>تشغيل الآية التالية تلقائياً</span>
                    </label>
                </div>
            </div>
            
            <!-- Translation Settings -->
            <div class="card mb-4">
                <h3 class="mb-4"><i class="fas fa-language"></i> إعدادات الترجمة</h3>
                
                <div class="mb-4">
                    <label class="text-sm" style="color: var(--color-text-gray); display: block; margin-bottom: 0.5rem;">
                        الترجمة الافتراضية
                    </label>
                    <select id="defaultTranslationSelect" class="search-input" onchange="Settings.setDefaultTranslation(this.value)">
                        ${Translation.availableTranslations.map(t => `
                            <option value="${t.id}" ${settings.defaultTranslation === t.id ? 'selected' : ''}>
                                ${t.name} (${t.language})
                            </option>
                        `).join('')}
                    </select>
                </div>
            </div>
            
            <!-- Tafseer Settings -->
            <div class="card mb-4">
                <h3 class="mb-4"><i class="fas fa-book-open"></i> إعدادات التفسير</h3>
                
                <div class="mb-4">
                    <label class="text-sm" style="color: var(--color-text-gray); display: block; margin-bottom: 0.5rem;">
                        التفسير الافتراضي
                    </label>
                    <select id="defaultTafseerSelect" class="search-input" onchange="Settings.setDefaultTafseer(this.value)">
                        ${Tafseer.availableTafseers.map(t => `
                            <option value="${t.id}" ${settings.defaultTafseer === t.id ? 'selected' : ''}>
                                ${t.nameAr}
                            </option>
                        `).join('')}
                    </select>
                </div>
            </div>
            
            <!-- Data Management -->
            <div class="card mb-4">
                <h3 class="mb-4"><i class="fas fa-database"></i> إدارة البيانات</h3>
                
                <div class="flex gap-4">
                    <button class="btn btn-secondary" onclick="Settings.clearCache()">
                        <i class="fas fa-trash"></i>
                        مسح الذاكرة المؤقتة
                    </button>
                    <button class="btn btn-secondary" onclick="Settings.resetSettings()" style="color: var(--color-error);">
                        <i class="fas fa-undo"></i>
                        إعادة تعيين الإعدادات
                    </button>
                </div>
            </div>
            
            <!-- About -->
            <div class="card">
                <h3 class="mb-4"><i class="fas fa-info-circle"></i> عن التطبيق</h3>
                <p style="color: var(--color-text-gray); line-height: 1.8;">
                    <strong>القرآن الكريم</strong> - تطبيق شامل لقراءة واستماع وتعلم القرآن الكريم
                </p>
                <p style="color: var(--color-text-gray); margin-top: 1rem;">
                    <i class="fas fa-code"></i> الإصدار 1.0.0
                </p>
                <p style="color: var(--color-text-gray); margin-top: 0.5rem;">
                    <i class="fas fa-database"></i> البيانات من Al Quran Cloud API
                </p>
            </div>
        `;

        container.innerHTML = html;
    },

    /**
     * Set font size
     */
    setFontSize(size) {
        App.settings.fontSize = size;

        // Apply font size
        const fontSizes = {
            small: '1.5rem',
            medium: '2rem',
            large: '2.5rem',
            xlarge: '3rem'
        };

        document.documentElement.style.setProperty('--text-2xl', fontSizes[size]);

        App.saveSettings();
        this.loadSettings(); // Refresh
    },

    /**
     * Set theme
     */
    setTheme(theme) {
        App.settings.theme = theme;
        App.applyTheme();
        App.saveSettings();
        this.loadSettings(); // Refresh
    },

    /**
     * Toggle translation display
     */
    toggleTranslation() {
        const checkbox = document.getElementById('showTranslationToggle');
        App.settings.showTranslation = checkbox.checked;
        App.saveSettings();
    },

    /**
     * Toggle auto play
     */
    toggleAutoPlay() {
        const checkbox = document.getElementById('autoPlayToggle');
        App.settings.autoPlay = checkbox.checked;
        App.saveSettings();
    },

    /**
     * Set default reciter
     */
    setDefaultReciter(reciterId) {
        App.settings.defaultReciter = reciterId;
        AudioPlayer.currentReciter = reciterId;
        App.saveSettings();
    },

    /**
     * Set default translation
     */
    setDefaultTranslation(translationId) {
        App.settings.defaultTranslation = translationId;
        App.saveSettings();
    },

    /**
     * Set default tafseer
     */
    setDefaultTafseer(tafseerId) {
        App.settings.defaultTafseer = tafseerId;
        App.saveSettings();
    },

    /**
     * Clear cache
     */
    clearCache() {
        if (confirm('هل أنت متأكد من حذف الذاكرة المؤقتة؟')) {
            APIService.clearCache();
            App.showToast('تم مسح الذاكرة المؤقتة', 'success');
        }
    },

    /**
     * Reset all settings to default
     */
    resetSettings() {
        if (confirm('هل أنت متأكد من إعادة تعيين جميع الإعدادات؟')) {
            localStorage.removeItem('quran_settings');
            App.loadSettings();
            App.applyTheme();
            this.loadSettings();
            App.showToast('تم إعادة تعيين الإعدادات', 'success');
        }
    }
};

window.Settings = Settings;
