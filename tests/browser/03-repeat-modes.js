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
      window.__seq = []; window.__items = [];
      PlaybackStore.subscribe((s, k) => { if (k.includes('ayah') || k.includes('surah')) __seq.push(s.surah + ':' + s.ayah);
        if (k.includes('itemId')) __items.push(PlayerState.queue.current && PlayerState.queue.current.ref); }); })()`);

    // repeat one ×2 on a single item
    await ev(`PlayerState.queue.setRepeat('one'); PlayerState.prefs.repeatCount = 2; AudioPlayer.playNow('surah', 108)`);
    await b.waitFor(`PlaybackStore.get().status === 'ended'`, 120000);
    check('repeat one ×2 on single item plays exactly twice then ends', await ev(`__seq.join(' ') === '108:1 108:2 108:3 108:1 108:2 108:3'`), await ev(`__seq.join(' ')`));

    // repeat all from a saved playlist
    await ev(`(() => { __items.length = 0; PlayerState.queue.setRepeat('all'); const s = PlayerState.playlists; const pl = s.create('حلقة'); [108,110].forEach(n => s.addItem(pl.id,'surah',n)); AudioPlayer.playPlaylist(pl.id); })()`);
    check('repeat all: playlist loops in order', await b.waitFor(`__items.length >= 5`, 120000) && await ev(`JSON.stringify(__items.slice(0,5)) === '[108,110,108,110,108]'`), await ev(`JSON.stringify(__items)`));
    check('no duplicate sound: single in-flight ayah (status playing/buffering)', await ev(`['playing','buffering','loading'].includes(PlaybackStore.get().status)`));
    await ev(`AudioPlayer.stop(); PlayerState.queue.setRepeat('off')`);
  } catch (e) { console.log('ERR', e.stack); results.push(false); }
  console.log('--- console errors ---\n' + b.logs.filter(l => /error|EXC/i.test(l)).join('\n'));
  console.log(results.every(Boolean) ? 'ALL PASS' : 'SOME FAILED');
  b.close();
})();
