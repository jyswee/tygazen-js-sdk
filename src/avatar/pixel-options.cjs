/**
 * pixel-options — the pixel-art catalogue and the config -> DiceBear options mapping.
 *
 * ONE FILE FOR BOTH SIDES. The server requires it (services/avatarDicebear.js) and the
 * browser loads it as a plain script (/js/pixel-options.js, served from public/). The
 * signup stage at /auth/join renders faces in the browser so Reroll needs no network
 * round trip, and the face a player sees there must be byte-identical to the one the
 * server stores. That only holds if both sides map a config to options the same way —
 * so there is exactly one implementation of that mapping, and it lives here. Do not
 * copy it into either side.
 *
 * Moved verbatim out of services/avatarDicebear.js, which re-exports every name it
 * used to define, so no existing caller changes.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PixelOptions = factory();
}(typeof self !== 'undefined' ? self : this, function () {
'use strict';

// ─── Catalog ─────────────────────────────────────────────────────────
// Transcribed from the style's own JSON schema so the builder can never offer a
// variant the generator would reject. Listed ascending; the schema declares them
// descending, which is an ordering nobody wants to scroll.

const GROUPS = {
  hair: [
    'long01','long02','long03','long04','long05','long06','long07','long08','long09','long10',
    'long11','long12','long13','long14','long15','long16','long17','long18','long19','long20','long21',
    'short01','short02','short03','short04','short05','short06','short07','short08','short09','short10',
    'short11','short12','short13','short14','short15','short16','short17','short18','short19','short20',
    'short21','short22','short23','short24'
  ],
  eyes: [
    'variant01','variant02','variant03','variant04','variant05','variant06',
    'variant07','variant08','variant09','variant10','variant11','variant12'
  ],
  mouth: [
    'happy01','happy02','happy03','happy04','happy05','happy06','happy07','happy08','happy09',
    'happy10','happy11','happy12','happy13',
    'sad01','sad02','sad03','sad04','sad05','sad06','sad07','sad08','sad09','sad10'
  ],
  clothing: [
    'variant01','variant02','variant03','variant04','variant05','variant06','variant07','variant08',
    'variant09','variant10','variant11','variant12','variant13','variant14','variant15','variant16',
    'variant17','variant18','variant19','variant20','variant21','variant22','variant23'
  ],
  glasses: [
    'dark01','dark02','dark03','dark04','dark05','dark06','dark07',
    'light01','light02','light03','light04','light05','light06','light07'
  ],
  hat: [
    'variant01','variant02','variant03','variant04','variant05',
    'variant06','variant07','variant08','variant09','variant10'
  ],
  beard: [
    'variant01','variant02','variant03','variant04','variant05','variant06','variant07','variant08'
  ],
  accessories: ['variant01','variant02','variant03','variant04']
};

const COLORS = {
  skinColor: ['ffdbac','f5cfa0','eac393','e0b687','cb9e6e','b68655','a26d3d','8d5524'],
  hairColor: ['cab188','603a14','83623b','a78961','611c17','603015','612616','28150a','009bbd','bd1700','91cb15'],
  // The generator's own six (five near-identical blue-greys: on a 2px eye nobody could see the
  // change) stay first, so every saved face still validates, then six that actually read.
  // Unset colours are never passed to the generator, so this list cannot alter an existing face.
  eyesColor: ['76778b','697b94','647b90','5b7c8b','588387','876658',
              '3b2314','8b5a2b','2e8b3e','1f6fe0','56c2f2','7a3fd1'],
  mouthColor: ['d29985','c98276','e35d6a','de0f0d'],
  clothingColor: ['5bc0de','428bca','03396c','88d8b0','44c585','00b159','ff6f69','d11141','ae0001','ffeead','ffd969','ffc425'],
  glassesColor: ['4b4b4b','323232','191919','43677d','5f705c','a04b5d'],
  hatColor: ['2e1e05','2663a3','989789','3d8a6b','cc6192','614f8a','a62116'],
  accessoriesColor: ['daa520','ffd700','fafad2','d3d3d3','a9a9a9']
};

/**
 * Groups the generator only draws SOME of the time (schema defaults: 10/5/20/5 %).
 * They are the reason decomposition needs absence detection: when one was not
 * drawn, EVERY variant reproduces the base SVG, so a naive search returns the
 * first one and invents a hat nobody is wearing.
 */
const PROBABILITY_GROUPS = ['accessories', 'beard', 'glasses', 'hat'];

/** Which colour belongs to which group, so an absent group's colour is skipped. */
const COLOR_OF_GROUP = {
  hair: 'hairColor',
  eyes: 'eyesColor',
  mouth: 'mouthColor',
  clothing: 'clothingColor',
  glasses: 'glassesColor',
  hat: 'hatColor',
  accessories: 'accessoriesColor',
  beard: null   // beard reuses hairColor
};

const GROUP_NAMES = Object.keys(GROUPS);
const COLOR_NAMES = Object.keys(COLORS);
const isProbabilityGroup = (g) => PROBABILITY_GROUPS.includes(g);

/**
 * Groups a player can switch OFF. The gated groups, plus hair: the generator has no hair
 * probability, but an EMPTY hair list draws no hair at all, which is how "Bald" works.
 * Before this existed sanitize() dropped null hair, so no stored config holds one; giving
 * it a meaning changes no existing face.
 */
const NULLABLE_GROUPS = [...PROBABILITY_GROUPS, 'hair'];
const isNullable = (g) => NULLABLE_GROUPS.includes(g);

/**
 * DiceBear options for a parameter set.
 *
 * A chosen variant is pinned as a ONE-ELEMENT array with probability 100; an
 * explicit null on a gated group is probability 0 ("I don't want a hat"), which
 * is different from leaving it unset ("let the seed decide"). Those three states
 * are why parts values are `string | null | undefined` rather than a boolean and
 * a string.
 */
function optionsFor(pixel = {}) {
  const parts = pixel.parts || {};
  const colors = pixel.colors || {};
  const opts = { seed: String(pixel.seed || '') };

  for (const g of GROUP_NAMES) {
    const v = parts[g];
    if (v === null) {
      if (isProbabilityGroup(g)) opts[`${g}Probability`] = 0;
      else if (isNullable(g)) opts[g] = [];   // bald: an empty list draws no hair
    } else if (typeof v === 'string' && GROUPS[g].includes(v)) {
      opts[g] = [v];
      if (isProbabilityGroup(g)) opts[`${g}Probability`] = 100;
    }
  }

  for (const c of COLOR_NAMES) {
    const v = colors[c];
    if (typeof v === 'string' && COLORS[c].includes(v)) opts[c] = [v];
  }

  return opts;
}

return {
  GROUPS, COLORS, GROUP_NAMES, COLOR_NAMES, PROBABILITY_GROUPS, COLOR_OF_GROUP,
  isProbabilityGroup, NULLABLE_GROUPS, isNullable, optionsFor
};
}));
