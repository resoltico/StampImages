"use strict";

const { stampToFile } = require("./attempt.js");

/*
 * The batch: what each photograph is called when it is finished, and what
 * becomes of the ones that do not get a copy.
 *
 * Three outcomes, not two. A photograph can be stamped; it can fail, which is
 * something going wrong; and it can be one the request did not apply to,
 * which is neither. A scan with no shutter time, in a run that asked for the
 * date, is not a failure of anything -- and calling it one made a folder of
 * old photographs read as a disaster.
 *
 * The unit of work is one photograph and so is the unit of failure. One that
 * cannot be read, or whose copy cannot be saved, is reported and the rest of
 * the batch goes on: there is no rollback, because the copies already
 * published are finished work and deleting them would be the failure.
 */

/*
 * A photograph that has been tried is one the run is finished with, whichever
 * way it went: the count moves here and nowhere else, so a batch whose second
 * image failed does not end saying two of three.
 */
const OUTCOMES = [
    { held: "failure", into: "failures", said: "Failed" },
    { held: "nothing", into: "nothing", said: "Nothing to stamp" }
];

function counted(job, results, outcome) {
    results.outputs.push(outcome.output);
    results.crowded += outcome.crowded ? 1 : 0;
    results.unconverted += outcome.unconverted ? 1 : 0;
    job.progress.finished("Saved");
}

function tally(job, results, outcome) {
    const kind = OUTCOMES.find((each) => outcome[each.held]);

    if (kind) {
        results[kind.into].push(outcome[kind.held]);
        job.progress.finished(kind.said);

        return;
    }

    /*
     * Stopped before this photograph came to anything: there is nothing to
     * count and nothing to say about it. A copy published a moment before the
     * stop surfaced is a different outcome -- it has an output -- and it is
     * counted like any other, because it is finished work.
     */
    if (outcome.output) {
        counted(job, results, outcome);
    }
}

/*
 * Every photograph that was asked for ends in exactly one of three places: a
 * copy that exists, a reason there is none, or a reason it failed. A run that
 * reported none of them for a file would be a run that lost it quietly.
 */

/*
 * One photograph: what it came to, and whether the run goes on.
 *
 * Neither question is asked here any more. Announcing the photograph is the
 * first thing the attempt does, and every report of what is about to happen
 * is a checkpoint -- so a stop that arrived while the photograph before this
 * one was being stamped ends the run there, and one that arrives during this
 * one ends it wherever it lands. What comes back says which, and it can say
 * both: a copy published a moment before the stop surfaced is counted, and
 * then the run stops.
 */
function attempt(job, results, image, index) {
    const outcome = stampToFile(job, image, index);

    tally(job, results, outcome);

    return Boolean(outcome.stopped);
}

function runJob(job, images) {
    const results = {
        outputs: [],
        failures: [],
        nothing: [],
        crowded: 0,
        unconverted: 0
    };

    for (const [index, image] of images.entries()) {
        if (attempt(job, results, image, index)) {
            results.stopped = true;

            return results;
        }
    }

    return results;
}

module.exports = { runJob };
