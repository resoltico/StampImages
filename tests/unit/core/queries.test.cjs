"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { buildMetadataArgv, buildSizeArgv, selectedTags } = require("../../../src/core/queries.js");

test("the default query requests only capture and creation dates, never GPS or modification time", () => {
    assert.deepEqual(buildMetadataArgv("/v/exiftool", "/a/photo.jpg"), [
        "/v/exiftool", "-json", "-n", "-DateTimeOriginal", "-CreateDate", "/a/photo.jpg"
    ]);
    assert.deepEqual(selectedTags({}), ["-DateTimeOriginal", "-CreateDate"]);
});

test("GPS fields are queried only with explicit enabled coordinate formats", () => {
    for (const coordinateFormat of ["decimal", "sexagesimal"]) {
        assert.deepEqual(selectedTags({ dateFormat: "none", coordinateFormat }), [
            "-GPSLatitude", "-GPSLongitude"
        ]);
        assert.deepEqual(selectedTags({ coordinateFormat }), [
            "-DateTimeOriginal", "-CreateDate", "-GPSLatitude", "-GPSLongitude"
        ]);
    }
    assert.deepEqual(selectedTags({ coordinateFormat: "none" }), selectedTags());
});

test("no metadata requested cannot accidentally become an all-metadata ExifTool request", () => {
    const none = { dateFormat: "none", coordinateFormat: "none" };

    assert.deepEqual(selectedTags(none), []);
    assert.throws(() => buildMetadataArgv("/v/exiftool", "/a/photo.jpg", none), /No stamp metadata/u);
    assert.throws(() => buildMetadataArgv("/v/exiftool", "/a/photo.jpg", {
        dateFormat: "none"
    }), /No stamp metadata/u);
});

test("invalid explicit query formats are not interpreted as opt-in", () => {
    for (const value of [null, true, false, "", "all", {}, []]) {
        assert.throws(() => selectedTags({ coordinateFormat: value }), /Unrecognised value/u);
        assert.throws(() => selectedTags({ dateFormat: value }), /Unrecognised value/u);
    }
});

test("a header field is asked for one at a time, by name", () => {
    assert.deepEqual(buildSizeArgv("/v/vipsheader", "/w/mask.png", "width"), [
        "/v/vipsheader", "-f", "width", "/w/mask.png"
    ]);
});
