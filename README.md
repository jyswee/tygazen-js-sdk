# TYGAZEN™ SDK for the web (`@tygazen/sdk`)

The ONE game-integration surface for the TYGA game center at tygazen.com
(= community.tyga.games) in a browser: native signup, the pixel face builder, and
clip-moment telemetry. One tygazen, one face, every game.

Deliberately the **same shape as the Unity SDK** (`com.tygazen`): `init`, `Session`,
`Events`, `Signup`, `Avatar`, `Clips`. A studio shipping both a web and a Unity title
calls the same things by the same names, and there is one contract to keep true
instead of two that drift.

TYGAZEN as a system, and the record of the mark: https://github.com/jyswee/tygazen

## Hook in

```js
import { TygaZen } from '@tygazen/sdk';

TygaZen.init({ gameCenterUrl: 'https://tygazen.com', titleSlug: 'your-title' });

const builder = await TygaZen.Signup.mount(document.getElementById('face'));
await builder.claim({ handle, email, dateOfBirth, country });   // the hub mails the magic link

TygaZen.Avatar.fromConfig(builder.pixel);     // SVG string, rendered locally, no network
TygaZen.Avatar.dataUri(builder.pixel);        // for an <img src>

TygaZen.Clips.track('boss_down', { difficulty: 'hard' });
TygaZen.Clips.clipMoment('boss_down', -3, 8);  // "started 3s ago, keep 8s"
```

`Avatar.get(handle)` and `Avatar.getMany` are in the surface but **NOT LIVE**: the hub
route they call (`/auth/join/face`) is not deployed and answers 404 on every host. They
were documented here as working, which was wrong. There is no public handle-to-face or
handle-to-personaKey lookup yet. What works today is a face from a config you already
hold (`fromConfig` / `dataUri`, pure local render) and the persona pool
(`Roster`, below). See FEAT-2026-1026-0090.

## Installing it — two routes, and the no-bundler one is a single file

**With a bundler** (npm, esbuild, vite, webpack, rollup):

```
npm i @tygazen/sdk @dicebear/core@9.4.3 @dicebear/pixel-art@9.4.3
```

`@dicebear/core` and `@dicebear/pixel-art` are **peerDependencies pinned to 9.4.3** —
install them at that exact version, not a caret range.

**With no bundler**, load the prebuilt browser bundle. One file, DiceBear 9.4.3 already
inside it, no import map and no peer install:

```html
<script type="module">
  import { TygaZen } from 'https://cdn.jsdelivr.net/gh/jyswee/tygazen-js-sdk@v0.2.0/dist/tygazen.browser.js';
  TygaZen.init({ gameCenterUrl: 'https://tygazen.com', titleSlug: 'your-title' });
</script>
```

> **If you are on v0.1.0, this is why it would not run in a browser.** v0.1.0 could not,
> at all — only Node and bundlers could load it. Three faults, all of them ours, all
> found by tygaria in headless Chrome and reproduced here before this was written:
>
> 1. `dist/avatar/options.js` default-imported `./pixel-options.cjs`, which is UMD and
>    has no ESM exports: *"The requested module './pixel-options.cjs' does not provide
>    an export named 'default'"*. Node and every bundler can default-import CommonJS,
>    so the one consumer that could not was the one this README told you to be.
> 2. Over jsdelivr that `.cjs` is served as `content-type: application/node`, which a
>    browser refuses as a module script before it even reaches fault 1.
> 3. The import-map route this README used to recommend — pointing at the hub's
>    `/vendor/dicebear/` — cannot work from another origin: module scripts load in CORS
>    mode and that path sent no `Access-Control-Allow-Origin`. The hub fix is committed
>    and queued for promotion — but the bundle above means you no longer depend on it,
>    which is the better answer anyway: one request to a CDN instead of three to us.
>
> A fourth, found while fixing those: `"sideEffects": false` let bundlers drop
> `import './avatar/options.js'` — the import that exists *only* to publish the
> config-to-options mapping on `globalThis.PixelOptions`, which `pixel-editor.js` reads
> at module scope. So bundled consumers had no global and a dead editor. `sideEffects`
> now names that file.

## What a call gives you back, and the one trap in it

Every network call returns the **same envelope**, and `ok` in it means *the request
worked*, not *the answer was yes*:

```js
{ ok, status, error, data }     // ok = transport+parse succeeded
```

The application's verdict lives **inside `data`**. So there are two `ok`s and they
answer different questions:

```js
const r = await TygaZen.client.checkHandle('mango');
r.ok               // did the call reach us and parse?
r.data.available   // is the handle free?        <- the answer you wanted

const s = await TygaZen.Signup.resend(email);
s.ok               // true on success
s.data.ok          // also true on success
                   // a 30s cooldown is HTTP 429: s.ok === false, s.data.retryIn === 30
```

**Why this bites.** A cooldown and a real failure both surface as `ok: false`, so code
that treats any `ok === false` as "the mail did not go" will offer the player a resend
they are rate-limited out of, and they will press it again. Branch on `status === 429`
before treating a resend as failed. Reported by a studio building against v0.1.0 — the
shape was correct, it was simply never written down.

**`checkHandle` is on `client`, not `Signup`.** `TygaZen.Signup` is the *builder* surface
(`mount`, `claim`, `resend`, `openHub`, `newConfig`). Handle availability is
`TygaZen.client.checkHandle(handle)`. `Signup.claim()` already calls it for you and
returns `{ ok: false, step: 'handle' }` when the handle is taken, so you only need
`checkHandle` directly for as-you-type feedback.

## No key goes in a browser

Every identity route is **keyless and public** — the same routes the hub's own join
page uses (`/auth/join/handle`, `/board`, `/claim`, `/resend`). The person's own
email is the credential and the hub mails the link. The wesell.cloud pattern: no game
key anywhere, no game backend in between.

A key in a browser bundle is not a key, it is a public string. So clip telemetry has
two keyless transports, exactly as in the Unity SDK:

| Mode | Set | Goes to | Status |
|---|---|---|---|
| Backend proxy | `clipsProxyUrl` | `{clipsProxyUrl}/api/gc/clips/events`, your backend forwards with its own ingest key | **works today** |
| Keyless client id | `publicClientId` | `{gameCenterUrl}/api/v1/clips/events` + `X-TygaZen-Client` | pending, FEAT-2026-1026-0027 |

Set neither and telemetry is OFF, said once, with signup and avatars unaffected.
While the keyless route is unshipped it reports `not_live` once per page and discards,
rather than queueing forever against a route that does not exist.

## Why there are no parity fixtures here

The Unity SDK bundles a **C# port** of the generator, so it needs a fixture set to
prove the port still matches what the server renders. This package has no port. It
draws with the same `@dicebear` packages the server renders with, through
`pixel-options` — the same config-to-options mapping the server itself requires
(`services/avatarDicebear.js`). A face drawn here is byte-identical to the one the
server would store **by construction**.

Measured, with a control that can fail: 10 configs rendered through this SDK and
through the server's own `svgFor()` came back 10 identical / 0 differing, while two
deliberately different seeds were reported as differing.

`pixel-options` and `pixel-editor` are in this package byte-for-byte as the app serves
them. Its own header says there must be exactly one implementation of that mapping —
so this package **owns** it rather than forking it, and the app imports it from here.
Do not copy it into a third place.

## Age

The 18+ check is the hub's, server-side, on the player's **own** attestation. This SDK
collects a date of birth and forwards it. It never supplies or defaults one.

## Status

`Signup.mount` and the three claim calls are live. Two routes a non-hub page wants —
claim status for a poll, and a member's face by handle — are not public on the hub
yet; they are wired and answer `not_live` until they ship, never a fake success.

---

## Licence

Licensed **commercially**, not open source. No licence arises from the publication of
this repository or from installing it through a package manager — see
[LICENSE.md](LICENSE.md) and [COPYRIGHT](COPYRIGHT). Bundled third-party components
keep their own licences: [Third Party Notices.md](Third%20Party%20Notices.md).

TYGAZEN™, TYGA.GAMES™ and the associated logos are trade marks of Tyga.Cloud Ltd,
asserted as unregistered marks. © 2026 Tyga.Cloud Ltd. All rights reserved.
