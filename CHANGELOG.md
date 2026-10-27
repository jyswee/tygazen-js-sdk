# Changelog

## 0.2.0 — 2026-10-27

**v0.1.0 could not run in a browser at all.** Only Node and bundlers could load it, and
the README's no-bundler route could never have worked. tygaria found it by being the
first to actually load the published tag in headless Chrome; every fault below was
reproduced here before it was fixed, and the negative control (v0.1.0, served with a
correct MIME type and an import map in place) still fails with tygaria's exact message.

### Fixed — the browser could not load this package
- **`dist/tygazen.browser.js` — new, and the whole no-bundler story.** One prebuilt ESM
  file with DiceBear 9.4.3 inside it. No bare specifiers, no import map, no peer
  install, no `.cjs` on the wire, one request. The build refuses to emit it if any
  module specifier survives, if DiceBear is not the exact version `peerDependencies`
  declares, or if the `PixelOptions` assignment is missing from the output.
- `avatar/options.js` default-imported `./pixel-options.cjs`, which is UMD and exports
  nothing to ESM: *"The requested module './pixel-options.cjs' does not provide an
  export named 'default'"*. Node and every bundler can default-import CommonJS, which is
  why this survived review — the only consumer that cannot is a browser, and nobody had
  been one. The shared file stays byte-identical to the hub's `public/js/pixel-options.js`
  (md5 `fd260033fff628b816633969195edb0e`); the bundle is what browsers load instead.
- Over jsdelivr that `.cjs` is served `content-type: application/node`, refused as a
  module script before parse. The bundle is `.js`.
- The README told you to point an import map at the hub's `/vendor/dicebear/`. Module
  scripts load in CORS mode and that path sent no `Access-Control-Allow-Origin`, so the
  documented route was impossible from any origin but the hub's own. The hub fix is
  committed separately; this package no longer needs it.

### Fixed — `sideEffects: false` was dropping a load-bearing import
`avatar/options.js` exists **for** its side effect: it publishes the config-to-options
mapping on `globalThis.PixelOptions`, which `pixel-editor.js` reads at module scope.
`"sideEffects": false` told every bundler it was safe to delete `import
'./avatar/options.js'`, and esbuild said so out loud — *"Ignoring this import because
dist/avatar/options.js was marked as having no side effects"*. So bundled consumers had
no global and a dead editor, with nothing in the build looking wrong. `sideEffects` now
names that one file, and the bundle build asserts the assignment reached the output.

### Fixed — the build silently omitted a whole surface
`scripts/build.cjs` published a hand-kept list of nine filenames. `src/pool/roster.js`
was added to `src/index.js` without being added to the list, so the next build would
have obfuscated an `index.js` importing `./pool/roster.js` and never emitted it: a
`dist/` that throws on first import, from a build reporting `9/9 ok`. The list is now
discovered from `src/`, and the build refuses an empty one.

### Added
- `pool/roster.js` — `Roster.list` / `get` / `all` read the persona pool live from
  `GET /api/v1/pool/personas`, so a title no longer imports a CDN drop of our members
  into its own database. Gated on a `vgk_` key granting `pool:read`; **backend or your
  own proxy only**, never a key in page JavaScript. Unconfigured it returns
  `{ ok: false, error: 'roster-not-configured' }` and never an empty list, because an
  empty list reads to an importer as "the pool is empty" and looks like success.
- `Roster.scaffolding(text)` — the `dialogueGuard` implemented once.

### Withdrawn
- `Avatar.get(handle)` / `Avatar.getMany` stay in the surface but are **NOT LIVE** and
  were wrongly documented as working. The hub route `/auth/join/face` is not deployed
  and answers 404 on every host. There is no public handle-to-face or
  handle-to-personaKey lookup yet.

### Measured, not assumed
DiceBear 9.4.2 and 9.4.3 render **byte-identical** SVGs — four seeds, md5-compared
across both installed trees. The hub had 9.4.2 installed while this package declared
9.4.3 exactly, which was a real inconsistency in what we advertise, but it never
produced a divergent face. An earlier message to titles called that mismatch worse than
it was; this is the measurement.

## 0.1.0 — 2026-10-26

First release. The web counterpart of the Unity SDK (`com.tygazen`), with the same
surface: `init`, `Session`, `Events`, `Signup`, `Avatar`, `Clips`.

### Added
- `identity/client.js` — the four keyless public join routes the hub's own page uses,
  with `X-TygaZen-Client` / `X-TygaZen-Title` and the same `not_live` rule as the
  Unity client for routes the hub has not shipped.
- `identity/signup.js` — `mount()` builds the face in the game's own page and claims
  from there; `openHub()` hands off to the hub's 7-beat stage, which works today.
- `avatar/avatar.js` — `fromConfig`, `dataUri`, `get`, `getMany`, `mine`,
  `placeholder`, matching the Unity SDK's Avatar surface name for name.
- `clips/clips.js` — crash-safe queue, idempotent `event_id`s, `lower_snake_case`
  enforced at the call site, and the two keyless transports.

### Owned, not forked
- `avatar/pixel-options.cjs` and `avatar/pixel-editor.js` are in this package
  byte-for-byte as the app serves them (md5 verified). pixel-options' own header
  requires exactly one implementation of the config-to-options mapping, so this
  package owns it and the app imports it from here. Renamed to `.cjs` only so Node
  reads the UMD file as CommonJS inside a `type: module` package; the content is
  unchanged.

### Verified
- Byte parity against the server's own renderer: 10 configs through this SDK and
  through `services/avatarDicebear.svgFor()` → 10 identical, 0 differing, with a
  negative control (two different seeds) correctly reported as differing.
- No port and therefore no parity fixtures: both sides call the same `@dicebear`
  packages through the same mapping.

### Not done
- `Signup.mount` ships the builder and the claim calls, not the hub's full 7-beat
  motion design. `openHub()` remains the reference flow.
- Claim-status polling and face-by-handle depend on hub routes that are not public
  yet; they answer `not_live`.
- Keyless clip ingest needs FEAT-2026-1026-0027. Use `clipsProxyUrl` today.
