"use strict";

/*
 * Drawing the stamp: a small image with a transparent background, to be
 * composited onto a photograph.
 *
 * The text is drawn as a coverage mask -- one band saying how much of each
 * pixel the glyphs cover -- which is what makes the colour a separate
 * decision. The same mask, grown by a maximum filter, is the outline.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const { stampFor } = require("../../../src/runtime/render.js");
const { createFakeHost, WORKSPACE } = require("./fake-host.cjs");
const { makeJob } = require("./fake-job.cjs");

function jobOn(settings = {}) {
    const host = createFakeHost();

    return { host, job: { ...makeJob(host, settings), workspace: WORKSPACE } };
}

function operations(host) {
    return host.commands
        .filter((command) => command.includes("/vips'"))
        .map((command) => command.split("' '")[1]);
}

test("the glyphs are drawn once and coloured, and the outline grown from them", () => {
    const { host, job } = jobOn();
    const stamp = stampFor(job, { text: "Riga", profile: "" });

    assert.equal(stamp.path, `${WORKSPACE}/stamp-1.png`);
    assert.deepEqual(stamp.size, { width: 200, height: 60 });
    assert.deepEqual(operations(host), [
        "text",
        "embed",
        "black",
        "linear",
        "bandjoin",
        "rank",
        "black",
        "linear",
        "bandjoin",
        "composite2"
    ]);
});

test("the mask is drawn with the font and size that were asked for", () => {
    const { host, job } = jobOn({ font: "Menlo Bold", size: 72 });

    stampFor(job, { text: "Riga", profile: "" });
    assert.ok(host.commands.some(
        (command) => command.includes("'--font' 'Menlo Bold 72'")
    ));
});

test("an outline of nothing is not drawn at all", () => {
    // A zero-pixel dilation is a copy and a composite for no visible
    // difference -- and with no outline there is nothing to make room for,
    // so the mask is not embedded either.
    const { host, job } = jobOn({ outlineWidth: 0 });
    const stamp = stampFor(job, { text: "Riga", profile: "" });

    assert.equal(stamp.path, `${WORKSPACE}/stamp-1-face.png`);
    assert.deepEqual(operations(host), ["text", "black", "linear", "bandjoin"]);
});

test("the drawing is given the room the outline will grow into", () => {
    // vips rank keeps its input's dimensions, so an outline grown without a
    // border is shaved flat against the glyphs on all four sides.
    const { host, job } = jobOn({ outlineWidth: 3 });
    const stamp = stampFor(job, { text: "Riga", profile: "" });
    const embedded = host.commands.find((command) => command.includes("'embed'"));

    assert.match(embedded, /'3' '3' '206' '66'/u);
    assert.deepEqual(stamp.size, { width: 200, height: 60 });
});

test("what the drawing was made from does not outlive it", () => {
    const { host, job } = jobOn();

    stampFor(job, { text: "Riga", profile: "" });

    const left = [...host.files].filter((path) => path.includes("stamp-1"));

    assert.deepEqual(left, [`${WORKSPACE}/stamp-1.png`]);
});


test("a drawing that produced nothing is not a drawing", () => {
    const host = createFakeHost({ failures: [["'text'", ""]] });
    const job = { ...makeJob(host), workspace: WORKSPACE };

    assert.throws(
        () => stampFor(job, { text: "Riga", profile: "" }),
        /the drawn text is not a file with anything in it/u
    );
});

test("a stamp that was not assembled is not a stamp", () => {
    const host = createFakeHost({ failures: [["'composite2'", ""]] });
    const job = { ...makeJob(host), workspace: WORKSPACE };

    assert.throws(
        () => stampFor(job, { text: "Riga", profile: "" }),
        /the stamp is not a file with anything in it/u
    );
});
