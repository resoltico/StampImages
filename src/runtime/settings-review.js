"use strict";

const { APP_NAME } = require("../core/version.js");
const { formSpec, CREATE_BUTTON, CANCEL_BUTTON } = require("../core/form.js");
const { answersFromSettings } = require("../core/answers.js");
const { UserCancelled } = require("../core/errors.js");
const { plural } = require("../core/numbers.js");
const { COPY_NOTE } = require("../core/stamp-description.js");

/*
 * The two questions an interactive run asks besides its settings, worded as
 * Image Files to PDF asks them.
 *
 * Both are consent, so both answer only with the button that goes on: Cancel
 * is the dialog's cancel button, and anything else that comes back -- a host
 * that returns Cancel rather than raising it -- is a cancellation, never
 * agreement. A headless run reaches neither: its configuration is the whole
 * of what it is told.
 */

const MAXIMUM_SHOWN = 12;

function approve(app, message, button) {
    const result = app.displayDialog(message, {
        withTitle: APP_NAME,
        buttons: [CANCEL_BUTTON, button],
        defaultButton: button,
        cancelButton: CANCEL_BUTTON
    });

    if (result.buttonReturned !== button) {
        throw new UserCancelled();
    }
}

/*
 * Items that will not be stamped are shown before the settings rather than
 * only after the run, so leaving out a locked folder is agreed to instead of
 * found out afterwards.
 */
function confirmSelection(app, context) {
    const rejected = context.rejected ?? [];

    if (rejected.length === 0) {
        return;
    }

    const shown = rejected.slice(0, MAXIMUM_SHOWN).map(
        (entry) => `${entry.name}: ${entry.reason}`
    );

    if (rejected.length > shown.length) {
        shown.push(`...and ${rejected.length - shown.length} more.`);
    }

    approve(app, [
        `${plural(rejected.length, "item")} in your selection cannot be ` +
            `included:\n${shown.join("\n")}`,
        `Continue with ${plural(context.count, "image")}?`
    ].join("\n\n"), "Continue");
}

/*
 * The form ends with its Create button; the stepwise dialogs end with the
 * last answer, which is not consent to write anything. So they finish on the
 * same question, stated with the answers actually given.
 */
function reviewSettings(app, settings, context) {
    const spec = formSpec(answersFromSettings(settings, context.fonts), [], context);
    const lines = spec.rows.map((row) =>
        `${row.label} ${row.kind === "text" ? JSON.stringify(row.value) : row.value}`
    );
    const question = context.count > 0
        ? `Create ${plural(context.count, "stamped copy", "stamped copies")}?`
        : "Create the stamped copies?";

    approve(app, [question, COPY_NOTE, "", ...lines].join("\n"), CREATE_BUTTON);
}

module.exports = { confirmSelection, reviewSettings, approve };
