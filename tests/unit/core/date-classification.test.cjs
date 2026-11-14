"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { readMoment, isRecordedMoment } = require("../../../src/core/moment.js");
const { captureMoment, captureMomentRecorded } = require("../../../src/core/metadata.js");
const { inscriptionFor } = require("../../../src/core/inscription.js");
const { reportText } = require("../../../src/core/run-report.js");
const { runOutcome } = require("../../../src/core/outcomes.js");
const settings = { dateFormat: "iso-date", coordinateFormat: "decimal", customText: "Caption" };

function report(facts) {
    const made = inscriptionFor(facts, settings);
    return reportText(runOutcome([{ source: "/source.png", state: "saved", output: "/out.png", issues: [],
        missingMetadata: made.missing ?? [], invalidMetadata: made.invalid }]));
}

test("only blank placeholders and complete all-zero moments are absent", () => {
    for (const value of [undefined, null, "", " ", " : :   : : ", "0000:00:00 00:00", "  0000:00:00 00:00:00 \t", "0000:00:00 00:00:00.000+00:00"]) {
        assert.equal(isRecordedMoment(value), false, String(value));
        assert.equal(captureMomentRecorded({ DateTimeOriginal: value }), false);
        assert.equal(inscriptionFor({ DateTimeOriginal: value }, settings).invalid, undefined);
    }
    for (const value of ["0000:01:01 12:00:00", "0000:00:00 00:00:00.001", "0000:00:00 00:00:00+01:00", "0000", "0000:00:00 garbage", "garbage", false, 0, [], {}]) {
        assert.equal(isRecordedMoment(value), true, String(value));
        assert.equal(readMoment(value), null);
        assert.ok(inscriptionFor({ DateTimeOriginal: value }, settings).invalid.includes("date/time"));
    }
});

test("nonzero year0000 and impossible calendar/clock values are never stamped", () => {
    for (const value of ["0000:01:01 12:00", "1900:02:29 12:00", "2025:02:29 12:00", "2026:04:31 12:00", "2026:01:01 24:00", ["2026:01:01 12:00"]]) {
        assert.equal(readMoment(value), null);
    }
    assert.deepEqual(readMoment("0001:01:01 00:00"), { year: "0001", month: "01", day: "01", hour: "00", minute: "00" });
    assert.equal(readMoment("2000:02:29 23:59:60").day, "29");
});

test("capture date keeps first-valid fallback and its provenance", () => {
    const valid = "2024:07:15 18:42:10";
    for (const primary of ["2026:02:30 12:00", "0000:01:01 12:00", "0000:00:00 00:00:00", " "]) {
        const facts = { DateTimeOriginal: primary, CreateDate: valid };
        assert.equal(captureMoment(facts).tag, "CreateDate");
        assert.equal(inscriptionFor(facts, { ...settings, coordinateFormat: "none" }).invalid, undefined);
        assert.ok(inscriptionFor(facts, settings).lines.includes("2024-07-15"));
    }
    assert.equal(captureMoment({ DateTimeOriginal: valid, CreateDate: "2023:01:01 00:00" }).tag, "DateTimeOriginal");
    assert.equal(captureMoment({ ModifyDate: valid }), null);
});

test("human Missing notes include only absent fields while receipt omissions stay inclusive", () => {
    const invalidDate = { DateTimeOriginal: "2026:02:30 12:00" };
    const invalidGps = { GPSLatitude: 999, GPSLongitude: 20 };
    const dateText = report(invalidDate);
    assert.ok(dateText.includes("Missing requested metadata: GPS coordinates."));
    assert.ok(dateText.includes("Recorded but not valid, so left off: date/time."));
    assert.ok(!dateText.includes("Missing requested metadata: date/time"));
    const gpsText = report(invalidGps);
    assert.ok(gpsText.includes("Missing requested metadata: date/time."));
    assert.ok(!gpsText.includes("Missing requested metadata: GPS coordinates"));
    const both = inscriptionFor({ ...invalidDate, ...invalidGps }, settings);
    assert.deepEqual(both.missing, ["date/time", "GPS coordinates"]);
    assert.deepEqual(both.invalid, ["date/time", "GPS coordinates"]);
    assert.doesNotMatch(report({ ...invalidDate, ...invalidGps }), /Missing requested metadata:/u);
    assert.match(dateText, /1 copy with requested metadata left off/u);
});

test("nothing-to-stamp reasons do not call invalid fields absent or read disabled date getters", () => {
    const noText = { ...settings, customText: "" };
    const date = inscriptionFor({ DateTimeOriginal: "2026:02:30 12:00" }, noText).nothing;
    assert.match(date, /does not say where/u); assert.doesNotMatch(date, /does not say when/u);
    const gps = inscriptionFor({ GPSLatitude: 999, GPSLongitude: 20 }, noText).nothing;
    assert.match(gps, /does not say when/u); assert.doesNotMatch(gps, /does not say where/u);
    const invalid = inscriptionFor({ DateTimeOriginal: "2026:02:30 12:00", GPSLatitude: 999, GPSLongitude: 20 }, noText).nothing;
    assert.doesNotMatch(invalid, /does not say/u);
    assert.match(invalid, /recorded but not valid/u);
    const facts = { get DateTimeOriginal() { throw new Error("disabled date read"); } };
    assert.deepEqual(inscriptionFor(facts, { ...settings, dateFormat: "none", coordinateFormat: "none" }).lines, ["Caption"]);
});


test("nothing reasons are complete sentences about the requested absent or invalid content", () => {
    const request = { ...settings, customText: "" };
    const ending = ", and there is no text of your own to put on it.";
    assert.equal(inscriptionFor({ DateTimeOriginal: "2026:02:30 12:00" }, request).nothing,
        `It does not say where it was taken; its date/time is recorded but not valid${ending}`);
    assert.equal(inscriptionFor({ GPSLatitude: 999, GPSLongitude: 20 }, request).nothing,
        `It does not say when it was taken; its GPS coordinates are recorded but not valid${ending}`);
    assert.equal(inscriptionFor({ DateTimeOriginal: "2026:02:30 12:00", GPSLatitude: 999, GPSLongitude: 20 }, request).nothing,
        `Its date/time and GPS coordinates are recorded but not valid${ending}`);
    assert.equal(inscriptionFor({}, request).nothing, `It does not say when or where it was taken${ending}`);
    assert.equal(inscriptionFor({}, { dateFormat: "none", coordinateFormat: "none", customText: "" }).nothing,
        "There is no text of your own to put on it.");
});
