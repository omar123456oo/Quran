/**
 * OfflineDB — promise wrapper over the app's IndexedDB database.
 *
 * Stores:
 *   resources  download records for audio (id "audio:<reciter>:<surah>")
 *   pages      verified, compact Mushaf page data (key: page number)
 *
 * Binary files (MP3s, page fonts) are kept in the Cache API, not here.
 */
(function (root) {
    const DB_NAME = 'quran-offline';
    const DB_VERSION = 1;
    let dbPromise = null;

    function open() {
        if (dbPromise) return dbPromise;
        dbPromise = new Promise((resolve, reject) => {
            if (!root.indexedDB) { reject(new Error('IndexedDB unavailable')); return; }
            const req = indexedDB.open(DB_NAME, DB_VERSION);
            req.onupgradeneeded = () => {
                const db = req.result;
                if (!db.objectStoreNames.contains('resources')) db.createObjectStore('resources', { keyPath: 'id' });
                if (!db.objectStoreNames.contains('pages')) db.createObjectStore('pages', { keyPath: 'p' });
            };
            req.onsuccess = () => {
                const db = req.result;
                db.onversionchange = () => db.close();
                resolve(db);
            };
            req.onerror = () => reject(req.error);
            req.onblocked = () => reject(new Error('IndexedDB blocked by another tab'));
        });
        dbPromise.catch(() => { dbPromise = null; });
        return dbPromise;
    }

    async function tx(store, mode, fn) {
        const db = await open();
        return new Promise((resolve, reject) => {
            const t = db.transaction(store, mode);
            const s = t.objectStore(store);
            let result;
            const r = fn(s);
            if (r) r.onsuccess = () => { result = r.result; };
            t.oncomplete = () => resolve(result);
            t.onerror = () => reject(t.error);
            t.onabort = () => reject(t.error || new Error('Transaction aborted'));
        });
    }

    root.OfflineDB = {
        open,
        get: (store, key) => tx(store, 'readonly', s => s.get(key)),
        getAll: (store) => tx(store, 'readonly', s => s.getAll()),
        getAllKeys: (store) => tx(store, 'readonly', s => s.getAllKeys()),
        put: (store, value) => tx(store, 'readwrite', s => s.put(value)),
        delete: (store, key) => tx(store, 'readwrite', s => s.delete(key)),
        /** Delete many keys in one transaction. */
        deleteMany: (store, keys) => tx(store, 'readwrite', s => { keys.forEach(k => s.delete(k)); return null; })
    };
})(window);
