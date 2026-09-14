"use strict";

/*
 * Reading a moment out of what a camera wrote.
 *
 * Read completely or not at all. The first version checked the month and the
 * day against fixed bounds and stopped there, so "2026:02:31 99:99" was
 * stamped onto a photograph as "2026-02-31 99:99" -- a date that is not a
 * date and a clock that is not a clock, printed in a form that looks like a
 * record of something.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const { readMoment, isLeapYear, daysInMonth } = require("../../../src/core/moment.js");

function readable(text) {
    const read = readMoment(text);

    return read && `${read.year}-${read.month}-${read.day} ${read.hour}:${read.minute}`;
}

test("an EXIF moment is read field by field, not handed to Date", () => {
    assert.deepEqual(readMoment("2026:09:09 14:30:05"), {
        year: "2026",
        month: "09",
        day: "09",
        hour: "14",
        minute: "30"
    });
});

test("the shapes cameras and editors actually write are all read", () => {
    // The seconds, a fraction of one and an offset all say which minute it
    // was; none of them is stamped, and none is a reason to refuse the date.
    for (const written of [
        "2026:09:09 14:30",
        "2026:09:09 14:30:05",
        "2026:09:09 14:30:05.25",
        "2026:09:09 14:30:05+03:00",
        "2026:09:09 14:30:05-0500",
        "2026:09:09 14:30:05Z"
    ]) {
        assert.equal(readable(written), "2026-09-09 14:30", written);
    }
});

test("a moment has to be the whole of what the field holds", () => {
    // Unanchored, the pattern took "2026:09:12 12:30garbage" as a date and a
    // clock and stamped the photograph with it.
    assert.equal(readMoment("2026:09:12 12:30garbage"), null);
    assert.equal(readMoment("taken 2026:09:12 12:30"), null);
});

test("a clock that is not a clock is not a moment", () => {
    assert.equal(readMoment("2026:02:31 99:99:00"), null);
    assert.equal(readMoment("2026:09:12 24:00"), null);
    assert.equal(readMoment("2026:09:12 12:60"), null);
});

test("a leap second is a minute, not a reason to refuse a photograph", () => {
    assert.equal(readable("2026:12:31 23:59:60"), "2026-12-31 23:59");
});

test("the day has to exist in that month of that year", () => {
    assert.equal(readable("2024:02:29 10:00"), "2024-02-29 10:00");
    assert.equal(readMoment("2023:02:29 10:00"), null);
    assert.equal(readMoment("2026:04:31 10:00"), null);
    assert.equal(readMoment("2026:00:09 10:00"), null);
    assert.equal(readMoment("2026:13:09 10:00"), null);
    assert.equal(readMoment("2026:09:00 10:00"), null);
});

test("the last day of the longest month is a day", () => {
    // Written as a bound rather than a comparison, so an off-by-one here
    // refuses the 31st of December.
    assert.equal(readable("2026:12:31 23:59"), "2026-12-31 23:59");
    assert.equal(readable("2026:01:31 00:00"), "2026-01-31 00:00");
});

test("a date that is not one at all is missing rather than guessed", () => {
    for (const value of [
        "", null, undefined, "2026-09-09 14:30", "09/09/2026", "yesterday",
        "26:09:09 14:30", "0000:00:00 00:00"
    ]) {
        assert.equal(readMoment(value), null, String(value));
    }
});

test("the century rule decides which Februaries have twenty-nine days", () => {
    assert.equal(isLeapYear(2024), true);
    assert.equal(isLeapYear(2023), false);
    assert.equal(isLeapYear(1900), false);
    assert.equal(isLeapYear(2000), true);
    assert.equal(daysInMonth(2024, 2), 29);
    assert.equal(daysInMonth(2023, 2), 28);
});

test("every month is as long as it is", () => {
    assert.deepEqual(
        Array.from({ length: 12 }, (ignored, index) => daysInMonth(2026, index + 1)),
        [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    );
});

test("the bounds of a date are bounds, each side of each of them", () => {
    // Written as four comparisons, and every one of them can be off by one in
    // a direction that either refuses a real date or accepts one that is not.
    assert.ok(readMoment("2026:01:01 00:00"), "the first day of the year");
    assert.ok(readMoment("2026:12:31 23:59"), "the last minute of it");
    assert.equal(readMoment("2026:12:32 10:00"), null, "no 32nd");
    assert.equal(readMoment("2026:11:31 10:00"), null, "no 31st of November");
    assert.ok(readMoment("2026:11:30 10:00"), "but a 30th");
});

test("seconds past a leap second are not seconds", () => {
    assert.equal(readMoment("2026:12:31 23:59:61"), null);
    assert.equal(readMoment("2026:12:31 23:59:99"), null);
});

test("an offset is bounded before it is discarded", () => {
    // What is written is the time the camera recorded, where it was -- but an
    // offset that is not one says the field does not hold what this thinks it
    // holds, and nothing in it can be believed.
    assert.ok(readMoment("2026:09:13 12:30:59+14:00"), "the furthest there is");
    assert.equal(readMoment("2026:09:13 12:30:59+15:00"), null, "further than that");
    assert.equal(readMoment("2026:09:13 12:30:59+03:99"), null, "99 minutes");
    assert.equal(readMoment("2026:09:13 12:30:59+99:99"), null);
    assert.ok(readMoment("2026:09:13 12:30:59-11:30"), "west of Greenwich");
});
