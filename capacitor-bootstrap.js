/**
 * Capacitor native bootstrap.
 * No-op outside Capacitor (plain browser) — every call below is guarded
 * by the top-level check, so this file never affects the desktop/web app.
 *
 * This app has no bundler, so plugins are reached through the
 * native-bridge-injected `Capacitor.Plugins.<Name>` registry rather than
 * importing the npm packages (the documented zero-build-tool access path).
 */
(function () {
    const Capacitor = window.Capacitor;
    if (!Capacitor || !Capacitor.isNativePlatform || !Capacitor.isNativePlatform()) {
        return;
    }

    const { App, Browser, StatusBar, SplashScreen, Network } = Capacitor.Plugins;

    // --- Back button: close menu/modal, else go home, else exit ---
    if (App) {
        App.addListener('backButton', () => {
            const openMenu = document.querySelector('.nav.active');
            if (openMenu) {
                const closeBtn = document.getElementById('mobileMenuClose');
                if (closeBtn) closeBtn.click();
                return;
            }

            const openModal = document.querySelector('.modal.active');
            if (openModal) {
                openModal.classList.remove('active');
                return;
            }

            if (window.App && window.App.currentPage && window.App.currentPage !== 'home') {
                window.App.navigateToPage('home');
                return;
            }

            App.exitApp();
        });
    }

    // --- Outbound resource links open in the system browser, not the WebView ---
    if (Browser) {
        document.addEventListener('click', (event) => {
            const link = event.target.closest('a[target="_blank"]');
            if (!link || !link.href) return;
            event.preventDefault();
            Browser.open({ url: link.href });
        });
    }

    // --- Status bar follows the app's own light/dark theme ---
    // Style.Dark = light icons (for a dark header); Style.Light = dark icons (for a light header).
    if (StatusBar) {
        const syncStatusBarStyle = () => {
            const theme = document.documentElement.getAttribute('data-theme');
            StatusBar.setStyle({ style: theme === 'dark' ? 'DARK' : 'LIGHT' });
        };
        syncStatusBarStyle();
        new MutationObserver(syncStatusBarStyle).observe(document.documentElement, {
            attributes: true,
            attributeFilter: ['data-theme'],
        });
    }

    // --- Hide the splash screen once the page has fully loaded ---
    if (SplashScreen) {
        window.addEventListener('load', () => SplashScreen.hide());
    }

    // --- Offline / back-online feedback via the app's existing toast UI ---
    if (Network) {
        Network.addListener('networkStatusChange', (status) => {
            if (!window.App || typeof window.App.showToast !== 'function') return;
            if (!status.connected) {
                window.App.showToast('لا يوجد اتصال بالإنترنت', 'error');
            } else {
                window.App.showToast('تم استعادة الاتصال بالإنترنت', 'success');
            }
        });
    }
})();
