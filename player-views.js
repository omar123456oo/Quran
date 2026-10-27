/**
 * Player views — presentation only. Playback state comes from PlaybackStore and every
 * action goes through AudioPlayer, so there is still exactly one <audio> element.
 *
 *   expanded  centred dialog with the playing verse; background blurred and inert
 *   compact   small floating player (default when minimised)
 *   docked    the original full control bar (#audioPlayerContainer), on request
 *
 * The verse shown is the ayah whose file is playing (one MP3 per ayah), never a guess
 * from elapsed time.
 */
const PlayerViews = {
    // Screens where starting playback opens the expanded player.
    EXPAND_ON: ['home', 'explore', 'revelation', 'article'],
    view: 'compact',
    expanded: false,
    autoOpenedFor: null,
    seeking: false,
    opener: null,

    init() {
        try {
            const v = localStorage.getItem('quran_player_view');
            if (v === 'compact' || v === 'docked') this.view = v;
        } catch (e) { /* default */ }
        this.build();
        PlaybackStore.subscribe((state, keys) => this.onState(state, keys));
        this.sync();
        this.render(PlaybackStore.get(), ['status', 'itemId', 'reciter', 'time', 'duration']);
    },

    build() {
        const n = document.createElement('div');
        n.innerHTML = `
            <div class="pv-overlay" id="pvOverlay" hidden></div>
            <div class="pv-expanded" id="pvExpanded" role="dialog" aria-modal="true" aria-labelledby="pvSurah" aria-describedby="pvAyah" hidden>
                <div class="pv-head">
                    <span class="pv-live" id="pvLive"><span class="pv-eq" aria-hidden="true"><i></i><i></i><i></i></span><span id="pvLiveText">يُتلى الآن</span></span>
                    <button type="button" class="pv-icon" data-pv="minimize" aria-label="تصغير المشغل" title="تصغير">
                        <i class="fas fa-chevron-down" aria-hidden="true"></i></button>
                </div>
                <div class="pv-art" id="pvArt" aria-hidden="true"><i class="fas fa-book-quran"></i></div>
                <h2 class="pv-surah" id="pvSurah"></h2>
                <button type="button" class="pv-reciter" data-pv="reciter" id="pvReciterBtn" title="تغيير القارئ">
                    <i class="fas fa-microphone" aria-hidden="true"></i>
                    <span id="pvReciter"></span>
                    <span class="sr-only">— تغيير القارئ</span>
                    <i class="fas fa-chevron-down pv-reciter-chev" aria-hidden="true"></i>
                </button>
                <div class="pv-verse">
                    <p class="pv-basmala" id="pvBasmala" lang="ar" dir="rtl" hidden></p>
                    <p class="pv-ayah" id="pvAyah" lang="ar" dir="rtl"></p>
                    <p class="pv-ref" id="pvRef"></p>
                </div>
                <div class="pv-progress">
                    <input type="range" id="pvSeek" min="0" max="1000" value="0" step="1" aria-label="موضع التشغيل في الآية">
                    <div class="pv-times"><span id="pvTime">0:00</span><span id="pvCount"></span><span id="pvDur">0:00</span></div>
                </div>
                <p class="pv-status" id="pvStatus" role="status" aria-live="polite"></p>
                <div class="pv-controls">
                    <button type="button" class="pv-icon pv-lg" data-pv="prev-ayah" aria-label="الآية السابقة" title="الآية السابقة">
                        <i class="fas fa-forward-step" aria-hidden="true"></i></button>
                    <button type="button" class="pv-play" data-pv="toggle" id="pvPlay" aria-label="تشغيل">
                        <i class="fas fa-play" aria-hidden="true"></i></button>
                    <button type="button" class="pv-icon pv-lg" data-pv="next-ayah" aria-label="الآية التالية" title="الآية التالية">
                        <i class="fas fa-backward-step" aria-hidden="true"></i></button>
                </div>
                <div class="pv-more">
                    <button type="button" class="pv-link" data-pv="locate"><i class="fas fa-book-open" aria-hidden="true"></i> عرض في القارئ</button>
                    <button type="button" class="pv-link" data-pv="docked"><i class="fas fa-sliders" aria-hidden="true"></i> عناصر التحكم الكاملة</button>
                </div>
            </div>
            <div class="pv-mini" id="pvMini" role="region" aria-label="المشغّل المصغّر" hidden>
                <button type="button" class="pv-mini-main" data-pv="expand" aria-label="فتح المشغّل الموسّع">
                    <span class="pv-thumb" aria-hidden="true"><i class="fas fa-book-quran"></i></span>
                    <span class="pv-mini-text"><span class="pv-mini-title" id="pvMiniTitle"></span><span class="pv-mini-sub" id="pvMiniSub"></span></span>
                </button>
                <button type="button" class="pv-icon" data-pv="toggle" id="pvMiniPlay" aria-label="تشغيل"><i class="fas fa-play" aria-hidden="true"></i></button>
                <button type="button" class="pv-icon pv-mic" data-pv="reciter" id="pvMiniReciter" aria-label="تغيير القارئ" title="تغيير القارئ"><i class="fas fa-microphone" aria-hidden="true"></i></button>
                <button type="button" class="pv-icon" data-pv="expand" aria-label="فتح المشغّل الموسّع" title="توسيع"><i class="fas fa-chevron-up" aria-hidden="true"></i></button>
                <button type="button" class="pv-icon" data-pv="close" aria-label="إيقاف التشغيل وإغلاق المشغّل" title="إيقاف وإغلاق"><i class="fas fa-xmark" aria-hidden="true"></i></button>
                <span class="pv-mini-bar" aria-hidden="true"><span id="pvMiniBar"></span></span>
            </div>`;
        while (n.firstElementChild) document.body.appendChild(n.firstElementChild);

        document.addEventListener('click', (e) => {
            const b = e.target.closest('[data-pv]');
            if (b) this.onAction(b.dataset.pv, b);
        });
        document.getElementById('pvOverlay').addEventListener('click', () => this.minimize());
        document.addEventListener('keydown', (e) => {
            // With the reciter list open on top, Escape closes only the list.
            const reciterOpen = document.getElementById('reciterModal')?.classList.contains('active');
            if (e.key === 'Escape' && this.expanded && !reciterOpen) { e.preventDefault(); this.minimize(); }
        }, true);   // capture: runs before the list's own Escape handler closes it
        const seek = document.getElementById('pvSeek');
        seek.addEventListener('input', () => { this.seeking = true; });
        seek.addEventListener('change', () => {
            AudioPlayer.seek(Number(seek.value) / 1000);
            this.seeking = false;
        });

        // Docked bar: secondary controls live in a "more" panel above the single line.
        const more = document.getElementById('apMore');
        const moreBtn = document.getElementById('apMoreBtn');
        if (more && moreBtn) {
            const setMore = (open) => {
                more.hidden = !open;
                moreBtn.setAttribute('aria-expanded', String(open));
                document.body.classList.toggle('player-more', open);
            };
            moreBtn.addEventListener('click', () => setMore(more.hidden));
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && !more.hidden && !this.expanded) setMore(false);
            });
        }
    },

    onAction(act, btn) {
        switch (act) {
            case 'toggle': AudioPlayer.togglePlayPause(); break;
            case 'prev-ayah': AudioPlayer.previousAyah(); break;
            case 'next-ayah': AudioPlayer.nextAyah(); break;
            case 'expand': this.open(btn); break;
            case 'minimize': this.minimize(); break;
            case 'close': this.closePlayer(); break;
            case 'locate': this.minimize(); QuranDisplay.jumpToPlaying(); break;
            case 'docked': this.setView('docked'); this.minimize(); break;
            case 'reciter': AudioPlayer.showReciterModal(btn); break;
            case 'compact': this.setView('compact'); break;
        }
    },

    /* ----------------------------------------------------- view state */
    setView(v) {
        this.view = v;
        try { localStorage.setItem('quran_player_view', v); } catch (e) { /* not critical */ }
        this.sync();
    },

    /** Apply view classes; called on every state change and by AudioPlayer.show/hidePlayer. */
    sync() {
        const visible = document.body.classList.contains('has-player');
        const compact = visible && this.view === 'compact';
        document.body.classList.toggle('player-compact', compact);
        const mini = document.getElementById('pvMini');
        if (mini) mini.hidden = !compact || this.expanded;
        if (!visible && this.expanded) this.minimize(true);
    },

    open(opener) {
        if (this.expanded || !document.body.classList.contains('has-player')) return;
        this.expanded = true;
        this.opener = opener || document.activeElement;
        const dlg = document.getElementById('pvExpanded');
        document.getElementById('pvOverlay').hidden = false;
        dlg.hidden = false;
        document.body.classList.add('player-expanded');
        // Background cannot be clicked or tabbed into while the dialog is open.
        ['header', 'main', '#audioPlayerContainer', '#offlineBanner', '#pvMini'].forEach(sel => {
            const el = document.querySelector(sel);
            if (el) el.inert = true;
        });
        this.sync();
        this.render(PlaybackStore.get(), Object.keys(PlaybackStore.get()));
        document.getElementById('pvPlay').focus();
    },

    minimize(silent) {
        if (!this.expanded) return;
        this.expanded = false;
        document.getElementById('pvExpanded').hidden = true;
        document.getElementById('pvOverlay').hidden = true;
        document.body.classList.remove('player-expanded');
        ['header', 'main', '#audioPlayerContainer', '#offlineBanner', '#pvMini'].forEach(sel => {
            const el = document.querySelector(sel);
            if (el) el.inert = false;
        });
        this.sync();
        if (silent) return;
        const back = this.view === 'compact' ? document.querySelector('#pvMini [data-pv="expand"]') : this.opener;
        if (back && back.isConnected && back.offsetParent !== null) back.focus();
    },

    /** Explicit user request: stop playback and hide the player. */
    closePlayer() {
        AudioPlayer.stop();
        AudioPlayer.hidePlayer();
        App.showToast('أُوقف التشغيل', 'info');
    },

    /* ----------------------------------------------------- rendering */
    onState(state, keys) {
        // Starting a new item while on the home screen opens the expanded player once.
        if (keys.includes('status') && state.status === 'playing' && state.itemId &&
            state.itemId !== this.autoOpenedFor && this.EXPAND_ON.includes(App.currentPage)) {
            this.autoOpenedFor = state.itemId;
            this.open();
        }
        if (keys.includes('itemId') && state.itemId !== this.autoOpenedFor && !this.EXPAND_ON.includes(App.currentPage)) {
            this.autoOpenedFor = state.itemId;     // started elsewhere: do not pop up later
        }
        this.render(state, keys);
    },

    surahName(n) { return n && MushafMeta.surahs[n - 1] ? MushafMeta.surahs[n - 1][0] : ''; },

    render(state, keys) {
        const has = (...k) => k.some(x => keys.includes(x));
        const $ = (id) => document.getElementById(id);
        const n = QuranUtil.toArabicDigits;
        const busy = state.status === 'playing' || state.status === 'buffering';
        const cur = AudioPlayer.queue.current;

        if (has('status', 'message')) {
            const icon = state.status === 'loading' ? 'fas fa-spinner fa-spin' : busy ? 'fas fa-pause' : 'fas fa-play';
            const label = busy ? 'إيقاف مؤقت' : 'تشغيل';
            ['pvPlay', 'pvMiniPlay'].forEach(id => {
                const b = $(id);
                if (!b) return;
                b.querySelector('i').className = icon;
                b.setAttribute('aria-label', label);
                b.title = label;
            });
            const live = $('pvLive');
            if (live) live.classList.toggle('is-playing', state.status === 'playing');
            const liveText = $('pvLiveText');
            if (liveText) liveText.textContent = state.status === 'playing' ? 'يُتلى الآن'
                : state.status === 'buffering' || state.status === 'loading' ? 'جارٍ التحميل…'
                : state.status === 'error' ? 'تعذر التشغيل' : state.status === 'ended' ? 'انتهت التلاوة' : 'متوقف مؤقتًا';
            const st = $('pvStatus');
            if (st) {
                st.textContent = state.message || '';
                st.classList.toggle('is-error', state.status === 'error');
            }
            const mini = $('pvMini');
            if (mini) mini.classList.toggle('is-playing', state.status === 'playing');
            const art = $('pvArt');
            if (art) art.classList.toggle('is-playing', state.status === 'playing');
        }

        if (has('itemId', 'surah', 'ayah', 'ayahText', 'ayahCount', 'ayahIndex', 'kind', 'reciter', 'queue', 'meta', 'status')) {
            const surahName = this.surahName(state.surah) || (cur ? PlayerState.label(cur.kind, cur.ref) : '');
            const itemLabel = cur && cur.kind !== 'surah' ? PlayerState.label(cur.kind, cur.ref) : '';
            const r = AudioPlayer.reciters.find(x => x.id === state.reciter);
            const whole = !state.ayah && state.surah && state.status !== 'idle';
            if ($('pvSurah')) $('pvSurah').textContent = surahName;
            if ($('pvReciter')) $('pvReciter').textContent = [r ? r.name : '', itemLabel].filter(Boolean).join(' · ');
            if ($('pvAyah')) {
                const part = QuranUtil.splitBasmala(state.surah, state.ayah, state.ayahText);
                $('pvAyah').textContent = whole ? 'تلاوة السورة كاملة في ملف واحد؛ لا يتوفر تحديد الآية لهذا القارئ.' : part.text;
                $('pvAyah').classList.toggle('is-note', !!whole);
                const bas = $('pvBasmala');
                if (bas) { bas.textContent = whole ? '' : (part.basmala || ''); bas.hidden = whole || !part.basmala; }
            }
            const total = state.surah && MushafMeta.surahs[state.surah - 1] ? MushafMeta.surahs[state.surah - 1][2] : 0;
            if ($('pvRef')) $('pvRef').textContent = state.ayah ? `${surahName} · الآية ${n(state.ayah)}${total ? ` من ${n(total)}` : ''}` : '';
            if ($('pvCount')) $('pvCount').textContent = state.ayahCount ? `${n(state.ayahIndex + 1)} / ${n(state.ayahCount)}` : '';
            if ($('pvMiniTitle')) $('pvMiniTitle').textContent = surahName || 'القرآن الكريم';
            if ($('pvMiniSub')) $('pvMiniSub').textContent = state.status === 'loading' ? 'جارٍ التحميل…'
                : state.status === 'error' ? 'تعذر التشغيل' : state.ayah ? `الآية ${n(state.ayah)}` : (r ? r.name : '');
            const step = AudioPlayer.canStepAyah();
            document.querySelectorAll('[data-pv="prev-ayah"]').forEach(b => { b.disabled = !step || state.ayahIndex <= 0; });
            document.querySelectorAll('[data-pv="next-ayah"]').forEach(b => { b.disabled = !step || state.ayahIndex >= state.ayahCount - 1; });
        }

        if (has('time', 'duration')) {
            const ok = Number.isFinite(state.duration) && state.duration > 0;
            const frac = ok ? Math.min(1, (state.time || 0) / state.duration) : 0;
            const seek = $('pvSeek');
            if (seek && !this.seeking) {
                seek.value = String(Math.round(frac * 1000));
                seek.setAttribute('aria-valuetext', `${App.formatTime(state.time || 0)} من ${ok ? App.formatTime(state.duration) : '0:00'}`);
            }
            if (seek) seek.disabled = !ok;
            if ($('pvTime')) $('pvTime').textContent = App.formatTime(state.time || 0);
            if ($('pvDur')) $('pvDur').textContent = ok ? App.formatTime(state.duration) : '0:00';
            if ($('pvMiniBar')) $('pvMiniBar').style.width = `${(frac * 100).toFixed(1)}%`;
        }
    }
};

window.PlayerViews = PlayerViews;
