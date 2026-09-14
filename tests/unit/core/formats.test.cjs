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
    outputExtension,
    savingPath,
    FALLBACK
} = require("../../../src/core/formats.js");

test("the copy keeps the kind of file the photograph was", () => {
    for (const extension of [
        ".jpg", ".jpeg", ".png", ".heic", ".heif", ".tif", ".tiff", ".webp", ".avif"
    ]) {
        assert.equal(outputExtension(`/a/photo${extension}`), extension);
    }
});

test("the spelling on disk does not decide the spelling written back", () => {
    // A name is matched however it was typed, and answered in one spelling.
    assert.equal(outputExtension("/a/PHOTO.JPG"), ".jpg");
    assert.equal(outputExtension("/a/photo.JPEG"), ".jpeg");
    assert.equal(outputExtension("/a/photo.TiFf"), ".tiff");
});

test("something this cannot save is saved as the fallback", () => {
    // A format vips will not write must still produce a copy, and the name
    // must say what the copy really is.
    assert.equal(outputExtension("/a/scan.gif"), FALLBACK.extension);
    assert.equal(outputExtension("/a/photo"), FALLBACK.extension);
    assert.equal(outputExtension("/a/.hidden"), FALLBACK.extension);
    assert.equal(FALLBACK.extension, ".jpg");
});

test("a dot in a folder name is not an extension", () => {
    assert.equal(outputExtension("/a/holiday.2026/photo"), FALLBACK.extension);
    assert.equal(outputExtension("/a/holiday.2026/photo.png"), ".png");
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
