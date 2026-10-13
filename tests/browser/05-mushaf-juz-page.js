const { launch } = require('./cdp.js');
const results = [];
const check = (name, ok, extra = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} ${extra}`); };
(async () => {
  const b = await launch();
  const ev = b.ev;
  try {
    await b.goto('http://127.0.0.1:8000/index.html');
    await b.waitFor('QuranDisplay.surahs.length === 114');
    await ev(`AudioPlayer.audio.defaultPlaybackRate = 16; AudioPlayer.audio.playbackRate = 16; window.confirm = () => true;`);

    // Mushaf page: play this page, then browse away; keyboard handler registered once
    await ev(`localStorage.setItem('mushaf_last_page', '604'); App.navigateToPage('mushaf')`);
    check('mushaf renders play bar', await b.waitFor(`!!document.querySelector('.mushaf-playbar')`, 15000));
    await ev(`document.querySelector('.mushaf-playbar .btn-primary').click()`);
    check('play page 604 → page item with page context', await b.waitFor(`PlaybackStore.get().status === 'playing' && PlaybackStore.get().page === 604`, 25000));
    await ev(`AudioPlayer.audio.playbackRate = 1; DigitalMushaf.loadPage(600)`);
    await b.sleep(1500);
    check('manual page (600) is separate from playing page (604)', await ev(`DigitalMushaf.currentPage === 600 && PlaybackStore.get().page === 604 && !document.getElementById('mushafJumpPlaying').hidden`));
    await ev(`document.getElementById('mushafJumpPlaying').click()`);
    await b.sleep(1500);
    check('jump button goes to the playing page', await ev(`DigitalMushaf.currentPage === 604`));
    await ev(`for (let i = 0; i < 4; i++) { App.navigateToPage('home'); App.navigateToPage('mushaf'); }`);
    await b.sleep(1500);
    await ev(`DigitalMushaf.loadPage(10)`); await b.sleep(800);
    await ev(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }))`);
    await b.sleep(800);
    check('keyboard handler fires once per key (10 → 11)', await ev(`DigitalMushaf.currentPage === 11`), 'page ' + await ev(`DigitalMushaf.currentPage`));
    await ev(`AudioPlayer.stop()`);

    // Juz and page from the reader (previously missing functions)
    await ev(`AudioPlayer.audio.playbackRate = 16; AudioPlayer.playFullJuz(30)`);
    check('playFullJuz(30) plays', await b.waitFor(`PlaybackStore.get().status === 'playing' && PlaybackStore.get().juz === 30`, 40000));
    await ev(`AudioPlayer.stop(); AudioPlayer.playFullPage(1)`);
    check('playFullPage(1) plays', await b.waitFor(`PlaybackStore.get().status === 'playing' && PlaybackStore.get().page === 1`, 25000));
    await ev(`AudioPlayer.stop()`);

    // Reader nav link keeps the open content
    await ev(`QuranDisplay.loadSurah(112)`);
    await b.waitFor(`document.querySelectorAll('#surahContent .ayah-container').length === 4`);
    await ev(`App.navigateToPage('settings'); document.querySelector('.nav-link[data-page=surah]').click()`);
    await b.sleep(500);
    check('"القراءة" nav returns to the open surah without reloading', await ev(`!document.getElementById('surahPage').classList.contains('hidden') && document.querySelectorAll('#surahContent .ayah-container').length === 4`));
  } catch (e) { console.log('ERR', e.stack); results.push(false); }
  console.log('--- console errors ---\n' + b.logs.filter(l => /error|EXC/i.test(l)).join('\n'));
  console.log(results.every(Boolean) ? 'ALL PASS' : 'SOME FAILED');
  b.close();
})();
