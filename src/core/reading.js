"use strict";

/*
 * What a value may be made of, before anything asks what it means.
 */

/*
 * What a setting may be made of, before anything asks what it means.
 *
 * A headless configuration is JSON, and JSON has lists and objects and true
 * in it. Read by coercion, every one of them is a value: `[36]` is a text
 * size of 36, `true` is an outline a pixel wide, and `{}` is the caption
 * "[object Object]" -- which somebody would have found on their photographs.
 *
 * So each kind is stated as what it accepts. A number is a number or text
 * that is one; text is text. Anything else is refused by name, which is the
 * same rule the coordinates are read by and for the same reason: a rule
 * written as exclusions is a rule with a gap in it.
 */
function readNumeric(value, subject) {
    if (typeof value !== "number" && typeof value !== "string") {
        throw new Error(`${subject} must be a number.`);
    }

    return value;
}

function readWords(value, subject) {
    if (typeof value !== "string") {
        throw new Error(`${subject} must be text.`);
    }

    return value;
}

module.exports = { readNumeric, readWords };
