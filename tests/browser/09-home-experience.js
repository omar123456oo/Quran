// Immersive/compact player, Makki–Madani explorer, Stories and Miracles.
// Needs the dev server on :8000 (npm start) and network access.
const os = require('node:os');
const fs = require('node:fs');
const { launch } = require('./cdp.js');
const OUT = os.tmpdir() + '/quran-home';
fs.mkdirSync(OUT, { recursive: true });
const results = [];
const check = (name, ok, extra = '') => { results.push(!!ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} ${extra}`); };

(async () => {
  const b = await launch({ width: 1280, height: 900, port: 9380, profile: 'home-exp' });
  const ev = b.ev;
  try {
    await b.goto('http://127.0.0.1:8000/index.html');
    await b.waitFor('QuranDisplay.surahs.length === 114 && document.querySelectorAll("[data-play-surah]").length >= 114', 20000);
    // count every distinct media element that ever starts playing
    await ev(`window.__players = new Set(); const p = HTMLMediaElement.prototype.play;
      HTMLMediaElement.prototype.play = function () { window.__players.add(this); return p.apply(this, arguments); };
      AudioPlayer.setReciter('ar.alafasy');`);

    /* ------------------------------------------------ expanded player */
    await ev(`document.querySelector('#surahList [data-play-surah="112"]').click()`);
    check('Surah card listen button does not open the reader', await ev(`App.currentPage === 'home'`));
    check('starting a Surah on home opens the expanded player', await b.waitFor(`!document.getElementById('pvExpanded').hidden && PlaybackStore.get().status === 'playing'`, 20000));
    check('background blurred and inert; focus inside the dialog', await ev(`document.body.classList.contains('player-expanded') &&
      getComputedStyle(document.querySelector('main')).filter.includes('blur') && document.querySelector('main').inert && document.querySelector('header').inert &&
      document.activeElement === document.getElementById('pvPlay')`));
    check('shows Surah, reciter, playing verse and its number', await ev(`(() => { const s = PlaybackStore.get();
      return document.getElementById('pvSurah').textContent === MushafMeta.surahs[111][0] &&
        /العفاسي/.test(document.getElementById('pvReciter').textContent) &&
        document.getElementById('pvAyah').textContent === QuranUtil.splitBasmala(s.surah, s.ayah, s.ayahText).text && s.ayahText.length > 5 &&
        document.getElementById('pvRef').textContent.includes('الآية ' + QuranUtil.toArabicDigits(s.ayah)); })()`));
    check('ayah 1: the API basmala prefix is shown on its own line, not as part of the ayah', await ev(`(() => { const s = PlaybackStore.get();
      if (s.ayah !== 1) return true;
      const shown = document.getElementById('pvBasmala').textContent + ' ' + document.getElementById('pvAyah').textContent;
      return !document.getElementById('pvBasmala').hidden && !document.getElementById('pvAyah').textContent.startsWith('بِسْمِ') && shown === s.ayahText.replace(/^\\uFEFF/, '')
        && !document.getElementById('currentAyahText').textContent.startsWith('بِسْمِ'); })()`));
    await b.shot(`${OUT}/expanded-1280.png`);

    await b.sleep(1200);
    const before = await ev(`({ src: AudioPlayer.audio.src, t: AudioPlayer.audio.currentTime, ayah: PlaybackStore.get().ayah })`);
    await ev(`document.querySelector('#pvExpanded [data-pv="minimize"]').click()`);
    await b.sleep(400);
    const after = await ev(`({ src: AudioPlayer.audio.src, t: AudioPlayer.audio.currentTime, paused: AudioPlayer.audio.paused, ayah: PlaybackStore.get().ayah })`);
    check('minimize: blur removed, compact player shown', await ev(`document.getElementById('pvExpanded').hidden && !document.body.classList.contains('player-expanded') &&
      !document.querySelector('main').inert && !document.getElementById('pvMini').hidden && getComputedStyle(document.querySelector('main')).filter === 'none'`));
    check('minimize does not restart or pause the audio', after.src === before.src && after.ayah === before.ayah && after.t >= before.t && !after.paused,
      `${before.t.toFixed(2)} → ${after.t.toFixed(2)}`);
    check('compact player shows Surah and verse number', await ev(`document.getElementById('pvMiniTitle').textContent === MushafMeta.surahs[111][0] &&
      document.getElementById('pvMiniSub').textContent.includes('الآية')`));
    check('compact player has a visible mic button', await ev(`(() => { const m = document.getElementById('pvMiniReciter'); return !!m && m.offsetParent !== null && !!m.querySelector('.fa-microphone'); })()`));
    await ev(`document.getElementById('pvMiniReciter').click()`); await b.sleep(300);
    check('compact mic opens the reciter list; playback continues', await ev(`document.getElementById('reciterModal').classList.contains('active') && !AudioPlayer.audio.paused`));
    await ev(`document.getElementById('closeReciterModal').click()`); await b.sleep(200);
    check('bar mic is in the main line, not hidden in "more"', await ev(`(() => { const m = document.getElementById('reciterBtn'); return !!m.closest('.ap-side') && !m.closest('#apMore'); })()`));
    check('docked full bar hidden in compact mode', await ev(`getComputedStyle(document.getElementById('audioPlayerContainer')).display === 'none'`));

    await ev(`document.querySelector('#pvMini [data-pv="expand"]').click()`); await b.sleep(300);
    check('reopen keeps the same playback', await ev(`!document.getElementById('pvExpanded').hidden && AudioPlayer.audio.src === ${JSON.stringify(after.src)} && !AudioPlayer.audio.paused`));
    const ayah0 = await ev(`PlaybackStore.get().ayah`);
    await ev(`document.querySelector('#pvExpanded [data-pv="next-ayah"]').click()`);
    check('next verse updates verse and text', await b.waitFor(`PlaybackStore.get().ayah === ${ayah0 + 1} && document.getElementById('pvAyah').textContent === PlaybackStore.get().ayahText`, 10000));
    await ev(`document.querySelector('#pvExpanded [data-pv="prev-ayah"]').click()`);
    check('previous verse', await b.waitFor(`PlaybackStore.get().ayah === ${ayah0}`, 10000));
    await ev(`document.querySelector('#pvExpanded [data-pv="toggle"]').click()`);
    check('pause from the dialog', await b.waitFor(`PlaybackStore.get().status === 'paused'`, 5000));
    await ev(`document.querySelector('#pvExpanded [data-pv="toggle"]').click()`);
    check('resume from the dialog', await b.waitFor(`PlaybackStore.get().status === 'playing'`, 8000));
    // change reciter from the popup (mic button)
    check('popup has a mic button showing the reciter', await ev(`(() => { const m = document.getElementById('pvReciterBtn');
      return !!m && !!m.querySelector('.fa-microphone') && m.offsetParent !== null && /العفاسي/.test(m.textContent); })()`));
    await ev(`window.confirm = () => true; document.getElementById('pvReciterBtn').click()`); await b.sleep(300);
    check('mic opens the reciter list on top of the popup', await ev(`(() => { const m = document.querySelector('#reciterModal .modal-content'); if (!m) return false;
      const r = m.getBoundingClientRect(); const top = document.elementFromPoint(r.left + r.width / 2, r.top + 20);
      return document.getElementById('reciterModal').classList.contains('active') && m.contains(top) && !document.getElementById('pvExpanded').hidden; })()`));
    await ev(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`); await b.sleep(200);
    check('Escape closes only the reciter list; focus back on the mic', await ev(`!document.getElementById('reciterModal').classList.contains('active') &&
      !document.getElementById('pvExpanded').hidden && document.activeElement === document.getElementById('pvReciterBtn')`));
    await ev(`document.getElementById('pvReciterBtn').click()`); await b.sleep(300);
    await ev(`[...document.querySelectorAll('#reciterList .reciter-option')].find(o => /الحصري/.test(o.textContent)).click()`);
    check('choosing a reciter keeps playing with the new voice; popup shows it', await b.waitFor(`AudioPlayer.currentReciter === 'ar.husary' && PlaybackStore.get().status === 'playing'
      && /الحصري/.test(document.getElementById('pvReciter').textContent) && !document.getElementById('pvExpanded').hidden && !document.getElementById('reciterModal').classList.contains('active')`, 20000));
    await ev(`AudioPlayer.setReciter('ar.alafasy')`);

    await ev(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`); await b.sleep(200);
    check('Escape minimizes', await ev(`document.getElementById('pvExpanded').hidden`));
    await ev(`PlayerViews.open(); document.getElementById('pvOverlay').click()`); await b.sleep(200);
    check('tapping outside minimizes', await ev(`document.getElementById('pvExpanded').hidden && !AudioPlayer.audio.paused`));

    // navigation keeps one player
    for (const p of ['settings', 'mushaf', 'downloads', 'home']) { await ev(`App.navigateToPage('${p}')`); await b.sleep(300); }
    check('navigation: playback continues, one audio element ever played', await ev(`!AudioPlayer.audio.paused && window.__players.size === 1 && !document.getElementById('pvMini').hidden`),
      `players=${await ev('window.__players.size')}`);

    // docked mode and back
    await ev(`PlayerViews.open(); document.querySelector('#pvExpanded [data-pv="docked"]').click()`); await b.sleep(300);
    check('"full controls" shows the original bar', await ev(`getComputedStyle(document.getElementById('audioPlayerContainer')).display !== 'none' && document.getElementById('pvMini').hidden`));
    await ev(`document.getElementById('dockMinimizeBtn').click()`); await b.sleep(200);
    check('docked bar can return to compact', await ev(`!document.getElementById('pvMini').hidden && localStorage.getItem('quran_player_view') === 'compact'`));

    // started outside home → no popup
    await ev(`App.navigateToPage('mushaf'); AudioPlayer.playNow('surah', 113)`);
    await b.waitFor(`PlaybackStore.get().surah === 113 && PlaybackStore.get().status === 'playing'`, 15000);
    check('playback started in the Mushaf does not open the popup', await ev(`document.getElementById('pvExpanded').hidden`));
    check('verse in compact player follows the Surah change', await ev(`document.getElementById('pvMiniTitle').textContent === MushafMeta.surahs[112][0]`));

    // close = explicit stop
    await ev(`document.querySelector('#pvMini [data-pv="close"]').click()`); await b.sleep(300);
    check('close stops playback and hides the player', await ev(`PlaybackStore.get().status === 'idle' && AudioPlayer.audio.paused && document.getElementById('pvMini').hidden && !document.body.classList.contains('has-player')`));

    // unavailable recitation
    await ev(`App.navigateToPage('home'); AudioPlayer.setReciter('ar.saadalghamadi'); AudioPlayer.playNow('surah', 1)`);
    check('unavailable recitation: clear error, no crash', await b.waitFor(`PlaybackStore.get().status === 'error' && PlaybackStore.get().message.length > 0`, 15000),
      await ev('PlaybackStore.get().message'));
    await ev(`AudioPlayer.setReciter('ar.alafasy'); AudioPlayer.stop(); AudioPlayer.hidePlayer()`);

    /* ------------------------------------------------ Explore page */
    await ev(`App.navigateToPage('home'); document.querySelector('.hx-teaser[data-page-go="explore"]').click()`);
    check('home entry card opens the Explore page', await b.waitFor(`App.currentPage === 'explore' && !document.getElementById('explorePage').classList.contains('hidden')`, 3000));
    await ev(`App.navigateToPage('home'); document.querySelector('.nav-link[data-page="explore"]').click()`);
    check('navbar link "استكشف" opens the Explore page', await b.waitFor(`App.currentPage === 'explore' && document.querySelector('.nav-link[data-page="explore"]').classList.contains('active')`, 3000));
    check('Explore page: full grids with 9 stories and 12 miracles, section counts', await b.waitFor(`document.querySelectorAll('#hxStoriesRow .hx-card').length === 9 && document.querySelectorAll('#hxMiraclesRow .hx-card').length === 12
      && document.getElementById('exStoriesCount').textContent === '٩' && document.getElementById('exMiraclesCount').textContent === '١٢'`, 10000));
    check('Explore sections are hidden on other pages', await ev(`App.navigateToPage('home'), document.getElementById('explorePage').offsetParent === null`));
    await ev(`App.navigateToPage('explore')`);
    await ev(`{ const s = document.getElementById('exploreSearch'); s.value = 'موسى'; s.dispatchEvent(new Event('input')); }`);
    check('one search filters both stories and miracles', await b.waitFor(`document.querySelectorAll('#hxStoriesRow .hx-card').length === 1 && document.querySelectorAll('#hxMiraclesRow .hx-card').length === 2 && /٣ نتيجة/.test(document.getElementById('exploreStatus').textContent)`, 3000),
      await ev(`document.getElementById('exploreStatus').textContent`));
    await ev(`{ const s = document.getElementById('exploreSearch'); s.value = ''; s.dispatchEvent(new Event('input')); }`);
    await ev(`document.querySelector('.hx-jump-link[href="#exMiracles"]').click()`); await b.sleep(600);
    check('jump link scrolls to the Miracles section', await ev(`Math.abs(document.getElementById('exMiracles').getBoundingClientRect().top - 96) < 60`),
      String(await ev(`document.getElementById('exMiracles').getBoundingClientRect().top`)));
    await ev(`window.scrollTo(0, 0)`); await b.sleep(300);
    await b.shot(`${OUT}/explore-1280.png`);

    /* ------------------------------------------------ Makki / Madani */
    await ev(`document.querySelector('[data-explore="makki"]').click()`);
    check('Makki card opens 86 Surahs', await b.waitFor(`App.currentPage === 'revelation' && document.querySelectorAll('.hx-sr').length === 86`, 5000));
    check('every listed Surah is Makki in the verified data, with correct ayah count', await ev(`[...document.querySelectorAll('.hx-sr')].every(li => {
      const num = Number(li.querySelector('[data-play-surah]').dataset.playSurah); const s = MushafMeta.surahs[num - 1];
      return s[3] === 'Meccan' && li.textContent.includes(QuranUtil.toArabicDigits(s[2]) + ' آية') && li.textContent.includes(s[0]); })`));
    await ev(`document.querySelector('[data-rev-tab="madani"]').click()`);
    check('Madani tab: 28 Surahs, incl. Al-Baqarah and Ar-Rahman per source', await b.waitFor(`document.querySelectorAll('.hx-sr').length === 28 &&
      !!document.querySelector('.hx-sr [data-play-surah="2"]') && !!document.querySelector('.hx-sr [data-play-surah="55"]') && !document.querySelector('.hx-sr [data-play-surah="1"]')`, 5000));
    await b.shot(`${OUT}/revelation-1280.png`);
    await ev(`document.querySelector('#revelationContent [data-explore-back]').click()`);
    check('explorer "back" returns to the Explore page', await b.waitFor(`App.currentPage === 'explore'`, 3000));
    await ev(`Explore.openRevelation('madani')`);
    await ev(`document.querySelector('.hx-sr [data-play-surah="110"]').click()`);
    check('listening from the explorer opens the expanded player', await b.waitFor(`!document.getElementById('pvExpanded').hidden && PlaybackStore.get().surah === 110`, 15000));
    await ev(`PlayerViews.minimize(); AudioPlayer.stop(); AudioPlayer.hidePlayer(); document.querySelector('.hx-sr [data-read-surah="110:1"]').click()`);
    check('"read" opens the existing reader', await b.waitFor(`App.currentPage === 'surah' && document.querySelectorAll('#surahContent .ayah-container').length === 3`, 15000));

    /* ------------------------------------------------ stories & miracles */
    await ev(`App.navigateToPage('home')`); await b.sleep(300);
    await b.shot(`${OUT}/home-1280.png`);
    await ev(`App.navigateToPage('explore')`);
    const search = (q) => ev(`{ const s = document.getElementById('exploreSearch'); s.value = ${JSON.stringify(q)}; s.dispatchEvent(new Event('input')); }`);
    await search('يونس');
    check('search by prophet name', await b.waitFor(`[...document.querySelectorAll('#hxStoriesRow .hx-card-title')].some(t => t.textContent.includes('يونس'))`, 3000));
    await search('البقرة');
    check('search by Surah name', await b.waitFor(`document.querySelectorAll('#hxStoriesRow .hx-card').length >= 2`, 3000));
    await search('zzzz');
    check('empty search state in both sections', await b.waitFor(`/لا توجد نتائج/.test(document.getElementById('hxStoriesRow').textContent) && /لا توجد نتائج/.test(document.getElementById('hxMiraclesRow').textContent)`, 3000));
    await search('');
    await ev(`document.querySelector('#hxStoriesRow [data-open-article="stories:yusuf"]').click()`);
    check('card opens its reading page', await b.waitFor(`App.currentPage === 'article' && /يوسف/.test(document.getElementById('articleTitle').textContent)`, 5000));
    await ev(`document.querySelector('.hx-article [data-explore-back]').click()`);
    check('reading page "back" returns to the Explore page', await b.waitFor(`App.currentPage === 'explore'`, 3000));

    // every story and miracle: passages are exactly the referenced ayahs
    const ids = await ev(`Promise.all([ContentStore.load('stories'), ContentStore.load('miracles')]).then(([s, m]) => [...s.items.map(i => 'stories:' + i.id), ...m.items.map(i => 'miracles:' + i.id)])`);
    let allOk = true, detail = '';
    for (const key of ids) {
      const [kind, id] = key.split(':');
      await ev(`Explore.openArticle('${kind}', '${id}')`);
      const ok = await b.waitFor(`document.querySelectorAll('.hx-quran').length > 0 && [...document.querySelectorAll('.hx-quran')].every(f => f.querySelector('.hx-num') || f.querySelector('.hx-q-error'))`, 30000);
      const res = await ev(`[...document.querySelectorAll('.hx-quran')].map(f => { const [s, a, z] = f.dataset.ref.split(':').map(Number);
        const nums = [...f.querySelectorAll('.hx-num')].map(x => x.textContent);
        const want = Array.from({ length: z - a + 1 }, (_, i) => '﴿' + QuranUtil.toArabicDigits(a + i) + '﴾');
        return !f.querySelector('.hx-q-error') && JSON.stringify(nums) === JSON.stringify(want); }).every(Boolean)
        && !!document.querySelector('.hx-explain .hx-label') && !!document.querySelector('.hx-lessons li')`);
      if (!(ok && res)) { allOk = false; detail += ` ${key}`; }
    }
    check(`all ${ids.length} pages: every passage shows exactly its referenced ayahs`, allOk, detail);

    await ev(`Explore.openArticle('stories', 'muhammad')`);
    await b.waitFor(`document.querySelectorAll('.hx-quran .hx-num').length > 10`, 20000);
    check('ayah 96:1 shown without the basmala inside it; basmala on its own line', await ev(`(() => { const f = document.querySelector('.hx-quran[data-ref="96:1:5"]');
      const first = f.querySelector('.hx-ayah').textContent; return !first.startsWith('بِسْمِ') && f.querySelector('.hx-basmala').textContent.startsWith('بِسْمِ'); })()`));
    check('hadith shown separately with source and grade', await ev(`(() => { const h = document.querySelector('.hx-hadith'); return !!h && /البخاري/.test(h.textContent) && /صحيح/.test(h.textContent) && !h.closest('.hx-quran'); })()`));
    check('Quranic text and explanation are visibly separate', await ev(`document.querySelectorAll('.hx-quran .hx-label').length > 0 && [...document.querySelectorAll('.hx-explain .hx-label')].every(l => l.textContent === 'شرح مبسّط')`));
    check('displayed basmala + ayah rebuild the dataset text exactly (17:1, 96:1)', await ev(`(async () => {
      for (const [s, ref] of [[17, '17:1:1'], [96, '96:1:5']]) {
        const d = await APIService.fetch('/surah/' + s + '/quran-uthmani?offset=0&limit=' + (s === 17 ? 1 : 5));
        const f = document.querySelector('.hx-quran[data-ref="' + ref + '"]');
        const shown = f.querySelector('.hx-basmala').textContent + ' ' + f.querySelector('.hx-ayah').textContent;
        if (shown !== d.ayahs[0].text) return false;
      } return true; })()`));
    check('a passage not starting at ayah 1 is shown unchanged (9:40)', await ev(`(async () => {
      const d = await APIService.fetch('/surah/9/quran-uthmani?offset=39&limit=1');
      return document.querySelector('.hx-quran[data-ref="9:40:40"] .hx-ayah').textContent === d.ayahs[0].text; })()`));
    await b.shot(`${OUT}/article-1280.png`);
    await ev(`document.querySelector('.hx-related [data-open-article^="miracles:"]').click()`);
    check('related link opens a miracle', await b.waitFor(`document.querySelector('.hx-article').dataset.kind === 'miracles'`, 5000));
    await ev(`document.querySelector('.hx-article [data-explore-back]').click()`);
    check('back returns to the previous screen', await b.waitFor(`App.currentPage === 'explore'`, 3000));
    await ev(`Explore.openArticle('miracles', 'muhammad-moon')`);
    check('miracle basis badge (Quran + Sunnah)', await b.waitFor(`/السنة الصحيحة/.test(document.querySelector('.hx-article-head').textContent)`, 5000));
    await ev(`document.querySelector('.hx-quran [data-listen]').click()`);
    check('listening from an article opens the expanded player at that ayah', await b.waitFor(`!document.getElementById('pvExpanded').hidden && PlaybackStore.get().surah === 54 && PlaybackStore.get().ayah === 1`, 15000));
    await ev(`PlayerViews.minimize(); AudioPlayer.stop()`);
  } catch (e) { console.log('ERR', e.stack); results.push(false); }
  const errs = b.logs.filter(l => /\[EXC\]/.test(l));
  check('no uncaught exceptions', !errs.length, errs.join(' | '));
  await b.closeAndWait();

  // opened directly from disk (file://): content must still load (was: "تعذر تحميل قصص الأنبياء")
  {
    const f = await launch({ port: 9382, profile: 'home-file' });
    try {
      await f.goto('file://' + require('node:path').resolve(__dirname, '..', '..', 'index.html'));
      await f.ev(`App.navigateToPage('explore')`);
      check('file:// — stories and miracles load', await f.waitFor(`document.querySelectorAll('#hxStoriesRow .hx-card').length === 9 && document.querySelectorAll('#hxMiraclesRow .hx-card').length === 12`, 15000));
    } catch (e) { console.log('ERR file://', e.stack); results.push(false); }
    await f.closeAndWait();
  }

  // responsive: no horizontal overflow; dialog fits
  for (const [w, h] of [[320, 640], [375, 812], [768, 1024]]) {
    const r = await launch({ width: w, height: h, port: 9381, profile: `home-${w}` });
    try {
      await r.goto('http://127.0.0.1:8000/index.html');
      await r.waitFor('QuranDisplay.surahs.length === 114 && document.querySelectorAll("#hxStoriesRow .hx-card").length === 9', 20000);
      const over = async () => r.ev('document.documentElement.scrollWidth - innerWidth');
      check(`${w}px home: no horizontal overflow`, (await over()) <= 1);
      await r.shot(`${OUT}/home-${w}.png`);
      await r.ev(`AudioPlayer.setReciter('ar.alafasy'); AudioPlayer.playNow('surah', 1)`);
      await r.waitFor(`!document.getElementById('pvExpanded').hidden`, 20000); await r.sleep(500);
      check(`${w}px expanded player fits the screen`, await r.ev(`(() => { const b = document.getElementById('pvExpanded').getBoundingClientRect(); return b.left >= 0 && b.right <= innerWidth && b.top >= 0 && b.bottom <= innerHeight; })()`));
      await r.shot(`${OUT}/expanded-${w}.png`);
      await r.ev(`PlayerViews.minimize()`); await r.sleep(300);
      check(`${w}px compact player inside the screen`, await r.ev(`(() => { const b = document.getElementById('pvMini').getBoundingClientRect(); return b.left >= 0 && b.right <= innerWidth && b.bottom <= innerHeight; })()`));
      await r.shot(`${OUT}/mini-${w}.png`);
      await r.ev(`App.navigateToPage('explore')`); await r.sleep(600);
      check(`${w}px explore page: no horizontal overflow`, (await over()) <= 1);
      await r.shot(`${OUT}/explore-${w}.png`);
      for (const p of [`Explore.openRevelation('makki')`, `Explore.openCollection('miracles')`, `Explore.openArticle('stories', 'yusuf')`]) {
        await r.ev(p); await r.sleep(1500);
        check(`${w}px ${p.split('(')[0].replace('Explore.', '')}: no horizontal overflow`, (await over()) <= 1);
      }
      await r.shot(`${OUT}/article-${w}.png`);
      await r.ev('AudioPlayer.stop()');
    } catch (e) { console.log('ERR', w, e.stack); results.push(false); }
    await r.closeAndWait();
  }
  console.log(`screenshots: ${OUT}`);
  console.log(results.every(Boolean) ? 'ALL PASS' : 'SOME FAILED');
  process.exit(results.every(Boolean) ? 0 : 1);
})();
