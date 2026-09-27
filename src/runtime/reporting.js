"use strict";

const { APP_NAME } = require("../core/version.js");
const { supportedFormatList } = require("../core/paths.js");
const { describe, detailOf } = require("./completion.js");
const {
    writeReceipt,
    ledgerOf,
    isCompleteSuccess,
    describeIncomplete
} = require("./receipt.js");

/*
 * What a run says when it is over.
 *
 * Two readers who cannot be told the same way. A person gets a sentence and
 * a dialog; a caller reading standard output gets the whole outcome as data,
 * including what was not stamped, because a receipt that listed only the
 * successes would describe a run that went perfectly.
 *
 * Every photograph that was asked for is in exactly one place in it. A count
 * that does not add up is a report that lost something.
 *
 * Only the second of those is a return value, and that is the whole of the
 * rule: a person has been told in a dialog, so there is nothing left to hand
 * back. Handing back the list of copies was not free -- a Quick Action's
 * result is the shortcut's result, and Shortcuts writes a text result out as
 * a file, named after the text with the slashes turned into colons. Measured
 * on a run of five: five files called ":Users:...:IMG_1538_stamped.txt"
 * appeared beside the photographs, each holding one path, each carrying
 * com.apple.shortcuts' own quarantine. What is given up is chaining this to
 * another action inside a shortcut, and litter in somebody's photographs is
 * the worse default.
 */

function notice(app, message) {
    app.displayDialog(message, {
        withTitle: APP_NAME,
        buttons: ["OK"],
        defaultButton: "OK"
    });
}

/*
 * Nothing to stamp, which is a different message depending on whether
 * anything was asked for. Selecting only a text file is not the same as
 * selecting nothing, and saying "no photographs selected" to somebody who
 * selected one is how a rejection becomes invisible.
 */
function describeNothing(rejected) {
    if (rejected.length === 0) {
        return "No photographs selected.\n\nSelect one or more " +
            `${supportedFormatList()} files in Finder, or a folder ` +
            "containing them, then run the action again.";
    }

    const reasons = rejected.map((entry) => `${entry.name}: ${entry.reason}`);

    return `Nothing to stamp.\n\n${reasons.join("\n")}`;
}

function reportNothing(app, headless, rejected) {
    if (headless) {
        throw new Error(describeNothing(rejected));
    }

    notice(app, describeNothing(rejected));
}

/*
 * A headless caller gets one thing back from osascript: the returned value on
 * success, the error on failure. An incomplete run has to be both, so the
 * receipt goes out on its own before the failure is raised -- newline
 * terminated, because a caller reads it a line at a time.
 *
 * The writer is a parameter so the line that is actually written can be read
 * back in a test; the default is the real one.
 */
function reportHeadless(result, write = writeReceipt) {
    const receipt = JSON.stringify({ ...result, ledger: ledgerOf(result) });

    if (isCompleteSuccess(result)) {
        return receipt;
    }

    write(`${receipt}\n`);

    throw new Error(describeIncomplete(result));
}

function report(app, result, headless) {
    if (headless) {
        return reportHeadless(result);
    }

    notice(app, `${describe(result)}${detailOf(result)}`);

    // Said out loud rather than fallen off the end of: nothing is the answer
    // here, and the host does something with an answer.
    return undefined;
}

module.exports = {
    report,
    reportNothing,
    reportHeadless,
    describe,
    describeNothing,
    detailOf
};
