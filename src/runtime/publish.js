"use strict";

const { keep } = require("./recovery.js");
const { deliver, stagingArea } = require("./transfer.js");
const { fileFacts } = require("./file-facts.js");
const {
    isPublished,
    confirm,
    unfinished,
    clearAttempt,
    abandon
} = require("./ownership.js");

/*
 * Who owns a finished copy, and where it goes when it cannot be published.
 *
 * The bytes are transfer.js's business. This is the rule about the file, and
 * it is three sentences: the job owns the copy it built from the moment the
 * copy exists; what happened at the output path is settled by asking the
 * output path; and this run removes only what this run made.
 *
 * All three were learned the hard way. The workspace copy used to be moved
 * into the output folder, so a failure after that had to work out where the
 * bytes had got to -- and it worked it out by asking whether files existed,
 * through a check that answers "no" when it cannot tell. The copy used to
 * become the job's only once a name had been chosen for it, so a run that
 * could not find a free name threw away a finished copy that nothing had
 * recorded. And a claim that reported failure used to be believed: a link
 * that was made and then reported as failed left the copy published at the
 * name and the run insisting it had not been, setting a second copy aside.
 *
 * Nothing here counts. Publication used to be the one place a unit of work
 * was closed, which meant a photograph that failed on its way here was never
 * counted as attempted at all.
 *
 * And it answers three ways rather than two. A claim can be published, it can
 * be refused, and it can be stopped before it became either -- which is not a
 * refusal, because a refusal is a fact about the output path and a stop says
 * nothing about it. What settles an abandoned claim is the same question that
 * settles every other one, asked of the same place: an interrupted call is not
 * proof that the filesystem did nothing, so a link that was made before the
 * stop surfaced is a copy that was published, and the run stops after saying
 * so rather than losing it.
 */

/*
 * How many names to try. A name is chosen free and claimed a moment later,
 * and another program can take it in between -- rare, and answerable: the
 * copy is still in the workspace, so the next free name costs a claim rather
 * than the work again. Bounded because a name that keeps being taken is not
 * a race any more.
 */
const ATTEMPTS = 3;

/*
 * The output path does not hold this run's copy, so which of the other two is
 * it? A claim that said it succeeded and did not is the one thing nothing here
 * may shrug at; a stop ends the run rather than the attempt, because another
 * name would answer nothing it is about; and what is left is a refusal, which
 * the caller may try another name for.
 */
function settle(job, paths, outcome) {
    if (outcome.published) {
        throw unfinished(job, paths, outcome);
    }

    if (outcome.abandoned) {
        throw abandon(job, paths.staged, outcome);
    }

    return { paths, outcome };
}

function claimOnce(job, staged, facts, final) {
    const paths = { staged, area: stagingArea(final), final };
    const outcome = deliver(job.app, paths, facts, job.rename);

    // The one question, asked the one way, whatever the claim said: a claim
    // that reported failure at a path holding the copy it was putting there
    // succeeded, and one that reported success at a path holding something
    // else did not.
    if (!isPublished(fileFacts(job.app, final), outcome)) {
        return settle(job, paths, outcome);
    }

    confirm(job, paths, outcome);

    return { published: final, stopped: Boolean(outcome.abandoned) };
}

function claimName(job, staged, facts, chooseName) {
    let refused = null;

    for (let attempt = 0; attempt < ATTEMPTS; attempt += 1) {
        const tried = claimOnce(job, staged, facts, chooseName());

        if (tried.published) {
            return { path: tried.published, stopped: tried.stopped };
        }

        refused = tried;

        if (!tried.outcome.taken) {
            break;
        }

        // This attempt's own leavings, before the next name is tried.
        clearAttempt(job, tried.outcome);
    }

    throw keep(job, refused.paths, refused.outcome);
}

/*
 * The copy becomes the job's before it has a name, because choosing one can
 * fail and a copy nothing has recorded is a copy the workspace takes with it.
 *
 * What comes back is where the copy went and whether the run is to stop after
 * it: both, because they are not alternatives.
 */
function publishImage(job, stagedPath, chooseName) {
    job.progress.phase("Saving the copy");
    job.unpublished.add(stagedPath);

    const facts = fileFacts(job.app, stagedPath);

    if (!facts.identity) {
        throw keep(job, { staged: stagedPath, final: "" }, {
            reasons: [`The finished copy could not be measured:\n\n${stagedPath}`],
            staging: null
        });
    }

    return claimName(job, stagedPath, facts, chooseName);
}

module.exports = { publishImage };
