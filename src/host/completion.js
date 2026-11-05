"use strict";
const { APP_NAME } = require("../core/version.js");
const { ledgerOf } = require("../core/outcomes.js");
const { plural } = require("../core/numbers.js");
const { showDetails } = require("./details-dialog.js");
function describe(result) {
    const counts = ledgerOf(result);
    if (result.state === "invalid") { return "The request is invalid."; }
    let prefix = "";
    if (result.state === "cancelled") { prefix = "Stopped. "; }
    else if (result.state === "incomplete") { prefix = "Finished with issues. "; }
    return `${prefix}${counts.saved ? `Created ${plural(counts.saved, "stamped copy", "stamped copies")}.` : "No stamped copy was created."}`;
}
function outcomeSummary(result) {
    const counts = ledgerOf(result);
    const labels = { saved: "saved", recovered: "recovered", failed: "failed", nothing: "with nothing to stamp", cancelled: "cancelled", notStarted: "not started", rejected: "not included" };
    const parts = Object.entries(labels).filter(([key]) => counts[key] > 0).map(([key, label]) => `${counts[key]} ${label}`);
    const missing = result.images.filter((image) => ["saved", "recovered"].includes(image.state) && image.missingMetadata?.length > 0).length;
    if (missing > 0) { parts.push(`${plural(missing, "copy", "copies")} missing requested metadata`); }
    return parts.length ? `${parts.join("; ")}.` : "0 saved.";
}
function detailOf(result) {
    const sections = [outcomeSummary(result)];
    for (const image of result.images) {
        const destination = image.output ?? image.recovery;
        sections.push(`${image.source}\n${image.state}${destination ? `: ${destination}` : ""}${image.reason ? `: ${image.reason}` : ""}`);
        sections.push(...image.issues.map((issue) => issue.message));
        if (image.missingMetadata?.length) { sections.push(`Missing requested metadata: ${image.missingMetadata.join(", ")}.`); }
        if (image.crowded) { sections.push("The stamp does not fit within the requested margins."); }
        if (image.expanded) { sections.push("Written in colour to preserve the caption colour."); }
        if (image.unconverted) { sections.push("The caption colour could not be converted to the photograph's profile."); }
    }
    sections.push(...result.rejected.map((entry) => `${entry.path || entry.name}: ${entry.reason}`));
    sections.push(...result.issues.map((issue) => `${issue.message}${issue.diagnostic?.path ? `\n${issue.diagnostic.path}` : ""}`));
    if (result.excluded.length) { sections.push(`Left alone: ${result.excluded.length} stamped copies from an earlier run.`); }
    return sections.join("\n\n");
}
const JSON_INDENT = 2;
function showCompletion(app, result) {
    const paths = result.images.flatMap((image) => image.output || image.recovery ? [image.output ?? image.recovery] : []);
    const diagnostics = [...result.diagnostics, ...result.issues, ...result.images.flatMap((image) => [...image.issues, ...(image.diagnostics ?? [])])];
    const technical = diagnostics.filter((issue) => issue.diagnostic || issue.stack || issue.code === "observer-fault");
    const buttons = ["OK", ...paths.length ? ["Show in Finder"] : [], ...technical.length ? ["Details"] : []];
    const response = showDetails(app, { title: APP_NAME, summary: describe(result), detail: detailOf(result), fallbackDetail: `${describe(result)}\n\n${detailOf(result)}`, buttons });
    if (buttons[response] === "Show in Finder") {
        ObjC.import("AppKit");
        $.NSWorkspace.sharedWorkspace.activateFileViewerSelectingURLs($(paths.map((path) => $.NSURL.fileURLWithPath(path))));
    }
    if (buttons[response] === "Details") { showDetails(app, { title: APP_NAME, summary: "Technical details (selectable and copyable)", detail: JSON.stringify(technical, null, JSON_INDENT), buttons: ["OK"] }); }
}
module.exports = { describe, detailOf, showCompletion };
