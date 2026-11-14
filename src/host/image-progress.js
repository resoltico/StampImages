"use strict";
const { UserCanceled } = require("../core/errors.js");

/*
 * Announce each image stage before testing for a pending stop. Hosts can
 * deliver cancellation during the announcement itself, so checking first would
 * miss it. Each stage announcement is a checkpoint; no separate checkpoint
 * list needs to track the pipeline.
 */
function imageProgress(state, say, stopped) {
    const announce = (text) => {
        state.description = text;
        say();

        if (stopped()) {
            throw new UserCanceled();
        }
    };

    return {
        beginning(index, originalName) {
            // A name is a line of the description, so it is kept to one.
            const name = String(originalName).replace(/\s+/gu, " ");

            state.detail = `${index} of ${state.images} — ${name}`;
            announce("Reading the image");
        },

        phase: announce,

        // What has happened, and the one report that may not stop the run:
        // unwinding past finished work throws away the account of it.
        finished(text) {
            state.done += 1;
            state.description = text;
            say();
        }
    };
}

module.exports = { imageProgress };
