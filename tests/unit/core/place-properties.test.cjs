"use strict";

/*
 * What every coordinate this can be given comes out as.
 *
 * Generated rather than chosen, because the two faults this module exists to
 * prevent are boundaries nobody thinks to write down: a value just under a
 * whole degree written with sixty arc seconds, and one just south of the
 * equator written with a minus sign in front of nothing.
 *
 * Two kinds of property, and the difference matters. Some state what is true
 * of every coordinate whatever it is -- its shape, that no unit reaches sixty
 * -- and take any value there is. One builds a coordinate from the parts it
 * should be written as, so the expected text is known without working it out
 * the way the code does: a result the test computed by the same arithmetic
 * would agree with the code about the same mistake.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const fc = require("fast-check");
const place = require("../../../src/core/place.js");
const { coordinates } = require("../../../src/core/metadata.js");

// The bound metadata.js holds a longitude to, which is the wider of the two:
// the same code writes both halves of a place.
const WORLD = 180;
const DEGREES = fc.double({ min: -WORLD, max: WORLD, noNaN: true });

const TENTHS_PER_MINUTE = 600;
const TENTHS_PER_DEGREE = 36000;

const WRITTEN =
    /^(?<degrees>\d+)°(?<minutes>\d+)'(?<seconds>\d+\.\d)"(?<letter>[NSEW])$/u;
const DECIMAL = /^-?\d+\.\d{4}$/u;

test("whatever a photograph says, the place is refused or written whole", () => {
    // Any value exiftool could hand over -- a number of any size, text, or
    // nothing -- goes through the same bounding a run does.
    const TAG = fc.oneof(fc.double(), fc.string(), fc.constant(undefined));

    fc.assert(fc.property(
        fc.record({ GPSLatitude: TAG, GPSLongitude: TAG }),
        (facts) => {
            const found = coordinates(facts);

            if (found !== null) {
                for (const half of place.sexagesimalPlace(found).split(" ")) {
                    assert.match(half, WRITTEN);
                }

                for (const half of place.decimalPlace(found).split(", ")) {
                    assert.match(half, DECIMAL);
                }
            }
        }
    ));
});

test("no minute is the sixtieth of a degree, and no second of a minute", () => {
    fc.assert(fc.property(DEGREES, (value) => {
        const written = WRITTEN.exec(place.sexagesimal(value, "E", "W"));

        assert.ok(written, `not a coordinate for ${value}`);
        assert.ok(Number(written.groups.minutes) < 60, written[0]);
        assert.ok(Number(written.groups.seconds) < 60, written[0]);
    }));
});

/*
 * Built from the parts it should be written as, and placed anywhere within
 * its tenth of a second short of the halfway point, so every value rounds to
 * the parts it was built from.
 */
const PARTS = fc.record({
    degrees: fc.integer({ min: 0, max: WORLD - 1 }),
    minutes: fc.integer({ min: 0, max: 59 }),
    tenths: fc.integer({ min: 0, max: 599 }),
    within: fc.double({ min: -0.49, max: 0.49, noNaN: true }),
    south: fc.boolean()
});

function built({ degrees, minutes, tenths, within, south }) {
    const exact = degrees * TENTHS_PER_DEGREE + minutes * TENTHS_PER_MINUTE + tenths;
    // Nothing is less than nothing: a coordinate at zero is not nudged below it.
    const magnitude = (exact + (exact === 0 ? Math.abs(within) : within)) /
        TENTHS_PER_DEGREE;

    return {
        value: south ? -magnitude : magnitude,
        expected: `${degrees}°${minutes}'${(tenths / 10).toFixed(1)}"` +
            `${south && exact !== 0 ? "S" : "N"}`
    };
}

test("a coordinate built from its parts is written as those parts", () => {
    fc.assert(fc.property(PARTS, (parts) => {
        const { value, expected } = built(parts);

        assert.equal(place.sexagesimal(value, "N", "S"), expected, `${value}`);
    }));
});

test("a value just short of a whole minute is written as that minute", () => {
    // The carry, which is the fault that shipped: rounding up across a minute
    // has to carry into it, and into the degree when the minute was the last.
    // Built just below the boundary on purpose -- a value drawn from anywhere
    // lands there too rarely for a hundred cases to be sure of reaching it,
    // and none of the campaign's twenty-five does.
    const JUST_SHORT = fc.record({
        degrees: fc.integer({ min: 1, max: WORLD - 1 }),
        minutes: fc.integer({ min: 0, max: 59 }),
        short: fc.double({ min: 0.001, max: 0.49, noNaN: true })
    });

    fc.assert(fc.property(JUST_SHORT, ({ degrees, minutes, short }) => {
        const tenths = degrees * TENTHS_PER_DEGREE + minutes * TENTHS_PER_MINUTE - short;

        assert.equal(
            place.sexagesimal(tenths / TENTHS_PER_DEGREE, "N", "S"),
            `${degrees}°${minutes}'0.0"N`
        );
    }));
});

test("decimal degrees keep four places and never a signed nothing", () => {
    fc.assert(fc.property(DEGREES, (value) => {
        const written = place.decimalDegrees(value);

        assert.match(written, DECIMAL);
        assert.notEqual(written, "-0.0000");
    }));
});

test("decimal degrees stay within half of the place they stop at", () => {
    fc.assert(fc.property(DEGREES, (value) => {
        const written = place.decimalDegrees(value);

        assert.ok(Math.abs(Number(written) - value) <= 0.00005, `${written} for ${value}`);
    }));
});
