"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { inscriptionFor } = require("../../../src/core/inscription.js");
const { defaultSettings } = require("../../../src/host/form-defaults.js");
const { coordinates } = require("../../../src/core/metadata.js");
const DEFAULTS = defaultSettings(["Menlo"]);
const DATE = { DateTimeOriginal: "2026:09:09 14:30:05" };

test("disabled coordinates are not inspected or reported missing", () => {
    const facts = {
        ...DATE,
        get GPSLatitude() { throw new Error("disabled GPS was read"); },
        get GPSLongitude() { throw new Error("disabled GPS was read"); }
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
    assert.deepEqual(inscriptionFor({ GPSLatitude: 0, GPSLongitude: 0 }, {
        ...DEFAULTS, coordinateFormat: "decimal"
    }).missing, ["date/time"]);
    assert.match(inscriptionFor({}, DEFAULTS).nothing, /does not say when/u);
});

test("coordinate parsing rejects coercible non-decimal data without losing valid zero or tiny numbers", () => {
    for (const bad of [true, false, [], [12], {}, "0x10", "0b10", "1e2", "  ", "NaN", Infinity, "12junk"]) {
        assert.equal(coordinates({ GPSLatitude: bad, GPSLongitude: 20 }), null);
        assert.equal(coordinates({ GPSLatitude: 20, GPSLongitude: bad }), null);
    }
    for (const [latitude, longitude] of [[0, 0], [90, 180], [-90, -180], [1e-7, -1e-7], [" +0.0 ", "-0"], [".5", "24."]]) {
        const value = coordinates({ GPSLatitude: latitude, GPSLongitude: longitude });

        assert.equal(value.latitude, Number(latitude));
        assert.equal(value.longitude, Number(longitude));
    }
});

test("a requested field that is recorded but unusable is named apart from one that is absent", () => {
    // Field regression: DateTimeOriginal "0000:00:00 00:00:00" and a latitude
    // of 999 degrees were reported as photographs that "do not say" when or
    // where they were taken.
    const broken = { DateTimeOriginal: "0000:00:00 00:00:00", GPSLatitude: 999, GPSLongitude: 12 };
    const both = { ...DEFAULTS, coordinateFormat: "decimal" };
    const nothing = inscriptionFor(broken, both);

    assert.deepEqual(nothing.missing, ["date/time", "GPS coordinates"]);
    assert.deepEqual(nothing.invalid, ["date/time", "GPS coordinates"]);
    assert.match(nothing.nothing, /its date\/time and GPS coordinates are recorded but not valid/u);
    const partial = inscriptionFor({ DateTimeOriginal: "2020:02:30 25:61:61", GPSLatitude: 1, GPSLongitude: 2 }, both);

    assert.deepEqual(partial.invalid, ["date/time"]);
    assert.equal(inscriptionFor({}, both).invalid, undefined, "absent is not invalid");
    assert.match(inscriptionFor({ CreateDate: " " }, DEFAULTS).nothing, /does not say when it was taken,/u);
    assert.match(inscriptionFor({ CreateDate: "garbled" }, DEFAULTS).nothing,
        /does not say when it was taken \(its date\/time is recorded but not valid\), and there/u);
    for (const absent of [undefined, null, "", "  "]) {
        assert.equal(inscriptionFor({ DateTimeOriginal: absent }, DEFAULTS).invalid, undefined, String(absent));
    }
    const gps = { ...DEFAULTS, dateFormat: "none", coordinateFormat: "decimal" };

    assert.deepEqual(inscriptionFor({ GPSLatitude: 91 }, gps).invalid, ["GPS coordinates"], "half a position is recorded");
    assert.deepEqual(inscriptionFor({ GPSLongitude: 181 }, gps).invalid, ["GPS coordinates"]);
});
