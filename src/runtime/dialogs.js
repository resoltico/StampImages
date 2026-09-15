"use strict";

const { ORDER, controlFor } = require("../core/form-rows.js");
const { readAnswers } = require("../core/answers.js");
const { undrawable } = require("./font-probe.js");
const { chooseRequired, askUntil } = require("./prompts.js");

/*
 * The same questions, one at a time, when the form cannot be shown.
 *
 * Ten dialogs is a tedious way to answer ten questions, and it is still a
 * working tool: an action whose interface disappears entirely is worse. It
 * opens on the answers it is given, which are the last run's when there are
 * any, so the tedium is mostly pressing Return.
 *
 * The questions and their order come from the same description the form is
 * built from. Two front ends that could drift apart would be two products.
 */

/*
 * A choice is a list; everything else is typed, and what may be typed is
 * decided by the same reader the form uses -- so a colour refused in one is
 * refused in the other, in the same words.
 *
 * The typeface is typed here as well. It used to be a list, because a dialog
 * cannot offer a list and a field at once and the list was the answer always
 * known to work -- but that left this the one path where a family the person
 * already uses could not be named, and the one path where nothing checked the
 * answer at all. Asked as text and resolved by the same probe, it re-asks like
 * a number out of range instead.
 */
function refusal(context, row, typed) {
    const read = readAnswers({ ...typed.answers, [row.key]: typed.text }, context.fonts);
    const mine = (read.problems ?? []).find((problem) => problem.key === row.key);

    if (mine) {
        return mine.message;
    }

    return row.kind === "font" && !context.draws(read.settings[row.key])
        ? undrawable(read.settings[row.key])
        : "";
}

function askRow(app, row, answers, context) {
    const control = controlFor(row, context.fonts);

    if (row.kind === "choice") {
        return chooseRequired(app, control, answers[row.key]);
    }

    return askUntil(
        app,
        {
            prompt: control.prompt,
            defaultAnswer: String(answers[row.key])
        },
        (text) => {
            const said = refusal(context, row, { answers, text });

            if (said) {
                throw new Error(said);
            }

            return text;
        }
    );
}

function collectDialogSettings(app, answers, context) {
    const given = { ...answers };

    for (const row of ORDER) {
        given[row.key] = askRow(app, row, given, context);
    }

    /*
     * Read once more, as a set. Every answer was read as it was given -- by
     * this same reader, one row at a time -- so this cannot come back with a
     * problem, and the branch that handled one was a branch nothing could
     * reach. What this call is for is the conversion: labels to values, text
     * to numbers.
     */
    return readAnswers(given, context.fonts).settings;
}

module.exports = { collectDialogSettings, askRow };
