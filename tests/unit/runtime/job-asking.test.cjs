"use strict";

/*
 * What the batch asks each photograph, and what it makes of the answer.
 *
 * The cheap question first: what the stamp will say is settled before the
 * photograph is decoded, so one the request does not apply to costs a call to
 * exiftool and nothing else -- and a run that wants nothing from the
 * metadata does not make even that call.
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

test("a photograph the request does not apply to is neither a copy nor a failure", () => {
    // A scan with no shutter time, in a run that asked for the date, is not a
    // failure of anything -- and calling it one made a folder of old
    // photographs read as a disaster.
    const host = createFakeHost({ files: ["/a/scan.png"] });
    const job = jobOn(host, { customText: "", coordinateFormat: "none" });
    const result = runJob(job, photographs("/a/scan.png"));

    assert.deepEqual(result.outputs, []);
    assert.deepEqual(result.failures, []);
    assert.equal(result.nothing.length, 1);
    assert.equal(result.nothing[0].name, "scan.png");
    assert.match(result.nothing[0].reason, /does not say when it was taken/u);
    assert.equal(host.files.has("/a/scan_stamped.png"), false);
});

test("a photograph with nothing to stamp costs one question and no decoding", () => {
    // The cheap question first: a photograph this request does not apply to
    // should cost a call to exiftool and nothing else.
    const host = createFakeHost({ files: ["/a/scan.png"] });

    runJob(jobOn(host, { customText: "", coordinateFormat: "none" }),
        photographs("/a/scan.png"));

    assert.deepEqual(
        host.commands.filter((command) => command.includes("'autorot'")),
        []
    );
});

test("a run that wants no metadata asks the photograph for none", () => {
    // A caption of your own is not a question for the photograph, and a run
    // that asks anyway is a run that can fail on a metadata reader it never
    // needed.
    const host = createFakeHost({ files: ["/a/one.jpg"] });
    const job = jobOn(host, {
        dateFormat: "none",
        coordinateFormat: "none",
        customText: "Riga"
    });
    const result = runJob(job, photographs("/a/one.jpg"));

    assert.deepEqual(result.outputs, ["/a/one_stamped.jpg"]);
    assert.deepEqual(
        host.commands.filter((command) => command.includes("'-json'")),
        []
    );
});

test("and one that cannot read metadata still stamps what was typed", () => {
    const host = createFakeHost({
        files: ["/a/one.jpg"],
        failures: [["-json", new Error("exiftool: killed")]]
    });
    const job = jobOn(host, {
        dateFormat: "none",
        coordinateFormat: "none",
        customText: "Riga"
    });

    assert.deepEqual(
        runJob(job, photographs("/a/one.jpg")).outputs,
        ["/a/one_stamped.jpg"]
    );
});
