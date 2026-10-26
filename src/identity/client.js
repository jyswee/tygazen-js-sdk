/**
 * The game center client — the web half of the same contract the Unity SDK speaks.
 *
 * It talks to the game center DIRECTLY and KEYLESS, on the same public routes the
 * hub's own join page uses (/auth/join/*). The wesell.cloud pattern: public,
 * rate-limited routes, the person's own email is the credential, no game key
 * anywhere and no game backend in between.
 *
 * Deliberately the SAME endpoint list, the SAME headers and the SAME "not live"
 * rule as Runtime/Identity/GameCenterClient.cs in the Unity SDK. If you change one,
 * change both: two clients that drift are two contracts, and the game center only
 * has one.
 */
export const NOT_LIVE = 'not_live';

export class GameCenterClient {
  constructor(config) {
    this.cfg = config;
    this.lastError = '';
  }

  get base() { return String(this.cfg.gameCenterUrl || '').replace(/\/+$/, ''); }

  /** Non-secret identification only. A secret must never reach a browser. */
  headers(extra = {}) {
    const h = { Accept: 'application/json', ...extra };
    if (this.cfg.publicClientId) h['X-TygaZen-Client'] = this.cfg.publicClientId;
    if (this.cfg.titleSlug) h['X-TygaZen-Title'] = this.cfg.titleSlug;
    return h;
  }

  /** GET /auth/join/handle?u= : free or taken, with the hub's own message. */
  checkHandle(handle) {
    const u = encodeURIComponent(String(handle || '').trim().toLowerCase());
    return this.#get(`/auth/join/handle?u=${u}`);
  }

  /** GET /auth/join/board : the hub's own board data for the stage. */
  board() { return this.#get('/auth/join/board'); }

  /**
   * POST /auth/join/claim : the same body the join page posts. Email and date of
   * birth go to the hub and nowhere else; the hub mails the magic link. The 18+
   * check is the hub's, server-side, on the claimant's own attestation — this SDK
   * never invents a date of birth.
   */
  claim({ handle, country, email, dateOfBirth, pixel }) {
    return this.#post('/auth/join/claim', {
      email,
      date_of_birth: dateOfBirth,
      handle: String(handle || '').trim().toLowerCase(),
      country: country || '',
      pixel: pixel || null,
      spine: null
    });
  }

  /** POST /auth/join/resend : the join page's resend. 30s cooldown belongs to the caller. */
  resend(email) { return this.#post('/auth/join/resend', { email }); }

  /** PENDING on the hub: claim status for a poll. Answers not_live until it ships. */
  claimStatus(email) { return this.#get(`/auth/join/status?email=${encodeURIComponent(email || '')}`); }

  /** PENDING on the hub: a member's face by handle. Answers not_live until it ships. */
  face(handle) { return this.#get(`/auth/join/face?u=${encodeURIComponent(handle || '')}`); }

  async #get(path) { return this.#send(path, { method: 'GET', headers: this.headers() }); }

  async #post(path, body) {
    return this.#send(path, {
      method: 'POST',
      headers: this.headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(body)
    });
  }

  /**
   * One place decides what counts as an answer, so a route the hub has not shipped
   * is reported as not_live rather than as a failure or — worse — a success. A
   * missing route answers 404 or returns a page, never join-page JSON.
   */
  async #send(path, init) {
    let res, text = '';
    try {
      res = await fetch(this.base + path, { ...init, credentials: 'omit' });
      text = await res.text();
    } catch (e) {
      this.lastError = String(e && e.message || e);
      return { ok: false, error: this.lastError, data: null };
    }
    let data = null;
    const looksJson = text.trimStart().startsWith('{');
    if (looksJson) { try { data = JSON.parse(text); } catch { data = null; } }
    const ok = res.ok && looksJson && data !== null;
    this.lastError = ok ? ''
      : (res.status === 404 || (res.ok && !looksJson)) ? NOT_LIVE
      : `${res.status} ${res.statusText}`;
    return { ok, status: res.status, error: this.lastError, data };
  }
}
