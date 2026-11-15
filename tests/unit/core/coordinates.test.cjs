"use strict";
const assert = require("node:assert/strict");
const test = require("node:test");
const { coordinates } = require("../../../src/core/metadata.js");
const { exifFacts, wholeDegrees, rigaFacts } = require("./gps-fixtures.cjs");
test("a coordinate is both halves or neither", () => {
    assert.deepEqual(coordinates(rigaFacts()), { latitude: 56.9496, longitude: 24.1052 });
    const latitude = rigaFacts(); delete latitude.gps.exif.longitude;
    const longitude = rigaFacts(); delete longitude.gps.exif.latitude;
    assert.equal(coordinates(latitude), null); assert.equal(coordinates(longitude), null); assert.equal(coordinates({}), null);
});
test("degrees off the globe are not a location", () => {
    assert.equal(coordinates(wholeDegrees(91, 0)), null); assert.equal(coordinates(wholeDegrees(0, 181)), null);
    assert.deepEqual(coordinates(wholeDegrees(90, 180, "S", "E")), { latitude: -90, longitude: 180 });
});
test("a tag holding something other than original fractions is refused", () => {
    for (const value of ["", true, false, null, "north", [], {}]) {
        assert.equal(coordinates(exifFacts(value, [["24", "1"], ["0", "1"], ["0", "1"]])), null, JSON.stringify(value));
    }
});
test("original text fraction components describe a coordinate", () => {
    assert.deepEqual(coordinates(rigaFacts()), { latitude: 56.9496, longitude: 24.1052 });
});
test("fraction members never coerce arrays to numbers", () => {
    assert.equal(coordinates(exifFacts([[["56"], "1"], ["0", "1"], ["0", "1"]], [["24", "1"], ["0", "1"], ["0", "1"]])), null);
});
test("an XMP coordinate permits spaces around its lexical components", () => {
    assert.deepEqual(coordinates({ gps: { xmp: { latitude: " 56, 56.976N ", longitude: " 24, 6.312E " } } }), { latitude: 56.9496, longitude: 24.1052 });
});
