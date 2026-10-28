/**
 * Progression — boards, achievements and clans, read from the game center.
 *
 * ONE NAME FOR EACH THING, ACROSS UNITY, JS AND UNREAL. This module is the JS half of
 * TygaZen.Progress in the Unity package, and the names below are deliberately identical:
 * boards/nations/catalogue/achievements/clan/clanTop, and the same DTO field names, which
 * are themselves unity-demo-game's from the shipped Cropsicles client. Parity is the
 * release gate, not a follow-up — the Unreal port already built a roster proxy off one
 * sentence of ours that was wrong, and that is what divergence costs.
 *
 * ─────────────────────────────────────────────────────────────────────────────────
 * THIS IS A READ CLIENT. THERE IS NO SUBMIT HERE, AND THE ABSENCE IS THE DESIGN.
 *
 * A score written from a page is a score written by whoever has devtools open. So runs
 * are posted SERVER-TO-SERVER by the title's backend, holding a vgk_ key with the
 * 'progress' scope — which grants progress:write and nothing else. The browser reads,
 * through progressProxyUrl on that same backend.
 *
 * Two honest ways to call this, and a third this module deliberately does not offer:
 *   1. FROM YOUR BACKEND, passing the key explicitly:
 *        TygaZen.Progress.boards('harvest', { gameKey: process.env.TYGAZEN_KEY })
 *   2. FROM THE BROWSER, through your own proxy:
 *        TygaZen.init({ progressProxyUrl: '/api/tz/progress' })
 *        await TygaZen.Progress.boards('harvest', { window: 'season' })
 *   3. NOT OFFERED: a key from page JavaScript. There is no parameter for it.
 *
 * progressProxyUrl IS A BASE — the client appends everything after /api/v1/progress.
 * Stated literally because the roster module's "same shape as clipsProxyUrl" was not
 * true and cost the Unreal team an implementation (BUG-2026-1028-0009).
 *
 * UNCONFIGURED CALLS RETURN { ok: false, error: 'progress-not-configured' } rather than an
 * empty board. An empty board reads to a UI as "nobody has played yet", which looks like
 * success and ships.
 */

const PATH = '/api/v1/progress';

function notConfigured() {
  return {
    ok: false,
    error: 'progress-not-configured',
    detail:
      'Progression needs either { gameKey } (backend only) or progressProxyUrl in TygaZen.init(). ' +
      'A key must never be shipped in page JavaScript, and writes are server-to-server only.',
  };
}

function buildQuery({ window, country, clan, limit, cursor } = {}) {
  const q = new URLSearchParams();
  if (window) q.set('window', String(window));
  if (country) q.set('country', String(country));
  if (clan) q.set('clan', String(clan));
  if (limit) q.set('limit', String(limit));
  if (cursor) q.set('cursor', String(cursor));
  const s = q.toString();
  return s ? `?${s}` : '';
}

async function call(cfg, path, { gameKey } = {}) {
  const proxy = cfg && cfg.progressProxyUrl;
  if (!gameKey && !proxy) return notConfigured();

  const url = gameKey
    ? `${(cfg && cfg.gameCenterUrl) || 'https://tygazen.com'}${PATH}${path}`
    : `${proxy}${path}`;

  const headers = {};
  if (gameKey) headers.Authorization = `Bearer ${gameKey}`;
  if (cfg && cfg.titleSlug) headers['X-TygaZen-Title'] = cfg.titleSlug;

  let res;
  try {
    res = await fetch(url, { headers });
  } catch (err) {
    // A transport failure is NOT an empty board. Say which it was.
    return { ok: false, error: 'transport', detail: err && err.message };
  }
  let body = null;
  try { body = await res.json(); } catch { body = null; }
  if (!res.ok) return { ok: false, error: 'http', status: res.status, detail: (body && body.error) || null };
  return { ok: true, status: res.status, ...body };
}

/** One page of a board. `boardKey` and `window` are whatever the TITLE declares. */
export function boards(cfg, boardKey, opts = {}) {
  return call(cfg, `/boards/${encodeURIComponent(boardKey || '')}${buildQuery(opts)}`, opts);
}

/** Per-country totals. Each country sums its players' BEST runs, not every run. */
export function nations(cfg, boardKey, opts = {}) {
  return call(cfg, `/boards/${encodeURIComponent(boardKey || '')}/nations${buildQuery(opts)}`, opts);
}

/** The boards this title declares, so a client can discover rather than hard-code. */
export function boardList(cfg, opts = {}) {
  return call(cfg, '/boards', opts);
}

/** This title's achievement catalogue: definitions, not a player's awards. */
export function catalogue(cfg, opts = {}) {
  return call(cfg, '/achievements', opts);
}

/** What one tygazen earned IN THIS TITLE. Key rows on personaKey, never handle. */
export function achievements(cfg, personaKey, opts = {}) {
  return call(cfg, `/players/${encodeURIComponent(personaKey || '')}/achievements`, opts);
}

/** One tygazen's progress IN THIS TITLE: best per board, plus the award count. */
export function player(cfg, personaKey, opts = {}) {
  return call(cfg, `/players/${encodeURIComponent(personaKey || '')}`, opts);
}

/** One clan: its roster and its DERIVED score. */
export function clan(cfg, clanId, opts = {}) {
  return call(cfg, `/clans/${encodeURIComponent(clanId || '')}`, opts);
}

/** The clan board for this title's scope. Clans are game-isolated today. */
export function clanTop(cfg, opts = {}) {
  return call(cfg, `/clans/top${buildQuery(opts)}`, opts);
}

/**
 * Every page of a board, followed to the end. For seeding or an export.
 *
 * STOPS ON THE FIRST FAILED PAGE and reports what it had, rather than returning a short
 * list that looks complete — the same rule the roster module follows, because a truncated
 * result is the failure you discover months later when a board is mysteriously thin.
 */
export async function allPages(cfg, boardKey, opts = {}) {
  const out = [];
  let cursor = null;
  let envelope = null;
  for (let page = 0; page < 200; page++) {
    const r = await boards(cfg, boardKey, { ...opts, limit: opts.limit || 200, cursor });
    if (!r.ok) return { ok: false, error: r.error, status: r.status, detail: r.detail, entries: out, complete: false };
    if (!envelope) {
      const { entries, paging, ok, status, ...rest } = r;
      envelope = rest;
    }
    out.push(...(r.entries || []));
    cursor = r.paging && r.paging.nextCursor;
    if (!cursor) return { ok: true, ...envelope, entries: out, count: out.length, complete: true };
  }
  return { ok: false, error: 'too-many-pages', entries: out, complete: false };
}
