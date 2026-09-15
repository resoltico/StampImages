"use strict";

const { probing } = require("./font-probe.js");

/*
 * Which faces the form suggests.
 *
 * Suggestions rather than the whole truth: resolving every family fontconfig
 * knows would cost a drawing apiece, and this Mac knows 671 of them, so the
 * list is short on purpose and any other family may be typed instead. What
 * makes that safe is that a typed name is resolved exactly as these are --
 * font-probe.js is the one question, and it is asked of whichever name a run
 * ends up using.
 *
 * Every name here is a family and only a family. The list used to offer each
 * one twice, as itself and with " Bold" on the end, which made the value a
 * font description rather than a name -- and the bold half was never resolved
 * at all, because only the plain name was drawn with before both were offered.
 * Weight is a setting of its own now.
 */

/*
 * Faces macOS ships, across the shapes somebody stamping a photograph might
 * want: a sans, a display sans, a serif, an old-style serif, and a monospace
 * for coordinates that line up. Names that do not resolve are dropped, so the
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
 * The faces to suggest, in the order they are written down -- and nothing at
 * all is an answer rather than a failure.
 *
 * It used to refuse the run when none of them resolved, which was right while
 * the list was the only way to name a typeface and is wrong now that the field
 * takes any family: a Mac with none of these ten and hundreds of others would
 * have been stopped at the door. A renderer that cannot draw at all still
 * fails loudly, because the reference drawing is not caught.
 */
function availableFonts(where) {
    const draws = probing(where);

    return CANDIDATES.filter(draws);
}

module.exports = { availableFonts, CANDIDATES };
