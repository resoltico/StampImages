"use strict";

/*
 * Taking one photograph from the file that was selected to a stamped copy.
 *
 * Every stage reads one file and writes another, in a workspace of this run's
 * own, and the source is never opened for writing.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const {
    readPhotograph,
    composite
} = require("../../../src/runtime/image.js");
const { bandsOf } = require("../../../src/runtime/fidelity.js");
const { createFakeHost, WORKSPACE } = require("./fake-host.cjs");
const { makeJob } = require("./fake-job.cjs");

function jobOn(settings = {}) {
    const host = createFakeHost({ files: ["/a/one.jpg"], ...settings });

    return { host, job: { ...makeJob(host), workspace: WORKSPACE } };
}

test("orientation is applied rather than carried", () => {
    // A photograph whose tag says to rotate it is shown rotated by everything
    // that displays it, so a stamp composited first would sit along an edge
    // the viewer never sees as the bottom.
    const { host, job } = jobOn();
    const photograph = readPhotograph(job, "/a/one.jpg", "1");

    assert.equal(photograph.path, `${WORKSPACE}/oriented-1.v`);
    assert.ok(host.commands.some((command) => command.includes("'autorot'")));
    assert.deepEqual(photograph.size, { width: 600, height: 400 });
});

test("a photograph that produced nothing is not a photograph", () => {
    const { job } = jobOn({ failures: [["autorot", ""]] });

    assert.throws(
        () => readPhotograph(job, "/a/one.jpg", "1"),
        /the photograph is not a file with anything in it/u
    );
});

test("an even band count is the alpha, after orientation", () => {
    // Oriented, a photograph is one band or three without transparency, so
    // two and four are the ones that carry it.
    assert.equal(bandsOf(jobOn({ bands: 3 }).job, "/a/one.jpg"), 3);

    for (const [bands, hasAlpha] of [[1, false], [2, true], [3, false], [4, true]]) {
        assert.equal(
            readPhotograph(jobOn({ bands }).job, "/a/one.jpg", "1").hasAlpha,
            hasAlpha,
            `${bands} bands`
        );
    }
});

test("the stamp is composited where it was placed", () => {
    const { host, job } = jobOn();
    const stamped = composite(job, { path: `${WORKSPACE}/oriented-1.v` }, {
        path: `${WORKSPACE}/stamp-1.png`,
        at: { left: 384, top: 344 }
    }, "1");

    assert.equal(stamped, `${WORKSPACE}/stamped-1.v`);
    assert.ok(host.commands.some(
        (command) => command.includes("'composite2'") &&
            command.includes("'--x' '384' '--y' '344'")
    ));
});
