"use strict";

const { normalizeColour } = require("./colour.js");
const { parseInteger } = require("./numbers.js");
const { readNumeric, readWords } = require("./reading.js");
const {
    POSITION,
    DATE_FORMAT,
    COORDINATE_FORMAT,
    MINIMUM_SIZE,
    MAXIMUM_SIZE,
    MINIMUM_MARGIN,
    MAXIMUM_MARGIN,
    MINIMUM_OUTLINE,
    MAXIMUM_OUTLINE
} = require("./choices.js");

/*
 * What a setting means, and validation of whatever arrives -- from the form,
 * from a remembered run, or from a headless caller.
 *
 * One validator, so a value that is refused in one place cannot be accepted
 * in another. Everything it returns is what the pipeline stores: a colour is
 * canonical, a number is a number, and a choice is its value rather than the
 * words a control offered it under.
 */

const CUSTOM_TEXT_LIMIT = 500;

function valuesOf(control) {
    return control.choices.map((choice) => choice.value);
}

function assertChoice(value, control, label) {
    const text = readWords(value, `The ${label}`);

    if (!valuesOf(control).includes(text)) {
        throw new Error(`Unsupported ${label}: ${text}`);
    }

    return text;
}

/*
 * The one setting a person writes freely. It is bounded because a stamp is a
 * caption rather than a document, and an unbounded one renders a text image
 * larger than the photograph it is going on.
 */
function readCustomText(value) {
    const text = value === undefined || value === null
        ? ""
        : readWords(value, "Your own text");

    if (text.length > CUSTOM_TEXT_LIMIT) {
        throw new Error(
            `Custom text must be ${CUSTOM_TEXT_LIMIT} characters or fewer.`
        );
    }

    return text;
}

/*
 * Valid JSON is not yet a set of settings. `null`, `false`, `0`, a bare string
 * and a list all parse, and asking any of them for a setting fails somewhere
 * further along, in words about the failure rather than about what was read:
 * "null is not an object", or an unsupported position that was never
 * supported because there was never a position.
 *
 * Asked in both places a set of settings arrives from outside this program --
 * a headless configuration file and a remembered record -- because they are
 * the same question and there is no version of it that should be answered
 * differently.
 */
function isSettingsRecord(value) {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeSettings(settings) {
    return {
        font: readWords(settings.font ?? "", "The typeface").trim(),
        size: parseInteger(
            readNumeric(settings.size, "Text size"),
            MINIMUM_SIZE,
            MAXIMUM_SIZE,
            "Text size"
        ),
        textColour: normalizeColour(settings.textColour, "Text colour"),
        outlineColour: normalizeColour(settings.outlineColour, "Outline colour"),
        outlineWidth: parseInteger(
            readNumeric(settings.outlineWidth, "Outline"),
            MINIMUM_OUTLINE,
            MAXIMUM_OUTLINE,
            "Outline"
        ),
        position: assertChoice(settings.position, POSITION, "position"),
        margin: parseInteger(
            readNumeric(settings.margin, "Margin"),
            MINIMUM_MARGIN,
            MAXIMUM_MARGIN,
            "Margin"
        ),
        dateFormat: assertChoice(settings.dateFormat, DATE_FORMAT, "date format"),
        coordinateFormat: assertChoice(
            settings.coordinateFormat,
            COORDINATE_FORMAT,
            "coordinate format"
        ),
        customText: readCustomText(settings.customText)
    };
}

/*
 * A run that would stamp nothing at all is a run that copies photographs for
 * no reason. It is refused where the settings are read rather than once per
 * photograph, because it is a fact about the request and not about any file.
 */
function stampsNothing(settings) {
    return settings.dateFormat === "none" &&
        settings.coordinateFormat === "none" &&
        settings.customText.trim() === "";
}

module.exports = {
    isSettingsRecord,
    normalizeSettings,
    stampsNothing,
    CUSTOM_TEXT_LIMIT
};
