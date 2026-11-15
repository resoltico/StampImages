"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { projectionArgv, readProjection } = require("../../../src/backend/metadata-projection.js");
const { captureProjection } = require("../../../src/backend/queries.js");
const { OperationError } = require("../../../src/core/errors.js");
const source = "/private/source.jpg";
function answer(projection = { ExifToolVersion: "13.55" }, envelope = {}) {
    return JSON.stringify([{ SourceFile: source, FileName: projection, ...envelope }]);
}
test("native projection flags, program and UserParams remain separate argv data", () => {
    const path = "/a/'\"$()\\\nphoto.jpg";
    assert.deepEqual(projectionArgv("/tools/exiftool", path, "$_={x=>1}"), ["/tools/exiftool", "-json", "-api", "StructFormat=JSONQ", "-api", "SaveFormat=1", "-api", "Filter=$_={x=>1}", "-System:FileName", path]);
    assert.deepEqual(projectionArgv("/e", source, "fixed", ["source=/a", "target=/b"]).slice(-6), ["-userParam", "source=/a", "-userParam", "target=/b", "-System:FileName", source]);
});
test("one correctly associated typed carrier is decoded without interpreting raw claims", () => {
    const projection = { ExifToolVersion: "13.55", EXIFGPSLatitudeRaw: { malformed: true }, DateTimeOriginal: ["bad"] };
    assert.deepEqual(captureProjection(answer(projection), source), projection);
});
test("malformed JSON and every non-single-record shape are refused", () => {
    for (const output of ["warning", "", "null", "{}", "[]", "[null]", "[[]]", "[true]", '[{"SourceFile":"/private/source.jpg"},{"SourceFile":"/private/source.jpg"}]']) {
        assert.throws(() => readProjection(output, source), OperationError, output);
    }
});
test("exact source identity is required and unrelated outer data is not capture metadata", () => {
    for (const envelope of [{ SourceFile: undefined }, { SourceFile: 7 }, { SourceFile: "/other" }, { GPSLatitude: 10 }]) {
        assert.throws(() => readProjection(answer(undefined, envelope), source), /requested metadata source/u);
    }
});
test("native scalar/array/missing carriers cannot silently become an empty metadata result", () => {
    for (const projection of [undefined, null, [], "source.jpg", 7, true, {}]) {
        const output = projection === undefined ? JSON.stringify([{ SourceFile: source }]) : answer(projection);
        assert.throws(() => readProjection(output, source), /structured raw metadata projection/u);
    }
});
test("the numeric-looking JSONQ marker must remain a string", () => {
    for (const version of [undefined, 13.55, "", " 13.55", "13.55junk", null, {}]) {
        assert.throws(() => readProjection(answer({ ExifToolVersion: version }), source));
    }
    for (const version of ["13.55", "13", "14.0"]) { assert.equal(readProjection(answer({ ExifToolVersion: version }), source).ExifToolVersion, version); }
});
test("native error records retain the original error text", () => {
    assert.throws(() => readProjection(answer(undefined, { Error: "Source unreadable." }), source), /Source unreadable/u);
    assert.throws(() => readProjection(answer({ ExifToolVersion: "13.55", Error: "Capture malformed." }), source), /Capture malformed/u);
});
test("capture normalization refuses unknown carrier keys rather than legacy scalar fallback", () => {
    assert.throws(() => captureProjection(answer({ ExifToolVersion: "13.55", GPSLatitude: 10 }), source), /unknown capture projection/u);
    assert.deepEqual(captureProjection(answer({ ExifToolVersion: "13.55", Error: "" }), source), { ExifToolVersion: "13.55", Error: "" });
});

test("malformed JSON keeps its parse cause rather than turning into another shape failure", () => {
    assert.throws(() => readProjection("not JSON", source), (error) => {
        assert.equal(error instanceof OperationError, true); assert.equal(error.cause instanceof SyntaxError, true);
        assert.equal(error.message, "ExifTool did not return valid metadata JSON."); return true;
    });
    for (const output of ["[true]", "[7]", '["record"]']) {
        assert.throws(() => readProjection(output, source), { name: "OperationError", message: "ExifTool did not return one metadata record." });
    }
});
