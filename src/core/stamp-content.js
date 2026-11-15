"use strict";
const { IssueError } = require("./errors.js");

/*
 * A run that would stamp nothing at all is a run that copies photographs for
 * no reason. It is refused where the settings are read rather than once per
 * photograph, because it is a fact about the request and not about any file.
 */
const VISIBLE_CHARACTER = /[^\s\p{Cf}\p{Cc}\u3164\u2800\u115F\u1160\uFFA0]/u;
function hasVisibleText(text) { return text.search(VISIBLE_CHARACTER) >= 0; }
function normalizeCustomText(text) { return text.replace(/\r\n?/gu, "\n"); }

function stampsNothing(settings) {
    return settings.dateFormat === "none" &&
        settings.coordinateFormat === "none" &&
        !hasVisibleText(settings.customText);
}

const EMPTY_STAMP_MESSAGE = "Choose a date/time format, include GPS coordinates, " +
    "or enter custom text. Otherwise there is nothing to stamp.";

function contentProblem(settings) {
    return stampsNothing(settings)
        ? { key: "customText", message: EMPTY_STAMP_MESSAGE }
        : null;
}

function requireStampContent(settings) {
    if (stampsNothing(settings)) {
        throw new IssueError(EMPTY_STAMP_MESSAGE);
    }

    return settings;
}

module.exports = { hasVisibleText, normalizeCustomText, stampsNothing, contentProblem, requireStampContent };
