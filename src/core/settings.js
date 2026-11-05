"use strict";
const { normalizeColor } = require("./color.js");
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
    size: { name: "Text size", minimum: 8, maximum: 400, unit: "pt", default: 36 },
    textColor: { name: "Text color", kind: "color", default: "#FFFFFF" },
    outlineWidth: { name: "Outline", minimum: 0, maximum: 20, unit: "px", default: 2 },
    outlineColor: { name: "Outline color", kind: "color", default: "#202020" },
    position: choiceRule("Position", ["bottom-right", "bottom-left", "top-right", "top-left", "bottom-center", "top-center"]),
    margin: { name: "Margin", minimum: 0, maximum: 2000, unit: "px", default: 24 }
});
const SETTINGS_FIELDS = Object.keys(SETTINGS_SCHEMA);
function isSettingsRecord(value) { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
// Each refusal carries the shared receipt code for the kind of value that was wrong.
function refusal(code, message) {
    const error = new Error(message);
    error.code = code;
    return error;
}
function readChoice(rule, value) {
    if (typeof value !== "string" || !rule.choices.some((choice) => choice.value === value)) {
        throw refusal("choice", `${rule.name} must be one of: ${rule.choices.map((choice) => choice.value).join(", ")}.`);
    }
    return value;
}
function readColor(rule, value) {
    try { return normalizeColor(value, rule.name); }
    catch (error) { throw refusal("color", error.message); }
}
function readText(field, rule, value) {
    if (typeof value !== "string") { throw refusal("text", `${rule.name} must be text.`); }
    if (field === "customText" && UNRENDERABLE_TEXT.test(value)) {
        throw refusal("text", "Custom text contains a null character or incomplete Unicode text. Remove it or paste the text again.");
    }
    if (rule.nonempty && value.trim() === "") { throw refusal("text", `${rule.name}: name a face to draw with.`); }
    if (rule.maximumLength !== undefined && value.length > rule.maximumLength) { throw refusal("text", `${rule.name} must be ${rule.maximumLength} characters or fewer.`); }
    return rule.nonempty ? value.trim() : value;
}
function readSetting(field, value) {
    const rule = SETTINGS_SCHEMA[field];
    if (!rule) { throw refusal("unknown", `Unknown setting: ${field}.`); }
    if (rule.minimum !== undefined) {
        if (!Number.isInteger(value) || value < rule.minimum || value > rule.maximum) {
            throw refusal("integer", `${rule.name} must be a whole number from ${rule.minimum} to ${rule.maximum}.`);
        }
        return value;
    }
    if (rule.choices) { return readChoice(rule, value); }
    if (rule.kind === "color") { return readColor(rule, value); }
    return readText(field, rule, value);
}
function validateSettings(input) {
    if (!isSettingsRecord(input)) { return { issues: [{ code: "object", stage: "settings", message: "Settings must be a JSON object." }] }; }
    const issues = Object.keys(input).filter((field) => !SETTINGS_FIELDS.includes(field))
        .map((field) => ({ field, code: "unknown", stage: "settings", message: `Unknown setting: ${field}.` }));
    const settings = {};
    for (const field of SETTINGS_FIELDS) {
        try { settings[field] = readSetting(field, input[field]); }
        catch (error) { issues.push({ field, code: error.code, stage: "settings", message: error.message }); }
    }
    return issues.length ? { issues } : { issues, settings };
}
function normalizeSettings(input) {
    const result = validateSettings(input);
    if (result.issues.length) { const error = new Error(result.issues.map((issue) => issue.message).join("\n")); error.issues = result.issues; throw error; }
    return result.settings;
}
module.exports = { SETTINGS_SCHEMA, SETTINGS_FIELDS, CUSTOM_TEXT_LIMIT, isSettingsRecord, readSetting, validateSettings, normalizeSettings };
