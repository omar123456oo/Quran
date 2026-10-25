/**
 * Mushaf store — verified page data + KFGQPC V1 page fonts, online or downloaded.
 *
 * A page is "downloaded" only when its validated layout record is in IndexedDB AND its
 * font is in the Cache API; the IndexedDB record is written last, so its presence means
 * both parts were stored. Downloaded pages render with no network request.
 */
(function (root) {
    const PAGE_API = (p) => 'https://api.quran.com/api/v4/verses/by_page/' + p +
        '?words=true&per_page=50&word_fields=code_v1,line_number,text_uthmani&fields=chapter_id';
    const FONT_URL = (p) => `https://static.qurancdn.com/fonts/quran/hafs/v1/woff2/p${p}.woff2`;
    const maxLine = (p) => (p === 1 || p === 2 ? 8 : 15);

    /* ------------------------------------------------------- pure helpers */
    const Core = {
        PAGE_API, FONT_URL, maxLine,

        /** API response -> { v, p, l: [[lineNumber, [[glyph, text, verseKey, isEnd, position], …]], …] } */
        compact(p, data) {
            const lines = new Map();
            for (const v of (data && data.verses) || []) {
                for (const w of v.words || []) {
                    if (!lines.has(w.line_number)) lines.set(w.line_number, []);
                    lines.get(w.line_number).push([w.code_v1, w.text_uthmani, v.verse_key, w.char_type_name === 'end' ? 1 : 0, w.position]);
                }
            }
            return { v: 1, p, l: [...lines.keys()].sort((a, b) => a - b).map(n => [n, lines.get(n)]) };
        },

        verseKeys(page) {
            const keys = [];
            for (const [, words] of page.l) for (const w of words) if (keys[keys.length - 1] !== w[2]) keys.push(w[2]);
            return keys;
        },

        nextKey(counts, key) {
            const [s, a] = key.split(':').map(Number);
            if (a < counts[s - 1]) return `${s}:${a + 1}`;
            return s < 114 ? `${s + 1}:1` : null;
        },

        /**
         * Line slots for rendering: text lines from the source, plus the Surah header and
         * basmala lines the printed page has above each Surah start.
         */
        layout(page, meta) {
            const p = page.p;
            const slots = new Map();
            for (const [n, words] of page.l) slots.set(n, { n, type: 'text', words });
            const seen = new Set();
            for (const [n, words] of page.l) {
                for (const w of words) {
                    if (seen.has(w[2])) continue;
                    seen.add(w[2]);
                    const [s, a] = w[2].split(':').map(Number);
                    if (a !== 1) continue;                    // first word of a Surah's first verse
                    const above = s === 1 || s === 9 ? [['header', n - 1]] : [['basmala', n - 1], ['header', n - 2]];
                    for (const [type, line] of above) {
                        if (line >= 1 && !slots.has(line)) slots.set(line, { n: line, type, surah: s });
                    }
                }
            }
            const endHeader = meta.headerAtPageEnd[String(p)];
            if (endHeader && !slots.has(maxLine(p))) slots.set(maxLine(p), { n: maxLine(p), type: 'header', surah: endHeader });
            const out = [];
            for (let n = 1; n <= maxLine(p); n++) out.push(slots.get(n) || { n, type: 'empty' });
            return out;
        },

        /** Returns a list of problems; an empty list means the page is safe to show/store. */
        validatePage(p, page, meta) {
            const problems = [];
            const counts = meta.surahs.map(s => s[2]);
            if (!page || page.p !== p || !Array.isArray(page.l) || !page.l.length) return ['empty or wrong page'];
            const seen = new Set();
            for (const [n, words] of page.l) {
                if (!(n >= 1 && n <= maxLine(p)) || seen.has(n)) problems.push(`bad line ${n}`);
                seen.add(n);
                if (!words.length) problems.push(`empty line ${n}`);
                for (const w of words) {
                    if (typeof w[0] !== 'string' || !w[0].length) problems.push(`missing glyph on line ${n}`);
                    if (!/^\d{1,3}:\d{1,3}$/.test(w[2])) problems.push(`bad verse key on line ${n}`);
                }
            }
            if (problems.length) return problems;

            const keys = Core.verseKeys(page);
            if (keys[0] !== meta.pageStart[p - 1]) problems.push(`starts at ${keys[0]}, expected ${meta.pageStart[p - 1]}`);
            for (let i = 1; i < keys.length; i++) {
                if (Core.nextKey(counts, keys[i - 1]) !== keys[i]) problems.push(`verse gap ${keys[i - 1]} → ${keys[i]}`);
            }
            const expectedNext = p < meta.pageStart.length ? meta.pageStart[p] : null;
            if (Core.nextKey(counts, keys[keys.length - 1]) !== expectedNext) problems.push(`ends at ${keys[keys.length - 1]}`);

            // each verse: words numbered 1…n with none missing, exactly one end marker, last
            const flat = page.l.flatMap(([, words]) => words);
            for (const k of keys) {
                const ws = flat.filter(w => w[2] === k);
                if (ws.some((w, i) => w[4] !== i + 1)) problems.push(`verse ${k} word missing or out of order`);
                if (ws.filter(w => w[3]).length !== 1 || !ws[ws.length - 1][3]) problems.push(`verse ${k} end marker`);
            }
            if (Core.layout(page, meta).some(s => s.type === 'empty')) problems.push('unexplained empty line');
            return problems;
        },

        isWoff2(bytes) {
            return !!bytes && bytes.length > 4 && bytes[0] === 0x77 && bytes[1] === 0x4F && bytes[2] === 0x46 && bytes[3] === 0x32;
        }
    };

    if (typeof module === 'object' && module.exports) { module.exports = Core; return; }

    /* -------------------------------------------------------------- store */
    const CACHE = 'quran-mushaf-v1';
    const MESSAGES = {
        'not-downloaded': 'هذه الصفحة غير محمّلة للقراءة دون اتصال',
        network: 'تعذر الاتصال بالخادم',
        invalid: 'بيانات الصفحة لم تجتز التحقق',
        font: 'خط الصفحة غير صالح',
        storage: 'لا توجد مساحة تخزين كافية على الجهاز'
    };
    const err = (code, detail) => Object.assign(new Error(MESSAGES[code] || code), { code, detail });

    const MushafStore = {
        downloaded: new Set(),
        memory: new Map(),          // small LRU of recently shown pages
        fonts: new Map(),           // page -> FontFace currently added to document.fonts
        job: null,
        listeners: new Set(),
        ready: null,

        init() {
            if (this.ready) return this.ready;
            this.ready = OfflineDB.getAllKeys('pages')
                .then(keys => { keys.forEach(k => this.downloaded.add(k)); })
                .catch(e => console.warn('Mushaf storage unavailable', e))
                .then(() => this.emit());
            return this.ready;
        },

        subscribe(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); },
        emit() { this.listeners.forEach(fn => { try { fn(); } catch (e) { console.error(e); } }); },
        message: (code) => MESSAGES[code] || 'حدث خطأ',
        isDownloaded(p) { return this.downloaded.has(p); },

        remember(p, page) {
            this.memory.delete(p);
            this.memory.set(p, page);
            while (this.memory.size > 12) this.memory.delete(this.memory.keys().next().value);
        },

        async fetchRemote(p, signal) {
            let res;
            try {
                res = await fetch(PAGE_API(p), { signal, mode: 'cors', credentials: 'omit' });
            } catch (e) {
                if (e.name === 'AbortError') throw e;
                throw err('network');
            }
            if (!res.ok) throw err('network', `HTTP ${res.status}`);
            const page = Core.compact(p, await res.json());
            const problems = Core.validatePage(p, page, MushafMeta);
            if (problems.length) throw err('invalid', problems.join('; '));
            return page;
        },

        /** Downloaded copy first; otherwise the network (when online). */
        async getPage(p) {
            await this.init();
            if (this.memory.has(p)) return this.memory.get(p);
            if (this.downloaded.has(p)) {
                const rec = await OfflineDB.get('pages', p).catch(() => null);
                if (rec && rec.data) { this.remember(p, rec.data); return rec.data; }
                this.downloaded.delete(p);
            }
            if (navigator.onLine === false) throw err('not-downloaded');
            try {
                const page = await this.fetchRemote(p);
                this.remember(p, page);
                return page;
            } catch (e) {
                if (e.code === 'network') throw err('not-downloaded');
                throw e;
            }
        },

        async fontBytes(p, signal) {
            const cache = await caches.open(CACHE);
            const hit = await cache.match(FONT_URL(p));
            if (hit) return new Uint8Array(await hit.arrayBuffer());
            if (navigator.onLine === false) throw err('not-downloaded');
            let res;
            try {
                res = await fetch(FONT_URL(p), { signal, mode: 'cors', credentials: 'omit' });
            } catch (e) {
                if (e.name === 'AbortError') throw e;
                throw err('network');
            }
            if (!res.ok) throw err('network', `font HTTP ${res.status}`);
            const bytes = new Uint8Array(await res.arrayBuffer());
            const len = Number(res.headers.get('Content-Length'));
            if (!Core.isWoff2(bytes) || (len > 0 && len !== bytes.length)) throw err('font');
            return bytes;
        },

        family: (p) => `qcf-p${p}`,

        /** Make the page's font usable; keeps only a few page fonts in memory. */
        async ensureFont(p) {
            if (this.fonts.has(p)) {
                const f = this.fonts.get(p);
                this.fonts.delete(p); this.fonts.set(p, f);
                return f;
            }
            const bytes = await this.fontBytes(p);
            const face = new FontFace(this.family(p), bytes.buffer, { display: 'block' });
            await face.load();
            document.fonts.add(face);
            this.fonts.set(p, face);
            while (this.fonts.size > 10) {
                const [oldP, oldFace] = this.fonts.entries().next().value;
                if (oldP === 1) { this.fonts.delete(1); this.fonts.set(1, oldFace); continue; }   // basmala glyphs
                document.fonts.delete(oldFace);
                this.fonts.delete(oldP);
            }
            return face;
        },

        /** Bytes still to fetch for these pages (from measured sizes). */
        estimate(pages) {
            return pages.filter(p => !this.downloaded.has(p)).reduce((t, p) => t + (MushafMeta.pageBytes[p - 1] || 0), 0);
        },

        storedBytes() {
            let t = 0;
            this.downloaded.forEach(p => { t += MushafMeta.pageBytes[p - 1] || 0; });
            return t;
        },

        /** Download pages (page 1 is always included: its font draws the basmala). */
        async download(pages) {
            await this.init();
            if (this.job && this.job.status === 'running') throw new Error('busy');
            const wanted = [...new Set([1, ...pages.map(Number)])]
                .filter(p => p >= 1 && p <= 604 && !this.downloaded.has(p)).sort((a, b) => a - b);
            const job = { pages: wanted, done: 0, failed: [], total: wanted.length, status: 'running', ctrl: new AbortController(), bytes: 0 };
            this.job = job;
            this.emit();
            if (!wanted.length) { job.status = 'done'; this.emit(); return job; }

            try {
                if (navigator.storage && navigator.storage.estimate) {
                    const { usage = 0, quota = 0 } = await navigator.storage.estimate();
                    if (quota && quota - usage < this.estimate(wanted) * 1.2 + 10e6) throw err('storage');
                }
                const cache = await caches.open(CACHE);
                let next = 0;
                const worker = async () => {
                    while (next < wanted.length && !job.ctrl.signal.aborted) {
                        const p = wanted[next++];
                        try {
                            await this.downloadPage(p, cache, job.ctrl.signal);
                            job.done += 1;
                            job.bytes += MushafMeta.pageBytes[p - 1] || 0;
                        } catch (e) {
                            if (e.name === 'AbortError') return;
                            if (e.name === 'QuotaExceededError') { job.ctrl.abort(); job.storageFull = true; return; }
                            job.failed.push(p);
                            job.lastError = e.code || 'network';
                        }
                        this.emit();
                    }
                };
                await Promise.all(Array.from({ length: 4 }, worker));
                job.status = job.storageFull ? 'failed' : job.ctrl.signal.aborted ? 'cancelled' : job.failed.length ? 'failed' : 'done';
                if (job.storageFull) job.lastError = 'storage';
            } catch (e) {
                job.status = 'failed';
                job.lastError = e.code || 'network';
                job.failed = wanted.filter(p => !this.downloaded.has(p));
            }
            this.emit();
            return job;
        },

        async downloadPage(p, cache, signal) {
            const page = await this.fetchRemote(p, signal);
            const res = await fetch(FONT_URL(p), { signal, mode: 'cors', credentials: 'omit', cache: 'no-store' });
            if (!res.ok) throw err('network', `font HTTP ${res.status}`);
            const bytes = new Uint8Array(await res.arrayBuffer());
            const len = Number(res.headers.get('Content-Length'));
            if (!Core.isWoff2(bytes) || (len > 0 && len !== bytes.length)) throw err('font');
            await cache.put(FONT_URL(p), new Response(new Blob([bytes], { type: 'font/woff2' }), {
                headers: { 'Content-Type': 'font/woff2', 'Content-Length': String(bytes.length) }
            }));
            const stored = await cache.match(FONT_URL(p));             // confirm before recording
            if (!stored || Number(stored.headers.get('Content-Length')) !== bytes.length) throw err('font');
            await OfflineDB.put('pages', { p, data: page, fontBytes: bytes.length, savedAt: Date.now() });
            this.downloaded.add(p);
            this.remember(p, page);
        },

        cancel() { if (this.job && this.job.status === 'running') this.job.ctrl.abort(); },

        retry() {
            if (this.job && this.job.failed.length) return this.download(this.job.failed.slice());
        },

        /** Remove pages; page 1 stays while other pages need its basmala glyphs. */
        async remove(pages) {
            await this.init();
            const set = new Set(pages.map(Number));
            const remaining = [...this.downloaded].filter(p => !set.has(p));
            if (remaining.length) set.delete(1);
            const list = [...set].filter(p => this.downloaded.has(p));
            const cache = await caches.open(CACHE);
            await Promise.all(list.map(p => cache.delete(FONT_URL(p))));
            await OfflineDB.deleteMany('pages', list);
            list.forEach(p => { this.downloaded.delete(p); this.memory.delete(p); });
            this.emit();
            return list.length;
        },

        /** Re-check that every recorded page still has its font (storage can be evicted). */
        async verifyAll() {
            await this.init();
            const cache = await caches.open(CACHE);
            const lost = [];
            for (const p of this.downloaded) if (!await cache.match(FONT_URL(p))) lost.push(p);
            if (lost.length) {
                await OfflineDB.deleteMany('pages', lost);
                lost.forEach(p => this.downloaded.delete(p));
                this.emit();
            }
            return lost;
        }
    };

    root.MushafCore = Core;
    root.MushafStore = MushafStore;
})(typeof window !== 'undefined' ? window : globalThis);
