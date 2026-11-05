"use strict";
const { issuesOf, runOutcome, ISSUE } = require("../core/outcomes.js");
const { isUserCancelled } = require("../core/errors.js");
function executeImage(ports, image, index) {
    const record = { source: image.path, state: "building", issues: [], missingMetadata: [] };
    try {
        ports.begin(image, index);
        const made = ports.stamp(image, index);
        // Requested fields that were recorded but unusable are named apart from those simply absent.
        const omitted = { missingMetadata: made.missing ?? [], ...made.invalid?.length ? { invalidMetadata: made.invalid } : {} };
        if (made.nothing) { Object.assign(record, { state: "nothing-to-stamp", reason: made.nothing }, omitted); }
        else {
            Object.assign(record, { crowded: made.crowded, unconverted: made.unconverted, expanded: made.expanded, substituted: Boolean(made.substituted) }, omitted);
            const saved = ports.publish(made.staged, image);
            Object.assign(record, { state: "saved", output: saved.path });
            record.issues.push(...saved.issues);
        }
    } catch (error) {
        record.issues.push(...issuesOf(error, "stamping"));
        record.state = isUserCancelled(error) ? "cancelled" : "failed";
        if (error?.recovery) { record.state = "recovered"; }
        if (error?.recovery) { record.recovery = error.recovery; }
    }
    try { record.issues.push(...ports.cleanup()); }
    catch (error) { record.issues.push(...issuesOf(error, "cleanup")); }
    try { ports.completed(record); }
    catch (error) { record.diagnostics = issuesOf(error, "observer"); }
    return record;
}
function runJob(ports, images) {
    const records = [];
    let stopped = false;
    for (const [index, image] of images.entries()) {
        const record = stopped ? { source: image.path, state: "not-started", issues: [], missingMetadata: [] } : executeImage(ports, image, index);
        records.push(record);
        stopped ||= record.state === "cancelled" || record.issues.some((issue) => [ISSUE.fault, ISSUE.cleanup, ISSUE.cancelled].includes(issue.code));
    }
    return runOutcome(records);
}
module.exports = { executeImage, runJob };
