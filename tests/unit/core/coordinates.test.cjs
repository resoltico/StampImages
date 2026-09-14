"use strict";

/*
 * Where a photograph says it was taken, read strictly.
 *
 * Both halves or neither: a latitude alone is not a place, and stamping one
 * would be stamping half a coordinate as though it were a location. And every
 * value is a claim by whatever wrote the file, so what is not a number is not
 * turned into one -- Number() answers for everything, and the answers it gives
 * for an empty string and an empty list are both the null island.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const { coordinates } = require("../../../src/core/metadata.js");

test("a coordinate is both halves or neither", () => {
    // A latitude alone is not a place.
    assert.deepEqual(
        coordinates({ GPSLatitude: 56.9496, GPSLongitude: 24.1052 }),
        { latitude: 56.9496, longitude: 24.1052 }
    );
    assert.equal(coordinates({ GPSLatitude: 56.9496 }), null);
    assert.equal(coordinates({ GPSLongitude: 24.1052 }), null);
    assert.equal(coordinates({}), null);
});

test("degrees off the globe are not a location", () => {
    assert.equal(coordinates({ GPSLatitude: 91, GPSLongitude: 0 }), null);
    assert.equal(coordinates({ GPSLatitude: 0, GPSLongitude: 181 }), null);
    assert.deepEqual(
        coordinates({ GPSLatitude: -90, GPSLongitude: 180 }),
        { latitude: -90, longitude: 180 }
    );
});

test("a tag holding something other than a number is missing", () => {
    // Number("") is 0 and Number(true) is 1, which is how the null island
    // gets stamped onto photographs taken indoors.
    for (const value of ["", true, false, null, "north", [], {}]) {
        assert.equal(
            coordinates({ GPSLatitude: value, GPSLongitude: 24 }),
            null,
            JSON.stringify(value)
        );
    }
});

test("a coordinate written as text is still a coordinate", () => {
    assert.deepEqual(
        coordinates({ GPSLatitude: "56.9496", GPSLongitude: "24.1052" }),
        { latitude: 56.9496, longitude: 24.1052 }
    );
});

test("a coordinate is a number or text, never anything else coerced", () => {
    // Number([56.9]) is 56.9, which is how a list of coordinates becomes one.
    assert.equal(coordinates({ GPSLatitude: [56.9], GPSLongitude: [24.1] }), null);
});

test("a coordinate written with spaces around it is still a coordinate", () => {
    assert.deepEqual(
        coordinates({ GPSLatitude: " 56.9496 ", GPSLongitude: "\t24.1052\n" }),
        { latitude: 56.9496, longitude: 24.1052 }
    );
});
