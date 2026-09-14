"use strict";

const { basename, fileStem } = require("../core/paths.js");
const { tryArgv, removeFile } = require("./shell.js");
const { sameBytes, isRegularFile } = require("./asking.js");

/*
 * Which colours a photograph's numbers mean.
 *
 * A colour chosen in the form is three sRGB numbers, and writing those
 * numbers into a photograph does not make them that colour: they are read
 * through whatever profile the photograph carries. Measured on this Mac, in
 * Lab: #FF3B30 written into a Display P3 photograph lands about 19 away from
 * the red that was asked for, and #FFD400 about 28. A difference of 2 is
 * visible. Every recent iPhone photograph is Display P3, so this is the
 * ordinary case rather than an exotic one -- and white and grey are exact,
 * which is why the defaults never showed it.
 *
 * So the photograph's profile is taken out of it and the colour is moved into
 * that space before it is painted. exiftool writes the profile to a file and
 * writes nothing at all when there is none, which is also how the question
 * "does this photograph carry one" is asked.
 *
 * A photograph with no profile needs none of this: numbers with no profile
 * are sRGB by convention, which is what they already are.
 */

/*
 * One file per distinct profile rather than per photograph. A batch comes off
 * one camera, so the second photograph's profile is the first photograph's --
 * and the stamp drawn for it can be the same drawing, which is the difference
 * between drawing once and drawing two hundred times.
 */
function known(job, path) {
    return job.profiles.find((seen) => sameBytes(job.app, seen, path)) ?? "";
}

function extract(job, source, token) {
    const written =
        `${job.workspace}/profile-${token}-${fileStem(basename(source))}.icc`;

    tryArgv(job.app, [
        job.tools.exiftool,
        "-icc_profile",
        "-b",
        "-w!",
        `${job.workspace}/profile-${token}-%f.icc`,
        source
    ]);

    return isRegularFile(job.app, written) ? written : "";
}

/*
 * The profile this photograph's colours are in, as a file this run owns, or
 * "" when the photograph carries none.
 */
function profileFor(job, source, token) {
    const written = extract(job, source, token);

    if (!written) {
        return "";
    }

    const seen = known(job, written);

    if (!seen) {
        job.profiles.push(written);

        return written;
    }

    removeFile(job.app, written);

    return seen;
}

module.exports = { profileFor };
