"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { captureFacts } = require("../../../src/host/capture-facts.js");
const { coordinates, coordinatesRecorded } = require("../../../src/core/metadata.js");
const { inscriptionFor } = require("../../../src/core/inscription.js");
const cases = require("./captured-gps.cjs");
for (const sample of cases) {
    test(`native producer claim → adapter → domain: ${sample.name}`, () => {
        const facts = captureFacts(sample.projection);
        assert.equal(Object.hasOwn(facts, "ExifToolVersion"), false);
        assert.equal(Object.hasOwn(facts, "FileName"), false);
        assert.equal(coordinatesRecorded(facts), sample.recorded);
        for (const tag of ["DateTimeOriginal", "CreateDate"]) {
            if (Object.hasOwn(sample.projection, tag)) { assert.equal(facts[tag], sample.projection[tag]); }
        }
        const place = coordinates(facts);
        if (sample.expected) {
            assert.ok(Math.abs(place.latitude - sample.expected.latitude) < 1e-10);
            assert.ok(Math.abs(place.longitude - sample.expected.longitude) < 1e-10);
        } else { assert.equal(place, null); }
    });
}
for (const sample of cases.filter((row) => ["bad-refs.jpg", "minutes60.jpg", "zero-denominator.jpg", "missing-refs.jpg", "wrong-exif-type.jpg", "xmp-bad-ref.jpg", "xmp-minutes60.jpg"].includes(row.name))) {
    test(`invalid raw GPS never becomes an inscription: ${sample.name}`, () => {
        const facts = captureFacts(sample.projection);
        const settings = { dateFormat: "none", coordinateFormat: "decimal", customText: "" };
        const nothing = inscriptionFor(facts, settings);
        assert.deepEqual(nothing.missing, ["GPS coordinates"]);
        assert.deepEqual(nothing.invalid, ["GPS coordinates"]);
        assert.equal(nothing.lines, undefined);
        assert.match(nothing.nothing, /recorded but not valid/u);
        const caption = inscriptionFor(facts, { ...settings, customText: "Caption" });
        assert.deepEqual(caption.lines, ["Caption"]);
        assert.deepEqual(caption.invalid, ["GPS coordinates"]);
    });
}
test("absent GPS is missing rather than recorded-invalid", () => {
    const nothing = inscriptionFor({}, { dateFormat: "none", coordinateFormat: "decimal", customText: "" });
    assert.equal(nothing.invalid, undefined); assert.doesNotMatch(nothing.nothing, /recorded but not valid/u);
});
test("valid native XMP-only southwest coordinates are stamped", () => {
    const sample = cases.find((row) => row.name === "xmp-only-sw.jpg");
    const made = inscriptionFor(captureFacts(sample.projection), { dateFormat: "none", coordinateFormat: "decimal", customText: "" });
    assert.deepEqual(made.lines, ["-22.9519, -43.2105"]); assert.equal(made.invalid, undefined);
});
test("the adapter keeps a wrong wire type recorded-invalid and preserves capture dates", () => {
    const facts = captureFacts({ ExifToolVersion: "13.55", EXIFGPSLatitudeRaw: "bad", EXIFGPSLongitude: "20/1 0/1 0/1", DateTimeOriginal: "recorded bad", CreateDate: "2024:07:15 18:42:10" });
    assert.equal(facts.gps.exif.latitude, null); assert.equal(coordinatesRecorded(facts), true);
    assert.equal(coordinates(facts), null); assert.equal(facts.DateTimeOriginal, "recorded bad");
    assert.equal(facts.CreateDate, "2024:07:15 18:42:10");
});

test("reference-only EXIF with no XMP coordinates is absent rather than recorded-invalid", () => {
    const facts = captureFacts({ EXIFGPSLatitudeRef: "N", EXIFGPSLongitudeRef: "E" });
    assert.deepEqual(facts.gps.xmp, {}); assert.equal(coordinatesRecorded(facts), false);
    const made = inscriptionFor(facts, { dateFormat: "none", coordinateFormat: "decimal", customText: "Caption" });
    assert.deepEqual(made.missing, ["GPS coordinates"]); assert.equal(made.invalid, undefined);
});
test("a structured wrong XMP value remains a recorded claim for domain refusal", () => {
    const facts = captureFacts({ XMPGPSLatitude: ["10,0N"], XMPGPSLongitude: "20,0E" });
    assert.equal(coordinatesRecorded(facts), true); assert.equal(coordinates(facts), null);
});
