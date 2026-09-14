"use strict";

/*
 * What exiftool says about one photograph, and the difference between a
 * photograph that says nothing and a question that could not be put.
 *
 * Those used to be the same thing here, so a broken exiftool produced a
 * folder of copies with no date on them and a report saying everything had
 * worked. A run that does not know says so.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const { factsFor } = require("../../../src/runtime/facts.js");
const { createFakeHost } = require("./fake-host.cjs");
const { makeJob } = require("./fake-job.cjs");

const TAKEN = {
    DateTimeOriginal: "2026:09:09 14:30:05",
    GPSLatitude: 56.9496,
    GPSLongitude: 24.1052
};

function jobOn(settings = {}) {
    const host = createFakeHost({
        files: ["/a/one.jpg"],
        metadata: [["/a/one.jpg", TAKEN]],
        ...settings
    });

    return { host, job: makeJob(host) };
}

test("the one entry exiftool answers with is the photograph's facts", () => {
    // It answers with a list, because it is built to be asked about many
    // files at once.
    const { job } = jobOn();
    const facts = factsFor(job, "/a/one.jpg");

    assert.equal(facts.DateTimeOriginal, TAKEN.DateTimeOriginal);
    assert.equal(facts.GPSLatitude, TAKEN.GPSLatitude);
});

test("exiftool is asked once, for the tags this program reads", () => {
    const { host, job } = jobOn();

    factsFor(job, "/a/one.jpg");

    const asked = host.commands.filter((command) => command.includes("exiftool"));

    assert.equal(asked.length, 1);
    assert.match(asked[0], /'-json' '-n'/u);
    assert.match(asked[0], /'-GPSLatitude'/u);
});

test("a photograph that carries none of the tags is still answered for", () => {
    // An entry that names it and says nothing else: a photograph this run
    // knows nothing about, which can still be stamped with what was typed.
    const { job } = jobOn({ files: ["/a/one.jpg"], metadata: [] });

    assert.deepEqual(Object.keys(factsFor(job, "/a/one.jpg")), ["SourceFile"]);
});

test("a tool that will not run is a question that could not be put", () => {
    const { job } = jobOn({ failures: [["exiftool", new Error("killed")]] });

    assert.throws(
        () => factsFor(job, "/a/one.jpg"),
        /Command failed while reading the photograph's metadata/u
    );
});

test("an answer that is not the JSON it promises is not an answer", () => {
    // A build that printed a warning where the JSON should be.
    const { job } = jobOn({ failures: [["exiftool", "Warning: unsupported"]] });

    assert.throws(
        () => factsFor(job, "/a/one.jpg"),
        /metadata could not be read/u
    );
});

test("an empty list is not an answer either", () => {
    const { job } = jobOn({ failures: [["exiftool", "[]"]] });

    assert.throws(() => factsFor(job, "/a/one.jpg"), /metadata could not be read/u);
});

test("a record carrying an error is carrying an error, not facts", () => {
    const { job } = jobOn({
        failures: [["exiftool", '[{"SourceFile":"/a/one.jpg","Error":"File format error"}]']]
    });

    assert.throws(() => factsFor(job, "/a/one.jpg"), /File format error/u);
});

test("every shape that is not one record is not an answer", () => {
    // "[]" is a list with nothing in it; "{}" is not a list; "[null]" is a
    // list with nothing in the place a record should be.
    for (const answered of ["[]", "{}", '{"SourceFile":"/a/one.jpg"}', "[null]", "null"]) {
        const { job } = jobOn({ failures: [["exiftool", answered]] });

        assert.throws(
            () => factsFor(job, "/a/one.jpg"),
            /answered with nothing about this photograph/u,
            answered
        );
    }
});
