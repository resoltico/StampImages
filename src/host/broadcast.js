"use strict";
const { hostError } = require("./cancellation.js");
const { isUserCanceled } = require("../core/errors.js");

/*
 * Saying one thing to every surface there is.
 */

/*
 * Deliver reports to every surface even if one fails. Display faults become
 * diagnostics; a translated cancellation latches a stop for the next safe
 * checkpoint rather than interrupting publication.
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
                 * Latch cancellation instead of unwinding the reporting call. A report may
                 * occur during publication while the run owns a finished copy and a claimed
                 * name; the next safe image-stage checkpoint handles the pending stop.
                 */
                if (isUserCanceled(error)) { state.stopped = true; }
                else { failed.add(sink); state.diagnostics?.push({ code: "observer-fault", message: String(error), stack: error?.stack ?? "" }); }
            }
        }
    };
}

module.exports = { broadcast };
