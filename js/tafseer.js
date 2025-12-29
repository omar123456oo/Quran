/**
 * Tafseer Module
 * Handles displaying Tafseer (commentary/exegesis) for Quranic verses
 */

const Tafseer = {
    availableTafseers: [
        { id: 'ar.muyassar', name: 'Tafsir Al-Muyassar', nameAr: 'التفسير الميسّر', language: 'ar' },
        { id: 'ar.jalalayn', name: 'Tafsir Al-Jalalayn', nameAr: 'تفسير الجلالين', language: 'ar' },
        { id: 'ar.qurtubi', name: 'Tafsir Al-Qurtubi', nameAr: 'تفسير القرطبي', language: 'ar' },
        { id: 'ar.baghawi', name: 'Tafsir Al-Baghawi', nameAr: 'تفسير البغوي', language: 'ar' },
        { id: 'ar.miqbas', name: 'Tafsir Ibn Abbas', nameAr: 'تنوير المقباس', language: 'ar' },
        { id: 'ar.waseet', name: 'Tafsir Al-Waseet', nameAr: 'التفسير الوسيط', language: 'ar' }
    ],
    currentTafseer: null,

    /**
     * Show Tafseer for a specific Ayah
     */
    async showTafseer(surahNumber, ayahNumber) {
        try {
            const modal = document.getElementById('tafseerModal');
            const content = document.getElementById('tafseerContent');

            if (!modal || !content) return;

            // Show loading in modal
            content.innerHTML = '<div class="text-center"><div class="spinner" style="margin: 0 auto;"></div></div>';
            modal.classList.add('active');

            // Get Tafseer
            const reference = `${surahNumber}:${ayahNumber}`;
            const tafseerSource = App.settings.defaultTafseer || 'ar.muyassar';

            console.log(`Loading Tafseer for ${reference} with source: ${tafseerSource}`);

            const tafseerData = await APIService.getTafseer(reference, tafseerSource);

            // API يعيد التفسير في data.text مباشرة
            if (tafseerData && tafseerData.text) {
                this.displayTafseer(tafseerData, surahNumber, ayahNumber);
            } else {
                console.warn('No Tafseer data found for:', reference);
                content.innerHTML = `
                    <div style="text-align: center; padding: 20px;">
                        <i class="fas fa-book" style="font-size: 48px; color: var(--color-text-gray); margin-bottom: 16px;"></i>
                        <p style="color: var(--color-text-gray); font-size: var(--text-lg);">التفسير غير متوفر لهذه الآية</p>
                        <p style="color: var(--color-text-light); font-size: var(--text-sm); margin-top: 8px;">يرجى تجربة مصدر تفسير آخر</p>
                    </div>
                `;
            }
        } catch (error) {
            console.error('Error loading Tafseer:', error);
            const content = document.getElementById('tafseerContent');
            if (content) {
                content.innerHTML = `
                    <div style="text-align: center; padding: 20px;">
                        <i class="fas fa-exclamation-circle" style="font-size: 48px; color: var(--color-error); margin-bottom: 16px;"></i>
                        <p style="color: var(--color-error); font-size: var(--text-lg);">حدث خطأ في تحميل التفسير</p>
                        <p style="color: var(--color-text-gray); font-size: var(--text-sm); margin-top: 8px;">${error.message || 'يرجى المحاولة مرة أخرى'}</p>
                        <button class="btn btn-primary" onclick="Tafseer.showTafseer(${surahNumber}, ${ayahNumber})" style="margin-top: 16px;">
                            <i class="fas fa-redo"></i> إعادة المحاولة
                        </button>
                    </div>
                `;
            }
        }
    },

    /**
     * Display Tafseer content
     */
    displayTafseer(tafseerData, surahNumber, ayahNumber) {
        const content = document.getElementById('tafseerContent');
        if (!content) return;

        const surahInfo = QuranDisplay.surahs.find(s => s.number === parseInt(surahNumber));
        const currentTafseer = this.availableTafseers.find(t => t.id === App.settings.defaultTafseer);

        // API يعيد معلومات السورة في tafseerData.surah
        const surahName = tafseerData.surah ? tafseerData.surah.name : (surahInfo ? surahInfo.name : `سورة ${surahNumber}`);

        let html = `
            <div class="mb-4">
                <div class="flex items-center gap-4 mb-4">
                    <div class="text-sm" style="color: var(--color-text-gray);">
                        ${surahName} - آية ${ayahNumber}
                    </div>
                    ${currentTafseer ? `
                        <div class="text-sm" style="color: var(--color-accent); font-weight: 600;">
                            <i class="fas fa-book-open"></i> ${currentTafseer.nameAr}
                        </div>
                    ` : ''}
                </div>
                
                <div class="card mb-4" style="background: var(--color-bg-light); padding: 25px; border-radius: var(--radius-lg); border-right: 4px solid var(--color-accent);">
                    <div class="arabic-text" style="font-size: var(--text-2xl); line-height: 2.2; text-align: justify;">
                        ${tafseerData.text}
                    </div>
                </div>
            </div>
            
            <div class="mt-4" style="border-top: 2px solid var(--color-border); padding-top: 20px;">
                <h4 class="mb-4" style="color: var(--color-text-dark);">
                    <i class="fas fa-exchange-alt"></i> اختر مصدر التفسير
                </h4>
                <div class="flex gap-4" style="flex-wrap: wrap;">
                    ${this.availableTafseers.map(t => `
                        <button class="btn ${t.id === App.settings.defaultTafseer ? 'btn-primary' : 'btn-secondary'}" 
                                onclick="Tafseer.changeTafseerSource('${t.id}', ${surahNumber}, ${ayahNumber})"
                                style="min-width: 150px;">
                            ${t.id === App.settings.defaultTafseer ? '<i class="fas fa-check-circle"></i>' : '<i class="fas fa-book"></i>'}
                            ${t.nameAr}
                        </button>
                    `).join('')}
                </div>
            </div>
        `;

        content.innerHTML = html;
    },

    /**
     * Change Tafseer source and reload
     */
    async changeTafseerSource(tafseerSource, surahNumber, ayahNumber) {
        App.settings.defaultTafseer = tafseerSource;
        App.saveSettings();
        await this.showTafseer(surahNumber, ayahNumber);
    }
};

// Setup modal close handlers
document.addEventListener('DOMContentLoaded', () => {
    const closeTafseerBtn = document.getElementById('closeTafseerModal');
    const tafseerBackdrop = document.getElementById('tafseerBackdrop');

    if (closeTafseerBtn) {
        closeTafseerBtn.addEventListener('click', () => {
            const modal = document.getElementById('tafseerModal');
            if (modal) modal.classList.remove('active');
        });
    }

    if (tafseerBackdrop) {
        tafseerBackdrop.addEventListener('click', () => {
            const modal = document.getElementById('tafseerModal');
            if (modal) modal.classList.remove('active');
        });
    }
});

window.Tafseer = Tafseer;
