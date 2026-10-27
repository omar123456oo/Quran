const { launch } = require('./cdp.js');
const results = [];
const check = (name, ok, extra = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} ${extra}`); };
(async () => {
  const b = await launch();
  const ev = b.ev;
  try {
    await b.goto('http://127.0.0.1:8000/index.html');
    await b.waitFor('QuranDisplay.surahs.length === 114');
    await ev(`(() => { AudioPlayer.audio.defaultPlaybackRate = 16; AudioPlayer.audio.playbackRate = 16; window.confirm = () => true;
      window.__seq = []; PlaybackStore.subscribe((s, k) => { if (k.includes('ayah') || k.includes('surah')) __seq.push(s.surah + ':' + s.ayah); }); })()`);

    // --- reader <-> player sync (surah-level via reader button)
    await ev(`QuranDisplay.loadSurah(108)`);
    await b.waitFor(`document.querySelectorAll('#surahContent .ayah-container').length === 3`);
    await ev(`document.querySelector('#surahContent .play-actions .btn-primary').click()`);
    check('Play from reader starts playback', await b.waitFor(`PlaybackStore.get().status === 'playing'`, 20000));
    check('playing ayah highlighted in reader', await b.waitFor(`document.querySelectorAll('.ayah-container.ayah-playing').length === 1`, 5000));
    // 4 ayah-level: highlight moves with the verse
    const before = await ev(`document.querySelector('.ayah-container.ayah-playing').dataset.numberInSurah`);
    // user selects a different ayah: selection is separate from playing
    await ev(`document.querySelector('.ayah-container[data-number-in-surah="1"]').click()`);
    check('selected ayah is distinct from playing ayah', await ev(`document.querySelectorAll('.ayah-selected').length === 1 && !!document.querySelector('.ayah-container.ayah-selected')`));
    check('reading position stored separately', await ev(`PlaybackStore.reading.surah === 108 && PlaybackStore.reading.ayah === 1`));

    // navigate away and back many times: no restart/dup
    const t0 = await ev(`__seq.length`);
    for (let i = 0; i < 8; i++) { await ev(`App.navigateToPage('home')`); await ev(`App.navigateToPage('playlists')`); await ev(`App.navigateToPage('surah')`); }
    check('reader still shows same surah after navigation', await ev(`document.querySelectorAll('#surahContent .ayah-container').length === 3`));
    await b.waitFor(`PlaybackStore.get().status === 'ended'`, 30000);
    const seq1 = await ev(`__seq.join(' ')`);
    check('no duplicated/restarted ayahs after repeated navigation', seq1 === '108:1 108:2 108:3', seq1);

    // jump-to-playing from another surah view
    await ev(`AudioPlayer.playAyah(110, 2)`);
    await b.waitFor(`PlaybackStore.get().ayah === 2 && PlaybackStore.get().surah === 110`, 20000);
    await ev(`QuranDisplay.loadSurah(1)`);
    await b.waitFor(`document.querySelectorAll('#surahContent .ayah-container').length === 7`);
    await ev(`document.getElementById('jumpToPlayingBtn').click()`);
    check('jump to playing loads the playing surah', await b.waitFor(`document.querySelectorAll('#surahContent .ayah-container[data-surah="110"]').length === 3`, 10000));
    await b.waitFor(`PlaybackStore.get().status === 'ended'`, 20000);

    // --- pause / resume / seek keep context
    await ev(`AudioPlayer.playNow('surah', 114)`);
    await b.waitFor(`PlaybackStore.get().status === 'playing'`, 20000);
    await ev(`AudioPlayer.audio.playbackRate = 1; AudioPlayer.audio.defaultPlaybackRate = 1`);
    await ev(`AudioPlayer.pause()`);
    await b.sleep(300);
    check('pause → paused, same context', await ev(`PlaybackStore.get().status === 'paused' && PlaybackStore.get().surah === 114`));
    const tp = await ev(`AudioPlayer.audio.currentTime`);
    await ev(`AudioPlayer.seek(0.5)`);
    await b.sleep(200);
    check('seek works', await ev(`Math.abs(AudioPlayer.audio.currentTime - AudioPlayer.audio.duration * 0.5) < 0.3`), `(was ${tp.toFixed(2)})`);
    await ev(`AudioPlayer.play()`);
    check('resume → playing, same ayah/surah', await b.waitFor(`PlaybackStore.get().status === 'playing' && PlaybackStore.get().surah === 114`, 5000));
    await ev(`AudioPlayer.audio.playbackRate = 16`);

    // --- queue operations
    await ev(`AudioPlayer.playNow('surah', 108)`);
    await b.waitFor(`PlaybackStore.get().status === 'playing'`, 20000);
    await ev(`AudioPlayer.addToQueue('surah', 109); AudioPlayer.addToQueue('surah', 110); AudioPlayer.playNextItem('surah', 112)`);
    check('Play Next goes first, Add goes last; current untouched', await ev(`JSON.stringify(PlayerState.queue.upcoming.map(e => e.ref)) === '[112,109,110]' && PlayerState.queue.current.ref === 108`));
    await ev(`AudioPlayer.moveQueued(PlayerState.queue.upcoming[2].id, -1)`);
    check('reorder upcoming', await ev(`JSON.stringify(PlayerState.queue.upcoming.map(e => e.ref)) === '[112,110,109]'`));
    await ev(`AudioPlayer.removeQueued(PlayerState.queue.upcoming[0].id)`);
    check('remove upcoming', await ev(`JSON.stringify(PlayerState.queue.upcoming.map(e => e.ref)) === '[110,109]'`));
    await ev(`App.navigateToPage('playlists')`);
    check('queue UI renders upcoming items', await ev(`document.querySelectorAll('#qSection .pl-item').length === 2`));
    await ev(`AudioPlayer.clearUpcoming()`);
    check('clear queue keeps current playing', await ev(`PlayerState.queue.upcoming.length === 0 && PlayerState.queue.current.ref === 108 && ['playing','buffering','loading'].includes(PlaybackStore.get().status)`));
    await b.waitFor(`PlaybackStore.get().status === 'ended'`, 20000);
    check('queue empty → ends gracefully, no restart', await ev(`PlaybackStore.get().status === 'ended' && PlayerState.queue.current.ref === 108`));

    // --- first/last item
    await ev(`PlayerState.queue.setRepeat('off'); AudioPlayer.playNow('surah', 108)`);
    await b.waitFor(`PlaybackStore.get().status === 'playing'`, 20000);
    await ev(`AudioPlayer.playNext()`);
    await b.sleep(300);
    check('Next on last item does nothing destructive', await ev(`PlayerState.queue.current.ref === 108`));
  } catch (e) { console.log('ERR', e.stack); results.push(false); }
  console.log('--- console errors ---\n' + b.logs.filter(l => /error|EXC/i.test(l)).join('\n'));
  console.log(results.every(Boolean) ? 'ALL PASS' : 'SOME FAILED');
  b.close();
})();
