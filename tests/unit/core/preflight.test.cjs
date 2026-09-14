"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const {
    buildVipsProbeArgv,
    buildExiftoolProbeArgv,
    isVipsUsable,
    isExiftoolUsable,
    describeSetupProblems
} = require("../../../src/core/preflight.js");

test("the vips probe uses the flags the pipeline depends on", () => {
    const argv = buildVipsProbeArgv("/opt/homebrew/bin/vips");

    assert.ok(argv.includes("--size=down"));
    assert.ok(argv.includes("--export-profile"));
    assert.ok(argv.includes("srgb"));
    // Against a path that cannot exist, so nothing is written anywhere.
    assert.ok(argv.some((argument) => /nonexistent/u.test(argument)));
});

test("the exiftool probe asks a question it can answer", () => {
    // It cannot be asked to fail. Measured: `-notaflag` is a request for a
    // tag called "notaflag", not an unknown option, so a build that
    // understands nothing we asked for still says "File not found" exactly
    // as a healthy one does. It is asked about a file certain to be there --
    // its own executable -- with the flags the adapter uses.
    const argv = buildExiftoolProbeArgv("/opt/homebrew/bin/exiftool");

    assert.ok(argv.includes("-json"));
    assert.ok(argv.includes("-n"));
    assert.equal(argv[0], "/opt/homebrew/bin/exiftool");
    assert.equal(argv.at(-1), "/opt/homebrew/bin/exiftool", "asked about itself");
});

test("vips is usable when it got as far as reaching for the file", () => {
    // The real failure for a missing file, which means the flags parsed.
    assert.equal(isVipsUsable('VipsForeignLoad: file "/x.png" does not exist'), true);
    // The real failure for a build that does not know the flag.
    assert.equal(isVipsUsable("Unknown option --export-profile"), false);
    assert.equal(isVipsUsable("Unknown option --size"), false);
});

test("a vips that said nothing at all is not usable", () => {
    // Asking that a particular complaint is absent passes silence, and a
    // binary that crashed before printing anything is silent.
    assert.equal(isVipsUsable(""), false);
    assert.equal(isVipsUsable("Segmentation fault"), false);
    assert.equal(isVipsUsable("dyld: Library not loaded: libvips.42.dylib"), false);
});

test("exiftool is usable only when it answers in the shape that is read", () => {
    // Not a substring of the output but the thing the adapter will do with
    // it: a list, with an entry, naming the file it was asked about.
    assert.equal(
        isExiftoolUsable('[{"SourceFile": "/opt/homebrew/bin/exiftool"}]'),
        true
    );
    assert.equal(isExiftoolUsable("Error: File not found - /x.jpg"), false);
    assert.equal(isExiftoolUsable("[]"), false, "an empty list answers nothing");
    assert.equal(isExiftoolUsable('{"SourceFile": "/x"}'), false, "not a list");
    assert.equal(isExiftoolUsable('[{"FileType": "JPEG"}]'), false, "no source named");
    assert.equal(isExiftoolUsable(""), false);
    assert.equal(isExiftoolUsable("warning\n[{}]"), false, "not parseable");
});

test("a missing tool is described plainly, with the command that fixes it", () => {
    const message = describeSetupProblems(
        [{ tool: "vips", kind: "missing" }],
        true
    );

    assert.match(message, /^Setup needed\./u);
    assert.match(message, /- vips is not installed\./u);
    assert.match(message, /brew install exiftool vips/u);
});

test("an outdated tool says so, and names the flags it lacks", () => {
    // "Installed" and "works" are different things, and the difference is
    // exactly what sends someone chasing a validation error instead.
    const message = describeSetupProblems(
        [{ tool: "vips", kind: "unusable", flags: "--size=down" }],
        true
    );

    assert.match(message, /vips is installed but does not do what this needs/u);
    assert.match(message, /--size=down/u);
});

test("every problem is reported at once, not just the first", () => {
    const message = describeSetupProblems(
        [
            { tool: "vips", kind: "missing" },
            { tool: "vipsheader", kind: "missing" },
            { tool: "exiftool", kind: "unusable", flags: "answer in JSON" }
        ],
        true
    );

    // One per line: run together they read as a single sentence about a tool
    // that does not exist, which is worse than reporting only the first.
    assert.deepEqual(message.split("\n\n")[1].split("\n"), [
        "- vips is not installed.",
        "- vipsheader is not installed.",
        "- exiftool is installed but does not do what this needs: answer in JSON."
    ]);
});

test("without Homebrew, the message does not assume brew exists", () => {
    const message = describeSetupProblems([{ tool: "vips", kind: "missing" }], false);

    assert.match(message, /Install Homebrew first/u);
    assert.match(message, /https:\/\/brew\.sh/u);
    assert.match(message, /brew install exiftool vips/u);
});

test("the vips probe names a file that cannot exist", () => {
    // Run the real tool with the real flags against a path certain to be
    // absent, so a build that understands the flags fails on the file and one
    // that does not fails on the flag. An empty or plausible path would make
    // the probe a real conversion. exiftool is the other way round, and is
    // covered above.
    const argvs = [buildVipsProbeArgv("/v/vips")];

    for (const argv of argvs) {
        const absent = argv.filter((argument) =>
            String(argument).includes("nonexistent-stamp-images-preflight"));

        assert.ok(absent.length > 0, `no impossible path in ${argv.join(" ")}`);

        for (const argument of argv) {
            assert.notEqual(argument, "", "an empty argument is not a probe");
        }
    }
});
