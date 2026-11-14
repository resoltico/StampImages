"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { coordinates, coordinatesRecorded } = require("../../../src/core/metadata.js");
const component = (numerator, denominator = "1") => [numerator, denominator];
const valid = () => ({ gps: { exif: {
    latitude: [component("10"), component("20"), component("30")], latitudeRef: "N",
    longitude: [component("40"), component("50"), component("15")], longitudeRef: "E"
} } });
for (const [name, change] of [
    ["missing latitude", exif => { delete exif.latitude; }],
    ["missing longitude", exif => { delete exif.longitude; }],
    ["missing latitude reference", exif => { delete exif.latitudeRef; }],
    ["unknown latitude reference", exif => { exif.latitudeRef = "X"; }],
    ["wrong axis latitude reference", exif => { exif.latitudeRef = "E"; }],
    ["wrong axis longitude reference", exif => { exif.longitudeRef = "N"; }],
    ["lowercase reference", exif => { exif.latitudeRef = "n"; }],
    ["reference suffix", exif => { exif.latitudeRef = "North"; }],
    ["negative degree", exif => { exif.latitude[0][0] = "-10"; }],
    ["negative minute", exif => { exif.latitude[1][0] = "-1"; }],
    ["negative denominator", exif => { exif.latitude[0][1] = "-1"; }],
    ["zero denominator", exif => { exif.latitude[0][1] = "0"; }],
    ["sixty minutes", exif => { exif.latitude[1][0] = "60"; }],
    ["sixty seconds", exif => { exif.latitude[2][0] = "60"; }],
    ["latitude above pole", exif => { exif.latitude[0][0] = "91"; }],
    ["nonzero minutes at pole", exif => { exif.latitude[0][0] = "90"; }],
    ["longitude above bound", exif => { exif.longitude[0][0] = "181"; }],
    ["numeric fraction members", exif => { exif.latitude[0][0] = 10; }],
    ["infinite fraction", exif => { exif.latitude[0][0] = "Infinity"; }],
    ["fraction is not a pair", exif => { exif.latitude[0] = "10/1"; }],
    ["fraction is incomplete", exif => { exif.latitude[0] = ["10"]; }],
    ["fraction has extra pieces", exif => { exif.latitude[0] = ["10", "1", "1"]; }],
    ["unsafe integer component", exif => { exif.latitude[0][0] = "9007199254740992"; }],
    ["two fractions", exif => { exif.latitude.pop(); }],
    ["recorded wrong wire type", exif => { exif.latitude = null; }],
    ["empty recorded coordinate", exif => { exif.latitude = []; }]
]) {
    test(`EXIF refusal: ${name}`, () => {
        const facts = valid(); change(facts.gps.exif);
        assert.equal(coordinates(facts), null);
        assert.equal(coordinatesRecorded(facts), true);
    });
}
for (const lexical of ["-10,20N", "+10,20N", "10,60N", "10,0,60N", "91,0N", "90,0.00000000000000001N", "10,20E", "10,20X", "10,20", "10.2", "10,20n", "10,20N junk", "10,20N\n", "10,20.1,1N", "10,20N\u0000", "NaN,0N", 10, null, []]) {
    test(`XMP refusal: ${JSON.stringify(lexical)}`, () => {
        const facts = { gps: { xmp: { latitude: lexical, longitude: "40,50E" } } };
        assert.equal(coordinates(facts), null);
        assert.equal(coordinatesRecorded(facts), true);
    });
}
test("valid northern/eastern EXIF DMS", () => {
    const place = coordinates(valid());
    assert(Math.abs(place.latitude - 10.341666666666667) < 1e-12);
    assert(Math.abs(place.longitude - 40.8375) < 1e-12);
});
test("valid XMP DMS and decimal minutes carry their own hemispheres", () => {
    const place = coordinates({ gps: { xmp: { latitude: " 10, 20, 30S ", longitude: "40,50.25W" } } });
    assert(Math.abs(place.latitude - -10.341666666666667) < 1e-12);
    assert(Math.abs(place.longitude - -40.8375) < 1e-12);
});
test("exact poles and antimeridian", () => {
    assert.deepEqual(coordinates({ gps: { xmp: { latitude: "90,0N", longitude: "180,0W" } } }), { latitude: 90, longitude: -180 });
});
test("invalid EXIF + valid XMP refuses rather than choosing different place", () => {
    const facts = valid(); facts.gps.exif.latitudeRef = "X";
    facts.gps.xmp = { latitude: "48,51.396N", longitude: "2,21.132E" };
    assert.equal(coordinates(facts), null);
});
test("incomplete EXIF and complete XMP never blend or fallback", () => {
    const facts = valid(); delete facts.gps.exif.longitude;
    facts.gps.xmp = { latitude: "48,51.396N", longitude: "2,21.132E" };
    assert.equal(coordinates(facts), null);
});
test("EXIF refs alone do not shadow a complete intrinsic XMP pair", () => {
    const facts = { gps: { exif: { latitudeRef: "X", longitudeRef: "Q" }, xmp: { latitude: "10,0S", longitude: "20,0W" } } };
    assert.deepEqual(coordinates(facts), { latitude: -10, longitude: -20 });
});
test("absent coordinates and EXIF refs alone are missing", () => {
    assert.equal(coordinates({}), null); assert.equal(coordinatesRecorded({}), false);
    assert.equal(coordinatesRecorded({ gps: { exif: { latitudeRef: "N" } } }), false);
});
test("normalized scalar GPS fields have no fallback", () => {
    assert.equal(coordinates({ GPSLatitude: 10, GPSLongitude: 20 }), null);
    assert.equal(coordinatesRecorded({ GPSLatitude: 10, GPSLongitude: 20 }), false);
});

test("an incomplete XMP pair is recorded but not a location", () => {
    const facts = { gps: { xmp: { latitude: "10,0N" } } };
    assert.equal(coordinates(facts), null); assert.equal(coordinatesRecorded(facts), true);
});
test("an oversized numeric XMP lexeme cannot become an infinite coordinate", () => {
    assert.equal(coordinates({ gps: { xmp: { latitude: `${"9".repeat(400)},0N`, longitude: "20,0E" } } }), null);
});

test("zero-over-zero and unsafe fractions are refused before they can invent finite values", () => {
    for (const fraction of [["0", "0"], ["9007199254740993", "9007199254740992"]]) {
        const facts = valid(); facts.gps.exif.latitude[0] = fraction; assert.equal(coordinates(facts), null);
    }
});
test("tiny nonzero EXIF pole offsets are rejected even when the magnitude rounds to the pole", () => {
    for (const axis of [1, 2]) {
        const facts = valid(); facts.gps.exif.latitude = [["90", "1"], ["0", "1"], ["0", "1"]];
        facts.gps.exif.latitude[axis] = ["1", "9007199254740991"]; assert.equal(coordinates(facts), null);
    }
});
test("XMP decimal seconds retain all precision and need no spaces after commas", () => {
    const place = coordinates({ gps: { xmp: { latitude: "10,20,30.25N", longitude: "40,50,15.125E" } } });
    assert.ok(Math.abs(place.latitude - 10.341736111111111) < 1e-12);
    assert.ok(Math.abs(place.longitude - 40.83753472222222) < 1e-12);
});
test("nonzero XMP offsets below floating precision cannot become exact poles", () => {
    const tiny = `0.${"0".repeat(323)}1`;
    assert.equal(coordinates({ gps: { xmp: { latitude: `90,${tiny}N`, longitude: "20,0E" } } }), null);
    assert.equal(coordinates({ gps: { xmp: { latitude: "10,0N", longitude: `180,0,${tiny}E` } } }), null);
});
