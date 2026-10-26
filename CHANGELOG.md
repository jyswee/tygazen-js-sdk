# Changelog

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
