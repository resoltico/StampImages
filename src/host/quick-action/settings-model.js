"use strict";
const { SETTINGS_SCHEMA, SETTINGS_FIELDS, settingIssue } = require("../../core/settings.js");
const { normalizeColor } = require("../../core/color.js");
const { IssueError, errorMessage } = require("../../core/errors.js");

// These prompts belong to the interface; names, bounds and choices belong to the schema.
const PROMPTS = {
    dateFormat: "Date/time format (these are examples, not dates to stamp):",
    coordinateFormat: "Coordinate format (latitude, then longitude):",
    customText: "Custom text (the same text is added to every copy; leave it empty for none):",
    font: "Typeface, by name:",
    position: "Where the stamp goes:",
    textColor: "Color of the text:",
    outlineColor: "Color of the outline:"
};
const NUMBER_NAMES = { size: "Text size in points", outlineWidth: "Outline width in pixels", margin: "Margin in pixels" };
function control(field) {
    const rule = SETTINGS_SCHEMA[field];
    return { field, label: `${rule.name}:`, prompt: rule.kind === "integer" ? `${NUMBER_NAMES[field]} (${rule.minimum}–${rule.maximum}):` : PROMPTS[field],
        defaultValue: rule.default, defaultAnswer: String(rule.default), minimum: rule.minimum, maximum: rule.maximum, hint: rule.hint,
        ...(rule.kind === "typeface" ? { suggests: true } : {}),
        ...(rule.choices ? { choices: rule.choices } : {}), ...(rule.presets ? { presets: rule.presets } : {}) };
}
const CONTROLS = Object.fromEntries(SETTINGS_FIELDS.map((field) => [field, control(field)]));
CONTROLS.coordinateFormat.optional = {
    label: "Include GPS coordinates", offValue: "none",
    help: "Adds the place to the stamp. Leaving it off does not remove location data already in the image."
};
const POSITION = CONTROLS.position;
const DATE_FORMAT = CONTROLS.dateFormat;
const COORDINATE_FORMAT = CONTROLS.coordinateFormat;
const SIZE = CONTROLS.size;
const MARGIN = CONTROLS.margin;
const OUTLINE_WIDTH = CONTROLS.outlineWidth;
const ROW_KIND = { choice: "choice", integer: "number", text: "text", color: "color", typeface: "font" };
const ORDER = SETTINGS_FIELDS.map((key) => ({ kind: ROW_KIND[SETTINGS_SCHEMA[key].kind], key, control: CONTROLS[key] }));
function labelsOf(given) { return given.choices.map((choice) => choice.label); }
function defaultValueOf(given) { return given.defaultValue; }
function labelOfValue(given, value) {
    const chosen = given.choices.find((choice) => choice.value === value);
    if (!chosen) { throw new IssueError(`Unrecognized value: ${value}`); }
    return chosen.label;
}
function defaultLabelOf(given) { return labelOfValue(given, given.defaultValue); }
function valueOfLabel(given, label) {
    const chosen = given.choices.find((choice) => choice.label === label);
    if (!chosen) { throw new IssueError(`Unrecognized choice: ${label}`); }
    return chosen.value;
}
function fontControl(fonts) { return { ...CONTROLS.font, choices: fonts.map((font) => ({ label: font, value: font })) }; }
function resolvedRow(row, fonts) { return row.kind === "font" ? { ...row, control: fontControl(fonts) } : row; }
function controlFor(row, fonts) { return resolvedRow(row, fonts).control; }
function listRow({ kind, key, control: given }, answers, invalid) {
    return { key, kind, label: given.label, hint: given.hint, suggests: given.suggests, value: String(answers[key]), invalid: invalid.has(key),
        ...(given.optional ? { optional: { ...given.optional, offLabel: labelOfValue(given, given.optional.offValue) } } : {}),
        options: (given.choices ?? given.presets).map((option) => ({ label: option.label ?? option })) };
}
function numberRow({ key, control: given }, answers, invalid) {
    return { key, kind: "number", label: given.label, hint: given.hint, value: String(answers[key]), invalid: invalid.has(key), minimum: given.minimum, maximum: given.maximum };
}
function textRow({ key, control: given }, answers, invalid) {
    return { key, kind: "text", label: given.label, value: String(answers[key]), invalid: invalid.has(key) };
}
const BUILDERS = { choice: listRow, font: listRow, color: listRow, number: numberRow, text: textRow };
function formRows(answers, invalid, fonts) { return ORDER.map((row) => BUILDERS[row.kind](resolvedRow(row, fonts), answers, invalid)); }
function defaultSettings(fonts) {
    const font = fonts.includes(SETTINGS_SCHEMA.font.default) ? SETTINGS_SCHEMA.font.default : fonts[0] ?? "";
    return Object.fromEntries(SETTINGS_FIELDS.map((field) => [field, SETTINGS_SCHEMA[field].kind === "typeface" ? font : SETTINGS_SCHEMA[field].default]));
}
function answersFromSettings(settings, fonts) {
    return Object.fromEntries(ORDER.map((row) => [row.key, row.kind === "choice"
        ? labelOfValue(controlFor(row, fonts), settings[row.key]) : String(settings[row.key])]));
}
function defaultAnswers(fonts) { return answersFromSettings(defaultSettings(fonts), fonts); }
const DECIMAL_INTEGER = /^[+-]?\d+$/u;
function readNumber(answer, given) {
    const text = String(answer).trim();
    if (!DECIMAL_INTEGER.test(text)) { throw new IssueError(`${given.label} enter a whole number.`); }
    return Number(text);
}
function readChoice(answer, given) { return valueOfLabel(given, answer); }
const READERS = { choice: readChoice, font: String, color: String, number: readNumber, text: String };
function readAnswer(row, answer, fonts) {
    const value = READERS[row.kind](answer, controlFor(row, fonts));
    const issue = settingIssue(row.key, value);
    if (issue) { throw new IssueError(issue.message, { issues: [issue] }); }
    if (row.kind === "color") { return normalizeColor(value, row.control.label.replace(/:$/u, "")); }
    return row.kind === "font" ? value.trim() : value;
}
function readAnswers(answers, fonts) {
    const settings = {};
    const problems = [];
    for (const row of ORDER) {
        try { settings[row.key] = readAnswer(row, answers[row.key], fonts); }
        catch (error) { problems.push({ key: row.key, message: errorMessage(error) }); }
    }
    return problems.length > 0 ? { problems, values: settings } : { settings };
}
module.exports = { CONTROLS, POSITION, DATE_FORMAT, COORDINATE_FORMAT, SIZE, MARGIN, OUTLINE_WIDTH, ORDER, labelsOf, defaultValueOf, labelOfValue, defaultLabelOf, valueOfLabel,
    fontControl, resolvedRow, controlFor, formRows, defaultSettings, answersFromSettings, defaultAnswers, readNumber, readAnswer, readAnswers };
