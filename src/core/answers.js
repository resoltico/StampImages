"use strict";

const { ORDER, controlFor } = require("./form-rows.js");
const { valueOfLabel, labelOfValue } = require("./choices.js");
const { normalizeColour } = require("./colour.js");
const { errorMessage } = require("./errors.js");
const { CUSTOM_TEXT_LIMIT } = require("./settings.js");

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

const DIGITS = /^\d+$/u;

/*
 * Digits, or it is a mistake. Deliberately stricter than the coercion used on
 * a settings file, where a JSON number is a number: Number() also reads
 * "0x12C" and "3e2" as 300, and turning either of those into a text size
 * would be guessing rather than reading.
 */
function readNumber(answer, control) {
    const text = String(answer).trim();
    const value = parseInt(text, 10);

    if (!DIGITS.test(text) || value < control.minimum || value > control.maximum) {
        throw new Error(
            `${control.label} enter a whole number from ` +
                `${control.minimum} to ${control.maximum}.`
        );
    }

    return value;
}

function readColour(answer, control) {
    return normalizeColour(answer, control.label.replace(/:$/u, ""));
}

function readChoice(answer, control) {
    try {
        return valueOfLabel(control, answer);
    } catch {
        throw new Error(`${control.label} "${answer}" is not one of the choices.`);
    }
}

function readText(answer, control) {
    const text = String(answer);

    if (text.length > CUSTOM_TEXT_LIMIT) {
        throw new Error(
            `${control.label} ${CUSTOM_TEXT_LIMIT} characters or fewer.`
        );
    }

    return text;
}

/*
 * A typeface is a name, and which names draw is not a question this layer can
 * answer: pango decides, by drawing. So what is read here is that a name was
 * given at all, and whether it draws is asked of the renderer afterwards --
 * in the form's own loop, where it comes back as this same kind of problem.
 */
function readFont(answer, control) {
    const name = String(answer).trim();

    if (name === "") {
        throw new Error(`${control.label} name a face to draw with.`);
    }

    return name;
}

const READERS = {
    choice: readChoice,
    font: readFont,
    colour: readColour,
    number: readNumber,
    text: readText
};

/*
 * Every problem at once. A form that reports the first bad field, and only
 * then the second, is a sequence of dialogs with extra steps.
 */
function readAnswers(answers, fonts) {
    const settings = {};
    const problems = [];

    for (const row of ORDER) {
        try {
            settings[row.key] = READERS[row.kind](
                answers[row.key],
                controlFor(row, fonts)
            );
        } catch (error) {
            problems.push({ key: row.key, message: errorMessage(error) });
        }
    }

    return problems.length > 0 ? { problems } : { settings };
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
    readAnswers,
    answersFromSettings,
    readNumber,
    readColour
};
