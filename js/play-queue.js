/**
 * PlayQueue — the listening-session queue (pure logic, no DOM, no audio).
 *
 * Model
 *   current   : the entry being played (or last played / restored, paused)
 *   upcoming  : entries that will play after `current`, in play order
 *   history   : entries already played, oldest first (used by Previous)
 *   source    : { type:'playlist', id, name } when the session was started from a saved playlist
 *
 * The queue is a *snapshot*: starting a playlist copies its items into the queue.
 * Editing or deleting the saved playlist afterwards never changes a running session.
 * Starting a different playlist replaces the whole queue (items of two playlists
 * are never silently mixed). Items the user adds by hand (Play Next / Add to Queue)
 * are tagged origin:'manual' and are interleaved with the remaining playlist items.
 *
 * Every entry has a stable id (not an index) and a `seq` number that remembers the
 * un-shuffled order, so turning Shuffle off restores the natural order of what is left.
 */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory();
    else root.PlayQueue = factory();
})(typeof self !== 'undefined' ? self : this, function () {
    const RANGES = { surah: [1, 114], page: [1, 604], juz: [1, 30] };
    const REPEAT_MODES = ['off', 'one', 'all'];
    const MAX_HISTORY = 200;
    const MAX_UPCOMING = 1000;
    let counter = 0;

    function uid(prefix) {
        counter += 1;
        return `${prefix}_${Date.now().toString(36)}${counter.toString(36)}${Math.random().toString(36).slice(2, 7)}`;
    }

    function isValidRef(kind, ref) {
        const r = RANGES[kind];
        return !!r && Number.isInteger(ref) && ref >= r[0] && ref <= r[1];
    }

    /** Validate untrusted data; returns a clean entry or null. */
    function sanitizeEntry(raw, fallbackSeq) {
        if (!raw || typeof raw !== 'object') return null;
        const ref = typeof raw.ref === 'string' ? parseInt(raw.ref, 10) : raw.ref;
        if (!isValidRef(raw.kind, ref)) return null;
        const id = typeof raw.id === 'string' && /^[\w-]{1,80}$/.test(raw.id) ? raw.id : uid('q');
        const seq = Number.isFinite(raw.seq) ? raw.seq : fallbackSeq;
        const sourceItemId = typeof raw.sourceItemId === 'string' && /^[\w-]{1,80}$/.test(raw.sourceItemId)
            ? raw.sourceItemId : null;
        return { id, kind: raw.kind, ref, origin: raw.origin === 'playlist' ? 'playlist' : 'manual', sourceItemId, seq };
    }

    class PlayQueue {
        constructor(options) {
            this.rng = (options && options.rng) || Math.random;
            this.current = null;
            this.upcoming = [];
            this.history = [];
            this.source = null;
            this.shuffle = false;
            this.repeat = 'off';
            this._seq = 0;
        }

        _entry(kind, ref, origin, sourceItemId) {
            if (!isValidRef(kind, ref)) throw new RangeError(`Invalid queue item ${kind}:${ref}`);
            this._seq += 1;
            return { id: uid('q'), kind, ref, origin: origin || 'manual', sourceItemId: sourceItemId || null, seq: this._seq };
        }

        _shuffled(list) {
            const a = list.slice();
            for (let i = a.length - 1; i > 0; i--) {
                const j = Math.floor(this.rng() * (i + 1));
                [a[i], a[j]] = [a[j], a[i]];
            }
            return a;
        }

        /** Replace the whole session with a saved playlist. Returns the entry to play, or null. */
        startPlaylist(playlist, startItemId) {
            const items = (playlist && playlist.items || []).filter(i => isValidRef(i.kind, i.ref));
            if (!items.length) return null;
            const entries = items.map(i => this._entry(i.kind, i.ref, 'playlist', i.id));
            this.source = { type: 'playlist', id: playlist.id, name: playlist.name };
            this.history = [];
            const startIdx = startItemId ? entries.findIndex(e => e.sourceItemId === startItemId) : -1;
            if (this.shuffle) {
                const first = startIdx >= 0 ? entries[startIdx] : null;
                const rest = this._shuffled(entries.filter(e => e !== first));
                this.current = first || rest.shift();
                this.upcoming = rest;
            } else {
                const from = startIdx >= 0 ? startIdx : 0;
                this.history = entries.slice(0, from);
                this.current = entries[from];
                this.upcoming = entries.slice(from + 1);
            }
            return this.current;
        }

        /** Interrupt with a new item; the rest of the queue continues afterwards. */
        playNow(kind, ref) {
            const entry = this._entry(kind, ref, 'manual');
            if (this.current) this._pushHistory(this.current);
            this.current = entry;
            return entry;
        }

        /** Insert right after the current item. If nothing is current it becomes current. */
        playNext(kind, ref) {
            const entry = this._entry(kind, ref, 'manual');
            if (!this.current) { this.current = entry; return { entry, becameCurrent: true }; }
            if (this.upcoming.length >= MAX_UPCOMING) throw new RangeError('Queue is full');
            entry.seq = (this.upcoming.length ? Math.min(...this.upcoming.map(e => e.seq)) : entry.seq) - 1;
            this.upcoming.unshift(entry);
            return { entry, becameCurrent: false };
        }

        /** Append to the end of the upcoming list. */
        addToQueue(kind, ref) {
            const entry = this._entry(kind, ref, 'manual');
            if (!this.current) { this.current = entry; return { entry, becameCurrent: true }; }
            if (this.upcoming.length >= MAX_UPCOMING) throw new RangeError('Queue is full');
            this.upcoming.push(entry);
            return { entry, becameCurrent: false };
        }

        removeUpcoming(id) {
            const idx = this.upcoming.findIndex(e => e.id === id);
            if (idx < 0) return false;
            this.upcoming.splice(idx, 1);
            return true;
        }

        moveUpcoming(id, delta) {
            const idx = this.upcoming.findIndex(e => e.id === id);
            return idx < 0 ? false : this.reorderUpcoming(idx, idx + delta);
        }

        reorderUpcoming(from, to) {
            const n = this.upcoming.length;
            if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || from >= n || to < 0 || to >= n) return false;
            if (from === to) return true;
            const [e] = this.upcoming.splice(from, 1);
            this.upcoming.splice(to, 0, e);
            // The user's explicit order becomes the "natural" order for later un-shuffling.
            const base = this._seq;
            this.upcoming.forEach((x, i) => { x.seq = base + i + 1; });
            this._seq = base + n;
            return true;
        }

        /** Remove future items only; the current item is untouched. */
        clearUpcoming() {
            const had = this.upcoming.length;
            this.upcoming = [];
            return had;
        }

        /** Jump to a queued item; skipped items are moved to history. */
        skipTo(id) {
            const idx = this.upcoming.findIndex(e => e.id === id);
            if (idx < 0) return null;
            const skipped = this.upcoming.splice(0, idx);
            const [target] = this.upcoming.splice(0, 1);
            if (this.current) this._pushHistory(this.current);
            skipped.forEach(e => this._pushHistory(e));
            this.current = target;
            return target;
        }

        /**
         * Move to the next item.
         * natural:true  → the current item finished by itself (Repeat One replays it).
         * natural:false → user pressed Next / a failure skipped the item.
         * Returns { item, replay?, looped?, finished? }.
         */
        advance(opts) {
            const natural = !!(opts && opts.natural);
            if (natural && this.repeat === 'one' && this.current) return { item: this.current, replay: true };
            if (this.upcoming.length) {
                if (this.current) this._pushHistory(this.current);
                this.current = this.upcoming.shift();
                return { item: this.current };
            }
            if (this.repeat === 'all' && this.current) {
                const loop = [...this.history, this.current];
                const ordered = this.shuffle ? this._shuffled(loop) : loop.slice().sort((a, b) => a.seq - b.seq);
                this.history = [];
                this.current = ordered[0];
                this.upcoming = ordered.slice(1);
                return { item: this.current, looped: true };
            }
            return { item: null, finished: true };
        }

        /** Go back one item. Returns { item } or { item:null } when there is no history. */
        previous() {
            if (!this.history.length) return { item: null };
            if (this.current) this.upcoming.unshift(this.current);
            this.current = this.history.pop();
            return { item: this.current };
        }

        /** Drop the current item (e.g. user removed it while playing) and move on. */
        removeCurrent() {
            this.current = this.upcoming.length ? this.upcoming.shift() : null;
            return this.current;
        }

        setShuffle(on) {
            on = !!on;
            if (on === this.shuffle) return;
            this.shuffle = on;
            this.upcoming = on ? this._shuffled(this.upcoming) : this.upcoming.slice().sort((a, b) => a.seq - b.seq);
        }

        setRepeat(mode) {
            if (!REPEAT_MODES.includes(mode)) throw new RangeError(`Invalid repeat mode ${mode}`);
            this.repeat = mode;
        }

        _pushHistory(entry) {
            this.history.push(entry);
            if (this.history.length > MAX_HISTORY) this.history.shift();
        }

        snapshot() {
            return {
                current: this.current,
                upcoming: this.upcoming,
                history: this.history.slice(-50),
                source: this.source,
                shuffle: this.shuffle,
                repeat: this.repeat
            };
        }

        /** Restore from untrusted persisted data; anything invalid is dropped. */
        restore(raw) {
            if (!raw || typeof raw !== 'object') return;
            const seen = new Set();
            const clean = (list) => (Array.isArray(list) ? list : [])
                .map((e, i) => sanitizeEntry(e, i))
                .filter(e => e && !seen.has(e.id) && seen.add(e.id));
            this.current = sanitizeEntry(raw.current, 0);
            if (this.current) seen.add(this.current.id);
            this.upcoming = clean(raw.upcoming).slice(0, MAX_UPCOMING);
            this.history = clean(raw.history).slice(-50);
            this.shuffle = !!raw.shuffle;
            this.repeat = REPEAT_MODES.includes(raw.repeat) ? raw.repeat : 'off';
            const s = raw.source;
            this.source = s && s.type === 'playlist' && typeof s.id === 'string' && typeof s.name === 'string'
                ? { type: 'playlist', id: s.id.slice(0, 80), name: s.name.slice(0, 60) } : null;
            const all = [this.current, ...this.upcoming, ...this.history].filter(Boolean);
            this._seq = all.reduce((m, e) => Math.max(m, e.seq), 0);
        }
    }

    PlayQueue.isValidRef = isValidRef;
    PlayQueue.sanitizeEntry = sanitizeEntry;
    PlayQueue.uid = uid;
    return PlayQueue;
});
