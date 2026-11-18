// Full-Surah continuous playback: double-buffered, gapless hand-off between ayah files.
// The real engine (audio-player.js) is loaded into a vm sandbox with a mock <audio>.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const AYAH_COUNTS = { 108: 3, 112: 4, 2: 286 };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function makeEnv() {
    const log = { srcSets: [], plays: [], toasts: [], loads: 0 };

    class MockAudio {
        constructor() {
            this._src = null; this.paused = true; this.volume = 1; this.muted = false;
            this.currentTime = 0; this.duration = NaN; this.error = null; this.preload = 'auto';
            this.listeners = {}; this.rejectPlay = null; this.id = MockAudio.n = (MockAudio.n || 0) + 1;
        }
        set src(v) { this._src = v; log.srcSets.push({ el: this.id, src: v }); }
        get src() { return this._src || ''; }
        getAttribute(n) { return n === 'src' ? this._src : null; }
        removeAttribute(n) { if (n === 'src') this._src = null; }
        addEventListener(e, fn) { (this.listeners[e] = this.listeners[e] || []).push(fn); }
        emit(e) { (this.listeners[e] || []).forEach(fn => fn({ target: this })); }
        load() { log.loads++; }
        pause() { this.paused = true; }
        play() {
            if (this.rejectPlay) { const e = new Error('blocked'); e.name = this.rejectPlay; return Promise.reject(e); }
            this.paused = false; log.plays.push({ el: this.id, src: this._src });
            return Promise.resolve();
        }
    }

    const store = {};
    const sb = {
        console, Date, URL, Promise, Math, Number, Object, Array, String, JSON, Set, Map,
        setTimeout: (fn, ms) => { const t = setTimeout(fn, Math.min(ms, 5)); if (t.unref) t.unref(); return t; },
        clearTimeout,
        Audio: MockAudio,
        localStorage: { getItem: k => store[k] || null, setItem: (k, v) => { store[k] = String(v); } },
        navigator: { onLine: true },
        confirm: () => true,
        document: {
            getElementById: () => null, querySelectorAll: () => [], addEventListener() {},
            body: { classList: { add() {}, remove() {}, toggle() {} } }
        },
        App: {
            settings: { defaultReciter: 'ar.alafasy' },
            showToast: (m, t) => log.toasts.push({ m, t }),
            saveSettings() {}, showLoading() {}, hideLoading() {},
            formatTime: s => String(s), navigateToPage() {}
        },
        APIService: {
            async getSurah(ref, reciter) {
                const n = AYAH_COUNTS[ref] || 7;
                return {
                    number: ref,
                    ayahs: Array.from({ length: n }, (_, i) => ({
                        number: i + 1, numberInSurah: i + 1, text: `t${i + 1}`, page: 1, juz: 1,
                        surah: { number: ref },
                        audio: `https://cdn.example/${reciter}/${ref}/${i + 1}.mp3`
                    }))
                };
            }
        }
    };
    sb.window = sb;
    sb.self = sb;
    sb.addEventListener = () => {};
    vm.createContext(sb);
    for (const f of ['play-queue.js', 'playlists.js', 'playback-store.js', 'audio-player.js']) {
        vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), sb, { filename: f });
    }
    sb.AudioPlayer.init();
    return { sb, AP: sb.AudioPlayer, PS: sb.PlaybackStore, log, MockAudio };
}

const ayahOf = (src) => Number(String(src).match(/(\d+)\.mp3$/)[1]);

test('full Surah: every ayah plays once, in order, with the next one buffered before the boundary', async () => {
    const { AP, PS, log } = makeEnv();
    await AP.playNow('surah', 108);
    AP.audio.emit('playing');

    for (let i = 1; i <= 3; i++) {
        assert.equal(PS.get().ayah, i);
        assert.equal(PS.get().ayahCount, 3);
        if (i < 3) {
            // The following ayah is already loading in the standby element while this one plays.
            assert.ok(AP.nextAudio.getAttribute('src').endsWith(`/${i + 1}.mp3`), `ayah ${i + 1} must be preloaded`);
        }
        AP.audio.emit('ended');
        await sleep(2);
        if (i < 3) AP.audio.emit('playing');
    }

    assert.deepEqual(log.plays.map(p => ayahOf(p.src)), [1, 2, 3], 'exact order, no skip, no repeat');
    // Each file URL is assigned to an element exactly once: no re-fetch/src swap at any boundary.
    assert.deepEqual(log.srcSets.map(s => ayahOf(s.src)).sort(), [1, 2, 3]);
    assert.equal(PS.get().status, 'ended', 'stops only after the last ayah');
});

test('the audible element and the standby element swap roles at the boundary', async () => {
    const { AP } = makeEnv();
    await AP.playNow('surah', 108);
    AP.audio.emit('playing');
    const first = AP.audio, standby = AP.nextAudio;
    first.emit('ended');
    await sleep(2);
    assert.equal(AP.audio, standby, 'preloaded element became the audible one');
    assert.equal(AP.nextAudio, first);
    assert.ok(!first.getAttribute('src') || first.getAttribute('src').endsWith('/3.mp3'), 'finished element is recycled as the next buffer');
    assert.equal(AP.ayahIndex, 1);
});

test('events from the standby element never change playback state', async () => {
    const { AP, PS } = makeEnv();
    await AP.playNow('surah', 108);
    AP.audio.emit('playing');
    AP.nextAudio.error = { code: 2 };
    AP.nextAudio.emit('error');
    AP.nextAudio.emit('waiting');
    AP.nextAudio.emit('pause');
    assert.equal(PS.get().status, 'playing');
    assert.equal(AP.ayahIndex, 0);
});

test('failed preload falls back to the regular load path (no skip, no repeat)', async () => {
    const { AP, PS, log } = makeEnv();
    await AP.playNow('surah', 108);
    AP.audio.emit('playing');
    const first = AP.audio;
    AP.nextAudio.error = { code: 2 };
    first.emit('ended');
    await sleep(2);
    assert.equal(AP.audio, first, 'no swap when the standby is broken');
    assert.equal(PS.get().ayah, 2);
    assert.ok(first.getAttribute('src').endsWith('/2.mp3'));
    assert.equal(log.plays.filter(p => ayahOf(p.src) === 2).length, 1);
});

test('autoplay refusal on the standby element reverts to the regular path', async () => {
    const { AP, PS } = makeEnv();
    await AP.playNow('surah', 108);
    AP.audio.emit('playing');
    const first = AP.audio;
    AP.nextAudio.rejectPlay = 'NotAllowedError';      // e.g. iOS: only the tapped element may play
    first.emit('ended');
    await sleep(10);
    assert.equal(AP.audio, first, 'roles restored');
    assert.equal(PS.get().ayah, 2);
    assert.ok(first.getAttribute('src').endsWith('/2.mp3'));
});

test('Single Ayah mode stops after the selected ayah and Play replays that same ayah', async () => {
    const { AP, PS, log } = makeEnv();
    AP.setPlayMode('single');
    await AP.playAyah(112, 2);
    AP.audio.emit('playing');
    assert.equal(PS.get().ayah, 2);
    assert.equal(AP.nextAudio.getAttribute('src'), null, 'nothing is preloaded in single mode');
    AP.audio.emit('ended');
    await sleep(2);
    assert.equal(PS.get().status, 'ended');
    assert.equal(PS.get().ayah, 2, 'did not advance');
    assert.deepEqual(log.plays.map(p => ayahOf(p.src)), [2]);
    AP.play();
    await sleep(2);
    assert.deepEqual(log.plays.map(p => ayahOf(p.src)), [2, 2], 'replays the same ayah only');
});

test('Full Surah mode started from a selected ayah continues to the end', async () => {
    const { AP, PS, log } = makeEnv();
    await AP.playAyah(112, 3);
    AP.audio.emit('playing');
    AP.audio.emit('ended'); await sleep(2); AP.audio.emit('playing');
    AP.audio.emit('ended'); await sleep(2);
    assert.deepEqual(log.plays.map(p => ayahOf(p.src)), [3, 4]);
    assert.equal(PS.get().status, 'ended');
});

test('switching modes mid-playback: single clears the buffer, surah re-buffers the next ayah', async () => {
    const { AP, PS } = makeEnv();
    await AP.playNow('surah', 112);
    AP.audio.emit('playing');
    assert.ok(AP.nextAudio.getAttribute('src').endsWith('/2.mp3'));
    AP.setPlayMode('single');
    assert.equal(AP.nextAudio.getAttribute('src'), null);
    assert.equal(PS.get().playMode, 'single');
    AP.setPlayMode('surah');
    assert.ok(AP.nextAudio.getAttribute('src').endsWith('/2.mp3'));
    assert.equal(PS.get().playMode, 'surah');
});

test('pause and resume keep the same ayah; next/previous step exactly one ayah', async () => {
    const { AP, PS } = makeEnv();
    await AP.playNow('surah', 112);
    AP.audio.emit('playing');
    AP.pause(); AP.audio.emit('pause');
    assert.equal(PS.get().status, 'paused');
    AP.play();
    assert.equal(PS.get().ayah, 1, 'resume does not move');
    AP.audio.emit('playing');
    assert.equal(AP.nextAyah(), true);
    assert.equal(PS.get().ayah, 2);
    assert.equal(AP.nextAyah(), true);
    assert.equal(PS.get().ayah, 3);
    assert.equal(AP.previousAyah(), true);
    assert.equal(PS.get().ayah, 2);
    assert.ok(AP.nextAudio.getAttribute('src').endsWith('/3.mp3'), 'buffer follows the new position');
});

test('changing reciter mid-Surah keeps the ayah and re-buffers from the new reciter', async () => {
    const { AP, PS } = makeEnv();
    await AP.playNow('surah', 112);
    AP.audio.emit('playing');
    AP.nextAyah(); AP.audio.emit('playing');
    assert.equal(PS.get().ayah, 2);
    await AP.selectReciter('ar.husary', 'الحصري');
    await sleep(2);
    assert.equal(PS.get().ayah, 2, 'same ayah');
    assert.ok(AP.audio.getAttribute('src').includes('ar.husary') && AP.audio.getAttribute('src').endsWith('/2.mp3'));
    assert.ok(AP.nextAudio.getAttribute('src').includes('ar.husary') && AP.nextAudio.getAttribute('src').endsWith('/3.mp3'));
});

test('transient failure is retried, then the ayah is skipped with a notice and the Surah continues', async () => {
    const { AP, PS, log } = makeEnv();
    await AP.playNow('surah', 112);
    AP.audio.emit('playing');
    for (let i = 0; i < 3; i++) { AP.audio.error = { code: 2 }; AP.audio.emit('error'); await sleep(15); }
    assert.equal(PS.get().ayah, 2, 'moved on after 2 retries failed');
    assert.ok(log.toasts.some(t => t.t === 'error' && /الآية/.test(t.m)), 'user is told which ayah failed');
    assert.equal(log.srcSets.filter(s => ayahOf(s.src) === 1).length >= 1, true);
});

test('offline failure does not skip ayahs; it stops with an error so nothing is lost', async () => {
    const { AP, PS, sb } = makeEnv();
    await AP.playNow('surah', 112);
    AP.audio.emit('playing');
    sb.navigator.onLine = false;
    for (let i = 0; i < 3; i++) { AP.audio.error = { code: 2 }; AP.audio.emit('error'); await sleep(15); }
    assert.equal(PS.get().status, 'error');
    assert.equal(PS.get().ayah, 1);
});

test('long Surah (Al-Baqarah, 286 ayahs): all played once in order, one src assignment each', async () => {
    const { AP, PS, log } = makeEnv();
    await AP.playNow('surah', 2);
    AP.audio.emit('playing');
    for (let i = 1; i <= 286; i++) {
        assert.equal(PS.get().ayah, i);
        AP.audio.emit('ended');
        await sleep(0);
        if (i < 286) AP.audio.emit('playing');
    }
    assert.deepEqual(log.plays.map(p => ayahOf(p.src)), Array.from({ length: 286 }, (_, i) => i + 1));
    assert.equal(log.srcSets.length, 286, 'each ayah file requested exactly once');
    assert.equal(PS.get().status, 'ended');
});

test('a duplicate ended event for the same ayah cannot skip an ayah', async () => {
    const { AP, PS } = makeEnvFixed();
    function makeEnvFixed() { return makeEnv(); }
    await AP.playNow('surah', 112);
    AP.audio.emit('playing');
    const first = AP.audio;
    first.emit('ended');
    first.emit('ended');          // stale element fires again: it is no longer the audible one
    await sleep(2);
    assert.equal(PS.get().ayah, 2);
    assert.equal(AP.ayahIndex, 1);
});


