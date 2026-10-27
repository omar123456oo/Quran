const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Audio = require('../offline-audio.js');
const Mushaf = require('../mushaf-store.js');
const Meta = require('../mushaf-meta.js');

const pages = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/mushaf-pages.json'), 'utf8'));
const counts = Meta.surahs.map(s => s[2]);
const types = (p) => Mushaf.layout(pages[p], Meta).map(s => s.type + (s.surah ? ':' + s.surah : ''));

/* ------------------------------------------------------------ metadata */
test('meta: 114 Surahs with 6236 ayahs, 604 page starts, 30 Juz starts', () => {
    assert.equal(Meta.surahs.length, 114);
    assert.equal(counts.reduce((a, b) => a + b, 0), 6236);
    assert.equal(Meta.pageStart.length, 604);
    assert.equal(Meta.pageStart[0], '1:1');
    assert.equal(Meta.pageStart[603], '112:1');
    assert.equal(Meta.juzStart.length, 30);
    assert.equal(Meta.juzStartPage[0], 1);
    assert.equal(Meta.surahStartPage[1], 2);      // Al-Baqarah
    assert.equal(Meta.surahStartPage[113], 604);  // An-Nas
    assert.equal(Meta.pageBytes.length, 604);
    assert.deepEqual(Meta.basmalaCodes.length, 4);
});

test('meta: Surah and Juz start pages never decrease', () => {
    for (let i = 1; i < 114; i++) assert.ok(Meta.surahStartPage[i] >= Meta.surahStartPage[i - 1]);
    for (let i = 1; i < 30; i++) assert.ok(Meta.juzStartPage[i] > Meta.juzStartPage[i - 1]);
});

/* -------------------------------------------------------------- layout */
test('layout: page 1 — header, then Al-Fatihah on lines 2–8 (basmala is verse 1)', () => {
    assert.deepEqual(types(1), ['header:1', 'text', 'text', 'text', 'text', 'text', 'text', 'text']);
});

test('layout: page 2 — header and basmala above Al-Baqarah', () => {
    assert.deepEqual(types(2).slice(0, 3), ['header:2', 'basmala:2', 'text']);
    assert.equal(types(2).length, 8);
});

test('layout: page 187 — At-Tawbah has a header but no basmala', () => {
    const t = types(187);
    assert.equal(t[0], 'header:9');
    assert.ok(!t.some(x => x.startsWith('basmala')));
    assert.equal(t.length, 15);
});

test('layout: page 76 ends with An-Nisa header; page 77 starts with its basmala', () => {
    assert.equal(types(76)[14], 'header:4');
    assert.deepEqual(types(77).slice(0, 2), ['basmala:4', 'text']);
});

test('layout: page 604 — three Surahs, each with header + basmala', () => {
    assert.deepEqual(types(604), [
        'header:112', 'basmala:112', 'text', 'text',
        'header:113', 'basmala:113', 'text', 'text', 'text',
        'header:114', 'basmala:114', 'text', 'text', 'text', 'text']);
});

test('layout: pages 586/587 — header at page end, two Surah starts on the next page', () => {
    assert.equal(types(586)[14], 'header:82');
    const t = types(587);
    assert.equal(t[0], 'basmala:82');
    assert.ok(t.includes('header:83') && t.includes('basmala:83'));
    assert.ok(!t.includes('empty'));
});

/* ---------------------------------------------------------- validation */
test('validatePage: all fixture pages pass', () => {
    for (const p of Object.keys(pages)) {
        assert.deepEqual(Mushaf.validatePage(Number(p), pages[p], Meta), [], `page ${p}`);
    }
});

test('validatePage: rejects a page with a removed word, wrong number, or missing glyph', () => {
    const clone = (p) => JSON.parse(JSON.stringify(pages[p]));

    const dropped = clone(604);
    dropped.l[2][1].splice(1, 1);               // a word missing from the middle of a line
    assert.ok(Mushaf.validatePage(604, dropped, Meta).length > 0, 'missing word');

    const noEnd = clone(604);
    noEnd.l[2][1] = noEnd.l[2][1].filter(w => !w[3]);   // end markers removed
    assert.ok(Mushaf.validatePage(604, noEnd, Meta).length > 0, 'missing end marker');

    assert.ok(Mushaf.validatePage(603, pages[604], Meta).length > 0);

    const noGlyph = clone(1);
    noGlyph.l[0][1][0][0] = '';
    assert.ok(Mushaf.validatePage(1, noGlyph, Meta).length > 0);

    const missingLine = clone(604);
    missingLine.l.splice(3, 1);                 // a whole text line lost
    assert.ok(Mushaf.validatePage(604, missingLine, Meta).length > 0);
});

test('isWoff2 checks the font signature', () => {
    assert.ok(Mushaf.isWoff2(new Uint8Array([0x77, 0x4F, 0x46, 0x32, 0])));
    assert.ok(!Mushaf.isWoff2(new Uint8Array([0x3C, 0x21, 0x44, 0x4F, 0x43])));   // "<!DOC" error page
});

/* --------------------------------------------------------------- audio */
test('mirrorUrl maps verified reciters only', () => {
    assert.equal(Audio.mirrorUrl('ar.alafasy', 2, 255), 'https://everyayah.com/data/Alafasy_128kbps/002255.mp3');
    assert.equal(Audio.mirrorUrl('ar.mahermuaiqly', 112, 1), 'https://everyayah.com/data/Maher_AlMuaiqly_64kbps/112001.mp3');
    assert.equal(Audio.mirrorUrl('yasser.aldossari', 2, 255), 'https://everyayah.com/data/Yasser_Ad-Dussary_128kbps/002255.mp3');
    assert.ok(Audio.MIRROR_ONLY.has('yasser.aldossari'));
    assert.equal(Audio.mirrorUrl('ar.saadalghamadi', 1, 1), null);
    assert.equal(Audio.mirrorUrl('ar.mahmoudalialbanna', 1, 1), null);
});

test('validateAudio accepts a complete MP3 and rejects bad downloads', () => {
    const mp3 = new Uint8Array(2048); mp3[0] = 0xFF; mp3[1] = 0xFB;
    const id3 = new Uint8Array(2048); id3.set([0x49, 0x44, 0x33]);
    const html = new TextEncoder().encode('<!DOCTYPE html>' + ' '.repeat(2048));
    const ok = { status: 200, contentType: 'audio/mpeg', contentLength: 2048 };
    assert.equal(Audio.validateAudio({ ...ok, bytes: mp3 }), null);
    assert.equal(Audio.validateAudio({ ...ok, bytes: id3 }), null);
    assert.equal(Audio.validateAudio({ ...ok, status: 404, bytes: mp3 }), 'http');
    assert.equal(Audio.validateAudio({ ...ok, contentType: 'text/html', bytes: html }), 'type');
    assert.equal(Audio.validateAudio({ ...ok, contentLength: 4096, bytes: mp3 }), 'length');
    assert.equal(Audio.validateAudio({ ...ok, contentLength: html.length, bytes: html }), 'signature');
    assert.equal(Audio.validateAudio({ ...ok, bytes: mp3.slice(0, 100) }), 'short');
});

test('globalIndex matches the API file numbering', () => {
    assert.equal(Audio.globalIndex(counts, 1, 1), 0);
    assert.equal(Audio.globalIndex(counts, 2, 255) + 1, 262);     // .../ar.alafasy/262.mp3
    assert.equal(Audio.globalIndex(counts, 112, 1) + 1, 6222);
    assert.equal(Audio.globalIndex(counts, 114, 6) + 1, 6236);
});

test('ayahRange covers a page and a Juz exactly', () => {
    const p604 = Audio.ayahRange(counts, Meta.pageStart[603], null);
    assert.equal(p604.length, 4 + 5 + 6);
    assert.deepEqual(p604[0], [112, 1]);
    assert.deepEqual(p604[p604.length - 1], [114, 6]);

    const p1 = Audio.ayahRange(counts, Meta.pageStart[0], Meta.pageStart[1]);
    assert.equal(p1.length, 7);

    const juz30 = Audio.ayahRange(counts, Meta.juzStart[29], null);
    assert.deepEqual(juz30[0], [78, 1]);
    assert.equal(juz30.length, 564);
});
