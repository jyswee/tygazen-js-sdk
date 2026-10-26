#!/usr/bin/env node
/**
 * Build — obfuscates src/ into dist/. Pattern: the vips CLI build
 * (javascript-obfuscator), with the settings a LIBRARY needs rather than a CLI.
 *
 * WHAT IS PUBLISHED: dist/ only. src/ never leaves Gitea. Same shape as the
 * oddsockets SDKs, whose public repo ships one compiled artifact and no source.
 *
 * THREE SETTINGS DELIBERATELY OFF, because a library is not a CLI:
 *   --rename-properties   OFF. pixel-editor reads GROUPS, COLORS, optionsFor and
 *                         friends off globalThis.PixelOptions, and the server reads
 *                         the same names. Renaming them severs both.
 *   --transform-object-keys OFF. The catalogue IS object keys (hair, eyes, mouth...)
 *                         and they are the wire contract with the hub and with
 *                         blender. Runtime-equivalent is not worth the risk here.
 *   --self-defending      OFF. It breaks downstream bundlers, and every consumer
 *                         of this package runs one.
 *
 * String-array encoding still hides the catalogue and the colour palette from
 * casual reading, which is the part worth protecting.
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const files = [
  'index.js',
  'identity/client.js',
  'identity/session.js',
  'identity/signup.js',
  'avatar/avatar.js',
  'avatar/options.js',
  'avatar/pixel-editor.js',
  'avatar/pixel-options.cjs',
  'clips/clips.js',
];

const root = path.join(__dirname, '..');
const dist = path.join(root, 'dist');
fs.rmSync(dist, { recursive: true, force: true });

const flags = [
  '--compact true',
  '--control-flow-flattening true',
  '--control-flow-flattening-threshold 0.75',
  '--dead-code-injection true',
  '--dead-code-injection-threshold 0.4',
  '--string-array true',
  '--string-array-encoding rc4',
  '--string-array-threshold 1',
  '--string-array-rotate true',
  '--string-array-shuffle true',
  '--string-array-wrappers-count 2',
  '--string-array-wrappers-type function',
  '--rename-globals false',
  '--rename-properties false',
  '--transform-object-keys false',
  '--self-defending false',
  '--identifier-names-generator hexadecimal',
  '--numbers-to-expressions true',
  '--simplify true',
  '--unicode-escape-sequence true',
  '--target browser',
].join(' ');

let ok = 0;
for (const f of files) {
  const src = path.join(root, 'src', f);
  const out = path.join(dist, f);
  if (!fs.existsSync(src)) { console.log('  SKIP (missing): ' + f); continue; }
  fs.mkdirSync(path.dirname(out), { recursive: true });
  try {
    execSync(`javascript-obfuscator ${JSON.stringify(src)} --output ${JSON.stringify(out)} ${flags}`, { stdio: 'pipe' });
    ok++;
    const before = fs.statSync(src).size, after = fs.statSync(out).size;
    console.log(`  ok  ${f}  ${before} -> ${after} bytes`);
  } catch (e) {
    console.error(`  FAIL ${f}: ${String(e.stderr || e.message).slice(0, 300)}`);
    process.exit(1);
  }
}
console.log(`\nBuild complete: ${ok}/${files.length} files obfuscated`);
if (ok !== files.length) process.exit(1);
