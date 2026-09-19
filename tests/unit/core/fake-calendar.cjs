"use strict";

const fc = require("fast-check");

/*
 * Moments, and the calendar they are checked against, from the platform
 * rather than from the module under test.
 *
 * Every property about reading a date needs to know which dates exist. Asked
 * of moment.js, that answer would agree with moment.js about any mistake it
 * makes -- a February of thirty days would be generated as valid and read as
 * valid. Date keeps its own calendar, so it is the one asked.
 */

// Four digits of year is what the field holds, so every one of them.
const WHEN = fc.date({
    min: new Date("0000-01-01T00:00:00.000Z"),
    max: new Date("9999-12-31T23:59:59.999Z"),
    noInvalidDate: true
});

function pad(value, width = 2) {
    return String(value).padStart(width, "0");
}

function fieldsOf(date) {
    return {
        year: pad(date.getUTCFullYear(), 4),
        month: pad(date.getUTCMonth() + 1),
        day: pad(date.getUTCDate()),
        hour: pad(date.getUTCHours()),
        minute: pad(date.getUTCMinutes())
    };
}

function exif({ year, month, day, hour, minute }) {
    return `${year}:${month}:${day} ${hour}:${minute}`;
}

/*
 * The last day of a month, as Date counts it: day nought of the month after.
 * setUTCFullYear rather than Date.UTC, which reads a year below 100 as 1900
 * plus it and would put the year 4 in 1904.
 */
function lastDay({ year, month }) {
    const date = new Date(0);

    date.setUTCFullYear(Number(year), Number(month), 0);

    return date.getUTCDate();
}

module.exports = { WHEN, pad, fieldsOf, exif, lastDay };
