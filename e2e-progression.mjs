#!/usr/bin/env node
/**
 * END-TO-END THROUGH THE SDK, not through curl.
 *
 * The suite that runs inside the container proves the ENDPOINTS behave. This proves the
 * SDK a studio actually installs can drive them — which is a different claim, and the one
 * that matters before anything is handed to the Unity team. Joe, 2026-10-28: the JS SDK is
 * what makes a real end-to-end possible, because it runs headless and Unity does not.
 *
 *   PROGRESS_KEY=vgk_... QA=https://vipsallowed.hq.tyga.dev node e2e-progression.mjs
 *
 * WRITES GO BY HTTP HERE ON PURPOSE. The SDK has no submit method — a score written from
 * a client is a score the player controls — so this script plays the part of a TITLE'S
 * BACKEND for the writes, and then reads them back THROUGH THE SDK exactly as a browser
 * would through that backend's proxy. If the SDK ever grows a submit, this file is the
 * thing that should start failing.
 */
import * as progress from './src/progress/index.js';

const QA = process.env.QA || 'https://vipsallowed.hq.tyga.dev';
const KEY = process.env.PROGRESS_KEY;
if (!KEY) { console.error('set PROGRESS_KEY'); process.exit(2); }

// The SDK config a BACKEND would hold: a key, and no proxy (it IS the proxy).
const cfg = { gameCenterUrl: QA, titleSlug: 'cropsicles' };
const opts = { gameKey: KEY };

let pass = 0; const fail = [];
const ok = (label, cond, detail) => {
  if (cond) { pass++; console.log(`  ok    ${label}`); }
  else { fail.push(label); console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`); }
};

const post = async (path, body) => {
  const r = await fetch(`${QA}/api/v1/progress${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY}` },
    body: JSON.stringify(body),
  });
  return { status: r.status, json: await r.json().catch(() => null) };
};

const persona = 'e2e-' + Date.now();
const matchId = 'e2e-match-' + Date.now();

console.log(`\nSDK end-to-end against ${QA}\n`);

// ── 1. the backend posts a run ────────────────────────────────────────────────
const run = { personaKey: persona, boardKey: 'harvest', matchId, score: 28820,
  mode: 'blitz', durationMs: 3000, dimensions: { worldReached: 4, stars: 32 },
  displayName: 'E2E Harvester', country: 'GB' };
const w1 = await post('/scores', run);
ok('backend posts the measured 28,820 cascade', w1.status === 200 && w1.json?.ok, `status ${w1.status} ${w1.json?.error || ''}`);
ok('it is not flagged duplicate', w1.json?.duplicate === false);
const w2 = await post('/scores', run);
ok('the SAME matchId replays as duplicate, not a second row', w2.json?.duplicate === true);

// ── 2. the SDK reads it back ──────────────────────────────────────────────────
const board = await progress.boards(cfg, 'harvest', { ...opts, limit: 200 });
ok('SDK.boards returns ok', board.ok === true, board.error);
const mine = (board.entries || []).find((e) => e.personaKey === persona);
ok('SDK sees the row the backend wrote', !!mine);
ok('…exactly once (no double-count through the SDK)',
   (board.entries || []).filter((e) => e.personaKey === persona).length === 1);
ok('…with the score intact', mine?.score === 28820, `score=${mine?.score}`);
ok('the envelope carries seededCount', typeof board.seededCount === 'number');
ok('the envelope carries labelling', typeof board.labelling === 'string' && board.labelling.length > 0);
ok('the envelope carries boundsVersion', 'boundsVersion' in board);
ok('paging carries a cursor field', board.paging && 'nextCursor' in board.paging);

// ── 3. discovery, catalogue, nations, player ──────────────────────────────────
const list = await progress.boardList(cfg, opts);
ok('SDK.boardList discovers the declared boards', list.ok && (list.boards || []).some((b) => b.boardKey === 'harvest'));

const cat = await progress.catalogue(cfg, opts);
ok('SDK.catalogue returns the eleven registered ids', cat.ok && (cat.achievements || []).length === 11,
   `count=${(cat.achievements || []).length}`);

const nations = await progress.nations(cfg, 'harvest', opts);
ok('SDK.nations returns ok', nations.ok === true, nations.error);
const gb = (nations.nations || []).find((n) => n.country === 'GB');
ok('…and the submitting country is present', !!gb);

// ── 4. an award, asserted by the backend, read by the SDK ─────────────────────
const a1 = await post('/achievements/award', { personaKey: persona, key: 'galactic' });
ok('backend asserts a REGISTERED achievement', a1.status === 200 && a1.json?.ok, `status ${a1.status}`);
const bogus = await post('/achievements/award', { personaKey: persona, key: 'zzz_not_registered' });
ok('an UNREGISTERED key is refused', bogus.status === 400, `status ${bogus.status}`);

const earned = await progress.achievements(cfg, persona, opts);
ok('SDK.achievements reads the award back', earned.ok && (earned.awards || []).some((a) => a.key === 'galactic'));

const player = await progress.player(cfg, persona, opts);
ok('SDK.player returns their best on the board', player.ok && (player.boards || [])[0]?.best === 28820,
   `best=${(player.boards || [])[0]?.best}`);
ok('SDK.player reports the award count', player.achievements?.unlocked === 1, `unlocked=${player.achievements?.unlocked}`);

// ── 5. the refusals a studio will actually hit ────────────────────────────────
const unconfigured = await progress.boards({ gameCenterUrl: QA }, 'harvest', {});
ok('no key and no proxy -> progress-not-configured', unconfigured.ok === false && unconfigured.error === 'progress-not-configured');
ok('…and NOT an empty board', !Array.isArray(unconfigured.entries));

const badBoard = await progress.boards(cfg, 'zzz-not-a-board', opts);
ok('an unknown board is an http error, not an empty page', badBoard.ok === false && badBoard.status === 400, `status ${badBoard.status}`);

const badCursor = await progress.boards(cfg, 'harvest', { ...opts, cursor: 'not-a-cursor' });
ok('an unknown cursor is an http error, not an empty page', badCursor.ok === false && badCursor.status === 400, `status ${badCursor.status}`);

console.log(`\n${pass} passed, ${fail.length} failed`);
if (fail.length) { console.log('\nFailures:'); fail.forEach((f) => console.log('  - ' + f)); }
process.exit(fail.length ? 1 : 0);
