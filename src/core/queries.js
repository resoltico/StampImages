"use strict";

const { MOMENT_TAGS } = require("./metadata.js");
const { DATE_FORMAT, COORDINATE_FORMAT, defaultValueOf, labelOfValue } = require("./choices.js");

const NUMERIC = "-n";
const JSON_OUT = "-json";
const COORDINATE_TAGS = ["-GPSLatitude", "-GPSLongitude"];

/* Only metadata requested for the stamp, not every tag the file carries. */
function selectedTags({
    dateFormat = defaultValueOf(DATE_FORMAT),
    coordinateFormat = defaultValueOf(COORDINATE_FORMAT)
} = {}) {
    labelOfValue(DATE_FORMAT, dateFormat);
    labelOfValue(COORDINATE_FORMAT, coordinateFormat);

    return [
        ...dateFormat === "none" ? [] : MOMENT_TAGS.map((tag) => `-${tag}`),
        ...coordinateFormat === "none" ? [] : COORDINATE_TAGS
    ];
}

function buildMetadataArgv(exiftoolPath, imagePath, settings) {
    const tags = selectedTags(settings);

    // ExifTool interprets no requested tags as ALL tags, not no metadata.
    if (tags.length === 0) {
        throw new Error("No stamp metadata was requested.");
    }

    return [exiftoolPath, JSON_OUT, NUMERIC, ...tags, imagePath];
}

function buildSizeArgv(vipsheaderPath, imagePath, field) {
    return [vipsheaderPath, "-f", field, imagePath];
}

module.exports = { buildMetadataArgv, buildSizeArgv, selectedTags };
