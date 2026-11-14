"use strict";
const { APP_NAME } = require("../../core/version.js");
const { formRows } = require("./settings-model.js");
const { defaultAnswers } = require("./settings-model.js");
const {
    selectionSummary, outcomeSummary, ORIGINALS_NOTE, SOURCE_NOTE, LOCATION_NOTE
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

function invitation({ count = 0, selectedFolders = 0, folders = [] } = {}) {
    const outcome = count > 0 && folders.length > 0
        ? [outcomeSummary({ count, folders }), `Save locations:\n${folders.join("\n")}`]
        : [selectionSummary({ count, selectedFolders })];

    return [...outcome, [ORIGINALS_NOTE, SOURCE_NOTE, LOCATION_NOTE].join("\n")].join("\n\n");
}

/*
 * A form asked for with no answers opens on the defaults -- which include a
 * typeface, and which one that is depends on the machine. Taking them without
 * the fonts left the row saying nothing while the control beside it showed a
 * face, so the answers are defaulted here, where the fonts are known.
 */
// One line, so the form keeps its height: a wrapped sentence measured 750 points.
function correction(count) {
    return `Correct the ${count === 1 ? "highlighted setting" : `${count} highlighted settings`}, listed below.`;
}

function formSpec(answers, problems, context) {
    const { fonts } = context;

    // That something needs correcting is said where the alert puts its
    // message, above the controls; what it is leads the scrolling note. The
    // messages themselves stay in the note because it has a fixed height:
    // measured, ten of them in the message grew the form past 744 points.
    return {
        title: APP_NAME,
        detail: problems.length > 0 ? correction(problems.length) : "Choose the stamp settings, then Create.",
        fullDetail: [
            ...problems.map((problem) => problem.message),
            invitation(context)
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
