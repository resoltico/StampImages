"use strict";
const { normalizeColour } = require("./colour.js");
const CUSTOM_TEXT_LIMIT = 500;
// A NUL cannot cross argv; unpaired surrogates are incomplete Unicode, not caption text.
// eslint-disable-next-line no-control-regex
const UNRENDERABLE_TEXT = /\u0000|[\uD800-\uDFFF]/u;
function choiceRule(name, values) { return { name, default: values[0], choices: values.map((value) => ({ value })) }; }
const SETTINGS_SCHEMA = Object.freeze({
    dateFormat: choiceRule("Date/time format", ["iso-minutes", "iso-date", "long-date", "none"]),
    coordinateFormat: choiceRule("Coordinate format", ["none", "decimal", "sexagesimal"]),
    customText: { name: "Custom text", maximumLength: CUSTOM_TEXT_LIMIT, default: "" },
    font: { name: "Typeface", nonempty: true },
    size: { name: "Text size", minimum: 8, maximum: 400, default: 36 },
    textColour: { name: "Text colour", kind: "colour", default: "#FFFFFF" },
    outlineWidth: { name: "Outline", minimum: 0, maximum: 20, default: 2 },
    outlineColour: { name: "Outline colour", kind: "colour", default: "#202020" },
    position: choiceRule("Position", ["bottom-right", "bottom-left", "top-right", "top-left", "bottom-centre", "top-centre"]),
    margin: { name: "Margin", minimum: 0, maximum: 2000, default: 24 }
});
const SETTINGS_FIELDS = Object.keys(SETTINGS_SCHEMA);
function isSettingsRecord(value) { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
function readSetting(field, value) {
    const rule = SETTINGS_SCHEMA[field];
    if (!rule) { throw new Error(`Unknown setting: ${field}.`); }
    if (rule.minimum !== undefined) {
        if (!Number.isInteger(value) || value < rule.minimum || value > rule.maximum) {
            throw new Error(`${rule.name} must be a whole number from ${rule.minimum} to ${rule.maximum}.`);
        }
        return value;
    }
    if (typeof value !== "string") { throw new Error(`${rule.name} must be text.`); }
    if (rule.choices && !rule.choices.some((choice) => choice.value === value)) { throw new Error(`Unsupported ${rule.name.toLowerCase()}: ${value}`); }
    if (field === "customText" && UNRENDERABLE_TEXT.test(value)) {
        throw new Error("Custom text contains a null character or incomplete Unicode text. Remove it or paste the text again.");
    }
    if (rule.kind === "colour") { return normalizeColour(value, rule.name); }
    if (rule.nonempty && value.trim() === "") { throw new Error(`${rule.name}: name a face to draw with.`); }
    if (rule.maximumLength !== undefined && value.length > rule.maximumLength) { throw new Error(`${rule.name} must be ${rule.maximumLength} characters or fewer.`); }
    return rule.nonempty ? value.trim() : value;
}
function validateSettings(input) {
    if (!isSettingsRecord(input)) { return { issues: [{ code: "object", stage: "settings", message: "Settings must be a JSON object." }] }; }
    const issues = Object.keys(input).filter((field) => !SETTINGS_FIELDS.includes(field))
        .map((field) => ({ field, code: "unknown", stage: "settings", message: `Unknown setting: ${field}.` }));
    const settings = {};
    for (const field of SETTINGS_FIELDS) {
        try { settings[field] = readSetting(field, input[field]); }
        catch (error) { issues.push({ field, code: "setting", stage: "settings", message: error.message }); }
    }
    return issues.length ? { issues } : { issues, settings };
}
function normalizeSettings(input) {
    const result = validateSettings(input);
    if (result.issues.length) { const error = new Error(result.issues.map((issue) => issue.message).join("\n")); error.issues = result.issues; throw error; }
    return result.settings;
}
module.exports = { SETTINGS_SCHEMA, SETTINGS_FIELDS, CUSTOM_TEXT_LIMIT, isSettingsRecord, readSetting, validateSettings, normalizeSettings };
