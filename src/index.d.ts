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
  playerToken?: string | null;
}

/** The signed-in member, as held locally. Key your own rows on the personaKey from the server, never on `handle`. */
export interface Player {
  id: string;
  handle: string;
}

export interface ClaimFields {
  handle: string;
  email: string;
  /** ISO `YYYY-MM-DD`. The hub enforces 18+. */
  dateOfBirth: string;
  country: string;
  pixel?: PixelConfig;
}

export type ClaimResult =
  | { ok: true; sentTo?: string }
  | { ok: false; step: 'handle' | 'claim'; error?: string; field?: string };

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
  board(): Promise<Envelope>;
  claim(fields: ClaimFields): Promise<Envelope<{ ok?: boolean; sentTo?: string; message?: string; field?: string }>>;
  resend(email: string): Promise<Envelope>;
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
    resend(email: string): Promise<Envelope>;
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
