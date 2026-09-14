"use strict";

/*
 * What is asked of the tools, rather than told to them.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const {
    buildMetadataArgv,
    buildSizeArgv,
    WANTED_TAGS
} = require("../../../src/core/queries.js");

test("exiftool is asked for five tags, by name, as numbers, in JSON", () => {
    assert.deepEqual(
        buildMetadataArgv("/v/exiftool", "/a/photo.jpg"),
        [
            "/v/exiftool",
            "-json",
            "-n",
            "-DateTimeOriginal",
            "-CreateDate",
            "-ModifyDate",
            "-GPSLatitude",
            "-GPSLongitude",
            "/a/photo.jpg"
        ]
    );
});

test("everything the photograph knows is not asked for", () => {
    // A photograph's metadata carries serial numbers, owner names and
    // thumbnails, and none of it is this program's business.
    assert.equal(WANTED_TAGS.length, 5);
    assert.ok(WANTED_TAGS.every((tag) => tag.startsWith("-")));
});

test("-n is what makes a coordinate a number rather than a sentence", () => {
    // Without it a latitude arrives as "56 deg 56' 58.63\" N", which would
    // have to be parsed back into the number it already was.
    assert.ok(buildMetadataArgv("/v/exiftool", "/a/p.jpg").includes("-n"));
});

test("a header field is asked for one at a time, by name", () => {
    assert.deepEqual(
        buildSizeArgv("/v/vipsheader", "/w/mask.png", "width"),
        ["/v/vipsheader", "-f", "width", "/w/mask.png"]
    );
});
