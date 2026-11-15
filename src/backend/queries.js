"use strict";
const { MOMENT_TAGS } = require("../core/metadata.js");
const { readSetting } = require("../core/settings.js");
const { OperationError } = require("../core/errors.js");
const { projectionArgv, readProjection } = require("./metadata-projection.js");
const COORDINATE_TAGS = ["GPSLatitude", "GPSLongitude"];
const CAPTURE_FIELDS = [
    ["ExifToolVersion", "ExifToolVersion", "Raw"],
    ["Error", "Error", "Raw"],
    ...MOMENT_TAGS.map((tag) => [tag, tag, "ValueConv", tag]),
    ...COORDINATE_TAGS.flatMap((tag) => [
        [`EXIF${tag}`, `EXIF:${tag}`, "Rational", tag],
        [`EXIF${tag}Raw`, `EXIF:${tag}`, "Raw", tag],
        [`EXIF${tag}Ref`, `EXIF:${tag}Ref`, "Raw", tag],
        [`XMP${tag}`, `XMP:${tag}`, "Raw", tag]
    ])
];
// Domain selection precedes the native projection; disabled stamp fields are not read.
function selectedTags(settings) {
    const dateFormat = readSetting("dateFormat", settings.dateFormat);
    const coordinateFormat = readSetting("coordinateFormat", settings.coordinateFormat);
    return [...dateFormat === "none" ? [] : MOMENT_TAGS,
        ...coordinateFormat === "none" ? [] : COORDINATE_TAGS];
}
function buildMetadataArgv(exiftoolPath, imagePath, settings) {
    const tags = selectedTags(settings);
    if (tags.length === 0) { throw new Error("No stamp metadata was requested."); }
    const fields = CAPTURE_FIELDS.filter((field) => !field[3] || tags.includes(field[3]));
    // Only fixed developer-owned field names enter Perl; paths remain argv data.
    const projection = `$_={};for my $f (${fields.map(([key, tag, kind]) => `[${[key, tag, kind].map((part) => JSON.stringify(part)).join(",")}]`).join(",")}){my $v=scalar($self->GetValue($f->[1],$f->[2]));$_->{$f->[0]}=$v if defined($v)}`;
    return projectionArgv(exiftoolPath, imagePath, projection);
}
function captureProjection(output, source) {
    const projection = readProjection(output, source);
    if (Object.keys(projection).some((key) => !CAPTURE_FIELDS.some((field) => field[0] === key))) {
        throw new OperationError("ExifTool returned an unknown capture projection field.");
    }
    return projection;
}
function buildSizeArgv(vipsheaderPath, imagePath, field) {
    return [vipsheaderPath, "-f", field, imagePath];
}
module.exports = { buildMetadataArgv, buildSizeArgv, selectedTags, captureProjection };
