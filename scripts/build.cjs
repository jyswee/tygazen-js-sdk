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

// EVERY .js/.cjs under src/, discovered — never a hand-kept list.
//
// It used to be a hand-kept list of nine names, and src/pool/roster.js was added to
// src/index.js without being added here. The build would have obfuscated an index.js
// that imports './pool/roster.js' and never emitted that file: a dist/ that throws on
// its first import, from a build reporting 9/9 ok. The old list only warned about names
// present HERE and missing from src/ — the opposite direction to the one that bit.
function discover(dir, prefix = '') {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const rel = prefix ? `${prefix}/${e.name}` : e.name;
    if (e.isDirectory()) out.push(...discover(path.join(dir, e.name), rel));
    else if (/\.(js|cjs)$/.test(e.name)) out.push(rel);
  }
  return out;
}

const root = path.join(__dirname, '..');
const dist = path.join(root, 'dist');
const files = discover(path.join(root, 'src'));
if (files.length === 0) { console.error('No sources found under src/ — refusing to publish an empty dist/'); process.exit(1); }
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
