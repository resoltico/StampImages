"use strict";

/*
 * Writing a place the way a map writes one.
 *
 * Both forms round before they decompose. Rounding afterwards produced
 * 12°59'60.0"N on a photograph -- the degrees and the minutes taken from the
 * unrounded value and the seconds rounded up into a sixtieth that has to
 * carry, with nothing carrying it.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const {
    sexagesimal,
    decimalDegrees,
    decimalPlace,
    sexagesimalPlace
} = require("../../../src/core/place.js");

test("a place is written as a map writes it", () => {
    assert.equal(
        sexagesimalPlace({ latitude: 56.9496, longitude: 24.1052 }),
        "56°56'58.6\"N 24°6'18.7\"E"
    );
    assert.equal(
        decimalPlace({ latitude: 56.9496, longitude: 24.1052 }),
        "56.9496, 24.1052"
    );
});

test("seconds that round to sixty carry into the minute, and the degree", () => {
    assert.equal(sexagesimal(12.9999999, "N", "S"), "13°0'0.0\"N");
    assert.equal(sexagesimal(59.99999999, "N", "S"), "60°0'0.0\"N");
    assert.equal(sexagesimal(-12.9999999, "N", "S"), "13°0'0.0\"S");
});

test("a hemisphere is a letter, not a minus sign", () => {
    // "-56°56'58.6\"" reads as an arithmetic result; the letter is what a map
    // says.
    assert.equal(sexagesimal(-56.9496, "N", "S"), "56°56'58.6\"S");
    assert.equal(sexagesimal(-24.1052, "E", "W"), "24°6'18.7\"W");
    assert.equal(
        sexagesimalPlace({ latitude: -33.8688, longitude: -151.2093 }),
        "33°52'7.7\"S 151°12'33.5\"W"
    );
});

test("a coordinate that rounds to nothing is not south of the equator", () => {
    assert.equal(sexagesimal(-0.00001, "N", "S"), "0°0'0.0\"N");
    assert.equal(sexagesimal(0, "N", "S"), "0°0'0.0\"N");
});

test("decimal degrees keep their sign, which is how they are written", () => {
    assert.equal(decimalDegrees(-33.8688), "-33.8688");
    assert.equal(decimalDegrees(56.9496), "56.9496");
    assert.equal(
        decimalPlace({ latitude: -33.8688, longitude: -151.2093 }),
        "-33.8688, -151.2093"
    );
});

test("a minus sign in front of nothing is not a coordinate", () => {
    // (-0.00001).toFixed(4) is "-0.0000", which prints a hemisphere the
    // photograph was never in.
    assert.equal(decimalDegrees(-0.00001), "0.0000");
    assert.equal(
        decimalPlace({ latitude: -0.00001, longitude: -0.00001 }),
        "0.0000, 0.0000"
    );
});

test("both forms are written to a fixed width, so a column stays a column", () => {
    assert.equal(decimalDegrees(5), "5.0000");
    assert.equal(sexagesimal(5, "N", "S"), "5°0'0.0\"N");
});

test("a coordinate at the pole is still written whole", () => {
    assert.equal(sexagesimal(90, "N", "S"), "90°0'0.0\"N");
    assert.equal(sexagesimal(-90, "N", "S"), "90°0'0.0\"S");
});

test("the sign is read off the coordinate, not off the rounding", () => {
    // Half of the smallest displayed unit south of the equator rounds to a
    // magnitude of one unit, and rounded again as a signed number to negative
    // zero -- so a place a tenth of a second south of the equator was
    // labelled north of it.
    assert.equal(sexagesimal(-0.5 / 36000, "N", "S"), "0°0'0.1\"S");
    assert.equal(sexagesimal(0.5 / 36000, "N", "S"), "0°0'0.1\"N");
    assert.equal(sexagesimal(-0.4 / 36000, "N", "S"), "0°0'0.0\"N", "rounds to nothing");
});

test("a coordinate that is not quite zero is still written to its width", () => {
    assert.equal(decimalDegrees(-0.00004), "0.0000");
    assert.equal(decimalDegrees(-0.00005), "-0.0001");
});
