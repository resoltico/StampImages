"use strict";

/*
 * What a stamped copy is saved as: the same kind of file it came from.
 *
 * One function answers for both the name and the encoding, because vips
 * chooses the encoder from the extension it is given. A copy that arrived as
 * something other than what it was is a surprise, and a file named .heic that
 * is secretly a JPEG is worse.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const {
    outputFormat,
    savingPath
} = require("../../../src/core/formats.js");

test("the copy keeps the kind of file the photograph was", () => {
    for (const extension of [
        ".jpg", ".jpeg", ".png", ".heic", ".heif", ".tif", ".tiff", ".webp", ".avif"
    ]) {
        assert.equal(outputFormat(`/a/photo${extension}`).extension, extension);
    }
});

test("the spelling on disk does not decide the spelling written back", () => {
    // A name is matched however it was typed, and answered in one spelling.
    assert.equal(outputFormat("/a/PHOTO.JPG").extension, ".jpg");
    assert.equal(outputFormat("/a/photo.JPEG").extension, ".jpeg");
    assert.equal(outputFormat("/a/photo.TiFf").extension, ".tiff");
});



test("a copy is written at a stated quality, not at the encoder's default", () => {
    // Measured: vips writes JPEG at quality 75 and HEIF lower still, so every
    // copy this program made was visibly worse than the photograph it came
    // from and nothing said so.
    assert.equal(savingPath("/a/photo_stamped.jpg"), "/a/photo_stamped.jpg[Q=90]");
    assert.equal(savingPath("/a/photo_stamped.heic"), "/a/photo_stamped.heic[Q=90]");
    assert.equal(savingPath("/a/photo_stamped.webp"), "/a/photo_stamped.webp[Q=90]");
    assert.equal(savingPath("/a/photo_stamped.avif"), "/a/photo_stamped.avif[Q=90]");
});

test("a format that loses nothing is asked for nothing", () => {
    assert.equal(savingPath("/a/photo_stamped.png"), "/a/photo_stamped.png");
    assert.equal(savingPath("/a/photo_stamped.tif"), "/a/photo_stamped.tif");
    assert.equal(savingPath("/a/photo_stamped.tiff"), "/a/photo_stamped.tiff");
});

test("unsupported output and disguised source formats are refused", () => {
    const { extensionFor } = require("../../../src/core/formats.js");
    assert.throws(() => outputFormat("photo.gif").extension, /Unsupported/u);
    assert.equal(extensionFor("photo.jpg", "PNG"), ".png");
    assert.equal(extensionFor("photo.JPEG", "JPEG"), ".jpeg");
});

test("actual content families match every supported extension", () => {
    const { extensionFor } = require("../../../src/core/formats.js");
    for (const [extension, family] of [["jpg", "JPEG"], ["jpeg", "JPEG"], ["png", "PNG"], ["tif", "TIFF"], ["tiff", "TIFF"], ["heic", "HEIF"], ["heif", "HEIF"], ["avif", "HEIF"], ["webp", "WebP"]]) {
        assert.equal(extensionFor(`/photo.${extension}`, family, extension === "avif" ? "av1" : "hevc"), `.${extension}`);
        assert.throws(() => extensionFor(`/photo.${extension}`, "unknown"), /could not be confirmed/u);
    }
});

test("actual raster encoding determines mislabeled copy extensions", () => {
    const { extensionFor } = require("../../../src/core/formats.js");
    assert.equal(extensionFor("photo.jpg", "PNG"), ".png");
    assert.equal(extensionFor("photo.png", "JPEG"), ".jpg");
    assert.equal(extensionFor("photo.heic", "HEIF", "av1"), ".avif");
    assert.equal(extensionFor("photo.avif", "HEIF", "hevc"), ".heic");
});
