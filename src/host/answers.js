"use strict";
const { ORDER, controlFor } = require("./form-rows.js");
const { valueOfLabel, labelOfValue } = require("./choices.js");
const { normalizeColour } = require("../core/colour.js");
const { errorMessage } = require("../core/errors.js");
const { readSetting } = require("../core/settings.js");

/*
 * Turning what a person answered into settings, or into a list of what is
 * wrong with it.
 *
 * A reader returns the value or throws the sentence, and the sentence names
 * the setting it is about: ten of them are listed together, and one that does
 * not name itself is a sentence about nothing.
 *
 * A problem carries the key of its row as well. Listing the sentences tells a
 * person what is wrong; the key is what lets the form also show them where.
 */

const DECIMAL_INTEGER = /^[+-]?\d+$/u;

/*
 * Controls accept plain signed decimal integers. Settings files already carry
 * typed JSON numbers; the form does not interpret hex or exponential text
 * as an ordinary size. The shared validator owns the numeric bounds.
 */
function readNumber(answer, control) {
    const text = String(answer).trim();
    if (!DECIMAL_INTEGER.test(text)) { throw new Error(`${control.label} enter a whole number.`); }
    return Number(text);
}
function readColour(answer, control) { return normalizeColour(answer, control.label.replace(/:$/u, "")); }
function readChoice(answer, control) { return valueOfLabel(control, answer); }
const READERS = { choice: readChoice, font: String, colour: String, number: readNumber, text: String };

/*
 * Every problem at once. A form that reports the first bad field, and only
 * then the second, is a sequence of dialogs with extra steps.
 */
function readAnswer(row, answer, fonts) {
    return readSetting(row.key, READERS[row.kind](answer, controlFor(row, fonts)));
}

function readAnswers(answers, fonts) {
    const settings = {};
    const problems = [];

    for (const row of ORDER) {
        try {
            settings[row.key] = readAnswer(row, answers[row.key], fonts);
        } catch (error) {
            problems.push({ key: row.key, message: errorMessage(error) });
        }
    }

    return problems.length > 0 ? { problems, values: settings } : { settings };
}

/*
 * Settings the form could have produced, which is what a remembered run is
 * given back as. The exact inverse of reading it: a closed choice becomes the
 * label it is offered under, a number becomes the text of itself, and a
 * colour or a typeface is already what the control holds.
 *
 * Only a closed choice is looked up, which is the whole of why a remembered
 * typeface that has since gone is no longer a problem: it used to be read
 * back through the list of faces this Mac drew with today, where an absent
 * one has no label -- and that raised, which discarded the record and reset
 * every other setting with it. A name is a name now.
 */
function answersFromSettings(settings, fonts) {
    const answers = {};

    for (const row of ORDER) {
        const value = settings[row.key];

        answers[row.key] = row.kind === "choice"
            ? labelOfValue(controlFor(row, fonts), value)
            : String(value);
    }

    return answers;
}

module.exports = {
    readAnswer,
    readAnswers,
    answersFromSettings,
    readNumber,
    readColour
};
