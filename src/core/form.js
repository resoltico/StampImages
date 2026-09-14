"use strict";

const { APP_NAME } = require("./version.js");
const { plural } = require("./numbers.js");
const { formRows } = require("./form-rows.js");
const { defaultAnswers } = require("./form-defaults.js");

/*
 * What the form says around its questions: the title above it, the buttons
 * under it, and the line between the two -- which is either an invitation or
 * the list of what needs correcting, because a form that has come back has
 * something to say first.
 */

const CREATE_BUTTON = "Stamp";
const CANCEL_BUTTON = "Cancel";

/*
 * Selecting a folder can mean a great many photographs, and this is the only
 * place between the selection and the work where the run can be called off.
 * Saying how many were found makes Cancel a decision rather than a guess.
 *
 * And it is the one place to say where the stamp's words come from. Two of
 * the ten rows choose how something is written rather than what it says, and
 * a form whose first two controls offer "2026-09-09 14:30" reads as though it
 * were asking which date to stamp. The photograph answers that; this only
 * asks how to write the answer.
 */
const SOURCE = "The date and place are each photograph's own. " +
    "Your own text is the same on all of them.";

function invitation(count) {
    const ask = `Choose what to stamp and how it should look. ${SOURCE}`;

    return count > 0 ? `${plural(count, "photograph")}. ${ask}` : ask;
}

/*
 * A form asked for with no answers opens on the defaults -- which include a
 * typeface, and which one that is depends on the machine. Taking them without
 * the fonts left the row saying nothing while the control beside it showed a
 * face, so the answers are defaulted here, where the fonts are known.
 */
function formSpec(answers, problems, context) {
    const { count, fonts } = context;

    return {
        title: APP_NAME,
        detail: problems.length > 0
            ? problems.map((problem) => problem.message).join("\n")
            : invitation(count),
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
