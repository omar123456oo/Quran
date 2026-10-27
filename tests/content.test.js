// Offline checks for content/stories.json and content/miracles.json.
// The network check of every reference against the Quran text is tools/verify-content.py.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Meta = require('../mushaf-meta.js');

const load = (f) => JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'content', f), 'utf8'));
const stories = load('stories.json');
const miracles = load('miracles.json');
const counts = Meta.surahs.map(s => s[2]);
const all = [...stories.items.map(i => ['stories', i]), ...miracles.items.map(i => ['miracles', i])];

test('content: expected collections', () => {
    assert.equal(stories.kind, 'stories');
    assert.equal(miracles.kind, 'miracles');
    const names = stories.items.map(i => i.id);
    for (const id of ['adam', 'nuh', 'ibrahim', 'yusuf', 'musa', 'dawud-sulayman', 'yunus', 'isa', 'muhammad']) {
        assert.ok(names.includes(id), id);
    }
    assert.ok(miracles.items.length >= 6);
});

test('content: unique ids, required fields, valid links', () => {
    const ids = new Set();
    const storyIds = new Set(stories.items.map(i => i.id));
    const miracleIds = new Set(miracles.items.map(i => i.id));
    for (const [kind, item] of all) {
        assert.ok(!ids.has(item.id), `duplicate ${item.id}`);
        ids.add(item.id);
        for (const f of ['prophet', 'title', 'icon', 'intro']) assert.ok(item[f] && typeof item[f] === 'string', `${item.id}.${f}`);
        assert.match(item.icon, /^fa-[a-z0-9-]+$/);
        assert.ok(item.sections.length > 0 && item.lessons.length > 0, item.id);
        assert.ok(Number.isInteger(item.minutes) && item.minutes > 0, `${item.id} minutes (run tools/verify-content.py)`);
        (item.related || []).forEach(r => assert.ok(storyIds.has(r), `${item.id} → ${r}`));
        (item.relatedStories || []).forEach(r => assert.ok(storyIds.has(r), `${item.id} → ${r}`));
        if (kind === 'miracles') assert.ok(['quran', 'quran+hadith'].includes(item.basis), `${item.id} basis`);
        assert.ok(storyIds.has(item.id) || miracleIds.has(item.id));
    }
});

test('content: every section cites the Quran with in-range references and expected phrases', () => {
    for (const [, item] of all) {
        for (const sec of item.sections) {
            assert.ok(sec.title && sec.text, `${item.id}: section text`);
            assert.ok(sec.refs.length > 0, `${item.id}/${sec.title}: no reference`);
            for (const r of sec.refs) {
                assert.ok(Number.isInteger(r.s) && r.s >= 1 && r.s <= 114, `${item.id} surah ${r.s}`);
                assert.ok(Number.isInteger(r.from) && Number.isInteger(r.to) && r.from >= 1 && r.from <= r.to && r.to <= counts[r.s - 1],
                    `${item.id} ${r.s}:${r.from}-${r.to}`);
                assert.ok(Array.isArray(r.expect) && r.expect.length > 0, `${item.id} ${r.s}:${r.from} expect`);
            }
        }
    }
});

test('content: hadith only with source and grade; miracles with hadith are marked quran+hadith', () => {
    for (const [kind, item] of all) {
        const withHadith = item.sections.filter(s => s.hadith);
        withHadith.forEach(s => {
            assert.ok(s.hadith.text && s.hadith.source && s.hadith.grade, `${item.id} hadith fields`);
        });
        if (kind === 'miracles') assert.equal(item.basis === 'quran+hadith', withHadith.length > 0, `${item.id} basis vs hadith`);
    }
});

test('content: no Quranic text is stored, only references', () => {
    const text = JSON.stringify([stories, miracles]);
    for (const key of ['"ayahText"', '"arabic"', '"verseText"', '"quran":']) assert.ok(!text.includes(key), key);
    // Uthmani-only characters (small high letters, alef wasla) appear only in Quran text, never in explanations.
    assert.ok(!/[ۖ-ۭٱ]/.test(text), 'Uthmani script found in content');
});

test('content: marked as awaiting scholarly review until signed off', () => {
    for (const doc of [stories, miracles]) {
        assert.ok(doc.review && typeof doc.review.status === 'string');
    }
});
