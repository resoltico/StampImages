"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { hasVisibleText, stampsNothing } = require("../../../src/core/stamp-content.js");
const { validateSettings, stampIssues } = require("../../../src/core/settings.js");
const GOOD = { dateFormat: "none", coordinateFormat: "none", customText: "Caption", font: "Menlo", size: 36, textColor: "#FFFFFF", outlineWidth: 2, outlineColor: "#202020", position: "bottom-right", margin: 24 };

test("invisible-only text is blank but combining sequences, emoji and real scripts remain visible", () => {
    for (const customText of ["", " \t\n", "\u200b", "\u202e", "\u2060", "\u200e", "\u00ad", "\u3164", "\u2800", "\u115f", "\u1160", "\uffa0", "\u0007", "\u0000", " \u200b\u2800 "]) {
        assert.equal(hasVisibleText(customText), false, JSON.stringify(customText));
        assert.equal(stampsNothing({ ...GOOD, customText }), true);
    }
    for (const customText of ["e\u0301", "👩‍👩‍👧‍👦", "שלום", "العربية", "가", "A\u200b", " \u200eשלום"]) {
        assert.equal(hasVisibleText(customText), true, customText);
        assert.equal(stampsNothing({ ...GOOD, customText }), false);
    }
    assert.throws(() => hasVisibleText(undefined), TypeError);
});

test("safe invisible captions are empty-stamp while unsafe Unicode keeps its earlier typed refusal", () => {
    for (const customText of ["\u200b", "\u0007", " \u3164\u2800 "]) {
        const result = validateSettings({ ...GOOD, customText });
        assert.deepEqual(result.issues, []);
        assert.deepEqual(stampIssues(result.settings).map(({ code, field, stage }) => ({ code, field, stage })), [{ code: "empty-stamp", field: "customText", stage: "settings" }]);
    }
    for (const customText of ["\u0000", "A\u0000", "\ud800"]) {
        for (const dateFormat of ["none", "iso-date"]) {
            const result = validateSettings({ ...GOOD, dateFormat, customText });
            assert.equal(result.issues[0].code, "text");
            assert.equal(result.issues[0].field, "customText");
        }
    }
});

test("line endings normalize before the caption limit is counted", () => {
    const read = validateSettings({ ...GOOD, customText: "A\r\nB\rC" });
    assert.equal(read.settings.customText, "A\nB\nC");
    assert.equal(validateSettings({ ...GOOD, customText: `${"x".repeat(499)}\r\n` }).settings.customText.length, 500);
    assert.equal(validateSettings({ ...GOOD, customText: `${"x".repeat(500)}\r\n` }).issues[0].code, "text");
});
