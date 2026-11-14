"use strict";
const { removeOwned } = require("./owned-cleanup.js");
const { isUserCanceled } = require("../core/errors.js");
const { runArgvInto } = require("./shell.js");
const { sameBytes, isRegularNonEmpty } = require("./filesystem-probes.js");

/*
 * Caption colors are sRGB values. Convert them through the image profile
 * before painting; otherwise chromatic colors can change meaning in P3 or
 * other spaces even when gray defaults look correct. An image without a
 * profile uses the sRGB convention.
 */

/*
 * Distinguish an absent profile, an extracted profile and failed extraction.
 * Only absence permits the sRGB convention without a warning; extraction
 * failure must remain visible in the outcome.
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
 * Name the extracted profile for this attempt rather than the source filename.
 * ExifTool -w extends the source name, which can exceed the filesystem byte
 * limit for a long valid image name. An explicit workspace path keeps extraction
 * failure distinct from a genuinely absent profile.
 */
function extract(job, source, token) {
    const written = `${job.workspace}/profile-${token}.icc`;

    try {
        runArgvInto(
            job.app,
            [job.tools.exiftool, "-icc_profile", "-b", source],
            written,
            "reading the image's color profile"
        );
    } catch (error) {
        if (isUserCanceled(error)) {
            throw error;
        }

        return unreadable();
    }

    // exiftool succeeds and writes nothing at all for a photograph that
    // carries no profile, which is how the question is asked.
    if (!isRegularNonEmpty(job.app, written)) {
        removeOwned(job, written);

        return none();
    }

    return { path: written, failed: false };
}

/*
 * The profile this photograph's colors are in, as a file this run owns.
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

    removeOwned(job, found.path);

    return { path: seen, failed: false };
}

module.exports = { profileFor };
