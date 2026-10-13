/**
 * Playlists & Queue page.
 *
 * Four independent sections (re-rendered separately so typing is never lost):
 *   npSection   — what is playing now
 *   qSection    — upcoming queue of the current listening session
 *   plSection   — saved playlists (reusable, persisted)
 *   pickerSection — all Surahs with Play Now / Play Next / Add to Queue / Add to Playlist
 *
 * Behaviour rules (also shown to the user on the page):
 *   • Starting a saved playlist copies it into the queue; later edits to the playlist do not
 *     change the running session, and a different playlist never mixes into the queue.
 *   • Play Next / Add to Queue only affect the upcoming queue, never the saved playlists.
 */
const PlaylistsUI = {
    pickerFilter: '',
    renameMode: false,
    formError: '',
    drag: null,
    els: {},

    init() {
        const $ = (id) => document.getElementById(id);
        this.els = { np: $('npSection'), q: $('qSection'), pl: $('plSection'), picker: $('pickerSection'), root: $('playlistsContent') };
        if (!this.els.root) return;

        this.els.root.addEventListener('click', (e) => this.onClick(e));
        this.els.root.addEventListener('change', (e) => {
            if (e.target.id === 'plSelect') {
                PlayerState.playlists.select(e.target.value);
                this.renameMode = false;
                PlayerState.touch(['playlists']);
            }
        });
        this.els.root.addEventListener('input', (e) => {
            if (e.target.id === 'pickerSearch') {
                this.pickerFilter = e.target.value.trim();
                this.renderPickerList();
            }
        });
        this.els.root.addEventListener('submit', (e) => this.onSubmit(e));
        this.bindDragAndDrop();

        PlaybackStore.subscribe((state, keys) => {
            if (App.currentPage !== 'playlists') return;
            const has = (...k) => k.some(x => keys.includes(x));
            if (has('playlists', 'meta')) { this.renderPlaylists(); this.renderPickerList(); }
            if (has('queue', 'meta')) this.renderQueue();
            if (has('queue', 'itemId', 'ayah', 'ayahCount', 'status', 'message', 'reciter', 'meta')) this.renderNowPlaying();
            if (has('queue', 'itemId')) this.updateActiveMarkers();
            if (has('time', 'duration')) this.updateProgress();
        });
    },

    show() {
        this.renderNowPlaying();
        this.renderQueue();
        this.renderPlaylists();
        this.renderPicker();
    },

    /* ----------------------------------------------------------- helpers */
    esc: (v) => QuranUtil.esc(v),
    ar: (n) => QuranUtil.toArabicDigits(n),
    label: (kind, ref) => PlayerState.label(kind, ref),

    /** Re-render, then put keyboard focus back on the control that was used. */
    keepFocus(render) {
        const a = document.activeElement;
        const action = a && a.dataset ? a.dataset.action : null;
        const id = a && a.dataset ? a.dataset.id : null;
        render();
        if (!action) return;
        const sel = `[data-action="${action}"]${id ? `[data-id="${CSS.escape(id)}"]` : ''}`;
        const target = this.els.root.querySelector(`${sel}:not([disabled])`);
        if (target) target.focus();
    },

    iconBtn(action, icon, title, extra) {
        const { id, ref, disabled, cls } = extra || {};
        return `<button type="button" class="pl-icon-btn ${cls || ''}" data-action="${action}"
            ${id ? `data-id="${this.esc(id)}"` : ''} ${ref ? `data-ref="${ref}"` : ''}
            title="${this.esc(title)}" aria-label="${this.esc(title)}" ${disabled ? 'disabled' : ''}>
            <i class="fas fa-${icon}" aria-hidden="true"></i></button>`;
    },

    /* ------------------------------------------------------- now playing */
    renderNowPlaying() {
        const el = this.els.np;
        if (!el) return;
        const q = PlayerState.queue;
        const s = PlaybackStore.get();
        const cur = q.current;
        const reciter = AudioPlayer.reciters.find(r => r.id === AudioPlayer.currentReciter);
        const modes = [
            q.shuffle ? 'عشوائي' : null,
            q.repeat === 'one' ? 'تكرار السورة' : q.repeat === 'all' ? 'تكرار القائمة' : null
        ].filter(Boolean);

        if (!cur) {
            el.innerHTML = `
                <h3 id="npHeading">يُشغَّل الآن</h3>
                <p class="pl-empty">لا يوجد تشغيل حالي. ابدأ قائمة محفوظة أو شغّل سورة من القسم الأخير.</p>`;
            return;
        }
        const status = { loading: 'جارٍ التحميل…', buffering: 'جارٍ التخزين المؤقت…', playing: 'قيد التشغيل', paused: 'متوقف مؤقتًا', ended: 'انتهى', error: s.message || 'خطأ', idle: 'متوقف' }[s.status] || '';
        const next = q.upcoming[0];
        el.innerHTML = `
            <h3 id="npHeading">يُشغَّل الآن</h3>
            <div class="np-title arabic-text">${this.esc(this.label(cur.kind, cur.ref))}</div>
            <div class="np-sub">
                ${s.ayah ? `<span>آية ${this.ar(s.ayah)}${s.ayahCount ? ` من ${this.ar(s.ayahCount)}` : ''}</span>` : ''}
                <span>${this.esc(reciter ? reciter.name : '')}</span>
                <span class="np-status ${s.status === 'error' ? 'is-error' : ''}">${this.esc(status)}</span>
                ${modes.map(m => `<span class="pl-tag">${m}</span>`).join('')}
            </div>
            ${q.source ? `<div class="np-sub">من قائمة: <strong>${this.esc(q.source.name)}</strong></div>` : ''}
            <div class="pl-progress" aria-hidden="true"><div id="npBar"></div></div>
            <div class="np-time"><span id="npTime">0:00</span> / <span id="npDuration">0:00</span></div>
            <div class="np-next">${next ? `التالي: ${this.esc(this.label(next.kind, next.ref))}` : 'لا يوجد عنصر تالٍ'}</div>
            <div class="pl-row-actions">
                <button type="button" class="btn btn-secondary" data-action="np-locate"><i class="fas fa-book-open" aria-hidden="true"></i> عرض في القارئ</button>
                <button type="button" class="btn btn-secondary" data-action="np-remove"><i class="fas fa-xmark" aria-hidden="true"></i> إزالة من الجلسة</button>
            </div>`;
        this.updateProgress();
    },

    updateProgress() {
        const bar = document.getElementById('npBar');
        if (!bar) return;
        const s = PlaybackStore.get();
        const ok = Number.isFinite(s.duration) && s.duration > 0;
        bar.style.width = `${ok ? Math.min(100, (s.time / s.duration) * 100) : 0}%`;
        const t = document.getElementById('npTime');
        const d = document.getElementById('npDuration');
        if (t) t.textContent = App.formatTime(s.time || 0);
        if (d) d.textContent = ok ? App.formatTime(s.duration) : '0:00';
    },

    /* ------------------------------------------------------------- queue */
    renderQueue() {
        const el = this.els.q;
        if (!el) return;
        const q = PlayerState.queue;
        const rows = q.upcoming.map((e, i) => `
            <li class="pl-item" draggable="true" data-list="queue" data-index="${i}" data-id="${this.esc(e.id)}">
                <span class="pl-grip" aria-hidden="true"><i class="fas fa-grip-vertical"></i></span>
                <span class="pl-index">${this.ar(i + 1)}</span>
                <span class="pl-name arabic-text">${this.esc(this.label(e.kind, e.ref))}</span>
                <span class="pl-tag">${e.origin === 'playlist' ? 'من القائمة' : 'يدوي'}</span>
                <span class="pl-btns">
                    ${this.iconBtn('queue-skip', 'play', 'تشغيل الآن من الطابور', { id: e.id })}
                    ${this.iconBtn('queue-up', 'arrow-up', 'نقل للأعلى', { id: e.id, disabled: i === 0 })}
                    ${this.iconBtn('queue-down', 'arrow-down', 'نقل للأسفل', { id: e.id, disabled: i === q.upcoming.length - 1 })}
                    ${this.iconBtn('queue-remove', 'xmark', 'إزالة من الطابور', { id: e.id, cls: 'danger' })}
                </span>
            </li>`).join('');
        el.innerHTML = `
            <div class="pl-head">
                <h3 id="qHeading">الطابور القادم <span class="pl-count">(${this.ar(q.upcoming.length)})</span></h3>
                <button type="button" class="btn btn-secondary" data-action="queue-clear" ${q.upcoming.length ? '' : 'disabled'}>
                    <i class="fas fa-broom" aria-hidden="true"></i> مسح القادم
                </button>
            </div>
            <p class="pl-hint">الطابور خاص بجلسة الاستماع الحالية ومنفصل عن قوائمك المحفوظة. تشغيل قائمة جديدة يستبدل الطابور بالكامل، ولا يتأثر الطابور بتعديل القائمة بعد بدء تشغيلها.</p>
            ${q.upcoming.length
                ? `<ol class="pl-list" aria-label="الطابور القادم">${rows}</ol>`
                : '<p class="pl-empty">الطابور القادم فارغ. استخدم «تشغيل التالي» أو «إلى الطابور».</p>'}`;
    },

    /* --------------------------------------------------------- playlists */
    renderPlaylists() {
        const el = this.els.pl;
        if (!el) return;
        const store = PlayerState.playlists;
        const pl = store.selected();
        const q = PlayerState.queue;
        const activeItem = q.source && pl && q.source.id === pl.id && q.current ? q.current.sourceItemId : null;

        const create = `
            <form class="pl-form" data-form="create" aria-label="قائمة جديدة">
                <input name="name" type="text" maxlength="60" required placeholder="اسم قائمة جديدة" aria-label="اسم القائمة">
                <input name="desc" type="text" maxlength="200" placeholder="وصف (اختياري)" aria-label="وصف القائمة">
                <button class="btn btn-primary" type="submit"><i class="fas fa-plus" aria-hidden="true"></i> إنشاء</button>
            </form>
            <div class="pl-error" role="alert">${this.esc(this.formError)}</div>`;

        let body;
        if (!pl) {
            body = '<p class="pl-empty">لا توجد قوائم بعد. أنشئ قائمتك الأولى ثم أضف إليها السور من القسم الأخير.</p>';
        } else {
            const options = store.playlists.map(p =>
                `<option value="${this.esc(p.id)}" ${p.id === pl.id ? 'selected' : ''}>${this.esc(p.name)} (${this.ar(p.items.length)})</option>`).join('');
            const items = pl.items.map((it, i) => `
                <li class="pl-item ${it.id === activeItem ? 'is-active' : ''}" draggable="true" data-list="pl" data-index="${i}" data-id="${this.esc(it.id)}" data-item="${this.esc(it.id)}"
                    ${it.id === activeItem ? 'aria-current="true"' : ''}>
                    <span class="pl-grip" aria-hidden="true"><i class="fas fa-grip-vertical"></i></span>
                    <span class="pl-index">${this.ar(i + 1)}</span>
                    <span class="pl-name arabic-text">${this.esc(this.label(it.kind, it.ref))}</span>
                    <span class="pl-tag pl-now" ${it.id === activeItem ? '' : 'hidden'}>قيد التشغيل</span>
                    <span class="pl-btns">
                        ${this.iconBtn('pl-play-from', 'play', 'تشغيل من هنا', { id: it.id })}
                        ${this.iconBtn('pl-up', 'arrow-up', 'نقل للأعلى', { id: it.id, disabled: i === 0 })}
                        ${this.iconBtn('pl-down', 'arrow-down', 'نقل للأسفل', { id: it.id, disabled: i === pl.items.length - 1 })}
                        ${this.iconBtn('pl-remove', 'xmark', 'إزالة من القائمة', { id: it.id, cls: 'danger' })}
                    </span>
                </li>`).join('');
            body = `
                <div class="pl-select-row">
                    <label for="plSelect">القائمة</label>
                    <select id="plSelect">${options}</select>
                </div>
                ${this.renameMode ? `
                    <form class="pl-form" data-form="rename" aria-label="إعادة تسمية القائمة">
                        <input name="name" type="text" maxlength="60" required value="${this.esc(pl.name)}" aria-label="الاسم الجديد">
                        <input name="desc" type="text" maxlength="200" value="${this.esc(pl.description)}" placeholder="وصف (اختياري)" aria-label="الوصف">
                        <button class="btn btn-primary" type="submit">حفظ</button>
                        <button class="btn btn-secondary" type="button" data-action="pl-rename-cancel">إلغاء</button>
                    </form>` : `
                    <div class="pl-summary">
                        <strong class="arabic-text">${this.esc(pl.name)}</strong>
                        <span class="pl-count">${this.ar(pl.items.length)} ${pl.items.length === 1 ? 'سورة' : 'سور'}</span>
                        ${pl.description ? `<p class="pl-desc">${this.esc(pl.description)}</p>` : ''}
                    </div>`}
                <div class="pl-row-actions">
                    <button type="button" class="btn btn-primary" data-action="pl-play" ${pl.items.length ? '' : 'disabled'}><i class="fas fa-play-circle" aria-hidden="true"></i> تشغيل القائمة</button>
                    <button type="button" class="btn btn-secondary" data-action="pl-rename"><i class="fas fa-pen" aria-hidden="true"></i> إعادة تسمية</button>
                    <button type="button" class="btn btn-secondary danger" data-action="pl-delete"><i class="fas fa-trash" aria-hidden="true"></i> حذف</button>
                </div>
                ${pl.items.length
                    ? `<ol class="pl-list" aria-label="سور القائمة بالترتيب">${items}</ol>`
                    : '<p class="pl-empty">القائمة فارغة. أضف سورًا من القسم الأخير.</p>'}`;
        }
        el.innerHTML = `<h3 id="plHeading">قوائمي المحفوظة</h3>${create}${body}`;
    },

    /** Only toggles the "now playing" marker of the open playlist — no re-render, so inputs keep their text. */
    updateActiveMarkers() {
        const q = PlayerState.queue;
        const pl = PlayerState.playlists.selected();
        const activeItem = q.source && pl && q.source.id === pl.id && q.current ? q.current.sourceItemId : null;
        this.els.pl.querySelectorAll('.pl-item[data-list="pl"]').forEach(li => {
            const on = li.dataset.item === activeItem;
            li.classList.toggle('is-active', on);
            if (on) li.setAttribute('aria-current', 'true'); else li.removeAttribute('aria-current');
            const tag = li.querySelector('.pl-now');
            if (tag) tag.hidden = !on;
        });
    },

    /* ------------------------------------------------------------ picker */
    renderPicker() {
        const el = this.els.picker;
        if (!el) return;
        el.innerHTML = `
            <h3 id="pickerHeading">السور</h3>
            <input id="pickerSearch" class="pl-search" type="search" placeholder="ابحث عن سورة بالاسم أو الرقم" aria-label="بحث عن سورة" value="${this.esc(this.pickerFilter)}">
            <div id="pickerList"></div>`;
        this.renderPickerList();
    },

    renderPickerList() {
        const box = document.getElementById('pickerList');
        if (!box) return;
        const surahs = QuranDisplay.surahs || [];
        if (!surahs.length) {
            box.innerHTML = '<p class="pl-empty">جارٍ تحميل قائمة السور…</p>';
            return;
        }
        const f = this.pickerFilter.toLowerCase();
        const list = f
            ? surahs.filter(s => String(s.number) === f || s.name.includes(this.pickerFilter) || s.englishName.toLowerCase().includes(f))
            : surahs;
        if (!list.length) {
            box.innerHTML = '<p class="pl-empty">لا توجد نتائج مطابقة.</p>';
            return;
        }
        box.innerHTML = `<ul class="pl-list picker" aria-label="قائمة السور">${list.map(s => `
            <li class="pl-item">
                <span class="pl-index">${this.ar(s.number)}</span>
                <span class="pl-name"><span class="arabic-text">${this.esc(s.name)}</span> <small>${this.esc(s.englishName)}</small></span>
                <span class="pl-btns">
                    ${this.iconBtn('p-now', 'play', `تشغيل ${s.englishName} الآن`, { ref: s.number })}
                    ${this.iconBtn('p-next', 'forward-step', `تشغيل ${s.englishName} بعد الحالي`, { ref: s.number })}
                    ${this.iconBtn('p-queue', 'list-ol', `إضافة ${s.englishName} إلى الطابور`, { ref: s.number })}
                    ${this.iconBtn('p-add', 'folder-plus', `إضافة ${s.englishName} إلى القائمة المحددة`, { ref: s.number })}
                </span>
            </li>`).join('')}</ul>`;
    },

    /* ----------------------------------------------------------- actions */
    onClick(e) {
        const btn = e.target.closest('[data-action]');
        if (!btn || btn.disabled) return;
        const { action, id } = btn.dataset;
        const ref = parseInt(btn.dataset.ref, 10);
        const store = PlayerState.playlists;
        const pl = store.selected();

        switch (action) {
            case 'np-locate': QuranDisplay.jumpToPlaying(); break;
            case 'np-remove': AudioPlayer.removeCurrent(); break;

            case 'queue-skip': AudioPlayer.skipToQueued(id); break;
            case 'queue-up': this.keepFocus(() => AudioPlayer.moveQueued(id, -1)); break;
            case 'queue-down': this.keepFocus(() => AudioPlayer.moveQueued(id, 1)); break;
            case 'queue-remove': AudioPlayer.removeQueued(id); break;
            case 'queue-clear':
                if (confirm('هل تريد مسح كل العناصر القادمة من الطابور؟ لن يتوقف التشغيل الحالي.')) AudioPlayer.clearUpcoming();
                break;

            case 'pl-play': if (pl) AudioPlayer.playPlaylist(pl.id); break;
            case 'pl-play-from': if (pl) AudioPlayer.playPlaylist(pl.id, id); break;
            case 'pl-up': if (pl) this.keepFocus(() => { store.moveItem(pl.id, id, -1); PlayerState.touch(['playlists']); }); break;
            case 'pl-down': if (pl) this.keepFocus(() => { store.moveItem(pl.id, id, 1); PlayerState.touch(['playlists']); }); break;
            case 'pl-remove': if (pl) { store.removeItem(pl.id, id); PlayerState.touch(['playlists']); } break;
            case 'pl-rename': this.renameMode = true; this.renderPlaylists(); this.focusField('[data-form="rename"] input[name="name"]'); break;
            case 'pl-rename-cancel': this.renameMode = false; this.renderPlaylists(); break;
            case 'pl-delete':
                if (pl && confirm(`هل تريد حذف القائمة «${pl.name}» نهائيًا؟ لا يمكن التراجع عن ذلك.`)) {
                    store.remove(pl.id);
                    this.renameMode = false;
                    PlayerState.touch(['playlists']);
                    App.showToast('تم حذف القائمة', 'success');
                }
                break;

            case 'p-now': AudioPlayer.playNow('surah', ref); break;
            case 'p-next': AudioPlayer.playNextItem('surah', ref); break;
            case 'p-queue': AudioPlayer.addToQueue('surah', ref); break;
            case 'p-add': this.addSurahToSelected(ref); break;
        }
    },

    onSubmit(e) {
        const form = e.target.closest('form[data-form]');
        if (!form) return;
        e.preventDefault();
        const name = form.elements.name.value;
        const desc = form.elements.desc.value;
        const store = PlayerState.playlists;
        try {
            if (form.dataset.form === 'create') {
                store.create(name, desc);
                App.showToast('تم إنشاء القائمة', 'success');
            } else {
                const pl = store.selected();
                if (pl) store.rename(pl.id, name, desc);
                this.renameMode = false;
            }
            this.formError = '';
            PlayerState.touch(['playlists']);
            if (form.dataset.form === 'create') this.focusField('[data-form="create"] input[name="name"]');
        } catch (err) {
            this.formError = err.message;
            this.renderPlaylists();
        }
    },

    focusField(selector) {
        const f = this.els.pl.querySelector(selector);
        if (f) f.focus();
    },

    /** Add a Surah to the selected playlist (asks before adding a duplicate). */
    addSurahToSelected(surah) {
        const store = PlayerState.playlists;
        const pl = store.selected();
        if (!pl) {
            App.showToast('أنشئ قائمة تشغيل أولًا ثم أضف إليها', 'info');
            App.navigateToPage('playlists');
            this.focusField('[data-form="create"] input[name="name"]');
            return;
        }
        if (store.hasSurah(pl.id, surah) &&
            !confirm(`«${this.label('surah', surah)}» موجودة بالفعل في «${pl.name}». هل تريد إضافتها مرة أخرى؟`)) {
            return;
        }
        try {
            store.addItem(pl.id, 'surah', surah);
        } catch (err) {
            App.showToast(err.message, 'error');
            return;
        }
        PlayerState.touch(['playlists']);
        App.showToast(`أُضيفت ${this.label('surah', surah)} إلى «${pl.name}»`, 'success');
    },

    /* -------------------------------------------------- drag and drop (mouse/touch-pointer) */
    bindDragAndDrop() {
        const root = this.els.root;
        root.addEventListener('dragstart', (e) => {
            const li = e.target.closest && e.target.closest('.pl-item[data-list]');
            if (!li) return;
            this.drag = { list: li.dataset.list, index: parseInt(li.dataset.index, 10) };
            li.classList.add('is-dragging');
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', li.dataset.id);
        });
        root.addEventListener('dragover', (e) => {
            const li = e.target.closest && e.target.closest('.pl-item[data-list]');
            if (!li || !this.drag || li.dataset.list !== this.drag.list) return;
            e.preventDefault();
            root.querySelectorAll('.drop-target').forEach(x => x.classList.remove('drop-target'));
            li.classList.add('drop-target');
        });
        root.addEventListener('drop', (e) => {
            const li = e.target.closest && e.target.closest('.pl-item[data-list]');
            if (!li || !this.drag || li.dataset.list !== this.drag.list) return;
            e.preventDefault();
            const from = this.drag.index;
            const to = parseInt(li.dataset.index, 10);
            this.drag = null;
            this.cleanupDrag();
            if (from === to) return;
            if (li.dataset.list === 'queue') {
                AudioPlayer.reorderQueued(from, to);
            } else {
                const pl = PlayerState.playlists.selected();
                if (pl && PlayerState.playlists.reorder(pl.id, from, to)) PlayerState.touch(['playlists']);
            }
        });
        root.addEventListener('dragend', () => { this.drag = null; this.cleanupDrag(); });
    },

    cleanupDrag() {
        this.els.root.querySelectorAll('.is-dragging, .drop-target').forEach(x => x.classList.remove('is-dragging', 'drop-target'));
    }
};

window.PlaylistsUI = PlaylistsUI;
