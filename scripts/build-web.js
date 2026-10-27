// Copies the flat web app into www/ (Capacitor's webDir, and the deploy
// output for the live site). Deliberately NOT bundled: sw.js's SHELL_FILES
// precache list names every individual JS/CSS file by its real filename, and
// cache.addAll() fails entirely if any one of those 404s. Bundling broke
// offline install silently; a flat copy keeps index.html, sw.js, and the
// actual files on disk all agreeing on the same filenames.
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const outDir = path.join(root, 'www');

fs.mkdirSync(outDir, { recursive: true });

const files = fs
  .readdirSync(root, { withFileTypes: true })
  .filter((entry) => entry.isFile())
  .map((entry) => entry.name)
  .filter((name) => name === 'index.html' || name === 'manifest.json' || name.endsWith('.js') || name.endsWith('.css'));

for (const name of files) {
  fs.copyFileSync(path.join(root, name), path.join(outDir, name));
}

const iconsDir = path.join(root, 'icons');
if (fs.existsSync(iconsDir)) {
  const outIconsDir = path.join(outDir, 'icons');
  fs.mkdirSync(outIconsDir, { recursive: true });
  for (const name of fs.readdirSync(iconsDir)) {
    fs.copyFileSync(path.join(iconsDir, name), path.join(outIconsDir, name));
  }
}

// SEO files — irrelevant inside the Android/iOS app shell, but www/ is also
// the build output for the live website, which does need them.
for (const name of ['robots.txt', 'sitemap.xml']) {
  if (fs.existsSync(path.join(root, name))) {
    fs.copyFileSync(path.join(root, name), path.join(outDir, name));
  }
}

console.log(`Copied ${files.length} files + icons/ into www/`);
