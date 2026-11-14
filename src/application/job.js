"use strict";
const { issuesOf, runOutcome, ISSUE } = require("../core/outcomes.js");
const { isUserCanceled } = require("../core/errors.js");
function stampWithMetadata(ports, image, index, record) {
    let metadataKnown = false;
    const metadataReady = (inscription) => {
        if (metadataKnown) { throw new TypeError("Stamp metadata was supplied more than once."); }
        const missing = inscription.missing ?? [];
        const invalid = inscription.invalid ?? [];
        if (!Array.isArray(missing) || !Array.isArray(invalid)) { throw new TypeError("Stamp metadata omissions must be arrays."); }
        record.missingMetadata = [...missing];
        if (invalid.length > 0) { record.invalidMetadata = [...invalid]; }
        metadataKnown = true;
    };
    const made = ports.stamp(image, index, metadataReady);
    if (!metadataKnown) { throw new TypeError("The stamp port did not supply its metadata facts."); }
    return made;
}
function executeImage(ports, image, index) {
    const record = { source: image.path, state: "building", issues: [], missingMetadata: [] };
    try {
        ports.begin(image, index);
        const made = stampWithMetadata(ports, image, index, record);
        if (made.nothing) { Object.assign(record, { state: "nothing-to-stamp", reason: made.nothing }); }
        else {
            Object.assign(record, { crowded: made.crowded, unconverted: made.unconverted, expanded: made.expanded, substituted: Boolean(made.substituted) });
            const saved = ports.publish(made.staged, image);
            Object.assign(record, { state: "saved", output: saved.path });
            record.issues.push(...saved.issues);
        }
    } catch (error) {
        record.issues.push(...issuesOf(error, "stamping"));
        record.state = isUserCanceled(error) ? "canceled" : "failed";
        if (error && Object.hasOwn(error, "recovery") && error.recovery === null) { record.state = "failed"; }
        else if (error?.recovery) { record.state = "recovered"; }
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
        stopped ||= record.state === "canceled" || record.issues.some((issue) => [ISSUE.fault, ISSUE.cleanup, ISSUE.canceled].includes(issue.code));
    }
    return runOutcome(records);
}
module.exports = { executeImage, runJob };
