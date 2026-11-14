"use strict";
const { IssueError } = require("./errors.js");

/*
 * A name with no matching family needs naming guidance; a known family with
 * an unknown style needs its available styles. Query the installed catalog
 * so activated fonts are recognized regardless of their file location.
 */

const { faceOf, nearestFamily } = require("./typeface.js");

/*
 * A list a person reads rather than a list a program prints.
 */
function inWords(names) {
    return names.length > 1
        ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`
        : names.join("");
}

const NAMING = "Name it as Font Book does -- the family, and the style after " +
    "it if you want a particular one. \"Helvetica Neue\", \"Helvetica Neue " +
    "Bold\" and \"Avenir Black\" are all names this takes.";

/*
 * Why a name was refused, in the one place every reader of it can reach.
 */
function unknownTypeface(known, name) {
    // A PostScript name names a face this Mac has, so saying it has no such
    // typeface would be untrue; what is wrong is only how it was named.
    const named = known.postScriptNamed?.(String(name).trim());
    if (named) {
        return `"${name}" is a PostScript name, which this does not take.\n\n` +
            `Name it as Font Book does: "${named.family} ${named.face}".`;
    }
    const near = nearestFamily(known, name);

    return near.family
        ? `${near.family} has no style called "${near.rest}".\n\n` +
            `It comes in ${inWords(known.facesOf(near.family))}.`
        : `This Mac has no typeface called "${name}".\n\n${NAMING}`;
}

/*
 * The one question both front ends ask: what a name names, or what to say
 * about it.
 *
 * A catalog is required. An unchecked name must never reach the renderer,
 * where silent font substitution would change the requested stamp.
 */
function resolved(known, name) {
    if (!known) {
        throw new IssueError("A typeface catalog is required before choosing a face.");
    }

    const found = faceOf(known, name);

    return found
        ? { typeface: found }
        : { problem: unknownTypeface(known, name) };
}

module.exports = { inWords, resolved };
