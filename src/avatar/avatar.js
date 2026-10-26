/**
 * A member's face. Mirrors Runtime/Wizard/TygaZen.cs's Avatar surface so a studio
 * moving between the Unity and web SDKs is calling the same thing by the same name.
 *
 * WHAT MAKES THE WEB SDK DIFFERENT FROM THE UNITY ONE, and it is worth knowing:
 * Unity bundles a C# PORT of the generator and needs parity fixtures to prove the
 * port still matches. Here there is no port. This draws with @dicebear/core and
 * @dicebear/pixel-art — the same packages the server renders with — through
 * pixel-options, the same mapping the server requires. So a face drawn here is
 * byte-identical to the one the server would store, by construction rather than by
 * test. Do not replace this with a reimplementation to save a dependency.
 */
import './options.js';                       // sets globalThis.PixelOptions for the editor
import { PixelOptions as P } from './options.js';
import { createAvatar } from '@dicebear/core';
import * as pixelArt from '@dicebear/pixel-art';

/** SVG string for a config. The one drawing primitive; everything else composes it. */
export function fromConfig(pixel) {
  return createAvatar(pixelArt, P.optionsFor(pixel || {})).toString();
}

/** A data: URI, for an <img src> or a CSS background. */
export function dataUri(pixel) {
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(fromConfig(pixel));
}

/**
 * The stock face for someone with no handle yet.
 *
 * MEASURED BUG, INHERITED AND FIXED HERE 2026-10-26. The Unity SDK's
 * PlaceholderConfig() keys its colours "skin", "hair", "clothing", "eyes",
 * "mouth" and sets them to greys. Neither half of that works:
 *   - the catalogue's colour keys are skinColor, hairColor, eyesColor,
 *     mouthColor, clothingColor, so those five keys are not read at all and
 *     optionsFor() emits NO colour options for that config;
 *   - and no grey exists in the curated palette anyway (skinColor is eight skin
 *     tones), so sanitize() would throw on one if the keys were right.
 * Rendered, the "grey" placeholder came out as an ordinary coloured face and no
 * intended grey appeared in the SVG. Verified against the server's own renderer.
 *
 * So the config stays palette-legal and the greying is done at RENDER time with a
 * saturate(0) filter. That keeps the stored shape something sanitize() accepts,
 * and keeps "no grey in the palette" a product decision rather than something this
 * function quietly depends on. com.tygazen has the same bug and needs the same fix.
 */
export function placeholderConfig() {
  return {
    seed: 'tygazen-nobody',
    // the smallest eye whites in the catalogue and a flat mouth: calm, not startled
    parts: { eyes: 'variant04', mouth: 'sad05', hair: 'short01', clothing: 'variant01' },
    probabilities: { hat: 0, glasses: 0, beard: 0, accessories: 0 },
    colors: {}                                   // palette-legal by being empty
  };
}

/** The placeholder, greyed. The filter is why it reads as "nobody" rather than "someone". */
export function placeholder() {
  const svg = fromConfig(placeholderConfig());
  return svg.replace(/<svg\b([^>]*)>/, (m, attrs) =>
    /style=/.test(attrs)
      ? `<svg${attrs.replace(/style="([^"]*)"/, 'style="$1;filter:saturate(0)"')}>`
      : `<svg${attrs} style="filter:saturate(0)">`);
}

const cache = new Map();

/**
 * A member's face by handle, from the game center. Cached on the handle.
 * Returns null when the hub has not shipped the public face route yet — null, not
 * a placeholder, so a caller can tell "unknown" from "this is their face".
 */
export async function get(client, handle) {
  if (!handle) return null;
  if (cache.has(handle)) return cache.get(handle);
  const r = await client.face(handle);
  if (!r.ok || !r.data || !r.data.avatar) return null;
  const a = r.data.avatar;
  const face = {
    handle,
    family: a.family,
    url: a.url,
    urls: a.urls || null,
    catalogVersion: a.catalogVersion,
    pixel: a.configJson ? safeParse(a.configJson) : null
  };
  cache.set(handle, face);
  return face;
}

/** Several at once. Fans out today; becomes one call when the batch route lands. */
export async function getMany(client, handles) {
  const out = {};
  for (const h of handles || []) out[h] = await get(client, h);
  return out;
}

/** The signed-in member's own face, held locally so it draws at once and offline. */
export function mine() {
  try {
    const raw = localStorage.getItem('tygazen.myface');
    return raw ? fromConfig(safeParse(raw)) : null;
  } catch { return null; }
}
export function rememberMine(pixel) {
  try { localStorage.setItem('tygazen.myface', JSON.stringify(pixel)); } catch {}
}

function safeParse(s) { try { return JSON.parse(s); } catch { return null; } }
