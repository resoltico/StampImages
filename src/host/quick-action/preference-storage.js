"use strict";
const { DOMAIN, KEY } = require("./preferences.js");

// The 1.2.0 record's key. It is never read: that release's record opens defaults.
const RETIRED_KEY = "lastSettings.v1";

/*
 * Where the record is kept: a defaults domain of this action's own.
 *
 * Not the standard defaults. "Standard" means the defaults of the application
 * that is running, and the application running a pasted script is Apple's
 * Shortcuts helper -- so writing there would put this action's settings in
 * somebody else's domain, alongside whatever every other script in that
 * helper had left behind. A named suite is addressed by name and belongs to
 * nothing else.
 *
 * Which is also why there is no fallback to the standard defaults when the
 * suite cannot be made. There is no second-best place to put this: a run that
 * cannot remember opens on the compiled defaults, stamps the photographs, and
 * says nothing about it. Nobody's copy depends on it.
 *
 * Whether a named suite is writable inside the Shortcuts helper is not
 * something anything headless can establish -- QA.md says how it is checked
 * and what the check has to cover.
 */

/*
 * Whether the bridge handed back an object or nothing.
 *
 * A wrapped Objective-C nil is a JavaScript object, and a truthy one: asking
 * `if (suite)` about it is answered yes, and the first message sent to it
 * fails. It is asked whether it is nil instead -- defensively, because a
 * plain value has no such question to answer.
 */
function present(value) {
    if (!value) {
        return false;
    }

    return typeof value.isNil !== "function" || !value.isNil();
}

function memoryOn(objc, ns, suite) {
    return {
        // Nothing there and nothing readable are the same answer -- and on a
        // first run there is nothing there, which comes back as a wrapped nil
        // rather than as a missing value.
        recall() {
            try {
                const held = suite.stringForKey(ns(KEY));

                return present(held) ? String(objc.unwrap(held)) : "";
            } catch {
                return "";
            }
        },

        // Best effort, and deliberately silent: a preference that would not
        // stick is not a failure of the run, and the completion
        // message is about the photographs.
        remember(text) {
            try {
                suite.setObjectForKey(ns(text), ns(KEY));
                // 1.2.0 kept its record under another key, which nothing reads
                // now; it is removed rather than left in the domain for good.
                suite.removeObjectForKey(ns(RETIRED_KEY));
            } catch {
                // Preference failures must not interrupt stamping.
            }
        }
    };
}

/*
 * Unavailable preferences still implement recall and remember. Callers can
 * proceed with defaults through the same interface, without treating missing
 * storage as a reason to abandon the settings form.
 */
const FORGETFUL = Object.freeze({
    recall() {
        return "";
    },
    remember() {
        return undefined;
    }
});

/*
 * Everything the bridge is asked to do is inside the attempt, not only the
 * import: a suite that cannot be made is documented to come back as nothing,
 * and one that raises instead must not take the run down with it.
 */
function createMemory(objc, ns) {
    if (!objc || !ns) {
        return FORGETFUL;
    }

    try {
        objc.import("Foundation");

        const suite = ns.NSUserDefaults.alloc.initWithSuiteName(ns(DOMAIN));

        return present(suite) ? memoryOn(objc, ns, suite) : FORGETFUL;
    } catch {
        return FORGETFUL;
    }
}

module.exports = { createMemory };
