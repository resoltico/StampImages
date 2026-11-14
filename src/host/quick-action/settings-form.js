"use strict";
const { resolveStampSettings } = require("../stamp-settings.js");
const { catalog } = require("../typefaces.js");
const { availableFonts } = require("./fonts.js");
const { confirmSelection } = require("./settings-review.js");
const { encode, rememberedAnswers } = require("./preferences.js");
const { createMemory } = require("./preference-storage.js");
const { formSpec } = require("./form.js");
const { readAnswers } = require("./settings-model.js");
const { stampIssues } = require("../../core/settings.js");
const { UserCanceled, OperationError } = require("../../core/errors.js");
const { presentForm } = require("./appkit.js");
const { appkitBridge } = require("./appkit-bridge.js");
const { collectDialogSettings } = require("./dialogs.js");
const { defaultAnswers } = require("./settings-model.js");

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
function confirmedSettings(state, outcome, read) {
    const values = read.settings ?? read.values;
    const problems = [...read.problems ?? []];
    if (values.font !== undefined && !state.context.known) { throw new OperationError("A typeface catalog is required before choosing a face."); }
    problems.push(...stampIssues(values, state.context.known).map((issue) => ({ key: issue.field, message: issue.message })));
    return problems.length > 0 ? { answers: outcome.answers, problems } : { settings: read.settings };
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

    if (outcome.canceled) {
        throw new UserCanceled();
    }

    const read = readAnswers(outcome.answers, state.context.fonts);

    return confirmedSettings(state, outcome, read);
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
        const round = formRound(bridge, present, state);

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

function defaultMemory() { return createMemory(globalThis.ObjC, globalThis.$); }

function chooseSettings(app, context, injected = {}) {
    const { known = catalog(), openMemory = defaultMemory } = injected;
    if (!known) { throw new OperationError("Installed typefaces could not be verified on this Mac."); }
    const asking = { ...context, known, fonts: availableFonts(known) };
    confirmSelection(app, asking);
    const memory = openMemory();
    const opening = { context: asking, answers: rememberedAnswers(memory.recall(), asking.fonts) };
    const resolved = resolveStampSettings(collectSettings(app, opening, injected), known);
    // Remember confirmed appearance before processing; custom text remains private to this run.
    memory.remember(encode(resolved.settings));
    return resolved;
}

module.exports = { collectViaForm, collectSettings, chooseSettings };
