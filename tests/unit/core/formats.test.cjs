"use strict";
const assert = require("node:assert/strict");
const test = require("node:test");
const { SUPPORTED_FORMATS, supportedFormatList, isSupportedImage } = require("../../../src/core/formats.js");

test("isSupportedImage accepts the still-image formats vips reads", () => {
    const accepted = [
        "/a/b.jpg", "/a/b.JPG", "/a/b.jpeg", "/a/b.png", "/a/b.PNG",
        "/a/b.heic", "/a/b.HEIF", "/a/b.heif",
        "/a/b.tif", "/a/b.tiff", "/a/b.TIFF",
        "/a/b.webp", "/a/b.avif"
    ];

    for (const path of accepted) {
        assert.equal(isSupportedImage(path), true, path);
    }
});

test("isSupportedImage rejects formats whose semantics would surprise", () => {
    // vips can read all of these. GIF and animated WebP would contribute only
    // their first frame, SVG would land as a stamp because the pipeline never
    // upscales, PDF would rasterise page one of a PDF to build a PDF, and RAW
    // is a processing job rather than a conversion.
    for (const rejected of [
        "/a/b.gif", "/a/b.svg", "/a/b.pdf", "/a/b.cr2", "/a/b.nef",
        "/a/b.bmp", "/a/b", "/a/pngx", "/a/b.png.txt", "/a/b.heicx"
    ]) {
        assert.equal(isSupportedImage(rejected), false, rejected);
    }
});

test("isSupportedImage anchors the extension at the end", () => {
    // Without the anchor, a file merely containing ".png" would be accepted.
    assert.equal(isSupportedImage("/a/report.png.txt"), false);
    assert.equal(isSupportedImage("/a/png.doc"), false);
    assert.equal(isSupportedImage("/a/b.jpeg.zip"), false);
});

test("the list shown to the user matches what the filter accepts", () => {
    // Both are derived from one table, so a format cannot be advertised and
    // then rejected, or accepted without ever being mentioned.
    const listed = supportedFormatList();

    for (const { name, extensions } of SUPPORTED_FORMATS) {
        assert.ok(listed.includes(name), `${name  } should be listed`);

        for (const extension of extensions) {
            assert.equal(isSupportedImage(`/a/photo.${  extension}`), true, extension);
        }
    }
});

test("the list reads as prose, not as a data dump", () => {
    assert.equal(supportedFormatList(), "JPEG, PNG, HEIC, TIFF, WebP or AVIF");
});
