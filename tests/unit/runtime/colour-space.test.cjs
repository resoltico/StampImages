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
const { isUserCancelled } = require("../../../src/core/errors.js");
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

    assert.deepEqual(profileFor(job, "/a/one.jpg", "1"), { path: "", failed: false });
    assert.deepEqual(job.profiles, []);
    assert.deepEqual(
        [...host.files].filter((file) => file.endsWith(".icc")),
        [],
        "and the empty file the redirection left was cleared away"
    );
});

test("a photograph that carries one has it taken out into the workspace", () => {
    const { job } = jobOn({ profiles: [["/a/one.jpg", "Display P3"]] });
    const profile = profileFor(job, "/a/one.jpg", "1");

    assert.deepEqual(profile, { path: `${WORKSPACE}/profile-1.icc`, failed: false });
    assert.deepEqual(job.profiles, [profile.path], "named for the attempt, not the photograph");
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

    assert.deepEqual(second, first);
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

test("the file is named for the attempt, never for the photograph", () => {
    // The token alone keeps two extractions apart, and it is the whole name:
    // exiftool's own -w names the file after the source, so a 250-character
    // photograph name asked for a 264-byte filename -- longer than any Mac
    // filesystem takes -- and the failure was read as "no profile".
    const { job } = jobOn({
        profiles: [["/a/one.jpg", "Display P3"], ["/b/one.jpg", "Adobe RGB"]]
    });

    assert.equal(profileFor(job, "/a/one.jpg", "1").path, `${WORKSPACE}/profile-1.icc`);
    assert.equal(profileFor(job, "/b/one.jpg", "2").path, `${WORKSPACE}/profile-2.icc`);
});

test("a profile that could not be read is not a photograph without one", () => {
    // They used to be the same empty string, and the empty string takes the
    // no-profile path -- which reports the colour as handled. So a failed
    // extraction was a stamp in unconverted numbers and a run that said
    // everything had gone well.
    const { job } = jobOn({
        profiles: [["/a/one.jpg", "Display P3"]],
        failures: [["-icc_profile", new Error("exiftool: cannot read")]]
    });

    assert.deepEqual(profileFor(job, "/a/one.jpg", "1"), { path: "", failed: true });
    assert.deepEqual(job.profiles, [], "and nothing was recorded as read");
});

test("a cancellation while the profile is read is a stop, not a failure", () => {
    // Reported as a failed extraction it would be counted against the
    // photograph, and the run stops for a reason that has nothing to do
    // with it.
    const stopped = new Error("User cancelled.");

    stopped.errorNumber = -128;

    const { job } = jobOn({
        profiles: [["/a/one.jpg", "Display P3"]],
        failures: [["-icc_profile", stopped]]
    });

    // Wrapped by the layer that caught it, and still a cancellation.
    assert.throws(
        () => profileFor(job, "/a/one.jpg", "1"),
        (error) => isUserCancelled(error)
    );
});
