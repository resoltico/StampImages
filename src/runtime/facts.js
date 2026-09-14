"use strict";

const { buildMetadataArgv } = require("../core/queries.js");
const { runArgv } = require("./shell.js");

/*
 * What exiftool says about one photograph.
 *
 * It answers with a list of one entry, because it is built to be asked about
 * many files at once. A photograph that carries none of the tags is answered
 * for all the same, with an entry that names it and says nothing else, and
 * that is a photograph this run knows nothing about -- which is a thing that
 * can still be stamped with whatever was typed by hand.
 *
 * Anything else is a question that could not be put: a tool that would not
 * run, an answer that is not the JSON it promises, a record carrying an error
 * instead of an answer. Those are not photographs without a date. They used
 * to be treated as though they were, so a broken exiftool produced a folder
 * of copies with no date on them and a report saying everything had worked.
 * A run that does not know says so.
 */

function recordFor(answer) {
    const read = JSON.parse(String(answer));

    if (!Array.isArray(read) || read.length === 0 || !read[0]) {
        throw new Error("it answered with nothing about this photograph");
    }

    if (read[0].Error) {
        throw new Error(String(read[0].Error));
    }

    return read[0];
}

function factsFor(job, imagePath) {
    const answer = runArgv(
        job.app,
        buildMetadataArgv(job.tools.exiftool, imagePath),
        "reading the photograph's metadata"
    );

    try {
        return recordFor(answer);
    } catch (error) {
        throw new Error(
            `The photograph's metadata could not be read: ${error.message}`,
            { cause: error }
        );
    }
}

module.exports = { factsFor };
