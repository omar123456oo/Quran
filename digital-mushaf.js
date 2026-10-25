/**
 * Digital Mushaf — المصحف القارئ
 *
 * Renders the KFGQPC Madinah Mushaf (1405 AH layout, 604 pages) line by line from the
 * verified page data in MushafStore: every word is drawn with its own glyph from the
 * page's KFGQPC V1 font, on the line where it is printed. Nothing is reflowed.
 * Downloaded pages render without any network request.
 */

// Largest glyph size as a fraction of the text width (≈ the size on ordinary full pages).
const MAX_GLYPH_RATIO = 0.064;

const DigitalMushaf = {
    currentPage: 1,
    totalPages: 604,
    renderToken: 0,
    built: false,
    prefs: { fit: 'screen', tone: 'auto', playbar: true, highlight: true },

    /* ------------------------------------------------------------ setup */
    init() {
        this.loadPrefs();
        if (!this.built) this.build();
        MushafStore.init();
        const saved = parseInt(localStorage.getItem('mushaf_last_page'), 10);
        this.currentPage = saved >= 1 && saved <= this.totalPages ? saved : 1;
        this.loadPage(this.currentPage);
        this.setupKeyboardControls();
        this.setupPlaybackSync();
    },

    loadPrefs() {
        try {
            const p = JSON.parse(localStorage.getItem('mushaf_prefs'));
            if (p && typeof p === 'object') {
                if (['screen', 'width'].includes(p.fit)) this.prefs.fit = p.fit;
                if (['auto', 'cream', 'white', 'dark'].includes(p.tone)) this.prefs.tone = p.tone;
                if (typeof p.playbar === 'boolean') this.prefs.playbar = p.playbar;
                if (typeof p.highlight === 'boolean') this.prefs.highlight = p.highlight;
            }
        } catch (e) { /* defaults */ }
    },

    savePrefs() {
        try { localStorage.setItem('mushaf_prefs', JSON.stringify(this.prefs)); } catch (e) { /* not critical */ }
        this.applyPrefs();
    },

    applyPrefs() {
        const root = document.getElementById('mushafReader');
        if (!root) return;
        root.dataset.fit = this.prefs.fit;
        root.dataset.tone = this.prefs.tone;
        root.classList.toggle('mr-no-playbar', !this.prefs.playbar);
        this.fitPage();
        this.applyPlaybackHighlight();
    },

    /** Build the reader shell once; later page turns only replace the page itself. */
    build() {
        const container = document.getElementById('mushafContent');
        if (!container) return;
        this.built = true;
        const n = (x) => this.getArabicNumber(x);
        container.innerHTML = `
            <div class="mr" id="mushafReader">
                <div class="mr-bar" role="toolbar" aria-label="أدوات المصحف">
                    <div class="mr-title">
                        <span class="mr-surah" id="mrSurah"></span>
                        <span class="mr-sub" id="mrSub"></span>
                    </div>
                    <div class="mr-nav">
                        <button type="button" class="mr-btn" data-act="prev" aria-label="الصفحة السابقة" title="الصفحة السابقة">
                            <i class="fas fa-angle-right" aria-hidden="true"></i></button>
                        <label class="mr-pageno">
                            <span class="sr-only">رقم الصفحة</span>
                            <input type="number" id="mushafPageInput" min="1" max="${this.totalPages}" inputmode="numeric" enterkeyhint="go">
                            <span aria-hidden="true">/ ${n(this.totalPages)}</span>
                        </label>
                        <button type="button" class="mr-btn" data-act="next" aria-label="الصفحة التالية" title="الصفحة التالية">
                            <i class="fas fa-angle-left" aria-hidden="true"></i></button>
                    </div>
                    <div class="mr-tools">
                        <span class="mr-avail" id="mrAvail" role="status" aria-live="polite"></span>
                        <button type="button" class="mr-btn" data-act="bookmark" id="mrBookmark" aria-pressed="false" aria-label="إضافة علامة" title="علامة مرجعية">
                            <i class="far fa-bookmark" aria-hidden="true"></i></button>
                        <button type="button" class="mr-btn" data-act="index" aria-label="الفهرس والتنقل" title="الفهرس">
                            <i class="fas fa-list" aria-hidden="true"></i></button>
                        <button type="button" class="mr-btn" data-act="download" aria-label="تنزيل للقراءة دون اتصال" title="تنزيل">
                            <i class="fas fa-download" aria-hidden="true"></i></button>
                        <button type="button" class="mr-btn" data-act="settings" aria-label="إعدادات القراءة" title="إعدادات القراءة">
                            <i class="fas fa-sliders" aria-hidden="true"></i></button>
                        <button type="button" class="mr-btn" data-act="fullscreen" aria-label="ملء الشاشة" title="ملء الشاشة">
                            <i class="fas fa-expand" aria-hidden="true"></i></button>
                    </div>
                </div>

                <div class="mushaf-playbar" role="group" aria-label="تشغيل الصفحة">
                    <button type="button" class="btn btn-primary" data-act="play-page">
                        <i class="fas fa-play-circle" aria-hidden="true"></i> تشغيل هذه الصفحة
                    </button>
                    <button type="button" class="btn btn-secondary" data-act="queue-page">
                        <i class="fas fa-list-ol" aria-hidden="true"></i> إلى الطابور
                    </button>
                    <button type="button" class="btn btn-secondary" id="mushafJumpPlaying" hidden data-act="jump-playing">
                        <i class="fas fa-location-crosshairs" aria-hidden="true"></i> <span></span>
                    </button>
                    <label class="follow-toggle">
                        <input type="checkbox" id="mrFollow"> تتبع التشغيل
                    </label>
                </div>

                <div class="mr-stage" id="mrStage">
                    <button type="button" class="mr-side mr-side-prev" data-act="prev" aria-label="الصفحة السابقة"><i class="fas fa-angle-right" aria-hidden="true"></i></button>
                    <section class="mr-page" id="mrPage" lang="ar" dir="rtl" aria-live="off"></section>
                    <button type="button" class="mr-side mr-side-next" data-act="next" aria-label="الصفحة التالية"><i class="fas fa-angle-left" aria-hidden="true"></i></button>
                </div>
                <p class="mr-hint">التنقل: الأسهم ← → في لوحة المفاتيح، أو السحب أفقيًا على الشاشات اللمسية</p>
            </div>`;

        const root = document.getElementById('mushafReader');
        root.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-act]');
            if (btn && root.contains(btn)) this.onAction(btn.dataset.act, btn);
        });
        const input = document.getElementById('mushafPageInput');
        input.addEventListener('change', () => this.goToPage(input.value));
        input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { input.blur(); this.goToPage(input.value); } });
        const follow = document.getElementById('mrFollow');
        follow.addEventListener('change', () => { PlayerState.prefs.followPlayback = follow.checked; PlayerState.persist(); });

        const page = document.getElementById('mrPage');
        page.addEventListener('copy', (e) => this.onCopy(e));
        this.setupSwipe(document.getElementById('mrStage'));

        if (typeof ResizeObserver !== 'undefined') {
            let t;
            new ResizeObserver(() => { clearTimeout(t); t = setTimeout(() => this.fitPage(), 60); })
                .observe(document.getElementById('mrStage'));
        }
        document.addEventListener('fullscreenchange', () => {
            root.classList.toggle('mr-fullscreen', document.fullscreenElement === root);
            this.updateFullscreenButton();
            this.fitPage();
        });
        window.addEventListener('online', () => this.updateAvailability());
        window.addEventListener('offline', () => this.updateAvailability());
        MushafStore.subscribe(() => this.updateAvailability());
        this.applyPrefs();
    },

    onAction(act, btn) {
        switch (act) {
            case 'prev': return this.previousPage();
            case 'next': return this.nextPage();
            case 'bookmark': return this.toggleBookmark(this.currentPage);
            case 'index': return this.showNavigationMenu();
            case 'download': return this.showDownloadSheet();
            case 'settings': return this.showSettings();
            case 'fullscreen': return this.toggleFullscreen();
            case 'play-page': return AudioPlayer.playNow('page', this.currentPage);
            case 'queue-page': return AudioPlayer.addToQueue('page', this.currentPage);
            case 'jump-playing': return this.goToPlayingPage();
            case 'goto-page': return this.loadPage(Number(btn.dataset.page));
            case 'open-downloads': return App.navigateToPage('downloads');
            case 'retry-page': return this.loadPage(this.currentPage);
        }
    },

    /* --------------------------------------------------- playback sync */
    setupPlaybackSync() {
        if (this._syncBound) return;
        this._syncBound = true;
        PlaybackStore.subscribe((state, keys) => {
            if (App.currentPage !== 'mushaf') return;
            if (!keys.some(k => ['page', 'status', 'itemId', 'surah', 'ayah'].includes(k))) return;
            this.updatePlayingControls();
            this.applyPlaybackHighlight();
            const turning = state.status === 'playing' || state.status === 'buffering';
            if (turning && keys.includes('page') && state.page && state.page !== this.currentPage &&
                PlayerState.prefs.followPlayback) {
                this.loadPage(state.page, { silent: true });
            }
        });
    },

    updatePlayingControls() {
        const s = PlaybackStore.get();
        const btn = document.getElementById('mushafJumpPlaying');
        if (btn) {
            const show = !!s.page && s.status !== 'idle' && s.page !== this.currentPage;
            btn.hidden = !show;
            if (show) btn.querySelector('span').textContent = `صفحة التشغيل الحالية (${this.getArabicNumber(s.page)})`;
        }
        const follow = document.getElementById('mrFollow');
        if (follow) follow.checked = !!PlayerState.prefs.followPlayback;
    },

    applyPlaybackHighlight() {
        const page = document.getElementById('mrPage');
        if (!page) return;
        page.querySelectorAll('.is-playing').forEach(el => el.classList.remove('is-playing'));
        const s = PlaybackStore.get();
        if (!this.prefs.highlight || !s.surah || !s.ayah || s.status === 'idle') return;
        page.querySelectorAll(`[data-k="${s.surah}:${s.ayah}"]`).forEach(el => el.classList.add('is-playing'));
    },

    goToPlayingPage() {
        const s = PlaybackStore.get();
        if (s.page) this.loadPage(s.page);
    },

    /* ------------------------------------------------------- rendering */
    loadPage(pageNumber, opts) {
        pageNumber = parseInt(pageNumber, 10);
        if (!(pageNumber >= 1 && pageNumber <= this.totalPages)) return;
        this.currentPage = pageNumber;
        try { localStorage.setItem('mushaf_last_page', pageNumber); } catch (e) { /* not critical */ }
        PlaybackStore.setReading({ page: pageNumber });
        return this.displayPage(pageNumber, opts);
    },

    async displayPage(p, opts) {
        if (!this.built) this.build();
        const pageEl = document.getElementById('mrPage');
        if (!pageEl) return;
        const token = ++this.renderToken;
        const silent = !!(opts && opts.silent);

        this.updateHeader(p, null);
        this.updateBookmarkButton();
        this.updatePlayingControls();
        const input = document.getElementById('mushafPageInput');
        if (input && document.activeElement !== input) input.value = p;
        pageEl.setAttribute('aria-busy', 'true');
        pageEl.classList.add('is-loading');

        try {
            const [data] = await Promise.all([MushafStore.getPage(p), MushafStore.ensureFont(p), MushafStore.ensureFont(1)]);
            if (token !== this.renderToken) return;           // the reader moved on
            this.renderPage(pageEl, p, data);
            this.updateHeader(p, data);
            this.applyPlaybackHighlight();
            if (!silent && App.currentPage === 'mushaf') {
                const top = document.getElementById('mushafReader').getBoundingClientRect().top + window.scrollY - 70;
                if (window.scrollY > top) window.scrollTo({ top: Math.max(0, top) });
            }
            this.prefetch(p);
        } catch (e) {
            if (token !== this.renderToken) return;
            this.renderProblem(pageEl, p, e);
        } finally {
            if (token === this.renderToken) {
                pageEl.removeAttribute('aria-busy');
                pageEl.classList.remove('is-loading');
                this.updateAvailability();
            }
        }
    },

    renderPage(pageEl, p, data) {
        const slots = MushafCore.layout(data, MushafMeta);
        const family = MushafStore.family(p);
        const esc = QuranUtil.esc;
        const lines = slots.map(slot => {
            if (slot.type === 'header') {
                const name = MushafMeta.surahs[slot.surah - 1][0];
                return `<div class="mr-line mr-line-header"><span class="mr-surah-frame">${esc(name)}</span></div>`;
            }
            if (slot.type === 'basmala') {
                const glyphs = MushafMeta.basmalaCodes.map(c => `<span class="mr-w">${esc(c)}</span>`).join('');
                return `<div class="mr-line mr-line-basmala" role="img" aria-label="بسم الله الرحمن الرحيم"><span class="mr-l" style="font-family:'${MushafStore.family(1)}'" aria-hidden="true">${glyphs}</span></div>`;
            }
            if (slot.type === 'empty') return '<div class="mr-line" aria-hidden="true"></div>';
            const spoken = slot.words.map(w => w[3] ? `(${w[1]})` : w[1]).join(' ');
            const words = slot.words.map(w =>
                `<span class="mr-w${w[3] ? ' mr-end' : ''}" data-k="${esc(w[2])}" data-t="${esc(w[1])}">${esc(w[0])}</span>`).join('');
            return `<div class="mr-line"><span class="sr-only">${esc(spoken)}</span><span class="mr-l" style="font-family:'${family}'" aria-hidden="true">${words}</span></div>`;
        }).join('');
        pageEl.dataset.page = p;
        pageEl.dataset.lines = MushafCore.maxLine(p);
        pageEl.setAttribute('aria-label', `صفحة ${this.getArabicNumber(p)}`);
        pageEl.innerHTML = `<div class="mr-lines">${lines}</div><div class="mr-folio" aria-hidden="true">${this.getArabicNumber(p)}</div>`;
        this.fitPage();
    },

    /**
     * Scale glyphs to the page width. Lines that fill most of the width are justified,
     * short ones (end of a Surah, pages 1–2) centred — as in print. Words are never moved
     * between lines and never resized individually.
     */
    fitPage() {
        const pageEl = document.getElementById('mrPage');
        const linesEl = pageEl && pageEl.querySelector('.mr-lines');
        if (!linesEl || !pageEl.offsetWidth) return;
        const cs = getComputedStyle(linesEl);
        const width = linesEl.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
        const base = width * 0.06;
        pageEl.style.setProperty('--mr-glyph', `${base}px`);
        const inner = [...linesEl.querySelectorAll('.mr-line:not(.mr-line-header):not(.mr-line-basmala) .mr-l')];
        inner.forEach(el => el.parentElement.classList.remove('is-full'));
        const natural = inner.map(el => el.scrollWidth);
        const widest = Math.max(1, ...natural);
        // Widest line fills ~97% of the width; capped so pages with only short lines
        // (pages 1–2, Surah endings) keep the same glyph size as ordinary pages.
        const cap = width * (MushafCore.maxLine(Number(pageEl.dataset.page)) === 8 ? 0.085 : MAX_GLYPH_RATIO);
        const size = Math.min(base * (width * 0.97) / widest, cap);
        pageEl.style.setProperty('--mr-glyph', `${size}px`);
        const scale = size / base;
        inner.forEach((el, i) => {
            if (natural[i] * scale >= width * 0.8) el.parentElement.classList.add('is-full');
        });
    },

    renderProblem(pageEl, p, e) {
        const code = e && e.code;
        const nearest = this.nearestDownloaded(p);
        const n = (x) => this.getArabicNumber(x);
        let title, body, actions = '';
        if (code === 'not-downloaded') {
            title = 'هذه الصفحة غير محمّلة على الجهاز';
            body = navigator.onLine === false
                ? 'أنت غير متصل بالإنترنت، ولم يتم تنزيل هذه الصفحة للقراءة دون اتصال.'
                : 'تعذر الوصول إلى الخادم، ولم يتم تنزيل هذه الصفحة للقراءة دون اتصال.';
            if (nearest) actions += `<button type="button" class="btn btn-primary" data-act="goto-page" data-page="${nearest}">الانتقال إلى أقرب صفحة محمّلة (${n(nearest)})</button>`;
            actions += '<button type="button" class="btn btn-secondary" data-act="open-downloads">إدارة التنزيلات</button>';
        } else if (code === 'invalid') {
            title = 'لم تجتز بيانات الصفحة التحقق';
            body = 'لن تُعرض صفحة قد تكون ناقصة أو غير مطابقة للمصحف. حاول مرة أخرى لاحقًا.';
            actions = '<button type="button" class="btn btn-primary" data-act="retry-page">إعادة المحاولة</button>';
        } else {
            title = 'تعذر عرض الصفحة';
            body = 'حدث خطأ أثناء تحميل الصفحة أو خطها.';
            actions = '<button type="button" class="btn btn-primary" data-act="retry-page">إعادة المحاولة</button>';
        }
        console.warn('Mushaf page', p, e);
        pageEl.dataset.page = p;
        pageEl.innerHTML = `
            <div class="mr-problem" role="alert">
                <i class="fas fa-cloud-arrow-down" aria-hidden="true"></i>
                <h3>${title}</h3>
                <p>${body}</p>
                <div class="mr-problem-actions">${actions}</div>
            </div>`;
        this.updateHeader(p, null);
    },

    nearestDownloaded(p) {
        let best = null;
        MushafStore.downloaded.forEach(d => { if (best === null || Math.abs(d - p) < Math.abs(best - p)) best = d; });
        return best;
    },

    /** Warm the neighbouring pages (data + font) without blocking the current one. */
    prefetch(p) {
        const run = () => [p + 1, p - 1].forEach(q => {
            if (q < 1 || q > this.totalPages) return;
            if (!MushafStore.isDownloaded(q) && navigator.onLine === false) return;
            MushafStore.getPage(q).then(() => MushafStore.ensureFont(q)).catch(() => {});
        });
        if ('requestIdleCallback' in window) requestIdleCallback(run, { timeout: 1500 }); else setTimeout(run, 300);
    },

    /** [first, last] page of a Surah; the last page is shared when the next Surah starts mid-page. */
    surahPages(s) {
        const start = MushafMeta.surahStartPage[s - 1];
        if (s === 114) return [start, 604];
        const next = MushafMeta.surahStartPage[s];
        return [start, Math.max(start, MushafMeta.pageStart[next - 1] === `${s + 1}:1` ? next - 1 : next)];
    },

    juzPages(j) {
        const start = MushafMeta.juzStartPage[j - 1];
        if (j === 30) return [start, 604];
        const next = MushafMeta.juzStartPage[j];
        return [start, Math.max(start, MushafMeta.pageStart[next - 1] === MushafMeta.juzStart[j] ? next - 1 : next)];
    },

    pageRange(a, b) { return Array.from({ length: Math.max(0, b - a + 1) }, (_, i) => a + i); },

    juzOf(key) {
        const counts = MushafMeta.surahs.map(s => s[2]);
        const idx = (k) => { const [s, a] = k.split(':').map(Number); return OfflineAudioCore.globalIndex(counts, s, a); };
        const i = idx(key);
        let j = 0;
        MushafMeta.juzStart.forEach((k, n) => { if (idx(k) <= i) j = n + 1; });
        return j;
    },

    updateHeader(p, data) {
        const surahEl = document.getElementById('mrSurah');
        const subEl = document.getElementById('mrSub');
        if (!surahEl || !subEl) return;
        const firstKey = data ? MushafCore.verseKeys(data)[0] : MushafMeta.pageStart[p - 1];
        const lastKey = data ? MushafCore.verseKeys(data).slice(-1)[0] : firstKey;
        const s0 = Number(firstKey.split(':')[0]);
        const s1 = Number(lastKey.split(':')[0]);
        const names = [];
        for (let s = s0; s <= s1; s++) names.push(MushafMeta.surahs[s - 1][0]);
        surahEl.textContent = names.join(' · ');
        subEl.textContent = `الجزء ${this.getArabicNumber(this.juzOf(firstKey))} · صفحة ${this.getArabicNumber(p)}`;
        document.title = `${names[0]} — صفحة ${p} | القرآن الكريم`;
    },

    updateAvailability() {
        const el = document.getElementById('mrAvail');
        if (!el) return;
        const p = this.currentPage;
        let icon, text, cls;
        if (MushafStore.isDownloaded(p)) { icon = 'fa-circle-check'; text = 'محفوظة على الجهاز'; cls = 'is-local'; }
        else if (navigator.onLine === false) { icon = 'fa-wifi'; text = 'غير متصل'; cls = 'is-offline'; }
        else { icon = 'fa-cloud'; text = 'من الإنترنت'; cls = 'is-online'; }
        el.className = `mr-avail ${cls}`;
        el.innerHTML = `<i class="fas ${icon}" aria-hidden="true"></i><span>${text}</span>`;
        el.title = text;
    },

    /* ------------------------------------------------------ navigation */
    goToPage(pageNumber) {
        const page = parseInt(pageNumber, 10);
        if (page >= 1 && page <= this.totalPages) this.loadPage(page);
        else {
            App.showToast(`الرجاء إدخال رقم صفحة صحيح (1-${this.totalPages})`, 'error');
            const input = document.getElementById('mushafPageInput');
            if (input) input.value = this.currentPage;
        }
    },
    nextPage() { if (this.currentPage < this.totalPages) this.loadPage(this.currentPage + 1); },
    previousPage() { if (this.currentPage > 1) this.loadPage(this.currentPage - 1); },
    firstPage() { this.loadPage(1); },
    lastPage() { this.loadPage(this.totalPages); },

    setupSwipe(stage) {
        let start = null;
        stage.addEventListener('pointerdown', (e) => {
            if (e.pointerType !== 'touch' || !e.isPrimary) { start = null; return; }
            start = { x: e.clientX, y: e.clientY, t: Date.now() };
        });
        stage.addEventListener('pointercancel', () => { start = null; });
        stage.addEventListener('pointerup', (e) => {
            if (!start || e.pointerType !== 'touch') return;
            const dx = e.clientX - start.x, dy = e.clientY - start.y, dt = Date.now() - start.t;
            start = null;
            if (dt > 800 || Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
            if (window.visualViewport && window.visualViewport.scale > 1.05) return;   // user is zoomed in
            const sel = window.getSelection && window.getSelection();
            if (sel && !sel.isCollapsed) return;                                      // user is selecting
            if (e.target.closest('button, a, input, select, .mr-problem')) return;
            // Right-to-left book: swiping toward the right brings the next page.
            if (dx > 0) this.nextPage(); else this.previousPage();
        });
    },

    setupKeyboardControls() {
        if (this._kbBound) return;
        this._kbBound = true;
        document.addEventListener('keydown', (e) => {
            if (App.currentPage !== 'mushaf') return;
            if (e.target.closest && e.target.closest('input, textarea, select, button, [role="slider"], .modal')) return;
            if (e.ctrlKey || e.metaKey || e.altKey) return;
            switch (e.key) {
                case 'ArrowLeft': case 'PageDown': e.preventDefault(); this.nextPage(); break;
                case 'ArrowRight': case 'PageUp': e.preventDefault(); this.previousPage(); break;
                case 'Home': e.preventDefault(); this.firstPage(); break;
                case 'End': e.preventDefault(); this.lastPage(); break;
                case 'f': case 'F': e.preventDefault(); this.toggleFullscreen(); break;
            }
        });
    },

    /** Copy the Uthmani text of the selected words instead of the font's private glyph codes. */
    onCopy(e) {
        const sel = window.getSelection();
        if (!sel || sel.isCollapsed || !e.clipboardData) return;
        const words = [...document.querySelectorAll('#mrPage .mr-w[data-t]')].filter(w => sel.containsNode(w, true));
        if (!words.length) return;
        const text = words.map(w => w.classList.contains('mr-end') ? `(${w.dataset.t})` : w.dataset.t).join(' ');
        e.clipboardData.setData('text/plain', text);
        e.preventDefault();
    },

    /* ------------------------------------------------------ fullscreen */
    toggleFullscreen() {
        const root = document.getElementById('mushafReader');
        if (!root) return;
        if (document.fullscreenElement) { document.exitFullscreen(); return; }
        if (root.requestFullscreen) {
            root.requestFullscreen().catch(() => this.toggleFocusMode());
        } else {
            this.toggleFocusMode();     // e.g. iPhone Safari: no element fullscreen
        }
    },

    toggleFocusMode() {
        const on = !document.body.classList.contains('mr-focus');
        document.body.classList.toggle('mr-focus', on);
        document.getElementById('mushafReader').classList.toggle('mr-fullscreen', on);
        this.updateFullscreenButton();
        this.fitPage();
    },

    updateFullscreenButton() {
        const btn = document.querySelector('#mushafReader [data-act="fullscreen"]');
        if (!btn) return;
        const on = !!document.fullscreenElement || document.body.classList.contains('mr-focus');
        btn.querySelector('i').className = on ? 'fas fa-compress' : 'fas fa-expand';
        btn.setAttribute('aria-label', on ? 'الخروج من ملء الشاشة' : 'ملء الشاشة');
    },

    /* ------------------------------------------------------- bookmarks */
    getBookmarks() {
        try {
            const b = JSON.parse(localStorage.getItem('mushaf_bookmarks') || '[]');
            return Array.isArray(b) ? b.filter(x => Number.isInteger(x) && x >= 1 && x <= 604) : [];
        } catch (e) { return []; }
    },

    setBookmarks(list) {
        localStorage.setItem('mushaf_bookmarks', JSON.stringify([...new Set(list)].sort((a, b) => a - b)));
        this.updateBookmarkButton();
    },

    toggleBookmark(pageNumber) {
        pageNumber = Number(pageNumber);
        const list = this.getBookmarks();
        if (list.includes(pageNumber)) {
            this.setBookmarks(list.filter(x => x !== pageNumber));
            App.showToast('تمت إزالة العلامة المرجعية', 'success');
        } else {
            this.setBookmarks([...list, pageNumber]);
            App.showToast('تمت إضافة العلامة المرجعية', 'success');
        }
    },

    removeBookmark(pageNumber) {
        this.setBookmarks(this.getBookmarks().filter(x => x !== Number(pageNumber)));
        if (document.getElementById('navigationModal')) this.switchNavigationTab('bookmarks');
        App.showToast('تمت إزالة العلامة المرجعية', 'success');
    },

    updateBookmarkButton() {
        const btn = document.getElementById('mrBookmark');
        if (!btn) return;
        const on = this.getBookmarks().includes(this.currentPage);
        btn.setAttribute('aria-pressed', String(on));
        btn.setAttribute('aria-label', on ? 'إزالة العلامة' : 'إضافة علامة');
        btn.querySelector('i').className = on ? 'fas fa-bookmark' : 'far fa-bookmark';
    },

    /* ----------------------------------------------------------- panels */
    /** Small accessible dialog used by the index, download and settings panels. */
    openPanel(id, title, bodyHtml, onReady) {
        const old = document.getElementById(id);
        if (old) old.remove();
        const opener = document.activeElement;
        const modal = document.createElement('div');
        modal.className = 'modal active mr-panel';
        modal.id = id;
        modal.innerHTML = `
            <div class="modal-backdrop" data-close></div>
            <div class="modal-content" role="dialog" aria-modal="true" aria-labelledby="${id}Title">
                <div class="mr-panel-head">
                    <h3 id="${id}Title">${title}</h3>
                    <button type="button" class="btn-icon" data-close aria-label="إغلاق"><i class="fas fa-times" aria-hidden="true"></i></button>
                </div>
                <div class="mr-panel-body">${bodyHtml}</div>
            </div>`;
        const close = () => {
            modal.remove();
            document.removeEventListener('keydown', onKey, true);
            if (opener && opener.focus) opener.focus();
        };
        const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
        modal.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) close(); });
        document.addEventListener('keydown', onKey, true);
        (document.fullscreenElement || document.body).appendChild(modal);
        modal.close = close;
        if (onReady) onReady(modal, close);
        const focusable = modal.querySelector('.mr-panel-body button, .mr-panel-body input, .mr-panel-body select') || modal.querySelector('[data-close]');
        if (focusable) focusable.focus();
        return modal;
    },

    showNavigationMenu() {
        const bm = this.getBookmarks();
        const body = `
            <div class="mr-tabs" role="tablist">
                <button type="button" class="mr-tab active" role="tab" data-tab="surahs" aria-selected="true">السور</button>
                <button type="button" class="mr-tab" role="tab" data-tab="juz" aria-selected="false">الأجزاء</button>
                <button type="button" class="mr-tab" role="tab" data-tab="bookmarks" aria-selected="false">العلامات (${this.getArabicNumber(bm.length)})</button>
                <button type="button" class="mr-tab" role="tab" data-tab="goto" aria-selected="false">انتقال مباشر</button>
            </div>
            <div id="navigationTabContent" class="mr-tab-content" role="tabpanel"></div>`;
        this.openPanel('navigationModal', '<i class="fas fa-compass" aria-hidden="true"></i> التنقل في المصحف', body, (modal, close) => {
            modal.addEventListener('click', (e) => {
                const tab = e.target.closest('[data-tab]');
                if (tab) { this.switchNavigationTab(tab.dataset.tab); return; }
                const go = e.target.closest('[data-goto]');
                if (go) { close(); this.loadPage(Number(go.dataset.goto)); return; }
                const rm = e.target.closest('[data-remove-bm]');
                if (rm) this.removeBookmark(Number(rm.dataset.removeBm));
            });
            this.switchNavigationTab('surahs');
        });
    },

    switchNavigationTab(tabName) {
        const modal = document.getElementById('navigationModal');
        if (!modal) return;
        modal.querySelectorAll('.mr-tab').forEach(t => {
            const on = t.dataset.tab === tabName;
            t.classList.toggle('active', on);
            t.setAttribute('aria-selected', String(on));
        });
        const content = document.getElementById('navigationTabContent');
        const n = (x) => this.getArabicNumber(x);
        const esc = QuranUtil.esc;
        const dl = (from, to) => { for (let p = from; p <= to; p++) if (!MushafStore.isDownloaded(p)) return false; return true; };
        if (tabName === 'surahs') {
            content.innerHTML = `<div class="mr-list">${MushafMeta.surahs.map((s, i) => {
                const [start, end] = this.surahPages(i + 1);
                return `<button type="button" class="mr-item${start === this.currentPage ? ' is-current' : ''}" data-goto="${start}">
                    <span class="mr-item-num">${n(i + 1)}</span>
                    <span class="mr-item-main"><span class="arabic-text">${esc(s[0])}</span><small>${esc(s[1])} · ${n(s[2])} آية</small></span>
                    <span class="mr-item-meta">ص ${n(start)}${dl(start, end) ? ' <i class="fas fa-circle-check" title="محمّلة" aria-label="محمّلة"></i>' : ''}</span>
                </button>`;
            }).join('')}</div>`;
        } else if (tabName === 'juz') {
            content.innerHTML = `<div class="mr-grid">${MushafMeta.juzStartPage.map((start, i) => {
                const [, end] = this.juzPages(i + 1);
                return `<button type="button" class="mr-juz" data-goto="${start}">
                    <strong>الجزء ${n(i + 1)}</strong><small>صفحة ${n(start)}${dl(start, end) ? ' · محمّل' : ''}</small></button>`;
            }).join('')}</div>`;
        } else if (tabName === 'bookmarks') {
            const bm = this.getBookmarks();
            content.innerHTML = bm.length ? `<div class="mr-grid">${bm.map(p => `
                <div class="mr-bm">
                    <button type="button" class="mr-juz" data-goto="${p}"><strong>صفحة ${n(p)}</strong>
                        <small>${esc(MushafMeta.surahs[Number(MushafMeta.pageStart[p - 1].split(':')[0]) - 1][0])}</small></button>
                    <button type="button" class="mr-bm-remove" data-remove-bm="${p}" aria-label="إزالة علامة الصفحة ${n(p)}"><i class="fas fa-times" aria-hidden="true"></i></button>
                </div>`).join('')}</div>`
                : '<p class="mr-empty">لا توجد علامات بعد. استخدم زر <i class="far fa-bookmark" aria-hidden="true"></i> في شريط المصحف لحفظ صفحة.</p>';
        } else {
            content.innerHTML = `
                <form class="mr-goto" id="mrGotoForm">
                    <label for="gotoPageInput">رقم الصفحة (١ – ٦٠٤)</label>
                    <input type="number" id="gotoPageInput" min="1" max="604" inputmode="numeric" required value="${this.currentPage}">
                    <button type="submit" class="btn btn-primary">انتقل</button>
                </form>`;
            const form = document.getElementById('mrGotoForm');
            form.addEventListener('submit', (e) => { e.preventDefault(); this.gotoPageFromInput(); });
            const input = document.getElementById('gotoPageInput');
            input.focus(); input.select();
        }
    },

    gotoPageFromInput() {
        const input = document.getElementById('gotoPageInput');
        const pageNum = input ? parseInt(input.value, 10) : NaN;
        if (pageNum >= 1 && pageNum <= 604) this.goToPageFromNav(pageNum);
        else App.showToast('الرجاء إدخال رقم صفحة صحيح (1-604)', 'error');
    },

    goToPageFromNav(pageNumber) {
        const modal = document.getElementById('navigationModal');
        if (modal) modal.close ? modal.close() : modal.remove();
        this.loadPage(pageNumber);
    },

    goToSurahPage(surahNumber) { this.goToPageFromNav(MushafMeta.surahStartPage[surahNumber - 1]); },
    goToJuzPage(juzNumber) { this.goToPageFromNav(MushafMeta.juzStartPage[juzNumber - 1]); },

    showDownloadSheet() {
        const p = this.currentPage;
        const juz = this.juzOf(MushafMeta.pageStart[p - 1]);
        const range = (a, b) => this.pageRange(a, b);
        const mb = (pages) => Downloads.formatBytes(MushafStore.estimate(pages));
        const n = (x) => this.getArabicNumber(x);
        const pageDone = MushafStore.isDownloaded(p);
        const juzPages = range(...this.juzPages(juz));
        const juzLeft = juzPages.filter(x => !MushafStore.isDownloaded(x)).length;
        const body = `
            <p class="mr-note">تُحفظ الصفحات داخل المتصفح على هذا الجهاز لتقرأها دون اتصال. ${navigator.onLine === false ? '<strong>أنت غير متصل الآن؛ يلزم الاتصال للتنزيل.</strong>' : ''}</p>
            <div class="mr-dl-options">
                <button type="button" class="btn btn-secondary" data-dl="page" ${pageDone ? 'disabled' : ''}>
                    ${pageDone ? '<i class="fas fa-circle-check" aria-hidden="true"></i> هذه الصفحة محفوظة' : `<i class="fas fa-download" aria-hidden="true"></i> هذه الصفحة (${n(p)}) — ${mb([p])}`}</button>
                <button type="button" class="btn btn-secondary" data-dl="juz" ${juzLeft ? '' : 'disabled'}>
                    ${juzLeft ? `<i class="fas fa-download" aria-hidden="true"></i> الجزء ${n(juz)} (${n(juzLeft)} صفحة متبقية) — ${mb(juzPages)}` : `<i class="fas fa-circle-check" aria-hidden="true"></i> الجزء ${n(juz)} محفوظ`}</button>
                <button type="button" class="btn btn-primary" data-dl="all">
                    <i class="fas fa-book-quran" aria-hidden="true"></i> المصحف كاملًا — ${mb(range(1, 604))}</button>
                <button type="button" class="btn btn-secondary" data-act-open="downloads">
                    <i class="fas fa-folder-open" aria-hidden="true"></i> إدارة التنزيلات (نطاق صفحات، حذف…)</button>
            </div>`;
        this.openPanel('mushafDownloadPanel', 'تنزيل المصحف للقراءة دون اتصال', body, (modal, close) => {
            modal.addEventListener('click', (e) => {
                const b = e.target.closest('[data-dl]');
                if (b) {
                    close();
                    const pages = b.dataset.dl === 'page' ? [p] : b.dataset.dl === 'juz' ? juzPages : range(1, 604);
                    Downloads.startMushaf(pages, b.dataset.dl === 'all' ? 'المصحف كاملًا' : b.dataset.dl === 'juz' ? `الجزء ${n(juz)}` : `الصفحة ${n(p)}`);
                    return;
                }
                if (e.target.closest('[data-act-open]')) { close(); App.navigateToPage('downloads'); }
            });
        });
    },

    showSettings() {
        const opt = (name, value, label) =>
            `<label class="mr-radio"><input type="radio" name="${name}" value="${value}" ${this.prefs[name] === value ? 'checked' : ''}> ${label}</label>`;
        const chk = (name, label) =>
            `<label class="mr-check"><input type="checkbox" name="${name}" ${this.prefs[name] ? 'checked' : ''}> ${label}</label>`;
        const body = `
            <fieldset class="mr-field"><legend>حجم الصفحة</legend>
                ${opt('fit', 'screen', 'ملاءمة الشاشة (الصفحة كاملة ظاهرة)')}
                ${opt('fit', 'width', 'ملء العرض (للقراءة بالتمرير)')}
            </fieldset>
            <fieldset class="mr-field"><legend>لون الصفحة</legend>
                ${opt('tone', 'auto', 'تلقائي حسب سمة التطبيق')}
                ${opt('tone', 'cream', 'كريمي')}
                ${opt('tone', 'white', 'أبيض')}
                ${opt('tone', 'dark', 'داكن')}
            </fieldset>
            <fieldset class="mr-field"><legend>العرض</legend>
                ${chk('playbar', 'إظهار شريط التشغيل فوق الصفحة')}
                ${chk('highlight', 'تمييز الآية الجارية أثناء التلاوة')}
            </fieldset>`;
        this.openPanel('mushafSettingsPanel', 'إعدادات القراءة', body, (modal) => {
            modal.addEventListener('change', (e) => {
                const t = e.target;
                if (t.type === 'radio') this.prefs[t.name] = t.value;
                else if (t.type === 'checkbox') this.prefs[t.name] = t.checked;
                this.savePrefs();
            });
        });
    },

    getArabicNumber(num) {
        return QuranUtil.toArabicDigits(num);
    }
};

window.DigitalMushaf = DigitalMushaf;
