"use strict";
const assert = require("node:assert/strict");
const test = require("node:test");
const { buildMetadataArgv, buildSizeArgv, selectedTags } = require("../../../src/backend/queries.js");
function keysOf(argv) {
    const program = argv.find((value) => value.startsWith("Filter="));
    return [...program.matchAll(/\["(?<key>[^"]+)"/gu)].map((match) => match.groups.key);
}
test("the default query requests only capture/creation dates, never GPS or modification time", () => {
    const settings = { dateFormat: "iso-minutes", coordinateFormat: "none" };
    const argv = buildMetadataArgv("/v/exiftool", "/a/photo.jpg", settings);
    assert.deepEqual(argv.slice(0, 6), ["/v/exiftool", "-json", "-api", "StructFormat=JSONQ", "-api", "SaveFormat=1"]);
    assert.deepEqual(argv.slice(-2), ["-System:FileName", "/a/photo.jpg"]);
    assert.deepEqual(keysOf(argv), ["ExifToolVersion", "Error", "DateTimeOriginal", "CreateDate"]);
    assert.deepEqual(selectedTags(settings), ["DateTimeOriginal", "CreateDate"]);
});
test("GPS original fractions, explicit refs and lexical XMP are queried only when enabled", () => {
    const gps = ["EXIFGPSLatitude", "EXIFGPSLatitudeRaw", "EXIFGPSLatitudeRef", "XMPGPSLatitude", "EXIFGPSLongitude", "EXIFGPSLongitudeRaw", "EXIFGPSLongitudeRef", "XMPGPSLongitude"];
    for (const coordinateFormat of ["decimal", "sexagesimal"]) {
        assert.deepEqual(selectedTags({ dateFormat: "none", coordinateFormat }), ["GPSLatitude", "GPSLongitude"]);
        assert.deepEqual(keysOf(buildMetadataArgv("/e", "/photo", { dateFormat: "none", coordinateFormat })), ["ExifToolVersion", "Error", ...gps]);
        assert.deepEqual(selectedTags({ dateFormat: "iso-minutes", coordinateFormat }), ["DateTimeOriginal", "CreateDate", "GPSLatitude", "GPSLongitude"]);
        assert.deepEqual(keysOf(buildMetadataArgv("/e", "/photo", { dateFormat: "iso-minutes", coordinateFormat })), ["ExifToolVersion", "Error", "DateTimeOriginal", "CreateDate", ...gps]);
    }
});
test("no requested metadata cannot accidentally become an all-metadata ExifTool request", () => {
    const none = { dateFormat: "none", coordinateFormat: "none" };
    assert.deepEqual(selectedTags(none), []);
    assert.throws(() => buildMetadataArgv("/e", "/photo", none), /No stamp metadata/u);
    assert.throws(() => buildMetadataArgv("/e", "/photo", { dateFormat: "none" }), /Coordinate format/u);
});
test("invalid explicit query formats are not interpreted as opt-in", () => {
    for (const value of [null, true, false, "", "all", {}, []]) {
        assert.throws(() => selectedTags({ dateFormat: "iso-minutes", coordinateFormat: value }), /Coordinate format|coordinate format/u);
        assert.throws(() => selectedTags({ dateFormat: value, coordinateFormat: "none" }), /Date\/time format|date\/time format/u);
    }
});
test("a header field is asked for one at a time by name", () => {
    assert.deepEqual(buildSizeArgv("/v/header", "/w/mask.png", "width"), ["/v/header", "-f", "width", "/w/mask.png"]);
});

test("every selected field retains its exact native getter mode and namespace", () => {
    const argv = buildMetadataArgv("/e", "/photo", { dateFormat: "iso-date", coordinateFormat: "decimal" });
    const program = argv.find((value) => value.startsWith("Filter="));
    const tuples = /for my \$f \((?<items>.+)\)\{/u.exec(program);
    assert.deepEqual(JSON.parse(`[${tuples.groups.items}]`), [
        ["ExifToolVersion", "ExifToolVersion", "Raw"], ["Error", "Error", "Raw"],
        ["DateTimeOriginal", "DateTimeOriginal", "ValueConv"], ["CreateDate", "CreateDate", "ValueConv"],
        ["EXIFGPSLatitude", "EXIF:GPSLatitude", "Rational"], ["EXIFGPSLatitudeRaw", "EXIF:GPSLatitude", "Raw"], ["EXIFGPSLatitudeRef", "EXIF:GPSLatitudeRef", "Raw"], ["XMPGPSLatitude", "XMP:GPSLatitude", "Raw"],
        ["EXIFGPSLongitude", "EXIF:GPSLongitude", "Rational"], ["EXIFGPSLongitudeRaw", "EXIF:GPSLongitude", "Raw"], ["EXIFGPSLongitudeRef", "EXIF:GPSLongitudeRef", "Raw"], ["XMPGPSLongitude", "XMP:GPSLongitude", "Raw"]
    ]);
});
