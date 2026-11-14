"use strict";
const { hostError } = require("../cancellation.js");
const { UserCanceled, errorMessage } = require("../../core/errors.js");
const { APP_NAME } = require("../../core/version.js");
const { labelsOf, valueOfLabel } = require("./settings-model.js");

/*
 * Asking one question at a time, when the native form is unavailable.
 *
 * Each takes what it should open on, so a run that remembers the last one
 * offers those answers back rather than the compiled defaults -- and a run
 * with nothing to remember passes nothing, and gets them.
 */

/*
 * Present choice labels and return the chosen label as a form answer.
 * The shared answer reader converts labels to stored values; returning a stored
 * value here would bypass that contract. Refuse a response outside the offered
 * list at this question rather than deferring it to later validation.
 */
function chooseRequired(app, control, opening) {
    try {
        const choice = app.chooseFromList(labelsOf(control), {
            withTitle: APP_NAME,
            withPrompt: control.prompt,
            defaultItems: [opening]
        });

        if (!choice) {
            throw new UserCanceled();
        }

        valueOfLabel(control, choice[0]);

        return choice[0];
    } catch (error) { throw hostError(error); }
}

/*
 * Retry an invalid answer with the submitted text still in the box. Replacing
 * it with the original default would discard the attempted correction and
 * could make an unaccepted number look approved.
 *
 * Put the problem in the same prompt as the answer. Keep native cancellation
 * outside the answer-validation catch so it ends the run instead of retrying.
 */
function dialogResponse(app, message, options) {
    try { return app.displayDialog(message, options); }
    catch (error) { throw hostError(error); }
}

function askUntil(app, question, read) {
    let answer = question.defaultAnswer;
    let problem = "";

    for (;;) {
        const response = dialogResponse(app,
            problem ? `${problem}\n\n${question.prompt}` : question.prompt,
            {
                withTitle: APP_NAME,
                defaultAnswer: answer,
                buttons: ["Cancel", "OK"],
                defaultButton: "OK",
                cancelButton: "Cancel"
            }
        );

        if (response.buttonReturned === "Cancel") {
            throw new UserCanceled();
        }

        answer = String(response.textReturned);

        try {
            return read(answer, question);
        } catch (error) {
            problem = errorMessage(error);
        }
    }
}

module.exports = { chooseRequired, askUntil };
