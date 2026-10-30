/**
 * pixel-editor — the pixel person editor, ONE implementation for every page that edits a face:
 * the signup stage (/auth/join beat 2) and Settings > Profile (the dashboard's "Edit pixel
 * person"). Pixel Frame kit styles: /css/pixel-kit.css.
 *
 * Faces are drawn here with the same generator the server uses (/vendor/dicebear via the page's
 * import map) and the same config -> options mapping (globalThis.PixelOptions), so what the player
 * sees is byte-identical to what the server would store.
 *
 *   const editor = createPixelEditor({ tabsEl, stripEl, swatchesEl,
 *       getPixel: () => pixel,                       // the current { seed, parts, colors }
 *       onChange: (next, label, tabId) => { ... } }); // the page owns the state and the face
 *   editor.render();                                  // tabs + the open tab
 *   editor.renderTab();                               // just the open tab (e.g. after a reroll)
 */
import { createAvatar } from '@dicebear/core';
import * as pixelArt from '@dicebear/pixel-art';

// globalThis, NOT window. options.js assigns globalThis.PixelOptions and in a browser the
// two are the same object, so this read was correct on every page — and it made the module
// impossible to IMPORT anywhere else: `window` is not defined in node, so the SDK's own
// pack verification could not load the one-file browser bundle to check it. The editor
// needs a DOM when render() runs, which is a function call; it does not need one to exist.
const P = globalThis.PixelOptions;

// What a player can tune. EVERY group in the catalogue appears here, and every group in
// NULLABLE_GROUPS leads its grid with a "none" tile — the five are hair (Bald), hat,
// glasses, beard and accessories. That is not a UI preference, it is the contract: a
// member who has no beard must be able to SAY so, because "off" and "the seed decides"
// are different states and only the member knows which one they mean.
//
// BEARD AND ACCESSORIES WERE MISSING FROM THIS LIST UNTIL 2026-10-30, and the comment
// here used to claim they "stay in the full builder at /my/avatar". They did not: every
// pixel-art surface — the signup wizard (join-stage.js), the in-game embed
// (avatar-embed.js), profile settings (pixel-settings.js) and the SDK's copy of this
// file — mounts THIS array, and /my/avatar's own picker is the 3D body/pack one. So no
// surface anywhere let a member choose or remove a beard or an accessory: both were
// decided by the seed, permanently, at the catalogue's 5% and 10%. The data layer was
// right the whole time (NULLABLE_GROUPS is five, optionsFor emits probability 0), which
// is exactly why nothing failed loudly. BUG-2026-1030-0020, and the sibling of
// BUG-2026-1029-0028 in Unity and unity2godot's own v0.3.2 fix.
//
// `color: null` means "no swatch row on this tab". Beard has none deliberately: the
// reference gives it no colour of its own (COLOR_OF_GROUP.beard === null) — it is drawn
// in hairColor, which is picked on the Hair tab. Inventing a beard swatch here would
// write a colour the renderer ignores.
export const TABS = [
    { id: 'skin', label: 'Skin', shape: null, color: 'skinColor' },
    { id: 'hair', label: 'Hair', shape: 'hair', color: 'hairColor', none: 'Bald' },
    { id: 'eyes', label: 'Eyes', shape: 'eyes', color: 'eyesColor' },
    { id: 'mouth', label: 'Mouth', shape: 'mouth', color: 'mouthColor' },   // lip colour, as /my/avatar offers
    { id: 'clothing', label: 'Clothes', shape: 'clothing', color: 'clothingColor' },
    { id: 'beard', label: 'Beard', shape: 'beard', color: null, none: 'No beard' },
    { id: 'hat', label: 'Hat', shape: 'hat', color: 'hatColor', none: 'No hat' },
    { id: 'glasses', label: 'Glasses', shape: 'glasses', color: 'glassesColor', none: 'None' },
    { id: 'accessories', label: 'Extras', shape: 'accessories', color: 'accessoriesColor', none: 'None' }
];

export const draw = (pixel) => createAvatar(pixelArt, P.optionsFor(pixel)).toString();
const hex = (c) => '#' + String(c).replace(/^#/, '');

export function createPixelEditor({ tabsEl, stripEl, swatchesEl, getPixel, onChange, initialTab = 'skin' }) {
    let tab = initialTab;
    let renderGen = 0;

    function choose(change, label) {
        const cur = getPixel();
        const next = {
            ...cur,
            parts: change.part ? { ...cur.parts, [change.part]: change.value } : cur.parts,
            colors: change.color ? { ...cur.colors, [change.color]: change.value } : cur.colors
        };
        onChange(next, label, tab);
        renderTab();
    }

    function renderTabs() {
        tabsEl.innerHTML = '';
        for (const t of TABS) {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'pp-tab pf';
            b.setAttribute('role', 'tab');
            b.setAttribute('aria-selected', String(t.id === tab));
            b.textContent = t.label;
            b.addEventListener('click', () => { tab = t.id; renderTabs(); renderTab(); });
            tabsEl.appendChild(b);
        }
    }

    // Each option is the player's OWN current face with that one thing swapped: the detail that
    // makes this character creation rather than a form. Drawn in small batches so a 46-option
    // hair grid never blocks a frame.
    function renderTab() {
        // A batch still drawing from a PREVIOUS render must stop, or it keeps appending its options
        // into the redrawn grid (duplicates, wrong order, the wrong option marked checked).
        const gen = ++renderGen;
        const pixel = getPixel();
        const t = TABS.find((x) => x.id === tab);
        stripEl.innerHTML = '';
        swatchesEl.innerHTML = '';

        const values = t.shape ? (t.none ? [null, ...P.GROUPS[t.shape]] : P.GROUPS[t.shape]) : null;
        const options = t.shape
            ? values.map((v) => ({ part: t.shape, value: v, pixel: { ...pixel, parts: { ...pixel.parts, [t.shape]: v } } }))
            : P.COLORS[t.color].map((v) => ({ color: t.color, value: v, pixel: { ...pixel, colors: { ...pixel.colors, [t.color]: v } } }));
        const isOn = (o) => (o.part ? pixel.parts[o.part] === o.value : pixel.colors[o.color] === o.value);

        let i = 0;
        const batch = () => {
            if (gen !== renderGen) return;
            const end = Math.min(i + 12, options.length);
            for (; i < end; i++) {
                const o = options[i];
                const b = document.createElement('button');
                b.type = 'button';
                b.className = 'pp-opt pf';
                b.setAttribute('role', 'radio');
                b.setAttribute('aria-checked', String(isOn(o)));
                b.setAttribute('aria-label', o.value === null ? t.none : t.label + ' option ' + (t.none ? i : i + 1));
                b.innerHTML = draw(o.pixel);
                b.addEventListener('click', () => choose(o, t.label));
                stripEl.appendChild(b);
            }
            if (i < options.length) requestAnimationFrame(batch);
        };
        batch();

        // The group's colour, as swatches. Skin is already its own grid of faces; a group that is
        // switched off (bald, no hat) has no colour to pick.
        if (t.shape && t.color && pixel.parts[t.shape] !== null) {
            for (const v of P.COLORS[t.color]) {
                const s = document.createElement('button');
                s.type = 'button';
                s.className = 'pp-swatch';
                s.setAttribute('role', 'radio');
                s.setAttribute('aria-checked', String(pixel.colors[t.color] === v));
                s.setAttribute('aria-label', t.label + ' colour ' + hex(v));
                s.style.setProperty('--c', hex(v));
                s.addEventListener('click', () => choose({ color: t.color, value: v }, t.label + ' colour'));
                swatchesEl.appendChild(s);
            }
        }
    }

    // Arrow keys move within a radio group, as a radio group should; up/down move a grid row.
    for (const el of [stripEl, swatchesEl]) {
        el.addEventListener('keydown', (e) => {
            if (!['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp'].includes(e.key)) return;
            if (el === swatchesEl && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) return;
            const items = [...el.querySelectorAll('[role="radio"]')];
            const at = items.indexOf(document.activeElement);
            if (at < 0) return;
            const cols = getComputedStyle(el).gridTemplateColumns.split(' ').filter(Boolean).length || 1;
            const step = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: cols, ArrowUp: -cols }[e.key];
            items[(at + step + items.length) % items.length].focus();
            e.preventDefault();
        });
    }

    return { render() { renderTabs(); renderTab(); }, renderTabs, renderTab, get tab() { return tab; } };
}
