"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const {
    buildVipsProbeArgv,
    buildExiftoolProbeArgv,
    isVipsUsable,
    isExiftoolUsable,
    describeSetupProblems
} = require("../../../src/backend/preflight.js");

test("the vips probe uses the flags the pipeline depends on", () => {
    const argv = buildVipsProbeArgv("/opt/homebrew/bin/vips");

    assert.ok(argv.includes("--size=down"));
    assert.ok(argv.includes("--export-profile"));
    assert.ok(argv.includes("srgb"));
    assert.ok(argv.includes("--fail-on=warning"));
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

test("vipsheader is tested with a bounded built-in RGB PNG and an exact width response", () => {
    const { VIPSHEADER_PROBE_IMAGE, buildVipsheaderProbeArgv, isVipsheaderUsable } = require("../../../src/backend/preflight.js");
    const { Buffer } = require("node:buffer");
    const bytes = Buffer.from([...VIPSHEADER_PROBE_IMAGE.matchAll(/\\0(?<octal>[0-7]{3})/gu)].map((match) => Number.parseInt(match.groups.octal, 8)));
    assert.equal(bytes.length, 69);
    assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
    assert.equal(bytes.readUInt32BE(16), 1);
    assert.equal(bytes.readUInt32BE(20), 1);
    assert.deepEqual(buildVipsheaderProbeArgv("/tools/header"), ["/tools/header", "-f", "width"]);
    for (const text of ["1", "1\n", " 1 "]) { assert.equal(isVipsheaderUsable(text), true); }
    for (const text of ["", "900", "width: 1", "1\nwarning", "not an image"]) { assert.equal(isVipsheaderUsable(text), false); }
});

test("override-only refusals give override advice without an unrelated Homebrew install", () => {
    const override = { tool: "vipsheader", kind: "unusable", override: { name: "STAMP_IMAGES_VIPSHEADER", value: "/usr/bin/false" } };
    const text = describeSetupProblems([override], true);
    assert.match(text, /STAMP_IMAGES_VIPSHEADER="\/usr\/bin\/false"/u);
    assert.match(text, /Fix or unset the named tool overrides, then try again\./u);
    assert.doesNotMatch(text, /brew|Homebrew/u);
    assert.equal(describeSetupProblems([{ tool: "vipsheader", kind: "unusable" }], true).includes("vipsheader could not read the built-in PNG image."), true);
    const mixed = describeSetupProblems([override, { tool: "vips", kind: "missing" }], true);
    assert.match(mixed, /Fix or unset/u);
    assert.match(mixed, /brew install exiftool vips/u);
});

test("setup advice preserves distinct missing, upgrade and override actions with one blank line per section", () => {
    assert.equal(describeSetupProblems([{ tool: "vips", kind: "missing" }], true), "Setup needed.\n\n- vips is not installed.\n\nRun this in Terminal:\n\nbrew install exiftool vips");
    assert.equal(describeSetupProblems([{ tool: "vips", kind: "missing" }, { tool: "exiftool", kind: "unusable", flags: "answer JSON" }], true), "Setup needed.\n\n- vips is not installed.\n- exiftool is installed but does not do what this needs: answer JSON.\n\nRun this in Terminal:\n\nbrew install exiftool vips\nbrew upgrade exiftool vips");
    const override = { tool: "vipsheader", kind: "unusable", override: { name: "STAMP_IMAGES_VIPSHEADER", value: "/usr/bin/false" } };
    assert.equal(describeSetupProblems([override], true), 'Setup needed.\n\n- STAMP_IMAGES_VIPSHEADER="/usr/bin/false" is not usable as vipsheader.\n\nFix or unset the named tool overrides, then try again.');
    assert.equal(describeSetupProblems([override, { tool: "vips", kind: "missing" }], true), 'Setup needed.\n\n- STAMP_IMAGES_VIPSHEADER="/usr/bin/false" is not usable as vipsheader.\n- vips is not installed.\n\nFix or unset the named tool overrides, then try again.\n\nRun this in Terminal:\n\nbrew install exiftool vips');
});
