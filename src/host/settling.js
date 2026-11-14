"use strict";
const { isPublished } = require("../core/artifacts.js");
const { releaseOwnedArtifact } = require("./workspace.js");
const { ISSUE, issuesOf } = require("../core/outcomes.js");
const { keep, clearAway } = require("./recovery.js");
const { removeOwned } = require("./owned-cleanup.js");

/*
 * What the output path holds, and letting go once that is settled.
 *
 * One question, put to the name itself, and every way an attempt can end
 * comes back to it: which file is this? Nothing here infers from absence, and
 * a measurement that could not be taken is not an answer.
 */

/*
 * Confirm the output's native identity before releasing any finished copy.
 * A hard link or rename preserves the claimed volume/file-number pair; a
 * nonempty regular file alone could belong to another writer. Unavailable
 * identity facts do not confirm publication, so recovery retains the image.
 */

/*
 * Letting go of both copies, in this order: the drop decides whether runJob
 * keeps the workspace, so it comes before the copy it was protecting goes.
 * One of these rather than two, because an abandoned publication that turns
 * out to have published needs exactly the same.
 */
function settled(job, paths, outcome) {
    releaseOwnedArtifact(job, paths.staged);
    job.cleanupIssues.push(...clearAway(job.app, outcome));
    removeOwned(job, paths.staged);
    if (job.cleanupIssues.some((issue) => issue.code === ISSUE.canceled)) { job.progress.requestStop(); }
}

function confirm(job, paths, outcome) {
    const published = job.publication.facts(paths.final);

    if (!isPublished(published, outcome)) {
        throw keep(job, paths, {
            ...outcome,
            reasons: [
                `the output path does not hold the image this run published:\n\n${paths.final}`
            ]
        });
    }

    outcome.state = "confirmed";
    try { settled(job, paths, outcome); }
    catch (error) { job.cleanupIssues.push(...issuesOf(error, "cleanup")); }
}

module.exports = { confirm };
