"use strict";

/*
 * Saying what the run is doing while it does it: the counting and the wording.
 * Where any of it is displayed is surfaces.js and panel.js; nothing here knows
 * about either, which is the point of the split.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const { createProgress } = require("../../../src/runtime/progress.js");

function recorder() {
    const said = [];

    return {
        said,
        start: (total) => said.push(`start ${total}`),
        report: (done, description, detail) =>
            said.push(`${description} ${done} | ${detail}`),
        pause: () => said.push("pause"),
        close: () => said.push("close")
    };
}

function opened(sink, images = 3) {
    const progress = createProgress([sink]);

    progress.expect(images);

    return progress;
}

test("nothing is complete until something has finished", () => {
    // completedUnitCount holds work that is done. It used to hold the number
    // of the photograph about to be started, so a job of one reported itself
    // complete before the first stamp had been drawn.
    const sink = recorder();
    const progress = opened(sink);

    progress.beginning(1, "one.png");
    progress.finished("Saved");
    progress.beginning(2, "two.png");

    assert.deepEqual(sink.said, [
        "start 3",
        "Reading the photograph 0 | 1 of 3 — one.png",
        "Saved 1 | 1 of 3 — one.png",
        "Reading the photograph 1 | 2 of 3 — two.png"
    ]);
});

test("the label says which photograph, the count says how much is done", () => {
    // Two different things, reported together. The label may say the third of
    // twenty while two are finished.
    const sink = recorder();
    const progress = opened(sink, 20);

    progress.beginning(1, "a.png");
    progress.finished("Saved");
    progress.beginning(2, "b.png");
    progress.finished("Saved");
    progress.beginning(3, "c.png");

    assert.equal(sink.said.at(-1), "Reading the photograph 2 | 3 of 20 — c.png");
});

test("one photograph is one unit, so the two numbers are one number", () => {
    const sink = recorder();

    opened(sink, 7);
    assert.equal(sink.said[0], "start 7");
});

test("the later stages keep the photograph they are working on", () => {
    const sink = recorder();
    const progress = opened(sink, 2);

    progress.beginning(2, "last.png");
    progress.phase("Drawing the stamp");
    progress.phase("Saving the copy");

    assert.deepEqual(sink.said.slice(-2), [
        "Drawing the stamp 0 | 2 of 2 — last.png",
        "Saving the copy 0 | 2 of 2 — last.png"
    ]);
});

test("a photograph that failed is still a photograph that is finished", () => {
    // The count used to move only on publication, so a run of three whose
    // second failed ended at two of three.
    const sink = recorder();
    const progress = opened(sink);

    progress.beginning(1, "a.png");
    progress.finished("Failed");

    assert.equal(sink.said.at(-1), "Failed 1 | 1 of 3 — a.png");
});

test("a name that spans lines is kept to one", () => {
    const sink = recorder();

    opened(sink, 1).beginning(1, "two\nwide\t\tlines .png");
    assert.equal(
        sink.said.at(-1),
        "Reading the photograph 0 | 1 of 1 — two wide lines .png"
    );
});

test("a stage reached before any photograph names none", () => {
    // Which is every stage before they have even been counted: the tools are
    // checked and the folders are read before there is a total.
    const sink = recorder();
    const progress = createProgress([sink]);

    progress.phase("Checking required tools");

    assert.deepEqual(sink.said, ["Checking required tools 0 | "]);
});
