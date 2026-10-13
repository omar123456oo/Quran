/**
 * PlaybackStore  — the single authoritative playback context (pub/sub).
 * PlayerStorage  — versioned, validated localStorage persistence.
 * PlayerState    — wires the queue, saved playlists and preferences together.
 *
 * Playback position (what is being heard) and reading position (what the user is
 * looking at) are kept in separate slices so one never overwrites the other.
 */
(function (root) {
    const esc = (value) => String(value == null ? '' : value)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

    const toArabicDigits = (n) => String(n).replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[d]);

    /* ---------------------------------------------------------------- store */
    const PlaybackStore = {
        state: {
            status: 'idle',      // idle | loading | buffering | playing | paused | ended | error
            itemId: null,        // queue entry id
            kind: null, ref: null,
            surah: null, ayah: null, ayahIndex: 0, ayahCount: 0,
            page: null, juz: null,
            reciter: 'ar.alafasy',
            audioSrc: null,
            time: 0, duration: 0,
            volume: 0.8,
            message: ''
        },
        reading: { surah: null, ayah: null, page: null },
        listeners: new Set(),

        get() { return this.state; },

        /** Merge a patch; subscribers receive (state, changedKeys). */
        set(patch) {
            const changed = [];
            for (const k of Object.keys(patch)) {
                if (this.state[k] !== patch[k]) { this.state[k] = patch[k]; changed.push(k); }
            }
            if (changed.length) this.emit(changed);
        },

        setReading(patch) {
            const changed = [];
            for (const k of Object.keys(patch)) {
                if (this.reading[k] !== patch[k]) { this.reading[k] = patch[k]; changed.push('reading'); }
            }
            if (changed.length) this.emit(['reading']);
        },

        /** Signal a change that is not part of `state` (e.g. 'queue', 'playlists', 'meta'). */
        emit(keys) {
            this.listeners.forEach(fn => {
                try { fn(this.state, keys); } catch (e) { console.error('PlaybackStore listener failed', e); }
            });
        },

        subscribe(fn) {
            this.listeners.add(fn);
            return () => this.listeners.delete(fn);
        }
    };

    /* -------------------------------------------------------------- storage */
    const PlayerStorage = {
        KEY: 'quran_player_v1',
        VERSION: 1,
        _timer: null,
        _pending: null,

        load() {
            try {
                const raw = localStorage.getItem(this.KEY);
                if (!raw) return null;
                const data = JSON.parse(raw);
                if (!data || typeof data !== 'object' || data.version !== this.VERSION) return null;
                return data;
            } catch (e) {
                console.warn('Player data unreadable, starting fresh', e);
                return null;
            }
        },

        /** Debounced write; storage failures never break playback. */
        save(getData) {
            this._pending = getData;
            if (this._timer) return;
            this._timer = setTimeout(() => this.flush(), 400);
        },

        flush() {
            clearTimeout(this._timer);
            this._timer = null;
            if (!this._pending) return;
            const getData = this._pending;
            this._pending = null;
            try {
                localStorage.setItem(this.KEY, JSON.stringify(Object.assign({ version: this.VERSION }, getData())));
            } catch (e) {
                console.warn('Could not save player data', e);
                if (!this._warned && root.App) { this._warned = true; App.showToast('تعذر حفظ قوائم التشغيل على هذا الجهاز', 'error'); }
            }
        }
    };

    /* ---------------------------------------------------------------- state */
    const PlayerState = {
        queue: new root.PlayQueue(),
        playlists: new root.PlaylistStore(),
        prefs: { volume: 0.8, repeatCount: 0, followPlayback: true },
        resume: null,   // { itemId, ayah, time } — restored only for the same queue entry

        init() {
            const data = PlayerStorage.load();
            if (data) {
                this.playlists.restore(data.playlists);
                this.queue.restore(data.queue);
                const p = data.prefs || {};
                if (typeof p.volume === 'number' && p.volume >= 0 && p.volume <= 1) this.prefs.volume = p.volume;
                if (Number.isInteger(p.repeatCount) && p.repeatCount >= 0 && p.repeatCount <= 10) this.prefs.repeatCount = p.repeatCount;
                if (typeof p.followPlayback === 'boolean') this.prefs.followPlayback = p.followPlayback;
                const r = data.resume;
                if (r && this.queue.current && r.itemId === this.queue.current.id &&
                    Number.isInteger(r.ayah) && r.ayah > 0 && Number.isFinite(r.time) && r.time >= 0) {
                    this.resume = { itemId: r.itemId, surah: Number.isInteger(r.surah) ? r.surah : null, ayah: r.ayah, time: r.time };
                }
            }
            window.addEventListener('pagehide', () => PlayerStorage.flush());
        },

        persist() {
            PlayerStorage.save(() => ({
                playlists: this.playlists.snapshot(),
                queue: this.queue.snapshot(),
                prefs: this.prefs,
                resume: this.resume
            }));
        },

        /** Notify the UI that the queue and/or playlists changed, then persist. */
        touch(what) {
            PlaybackStore.emit(what || ['queue']);
            this.persist();
        },

        /** Human label for a queue/playlist item. Names come from the loaded Surah list. */
        label(kind, ref) {
            if (kind === 'surah') {
                const s = root.QuranDisplay && QuranDisplay.surahs && QuranDisplay.surahs.find(x => x.number === ref);
                return s ? s.name : `سورة ${toArabicDigits(ref)}`;
            }
            if (kind === 'page') return `صفحة ${toArabicDigits(ref)}`;
            if (kind === 'juz') return `الجزء ${toArabicDigits(ref)}`;
            return String(ref);
        }
    };

    root.PlaybackStore = PlaybackStore;
    root.PlayerStorage = PlayerStorage;
    root.PlayerState = PlayerState;
    root.QuranUtil = { esc, toArabicDigits };
})(window);
