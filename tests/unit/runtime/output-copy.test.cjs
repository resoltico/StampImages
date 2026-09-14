"use strict";

/*
 * Copying the copy into the output folder, which happens when it cannot be
 * linked there from the workspace.
 *
 * It goes into a place this run made rather than a name this run found: mkdir
 * either creates the directory or fails, and it fails for anything already at
 * that name. So what is inside it is this attempt's, which is what makes
 * copying into it and clearing it away afterwards safe.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const { publishImage } = require("../../../src/runtime/publish.js");
const { copyBeside } = require("../../../src/runtime/output-copy.js");
const { createFakeHost } = require("./fake-host.cjs");
const { makeJob } = require("./fake-job.cjs");

const DIRECT_CLAIM = "ln' '/a/staged-1.jpg'";
const STAGED_FACTS = "stat' '-f%d:%i:%z' '/a/.StampImages";
const AREA = {
    directory: "/a/.StampImages-test",
    file: "/a/.StampImages-test/ready.jpg"
};

test("a place that cannot be made is not one this run may clear away", () => {
    // Anything at all at that name -- a file, a folder, a link, a named pipe
    // -- and mkdir fails. Opening a name instead accepted a link pointing at
    // something that is not a regular file, and the run went on to record a
    // name it did not own.
    for (const settings of [
        { files: ["/a/staged-1.jpg", AREA.directory] },
        { files: ["/a/staged-1.jpg"], directories: [AREA.directory] },
        { files: ["/a/staged-1.jpg"], danglingLinks: [AREA.directory] }
    ]) {
        const host = createFakeHost(settings);
        const outcome = copyBeside(host, "/a/staged-1.jpg", AREA, 1024);

        assert.equal(outcome.made, false, "nothing of it is this run's");
        assert.match(outcome.reasons[0], /File exists/u);
        assert.match(
            outcome.reasons[0],
            /making a place for the copy in the output folder/u,
            "and which step it was"
        );
        assert.equal(
            host.commands.filter((command) => command.includes("/bin/cp")).length,
            0,
            "and nothing was written into it"
        );
    }
});

test("a copy that failed still made the place it was going into", () => {
    // cp leaves the destination in place after an error and can fail after
    // writing part of the file or all of it. The place was made before it
    // ran, so it is this attempt's to clear away either way.
    const host = createFakeHost({
        files: ["/a/staged-1.jpg"],
        failures: [["/bin/cp", new Error("cp: no space left on device")]]
    });
    const outcome = copyBeside(host, "/a/staged-1.jpg", AREA, 1024);

    assert.equal(outcome.made, true);
    assert.match(outcome.reasons[0], /no space left/u);
});

test("a copy is checked against the size it should have", () => {
    const host = createFakeHost({
        files: ["/a/staged-1.jpg"],
        failures: [[`stat' '-f%d:%i:%z' '${AREA.file}'`, "16777232:5:7"]]
    });
    const outcome = copyBeside(host, "/a/staged-1.jpg", AREA, 1024);

    assert.equal(outcome.made, true, "and it is still this run's to clear away");
    assert.match(outcome.reasons[0], /7 bytes where 1024 were expected/u);
});

test("a source that could not be measured is never copied successfully", () => {
    const host = createFakeHost({ files: ["/a/staged-1.jpg"] });
    const outcome = copyBeside(host, "/a/staged-1.jpg", AREA, -1);

    assert.match(outcome.reasons[0], /-1 were expected/u);
});

test("neither file being measurable is not a match", () => {
    // Two unknown sizes are equal to each other. Without the explicit check
    // for an unknown expectation, a copy nobody could measure would pass.
    const host = createFakeHost({
        files: ["/a/staged-1.jpg"],
        failures: [["/usr/bin/stat", new Error("stat: denied")]]
    });
    const outcome = copyBeside(host, "/a/staged-1.jpg", AREA, -1);

    assert.deepEqual(outcome.reasons, ["the staged file is -1 bytes where -1 were expected"]);
});

test("a truncated copy never wears the finished copy's name", () => {
    const host = createFakeHost({
        files: ["/a/staged-1.jpg"],
        failures: [
            [DIRECT_CLAIM, new Error("Operation not permitted")],
            [STAGED_FACTS, "16777232:5:7"]
        ]
    });

    assert.throws(
        () => publishImage(makeJob(host), "/a/staged-1.jpg", () => "/a/photo_stamped.jpg"),
        /7 bytes where 1024 were expected/u
    );
    assert.ok(!host.files.has("/a/photo_stamped.jpg"), "and nothing is at the output name");
    assert.deepEqual(
        [...host.files].filter((file) => file.includes(".StampImages")),
        [],
        "and the place it was copied into is gone"
    );
});

test("a copy that is not the same bytes is not a copy", () => {
    // Two files of one length are not two files of the same contents, and a
    // copy that failed part way through can be both.
    const host = createFakeHost({
        files: ["/a/staged-1.jpg"],
        failures: [["/usr/bin/cmp", new Error("files differ")]]
    });
    const outcome = copyBeside(host, "/a/staged-1.jpg", AREA, 1024);

    assert.match(outcome.reasons[0], /not the same file/u);
    assert.equal(outcome.identity, undefined);
});
