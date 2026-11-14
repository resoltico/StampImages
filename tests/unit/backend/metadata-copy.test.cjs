"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { buildMetadataCopyArgv } = require("../../../src/backend/metadata-copy.js");
test("all-format capture metadata comes from owned bytes while target geometry replaces source geometry", () => {
    assert.deepEqual(buildMetadataCopyArgv("/tools/exiftool", "/owned/source.tif", "/owned/copy.tif", { width: 600, height: 900 }), [
        "/tools/exiftool", "-overwrite_original", "-TagsFromFile", "/owned/source.tif",
        "-ExifIFD:All", "-GPS:All", "-IFD0:Make", "-IFD0:Model", "-IFD0:Artist", "-IFD0:Copyright", "-IFD0:Software", "-IFD0:ImageDescription", "-IFD0:ModifyDate",
        "--MakerNotes", "--Orientation", "--ImageWidth", "--ImageHeight", "--ExifImageWidth", "--ExifImageHeight", "--ThumbnailImage", "--PreviewImage", "-XMP:All", "-IPTC:All", "-IFD0:Orientation#=1",
        "-ExifIFD:ExifImageWidth=600", "-ExifIFD:ExifImageHeight=900", "-XMP-tiff:ImageWidth=600", "-XMP-tiff:ImageHeight=900", "-XMP-exif:ExifImageWidth=600", "-XMP-exif:ExifImageHeight=900",
        "-XMP-GContainer:All=", "-XMP-hdrgm:All=", "-XMP-HDRGainMap:All=", "-XMP-hdr:All=", "-XMP-apdi:All=", "-XMP-tiff:Orientation=", "/owned/copy.tif"
    ]);
});
