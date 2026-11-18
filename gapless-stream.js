/**
 * Gapless stream — continuous playback of consecutive per-ayah MP3 files through ONE media
 * pipeline (Media Source Extensions), used by AudioPlayer in Full Surah mode.
 *
 * Why it exists (measured, see docs/GAPLESS_PLAYBACK.md):
 *   - Playing every ayah file in its own media pipeline — even one already buffered in a standby
 *     <audio> and started on 'ended' — leaves 110–175 ms of digital silence at every boundary
 *     (end-of-file detection + pipeline start), on every reciter.
 *   - Most reciters' ayah files are cut out of one continuous MP3 stream without gapless metadata
 *     (bit reservoir continues across the cut). Decoded on their own, each file starts with
 *     13–39 ms of decoder priming silence that is not in the recording.
 * Appending the files back to back into one SourceBuffer restores the original stream: the
 * decoder runs continuously and nothing is inserted. Files that do carry a LAME/Info header
 * (encoder delay + padding) are trimmed to their exact audio with appendWindow — only the
 * encoder's own padding samples are removed. Recitation audio and its natural pauses are never
 * altered or shortened; the bytes are the published files.
 */
(function (root) {
    /* ------------------------------------------------------------ MP3 parsing (pure) */
    const BR_V1 = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320];
    const BR_V2 = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160];
    const SR = { 3: [44100, 48000, 32000], 2: [22050, 24000, 16000], 0: [11025, 12000, 8000] };

    /** MPEG audio Layer III frame header at offset o, or null. */
    function frameHeader(u, o) {
        if (o + 4 > u.length || u[o] !== 0xFF || (u[o + 1] & 0xE0) !== 0xE0) return null;
        const v = (u[o + 1] >> 3) & 3, layer = (u[o + 1] >> 1) & 3;
        const bi = u[o + 2] >> 4, si = (u[o + 2] >> 2) & 3;
        if (v === 1 || layer !== 1 || bi === 0 || bi === 15 || si === 3) return null;
        const sr = SR[v][si], kbps = (v === 3 ? BR_V1 : BR_V2)[bi];
        const spf = v === 3 ? 1152 : 576;
        const size = Math.floor((spf / 8) * kbps * 1000 / sr) + ((u[o + 2] >> 1) & 1);
        return { v, sr, spf, size, channels: (u[o + 3] >> 6) === 3 ? 1 : 2 };
    }

    const u32 = (u, p) => ((u[p] << 24) | (u[p + 1] << 16) | (u[p + 2] << 8) | u[p + 3]) >>> 0;

    /**
     * Frame-level view of one MP3 file. Tags (ID3v2/ID3v1) are excluded; a Xing/Info frame is
     * reported through delay/padding and excluded from `audio`. Returns null if no audio frames.
     */
    function parseMp3(u) {
        if (!u || u.length < 4) return null;
        let s = 0, e = u.length;
        while (s + 10 <= e && u[s] === 0x49 && u[s + 1] === 0x44 && u[s + 2] === 0x33) {
            const size = ((u[s + 6] & 0x7f) << 21) | ((u[s + 7] & 0x7f) << 14) | ((u[s + 8] & 0x7f) << 7) | (u[s + 9] & 0x7f);
            s += 10 + size + ((u[s + 5] & 0x10) ? 10 : 0);
        }
        if (e - s >= 128 && u[e - 128] === 0x54 && u[e - 127] === 0x41 && u[e - 126] === 0x47) e -= 128;   // "TAG"
        // first frame: a valid header followed by another valid header (avoids false syncs in junk)
        let o = s;
        const limit = Math.min(e - 4, s + 8192);
        for (; o < limit; o++) {
            const h = frameHeader(u, o);
            if (h && (o + h.size === e || frameHeader(u, o + h.size))) break;
        }
        if (o >= limit) return null;

        let frames = 0, first = null, tagged = false, delay = 0, padding = 0, audioStart = o;
        while (o + 4 <= e) {
            const h = frameHeader(u, o);
            if (!h || o + h.size > e) break;
            if (!first) {
                first = h;
                const side = h.v === 3 ? (h.channels === 1 ? 17 : 32) : (h.channels === 1 ? 9 : 17);
                // Some encoders set the CRC bit but write the tag at the no-CRC offset: check both.
                for (const x of [o + 4 + side, o + 6 + side]) {
                    const tag = String.fromCharCode(u[x], u[x + 1], u[x + 2], u[x + 3]);
                    if (tag !== 'Xing' && tag !== 'Info') continue;
                    const flags = u32(u, x + 4);
                    let p = x + 8;
                    if (flags & 1) p += 4;
                    if (flags & 2) p += 4;
                    if (flags & 4) p += 100;
                    if (flags & 8) p += 4;
                    // LAME extension: encoder delay / padding (12 bits each) at +21 from the encoder string
                    if (p + 24 <= o + h.size) {
                        delay = (u[p + 21] << 4) | (u[p + 22] >> 4);
                        padding = ((u[p + 22] & 0x0f) << 8) | u[p + 23];
                    }
                    tagged = true;
                    break;
                }
                if (tagged) { o += h.size; audioStart = o; continue; }
            }
            if (h.sr !== first.sr) break;
            frames++;
            o += h.size;
        }
        if (!frames) return null;
        const total = frames * first.spf;
        if (delay + padding >= total) { delay = 0; padding = 0; }
        return {
            sr: first.sr, spf: first.spf, frames, tagged, delay, padding,
            samples: total - delay - padding,       // exact audio length in samples
            audio: u.subarray(audioStart, o)
        };
    }

    const Core = { parseMp3, frameHeader };
    if (typeof module === 'object' && module.exports) { module.exports = Core; return; }

    /* ------------------------------------------------------------------ session */
    const AHEAD_SECONDS = 45;          // keep at least this much audio appended ahead of the playhead
    const MIN_AHEAD_AYAHS = 3;         // ...and at least this many ayahs (fast playback / short ayahs)
    const PREFETCH = 3;                // concurrent downloads ahead of the append head
    const MAX_BUFFERED_BYTES = 8 * 1024 * 1024;   // stay well under the SourceBuffer quota
    const KEEP_BEHIND_SECONDS = 30;    // played audio kept for instant "previous ayah"/seek back
    const RETRIES = 2;

    /**
     * One continuous stream for a run of ayahs, attached to an existing <audio> element (the
     * element is reused, never recreated). Timeline: the first ayah starts at 0; each following
     * ayah starts exactly where the previous one's samples end.
     *
     * opts: { el, list, start, offset, load(ayah, signal) => Promise<Uint8Array>,
     *         onAyah(index), onFailure(index, error) }
     */
    class GaplessSession {
        static supported() {
            const MS = root.MediaSource;
            try { return !!MS && typeof MS.isTypeSupported === 'function' && MS.isTypeSupported('audio/mpeg'); } catch (e) { return false; }
        }

        constructor(opts) {
            Object.assign(this, { el: opts.el, list: opts.list, start: opts.start, offset: opts.offset || 0,
                load: opts.load, onAyah: opts.onAyah || (() => {}), onFailure: opts.onFailure || (() => {}) });
            this.starts = [];          // starts[i] / ends[i]: seconds on the stream timeline
            this.ends = [];
            this.bytes = [];
            this.next = this.start;    // next ayah index to append
            this.first = this.start;   // first ayah index still buffered
            this.current = this.start;
            this.samples = 0;          // write head in samples (exact; avoids float drift)
            this.sr = 0;
            this.buffered = 0;
            this.pending = new Map();  // index -> Promise<Uint8Array>
            this.failedAt = null;
            this.eos = false;
            this.closed = false;
            this.busy = false;
            this.ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
        }

        /** Attach the MediaSource to the element (synchronous, so play() can follow in the same gesture). */
        open() {
            const ms = this.ms = new root.MediaSource();
            this.url = URL.createObjectURL(ms);
            ms.addEventListener('sourceopen', () => {
                if (this.closed || this.sb) return;
                try {
                    this.sb = ms.addSourceBuffer('audio/mpeg');
                } catch (e) { this.fail(this.next, e); return; }
                this.sb.addEventListener('updateend', () => this.pump());
                this.pump();
            });
            this.el.src = this.url;
            this.prefetch();
        }

        has(i) { return !this.closed && i >= this.first && i < this.next && this.starts[i] !== undefined; }

        /** Index of the ayah at stream time t. */
        indexAt(t) {
            let i = this.first;
            while (i + 1 < this.next && this.starts[i + 1] <= t + 0.0005) i++;
            return i;
        }

        ayahTime() { return Math.max(0, (this.el.currentTime || 0) - (this.starts[this.current] || 0)); }
        ayahDuration(i = this.current) {
            return this.starts[i] !== undefined ? this.ends[i] - this.starts[i] : 0;
        }

        /** Move the playhead to ayah i (must be buffered), `t` seconds into it. */
        seek(i, t) {
            const d = this.ayahDuration(i);
            const into = Math.max(0, Math.min(t || 0, Math.max(0, d - 0.05)));
            this.current = i;
            try { this.el.currentTime = this.starts[i] + into; } catch (e) { /* ignore */ }
            this.schedule();
            this.pump();
        }

        /** Called on timeupdate/seeked: follow the playhead across ayah boundaries. */
        tick() {
            if (this.closed || this.next === this.first) return;
            const i = this.indexAt(this.el.currentTime || 0);
            if (i !== this.current) {
                this.current = i;
                this.onAyah(i);
            }
            this.schedule();
            this.pump();
        }

        /** Timer for the next boundary, so the verse display switches on time (timeupdate is ~4 Hz). */
        schedule() {
            clearTimeout(this.timer);
            if (this.closed || this.el.paused) return;
            const end = this.ends[this.current];
            if (end === undefined || this.current + 1 >= this.next) return;
            const rate = this.el.playbackRate || 1;
            const ms = Math.max(0, (end - (this.el.currentTime || 0)) / rate * 1000) + 5;
            this.timer = setTimeout(() => this.tick(), ms);
        }

        /** Download the next few ayahs (in parallel with playback and appends). */
        prefetch() {
            for (let i = this.next; i < Math.min(this.list.length, this.next + PREFETCH); i++) {
                if (!this.pending.has(i)) {
                    const p = this.fetchWithRetry(i);
                    p.catch(() => {});        // handled when it is appended
                    this.pending.set(i, p);
                }
            }
        }

        async fetchWithRetry(i) {
            let err;
            for (let attempt = 0; attempt <= RETRIES; attempt++) {
                if (this.closed) throw new Error('closed');
                if (attempt) await new Promise(r => setTimeout(r, 700 * attempt));
                try {
                    return await this.load(this.list[i], this.ctrl && this.ctrl.signal);
                } catch (e) {
                    err = e;
                    if (this.closed || (e && e.name === 'AbortError')) throw e;
                }
            }
            throw err;
        }

        /** Append/evict/finish as needed. Re-entered on every updateend and timeupdate. */
        pump() {
            if (this.closed || this.busy || !this.sb || this.sb.updating || this.ms.readyState !== 'open' || this.failedAt !== null) return;
            if (this.next >= this.list.length) {
                if (!this.eos) { this.eos = true; try { this.ms.endOfStream(); } catch (e) { /* ignore */ } }
                return;
            }
            if (this.buffered > MAX_BUFFERED_BYTES && this.evict(KEEP_BEHIND_SECONDS)) return;
            const ahead = this.samples / (this.sr || 1) - (this.el.currentTime || 0);
            if (this.next > this.start && ahead > AHEAD_SECONDS && this.next - this.current > MIN_AHEAD_AYAHS) return;
            this.appendNext();
        }

        async appendNext() {
            const i = this.next;
            this.busy = true;
            this.prefetch();
            let parsed;
            try {
                const bytes = await this.pending.get(i);
                if (this.closed) return;
                parsed = parseMp3(bytes);
                if (!parsed) throw new Error('not an MP3 file');
                if (this.sr && parsed.sr !== this.sr) throw new Error('sample rate changed');
            } catch (e) {
                this.busy = false;
                if (!this.closed) this.fail(i, e);
                return;
            }
            if (this.closed || this.sb.updating || this.ms.readyState !== 'open') { this.busy = false; return; }

            this.sr = this.sr || parsed.sr;
            const T = this.samples / this.sr;
            const end = (this.samples + parsed.samples) / this.sr;
            try {
                const sb = this.sb;
                sb.appendWindowStart = 0;
                sb.appendWindowEnd = Infinity;
                if (parsed.tagged) {
                    // Exact audio only: drop the encoder delay at the start and padding at the end.
                    sb.timestampOffset = T - parsed.delay / this.sr;
                    sb.appendWindowEnd = end;
                    sb.appendWindowStart = T;
                } else {
                    sb.timestampOffset = T;
                }
                this.appendData(sb, parsed.audio);
            } catch (e) {
                this.busy = false;
                this.fail(i, e);
                return;
            }
            this.pending.delete(i);
            this.starts[i] = T;
            this.ends[i] = end;
            this.bytes[i] = parsed.audio.length;
            this.buffered += parsed.audio.length;
            this.samples += parsed.samples;
            this.next = i + 1;
            this.busy = false;
            if (i === this.start && this.offset > 0) {
                try { this.el.currentTime = Math.min(this.offset, Math.max(0, end - 0.25)); } catch (e) { /* ignore */ }
            }
            this.prefetch();
        }

        appendData(sb, data) {
            try {
                sb.appendBuffer(data);
            } catch (e) {
                if (!e || e.name !== 'QuotaExceededError' || !this.evictNow(0)) throw e;
                throw Object.assign(new Error('quota'), { name: 'RetryLater' });
            }
        }

        /** Remove whole ayahs that ended more than `keep` seconds before the playhead. */
        evict(keep) { return this.evictNow(keep); }

        evictNow(keep) {
            if (this.eos || !this.sb || this.sb.updating) return false;
            const t = this.el.currentTime || 0;
            let k = this.first;
            while (k < this.current && this.ends[k] < t - keep) k++;
            if (k === this.first) return false;
            for (let j = this.first; j < k; j++) this.buffered -= this.bytes[j] || 0;
            const upTo = this.ends[k - 1];
            this.first = k;
            try { this.sb.remove(0, upTo); } catch (e) { return false; }
            return true;
        }

        /**
         * A file could not be loaded/decoded. Nothing played yet: report it at once (the player
         * uses its per-file path). Otherwise end the stream where the audio stops, so everything
         * already buffered still plays; the player continues from `failedAt` on 'ended'.
         */
        fail(i, err) {
            if (this.closed || this.failedAt !== null) return;
            if (err && err.name === 'RetryLater') { setTimeout(() => this.pump(), 50); return; }
            this.failedAt = i;
            if (i <= this.start || this.next === this.start) {
                this.onFailure(i, err);
                return;
            }
            if (!this.eos && this.ms.readyState === 'open') {
                this.eos = true;
                const end = () => { try { this.ms.endOfStream(); } catch (e) { /* ignore */ } };
                if (this.sb && this.sb.updating) this.sb.addEventListener('updateend', end, { once: true }); else end();
            }
        }

        destroy() {
            if (this.closed) return;
            this.closed = true;
            clearTimeout(this.timer);
            if (this.ctrl) try { this.ctrl.abort(); } catch (e) { /* ignore */ }
            this.pending.clear();
            if (this.url) { try { URL.revokeObjectURL(this.url); } catch (e) { /* ignore */ } }
        }
    }

    root.GaplessCore = Core;
    root.GaplessSession = GaplessSession;
})(typeof window !== 'undefined' ? window : globalThis);
