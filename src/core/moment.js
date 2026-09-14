"use strict";

/*
 * Reading a moment out of what a camera wrote.
 *
 * EXIF writes "2026:09:09 14:30:05", which is not a format anything parses by
 * accident. It is read field by field rather than handed to Date, because
 * Date accepts a great deal and reinterprets some of it: a string it does not
 * understand becomes Invalid Date, and one it half understands becomes a
 * different moment in the local zone.
 *
 * Read completely or not at all. The first version of this checked the month
 * and the day against fixed bounds and stopped there, so "2026:02:31 99:99"
 * was stamped onto a photograph as "2026-02-31 99:99" -- a date that is not a
 * date and a clock that is not a clock, printed in a form that looks like a
 * record of something. A half-read moment is worse than no moment at all.
 *
 * Tolerant about shape, strict about meaning. Cameras and editors write the
 * seconds, sometimes a fraction of one, and occasionally an offset; none of
 * those change which minute it was, so they are accepted and not displayed.
 * Anything else after the minute means the field does not hold what this
 * thinks it holds, and the pattern ends where the value must.
 */

const EXIF_MOMENT = new RegExp(
    "^(?<year>\\d{4}):(?<month>\\d{2}):(?<day>\\d{2})" +
    " (?<hour>\\d{2}):(?<minute>\\d{2})(?::(?<second>\\d{2}))?" +
    "(?:\\.\\d+)?(?:Z|(?<offsetSign>[+-])" +
    "(?<offsetHour>\\d{2}):?(?<offsetMinute>\\d{2}))?$",
    "u"
);

const MONTHS_IN_YEAR = 12;
const HOURS_IN_DAY = 24;
const MINUTES_IN_HOUR = 60;
// A minute may have a leap second in it, and no photograph should be refused
// over one.
const SECONDS_IN_MINUTE = 61;

/*
 * The calendar, written as the pattern it is rather than as twelve numbers:
 * a long month, February, and then the alternation that the seventh and
 * eighth months break.
 */
const LONG = 31;
const SHORT = 30;
const FEBRUARY_DAYS = 28;
const LEAP_DAYS = 29;
const FEBRUARY = 2;

const DAYS_IN_MONTH = [
    LONG, FEBRUARY_DAYS, LONG, SHORT, LONG, SHORT,
    LONG, LONG, SHORT, LONG, SHORT, LONG
];

const FOUR = 4;
const HUNDRED = 100;
const FOUR_HUNDRED = 400;

function isLeapYear(year) {
    return year % FOUR === 0 && (year % HUNDRED !== 0 || year % FOUR_HUNDRED === 0);
}

function daysInMonth(year, month) {
    return month === FEBRUARY && isLeapYear(year)
        ? LEAP_DAYS
        : DAYS_IN_MONTH[month - 1];
}

function isCalendarDate(year, month, day) {
    return month >= 1 && month <= MONTHS_IN_YEAR &&
        day >= 1 && day <= daysInMonth(year, month);
}

// Fourteen hours east of Greenwich is the furthest any place keeps time.
const OFFSET_HOURS_LIMIT = 14;

function isOffset({ offsetSign, offsetHour, offsetMinute }) {
    return !offsetSign ||
        (Number(offsetHour) <= OFFSET_HOURS_LIMIT &&
            Number(offsetMinute) < MINUTES_IN_HOUR);
}

function isClockTime(hour, minute, second) {
    return hour < HOURS_IN_DAY &&
        minute < MINUTES_IN_HOUR &&
        second < SECONDS_IN_MINUTE;
}

/*
 * The fields as they were written, once they have been shown to name a moment
 * that exists. They are kept as text rather than as numbers because what is
 * stamped is the camera's own "09", not a nine.
 */
function readMoment(text) {
    const match = EXIF_MOMENT.exec(String(text));

    if (!match) {
        return null;
    }

    const { year, month, day, hour, minute, second } = match.groups;

    if (!isCalendarDate(Number(year), Number(month), Number(day))) {
        return null;
    }

    if (!isClockTime(Number(hour), Number(minute), Number(second ?? 0))) {
        return null;
    }

    /*
     * The offset is not stamped -- what is written is the time the camera
     * recorded, where it was -- but an offset that is not one says the field
     * does not hold what this thinks it holds, and nothing in it can be
     * believed.
     */
    return isOffset(match.groups) ? { year, month, day, hour, minute } : null;
}

module.exports = { readMoment, isLeapYear, daysInMonth };
