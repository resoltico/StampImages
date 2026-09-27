"use strict";

const { normalizeSettings } = require("../core/settings.js");
const { requireStampContent } = require("../core/stamp-content.js");
const { confirmSelection } = require("./settings-review.js");
const { encode, rememberedAnswers } = require("../core/preferences.js");
const { resolved } = require("../core/typeface-refusal.js");
const { createMemory } = require("./preferences.js");
const { collectSettings } = require("./settings-form.js");

/*
 * Which settings a run uses, and which runs remember.
 */

function defaultMemory() {
    return createMemory(globalThis.ObjC, globalThis.$);
}

/*
 * A configuration file is the whole of what a headless run is told, and it
 * has to mean the same thing every time it is used. So nothing is read from
 * the last run and nothing is written for the next -- and nothing is even
 * opened: the memory arrives as something to open rather than something
 * already open, and this branch returns before it can be.
 *
 * Which branch is taken is what the invocation says it is, never what the
 * settings look like. Reading it off them -- "there are none, so somebody
 * must be here to ask" -- is a guess, and a configuration file holding
 * `false` or `0` got it wrong: a headless run opened a dialog and waited for
 * an answer nobody was there to give.
 */
/*
 * A configuration names its own typeface and nothing has offered it a list, so
 * this is the only thing that stands between a name and the renderer -- and
 * pango answers every name, so a file asking for a face this Mac does not have
 * stamped the photograph in a default one and reported a complete success.
 *
 * Refused rather than repaired: choosing the substitute here rather than
 * letting pango choose it is the same silence with better manners.
 *
 * It is the same call the form makes, on settings that arrived the same way,
 * so a name a headless run may use is exactly a name somebody may type. That
 * was not true before: the form resolved a typed name and a configuration file
 * went through a different door.
 */
function drawableSettings(settings, context) {
    requireStampContent(settings);

    const answer = resolved(context.known, settings.font);

    if (answer.problem) {
        throw new Error(answer.problem);
    }

    return { ...settings, typeface: answer.typeface };
}

function settingsFor(app, invocation, context, injected = {}) {
    if (invocation.headless) {
        return drawableSettings(normalizeSettings(invocation.settings), context);
    }

    confirmSelection(app, context);

    const { openMemory = defaultMemory } = injected;
    const memory = openMemory();
    const opening = {
        context,
        answers: rememberedAnswers(memory.recall(), context.fonts)
    };
    const settings = drawableSettings(
        normalizeSettings(collectSettings(app, opening, injected)),
        context
    );

    /*
     * Confirmed and valid, and before a photograph is touched: a preference
     * is not made wrong by a picture that fails to stamp later. What is kept
     * is the appearance and not the words -- the text somebody typed is about
     * this job, and is the field most likely to say something private.
     */
    memory.remember(encode(settings));

    return settings;
}


module.exports = { settingsFor };
