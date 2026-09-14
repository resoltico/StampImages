"use strict";

const { inscriptionFor, wantsMetadata } = require("../core/inscription.js");
const { placeStamp } = require("../core/geometry.js");
const { stagedPath } = require("../core/naming.js");
const { outputExtension } = require("../core/formats.js");
const { removeFile } = require("./shell.js");
const { factsFor } = require("./facts.js");
const { profileFor } = require("./colour-space.js");
const { stampFor } = require("./render.js");
const { readPhotograph, composite, saveCopy } = require("./image.js");

/*
 * One photograph, from the file that was selected to a finished copy waiting
 * in the workspace for a name -- or the reason there is no copy to publish.
 *
 * The order is the cheap question first. What the stamp will say is settled
 * before the photograph is decoded, because a photograph this request does
 * not apply to should cost a call to exiftool and nothing else.
 *
 * Every stage reads one file and writes another. The original is never opened
 * for writing, and nothing is written outside the workspace: what leaves here
 * is a path, and publishing it is somebody else's business.
 */

/*
 * What this photograph needed on the way through, and nothing else's.
 *
 * The stages between the file and the copy are uncompressed: a 24-megapixel
 * photograph is about 70 megabytes oriented and rather more once the stamp
 * has been composited onto it. Kept until the end of the run, a batch of two
 * hundred would ask the disk for tens of gigabytes it was never told about.
 *
 * Everything this photograph made is on the list, the finished copy included,
 * and the copy is spared only once there is one to hand back. A copy vips
 * wrote and that then failed its own check -- the wrong size, unreadable --
 * is not a copy of anything, and it used to wait for the workspace: a batch
 * of failures held one apiece.
 */
function clearIntermediates(job, intermediates, keeping) {
    for (const path of intermediates) {
        if (path !== keeping) {
            removeFile(job.app, path);
        }
    }
}

function stampOnto(job, photograph, image, token) {
    job.progress.phase("Drawing the stamp");

    const stamp = stampFor(job, {
        text: image.inscription.text,
        profile: profileFor(job, image.path, token)
    });
    const at = placeStamp(photograph.size, stamp.size, job.settings);

    job.progress.phase("Stamping the photograph");

    return {
        stamped: composite(job, photograph, { path: stamp.path, at }, token),
        crowded: at.crowded,
        unconverted: !stamp.moved
    };
}

function produce(job, image, token, intermediates) {
    const photograph = readPhotograph(job, image.path, token);

    intermediates.push(photograph.path);

    const drawn = stampOnto(job, photograph, image, token);

    intermediates.push(drawn.stamped);

    const target = stagedPath(job.workspace, token, outputExtension(image.path));

    intermediates.push(target);
    saveCopy(job, drawn.stamped, target, photograph);

    return {
        staged: target,
        crowded: drawn.crowded,
        unconverted: drawn.unconverted
    };
}

/*
 * What will be written on this photograph, or the reason nothing will be.
 *
 * A photograph that knows neither when nor where it was taken, when that is
 * all that was asked for, is not a failure of the program and not a success
 * of the run. It is a photograph the request did not apply to, and it used to
 * reach the renderer as an empty drawing -- which vips refused, in its own
 * words, so somebody who had asked for the date on a folder of scans was
 * shown "text: no text to render" and the command that failed.
 */
function inscribe(job, image) {
    const facts = wantsMetadata(job.settings) ? factsFor(job, image.path) : {};

    return inscriptionFor(facts, job.settings);
}

function stampOne(job, image, token) {
    const inscription = inscribe(job, image);

    if (inscription.nothing) {
        return { nothing: inscription.nothing };
    }

    const intermediates = [];
    let keeping = "";

    try {
        const made = produce(job, { ...image, inscription }, token, intermediates);

        keeping = made.staged;

        return made;
    } finally {
        clearIntermediates(job, intermediates, keeping);
    }
}

module.exports = { stampOne };
