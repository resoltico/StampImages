"use strict";

const { MOMENT_TAGS } = require("../core/metadata.js");
const { readSetting } = require("../core/settings.js");

const NUMERIC = "-n";
const JSON_OUT = "-json";
const COORDINATE_TAGS = ["-GPSLatitude", "-GPSLongitude"];

/* Only metadata requested for the stamp, not every tag the file carries. */
function selectedTags(settings) {
    const dateFormat = readSetting("dateFormat", settings.dateFormat);
    const coordinateFormat = readSetting("coordinateFormat", settings.coordinateFormat);

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
