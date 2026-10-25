/**
 * Downloads page — "التنزيلات": storage status, offline Surah audio, offline Mushaf pages,
 * and a backup of reading data. Also keeps the download buttons on the Surah list in sync.
 */
const Downloads = {
    rendered: false,

    init() {
        OfflineAudio.init();
        MushafStore.init();
        OfflineAudio.subscribe(() => { this.refreshCards(); if (App.currentPage === 'downloads') this.renderAudio(); });
        MushafStore.subscribe(() => { if (App.currentPage === 'downloads') this.renderMushaf(); });
        PlaybackStore.subscribe((state, keys) => { if (keys.includes('reciter')) this.refreshCards(); });
        window.addEventListener('online', () => App.currentPage === 'downloads' && this.renderStorage());
        window.addEventListener('offline', () => App.currentPage === 'downloads' && this.renderStorage());

        // Surah list download buttons (cards are re-rendered by QuranDisplay; use delegation)
        const list = document.getElementById('surahList');
        if (list) list.addEventListener('click', (e) => {
            const b = e.target.closest('[data-dl-surah]');
            if (!b) return;
            e.stopPropagation();
            this.onCardButton(Number(b.dataset.dlSurah));
        });
        OfflineAudio.ready.then(() => {
            // Storage can be evicted by the browser: re-check what we claim is available.
            OfflineAudio.list().filter(r => r.status === 'complete').forEach(r => OfflineAudio.verify(r));
            MushafStore.verifyAll();
        });
    },

    /* ---------------------------------------------------------- helpers */
    n: (x) => QuranUtil.toArabicDigits(x),

    formatBytes(b) {
        if (!Number.isFinite(b) || b <= 0) return '٠ ميجابايت';
        if (b < 1e6) return `${QuranUtil.toArabicDigits(Math.max(1, Math.round(b / 1e3)))} كيلوبايت`;
        const mb = b / 1e6;
        const v = mb < 10 ? mb.toFixed(1) : Math.round(mb).toString();
        return `${QuranUtil.toArabicDigits(v).replace('.', '٫')} ميجابايت`;
    },

    surahName: (s) => (MushafMeta.surahs[s - 1] || [`سورة ${s}`])[0],
    reciterName: (id) => { const r = AudioPlayer.reciters.find(x => x.id === id); return r ? r.name : id; },

    /* ------------------------------------------------------ Surah cards */
    cardButton(surah) {
        const reciter = AudioPlayer.currentReciter;
        const name = this.surahName(surah);
        if (!OfflineAudio.canDownload(reciter)) {
            return `<button type="button" class="surah-dl" data-dl-surah="${surah}" data-state="unsupported" title="التنزيل غير متاح لهذا القارئ" aria-label="التنزيل غير متاح لهذا القارئ"><i class="fas fa-ban" aria-hidden="true"></i></button>`;
        }
        const r = OfflineAudio.get(reciter, surah);
        const state = !r ? 'none' : r.status;
        const icon = { none: 'fa-download', downloading: 'fa-spinner fa-spin', complete: 'fa-circle-check', failed: 'fa-triangle-exclamation' }[state];
        const label = {
            none: `تنزيل ${name} للاستماع دون اتصال`,
            downloading: `جارٍ تنزيل ${name} — اضغط للإلغاء`,
            complete: `${name} محفوظة للاستماع دون اتصال`,
            failed: `فشل تنزيل ${name} — اضغط لإعادة المحاولة`
        }[state];
        const pct = state === 'downloading' ? `<span class="surah-dl-pct">${this.n(Math.floor((r.progress || 0) * 100))}٪</span>` : '';
        return `<button type="button" class="surah-dl" data-dl-surah="${surah}" data-state="${state}" title="${label}" aria-label="${label}"><i class="fas ${icon}" aria-hidden="true"></i>${pct}</button>`;
    },

    refreshCards() {
        document.querySelectorAll('#surahList [data-dl-surah]').forEach(b => {
            b.outerHTML = this.cardButton(Number(b.dataset.dlSurah));
        });
    },

    onCardButton(surah) {
        const reciter = AudioPlayer.currentReciter;
        const r = OfflineAudio.get(reciter, surah);
        if (!OfflineAudio.canDownload(reciter)) {
            App.showToast(`لا يتوفر مصدر تنزيل موثّق لصوت ${this.reciterName(reciter)}. اختر قارئًا آخر للتنزيل`, 'info');
        } else if (!r) {
            this.startAudio(surah, reciter);
        } else if (r.status === 'downloading') {
            if (confirm(`إلغاء تنزيل ${this.surahName(surah)}؟ ستُحذف الملفات التي نُزّلت جزئيًا.`)) OfflineAudio.cancel(r.id);
        } else if (r.status === 'failed') {
            this.run(OfflineAudio.retry(r.id), surah);
        } else {
            App.navigateToPage('downloads');
        }
    },

    /* --------------------------------------------------------- actions */
    startAudio(surah, reciter) {
        const name = this.surahName(surah);
        const count = MushafMeta.surahs[surah - 1][2];
        if (navigator.onLine === false) { App.showToast('يلزم الاتصال بالإنترنت لتنزيل السورة', 'error'); return; }
        if (!confirm(`تنزيل ${name} بصوت ${this.reciterName(reciter)} (${this.n(count)} ملفًا صوتيًا، ملف لكل آية) للاستماع دون اتصال؟\nيظهر الحجم الفعلي أثناء التنزيل.`)) return;
        this.run(OfflineAudio.download(surah, reciter), surah);
    },

    run(promise, surah) {
        Promise.resolve(promise).then((rec) => {
            if (rec && rec.status === 'complete') {
                App.showToast(`اكتمل تنزيل ${this.surahName(surah)} (${this.formatBytes(rec.bytes)}) وتم التحقق منه`, 'success');
            }
        }).catch((e) => App.showToast(`${this.surahName(surah)}: ${e.message}`, 'error'));
    },

    async startMushaf(pages, label) {
        await MushafStore.init();
        const left = [...new Set([1, ...pages])].filter(p => !MushafStore.isDownloaded(p));
        if (!left.length) { App.showToast(`${label} محفوظ بالفعل`, 'info'); return; }
        if (navigator.onLine === false) { App.showToast('يلزم الاتصال بالإنترنت للتنزيل', 'error'); return; }
        if (MushafStore.job && MushafStore.job.status === 'running') { App.showToast('يوجد تنزيل للمصحف قيد التنفيذ', 'info'); return; }
        const size = this.formatBytes(MushafStore.estimate(left));
        if (!confirm(`تنزيل ${label}: ${this.n(left.length)} صفحة، تحتاج نحو ${size} من مساحة التخزين في المتصفح.\nمتابعة؟`)) return;
        App.showToast(`بدأ تنزيل ${label}`, 'info');
        let job;
        try {
            job = await MushafStore.download(pages);
        } catch (e) {
            App.showToast('تعذر بدء التنزيل', 'error');
            return;
        }
        if (job.status === 'done') App.showToast(`اكتمل تنزيل ${label} وتم التحقق منه`, 'success');
        else if (job.status === 'cancelled') App.showToast(`أُلغي التنزيل. حُفظت ${this.n(job.done)} صفحة مكتملة`, 'info');
        else App.showToast(`${MushafStore.message(job.lastError)} — لم تُنزَّل ${this.n(job.failed.length)} صفحة`, 'error');
        if (App.currentPage === 'mushaf') DigitalMushaf.updateAvailability();
    },

    /* ------------------------------------------------------------ page */
    show() {
        const root = document.getElementById('downloadsContent');
        if (!root) return;
        if (!this.rendered) {
            this.rendered = true;
            root.innerHTML = `
                <section class="dl-card" id="dlStorage" aria-labelledby="dlStorageH"></section>
                <section class="dl-card" aria-labelledby="dlAudioH">
                    <h3 id="dlAudioH"><i class="fas fa-headphones" aria-hidden="true"></i> السور الصوتية</h3>
                    <form class="dl-form" id="dlAudioForm">
                        <label>السورة <select id="dlAudioSurah">${MushafMeta.surahs.map((s, i) => `<option value="${i + 1}">${this.n(i + 1)}. ${QuranUtil.esc(s[0])}</option>`).join('')}</select></label>
                        <label>القارئ <select id="dlAudioReciter"></select></label>
                        <button type="submit" class="btn btn-primary"><i class="fas fa-download" aria-hidden="true"></i> تنزيل</button>
                    </form>
                    <div id="dlAudioList" class="dl-list" aria-live="polite"></div>
                </section>
                <section class="dl-card" aria-labelledby="dlMushafH">
                    <h3 id="dlMushafH"><i class="fas fa-book-quran" aria-hidden="true"></i> صفحات المصحف</h3>
                    <div id="dlMushaf"></div>
                </section>
                <section class="dl-card" aria-labelledby="dlBackupH">
                    <h3 id="dlBackupH"><i class="fas fa-floppy-disk" aria-hidden="true"></i> نسخة احتياطية لبيانات القراءة</h3>
                    <p class="dl-note">تشمل العلامات المرجعية في المصحف والقارئ، وآخر صفحة وآية قرأتها، وإعدادات القراءة. لا تشمل الملفات المنزّلة.</p>
                    <div class="dl-actions">
                        <button type="button" class="btn btn-secondary" id="dlExport"><i class="fas fa-file-export" aria-hidden="true"></i> تصدير</button>
                        <label class="btn btn-secondary dl-file"><i class="fas fa-file-import" aria-hidden="true"></i> استيراد
                            <input type="file" id="dlImport" accept="application/json,.json"></label>
                    </div>
                </section>`;
            document.getElementById('dlAudioForm').addEventListener('submit', (e) => {
                e.preventDefault();
                const surah = Number(document.getElementById('dlAudioSurah').value);
                const reciter = document.getElementById('dlAudioReciter').value;
                const r = OfflineAudio.get(reciter, surah);
                if (r && r.status === 'complete') { App.showToast('هذه السورة محفوظة بالفعل لهذا القارئ', 'info'); return; }
                if (r && r.status === 'downloading') { App.showToast('التنزيل قيد التنفيذ', 'info'); return; }
                this.startAudio(surah, reciter);
            });
            root.addEventListener('click', (e) => this.onClick(e));
            document.getElementById('dlExport').addEventListener('click', () => this.exportData());
            document.getElementById('dlImport').addEventListener('change', (e) => this.importData(e));
        }
        const sel = document.getElementById('dlAudioReciter');
        sel.innerHTML = AudioPlayer.reciters.map(r => `<option value="${r.id}" ${OfflineAudio.canDownload(r.id) ? '' : 'disabled'} ${r.id === AudioPlayer.currentReciter ? 'selected' : ''}>${QuranUtil.esc(r.name)}${OfflineAudio.canDownload(r.id) ? '' : ' — التنزيل غير متاح'}</option>`).join('');
        if (sel.selectedOptions[0] && sel.selectedOptions[0].disabled) {
            const first = [...sel.options].find(o => !o.disabled);
            if (first) first.selected = true;
        }
        this.renderStorage();
        this.renderAudio();
        this.renderMushaf();
    },

    async renderStorage() {
        const el = document.getElementById('dlStorage');
        if (!el) return;
        let usage = 0, quota = 0, persisted = false;
        try {
            if (navigator.storage && navigator.storage.estimate) ({ usage = 0, quota = 0 } = await navigator.storage.estimate());
            if (navigator.storage && navigator.storage.persisted) persisted = await navigator.storage.persisted();
        } catch (e) { /* unsupported */ }
        const pct = quota ? Math.min(100, usage / quota * 100) : 0;
        const sw = navigator.serviceWorker && navigator.serviceWorker.controller;
        const online = navigator.onLine !== false;
        el.innerHTML = `
            <h3 id="dlStorageH"><i class="fas fa-hard-drive" aria-hidden="true"></i> التخزين على هذا الجهاز</h3>
            <div class="dl-status-row">
                <span class="dl-pill ${online ? 'is-ok' : 'is-warn'}"><i class="fas ${online ? 'fa-wifi' : 'fa-plane'}" aria-hidden="true"></i> ${online ? 'متصل بالإنترنت' : 'غير متصل'}</span>
                <span class="dl-pill ${sw ? 'is-ok' : 'is-warn'}"><i class="fas ${sw ? 'fa-circle-check' : 'fa-circle-info'}" aria-hidden="true"></i> ${sw ? 'واجهة التطبيق متاحة دون اتصال' : 'وضع العمل دون اتصال غير مفعّل بعد (يتطلب HTTPS أو localhost)'}</span>
            </div>
            ${quota ? `<div class="dl-meter" role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(pct)}" aria-label="المساحة المستخدمة">
                <div class="dl-meter-bar" style="width:${pct.toFixed(1)}%"></div></div>
            <p class="dl-note">المستخدم: ${this.formatBytes(usage)} من ${this.formatBytes(quota)} متاحة للمتصفح · الصوت: ${this.formatBytes(OfflineAudio.totalBytes())} · المصحف: ${this.formatBytes(MushafStore.storedBytes())} (تقريبي)</p>` : ''}
            <p class="dl-note">تُحفظ التنزيلات داخل المتصفح وليست ملفات مستقلة على الجهاز. قد يحذفها المتصفح عند امتلاء المساحة أو إذا مسحت بيانات الموقع.
            ${persisted ? '<strong>التخزين محمي من الحذف التلقائي.</strong>' : ''}</p>
            ${!persisted && navigator.storage && navigator.storage.persist ? '<button type="button" class="btn btn-secondary" data-act="persist"><i class="fas fa-shield-halved" aria-hidden="true"></i> طلب حماية التنزيلات من الحذف التلقائي</button>' : ''}`;
    },

    renderAudio() {
        const el = document.getElementById('dlAudioList');
        if (!el) return;
        const recs = OfflineAudio.list();
        if (!recs.length) {
            el.innerHTML = '<p class="dl-empty">لا توجد سور منزّلة بعد. اختر سورة وقارئًا أعلاه، أو استخدم زر <i class="fas fa-download" aria-hidden="true"></i> في قائمة السور.</p>';
            return;
        }
        const order = { downloading: 0, failed: 1, complete: 2 };
        recs.sort((a, b) => (order[a.status] - order[b.status]) || a.surah - b.surah);
        el.innerHTML = recs.map(r => {
            const pct = Math.floor((r.status === 'complete' ? 1 : (r.progress || 0)) * 100);
            const status = r.status === 'complete' ? `<span class="dl-ok"><i class="fas fa-circle-check" aria-hidden="true"></i> محفوظة · ${this.formatBytes(r.bytes)}</span>`
                : r.status === 'downloading' ? `<span>جارٍ التنزيل ${this.n(pct)}٪ · ${this.n(r.done || 0)}/${this.n(r.total || 0)} آية · ${this.formatBytes(r.bytes)}</span>`
                : `<span class="dl-err"><i class="fas fa-triangle-exclamation" aria-hidden="true"></i> ${QuranUtil.esc(OfflineAudio.message(r.error))}${r.total ? ` (${this.n(r.done || 0)}/${this.n(r.total)})` : ''}</span>`;
            const actions = r.status === 'complete'
                ? `<button type="button" class="btn btn-secondary" data-act="play" data-id="${r.id}"><i class="fas fa-play" aria-hidden="true"></i> تشغيل</button>
                   <button type="button" class="btn btn-secondary" data-act="delete" data-id="${r.id}"><i class="fas fa-trash" aria-hidden="true"></i> حذف</button>`
                : r.status === 'downloading'
                ? `<button type="button" class="btn btn-secondary" data-act="cancel" data-id="${r.id}"><i class="fas fa-xmark" aria-hidden="true"></i> إلغاء</button>`
                : `<button type="button" class="btn btn-primary" data-act="retry" data-id="${r.id}"><i class="fas fa-rotate-right" aria-hidden="true"></i> إعادة المحاولة</button>
                   <button type="button" class="btn btn-secondary" data-act="delete" data-id="${r.id}"><i class="fas fa-trash" aria-hidden="true"></i> حذف</button>`;
            return `<div class="dl-item" data-status="${r.status}">
                <div class="dl-item-main">
                    <strong class="arabic-text">${QuranUtil.esc(this.surahName(r.surah))}</strong>
                    <small>${QuranUtil.esc(this.reciterName(r.reciter))}</small>
                    ${r.status === 'downloading' ? `<div class="dl-progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><div style="width:${pct}%"></div></div>` : ''}
                    <div class="dl-item-status">${status}</div>
                </div>
                <div class="dl-actions">${actions}</div>
            </div>`;
        }).join('');
    },

    renderMushaf() {
        const el = document.getElementById('dlMushaf');
        if (!el) return;
        const done = MushafStore.downloaded.size;
        const job = MushafStore.job;
        const n = this.n;
        const all = DigitalMushaf.pageRange(1, 604);
        const juzOpts = Array.from({ length: 30 }, (_, i) => `<option value="${i + 1}">الجزء ${n(i + 1)}</option>`).join('');
        const surahOpts = MushafMeta.surahs.map((s, i) => `<option value="${i + 1}">${n(i + 1)}. ${QuranUtil.esc(s[0])}</option>`).join('');
        let jobHtml = '';
        if (job && job.status === 'running') {
            const pct = job.total ? Math.floor((job.done + job.failed.length) / job.total * 100) : 0;
            jobHtml = `<div class="dl-job">
                <div class="dl-progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}" aria-label="تقدم تنزيل المصحف"><div style="width:${pct}%"></div></div>
                <p>جارٍ التنزيل: ${n(job.done)} من ${n(job.total)} صفحة${job.failed.length ? ` · تعذّر ${n(job.failed.length)}` : ''}</p>
                <button type="button" class="btn btn-secondary" data-act="mushaf-cancel"><i class="fas fa-xmark" aria-hidden="true"></i> إيقاف التنزيل</button>
            </div>`;
        } else if (job && job.status === 'failed' && job.failed.length) {
            jobHtml = `<div class="dl-job is-failed"><p class="dl-err"><i class="fas fa-triangle-exclamation" aria-hidden="true"></i> ${QuranUtil.esc(MushafStore.message(job.lastError))} — لم تُنزَّل ${n(job.failed.length)} صفحة.</p>
                <button type="button" class="btn btn-primary" data-act="mushaf-retry"><i class="fas fa-rotate-right" aria-hidden="true"></i> إعادة محاولة الصفحات المتبقية</button></div>`;
        }
        const busy = job && job.status === 'running';
        el.innerHTML = `
            <p class="dl-summary"><strong>${n(done)}</strong> من ٦٠٤ صفحة محفوظة · ${this.formatBytes(MushafStore.storedBytes())}</p>
            <div class="dl-meter" aria-hidden="true"><div class="dl-meter-bar" style="width:${(done / 604 * 100).toFixed(1)}%"></div></div>
            <p class="dl-note">${QuranUtil.esc(MushafMeta.edition.name)} — ٦٠٤ صفحة، ١٥ سطرًا. المصدر: Quran.com (خطوط مجمع الملك فهد KFGQPC V1). تُحفظ الصفحة الأولى دائمًا لأن خطها يُستخدم في رسم البسملة.</p>
            ${jobHtml}
            <div class="dl-grid" ${busy ? 'aria-disabled="true"' : ''}>
                <div class="dl-box">
                    <h4>المصحف كاملًا</h4>
                    <p class="dl-note">نحو ${this.formatBytes(MushafStore.estimate(all))} متبقية للتنزيل.</p>
                    <button type="button" class="btn btn-primary" data-act="mushaf-all" ${busy || done === 604 ? 'disabled' : ''}>${done === 604 ? 'محفوظ كاملًا' : 'تنزيل المصحف كاملًا'}</button>
                </div>
                <form class="dl-box" data-form="juz">
                    <h4>جزء</h4>
                    <select name="juz" aria-label="اختر الجزء">${juzOpts}</select>
                    <div class="dl-actions"><button type="submit" class="btn btn-secondary" ${busy ? 'disabled' : ''}>تنزيل</button>
                    <button type="button" class="btn btn-secondary" data-act="mushaf-del-juz">حذف</button></div>
                </form>
                <form class="dl-box" data-form="surah">
                    <h4>سورة</h4>
                    <select name="surah" aria-label="اختر السورة">${surahOpts}</select>
                    <div class="dl-actions"><button type="submit" class="btn btn-secondary" ${busy ? 'disabled' : ''}>تنزيل صفحاتها</button></div>
                </form>
                <form class="dl-box" data-form="range">
                    <h4>نطاق صفحات</h4>
                    <div class="dl-range">
                        <label>من <input type="number" name="from" min="1" max="604" value="${DigitalMushaf.currentPage}" required inputmode="numeric"></label>
                        <label>إلى <input type="number" name="to" min="1" max="604" value="${Math.min(604, DigitalMushaf.currentPage + 19)}" required inputmode="numeric"></label>
                    </div>
                    <div class="dl-actions"><button type="submit" class="btn btn-secondary" ${busy ? 'disabled' : ''}>تنزيل</button>
                    <button type="button" class="btn btn-secondary" data-act="mushaf-del-range">حذف</button></div>
                </form>
            </div>
            ${done ? `<button type="button" class="btn btn-secondary dl-danger" data-act="mushaf-del-all" ${busy ? 'disabled' : ''}><i class="fas fa-trash" aria-hidden="true"></i> حذف كل صفحات المصحف المحفوظة</button>` : ''}`;
        el.querySelectorAll('form[data-form]').forEach(f => f.addEventListener('submit', (e) => { e.preventDefault(); this.onMushafForm(f); }));
    },

    rangeFrom(form) {
        let a = parseInt(form.elements.from.value, 10), b = parseInt(form.elements.to.value, 10);
        if (!(a >= 1 && a <= 604 && b >= 1 && b <= 604)) { App.showToast('أدخل أرقام صفحات بين ١ و٦٠٤', 'error'); return null; }
        if (a > b) [a, b] = [b, a];
        return [a, b];
    },

    onMushafForm(form) {
        const n = this.n;
        if (form.dataset.form === 'juz') {
            const j = Number(form.elements.juz.value);
            this.startMushaf(DigitalMushaf.pageRange(...DigitalMushaf.juzPages(j)), `الجزء ${n(j)}`);
        } else if (form.dataset.form === 'surah') {
            const s = Number(form.elements.surah.value);
            this.startMushaf(DigitalMushaf.pageRange(...DigitalMushaf.surahPages(s)), `صفحات ${this.surahName(s)}`);
        } else {
            const r = this.rangeFrom(form);
            if (r) this.startMushaf(DigitalMushaf.pageRange(...r), `الصفحات ${n(r[0])}–${n(r[1])}`);
        }
    },

    async onClick(e) {
        const b = e.target.closest('[data-act]');
        if (!b) return;
        const id = b.dataset.id;
        const rec = id && OfflineAudio.records.get(id);
        const n = this.n;
        switch (b.dataset.act) {
            case 'play':
                if (rec) {
                    if (rec.reciter !== AudioPlayer.currentReciter) {
                        AudioPlayer.setReciter(rec.reciter);
                        App.showToast(`القارئ: ${this.reciterName(rec.reciter)}`, 'info');
                    }
                    AudioPlayer.playNow('surah', rec.surah);
                }
                break;
            case 'delete':
                if (rec && confirm(`حذف ${this.surahName(rec.surah)} (${this.reciterName(rec.reciter)}) من الجهاز؟`)) {
                    await OfflineAudio.remove(id);
                    App.showToast('تم الحذف', 'success');
                }
                break;
            case 'cancel':
                if (rec) await OfflineAudio.cancel(id);
                break;
            case 'retry':
                if (rec) this.run(OfflineAudio.retry(id), rec.surah);
                break;
            case 'persist':
                try {
                    const ok = await navigator.storage.persist();
                    App.showToast(ok ? 'تمت حماية التنزيلات من الحذف التلقائي' : 'لم يوافق المتصفح على طلب الحماية الآن', ok ? 'success' : 'info');
                } catch (err) { App.showToast('المتصفح لا يدعم هذا الطلب', 'info'); }
                this.renderStorage();
                break;
            case 'mushaf-cancel': MushafStore.cancel(); break;
            case 'mushaf-retry': {
                const job = MushafStore.job;
                if (job) this.startMushaf(job.failed.slice(), 'الصفحات المتبقية');
                break;
            }
            case 'mushaf-all': this.startMushaf(DigitalMushaf.pageRange(1, 604), 'المصحف كاملًا'); break;
            case 'mushaf-del-all':
                if (confirm('حذف كل صفحات المصحف المحفوظة من هذا الجهاز؟')) {
                    await MushafStore.remove(DigitalMushaf.pageRange(1, 604));
                    App.showToast('تم حذف صفحات المصحف', 'success');
                }
                break;
            case 'mushaf-del-juz': {
                const j = Number(b.closest('form').elements.juz.value);
                if (confirm(`حذف صفحات الجزء ${n(j)} المحفوظة؟`)) {
                    const c = await MushafStore.remove(DigitalMushaf.pageRange(...DigitalMushaf.juzPages(j)));
                    App.showToast(`حُذفت ${n(c)} صفحة`, 'success');
                }
                break;
            }
            case 'mushaf-del-range': {
                const r = this.rangeFrom(b.closest('form'));
                if (r && confirm(`حذف الصفحات ${n(r[0])}–${n(r[1])} المحفوظة؟`)) {
                    const c = await MushafStore.remove(DigitalMushaf.pageRange(...r));
                    App.showToast(`حُذفت ${n(c)} صفحة`, 'success');
                }
                break;
            }
        }
        if (b.dataset.act !== 'persist') this.renderStorage();
    },

    /* ----------------------------------------------------------- backup */
    BACKUP_KEYS: ['mushaf_bookmarks', 'mushaf_last_page', 'mushaf_prefs', 'quran_bookmarks', 'quran_last_read'],

    async exportData() {
        const data = { app: 'quran-kareem', version: 1, exportedAt: new Date().toISOString(), items: {} };
        this.BACKUP_KEYS.forEach(k => { const v = localStorage.getItem(k); if (v !== null) data.items[k] = v; });
        const text = JSON.stringify(data, null, 2);
        const name = `quran-reading-backup-${new Date().toISOString().slice(0, 10)}.json`;
        try {
            if (window.showSaveFilePicker) {
                const handle = await window.showSaveFilePicker({ suggestedName: name, types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }] });
                const w = await handle.createWritable();
                await w.write(text); await w.close();
                App.showToast('تم حفظ النسخة الاحتياطية', 'success');
                return;
            }
        } catch (e) {
            if (e && e.name === 'AbortError') return;
        }
        const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
        const a = document.createElement('a');
        a.href = url; a.download = name;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        App.showToast('تم تنزيل ملف النسخة الاحتياطية', 'success');
    },

    importData(event) {
        const file = event.target.files && event.target.files[0];
        event.target.value = '';
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            let data;
            try { data = JSON.parse(reader.result); } catch (e) { data = null; }
            if (!data || data.app !== 'quran-kareem' || !data.items || typeof data.items !== 'object') {
                App.showToast('الملف ليس نسخة احتياطية صالحة لهذا التطبيق', 'error');
                return;
            }
            const valid = {};
            for (const k of this.BACKUP_KEYS) {
                const v = data.items[k];
                if (typeof v !== 'string') continue;
                if (k === 'mushaf_last_page') { const p = parseInt(v, 10); if (p >= 1 && p <= 604) valid[k] = String(p); continue; }
                try { JSON.parse(v); valid[k] = v; } catch (e) { /* skip unreadable entry */ }
            }
            if (!Object.keys(valid).length) { App.showToast('لا توجد بيانات قابلة للاستيراد في الملف', 'error'); return; }
            if (!confirm('سيستبدل الاستيراد العلامات المرجعية وموضع القراءة الحاليين. متابعة؟')) return;
            Object.entries(valid).forEach(([k, v]) => localStorage.setItem(k, v));
            if (typeof Bookmarks !== 'undefined') Bookmarks.loadFromStorage();
            DigitalMushaf.loadPrefs();
            DigitalMushaf.updateBookmarkButton();
            App.showToast('تم استيراد بيانات القراءة', 'success');
        };
        reader.readAsText(file);
    }
};

window.Downloads = Downloads;
