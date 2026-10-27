// Reciter Yasser Al-Dosari (per-ayah files from everyayah.com): selection, playback with
// verse sync, page playback, offline download. Needs the dev server on :8000 and network.
const { launch } = require('./cdp.js');
const results = [];
const check = (name, ok, extra = '') => { results.push(!!ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} ${extra}`); };
const FOLDER = 'https://everyayah.com/data/Yasser_Ad-Dussary_128kbps/';

(async () => {
  const b = await launch({ port: 9395, profile: 'yasser' });
  const ev = b.ev;
  try {
    await b.goto('http://127.0.0.1:8000/index.html');
    await b.waitFor('QuranDisplay.surahs.length === 114', 20000);
    await ev(`window.confirm = () => true; AudioPlayer.setReciter('ar.alafasy'); AudioPlayer.playNow('surah', 1)`);
    await b.waitFor(`PlaybackStore.get().status === 'playing'`, 20000);
    await ev(`PlayerViews.minimize(); PlayerViews.setView('docked'); document.getElementById('reciterBtn').click()`);
    check('reciter menu lists ياسر الدوسري', await b.waitFor(`[...document.querySelectorAll('#reciterList .reciter-option')].some(o => /ياسر الدوسري/.test(o.textContent))`, 5000));
    await ev(`[...document.querySelectorAll('#reciterList .reciter-option')].find(o => /ياسر الدوسري/.test(o.textContent)).click()`);
    check('switching keeps playing, now from the Dosari folder', await b.waitFor(`AudioPlayer.currentReciter === 'yasser.aldossari' && PlaybackStore.get().status === 'playing' && AudioPlayer.audio.src.startsWith('${FOLDER}')`, 20000),
      await ev('AudioPlayer.audio.src'));
    check('reciter name shown in the player', await ev(`document.getElementById('currentReciter').textContent === 'ياسر الدوسري'`));
    await ev(`PlayerViews.setView('compact'); AudioPlayer.playNow('surah', 112)`);
    check('Surah 112 plays ayah 1 file 112001.mp3', await b.waitFor(`PlaybackStore.get().surah === 112 && PlaybackStore.get().ayah === 1 && PlaybackStore.get().status === 'playing' && AudioPlayer.audio.src === '${FOLDER}112001.mp3'`, 20000));
    check('verse text and count come from the Quran text (4 ayahs)', await ev(`PlaybackStore.get().ayahCount === 4 && PlaybackStore.get().ayahText.length > 5`));
    await ev(`AudioPlayer.nextAyah()`);
    check('next verse → 112002.mp3', await b.waitFor(`PlaybackStore.get().ayah === 2 && AudioPlayer.audio.src === '${FOLDER}112002.mp3' && PlaybackStore.get().status === 'playing'`, 15000));
    await ev(`AudioPlayer.audio.playbackRate = 16`);
    check('continues to the next ayah by itself', await b.waitFor(`PlaybackStore.get().ayah >= 3`, 20000));
    await ev(`AudioPlayer.audio.playbackRate = 1; AudioPlayer.playNow('page', 604)`);
    check('page 604 plays across 3 Surahs (15 ayahs)', await b.waitFor(`PlaybackStore.get().status === 'playing' && PlaybackStore.get().ayahCount === 15 && PlaybackStore.get().page === 604`, 20000));
    await ev(`AudioPlayer.stop()`);

    // offline download
    await ev(`App.navigateToPage('downloads')`);
    check('Downloads: reciter is downloadable', await b.waitFor(`!!document.querySelector('#dlAudioReciter option[value="yasser.aldossari"]') && !document.querySelector('#dlAudioReciter option[value="yasser.aldossari"]').disabled`, 5000));
    await ev(`OfflineAudio.download(112, 'yasser.aldossari')`);
    check('Surah 112 downloads and verifies', await b.waitFor(`(OfflineAudio.getComplete('yasser.aldossari', 112) || {}).verified === true && OfflineAudio.getComplete('yasser.aldossari', 112).total === 4`, 60000));
    await ev(`AudioPlayer.playNow('surah', 112)`);
    check('downloaded Surah plays from the device', await b.waitFor(`PlaybackStore.get().local === true && AudioPlayer.audio.src.startsWith('blob:') && PlaybackStore.get().status === 'playing'`, 15000));
    await ev(`AudioPlayer.stop(); OfflineAudio.remove('audio:yasser.aldossari:112')`);
  } catch (e) { console.log('ERR', e.stack); results.push(false); }
  const errs = b.logs.filter(l => /\[EXC\]/.test(l));
  check('no uncaught exceptions', !errs.length, errs.join(' | '));
  await b.closeAndWait();
  console.log(results.every(Boolean) ? 'ALL PASS' : 'SOME FAILED');
  process.exit(results.every(Boolean) ? 0 : 1);
})();
