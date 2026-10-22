// Copies the existing flat web app (index.html + root-level *.js + *.css)
// into www/, Capacitor's webDir. No bundling, no minification — the app
// has none today and this script doesn't introduce one.
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const outDir = path.join(root, 'www');

fs.mkdirSync(outDir, { recursive: true });

const files = fs
  .readdirSync(root, { withFileTypes: true })
  .filter((entry) => entry.isFile())
  .map((entry) => entry.name)
  .filter((name) => name === 'index.html' || name.endsWith('.js') || name.endsWith('.css'));

for (const name of files) {
  fs.copyFileSync(path.join(root, name), path.join(outDir, name));
}

console.log(`Copied ${files.length} files into www/`);
