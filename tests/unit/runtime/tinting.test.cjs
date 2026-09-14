"use strict";

/*
 * Giving a coverage mask a colour.
 *
 * A mask says how much of each pixel a glyph covers and nothing about what
 * colour it is, which is what lets one drawing serve both the text and its
 * outline. Colour is a solid image with the mask for its alpha: the edge of a
 * glyph keeps the softness the renderer gave it, where painting the mask
 * directly would cut it to a hard shape.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const {
    sizeOf,
    tinted,
    pathsFor,
    filesOf
} = require("../../../src/runtime/tinting.js");
const { createFakeHost, WORKSPACE } = require("./fake-host.cjs");
const { makeJob } = require("./fake-job.cjs");

function jobOn(settings = {}) {
    const host = createFakeHost(settings);

    return { host, job: { ...makeJob(host), workspace: WORKSPACE } };
}

test("every file a stage writes is named for that stage and this drawing", () => {
    // Two stages share a token and differ in one word, so a file from one
    // cannot be read as a file from the other.
    assert.deepEqual(pathsFor("/w", "2", "edge"), {
        raw: "/w/stamp-2-edge-raw.png",
        mask: "/w/stamp-2-edge-mask.png",
        solid: "/w/stamp-2-edge-solid.v",
        colour: "/w/stamp-2-edge-colour.v",
        moved: "/w/stamp-2-edge-moved.v",
        out: "/w/stamp-2-edge.png"
    });

    const face = pathsFor("/w", "2", "face");

    for (const key of Object.keys(face)) {
        assert.notEqual(face[key], pathsFor("/w", "2", "edge")[key], key);
    }
});

test("every file one layer made is one the run can clear away", () => {
    // A batch of photographs taken over an hour has a distinct stamp for
    // nearly every one of them, so the parts of the last one are not
    // something to keep.
    const paths = pathsFor("/w", "1", "face");

    assert.deepEqual(filesOf(paths), Object.values(paths));
});

test("a drawing is measured in both directions, one question each", () => {
    const { host, job } = jobOn({ width: 180, height: 64 });

    assert.deepEqual(sizeOf(job, "/w/mask.png"), { width: 180, height: 64 });
    assert.deepEqual(
        host.commands.map((command) => command.split("' '")[2]),
        ["width", "height"]
    );
});

test("a measurement that cannot be taken says what was being measured", () => {
    const { job } = jobOn({ failures: [["'width'", new Error("no header")]] });

    assert.throws(
        () => sizeOf(job, "/w/mask.png"),
        /Command failed while measuring the stamp\./u
    );
});

test("the colour is a solid the size of the drawing, with the mask for alpha", () => {
    const { host, job } = jobOn();
    const paths = pathsFor(WORKSPACE, "1", "face");
    const out = tinted(job, paths, "#FF8000", {
        size: { width: 180, height: 64 },
        profile: ""
    });

    assert.equal(out.path, paths.out);
    assert.equal(out.moved, true, "nothing to move it into");
    assert.deepEqual(host.commands.map((command) => command.split("' '")[1]), [
        "black",
        "linear",
        "bandjoin"
    ]);
    assert.ok(host.commands[0].includes("'180' '64' '--bands' '3'"));
    assert.ok(host.commands[1].includes("'255 128 0'"));
    assert.ok(host.commands[2].includes(`'${paths.colour} ${paths.mask}'`));
});
