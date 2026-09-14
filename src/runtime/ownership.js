"use strict";

const { basename } = require("../core/paths.js");
const { UserCancelled } = require("../core/errors.js");
const { keep, clearAway } = require("./recovery.js");
const { fileFacts } = require("./file-facts.js");
const { removeFile } = require("./shell.js");

/*
 * Whether the copy is where it was meant to be, and what to let go of once it
 * is. One question and its consequences; publish.js decides when to ask.
 */

/*
 * The copy is at the output path, or it is not published.
 *
 * Asked of the output path itself: which file is this? A hard link shares its
 * volume and file number with the file it was made from, and a rename carries
 * them along, so the same pair is proof that the entry holds what this run
 * put there. A nonempty regular file is not proof of anything -- another
 * writer's picture is one too, and taking it as ours published their file and
 * deleted both copies of ours.
 *
 * Checked before anything is let go, and checked again when a claim says it
 * failed. An identity that could not be read is not a match, which is what
 * makes a refused inspection safe.
 */
function isPublished(published, outcome) {
    return Boolean(published.identity) &&
        published.identity === outcome.claimedIdentity &&
        published.size === outcome.claimedSize;
}

/*
 * ln links into a folder standing at the output path rather than refusing it,
 * so the claim may have gone inside one. The link there is this run's own
 * only if it is the file this run published, which is a question with an
 * exact answer -- and only then is it this run's to remove.
 */
function strayInside(app, paths, outcome) {
    const inside = `${paths.final}/${basename(outcome.claimed)}`;

    return fileFacts(app, inside).identity === outcome.claimedIdentity
        ? [inside]
        : [];
}

function confirm(job, paths, outcome) {
    job.unpublished.delete(paths.staged);
    clearAway(job, outcome);
    removeFile(job.app, paths.staged);
}

function unfinished(job, paths, outcome) {
    return keep(job, paths, {
        ...outcome,
        mine: strayInside(job.app, paths, outcome),
        reasons: [
            `the output path does not hold the copy this run published:\n\n${paths.final}`
        ]
    });
}

/*
 * One name, tried. What comes back is where the copy went, or what to say if
 * this was the last attempt.
 */
function clearAttempt(job, outcome) {
    clearAway(job, outcome);
}

/*
 * Stopped, and the output path does not hold this run's copy -- so nothing of
 * it was published.
 *
 * Which is a question that had to be put rather than assumed: an interrupted
 * call is not proof that the filesystem did nothing, and publish.js asks the
 * output path what it holds whatever the claim said. This is what is left
 * when the answer is "not ours". The place this attempt made goes, and the
 * copy is dropped from the unpublished set because there is nothing to
 * recover -- the workspace takes it on the way out. That is the difference
 * from a refusal, which keeps the copy somewhere the person can get it back.
 */
function abandon(job, staged, outcome) {
    clearAway(job, outcome);
    job.unpublished.delete(staged);

    return new UserCancelled();
}

module.exports = {
    isPublished,
    strayInside,
    confirm,
    unfinished,
    clearAttempt,
    abandon
};
