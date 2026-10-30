/**
 * Signup — the claim flow, driven from a sister game's own page.
 *
 * TWO WAYS IN, and the difference is honest rather than cosmetic:
 *
 *   mount(el)   builds the face IN YOUR PAGE with the same editor the hub uses, then
 *               posts the claim to the hub. The player never leaves your game.
 *   openHub()   sends them to the hub's own 7-beat stage. Works today with no UI
 *               work from you, and is the reference implementation of the flow.
 *
 * The 18+ check is the hub's, server-side, on the player's OWN attestation. This SDK
 * collects a date of birth and forwards it; it never supplies or defaults one.
 */
import { fromConfig, rememberMine, placeholderConfig } from '../avatar/avatar.js';

/**
 * HOW THE EDITOR IS FOUND, and why there is a seam here at all.
 *
 * mount() used to do `await import('../avatar/pixel-editor.js')` inline. That specifier
 * is correct for THIS file's position (dist/identity/ -> dist/avatar/) and it is wrong
 * for every bundle, because a bundler flattens this module to the bundle's own location
 * and a runtime import() resolves against the MODULE's URL. In dist/tygazen.browser.js
 * the same string therefore points one folder ABOVE dist/ and the browser answers 404.
 * Measured independently by coilgo and by pokattack on 0.3.0, both of whom shipped a
 * workaround rather than a bug report, which is how long a 404 can hide.
 *
 * Worse, it is invisible to a build gate: the obfuscator turns the specifier into a
 * computed expression, so there is no literal path left in the output to check.
 *
 * So a bundle REGISTERS the editor up front (src/browser.js does exactly that) and no
 * runtime resolution happens at all — the one-file bundle is actually one file. The
 * unbundled dist keeps the lazy import, where the specifier is right and the saving is
 * real.
 */
let registeredEditor = null;

/** Register the editor factory ahead of mount(). For bundles; see the note above. */
export function useEditor(factory) { registeredEditor = factory; }

async function resolveEditor() {
  if (registeredEditor) return registeredEditor;
  const m = await import('../avatar/pixel-editor.js');
  return m.createPixelEditor;
}

export function openHub(client, { returnTo } = {}) {
  const u = new URL(client.base + '/auth/join');
  if (returnTo) u.searchParams.set('return_to', returnTo);
  if (client.cfg.titleSlug) u.searchParams.set('title', client.cfg.titleSlug);
  location.assign(u.toString());
}

/** A fresh config to open the builder on. Random seed, nothing else assumed. */
export function newConfig() {
  return { seed: Math.random().toString(36).slice(2, 10), parts: {}, colors: {}, probabilities: {} };
}

/**
 * The minimal real flow: face -> handle -> claim. Returns the claim result; the
 * account itself comes into existence when the player opens the magic link, which
 * is also what proves the inbox, so there is nothing to "wait for" here beyond the
 * hub confirming it sent the mail.
 */
export async function claim(client, { pixel, handle, email, dateOfBirth, country }) {
  const h = await client.checkHandle(handle);
  if (!h.ok) return { ok: false, step: 'handle', error: h.error };
  if (h.data && h.data.available === false) {
    return { ok: false, step: 'handle', error: h.data.message || 'Taken. Try another.' };
  }
  const r = await client.claim({ handle, email, dateOfBirth, country, pixel });
  if (!r.ok) return { ok: false, step: 'claim', error: r.error };
  if (r.data && r.data.ok === false) return { ok: false, step: 'claim', error: r.data.message, field: r.data.field };
  rememberMine(pixel);                       // so the face draws at once on the next page
  return { ok: true, sentTo: r.data && r.data.sentTo };
}

export function resend(client, email) { return client.resend(email); }

/**
 * Mount the face builder into an element. Thin on purpose: it owns the config and
 * the preview, and hands every change back so the page keeps its own state — the
 * same split createPixelEditor() already uses on the hub.
 */
export async function mount(el, { client, pixel = newConfig(), onChange } = {}) {
  const createPixelEditor = await resolveEditor();
  el.innerHTML = '<div class="tz-face"></div><div class="tz-tabs"></div>'
    + '<div class="tz-strip"></div><div class="tz-swatches"></div>';
  const faceEl = el.querySelector('.tz-face');
  let current = pixel;
  const paint = () => { faceEl.innerHTML = fromConfig(current); };
  const editor = createPixelEditor({
    tabsEl: el.querySelector('.tz-tabs'),
    stripEl: el.querySelector('.tz-strip'),
    swatchesEl: el.querySelector('.tz-swatches'),
    getPixel: () => current,
    onChange: (next, label, tabId) => { current = next; paint(); onChange && onChange(next, label, tabId); }
  });
  editor.render();
  paint();
  return {
    get pixel() { return current; },
    reroll() { current = { ...current, seed: Math.random().toString(36).slice(2, 10) }; paint(); editor.renderTab(); return current; },
    placeholder() { current = placeholderConfig(); paint(); editor.renderTab(); return current; },
    claim: (fields) => claim(client, { ...fields, pixel: current })
  };
}
