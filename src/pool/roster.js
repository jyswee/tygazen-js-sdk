/**
 * Roster — read the TYGA persona pool live, instead of importing a copy of it.
 *
 * WHY THIS EXISTS. Until now the only way a title could get the pool was a JSON drop
 * published to a CDN and imported into the title's own database. That made every game
 * keep its own copy of the game center's members, which is backwards: each copy goes
 * stale the moment the pool changes, five titles meant five divergent snapshots, and any
 * importer that keyed rows on `handle` rather than `personaKey` silently orphaned them on
 * a rename. A title should not have to seed our members in order to show a face or find
 * an opponent.
 *
 * ─────────────────────────────────────────────────────────────────────────────────
 * THIS IS THE ONE SURFACE IN THE SDK THAT NEEDS A KEY, AND KEYS DO NOT GO IN BROWSERS.
 *
 * Every identity route in this SDK is keyless and public on purpose. The roster is not:
 * it is gated on a vgk_ key granting 'pool:read'. So there are exactly two honest ways to
 * call it, and a third that this module deliberately does NOT offer.
 *
 *   1. FROM YOUR BACKEND (recommended). Pass your key explicitly:
 *        TygaZen.Roster.list({ gameKey: process.env.TYGAZEN_KEY, band: 3 })
 *      Node, Deno, a worker, an edge function — anywhere the key is not shipped to a
 *      player. This is how you seed or refresh a ladder.
 *
 *   2. FROM THE BROWSER, THROUGH YOUR OWN PROXY. Set `rosterProxyUrl` in init() to an
 *      endpoint on YOUR server that forwards to the game center with your key:
 *        TygaZen.init({ ..., rosterProxyUrl: '/api/tygazen/pool' })
 *        await TygaZen.Roster.list({ band: 3 })        // no key in the page
 *      Same shape as `clipsProxyUrl`, for the same reason.
 *
 *   3. NOT OFFERED: passing a key from page JavaScript. There is no parameter for it. A
 *      key in a shipped client is a key in every player's devtools, and 'pool:read' keys
 *      can be minted as `readonly` — which grants nothing else — precisely so that the
 *      backend holding one is boring. Putting it in the page would throw that away.
 *
 * WITHOUT a gameKey and without a rosterProxyUrl, every call here returns
 * { ok: false, error: 'roster-not-configured' } rather than throwing or silently
 * returning an empty list. An empty list is the dangerous answer: an importer reads it as
 * "the pool is empty" and writes nothing, which looks like success.
 *
 * ─────────────────────────────────────────────────────────────────────────────────
 * THE ENVELOPE IS NOT OPTIONAL READING.
 *
 * Every response carries `labelling`, `bandSemantics`, `bandBasis`, `bandNote` and
 * `dialogueGuard`. They are obligations, not documentation, and they travel with the data
 * so they cannot be left behind in a file somebody read once:
 *
 *   labelling      — every persona is AI, and that is for YOUR records and YOUR metrics.
 *                    Do not badge or single out individual personas on a player-facing
 *                    surface.
 *   bandSemantics  — 'band1=strongest'. The field name carries no direction, and a
 *                    previous consumer implemented it upside down off the same name.
 *   bandBasis      — 'synthetic-pyramid': band is sha1(personaKey). It is NOT a measured
 *                    skill rating and NOT derived from engagement. Seed an opening rating
 *                    from it if you like; your ladder owns progression from real results.
 *   dialogueGuard  — a 200 from the dialogue engine can carry scaffolding instead of
 *                    speech. Refuse to render a reply containing any listed marker.
 *
 * `scaffolding(text, guard)` below is the guard, implemented once, so you do not have to
 * re-type its marker list.
 *
 * KEY EVERY ROW YOU STORE ON personaKey. It is the immutable id. A handle can be renamed
 * and will silently orphan whatever you bound to it.
 */

const PATH = '/api/v1/pool/personas';

function notConfigured() {
  return {
    ok: false,
    error: 'roster-not-configured',
    detail:
      'Roster needs either { gameKey } (backend only) or rosterProxyUrl in TygaZen.init(). ' +
      'A key must never be shipped in page JavaScript.',
  };
}

function buildQuery({ band, country, clan, limit, cursor } = {}) {
  const q = new URLSearchParams();
  if (band !== undefined && band !== null && band !== '') q.set('band', String(band));
  if (country) q.set('country', String(country));
  if (clan) q.set('clan', String(clan));
  if (limit) q.set('limit', String(limit));
  if (cursor) q.set('cursor', String(cursor));
  const s = q.toString();
  return s ? `?${s}` : '';
}

async function call(cfg, path, { gameKey } = {}) {
  const proxy = cfg && cfg.rosterProxyUrl;
  if (!gameKey && !proxy) return notConfigured();

  const url = gameKey ? `${(cfg && cfg.gameCenterUrl) || 'https://tygazen.com'}${path}` : `${proxy}${path.slice(PATH.length) || ''}`;
  const headers = {};
  if (gameKey) headers.Authorization = `Bearer ${gameKey}`;
  if (cfg && cfg.titleSlug) headers['X-TygaZen-Title'] = cfg.titleSlug;

  let res;
  try {
    res = await fetch(url, { headers });
  } catch (err) {
    // A transport failure is NOT an empty pool. Say which it was.
    return { ok: false, error: 'transport', detail: err && err.message };
  }
  let body = null;
  try { body = await res.json(); } catch { body = null; }
  if (!res.ok) return { ok: false, error: 'http', status: res.status, detail: (body && body.error) || null };
  return { ok: true, status: res.status, ...body };
}

/** One page. Returns { ok, personas, total, paging:{ nextCursor, hasMore }, ...envelope }. */
export function list(cfg, opts = {}) {
  return call(cfg, `${PATH}${buildQuery(opts)}`, opts);
}

/** One row by its immutable personaKey. 404 -> { ok:false, error:'http', status:404 }. */
export function get(cfg, personaKey, opts = {}) {
  return call(cfg, `${PATH}/${encodeURIComponent(personaKey || '')}`, opts);
}

/**
 * Every page, followed to the end. For seeding a ladder once.
 *
 * It STOPS on the first failed page and reports what it had, rather than returning a
 * short list that looks complete — a truncated seed is the failure you discover months
 * later when a band is mysteriously thin.
 */
export async function all(cfg, opts = {}) {
  const out = [];
  let cursor = null;
  let envelope = null;
  for (let page = 0; page < 200; page++) {
    const r = await list(cfg, { ...opts, limit: opts.limit || 200, cursor });
    if (!r.ok) return { ok: false, error: r.error, status: r.status, detail: r.detail, personas: out, complete: false };
    if (!envelope) {
      const { personas, paging, ok, status, ...rest } = r;
      envelope = rest;
    }
    out.push(...(r.personas || []));
    cursor = r.paging && r.paging.nextCursor;
    if (!cursor) return { ok: true, ...envelope, personas: out, count: out.length, complete: true };
  }
  return { ok: false, error: 'too-many-pages', personas: out, complete: false };
}

/**
 * The dialogueGuard, implemented once. True means REFUSE TO RENDER the reply and retry
 * the generation.
 *
 * THE MARKER LIST LIVES HERE, NOT IN THE RESPONSE, deliberately. The envelope's
 * `dialogueGuard` is prose written for a human, and one of the five things it names is
 * "Round <3+ digits>" — a DESCRIPTION of a pattern, not a literal. Lifting the quoted
 * tokens out of that sentence would make the guard hunt for the literal text
 * "Round <3+ digits>", which no engine ever emits, so the one marker that actually needs
 * a regex would be the one silently disarmed.
 *
 * This function previously took a `guard` argument and read `guard.markers` off it. The
 * server sends `dialogueGuard` as a STRING, so that property was always undefined and the
 * argument did nothing — a parameter implying the live value was in use while the
 * defaults did all the work. Removed rather than left as decoration. Read `dialogueGuard`
 * to understand the obligation; this enforces it.
 */
const MARKERS = ['[H-CONTEXT]', 'player_dialogue', 'ambient_trigger', 'compaction-summary'];

export function scaffolding(text) {
  if (!text) return false;
  const s = String(text);
  if (MARKERS.some((m) => s.includes(m))) return true;
  // A leaked counter, not a line of speech. "Round 12 was mine" stays renderable.
  return /\bRound\s+\d{3,}\b/.test(s);
}
