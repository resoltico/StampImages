"use strict";

const { isUserCancelled } = require("../core/errors.js");
const { runArgvInto, removeFile } = require("./shell.js");
const { sameBytes, isRegularNonEmpty } = require("./asking.js");

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
 * that space before it is painted. A photograph with no profile needs none of
 * this: numbers with no profile are sRGB by convention, which is what they
 * already are.
 */

/*
 * Three answers, because two were not enough.
 *
 * "There is no profile" and "the profile could not be read" used to be the
 * same empty string, and the empty string took the no-profile path -- which
 * reports the colour as handled. So an extraction that failed was a stamp
 * painted in unconverted numbers and a run that said everything went well.
 * They are told apart now, and a failure is counted rather than assumed away.
 */
function none() {
    return { path: "", failed: false };
}

function unreadable() {
    return { path: "", failed: true };
}

/*
 * One file per distinct profile rather than per photograph. A batch comes off
 * one camera, so the second photograph's profile is the first photograph's --
 * and the stamp drawn for it can be the same drawing, which is the difference
 * between drawing once and drawing two hundred times.
 */
function known(job, path) {
    return job.profiles.find((seen) => sameBytes(job.app, seen, path)) ?? "";
}

/*
 * Named for the attempt rather than for the photograph. exiftool's own -w
 * names the file after the source, so a 250-character photograph name asked
 * for a 264-byte filename -- longer than any Mac filesystem takes -- and the
 * failure was swallowed as "this photograph has no profile".
 */
function extract(job, source, token) {
    const written = `${job.workspace}/profile-${token}.icc`;

    try {
        runArgvInto(
            job.app,
            [job.tools.exiftool, "-icc_profile", "-b", source],
            written,
            "reading the photograph's colour profile"
        );
    } catch (error) {
        if (isUserCancelled(error)) {
            throw error;
        }

        return unreadable();
    }

    // exiftool succeeds and writes nothing at all for a photograph that
    // carries no profile, which is how the question is asked.
    if (!isRegularNonEmpty(job.app, written)) {
        removeFile(job.app, written);

        return none();
    }

    return { path: written, failed: false };
}

/*
 * The profile this photograph's colours are in, as a file this run owns.
 */
function profileFor(job, source, token) {
    const found = extract(job, source, token);

    if (!found.path) {
        return found;
    }

    const seen = known(job, found.path);

    if (!seen) {
        job.profiles.push(found.path);

        return found;
    }

    removeFile(job.app, found.path);

    return { path: seen, failed: false };
}

module.exports = { profileFor };
