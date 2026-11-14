"use strict";
const { IssueError } = require("./errors.js");

/*
 * Whole-number parsing and padding for settings and tool responses.
 */

function parseInteger(value, minimum, maximum, label) {
    const numeric = Number(value);

    if (
        !isFinite(numeric) ||
        Math.floor(numeric) !== numeric ||
        numeric < minimum ||
        numeric > maximum
    ) {
        throw new IssueError(
            `${label} must be a whole number from ${minimum} to ${maximum}.`
        );
    }

    return numeric;
}

/* A complete decimal count from a tool, never a coerced or partial value. */
function positiveIntegerFrom(value) {
    const text = String(value).trim();
    const numeric = Number(text);

    return /^\d+$/u.test(text) && Number.isSafeInteger(numeric)
        ? numeric
        : 0;
}

function zeroPad(value, width) {
    let text = String(value);

    while (text.length < width) {
        text = `0${text}`;
    }

    return text;
}

module.exports = {
    parseInteger,
    positiveIntegerFrom,
    zeroPad
};
