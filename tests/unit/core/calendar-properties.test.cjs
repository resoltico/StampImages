"use strict";

/*
 * The calendar moment.js keeps, against the one the platform keeps.
 *
 * Written out rather than asked of Date, because a date read from a camera is
 * text and has to be checked as text -- so the table is a second calendar, and
 * a second calendar can be wrong in one row and right in every example
 * somebody thought to write. The century rule is the row nobody reaches with
 * an example: 1900 was not a leap year and 2000 was.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const fc = require("fast-check");
const { isLeapYear, daysInMonth } = require("../../../src/core/moment.js");
const { lastDay } = require("./fake-calendar.cjs");

// Every year four digits can write, which is every year a camera can.
const YEAR = fc.integer({ min: 0, max: 9999 });
const MONTH = fc.integer({ min: 1, max: 12 });

test("a leap year is one the calendar agrees is a leap year", () => {
    fc.assert(fc.property(YEAR, (year) => {
        assert.equal(isLeapYear(year), lastDay({ year, month: 2 }) === 29, `${year}`);
    }));
});

test("every month ends on the day the calendar says it does", () => {
    fc.assert(fc.property(YEAR, MONTH, (year, month) => {
        assert.equal(daysInMonth(year, month), lastDay({ year, month }), `${year}-${month}`);
    }));
});
