"use strict";
const { APP_NAME } = require("../core/version.js");
const { ledgerOf } = require("../core/outcomes.js");
const { plural } = require("../core/numbers.js");
const { showDetails } = require("./details-dialog.js");
/*
 * A recovered copy exists, just not where it was meant to go, so a headline
 * that counted only saved copies said "No stamped copy was created" about a
 * run that had made one.
 */
function madeSentence(counts) {
    const saved = counts.saved ? `Created ${plural(counts.saved, "stamped copy", "stamped copies")}.` : "";
    const recovered = counts.recovered
        ? `${plural(counts.recovered, "copy", "copies")} could not be saved beside ${counts.recovered === 1 ? "its original" : "their originals"} and ${counts.recovered === 1 ? "was" : "were"} kept elsewhere; the location is below.`
        : "";
    return [saved, recovered].filter(Boolean).join(" ") || "No stamped copy was created.";
}
function describe(result) {
    if (result.state === "invalid") { return "The request is invalid."; }
    let prefix = "";
    if (result.state === "cancelled") { prefix = "Stopped. "; }
    else if (result.state === "incomplete") { prefix = "Finished with issues. "; }
    return `${prefix}${madeSentence(ledgerOf(result))}`;
}
// Why a copy could not be published, in the words of what the folder refused.
const PUBLICATION_REASONS = {
    denied: "Its folder cannot be written (permission denied).",
    "cross-device": "Its folder is on a volume that could not take the finished copy.",
    unsupported: "Its folder's filesystem does not support saving the copy safely."
};
function issueLines(issue) {
    const reason = issue.code === "publication" ? PUBLICATION_REASONS[issue.diagnostic?.state] : undefined;
    return [reason ? `${issue.message} ${reason}` : issue.message];
}
function outcomeSummary(result) {
    if (result.state === "invalid") { return ""; }
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
        sections.push(...image.issues.flatMap(issueLines));
        if (image.missingMetadata?.length && image.state !== "nothing-to-stamp") { sections.push(`Missing requested metadata: ${image.missingMetadata.join(", ")}.`); }
        if (image.invalidMetadata?.length && image.state !== "nothing-to-stamp") { sections.push(`Recorded but not valid, so left off: ${image.invalidMetadata.join(", ")}.`); }
        if (image.crowded) { sections.push("The margin is larger than this photograph has room for, so the stamp was placed against the opposite edge."); }
        if (image.expanded) { sections.push("Written in colour to preserve the caption colour."); }
        if (image.substituted) { sections.push("Some characters are not in the chosen typeface and were drawn in another one."); }
        if (image.unconverted) { sections.push("The caption colour could not be converted to the photograph's profile."); }
    }
    sections.push(...result.rejected.map((entry) => `${entry.path || entry.name}: ${entry.reason}`));
    sections.push(...result.issues.map((issue) => `${issue.message}${issue.diagnostic?.path ? `\n${issue.diagnostic.path}` : ""}`));
    if (result.excluded.length) { sections.push(`Left alone: ${plural(result.excluded.length, "stamped copy", "stamped copies")} from an earlier run.`); }
    return sections.filter(Boolean).join("\n\n");
}
const JSON_INDENT = 2;
function showCompletion(app, result) {
    const paths = result.images.flatMap((image) => image.output || image.recovery ? [image.output ?? image.recovery] : []);
    const diagnostics = [...result.diagnostics, ...result.issues, ...result.images.flatMap((image) => [...image.issues, ...(image.diagnostics ?? [])])];
    const technical = diagnostics.filter((issue) => issue.diagnostic || issue.stack || issue.code === "observer-fault");
    const buttons = ["OK", ...paths.length ? ["Show in Finder"] : [], ...technical.length ? ["Details"] : []];
    // Details is a detour, not an ending: reading it must not take away Show
    // in Finder, so the summary comes back until it is dismissed another way.
    for (;;) {
        const response = showDetails(app, { title: APP_NAME, summary: describe(result), detail: detailOf(result), fallbackDetail: `${describe(result)}\n\n${detailOf(result)}`, buttons });
        if (buttons[response] !== "Details") {
            if (buttons[response] === "Show in Finder") {
                ObjC.import("AppKit");
                $.NSWorkspace.sharedWorkspace.activateFileViewerSelectingURLs($(paths.map((path) => $.NSURL.fileURLWithPath(path))));
            }
            return;
        }
        showDetails(app, { title: APP_NAME, summary: "Technical details (selectable and copyable)", detail: JSON.stringify(technical, null, JSON_INDENT), buttons: ["Back"] });
    }
}
module.exports = { describe, detailOf, showCompletion };
