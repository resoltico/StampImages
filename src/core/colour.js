"use strict";

const { plural } = require("./numbers.js");

/*
 * A colour, as the one kind of thing it is.
 *
 * More than one setting is a colour -- the text and its outline -- so what a
 * colour *is* is said once, here, and each setting says which of them it is.
 * A parser per setting is how two of them come to disagree: one accepting a
 * value the other silently makes nothing of.
 *
 * Permissive at the edge and strict in what is kept. A leading # is optional,
 * either case is taken, surrounding space is ignored, and what comes out is
 * always uppercase #RRGGBB. Normalizing is idempotent, so a value that has
 * been through here once is unchanged by going through again -- which is what
 * lets the form and the headless path share it without either needing to know
 * whether the other ran first.
 *
 * Six digits, and only six. Three-digit shorthand is refused rather than
 * guessed at, because #FFF is as readily an unfinished #FFF000 as it is
 * white; eight digits are refused because the fourth pair is transparency,
 * and a page background has nothing behind it to be transparent against.
 *
 * A value that is not a string is refused too, rather than converted: a
 * headless configuration is JSON, and a bare number there is a mistake to be
 * reported, not a colour to be inferred.
 */

const HEX_COLOUR =
    /^#?(?<red>[\da-f]{2})(?<green>[\da-f]{2})(?<blue>[\da-f]{2})$/iu;
const HEX_RADIX = 16;

/*
 * The rule, without a subject. The caller supplies the subject, because a
 * message that names the setting is the difference between "wrong" and
 * "which one".
 */
const COLOUR_RULE = "must be six hexadecimal digits, for example #C7DAE8. " +
    "The # is optional, and transparency is not supported.";

function refuse(subject) {
    return new Error(`${subject} ${COLOUR_RULE}`);
}

function groupsOf(value) {
    if (typeof value !== "string") {
        return null;
    }

    const match = HEX_COLOUR.exec(value.trim());

    return match ? match.groups : null;
}

function normalizeColour(value, subject = "A colour") {
    const groups = groupsOf(value);

    if (!groups) {
        throw refuse(subject);
    }

    return `#${groups.red}${groups.green}${groups.blue}`.toUpperCase();
}

function rgbOf(value, subject = "A colour") {
    const groups = groupsOf(value);

    if (!groups) {
        throw refuse(subject);
    }

    return {
        red: parseInt(groups.red, HEX_RADIX),
        green: parseInt(groups.green, HEX_RADIX),
        blue: parseInt(groups.blue, HEX_RADIX)
    };
}

/*
 * A colour that could not be moved into a photograph's own space is painted
 * as the numbers it is, which is what every copy was before the move existed.
 * Said once for the run: what it affects is how closely the stamp matches the
 * colour that was chosen, and only on a photograph that carries a profile.
 */
function describeUnconverted(count) {
    return `${plural(count, "photograph")} carried a colour profile this ` +
        "could not read, so the stamp was drawn in plain sRGB.";
}

module.exports = { COLOUR_RULE, normalizeColour, rgbOf, describeUnconverted };
