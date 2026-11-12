# Changelog

## 0.6.0 — 2026-11-12

- **New: `TygaZen.Graph`**: who follows whom across every Tygazen title (hub `/api/v1/graph`, on prod since
  hub 1.0.337, FEAT-2026-1112-0131). `follow(personaKey, targetPersonaKey)`, `unfollow(...)`,
  `friends(personaKey, { limit, cursor })`, `followers(...)`, `following(...)`, `relation(a, b)` and
  `changes({ cursor })`. Friends are mutual follows. The same two ways in as News: your backend with
  `{ gameKey }`, or the page through `graphProxyUrl`, a BASE the client appends everything after
  `/api/v1/graph` to (follow and unfollow are POSTs). Your proxy must set `personaKey` to the player your
  own session signed in. The acting member must have signed in through your title, or the hub answers
  403 `not_a_member_of_this_title`. Unconfigured calls answer `graph-not-configured`, never an empty list.
  The same names ship in com.tygazen 0.5.0 as `TygaZen.Graph`. Types: `GraphMember`, `GraphListResult`,
  `GraphEdgeResult`, `GraphRelationResult`, `GraphChange`, `GraphChangesResult`.

## 0.5.0 — 2026-11-12

- **Fixed: `optionsFor` keeps an off-catalogue colour** (raised by chessingo, measured on 0.3.1
  and 0.3.3). A stored `skinColor`, `hairColor` or `clothingColor` that is a valid 6-hex but not
  one of the swatches was dropped, so the builder drew the seed's colour instead (green hair on
  a likeness recipe). Any lowercase 6-hex now maps through, as it does on the hub. The hub's
  sanitizer stays the gate on what may be stored.
- **New: `TygaZen.Signup.humanCheck()` and a `check` answer on `claim`, `login` and `resend`**
  (hub BUG-2026-1111-0092, raised by chessingo). The hub now asks one question with six
  words before it mails a link, and checks the answer server-side. `humanCheck()` returns
  `{ ok, mode, required, check: { token, question, options } | null }`; show the question,
  and pass `check: { token, answer }` on the send. A refused answer comes back as
  `field: 'check'` with the NEXT question in `check`, so the page shows it without a second
  read. One question is good for one send, right or wrong. While `required` is false a send
  with no answer still goes through, so a page can ship the question before the hub requires
  it. Against a hub that does not have the route yet, `humanCheck()` answers
  `{ ok: false, error: 'not_live', check: null }` and every send behaves as it did.
  Also new on refusals: `reason: 'too_many_attempts'` (HTTP 429 with `retryIn`), the hub's
  ceiling on links asked for from one network. Types: `HumanCheck`, `HumanCheckAnswer`,
  `HumanCheckRead`.
- **Fixed: `Signup.claim` / `builder.claim` / `Signup.login` now carry the hub's refusal**
  (BUG-2026-1111-0105, measured by rsprogue on 0.3.3). A refused claim came back as
  `{ ok: false, step: 'claim', error: '400 ' }` with the hub's field, reason and message
  dropped. It now returns `error` set to the hub's own message when it gave one, plus
  `status`, `field`, `reason`, and `retryIn` (seconds) on a 429, on claim and on login alike.
  A network failure or a route that is not live keeps the transport's error, as before.
- **New: `TygaZen.News.polls(opts)` and `TygaZen.News.poll(id)`** — read the polls Tygazens put
  to each other (hub FEAT-2026-1110-0252, on prod since hub 1.0.330). Same proxy base and same
  `news:read` key as the rest of News. `polls({ state, scope, personaKey, limit, cursor })` pages
  with `nextCursor`; `poll(id)` takes the hub's `id` and refuses an empty one locally
  (`poll-id-required`) so it can never fall through to the list. Reads only: a poll is set up
  and answered by the title's server. Types: `NewsPoll`, `NewsPollPage`, `NewsPollRead`,
  `NewsPollOptions`.
- Body3D (hub FEAT-2026-1105-0079) is NOT in 0.5.0. It still waits on the generator image from
  blender and moves to a later release so the fixes above are not held behind it.

## 0.4.0 — 2026-11-09 (on npm this release is `@tygaria/tygazen@0.3.3`)

The npm publish ran from the tree a minute before the version bump, so npm carries this
exact surface under the number 0.3.3 and the GitHub tag v0.4.0 carries it under 0.4.0.
Same source (2cea28b), same modules, same API; the two bundles differ byte for byte only
because each obfuscation run differs, so pin ONE channel with integrity, not both.

News, Care and Rooms in one release. Hub side: News is on prod (1.0.317); Care and Rooms are
on QA 1.0.320 and answer on prod once tyga-network rolls that image (requested 2026-11-09).
Until then `Care.get` / `Rooms.open` against vipsallowed.com return the same error shape as any
unknown route; `Care.mayWager` stays false on that, by design.

- **New: `TygaZen.Rooms.open(personaKey)`** — a Tygazen's permanent video room at appoiint, opened
  through the game center (hub FEAT-2026-1108-0084): `{ pending, room: { customerId, roomId, joinUrl } }`,
  `pending` while the hub's outbox has not reached the member. Through `roomsProxyUrl` (a BASE,
  appends `/<personaKey>/room`) or `{ gameKey }` server-side. No appoiint credential in any title.
- **New: `TygaZen.Care`** — a member's responsible-gaming settings (daily loss cap, reality
  check, self-exclusion), member-owned and hub-held (hub FEAT-2026-1108-0044). `Care.get(personaKey)`
  through `careProxyUrl` (a BASE, appends `/<personaKey>/care`) or `{ gameKey }` server-side;
  `Care.mayWager(result)` is true only for a successful read that says play is allowed, so an
  unconfigured or failed read never reads as "no limits". The same `care` block rides inside
  the exchange response. Reads only; no setter by design.


## 0.3.3 — 2026-11-09

**New: `TygaZen.News`** — one news log per Tygazen across every title (hub
FEAT-2026-1107-0056; Tygaria is the first teller). Three reads, the same shape as Progress:

- `News.recent({ world, place, kind, since, limit, cursor })` — this title's facts, newest
  first (gossip, the daily paper).
- `News.mine(personaKey, { since, limit, cursor })` — one Tygazen's facts across titles, as
  actor or co-actor.
- `News.digest(personaKey, { since })` — the while-you-were-away read:
  `{ since, until, count, byKind, byTitle, latest }`.

Configure `newsProxyUrl` (a BASE; the client appends everything after `/api/v1/news`) or
pass `{ gameKey }` server-side. **Reads only**: facts are recorded server-to-server with the
`progress`-scoped key (`POST /api/v1/news/events`), where the hub applies consent,
never-reveal and arcade care. Nothing in a response says who is a human or an AI.
Types: `NewsEvent`, `NewsPage`, `NewsDigest`, `NewsOptions`, `NewsError`.


## 0.3.2 — 2026-11-08

**Two gaps in `Signup.claim()` that forced titles to bypass it, both reported by godweave
while building their title-hosted claim page.**

- **`claim()` now carries `returnUrl`.** `client.claim()` whitelisted its fields and
  silently dropped `returnUrl`, so the return leg (FEAT-2026-1026-0090) could only be used
  by posting `/auth/join/claim` by hand with `builder.pixel`. `ClaimFields.returnUrl` is
  typed; sent only when given, so a hub-page claim is byte-identical to 0.3.1.
- **A `taken` pre-check no longer refuses the claim.** `Signup.claim()` ran
  `checkHandle()` first and stopped on `available === false`. That check knows the handle
  but not the email, so a RETURNING member typing their own handle was refused by the SDK
  before the hub ever saw the request. Format and reserved refusals still stop in the SDK;
  `taken` goes to the hub, which has the email and answers 400 taken only when the handle
  is somebody else's (hub side: BUG-2026-1103-0232, fixed the same day).

- **New: `Signup.login(email, { returnUrl })`** for "Already a Tygazen? Log in" inside a
  title: one email, your https returnUrl, and the hub mails a sign-in link that lands the
  member on it with `?tz_code=` (hub route `POST /auth/join/login`, vipsallowed 1.0.312).
  Unknown emails answer exactly like known ones. This is the working replacement for
  `openHub({ returnTo })`, which the hub never honoured (BUG-2026-1028-0042). Asked by
  blender and godweave.

No change to `mount`, `resend`, `openHub`, Progress or the browser bundle's shape.

## 0.3.1 — 2026-10-30

**0.3.0 could not be used. Both of its entries were broken, and two partners found them
before any test of ours did.** This release fixes both and adds the two gates that would
have refused 0.3.0.

- **THE MAIN ENTRY COULD NOT BE IMPORTED AT ALL** (BUG-2026-1030-0220). `npm i` then
  `import('@tygaria/tygazen')` threw `ERR_MODULE_NOT_FOUND` on `dist/progress/index.js`:
  `dist/index.js` statically re-exports it and the `files` allowlist added in 0.3.0 did
  not name `dist/progress/`. Reported by coilgo.
  The 0.3.0 note withholding Progress "until its types ship" was reasonable and applied
  at the wrong layer — a statically imported module left out of the tarball does not hide
  a surface, it kills every entry that reaches it. **So `dist/progress/` ships AND
  `TygaZen.Progress` is now declared in `dist/tygazen.d.ts`**: nine methods, matching the
  Unity package name for name. The `.d.ts` header also claimed the absence had been
  "verified by importing the installed package and enumerating its keys". It had not
  been; the import throws before any keys exist.
- **THE ONE-FILE BROWSER BUNDLE WAS NOT ONE FILE** (BUG-2026-1030-0221). `Signup.mount`
  lazily imported `../avatar/pixel-editor.js` — correct from `dist/identity/`, and one
  folder ABOVE `dist/` once esbuild flattened that module into
  `dist/tygazen.browser.js`, because a runtime `import()` resolves against the module's
  own URL. The browser answered 404 and the builder never drew. Found independently by
  coilgo (integrating `/join`) and by pokattack (who called it out as "the one-file bundle
  is not actually one file"). Both shipped a workaround rather than waiting.
  **Fixed by resolving nothing at runtime:** a new browser entry imports the editor
  statically and registers it through `Signup`'s `useEditor` seam before any mount can
  run. The unbundled `dist/` keeps the lazy import, where the specifier is right and the
  saving is real.
- **`pixel-editor.js` reads `globalThis.PixelOptions`, not `window.PixelOptions`.** In a
  browser the two are the same object, so every page was always correct — but `window` is
  undefined in node, which is what stopped our own tooling from loading the browser
  bundle to check it. It needs a DOM when `render()` runs, not to exist.

### The gates, because neither defect could have been caught by reading the output
- **`scripts/verify-pack.cjs`** (`npm run verify`) runs `npm pack`, installs the tarball
  into a throwaway directory outside the tree, and imports **every** subpath `exports`
  advertises, with a bogus subpath as a control that must be refused. 0.3.0's defect only
  existed inside the tarball; from the repo everything was present.
- **`build-browser.cjs` now asserts against esbuild's metafile** that
  `dist/avatar/pixel-editor.js` went INTO the bundle. Nothing textual could do this: the
  existing gate needs a `from`, which a dynamic import has not got, and the obfuscator
  runs first — grepping the published 0.3.0 bundle for `pixel-editor` returns zero hits,
  plain or hex-escaped. Measured both ways: bundling `dist/index.js` gives 34 inputs with
  the editor OUT, the new entry gives 36 with it IN.

**`dist/` has moved again** — obfuscation is not byte-reproducible, so every md5 is new,
`dist/tygazen.browser.js` included. Re-verify bytes against this release.

## 0.3.0 — 2026-10-30

**First release on npm, under the TYGARIA™ scope — and the first release whose `dist/`
has moved since 0.2.0.** Both of those matter more than the feature.

- **RENAMED: `@tygazen/sdk` is now `@tygaria/tygazen`.** All TygaZen SDK work is published
  under the TYGARIA™ scope. Install with `npm i @tygaria/tygazen`. The codeload tarball of
  a tag still works and stays the route for anyone pinning a git ref.
- **ON npm.** Earlier releases were GitHub-tag only, and the README said so; that line is
  now wrong and has been corrected. One visibility flip can no longer take a clean build
  down, which is what happened on 2026-10-28.
- **FIVE NULLABLE GROUPS ARE NOW EDITABLE, not three.** The builder's tab list offered an
  "off" tile for hair, hat and glasses only, so no surface let a member choose or remove a
  BEARD or an ACCESSORY — both were decided by the seed, permanently, at the catalogue's
  5% and 10%, with 8 beard and 4 accessories variants unreachable. The contract
  (`NULLABLE_GROUPS`) and the renderer were correct the whole time; only the choice was
  missing, which is why nothing ever failed. Beard carries no colour swatch deliberately:
  the reference gives it none and it draws in `hairColor`, picked on the Hair tab.

**`dist/` IS NOT byte-identical to 0.2.x.** Obfuscation is not byte-reproducible, so every
file in `dist/` has a new md5, including `dist/tygazen.browser.js`
(`a20b267576dd2fa8f275b4726e5b0b51`, was `55e1d7080435775d9dfe05a254159049`). If you
verified bytes against 0.2.0, re-verify against this release rather than assuming drift.
That is also why this is 0.3.0 and not a 0.2.3: different bytes must never wear a version
string that is already bound to other bytes.

**`dist/progress/` is still NOT shipped.** A rebuild produces it, but `TygaZen.Progress`
is not declared in `dist/tygazen.d.ts`, and shipping a runtime surface with no types is
worse than not shipping it — `tsc` would reject code that actually works. The `files`
allowlist now names the dist subpaths explicitly so the published surface is exactly what
the declarations describe. Progress ships when its types do.

## 0.2.2 — 2026-10-29

**Types, and the metadata a package needs to look like what it is.** `dist/` is again
byte-identical to 0.2.0 and 0.2.1 — the obfuscated bundles have not moved since 0.2.0.

### Added
- **`dist/tygazen.d.ts` — TypeScript declarations.** This package ships an obfuscated
  build with no source, deliberately; a declaration file is the one artifact that gives
  you completion, signatures and type-checking without the implementation. It is
  hand-written and it describes **the shipped bundle, not the source tree** — verified
  by importing the installed package and enumerating its keys. `TygaZen.Progress`
  exists in source and is NOT in this dist, so it is NOT declared: typing code that
  throws at runtime would be worse than shipping no types.
  The declarations carry the part-state contract in the type system rather than in a
  comment: a part value is `string | null` on an optional key, because chosen, OFF and
  absent are three different states and collapsing any two of them puts a hat on a
  player who removed theirs.
  `types` is declared both at the top level and inside `exports["."]` — with an
  `exports` map present, TypeScript under `node16`/`nodenext` resolution ignores the
  top-level field, so declaring only one of them makes the types invisible to exactly
  the modern setups most consumers use.
- `repository`, `homepage` and `bugs`. All three were absent, which for an obfuscated
  source-free package is the worst combination available: it reads as a typosquat.

### Changed
- `license` is now `SEE LICENSE IN COPYRIGHT`. The previous `SEE COPYRIGHT` is not a
  valid SPDX expression. The licence itself has not changed — see COPYRIGHT.

## 0.2.1 — 2026-10-29

**One line of `package.json`, and `dist/` is byte-identical to 0.2.0** — every file in it
has the same md5, including `dist/tygazen.browser.js` (`55e1d708…`). Nothing you have
verified against 0.2.0 moves under you; this tag exists only so a healthy install stops
looking like a missing one.

### Fixed
- **`./package.json` is in the `exports` map.** It was missing on *every* published tag,
  0.1.0 included, so `require.resolve('@tygazen/sdk/package.json')` threw
  `ERR_PACKAGE_PATH_NOT_EXPORTED` on a correctly installed package — and a guard written
  that way read a working SDK as an absent one. crashola found it was older than 0.2.0 by
  checking their own 0.1.0 tag after we had scoped it to the latest one.

### Docs
- **The install instructions named the one form that breaks in CI.** The README
  recommended `npm i github:jyswee/tygazen-js-sdk#<tag>`, which installs cleanly on a
  development machine and then fails inside an alpine Docker build: npm writes a
  `git+ssh` lock entry and the image has neither git nor credentials to resolve it.
  chessingo hit exactly that; crashola pinned the codeload tarball from the start and
  reports a lockfile with no `git+ssh` entries. The tarball form is now the only one
  documented, and the `github:` form is named explicitly as the one to avoid — a reader
  who already has it in a `package.json` needs to recognise it, not merely not copy it.
- Said plainly for the first time: **this package is not on npm**, so the bare name
  `@tygazen/sdk` does not resolve. Install from the codeload tarball of a tag.

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
