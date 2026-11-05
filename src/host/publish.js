"use strict";
const { requireValidatedArtifact, isPublished } = require("../core/artifacts.js");
const { keep, clearAway } = require("./recovery.js");
const { confirm } = require("./settling.js");
const { ISSUE, issuesOf } = require("../core/outcomes.js");
const { errorMessage, isUserCanceled, UserCanceled } = require("../core/errors.js");
const { claimAvailable } = require("./destination.js");

function confirmed(context) {
    const { job, paths, claimed, area } = context;
    const issueStart = job.cleanupIssues.length;
    const outcome = { state: "unconfirmed", claimedIdentity: claimed.identity, claimedSize: claimed.size, staging: area };
    try {
        // No checkpoint between confirmation and recording the confirmed destination.
        confirm(job, paths, outcome);
        return { state: "saved", path: paths.final, issues: job.cleanupIssues.slice(issueStart) };
    } catch (error) {
        if (outcome.state !== "confirmed") { throw error; }
        return { state: "saved", path: paths.final, issues: issuesOf(error, "cleanup") };
    }
}

function publicationCode(error) {
    const [issue] = issuesOf(error, "publication");
    return issue.code === ISSUE.operation ? ISSUE.publication : issue.code;
}

function retainedAfterStop(context) {
    const { job, paths, area } = context;
    const failure = new UserCanceled();
    failure.recovery = paths.staged;
    failure.issues = [{ code: ISSUE.canceled, stage: "publication", diagnostic: context.diagnostic, message: `Stopped before saving. Keep this finished copy from its temporary workspace before restarting:\n${paths.staged}` }];
    try { failure.issues.push(...clearAway(job.app, { staging: area })); }
    catch (error) { failure.issues.push(...issuesOf(error, "cleanup")); }
    return failure;
}

function failedPublication(context, error) {
    const { job, paths, claimed, area } = context;
    if (error?.recovery) { throw error; }
    if (isPublished(job.publication.facts(paths.final), {
        claimedIdentity: claimed.identity, claimedSize: claimed.size
    })) {
        const saved = confirmed(context);
        if (isUserCanceled(error)) { job.progress.requestStop(); }
        else { saved.issues.push(...issuesOf(error, "publication")); }
        return saved;
    }
    if (isUserCanceled(error)) { throw retainedAfterStop(context); }
    try { job.progress.phase("Keeping the finished copy"); }
    catch (checkpoint) {
        if (isUserCanceled(checkpoint)) { throw retainedAfterStop(context); }
        throw checkpoint;
    }
    const failure = keep(job, paths, { reasons: [errorMessage(error)], staging: area });
    failure.issues = [{ code: publicationCode(error), stage: "publication",
        message: "The image could not be saved to its requested destination.", diagnostic: context.diagnostic ?? issuesOf(error, "publication")[0].diagnostic }, ...failure.issues.slice(1)];
    throw failure;
}

/** Exact native claims retry positively classified collisions using the same validated image. */
function publishImage(job, staged, destination) {
    requireValidatedArtifact(job.artifacts, staged);
    const facts = job.publication.facts(staged);
    const paths = { staged, final: destination, intended: destination };
    if (!facts.identity || facts.size <= 0) {
        throw keep(job, paths, { reasons: ["The validated image identity could not be measured."], staging: null });
    }
    const context = { job, paths, facts, area: null, from: staged, claimed: facts, diagnostic: null };
    try { return claimAvailable(context, destination, confirmed, () => job.progress.phase("Saving image")); }
    catch (error) { return failedPublication(context, error); }
}
module.exports = { publishImage };
