"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { inscriptionFor } = require("../../../src/core/inscription.js");
const { defaultSettings } = require("../../../src/core/form-defaults.js");
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

    assert.deepEqual(stamp, { text: "2026-09-09 14:30", lines: ["2026-09-09 14:30"] });
});

test("missing requested components remain explicit when another component allows a copy", () => {
    assert.deepEqual(inscriptionFor(DATE, { ...DEFAULTS, coordinateFormat: "decimal" }).missing,
        ["GPS coordinates"]);
    const both = inscriptionFor({}, { ...DEFAULTS, coordinateFormat: "decimal", customText: "caption" });

    assert.equal(both.text, "caption");
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
