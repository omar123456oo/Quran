/**
 * Bookmarks Module
 * Handles user bookmarks, favorites, and reading history
 */

const Bookmarks = {
    bookmarks: [],
    lastRead: null,

    /**
     * Initialize bookmarks
     */
    init() {
        this.loadFromStorage();
    },

    /**
     * Load bookmarks from localStorage
     */
    loadFromStorage() {
        const saved = localStorage.getItem('quran_bookmarks');
        if (saved) {
            try {
                this.bookmarks = JSON.parse(saved);
            } catch (e) {
                console.error('Error loading bookmarks:', e);
                this.bookmarks = [];
            }
        }

        const lastRead = localStorage.getItem('quran_last_read');
        if (lastRead) {
            try {
                this.lastRead = JSON.parse(lastRead);
            } catch (e) {
                console.error('Error loading last read:', e);
                this.lastRead = null;
            }
        }
    },

    /**
     * Save bookmarks to localStorage
     */
    saveToStorage() {
        localStorage.setItem('quran_bookmarks', JSON.stringify(this.bookmarks));
    },

    /**
     * Add bookmark
     */
    addBookmark(surahNumber, ayahNumber, ayahText) {
        const bookmark = {
            id: `${surahNumber}:${ayahNumber}`,
            surahNumber: parseInt(surahNumber),
            ayahNumber: parseInt(ayahNumber),
            ayahText: ayahText,
            timestamp: new Date().toISOString()
        };

        // Check if already bookmarked
        const exists = this.bookmarks.find(b => b.id === bookmark.id);
        if (exists) {
            App.showToast('هذه الآية محفوظة بالفعل', 'info');
            return;
        }

        this.bookmarks.unshift(bookmark);
        this.saveToStorage();

        App.showToast('تمت إضافة الآية إلى المحفوظات', 'success');
    },

    /**
     * Remove bookmark
     */
    removeBookmark(bookmarkId) {
        this.bookmarks = this.bookmarks.filter(b => b.id !== bookmarkId);
        this.saveToStorage();

        App.showToast('تم حذف الآية من المحفوظات', 'success');
        this.loadBookmarks(); // Refresh display
    },

    /**
     * Save last read position
     */
    saveLastRead(surahNumber, ayahNumber) {
        this.lastRead = {
            surahNumber: parseInt(surahNumber),
            ayahNumber: parseInt(ayahNumber),
            timestamp: new Date().toISOString()
        };

        localStorage.setItem('quran_last_read', JSON.stringify(this.lastRead));
    },

    /**
     * Load and display bookmarks page
     */
    loadBookmarks() {
        const container = document.getElementById('bookmarksList');
        if (!container) return;

        let html = '';

        // Last Read Section
        if (this.lastRead) {
            const surahInfo = QuranDisplay.surahs.find(s => s.number === this.lastRead.surahNumber);
            html += `
                <div class="card mb-4" style="background: linear-gradient(135deg, var(--color-primary), var(--color-primary-light)); color: white;">
                    <h3 style="color: white;"><i class="fas fa-book-reader"></i> آخر قراءة</h3>
                    <div class="flex items-center justify-between mt-3">
                        <div>
                            <div class="arabic-text" style="font-size: var(--text-xl); color: white;">
                                ${surahInfo ? surahInfo.name : `سورة ${this.lastRead.surahNumber}`}
                            </div>
                            <div style="color: rgba(255,255,255,0.9);">
                                آية ${this.lastRead.ayahNumber}
                            </div>
                        </div>
                        <button class="btn btn-secondary" onclick="QuranDisplay.loadSurah(${this.lastRead.surahNumber})" style="background: white; color: var(--color-primary);">
                            متابعة القراءة
                            <i class="fas fa-arrow-left"></i>
                        </button>
                    </div>
                </div>
            `;
        }

        // Bookmarks Section
        html += '<h3 class="mt-4 mb-4"><i class="fas fa-bookmark"></i> الآيات المحفوظة</h3>';

        if (this.bookmarks.length === 0) {
            html += `
                <div class="card text-center">
                    <i class="fas fa-bookmark" style="font-size: 3rem; color: var(--color-text-light); margin-bottom: 1rem;"></i>
                    <p style="color: var(--color-text-gray);">لا توجد آيات محفوظة بعد</p>
                </div>
            `;
        } else {
            this.bookmarks.forEach(bookmark => {
                const surahInfo = QuranDisplay.surahs.find(s => s.number === bookmark.surahNumber);
                const date = new Date(bookmark.timestamp).toLocaleDateString('ar-EG');

                html += `
                    <div class="card mb-4">
                        <div class="flex items-center justify-between mb-3">
                            <div>
                                <span class="text-sm" style="color: var(--color-primary); font-weight: 600;">
                                    ${surahInfo ? surahInfo.name : `سورة ${bookmark.surahNumber}`} - آية ${bookmark.ayahNumber}
                                </span>
                            </div>
                            <span class="text-sm" style="color: var(--color-text-light);">
                                ${date}
                            </span>
                        </div>
                        
                        <div class="arabic-text mb-4" style="font-size: var(--text-lg);">
                            ${bookmark.ayahText}
                        </div>
                        
                        <div class="flex gap-4">
                            <button class="btn btn-secondary btn-sm" onclick="QuranDisplay.loadSurah(${bookmark.surahNumber})">
                                <i class="fas fa-arrow-left"></i>
                                الذهاب للآية
                            </button>
                            <button class="btn btn-secondary btn-sm" onclick="AudioPlayer.playAyah(${bookmark.surahNumber}, ${bookmark.ayahNumber})">
                                <i class="fas fa-play"></i>
                                استماع
                            </button>
                            <button class="btn btn-secondary btn-sm" onclick="Bookmarks.removeBookmark('${bookmark.id}')" style="margin-right: auto; color: var(--color-error);">
                                <i class="fas fa-trash"></i>
                                حذف
                            </button>
                        </div>
                    </div>
                `;
            });
        }

        // Export/Import Section
        html += `
            <div class="card mt-4">
                <h4 class="mb-4"><i class="fas fa-file-export"></i> إدارة المحفوظات</h4>
                <div class="flex gap-4">
                    <button class="btn btn-primary" onclick="Bookmarks.exportBookmarks()">
                        <i class="fas fa-download"></i>
                        تصدير المحفوظات
                    </button>
                    <button class="btn btn-secondary" onclick="document.getElementById('importBookmarksInput').click()">
                        <i class="fas fa-upload"></i>
                        استيراد المحفوظات
                    </button>
                </div>
                <input type="file" id="importBookmarksInput" accept=".json" style="display: none;" onchange="Bookmarks.importBookmarks(event)">
            </div>
        `;

        container.innerHTML = html;
    },

    /**
     * Export bookmarks as JSON file
     */
    exportBookmarks() {
        const data = {
            bookmarks: this.bookmarks,
            lastRead: this.lastRead,
            exportDate: new Date().toISOString()
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `quran-bookmarks-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);

        App.showToast('تم تصدير المحفوظات بنجاح', 'success');
    },

    /**
     * Import bookmarks from JSON file
     */
    importBookmarks(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);

                if (data.bookmarks && Array.isArray(data.bookmarks)) {
                    this.bookmarks = data.bookmarks;
                    this.saveToStorage();
                }

                if (data.lastRead) {
                    this.lastRead = data.lastRead;
                    localStorage.setItem('quran_last_read', JSON.stringify(this.lastRead));
                }

                this.loadBookmarks();
                App.showToast('تم استيراد المحفوظات بنجاح', 'success');
            } catch (error) {
                console.error('Error importing bookmarks:', error);
                App.showToast('حدث خطأ في استيراد المحفوظات', 'error');
            }
        };

        reader.readAsText(file);
    }
};

window.Bookmarks = Bookmarks;
