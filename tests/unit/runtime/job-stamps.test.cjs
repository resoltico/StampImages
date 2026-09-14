"use strict";

/*
 * What the batch does with the work each photograph has in common with the
 * next: one drawing per distinct text, composited onto each photograph, and
 * nothing kept afterwards that the run does not still need.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const { runJob } = require("../../../src/runtime/job.js");
const { createFakeHost, WORKSPACE } = require("./fake-host.cjs");
const { makeJob, imageOf } = require("./fake-job.cjs");

function jobOn(host, settings) {
    return { ...makeJob(host, settings), workspace: WORKSPACE };
}

function photographs(...paths) {
    return paths.map(imageOf);
}

test("the stamp is composited onto the photograph, at a place", () => {
    // Where that place is is geometry's business; that the stamp and its
    // placement reach the command at all is this one's.
    const host = createFakeHost({ files: ["/a/one.jpg"] });

    runJob(jobOn(host), photographs("/a/one.jpg"));

    const stamping = host.commands.find(
        (command) => command.includes("'composite2'") && command.includes("oriented-1.v")
    );

    assert.match(stamping, /stamp-1\.png'/u);
    assert.match(stamping, /'--x' '\d+' '--y' '\d+'$/u);
});

test("what a photograph needed is removed by name, and nothing else is", () => {
    // The parts of the drawing go as soon as it is one file; the photograph's
    // own stages go as soon as its copy is written; the copy goes when it has
    // been published. Nothing else in the workspace is removed by name.
    const host = createFakeHost({ files: ["/a/one.jpg"] });

    runJob(jobOn(host), photographs("/a/one.jpg"));

    const removed = host.commands
        .filter((command) => command.startsWith("'/bin/rm' '-f'"))
        .map((command) => command.split("' '").at(-1).replace(/'$/u, ""))
        .map((path) => path.replace(`${WORKSPACE}/`, ""));

    assert.deepEqual(removed, [
        "stamp-1-face-raw.png",
        "stamp-1-face-mask.png",
        "stamp-1-face-solid.v",
        "stamp-1-face-colour.v",
        "stamp-1-face-moved.v",
        "stamp-1-face.png",
        "stamp-1-edge-raw.png",
        "stamp-1-edge-mask.png",
        "stamp-1-edge-solid.v",
        "stamp-1-edge-colour.v",
        "stamp-1-edge-moved.v",
        "stamp-1-edge.png",
        "oriented-1.v",
        "stamped-1.v",
        "staged-1.jpg"
    ]);
});

test("what the photographs are stamped with is drawn once for the run", () => {
    // Two photographs taken in the same minute in the same place want the
    // same stamp, and drawing it is several invocations of vips.
    const host = createFakeHost({ files: ["/a/one.jpg", "/a/two.jpg"] });
    const job = jobOn(host);

    runJob(job, photographs("/a/one.jpg", "/a/two.jpg"));

    assert.equal(job.stamps.size, 1);
    assert.equal(
        host.commands.filter((command) => command.includes("'text'")).length,
        1
    );
});

test("photographs that say different things get different stamps", () => {
    const host = createFakeHost({
        files: ["/a/one.jpg", "/a/two.jpg"],
        metadata: [["/a/one.jpg", { DateTimeOriginal: "2026:09:09 14:30:00" }]]
    });
    const job = jobOn(host);

    runJob(job, photographs("/a/one.jpg", "/a/two.jpg"));
    assert.equal(job.stamps.size, 2);
});

test("a margin that could not be honoured is counted, not concealed", () => {
    // The whole stamp is still visible, and a margin is a request rather than
    // a promise -- but a run that quietly did something else should say so.
    const host = createFakeHost({ files: ["/a/one.jpg"] });
    const result = runJob(jobOn(host, { margin: 400 }), photographs("/a/one.jpg"));

    assert.deepEqual(result.outputs, ["/a/one_stamped.jpg"]);
    assert.equal(result.crowded, 1);
});

test("a margin with room for it is not counted", () => {
    const host = createFakeHost({ files: ["/a/one.jpg"] });
    const result = runJob(jobOn(host, { margin: 10 }), photographs("/a/one.jpg"));

    assert.equal(result.crowded, 0);
});

test("a photograph whose colour space could not be read is counted", () => {
    // The stamp is drawn in plain sRGB, which is what every copy was before
    // the colour was moved at all -- and the run says so rather than nothing.
    const host = createFakeHost({
        files: ["/a/one.jpg"],
        profiles: [["/a/one.jpg", "Display P3"]],
        failures: [["icc_transform", new Error("vips: bad profile")]]
    });
    const result = runJob(jobOn(host), photographs("/a/one.jpg"));

    assert.deepEqual(result.outputs, ["/a/one_stamped.jpg"]);
    assert.equal(result.unconverted, 1);
});

test("a photograph whose colour space was read is not counted", () => {
    const host = createFakeHost({
        files: ["/a/one.jpg"],
        profiles: [["/a/one.jpg", "Display P3"]]
    });
    const result = runJob(jobOn(host), photographs("/a/one.jpg"));

    assert.equal(result.unconverted, 0);
    assert.ok(host.commands.some((command) => command.includes("'icc_transform'")));
});
