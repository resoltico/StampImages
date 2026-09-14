"use strict";

const { DOMAIN, KEY } = require("../core/preferences.js");

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
            } catch {
                // The next run opens on the defaults, which is what it did
                // before there was anything to remember.
            }
        }
    };
}

/*
 * A memory with nowhere to keep anything, which is what every way of failing
 * to reach the defaults comes back as.
 *
 * Not null. A caller given nothing has to remember to ask whether it got
 * something, at every place it uses it, and forgetting once put a null where
 * a set of answers belonged -- which the form could not read, so a machine
 * that merely could not save its settings was answering ten questions one at
 * a time instead. Being unable to remember is a way of behaving, and it says
 * what this policy has said all along: recall nothing, keep nothing, and let
 * the stamping get on with it.
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
