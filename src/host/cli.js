"use strict";
const { APP_NAME, VERSION } = require("../core/version.js");
const { SETTINGS_SCHEMA, validateSettings } = require("../core/settings.js");
const { contentProblem } = require("../core/stamp-content.js");
const { OperationError } = require("../core/errors.js");
const { normalizeInvocationInput } = require("../core/invocation.js");
const { writeReceipt, exitCli } = require("./receipt.js");
const { POSITION, DATE_FORMAT, COORDINATE_FORMAT } = require("./choices.js");

// The captions the form shows, so a value in help reads as it does in the form.
const CAPTIONED = { position: POSITION.choices, dateFormat: DATE_FORMAT.choices, coordinateFormat: COORDINATE_FORMAT.choices };

// A caption that only restates the value ("Bottom right" for bottom-right) is left out.
function choiceCaption(choice) {
    const caption = choice.label ?? choice.name;
    const restates = caption && caption.toLowerCase().replace(/\s+/gu, "-") === choice.value;
    return caption && !restates ? `${choice.value} (${caption})` : choice.value;
}

// One line per setting, in the form Image Files to PDF uses: values, then the default.
function settingsHelp() {
    return Object.entries(SETTINGS_SCHEMA).map(([field, rule]) => {
        let values = rule.kind === "color" ? "#RRGGBB" : "text";
        if (rule.choices) { values = (CAPTIONED[field] ?? rule.choices).map(choiceCaption).join(" | "); }
        else if (rule.minimum !== undefined) { values = `${rule.minimum}–${rule.maximum}${rule.unit ? ` ${rule.unit}` : ""}`; }
        const fallback = rule.default === undefined || rule.default === "" ? "" : `; default ${rule.default}`;
        return `  ${field} — ${rule.name}: ${values}${fallback}`;
    }).join("\n");
}
const RUN_LINE = "osascript -l JavaScript Stamp-Images.jxa -- --headless <settings.json> <path…>";
function usage() {
    return `${APP_NAME} ${VERSION}\n\nUsage:\n  osascript -l JavaScript Stamp-Images.jxa -- --help\n` +
        "  osascript -l JavaScript Stamp-Images.jxa -- --version\n" +
        `  ${RUN_LINE}\n\nSettings (all ten required):\n` +
        `${settingsHelp()}\n\nPaths may be absolute or relative to the working directory. Settings must be UTF-8 JSON without a BOM.\n`;
}
function requestError(code, message, diagnostic = null) {
    return new OperationError(message, { issues: [{ code, stage: "request", message, ...(diagnostic ? { diagnostic } : {}) }] });
}

// What was wrong, and the one line that would have been right; the settings are --help's to list.
function usageProblem(args) {
    if (args.length === 0) { return "No arguments were given."; }
    if (args.some((argument) => argument === "")) { return "An argument is empty."; }
    if (["--help", "--version"].includes(args[0])) { return "--help and --version take no other arguments."; }
    if (args[0] !== "--headless") { return `Unknown option: ${args[0]}.`; }
    return "--headless needs a settings file and at least one path.";
}
function usageError(args) {
    return requestError("usage", `${usageProblem(args)}\nUsage: ${RUN_LINE}\nRun with --help to see the settings.`);
}

function settingsFileError(path, cause, diagnostic = null) {
    return requestError("settings-file", `Settings file ${cause}: ${path}`, diagnostic);
}

function parsedJSON(text, path) {
    try { return JSON.parse(text); }
    catch (error) {
        const position = /position \d+|line \d+(?: column \d+)?/iu.exec(error.message);
        throw settingsFileError(path, `is not valid JSON${position ? ` (${position[0]})` : ""}`);
    }
}

function jsonConfiguration(text, path) {
    const value = parsedJSON(text, path);
    if (!value || typeof value !== "object" || Array.isArray(value)) { throw settingsFileError(path, "is not an object"); }
    return value;
}

function configurationValues(configuration) {
    const validated = validateSettings(configuration);
    if (validated.issues.length) {
        throw new OperationError(validated.issues.map((issue) => issue.message).join("\n"), { issues: validated.issues });
    }
    const empty = contentProblem(validated.settings);
    if (empty) { throw requestError("empty-stamp", empty.message); }
    return { settings: validated.settings };
}

const BOM_BYTES = 3;
const UTF8_BOM_BASE64 = "77u/";

function readSettingsFile(context, path) {
    const { ns, objc, manager, ref } = context;
    const directory = ref();
    if (!manager.fileExistsAtPathIsDirectory(ns(path), directory)) { throw settingsFileError(path, "not found"); }
    if (directory[0]) { throw settingsFileError(path, "is a folder"); }
    if (!manager.isReadableFileAtPath(ns(path))) { throw settingsFileError(path, "cannot be read (permission denied)"); }
    const data = ns.NSData.dataWithContentsOfFile(ns(path));
    if (!data || data.isNil()) { throw settingsFileError(path, "cannot be read"); }
    const length = Number(data.length);
    if (length === 0) { throw settingsFileError(path, "is empty"); }
    const decoded = ns.NSString.alloc.initWithDataEncoding(data, ns.NSUTF8StringEncoding);
    if (!decoded || decoded.isNil()) { throw settingsFileError(path, "is not UTF-8"); }
    // NSString consumes a UTF-8 BOM; reject those bytes to preserve strict JSON input.
    if (length >= BOM_BYTES && String(objc.unwrap(data.subdataWithRange(ns.NSMakeRange(0, BOM_BYTES)).base64EncodedStringWithOptions(0))) === UTF8_BOM_BASE64) {
        throw settingsFileError(path, "is not valid JSON (unexpected byte-order mark at position 0)");
    }
    return jsonConfiguration(String(objc.unwrap(decoded)), path);
}

function absolutePath(value, context) {
    if (/^[a-z][a-z\d+.-]*:\/\//iu.test(value)) { return value; }
    const { objc, ns, manager } = context;
    const path = value.startsWith("/") ? value : `${String(objc.unwrap(manager.currentDirectoryPath))}/${value}`;
    const standardized = String(objc.unwrap(ns(path).stringByStandardizingPath));
    return value.endsWith("/") && !standardized.endsWith("/") ? `${standardized}/` : standardized;
}

function nativeCliIO() {
    ObjC.import("Foundation");
    const context = { ns: $, objc: ObjC, ref: globalThis.Ref, manager: $.NSFileManager.defaultManager };
    return { absolute: (path) => absolutePath(path, context), read: (path) => readSettingsFile(context, path) };
}

function cliCommand(input, injected = null) {
    const args = normalizeInvocationInput(input);
    if (args.length === 1 && args[0] === "--help") { return { kind: "help" }; }
    if (args.length === 1 && args[0] === "--version") { return { kind: "version" }; }
    const minimumArguments = 3;
    if (args[0] !== "--headless" || args.length < minimumArguments || args.some((argument) => argument === "")) {
        throw usageError(args);
    }
    const io = injected ?? nativeCliIO();
    const configuration = io.read(io.absolute(args[1]));
    const firstImageIndex = 2;
    return { kind: "run", invocation: { headless: true, ...configurationValues(configuration),
        inputItems: args.slice(firstImageIndex).map((path) => io.absolute(path)) } };
}

function showCliCommand(kind) {
    writeReceipt(kind === "help" ? usage() : `${APP_NAME} ${VERSION}\n`);
    return exitCli(0);
}
module.exports = { cliCommand, showCliCommand, jsonConfiguration, configurationValues, usage };
