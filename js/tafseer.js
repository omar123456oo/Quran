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
            const tafseerSource = App.settings.defaultTafseer;

            const tafseerData = await APIService.getTafseer(reference, tafseerSource);

            if (tafseerData) {
                this.displayTafseer(tafseerData, surahNumber, ayahNumber);
            } else {
                content.innerHTML = '<p style="color: var(--color-text-gray);">التفسير غير متوفر لهذه الآية</p>';
            }
        } catch (error) {
            console.error('Error loading Tafseer:', error);
            const content = document.getElementById('tafseerContent');
            if (content) {
                content.innerHTML = '<p style="color: var(--color-error);">حدث خطأ في تحميل التفسير</p>';
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

        let html = `
            <div class="mb-4">
                <div class="flex items-center gap-4 mb-4">
                    <div class="text-sm" style="color: var(--color-text-gray);">
                        ${surahInfo ? surahInfo.name : `سورة ${surahNumber}`} - آية ${ayahNumber}
                    </div>
                </div>
                
                <div class="card mb-4">
                    <div class="arabic-text" style="font-size: var(--text-xl);">
                        ${tafseerData.text}
                    </div>
                </div>
                
                <div style="line-height: 1.8; color: var(--color-text-dark);">
                    ${tafseerData.tafsir ? tafseerData.tafsir.text : 'التفسير غير متوفر'}
                </div>
            </div>
            
            <div class="mt-4">
                <h4 class="mb-4">اختر مصدر التفسير</h4>
                <div class="flex gap-4" style="flex-wrap: wrap;">
                    ${this.availableTafseers.map(t => `
                        <button class="btn btn-secondary" onclick="Tafseer.changeTafseerSource('${t.id}', ${surahNumber}, ${ayahNumber})">
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
