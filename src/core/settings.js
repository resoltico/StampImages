"use strict";
const { IssueError } = require("./errors.js");
const { normalizeColor } = require("./color.js");
const { contentProblem } = require("./stamp-content.js");
const { resolved } = require("./typeface-refusal.js");
const CUSTOM_TEXT_LIMIT = 500;
// A NUL cannot cross argv; unpaired surrogates are incomplete Unicode, not caption text.
// eslint-disable-next-line no-control-regex
const UNRENDERABLE_TEXT = /\u0000|[\uD800-\uDFFF]/u;
function choiceRule(name, labels) { const choices = Object.entries(labels).map(([value, label]) => ({ value, label })); return { kind: "choice", name, default: choices[0].value, choices }; }
function integerRule(rule) {
    return { kind: "integer", ...rule, hint: `${rule.minimum}–${rule.maximum} ${rule.unit}${rule.note ? `, ${rule.note}` : ""}` };
}
const SETTINGS_SCHEMA = Object.freeze({
    dateFormat: choiceRule("Date/time format", { "iso-minutes": "2026-09-09 14:30", "iso-date": "2026-09-09", "long-date": "September 9, 2026", none: "Do not stamp the date" }),
    coordinateFormat: choiceRule("Coordinate format", { none: "Do not stamp the coordinates", decimal: "56.9496, 24.1052", sexagesimal: "56°56'58.6\"N 24°6'18.7\"E" }),
    customText: { kind: "text", name: "Custom text", maximumLength: CUSTOM_TEXT_LIMIT, multiline: true, default: "" },
    font: { kind: "typeface", name: "Typeface", default: "Helvetica Neue", hint: "or type a name", suggestions: ["Helvetica Neue", "Arial", "Verdana", "Avenir Next", "Gill Sans", "Georgia", "Palatino", "Baskerville", "Menlo", "Courier New"] },
    size: integerRule({ name: "Text size", minimum: 8, maximum: 400, unit: "pt", default: 36 }),
    textColor: { kind: "color", name: "Text color", default: "#FFFFFF", hint: "or type #RRGGBB", presets: ["#FFFFFF", "#000000", "#FFD400", "#FF3B30"] },
    outlineWidth: integerRule({ name: "Outline", minimum: 0, maximum: 20, unit: "px", default: 2, note: "0 for none" }),
    outlineColor: { kind: "color", name: "Outline color", default: "#202020", hint: "or type #RRGGBB", presets: ["#202020", "#000000", "#FFFFFF"] },
    position: choiceRule("Position", { "bottom-right": "Bottom right", "bottom-left": "Bottom left", "top-right": "Top right", "top-left": "Top left", "bottom-center": "Bottom center", "top-center": "Top center" }),
    margin: integerRule({ name: "Margin", minimum: 0, maximum: 2000, unit: "px", default: 24 })
});
const SETTINGS_FIELDS = Object.keys(SETTINGS_SCHEMA);
function isSettingsRecord(value) { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
function textIssue(rule, value) {
    if (typeof value !== "string") { return `${rule.name} must be text.`; }
    if (rule.kind === "typeface") { return value.trim() === "" ? `${rule.name}: name a face to draw with.` : ""; }
    if (UNRENDERABLE_TEXT.test(value)) { return "Custom text contains a null character or incomplete Unicode text. Remove it or paste the text again."; }
    return value.length > rule.maximumLength ? `${rule.name} must be ${rule.maximumLength} characters or fewer.` : "";
}
function settingIssue(field, value) {
    const rule = Object.hasOwn(SETTINGS_SCHEMA, field) ? SETTINGS_SCHEMA[field] : null;
    let code = rule?.kind;
    let message = "";
    if (!rule) { code = "unknown"; message = `Unknown setting: ${field}.`; }
    else if (rule.kind === "choice") {
        if (typeof value !== "string" || !rule.choices.some((choice) => choice.value === value)) { message = `${rule.name} must be one of: ${rule.choices.map((choice) => choice.value).join(", ")}.`; }
    } else if (rule.kind === "integer") {
        if (!Number.isInteger(value) || value < rule.minimum || value > rule.maximum) { message = `${rule.name} must be a whole number from ${rule.minimum} to ${rule.maximum}.`; }
    } else if (rule.kind === "color") {
        try { normalizeColor(value, rule.name); } catch (error) { ({ message } = error); }
    } else { code = "text"; message = textIssue(rule, value); }
    return message ? { field, code, stage: "settings", message } : null;
}
function normalizedValue(field, value) {
    const rule = SETTINGS_SCHEMA[field];
    if (rule.kind === "color") { return normalizeColor(value, rule.name); }
    return rule.kind === "typeface" ? value.trim() : value;
}
function readSetting(field, value) {
    const issue = settingIssue(field, value);
    if (issue) { throw new IssueError(issue.message, { issues: [issue] }); }
    return normalizedValue(field, value);
}
function validateSettings(input) {
    if (!isSettingsRecord(input)) { return { issues: [{ code: "object", stage: "settings", message: "Settings must be a JSON object." }] }; }
    const issues = Object.keys(input).filter((field) => !SETTINGS_FIELDS.includes(field)).map((field) => settingIssue(field, input[field]));
    for (const field of SETTINGS_FIELDS) { const issue = settingIssue(field, input[field]); if (issue) { issues.push(issue); } }
    return issues.length > 0 ? { issues } : { issues, settings: Object.fromEntries(SETTINGS_FIELDS.map((field) => [field, normalizedValue(field, input[field])])) };
}
// Partial form answers are checked independently; absent fields are not submitted values.
function stampIssues(settings, catalog) {
    const issues = [];
    if (settings.font !== undefined && catalog) {
        const answer = resolved(catalog, settings.font);
        if (answer.problem) { issues.push({ code: "typeface", field: "font", stage: "settings", message: answer.problem }); }
    }
    if (["dateFormat", "coordinateFormat", "customText"].every((field) => Object.hasOwn(settings, field))) {
        const problem = contentProblem(settings);
        if (problem) { issues.push({ code: "empty-stamp", field: "customText", stage: "settings", message: problem.message }); }
    }
    return issues;
}
function normalizeSettings(input) {
    const result = validateSettings(input);
    if (result.issues.length) { throw new IssueError(result.issues.map((issue) => issue.message).join("\n"), { issues: result.issues }); }
    return result.settings;
}
module.exports = { SETTINGS_SCHEMA, SETTINGS_FIELDS, CUSTOM_TEXT_LIMIT, isSettingsRecord, settingIssue, readSetting, validateSettings, stampIssues, normalizeSettings };
