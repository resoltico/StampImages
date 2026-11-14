"use strict";
const { noImagesOutcome } = require("../core/outcomes.js");
const { APP_NAME } = require("../core/version.js");
const { showCompletion } = require("./completion.js");
const { reportText, noImagesHeadline, describeNoImages } = require("../core/run-report.js");
const { showDetails } = require("./details-dialog.js");
const { writeReceipt, exitCli } = require("./receipt.js");
function reportNothing(app, headless, rejected) {
    if (headless) { return noImagesOutcome(rejected); }
    showDetails(app, { title: APP_NAME, summary: noImagesHeadline(rejected), detail: describeNoImages(rejected, false), buttons: ["OK"] });
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
    write(`${reportText(result)}\n`, undefined, true);
    return exit(exitCode(result));
}
function report(app, result, headless) {
    if (headless) { return result; }
    showCompletion(app, result);
    return undefined;
}
module.exports = { report, reportNothing, reportHeadless, exitCode };
