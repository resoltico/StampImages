"use strict";

/*
 * Which drawings a run keeps, and what makes two of them different.
 *
 * A drawing is the words and the colour space together: the same caption
 * painted for a Display P3 photograph is different numbers from the same
 * caption painted for an sRGB one. And the cache is for photographs that say
 * the same thing, which is a burst taken in one minute -- so it is bounded,
 * because a thousand different inscriptions would leave a thousand files in
 * the workspace to serve a hit rate of nothing.
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

test("the colour is moved into the photograph's space before it is painted", () => {
    const { host, job } = jobOn();

    stampFor(job, { text: "Riga", profile: { path: "/w/profile-1.icc", failed: false } });
    assert.ok(host.commands.some(
        (command) => command.includes("'icc_transform'") &&
            command.includes("'/w/profile-1.icc'")
    ));
});

test("a colour that could not be moved is painted as it is, and said so", () => {
    const host = createFakeHost({
        failures: [["icc_transform", new Error("vips: bad profile")]]
    });
    const job = { ...makeJob(host), workspace: WORKSPACE };
    const stamp = stampFor(job, { text: "Riga", profile: { path: "/w/profile-1.icc", failed: false } });

    assert.equal(stamp.moved, false);
    assert.ok(stamp.path.length > 0, "and the stamp is still drawn");
});

test("the same words for two colour spaces are two drawings", () => {
    const { job } = jobOn();
    const plain = stampFor(job, { text: "Riga", profile: { path: "", failed: false } });
    const wide = stampFor(job, { text: "Riga", profile: "/w/p3.icc" });

    assert.notEqual(wide.path, plain.path);
    assert.equal(job.stamps.size, 2);
});

test("a profile that could not be read is not a photograph without one", () => {
    // Two spaces that share a path, and two different verdicts: no profile is
    // drawn in sRGB and reported as handled, an unreadable one is drawn in
    // sRGB and counted as unconverted. Keyed on the path alone the second took
    // the first's drawing and with it the first's verdict, so a photograph
    // this program could not read the colours of was reported as one whose
    // colours were fine.
    const { job } = jobOn();
    const none = stampFor(job, { text: "Riga", profile: { path: "", failed: false } });
    const unreadable = stampFor(job, { text: "Riga", profile: { path: "", failed: true } });

    assert.notEqual(unreadable.path, none.path);
    assert.equal(none.moved, true);
    assert.equal(unreadable.moved, false, "and it is counted, not assumed away");
    assert.equal(job.stamps.size, 2);
});

test("the drawings a run keeps are bounded, and an evicted one goes", () => {
    // The cache is for photographs that say the same thing, which is a burst
    // taken in one minute. A thousand different inscriptions would otherwise
    // leave a thousand files to serve a hit rate of nothing.
    const { host, job } = jobOn();

    for (let index = 0; index < 12; index += 1) {
        stampFor(job, { text: `Riga ${index}`, profile: { path: "", failed: false } });
    }

    assert.equal(job.stamps.size, 8);
    assert.equal(
        [...host.files].filter((file) => (/\/stamp-\d+\.png$/u).test(file)).length,
        8
    );
});

test("the same text is drawn once, however many photographs carry it", () => {
    const { host, job } = jobOn();
    const first = stampFor(job, { text: "Riga", profile: { path: "", failed: false } });
    const again = stampFor(job, { text: "Riga", profile: { path: "", failed: false } });

    assert.equal(again, first);
    assert.equal(operations(host).filter((each) => each === "text").length, 1);
});

test("different text is a different stamp, with its own files", () => {
    const { job } = jobOn();

    assert.notEqual(stampFor(job, { text: "Riga", profile: { path: "", failed: false } }).path, stampFor(job, { text: "Liepāja", profile: { path: "", failed: false } }).path);
    assert.equal(job.stamps.size, 2);
});
