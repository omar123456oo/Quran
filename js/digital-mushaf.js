/**
 * Digital Mushaf (Electronic Quran Reader) Module
 * المصحف القارئ الإلكتروني
 */

const DigitalMushaf = {
    currentPage: 1,
    totalPages: 604,
    viewMode: 'page', // 'page', 'surah', 'juz'
    
    // مصادر صور المصحف
    mushafImageBase: 'https://www.quranwbw.com/images/Madani/large/',
    
    /**
     * تهيئة المصحف الإلكتروني
     */
    init() {
        console.log('Initializing Digital Mushaf...');
        this.currentPage = parseInt(localStorage.getItem('mushaf_last_page')) || 1;
        this.loadPage(this.currentPage);
        this.setupKeyboardControls();
    },

    /**
     * تحميل صفحة معينة
     */
    loadPage(pageNumber) {
        if (pageNumber < 1 || pageNumber > this.totalPages) return;
        
        this.currentPage = pageNumber;
        localStorage.setItem('mushaf_last_page', pageNumber);
        
        this.displayPage(pageNumber);
    },

    /**
     * عرض الصفحة
     */
    async displayPage(pageNumber) {
        const container = document.getElementById('mushafContent');
        if (!container) return;

        App.showLoading();

        try {
            // الحصول على معلومات الصفحة من API
            const pageData = await APIService.getPage(pageNumber, 'ar.alafasy');
            
            // تجهيز صور الصفحة من مصادر مختلفة
            const pageImageUrl = this.getPageImageUrl(pageNumber);
            
            // الحصول على معلومات الجزء والسورة
            const firstAyah = pageData.ayahs[0];
            const juzNumber = firstAyah.juz;
            const surahInfo = firstAyah.surah;

            let html = `
                <div class="mushaf-viewer">
                    <!-- شريط التحكم العلوي -->
                    <div class="mushaf-controls" style="background: var(--color-bg-white); padding: 20px; border-radius: var(--radius-lg); margin-bottom: 20px; box-shadow: var(--shadow-md);">
                        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 15px;">
                            <!-- معلومات الصفحة -->
                            <div style="flex: 1; min-width: 200px;">
                                <h3 class="arabic-text" style="margin: 0; color: var(--color-accent);">
                                    ${surahInfo.name}
                                </h3>
                                <div style="color: var(--color-text-gray); font-size: 14px; margin-top: 5px;">
                                    صفحة ${this.getArabicNumber(pageNumber)} - الجزء ${this.getArabicNumber(juzNumber)}
                                </div>
                            </div>

                            <!-- أزرار التنقل -->
                            <div style="display: flex; gap: 10px; align-items: center;">
                                <button class="btn btn-secondary" onclick="DigitalMushaf.firstPage()" title="الصفحة الأولى">
                                    <i class="fas fa-angle-double-right"></i>
                                </button>
                                <button class="btn btn-primary" onclick="DigitalMushaf.previousPage()" title="الصفحة السابقة">
                                    <i class="fas fa-angle-right"></i>
                                </button>
                                
                                <input type="number" 
                                       min="1" 
                                       max="${this.totalPages}" 
                                       value="${pageNumber}" 
                                       id="mushafPageInput"
                                       onchange="DigitalMushaf.goToPage(this.value)"
                                       style="width: 80px; text-align: center; padding: 8px; border: 2px solid var(--color-border); border-radius: var(--radius-md);">
                                
                                <span style="color: var(--color-text-gray);">/ ${this.totalPages}</span>
                                
                                <button class="btn btn-primary" onclick="DigitalMushaf.nextPage()" title="الصفحة التالية">
                                    <i class="fas fa-angle-left"></i>
                                </button>
                                <button class="btn btn-secondary" onclick="DigitalMushaf.lastPage()" title="الصفحة الأخيرة">
                                    <i class="fas fa-angle-double-left"></i>
                                </button>
                            </div>

                            <!-- خيارات إضافية -->
                            <div style="display: flex; gap: 10px;">
                                <button class="btn btn-secondary" onclick="DigitalMushaf.toggleBookmark(${pageNumber})" title="إضافة علامة">
                                    <i class="far fa-bookmark"></i>
                                </button>
                                <button class="btn btn-secondary" onclick="DigitalMushaf.toggleFullscreen()" title="ملء الشاشة">
                                    <i class="fas fa-expand"></i>
                                </button>
                                <button class="btn btn-secondary" onclick="DigitalMushaf.showNavigationMenu()" title="القائمة">
                                    <i class="fas fa-bars"></i>
                                </button>
                            </div>
                        </div>
                    </div>

                    <!-- عرض صفحة المصحف -->
                    <div class="mushaf-page-container" style="text-align: center; background: var(--color-bg-light); padding: 30px; border-radius: var(--radius-lg); min-height: 800px;">
                        <img src="${pageImageUrl}" 
                             alt="صفحة ${pageNumber}" 
                             class="mushaf-page-image"
                             style="max-width: 100%; height: auto; border-radius: var(--radius-md); box-shadow: var(--shadow-lg); cursor: pointer;"
                             onclick="DigitalMushaf.toggleFullscreen()"
                             onerror="DigitalMushaf.handleImageError(this, ${pageNumber})">
                        
                        <!-- نص بديل في حالة عدم توفر الصورة -->
                        <div id="mushaf-text-fallback" style="display: none; text-align: right; direction: rtl;">
                            <div class="card" style="max-width: 800px; margin: 0 auto;">
                                ${pageData.ayahs.map(ayah => `
                                    <div class="arabic-text" style="font-size: var(--text-2xl); line-height: 2.5; margin-bottom: 20px;">
                                        ${ayah.text} 
                                        <span style="color: var(--color-accent); font-weight: 700;">﴿${ayah.numberInSurah}﴾</span>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    </div>

                    <!-- معلومات إضافية -->
                    <div class="mushaf-info" style="margin-top: 20px; padding: 20px; background: var(--color-bg-white); border-radius: var(--radius-lg);">
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px;">
                            <div style="text-align: center; padding: 15px; background: var(--color-bg-light); border-radius: var(--radius-md);">
                                <i class="fas fa-book-open" style="font-size: 24px; color: var(--color-accent); margin-bottom: 10px;"></i>
                                <div style="font-weight: 600;">عدد الآيات</div>
                                <div style="color: var(--color-text-gray);">${pageData.ayahs.length} آية</div>
                            </div>
                            <div style="text-align: center; padding: 15px; background: var(--color-bg-light); border-radius: var(--radius-md);">
                                <i class="fas fa-bookmark" style="font-size: 24px; color: var(--color-accent); margin-bottom: 10px;"></i>
                                <div style="font-weight: 600;">الجزء</div>
                                <div style="color: var(--color-text-gray);">${this.getArabicNumber(juzNumber)}</div>
                            </div>
                            <div style="text-align: center; padding: 15px; background: var(--color-bg-light); border-radius: var(--radius-md);">
                                <i class="fas fa-map-marker-alt" style="font-size: 24px; color: var(--color-accent); margin-bottom: 10px;"></i>
                                <div style="font-weight: 600;">السورة</div>
                                <div style="color: var(--color-text-gray);">${surahInfo.name}</div>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            container.innerHTML = html;
            App.hideLoading();
            
            // التمرير لأعلى الصفحة
            window.scrollTo({ top: 0, behavior: 'smooth' });

        } catch (error) {
            console.error('Error loading Mushaf page:', error);
            App.showToast('حدث خطأ في تحميل الصفحة', 'error');
            App.hideLoading();
        }
    },

    /**
     * الحصول على رابط صورة الصفحة
     */
    getPageImageUrl(pageNumber) {
        // تنسيق رقم الصفحة بثلاثة أرقام
        const formattedPage = pageNumber.toString().padStart(3, '0');
        
        // مصادر بديلة لصور المصحف
        const sources = [
            `https://www.searchtruth.com/quran/images2/${pageNumber}.jpg`,
            `https://surahquran.com/img/madina-mushaf/${formattedPage}.png`,
            `${this.mushafImageBase}${formattedPage}.png`
        ];
        
        return sources[0]; // استخدام المصدر الأول كافتراضي
    },

    /**
     * معالجة خطأ تحميل الصورة
     */
    handleImageError(img, pageNumber) {
        console.warn('Failed to load mushaf page image, trying alternative source...');
        
        // محاولة مصدر بديل
        const formattedPage = pageNumber.toString().padStart(3, '0');
        const altSources = [
            `https://surahquran.com/img/madina-mushaf/${formattedPage}.png`,
            `${this.mushafImageBase}${formattedPage}.png`
        ];
        
        if (!img.dataset.altAttempted) {
            img.dataset.altAttempted = '1';
            img.src = altSources[0];
        } else if (img.dataset.altAttempted === '1') {
            img.dataset.altAttempted = '2';
            img.src = altSources[1];
        } else {
            // إذا فشلت جميع المصادر، عرض النص بدلاً من الصورة
            img.style.display = 'none';
            document.getElementById('mushaf-text-fallback').style.display = 'block';
        }
    },

    /**
     * الذهاب إلى صفحة محددة
     */
    goToPage(pageNumber) {
        const page = parseInt(pageNumber);
        if (page >= 1 && page <= this.totalPages) {
            this.loadPage(page);
        }
    },

    /**
     * الصفحة التالية
     */
    nextPage() {
        if (this.currentPage < this.totalPages) {
            this.loadPage(this.currentPage + 1);
        }
    },

    /**
     * الصفحة السابقة
     */
    previousPage() {
        if (this.currentPage > 1) {
            this.loadPage(this.currentPage - 1);
        }
    },

    /**
     * الصفحة الأولى
     */
    firstPage() {
        this.loadPage(1);
    },

    /**
     * الصفحة الأخيرة
     */
    lastPage() {
        this.loadPage(this.totalPages);
    },

    /**
     * تبديل وضع ملء الشاشة
     */
    toggleFullscreen() {
        const elem = document.querySelector('.mushaf-page-container');
        
        if (!document.fullscreenElement) {
            elem.requestFullscreen().catch(err => {
                console.error('Error attempting to enable fullscreen:', err);
            });
        } else {
            document.exitFullscreen();
        }
    },

    /**
     * عرض قائمة التنقل السريع
     */
    async showNavigationMenu() {
        // إنشاء modal للتنقل السريع
        const modal = document.createElement('div');
        modal.className = 'modal active';
        modal.id = 'navigationModal';
        
        // الحصول على بيانات السور
        const surahs = QuranDisplay.surahs || [];
        const bookmarks = JSON.parse(localStorage.getItem('mushaf_bookmarks') || '[]');
        
        modal.innerHTML = `
            <div class="modal-backdrop" onclick="document.getElementById('navigationModal').remove()"></div>
            <div class="modal-content" style="max-width: 900px; width: 95%; max-height: 90vh;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 2px solid var(--color-border);">
                    <h2 style="margin: 0; color: var(--color-primary);">
                        <i class="fas fa-compass"></i> التنقل السريع
                    </h2>
                    <button class="btn btn-icon" onclick="document.getElementById('navigationModal').remove()" style="font-size: 24px;">
                        <i class="fas fa-times"></i>
                    </button>
                </div>

                <!-- تبويبات التنقل -->
                <div class="navigation-tabs" style="display: flex; gap: 10px; margin-bottom: 20px; border-bottom: 2px solid var(--color-border);">
                    <button class="nav-tab active" onclick="DigitalMushaf.switchNavigationTab('surahs')" data-tab="surahs">
                        <i class="fas fa-book"></i> السور (${surahs.length})
                    </button>
                    <button class="nav-tab" onclick="DigitalMushaf.switchNavigationTab('juz')" data-tab="juz">
                        <i class="fas fa-bookmark"></i> الأجزاء (30)
                    </button>
                    <button class="nav-tab" onclick="DigitalMushaf.switchNavigationTab('bookmarks')" data-tab="bookmarks">
                        <i class="fas fa-star"></i> العلامات (${bookmarks.length})
                    </button>
                    <button class="nav-tab" onclick="DigitalMushaf.switchNavigationTab('goto')" data-tab="goto">
                        <i class="fas fa-search"></i> انتقال مباشر
                    </button>
                </div>

                <!-- محتوى التبويبات -->
                <div id="navigationTabContent" style="overflow-y: auto; max-height: calc(90vh - 180px);">
                    ${this.renderSurahsList(surahs)}
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
    },

    /**
     * عرض قائمة السور
     */
    renderSurahsList(surahs) {
        return `
            <div class="surahs-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 15px;">
                ${surahs.map(surah => `
                    <div class="surah-nav-card" onclick="DigitalMushaf.goToSurahPage(${surah.number})" style="background: var(--color-bg-white); padding: 15px; border-radius: var(--radius-lg); border: 2px solid var(--color-border); cursor: pointer; transition: all 0.3s;">
                        <div style="display: flex; align-items: center; gap: 12px;">
                            <div style="width: 40px; height: 40px; background: linear-gradient(135deg, var(--color-primary), var(--color-primary-light)); color: white; border-radius: var(--radius-md); display: flex; align-items: center; justify-content: center; font-weight: bold;">
                                ${surah.number}
                            </div>
                            <div style="flex: 1;">
                                <div class="arabic-text" style="font-size: var(--text-lg); margin-bottom: 4px;">
                                    ${surah.name}
                                </div>
                                <div style="font-size: var(--text-sm); color: var(--color-text-gray);">
                                    ${surah.englishName} • ${surah.numberOfAyahs} آية
                                </div>
                            </div>
                            <i class="fas fa-chevron-left" style="color: var(--color-text-light);"></i>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    },

    /**
     * عرض قائمة الأجزاء
     */
    renderJuzList() {
        let html = '<div class="juz-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 15px;">';
        
        for (let i = 1; i <= 30; i++) {
            html += `
                <div class="juz-nav-card" onclick="DigitalMushaf.goToJuzPage(${i})" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: var(--radius-lg); cursor: pointer; transition: all 0.3s; text-align: center; color: white; box-shadow: var(--shadow-md);">
                    <div style="font-size: var(--text-3xl); font-weight: bold; margin-bottom: 8px;">
                        ${this.getArabicNumber(i)}
                    </div>
                    <div style="font-size: var(--text-sm); opacity: 0.9;">
                        الجزء ${this.getArabicNumber(i)}
                    </div>
                    <div style="font-size: var(--text-xs); opacity: 0.8; margin-top: 8px;">
                        Juz ${i}
                    </div>
                </div>
            `;
        }
        
        html += '</div>';
        return html;
    },

    /**
     * عرض العلامات المرجعية
     */
    renderBookmarksList() {
        const bookmarks = JSON.parse(localStorage.getItem('mushaf_bookmarks') || '[]');
        
        if (bookmarks.length === 0) {
            return `
                <div style="text-align: center; padding: 60px 20px; color: var(--color-text-gray);">
                    <i class="fas fa-bookmark" style="font-size: 64px; opacity: 0.3; margin-bottom: 20px;"></i>
                    <h3>لا توجد علامات مرجعية</h3>
                    <p style="margin-top: 10px;">أضف علامات لصفحاتك المفضلة للوصول السريع</p>
                </div>
            `;
        }
        
        return `
            <div class="bookmarks-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 15px;">
                ${bookmarks.map(pageNum => `
                    <div class="bookmark-card" style="position: relative; background: var(--color-bg-white); padding: 20px; border-radius: var(--radius-lg); border: 2px solid var(--color-accent); cursor: pointer; transition: all 0.3s; text-align: center;">
                        <button onclick="event.stopPropagation(); DigitalMushaf.removeBookmark(${pageNum})" style="position: absolute; top: 8px; right: 8px; background: var(--color-error); color: white; border: none; width: 24px; height: 24px; border-radius: 50%; cursor: pointer; font-size: 12px;">
                            <i class="fas fa-times"></i>
                        </button>
                        <div onclick="DigitalMushaf.goToPageFromNav(${pageNum})" style="padding: 10px;">
                            <i class="fas fa-star" style="color: var(--color-accent); font-size: 32px; margin-bottom: 12px;"></i>
                            <div style="font-size: var(--text-2xl); font-weight: bold; color: var(--color-primary);">
                                ${this.getArabicNumber(pageNum)}
                            </div>
                            <div style="font-size: var(--text-sm); color: var(--color-text-gray); margin-top: 4px;">
                                صفحة ${pageNum}
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    },

    /**
     * عرض الانتقال المباشر
     */
    renderGotoTab() {
        setTimeout(() => {
            const input = document.getElementById('gotoPageInput');
            if (input) {
                input.focus();
                // دعم مفتاح Enter
                input.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        this.gotoPageFromInput();
                    }
                });
            }
        }, 100);
        
        return `
            <div style="max-width: 500px; margin: 40px auto; text-align: center;">
                <h3 style="margin-bottom: 30px; color: var(--color-primary);">
                    <i class="fas fa-crosshairs"></i> الانتقال المباشر
                </h3>
                
                <div style="background: var(--color-bg-light); padding: 30px; border-radius: var(--radius-xl);">
                    <label style="display: block; margin-bottom: 15px; font-weight: 600; color: var(--color-text-dark);">
                        أدخل رقم الصفحة (1 - 604)
                    </label>
                    <input type="number" 
                           id="gotoPageInput" 
                           min="1" 
                           max="604" 
                           placeholder="رقم الصفحة"
                           style="width: 100%; max-width: 300px; padding: 15px; font-size: var(--text-xl); text-align: center; border: 3px solid var(--color-primary); border-radius: var(--radius-lg); margin-bottom: 20px;">
                    
                    <button class="btn btn-primary" onclick="DigitalMushaf.gotoPageFromInput()" style="width: 100%; max-width: 300px; padding: 15px; font-size: var(--text-lg);">
                        <i class="fas fa-arrow-left"></i> انتقل للصفحة
                    </button>
                    
                    <p style="margin-top: 15px; font-size: var(--text-sm); color: var(--color-text-gray);">
                        <i class="fas fa-keyboard"></i> اضغط Enter للانتقال السريع
                    </p>
                </div>

                <div style="margin-top:40px; padding: 20px; background: var(--color-bg-white); border-radius: var(--radius-lg); border: 2px solid var(--color-border);">
                    <h4 style="margin-bottom: 15px; color: var(--color-accent);">
                        <i class="fas fa-lightbulb"></i> نصائح سريعة
                    </h4>
                    <ul style="text-align: right; list-style: none; padding: 0; color: var(--color-text-gray); line-height: 2;">
                        <li><i class="fas fa-check" style="color: var(--color-success); margin-left: 8px;"></i> الصفحة 1: سورة الفاتحة</li>
                        <li><i class="fas fa-check" style="color: var(--color-success); margin-left: 8px;"></i> الصفحة 604: أواخر سورة الناس</li>
                        <li><i class="fas fa-check" style="color: var(--color-success); margin-left: 8px;"></i> كل جزء ≈ 20 صفحة</li>
                    </ul>
                </div>
            </div>
        `;
    },

    /**
     * التبديل بين تبويبات التنقل
     */
    switchNavigationTab(tabName) {
        // تحديث التبويبات النشطة
        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
        
        // عرض المحتوى المناسب
        const contentDiv = document.getElementById('navigationTabContent');
        const surahs = QuranDisplay.surahs || [];
        
        switch(tabName) {
            case 'surahs':
                contentDiv.innerHTML = this.renderSurahsList(surahs);
                break;
            case 'juz':
                contentDiv.innerHTML = this.renderJuzList();
                break;
            case 'bookmarks':
                contentDiv.innerHTML = this.renderBookmarksList();
                break;
            case 'goto':
                contentDiv.innerHTML = this.renderGotoTab();
                // تركيز على حقل الإدخال
                setTimeout(() => {
                    const input = document.getElementById('gotoPageInput');
                    if (input) input.focus();
                }, 100);
                break;
        }
    },

    /**
     * الانتقال لصفحة سورة معينة
     */
    async goToSurahPage(surahNumber) {
        try {
            // الحصول على الصفحة الأولى من السورة
            const surahData = await APIService.getSurah(surahNumber, 'ar.alafasy');
            if (surahData && surahData.ayahs && surahData.ayahs[0]) {
                const firstPage = surahData.ayahs[0].page;
                this.loadPage(firstPage);
                document.getElementById('navigationModal').remove();
            }
        } catch (error) {
            console.error('Error loading surah page:', error);
            App.showToast('حدث خطأ في تحميل السورة', 'error');
        }
    },

    /**
     * الانتقال لصفحة جزء معين
     */
    async goToJuzPage(juzNumber) {
        try {
            // الحصول على الصفحة الأولى من الجزء
            const juzData = await APIService.getJuz(juzNumber, 'ar.alafasy');
            if (juzData && juzData.ayahs && juzData.ayahs[0]) {
                const firstPage = juzData.ayahs[0].page;
                this.loadPage(firstPage);
                document.getElementById('navigationModal').remove();
            }
        } catch (error) {
            console.error('Error loading juz page:', error);
            App.showToast('حدث خطأ في تحميل الجزء', 'error');
        }
    },

    /**
     * الانتقال لصفحة من التنقل
     */
    goToPageFromNav(pageNumber) {
        this.loadPage(pageNumber);
        document.getElementById('navigationModal').remove();
    },

    /**
     * الانتقال من حقل الإدخال
     */
    gotoPageFromInput() {
        const input = document.getElementById('gotoPageInput');
        if (input) {
            const pageNum = parseInt(input.value);
            if (pageNum >= 1 && pageNum <= 604) {
                this.goToPageFromNav(pageNum);
            } else {
                App.showToast('الرجاء إدخال رقم صفحة صحيح (1-604)', 'error');
            }
        }
    },

    /**
     * إزالة علامة مرجعية
     */
    removeBookmark(pageNumber) {
        const bookmarks = JSON.parse(localStorage.getItem('mushaf_bookmarks') || '[]');
        const index = bookmarks.indexOf(pageNumber);
        if (index > -1) {
            bookmarks.splice(index, 1);
            localStorage.setItem('mushaf_bookmarks', JSON.stringify(bookmarks));
            // تحديث العرض
            this.switchNavigationTab('bookmarks');
            App.showToast('تمت إزالة العلامة المرجعية', 'success');
        }
    },

    /**
     * تبديل العلامة المرجعية
     */
    toggleBookmark(pageNumber) {
        const bookmarks = JSON.parse(localStorage.getItem('mushaf_bookmarks') || '[]');
        const index = bookmarks.indexOf(pageNumber);
        
        if (index > -1) {
            bookmarks.splice(index, 1);
            App.showToast('تمت إزالة العلامة المرجعية', 'success');
        } else {
            bookmarks.push(pageNumber);
            App.showToast('تمت إضافة العلامة المرجعية', 'success');
        }
        
        localStorage.setItem('mushaf_bookmarks', JSON.stringify(bookmarks));
    },

    /**
     * إعداد التحكم بلوحة المفاتيح
     */
    setupKeyboardControls() {
        document.addEventListener('keydown', (e) => {
            // التأكد من أن المستخدم في صفحة المصحف
            if (!document.getElementById('mushafContent')) return;
            
            switch(e.key) {
                case 'ArrowLeft':
                case 'ArrowDown':
                    e.preventDefault();
                    this.nextPage();
                    break;
                case 'ArrowRight':
                case 'ArrowUp':
                    e.preventDefault();
                    this.previousPage();
                    break;
                case 'Home':
                    e.preventDefault();
                    this.firstPage();
                    break;
                case 'End':
                    e.preventDefault();
                    this.lastPage();
                    break;
                case 'f':
                case 'F':
                    if (e.ctrlKey) {
                        e.preventDefault();
                        this.toggleFullscreen();
                    }
                    break;
            }
        });
    },

    /**
     * تحويل الأرقام إلى العربية
     */
    getArabicNumber(num) {
        const arabicNums = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
        return num.toString().split('').map(d => arabicNums[parseInt(d)]).join('');
    }
};

window.DigitalMushaf = DigitalMushaf;
