"use strict";

const { probing } = require("./font-probe.js");

/*
 * Which faces the form suggests.
 *
 * A list offering a name that silently becomes a different face is worse than
 * a shorter list, so every name here is drawn with before it is offered --
 * font-probe.js is that question. What the list may not do is grow without
 * bound: every name in it costs a rendering before the form can appear, and
 * this Mac knows 671 family names.
 *
 * So the list is short on purpose, and the typeface is the one setting whose
 * list is a set of suggestions rather than the whole of what may be chosen: a
 * name that is not here can be typed, and is drawn with in the same way before
 * the run starts.
 */

/*
 * Faces macOS ships, across the shapes somebody stamping a photograph might
 * want: a sans, a display sans, a serif, an old-style serif, and a monospace
 * for coordinates that line up. Names that do not draw are dropped, so the
 * list can afford to be optimistic about what a given Mac has.
 */
const CANDIDATES = [
    "Helvetica Neue",
    "Arial",
    "Verdana",
    "Avenir Next",
    "Gill Sans",
    "Georgia",
    "Palatino",
    "Baskerville",
    "Menlo",
    "Courier New"
];

/*
 * A family that draws is offered in both weights without probing the bold.
 *
 * The fallback is a fallback of the family: once the name has resolved, the
 * weight is chosen within the face pango found, so bold cannot become somebody
 * else's font. It can become a synthesised or nearest-weight bold, which is a
 * heavier version of what was asked for rather than a substitution -- and
 * probing for it would double the wait before the form appears.
 */
const WEIGHTS = ["", " Bold"];

/*
 * The faces to offer, in the order they are written down. A machine none of
 * them draws on is not one this can offer a choice on, and it says so rather
 * than offering a list that does nothing.
 */
function availableFonts(where) {
    const draws = probing(where);
    const found = [];

    for (const family of CANDIDATES) {
        if (draws(family)) {
            found.push(...WEIGHTS.map((weight) => `${family}${weight}`));
        }
    }

    if (found.length === 0) {
        throw new Error(
            "None of the fonts this action offers draws on this Mac."
        );
    }

    return found;
}

module.exports = { availableFonts, CANDIDATES };
