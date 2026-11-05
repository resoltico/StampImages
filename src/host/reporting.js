"use strict";
const { runOutcome } = require("../core/outcomes.js");
const { APP_NAME } = require("../core/version.js");
const { supportedFormatList } = require("../core/paths.js");
const { describe, detailOf, showCompletion } = require("./completion.js");
const { showDetails } = require("./details-dialog.js");
const { writeReceipt, exitCli } = require("./receipt.js");
function describeNothing(rejected) {
    return rejected.length ? rejected.map((entry) => `${entry.path || entry.name}: ${entry.reason}`).join("\n")
        : `Select ${supportedFormatList()} files or folders in Finder, then run the action again.`;
}
function reportNothing(app, headless, rejected) {
    const message = describeNothing(rejected);
    // The rejections are listed with the receipt already; the issue says only
    // what they add up to, so a terminal does not print each one twice.
    if (headless) { return runOutcome([], rejected, [], [{ code: "no-images", stage: "selection", message: rejected.length ? "None of the selected items can be stamped." : message }]); }
    showDetails(app, { title: APP_NAME, summary: rejected.length ? "Nothing to stamp." : "No photographs selected.", detail: message, buttons: ["OK"] });
    return undefined;
}
const INVALID_EXIT = 2;
const SETUP_EXIT = 3;
function exitCode(result) {
    if (result.state === "invalid") { return INVALID_EXIT; }
    if (result.issues.some((issue) => issue.stage === "setup")) { return SETUP_EXIT; }
    return result.state === "complete" ? 0 : 1;
}
function reportHeadless(result, write = writeReceipt, exit = exitCli) {
    write(`${JSON.stringify(result)}\n`);
    write(`${describe(result)}\n${detailOf(result)}\n`, undefined, true);
    return exit(exitCode(result));
}
function report(app, result, headless) {
    if (headless) { return result; }
    showCompletion(app, result);
    return undefined;
}
module.exports = { report, reportNothing, reportHeadless, exitCode, describe, detailOf, describeNothing };
