"use strict";
const { OperationError } = require("../core/errors.js");

const { buildMetadataArgv } = require("../backend/queries.js");
const { runArgv } = require("./shell.js");

/*
 * Read ExifTool's single-file response as a list containing one record that
 * names the source. A valid record with no requested tags means the image has
 * no such metadata and may still use custom text.
 *
 * A failed process, malformed JSON or an error record is an unreadable answer,
 * not evidence that metadata is absent. Report that failure rather than creating
 * undated copies and claiming that every requested field was handled.
 */

function recordFor(answer) {
    const read = JSON.parse(String(answer));

    if (!Array.isArray(read) || read.length !== 1 || !read[0] ||
        typeof read[0] !== "object" || Array.isArray(read[0])) {
        throw new OperationError("it answered with nothing about this image");
    }

    if (read[0].Error) {
        throw new OperationError(String(read[0].Error));
    }

    return read[0];
}

function factsFor(job, imagePath) {
    const answer = runArgv(
        job.app,
        buildMetadataArgv(job.tools.exiftool, imagePath, job.settings),
        "reading the image's metadata"
    );

    try {
        return recordFor(answer);
    } catch (error) {
        throw new OperationError(
            `The image's metadata could not be read: ${error.message}`,
            { cause: error }
        );
    }
}

module.exports = { factsFor };
