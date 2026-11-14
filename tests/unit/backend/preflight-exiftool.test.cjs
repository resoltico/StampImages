"use strict";
const assert = require("node:assert/strict");
const test = require("node:test");
const { buildExiftoolProbeArgv, isExiftoolUsable } = require("../../../src/backend/preflight.js");
function usable(answer) { return isExiftoolUsable(answer, "/x"); }
const healthy = '[{"SourceFile":"/x","FileName":{"ExifToolVersion":"13.55"}}]';
test("the exiftool probe asks for the same typed raw projection the adapter reads", () => {
    const argv = buildExiftoolProbeArgv("/opt/homebrew/bin/exiftool");
    assert.deepEqual(argv.slice(0, 6), ["/opt/homebrew/bin/exiftool", "-json", "-api", "StructFormat=JSONQ", "-api", "SaveFormat=1"]);
    assert.equal(argv.at(-2), "-System:FileName"); assert.equal(argv.at(-1), "/opt/homebrew/bin/exiftool");
    const filter = argv.find((value) => value.startsWith("Filter="));
    assert.match(filter, /"ExifToolVersion","ExifToolVersion","Raw"/u);
    assert.match(filter, /"EXIFGPSLatitude","EXIF:GPSLatitude","Rational"/u);
    assert.match(filter, /"XMPGPSLongitude","XMP:GPSLongitude","Raw"/u);
    assert.equal(argv.includes("-n"), false);
});
test("an answer of the wrong shape has not shown it can answer", () => {
    for (const output of ["[]", '{"SourceFile":"/x"}', '[{"FileType":"PNG"}]', '[{"SourceFile":7}]', "Warning: unsupported"]) { assert.equal(usable(output), false, output); }
    assert.equal(usable(healthy), true);
});
test("every part of the answer has to be there and an error must not be present", () => {
    for (const output of ['{"SourceFile":"/x"}', "[]", "[null]", '[{"FileType":"PNG"}]', '[{"SourceFile":"/x","Error":"File format error"}]']) { assert.equal(usable(output), false, output); }
    assert.equal(usable(healthy), true);
});
test("an array-like object is not the list exiftool answers with", () => {
    assert.equal(usable('{"length":1,"0":{"SourceFile":"/x"}}'), false);
});
test("a native legacy scalar carrier is refused rather than read as missing metadata", () => {
    for (const output of ['[{"SourceFile":"/x"}]', '[{"SourceFile":"/x","FileName":"exiftool"}]', '[{"SourceFile":"/x","GPSLatitude":10,"GPSLongitude":20}]']) { assert.equal(usable(output), false); }
});
test("JSONQ capability is a typed numeric-looking version marker, not a version pin", () => {
    for (const version of ["13.55", "14.0", "13"]) { assert.equal(usable(JSON.stringify([{ SourceFile: "/x", FileName: { ExifToolVersion: version } }])), true); }
    for (const version of [13.55, null, "", "13.55garbage", " 13.55", {}]) { assert.equal(usable(JSON.stringify([{ SourceFile: "/x", FileName: { ExifToolVersion: version } }])), false); }
});
test("capability requires exact source association and one fixed capture record", () => {
    assert.equal(isExiftoolUsable(healthy, "/other"), false);
    assert.equal(usable('[{"SourceFile":"/x","FileName":{"ExifToolVersion":"13.55","Error":"Unreadable"}}]'), false);
    assert.equal(usable('[{"SourceFile":"/x","FileName":{"ExifToolVersion":"13.55","Unrequested":"data"}}]'), false);
    assert.equal(usable('[{"SourceFile":"/x","FileName":{"ExifToolVersion":"13.55"}},{"SourceFile":"/x"}]'), false);
});
