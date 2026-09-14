"use strict";

const { UserCancelled } = require("../core/errors.js");

/*
 * What the run says about the photograph in hand, and where saying it may
 * stop the run. How many there are and where any of it is displayed is
 * progress.js.
 *
 * Saying what is about to happen is where a stop takes effect, and there is no
 * list of such places to keep right: they are wherever the code says what it
 * is about to do. Nothing has been done yet at any of them, so nothing is lost
 * by not doing it, and a stage added later becomes a checkpoint by writing the
 * line that makes it visible.
 *
 * This replaced a list. "Between photographs" bounded a stop by a whole
 * photograph -- a 24-megapixel HEIC goes through half a dozen vips stages --
 * and had to be argued for again at every stage anybody added.
 *
 * Afterwards rather than before, which is not a detail: a host raises at the
 * call following the button, so the report that discovers a stop is the one
 * being made, and checking first would miss it.
 */
function reporting(state, say, stopped) {
    const announce = (text) => {
        state.description = text;
        say();

        if (stopped()) {
            throw new UserCancelled();
        }
    };

    return {
        beginning(index, originalName) {
            // A name is a line of the description, so it is kept to one.
            const name = String(originalName).replace(/\s+/gu, " ");

            state.detail = `${index} of ${state.images} — ${name}`;
            announce("Reading the photograph");
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

module.exports = { reporting };
