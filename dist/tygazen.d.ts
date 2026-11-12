/**
 * TygaZen SDK for the web — TypeScript declarations.
 *
 * WHY THIS FILE EXISTS AND WHAT IT IS NOT. The published package is an obfuscated
 * build with no source, which is deliberate. A declaration file is the one thing that
 * can give a consumer completion, signatures and type-checking WITHOUT shipping the
 * implementation — the same pattern the oddsockets SDKs use on npm (one minified
 * bundle plus one .d.ts). It describes the surface; it reveals no logic.
 *
 * IT DESCRIBES THE SHIPPED BUNDLE, NOT THE SOURCE TREE, and that distinction is the
 * whole reason this is hand-written rather than generated. If you add to src/index.js,
 * this does not change until the artifact does.
 *
 * THAT RULE HAS A SECOND HALF, AND 0.3.0 FOUND IT. Through 0.3.0 this header said
 * TygaZen.Progress was not in the published dist and so would not be declared — and
 * claimed that was "verified by importing the installed package in node and enumerating
 * its keys". It was not: 0.3.0's entry throws ERR_MODULE_NOT_FOUND before any keys
 * exist, because the files allowlist omitted dist/progress/ while dist/index.js
 * statically re-exports it (BUG-2026-1030-0220). Withholding types was defensible;
 * withholding the RUNTIME to match broke every entry. Keeping a declaration behind an
 * artifact is right. Trimming the artifact to match the declarations is not — and
 * asserting a measurement I had not taken is how a sound rule produced a dead package.
 *
 * Progress is declared below and dist/progress/ ships. scripts/verify-pack.cjs imports
 * the tarball, so this file and the artifact can no longer disagree quietly.
 */

/**
 * A part value, and the reason it is not `string`.
 *
 * THREE STATES, NOT TWO:
 *   "variant07"   CHOSEN — the player picked it
 *   null          OFF — the player explicitly does not want one ("no hat"; on hair, bald)
 *   absent        ABSENT — let the seed decide
 *
 * `null` and absent are DIFFERENT. Collapsing them paints a part on a player who
 * removed it, and you will not see it happen because the seed deals something
 * plausible. A boolean plus a string cannot hold three states — that is the actual
 * root cause of BUG-2026-1029-0006, -0009 and -0010, which were the same mistake in a
 * parser, a writer and a renderer. Written as `string | null` with the key optional so
 * the type system carries the distinction instead of a comment.
 */
export type PartValue = string | null;

/** The parts-and-colours description of one tygazen's 2D pixel face. */
export interface PixelConfig {
  /** Decides every unpinned part. Change it and the whole face changes. */
  seed?: string;
  /** Pinned part choices by group ("hair", "eyes", "hat", …). See {@link PartValue}. */
  parts?: Record<string, PartValue>;
  /** Pinned colours by group, 6-hex without a leading `#`. */
  colors?: Record<string, string>;
  /**
   * Probability overrides 0..100 for the groups the reference draws behind a bool
   * (hat, glasses, beard, accessories). 0 means "do not draw". Hair is NOT one of
   * these: off for hair is a null in `parts`.
   */
  probabilities?: Record<string, number>;
}

/** Every response from the game center, success or failure, has this shape. */
export interface Envelope<T = unknown> {
  /** True only when the request succeeded AND the body parsed as JSON. */
  ok: boolean;
  status?: number;
  /** `''` when ok. {@link NOT_LIVE} when the route is not deployed. */
  error: string;
  data: T | null;
}

/**
 * The route exists in the SDK but not yet on the host it was called against — a 404,
 * or a 200 that returned a page rather than JSON. Distinct from a real refusal: treat
 * it as "not shipped yet", never as "no such member".
 */
export const NOT_LIVE: 'not_live';

export interface TygaZenConfig {
  /** Default `https://tygazen.com`. */
  gameCenterUrl?: string;
  /** Your title's slug, sent as `X-TygaZen-Title` on every call. */
  titleSlug?: string;
  publicClientId?: string;
  /** Your backend, which holds the key. Clip telemetry is disabled without it. */
  clipsProxyUrl?: string;
  /** Your backend. The roster is the one surface needing a key — never put one in a page. */
  rosterProxyUrl?: string;
  /** Base only; the client appends everything after `/api/v1/progress`. READS only. */
  progressProxyUrl?: string;
  /**
   * READS only, a BASE: the client appends everything after `/api/v1/news`. Facts are
   * posted server-to-server by your backend with a `vgk_` key scoped `progress`.
   */
  newsProxyUrl?: string;
  /** READS only, a BASE: the client appends `/<personaKey>/care`. Server-side use passes `{ gameKey }`. */
  careProxyUrl?: string;
  /** READS only, a BASE: the client appends `/<personaKey>/room`. Server-side use passes `{ gameKey }`. */
  roomsProxyUrl?: string;
  playerToken?: string | null;
}

/** The signed-in member, as held locally. Key your own rows on the personaKey from the server, never on `handle`. */
export interface Player {
  id: string;
  handle: string;
}

/** One question from the hub's human check: show `question`, and `options` as buttons. */
export interface HumanCheck {
  /** Opaque. Send it back with the answer. Good for ONE send, right or wrong. */
  token: string;
  question: string;
  /** Six words; exactly one answers the question. Send the tapped word back verbatim. */
  options: string[];
}

/** The player's answer: the question's token and the word they tapped. */
export interface HumanCheckAnswer { token: string; answer: string; }

/**
 * What `Signup.humanCheck()` returns. `check` is null when the check is off, and also
 * when the read failed (a hub without the route answers `not_live`): show nothing, send
 * without an answer, and the hub decides. `required` is true when a send with no answer
 * is refused (`reason: 'check_required'`).
 */
export type HumanCheckRead =
  | { ok: true; mode: 'off' | 'optional' | 'enforce'; required: boolean; check: HumanCheck | null }
  | { ok: false; status?: number; error: string; required: false; check: null };

export interface ClaimFields {
  handle: string;
  email: string;
  /** ISO `YYYY-MM-DD`. The hub enforces 18+. */
  dateOfBirth: string;
  country: string;
  pixel?: PixelConfig;
  /**
   * The way back (FEAT-2026-1026-0090): an https URL on this title's registered origin.
   * The hub validates it at claim time and the magic link lands the player on it with
   * `?tz_code=`, which the title's backend redeems at POST /api/v1/players/exchange.
   * Omit for a claim that should end on the hub.
   */
  returnUrl?: string;
  /** The player's answer to `Signup.humanCheck()`. Omit when no question was shown. */
  check?: HumanCheckAnswer;
}

/**
 * A refused claim carries what the hub said: `error` is the hub's own message when it gave
 * one (otherwise the transport's status text), `status` the HTTP status, and `field` /
 * `reason` name what was refused (for example `date_of_birth` / `under_age`).
 *
 * A refused human check is `field: 'check'` with `reason` one of `check_required`,
 * `check_wrong`, `check_expired`, `check_used` (HTTP 400, and `check` holds the NEXT
 * question to show) or `check_locked` (HTTP 429 with `retryIn`, too many wrong answers
 * from this network today). `reason: 'too_many_attempts'` (HTTP 429 with `retryIn`) is
 * the hub's ceiling on links asked for from one network.
 */
export type ClaimResult =
  | { ok: true; sentTo?: string }
  | { ok: false; step: 'handle' | 'claim'; error?: string; status?: number; field?: string; reason?: string; retryIn?: number;
      /** The next question, when the refusal was about the human check. */
      check?: HumanCheck };

/** What {@link mount} hands back: it owns the config, you drive it. */
export interface FaceBuilder {
  /** The config as it stands right now. */
  readonly pixel: PixelConfig;
  /** A fresh seed, keeping pins. Returns the new config. */
  reroll(): PixelConfig;
  /** The stock "nobody" face. Returns the new config. */
  placeholder(): PixelConfig;
  /** Checks the handle, then claims. The builder supplies `pixel`. */
  claim(fields: Omit<ClaimFields, 'pixel'>): Promise<ClaimResult>;
}

export interface MountOptions {
  pixel?: PixelConfig;
  onChange?: (next: PixelConfig, label?: string, tabId?: string) => void;
}

/** Low-level HTTP against the game center. `TygaZen.init` builds one for you. */
export declare class GameCenterClient {
  constructor(config: TygaZenConfig);
  /** `''`, {@link NOT_LIVE}, or `"<status> <statusText>"`. Set by the last call. */
  lastError: string;
  headers(extra?: Record<string, string>): Record<string, string>;
  checkHandle(handle: string): Promise<Envelope<{ available?: boolean; message?: string }>>;
  /** GET /auth/join/check : the raw read behind `Signup.humanCheck()`. */
  humanCheck(): Promise<Envelope<{ ok?: boolean; mode?: string; required?: boolean; check?: HumanCheck | null }>>;
  board(): Promise<Envelope>;
  claim(fields: ClaimFields): Promise<Envelope<{ ok?: boolean; sentTo?: string; message?: string; field?: string }>>;
  resend(email: string, opts?: { check?: HumanCheckAnswer }): Promise<Envelope>;
  /** POST /auth/join/login : a returning member's sign-in link, carrying the way back. */
  login(email: string, opts?: { returnUrl?: string; check?: HumanCheckAnswer }): Promise<Envelope<{ ok?: boolean; sentTo?: string; message?: string; field?: string; reason?: string }>>;
  claimStatus(email: string): Promise<Envelope>;
  face(handle: string): Promise<Envelope>;
}

/** Local record of who is signed in. Survives a reload; returns a guest rather than throwing when storage is blocked. */
export declare const Session: {
  readonly player: Player | null;
  readonly isGuest: boolean;
  signIn(player: Player): void;
  signOut(): void;
};

/** One page of the persona pool, flattened onto the envelope. */
export interface RosterPage {
  ok: boolean;
  status?: number;
  error?: string;
  personas?: unknown[];
  total?: number;
  paging?: { nextCursor?: string | null; hasMore?: boolean };
  [key: string]: unknown;
}

export interface RosterOptions {
  band?: number;
  limit?: number;
  cursor?: string | null;
  /** Server-side only. Never pass a key from page JavaScript — use `rosterProxyUrl`. */
  gameKey?: string;
  [key: string]: unknown;
}

/**
 * Progression's refusal shape. An unconfigured call reports this rather than an empty
 * board, because an empty board reads to a UI as "nobody has played yet" — which looks
 * like success and ships.
 */
export interface ProgressError {
  ok: false;
  error: 'progress-not-configured' | 'transport' | 'http' | 'too-many-pages';
  status?: number;
  detail?: string | null;
}

/** One progression response. Server fields are spread onto the envelope. */
export type ProgressResult<T = Record<string, unknown>> =
  | ({ ok: true; status?: number } & T)
  | ProgressError;

export interface ProgressOptions {
  /** Whatever the TITLE declares, e.g. `season`. Not a fixed enum. */
  window?: string;
  country?: string;
  clan?: string;
  limit?: number;
  cursor?: string | null;
  /**
   * SERVER-SIDE ONLY, and there is deliberately no other way in. A score written from a
   * page is written by whoever has devtools open, so writes are server-to-server with a
   * `vgk_` key scoped `progress`. From a browser, set `progressProxyUrl` instead.
   */
  gameKey?: string;
}

/** News' refusal shape. An unconfigured call reports this rather than an empty feed. */
export interface NewsError {
  ok: false;
  error: 'news-not-configured' | 'transport' | 'http' | 'poll-id-required';
  status?: number;
  detail?: string | null;
}

/** One news fact. Nothing here says whether a Tygazen is a human or an AI, by design. */
export interface NewsEvent {
  id: string;
  titleSlug: string;
  eventId: string;
  kind: 'met' | 'talked' | 'won' | 'fought' | 'traded' | 'claimed' | 'swore' | 'levelled' | 'entered' | 'harvested' | 'completed' | 'changed';
  personaKey: string;
  with: Array<{ personaKey: string | null; name: string | null }>;
  world: string | null;
  place: string | null;
  summary: string;
  source: 'moment' | 'arcade' | 'story' | 'social' | 'trade' | 'system';
  data: Record<string, unknown> | null;
  occurredAt: string;
}

export interface NewsPage {
  titleSlug: string;
  schemaVersion: number;
  servedAt: string;
  personaKey?: string;
  count: number;
  events: NewsEvent[];
  paging: { limit: number; nextCursor: string | null };
}

export interface NewsDigest {
  titleSlug: string;
  personaKey: string;
  since: string;
  until: string;
  count: number;
  byKind: Record<string, number>;
  byTitle: Record<string, number>;
  latest: NewsEvent[];
}

export type NewsResult<T> = ({ ok: true; status?: number } & T) | NewsError;

export interface NewsOptions {
  world?: string;
  place?: string;
  kind?: NewsEvent['kind'];
  /** ISO string or Date. */
  since?: string | Date;
  limit?: number;
  cursor?: string | null;
  /** SERVER-SIDE ONLY. From a browser, set `newsProxyUrl` instead. */
  gameKey?: string;
}

/**
 * A poll: a question any Tygazen sets up and any Tygazen answers. It binds nothing.
 * Counts are served; who answered never is. Nothing here says whether the author or a
 * voter is a human or an AI, by design.
 */
export interface NewsPoll {
  /** The hub's id. Pass this to `News.poll(id)`. */
  id: string;
  /** The id the title's server gave the poll when it set it up, or null for one made on the hub. */
  pollId: string | null;
  question: string;
  options: Array<{ key: string; label: string; votes: number }>;
  /** Answers counted so far, across every option. */
  votes: number;
  state: 'open' | 'closed';
  opensAt: string | null;
  closesAt: string | null;
  /** null when the author has opted out of News. */
  author: { personaKey: string } | null;
  /** The slug of the title whose server set the poll up, or the hub's own value. */
  via: string;
  /** The leading option's key once the poll is closed. null while it runs, on a tie, and when nobody answered. */
  winner: string | null;
  /** Where a Tygazen answers it on the hub, in their own session. */
  voteUrl: string;
}

export interface NewsPollPage {
  titleSlug: string;
  schemaVersion: number;
  servedAt: string;
  state: 'open' | 'closed';
  count: number;
  polls: NewsPoll[];
  nextCursor: string | null;
}

export interface NewsPollRead {
  titleSlug: string;
  schemaVersion: number;
  servedAt: string;
  poll: NewsPoll;
}

export interface NewsPollOptions {
  /** 'open' when omitted. */
  state?: 'open' | 'closed';
  /** 'own' = only the polls this title's server set up. */
  scope?: 'all' | 'own';
  /** Only this Tygazen's polls. The member id, never a handle. */
  personaKey?: string;
  limit?: number;
  cursor?: string | null;
  /** SERVER-SIDE ONLY. From a browser, set `newsProxyUrl` instead. */
  gameKey?: string;
}

/** A member's responsible-gaming settings. Member-owned, hub-held; titles only read. */
export interface CareSettings {
  excluded: boolean;
  /** The decision: refuse wagering play when true and show `resource`. */
  mustRefusePlay: boolean;
  selfExclusion: { until: string | null; permanent: boolean; setAt: string | null } | null;
  dailyLossCap: { amount: number; currency: 'GOLD'; resetsAt: string } | null;
  /** A raise or removal waiting its 24 h deferral. */
  dailyLossCapPending: { amount: number | null; effectiveAt: string } | null;
  realityCheck: { everyMinutes: number } | null;
  resource: { name: string; url: string; line: string };
  updatedAt: string | null;
}

export interface CareError {
  ok: false;
  error: 'care-not-configured' | 'transport' | 'http';
  status?: number;
  detail?: string | null;
}

export type CareResult = ({ ok: true; status?: number; personaKey: string; care: CareSettings } & Record<string, unknown>) | CareError;

export interface CareOptions {
  /** SERVER-SIDE ONLY. From a browser, set `careProxyUrl` instead. */
  gameKey?: string;
}

/** A Tygazen's appoiint room, as the hub holds it. */
export interface Room { customerId: string; roomId: string; joinUrl: string | null; ensuredAt: string | null }
export interface RoomsError { ok: false; error: 'rooms-not-configured' | 'transport' | 'http'; status?: number; detail?: string | null }
export type RoomsResult = { ok: true; status?: number; personaKey?: string; pending: boolean; room: Room | null } | RoomsError;

/** {@link TygaZen.Progress.allPages} — `complete` says whether it reached the end. */
export type ProgressAllPages = {
  ok: boolean;
  entries: unknown[];
  count?: number;
  complete: boolean;
  error?: string;
  status?: number;
  detail?: string | null;
  [key: string]: unknown;
};

export type ClipFlushStatus = 'disabled' | 'empty' | 'delivered' | 'retry_later' | 'not_live';

export declare const TygaZen: {
  readonly config: TygaZenConfig | null;
  readonly client: GameCenterClient | null;

  /** Call once at boot. Returns itself, so it chains. */
  init(config: TygaZenConfig): typeof TygaZen;

  Session: typeof Session;

  Events: {
    on(name: 'faceChanged' | 'signedIn' | string, fn: (arg?: unknown) => void): void;
    emit(name: string, arg?: unknown): void;
  };

  Signup: {
    /** Draw the face builder into an element. */
    mount(el: Element, opts?: MountOptions): Promise<FaceBuilder>;
    /**
     * Open the hub's own join page in a new tab.
     *
     * `returnTo` is accepted and currently DOES NOTHING: the hub sets no return
     * parameter it reads back (BUG-2026-1028-0042). Do not build a flow on it until
     * FEAT-2026-1026-0090 ships the one-time-code handoff.
     */
    openHub(opts?: { returnTo?: string }): void;
    /** A fresh random config. */
    newConfig(): PixelConfig;
    claim(fields: ClaimFields): Promise<ClaimResult>;
    /**
     * The hub's human check for claim, login and resend: one question, six words, one tap.
     * Read one per attempt, show it, and pass `{ token, answer }` as `check`.
     */
    humanCheck(): Promise<HumanCheckRead>;
    /**
     * The raw envelope, as before. A refused human check is `status` 400 or 429 with
     * `data.field === 'check'`, and `data.check` holds the next question.
     */
    resend(email: string, opts?: { check?: HumanCheckAnswer }): Promise<Envelope>;
    /**
     * "Already a Tygazen? Log in" inside a title: one email, your https returnUrl, and
     * the hub mails a sign-in link that lands the member on it with `?tz_code=`. Unknown
     * emails answer exactly like known ones (anti-enumeration). Replaces openHub({ returnTo }).
     */
    login(email: string, opts?: { returnUrl?: string; check?: HumanCheckAnswer }): Promise<
      | { ok: true; sentTo?: string }
      | { ok: false; step: 'login'; error?: string; field?: string; reason?: string; status?: number;
          /** Seconds until another link may be asked for; present on a 429. */
          retryIn?: number;
          /** The next question, when the refusal was about the human check. */
          check?: HumanCheck }>;
  };

  Avatar: {
    /** An SVG string for a config. The one drawing primitive. */
    fromConfig(pixel: PixelConfig): string;
    /** A `data:image/svg+xml` URI for an `<img src>` or a CSS background. */
    dataUri(pixel: PixelConfig): string;
    /** The stock face for someone with no handle yet, desaturated. */
    placeholder(): string;
    placeholderConfig(): PixelConfig;
    /** The signed-in member's own face from local storage, or `null`. */
    mine(): string | null;
    /**
     * @deprecated WITHDRAWN and not coming back. There is no public handle-to-face
     * lookup; a handle renames and orphans whatever you bound to it. Answers `null`
     * with one warning. Key on personaKey and read the face from the sign-in handoff
     * (FEAT-2026-1026-0090) or FEAT-2026-1028-0146.
     */
    get(handle: string): Promise<null>;
    /** @deprecated Withdrawn — see {@link TygaZen.Avatar.get}. */
    getMany(handles: string[]): Promise<null>;
  };

  /**
   * The persona pool, read live — AI-powered opponents, not players. Needs a key, so
   * it runs from your backend or through your own `rosterProxyUrl`. An unconfigured
   * call reports an error rather than an empty list, because an empty list reads to a
   * UI as "nobody is here".
   */
  Roster: {
    list(opts?: RosterOptions): Promise<RosterPage>;
    get(personaKey: string, opts?: RosterOptions): Promise<RosterPage>;
    /** Every page, stopping on the first failure and reporting what it had. */
    all(opts?: RosterOptions): Promise<RosterPage>;
    scaffolding(text: string): string;
  };

  /**
   * Boards, achievements and clans. THE SAME SIX NAMES as TygaZen.Progress in the Unity
   * package, with the same DTO field names, so a studio shipping both calls one contract
   * rather than two that drift.
   *
   * READS ONLY — there is no submit, and the absence is the design. See
   * {@link ProgressOptions.gameKey}.
   */
  Progress: {
    /** One page of a board. `boardKey` and `window` are whatever the title declares. */
    boards(boardKey: string, opts?: ProgressOptions): Promise<ProgressResult>;
    /** Per-country totals. Each country sums its players' BEST runs, not every run. */
    nations(boardKey: string, opts?: ProgressOptions): Promise<ProgressResult>;
    /** The boards this title declares, so a client discovers rather than hard-codes. */
    boardList(opts?: ProgressOptions): Promise<ProgressResult>;
    /** This title's achievement definitions — not one player's awards. */
    catalogue(opts?: ProgressOptions): Promise<ProgressResult>;
    /** What one tygazen earned IN THIS TITLE. Key rows on personaKey, never handle. */
    achievements(personaKey: string, opts?: ProgressOptions): Promise<ProgressResult>;
    /** One tygazen's progress in this title: best per board, plus the award count. */
    player(personaKey: string, opts?: ProgressOptions): Promise<ProgressResult>;
    /** One clan: its roster and its DERIVED score. */
    clan(clanId: string, opts?: ProgressOptions): Promise<ProgressResult>;
    /** The clan board for this title's scope. Clans are game-isolated today. */
    clanTop(opts?: ProgressOptions): Promise<ProgressResult>;
    /**
     * Every page of a board. STOPS ON THE FIRST FAILED PAGE and reports what it had,
     * rather than returning a short list that looks complete.
     */
    allPages(boardKey: string, opts?: ProgressOptions): Promise<ProgressAllPages>;
  };

  /**
   * TygaZen News: one news log per Tygazen across every title. READS ONLY; facts are
   * recorded server-to-server by your backend. Nothing in a response says who is a human
   * or an AI. See {@link NewsOptions.gameKey}.
   */
  News: {
    /** This title's recent facts, newest first; filter by world, place, kind, since. */
    recent(opts?: NewsOptions): Promise<NewsResult<NewsPage>>;
    /** One Tygazen's facts across titles, as actor or co-actor. Key on personaKey. */
    mine(personaKey: string, opts?: NewsOptions): Promise<NewsResult<NewsPage>>;
    /** The while-you-were-away read since a moment. */
    digest(personaKey: string, opts?: Pick<NewsOptions, 'since' | 'gameKey'>): Promise<NewsResult<NewsDigest>>;
    /** Polls, newest first: open ones unless `state: 'closed'`. Reads only. */
    polls(opts?: NewsPollOptions): Promise<NewsResult<NewsPollPage>>;
    /** One poll by the hub's `id`. An empty id is refused locally with 'poll-id-required'. */
    poll(id: string, opts?: Pick<NewsPollOptions, 'gameKey'>): Promise<NewsResult<NewsPollRead>>;
  };

  /**
   * A member's responsible-gaming settings. READ-ONLY; the member sets them on the hub.
   * `mayWager(result)` is true only for a successful read that says play is allowed.
   */
  Care: {
    get(personaKey: string, opts?: CareOptions): Promise<CareResult>;
    mayWager(result: CareResult | null | undefined): boolean;
  };

  /** A Tygazen's permanent video room at appoiint, opened through the game center. */
  Rooms: {
    /** `pending` true (202) while the hub's outbox has not reached the member; ask again shortly. */
    open(personaKey: string, opts?: { gameKey?: string }): Promise<RoomsResult>;
  };

  Clips: {
    /** False unless the config names a transport. Every call below is then inert. */
    readonly enabled: boolean;
    track(eventName: string, meta?: Record<string, unknown>): void;
    /** `start` is negative for "began this many seconds ago"; `duration` in seconds. */
    clipMoment(eventName: string, start: number, duration: number, meta?: Record<string, unknown>): void;
    flush(): Promise<{ status: ClipFlushStatus }>;
  };

  NOT_LIVE: typeof NOT_LIVE;
};

export default TygaZen;
