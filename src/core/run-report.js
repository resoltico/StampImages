"use strict";
const { isWorkspaceName } = require("./workspaces.js");
const { summarizeRun } = require("./run-summary.js");
const { basename } = require("./paths.js");
const { supportedFormatList } = require("./formats.js");
const { plural } = require("./formatting.js");

function madeSentence(counts) {
    const saved = counts.saved ? `Created ${plural(counts.saved, "stamped copy", "stamped copies")}.` : "";
    const recovered = counts.recovered
        ? `${plural(counts.recovered, "copy", "copies")} could not be saved where ${counts.recovered === 1 ? "it was" : "they were"} meant to go and ${counts.recovered === 1 ? "was" : "were"} kept elsewhere; the location is below.`
        : "";
    return [saved, recovered].filter(Boolean).join(" ") || "No stamped copy was created.";
}
function headline(summary) {
    if (summary.kind === "setup") { return "A required tool is missing or unusable."; }
    if (summary.kind === "invalid") { return "The request is invalid."; }
    if (summary.kind === "nothing-to-stamp") { return "Nothing to stamp."; }
    let prefix = "Finished with issues. ";
    if (summary.kind === "stopped") { prefix = "Stopped. "; }
    else if (summary.kind === "all-saved") { prefix = ""; }
    return `${prefix}${madeSentence(summary.counts)}`;
}
const PUBLICATION_REASONS = {
    denied: "Its folder cannot be written (permission denied).",
    "cross-device": "Its folder is on a volume that could not take the finished copy.",
    unsupported: "Its folder's filesystem does not support saving the copy safely."
};
function issueLines(issue) {
    const reason = issue.code === "publication" ? PUBLICATION_REASONS[issue.diagnostic?.state] : undefined;
    return [reason ? `${issue.message} ${reason}` : issue.message];
}
function countsLine(summary) {
    if (summary.kind === "invalid") { return ""; }
    const labels = { saved: "saved", recovered: "recovered", failed: "failed", "nothing-to-stamp": "with nothing to stamp", canceled: "canceled", "not-started": "not started" };
    const parts = Object.entries(labels).filter(([key]) => summary.counts[key] > 0).map(([key, label]) => `${summary.counts[key]} ${label}`);
    if (summary.refusals.length > 0) { parts.push(`${summary.refusals.length} not included`); }
    if (summary.missing > 0) { parts.push(`${plural(summary.missing, "copy", "copies")} with requested metadata left off`); }
    return parts.length > 0 ? `${parts.join("; ")}.` : "";
}
function notesOf(image) {
    const absent = (image.missingMetadata ?? []).filter((field) => !image.invalidMetadata?.includes(field));
    return [
        absent.length ? `Missing requested metadata: ${absent.join(", ")}.` : "",
        image.invalidMetadata?.length ? `Recorded but not valid, so left off: ${image.invalidMetadata.join(", ")}.` : "",
        image.crowded ? "The margin is larger than this image has room for, so the stamp was placed against the opposite edge." : "",
        image.expanded ? "Written in color from a grayscale original." : "",
        image.substituted ? "Some characters are not in the chosen typeface and were drawn in another one." : "",
        image.unconverted ? "The caption color could not be converted to the image's color profile." : ""
    ].filter(Boolean);
}

function section(heading, lines) {
    return lines.length > 0 ? `${heading}\n${lines.join("\n")}` : "";
}

function describeRejections(rejected, heading = "Not included from your selection:") {
    return section(heading, rejected.map((entry) => `${entry.path || entry.name}: ${entry.reason}`));
}

function recoveryReason(cause) {
    const diagnostic = cause?.diagnostic;
    const reason = [diagnostic?.message, ...(Array.isArray(diagnostic) ? diagnostic : []), cause ? issueLines(cause)[0] : undefined]
        .find((value) => typeof value === "string" && value.trim());
    return reason ? reason.replace(/\s+/gu, " ").trim() : "The requested destination was not used.";
}

function problemLine({ source, issue }) {
    return `${source ? `${source}: ` : ""}${issue.message}${issue.diagnostic?.path ? `\n${issue.diagnostic.path}` : ""}`;
}

function summaryText(summary, includeHeadline = true) {
    const saved = summary.saved.map((group) => `${group.folder}\n${group.outputs.map((output) => output.name).join("\n")}`).join("\n\n");
    const problems = summary.problems.map(problemLine);
    return [includeHeadline ? headline(summary) : "", countsLine(summary), saved ? `Saved to:\n${saved}` : "",
        section("Notes:", summary.notes.flatMap((image) => notesOf(image).map((note) => `${basename(image.output ?? image.source)}: ${note}`))),
        section("Nothing to stamp:", summary.nothingToStamp.map((image) => `${image.source}: ${image.reason}`)),
        section("Could not stamp:", summary.failures.map((image) => `${image.source}: ${image.issues.flatMap(issueLines).join(" ") || image.state}`)),
        section("Saved elsewhere:", summary.recoveries.map((image) => `${image.recovery}\n${recoveryReason(image.cause)}`)),
        summary.notStarted > 0 ? `Not started: ${summary.notStarted}` : "", describeRejections(summary.refusals),
        ["invalid", "setup"].includes(summary.kind) ? problems.join("\n\n") : section("Other issues:", problems),
        summary.excluded.length > 0 ? `Left alone: ${plural(summary.excluded.length, "stamped copy", "stamped copies")} from an earlier run.` : ""
    ].filter(Boolean).join("\n\n");
}

function workspaceText(diagnostics) {
    const workspaces = diagnostics.filter((entry) => entry.stage === "workspace" &&
        ["workspace-retained", "workspace-reclaimed", "workspace-unreadable"].includes(entry.code) &&
        typeof entry.message === "string" && entry.message.trim() &&
        typeof entry.diagnostic?.path === "string" && isWorkspaceName(basename(entry.diagnostic.path)));
    return workspaces.length > 0 ? `Temporary work:\n${workspaces.map((entry) => `${entry.message}\n${entry.diagnostic.path}`).join("\n\n")}` : "";
}

function reportText(result, includeHeadline = true) {
    return [summaryText(summarizeRun(result), includeHeadline), workspaceText(result.diagnostics), result.elapsed ? `Elapsed: ${result.elapsed}` : ""].filter(Boolean).join("\n\n");
}
function noImagesHeadline(rejected) { return rejected.length > 0 ? "Nothing to stamp." : "No images selected."; }
function describeNoImages(rejected, includeHeadline = true) {
    const detail = rejected.length > 0 ? rejected.map((entry) => `${entry.path || entry.name}: ${entry.reason}`).join("\n")
        : `Select ${supportedFormatList()} files or folders in Finder, then run the action again.`;
    return includeHeadline ? `${noImagesHeadline(rejected)}\n\n${detail}` : detail;
}
module.exports = { headline, countsLine, summaryText, reportText, describeRejections, noImagesHeadline, describeNoImages };
