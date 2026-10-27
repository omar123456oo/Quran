// Copies the existing flat web app into www/ (Capacitor's webDir, and the
// recommended deploy output for the live site). The root index.html stays
// completely untouched for local dev (`npm start` serves it as-is, with
// every script/stylesheet as its own <script>/<link> tag — fast edit/reload
// loop, no build step needed). www/index.html is a transformed copy: its
// individual <script src> / <link rel=stylesheet> tags for the app's own
// JS/CSS are replaced with a single concatenated bundle each, which is what
// a production/SEO audit should see (fewer requests). capacitor-bootstrap.js
// stays its own file/tag — it's tiny, Capacitor-only, and guarded to be a
// no-op outside Capacitor, so bundling it in buys nothing.
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const outDir = path.join(root, 'www');

// Must match the dependency order already established in index.html's
// <script> tags — concatenation preserves that order exactly, same as the
// separate tags do today.
const JS_BUNDLE = [
  'api-service.js', 'app.js', 'quran-display.js', 'play-queue.js',
  'playlists.js', 'playback-store.js', 'audio-player.js', 'tafseer.js',
  'translation.js', 'search.js', 'bookmarks.js', 'settings.js',
  'islamic-resources.js', 'adhkar.js', 'digital-mushaf.js', 'playlists-ui.js',
];
const CSS_BUNDLE = ['styles.css', 'adhkar-mushaf-styles.css', 'player-styles.css'];
const STANDALONE_JS = ['capacitor-bootstrap.js'];

fs.mkdirSync(outDir, { recursive: true });

// Fail loudly if a root .js/.css file exists that isn't accounted for above,
// so a new file never silently falls out of the production build.
const rootFiles = fs
  .readdirSync(root, { withFileTypes: true })
  .filter((entry) => entry.isFile())
  .map((entry) => entry.name)
  .filter((name) => name.endsWith('.js') || name.endsWith('.css'));

const known = new Set([...JS_BUNDLE, ...CSS_BUNDLE, ...STANDALONE_JS]);
const unaccounted = rootFiles.filter((name) => !known.has(name));
if (unaccounted.length) {
  throw new Error(
    `scripts/build-web.js doesn't know about: ${unaccounted.join(', ')}. ` +
    `Add each to JS_BUNDLE/CSS_BUNDLE/STANDALONE_JS in this file.`
  );
}

const readRoot = (name) => fs.readFileSync(path.join(root, name), 'utf8');

const jsBundle = JS_BUNDLE.map(readRoot).join('\n;\n');
fs.writeFileSync(path.join(outDir, 'app.bundle.js'), jsBundle);

const cssBundle = CSS_BUNDLE.map(readRoot).join('\n');
fs.writeFileSync(path.join(outDir, 'app.bundle.css'), cssBundle);

for (const name of STANDALONE_JS) {
  fs.copyFileSync(path.join(root, name), path.join(outDir, name));
}

// SEO files — irrelevant inside the Android/iOS app shell, but www/ is also
// the build output for the live website, which does need them.
for (const name of ['robots.txt', 'sitemap.xml']) {
  if (fs.existsSync(path.join(root, name))) {
    fs.copyFileSync(path.join(root, name), path.join(outDir, name));
  }
}

let html = readRoot('index.html');

for (const name of CSS_BUNDLE) {
  html = html.replace(`    <link rel="stylesheet" href="${name}">\n`, '');
}
html = html.replace(
  '<!-- Styles -->\n',
  '<!-- Styles -->\n    <link rel="stylesheet" href="app.bundle.css">\n'
);

for (const name of JS_BUNDLE) {
  html = html.replace(`    <script src="${name}"></script>\n`, '');
}
html = html.replace(
  `    <script src="${STANDALONE_JS[0]}"></script>`,
  `    <script src="app.bundle.js"></script>\n    <script src="${STANDALONE_JS[0]}"></script>`
);

fs.writeFileSync(path.join(outDir, 'index.html'), html);

console.log(
  `Built www/: ${JS_BUNDLE.length} JS files -> app.bundle.js, ` +
  `${CSS_BUNDLE.length} CSS files -> app.bundle.css, ` +
  `${STANDALONE_JS.length} standalone file(s) copied, index.html rewritten.`
);
