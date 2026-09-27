"use strict";

const { formSpec } = require("../core/form.js");
const { readAnswers } = require("../core/answers.js");
const { contentProblem } = require("../core/stamp-content.js");
const { isUserCancelled, UserCancelled } = require("../core/errors.js");
const { resolved } = require("../core/typeface-refusal.js");
const { presentForm } = require("./appkit.js");
const { appkitBridge } = require("./appkit-bridge.js");
const { collectDialogSettings } = require("./dialogs.js");
const { defaultAnswers } = require("../core/form-defaults.js");

/*
 * Which front end asks for the settings.
 *
 * The AppKit form is preferred and the stepwise dialogs are the fallback,
 * because a host that can present neither is a host this cannot ask anything
 * -- and falling back to ten questions is better than failing a run over a
 * widget. What has been measured about each is in QA.md.
 */

/*
 * The answers this layer cannot read for itself, because each depends on more
 * than one row or on the machine: that the stamp says something at all, and
 * that the typeface names a face this Mac has. Each comes back as the same kind
 * of problem a number out of range does: the field marked, the sentence at the
 * top, and everything else still typed.
 *
 * What the name turned out to mean is not taken from here. This is the loop
 * that decides whether to ask again, and it asks only that; the run resolves
 * the name it accepts, once, in settings-run.js.
 */
function confirmedSettings(state, outcome, settings) {
    const empty = contentProblem(settings);
    const answer = resolved(state.context.known, settings.font);
    const problem = empty ?? (answer.problem
        ? { key: "font", message: answer.problem }
        : null);

    return problem
        ? { answers: outcome.answers, problems: [problem] }
        : { settings };
}

/*
 * One pass: present, and report what came back as either unusable, the
 * settings, or the answers to try again with.
 */
function formRound(bridge, present, state) {
    const outcome = present(bridge, formSpec(state.answers, state.problems, state.context));

    if (!outcome) {
        return { unavailable: true };
    }

    if (outcome.cancelled) {
        throw new UserCancelled();
    }

    const read = readAnswers(outcome.answers, state.context.fonts);

    return read.settings
        ? confirmedSettings(state, outcome, read.settings)
        : { answers: outcome.answers, problems: read.problems };
}

/*
 * A cancellation is an answer and must be honoured. Anything else the form
 * throws is treated as the form being unusable, because falling back to
 * dialogs that work is better than failing the run over a widget.
 */
function availableRound(bridge, present, state) {
    try {
        return formRound(bridge, present, state);
    } catch (error) {
        if (isUserCancelled(error)) {
            throw error;
        }

        return { unavailable: true };
    }
}

/*
 * Redisplayed with the previous answers and every problem at once, so
 * correcting a mistyped size does not mean answering the other nine again.
 * A form that stops working part way hands the dialogs the answers last
 * submitted, not the ones it opened with: corrections already made are not
 * asked for twice. Edits never submitted are lost with the widget.
 */
function collectViaForm(bridge, present, opening) {
    let state = {
        ...opening,
        answers: opening.answers ?? defaultAnswers(opening.context.fonts),
        problems: []
    };

    for (;;) {
        const round = availableRound(bridge, present, state);

        if (round.unavailable) {
            return { answers: state.answers };
        }

        if (round.settings) {
            return round;
        }

        state = { ...round, context: opening.context };
    }
}

/*
 * The opening state of both front ends: what was selected, and the answers
 * to start from when the last run left some. They are the same answers either
 * way -- a form that cannot be shown must not also forget.
 */
function collectSettings(app, opening, injected) {
    const {
        bridge = appkitBridge(globalThis.ObjC, globalThis.$),
        present = presentForm
    } = injected;
    const result = bridge ? collectViaForm(bridge, present, opening) : opening;

    return result.settings ?? collectDialogSettings(
        app,
        result.answers ?? defaultAnswers(opening.context.fonts),
        opening.context
    );
}

module.exports = { collectViaForm, collectSettings };
