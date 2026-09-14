"use strict";

/*
 * What a failing command says it was doing.
 *
 * Every stage runs a tool, and a tool that fails says only its own words --
 * "unable to load", "no such file". The label is what turns that into a
 * sentence about this program: which of the seven things it was in the
 * middle of. It reaches a person in a dialog and a caller in a receipt, so
 * each one is asserted rather than assumed.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const { stampOne } = require("../../../src/runtime/stamping.js");
const { availableFonts } = require("../../../src/runtime/fonts.js");
const { createFakeHost, WORKSPACE } = require("./fake-host.cjs");
const { makeJob, imageOf } = require("./fake-job.cjs");

function failing(needle, settings = {}) {
    const host = createFakeHost({
        files: ["/a/one.jpg"],
        failures: [[needle, new Error("vips: it would not")]],
        ...settings
    });

    return { ...makeJob(host, settings.settings), workspace: WORKSPACE };
}

function stamping(job) {
    return () => stampOne(job, imageOf("/a/one.jpg"), "1");
}

test("reading the photograph is named when the photograph will not read", () => {
    assert.throws(
        stamping(failing("'autorot'")),
        /Command failed while reading the photograph\./u
    );
});

test("measuring is named, and says what was being measured", () => {
    assert.throws(
        stamping(failing("'width'")),
        /Command failed while measuring the stamp\./u
    );
    assert.throws(
        stamping(failing("'bands'")),
        /Command failed while measuring the photograph\./u
    );
});

test("drawing the stamp is named, stage by stage", () => {
    assert.throws(
        stamping(failing("'text'")),
        /Command failed while drawing the stamp\./u
    );
    assert.throws(
        stamping(failing("'rank'")),
        /Command failed while drawing the outline\./u
    );
});

test("colouring is named for each of the three operations it takes", () => {
    for (const operation of ["'black'", "'linear'", "'bandjoin'"]) {
        assert.throws(
            stamping(failing(operation)),
            /Command failed while colouring the stamp\./u,
            operation
        );
    }
});

test("assembling the stamp is named", () => {
    assert.throws(
        stamping(failing(`'composite2' '${WORKSPACE}/stamp-1-edge.png'`)),
        /Command failed while assembling the stamp\./u
    );
});

test("stamping the photograph is named", () => {
    assert.throws(
        stamping(failing(`'composite2' '${WORKSPACE}/oriented-1.v'`)),
        /Command failed while stamping the photograph\./u
    );
});

test("saving the copy is named, whichever way it is saved", () => {
    assert.throws(
        stamping(failing("'flatten'")),
        /Command failed while saving the stamped copy\./u
    );
    assert.throws(
        stamping(failing("'copy'", { bands: 4 })),
        /Command failed while saving the stamped copy\./u
    );
});

test("checking the fonts is named, which happens before anything else", () => {
    const host = createFakeHost({
        failures: [["'text'", new Error("vips: it would not")]]
    });

    assert.throws(
        () => availableFonts({
            app: host,
            tools: { vips: "/opt/homebrew/bin/vips" },
            workspace: WORKSPACE
        }),
        /Command failed while checking which fonts are installed\./u
    );
});

test("reading the photograph's metadata is named when it cannot be read", () => {
    // A tool that would not run is not a photograph without a date: it is a
    // question that could not be put, and the run says so.
    assert.throws(
        stamping(failing("exiftool")),
        /Command failed while reading the photograph's metadata\./u
    );
});
