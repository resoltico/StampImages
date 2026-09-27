"use strict";

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

const EMPTY_STAMP_MESSAGE = "Choose a date/time format, include GPS coordinates, " +
    "or enter custom text. Otherwise there is nothing to stamp.";

function contentProblem(settings) {
    return stampsNothing(settings)
        ? { key: "customText", message: EMPTY_STAMP_MESSAGE }
        : null;
}

function requireStampContent(settings) {
    if (stampsNothing(settings)) {
        throw new Error(EMPTY_STAMP_MESSAGE);
    }

    return settings;
}

module.exports = {
    stampsNothing,
    contentProblem,
    requireStampContent,
    EMPTY_STAMP_MESSAGE
};
