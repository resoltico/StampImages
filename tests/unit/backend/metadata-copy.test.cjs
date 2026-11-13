"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { buildMetadataCopyArgv } = require("../../../src/backend/metadata-copy.js");

test("HDR metadata retention reads captured bytes and excludes HDR declarations", () => {
    assert.deepEqual(buildMetadataCopyArgv("/tools/exiftool", "/owned/source.jpg", "/owned/copy.jpg"), [
        "/tools/exiftool", "-overwrite_original", "-TagsFromFile", "/owned/source.jpg", "-XMP:All", "-IPTC:All",
        "-XMP-GContainer:All=", "-XMP-hdrgm:All=", "-XMP-HDRGainMap:All=", "-XMP-hdr:All=", "-XMP-apdi:All=", "-XMP-tiff:Orientation=", "/owned/copy.jpg"
    ]);
});
