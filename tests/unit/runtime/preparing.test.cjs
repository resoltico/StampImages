"use strict";

/*
 * What a photograph has to be before a stamp can go on it.
 *
 * Turned the way it is meant to be seen, and in a colour space that can hold
 * the caption's colour. The second only sometimes: a photograph that stores
 * only greys cannot hold a red, and the stamp's colour used to be moved into
 * the photograph's space regardless -- measured, #FF3B30 moved into a grey
 * profile is one band with the value 138, so the caption came out grey and
 * the run reported that the colour had been handled.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const { meeting, prepared } = require("../../../src/runtime/preparing.js");
const { runJob } = require("../../../src/runtime/job.js");
const { inSpaceOf } = require("../../../src/runtime/tinting.js");
const { describeExpanded } = require("../../../src/core/colour.js");
const { createFakeHost, WORKSPACE } = require("./fake-host.cjs");
const { makeJob, imageOf, reporter } = require("./fake-job.cjs");

const GREY = { path: "/w/profile-1.icc", failed: false };

function jobOn(settings = {}, host = createFakeHost({ files: ["/a/one.jpg"] })) {
    return { host, job: { ...makeJob(host, settings), workspace: WORKSPACE } };
}

function greyPhotograph(host, settings) {
    host.bands = 1;

    return { ...makeJob(host, settings), workspace: WORKSPACE };
}

test("a grey photograph and a grey caption meet where they already are", () => {
    // White, black and the default outline are greys, so the ordinary run
    // over a grey photograph is untouched and the copy stays as grey as the
    // photograph was.
    const host = createFakeHost({ files: ["/a/one.jpg"] });
    const job = greyPhotograph(host, { textColour: "#FFFFFF", outlineColour: "#202020" });
    const met = meeting(job, { path: `${WORKSPACE}/oriented-1.v` }, GREY, "1");

    assert.equal(met.expanded, false);
    assert.equal(met.profile, GREY, "and the colour is still moved into its space");
    assert.equal(
        host.commands.filter((command) => command.includes("icc_transform")).length,
        0
    );
});

test("a grey photograph and a coloured caption meet in sRGB", () => {
    const host = createFakeHost({ files: ["/a/one.jpg"] });
    const job = greyPhotograph(host, { textColour: "#FF3B30", outlineWidth: 0 });
    const met = meeting(job, { path: `${WORKSPACE}/oriented-1.v` }, GREY, "1");

    assert.equal(met.expanded, true);
    assert.equal(met.photograph.path, `${WORKSPACE}/colour-1.v`);
    assert.deepEqual(
        met.profile,
        { path: "", failed: false },
        "and the stamp stays in sRGB with it, which is what the profile was for"
    );
    assert.ok(host.commands.some((command) => command.includes("icc_transform") &&
        command.includes("'srgb'") && command.includes(GREY.path)));
});

test("a photograph with no profile is read into sRGB by its numbers", () => {
    const host = createFakeHost({ files: ["/a/one.jpg"] });
    const job = greyPhotograph(host, { textColour: "#FF3B30", outlineWidth: 0 });

    meeting(job, { path: `${WORKSPACE}/oriented-1.v` }, { path: "", failed: false }, "1");

    assert.ok(host.commands.some((command) => command.includes("'colourspace'")));
});

test("a colour photograph is left exactly as it is", () => {
    const { host, job } = jobOn({ textColour: "#FF3B30" });
    const met = meeting(job, { path: `${WORKSPACE}/oriented-1.v` }, GREY, "1");

    assert.equal(met.expanded, false);
    assert.equal(
        host.commands.filter((command) => command.includes("'colourspace'")).length,
        0
    );
});

test("an expansion is a second file, and a photograph that needed none is not", () => {
    // A list holding one path twice removes it twice.
    const { job } = jobOn();
    const kept = [];

    prepared(job, imageOf("/a/one.jpg"), "1", kept);

    assert.equal(new Set(kept).size, kept.length, kept.join(", "));
});

test("a run says how many photographs it had to read into colour", () => {
    const host = createFakeHost({ files: ["/a/one.jpg"] });

    host.bands = 1;

    const job = {
        ...makeJob(host, { textColour: "#FF3B30", outlineWidth: 0 }),
        workspace: WORKSPACE,
        progress: reporter()
    };
    const result = runJob(job, [imageOf("/a/one.jpg")]);

    assert.equal(result.expanded, 1);
    assert.deepEqual(result.failures, []);
});

test("the reader is told how many, in the run's own words", () => {
    const host = createFakeHost({ files: ["/a/one.jpg"] });

    host.bands = 1;

    const job = {
        ...makeJob(host, { textColour: "#FF3B30", outlineWidth: 0 }),
        workspace: WORKSPACE,
        progress: reporter()
    };

    runJob(job, [imageOf("/a/one.jpg")]);

    assert.match(
        describeExpanded(1),
        /stored its greys only, so the copy is in colour/u
    );
});

test("a profile that could not be read is not a photograph without one", () => {
    // They used to be the same empty string, and the empty string takes the
    // no-profile path -- which reports the colour as handled.
    const { job } = jobOn();
    const paths = { colour: "/w/colour.v", moved: "/w/moved.v" };

    assert.deepEqual(
        inSpaceOf(job, paths, { path: "", failed: true }),
        { path: paths.colour, moved: false },
        "so it is counted rather than assumed away"
    );
    assert.deepEqual(
        inSpaceOf(job, paths, { path: "", failed: false }),
        { path: paths.colour, moved: true }
    );
});
