// Continuous (MSE) Full-Surah playback: MP3 frame parsing, stream timeline, and the player's use of
// it. The real gapless-stream.js + audio-player.js run in a vm sandbox with a mock <audio>,
// MediaSource and SourceBuffer; ayah files are synthetic MPEG-1 Layer III frames.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const Core = require('../gapless-stream.js');

const root = path.join(__dirname, '..');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const SPF = 1152, SR = 44100, FRAME = 417;   // 128 kbps, 44.1 kHz, no padding bit

/** n audio frames (+ optional LAME Info frame, ID3v2 and ID3v1 tags). */
function mp3({ frames, info = null, id3v2 = 0, id3v1 = false }) {
    const parts = [];
    if (id3v2) {
        const h = Buffer.alloc(10 + id3v2);
        h.write('ID3', 0); h[3] = 3; h[9] = id3v2 & 0x7f; h[8] = (id3v2 >> 7) & 0x7f;
        parts.push(h);
    }
    const frame = () => { const f = Buffer.alloc(FRAME); f[0] = 0xFF; f[1] = 0xFB; f[2] = 0x90; f[3] = 0x00; return f; };
    if (info) {
        const f = frame();
        f.write('Info', 36);
        f.writeUInt32BE(0x0F, 40);                 // frames, bytes, toc, quality present
        const p = 44 + 4 + 4 + 100 + 4;
        f.write('LAME3.96r', p);
        f[p + 21] = info.delay >> 4;
        f[p + 22] = ((info.delay & 0x0f) << 4) | (info.padding >> 8);
        f[p + 23] = info.padding & 0xff;
        parts.push(f);
    }
    for (let i = 0; i < frames; i++) parts.push(frame());
    if (id3v1) { const t = Buffer.alloc(128); t.write('TAG', 0); parts.push(t); }
    return new Uint8Array(Buffer.concat(parts));
}

/* ------------------------------------------------------------------ parser */
test('parseMp3: header-less file (frames cut from one stream) — tags excluded, nothing trimmed', () => {
    const p = Core.parseMp3(mp3({ frames: 50, id3v2: 300, id3v1: true }));
    assert.equal(p.sr, SR);
    assert.equal(p.spf, SPF);
    assert.equal(p.frames, 50);
    assert.equal(p.tagged, false);
    assert.equal(p.samples, 50 * SPF, 'every decoded sample is recitation audio');
    assert.equal(p.audio.length, 50 * FRAME, 'ID3v2 and ID3v1 bytes are not fed to the decoder');
    assert.equal(p.audio[0], 0xFF);
});

test('parseMp3: LAME/Info header — encoder delay and padding read, Info frame excluded', () => {
    const p = Core.parseMp3(mp3({ frames: 40, info: { delay: 576, padding: 1834 } }));
    assert.equal(p.tagged, true);
    assert.equal(p.frames, 40);
    assert.equal(p.delay, 576);
    assert.equal(p.padding, 1834);
    assert.equal(p.samples, 40 * SPF - 576 - 1834);
    assert.equal(p.audio.length, 40 * FRAME);
});

test('parseMp3: rejects data that is not MP3', () => {
    assert.equal(Core.parseMp3(new Uint8Array(2000)), null);
    assert.equal(Core.parseMp3(new TextEncoder().encode('<html>not found</html>')), null);
});

/* ----------------------------------------------------------------- sandbox */
function makeEnv({ ayahs = 12, tagged = false, failUrls = new Set(), local = false, noMSE = false } = {}) {
    const log = { srcSets: [], plays: [], loads: 0, fetches: [], appends: [], removes: [], eos: 0, toasts: [], created: 0, maxBuffered: 0 };
    const registry = new Map();
    let blobN = 0;

    class MockSourceBuffer {
        constructor(ms) { this.ms = ms; this.updating = false; this.timestampOffset = 0; this.appendWindowStart = 0; this._end = Infinity; this.listeners = {}; this.ranges = []; }
        get appendWindowEnd() { return this._end; }
        set appendWindowEnd(v) { this._end = v; }
        addEventListener(e, fn, o) { (this.listeners[e] = this.listeners[e] || []).push({ fn, once: o && o.once }); }
        emit(e) { const l = this.listeners[e] || []; this.listeners[e] = l.filter(x => !x.once); l.forEach(x => x.fn()); }
        appendBuffer(data) {
            if (this.updating) throw new Error('InvalidStateError: updating');
            const p = sb.GaplessCore.parseMp3(data);           // the bytes must be whole MP3 frames
            assert.ok(p && !p.tagged, 'only audio frames are appended');
            const raw0 = this.timestampOffset, raw1 = raw0 + p.frames * SPF / SR;
            const s = Math.max(raw0, this.appendWindowStart), e = Math.min(raw1, this.appendWindowEnd);
            log.appends.push({ bytes: data.length, start: s, end: e, raw0, raw1 });
            this.ranges.push([s, e]);
            this.timestampOffset = raw1;                        // 'sequence' mode
            this.updating = true;
            setTimeout(() => { this.updating = false; this.emit('updateend'); }, 0);
        }
        remove(a, b) {
            log.removes.push([a, b]);
            this.ranges = this.ranges.filter(r => r[1] > b + 1e-9);
            this.updating = true;
            setTimeout(() => { this.updating = false; this.emit('updateend'); }, 0);
        }
        get end() { return this.ranges.length ? this.ranges[this.ranges.length - 1][1] : 0; }
    }
    class MockMediaSource {
        constructor() { this.readyState = 'closed'; this.listeners = {}; }
        static isTypeSupported(t) { return t === 'audio/mpeg'; }
        addEventListener(e, fn) { (this.listeners[e] = this.listeners[e] || []).push(fn); }
        addSourceBuffer() { this.sb = new MockSourceBuffer(this); return this.sb; }
        endOfStream() { this.readyState = 'ended'; log.eos++; }
        open() { this.readyState = 'open'; (this.listeners.sourceopen || []).forEach(fn => fn()); }
    }
    class MockAudio {
        constructor() {
            log.created++;
            this._src = null; this.paused = true; this.volume = 1; this.muted = false; this.playbackRate = 1; this.defaultPlaybackRate = 1;
            this._t = 0; this.duration = NaN; this.error = null; this.preload = 'auto'; this.listeners = {}; this.rejectPlay = null;
        }
        set src(v) {
            this._src = v; this._t = 0; log.srcSets.push(v);
            const ms = registry.get(v);
            if (ms) setTimeout(() => ms.open(), 0);
        }
        get src() { return this._src || ''; }
        get currentTime() { return this._t; }
        set currentTime(v) { this._t = v; setTimeout(() => this.emit('seeked'), 0); }
        get ms() { return registry.get(this._src); }
        getAttribute(n) { return n === 'src' ? this._src : null; }
        removeAttribute(n) { if (n === 'src') this._src = null; }
        addEventListener(e, fn) { (this.listeners[e] = this.listeners[e] || []).push(fn); }
        emit(e) { (this.listeners[e] || []).forEach(fn => fn({ target: this })); }
        load() { log.loads++; }
        pause() { this.paused = true; }
        play() {
            if (this.rejectPlay) { const e = new Error('blocked'); e.name = this.rejectPlay; return Promise.reject(e); }
            this.paused = false; log.plays.push(this._src);
            return Promise.resolve();
        }
    }

    const url = (r, s, a) => `https://mirror.example/${r}/${s}/${a}.mp3`;
    const files = new Map();
    const fileFor = (u) => {
        if (!files.has(u)) {
            const a = Number(u.match(/(\d+)\.mp3$/)[1]);
            files.set(u, mp3({ frames: 100 + a, id3v1: true, info: tagged ? { delay: 576, padding: 1000 + a } : null }));
        }
        return files.get(u);
    };
    const store = {};
    const sb = {
        console: { log() {}, warn() {}, error: console.error }, Date, Promise, Math, Number, Object, Array, String, JSON, Set, Map, Uint8Array, Error, TextEncoder,
        setTimeout: (fn, ms) => { const t = setTimeout(fn, Math.min(ms, 5)); if (t.unref) t.unref(); return t; },
        clearTimeout, AbortController,
        URL: { createObjectURL: (o) => { const u = `blob:mock/${++blobN}`; registry.set(u, o); return u; }, revokeObjectURL: (u) => registry.delete(u) },
        Audio: MockAudio,
        MediaSource: noMSE ? undefined : MockMediaSource,
        fetch: async (u) => {
            log.fetches.push(u);
            if (failUrls.has(u)) throw new TypeError('Failed to fetch');
            const b = fileFor(u);
            return { ok: true, status: 200, arrayBuffer: async () => b.slice().buffer };
        },
        localStorage: { getItem: k => store[k] || null, setItem: (k, v) => { store[k] = String(v); } },
        navigator: { onLine: true },
        confirm: () => true,
        document: { getElementById: () => null, querySelectorAll: () => [], addEventListener() {}, body: { classList: { add() {}, remove() {}, toggle() {} } } },
        App: { settings: { defaultReciter: 'ar.alafasy' }, showToast: (m, t) => log.toasts.push({ m, t }), saveSettings() {}, showLoading() {}, hideLoading() {}, formatTime: s => String(s), navigateToPage() {} },
        OfflineAudioCore: { mirrorUrl: url },
        APIService: {
            async getSurah(ref, reciter) {
                return { number: ref, ayahs: Array.from({ length: ayahs }, (_, i) => ({
                    numberInSurah: i + 1, text: `t${i + 1}`, page: 1, juz: 1, surah: { number: ref },
                    audio: `https://cdn.example/${reciter}/${ref}/${i + 1}.mp3` })) };
            }
        }
    };
    if (local) {
        sb.OfflineAudio = {
            init: async () => {},
            localAyahs: (item) => Array.from({ length: ayahs }, (_, i) => ({ surah: item.ref, numberInSurah: i + 1, text: `t${i + 1}`, page: 1, juz: 1, audio: null, localKey: url('ar.alafasy', item.ref, i + 1) })),
            bytes: async (k) => { log.fetches.push('cache:' + k); return fileFor(k); },
            objectUrl: async () => null
        };
    }
    sb.window = sb; sb.self = sb; sb.addEventListener = () => {};
    vm.createContext(sb);
    for (const f of ['play-queue.js', 'playlists.js', 'playback-store.js', 'gapless-stream.js', 'audio-player.js']) {
        vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), sb, { filename: f });
    }
    sb.AudioPlayer.init();
    const AP = sb.AudioPlayer, PS = sb.PlaybackStore;

    /** Let appends/opens settle. */
    const settle = async (n = 30) => { for (let i = 0; i < n; i++) await sleep(1); };
    /** Advance the playhead like a real element: timeupdate, and 'ended' at the end of the stream. */
    const advance = async (seconds, step = 0.25) => {
        const el = AP.audio;
        for (let t = 0; t < seconds; t += step) {
            const ms = el.ms;
            const end = ms && ms.sb ? ms.sb.end : 0;
            const nt = Math.min(el._t + step, end);
            el._t = nt;
            el.emit('timeupdate');
            if (ms && ms.readyState === 'ended' && nt >= end - 1e-9) { el.paused = true; el.emit('ended'); return; }
            await sleep(0);
        }
    };
    /** Play to the end of the stream (or until `until()`), collecting the ayahs heard. */
    const playThrough = async (until = () => false) => {
        for (let k = 0; k < 4000; k++) {
            if (PS.get().status === 'ended' || until() || !AP.session) return;
            await advance(1);
            await settle(2);
        }
    };
    return { sb, AP, PS, log, settle, advance, playThrough, url };
}

const trackAyahs = (PS) => { const seq = []; PS.subscribe((s, k) => { if (k.includes('ayahIndex') || k.includes('ayah')) seq.push(s.ayah); }); return seq; };

/* ------------------------------------------------------- stream timeline */
test('12 consecutive ayahs: one element, one stream, each file fetched and appended once, back to back', async () => {
    const { AP, PS, log, settle, playThrough } = makeEnv({ ayahs: 12 });
    const seq = trackAyahs(PS);
    const el = AP.audio;
    await AP.playNow('surah', 78);
    await settle();
    el.emit('playing');
    await playThrough();

    assert.equal(PS.get().status, 'ended');
    assert.equal(AP.audio, el, 'same element throughout');
    assert.equal(log.created, 2, 'no element created after init');
    assert.equal(log.srcSets.filter(Boolean).length, 1, 'one source for the whole Surah: no reinitialisation between ayahs');
    assert.equal(log.plays.length, 1, 'play() called once');
    assert.deepEqual([...new Set(seq.filter(Boolean))], Array.from({ length: 12 }, (_, i) => i + 1), 'every ayah, in order');
    assert.deepEqual(seq.filter(Boolean), [...new Set(seq.filter(Boolean))], 'no ayah repeated');
    assert.equal(log.fetches.length, 12, 'each file requested exactly once');
    assert.equal(log.appends.length, 12);
    for (let i = 1; i < 12; i++) assert.ok(Math.abs(log.appends[i].start - log.appends[i - 1].end) < 1e-9, `ayah ${i + 1} starts exactly where ayah ${i} ends`);
    assert.ok(log.appends.every(a => a.start === a.raw0 && a.end === a.raw1), 'header-less files are not trimmed');
    assert.equal(log.eos, 1, 'stream closed once, after the last ayah');
});

test('LAME-tagged files: only encoder delay/padding is trimmed; timeline stays contiguous', async () => {
    const { AP, log, settle, playThrough } = makeEnv({ ayahs: 6, tagged: true });
    await AP.playNow('surah', 78);
    await settle();
    AP.audio.emit('playing');
    await playThrough();
    assert.equal(log.appends.length, 6);
    let t = 0;
    log.appends.forEach((a, i) => {
        const n = i + 1;
        const exact = ((100 + n) * SPF - 576 - (1000 + n)) / SR;
        assert.ok(Math.abs(a.start - t) < 1e-9, `ayah ${n} starts at the previous end`);
        assert.ok(Math.abs((a.end - a.start) - exact) < 1e-9, `ayah ${n} keeps exactly its audio samples`);
        assert.ok(Math.abs(a.start - (a.raw0 + 576 / SR)) < 1e-9, 'encoder delay removed at the start');
        t = a.end;
    });
});

test('verse tracking: state follows the playhead; time/duration are per ayah', async () => {
    const { AP, PS, settle, advance } = makeEnv({ ayahs: 5 });
    await AP.playNow('surah', 78);
    await settle();
    AP.audio.emit('playing');
    const s = AP.session;
    assert.equal(PS.get().ayah, 1);
    AP.audio._t = s.starts[2] + 0.4;
    AP.audio.emit('timeupdate');
    assert.equal(PS.get().ayah, 3);
    assert.equal(PS.get().ayahIndex, 2);
    assert.ok(Math.abs(PS.get().time - 0.4) < 1e-6, 'time is inside the ayah');
    assert.ok(Math.abs(PS.get().duration - s.ayahDuration(2)) < 1e-9);
    await advance(0.5);
    assert.equal(PS.get().status, 'playing');
});

test('next/previous/seek inside the stream: no new request, no new source', async () => {
    const { AP, PS, log, settle } = makeEnv({ ayahs: 8 });
    await AP.playNow('surah', 78);
    await settle();
    AP.audio.emit('playing');
    const fetches = log.fetches.length, srcs = log.srcSets.length;
    assert.equal(AP.nextAyah(), true);
    assert.equal(PS.get().ayah, 2);
    assert.ok(Math.abs(AP.audio.currentTime - AP.session.starts[1]) < 1e-9, 'playhead at the start of ayah 2');
    assert.equal(AP.nextAyah(), true);
    assert.equal(AP.previousAyah(), true);
    assert.equal(PS.get().ayah, 2);
    AP.seek(0.5);
    assert.ok(Math.abs(AP.ayahTime() - AP.session.ayahDuration(1) * 0.5) < 1e-6, 'seek is relative to the ayah');
    assert.equal(PS.get().ayah, 2);
    assert.equal(log.srcSets.length, srcs, 'no reload');
    assert.ok(log.fetches.length - fetches <= 3, 'only normal read-ahead');
    AP.pause(); AP.audio.emit('pause');
    assert.equal(PS.get().status, 'paused');
    AP.play();
    assert.equal(log.srcSets.length, srcs, 'resume does not reload');
    assert.equal(PS.get().ayah, 2);
});

test('Single Ayah mode: per-file playback of exactly the chosen ayah (independent of the stream)', async () => {
    const { AP, PS, log, settle } = makeEnv({ ayahs: 6 });
    AP.setPlayMode('single');
    await AP.playAyah(78, 3);
    await settle();
    assert.equal(AP.session, null, 'no stream in Single Ayah mode');
    assert.ok(AP.audio.src.endsWith('/78/3.mp3'), 'the API file of the selected ayah');
    AP.audio.emit('playing');
    AP.audio.emit('ended');
    await settle();
    assert.equal(PS.get().status, 'ended');
    assert.equal(PS.get().ayah, 3);
    assert.equal(log.appends.length, 0);
});

test('switching Full Surah → Single mid-ayah continues the same ayah at the same position, then stops', async () => {
    const { AP, PS, settle } = makeEnv({ ayahs: 6 });
    await AP.playNow('surah', 78);
    await settle();
    AP.audio.emit('playing');
    AP.nextAyah();
    AP.audio._t = AP.session.starts[1] + 1.25;
    AP.audio.emit('timeupdate');
    AP.setPlayMode('single');
    assert.equal(AP.session, null);
    assert.equal(PS.get().ayah, 2);
    assert.ok(AP.audio.src.endsWith('/78/2.mp3'));
    assert.equal(AP.pendingSeek, 1.25, 'resumes where it was');
    AP.audio.emit('playing');
    AP.audio.emit('ended');
    await settle();
    assert.equal(PS.get().status, 'ended');
    assert.equal(PS.get().ayah, 2);
});

test('switching Single → Full Surah: the next boundary moves onto the continuous stream', async () => {
    const { AP, PS, settle, playThrough } = makeEnv({ ayahs: 4 });
    const seq = trackAyahs(PS);
    AP.setPlayMode('single');
    await AP.playAyah(78, 1);
    await settle();
    AP.audio.emit('playing');
    AP.setPlayMode('surah');
    AP.audio.emit('ended');
    await settle();
    assert.ok(AP.session, 'stream started at ayah 2');
    assert.equal(PS.get().ayah, 2);
    AP.audio.emit('playing');
    await playThrough();
    assert.deepEqual([...new Set(seq.filter(Boolean))], [1, 2, 3, 4]);
    assert.equal(PS.get().status, 'ended');
});

test('a file that cannot be fetched: everything before it plays, then that ayah via the per-file path, then the stream again', async () => {
    const env = makeEnv({ ayahs: 6, failUrls: new Set([`https://mirror.example/ar.alafasy/78/4.mp3`]) });
    const { AP, PS, log, settle, playThrough } = env;
    const seq = trackAyahs(PS);
    await AP.playNow('surah', 78);
    await settle(60);
    AP.audio.emit('playing');
    await playThrough(() => !AP.session);
    assert.equal(AP.session, null, 'stream ended after ayah 3');
    assert.equal(PS.get().ayah, 4);
    assert.ok(AP.audio.src.endsWith('cdn.example/ar.alafasy/78/4.mp3'), 'ayah 4 from the original API URL');
    AP.audio.emit('playing');
    AP.audio.emit('ended');
    await settle(40);
    assert.ok(AP.session, 'back on the stream for ayah 5');
    AP.audio.emit('playing');
    await playThrough();
    assert.deepEqual(seq.filter(Boolean).filter((v, i, a) => a.indexOf(v) === i), [1, 2, 3, 4, 5, 6], 'no ayah missing');
    assert.equal(PS.get().status, 'ended');
    assert.ok(log.fetches.filter(u => u.endsWith('/78/4.mp3')).length === 3, 'the failed file was retried twice');
});

test('first file unavailable: falls back to per-file playback immediately', async () => {
    const { AP, PS, settle } = makeEnv({ ayahs: 3, failUrls: new Set([`https://mirror.example/ar.alafasy/78/1.mp3`]) });
    await AP.playNow('surah', 78);
    await settle(60);
    assert.equal(AP.session, null);
    assert.ok(AP.audio.src.endsWith('cdn.example/ar.alafasy/78/1.mp3'));
    assert.equal(PS.get().ayah, 1);
});

test('no MediaSource (e.g. iPhone Safari): per-file path, unchanged behaviour', async () => {
    const { AP, PS, settle } = makeEnv({ ayahs: 3, noMSE: true });
    await AP.playNow('surah', 78);
    await settle();
    assert.equal(AP.session, null);
    assert.ok(AP.audio.src.endsWith('/78/1.mp3'));
    assert.ok(AP.nextAudio.src.endsWith('/78/2.mp3'), 'standby preload still used');
    assert.equal(PS.get().ayah, 1);
});

test('downloaded Surah streams continuously from the device copy (no network)', async () => {
    const { AP, PS, log, settle, playThrough } = makeEnv({ ayahs: 5, local: true });
    const seq = trackAyahs(PS);
    await AP.playNow('surah', 78);
    await settle();
    AP.audio.emit('playing');
    await playThrough();
    assert.ok(log.fetches.every(u => u.startsWith('cache:')), 'bytes read from storage only');
    assert.deepEqual([...new Set(seq.filter(Boolean))], [1, 2, 3, 4, 5]);
    assert.equal(PS.get().local, true);
});

test('long Surah (286 ayahs): played in order with bounded buffer (played audio is released)', async () => {
    const { AP, PS, log, settle, playThrough } = makeEnv({ ayahs: 286 });
    const seq = trackAyahs(PS);
    await AP.playNow('surah', 2);
    await settle();
    AP.audio.emit('playing');
    let max = 0;
    await playThrough(() => { max = Math.max(max, AP.session ? AP.session.buffered : 0); return false; });
    assert.equal(PS.get().status, 'ended');
    const heard = seq.filter(Boolean);
    assert.deepEqual([...new Set(heard)], Array.from({ length: 286 }, (_, i) => i + 1));
    assert.equal(log.fetches.length, 286, 'each file once');
    assert.ok(log.removes.length > 0, 'played ayahs were evicted');
    assert.ok(max < 9 * 1024 * 1024, `buffer stayed bounded (${max} bytes)`);
});

test('Repeat Surah: the stream restarts at ayah 1 the requested number of times', async () => {
    const { AP, PS, sb, settle, playThrough } = makeEnv({ ayahs: 3 });
    const seq = trackAyahs(PS);
    sb.PlayerState.queue.setRepeat('one');
    sb.PlayerState.prefs.repeatCount = 2;
    await AP.playNow('surah', 108);
    await settle();
    AP.audio.emit('playing');
    await playThrough(() => false);
    for (let k = 0; k < 20 && PS.get().status !== 'ended'; k++) { await settle(); AP.audio.emit('playing'); await playThrough(); }
    assert.deepEqual(seq.filter(Boolean), [1, 2, 3, 1, 2, 3]);
    assert.equal(PS.get().status, 'ended');
});

test('reciter change mid-Surah: same ayah and position, new stream from the new reciter', async () => {
    const { AP, PS, log, settle } = makeEnv({ ayahs: 6 });
    await AP.playNow('surah', 78);
    await settle();
    AP.audio.emit('playing');
    AP.nextAyah(); AP.nextAyah();
    AP.audio._t = AP.session.starts[2] + 0.75;
    await AP.selectReciter('ar.husary', 'الحصري');
    await settle();
    assert.equal(PS.get().ayah, 3);
    assert.ok(PS.get().audioSrc.includes('ar.husary'));
    assert.ok(log.fetches.some(u => u.includes('/ar.husary/78/3.mp3')));
    assert.ok(Math.abs(AP.ayahTime() - 0.75) < 1e-6, 'position kept');
});

test('playback speed is applied to the element and survives a new stream', async () => {
    const { AP, PS, settle } = makeEnv({ ayahs: 3 });
    AP.setPlaybackRate(1.5);
    await AP.playNow('surah', 78);
    await settle();
    assert.equal(AP.audio.playbackRate, 1.5);
    assert.equal(PS.get().rate, 1.5);
    AP.setPlaybackRate(9);
    assert.equal(AP.audio.playbackRate, 2, 'clamped');
});
