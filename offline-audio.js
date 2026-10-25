/**
 * Offline audio — user-initiated Surah downloads for offline listening.
 *
 * Files come from everyayah.com, a CORS-enabled mirror whose audio frames were verified
 * byte-identical to the app's streaming source (see docs/OFFLINE_AUDIT.md). Each ayah
 * file is checked (HTTP status, type, length, MP3 signature) before it is stored in the
 * Cache API; a Surah is only marked "complete" after every file is re-read from storage.
 */
(function (root) {
    /* ------------------------------------------------------- pure helpers */
    const MIRROR = {
        'ar.alafasy': 'Alafasy_128kbps',
        'ar.abdulbasitmurattal': 'Abdul_Basit_Murattal_192kbps',
        'ar.minshawi': 'Minshawy_Murattal_128kbps',
        'ar.husary': 'Husary_128kbps',
        'ar.shaatree': 'Abu_Bakr_Ash-Shaatree_128kbps',
        'ar.abdurrahmaansudais': 'Abdurrahmaan_As-Sudais_192kbps',
        'ar.mahermuaiqly': 'Maher_AlMuaiqly_64kbps'
    };
    const pad3 = (n) => String(n).padStart(3, '0');

    const Core = {
        MIRROR,
        mirrorUrl(reciter, surah, ayah) {
            const folder = MIRROR[reciter];
            return folder ? `https://everyayah.com/data/${folder}/${pad3(surah)}${pad3(ayah)}.mp3` : null;
        },

        /** ID3v2 header or an MPEG audio frame sync at the start of the file. */
        looksLikeMp3(bytes) {
            if (!bytes || bytes.length < 4) return false;
            if (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) return true;
            return bytes[0] === 0xFF && (bytes[1] & 0xE0) === 0xE0;
        },

        /** Returns an error code, or null when the downloaded file is acceptable. */
        validateAudio({ status, contentType, contentLength, bytes }) {
            if (status !== 200) return 'http';
            if (contentType && !/^audio\/|^application\/octet-stream/i.test(contentType)) return 'type';
            if (!bytes || bytes.length < 1024) return 'short';
            if (Number.isFinite(contentLength) && contentLength > 0 && contentLength !== bytes.length) return 'length';
            if (!Core.looksLikeMp3(bytes)) return 'signature';
            return null;
        },

        /** Index (0-based) of "surah:ayah" in the whole Qur'an, from per-Surah ayah counts. */
        globalIndex(counts, surah, ayah) {
            let n = 0;
            for (let s = 1; s < surah; s++) n += counts[s - 1];
            return n + ayah - 1;
        },

        /** All ayahs in [startKey, endKey) as [surah, ayah] pairs; endKey null = to the end. */
        ayahRange(counts, startKey, endKey) {
            const [s0, a0] = startKey.split(':').map(Number);
            const end = endKey ? endKey.split(':').map(Number) : [counts.length + 1, 1];
            const out = [];
            let s = s0, a = a0;
            while (s < end[0] || (s === end[0] && a < end[1])) {
                if (s > counts.length) break;
                out.push([s, a]);
                if (a < counts[s - 1]) a += 1; else { s += 1; a = 1; }
            }
            return out;
        }
    };

    if (typeof module === 'object' && module.exports) { module.exports = Core; return; }

    /* ------------------------------------------------------------ manager */
    const CACHE = 'quran-audio-v1';
    const CONCURRENCY = 3;
    const MESSAGES = {
        network: 'انقطع الاتصال أثناء التنزيل',
        http: 'الخادم لم يُرجع الملف المطلوب',
        type: 'الملف المستلم ليس ملفًا صوتيًا',
        short: 'الملف المستلم غير مكتمل',
        length: 'حجم الملف لا يطابق المتوقع (تنزيل غير مكتمل)',
        signature: 'الملف المستلم ليس MP3 صالحًا',
        storage: 'لا توجد مساحة تخزين كافية على الجهاز',
        mismatch: 'بيانات الآيات لا تطابق السورة المطلوبة',
        missing: 'بعض الملفات المحفوظة حُذفت من المتصفح',
        interrupted: 'توقف التنزيل قبل اكتماله (أُغلق التطبيق)',
        unsupported: 'التنزيل غير متاح لهذا القارئ',
        api: 'تعذر الحصول على قائمة الآيات'
    };

    const OfflineAudio = {
        records: new Map(),
        active: new Map(),          // id -> AbortController
        listeners: new Set(),
        ready: null,
        _emitTimer: null,

        id: (reciter, surah) => `audio:${reciter}:${surah}`,

        init() {
            if (this.ready) return this.ready;
            this.ready = (async () => {
                try {
                    const all = await OfflineDB.getAll('resources');
                    for (const r of all) {
                        if (r.type !== 'audio') continue;
                        if (r.status === 'downloading') {
                            r.status = 'failed'; r.error = 'interrupted';
                            await OfflineDB.put('resources', r);
                        }
                        this.records.set(r.id, r);
                    }
                } catch (e) {
                    console.warn('Offline audio storage unavailable', e);
                }
                this.emit(true);
            })();
            return this.ready;
        },

        subscribe(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); },

        emit(now) {
            const fire = () => { this._emitTimer = null; this.listeners.forEach(fn => { try { fn(); } catch (e) { console.error(e); } }); };
            if (now) { clearTimeout(this._emitTimer); fire(); return; }
            if (!this._emitTimer) this._emitTimer = setTimeout(fire, 200);
        },

        message: (code) => MESSAGES[code] || 'حدث خطأ أثناء التنزيل',

        /** Whether this reciter has a verified downloadable source. */
        canDownload(reciter) { return !!MIRROR[reciter]; },

        get(reciter, surah) { return this.records.get(this.id(reciter, surah)) || null; },

        getComplete(reciter, surah) {
            const r = this.get(reciter, surah);
            return r && r.status === 'complete' ? r : null;
        },

        list() {
            return [...this.records.values()].sort((a, b) => a.reciter.localeCompare(b.reciter) || a.surah - b.surah);
        },

        async save(rec) {
            rec.updatedAt = Date.now();
            this.records.set(rec.id, rec);
            await OfflineDB.put('resources', rec);
            this.emit();
        },

        /** Start (or resume) a download. Files already stored and verified are kept. */
        async download(surah, reciter) {
            await this.init();
            surah = Number(surah);
            const id = this.id(reciter, surah);
            if (this.active.has(id)) return;                      // no duplicate downloads
            const existing = this.records.get(id);
            if (existing && existing.status === 'complete') return;
            if (!this.canDownload(reciter)) throw new Error(MESSAGES.unsupported);

            const ctrl = new AbortController();
            this.active.set(id, ctrl);
            const rec = existing || { id, type: 'audio', surah, reciter, createdAt: Date.now(), ayahs: [] };
            Object.assign(rec, {
                status: 'downloading', error: null, verified: false,
                source: `everyayah.com/data/${MIRROR[reciter]}`
            });
            this.records.set(id, rec);
            this.emit(true);

            try {
                if (!rec.ayahs.length) rec.ayahs = await this.resolveList(surah, reciter);
                const cache = await caches.open(CACHE);
                for (const a of rec.ayahs) {                      // resume: keep only files still stored
                    if (a.size && !await this.hasFile(cache, a)) a.size = 0;
                }
                rec.total = rec.ayahs.length;
                rec.done = rec.ayahs.filter(a => a.size).length;
                rec.bytes = rec.ayahs.reduce((t, a) => t + (a.size || 0), 0);
                rec.progress = rec.done / rec.total;
                await this.save(rec);
                await this.checkQuota();

                const todo = rec.ayahs.filter(a => !a.size);
                let next = 0;
                const worker = async () => {
                    while (next < todo.length) {
                        if (ctrl.signal.aborted) throw new DOMException('Aborted', 'AbortError');
                        const a = todo[next++];
                        await this.fetchFile(cache, a, ctrl.signal, rec);
                        rec.done += 1;
                        await this.save(rec);
                    }
                };
                await Promise.all(Array.from({ length: CONCURRENCY }, worker));

                // Re-read every file from storage before calling the Surah available offline.
                rec.done = 0;
                for (const a of rec.ayahs) {
                    if (!await this.hasFile(cache, a)) throw Object.assign(new Error('missing'), { code: 'missing' });
                    rec.done += 1;
                }
                rec.bytes = rec.ayahs.reduce((t, a) => t + a.size, 0);
                Object.assign(rec, { status: 'complete', verified: true, completedAt: Date.now(), progress: 1 });
                await this.save(rec);
                this.emit(true);
                return rec;
            } catch (err) {
                if (err && err.name === 'AbortError') {
                    // cancel() removed the record; drop any file a worker stored after that.
                    if (!this.records.has(id)) {
                        const cache = await caches.open(CACHE).catch(() => null);
                        if (cache) await Promise.all(rec.ayahs.map(a => cache.delete(a.key)));
                    }
                    return;
                }
                const code = err.code || (err.name === 'QuotaExceededError' ? 'storage' : (err instanceof TypeError ? 'network' : 'api'));
                Object.assign(rec, { status: 'failed', error: code });
                await this.save(rec).catch(() => {});
                this.emit(true);
                throw Object.assign(new Error(this.message(code)), { code });
            } finally {
                this.active.delete(id);
            }
        },

        /** Ayah list from the API, mapped to verified mirror files. */
        async resolveList(surah, reciter) {
            let data;
            try {
                data = await APIService.getSurah(surah, reciter);
            } catch (e) {
                throw Object.assign(new Error('api'), { code: navigator.onLine === false ? 'network' : 'api' });
            }
            const counts = MushafMeta.surahs.map(s => s[2]);
            if (!data || data.number !== surah || !Array.isArray(data.ayahs) || data.ayahs.length !== counts[surah - 1]) {
                throw Object.assign(new Error('mismatch'), { code: 'mismatch' });
            }
            return data.ayahs.map((a, i) => {
                // The API's file name is the global ayah number; it must match this Surah/ayah.
                const m = typeof a.audio === 'string' && a.audio.match(/\/(\d+)\.mp3$/);
                if (a.numberInSurah !== i + 1 || !m || Number(m[1]) !== Core.globalIndex(counts, surah, i + 1) + 1) {
                    throw Object.assign(new Error('mismatch'), { code: 'mismatch' });
                }
                return {
                    surah, numberInSurah: a.numberInSurah, page: a.page, juz: a.juz,
                    text: typeof a.text === 'string' ? a.text : '',
                    key: Core.mirrorUrl(reciter, surah, a.numberInSurah), size: 0
                };
            });
        },

        async checkQuota() {
            if (!navigator.storage || !navigator.storage.estimate) return;
            const { usage = 0, quota = 0 } = await navigator.storage.estimate();
            if (quota && quota - usage < 30 * 1024 * 1024) throw Object.assign(new Error('storage'), { code: 'storage' });
        },

        async hasFile(cache, a) {
            const res = await cache.match(a.key);
            if (!res) return false;
            const size = Number(res.headers.get('Content-Length'));
            return a.size > 0 && size === a.size;
        },

        async fetchFile(cache, a, signal, rec) {
            const res = await fetch(a.key, { signal, mode: 'cors', credentials: 'omit', cache: 'no-store' });
            const contentLength = Number(res.headers.get('Content-Length'));
            const contentType = res.headers.get('Content-Type') || '';
            if (!res.ok) throw Object.assign(new Error('http'), { code: 'http' });

            const chunks = [];
            let received = 0;
            const reader = res.body.getReader();
            for (;;) {
                const { done, value } = await reader.read();
                if (done) break;
                chunks.push(value);
                received += value.length;
                if (contentLength > 0) {
                    rec.progress = (rec.done + Math.min(1, received / contentLength)) / rec.total;
                    this.emit();
                }
            }
            const bytes = new Uint8Array(received);
            let off = 0;
            for (const c of chunks) { bytes.set(c, off); off += c.length; }

            const problem = Core.validateAudio({ status: res.status, contentType, contentLength, bytes });
            if (problem) throw Object.assign(new Error(problem), { code: problem });

            await cache.put(a.key, new Response(new Blob([bytes], { type: 'audio/mpeg' }), {
                headers: { 'Content-Type': 'audio/mpeg', 'Content-Length': String(bytes.length) }
            }));
            a.size = bytes.length;
            rec.bytes = (rec.bytes || 0) + bytes.length;
            rec.progress = (rec.done + 1) / rec.total;
        },

        /** Stop an active download and discard its partial files. */
        async cancel(id) {
            const ctrl = this.active.get(id);
            if (ctrl) ctrl.abort();
            await this.remove(id);
        },

        async retry(id) {
            const r = this.records.get(id);
            if (r) return this.download(r.surah, r.reciter);
        },

        async remove(id) {
            const r = this.records.get(id);
            if (!r) return;
            const ctrl = this.active.get(id);
            if (ctrl) ctrl.abort();
            try {
                const cache = await caches.open(CACHE);
                await Promise.all(r.ayahs.map(a => cache.delete(a.key)));
            } catch (e) { console.warn('Could not delete cached audio', e); }
            this.records.delete(id);
            await OfflineDB.delete('resources', id).catch(() => {});
            this.emit(true);
        },

        /** Check that a "complete" Surah's files still exist (the browser may evict storage). */
        async verify(rec) {
            const cache = await caches.open(CACHE);
            for (const a of rec.ayahs) {
                if (!await this.hasFile(cache, a)) {
                    Object.assign(rec, { status: 'failed', error: 'missing', verified: false });
                    await this.save(rec);
                    return false;
                }
            }
            return true;
        },

        /* ---------------------------------------------------- playback */
        playable(rec) {
            return rec.ayahs.map(a => ({
                surah: a.surah, numberInSurah: a.numberInSurah, text: a.text,
                page: a.page, juz: a.juz, audio: null, localKey: a.key
            }));
        },

        /** Local ayahs for a queue item, or null when it is not fully downloaded. */
        localAyahs(item, reciter) {
            if (item.kind === 'surah') {
                const rec = this.getComplete(reciter, item.ref);
                return rec ? this.playable(rec) : null;
            }
            const counts = MushafMeta.surahs.map(s => s[2]);
            const starts = item.kind === 'page' ? MushafMeta.pageStart : MushafMeta.juzStart;
            const i = item.ref - 1;
            if (!(i >= 0 && i < starts.length)) return null;
            const wanted = Core.ayahRange(counts, starts[i], starts[i + 1] || null);
            const bySurah = new Map();
            const out = [];
            for (const [s, a] of wanted) {
                if (!bySurah.has(s)) {
                    const rec = this.getComplete(reciter, s);
                    if (!rec) return null;
                    bySurah.set(s, this.playable(rec));
                }
                const ay = bySurah.get(s)[a - 1];
                if (!ay) return null;
                out.push(ay);
            }
            return out;
        },

        async objectUrl(key) {
            const cache = await caches.open(CACHE);
            const res = await cache.match(key);
            if (!res) return null;
            return URL.createObjectURL(await res.blob());
        },

        totalBytes() {
            let t = 0;
            this.records.forEach(r => { if (r.status === 'complete') t += r.bytes || 0; });
            return t;
        }
    };

    root.OfflineAudioCore = Core;
    root.OfflineAudio = OfflineAudio;
})(typeof window !== 'undefined' ? window : globalThis);
