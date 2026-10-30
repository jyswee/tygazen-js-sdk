# TYGAZEN™ SDK for the web (`@tygaria/tygazen`)

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
import { TygaZen } from '@tygaria/tygazen';

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

**With a bundler** (npm, esbuild, vite, webpack, rollup) — from npm, as of 0.3.0:

```
npm i @tygaria/tygazen @dicebear/core@9.4.3 @dicebear/pixel-art@9.4.3
```

The two DiceBear packages are peer dependencies: install them at that EXACT version, not
a caret range.

The codeload tarball of a tag still works and remains the route for anyone pinning to a
git ref rather than a registry version:

```
npm i https://codeload.github.com/jyswee/tygazen-js-sdk/tar.gz/refs/tags/v0.3.0 \
      @dicebear/core@9.4.3 @dicebear/pixel-art@9.4.3
```

**NOT `npm i github:jyswee/tygazen-js-sdk#v0.2.0`.** That form installs perfectly on a
laptop and then fails inside an alpine Docker build, because npm writes a `git+ssh` lock
entry that the image has no git or credentials to fetch. chessingo hit exactly that and
switched; crashola pinned the tarball from the start and reports a lockfile with ZERO
`git+ssh` entries, so their image builds. This README used to name the `github:` form,
which means it recommended the one that only breaks in the worst place to find out.

**TypeScript**: declarations ship in the package (`dist/tygazen.d.ts`), so imports are
typed with no `@types` package and no `declare module`. They describe the **shipped**
bundle — if something is missing from them it is missing from the build, not from the
types. Note `parts` values are `string | null` on an optional key: a string is a chosen
variant, `null` is explicitly OFF ("no hat"; on hair, bald), and an absent key lets the
seed decide. Those are three different states.

`@dicebear/core` and `@dicebear/pixel-art` are **peerDependencies pinned to 9.4.3** —
install them at that exact version, not a caret range.

**An exports-map gap that is now FIXED, recorded because guards were written around it.**
On every tag up to and including v0.2.0 the map had no `./package.json` key, so
`require.resolve('@tygaria/tygazen/package.json')` threw `ERR_PACKAGE_PATH_NOT_EXPORTED`
on a perfectly healthy install, and a guard written that way read a healthy install as a
missing one. First flagged as a v0.2.0 problem, which was too narrow: crashola checked
their own 0.1.0 tag and found it missing there too. Fixed from v0.2.1 onward — the map now
carries `.`, `./package.json`, `./pixel-options`, `./pixel-editor` and `./browser`. If you
added the resolve-the-root-and-take-its-dirname workaround, it still works and is not
wrong; you simply no longer need it.

**With no bundler**, load the prebuilt browser bundle. One file, DiceBear 9.4.3 already
inside it, no import map and no peer install:

```html
<script type="module">
  import { TygaZen } from 'https://cdn.jsdelivr.net/npm/@tygaria/tygazen@0.3.1/dist/tygazen.browser.js';
  TygaZen.init({ gameCenterUrl: 'https://tygazen.com', titleSlug: 'your-title' });
</script>
```

> **Use 0.3.1 or later. "One file" was not true before it**, and the `@v0.2.0` jsDelivr
> URL this README used to print is a git tag from before the package was on npm.
> Through 0.3.0 `Signup.mount` fetched the pixel editor at runtime from a path one folder
> ABOVE the bundle, so the builder 404ed and never drew — a runtime `import()` resolves
> against the module's own URL, and the specifier had been written for the unbundled
> layout. coilgo and pokattack each found it and each shipped a workaround; if you serve
> the bundle from a subfolder to make `../avatar/pixel-editor.js` resolve, you can drop
> that now. 0.3.0's main entry could not be imported at all (`dist/progress/` was left
> out of the tarball while the entry re-exports it), so **0.3.0 should not be used for
> anything**. Both are BUG-2026-1030-0220 and -0221, fixed in 0.3.1, and
> `npm run verify` now imports the packed tarball so neither can recur quietly.

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

---

TYGAZEN™ and TYGARIA™ are trade marks of **Tyga.Cloud Ltd**, asserted as unregistered
marks. © 2026 Tyga.Cloud Ltd. All rights reserved — this SDK is licensed commercially
and no licence arises from installing it. See `COPYRIGHT` and `LICENSE.md`.
