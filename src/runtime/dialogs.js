"use strict";

const { ORDER, controlFor } = require("../core/form-rows.js");
const { readAnswers } = require("../core/answers.js");
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
 */
function askRow(app, row, answers, fonts) {
    const control = controlFor(row, fonts);

    if (row.kind === "choice" || row.kind === "font") {
        return chooseRequired(app, control, answers[row.key]);
    }

    return askUntil(
        app,
        {
            prompt: control.prompt,
            defaultAnswer: String(answers[row.key])
        },
        (typed) => {
            const read = readAnswers({ ...answers, [row.key]: typed }, fonts);

            if (read.problems) {
                const mine = read.problems.find((problem) => problem.key === row.key);

                if (mine) {
                    throw new Error(mine.message);
                }
            }

            return typed;
        }
    );
}

function collectDialogSettings(app, answers, fonts) {
    const given = { ...answers };

    for (const row of ORDER) {
        given[row.key] = askRow(app, row, given, fonts);
    }

    /*
     * Read once more, as a set. Every answer was read as it was given -- by
     * this same reader, one row at a time -- so this cannot come back with a
     * problem, and the branch that handled one was a branch nothing could
     * reach. What this call is for is the conversion: labels to values, text
     * to numbers.
     */
    return readAnswers(given, fonts).settings;
}

module.exports = { collectDialogSettings, askRow };
