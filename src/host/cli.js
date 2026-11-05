"use strict";
const { APP_NAME, VERSION } = require("../core/version.js");
const { SETTINGS_SCHEMA, validateSettings } = require("../core/settings.js");
const { contentProblem } = require("../core/stamp-content.js");
const { OperationError } = require("../core/errors.js");
const { normalizeInvocationInput } = require("../core/invocation.js");
const { writeReceipt, exitCli } = require("./receipt.js");

function choiceCaption(choice) {
    const caption = choice.label ?? choice.name;
    return caption && caption !== choice.value ? `${choice.value} (${caption})` : choice.value;
}

function settingsHelp() {
    return Object.entries(SETTINGS_SCHEMA).map(([field, rule]) => {
        let values = rule.kind === "colour" ? "#RRGGBB" : "text";
        if (rule.choices) { values = rule.choices.map(choiceCaption).join(" | "); }
        else if (rule.minimum !== undefined) { values = `integer ${rule.minimum}–${rule.maximum}`; }
        return `  ${field} — ${rule.name}: ${values}`;
    }).join("\n");
}
function usage() {
    return `${APP_NAME} ${VERSION}\n\nUsage:\n  osascript -l JavaScript Stamp-Images.jxa -- --help\n` +
        "  osascript -l JavaScript Stamp-Images.jxa -- --version\n" +
        "  osascript -l JavaScript Stamp-Images.jxa -- --headless <settings.json> <path…>\n\nSettings (all ten required):\n" +
        `${settingsHelp()}\n\nPaths may be relative to the working directory. Settings must be UTF-8 JSON without a BOM.\n`;
}

function requestError(code, message, diagnostic = null) {
    const error = new OperationError(message);
    error.issues = [{ code, stage: "request", message, ...(diagnostic ? { diagnostic } : {}) }];
    return error;
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
        const error = new OperationError(validated.issues.map((issue) => issue.message).join("\n"));
        error.issues = validated.issues;
        throw error;
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
        throw requestError("usage", usage());
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
