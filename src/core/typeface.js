"use strict";

/*
 * A typeface, named the way a person names one, and checked against what this
 * Mac actually has.
 *
 * One field holds the whole name: "Georgia", "Georgia Bold", "Avenir Black",
 * "Source Serif 4 Semibold". There is no separate weight setting, because a
 * weight setting can only offer the two weights somebody thought of, while a
 * family offers the faces it was drawn with -- Avenir has Book, Light, Medium,
 * Heavy and Black, and a Bold menu can reach none of them. A name reaches all
 * of them, including the named instances of a variable font, without this
 * program knowing anything about font files.
 *
 * What makes that safe is that the name is resolved before anything is drawn:
 * the family has to be one the machine has, and the style has to be one that
 * family has. A name that resolves to nothing is refused, and the refusal can
 * say what the family does come in, because by then it is known.
 *
 * Everything here is a decision about strings. Where the machine's answer
 * comes from is typefaces.js.
 */

const SPACE = /\s+/u;

/*
 * Named the way the person named it, whatever they capitalised, and however
 * they spaced the ends of it.
 */
function sameName(one, other) {
    return String(one).trim().toLowerCase() === String(other).trim().toLowerCase();
}

function familyIn(known, name) {
    return known.families.find((family) => sameName(family, name)) ?? "";
}

function faceIn(known, family, name) {
    return known.facesOf(family).find((face) => sameName(face, name)) ?? "";
}

function wordsOf(name) {
    return String(name).trim().split(SPACE).filter(Boolean);
}

/*
 * The longest family first, because family names contain the words that styles
 * are also made of. "Arial Hebrew Scholar" is a family of its own and not
 * Arial Hebrew in some Scholar style; "Avenir Next" is a family and not Avenir
 * in a style called Next. Taking the shortest match would name the wrong
 * family for both and then fail to find a style, which is a refusal of a
 * typeface this Mac has.
 */
function splitAt(known, words, taken) {
    const family = familyIn(known, words.slice(0, taken).join(" "));

    if (!family) {
        return null;
    }

    const rest = words.slice(taken).join(" ");

    if (rest === "") {
        return { family, face: "" };
    }

    const face = faceIn(known, family, rest);

    return face ? { family, face } : null;
}

/*
 * The family and the face a name asks for, or nothing at all.
 */
function faceOf(known, name) {
    const words = wordsOf(name);

    for (let taken = words.length; taken > 0; taken -= 1) {
        const found = splitAt(known, words, taken);

        if (found) {
            return found;
        }
    }

    return null;
}

/*
 * How far a name that did not resolve did get: the family it named, and what
 * was left over. A name whose family is right and whose style is wrong is a
 * different mistake from a name nothing recognises, and the person who made it
 * needs a different sentence.
 */
function nearestFamily(known, name) {
    const words = wordsOf(name);

    for (let taken = words.length - 1; taken > 0; taken -= 1) {
        const family = familyIn(known, words.slice(0, taken).join(" "));

        if (family) {
            return { family, rest: words.slice(taken).join(" ") };
        }
    }

    return { family: "", rest: "" };
}

module.exports = { sameName, familyIn, faceIn, faceOf, nearestFamily };
