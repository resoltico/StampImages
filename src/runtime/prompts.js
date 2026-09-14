"use strict";

const { UserCancelled, errorMessage } = require("../core/errors.js");
const { APP_NAME } = require("../core/version.js");
const { labelsOf, valueOfLabel } = require("../core/choices.js");

/*
 * Asking one question at a time, where there is no form to ask six at once.
 *
 * Each takes what it should open on, so a run that remembers the last one
 * offers those answers back rather than the compiled defaults -- and a run
 * with nothing to remember passes nothing, and gets them.
 */

/*
 * Presents the labels and answers with the one chosen -- the label, not the
 * value behind it. What the caller is assembling is a set of answers, which is
 * what the controls of the form would be showing, and the whole set is read
 * into settings once at the end by the reader the form uses. Answering with
 * the value here put a value where a label belonged, and every choice was then
 * refused as not being one of the choices.
 *
 * Checked against the list it came from all the same: a host that answers
 * something that was never offered is a refusal at the question rather than a
 * puzzle ten questions later.
 */
function chooseRequired(app, control, opening) {
    const choice = app.chooseFromList(labelsOf(control), {
        withTitle: APP_NAME,
        withPrompt: control.prompt,
        defaultItems: [opening]
    });

    if (!choice) {
        throw new UserCancelled();
    }

    valueOfLabel(control, choice[0]);

    return choice[0];
}

/*
 * A question that will not take an answer it cannot use.
 *
 * What was typed comes back in the box. Asking again with the original
 * default in its place threw away the one thing the person had that the
 * program did not -- the value they were correcting -- and for a number it
 * put back a figure that looked as though it had been accepted.
 *
 * The reason goes into the prompt rather than into a dialog of its own, which
 * is what the form does with its problems: an answer and what is wrong with
 * it belong on one screen rather than on two in turn.
 *
 * displayDialog raises when the person cancels, and that call sits outside
 * the try deliberately: cancelling is a decision, not an unusable answer.
 */
function askUntil(app, question, read) {
    let answer = question.defaultAnswer;
    let problem = "";

    for (;;) {
        const response = app.displayDialog(
            problem ? `${problem}\n\n${question.prompt}` : question.prompt,
            {
                withTitle: APP_NAME,
                defaultAnswer: answer,
                buttons: ["Cancel", "OK"],
                defaultButton: "OK",
                cancelButton: "Cancel"
            }
        );

        answer = String(response.textReturned);

        try {
            return read(answer, question);
        } catch (error) {
            problem = errorMessage(error);
        }
    }
}

module.exports = { chooseRequired, askUntil };
