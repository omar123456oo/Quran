const { launch } = require('./cdp.js');
const results = [];
const check = (name, ok, extra = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} ${extra}`); };
(async () => {
  const b = await launch();
  try {
    await b.goto('http://127.0.0.1:8000/index.html');
    await b.waitFor('QuranDisplay.surahs.length === 114');
    // speed up playback & record every transition
    await b.ev(`(() => { AudioPlayer.audio.defaultPlaybackRate = 16; AudioPlayer.audio.playbackRate = 16;
      window.__seq = []; window.__items = []; window.__status = [];
      PlaybackStore.subscribe((s, k) => {
        if (k.includes('ayah') || k.includes('surah')) __seq.push(s.surah + ':' + s.ayah);
        if (k.includes('itemId')) __items.push(PlayerState.queue.current && PlayerState.queue.current.ref);
        if (k.includes('status')) __status.push(s.status);
      }); })()`);

    // 1. create playlist via the real UI
    await b.ev(`App.navigateToPage('playlists')`);
    await b.ev(`(() => { const f = document.querySelector('form[data-form=create]'); f.elements.name.value = 'تجربة'; f.elements.desc.value = 'ثلاث سور قصيرة'; f.requestSubmit(); })()`);
    check('playlist created', await b.ev(`PlayerState.playlists.playlists.length === 1 && PlayerState.playlists.selected().name === 'تجربة'`));
    for (const n of [108, 109, 110]) await b.ev(`document.querySelector('[data-action=p-add][data-ref="${n}"]').click()`);
    check('3 surahs added in order', await b.ev(`JSON.stringify(PlayerState.playlists.selected().items.map(i => i.ref)) === '[108,109,110]'`));
    check('playlist items rendered', await b.ev(`document.querySelectorAll('#plSection .pl-item').length === 3`));

    // duplicate add (confirm auto-accepted)
    await b.ev(`window.confirm = () => true; document.querySelector('[data-action=p-add][data-ref="108"]').click()`);
    check('duplicate surah can be added explicitly', await b.ev(`PlayerState.playlists.selected().items.length === 4`));
    await b.ev(`(() => { const pl = PlayerState.playlists.selected(); PlayerState.playlists.removeItem(pl.id, pl.items[3].id); PlayerState.touch(['playlists']); })()`);

    // 2. play playlist: automatic sequential playback
    await b.ev(`document.querySelector('[data-action=pl-play]').click()`);
    check('playback starts (status playing)', await b.waitFor(`PlaybackStore.get().status === 'playing'`, 20000));
    check('active playlist item marked', await b.ev(`document.querySelectorAll('#plSection .pl-item.is-active').length === 1`));
    const ended = await b.waitFor(`PlaybackStore.get().status === 'ended'`, 90000);
    check('playlist finished by itself', ended);
    console.log('   items:', await b.ev(`JSON.stringify(__items)`), ' ayahs:', await b.ev(`__seq.length`));
    check('plays surahs in exact order, once each', await b.ev(`JSON.stringify(__items) === '[108,109,110]'`));
    check('every ayah exactly once (3+6+3=12)', await b.ev(`__seq.length === 12 && new Set(__seq).size === 12`), await b.ev(`__seq.join(' ')`));
    check('last item retained, nothing restarted', await b.ev(`PlayerState.queue.current.ref === 110 && PlaybackStore.get().status === 'ended'`));
  } catch (e) { console.log('ERR', e.stack); results.push(false); }
  console.log('--- console errors ---\n' + b.logs.filter(l => /error|EXC|warn/i.test(l)).join('\n'));
  console.log(results.every(Boolean) ? 'ALL PASS' : 'SOME FAILED');
  b.close();
})();
