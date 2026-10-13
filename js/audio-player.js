/**
 * Audio Player — playback engine.
 *
 * One <audio> element, one authoritative state (PlaybackStore), one queue (PlayerState.queue).
 * The engine never touches the reader; views subscribe to PlaybackStore, so navigating between
 * screens cannot restart or duplicate playback.
 *
 * Audio source: the API publishes one MP3 per ayah, so every queue item (Surah / page / Juz)
 * is played as a sequence of ayah files. Verse-level sync is therefore exact — no timing is estimated.
 */

const AudioPlayer = {
    audio: null,
    nextAudio: null,           // preloads only the next ayah file
    ayahs: [],                 // resolved, playable ayahs of the current queue item
    ayahIndex: 0,
    loadedItemId: null,        // queue entry that `ayahs` belongs to
    loadToken: 0,              // bumped on every (re)load; stale async results are dropped
    ayahSerial: 0,             // identifies the ayah being played; de-duplicates 'ended'
    endedSerial: -1,
    switching: false,          // true while src is being swapped (ignore spurious 'pause')
    pendingSeek: null,
    retried: false,
    failures: 0,               // consecutive unplayable items (prevents skip loops)
    repeatsDone: 0,
    lastResumeSave: 0,
    currentReciter: 'ar.alafasy',

    reciters: [
        { id: 'ar.alafasy', name: 'مشاري راشد العفاسي', nameEn: 'Mishary Rashid Alafasy' },
        { id: 'ar.abdulbasitmurattal', name: 'عبد الباسط عبد الصمد', nameEn: 'Abdul Basit Abdul Samad' },
        { id: 'ar.minshawi', name: 'محمد صديق المنشاوي', nameEn: 'Mohamed Siddiq Al-Minshawi' },
        { id: 'ar.husary', name: 'محمود خليل الحصري', nameEn: 'Mahmoud Khalil Al-Hussary' },
        { id: 'ar.saadalghamadi', name: 'سعد الغامدي', nameEn: 'Saad Al-Ghamadi' },
        { id: 'ar.shaatree', name: 'أبو بكر الشاطري', nameEn: 'Abu Bakr Al-Shatri' },
        { id: 'ar.abdurrahmaansudais', name: 'عبد الرحمن السديس', nameEn: 'Abdurrahman As-Sudais' },
        { id: 'ar.mahermuaiqly', name: 'ماهر المعيقلي', nameEn: 'Maher Al-Muaiqly' }
    ],

    get queue() { return PlayerState.queue; },

    /* ------------------------------------------------------------ init */
    init() {
        PlayerState.init();

        this.audio = new Audio();
        this.audio.preload = 'auto';
        this.nextAudio = new Audio();
        this.nextAudio.preload = 'auto';

        const saved = this.reciters.find(r => r.id === App.settings.defaultReciter);
        this.currentReciter = saved ? saved.id : 'ar.alafasy';
        this.audio.volume = PlayerState.prefs.volume;
        PlaybackStore.set({ reciter: this.currentReciter, volume: PlayerState.prefs.volume });

        this.setupEventListeners();
        this.setupAudioListeners();
        PlaybackStore.subscribe((state, keys) => this.render(state, keys));

        // Restore the previous session as "ready to resume" — never auto-start sound.
        const current = this.queue.current;
        if (current) {
            PlaybackStore.set({ status: 'paused', itemId: current.id, kind: current.kind, ref: current.ref });
            this.showPlayer();
        }
        this.render(PlaybackStore.get(), ['status', 'queue', 'reciter', 'volume']);
        this.setupMediaSession();
    },

    /* ------------------------------------------------------- DOM events */
    setupEventListeners() {
        const on = (id, ev, fn) => { const el = document.getElementById(id); if (el) el.addEventListener(ev, fn); };

        on('playPauseBtn', 'click', () => this.togglePlayPause());
        on('prevBtn', 'click', () => this.playPrevious());
        on('nextBtn', 'click', () => this.playNext());
        on('shuffleBtn', 'click', () => this.setShuffle(!this.queue.shuffle));
        on('repeatBtn', 'click', () => this.cycleRepeat());
        on('repeatCountSelect', 'change', (e) => this.setRepeatCount(e.target.value));
        on('volumeSlider', 'input', (e) => this.setVolume(e.target.value / 100));
        on('reciterBtn', 'click', () => this.showReciterModal());
        on('closeReciterModal', 'click', () => this.hideReciterModal());
        on('reciterBackdrop', 'click', () => this.hideReciterModal());
        on('queueBtn', 'click', () => App.navigateToPage('playlists'));
        on('locateBtn', 'click', () => QuranDisplay.jumpToPlaying());
        on('addToPlaylistBtn', 'click', () => {
            const s = PlaybackStore.get();
            if (s.surah) PlaylistsUI.addSurahToSelected(s.surah);
        });

        const progress = document.getElementById('audioProgress');
        if (progress) {
            progress.addEventListener('click', (e) => {
                const rect = progress.getBoundingClientRect();
                // The page is RTL: the bar fills from the right.
                const rtl = getComputedStyle(progress).direction === 'rtl';
                const x = rtl ? rect.right - e.clientX : e.clientX - rect.left;
                this.seek(x / rect.width);
            });
            progress.addEventListener('keydown', (e) => {
                const step = { ArrowLeft: -5, ArrowRight: 5, ArrowUp: 5, ArrowDown: -5 }[e.key];
                if (step === undefined) return;
                e.preventDefault();
                this.seekBy(step);
            });
        }

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') this.hideReciterModal();
        });
    },

    setupAudioListeners() {
        const a = this.audio;

        a.addEventListener('timeupdate', () => {
            PlaybackStore.set({ time: a.currentTime });
            this.saveResume();
        });
        const meta = () => {
            if (Number.isFinite(a.duration)) PlaybackStore.set({ duration: a.duration });
        };
        a.addEventListener('durationchange', meta);
        a.addEventListener('loadedmetadata', () => {
            this.switching = false;
            if (this.pendingSeek !== null) {
                const t = this.pendingSeek;
                this.pendingSeek = null;
                if (Number.isFinite(a.duration)) a.currentTime = Math.min(t, Math.max(0, a.duration - 0.25));
            }
            meta();
        });
        a.addEventListener('playing', () => {
            this.switching = false;
            this.failures = 0;
            PlaybackStore.set({ status: 'playing', message: '' });
        });
        a.addEventListener('waiting', () => {
            if (PlaybackStore.get().status === 'playing') PlaybackStore.set({ status: 'buffering' });
        });
        a.addEventListener('canplay', () => {
            if (PlaybackStore.get().status === 'buffering' && !a.paused) PlaybackStore.set({ status: 'playing' });
        });
        a.addEventListener('pause', () => {
            if (this.switching || a.ended) return;
            const st = PlaybackStore.get().status;
            if (st === 'playing' || st === 'buffering') PlaybackStore.set({ status: 'paused' });
        });
        a.addEventListener('ended', () => {
            // Guard against a second 'ended' for the same ayah (e.g. rapid events/races).
            if (this.endedSerial === this.ayahSerial) return;
            this.endedSerial = this.ayahSerial;
            this.onAyahEnded();
        });
        a.addEventListener('error', () => this.onAudioFailure());
    },

    setupMediaSession() {
        if (!('mediaSession' in navigator)) return;
        const set = (name, fn) => { try { navigator.mediaSession.setActionHandler(name, fn); } catch (e) { /* unsupported */ } };
        set('play', () => this.play());
        set('pause', () => this.pause());
        set('nexttrack', () => this.playNext());
        set('previoustrack', () => this.playPrevious());
    },

    /* ------------------------------------------------------ loading */
    /** Fetch the ayahs of a queue item for a reciter. Only keeps entries with a valid https audio URL. */
    async resolveAyahs(item, reciter) {
        let data;
        if (item.kind === 'surah') data = await APIService.getSurah(item.ref, reciter);
        else if (item.kind === 'page') data = await APIService.getPage(item.ref, reciter);
        else data = await APIService.getJuz(item.ref, reciter);
        if (!data || !Array.isArray(data.ayahs)) throw new Error('Unexpected API response');
        return data.ayahs
            .map(a => ({
                surah: a.surah ? a.surah.number : data.number,
                numberInSurah: a.numberInSurah,
                text: typeof a.text === 'string' ? a.text : '',
                audio: typeof a.audio === 'string' && /^https:\/\//.test(a.audio) ? a.audio : null,
                page: a.page,
                juz: a.juz
            }))
            .filter(a => a.audio && Number.isInteger(a.surah) && Number.isInteger(a.numberInSurah));
    },

    /** Load and start the queue's current item. */
    async playItem(opts) {
        const { target = null, autoplay = true, resume = null } = opts || {};
        const item = this.queue.current;
        if (!item) return;

        const token = ++this.loadToken;
        this.repeatsDone = 0;
        this.halt();
        this.ayahs = [];
        this.loadedItemId = null;
        PlaybackStore.set({
            status: 'loading', itemId: item.id, kind: item.kind, ref: item.ref, message: '',
            time: 0, duration: 0, ayahText: '', ayahCount: 0, ayahIndex: 0
        });
        this.showPlayer();

        let list;
        try {
            list = await this.resolveAyahs(item, this.currentReciter);
        } catch (err) {
            if (token !== this.loadToken) return;
            console.error('Could not load audio list', err);
            return this.handleItemFailure(item, 'network');
        }
        if (token !== this.loadToken) return;          // a newer request superseded this one
        if (!list.length) return this.handleItemFailure(item, 'unavailable');

        this.ayahs = list;
        this.loadedItemId = item.id;

        let idx = 0;
        let seek = 0;
        const wanted = target || (resume && { surah: resume.surah, ayah: resume.ayah });
        if (wanted) {
            const f = list.findIndex(a => a.numberInSurah === Number(wanted.ayah) &&
                (wanted.surah == null || a.surah === Number(wanted.surah)));
            if (f >= 0) { idx = f; if (!target && resume) seek = resume.time; }
        }
        this.playIndex(idx, { autoplay, seek });
    },

    /** Play ayah #i of the loaded item. */
    playIndex(i, opts) {
        const { autoplay = true, seek = 0 } = opts || {};
        const a = this.ayahs[i];
        if (!a) return;
        this.ayahIndex = i;
        this.ayahSerial += 1;
        this.retried = false;
        this.switching = true;
        this.pendingSeek = seek > 0 ? seek : null;
        this.audio.src = a.audio;
        PlaybackStore.set({
            status: autoplay ? 'loading' : 'paused',
            surah: a.surah, ayah: a.numberInSurah, ayahIndex: i, ayahCount: this.ayahs.length,
            page: a.page, juz: a.juz, ayahText: a.text, audioSrc: a.audio,
            time: seek || 0, duration: 0, message: ''
        });
        if (autoplay) this.safePlay();
        this.preloadNext();
        this.saveResume(true);
    },

    preloadNext() {
        const n = this.ayahs[this.ayahIndex + 1];
        if (n) this.nextAudio.src = n.audio;
    },

    safePlay() {
        const p = this.audio.play();
        if (p && p.catch) {
            p.catch((err) => {
                if (err && err.name === 'AbortError') return;        // superseded by a newer src
                if (err && err.name === 'NotAllowedError') {
                    PlaybackStore.set({ status: 'paused', message: 'اضغط زر التشغيل للبدء' });
                    return;
                }
                this.onAudioFailure();
            });
        }
    },

    /** Stop sound and detach the source without raising an error event. */
    halt() {
        this.switching = true;
        this.audio.pause();
        this.audio.removeAttribute('src');
        this.audio.load();
    },

    /* ------------------------------------------------ end of ayah/item */
    onAyahEnded() {
        if (this.ayahIndex + 1 < this.ayahs.length) {
            this.playIndex(this.ayahIndex + 1, { autoplay: true });
            return;
        }
        this.onItemEnded();
    },

    onItemEnded() {
        const limit = PlayerState.prefs.repeatCount;     // 0 = repeat without limit
        if (this.queue.repeat === 'one') {
            this.repeatsDone += 1;
            if (limit === 0 || this.repeatsDone < limit) {
                if (limit > 0) App.showToast(`تكرار ${this.repeatsDone + 1} من ${limit}`, 'info');
                this.playIndex(0, { autoplay: true });
                return;
            }
            this.repeatsDone = 0;
        }
        this.goNext(true);
    },

    /** Advance the queue. `auto` = playback finished by itself. */
    goNext(auto) {
        const r = this.queue.advance({ natural: false });
        if (r.item) {
            PlayerState.touch(['queue']);
            this.playItem();
            return;
        }
        if (auto) this.finishQueue();
        else App.showToast('هذا آخر عنصر في القائمة', 'info');
    },

    finishQueue() {
        this.loadToken += 1;
        this.switching = true;
        this.audio.pause();
        PlayerState.resume = null;
        PlayerState.persist();
        PlaybackStore.set({ status: 'ended', time: 0, message: 'انتهى التشغيل' });
        App.showToast('انتهى التشغيل', 'success');
    },

    /* ------------------------------------------------------ failures */
    handleItemFailure(item, reason) {
        this.failures += 1;
        const name = PlayerState.label(item.kind, item.ref);
        const message = reason === 'network'
            ? `تعذر تحميل الصوت لـ ${name}. تحقق من الاتصال`
            : `لا يوجد تسجيل متاح لـ ${name} بصوت هذا القارئ`;
        App.showToast(message, 'error');

        if (this.failures < 5) {
            const before = item.id;
            const r = this.queue.advance({ natural: false });
            if (r.item && r.item.id !== before) {
                PlayerState.touch(['queue']);
                this.playItem();
                return;
            }
        }
        PlaybackStore.set({ status: 'error', message });
    },

    onAudioFailure() {
        if (!this.audio.getAttribute('src')) return;
        const serial = this.ayahSerial;
        if (!this.retried) {                       // one automatic retry (transient network errors)
            this.retried = true;
            const t = this.audio.currentTime || 0;
            PlaybackStore.set({ status: 'buffering' });
            setTimeout(() => {
                if (serial !== this.ayahSerial || PlaybackStore.get().status !== 'buffering') return;
                this.pendingSeek = t > 0 ? t : null;
                this.switching = true;
                this.audio.load();
                this.safePlay();
            }, 800);
            return;
        }
        const code = this.audio.error && this.audio.error.code;
        const message = code === 2 ? 'فشل تحميل الصوت. تحقق من اتصال الإنترنت'
            : code === 3 ? 'فشل فك تشفير ملف الصوت'
            : code === 4 ? 'تسجيل هذه الآية غير متوفر لهذا القارئ'
            : 'حدث خطأ في تشغيل الصوت';
        PlaybackStore.set({ status: 'error', message });
        App.showToast(message, 'error');
    },

    /* ------------------------------------------------------ transport */
    togglePlayPause() {
        const st = PlaybackStore.get().status;
        if (st === 'playing' || st === 'buffering') this.pause();
        else if (st === 'loading') { this.loadToken += 1; this.halt(); PlaybackStore.set({ status: 'paused' }); }
        else this.play();
    },

    play() {
        const item = this.queue.current;
        if (!item) { App.showToast('اختر سورة للتشغيل', 'info'); return; }
        const st = PlaybackStore.get().status;
        const loaded = this.loadedItemId === item.id && this.ayahs.length > 0;
        if (loaded && this.audio.getAttribute('src') && st !== 'ended' && st !== 'error') {
            this.safePlay();
        } else if (loaded) {
            const seek = st === 'error' ? (PlaybackStore.get().time || 0) : 0;
            this.playIndex(st === 'ended' ? 0 : this.ayahIndex, { autoplay: true, seek });
        } else {
            const r = PlayerState.resume;
            this.playItem({ resume: r && r.itemId === item.id ? r : null });
        }
    },

    pause() {
        this.audio.pause();
    },

    stop() {
        this.loadToken += 1;
        this.halt();
        this.ayahs = [];
        this.loadedItemId = null;
        PlaybackStore.set({ status: 'idle', time: 0, duration: 0, message: '' });
    },

    playNext() { this.goNext(false); },

    playPrevious() {
        const r = this.queue.previous();
        if (r.item) {
            PlayerState.touch(['queue']);
            this.playItem();
        } else if (this.loadedItemId && this.ayahs.length) {
            this.playIndex(0, { autoplay: true });   // first item: restart it
        }
    },

    seek(fraction) {
        if (!Number.isFinite(this.audio.duration)) return;
        this.audio.currentTime = Math.max(0, Math.min(1, fraction)) * this.audio.duration;
    },

    seekBy(seconds) {
        if (!Number.isFinite(this.audio.duration)) return;
        this.audio.currentTime = Math.max(0, Math.min(this.audio.duration, this.audio.currentTime + seconds));
    },

    setVolume(volume) {
        const v = Math.max(0, Math.min(1, volume));
        this.audio.volume = v;
        PlayerState.prefs.volume = v;
        PlaybackStore.set({ volume: v });
        PlayerState.persist();
    },

    /* ---------------------------------------------------- queue actions */
    playFullSurah(surah) { return this.playNow('surah', Number(surah)); },
    playFullJuz(juz) { return this.playNow('juz', Number(juz)); },
    playFullPage(page) { return this.playNow('page', Number(page)); },

    /** Play a Surah starting at a specific ayah (it then continues to the end of the Surah). */
    playAyah(surah, ayah) {
        if (!this.pushNow('surah', Number(surah))) return;
        return this.playItem({ target: { surah: Number(surah), ayah: Number(ayah) } });
    },

    playNow(kind, ref) {
        if (!this.pushNow(kind, ref)) return;
        return this.playItem();
    },

    pushNow(kind, ref) {
        try {
            this.queue.playNow(kind, ref);
        } catch (e) {
            App.showToast('عنصر غير صالح', 'error');
            return false;
        }
        PlayerState.touch(['queue']);
        return true;
    },

    playNextItem(kind, ref) { this.enqueue('playNext', kind, ref, 'سيُشغَّل بعد الحالي'); },
    addToQueue(kind, ref) { this.enqueue('addToQueue', kind, ref, 'أُضيف إلى الطابور'); },

    enqueue(method, kind, ref, text) {
        let result;
        try {
            result = this.queue[method](kind, ref);
        } catch (e) {
            App.showToast(e.message === 'Queue is full' ? 'الطابور ممتلئ' : 'عنصر غير صالح', 'error');
            return;
        }
        PlayerState.touch(['queue']);
        if (result.becameCurrent) this.playItem();
        else App.showToast(`${text}: ${PlayerState.label(kind, ref)}`, 'success');
    },

    /** Start a saved playlist (optionally from one of its items). Replaces the current queue. */
    playPlaylist(playlistId, startItemId) {
        const pl = PlayerState.playlists.get(playlistId);
        if (!pl || !pl.items.length) { App.showToast('القائمة فارغة', 'info'); return; }
        const entry = this.queue.startPlaylist(pl, startItemId);
        if (!entry) return;
        PlayerState.touch(['queue']);
        this.playItem();
    },

    skipToQueued(entryId) {
        if (this.queue.skipTo(entryId)) {
            PlayerState.touch(['queue']);
            this.playItem();
        }
    },

    removeQueued(entryId) { if (this.queue.removeUpcoming(entryId)) PlayerState.touch(['queue']); },
    moveQueued(entryId, delta) { if (this.queue.moveUpcoming(entryId, delta)) PlayerState.touch(['queue']); },
    reorderQueued(from, to) { if (this.queue.reorderUpcoming(from, to)) PlayerState.touch(['queue']); },

    clearUpcoming() {
        if (this.queue.clearUpcoming()) {
            PlayerState.touch(['queue']);
            App.showToast('تم مسح الطابور القادم', 'success');
        }
    },

    /** Remove the item that is playing; playback moves on, or stops if nothing is left. */
    removeCurrent() {
        const next = this.queue.removeCurrent();
        PlayerState.touch(['queue']);
        if (next) this.playItem();
        else {
            this.stop();
            PlaybackStore.set({ itemId: null, kind: null, ref: null, surah: null, ayah: null, ayahText: '', page: null, juz: null });
        }
    },

    setShuffle(on) {
        this.queue.setShuffle(on);
        PlayerState.touch(['queue']);
        App.showToast(on ? 'التشغيل العشوائي مفعّل' : 'التشغيل العشوائي متوقف', 'info');
    },

    cycleRepeat() {
        const order = ['off', 'all', 'one'];
        const next = order[(order.indexOf(this.queue.repeat) + 1) % order.length];
        this.queue.setRepeat(next);
        PlayerState.touch(['queue']);
        App.showToast({ off: 'إيقاف التكرار', all: 'تكرار القائمة كاملة', one: 'تكرار السورة الحالية' }[next], 'info');
    },

    /** 0 = repeat without limit (Repeat One only). */
    setRepeatCount(count) {
        const n = parseInt(count, 10);
        PlayerState.prefs.repeatCount = Number.isInteger(n) ? Math.max(0, Math.min(10, n)) : 0;
        this.repeatsDone = 0;
        PlayerState.touch(['queue']);
    },

    /* ---------------------------------------------------------- resume */
    saveResume(force) {
        const item = this.queue.current;
        if (!item || this.loadedItemId !== item.id) return;
        const now = Date.now();
        if (!force && now - this.lastResumeSave < 5000) return;
        this.lastResumeSave = now;
        const s = PlaybackStore.get();
        PlayerState.resume = { itemId: item.id, surah: s.surah, ayah: s.ayah, time: force ? 0 : Math.floor(this.audio.currentTime || 0) };
        PlayerState.persist();
    },

    /* ----------------------------------------------------------- render */
    render(state, keys) {
        const has = (...k) => k.some(x => keys.includes(x));
        const byId = (id) => document.getElementById(id);

        if (has('status', 'message')) {
            const busy = state.status === 'playing' || state.status === 'buffering';
            const btn = byId('playPauseBtn');
            if (btn) {
                const icon = btn.querySelector('i');
                if (icon) {
                    icon.className = state.status === 'loading' ? 'fas fa-spinner fa-spin' : (busy ? 'fas fa-pause' : 'fas fa-play');
                }
                const label = busy ? 'إيقاف مؤقت' : 'تشغيل';
                btn.title = label;
                btn.setAttribute('aria-label', label);
            }
            const status = byId('playerStatus');
            if (status) {
                status.textContent = state.status === 'loading' ? 'جارٍ التحميل…'
                    : state.status === 'buffering' ? 'جارٍ التخزين المؤقت…'
                    : (state.status === 'error' || state.status === 'ended') ? state.message : (state.message || '');
                status.classList.toggle('is-error', state.status === 'error');
            }
        }

        if (has('time', 'duration')) {
            const ok = Number.isFinite(state.duration) && state.duration > 0;
            const pct = ok ? Math.min(100, (state.time / state.duration) * 100) : 0;
            const bar = byId('audioProgressBar');
            if (bar) bar.style.width = `${pct}%`;
            const prog = byId('audioProgress');
            if (prog) {
                prog.setAttribute('aria-valuenow', String(Math.round(pct)));
                prog.setAttribute('aria-valuetext', `${App.formatTime(state.time || 0)} من ${ok ? App.formatTime(state.duration) : '0:00'}`);
            }
            const t = byId('currentTime');
            if (t) t.textContent = App.formatTime(state.time || 0);
            const d = byId('duration');
            if (d) d.textContent = ok ? App.formatTime(state.duration) : '0:00';
        }

        if (has('itemId', 'ayah', 'ayahText', 'ayahCount', 'queue', 'kind')) {
            const el = byId('currentAyahText');
            if (el) el.textContent = state.ayahText || '';       // textContent: never interpreted as HTML
            const cur = this.queue.current;
            const title = byId('nowTitle');
            if (title) {
                title.textContent = cur
                    ? `${PlayerState.label(cur.kind, cur.ref)}${state.ayah ? ` — آية ${QuranUtil.toArabicDigits(state.ayah)}${state.ayahCount ? ` / ${QuranUtil.toArabicDigits(state.ayahCount)}` : ''}` : ''}`
                    : '';
            }
            const nextUp = byId('nextUp');
            if (nextUp) {
                const nx = this.queue.upcoming[0];
                nextUp.textContent = nx ? `التالي: ${PlayerState.label(nx.kind, nx.ref)}` : '';
            }
            this.updateMediaSession(cur, state);
        }

        if (has('queue')) {
            const sh = byId('shuffleBtn');
            if (sh) {
                sh.classList.toggle('is-active', this.queue.shuffle);
                sh.setAttribute('aria-pressed', String(this.queue.shuffle));
            }
            const rp = byId('repeatBtn');
            if (rp) {
                const mode = this.queue.repeat;
                rp.classList.toggle('is-active', mode !== 'off');
                const icon = rp.querySelector('i');
                if (icon) icon.className = mode === 'one' ? 'fas fa-1' : 'fas fa-repeat';
                const label = { off: 'التكرار متوقف', all: 'تكرار القائمة كاملة', one: 'تكرار السورة الحالية' }[mode];
                rp.title = label;
                rp.setAttribute('aria-label', label);
                const cd = byId('repeatCountDisplay');
                const n = PlayerState.prefs.repeatCount;
                if (cd) cd.textContent = mode === 'one' && n > 0 ? `×${n}` : '';
            }
            const sel = byId('repeatCountSelect');
            if (sel) {
                sel.value = String(PlayerState.prefs.repeatCount);
                sel.disabled = this.queue.repeat !== 'one';
            }
        }

        if (has('volume')) {
            const v = byId('volumeSlider');
            if (v) v.value = String(Math.round(state.volume * 100));
        }

        if (has('reciter')) {
            const r = this.reciters.find(x => x.id === state.reciter);
            const el = byId('currentReciter');
            if (el && r) el.textContent = r.name;
        }
    },

    updateMediaSession(cur, state) {
        if (!('mediaSession' in navigator) || !cur || typeof MediaMetadata === 'undefined') return;
        const r = this.reciters.find(x => x.id === this.currentReciter);
        try {
            navigator.mediaSession.metadata = new MediaMetadata({
                title: PlayerState.label(cur.kind, cur.ref),
                artist: r ? r.name : '',
                album: 'القرآن الكريم'
            });
        } catch (e) { /* not critical */ }
    },

    /* ------------------------------------------------------------ views */
    showPlayer() {
        const c = document.getElementById('audioPlayerContainer');
        if (c) c.classList.remove('hidden');
        document.body.classList.add('has-player');
    },

    hidePlayer() {
        const c = document.getElementById('audioPlayerContainer');
        if (c) c.classList.add('hidden');
        document.body.classList.remove('has-player');
    },

    /* ----------------------------------------------------------- reciter */
    showReciterModal() {
        const modal = document.getElementById('reciterModal');
        const list = document.getElementById('reciterList');
        if (!modal || !list) return;
        list.innerHTML = '';
        this.reciters.forEach(reciter => {
            const item = document.createElement('button');
            item.type = 'button';
            item.className = 'card mb-4 reciter-option';
            const selected = this.currentReciter === reciter.id;
            item.setAttribute('aria-pressed', String(selected));
            item.innerHTML = `
                <span>
                    <span class="arabic-text reciter-name">${QuranUtil.esc(reciter.name)}</span>
                    <span class="reciter-name-en">${QuranUtil.esc(reciter.nameEn)}</span>
                </span>
                ${selected ? '<i class="fas fa-check" style="color: var(--color-success);" aria-hidden="true"></i>' : ''}`;
            item.addEventListener('click', () => this.selectReciter(reciter.id, reciter.name));
            list.appendChild(item);
        });
        modal.classList.add('active');
        const first = list.querySelector('button');
        if (first) first.focus();
    },

    hideReciterModal() {
        const modal = document.getElementById('reciterModal');
        if (modal) modal.classList.remove('active');
    },

    /**
     * Switch reciter. Availability is checked first; the user is told before an active
     * recording changes voice, and the current ayah/position is kept.
     */
    async selectReciter(reciterId, reciterName) {
        this.hideReciterModal();
        if (reciterId === this.currentReciter) return;

        const status = PlaybackStore.get().status;
        const item = this.queue.current;
        const live = item && this.loadedItemId === item.id && this.ayahs.length > 0;
        if (live && (status === 'playing' || status === 'buffering' || status === 'paused') &&
            !confirm(`سيتم تغيير القارئ إلى ${reciterName} ومتابعة التشغيل من الموضع الحالي. هل تريد المتابعة؟`)) {
            return;
        }

        let newList = null;
        if (item) {
            try {
                App.showLoading();
                newList = await this.resolveAyahs(item, reciterId);
            } catch (e) {
                App.hideLoading();
                App.showToast('تعذر التحقق من توفر هذا القارئ. حاول لاحقًا', 'error');
                return;
            }
            App.hideLoading();
            if (!newList.length) {
                App.showToast(`لا توجد تسجيلات متاحة لهذا العنصر بصوت ${reciterName}`, 'error');
                return;
            }
        }

        this.currentReciter = reciterId;
        App.settings.defaultReciter = reciterId;
        App.saveSettings();
        PlaybackStore.set({ reciter: reciterId });

        if (live && newList && item === this.queue.current) {
            const cur = this.ayahs[this.ayahIndex];
            const wasPlaying = status === 'playing' || status === 'buffering';
            const time = this.audio.currentTime || 0;
            const idx = newList.findIndex(a => cur && a.surah === cur.surah && a.numberInSurah === cur.numberInSurah);
            this.ayahs = newList;
            this.playIndex(idx >= 0 ? idx : 0, { autoplay: wasPlaying, seek: idx >= 0 ? time : 0 });
        }
        App.showToast(`تم اختيار ${reciterName}`, 'success');
    }
};

window.AudioPlayer = AudioPlayer;
