"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { sourceIssue, sourceFileIssue, sourceIssues, orientedSize, sourceRefusal, matchesAdmission, captureIssue, changedSourceIssue } = require("../../../src/core/source-policy.js");
const image = { loader: "jpegload", format: "JPEG", width: 400, height: 200, bands: 3, orientation: 1, pages: 1, icc: false, interpretation: "srgb" };

test("file access and empty-file refusals are distinct and precede content inspection", () => {
    assert.equal(sourceFileIssue({ readable: false, size: "0" }).code, "unreadable");
    assert.equal(sourceFileIssue({ readable: true, size: "0" }).code, "empty");
    for (const size of [undefined, 0, "-1", "100 bytes"]) {
        assert.match(sourceFileIssue({ readable: true, size }).message, /still exists/u);
    }
    assert.equal(sourceFileIssue({ readable: true, size: "100" }), null);
    assert.equal(sourceIssue("unreadable").message, "This file cannot be read (permission denied).");
    assert.throws(() => sourceIssue("typo"), /Unknown source issue code/u);
});

test("the source policy owns content codes and user-facing messages", () => {
    assert.deepEqual(sourceIssues(image), []);
    for (const orientation of [1, 2, 3, 4, 5, 6, 7, 8]) { assert.deepEqual(sourceIssues({ ...image, orientation }), []); }
    for (const loader of ["", "svgload", "pdfload", "pdfiumload"]) {
        assert.equal(sourceIssues({ ...image, format: undefined, loader })[0].code, "not-an-image");
    }
    assert.equal(sourceIssues({ ...image, format: undefined, loader: "not-svgload" })[0].code, "unsupported-content");
    assert.deepEqual(sourceIssues({ ...image, format: undefined, loader: "gifload" }), [{ code: "unsupported-content", stage: "inspection", message: "This image uses unsupported content; use JPEG, PNG, HEIC, TIFF, WebP or AVIF." }]);
    assert.deepEqual(sourceIssues({ ...image, pages: 2 }), [{ code: "multiple-images", stage: "inspection", message: "This file contains 2 images; only single images are supported." }]);
    for (const patch of [{ width: 0 }, { height: -1 }, { bands: 1.5 }, { pages: NaN }, { orientation: 0 }, { orientation: 9 }]) {
        assert.equal(sourceIssues({ ...image, ...patch })[0].code, "damaged");
    }
    const diagnostic = { message: "backend command and private path" };
    const [issue] = sourceIssues({ problem: "damaged", diagnostic });
    assert.equal(issue.diagnostic, diagnostic);
    assert.equal(issue.message, "This image is damaged or incomplete.");
    assert.ok(!issue.message.includes("backend"));
});

test("source refusals preserve the original pathname and keep technical text diagnostic-only", () => {
    const diagnostic = { message: "private details" };
    assert.deepEqual(sourceRefusal("/a/same.png", sourceIssue("empty")), { path: "/a/same.png", name: "same.png", reason: "This file is empty.", code: "empty", stage: "inspection" });
    assert.equal(sourceRefusal("/a/same.png", sourceIssue("damaged", {}, diagnostic)).diagnostic, diagnostic);
    assert.deepEqual(captureIssue("/user.png", diagnostic), { code: "operation", stage: "capture", source: "/user.png", message: "This file could not be copied for stamping.", diagnostic });
    assert.deepEqual(changedSourceIssue("/user.png"), { code: "operation", stage: "capture", source: "/user.png", message: "The source changed after selection; try again when it is stable." });
    assert.equal(changedSourceIssue("/user.png", diagnostic).diagnostic, diagnostic);
});

test("capture must match the admitted identity, version and all image facts", () => {
    const admitted = { identity: "1:2", version: "v1", image };
    const captured = { path: "/owned/input", identity: "1:2", version: "v1", ...image };
    assert.equal(matchesAdmission(admitted, captured), true);
    assert.equal(matchesAdmission(undefined, captured), false);
    assert.equal(matchesAdmission({ identity: "1:2", version: "v1", image: {} }, captured), false);
    for (const patch of [{ identity: "1:3" }, { version: "v2" }, { width: 401 }, { height: 201 }, { bands: 4 }, { orientation: 2 }, { pages: 2 }, { loader: "pngload" }, { format: "PNG" }, { icc: true }, { interpretation: "b-w" }]) {
        assert.equal(matchesAdmission(admitted, { ...captured, ...patch }), false);
    }
});

test("EXIF orientation ownership is shared by source validation and backend parsing", () => {
    assert.deepEqual(orientedSize(400, 200, 4), { width: 400, height: 200 });
    assert.deepEqual(orientedSize(400, 200, 5), { width: 200, height: 400 });
    assert.deepEqual(orientedSize(400, 200, 8), { width: 200, height: 400 });
    assert.deepEqual(orientedSize(400, 200, 9), { width: 400, height: 200 });
});

test("stamp fidelity refuses unsupported colour spaces and impossible band layouts", () => {
    for (const patch of [{ interpretation: "cmyk", bands: 4 }, { interpretation: "srgb", bands: 5 }, { interpretation: "b-w", bands: 3 }]) {
        assert.equal(sourceIssues({ ...image, ...patch })[0].code, "unsupported-colour");
    }
    for (const interpretation of ["b-w", "grey16"]) {
        for (const bands of [1, 2]) { assert.deepEqual(sourceIssues({ ...image, interpretation, bands }), []); }
    }
});

test("RGB and RGB16 permit exactly colour or colour plus alpha bands", () => {
    for (const interpretation of ["rgb", "rgb16"]) {
        assert.deepEqual(sourceIssues({ ...image, interpretation, bands: 3 }), []);
        assert.deepEqual(sourceIssues({ ...image, interpretation, bands: 4 }), []);
        assert.equal(sourceIssues({ ...image, interpretation, bands: 2 })[0].code, "unsupported-colour");
    }
    assert.equal(sourceIssues({ ...image, format: undefined, loader: "svgload" })[0].message, "This file is not a supported still raster image.");
    assert.equal(matchesAdmission({ identity: "1:2", version: "v1" }, image), false);
});

test("field regression: colour-layout refusal gives a meaningful conversion instruction", () => {
    const [issue] = sourceIssues({ ...image, interpretation: "cmyk", bands: 4 });
    assert.equal(issue.code, "unsupported-colour");
    assert.match(issue.message, /convert.*RGB or greyscale/iu);
    assert.equal(sourceIssues({ ...image, format: undefined, loader: "gifload" })[0].code, "unsupported-content");
});

test("HEIF is admitted only when its supported encoding is confirmed", () => {
    for (const compression of ["hevc", "av1"]) { assert.deepEqual(sourceIssues({ ...image, loader: "heifload", format: "HEIF", compression }), []); }
    for (const compression of [undefined, "", "unknown"]) { assert.equal(sourceIssues({ ...image, loader: "heifload", format: "HEIF", compression })[0].code, "unsupported-content"); }
});
