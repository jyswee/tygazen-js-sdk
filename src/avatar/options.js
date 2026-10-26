/**
 * Adapter, NOT a fork.
 *
 * pixel-options.js is UMD and pixel-editor.js reads it off `window.PixelOptions`,
 * because both were written for a page with a plain script tag. Both files are in
 * this package byte-for-byte as the app serves them, and pixel-options' own header
 * says there must be exactly one implementation of the config -> options mapping.
 * So this file adapts rather than reimplements: it imports the UMD module, hands it
 * back as a normal ESM export, and publishes it on the global the editor expects.
 *
 * That is also why pixel-editor can stay untouched: a bundled web game gets the
 * global set before the editor's first call, and a page using an import map keeps
 * working exactly as it does today.
 */
import PixelOptionsModule from './pixel-options.cjs';

export const PixelOptions = PixelOptionsModule;

// pixel-editor.js does `const P = window.PixelOptions` at module scope, so this has
// to be in place before it is imported. index.js imports this module first.
if (typeof globalThis !== 'undefined' && !globalThis.PixelOptions) {
  globalThis.PixelOptions = PixelOptionsModule;
}
export default PixelOptionsModule;
