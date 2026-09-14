"use strict";

/*
 * Which colours a photograph's numbers mean.
 *
 * A colour chosen in the form is three sRGB numbers, and writing those
 * numbers into a photograph does not make them that colour: they are read
 * through whatever profile the photograph carries. Measured on this Mac, in
 * Lab, #FF3B30 written into a Display P3 photograph lands about 19 from the
 * red that was asked for -- and 2 is visible.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const { profileFor } = require("../../../src/runtime/colour-space.js");
const { createFakeHost, WORKSPACE } = require("./fake-host.cjs");
const { makeJob } = require("./fake-job.cjs");

function jobOn(settings = {}) {
    const host = createFakeHost({
        files: ["/a/one.jpg", "/b/one.jpg", "/a/two.jpg"],
        ...settings
    });

    return { host, job: { ...makeJob(host), workspace: WORKSPACE } };
}

test("a photograph with no profile needs none of this", () => {
    // Numbers with no profile are sRGB by convention, which is what they
    // already are.
    const { host, job } = jobOn();

    assert.equal(profileFor(job, "/a/one.jpg", "1"), "");
    assert.deepEqual(job.profiles, []);
    assert.deepEqual(
        [...host.files].filter((file) => file.endsWith(".icc")),
        []
    );
});

test("a photograph that carries one has it taken out into the workspace", () => {
    const { job } = jobOn({ profiles: [["/a/one.jpg", "Display P3"]] });
    const profile = profileFor(job, "/a/one.jpg", "1");

    assert.equal(profile, `${WORKSPACE}/profile-1-one.icc`);
    assert.deepEqual(job.profiles, [profile]);
});

test("one file per profile, not one per photograph", () => {
    // A batch comes off one camera, so the second photograph's profile is the
    // first photograph's -- and the stamp drawn for it can be the same
    // drawing, which is the difference between drawing once and two hundred
    // times.
    const { host, job } = jobOn({
        profiles: [["/a/one.jpg", "Display P3"], ["/a/two.jpg", "Display P3"]]
    });
    const first = profileFor(job, "/a/one.jpg", "1");
    const second = profileFor(job, "/a/two.jpg", "2");

    assert.equal(second, first);
    assert.equal(job.profiles.length, 1);
    assert.equal(
        [...host.files].filter((file) => file.endsWith(".icc")).length,
        1,
        "and the second extraction was cleared away"
    );
});

test("two different profiles are two different files", () => {
    const { job } = jobOn({
        profiles: [["/a/one.jpg", "Display P3"], ["/a/two.jpg", "Adobe RGB"]]
    });

    assert.notEqual(
        profileFor(job, "/a/one.jpg", "1"),
        profileFor(job, "/a/two.jpg", "2")
    );
    assert.equal(job.profiles.length, 2);
});

test("two photographs of one name are two extractions, not one", () => {
    // The token keeps them apart; the basename alone would not.
    const { job } = jobOn({
        profiles: [["/a/one.jpg", "Display P3"], ["/b/one.jpg", "Adobe RGB"]]
    });

    assert.equal(profileFor(job, "/a/one.jpg", "1"), `${WORKSPACE}/profile-1-one.icc`);
    assert.equal(profileFor(job, "/b/one.jpg", "2"), `${WORKSPACE}/profile-2-one.icc`);
});
