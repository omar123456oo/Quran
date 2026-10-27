// Responsive layout of the Mushaf reader and Downloads page at representative sizes.
// Needs the dev server on :8000 (npm start) and network access to Quran.com for page data.
// Screenshots: $TMPDIR/quran-responsive/*.png
const fs = require('node:fs');
const os = require('node:os');
const { launch } = require('./cdp.js');

const SIZES = [
  [320, 568], [375, 812], [430, 932], [812, 375],      // phones, incl. landscape
  [768, 1024], [1024, 768],                            // tablet portrait / landscape
  [1440, 900], [1920, 1080]                            // laptop / desktop
];
const OUT = os.tmpdir() + '/quran-responsive';
fs.mkdirSync(OUT, { recursive: true });
const results = [];
const check = (name, ok, extra = '') => { results.push(!!ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} ${extra}`); };

const METRICS = `(() => {
  const page = document.getElementById('mrPage');
  const r = page.getBoundingClientRect();
  const lines = [...page.querySelectorAll('.mr-line')];
  const overflowing = [...page.querySelectorAll('.mr-l')].filter(l => l.scrollWidth > l.parentElement.clientWidth + 1).length;
  const bar = document.querySelector('.mr-bar').getBoundingClientRect();
  const small = [...document.querySelectorAll('#mushafReader .mr-btn, #mushafReader .mushaf-playbar .btn')]
    .filter(b => b.offsetParent && (b.getBoundingClientRect().height < 40 || b.getBoundingClientRect().width < 40)).length;
  return {
    docOverflow: document.documentElement.scrollWidth - innerWidth,
    ratio: r.width / r.height, pageLeft: r.left, pageRight: r.right, pageW: r.width, pageH: r.height,
    lines: lines.length, overflowing, barRight: bar.right, small
  };
})()`;

(async () => {
  for (const [w, h] of SIZES) {
    const b = await launch({ width: w, height: h, port: 9350, profile: `responsive-${w}x${h}` });
    const tag = `${w}x${h}`;
    try {
      await b.goto('http://127.0.0.1:8000/index.html');
      await b.waitFor('QuranDisplay.surahs.length === 114', 20000);
      await b.ev(`localStorage.setItem('mushaf_last_page', '50'); App.navigateToPage('mushaf')`);
      const ok = await b.waitFor(`document.querySelectorAll('#mrPage .mr-line .mr-w').length > 50 && document.fonts.check('24px qcf-p50')`, 20000);
      await b.sleep(600);
      const m = await b.ev(METRICS);
      check(`${tag} page renders`, ok);
      check(`${tag} no horizontal page overflow`, m.docOverflow <= 1, `(${m.docOverflow}px)`);
      check(`${tag} page keeps printed aspect ratio`, Math.abs(m.ratio - 0.6184) < 0.01, m.ratio.toFixed(4));
      check(`${tag} page fully inside viewport width`, m.pageLeft >= 0 && m.pageRight <= w + 0.5, `${Math.round(m.pageLeft)}–${Math.round(m.pageRight)}`);
      check(`${tag} 15 lines, none overflowing`, m.lines === 15 && m.overflowing === 0, `overflow=${m.overflowing}`);
      check(`${tag} touch targets ≥ 40px`, m.small === 0, `small=${m.small}`);
      if (w >= 1000) check(`${tag} page not stretched across the monitor`, m.pageW <= 700.5, `${Math.round(m.pageW)}px`);
      if (w >= 600 && (h - 300) * 0.6184 >= 460) check(`${tag} whole page fits the screen height (fit screen)`, m.pageH <= h - 200, `${Math.round(m.pageH)}px`);
      if (w >= 600 && w < 1000) check(`${tag} page uses the readable minimum width`, m.pageW >= Math.min(460, w - 60), `${Math.round(m.pageW)}px`);
      await b.ev(`DigitalMushaf.toggleFocusMode()`); await b.sleep(400);
      const fs = await b.ev(`(() => { const r = document.getElementById('mrPage').getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right }; })()`);
      check(`${tag} focus/fullscreen mode shows the whole page`, fs.top >= 0 && fs.bottom <= h + 1 && fs.left >= 0 && fs.right <= w + 1 || w < 600,
        `${Math.round(fs.top)}–${Math.round(fs.bottom)}`);
      await b.shot(`${OUT}/mushaf-${tag}-focus.png`);
      await b.ev(`DigitalMushaf.toggleFocusMode()`); await b.sleep(300);
      await b.ev('window.scrollTo(0, 0)');
      await b.shot(`${OUT}/mushaf-${tag}.png`);

      // pages with special layout
      for (const p of [1, 187, 604]) {
        await b.ev(`DigitalMushaf.loadPage(${p})`);
        await b.waitFor(`document.getElementById('mrPage').dataset.page === '${p}' && !document.getElementById('mrPage').classList.contains('is-loading') && document.fonts.check('24px qcf-p${p}')`, 20000);
        await b.sleep(400);
        const mp = await b.ev(METRICS);
        check(`${tag} page ${p}: no line overflow`, mp.overflowing === 0 && mp.docOverflow <= 1);
        if (w === 430 || w === 1440) await b.shot(`${OUT}/mushaf-${tag}-p${p}.png`);
      }

      await b.ev(`App.navigateToPage('downloads')`);
      await b.waitFor(`!!document.getElementById('dlMushaf') && !!document.querySelector('#dlMushaf .dl-grid')`, 10000);
      await b.sleep(300);
      check(`${tag} downloads page: no horizontal overflow`, await b.ev('document.documentElement.scrollWidth - innerWidth <= 1'));
      await b.shot(`${OUT}/downloads-${tag}.png`);

      await b.ev(`App.navigateToPage('home')`);
      await b.sleep(300);
      check(`${tag} home: no horizontal overflow`, await b.ev('document.documentElement.scrollWidth - innerWidth <= 1'));
    } catch (e) { console.log('ERR', tag, e.stack); results.push(false); }
    const errs = b.logs.filter(l => /\[EXC\]/.test(l));
    if (errs.length) { console.log(errs.join('\n')); results.push(false); }
    await b.closeAndWait();
  }
  console.log(`screenshots: ${OUT}`);
  console.log(results.every(Boolean) ? 'ALL PASS' : 'SOME FAILED');
  process.exit(results.every(Boolean) ? 0 : 1);
})();
