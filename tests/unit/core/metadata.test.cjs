"use strict";

/*
 * What a photograph says about itself, and which of its tags may speak.
 *
 * Every value here is a claim by whatever wrote the file. The rule is that a
 * field is either understood completely or treated as missing: a half-read
 * date stamped onto somebody's photograph looks like a record of something.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const {
    captureMoment,
    MONTHS,
    MOMENT_TAGS
} = require("../../../src/core/metadata.js");

test("the first tag that holds a readable moment wins, and says which", () => {
    const facts = {
        DateTimeOriginal: "2026:09:09 14:30:05",
        CreateDate: "2020:01:01 00:00:00"
    };

    assert.equal(captureMoment(facts).tag, "DateTimeOriginal");
    assert.equal(captureMoment(facts).year, "2026");
});

test("an editor that lost the original date leaves the one beside it", () => {
    assert.equal(
        captureMoment({ DateTimeOriginal: "", CreateDate: "2020:01:01 00:00" }).tag,
        "CreateDate"
    );
    assert.equal(captureMoment({}), null);
});

test("the file's own modification time never speaks for the capture", () => {
    // It is when the file was last changed -- and the only time it would ever
    // be reached is when both of the others are absent, which is exactly the
    // case where it is an editor's clock rather than a camera's.
    assert.deepEqual(MOMENT_TAGS, ["DateTimeOriginal", "CreateDate"]);
    assert.equal(captureMoment({ ModifyDate: "2026:09:12 10:00" }), null);
});

test("a tag holding something unreadable is passed over, not half-read", () => {
    assert.equal(
        captureMoment({
            DateTimeOriginal: "2026:02:31 99:99",
            CreateDate: "2020:01:01 00:00"
        }).tag,
        "CreateDate"
    );
});

test("the months are named, in order, for the long date", () => {
    assert.deepEqual(MONTHS, [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ]);
});
