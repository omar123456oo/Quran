/**
 * Islamic Resources Module
 * Provides access to trusted Islamic websites and resources
 */

const IslamicResources = {
    resources: [
        {
            id: 1,
            name: 'Quran.com',
            nameAr: 'موقع القرآن الكريم',
            description: 'The most advanced digital Quran with translations, audio, and more',
            descriptionAr: 'المصحف الرقمي المتقدم مع التراجم والصوتيات',
            url: 'https://quran.com',
            category: 'quran',
            icon: 'book-quran'
        },
        {
            id: 2,
            name: 'Al-Azhar University',
            nameAr: 'جامعة الأزهر الشريف',
            description: 'Official website of Al-Azhar University, Egypt',
            descriptionAr: 'الموقع الرسمي لجامعة الأزهر الشريف',
            url: 'https://www.azhar.eg',
            category: 'education',
            icon: 'mosque'
        },
        {
            id: 3,
            name: 'IslamQA.info',
            nameAr: 'الإسلام سؤال وجواب',
            description: 'Trusted Islamic Q&A website',
            descriptionAr: 'موقع موثوق للأسئلة والأجوبة الإسلامية',
            url: 'https://islamqa.info/ar',
            category: 'knowledge',
            icon: 'question-circle'
        },
        {
            id: 4,
            name: 'SeekersGuidance',
            nameAr: 'طالبي الهداية',
            description: 'Islamic education and spiritual guidance',
            descriptionAr: 'التعليم الإسلامي والإرشاد الروحي',
            url: 'https://seekersguidance.org',
            category: 'education',
            icon: 'graduation-cap'
        },
        {
            id: 5,
            name: 'Sunnah.com',
            nameAr: 'موقع السنة النبوية',
            description: 'Collection of Hadith with searchable database',
            descriptionAr: 'مجموعة الأحاديث النبوية مع قاعدة بيانات قابلة للبحث',
            url: 'https://sunnah.com',
            category: 'hadith',
            icon: 'book'
        },
        {
            id: 6,
            name: 'Bayyinah TV',
            nameAr: 'بيّنة',
            description: 'Learn Arabic and study the Quran',
            descriptionAr: 'تعلم العربية ودراسة القرآن',
            url: 'https://bayyinah.tv',
            category: 'education',
            icon: 'video'
        },
        {
            id: 7,
            name: 'Islamic Finder',
            nameAr: 'الباحث الإسلامي',
            description: 'Prayer times, Qibla direction, and Islamic calendar',
            descriptionAr: 'أوقات الصلاة واتجاه القبلة والتقويم الإسلامي',
            url: 'https://www.islamicfinder.org',
            category: 'tools',
            icon: 'compass'
        },
        {
            id: 8,
            name: 'Productive Muslim',
            nameAr: 'المسلم المنتج',
            description: 'Productivity and Islamic lifestyle',
            descriptionAr: 'الإنتاجية ونمط الحياة الإسلامي',
            url: 'https://productivemuslim.com',
            category: 'lifestyle',
            icon: 'chart-line'
        }
    ],

    categories: {
        quran: { name: 'القرآن الكريم', icon: 'book-quran', color: '#1e7b5f' },
        hadith: { name: 'الحديث النبوي', icon: 'book', color: '#d4af37' },
        education: { name: 'التعليم', icon: 'graduation-cap', color: '#3b82f6' },
        knowledge: { name: 'المعرفة', icon: 'lightbulb', color: '#f59e0b' },
        tools: { name: 'أدوات', icon: 'tools', color: '#8b5cf6' },
        lifestyle: { name: 'أسلوب الحياة', icon: 'heart', color: '#ec4899' }
    },

    /**
     * Initialize resources module
     */
    init() {
        console.log('Islamic Resources module initialized');
    },

    /**
     * Load resources page
     */
    loadResources() {
        const container = document.getElementById('resourcesList');
        if (!container) return;

        let html = `
            <div class="mb-4">
                <p style="color: var(--color-text-gray);">
                    مجموعة من المواقع الإسلامية الموثوقة للبحث والتعلم
                </p>
            </div>
            
            <!-- Category Filters -->
            <div class="flex gap-4 mb-4" style="flex-wrap: wrap;">
                <button class="btn btn-primary" onclick="IslamicResources.filterByCategory('all')">
                    الكل
                </button>
                ${Object.entries(this.categories).map(([key, cat]) => `
                    <button class="btn btn-secondary" onclick="IslamicResources.filterByCategory('${key}')">
                        <i class="fas fa-${cat.icon}"></i>
                        ${cat.name}
                    </button>
                `).join('')}
            </div>
            
            <!-- Resources Grid -->
            <div class="surah-grid" id="resourcesGrid">
                ${this.resources.map(resource => this.createResourceCard(resource)).join('')}
            </div>
        `;

        container.innerHTML = html;
    },

    /**
     * Create resource card
     */
    createResourceCard(resource) {
        const category = this.categories[resource.category];

        return `
            <div class="card resource-card" data-category="${resource.category}">
                <div class="flex items-center gap-4 mb-3">
                    <div style="width: 48px; height: 48px; background: ${category.color}; border-radius: var(--radius-md); display: flex; align-items: center; justify-content: center; color: white; font-size: 1.5rem;">
                        <i class="fas fa-${resource.icon}"></i>
                    </div>
                    <div>
                        <div style="font-weight: 600; font-size: var(--text-lg);">
                            ${resource.nameAr}
                        </div>
                        <div style="color: var(--color-text-gray); font-size: var(--text-sm);">
                            ${resource.name}
                        </div>
                    </div>
                </div>
                
                <p style="color: var(--color-text-gray); font-size: var(--text-sm); margin-bottom: var(--space-4);">
                    ${resource.descriptionAr}
                </p>
                
                <div class="flex gap-4">
                    <a href="${resource.url}" target="_blank" rel="noopener noreferrer" class="btn btn-primary" style="flex: 1;">
                        <i class="fas fa-external-link-alt"></i>
                        زيارة الموقع
                    </a>
                </div>
            </div>
        `;
    },

    /**
     * Filter resources by category
     */
    filterByCategory(category) {
        const cards = document.querySelectorAll('.resource-card');

        cards.forEach(card => {
            if (category === 'all' || card.dataset.category === category) {
                card.style.display = 'block';
            } else {
                card.style.display = 'none';
            }
        });

        // Update active button
        const buttons = document.querySelectorAll('#resourcesList .btn');
        buttons.forEach(btn => {
            btn.classList.remove('btn-primary');
            btn.classList.add('btn-secondary');
        });

        event.target.classList.remove('btn-secondary');
        event.target.classList.add('btn-primary');
    }
};

window.IslamicResources = IslamicResources;
