"use strict";
const { basename, dirname } = require("./paths.js");

function summaryKind(outcome, counts) {
    if (outcome.state === "invalid") { return "invalid"; }
    if (outcome.images.length === 0 && outcome.issues.some((issue) => issue.code === "no-images")) { return "nothing-to-stamp"; }
    if (outcome.state === "canceled") { return "stopped"; }
    const allSaved = counts.saved > 0 && counts.saved === outcome.images.length && outcome.issues.length === 0 &&
        outcome.images.every((image) => image.issues.length === 0 && !image.missingMetadata?.length);
    if (allSaved) { return "all-saved"; }
    return counts.saved > 0 ? "some-saved" : "none-saved";
}

/** Presentation-independent facts; consented refusals do not change the completion headline. */
function summarizeRun(outcome) {
    const counts = { saved: 0, recovered: 0, failed: 0, "nothing-to-stamp": 0, canceled: 0, "not-started": 0 };
    const folders = new Map();
    for (const image of outcome.images) {
        counts[image.state] += 1;
        if (image.state === "saved") {
            const folder = dirname(image.output);
            if (!folders.has(folder)) { folders.set(folder, []); }
            folders.get(folder).push({ path: image.output, name: basename(image.output) });
        }
    }
    const finished = outcome.images.filter((image) => ["saved", "recovered"].includes(image.state));
    return { kind: summaryKind(outcome, counts), counts,
        saved: Array.from(folders, ([folder, outputs]) => ({ folder, outputs })),
        notes: finished, missing: finished.filter((image) => image.missingMetadata?.length > 0).length,
        nothingToStamp: outcome.images.filter((image) => image.state === "nothing-to-stamp"),
        failures: outcome.images.filter((image) => ["failed", "canceled"].includes(image.state)),
        recoveries: outcome.images.filter((image) => image.state === "recovered"),
        notStarted: counts["not-started"], refusals: outcome.rejected, excluded: outcome.excluded, issues: outcome.issues };
}
module.exports = { summarizeRun };
