/**
 * PlaylistStore — saved, reusable collections of Surahs (pure logic, no DOM).
 * Items are { id, kind:'surah', ref:<1..114> } with stable ids, so the same Surah
 * may appear more than once and reordering never relies on names or indexes.
 */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory(require('./play-queue.js'));
    else root.PlaylistStore = factory(root.PlayQueue);
})(typeof self !== 'undefined' ? self : this, function (PlayQueue) {
    const MAX_PLAYLISTS = 100;
    const MAX_ITEMS = 500;
    const NAME_MAX = 60;
    const DESC_MAX = 200;

    const cleanText = (s, max) => String(s == null ? '' : s)
        .replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);

    class PlaylistStore {
        constructor() {
            this.playlists = [];
            this.selectedId = null;
        }

        get(id) { return this.playlists.find(p => p.id === id) || null; }
        selected() { return this.get(this.selectedId); }

        select(id) {
            if (id !== null && !this.get(id)) return false;
            this.selectedId = id;
            return true;
        }

        create(name, description) {
            const n = cleanText(name, NAME_MAX);
            if (!n) throw new Error('اسم القائمة مطلوب');
            if (this.playlists.length >= MAX_PLAYLISTS) throw new Error('تم الوصول للحد الأقصى من القوائم');
            const now = Date.now();
            const pl = { id: PlayQueue.uid('pl'), name: n, description: cleanText(description, DESC_MAX), items: [], createdAt: now, updatedAt: now };
            this.playlists.push(pl);
            this.selectedId = pl.id;
            return pl;
        }

        rename(id, name, description) {
            const pl = this.get(id);
            if (!pl) return false;
            const n = cleanText(name, NAME_MAX);
            if (!n) throw new Error('اسم القائمة مطلوب');
            pl.name = n;
            if (description !== undefined) pl.description = cleanText(description, DESC_MAX);
            pl.updatedAt = Date.now();
            return true;
        }

        remove(id) {
            const idx = this.playlists.findIndex(p => p.id === id);
            if (idx < 0) return false;
            this.playlists.splice(idx, 1);
            if (this.selectedId === id) this.selectedId = this.playlists.length ? this.playlists[0].id : null;
            return true;
        }

        /** Always appends a new item, so duplicates are possible; callers confirm with the user. */
        addItem(id, kind, ref) {
            const pl = this.get(id);
            if (!pl) throw new Error('القائمة غير موجودة');
            if (kind !== 'surah' || !PlayQueue.isValidRef(kind, ref)) throw new RangeError('عنصر غير صالح');
            if (pl.items.length >= MAX_ITEMS) throw new Error('القائمة ممتلئة');
            const item = { id: PlayQueue.uid('pi'), kind, ref };
            pl.items.push(item);
            pl.updatedAt = Date.now();
            return item;
        }

        hasSurah(id, ref) {
            const pl = this.get(id);
            return !!pl && pl.items.some(i => i.ref === ref);
        }

        removeItem(id, itemId) {
            const pl = this.get(id);
            if (!pl) return false;
            const idx = pl.items.findIndex(i => i.id === itemId);
            if (idx < 0) return false;
            pl.items.splice(idx, 1);
            pl.updatedAt = Date.now();
            return true;
        }

        moveItem(id, itemId, delta) {
            const pl = this.get(id);
            if (!pl) return false;
            const idx = pl.items.findIndex(i => i.id === itemId);
            return idx < 0 ? false : this.reorder(id, idx, idx + delta);
        }

        reorder(id, from, to) {
            const pl = this.get(id);
            if (!pl) return false;
            const n = pl.items.length;
            if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || from >= n || to < 0 || to >= n) return false;
            if (from !== to) {
                const [it] = pl.items.splice(from, 1);
                pl.items.splice(to, 0, it);
                pl.updatedAt = Date.now();
            }
            return true;
        }

        snapshot() {
            return { playlists: this.playlists, selectedId: this.selectedId };
        }

        /** Restore from untrusted persisted data; invalid playlists/items are dropped. */
        restore(raw) {
            this.playlists = [];
            this.selectedId = null;
            if (!raw || !Array.isArray(raw.playlists)) return;
            const ids = new Set();
            for (const p of raw.playlists.slice(0, MAX_PLAYLISTS)) {
                if (!p || typeof p !== 'object') continue;
                const name = cleanText(p.name, NAME_MAX);
                if (!name) continue;
                let id = typeof p.id === 'string' && /^[\w-]{1,80}$/.test(p.id) ? p.id : PlayQueue.uid('pl');
                if (ids.has(id)) id = PlayQueue.uid('pl');
                ids.add(id);
                const itemIds = new Set();
                const items = (Array.isArray(p.items) ? p.items : []).slice(0, MAX_ITEMS).map(i => {
                    const ref = i && typeof i.ref === 'string' ? parseInt(i.ref, 10) : i && i.ref;
                    if (!i || i.kind !== 'surah' || !PlayQueue.isValidRef('surah', ref)) return null;
                    let iid = typeof i.id === 'string' && /^[\w-]{1,80}$/.test(i.id) ? i.id : PlayQueue.uid('pi');
                    if (itemIds.has(iid)) iid = PlayQueue.uid('pi');
                    itemIds.add(iid);
                    return { id: iid, kind: 'surah', ref };
                }).filter(Boolean);
                this.playlists.push({
                    id, name, description: cleanText(p.description, DESC_MAX), items,
                    createdAt: Number.isFinite(p.createdAt) ? p.createdAt : Date.now(),
                    updatedAt: Number.isFinite(p.updatedAt) ? p.updatedAt : Date.now()
                });
            }
            this.selectedId = this.get(raw.selectedId) ? raw.selectedId : (this.playlists[0] ? this.playlists[0].id : null);
        }
    }

    return PlaylistStore;
});
