#!/usr/bin/env node
/**
 * Browser bundle — ONE file a page can load with a plain <script type="module">.
 *
 * WHY THIS EXISTS. v0.1.0 could not run in a browser at all, and tygaria measured
 * exactly why (headless Chrome, 2026-10-27). Two faults, both in the published tag:
 *
 *   1. dist/avatar/options.js default-imports ./pixel-options.cjs. That file is UMD —
 *      it has no ESM exports — so a browser raises "The requested module
 *      ./pixel-options.cjs does not provide an export named default". Node can
 *      default-import CJS and so can every bundler, which is why the fault survived:
 *      the only consumer that cannot is the one the README told people to be.
 *   2. Over jsdelivr the .cjs is served as content-type application/node, which a
 *      browser refuses as a module script BEFORE it even gets to fault 1.
 *
 * And the README's no-bundler route compounded it: an import map pointing at the hub's
 * /vendor/dicebear/ cannot work cross-origin, because module scripts load in CORS mode
 * and that path sends no Access-Control-Allow-Origin. Three faults, one cause — nobody
 * had ever loaded the published artifact in a browser from another origin.
 *
 * This bundle answers all three by removing the moving parts: no bare specifiers to
 * resolve, no .cjs on the wire, no import map, no cross-origin fetch of DiceBear. One
 * .js file, one MIME type, one request.
 *
 * IT BUNDLES dist/, NOT src/, and that order is deliberate: our modules go in already
 * obfuscated by build.cjs, so the bundle inherits exactly the protection the per-file
 * build gives and src/ still never leaves Gitea. Run build.cjs first.
 *
 * DICEBEAR IS BAKED IN AT THE PINNED VERSION, read from the installed tree rather than
 * trusted from package.json, and the build REFUSES if it is not the version
 * peerDependencies declares. The alternative is how the parity claim got away from us
 * once already: the hub had 9.4.2 installed while the SDK declared 9.4.3.
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const want = pkg.peerDependencies['@dicebear/core'];

for (const dep of ['@dicebear/core', '@dicebear/pixel-art']) {
  const p = path.join(root, 'node_modules', dep, 'package.json');
  if (!fs.existsSync(p)) {
    console.error(`${dep} is not installed — run: npm i -D -E ${dep}@${want}`);
    process.exit(1);
  }
  const have = JSON.parse(fs.readFileSync(p, 'utf8')).version;
  if (have !== want) {
    console.error(`${dep} installed ${have}, peerDependencies declares ${want}. Refusing to bake a version we do not advertise.`);
    process.exit(1);
  }
  console.log(`  pinned ${dep}@${have}`);
}

// dist/browser.js, NOT dist/index.js. The browser entry statically imports the editor
// and registers it, so the bundle resolves nothing at runtime. See src/browser.js for
// what 0.3.0 got wrong by bundling the plain entry.
const entry = path.join(root, 'dist', 'browser.js');
if (!fs.existsSync(entry)) {
  console.error('dist/browser.js missing — run `npm run build` first; this bundles dist/, not src/.');
  process.exit(1);
}

const out = path.join(root, 'dist', 'tygazen.browser.js');
const esbuild = path.join(root, 'node_modules', '.bin', 'esbuild');

const metaPath = path.join(root, 'dist', '.browser-meta.json');
execFileSync(esbuild, [
  entry,
  '--bundle',
  '--format=esm',
  '--platform=browser',
  '--target=es2020',
  '--legal-comments=none',
  `--metafile=${metaPath}`,
  `--outfile=${out}`,
], { stdio: 'inherit' });

const bytes = fs.statSync(out).size;
const md5 = require('crypto').createHash('md5').update(fs.readFileSync(out)).digest('hex');
console.log(`\ndist/tygazen.browser.js  ${bytes} bytes  md5 ${md5}`);

// A bundle that still names a bare specifier did not bundle. Checked, not assumed.
const text = fs.readFileSync(out, 'utf8');
const leaked = text.match(/from\s*["']@dicebear\/[^"']+["']/g) || [];
if (leaked.length) {
  console.error(`\nREFUSING: the bundle still imports ${leaked.join(', ')} — a browser cannot resolve a bare specifier.`);
  process.exit(1);
}
// A COMPLETE bundle has no module specifiers left at all. Checking for the string
// '.cjs' was the first version of this gate and it was wrong: esbuild writes the
// original path as a section comment and as its CJS registry key, so the gate tripped
// on its own bookkeeping while a genuinely unresolved import would read the same.
// Match the SYNTAX instead.
const unresolved = text.match(/(?:^|[\s;}])(?:import|export)\s*(?:[^;'"]*\sfrom\s*)?["'][^"']+["']/g) || [];
if (unresolved.length) {
  console.error(`\nREFUSING: ${unresolved.length} import/export still names a module: ${unresolved.slice(0, 3).join(' | ')}`);
  process.exit(1);
}

// IS THE EDITOR ACTUALLY IN HERE? The defect 0.3.0 shipped (BUG-2026-1030-0221) was the
// editor being FETCHED at runtime from a path that does not exist — Signup.mount lazily
// imported '../avatar/pixel-editor.js', correct for dist/identity/ and one folder above
// dist/ once flattened into this bundle. 404, and the builder never drew. Found by coilgo
// and by pokattack independently, each of whom shipped a workaround.
//
// NOTHING TEXTUAL CAN CATCH THAT. The static gate above needs a `from`, which a dynamic
// import has not got; and the obfuscator runs BEFORE this bundle, so the specifier is a
// computed string-array call with no literal path anywhere in the output — grepping the
// published 0.3.0 bundle for 'pixel-editor' returns zero hits, plain or hex-escaped. A
// gate hunting a bad path would have found nothing and passed.
//
// Nor can the fix be "make it static everywhere": pixel-editor.js does
// `const P = window.PixelOptions` at MODULE scope, so a static import from signup.js
// would throw ReferenceError on `import('@tygaria/tygazen')` in node and trade one dead
// entry for another. The lazy path has to stay for the unbundled dist; src/browser.js
// registers the editor up front so THIS bundle never walks it.
//
// So ask esbuild what it put in, rather than reading the output. The metafile is
// authoritative and obfuscation cannot touch it.
const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
const outKey = Object.keys(meta.outputs).find((k) => path.resolve(root, k) === out);
const inputs = Object.keys((outKey && meta.outputs[outKey].inputs) || {});
const needed = ['dist/avatar/pixel-editor.js', 'dist/identity/signup.js', 'dist/index.js'];
const missing = needed.filter((n) => !inputs.some((i) => i.replace(/\\/g, '/').endsWith(n)));
if (missing.length) {
  console.error(`\nREFUSING: ${missing.join(', ')} did not go INTO the bundle, so the page would fetch it at runtime — which is the 404 of BUG-2026-1030-0221. Register it in src/browser.js.`);
  process.exit(1);
}
console.log(`  bundle inputs: ${inputs.length}; editor, signup and the entry are all inside`);
fs.unlinkSync(metaPath);

// The whole point of the sideEffects fix. If a bundler dropped avatar/options.js again
// the global is never set, pixel-editor reads undefined at module scope, and nothing
// about the bundle looks wrong. Assert the assignment is IN the output.
if (!/globalThis\.PixelOptions|PixelOptions\s*=/.test(text)) {
  console.error('\nREFUSING: no PixelOptions assignment in the bundle — avatar/options.js was tree-shaken away. Check "sideEffects" in package.json.');
  process.exit(1);
}
console.log('No unresolved specifiers; PixelOptions assignment present.');
