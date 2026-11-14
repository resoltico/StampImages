"use strict";
const { APP_NAME, VERSION } = require("../../core/version.js");
const { summarizeRun } = require("../../core/run-summary.js");
const { headline, reportText } = require("../../core/run-report.js");
const { showDetails } = require("./details-dialog.js");
function completionMessage(result) {
    return [reportText(result, false), result.state === "invalid" ? "" : `${APP_NAME} ${VERSION}`].filter(Boolean).join("\n\n");
}
// Technical details use key: value lines; stacks stay in the receipt.
function diagnosticLines(value, label = "") {
    if (value === null || value === undefined) { return []; }
    if (typeof value !== "object") { return [`${label}${String(value).replace(/\r\n?/gu, "\n")}`]; }
    return Object.entries(value).filter(([key]) => key !== "stack").flatMap(([key, entry]) => diagnosticLines(entry, `${label}${key}: `));
}

function showCompletion(app, result) {
    const paths = result.images.flatMap((image) => image.output || image.recovery ? [image.output ?? image.recovery] : []);
    const diagnostics = [...result.diagnostics, ...result.issues, ...result.rejected, ...result.images.flatMap((image) => [...image.issues, ...(image.diagnostics ?? [])])];
    const technical = diagnostics.filter((issue) => issue.diagnostic || issue.stack || issue.code === "observer-fault");
    const buttons = ["OK", ...paths.length ? ["Show in Finder"] : [], ...technical.length ? ["Details"] : []];
    // Details is a detour, not an ending: reading it must not take away Show
    // in Finder, so the summary comes back until it is dismissed another way.
    for (;;) {
        const response = showDetails(app, { title: APP_NAME, summary: headline(summarizeRun(result)), detail: completionMessage(result), fallbackDetail: `${headline(summarizeRun(result))}\n\n${completionMessage(result)}`, buttons });
        if (buttons[response] !== "Details") {
            if (buttons[response] === "Show in Finder") {
                ObjC.import("AppKit");
                $.NSWorkspace.sharedWorkspace.activateFileViewerSelectingURLs($(paths.map((path) => $.NSURL.fileURLWithPath(path))));
            }
            return;
        }
        showDetails(app, { title: APP_NAME, summary: "Technical details (selectable and copyable)", detail: technical.flatMap((issue) => diagnosticLines(issue)).join("\n"), buttons: ["Back"] });
    }
}
module.exports = { completionMessage, diagnosticLines, showCompletion };
