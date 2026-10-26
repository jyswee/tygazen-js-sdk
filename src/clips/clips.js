/**
 * Clip-moment telemetry for the web. The game TELLS the game center when a
 * marketable moment happens; nothing here inspects pixels.
 *
 * Same contract as Runtime/Clips in the Unity SDK, and the same two KEYLESS
 * transports, for the same reason: a key in a browser bundle is not a key, it is a
 * public string. An extracted ingest key can forge the base rates that decide which
 * moments are worth marketing, and push footage at asset upload.
 *
 *   PROXY  (works today)  POST {clipsProxyUrl}/api/gc/clips/events
 *   DIRECT (pending)      POST {gameCenterUrl}/api/v1/clips/events + X-TygaZen-Client
 *
 * Until the game center accepts a public client id (FEAT-2026-1026-0027) the direct
 * transport reports not_live ONCE per page and discards, rather than retrying
 * forever against a route that does not exist or reporting a success it did not get.
 */
const QUEUE_KEY = 'tygazen.clips.queue';

/** Canonical event-name shape, identical to the server's and to the Unity SDK's. */
function isCanonical(name) {
  if (!name) return false;
  let prevUnderscore = true;                       // treat the start as a boundary
  for (const c of name) {
    if (c === '_') { if (prevUnderscore) return false; prevUnderscore = true; continue; }
    if (!/[a-z0-9]/.test(c)) return false;
    prevUnderscore = false;
  }
  return !prevUnderscore;
}

export class Clips {
  constructor(config) {
    this.cfg = config;
    this.session = crypto.randomUUID().replace(/-/g, '');
    this.proxied = !!config.clipsProxyUrl;
    this.enabled = this.proxied || !!config.publicClientId;
    this.saidNotLive = false;
    this.url = this.proxied
      ? String(config.clipsProxyUrl).replace(/\/+$/, '') + '/api/gc/clips/events'
      : String(config.gameCenterUrl || '').replace(/\/+$/, '') + '/api/v1/clips/events';
    if (!this.enabled) {
      // Refuse loudly rather than queue into a void: a game that believes telemetry
      // is on while silently dropping it is worse than one told it is off.
      console.error('[TygaZen] clip telemetry is OFF: set clipsProxyUrl (your backend holds the ingest key) '
        + 'or publicClientId once the game center issues them. Signup and avatars are unaffected.');
    }
    if (typeof addEventListener === 'function') {
      // A page can be closed at any moment, so flush on the last reliable signal.
      addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') this.flush(); });
    }
  }

  track(eventName, meta) { this.#enqueue(eventName, null, null, meta); }

  /** start may be negative: "it began three seconds before I noticed". */
  clipMoment(eventName, start, duration, meta) { this.#enqueue(eventName, start, duration, meta); }

  #enqueue(eventName, start, duration, meta) {
    if (!this.enabled) return;
    const name = typeof eventName === 'string' ? eventName.trim() : eventName;
    if (!isCanonical(name)) {
      // Refused HERE, at the call site, because the ingest route rejects a whole
      // batch on its first bad member — so one mistyped name would quietly eat every
      // good event flushed alongside it. Base rates also group on this exact string,
      // so boss_down and BossDown would read as two uncommon moments, undetectably.
      console.error(`[TygaZen] event name '${eventName}' is not lower_snake_case and was NOT queued. `
        + `Use a-z, 0-9 and single underscores (e.g. 'boss_down').`);
      return;
    }
    const q = this.#read();
    q.push({
      event: name,
      event_id: crypto.randomUUID().replace(/-/g, ''),
      occurred_at: new Date().toISOString().replace(/\.\d+Z$/, 'Z'),
      session: this.session,
      ...(start != null ? { window_start: start } : {}),
      ...(duration != null ? { window_duration: duration } : {}),
      ...(meta ? { meta } : {})
    });
    this.#write(q);
  }

  /**
   * Send what is queued. Idempotent event_ids mean a retry can never double-count,
   * which is what makes it safe to keep the batch on a deferral.
   */
  async flush() {
    if (!this.enabled) return { status: 'disabled' };
    const batch = this.#read();
    if (!batch.length) return { status: 'empty' };

    const headers = { 'Content-Type': 'application/json', Accept: 'application/json' };
    if (this.proxied) {
      const tok = this.cfg.playerToken && this.cfg.playerToken();
      if (tok) headers.Authorization = 'Bearer ' + tok;   // the GAME's player token, never a game key
    } else if (this.cfg.publicClientId) {
      headers['X-TygaZen-Client'] = this.cfg.publicClientId;
    }
    if (this.cfg.titleSlug) headers['X-TygaZen-Title'] = this.cfg.titleSlug;

    let res;
    try {
      res = await fetch(this.url, { method: 'POST', headers, body: JSON.stringify({ events: batch }), keepalive: true });
    } catch {
      return { status: 'retry_later' };                   // keep the queue; dedupe makes overlap safe
    }
    if (res.ok) { this.#write([]); return { status: 'delivered' }; }
    if (res.status === 429 || res.status >= 500) return { status: 'retry_later' };
    if (!this.proxied && [401, 403, 404].includes(res.status)) {
      this.#sayNotLive();
      this.#write([]);                                   // the route does not exist: queueing is not retrying
      return { status: 'not_live' };
    }
    console.error(`[TygaZen] clips batch REJECTED (${res.status})`);
    this.#write([]);
    return { status: 'rejected' };
  }

  /** Said once per page, not once per flush: a line repeated every few seconds is how a real problem becomes invisible. */
  #sayNotLive() {
    if (this.saidNotLive) return;
    this.saidNotLive = true;
    console.error('[TygaZen] clip ingest is not live for the keyless client-id transport yet '
      + '(FEAT-2026-1026-0027): these events are being discarded, not queued. Set clipsProxyUrl to send them today.');
  }

  #read() { try { return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]'); } catch { return []; } }
  #write(q) { try { localStorage.setItem(QUEUE_KEY, JSON.stringify(q)); } catch {} }
}
