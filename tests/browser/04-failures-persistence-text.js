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
      window.__items = []; PlaybackStore.subscribe((s, k) => { if (k.includes('itemId')) __items.push(PlayerState.queue.current && PlayerState.queue.current.ref); });
      window.__realResolve = AudioPlayer.resolveAyahs.bind(AudioPlayer); })()`);

    // --- Quranic text integrity: displayed text == API text, nothing altered
    const integrity = await ev(`(async () => {
      const out = [];
      for (const n of [1, 2, 9, 36, 112, 114]) {
        await QuranDisplay.loadSurah(n);
        const api = await (await fetch('https://api.alquran.cloud/v1/surah/' + n + '/quran-uthmani')).json();
        const dom = [...document.querySelectorAll('#surahContent .ayah-container .ayah-arabic')].map(e => e.textContent);
        const ok = api.data.ayahs.length === dom.length && api.data.ayahs.every((a, i) => {
          const shown = dom[i].replace(/\\s*﴿[٠-٩]+﴾\\s*$/, '').replace(/^\\s+|\\s+$/g, '');
          return shown.replace(/\\uFEFF/g, '') === a.text.replace(/\\uFEFF/g, '').trim();
        });
        const banner = document.querySelectorAll('#surahContent > .card.text-center .arabic-text[style*="3xl"]').length;
        out.push(n + ':' + (ok ? 'same' : 'DIFF') + ':banner' + banner);
      }
      return out.join(' ');
    })()`);
    console.log('   ', integrity);
    check('Quran text identical to source for 6 surahs', !/DIFF/.test(integrity));
    check('Bismillah never duplicated (no extra banner when text has it)', /2:same:banner0/.test(integrity));

    // --- missing recording for one item → skipped, playback continues
    await ev(`AudioPlayer.resolveAyahs = async (item, r) => item.ref === 109 ? [] : __realResolve(item, r);
      __items.length = 0; AudioPlayer.playNow('surah', 108); AudioPlayer.addToQueue('surah', 109); AudioPlayer.addToQueue('surah', 110)`);
    await b.waitFor(`PlaybackStore.get().status === 'ended'`, 90000);
    check('unavailable item skipped, next still plays', await ev(`JSON.stringify(__items) === '[108,109,110]' && PlayerState.queue.current.ref === 110`), await ev(`JSON.stringify(__items)`));

    // --- everything fails → stops (no infinite loop), status error
    await ev(`AudioPlayer.resolveAyahs = async () => { throw new Error('offline'); };
      __items.length = 0; PlayerState.queue.setRepeat('all'); AudioPlayer.playNow('surah', 108); AudioPlayer.addToQueue('surah', 110)`);
    await b.sleep(4000);
    const st = await ev(`PlaybackStore.get().status`);
    const n1 = await ev(`__items.length`); await b.sleep(2000); const n2 = await ev(`__items.length`);
    check('network failure + repeat all: stops with error, no skip loop', st === 'error' && n1 === n2 && n1 <= 8, `(status ${st}, attempts ${n1})`);
    await ev(`PlayerState.queue.setRepeat('off'); AudioPlayer.resolveAyahs = __realResolve; AudioPlayer.failures = 0`);
    await ev(`AudioPlayer.play()`);
    check('retry after failure recovers', await b.waitFor(`PlaybackStore.get().status === 'playing'`, 20000));

    // --- remove current item while playing → moves to next
    await ev(`PlayerState.queue.clearUpcoming(); AudioPlayer.addToQueue('surah', 112); AudioPlayer.removeCurrent()`);
    check('removing playing item advances to next', await b.waitFor(`PlayerState.queue.current && PlayerState.queue.current.ref === 112`, 5000));
    await b.waitFor(`PlaybackStore.get().status === 'playing'`, 20000);
    await ev(`AudioPlayer.removeCurrent()`);
    await b.sleep(300);
    check('removing last item stops playback cleanly', await ev(`PlayerState.queue.current === null && PlaybackStore.get().status === 'idle'`));

    // --- reciter switch keeps ayah & verifies availability
    await ev(`AudioPlayer.playNow('surah', 109)`);
    await b.waitFor(`PlaybackStore.get().status === 'playing'`, 20000);
    await ev(`AudioPlayer.audio.playbackRate = 1; AudioPlayer.pause()`);
    const ay = await ev(`PlaybackStore.get().ayah`);
    await ev(`AudioPlayer.selectReciter('ar.husary', 'محمود خليل الحصري')`);
    await b.sleep(2500);
    check('reciter switch: same ayah, new voice URL', await ev(`PlaybackStore.get().ayah === ${ay} && PlaybackStore.get().audioSrc.includes('ar.husary') && AudioPlayer.currentReciter === 'ar.husary'`));
    check('reciter shown in player', await ev(`document.getElementById('currentReciter').textContent.includes('الحصري')`));
    await ev(`AudioPlayer.stop()`);

    // --- persistence
    await ev(`(() => { const s = PlayerState.playlists; const pl = s.create('محفوظة'); [1, 2, 3].forEach(n => s.addItem(pl.id, 'surah', n)); PlayerState.queue.setShuffle(false); AudioPlayer.setVolume(0.33); PlayerStorage.flush(); })()`);
    const storedBefore = await ev(`PlayerState.playlists.playlists.map(p => p.name + ':' + p.items.length).join(',')`);
    await b.goto('http://127.0.0.1:8000/index.html');
    await b.waitFor('QuranDisplay.surahs.length === 114');
    const after = await ev(`PlayerState.playlists.playlists.map(p => p.name + ':' + p.items.length).join(',')`);
    check('playlists survive a page refresh', storedBefore === after && after.includes('محفوظة:3'), after);
    check('volume preference restored', await ev(`Math.abs(AudioPlayer.audio.volume - 0.33) < 0.01`));
    check('restored queue is paused, not auto-playing', await ev(`PlaybackStore.get().status === 'paused' || PlaybackStore.get().status === 'idle'`));

    // --- corrupted storage
    await ev(`localStorage.setItem('quran_player_v1', '{not json')`);
    await b.goto('http://127.0.0.1:8000/index.html');
    check('corrupted storage → app still starts, empty playlists', await b.waitFor('QuranDisplay.surahs.length === 114') && await ev(`PlayerState.playlists.playlists.length === 0`));
    await ev(`localStorage.setItem('quran_player_v1', JSON.stringify({version:1, playlists:{playlists:[{id:'x',name:'<img src=x onerror=alert(1)>',items:[{kind:'surah',ref:5},{kind:'surah',ref:999},{kind:'hack'}]}]}, queue:{current:{kind:'surah',ref:'7'},upcoming:[{kind:'page',ref:9999}]}}))`);
    await b.goto('http://127.0.0.1:8000/index.html');
    await b.waitFor('QuranDisplay.surahs.length === 114');
    await ev(`App.navigateToPage('playlists')`);
    check('persisted data validated (bad items dropped)', await ev(`PlayerState.playlists.playlists[0].items.length === 1 && PlayerState.queue.current.ref === 7 && PlayerState.queue.upcoming.length === 0`));
    check('playlist name rendered as text, not HTML', await ev(`document.querySelectorAll('#plSection img').length === 0 && document.querySelector('#plSection strong').textContent.includes('<img')`));
    await ev(`localStorage.setItem('quran_settings', '{bad')`);
    await b.goto('http://127.0.0.1:8000/index.html');
    check('corrupted settings → defaults, app starts', await b.waitFor('QuranDisplay.surahs.length === 114'));
  } catch (e) { console.log('ERR', e.stack); results.push(false); }
  console.log('--- console errors ---\n' + b.logs.filter(l => /error|EXC/i.test(l) && !/offline/.test(l)).join('\n'));
  console.log(results.every(Boolean) ? 'ALL PASS' : 'SOME FAILED');
  b.close();
})();
