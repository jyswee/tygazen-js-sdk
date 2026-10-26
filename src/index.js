/**
 * TygaZen SDK for the web — the ONE game-integration surface for the TYGA game
 * center (tygazen.com = community.tyga.games) in a browser.
 *
 * Deliberately the SAME SHAPE as the Unity SDK (com.tygazen): init, Session,
 * Events, Signup, Avatar, Clips. A studio that ships both a web and a Unity title
 * calls the same things by the same names, and there is one contract to keep true
 * rather than two that drift.
 *
 *   import { TygaZen } from '@tygazen/sdk';
 *   TygaZen.init({ gameCenterUrl: 'https://tygazen.com', titleSlug: 'chessingo' });
 *   const builder = await TygaZen.Signup.mount(el);
 *   await builder.claim({ handle, email, dateOfBirth, country });
 *   TygaZen.Avatar.fromConfig(builder.pixel);
 *   TygaZen.Clips.track('boss_down');
 *
 * NO KEY GOES IN A BROWSER. Every identity route is keyless and public; clip
 * telemetry goes through your own backend, or through a non-secret client id once
 * the game center issues them.
 */
import './avatar/options.js';                 // must precede the editor: it sets globalThis.PixelOptions
import { GameCenterClient, NOT_LIVE } from './identity/client.js';
import { Session } from './identity/session.js';
import * as signup from './identity/signup.js';
import * as avatar from './avatar/avatar.js';
import { Clips as ClipsRuntime } from './clips/clips.js';

const listeners = { faceChanged: [], signedIn: [] };
let cfg = null, client = null, clips = null;

export const TygaZen = {
  get config() { return cfg; },
  get client() { return client; },

  /** Call once at boot. Clip telemetry comes up only if the config names a transport. */
  init(config) {
    cfg = {
      gameCenterUrl: 'https://tygazen.com',
      titleSlug: '',
      publicClientId: '',
      clipsProxyUrl: '',
      playerToken: null,
      ...config
    };
    client = new GameCenterClient(cfg);
    clips = new ClipsRuntime(cfg);
    return TygaZen;
  },

  Session,

  Events: {
    on(name, fn) { (listeners[name] || (listeners[name] = [])).push(fn); },
    emit(name, arg) { (listeners[name] || []).forEach((f) => { try { f(arg); } catch {} }); }
  },

  Signup: {
    mount: (el, opts = {}) => signup.mount(el, { client: require_(), ...opts }),
    openHub: (opts) => signup.openHub(require_(), opts),
    newConfig: signup.newConfig,
    claim: (fields) => signup.claim(require_(), fields),
    resend: (email) => signup.resend(require_(), email)
  },

  Avatar: {
    fromConfig: avatar.fromConfig,
    dataUri: avatar.dataUri,
    placeholder: avatar.placeholder,
    placeholderConfig: avatar.placeholderConfig,
    mine: avatar.mine,
    get: (handle) => avatar.get(require_(), handle),
    getMany: (handles) => avatar.getMany(require_(), handles)
  },

  Clips: {
    get enabled() { return !!(clips && clips.enabled); },
    track: (n, m) => clips && clips.track(n, m),
    clipMoment: (n, s, d, m) => clips && clips.clipMoment(n, s, d, m),
    flush: () => clips ? clips.flush() : Promise.resolve({ status: 'disabled' })
  },

  NOT_LIVE
};

function require_() {
  if (!client) throw new Error('TygaZen.init(config) has not been called');
  return client;
}

export default TygaZen;
export { GameCenterClient, Session, NOT_LIVE };
