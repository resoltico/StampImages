"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { inscriptionFor } = require("../../../src/core/inscription.js");
const { defaultSettings } = require("../../../src/host/quick-action/settings-model.js");
const { coordinates } = require("../../../src/core/metadata.js");
const { exifFacts, wholeDegrees } = require("../core/gps-fixtures.cjs");
const DEFAULTS = defaultSettings(["Menlo"]);
const DATE = { DateTimeOriginal: "2026:09:09 14:30:05" };

test("disabled coordinates are not inspected or reported missing", () => {
    const facts = {
        ...DATE,
        get gps() { throw new Error("disabled GPS was read"); }
    };
    const stamp = inscriptionFor(facts, DEFAULTS);

    assert.deepEqual(stamp, { text: "\u20662026-09-09 14:30\u2069", lines: ["2026-09-09 14:30"] });
});

test("missing requested components remain explicit when another component allows a copy", () => {
    assert.deepEqual(inscriptionFor(DATE, { ...DEFAULTS, coordinateFormat: "decimal" }).missing,
        ["GPS coordinates"]);
    const both = inscriptionFor({}, { ...DEFAULTS, coordinateFormat: "decimal", customText: "caption" });

    assert.deepEqual(both.lines, ["caption"]);
    assert.deepEqual(both.missing, ["date/time", "GPS coordinates"]);
    assert.deepEqual(inscriptionFor(wholeDegrees(0, 0), {
        ...DEFAULTS, coordinateFormat: "decimal"
    }).missing, ["date/time"]);
    assert.match(inscriptionFor({}, DEFAULTS).nothing, /does not say when/u);
});

test("raw component grammar rejects coercions while zero, boundaries and tiny ratios remain valid", () => {
    const zero = [["0", "1"], ["0", "1"], ["0", "1"]];
    for (const bad of [true, false, [], [12], {}, "0x10", "0b10", "1e2", "  ", "NaN", Infinity, "12junk"]) {
        const invalid = [[bad, "1"], ["0", "1"], ["0", "1"]];
        assert.equal(coordinates(exifFacts(invalid, zero)), null);
        assert.equal(coordinates(exifFacts(zero, invalid)), null);
    }
    for (const [facts, latitude, longitude] of [
        [wholeDegrees(0, 0), 0, 0], [wholeDegrees(90, 180), 90, 180], [wholeDegrees(90, 180, "S", "W"), -90, -180],
        [exifFacts([["1", "10000000"], ["0", "1"], ["0", "1"]], [["1", "10000000"], ["0", "1"], ["0", "1"]], "N", "W"), 1e-7, -1e-7],
        [exifFacts([["1", "2"], ["0", "1"], ["0", "1"]], [["24", "1"], ["0", "1"], ["0", "1"]]), 0.5, 24]
    ]) { assert.deepEqual(coordinates(facts), { latitude, longitude }); }
});

test("a requested field that is recorded but unusable is named apart from one that is absent", () => {
    // Field regression: An impossible recorded DateTimeOriginal and a latitude
    // of 999 degrees were reported as photographs that "do not say" when or
    // where they were taken.
    const broken = { DateTimeOriginal: "2026:02:30 00:00:00", ...wholeDegrees(999, 12) };
    const both = { ...DEFAULTS, coordinateFormat: "decimal" };
    const nothing = inscriptionFor(broken, both);

    assert.deepEqual(nothing.missing, ["date/time", "GPS coordinates"]);
    assert.deepEqual(nothing.invalid, ["date/time", "GPS coordinates"]);
    assert.match(nothing.nothing, /Its date\/time and GPS coordinates are recorded but not valid/u);
    const partial = inscriptionFor({ DateTimeOriginal: "2020:02:30 25:61:61", ...wholeDegrees(1, 2) }, both);

    assert.deepEqual(partial.invalid, ["date/time"]);
    assert.equal(inscriptionFor({}, both).invalid, undefined, "absent is not invalid");
    assert.match(inscriptionFor({ CreateDate: " " }, DEFAULTS).nothing, /does not say when it was taken,/u);
    assert.match(inscriptionFor({ CreateDate: "garbled" }, DEFAULTS).nothing,
        /Its date\/time is recorded but not valid, and there/u);
    for (const absent of [undefined, null, "", "  "]) {
        assert.equal(inscriptionFor({ DateTimeOriginal: absent }, DEFAULTS).invalid, undefined, String(absent));
    }
    const gps = { ...DEFAULTS, dateFormat: "none", coordinateFormat: "decimal" };

    assert.deepEqual(inscriptionFor({ gps: { exif: { latitude: [["91", "1"], ["0", "1"], ["0", "1"]] } } }, gps).invalid, ["GPS coordinates"], "half a position is recorded");
    assert.deepEqual(inscriptionFor({ gps: { exif: { longitude: [["181", "1"], ["0", "1"], ["0", "1"]] } } }, gps).invalid, ["GPS coordinates"]);
});
