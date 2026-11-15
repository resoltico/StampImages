"use strict";
const { APP_NAME, VERSION } = require("../../core/version.js");
const { summarizeRun } = require("../../core/run-summary.js");
const { headline, reportText } = require("../../core/run-report.js");
const { showDetails } = require("./details-dialog.js");
function completionMessage(result) {
    return [reportText(result, false), result.state === "invalid" ? "" : `${APP_NAME} ${VERSION}`].filter(Boolean).join("\n\n");
}
// Render structured diagnostics without stack text or empty values.
function diagnosticLines(value, label = "") {
    if (value === null || value === undefined || (typeof value === "string" && value.trim() === "")) { return []; }
    if (typeof value !== "object") { return [`${label}${String(value).replace(/\r\n?/gu, "\n")}`]; }
    return Object.entries(value).filter(([key]) => key !== "stack").flatMap(([key, entry]) => diagnosticLines(entry, `${label}${key}: `));
}

function hasDiagnostic(entry) {
    return entry?.code !== "canceled" || Object.entries(entry).some(([key, value]) =>
        !["code", "stage", "stack"].includes(key) && diagnosticLines(value).length > 0);
}

function showCompletion(app, result) {
    const paths = result.images.flatMap((image) => image.output || image.recovery ? [image.output ?? image.recovery] : []);
    const issues = [...result.issues, ...result.rejected, ...result.images.flatMap((image) => image.issues)];
    const diagnostics = [...result.diagnostics, ...result.images.flatMap((image) => image.diagnostics ?? []),
        ...issues.flatMap((issue) => issue.diagnostic ? [{ code: issue.code, stage: issue.stage, ...issue.diagnostic }] : [])];
    const technical = diagnostics.filter(hasDiagnostic).flatMap((entry) => diagnosticLines(entry)).join("\n");
    const buttons = ["OK", ...paths.length ? ["Show in Finder"] : [], ...technical ? ["Details"] : []];
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
        showDetails(app, { title: APP_NAME, summary: "Technical details (selectable and copyable)", detail: technical, buttons: ["Back"] });
    }
}
module.exports = { completionMessage, diagnosticLines, showCompletion };
