"use strict";

const { APP_NAME } = require("./version.js");
const { formRows } = require("./form-rows.js");
const { defaultAnswers } = require("./form-defaults.js");
const {
    selectionSummary, COPY_NOTE, SOURCE_NOTE, LOCATION_NOTE
} = require("./stamp-description.js");

/*
 * What the form says around its questions: the title above it, the buttons
 * under it, and the text between the two -- what was selected, what will be
 * made of it, and where the stamp's words come from. A form that has come
 * back puts what needs correcting first and keeps the rest, because a
 * correction is made against the same selection.
 *
 * Selecting a folder can mean a great many photographs, and this is the only
 * place between the selection and the work where the run can be called off.
 * Saying how many were found makes Cancel a decision rather than a guess.
 */

const CREATE_BUTTON = "Create";
const CANCEL_BUTTON = "Cancel";

function invitation(count, selectedFolders = 0) {
    return [
        selectionSummary({ count, selectedFolders }),
        COPY_NOTE,
        SOURCE_NOTE,
        LOCATION_NOTE
    ].join("\n");
}

/*
 * A form asked for with no answers opens on the defaults -- which include a
 * typeface, and which one that is depends on the machine. Taking them without
 * the fonts left the row saying nothing while the control beside it showed a
 * face, so the answers are defaulted here, where the fonts are known.
 */
function formSpec(answers, problems, context) {
    const { count, fonts, selectedFolders } = context;

    return {
        title: APP_NAME,
        detail: [
            ...problems.map((problem) => problem.message),
            invitation(count, selectedFolders)
        ].join("\n"),
        rows: formRows(
            answers ?? defaultAnswers(fonts),
            new Set(problems.map((problem) => problem.key)),
            fonts
        ),
        buttons: [CREATE_BUTTON, CANCEL_BUTTON]
    };
}

module.exports = {
    invitation,
    CREATE_BUTTON,
    CANCEL_BUTTON,
    defaultAnswers,
    formSpec
};
