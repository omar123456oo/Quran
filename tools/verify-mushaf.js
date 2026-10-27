#!/usr/bin/env node
// Runs the app's own page validator (mushaf-store.js) against all 604 live pages and
// checks each page font's signature and size. Exit code 1 on any problem.
// Usage: node tools/verify-mushaf.js
const Core = require('../mushaf-store.js');
const Meta = require('../mushaf-meta.js');

async function get(url, binary) {
  for (let i = 0; ; i++) {
    try {
      const r = await fetch(url);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return binary ? new Uint8Array(await r.arrayBuffer()) : await r.json();
    } catch (e) { if (i === 3) throw e; await new Promise(r => setTimeout(r, 1000 * (i + 1))); }
  }
}

(async () => {
  const problems = [];
  let next = 1, fontBytes = 0;
  const worker = async () => {
    while (next <= 604) {
      const p = next++;
      const page = Core.compact(p, await get(Core.PAGE_API(p)));
      const errs = Core.validatePage(p, page, Meta);
      if (errs.length) problems.push(`page ${p}: ${errs.join('; ')}`);
      const font = await get(Core.FONT_URL(p), true);
      if (!Core.isWoff2(font)) problems.push(`page ${p}: font is not WOFF2`);
      fontBytes += font.length;
    }
  };
  await Promise.all(Array.from({ length: 6 }, worker));
  problems.forEach(x => console.log(x));
  console.log(`${604 - new Set(problems.map(x => x.split(':')[0])).size}/604 pages valid; fonts ${(fontBytes / 1e6).toFixed(1)} MB`);
  process.exit(problems.length ? 1 : 0);
})();
