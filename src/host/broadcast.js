"use strict";
const { hostError } = require("./cancellation.js");
const { isUserCanceled } = require("../core/errors.js");

/*
 * Saying one thing to every surface there is.
 */

/*
 * Every surface gets every report, and one that refuses does not stop the
 * others: they are presented by different hosts, not by one host twice.
 *
 * A surface can report two things by throwing and only one is about the
 * surface. "I could not show this" is not news. "The person asked you to
 * stop" is not about the display at all -- that is merely where it arrived --
 * and it used to be discarded along with it.
 */
function broadcast(sinks, state) {
    const failed = new Set();
    return (use) => {
        for (const sink of sinks.filter((item) => !failed.has(item))) {
            try {
                use(sink);
            } catch (caught) {
                const error = hostError(caught);
                /*
                 * Recorded rather than thrown on: letting it out would unwind
                 * the run from wherever the report was made, and one of those
                 * places is the middle of a publication, which owns a finished
                 * copy and a name it has claimed. The loop asks between
                 * photographs, where stopping is safe.
                 */
                if (isUserCanceled(error)) { state.stopped = true; }
                else { failed.add(sink); state.diagnostics?.push({ code: "observer-fault", message: String(error), stack: error?.stack ?? "" }); }
            }
        }
    };
}

module.exports = { broadcast };
