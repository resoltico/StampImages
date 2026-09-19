"use strict";

/*
 * What is said when a typeface cannot be found, and why it is said here.
 *
 * There are two different mistakes and they need two different sentences. A
 * name nothing recognises is somebody who does not know how to name a face;
 * a family this Mac has, asked for in a style it has not, is somebody who
 * knows exactly what they want and asked for a face the family does not come
 * in. Telling the second one how to name a font would be answering a question
 * they did not ask.
 *
 * The second sentence is the reason for reading a catalogue at all: only a
 * program that knows what the family does come in can say so. What this
 * replaced could report that a name had failed and nothing more -- and what
 * that replaced gave advice about where font files have to live, which was
 * wrong as well as unhelpful. A face switched on by a font manager, kept in
 * any folder at all, is one this draws with.
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
 * A host with no catalogue cannot be told anything about fonts, so nothing is
 * checked and the name is passed on whole for pango to make what it can of.
 * Refusing every typeface on a machine that has them all would be the worse
 * failure, and a catalogue is not something a person can install.
 */
function resolved(known, name) {
    if (!known) {
        return { typeface: { name } };
    }

    const found = faceOf(known, name);

    return found
        ? { typeface: found }
        : { problem: unknownTypeface(known, name) };
}

module.exports = { inWords, unknownTypeface, resolved };
