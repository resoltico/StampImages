"use strict";

/*
 * What every moment this can be given is read as.
 *
 * Generated rather than chosen, because the fault this module exists to
 * prevent is a date that passes each field's own bounds and is not a date:
 * "2026:02:31 99:99" was stamped onto a photograph. Every month has its own
 * last day, February has two, and the century rule for leap years is the one
 * nobody reaches with an example.
 *
 * The seed is fixed, so this is the same run every time.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const fc = require("fast-check");
const { readMoment, isLeapYear, daysInMonth } = require("../../../src/core/moment.js");

const RUNS = { seed: 20260916, numRuns: 25 };

const YEAR = fc.integer({ min: 1800, max: 2400 });
const MONTH = fc.integer({ min: 1, max: 12 });
const DAY = fc.integer({ min: 1, max: 31 });
const HOUR = fc.integer({ min: 0, max: 23 });
const MINUTE = fc.integer({ min: 0, max: 59 });

const YEAR_WIDTH = 4;
const FIELD_WIDTH = 2;
const FEBRUARY = 2;
const LEAP_DAY = 29;

function pad(value, width = FIELD_WIDTH) {
    return String(value).padStart(width, "0");
}

// The five fields travel as one tuple, which is what the generator produces
// and what every property here takes apart.
function exif([year, month, day, hour, minute]) {
    return `${pad(year, YEAR_WIDTH)}:${pad(month)}:${pad(day)} ` +
        `${pad(hour)}:${pad(minute)}`;
}

const DATE = fc.tuple(YEAR, MONTH, DAY, HOUR, MINUTE);

test("a moment that exists is read back as the fields it was written in", () => {
    // Kept as text, because what is stamped is the camera's own "09".
    fc.assert(fc.property(DATE, (written) => {
        const [year, month, day, hour, minute] = written;

        fc.pre(day <= daysInMonth(year, month));

        assert.deepEqual(readMoment(exif(written)), {
            year: pad(year, YEAR_WIDTH),
            month: pad(month),
            day: pad(day),
            hour: pad(hour),
            minute: pad(minute)
        });
    }), RUNS);
});

test("a day the month does not have is not a date", () => {
    fc.assert(fc.property(DATE, (written) => {
        const [year, month, day] = written;

        fc.pre(day > daysInMonth(year, month));

        assert.equal(readMoment(exif(written)), null);
    }), RUNS);
});

test("the seconds, a fraction and an offset are accepted and not shown", () => {
    // None of them change which minute it was.
    const SUFFIX = fc.constantFrom("", ":05", ":05.25", ":05Z", ":05+03:00", ":05-0330");

    fc.assert(fc.property(DATE, SUFFIX, (written, tail) => {
        const [year, month, day, , minute] = written;

        fc.pre(day <= daysInMonth(year, month));

        assert.equal(readMoment(`${exif(written)}${tail}`)?.minute, pad(minute), tail);
    }), RUNS);
});

test("anything else after the minute means the field is not a moment", () => {
    // Filtered against the grammar the reader actually accepts, so what is
    // generated is only what it must refuse.
    const ACCEPTED = /^(?::\d{2})?(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?$/u;
    const JUNK = fc.string({ minLength: 1 }).filter((text) => !ACCEPTED.test(text));

    fc.assert(fc.property(DATE, JUNK, (written, tail) => {
        const [year, month, day] = written;

        fc.pre(day <= daysInMonth(year, month));

        assert.equal(readMoment(`${exif(written)}${tail}`), null, JSON.stringify(tail));
    }), RUNS);
});

test("a leap year is one the calendar agrees is a leap year", () => {
    // The century rule is the half nobody reaches with an example: 1900 is not
    // a leap year and 2000 is.
    fc.assert(fc.property(YEAR, (year) => {
        const february = new Date(Date.UTC(year, FEBRUARY - 1, LEAP_DAY));

        assert.equal(isLeapYear(year), february.getUTCDate() === LEAP_DAY);
        assert.equal(daysInMonth(year, FEBRUARY), isLeapYear(year) ? 29 : 28);
    }), RUNS);
});
