/**
 * Main Application Controller
 * Handles routing, navigation, theming, and utility functions
 */

const App = {
    currentPage: 'home',
    currentSurah: null,
    settings: null,

    /**
     * Initialize the application
     */
    init() {
        console.log('Initializing Qur\'an Kareem Application...');

        // Load settings
        this.loadSettings();

        // Apply theme
        this.applyTheme();

        // Setup event listeners
        this.setupEventListeners();

        // Setup mobile menu
        this.setupMobileMenu();

        // Initialize modules
        this.initModules();

        // Initialize search
        if (typeof Search !== 'undefined') {
            Search.init();
        }

        this.setupConnectivity();
        this.registerServiceWorker();

        console.log('Application initialized successfully');
    },

    /** Offline banner; content that is stored on the device keeps working. */
    setupConnectivity() {
        const banner = document.getElementById('offlineBanner');
        const update = () => {
            const offline = navigator.onLine === false;
            if (banner) banner.hidden = !offline;
            document.body.classList.toggle('is-offline', offline);
        };
        window.addEventListener('online', update);
        window.addEventListener('offline', update);
        if (banner) banner.addEventListener('click', (e) => {
            const link = e.target.closest('[data-page-link]');
            if (link) { e.preventDefault(); this.navigateToPage(link.dataset.pageLink); }
        });
        update();
    },

    /** Service workers need a secure context: HTTPS in production, or localhost in development. */
    registerServiceWorker() {
        if (!('serviceWorker' in navigator) || !window.isSecureContext) return;
        navigator.serviceWorker.register('sw.js').catch((e) => console.warn('Service worker registration failed', e));
    },

    /**
     * Setup mobile menu
     */
    setupMobileMenu() {
        const toggleBtn = document.getElementById('mobileMenuToggle');
        const closeBtn = document.getElementById('mobileMenuClose');
        const nav = document.querySelector('.nav');
        const backdrop = document.getElementById('mobileMenuBackdrop');
        const navLinks = document.querySelectorAll('.nav-link');

        if (toggleBtn && nav && backdrop) {
            // Function to toggle menu
            const toggleMenu = () => {
                const isActive = nav.classList.contains('active');

                if (isActive) {
                    nav.classList.remove('active');
                    backdrop.classList.remove('active');
                    toggleBtn.classList.remove('active');
                    toggleBtn.querySelector('i').className = 'fas fa-bars';
                    document.body.style.overflow = '';
                } else {
                    nav.classList.add('active');
                    backdrop.classList.add('active');
                    toggleBtn.classList.add('active');
                    toggleBtn.querySelector('i').className = 'fas fa-times';
                    document.body.style.overflow = 'hidden'; // Prevent scrolling
                }
            };

            // Function to close menu
            const closeMenu = () => {
                nav.classList.remove('active');
                backdrop.classList.remove('active');
                toggleBtn.classList.remove('active');
                toggleBtn.querySelector('i').className = 'fas fa-bars';
                document.body.style.overflow = '';
            };

            // Toggle menu
            toggleBtn.addEventListener('click', toggleMenu);

            // Close button in menu
            if (closeBtn) {
                closeBtn.addEventListener('click', closeMenu);
            }

            // Close when clicking backdrop
            backdrop.addEventListener('click', closeMenu);

            // Close when clicking a link
            navLinks.forEach(link => {
                link.addEventListener('click', closeMenu);
            });

            // Close when pressing Escape
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && nav.classList.contains('active')) {
                    closeMenu();
                }
            });
        }
    },

    /**
     * Load settings from localStorage
     */
    loadSettings() {
        const defaultSettings = {
            theme: 'light',
            fontSize: 'medium',
            arabicFont: 'amiri',
            defaultReciter: 'ar.alafasy',
            defaultTranslation: 'en.sahih',
            defaultTafseer: 'ar.muyassar',
            autoPlay: false,
            showTranslation: true,
            translationPosition: 'below'
        };

        let saved = null;
        try {
            saved = JSON.parse(localStorage.getItem('quran_settings'));
        } catch (e) {
            console.warn('Saved settings unreadable, using defaults', e);
        }
        this.settings = Object.assign({}, defaultSettings, saved && typeof saved === 'object' ? saved : {});
    },

    /**
     * Save settings to localStorage
     */
    saveSettings() {
        localStorage.setItem('quran_settings', JSON.stringify(this.settings));
        this.showToast('تم حفظ الإعدادات', 'success');
    },

    /**
     * Apply theme
     */
    applyTheme() {
        const theme = this.settings.theme;
        document.documentElement.setAttribute('data-theme', theme);

        const themeIcon = document.querySelector('#themeToggle i');
        if (themeIcon) {
            themeIcon.className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
        }
    },

    /**
     * Toggle theme
     */
    toggleTheme() {
        this.settings.theme = this.settings.theme === 'light' ? 'dark' : 'light';
        this.applyTheme();
        this.saveSettings();
    },

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Theme toggle
        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) {
            themeToggle.addEventListener('click', () => this.toggleTheme());
        }

        // Navigation links
        const navLinks = document.querySelectorAll('.nav-link');
        navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                const page = e.currentTarget.getAttribute('data-page');
                this.navigateToPage(page);
            });
        });

        // Logo click - go home
        const logoLink = document.getElementById('logoLink');
        if (logoLink) {
            logoLink.addEventListener('click', (e) => {
                e.preventDefault();
                this.navigateToPage('home');
            });
        }

        // Back to home button
        const backToHome = document.getElementById('backToHome');
        if (backToHome) {
            backToHome.addEventListener('click', () => {
                this.navigateToPage('home');
            });
        }

        // Search input
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            let searchTimeout;
            searchInput.addEventListener('input', (e) => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    const query = e.target.value.trim();
                    if (query.length > 2) {
                        Search.performSearch(query);
                    }
                }, 500);
            });

            searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    const query = e.target.value.trim();
                    if (query.length > 0) {
                        Search.performSearch(query);
                    }
                }
            });
        }
    },

    /**
     * Initialize all modules
     */
    initModules() {
        // Initialize modules that need setup
        if (typeof QuranDisplay !== 'undefined') {
            QuranDisplay.init();
        }

        if (typeof AudioPlayer !== 'undefined') {
            AudioPlayer.init();
        }

        if (typeof Settings !== 'undefined') {
            Settings.init();
        }

        if (typeof IslamicResources !== 'undefined') {
            IslamicResources.init();
        }

        if (typeof Bookmarks !== 'undefined') {
            Bookmarks.init();
        }

        if (typeof PlaylistsUI !== 'undefined') {
            PlaylistsUI.init();
        }

        if (typeof Downloads !== 'undefined') {
            Downloads.init();
        }
    },

    /**
     * Show the reader (Surah / Juz / page text) without touching playback.
     */
    showReader() {
        this.navigateToPage('surah');
    },

    /**
     * Navigate to a page
     */
    navigateToPage(pageName) {
        if (pageName !== 'mushaf') {
            document.body.classList.remove('mr-focus');
            if (this.baseTitle) document.title = this.baseTitle;
        }
        if (!this.baseTitle) this.baseTitle = document.title;

        // Hide all pages
        const pages = document.querySelectorAll('.page');
        pages.forEach(page => page.classList.add('hidden'));

        // Show target page
        const targetPage = document.getElementById(`${pageName}Page`);
        if (targetPage) {
            targetPage.classList.remove('hidden');
        }

        // Update nav links
        const navLinks = document.querySelectorAll('.nav-link');
        navLinks.forEach(link => {
            if (link.getAttribute('data-page') === pageName) {
                link.classList.add('active');
            } else {
                link.classList.remove('active');
            }
        });

        this.currentPage = pageName;
        window.scrollTo({ top: 0 });

        // Load page content if needed
        switch (pageName) {
            case 'surah':
                // Re-entering the reader keeps what was open; only load something if nothing is open yet.
                if (!QuranDisplay.currentSurah) {
                    const last = Bookmarks.lastRead;
                    if (last && last.surahNumber >= 1 && last.surahNumber <= 114) {
                        QuranDisplay.loadSurah(last.surahNumber);
                    } else {
                        this.navigateToPage('home');
                    }
                }
                break;
            case 'playlists':
                if (typeof PlaylistsUI !== 'undefined') PlaylistsUI.show();
                break;
            case 'adhkar':
                if (typeof Adhkar !== 'undefined') {
                    Adhkar.init();
                }
                break;
            case 'mushaf':
                if (typeof DigitalMushaf !== 'undefined') {
                    DigitalMushaf.init();
                }
                break;
            case 'bookmarks':
                Bookmarks.loadBookmarks();
                break;
            case 'downloads':
                if (typeof Downloads !== 'undefined') Downloads.show();
                break;
            case 'resources':
                IslamicResources.loadResources();
                break;
            case 'settings':
                Settings.loadSettings();
                break;
        }
    },

    /**
     * Show loading overlay
     */
    showLoading() {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) {
            overlay.classList.remove('hidden');
        }
    },

    /**
     * Hide loading overlay
     */
    hideLoading() {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) {
            overlay.classList.add('hidden');
        }
    },

    /**
     * Show toast notification
     */
    showToast(message, type = 'info') {
        const container = document.getElementById('toastContainer');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.setAttribute('role', type === 'error' ? 'alert' : 'status');
        toast.innerHTML = `
            <div class="flex items-center gap-4">
                <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}" aria-hidden="true"></i>
                <span></span>
            </div>
        `;
        toast.querySelector('span').textContent = message;

        container.appendChild(toast);

        // Auto remove after 3 seconds
        setTimeout(() => {
            toast.style.animation = 'fadeOut 0.3s ease';
            setTimeout(() => {
                toast.remove();
            }, 300);
        }, 3000);
    },

    /**
     * Format time in MM:SS format
     */
    formatTime(seconds) {
        if (!Number.isFinite(seconds) || seconds < 0) seconds = 0;
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    },

    /**
     * Get Surah name in English
     */
    getSurahNameEnglish(number) {
        const names = {
            1: 'Al-Fatihah', 2: 'Al-Baqarah', 3: 'Aal-E-Imran', 4: 'An-Nisa',
            5: 'Al-Ma\'idah', 6: 'Al-An\'am', 7: 'Al-A\'raf', 8: 'Al-Anfal',
            9: 'At-Tawbah', 10: 'Yunus', 11: 'Hud', 12: 'Yusuf',
            13: 'Ar-Ra\'d', 14: 'Ibrahim', 15: 'Al-Hijr', 16: 'An-Nahl',
            17: 'Al-Isra', 18: 'Al-Kahf', 19: 'Maryam', 20: 'Ta-Ha',
            // ... (abbreviated for brevity, full list in actual implementation)
        };
        return names[number] || `Surah ${number}`;
    }
};

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => App.init());
} else {
    App.init();
}

// Export for use in other modules
window.App = App;
