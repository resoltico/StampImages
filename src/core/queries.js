"use strict";

/*
 * What is asked of the tools, rather than told to them.
 *
 * A question has an answer to interpret, so these live apart from the
 * commands that draw: what comes back from them is somebody else's data and
 * is read strictly, in metadata.js.
 */

const NUMERIC = "-n";
const JSON_OUT = "-json";

/*
 * The tags that are read, named individually rather than taking everything.
 * A photograph's metadata can be large and is none of this program's business
 * beyond these five: asking for all of it would pull serial numbers, owner
 * names and thumbnails into the run for no reason.
 */
const WANTED_TAGS = [
    "-DateTimeOriginal",
    "-CreateDate",
    "-ModifyDate",
    "-GPSLatitude",
    "-GPSLongitude"
];

function buildMetadataArgv(exiftoolPath, imagePath) {
    return [exiftoolPath, JSON_OUT, NUMERIC, ...WANTED_TAGS, imagePath];
}

function buildSizeArgv(vipsheaderPath, imagePath, field) {
    return [vipsheaderPath, "-f", field, imagePath];
}


module.exports = { buildMetadataArgv, buildSizeArgv, WANTED_TAGS };
