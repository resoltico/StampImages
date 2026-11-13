"use strict";
const { APP_NAME, VERSION } = require("../core/version.js");
const { basename, dirname } = require("../core/paths.js");
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
        ? `${plural(counts.recovered, "copy", "copies")} could not be saved where ${counts.recovered === 1 ? "it was" : "they were"} meant to go and ${counts.recovered === 1 ? "was" : "were"} kept elsewhere; the location is below.`
        : "";
    return [saved, recovered].filter(Boolean).join(" ") || "No stamped copy was created.";
}
/*
 * Items the person already agreed to leave out in the selection review do not
 * make a finished run read as one with issues; Image Files to PDF headlines
 * consented refusals the same way. The receipt state stays incomplete.
 */
function onlyRefusals(result) {
    return result.rejected.length > 0 && result.issues.length === 0 && result.images.length > 0 &&
        result.images.every((image) => image.state === "saved" && image.issues.length === 0 && !image.missingMetadata?.length);
}
function describe(result) {
    if (result.state === "invalid") { return "The request is invalid."; }
    if (result.images.length === 0 && result.issues.some((issue) => issue.code === "no-images")) { return "Nothing to stamp."; }
    let prefix = "";
    if (result.state === "canceled") { prefix = "Stopped. "; }
    else if (result.state === "incomplete" && !onlyRefusals(result)) { prefix = "Finished with issues. "; }
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
    const labels = { saved: "saved", recovered: "recovered", failed: "failed", nothing: "with nothing to stamp", canceled: "canceled", notStarted: "not started", rejected: "not included" };
    const parts = Object.entries(labels).filter(([key]) => counts[key] > 0).map(([key, label]) => `${counts[key]} ${label}`);
    const missing = result.images.filter((image) => ["saved", "recovered"].includes(image.state) && image.missingMetadata?.length > 0).length;
    if (missing > 0) { parts.push(`${plural(missing, "copy", "copies")} missing requested metadata`); }
    return parts.length ? `${parts.join("; ")}.` : "";
}
// What a person may want to know about one finished copy, beyond where it is.
function notesOf(image) {
    return [
        image.missingMetadata?.length ? `Missing requested metadata: ${image.missingMetadata.join(", ")}.` : "",
        image.invalidMetadata?.length ? `Recorded but not valid, so left off: ${image.invalidMetadata.join(", ")}.` : "",
        image.crowded ? "The margin is larger than this image has room for, so the stamp was placed against the opposite edge." : "",
        image.expanded ? "Written in color to preserve the caption color." : "",
        image.substituted ? "Some characters are not in the chosen typeface and were drawn in another one." : "",
        image.unconverted ? "The caption color could not be converted to the image's color profile." : ""
    ].filter(Boolean);
}

function section(heading, lines) {
    return lines.length > 0 ? `${heading}\n${lines.join("\n")}` : "";
}

// Saved copies by folder, the folder once and then its file names, as Image Files to PDF lists its PDFs.
function savedTo(images) {
    const folders = new Map();
    for (const image of images.filter((each) => each.state === "saved")) {
        const folder = dirname(image.output);
        folders.set(folder, [...folders.get(folder) ?? [], basename(image.output)]);
    }
    return [...folders].map(([folder, names]) => `${folder}\n${names.join("\n")}`).join("\n\n");
}

/*
 * The detail under the headline, in the order Image Files to PDF uses: the
 * counts, where the copies are, what to know about them, what went wrong,
 * what was left out, and which version said so.
 */
function detailOf(result, { commandLine = false } = {}) {
    const { images } = result;
    const finished = images.filter((image) => ["saved", "recovered"].includes(image.state));
    const notStarted = images.filter((image) => image.state === "not-started").length;
    const saved = savedTo(images);
    return [
        outcomeSummary(result),
        saved ? `Saved to:\n${saved}` : "",
        section("Notes:", finished.flatMap((image) => notesOf(image).map((note) => `${basename(image.output ?? image.source)}: ${note}`))),
        section("Nothing to stamp:", images.filter((image) => image.state === "nothing-to-stamp").map((image) => `${image.source}: ${image.reason}`)),
        section("Could not stamp:", images.filter((image) => ["failed", "canceled"].includes(image.state))
            .map((image) => `${image.source}: ${image.issues.flatMap(issueLines).join(" ") || image.state}`)),
        section("Recovered copies:", images.filter((image) => image.state === "recovered")
            .map((image) => `${image.recovery}\n${[image.source, ...image.issues.flatMap(issueLines)].join("\n")}`)),
        notStarted > 0 ? `Not started: ${notStarted}` : "",
        section("Not included from your selection:", result.rejected.map((entry) => `${entry.path || entry.name}: ${entry.reason}`)),
        // The no-images issue is what the "Nothing to stamp." headline already says.
        ...result.issues.filter((issue) => issue.code !== "no-images").map((issue) => `${issue.message}${issue.diagnostic?.path ? `\n${issue.diagnostic.path}` : ""}`),
        result.excluded.length ? `Left alone: ${plural(result.excluded.length, "stamped copy", "stamped copies")} from an earlier run.` : "",
        result.elapsed ? `Elapsed: ${result.elapsed}` : "",
        // The command line has --version; the dialog is where a person reads which version spoke.
        result.state === "invalid" || commandLine ? "" : `${APP_NAME} ${VERSION}`
    ].filter(Boolean).join("\n\n");
}

// Technical details as key: value lines, the format Image Files to PDF uses; stacks stay in the receipt.
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
        const response = showDetails(app, { title: APP_NAME, summary: describe(result), detail: detailOf(result), fallbackDetail: `${describe(result)}\n\n${detailOf(result)}`, buttons });
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
module.exports = { describe, detailOf, diagnosticLines, showCompletion };
