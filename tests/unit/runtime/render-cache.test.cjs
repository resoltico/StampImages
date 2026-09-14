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

    stampFor(job, { text: "Riga", profile: "/w/profile-1-a.icc" });
    assert.ok(host.commands.some(
        (command) => command.includes("'icc_transform'") &&
            command.includes("'/w/profile-1-a.icc'")
    ));
});

test("a colour that could not be moved is painted as it is, and said so", () => {
    const host = createFakeHost({
        failures: [["icc_transform", new Error("vips: bad profile")]]
    });
    const job = { ...makeJob(host), workspace: WORKSPACE };
    const stamp = stampFor(job, { text: "Riga", profile: "/w/profile-1-a.icc" });

    assert.equal(stamp.moved, false);
    assert.ok(stamp.path.length > 0, "and the stamp is still drawn");
});

test("the same words for two colour spaces are two drawings", () => {
    const { job } = jobOn();
    const plain = stampFor(job, { text: "Riga", profile: "" });
    const wide = stampFor(job, { text: "Riga", profile: "/w/p3.icc" });

    assert.notEqual(wide.path, plain.path);
    assert.equal(job.stamps.size, 2);
});

test("the drawings a run keeps are bounded, and an evicted one goes", () => {
    // The cache is for photographs that say the same thing, which is a burst
    // taken in one minute. A thousand different inscriptions would otherwise
    // leave a thousand files to serve a hit rate of nothing.
    const { host, job } = jobOn();

    for (let index = 0; index < 12; index += 1) {
        stampFor(job, { text: `Riga ${index}`, profile: "" });
    }

    assert.equal(job.stamps.size, 8);
    assert.equal(
        [...host.files].filter((file) => (/\/stamp-\d+\.png$/u).test(file)).length,
        8
    );
});

test("the same text is drawn once, however many photographs carry it", () => {
    const { host, job } = jobOn();
    const first = stampFor(job, { text: "Riga", profile: "" });
    const again = stampFor(job, { text: "Riga", profile: "" });

    assert.equal(again, first);
    assert.equal(operations(host).filter((each) => each === "text").length, 1);
});

test("different text is a different stamp, with its own files", () => {
    const { job } = jobOn();

    assert.notEqual(stampFor(job, { text: "Riga", profile: "" }).path, stampFor(job, { text: "Liepāja", profile: "" }).path);
    assert.equal(job.stamps.size, 2);
});
