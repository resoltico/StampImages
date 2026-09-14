"use strict";

const { formSpec } = require("../core/form.js");
const { readAnswers } = require("../core/answers.js");
const { isUserCancelled, UserCancelled } = require("../core/errors.js");
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
 * One pass: present, and report what came back as either unusable, the
 * settings, or the answers to try again with.
 */
function formRound(bridge, present, state) {
    const outcome = present(
        bridge,
        formSpec(state.answers, state.problems, state.context)
    );

    if (!outcome) {
        return { unavailable: true };
    }

    if (outcome.cancelled) {
        throw new UserCancelled();
    }

    const read = readAnswers(outcome.answers, state.context.fonts);

    return read.settings
        ? { settings: read.settings }
        : { answers: outcome.answers, problems: read.problems };
}

/*
 * Redisplayed with the previous answers and every problem at once, so
 * correcting a mistyped size does not mean answering the other nine again.
 */
function collectViaForm(bridge, present, opening) {
    // Nothing wrong yet, and answers only if the last run left any. What an
    // absent set of answers shows is formSpec's to say: stating the defaults
    // again here would be a second copy of them, free to drift from the first.
    let state = { ...opening, problems: [] };

    for (;;) {
        const round = formRound(bridge, present, state);

        if (round.unavailable) {
            return null;
        }

        if (round.settings) {
            return round.settings;
        }

        state = { ...round, context: opening.context };
    }
}

/*
 * A cancellation is an answer and must be honoured. Anything else the form
 * throws is treated as the form being unusable, because falling back to
 * dialogs that work is better than failing the run over a widget.
 */
function attemptForm(bridge, present, opening) {
    try {
        return collectViaForm(bridge, present, opening);
    } catch (error) {
        if (isUserCancelled(error)) {
            throw error;
        }

        return null;
    }
}

/*
 * The opening state of both front ends: how many images were found, and the
 * answers to start from when the last run left some. They are the same
 * answers either way -- a form that cannot be shown must not also forget.
 */
function collectSettings(app, opening, injected) {
    const {
        bridge = appkitBridge(globalThis.ObjC, globalThis.$),
        present = presentForm
    } = injected;

    if (bridge) {
        const settings = attemptForm(bridge, present, opening);

        if (settings) {
            return settings;
        }
    }

    const { fonts } = opening.context;

    return collectDialogSettings(app, opening.answers ?? defaultAnswers(fonts), fonts);
}

module.exports = { collectViaForm, collectSettings };
