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

TygaZen.Avatar.fromConfig(builder.pixel);     // SVG string
TygaZen.Avatar.dataUri(builder.pixel);        // for an <img src>
await TygaZen.Avatar.get('sophialaurent');    // a member's face by handle

TygaZen.Clips.track('boss_down', { difficulty: 'hard' });
TygaZen.Clips.clipMoment('boss_down', -3, 8);  // "started 3s ago, keep 8s"
```

`@dicebear/core` and `@dicebear/pixel-art` are **peerDependencies**, pinned to 9.4.3.
Install them alongside. With no bundler, add an import map pointing both at the
copies the hub already serves from `/vendor/dicebear/`.

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
