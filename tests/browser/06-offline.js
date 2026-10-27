// Offline audio + Mushaf, end to end, with the network really unavailable.
//   Session A (online)            : download Surahs and Mushaf pages; failure, cancel, retry.
//   Session B (restart, offline)  : same profile; every external host is unresolvable
//                                   (--host-resolver-rules) and the page is emulated offline.
//   Session C (no server at all)  : the local web server is stopped too; the service worker
//                                   must serve the app shell.
// Starts its own static server on :8010 so it can stop it for session C.
const { spawn } = require('node:child_process');
const path = require('node:path');
const { launch } = require('./cdp.js');

const ROOT = path.join(__dirname, '..', '..');
const URL_ = 'http://127.0.0.1:8010/index.html';
const PROFILE = 'offline-e2e';
const SHELL_CACHE = 'quran-shell-' + require('node:fs').readFileSync(path.join(ROOT, 'sw.js'), 'utf8').match(/const VERSION = '([^']+)'/)[1];
const NO_NET = ['--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1'];
const results = [];
const check = (name, ok, extra = '') => { results.push(!!ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} ${extra}`); };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function startServer() {
  const s = spawn('python3', ['-m', 'http.server', '8010', '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
  return sleep(800).then(() => s);
}
const external = (urls) => urls.filter(u => !/^(https?:\/\/127\.0\.0\.1|blob:|data:|chrome)/.test(u));

(async () => {
  let server = await startServer();
  let b;
  try {
    /* ------------------------------------------------------------ Session A */
    b = await launch({ port: 9341, profile: PROFILE });
    let ev = b.ev;
    await b.goto(URL_);
    await b.waitFor('QuranDisplay.surahs.length === 114', 20000);
    check('service worker installed and shell cached', await b.waitFor(`navigator.serviceWorker.ready.then(r => !!r.active).then(() => caches.has('${SHELL_CACHE}'))`, 20000));
    await b.goto(URL_);                                            // now controlled by the worker
    await b.waitFor('QuranDisplay.surahs.length === 114', 20000);
    check('page is controlled by the service worker', await ev('!!navigator.serviceWorker.controller'));
    await ev(`AudioPlayer.setReciter('ar.alafasy'); window.confirm = () => true;`);

    // download via the Surah card button (the user path)
    await ev(`document.querySelector('[data-dl-surah="112"]').click()`);
    check('Surah 112 downloads and is verified', await b.waitFor(`(OfflineAudio.getComplete('ar.alafasy', 112) || {}).verified === true`, 60000));
    check('112: 4 files stored with matching sizes', await ev(`(async () => {
      const r = OfflineAudio.getComplete('ar.alafasy', 112); const c = await caches.open('quran-audio-v1');
      let ok = r.total === 4 && r.ayahs.length === 4;
      for (const a of r.ayahs) { const m = await c.match(a.key); ok = ok && !!m && Number(m.headers.get('Content-Length')) === a.size && a.size > 1000; }
      return ok; })()`));
    check('card button shows "downloaded"', await b.waitFor(`document.querySelector('[data-dl-surah="112"]').dataset.state === 'complete'`, 5000));

    // a failed file must leave the Surah NOT available offline
    await b.send('Network.enable');
    await b.send('Network.setBlockedURLs', { urls: ['*everyayah.com/data/Alafasy_128kbps/114003.mp3'] });
    await ev(`OfflineAudio.download(114, 'ar.alafasy').catch(e => window.__err114 = e.code)`);
    check('blocked file → Surah 114 marked failed, not complete', await b.waitFor(`(OfflineAudio.get('ar.alafasy', 114) || {}).status === 'failed'`, 60000) &&
      await ev(`OfflineAudio.getComplete('ar.alafasy', 114) === null && OfflineAudio.get('ar.alafasy', 114).done < 6`));
    await b.send('Network.setBlockedURLs', { urls: [] });
    await ev(`OfflineAudio.retry('audio:ar.alafasy:114')`);
    check('retry completes Surah 114', await b.waitFor(`!!OfflineAudio.getComplete('ar.alafasy', 114)`, 60000));

    // cancel removes partial files
    await ev(`OfflineAudio.download(2, 'ar.alafasy').catch(() => {})`);
    await b.waitFor(`(OfflineAudio.get('ar.alafasy', 2) || {}).done >= 3`, 60000);
    await ev(`OfflineAudio.cancel('audio:ar.alafasy:2')`);
    await sleep(1500);
    check('cancel removes record and partial files', await ev(`(async () => {
      const c = await caches.open('quran-audio-v1'); const keys = await c.keys();
      return !OfflineAudio.get('ar.alafasy', 2) && !keys.some(k => /\\/002\\d{3}\\.mp3$/.test(k.url)); })()`));

    // Mushaf: a page range (page 1 is added for the basmala glyphs)
    await ev(`MushafStore.download([603, 604])`);
    check('Mushaf pages 603–604 (+1) downloaded', await b.waitFor(`MushafStore.job && MushafStore.job.status === 'done' && [1, 603, 604].every(p => MushafStore.isDownloaded(p))`, 60000));
    await ev(`App.navigateToPage('mushaf'); DigitalMushaf.loadPage(604)`);
    await b.waitFor(`document.querySelectorAll('#mrPage .mr-line').length === 15`, 15000);
    await ev(`if (!DigitalMushaf.getBookmarks().includes(604)) DigitalMushaf.toggleBookmark(604)`);
    await sleep(500);
    await b.closeAndWait();

    /* ---------------------------------------- Session B: restart, offline */
    b = await launch({ port: 9342, profile: PROFILE, keepProfile: true, args: NO_NET });
    ev = b.ev;
    await b.send('Network.enable');
    await b.goto(URL_);
    await b.waitFor('typeof QuranDisplay !== "undefined" && QuranDisplay.surahs.length === 114', 20000);
    await b.send('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
    await sleep(300);
    check('offline banner shown', await ev(`!document.getElementById('offlineBanner').hidden`));
    check('Surah list available offline (114)', await ev('QuranDisplay.surahs.length === 114'));
    await ev('OfflineAudio.init()');
    check('download records survived the restart', await ev(`!!OfflineAudio.getComplete('ar.alafasy', 112) && !!OfflineAudio.getComplete('ar.alafasy', 114) && !OfflineAudio.get('ar.alafasy', 2)`));

    b.requests.length = 0;
    await ev(`App.navigateToPage('mushaf')`);
    check('last-read page 604 restored offline', await b.waitFor(`DigitalMushaf.currentPage === 604 && document.querySelectorAll('#mrPage .mr-line').length === 15 && !document.querySelector('.mr-problem')`, 15000));
    check('page 604 font loaded from device', await ev(`document.fonts.check("24px qcf-p604")`));
    check('bookmark restored', await ev(`document.getElementById('mrBookmark').getAttribute('aria-pressed') === 'true'`));
    check('page 604 shows 3 Surah headers', await ev(`document.querySelectorAll('#mrPage .mr-line-header').length === 3`));
    await ev(`DigitalMushaf.previousPage()`);
    check('previous page (603) renders offline', await b.waitFor(`DigitalMushaf.currentPage === 603 && document.querySelectorAll('#mrPage .mr-line .mr-w').length > 0`, 10000));
    check('no external request was needed to render downloaded pages', external(b.requests).filter(u => /quran\.com|qurancdn/.test(u)).length === 0,
      external(b.requests).join(' '));
    await ev(`DigitalMushaf.loadPage(10)`);
    check('undownloaded page shows a clear message', await b.waitFor(`/غير محمّلة/.test((document.querySelector('.mr-problem') || {}).textContent || '')`, 10000));
    await ev(`document.querySelector('.mr-problem [data-act="goto-page"]').click()`);
    check('"nearest downloaded page" goes to page 1', await b.waitFor(`DigitalMushaf.currentPage === 1 && document.querySelectorAll('#mrPage .mr-line').length === 8`, 10000));

    // offline audio
    await ev(`AudioPlayer.playNow('surah', 112)`);
    check('downloaded Surah 112 plays offline from local file', await b.waitFor(`PlaybackStore.get().status === 'playing' && PlaybackStore.get().local === true && AudioPlayer.audio.src.startsWith('blob:')`, 15000));
    await sleep(800);
    await ev(`AudioPlayer.pause()`);
    check('pause', await b.waitFor(`PlaybackStore.get().status === 'paused'`, 5000));
    await ev(`AudioPlayer.seek(0.6)`); await sleep(300);
    check('seek within local file', await ev(`AudioPlayer.audio.currentTime > 0.5 * AudioPlayer.audio.duration`));
    await ev(`AudioPlayer.play()`);
    check('resume', await b.waitFor(`PlaybackStore.get().status === 'playing'`, 5000));
    await ev(`AudioPlayer.audio.playbackRate = 16`);
    check('continues to next ayah offline', await b.waitFor(`PlaybackStore.get().ayah >= 2 && PlaybackStore.get().status === 'playing'`, 20000));
    await ev(`AudioPlayer.addToQueue('surah', 114); AudioPlayer.playNext()`);
    check('next Surah (114, downloaded) plays offline', await b.waitFor(`PlaybackStore.get().surah === 114 && PlaybackStore.get().status === 'playing'`, 15000));
    await ev(`AudioPlayer.stop(); AudioPlayer.playNow('surah', 113)`);
    check('undownloaded Surah offline → clear error', await b.waitFor(`PlaybackStore.get().status === 'error' && /غير محمّلة/.test(PlaybackStore.get().message)`, 15000),
      await ev('PlaybackStore.get().message'));
    await ev(`AudioPlayer.stop()`);
    check('no unexpected console errors', !b.logs.some(l => /\[EXC\]/.test(l)), b.logs.filter(l => /EXC/.test(l)).join(' | '));
    await b.closeAndWait();

    /* ------------------------------- Session C: no web server, no network */
    server.kill(); await sleep(500);
    b = await launch({ port: 9343, profile: PROFILE, keepProfile: true, args: NO_NET });
    ev = b.ev;
    await b.goto(URL_);
    check('app shell loads from the service worker with the server down', await b.waitFor('typeof App !== "undefined" && QuranDisplay.surahs.length === 114', 20000));
    await ev(`App.navigateToPage('mushaf'); DigitalMushaf.loadPage(604)`);
    check('Mushaf page renders with no server and no network', await b.waitFor(`document.querySelectorAll('#mrPage .mr-line-header').length === 3`, 15000));
    await ev(`AudioPlayer.playNow('surah', 112)`);
    check('Surah 112 plays with no server and no network', await b.waitFor(`PlaybackStore.get().status === 'playing'`, 15000));
    await ev(`AudioPlayer.stop()`);
    await ev(`OfflineAudio.remove('audio:ar.alafasy:112')`);
    check('delete removes the Surah and its files', await ev(`(async () => {
      const c = await caches.open('quran-audio-v1'); const keys = await c.keys();
      return !OfflineAudio.get('ar.alafasy', 112) && !keys.some(k => /\\/112\\d{3}\\.mp3$/.test(k.url)); })()`));
    await ev(`MushafStore.remove([603])`);
    check('delete Mushaf page 603', await ev(`!MushafStore.isDownloaded(603) && MushafStore.isDownloaded(604)`));
  } catch (e) { console.log('ERR', e.stack); results.push(false); }
  if (b) {
    console.log('--- console errors ---\n' + b.logs.filter(l => /error|EXC/i.test(l)).join('\n'));
    await b.closeAndWait();
  }
  server.kill();
  console.log(results.every(Boolean) ? 'ALL PASS' : 'SOME FAILED');
  process.exit(results.every(Boolean) ? 0 : 1);
})();
