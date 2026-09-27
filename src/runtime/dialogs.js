"use strict";

const { ORDER, controlFor } = require("../core/form-rows.js");
const { readAnswer, readAnswers } = require("../core/answers.js");
const { labelOfValue } = require("../core/choices.js");
const { errorMessage } = require("../core/errors.js");
const { contentProblem } = require("../core/stamp-content.js");
const { APP_NAME } = require("../core/version.js");
const { resolved } = require("../core/typeface-refusal.js");
const { chooseRequired, askUntil } = require("./prompts.js");
const { reviewSettings } = require("./settings-review.js");
const { invitation } = require("../core/form.js");

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
 * refused in the other, in the same words. Each answer is read on its own:
 * reading it alongside the rest let a bad later answer, still at its old
 * value, refuse a good typeface.
 *
 * The typeface is typed here as well, and resolved by the same function the
 * form uses, so a family the person already uses can be named and a name
 * that names nothing is asked again like a number out of range.
 */
function refusal(context, row, text) {
    try {
        const value = readAnswer(row, text, context.fonts);

        return row.kind === "font"
            ? resolved(context.known, value).problem ?? ""
            : "";
    } catch (error) {
        return errorMessage(error);
    }
}

/*
 * The checkbox and its menu, asked as two questions: whether, then how. A
 * format is asked for only when the answer is On, and On opens on the format
 * last used rather than on whatever the list happens to begin with.
 */
function askOptional(app, control, answer) {
    const off = labelOfValue(control, control.optional.offValue);
    const enabled = chooseRequired(app, {
        prompt: `${control.optional.label}? ${control.optional.help}`,
        choices: [{ label: "Off", value: false }, { label: "On", value: true }]
    }, answer === off ? "Off" : "On");

    if (enabled === "Off") {
        return off;
    }

    const choices = control.choices.filter((choice) => choice.value !== control.optional.offValue);

    return chooseRequired(app, { ...control, choices },
        answer === off ? choices[0].label : answer);
}

function askRow(app, row, answers, context) {
    const control = controlFor(row, context.fonts);

    if (control.optional) {
        return askOptional(app, control, answers[row.key]);
    }

    if (row.kind === "choice") {
        return chooseRequired(app, control, answers[row.key]);
    }

    return askUntil(app, {
        prompt: control.prompt,
        defaultAnswer: String(answers[row.key])
    }, (text) => {
        const said = refusal(context, row, text);

        if (said) {
            throw new Error(said);
        }

        return text;
    });
}

/*
 * The first question carries what the form says above its rows -- what was
 * selected and what will be made of it -- because a person answering ten
 * dialogs is owed the same account as one answering one form.
 */
function withInvitation(row, context) {
    return {
        ...row,
        control: {
            ...row.control,
            prompt: `${invitation(context.count, context.selectedFolders)}` +
                `\n\n${row.control.prompt}`
        }
    };
}

function collectDialogSettings(app, answers, context) {
    const given = { ...answers };

    for (;;) {
        ORDER.forEach((row, index) => {
            given[row.key] = askRow(
                app, index === 0 ? withInvitation(row, context) : row, given, context
            );
        });

        const read = readAnswers(given, context.fonts);
        // Every field has already passed the same reader in askRow.
        // Only the relationship between the content fields remains to check.
        const problem = contentProblem(read.settings);

        if (problem) {
            app.displayDialog(problem.message, {
                withTitle: APP_NAME, buttons: ["OK"], defaultButton: "OK"
            });
        } else {
            reviewSettings(app, read.settings, context);

            return read.settings;
        }
    }
}

module.exports = { collectDialogSettings, askRow };
