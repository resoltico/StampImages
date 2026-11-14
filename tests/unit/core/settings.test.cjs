"use strict";

/*
 * What a setting means, and validation of whatever arrives -- from the form,
 * from a remembered run, or from a headless caller.
 *
 * One validator, so a value refused in one place cannot be accepted in
 * another, and everything it returns is what the pipeline stores.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const {
    normalizeSettings,
    CUSTOM_TEXT_LIMIT
} = require("../../../src/core/settings.js");
const { stampsNothing } = require("../../../src/core/stamp-content.js");

const GOOD = {
    font: "Helvetica Neue",
    size: 36,
    textColor: "#FFFFFF",
    outlineColor: "#000000",
    outlineWidth: 2,
    position: "bottom-right",
    margin: 24,
    dateFormat: "iso-minutes",
    coordinateFormat: "decimal",
    customText: "Riga"
};

function normalized(overrides = {}) {
    return normalizeSettings({ ...GOOD, ...overrides });
}

test("what comes back is what the pipeline stores, in its own types", () => {
    assert.deepEqual(normalized(), { ...GOOD });
});

test("JSON numbers cannot be supplied as strings", () => {
    for (const key of ["size", "margin", "outlineWidth"]) { assert.throws(() => normalized({ [key]: "24" }), /whole number/u); }
});

test("a number outside its bounds is refused by name", () => {
    assert.throws(() => normalized({ size: 7 }), /Text size/u);
    assert.throws(() => normalized({ size: 401 }), /Text size/u);
    assert.throws(() => normalized({ margin: -1 }), /Margin/u);
    assert.throws(() => normalized({ margin: 2001 }), /Margin/u);
    assert.throws(() => normalized({ outlineWidth: 21 }), /Outline/u);
});

test("a color is canonical however it was written", () => {
    const settings = normalized({ textColor: "ff8000", outlineColor: " #ffffff " });

    assert.equal(settings.textColor, "#FF8000");
    assert.equal(settings.outlineColor, "#FFFFFF");
});

test("something that is not a color is refused by name", () => {
    assert.throws(() => normalized({ textColor: "sky" }), /Text color/u);
    assert.throws(() => normalized({ outlineColor: "#12345" }), /Outline color/u);
    // Shorthand is refused rather than guessed at: #FFF is as readily an
    // unfinished #FFF000 as it is white.
    assert.throws(() => normalized({ textColor: "#FFF" }), /Text color/u);
});

test("a choice nothing offers is refused rather than passed on", () => {
    assert.throws(() => normalized({ position: "middle" }), /Position must be one of: bottom-right, bottom-left, top-right, top-left, bottom-center, top-center\./u);
    assert.throws(
        () => normalized({ dateFormat: "rfc822" }),
        /Date\/time format must be one of: iso-minutes, iso-date, long-date, none\./u
    );
    assert.throws(
        () => normalized({ coordinateFormat: "utm" }),
        /Coordinate format must be one of: none, decimal, sexagesimal\./u
    );
});

test("a font is taken as typed, less the spaces around it", () => {
    assert.equal(normalized({ font: "  Menlo Bold  " }).font, "Menlo Bold");
    assert.throws(() => normalized({ font: undefined }), /Typeface/u);
});

test("custom text is bounded, because a stamp is a caption", () => {
    // Unbounded, it renders a text image larger than the photograph.
    const long = "x".repeat(CUSTOM_TEXT_LIMIT);

    assert.equal(normalized({ customText: long }).customText, long);
    assert.throws(
        () => normalized({ customText: `${long}x` }),
        new RegExp(`${CUSTOM_TEXT_LIMIT} characters or fewer`, "u")
    );
});

test("all settings are required, unknown fields and malformed values are rejected together", () => {
    const { validateSettings } = require("../../../src/core/settings.js");
    assert.throws(() => normalized({ customText: null }), /Custom text/u);
    const result = validateSettings({ ...GOOD, size: "36", margin: -1, extra: true });
    assert.deepEqual(result.issues.map((issue) => issue.field).sort(), ["extra", "margin", "size"]);
    for (const value of [null, [], 1, false]) { assert.equal(validateSettings(value).issues[0].code, "object"); }
    for (const field of Object.keys(GOOD)) { const value = { ...GOOD }; delete value[field]; assert.ok(validateSettings(value).issues.some((issue) => issue.field === field)); }
});

test("a request that would stamp nothing is one to refuse", () => {
    // A run that copies photographs and draws nothing on them is a run that
    // copied photographs for no reason.
    assert.equal(
        stampsNothing(normalized({
            dateFormat: "none",
            coordinateFormat: "none",
            customText: "   \n  "
        })),
        true
    );
});

test("any one of the three is enough to be worth stamping", () => {
    const nothing = { dateFormat: "none", coordinateFormat: "none", customText: "" };

    assert.equal(stampsNothing(normalized({ ...nothing, dateFormat: "iso-date" })), false);
    assert.equal(
        stampsNothing(normalized({ ...nothing, coordinateFormat: "decimal" })),
        false
    );
    assert.equal(stampsNothing(normalized({ ...nothing, customText: "Riga" })), false);
});

test("each malformed field is identified structurally", () => {
    const { validateSettings } = require("../../../src/core/settings.js");
    for (const field of Object.keys(GOOD)) { assert.ok(validateSettings({ ...GOOD, [field]: [] }).issues.some((issue) => issue.field === field)); }
});

test("unknown individual settings and a blank typeface are refused", () => {
    const { readSetting } = require("../../../src/core/settings.js");
    assert.throws(() => readSetting("obsolete", 1), /Unknown setting/u);
    assert.throws(() => normalized({ font: "   " }), /name a face/u);
});

test("typed settings report exact issue context and reject fractional boundaries", () => {
    const { validateSettings, readSetting } = require("../../../src/core/settings.js");
    assert.deepEqual(validateSettings(null), { issues: [{ code: "object", stage: "settings", message: "Settings must be a JSON object." }] });
    assert.deepEqual(validateSettings({ ...GOOD, obsolete: true }).issues, [{ field: "obsolete", code: "unknown", stage: "settings", message: "Unknown setting: obsolete." }]);
    assert.deepEqual(validateSettings({ ...GOOD, size: 36.5 }).issues, [{ field: "size", code: "integer", stage: "settings", message: "Text size must be a whole number from 8 to 400." }]);
    for (const [field, values] of [["size", [7, 401, 36.5, NaN, Infinity]], ["margin", [-1, 2001, 1.5]], ["outlineWidth", [-1, 21, 1.5]]]) {
        for (const value of values) { assert.throws(() => normalized({ [field]: value }), /whole number/u); }
    }
    assert.equal(readSetting("font", " A long installed typeface name "), "A long installed typeface name");
    assert.equal(readSetting("customText", "x".repeat(500)).length, 500);
    assert.throws(() => normalizeSettings({ ...GOOD, size: 1, margin: -1 }), /Text size.*\nMargin/u);
});

test("field regression: unrenderable caption strings are invalid settings before processing", () => {
    const { validateSettings } = require("../../../src/core/settings.js");
    for (const customText of ["before\u0000after", "before\ud800after", "before\udfffafter"]) {
        const result = validateSettings({ ...GOOD, customText });
        assert.ok(result.issues.some((issue) => issue.field === "customText" && issue.stage === "settings"));
    }
    assert.equal(normalized({ customText: "Rīga & <literal>\nمرحبا 📷\t" }).customText, "Rīga & <literal>\nمرحبا 📷\t");
});

test("each refused setting carries the shared code for its kind of value", () => {
    // Shared with Image Files to PDF: unknown, choice, integer, text and color.
    const { validateSettings: validate, readSetting } = require("../../../src/core/settings.js");
    const codes = Object.fromEntries(validate({
        ...GOOD, extra: 1, position: 7, size: "36", textColor: "red", font: " ", customText: 5
    }).issues.map((issue) => [issue.field, issue.code]));

    assert.deepEqual(codes, { extra: "unknown", position: "choice", size: "integer", textColor: "color", font: "text", customText: "text" });
    assert.throws(() => readSetting("nope", 1), (error) => error.issues[0].code === "unknown");
});
