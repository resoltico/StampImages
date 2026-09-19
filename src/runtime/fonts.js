"use strict";

const { familyIn } = require("../core/typeface.js");

/*
 * Which faces the form suggests.
 *
 * Suggestions rather than the whole truth: this Mac has 217 families and a
 * menu of them is not a menu. So the list is short on purpose, and any other
 * name may be typed instead -- typeface.js resolves whichever name a run ends
 * up using, so a typed one is checked exactly as a suggested one is.
 *
 * Each is a family and a family in bold, which is the variation nearly
 * everybody wants and the one worth saving a person from typing. Every other
 * face of every other family is a name away.
 */

/*
 * Faces macOS ships, across the shapes somebody stamping a photograph might
 * want: a sans, a display sans, a serif, an old-style serif, and a monospace
 * for coordinates that line up. Names the machine does not have are dropped,
 * so the list can afford to be optimistic about what a given Mac has.
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
 * The one style worth offering beside the family itself, and offered only
 * where the family really has a face by that name. All ten have one here;
 * a machine where one does not gets the family alone rather than a suggestion
 * that would be refused the moment it was chosen.
 */
const BOLD = "Bold";

function suggestionsFor(known, name) {
    const family = familyIn(known, name);

    if (!family) {
        return [];
    }

    return known.facesOf(family).includes(BOLD)
        ? [family, `${family} ${BOLD}`]
        : [family];
}

/*
 * The faces to suggest, in the order they are written down -- and nothing at
 * all is an answer rather than a failure. A Mac with none of these ten and
 * hundreds of others must not be stopped at the door; the field takes a name.
 *
 * A host with no catalogue is offered the candidates unfiltered, because the
 * alternative is offering nothing at all on a machine that has them.
 */
function availableFonts(known) {
    return known
        ? CANDIDATES.flatMap((name) => suggestionsFor(known, name))
        : [...CANDIDATES];
}

module.exports = { availableFonts, CANDIDATES };
