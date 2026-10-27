// Downloads UI: forms, reader download panel, delete, unsupported reciters, backup export/import.
// Needs the dev server on :8000 and network access.
const { launch } = require('./cdp.js');
const results = [];
const check = (name, ok, extra = '') => { results.push(!!ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} ${extra}`); };

(async () => {
  const b = await launch({ port: 9370, profile: 'downloads-ui' });
  const ev = b.ev;
  try {
    await b.goto('http://127.0.0.1:8000/index.html');
    await b.waitFor('QuranDisplay.surahs.length === 114', 20000);
    await ev(`window.confirm = () => true; AudioPlayer.setReciter('ar.alafasy')`);

    await ev(`document.querySelector('.nav-link[data-page="downloads"]').click()`);
    check('downloads page opens from the nav', await b.waitFor(`!document.getElementById('downloadsPage').classList.contains('hidden') && !!document.getElementById('dlAudioForm')`, 5000));
    check('reciters without a verified source are disabled', await ev(`['ar.saadalghamadi', 'ar.mahmoudalialbanna'].every(id => document.querySelector('#dlAudioReciter option[value="' + id + '"]').disabled)
      && !document.querySelector('#dlAudioReciter option[value="ar.alafasy"]').disabled`));

    // audio via the form
    await ev(`document.getElementById('dlAudioSurah').value = '108'; document.getElementById('dlAudioReciter').value = 'ar.husary';
      document.querySelector('#dlAudioForm button[type=submit]').click()`);
    check('form download (108, Husary) completes', await b.waitFor(`!!OfflineAudio.getComplete('ar.husary', 108)`, 60000));
    check('list shows the downloaded item with play/delete', await b.waitFor(`[...document.querySelectorAll('#dlAudioList .dl-item[data-status="complete"]')].some(x => x.textContent.includes(MushafMeta.surahs[107][0]) && x.querySelector('[data-act="play"]') && x.querySelector('[data-act="delete"]'))`, 5000));
    await ev(`document.querySelector('#dlAudioList [data-act="play"]').click()`);
    check('play from Downloads switches to its reciter and plays', await b.waitFor(`AudioPlayer.currentReciter === 'ar.husary' && PlaybackStore.get().surah === 108 && PlaybackStore.get().status === 'playing' && PlaybackStore.get().local`, 15000));
    await ev(`AudioPlayer.stop(); document.querySelector('#dlAudioList [data-act="delete"]').click()`);
    check('delete from the list', await b.waitFor(`!OfflineAudio.get('ar.husary', 108) && /لا توجد سور/.test(document.getElementById('dlAudioList').textContent)`, 5000));

    // Mushaf range via the form
    await ev(`const f = document.querySelector('#dlMushaf form[data-form="range"]'); f.elements.from.value = 601; f.elements.to.value = 600;
      f.querySelector('button[type=submit]').click()`);
    check('range form (reversed 601–600) downloads 600, 601 and page 1', await b.waitFor(`MushafStore.job && MushafStore.job.status === 'done' && [1, 600, 601].every(p => MushafStore.isDownloaded(p))`, 60000));
    check('summary shows 3 of 604 pages', await b.waitFor(`/٣\\s*من ٦٠٤/.test(document.querySelector('#dlMushaf .dl-summary').textContent)`, 5000));
    check('invalid range is rejected', await ev(`(() => { const f = document.querySelector('#dlMushaf form[data-form="range"]'); f.elements.from.value = 0; f.elements.to.value = 700;
      return Downloads.rangeFrom(f) === null; })()`));

    // reader download panel
    await ev(`App.navigateToPage('mushaf'); DigitalMushaf.loadPage(602)`);
    await b.waitFor(`document.getElementById('mrPage').dataset.page === '602' && !!document.querySelector('#mrPage .mr-w')`, 20000);
    check('availability badge says "from the internet"', await ev(`document.getElementById('mrAvail').classList.contains('is-online')`));
    await ev(`document.querySelector('#mushafReader [data-act="download"]').click()`);
    check('download panel opens as a dialog with sizes', await b.waitFor(`!!document.querySelector('#mushafDownloadPanel [role="dialog"]') && /ميجابايت|كيلوبايت/.test(document.getElementById('mushafDownloadPanel').textContent)`, 5000));
    await ev(`document.querySelector('#mushafDownloadPanel [data-dl="page"]').click()`);
    check('"this page" downloads page 602', await b.waitFor(`MushafStore.isDownloaded(602)`, 30000));
    check('badge updates to "saved on device"', await b.waitFor(`document.getElementById('mrAvail').classList.contains('is-local')`, 5000));
    await ev(`document.querySelector('#mushafReader [data-act="index"]').click()`);
    check('index panel lists 114 Surahs', await b.waitFor(`document.querySelectorAll('#navigationTabContent .mr-item').length === 114`, 5000));
    await ev(`document.querySelector('#navigationModal [data-tab="juz"]').click()`);
    await ev(`document.querySelector('#navigationTabContent [data-goto="582"]').click()`);
    check('Juz 30 navigation (offline mapping) goes to page 582', await b.waitFor(`DigitalMushaf.currentPage === 582 && !document.getElementById('navigationModal')`, 5000));
    await ev(`document.querySelector('#mushafReader [data-act="index"]').click()`);
    await ev(`document.querySelector('#navigationTabContent .mr-item:nth-child(18)').click()`);
    check('Surah navigation: Al-Kahf → page 293', await b.waitFor(`DigitalMushaf.currentPage === 293`, 5000));
    await ev(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))`);

    // settings persist
    await ev(`document.querySelector('#mushafReader [data-act="settings"]').click()`);
    await ev(`document.querySelector('#mushafSettingsPanel input[name="tone"][value="dark"]').click()`);
    check('reading setting applies and persists', await ev(`document.getElementById('mushafReader').dataset.tone === 'dark' && JSON.parse(localStorage.getItem('mushaf_prefs')).tone === 'dark'`));
    await ev(`document.querySelector('#mushafSettingsPanel [data-close]').click()`);

    // swipe (touch) turns the page; vertical drag does not
    const swipe = async (dx, dy) => {
      await ev(`(() => { const s = document.getElementById('mrStage'); const r = s.getBoundingClientRect(); const x = r.left + r.width / 2, y = r.top + 200;
        const o = (t, X, Y) => s.dispatchEvent(new PointerEvent(t, { pointerType: 'touch', isPrimary: true, clientX: X, clientY: Y, bubbles: true }));
        o('pointerdown', x, y); o('pointerup', x + ${dx}, y + ${dy}); })()`);
      await b.sleep(300);
    };
    await swipe(120, 10);
    check('swipe right → next page (294)', await ev(`DigitalMushaf.currentPage === 294`));
    await swipe(-120, 5);
    check('swipe left → previous page (293)', await ev(`DigitalMushaf.currentPage === 293`));
    await swipe(30, 200);
    check('vertical drag does not turn the page', await ev(`DigitalMushaf.currentPage === 293`));

    // backup
    await ev(`App.navigateToPage('downloads'); localStorage.setItem('mushaf_bookmarks', '[5,77]')`);
    const exported = await ev(`(async () => {
      let text = null; const orig = URL.createObjectURL;
      URL.createObjectURL = (blob) => { blob.text().then(t => window.__exp = t); return orig.call(URL, blob); };
      await Downloads.exportData(); await new Promise(r => setTimeout(r, 300)); URL.createObjectURL = orig; return window.__exp; })()`);
    const parsed = JSON.parse(exported || '{}');
    check('export contains reading data', parsed.app === 'quran-kareem' && parsed.items.mushaf_bookmarks === '[5,77]');
    await ev(`localStorage.setItem('mushaf_bookmarks', '[]')`);
    await ev(`Downloads.importData({ target: { files: [new File([${JSON.stringify(exported)}], 'b.json')], value: '' } })`);
    check('import restores bookmarks', await b.waitFor(`localStorage.getItem('mushaf_bookmarks') === '[5,77]'`, 3000));
    await ev(`Downloads.importData({ target: { files: [new File(['{"nope":1}'], 'x.json')], value: '' } })`);
    check('invalid backup file is rejected', await b.waitFor(`[...document.querySelectorAll('.toast.error')].some(t => /ليس نسخة احتياطية/.test(t.textContent))`, 3000));

    // card shows unsupported for a reciter without a verified source
    await ev(`AudioPlayer.setReciter('ar.mahmoudalialbanna'); App.navigateToPage('home')`);
    check('Surah cards show "unsupported" for al-Banna', await b.waitFor(`document.querySelector('[data-dl-surah="1"]').dataset.state === 'unsupported'`, 5000));
  } catch (e) { console.log('ERR', e.stack); results.push(false); }
  const errs = b.logs.filter(l => /\[EXC\]/.test(l));
  if (errs.length) { console.log(errs.join('\n')); results.push(false); }
  await b.closeAndWait();
  console.log(results.every(Boolean) ? 'ALL PASS' : 'SOME FAILED');
  process.exit(results.every(Boolean) ? 0 : 1);
})();
