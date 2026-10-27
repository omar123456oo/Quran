const test = require('node:test');
const assert = require('node:assert/strict');
const PlayQueue = require('../play-queue.js');
const PlaylistStore = require('../playlists.js');

const mkPlaylist = (surahs, name = 'P') => {
    const s = new PlaylistStore();
    const pl = s.create(name);
    surahs.forEach(n => s.addItem(pl.id, 'surah', n));
    return { store: s, pl };
};
const refs = (list) => list.map(e => e.ref);
// deterministic rng
const seqRng = (vals) => { let i = 0; return () => vals[i++ % vals.length]; };

test('create playlist, add several surahs, keep order and allow duplicates', () => {
    const { store, pl } = mkPlaylist([1, 2, 3, 4]);
    store.addItem(pl.id, 'surah', 2);
    assert.deepEqual(refs(pl.items), [1, 2, 3, 4, 2]);
    assert.equal(new Set(pl.items.map(i => i.id)).size, 5, 'duplicate surah gets its own id');
    assert.equal(store.hasSurah(pl.id, 2), true);
    assert.throws(() => store.addItem(pl.id, 'surah', 115));
    assert.throws(() => store.create('   '));
});

test('playlist reorder, move, remove, rename', () => {
    const { store, pl } = mkPlaylist([1, 2, 3]);
    store.moveItem(pl.id, pl.items[2].id, -2);
    assert.deepEqual(refs(pl.items), [3, 1, 2]);
    assert.equal(store.moveItem(pl.id, pl.items[0].id, -1), false, 'cannot move above first');
    store.removeItem(pl.id, pl.items[1].id);
    assert.deepEqual(refs(pl.items), [3, 2]);
    store.rename(pl.id, '  جديد  ', 'وصف');
    assert.equal(pl.name, 'جديد');
});

test('sequential playback follows exact playlist order and finishes', () => {
    const { pl } = mkPlaylist([1, 2, 3, 4]);
    const q = new PlayQueue();
    assert.equal(q.startPlaylist(pl).ref, 1);
    const played = [q.current.ref];
    let r;
    while ((r = q.advance({ natural: true })).item) played.push(r.item.ref);
    assert.deepEqual(played, [1, 2, 3, 4]);
    assert.equal(r.finished, true);
    assert.equal(q.current.ref, 4, 'last item is retained, nothing restarts');
    assert.equal(q.advance({ natural: true }).finished, true);
});

test('start from a middle item: earlier items go to history for Previous', () => {
    const { pl } = mkPlaylist([1, 2, 3, 4]);
    const q = new PlayQueue();
    q.startPlaylist(pl, pl.items[2].id);
    assert.equal(q.current.ref, 3);
    assert.deepEqual(refs(q.upcoming), [4]);
    assert.equal(q.previous().item.ref, 2);
    assert.deepEqual(refs(q.upcoming), [3, 4]);
});

test('Play Now / Play Next / Add to Queue', () => {
    const { pl } = mkPlaylist([1, 2, 3]);
    const q = new PlayQueue();
    q.startPlaylist(pl);
    q.addToQueue('surah', 50);
    q.playNext('surah', 60);
    q.playNext('surah', 61);
    assert.deepEqual(refs(q.upcoming), [61, 60, 2, 3, 50], 'latest Play Next goes first; Add goes last');
    assert.equal(q.current.ref, 1, 'current not interrupted');
    q.playNow('surah', 99);
    assert.equal(q.current.ref, 99);
    assert.equal(q.history.at(-1).ref, 1);
    assert.deepEqual(refs(q.upcoming), [61, 60, 2, 3, 50], 'queue continues after Play Now');
});

test('empty queue: Add / Play Next become current', () => {
    const q = new PlayQueue();
    const r = q.addToQueue('surah', 5);
    assert.equal(r.becameCurrent, true);
    assert.equal(q.current.ref, 5);
    assert.equal(q.advance({ natural: true }).finished, true);
});

test('reorder / remove / clear upcoming leaves current alone', () => {
    const q = new PlayQueue();
    q.playNow('surah', 1);
    [2, 3, 4, 5].forEach(n => q.addToQueue('surah', n));
    q.moveUpcoming(q.upcoming[3].id, -3);
    assert.deepEqual(refs(q.upcoming), [5, 2, 3, 4]);
    q.removeUpcoming(q.upcoming[1].id);
    assert.deepEqual(refs(q.upcoming), [5, 3, 4]);
    assert.equal(q.removeUpcoming('nope'), false);
    assert.equal(q.reorderUpcoming(0, 9), false);
    assert.equal(q.clearUpcoming(), 3);
    assert.equal(q.current.ref, 1);
    assert.equal(q.advance({ natural: true }).finished, true, 'empty queue finishes gracefully');
});

test('skipTo moves skipped items to history', () => {
    const q = new PlayQueue();
    q.playNow('surah', 1);
    [2, 3, 4].forEach(n => q.addToQueue('surah', n));
    q.skipTo(q.upcoming[1].id);
    assert.equal(q.current.ref, 3);
    assert.deepEqual(refs(q.history), [1, 2]);
    assert.deepEqual(refs(q.upcoming), [4]);
});

test('starting another playlist replaces the queue (no mixing)', () => {
    const a = mkPlaylist([1, 2, 3], 'A');
    const b = mkPlaylist([10, 11], 'B');
    const q = new PlayQueue();
    q.startPlaylist(a.pl);
    q.startPlaylist(b.pl);
    assert.deepEqual([q.current.ref, ...refs(q.upcoming)], [10, 11]);
    assert.equal(q.source.id, b.pl.id);
    assert.equal(q.history.length, 0);
});

test('queue is a snapshot: editing the playlist does not change the running session', () => {
    const { store, pl } = mkPlaylist([1, 2, 3]);
    const q = new PlayQueue();
    q.startPlaylist(pl);
    store.removeItem(pl.id, pl.items[1].id);
    store.remove(pl.id);
    assert.deepEqual(refs(q.upcoming), [2, 3]);
});

test('repeat one replays on natural end only; Next skips it', () => {
    const { pl } = mkPlaylist([1, 2]);
    const q = new PlayQueue();
    q.startPlaylist(pl);
    q.setRepeat('one');
    const r = q.advance({ natural: true });
    assert.equal(r.replay, true);
    assert.equal(r.item.ref, 1);
    assert.equal(q.advance({ natural: false }).item.ref, 2, 'manual next leaves repeat-one item');
});

test('repeat all restarts the playlist in original order; repeat off stops', () => {
    const { pl } = mkPlaylist([1, 2, 3]);
    const q = new PlayQueue();
    q.startPlaylist(pl);
    q.setRepeat('all');
    const seen = [q.current.ref];
    for (let i = 0; i < 5; i++) seen.push(q.advance({ natural: true }).item.ref);
    assert.deepEqual(seen, [1, 2, 3, 1, 2, 3]);
    q.setRepeat('off');
    q.advance({ natural: true }); q.advance({ natural: true });
    assert.equal(q.advance({ natural: true }).finished, true);
});

test('repeat all with a single item replays it', () => {
    const q = new PlayQueue();
    q.playNow('surah', 7);
    q.setRepeat('all');
    const r = q.advance({ natural: true });
    assert.equal(r.item.ref, 7);
    assert.equal(r.looped, true);
});

test('shuffle randomises play order but keeps the saved playlist untouched; unshuffle restores order', () => {
    const { pl } = mkPlaylist([1, 2, 3, 4, 5]);
    const q = new PlayQueue({ rng: seqRng([0.1, 0.9, 0.4, 0.7]) });
    q.setShuffle(true);
    q.startPlaylist(pl);
    const order = [q.current.ref, ...refs(q.upcoming)];
    assert.deepEqual(order.slice().sort(), [1, 2, 3, 4, 5]);
    assert.notDeepEqual(order, [1, 2, 3, 4, 5]);
    assert.deepEqual(refs(pl.items), [1, 2, 3, 4, 5]);
    assert.equal(new Set(order).size, 5, 'no repeats within a shuffled pass');
    q.setShuffle(false);
    const rest = refs(q.upcoming);
    assert.deepEqual(rest, rest.slice().sort((a, b) => a - b));
});

test('shuffle toggled mid-playback does not touch current and does not duplicate', () => {
    const q = new PlayQueue();
    q.playNow('surah', 1);
    [2, 3, 4, 5, 6].forEach(n => q.addToQueue('surah', n));
    q.setShuffle(true);
    assert.equal(q.current.ref, 1);
    assert.deepEqual(refs(q.upcoming).sort(), [2, 3, 4, 5, 6]);
    q.setShuffle(false);
    assert.deepEqual(refs(q.upcoming), [2, 3, 4, 5, 6]);
});

test('first/last item edges: Previous with no history, Next at the end', () => {
    const { pl } = mkPlaylist([1, 2]);
    const q = new PlayQueue();
    q.startPlaylist(pl);
    assert.equal(q.previous().item, null);
    assert.equal(q.current.ref, 1);
    q.advance({ natural: false });
    assert.equal(q.advance({ natural: false }).finished, true);
    assert.equal(q.current.ref, 2);
});

test('removing the current item moves on; removing the last one empties current', () => {
    const q = new PlayQueue();
    q.playNow('surah', 1);
    q.addToQueue('surah', 2);
    assert.equal(q.removeCurrent().ref, 2);
    assert.equal(q.removeCurrent(), null);
    assert.equal(q.current, null);
});

test('same surah repeated in a playlist plays each entry once per pass', () => {
    const { pl } = mkPlaylist([2, 2, 3, 2]);
    const q = new PlayQueue();
    q.startPlaylist(pl);
    const seen = [q.current.ref];
    let r;
    while ((r = q.advance({ natural: true })).item) seen.push(r.item.ref);
    assert.deepEqual(seen, [2, 2, 3, 2]);
});

test('persistence: snapshot/restore round-trips and rejects corrupted data', () => {
    const { store, pl } = mkPlaylist([1, 2, 3]);
    const q = new PlayQueue();
    q.startPlaylist(pl); q.setRepeat('all'); q.setShuffle(false);
    const copy = JSON.parse(JSON.stringify(q.snapshot()));
    const q2 = new PlayQueue();
    q2.restore(copy);
    assert.equal(q2.current.ref, 1);
    assert.deepEqual(refs(q2.upcoming), [2, 3]);
    assert.equal(q2.repeat, 'all');
    assert.equal(q2.source.name, 'P');

    const bad = new PlayQueue();
    bad.restore({ current: { kind: 'surah', ref: 999 }, upcoming: [null, 5, { kind: 'x', ref: 1 }, { kind: 'surah', ref: '7' }], repeat: 'bogus', source: { type: 'evil', id: 1 } });
    assert.equal(bad.current, null);
    assert.deepEqual(refs(bad.upcoming), [7]);
    assert.equal(bad.repeat, 'off');
    assert.equal(bad.source, null);
    bad.restore('garbage'); bad.restore(null);

    const s2 = new PlaylistStore();
    s2.restore({ playlists: [{ id: 'a', name: '<b>x</b>', items: [{ kind: 'surah', ref: 1 }, { kind: 'surah', ref: 0 }, 'z'] }, { name: '' }, null], selectedId: 'missing' });
    assert.equal(s2.playlists.length, 1);
    assert.equal(s2.playlists[0].items.length, 1);
    assert.equal(s2.selectedId, 'a');
    s2.restore({ playlists: 'nope' });
    assert.equal(s2.playlists.length, 0);
    assert.deepEqual(new PlaylistStore().snapshot(), { playlists: [], selectedId: null });
    assert.ok(store);
});
