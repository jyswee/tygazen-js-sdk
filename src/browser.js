/**
 * Browser entry — the entry dist/tygazen.browser.js is bundled FROM.
 *
 * WHY THIS FILE EXISTS. The bundle's whole promise is one file, one MIME type, one
 * request: no bare specifiers, no import map, no .cjs on the wire. 0.3.0 broke that
 * promise in a way nothing checked — Signup.mount lazily imported the editor, and a
 * runtime import() resolves against the MODULE's URL, so a specifier written for
 * dist/identity/ pointed one folder above dist/ once the module was flattened into
 * dist/tygazen.browser.js. The browser answered 404 and the builder never drew.
 *
 * coilgo and pokattack each found it on their own and each shipped a workaround. Two
 * partners, one defect, no failing test anywhere: the gate in build-browser.cjs matched
 * static `from "spec"` syntax only, and the obfuscator had already turned the dynamic
 * specifier into a computed expression with no literal left to match.
 *
 * The fix is to stop resolving anything at runtime. The editor is imported STATICALLY
 * here and registered before any mount can run, so it is inside the bundle like
 * everything else. options.js is imported FIRST on purpose: pixel-editor.js reads
 * globalThis.PixelOptions at module scope, so the assignment has to have happened
 * before its evaluation, and ESM evaluates in import order.
 *
 * The unbundled dist/ keeps the lazy import, where the specifier is correct and the
 * saving is real — a page that only reads faces never fetches the editor.
 */
import './avatar/options.js';                 // must precede the editor: sets globalThis.PixelOptions
import { createPixelEditor } from './avatar/pixel-editor.js';
import { useEditor } from './identity/signup.js';
import TygaZen, { GameCenterClient, Session, NOT_LIVE } from './index.js';

// Runs after the whole graph has evaluated, because ESM hoists every import above the
// body. That is early enough and it is the only ordering that matters: nothing calls
// Signup.mount during module evaluation, so the editor is registered before any mount.
useEditor(createPixelEditor);

export { TygaZen, GameCenterClient, Session, NOT_LIVE };
export default TygaZen;
