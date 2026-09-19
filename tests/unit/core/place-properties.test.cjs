"use strict";

/*
 * What every coordinate this can be given comes out as.
 *
 * Generated rather than chosen, because the two faults this module exists to
 * prevent are boundaries nobody thinks to write down: a value just under a
 * whole degree printing sixty arc seconds, and one just south of the equator
 * printing a minus sign in front of nothing. An example finds those only if
 * somebody already suspects them.
 *
 * The seed is fixed, so this is the same run every time and a failure is one
 * anybody can reproduce. What the generator buys is inputs nobody thought of,
 * not randomness in the gate.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const fc = require("fast-check");
const { sexagesimal, decimalDegrees } = require("../../../src/core/place.js");

const RUNS = { seed: 20260916, numRuns: 25 };
const LATITUDE = fc.double({ min: -90, max: 90, noNaN: true });

const WRITTEN =
    /^(?<degrees>\d+)°(?<minutes>\d+)'(?<seconds>\d+\.\d)"(?<letter>[NS])$/u;

const TENTHS_PER_SECOND = 10;
const TENTHS_PER_MINUTE = 600;
const TENTHS_PER_DEGREE = 36000;
const MINUTES_PER_DEGREE = 60;
const SECONDS_PER_MINUTE = 60;
const LAST_PLACE = 0.00005;

function parts(written) {
    const match = WRITTEN.exec(written);

    assert.ok(match, `not a coordinate: ${written}`);

    return match.groups;
}

test("every coordinate is degrees, minutes, seconds and a letter", () => {
    fc.assert(fc.property(LATITUDE, (value) => {
        parts(sexagesimal(value, "N", "S"));
    }), RUNS);
});

test("no minute is the sixtieth of a degree, and no second of a minute", () => {
    // Rounding after the degrees are taken is what writes 12°59'60.0"N.
    fc.assert(fc.property(LATITUDE, (value) => {
        const { minutes, seconds } = parts(sexagesimal(value, "N", "S"));

        assert.ok(Number(minutes) < MINUTES_PER_DEGREE, `minutes: ${minutes}`);
        assert.ok(Number(seconds) < SECONDS_PER_MINUTE, `seconds: ${seconds}`);
    }), RUNS);
});

test("the parts add back to the tenth of a second rounded to", () => {
    // Exact integer arithmetic rather than a tolerance: the three displayed
    // units are one number decomposed, so they cannot disagree with it.
    fc.assert(fc.property(LATITUDE, (value) => {
        const { degrees, minutes, seconds } = parts(sexagesimal(value, "N", "S"));

        assert.equal(
            Number(degrees) * TENTHS_PER_DEGREE +
                Number(minutes) * TENTHS_PER_MINUTE +
                Math.round(Number(seconds) * TENTHS_PER_SECOND),
            Math.round(Math.abs(value) * TENTHS_PER_DEGREE)
        );
    }), RUNS);
});

test("the letter is the hemisphere, and no coordinate carries a sign", () => {
    fc.assert(fc.property(LATITUDE, (value) => {
        const written = sexagesimal(value, "N", "S");
        const { letter } = parts(written);
        const shown = Math.round(Math.abs(value) * TENTHS_PER_DEGREE);

        assert.ok(!written.includes("-"), written);
        assert.equal(letter, value < 0 && shown !== 0 ? "S" : "N", written);
    }), RUNS);
});

test("decimal degrees keep four places and never a signed nothing", () => {
    fc.assert(fc.property(LATITUDE, (value) => {
        const written = decimalDegrees(value);

        assert.match(written, /^-?\d+\.\d{4}$/u);
        assert.notEqual(written, "-0.0000");
    }), RUNS);
});

test("decimal degrees stay within half of the place they stop at", () => {
    fc.assert(fc.property(LATITUDE, (value) => {
        assert.ok(
            Math.abs(Number(decimalDegrees(value)) - value) <= LAST_PLACE,
            `${decimalDegrees(value)} for ${value}`
        );
    }), RUNS);
});
