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
 * whole reason this is hand-written rather than generated. Source carries a
 * TygaZen.Progress surface (boards, achievements, clans) that is NOT in the published
 * dist — verified by importing the installed package in node and enumerating its keys,
 * not by reading src/index.js. Declaring Progress here would type-check code that
 * throws at runtime, which is worse than having no types at all. It arrives when the
 * dist does.
 *
 * Keep this file honest the same way: if you add to src/index.js, this does not change
 * until the artifact does.
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
