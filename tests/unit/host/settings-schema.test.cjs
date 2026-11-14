"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { SETTINGS_SCHEMA, settingIssue, validateSettings, stampIssues } = require("../../../src/core/settings.js");
const { defaultSettings, defaultAnswers } = require("../../../src/host/quick-action/settings-model.js");
const { catalogOf } = require("./fake-typefaces.cjs");
const KNOWN = catalogOf({ Menlo: ["Regular", "Bold"] });

test("the schema declares field order and each setting kind", () => {
    assert.deepEqual(Object.keys(SETTINGS_SCHEMA), ["dateFormat", "coordinateFormat", "customText", "font", "size", "textColor", "outlineWidth", "outlineColor", "position", "margin"]);
    assert.deepEqual(Object.values(SETTINGS_SCHEMA).map((rule) => rule.kind), ["choice", "choice", "text", "typeface", "integer", "color", "integer", "color", "choice", "integer"]);
    assert.equal(SETTINGS_SCHEMA.customText.multiline, true);
    assert.equal(SETTINGS_SCHEMA.font.default, "Helvetica Neue");
    assert.deepEqual(SETTINGS_SCHEMA.font.suggestions, ["Helvetica Neue", "Arial", "Verdana", "Avenir Next", "Gill Sans", "Georgia", "Palatino", "Baskerville", "Menlo", "Courier New"]);
});

test("the declared typeface default is preferred only when this machine offers it", () => {
    assert.equal(defaultSettings(["Menlo", "Helvetica Neue"]).font, "Helvetica Neue");
    assert.equal(defaultAnswers(["Menlo", "Helvetica Neue"]).font, "Helvetica Neue");
    assert.equal(defaultSettings(["Menlo", "Menlo Bold"]).font, "Menlo");
    assert.equal(defaultSettings([]).font, "");
    const settings = defaultSettings(["Menlo"]);
    delete settings.font;
    assert.deepEqual(validateSettings(settings).issues, [{ field: "font", code: "text", stage: "settings", message: "Typeface must be text." }]);
});

test("setting issues return their shared receipt context without throwing", () => {
    assert.equal(settingIssue("size", 8), null);
    assert.equal(settingIssue("size", 400), null);
    assert.deepEqual(settingIssue("size", 401), { field: "size", code: "integer", stage: "settings", message: "Text size must be a whole number from 8 to 400." });
    assert.deepEqual(settingIssue("missing", 1), { field: "missing", code: "unknown", stage: "settings", message: "Unknown setting: missing." });
    assert.equal(settingIssue("font", "Menlo"), null);
    assert.equal(settingIssue("customText", "caption"), null);
    assert.equal(settingIssue("textColor", "ffffff"), null);
});

test("an empty stamp identifies custom text as an invalid setting", () => {
    const empty = { ...defaultSettings(["Menlo"]), dateFormat: "none", customText: " \n " };
    assert.deepEqual(stampIssues(empty, KNOWN), [{ code: "empty-stamp", field: "customText", stage: "settings", message: "Choose a date/time format, include GPS coordinates, or enter custom text. Otherwise there is nothing to stamp." }]);
    for (const override of [{ dateFormat: "iso-date" }, { coordinateFormat: "decimal" }, { customText: "caption" }]) {
        assert.deepEqual(stampIssues({ ...empty, ...override }, KNOWN), []);
    }
});

test("typeface checks use the catalog and accept independent partial answers", () => {
    assert.deepEqual(stampIssues({ font: "Menlo Bold" }, KNOWN), []);
    const issues = stampIssues({ font: "Absent" }, KNOWN);
    assert.equal(issues.length, 1);
    assert.deepEqual({ code: issues[0].code, field: issues[0].field, stage: issues[0].stage }, { code: "typeface", field: "font", stage: "settings" });
    assert.match(issues[0].message, /This Mac has no typeface called "Absent"/u);
    assert.deepEqual(stampIssues({ customText: "" }, KNOWN), []);
    assert.deepEqual(stampIssues({ font: "Absent" }), []);
    assert.deepEqual(stampIssues({ font: "Absent" }, null), []);
});

test("inherited object names remain unknown settings", () => {
    for (const field of ["toString", "constructor", "__proto__"]) {
        const issue = { field, code: "unknown", stage: "settings", message: `Unknown setting: ${field}.` };
        assert.deepEqual(settingIssue(field, "value"), issue);
        const values = { ...defaultSettings(["Menlo"]), [field]: "value" };
        assert.deepEqual(validateSettings(values).issues, [issue]);
    }
});
