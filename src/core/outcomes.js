"use strict";
const { OperationError, errorMessage, commandOf, isUserCanceled, causes } = require("./errors.js");
const ISSUE = Object.freeze({ operation: "operation", fault: "fault", canceled: "canceled", cleanup: "cleanup", publication: "publication", recovery: "recovery" });
function readableIssues(error, stage) {
    if (Array.isArray(error?.issues) && error.issues.length) { return error.issues; }
    const fault = causes(error).some((cause) => cause instanceof TypeError || cause instanceof ReferenceError);
    let code = ISSUE.fault;
    if (isUserCanceled(error)) { code = ISSUE.canceled; }
    else if (error instanceof OperationError && !fault) { code = ISSUE.operation; }
    return [{ code, stage, message: errorMessage(error), diagnostic: { command: commandOf(error), stack: error?.stack ?? "" } }];
}
function issuesOf(error, stage) {
    try { return readableIssues(error, stage); }
    catch { return [{ code: ISSUE.fault, stage, message: "The failure details could not be read." }]; }
}
function runOutcome(images = [], rejected = [], excluded = [], issues = []) {
    const stopped = issues.some((issue) => issue.code === ISSUE.canceled) || images.some((image) => image.state === "canceled" || image.issues.some((issue) => issue.code === ISSUE.canceled));
    const incomplete = images.length === 0 || rejected.length > 0 || issues.length > 0 || images.some((image) => image.state !== "saved" || image.issues.length > 0 || image.missingMetadata?.length > 0);
    let state = incomplete ? "incomplete" : "complete";
    if (stopped && incomplete) { state = "canceled"; }
    return { state, images, rejected, excluded, issues, diagnostics: [] };
}
function ledgerOf(result) {
    const count = (state) => result.images.filter((image) => image.state === state).length;
    return { saved: count("saved"), recovered: count("recovered"), failed: count("failed"), nothing: count("nothing-to-stamp"), canceled: count("canceled"), notStarted: count("not-started"), rejected: result.rejected.length };
}
module.exports = { ISSUE, issuesOf, runOutcome, ledgerOf };
