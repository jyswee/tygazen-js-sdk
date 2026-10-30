#!/usr/bin/env node
/**
 * Verify the TARBALL, as a consumer, before it is published.
 *
 * WHY THIS EXISTS. 0.3.0 went to npm with a main entry that could not be imported at
 * all: the 'files' allowlist did not name dist/progress/, which dist/index.js statically
 * re-exports (BUG-2026-1030-0220). Everything looked right from the repo, because in the
 * repo the folder is there. The defect only exists inside the tarball.
 *
 * scripts/build.cjs already carries the same lesson one layer down — a hand-kept source
 * list once omitted src/pool/roster.js and would have shipped 'a dist/ that throws on its
 * first import' from a build reporting 9/9 ok. It fixed that by DISCOVERING sources.
 * package.json 'files' is a hand-kept list again, so the answer is not a better list: it
 * is to load the published artifact in the consumer's own runtime and see.
 *
 * WHAT IT DOES: npm pack, install the tarball into a throwaway directory OUTSIDE this
 * tree (an install inside it would resolve through node_modules and prove nothing), then
 * import every entry the 'exports' map declares.
 *
 * It asserts a NEGATIVE CONTROL too. A probe with no failing case is not a probe: if a
 * bogus subpath also "passed", the harness would be reporting its own success.
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const root = path.join(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tygazen-verify-'));
console.log(`consumer dir: ${tmp}`);

const packed = execFileSync('npm', ['pack', '--json', '--pack-destination', tmp], { cwd: root })
  .toString();
const tarball = path.join(tmp, JSON.parse(packed)[0].filename);
console.log(`tarball: ${path.basename(tarball)}  ${fs.statSync(tarball).size} bytes`);

fs.writeFileSync(path.join(tmp, 'package.json'),
  JSON.stringify({ name: 'tygazen-verify-consumer', private: true, type: 'module' }));
execFileSync('npm', ['install', '--silent', tarball], { cwd: tmp, stdio: 'inherit' });

// Every subpath the package advertises, minus the ones that are not ES modules.
const subpaths = Object.keys(pkg.exports)
  .filter((k) => k !== './package.json' && !String(pkg.exports[k]).endsWith('.cjs'))
  .map((k) => (k === '.' ? pkg.name : `${pkg.name}/${k.slice(2)}`));

const probe = `
const results = [];
for (const spec of ${JSON.stringify(subpaths)}) {
  try {
    const m = await import(spec);
    results.push([spec, 'LOADED', Object.keys(m).length + ' exports']);
  } catch (e) {
    results.push([spec, 'FAILED', e.code + ': ' + String(e.message).split('\\n')[0]]);
  }
}
// The control. This MUST fail, or a "pass" above means nothing.
try {
  await import('${pkg.name}/zzz-no-such-subpath');
  results.push(['<control>', 'FAILED', 'a bogus subpath resolved — the probe proves nothing']);
} catch (e) {
  results.push(['<control>', 'REFUSED', e.code]);
}
for (const [a, b, c] of results) console.log([b, a, c].join('\\t'));
process.exit(results.some(([, b]) => b === 'FAILED') ? 1 : 0);
`;
fs.writeFileSync(path.join(tmp, 'probe.mjs'), probe);

console.log('');
let failed = false;
try {
  execFileSync(process.execPath, ['probe.mjs'], { cwd: tmp, stdio: 'inherit' });
} catch {
  failed = true;
}

// The editor is fetched at runtime by the UNBUNDLED entry, so its absence from the
// tarball is invisible to an import of index.js. Name the file.
const editor = path.join(tmp, 'node_modules', pkg.name, 'dist', 'avatar', 'pixel-editor.js');
if (!fs.existsSync(editor)) {
  console.error('\nREFUSING: dist/avatar/pixel-editor.js is not in the tarball. Signup.mount imports it at runtime, so nothing fails until a player opens the builder.');
  failed = true;
} else {
  console.log(`\nOK  dist/avatar/pixel-editor.js present (${fs.statSync(editor).size} bytes)`);
}

if (failed) {
  console.error(`\nPACK VERIFICATION FAILED. Consumer tree left at ${tmp} for inspection.`);
  process.exit(1);
}
fs.rmSync(tmp, { recursive: true, force: true });
console.log('\nPack verification passed: every advertised entry loads from the tarball.');
