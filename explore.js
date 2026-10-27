/**
 * Explore — the home "discover" band and its pages:
 *   - Makki / Madani Surah explorer (classification from the bundled verified metadata)
 *   - Stories of the Prophets and Miracles of the Prophets (content/*.json)
 *   - one reading page for both, showing the verified Uthmani text of each reference
 *
 * Content files store only references ({s, from, to}); the Quranic text is fetched from the
 * same Quran API the reader uses and checked to be exactly the requested ayahs.
 */
const ContentStore = {
    docs: {},
    pending: {},

    /**
     * Loaded as a script (content/<kind>.js, generated from the JSON) rather than with
     * fetch(), so it also works when index.html is opened directly from disk (file://).
     */
    load(kind) {
        if (this.docs[kind]) return Promise.resolve(this.docs[kind]);
        if (this.pending[kind]) return this.pending[kind];
        const ready = () => {
            const doc = window.QuranContentData && window.QuranContentData[kind];
            if (!doc || !Array.isArray(doc.items)) throw new Error('Bad content file');
            this.docs[kind] = doc;
            return doc;
        };
        this.pending[kind] = new Promise((resolve, reject) => {
            if (window.QuranContentData && window.QuranContentData[kind]) { resolve(); return; }
            const s = document.createElement('script');
            s.src = `content/${kind}.js`;
            s.onload = () => resolve();
            s.onerror = () => { s.remove(); reject(new Error(`Could not load content/${kind}.js`)); };
            document.head.appendChild(s);
        }).then(ready).finally(() => { delete this.pending[kind]; });
        return this.pending[kind];
    },

    find(kind, id) {
        const doc = this.docs[kind];
        return doc ? doc.items.find(x => x.id === id) || null : null;
    },

    active: 0,
    waiting: [],

    /** At most two passage requests at a time, so a long page does not burst the API. */
    async throttled(fn) {
        if (this.active >= 2) await new Promise(r => this.waiting.push(r));
        this.active += 1;
        try { return await fn(); } finally {
            this.active -= 1;
            const next = this.waiting.shift();
            if (next) next();
        }
    },

    /**
     * Exactly the ayahs s:from–to in Uthmani script, or an error. For ayah 1 the API
     * prefixes the basmala (not part of the ayah except in Al-Fatihah); it is returned
     * separately, in the dataset's own characters.
     */
    async passage(ref) {
        const n = ref.to - ref.from + 1;
        const endpoint = `/surah/${ref.s}/quran-uthmani?offset=${ref.from - 1}&limit=${n}`;
        let data;
        for (let attempt = 0; ; attempt++) {
            try { data = await this.throttled(() => APIService.fetch(endpoint)); break; } catch (e) {
                if (attempt === 2) throw e;
                await new Promise(r => setTimeout(r, 700 * (attempt + 1)));
            }
        }
        const ayahs = (data && data.ayahs) || [];
        const ok = data && data.number === ref.s && ayahs.length === n &&
            ayahs.every((a, i) => a.numberInSurah === ref.from + i && typeof a.text === 'string' && a.text.length);
        if (!ok) throw new Error('Passage does not match the reference');
        let basmala = null;
        const out = ayahs.map(a => {
            const part = QuranUtil.splitBasmala(ref.s, a.numberInSurah, a.text);
            if (part.basmala) basmala = part.basmala;
            return { n: a.numberInSurah, text: part.text };
        });
        out.basmala = basmala;
        return out;
    }
};

const Explore = {
    from: 'explore',
    revelationType: 'makki',
    LABELS: {
        stories: { title: 'قصص الأنبياء', read: 'اقرأ القصة' },
        miracles: { title: 'معجزات الأنبياء', read: 'اقرأ المزيد' }
    },
    REV: {
        makki: { title: 'السور المكية', icon: 'fa-kaaba', desc: 'سور نزلت قبل الهجرة، وتتناول موضوعات الإيمان والتوحيد والآخرة غالبًا.' },
        madani: { title: 'السور المدنية', icon: 'fa-mosque', desc: 'سور نزلت بعد الهجرة، وتتناول موضوعات المجتمع والأحكام وتنظيم الحياة الإسلامية غالبًا.' }
    },

    n: (x) => QuranUtil.toArabicDigits(x),
    minutes(m) {
        m = Math.max(1, m || 1);
        if (m === 1) return 'دقيقة واحدة';
        if (m === 2) return 'دقيقتان';
        return `${QuranUtil.toArabicDigits(m)} ${m <= 10 ? 'دقائق' : 'دقيقة'}`;
    },
    esc: (x) => QuranUtil.esc(x),
    surahName: (s) => MushafMeta.surahs[s - 1][0],
    isMakki: (s) => MushafMeta.surahs[s - 1][3] === 'Meccan',

    init() {
        this.renderRevelationCards();
        document.addEventListener('click', (e) => this.onClick(e));
        const exSearch = document.getElementById('exploreSearch');
        if (exSearch) exSearch.addEventListener('input', () => ['stories', 'miracles'].forEach(k => this.renderRow(k)));
        const run = () => ['stories', 'miracles'].forEach(k => this.renderRow(k));
        if ('requestIdleCallback' in window) requestIdleCallback(run, { timeout: 1200 }); else setTimeout(run, 200);
    },

    onClick(e) {
        const t = e.target.closest('[data-explore],[data-open-collection],[data-open-article],[data-rev-tab],[data-play-surah],[data-read-surah],[data-listen],[data-explore-back],[data-retry-row],[data-page-go]');
        if (!t) return;
        if (t.dataset.pageGo) {
            App.navigateToPage(t.dataset.pageGo);
        } else if (t.dataset.playSurah) {
            e.stopPropagation();
            AudioPlayer.playNow('surah', Number(t.dataset.playSurah));
        } else if (t.dataset.readSurah) {
            const [s, a] = t.dataset.readSurah.split(':').map(Number);
            QuranDisplay.loadSurah(s, a > 1 ? a : undefined);
        } else if (t.dataset.listen) {
            const [s, a] = t.dataset.listen.split(':').map(Number);
            AudioPlayer.playAyah(s, a);
        } else if (t.dataset.explore) {
            this.openRevelation(t.dataset.explore);
        } else if (t.dataset.revTab) {
            this.revelationType = t.dataset.revTab;
            this.renderRevelation();
            const tab = document.querySelector(`[data-rev-tab="${this.revelationType}"]`);
            if (tab) tab.focus();
        } else if (t.dataset.openCollection) {
            this.openCollection(t.dataset.openCollection);
        } else if (t.dataset.openArticle) {
            const [kind, id] = t.dataset.openArticle.split(':');
            this.openArticle(kind, id);
        } else if (t.dataset.exploreBack) {
            App.navigateToPage(t.dataset.exploreBack);
        } else if (t.dataset.retryRow) {
            this.renderRow(t.dataset.retryRow);
        }
    },

    /* ---------------------------------------------------- Surah cards */
    playButton(s) {
        return `<button type="button" class="surah-play" data-play-surah="${s}" aria-label="استماع إلى ${this.esc(this.surahName(s))}" title="استماع"><i class="fas fa-play" aria-hidden="true"></i></button>`;
    },

    /* ------------------------------------------------ Makki / Madani */
    renderRevelationCards() {
        const el = document.getElementById('hxRevCards');
        if (!el) return;
        const count = (type) => MushafMeta.surahs.filter((s, i) => this.isMakki(i + 1) === (type === 'makki')).length;
        el.innerHTML = ['makki', 'madani'].map(type => `
            <button type="button" class="hx-rev-card" data-explore="${type}" data-type="${type}">
                <span class="hx-rev-icon" aria-hidden="true"><i class="fas ${this.REV[type].icon}"></i></span>
                <span class="hx-rev-body">
                    <span class="hx-rev-title">${this.REV[type].title} <span class="hx-rev-count">${this.n(count(type))} سورة</span></span>
                    <span class="hx-rev-desc">${this.REV[type].desc}</span>
                </span>
                <i class="fas fa-chevron-left hx-chev" aria-hidden="true"></i>
            </button>`).join('');
    },

    openRevelation(type) {
        if (App.currentPage !== 'revelation') this.revFrom = App.currentPage === 'home' ? 'home' : 'explore';
        this.revelationType = type === 'madani' ? 'madani' : 'makki';
        App.navigateToPage('revelation');
        this.renderRevelation();
    },

    renderRevelation() {
        const el = document.getElementById('revelationContent');
        if (!el) return;
        const type = this.revelationType;
        const list = MushafMeta.surahs.map((s, i) => ({ num: i + 1, s })).filter(x => this.isMakki(x.num) === (type === 'makki'));
        const tab = (t) => `<button type="button" role="tab" class="hx-seg${t === type ? ' is-active' : ''}" data-rev-tab="${t}" aria-selected="${t === type}" tabindex="${t === type ? 0 : -1}">
            <i class="fas ${this.REV[t].icon}" aria-hidden="true"></i> ${this.REV[t].title}</button>`;
        el.innerHTML = `
            <div class="hx-page-head">
                <button type="button" class="btn btn-secondary" data-explore-back="${this.revFrom || 'explore'}"><i class="fas fa-arrow-right" aria-hidden="true"></i> العودة</button>
                <div class="hx-segs" role="tablist" aria-label="نوع السور">${tab('makki')}${tab('madani')}</div>
            </div>
            <div class="hx-rev-intro" data-type="${type}">
                <span class="hx-rev-icon" aria-hidden="true"><i class="fas ${this.REV[type].icon}"></i></span>
                <div>
                    <h2>${this.REV[type].title} <small>(${this.n(list.length)} سورة)</small></h2>
                    <p>${this.REV[type].desc}</p>
                </div>
            </div>
            <ol class="hx-surahs" role="tabpanel" aria-label="${this.REV[type].title}">
                ${list.map(({ num, s }) => `
                <li class="hx-sr">
                    <span class="hx-sr-num">${this.n(num)}</span>
                    <span class="hx-sr-main"><span class="arabic-text">${this.esc(s[0])}</span><small>${this.esc(s[1])}</small></span>
                    <span class="hx-sr-meta"><span class="hx-badge" data-type="${type}">${type === 'makki' ? 'مكية' : 'مدنية'}</span> ${this.n(s[2])} آية</span>
                    <span class="hx-sr-actions">
                        <button type="button" class="hx-icon-btn" data-read-surah="${num}:1" aria-label="قراءة ${this.esc(s[0])}" title="قراءة"><i class="fas fa-book-open" aria-hidden="true"></i></button>
                        <button type="button" class="hx-icon-btn" data-play-surah="${num}" aria-label="استماع إلى ${this.esc(s[0])}" title="استماع"><i class="fas fa-play" aria-hidden="true"></i></button>
                    </span>
                </li>`).join('')}
            </ol>
            <p class="hx-source"><i class="fas fa-circle-info" aria-hidden="true"></i>
                التصنيف وفق المتعارف عليه في مصحف المدينة النبوية: المكي ما نزل قبل الهجرة والمدني ما نزل بعدها، ولو نزل بمكة.
                مصدر البيانات: Tanzil عبر alquran.cloud، وقد طابق Quran.com في جميع السور الـ١١٤. ويختلف العلماء في تصنيف عدد قليل من السور.</p>`;
        const segs = el.querySelector('.hx-segs');
        segs.addEventListener('keydown', (e) => {
            if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
            e.preventDefault();
            this.revelationType = this.revelationType === 'makki' ? 'madani' : 'makki';
            this.renderRevelation();
            const t = document.querySelector(`[data-rev-tab="${this.revelationType}"]`);
            if (t) t.focus();
        });
    },

    /* -------------------------------------------- stories & miracles */
    refLabel(ref) {
        const range = ref.from === ref.to ? this.n(ref.from) : `${this.n(ref.from)}–${this.n(ref.to)}`;
        return `${this.surahName(ref.s)}: ${range}`;
    },

    surahsOf(item) {
        const seen = [];
        item.sections.forEach(sec => sec.refs.forEach(r => { if (!seen.includes(r.s)) seen.push(r.s); }));
        return seen;
    },

    card(kind, item) {
        const surahs = this.surahsOf(item);
        const shown = surahs.slice(0, 3).map(s => `<span class="hx-chip">${this.esc(this.surahName(s))}</span>`).join('');
        const more = surahs.length > 3 ? `<span class="hx-chip">+${this.n(surahs.length - 3)}</span>` : '';
        return `
            <article class="hx-card" role="listitem" data-kind="${kind}">
                <div class="hx-card-art" aria-hidden="true"><i class="fas ${this.esc(item.icon)}"></i></div>
                <div class="hx-card-body">
                    <p class="hx-card-prophet">${this.esc(item.prophet)}</p>
                    <h3 class="hx-card-title">${this.esc(item.title)}</h3>
                    <p class="hx-card-intro">${this.esc(item.intro)}</p>
                    <div class="hx-chips" aria-label="السور المذكورة">${shown}${more}</div>
                    <div class="hx-card-foot">
                        <span class="hx-meta"><i class="far fa-clock" aria-hidden="true"></i> ${this.minutes(item.minutes)}</span>
                        <button type="button" class="btn btn-primary hx-read" data-open-article="${kind}:${this.esc(item.id)}" aria-label="${this.LABELS[kind].read}: ${this.esc(item.title)}">${this.LABELS[kind].read}</button>
                    </div>
                </div>
            </article>`;
    },

    skeletons(k) { return Array.from({ length: k }, () => '<div class="hx-card hx-skel" aria-hidden="true"><div class="hx-card-art"></div><div class="hx-card-body"><span></span><span></span><span></span></div></div>').join(''); },

    matches(item, q) {
        return !q || this.norm([item.prophet, item.title, item.intro,
            ...this.surahsOf(item).map(s => this.surahName(s) + ' ' + MushafMeta.surahs[s - 1][1])].join(' ')).includes(q);
    },

    /** Explore page grids (all items), filtered by the page's search box. */
    async renderRow(kind) {
        const el = document.getElementById(kind === 'stories' ? 'hxStoriesRow' : 'hxMiraclesRow');
        if (!el) return;
        el.setAttribute('aria-busy', 'true');
        if (!ContentStore.docs[kind]) el.innerHTML = this.skeletons(3);
        try {
            const doc = await ContentStore.load(kind);
            const q = this.norm((document.getElementById('exploreSearch') || {}).value);
            const items = doc.items.filter(item => this.matches(item, q));
            el.innerHTML = items.length ? items.map(item => this.card(kind, item)).join('')
                : '<div class="hx-state"><p>لا توجد نتائج مطابقة في هذا القسم.</p></div>';
            const count = document.getElementById(kind === 'stories' ? 'exStoriesCount' : 'exMiraclesCount');
            if (count) count.textContent = this.n(q ? items.length : doc.items.length);
            const status = document.getElementById('exploreStatus');
            if (status) {
                const docs = ContentStore.docs;
                const total = ['stories', 'miracles'].reduce((t, k) => t + (docs[k] ? docs[k].items.filter(i => this.matches(i, q)).length : 0), 0);
                status.textContent = q ? `${this.n(total)} نتيجة` : '';
            }
        } catch (e) {
            console.warn('Content unavailable', kind, e);
            el.innerHTML = `<div class="hx-state" role="alert"><p>تعذر تحميل ${this.LABELS[kind].title}.</p>
                <button type="button" class="btn btn-secondary" data-retry-row="${kind}">إعادة المحاولة</button></div>`;
        } finally {
            el.removeAttribute('aria-busy');
        }
    },

    /** Show a collection: the Explore page, scrolled to that section. */
    openCollection(kind) {
        App.navigateToPage('explore');
        const sec = document.getElementById(kind === 'miracles' ? 'exMiracles' : 'exStories');
        if (sec) sec.scrollIntoView();
    },

    norm(t) {
        return String(t || '').replace(/[ؐ-ًؚ-ٰٟۖ-ۭـ]/g, '')
            .replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').toLowerCase().trim();
    },

    async openArticle(kind, id) {
        if (App.currentPage !== 'article') this.from = App.currentPage || 'home';
        App.navigateToPage('article');
        const el = document.getElementById('articleContent');
        el.innerHTML = '<div class="hx-state" aria-busy="true"><i class="fas fa-spinner fa-spin" aria-hidden="true"></i> جارٍ التحميل…</div>';
        let item;
        try {
            await Promise.all([ContentStore.load('stories'), ContentStore.load('miracles')]);
            item = ContentStore.find(kind, id);
        } catch (e) { item = null; }
        if (!item) {
            el.innerHTML = `<div class="hx-state" role="alert"><p>تعذر فتح هذه الصفحة.</p><button type="button" class="btn btn-secondary" data-explore-back="${this.from}">العودة</button></div>`;
            return;
        }
        this.renderArticle(el, kind, item);
    },

    renderArticle(el, kind, item) {
        const esc = this.esc, n = this.n;
        const basis = kind === 'miracles'
            ? `<span class="hx-badge" data-basis="${esc(item.basis)}">${item.basis === 'quran' ? 'مذكورة في القرآن الكريم' : 'في القرآن الكريم والسنة الصحيحة'}</span>` : '';
        const related = this.relatedOf(kind, item);
        const sections = item.sections.map((sec, i) => `
            <section class="hx-sec" id="sec-${i}" aria-labelledby="sec-${i}-h">
                <h2 id="sec-${i}-h">${esc(sec.title)}</h2>
                ${sec.refs.map(ref => `
                <figure class="hx-quran" data-ref="${ref.s}:${ref.from}:${ref.to}">
                    <figcaption>
                        <span class="hx-label"><i class="fas fa-book-quran" aria-hidden="true"></i> قال الله تعالى — ${esc(this.refLabel(ref))}</span>
                        <span class="hx-q-actions">
                            <button type="button" class="hx-icon-btn" data-read-surah="${ref.s}:${ref.from}" aria-label="فتح ${esc(this.refLabel(ref))} في القارئ" title="فتح في القارئ"><i class="fas fa-book-open" aria-hidden="true"></i></button>
                            <button type="button" class="hx-icon-btn" data-listen="${ref.s}:${ref.from}" aria-label="استماع من ${esc(this.refLabel(ref))}" title="استماع"><i class="fas fa-play" aria-hidden="true"></i></button>
                        </span>
                    </figcaption>
                    <blockquote class="hx-ayat" lang="ar" dir="rtl"><span class="hx-skel-line"></span><span class="hx-skel-line"></span></blockquote>
                </figure>`).join('')}
                <div class="hx-explain"><span class="hx-label">شرح مبسّط</span><p>${esc(sec.text)}</p></div>
                ${sec.hadith ? `
                <aside class="hx-hadith" aria-label="من السنة النبوية">
                    <span class="hx-label"><i class="fas fa-scroll" aria-hidden="true"></i> من السنة النبوية</span>
                    <p>${esc(sec.hadith.text)}</p>
                    <p class="hx-src">المصدر: ${esc(sec.hadith.source)} · الدرجة: ${esc(sec.hadith.grade)}</p>
                </aside>` : ''}
            </section>`).join('');
        el.innerHTML = `
            <article class="hx-article" data-kind="${kind}" aria-labelledby="articleTitle">
                <button type="button" class="btn btn-secondary hx-back" data-explore-back="${esc(this.from)}"><i class="fas fa-arrow-right" aria-hidden="true"></i> العودة</button>
                <header class="hx-article-head">
                    <span class="hx-card-art" aria-hidden="true"><i class="fas ${esc(item.icon)}"></i></span>
                    <div>
                        <p class="hx-card-prophet">${esc(item.prophet)} · ${this.LABELS[kind].title}</p>
                        <h1 id="articleTitle">${esc(item.title)}</h1>
                        <p class="hx-meta"><i class="far fa-clock" aria-hidden="true"></i> قراءة ${this.minutes(item.minutes)} · ${n(item.sections.reduce((t, s) => t + s.refs.length, 0))} مواضع من القرآن ${basis}</p>
                    </div>
                </header>
                <p class="hx-lead">${esc(item.intro)}</p>
                ${item.sections.length > 2 ? `<nav class="hx-toc" aria-label="محتويات الصفحة"><ol>${item.sections.map((s, i) => `<li><a href="#sec-${i}">${esc(s.title)}</a></li>`).join('')}</ol></nav>` : ''}
                ${sections}
                <section class="hx-lessons" aria-labelledby="lessonsH">
                    <h2 id="lessonsH"><i class="fas fa-lightbulb" aria-hidden="true"></i> دروس وعبر</h2>
                    <ul>${item.lessons.map(l => `<li>${esc(l)}</li>`).join('')}</ul>
                </section>
                ${related.length ? `<section class="hx-related" aria-labelledby="relH"><h2 id="relH">للمزيد</h2>
                    <div class="hx-related-list">${related.map(r => `<button type="button" class="hx-rel" data-open-article="${r.kind}:${esc(r.item.id)}">
                        <i class="fas ${esc(r.item.icon)}" aria-hidden="true"></i><span>${esc(r.item.title)}</span><small>${r.kind === 'stories' ? 'قصة' : 'معجزة'}</small></button>`).join('')}</div></section>` : ''}
                <footer class="hx-source">
                    <p><i class="fas fa-circle-info" aria-hidden="true"></i> النص القرآني بالرسم العثماني من مصدر بيانات القارئ نفسه (alquran.cloud)، ويُعرض كما هو دون تعديل. «الشرح المبسّط» تقريب لمعاني الآيات المذكورة فقط وليس تفسيرًا معتمدًا؛ ويُرجع في التفسير إلى كتب التفسير المعتبرة.</p>
                </footer>
            </article>`;
        el.querySelectorAll('.hx-toc a').forEach(a => a.addEventListener('click', (e) => {
            e.preventDefault();
            const target = document.querySelector(a.getAttribute('href'));
            if (target) { target.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); target.querySelector('h2').focus({ preventScroll: true }); }
        }));
        el.querySelectorAll('.hx-sec h2').forEach(h => h.setAttribute('tabindex', '-1'));
        el.querySelectorAll('.hx-quran').forEach(fig => this.fillPassage(fig));
        document.title = `${item.title} | القرآن الكريم`;
        const h = document.getElementById('articleTitle');
        if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
    },

    async fillPassage(fig) {
        const [s, from, to] = fig.dataset.ref.split(':').map(Number);
        const box = fig.querySelector('.hx-ayat');
        try {
            const ayahs = await ContentStore.passage({ s, from, to });
            const basmala = ayahs.basmala ? `<span class="hx-basmala">${this.esc(ayahs.basmala)}</span>` : '';
            box.innerHTML = basmala + ayahs.map(a =>
                `<span class="hx-ayah">${this.esc(a.text)}</span> <span class="hx-num" aria-label="الآية ${this.n(a.n)}">﴿${this.n(a.n)}﴾</span>`).join(' ');
        } catch (e) {
            box.innerHTML = `<span class="hx-q-error" role="alert">تعذر تحميل نص الآيات (${this.esc(this.refLabel({ s, from, to }))}). تحقق من الاتصال.
                <button type="button" class="btn btn-secondary">إعادة المحاولة</button></span>`;
            box.querySelector('button').addEventListener('click', () => {
                box.innerHTML = '<span class="hx-skel-line"></span>';
                this.fillPassage(fig);
            });
        }
    },

    relatedOf(kind, item) {
        const out = [];
        const add = (k, id) => {
            const it = ContentStore.find(k, id);
            if (it && it !== item && !out.some(r => r.item === it)) out.push({ kind: k, item: it });
        };
        if (kind === 'stories') {
            (item.related || []).forEach(id => add('stories', id));
            (ContentStore.docs.miracles ? ContentStore.docs.miracles.items : [])
                .filter(m => (m.relatedStories || []).includes(item.id)).forEach(m => add('miracles', m.id));
        } else {
            (item.relatedStories || []).forEach(id => add('stories', id));
            (ContentStore.docs.miracles ? ContentStore.docs.miracles.items : [])
                .filter(m => m.prophet === item.prophet).forEach(m => add('miracles', m.id));
        }
        return out;
    }
};

window.ContentStore = ContentStore;
window.Explore = Explore;
