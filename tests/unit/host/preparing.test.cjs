"use strict";

/*
 * What a photograph has to be before a stamp can go on it.
 *
 * Turned the way it is meant to be seen, and in a color space that can hold
 * the caption's color. The second only sometimes: a photograph that stores
 * only grays cannot hold a red, and the stamp's color used to be moved into
 * the photograph's space regardless -- measured, #FF3B30 moved into a gray
 * profile is one band with the value 138, so the caption came out gray and
 * the run reported that the color had been handled.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const { meeting, prepared } = require("../../../src/host/preparing.js");
const { runJob } = require("../../../src/application/job.js");
const { inSpaceOf } = require("../../../src/host/tinting.js");
const { describeExpanded } = require("../../../src/core/color.js");
const { createFakeHost, WORKSPACE } = require("./fake-host.cjs");
const { makeJob, imageOf, reporter } = require("./fake-job.cjs");

const GRAY = { path: "/w/profile-1.icc", failed: false };

function jobOn(settings = {}, host = createFakeHost({ files: ["/a/one.jpg"] })) {
    return { host, job: { ...makeJob(host, settings), workspace: WORKSPACE } };
}

function grayPhotograph(host, settings) {
    host.bands = 1;

    return { ...makeJob(host, settings), workspace: WORKSPACE };
}

test("a gray photograph and a gray caption meet where they already are", () => {
    // White, black and the default outline are grays, so the ordinary run
    // over a gray photograph is untouched and the copy stays as gray as the
    // photograph was.
    const host = createFakeHost({ files: ["/a/one.jpg"] });
    const job = grayPhotograph(host, { textColor: "#FFFFFF", outlineColor: "#202020" });
    const met = meeting(job, { path: `${WORKSPACE}/oriented-1.v` }, GRAY, "1");

    assert.equal(met.expanded, false);
    assert.equal(met.profile, GRAY, "and the color is still moved into its space");
    assert.equal(
        host.commands.filter((command) => command.includes("icc_transform")).length,
        0
    );
});

test("a gray photograph and a colored caption meet in sRGB", () => {
    const host = createFakeHost({ files: ["/a/one.jpg"] });
    const job = grayPhotograph(host, { textColor: "#FF3B30", outlineWidth: 0 });
    const met = meeting(job, { path: `${WORKSPACE}/oriented-1.v` }, GRAY, "1");

    assert.equal(met.expanded, true);
    assert.equal(met.photograph.path, `${WORKSPACE}/color-1.v`);
    assert.deepEqual(
        met.profile,
        { path: "", failed: false },
        "and the stamp stays in sRGB with it, which is what the profile was for"
    );
    assert.ok(host.commands.some((command) => command.includes("icc_transform") &&
        command.includes("'srgb'") && command.includes(GRAY.path)));
});

test("a photograph with no profile is read into sRGB by its numbers", () => {
    const host = createFakeHost({ files: ["/a/one.jpg"] });
    const job = grayPhotograph(host, { textColor: "#FF3B30", outlineWidth: 0 });

    meeting(job, { path: `${WORKSPACE}/oriented-1.v` }, { path: "", failed: false }, "1");

    assert.ok(host.commands.some((command) => command.includes("'colourspace'")));
});

test("a color photograph is left exactly as it is", () => {
    const { host, job } = jobOn({ textColor: "#FF3B30" });
    const met = meeting(job, { path: `${WORKSPACE}/oriented-1.v` }, GRAY, "1");

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


test("the reader is told how many, in the run's own words", () => {
    const host = createFakeHost({ files: ["/a/one.jpg"] });

    host.bands = 1;

    const job = {
        ...makeJob(host, { textColor: "#FF3B30", outlineWidth: 0 }),
        workspace: WORKSPACE,
        progress: reporter()
    };

    runJob(job, [imageOf("/a/one.jpg")]);

    assert.match(
        describeExpanded(1),
        /stored its grays only, so the copy is in color/u
    );
});

test("a profile that could not be read is not a photograph without one", () => {
    // They used to be the same empty string, and the empty string takes the
    // no-profile path -- which reports the color as handled.
    const { job } = jobOn();
    const paths = { color: "/w/color.v", moved: "/w/moved.v" };

    assert.deepEqual(
        inSpaceOf(job, paths, { path: "", failed: true }),
        { path: paths.color, moved: false },
        "so it is counted rather than assumed away"
    );
    assert.deepEqual(
        inSpaceOf(job, paths, { path: "", failed: false }),
        { path: paths.color, moved: true }
    );
});

test("a photograph its decoder finds cut short is refused as damaged, in inspection's words", () => {
    // Measured: a truncated JPEG keeps an intact header, passes inspection,
    // and only the full decode finds the end missing. vips said so in its
    // own words -- "VipsJpeg: premature end of JPEG image", "jpegload: load
    // error" -- and that was the message a person was shown.
    const said = "\r(vips:1): VIPS-WARNING **: error in tile 0 x 24\rVipsJpeg: premature end of JPEG image\rjpegload: load error";
    const { job } = jobOn({}, createFakeHost({ files: ["/a/one.jpg"], failures: [["'autorot'", new Error(said)]] }));

    assert.throws(() => prepared(job, imageOf("/a/one.jpg"), "1", []), (error) => {
        assert.equal(error.message, "This image is damaged or incomplete.");
        assert.equal(error.issues[0].code, "damaged");
        assert.equal(error.issues[0].stage, "stamping");
        assert.match(error.issues[0].diagnostic.message, /premature end of JPEG image\njpegload/u);
        assert.match(error.issues[0].diagnostic.command, /'autorot'/u);

        return true;
    });
});

test("a decode that fails for another reason keeps its own description", () => {
    const { job } = jobOn({}, createFakeHost({ files: ["/a/one.jpg"], failures: [["'autorot'", new Error("No space left on device")]] }));

    assert.throws(() => prepared(job, imageOf("/a/one.jpg"), "1", []), (error) => {
        assert.equal(error.issues, undefined);
        assert.match(error.message, /No space left on device/u);

        return true;
    });
});
