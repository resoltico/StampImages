"use strict";

/*
 * What every moment this can be given is read as.
 *
 * Generated rather than chosen, because the fault this module exists to
 * prevent is a date that passes each field's own bounds and is not a date:
 * "2026:02:31 99:99" was stamped onto a photograph.
 *
 * Every moment here is built from the platform's own Date rather than checked
 * against this module's calendar. A property that asked moment.js which days
 * exist would agree with moment.js about a February of thirty days.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const fc = require("fast-check");
const { readMoment } = require("../../../src/core/moment.js");
const { WHEN, pad, fieldsOf, exif, lastDay } = require("./fake-calendar.cjs");

test("a moment that exists is read back as the fields it was written in", () => {
    // Kept as text, because what is stamped is the camera's own "09".
    fc.assert(fc.property(WHEN, (date) => {
        const fields = fieldsOf(date);

        assert.deepEqual(readMoment(exif(fields)), fields);
    }));
});

test("a day past the end of its month is not a date", () => {
    // Built past the end the calendar gives, up to the most two digits hold.
    const PAST_THE_END = WHEN.chain((date) => {
        const fields = fieldsOf(date);

        return fc.integer({ min: lastDay(fields) + 1, max: 99 })
            .map((day) => ({ ...fields, day: pad(day) }));
    });

    fc.assert(fc.property(PAST_THE_END, (fields) => {
        assert.equal(readMoment(exif(fields)), null, exif(fields));
    }));
});

test("a field outside its range is not a moment", () => {
    const BROKEN = fc.oneof(
        fc.record({
            field: fc.constant("month"),
            value: fc.oneof(fc.constant(0), fc.integer({ min: 13, max: 99 }))
        }),
        fc.record({ field: fc.constant("day"), value: fc.constant(0) }),
        fc.record({ field: fc.constant("hour"), value: fc.integer({ min: 24, max: 99 }) }),
        fc.record({ field: fc.constant("minute"), value: fc.integer({ min: 60, max: 99 }) })
    );

    fc.assert(fc.property(WHEN, BROKEN, (date, { field, value }) => {
        const fields = { ...fieldsOf(date), [field]: pad(value) };

        assert.equal(readMoment(exif(fields)), null, exif(fields));
    }));
});

// A signed hour and minute, with or without the colon between them.
function signedOffset(bounds) {
    return fc.record({
        sign: fc.constantFrom("+", "-"),
        hour: fc.integer(bounds.hour),
        minute: fc.integer(bounds.minute),
        colon: fc.boolean()
    }).map((part) => `${part.sign}${pad(part.hour)}${part.colon ? ":" : ""}${pad(part.minute)}`);
}

test("the seconds, a fraction of one and an offset are read and not shown", () => {
    // None of them change which minute it was. Sixty is a leap second.
    const TAIL = fc.record({
        second: fc.option(fc.integer({ min: 0, max: 60 })),
        fraction: fc.option(fc.stringMatching(/^\d+$/u)),
        zone: fc.option(fc.oneof(
            fc.constant("Z"),
            signedOffset({ hour: { min: 0, max: 14 }, minute: { min: 0, max: 59 } })
        ))
    }).map(({ second, fraction, zone }) =>
        `${second === null ? "" : `:${pad(second)}`}` +
        `${fraction === null ? "" : `.${fraction}`}${zone ?? ""}`);

    fc.assert(fc.property(WHEN, TAIL, (date, tail) => {
        const fields = fieldsOf(date);

        assert.deepEqual(readMoment(`${exif(fields)}${tail}`), fields, tail);
    }));
});

test("an offset past any clock on Earth means the field is not a moment", () => {
    // Fourteen hours east is the furthest any place keeps time.
    const IMPOSSIBLE = fc.oneof(
        signedOffset({ hour: { min: 15, max: 99 }, minute: { min: 0, max: 59 } }),
        signedOffset({ hour: { min: 0, max: 14 }, minute: { min: 60, max: 99 } })
    );

    fc.assert(fc.property(WHEN, IMPOSSIBLE, (date, zone) => {
        assert.equal(readMoment(`${exif(fieldsOf(date))}:00${zone}`), null, zone);
    }));
});

test("anything else after the minute means the field is not a moment", () => {
    // Nothing a reading may continue with -- a colon, a point, Z, a sign --
    // so the whole of it is left over, and a pattern that ends where the
    // value must refuses it.
    const JUNK = fc.string({ minLength: 1 }).filter((text) => !":.Z+-".includes(text[0]));

    fc.assert(fc.property(WHEN, JUNK, (date, tail) => {
        assert.equal(readMoment(`${exif(fieldsOf(date))}${tail}`), null, JSON.stringify(tail));
    }));
});
