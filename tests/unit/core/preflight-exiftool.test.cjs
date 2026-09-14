"use strict";

/*
 * The exiftool probe, which cannot be the vips one.
 *
 * Measured: `-notaflag` is not an unknown option to exiftool, it is a request
 * for a tag called "notaflag", so a build that understands nothing this
 * program asks for still answers "File not found" exactly as a healthy one
 * does. It is asked to succeed instead, about a file that is certainly there
 * -- its own executable -- and the answer has to be the JSON this program
 * reads.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const {
    buildExiftoolProbeArgv,
    isExiftoolUsable
} = require("../../../src/core/preflight.js");

test("the exiftool probe asks for a tag, in the form the adapter reads", () => {
    // Every argument matters: without -json there is nothing to parse, and
    // without a tag there is nothing to answer about.
    assert.deepEqual(buildExiftoolProbeArgv("/opt/homebrew/bin/exiftool"), [
        "/opt/homebrew/bin/exiftool",
        "-json",
        "-n",
        "-FileType",
        "/opt/homebrew/bin/exiftool"
    ]);
});

test("an answer of the wrong shape has not shown it can answer", () => {
    // Not a substring of the output but the thing the adapter will do with it:
    // a list, with an entry, naming the file it was asked about.
    assert.equal(isExiftoolUsable("[]"), false, "an empty list");
    assert.equal(isExiftoolUsable('{"SourceFile": "/x"}'), false, "not a list");
    assert.equal(isExiftoolUsable('[{"FileType": "PNG"}]'), false, "no SourceFile");
    assert.equal(isExiftoolUsable('[{"SourceFile": 7}]'), false, "not a name");
    assert.equal(isExiftoolUsable("Warning: unsupported"), false, "not JSON");
    assert.equal(isExiftoolUsable('[{"SourceFile": "/x"}]'), true);
});

test("every part of the answer has to be there, and one part has to not be", () => {
    // Each clause on its own: not a list, an empty one, a list of nothing, a
    // record with no name, and a record carrying an error instead of one.
    assert.equal(isExiftoolUsable('{"SourceFile":"/x"}'), false, "not a list");
    assert.equal(isExiftoolUsable("[]"), false, "an empty list");
    assert.equal(isExiftoolUsable("[null]"), false, "nothing in the first place");
    assert.equal(isExiftoolUsable('[{"FileType":"PNG"}]'), false, "no name");
    assert.equal(
        isExiftoolUsable('[{"SourceFile":"/x","Error":"File format error"}]'),
        false,
        "a build that answers that way about its own executable"
    );
    assert.equal(isExiftoolUsable('[{"SourceFile":"/x"}]'), true);
});
