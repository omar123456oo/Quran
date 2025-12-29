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

        console.log('Application initialized successfully');
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

        const savedSettings = localStorage.getItem('quran_settings');
        this.settings = savedSettings ? JSON.parse(savedSettings) : defaultSettings;
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
                const page = e.target.getAttribute('data-page');
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
    },

    /**
     * Navigate to a page
     */
    navigateToPage(pageName) {
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

        // Load page content if needed
        switch (pageName) {
            case 'bookmarks':
                Bookmarks.loadBookmarks();
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
        toast.innerHTML = `
            <div class="flex items-center gap-4">
                <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
                <span>${message}</span>
            </div>
        `;

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
