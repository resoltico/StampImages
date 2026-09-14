"use strict";

const {
    errorMessage,
    commandOf,
    isUserCancelled
} = require("../core/errors.js");
const { STAMPED, nameFrom, nextUniquePath } = require("../core/naming.js");
const { outputExtension } = require("../core/formats.js");
const { pathIsTaken } = require("./asking.js");
const { stampOne } = require("./stamping.js");
const { publishImage } = require("./publish.js");

/*
 * One photograph, attempted: what it is called when it is finished, and what
 * it comes back as when it is not.
 *
 * Three outcomes, not two. A photograph can be stamped; it can fail, which is
 * something going wrong; and it can be one the request did not apply to,
 * which is neither. A scan with no shutter time, in a run that asked for the
 * date, is not a failure of anything -- and calling it one made a folder of
 * old photographs read as a disaster.
 */

/*
 * The name a copy will have, and a name nothing else holds. The check is a
 * courtesy -- publication itself refuses an occupied name, which is what
 * makes it safe -- but a number chosen before the work is a better message
 * than a refusal after it.
 */
function destinationFor(job, image) {
    const extension = outputExtension(image.path);
    const name = nameFrom(image.originalName, `${STAMPED}${extension}`);

    return nextUniquePath(
        `${image.folder}${name}`,
        (candidate) => pathIsTaken(job.app, candidate)
    );
}

/*
 * What a failed photograph is, kept as a record until something displays it.
 *
 * The command that failed is carried by the innermost error and reached
 * through the cause chain, because the one reader who can act on it is the
 * headless caller reading the receipt. The path is carried for the same
 * reader: two photographs of the same name in two folders are two records,
 * and a receipt that called them both "photo.jpg" named neither.
 */
function failed(image, error) {
    return {
        name: image.originalName,
        path: image.path,
        message: errorMessage(error),
        command: commandOf(error)
    };
}

/*
 * The name is chosen inside publication rather than before it, because
 * choosing one can fail and a copy that exists is recoverable work from the
 * moment it exists. Passed as a question rather than an answer so that a name
 * taken between the choosing and the claiming can be asked again.
 *
 * Announcing the photograph is inside the try, where a stop is an outcome of
 * this attempt rather than an escape from the batch: every report of what is
 * about to happen is a checkpoint, and one that unwound past here would take
 * the account of everything already published with it.
 */
function stampToFile(job, image, index) {
    const token = String(index + 1);

    try {
        job.progress.beginning(index + 1, image.originalName);

        const made = stampOne(job, image, token);

        if (made.nothing) {
            return { nothing: { name: image.originalName, reason: made.nothing } };
        }

        const saved = publishImage(job, made.staged, () => destinationFor(job, image));

        return {
            output: saved.path,
            stopped: saved.stopped,
            crowded: made.crowded,
            unconverted: made.unconverted
        };
    } catch (error) {
        /*
         * Not this photograph's fault, and not this photograph's failure. The
         * person asked the run to stop, so the run stops -- with whatever was
         * published before they asked, which is finished work.
         */
        return isUserCancelled(error)
            ? { stopped: true }
            : { failure: failed(image, error) };
    }
}


module.exports = { stampToFile, destinationFor };
