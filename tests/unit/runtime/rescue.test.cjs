"use strict";

/*
 * Setting aside a copy that could not be published.
 *
 * It has been imported and validated by the time this runs, and the workspace
 * it sits in is removed as soon as the run ends — so where it goes is the
 * difference between a recoverable failure and lost work.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const { setAside } = require("../../../src/runtime/rescue.js");
const { createFakeHost } = require("./fake-host.cjs");

const RECOVERY = "/var/folders/xx/T/StampImages-recovered.Fake01";

test("the copy is moved out of the workspace, keeping its name", () => {
    const host = createFakeHost({ files: ["/tmp/ws/staged-1.jpg"] });
    const recovered = setAside(host, "/tmp/ws/staged-1.jpg");

    assert.match(recovered, /staged-1\.jpg$/u, recovered);
    assert.ok(host.files.has(recovered), "it must exist where it was put");
    assert.ok(!host.files.has("/tmp/ws/staged-1.jpg"), "and not where it was");
});

test("the folder it goes to is made for the purpose", () => {
    const host = createFakeHost({ files: ["/tmp/ws/staged-1.jpg"] });

    setAside(host, "/tmp/ws/staged-1.jpg");

    const made = host.commands.find((command) => command.includes("mktemp"));

    assert.match(made, /'-d'/u, "a directory, not a file");
    assert.match(made, /StampImages-recovered/u, "named so it can be found");
});

test("a copy that cannot be moved stays where it was, and says so", () => {
    // Best effort. Claiming a rescue that did not happen would send someone
    // to a folder with nothing in it.
    const host = createFakeHost({
        files: ["/tmp/ws/staged-1.jpg"],
        failures: [["/bin/mv", new Error("Operation not permitted")]]
    });

    assert.equal(setAside(host, "/tmp/ws/staged-1.jpg"), "/tmp/ws/staged-1.jpg");
    assert.ok(host.files.has("/tmp/ws/staged-1.jpg"), "and it is still there");
});

test("a folder that cannot be made leaves the copy where it was", () => {
    const host = createFakeHost({
        files: ["/tmp/ws/staged-1.jpg"],
        failures: [["mktemp", new Error("no space left")]]
    });

    assert.equal(setAside(host, "/tmp/ws/staged-1.jpg"), "/tmp/ws/staged-1.jpg");
});

test("the prefix is passed as a prefix, not as a template", () => {
    // Without -t, mktemp reads the argument as a template and requires the
    // trailing X's; the folder is never made and the rescue never happens.
    const host = createFakeHost({ files: ["/tmp/ws/staged-1.jpg"] });

    setAside(host, "/tmp/ws/staged-1.jpg");

    assert.equal(
        host.commands.find((command) => command.includes("mktemp")),
        "'/usr/bin/mktemp' '-d' '-t' 'StampImages-recovered'"
    );
});

test("a host that answers with something other than a string still works", () => {
    // doShellScript answers through the ObjC bridge, and what comes back is
    // not always a JavaScript string. Trimming it directly would throw, and
    // the rescue would silently become a no-op.
    const host = createFakeHost({ files: ["/tmp/ws/staged-1.jpg"] });
    const { doShellScript } = host;

    host.doShellScript = (command) => ({
        toString: () => doShellScript(command)
    });

    assert.equal(
        setAside(host, "/tmp/ws/staged-1.jpg"),
        `${RECOVERY}/staged-1.jpg`
    );
});
