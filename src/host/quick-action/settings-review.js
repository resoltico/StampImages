"use strict";
const { APP_NAME } = require("../../core/version.js");
const { formSpec, CREATE_BUTTON, CANCEL_BUTTON } = require("./form.js");
const { answersFromSettings } = require("./settings-model.js");
const { UserCanceled } = require("../../core/errors.js");
const { plural } = require("../../core/formatting.js");
const { COPY_NOTE } = require("./stamp-description.js");
const { basename, dirname } = require("../../core/paths.js");

/*
 * One refusal as a person scans for it: the name first, then why, then where.
 * Full paths put the name last on a line that wraps, and a list of them read
 * as one block.
 */
function refusalLines(entry) {
    if (!entry.path) { return `${entry.name}: ${entry.reason}`; }
    return `${basename(entry.path)}: ${entry.reason}\nin ${dirname(entry.path)}`;
}

/*
 * Selection and settings review require affirmative consent. Only the
 * continuing button approves the operation; a returned Cancel is cancellation
 * just as a raised native Cancel is. Command-line requests never enter these
 * interactive reviews.
 */

const { showDetails } = require("./details-dialog.js");

const REVIEW_SUMMARY = "Review the settings before creating stamped copies.";

// A summary that carries a fact leads the text where there is no native alert
// to show it; the settings review's summary only names the step, so it does not.
function approve(app, message, button, summary = REVIEW_SUMMARY) {
    const fallbackDetail = summary === REVIEW_SUMMARY ? message : `${summary}\n\n${message}`;
    const response = showDetails(app, { title: APP_NAME, summary, detail: message, fallbackDetail, buttons: [button, CANCEL_BUTTON] });
    if (response !== 0) { throw new UserCanceled(); }
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

    const shown = rejected.map(refusalLines);

    approve(app, [
        `Not included:\n${shown.join("\n\n")}`,
        `Continue with ${plural(context.count, "image")}?`
    ].join("\n\n"), "Continue", `${plural(rejected.length, "item")} in your selection cannot be included.`);
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
