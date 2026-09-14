"use strict";

/*
 * Saving the copy.
 *
 * A copy of a photograph should be the same kind of thing it was, written at
 * a quality nobody has to accept by default, and it should be a photograph:
 * a file with something in it is not one, so the copy is asked its size
 * through the reader that will have to open it.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const { saveCopy } = require("../../../src/runtime/image.js");
const { createFakeHost, WORKSPACE } = require("./fake-host.cjs");
const { makeJob } = require("./fake-job.cjs");

function jobOn(settings = {}) {
    const host = createFakeHost({ files: ["/a/one.jpg"], ...settings });

    return { host, job: { ...makeJob(host), workspace: WORKSPACE } };
}

test("a copy of a photograph is the same kind of thing it was", () => {
    // Compositing adds an alpha band whether the photograph had one or not,
    // and a JPEG has nowhere to put transparency.
    const { host, job } = jobOn();

    saveCopy(job, `${WORKSPACE}/stamped-1.v`, `${WORKSPACE}/staged-1.jpg`, {
        hasAlpha: false,
        size: { width: 600, height: 400 }
    });

    assert.ok(host.commands.some((command) => command.includes("'flatten'")));
});

test("the encoder is told what to do, on the path and nowhere else", () => {
    // vips reads its settings off the path it is given; everything that asks
    // whether the file is there asks about the file.
    const { host, job } = jobOn();

    saveCopy(job, `${WORKSPACE}/stamped-1.v`, `${WORKSPACE}/staged-1.jpg`, {
        hasAlpha: false,
        size: { width: 600, height: 400 }
    });

    assert.ok(host.commands.some(
        (command) => command.includes("'flatten'") && command.includes("staged-1.jpg[Q=90]")
    ));
    assert.ok(host.commands.some(
        (command) => command.startsWith("'/bin/test' '-f'") &&
            !command.includes("[Q=90]")
    ));
});

test("a photograph that had transparency keeps it", () => {
    const { host, job } = jobOn();

    saveCopy(job, `${WORKSPACE}/stamped-1.v`, `${WORKSPACE}/staged-1.png`, {
        hasAlpha: true,
        size: { width: 600, height: 400 }
    });

    assert.ok(host.commands.some((command) => command.includes("'copy'")));
    assert.deepEqual(
        host.commands.filter((command) => command.includes("'flatten'")),
        []
    );
});

test("a copy that was not written is not a copy", () => {
    const { job } = jobOn({ failures: [["flatten", ""]] });

    assert.throws(
        () => saveCopy(job, "/w/stamped-1.v", "/w/staged-1.jpg", {
            hasAlpha: false,
            size: { width: 600, height: 400 }
        }),
        /the stamped copy is not a file with anything in it/u
    );
});

test("a copy that is not the size of the photograph is not the copy", () => {
    // A file with something in it is not a photograph. Asked of the copy
    // itself, through the reader that will have to open it.
    const host = createFakeHost({ files: ["/a/one.jpg"], stampWidth: 90, stampHeight: 20 });
    const job = { ...makeJob(host), workspace: WORKSPACE };

    assert.throws(
        () => saveCopy(job, `${WORKSPACE}/stamped-1.v`, `${WORKSPACE}/stamp-x.jpg`, {
            hasAlpha: false,
            size: { width: 600, height: 400 }
        }),
        /is 90 by 20 pixels where 600 by 400 were expected/u
    );
});

test("either dimension is enough to say the copy is not the photograph", () => {
    const job = { ...makeJob(createFakeHost({ stampHeight: 400 })), workspace: WORKSPACE };

    assert.throws(
        () => saveCopy(job, `${WORKSPACE}/stamped-1.v`, `${WORKSPACE}/stamp-x.jpg`, {
            hasAlpha: false,
            size: { width: 200, height: 399 }
        }),
        /is 200 by 400 pixels where 200 by 399 were expected/u
    );
});
