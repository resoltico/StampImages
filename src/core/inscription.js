"use strict";

const { MONTHS, MOMENT_TAGS, captureMoment, coordinates } = require("./metadata.js");
const { decimalPlace, sexagesimalPlace } = require("./place.js");

/*
 * Build the complete inscription before rendering, or explain why the image
 * has none of the requested content. An empty inscription never reaches vips.
 * Date and coordinate formats are a closed set validated with the settings.
 */

function isoDate(moment) {
    return `${moment.year}-${moment.month}-${moment.day}`;
}

const MOMENT_WRITERS = {
    "iso-minutes": (moment) => `${isoDate(moment)} ${moment.hour}:${moment.minute}`,
    "iso-date": isoDate,
    // US English: month, day, year.
    "long-date": (moment) =>
        `${MONTHS[Number(moment.month) - 1]} ${Number(moment.day)}, ${moment.year}`
};

const PLACE_WRITERS = {
    decimal: decimalPlace,
    sexagesimal: sexagesimalPlace
};

function wrote(facts, format, read, writers) {
    const value = writers[format] ? read(facts) : null;

    return value ? writers[format](value) : "";
}

/*
 * Preserve custom text spacing and internal line breaks. Omit absent metadata
 * lines rather than trimming user text to hide them. Drop trailing blank lines
 * so they do not create empty space below the caption.
 */
function customLines(text) {
    const lines = String(text ?? "").split("\n");

    while (lines.length > 0 && lines.at(-1).trim() === "") {
        lines.pop();
    }

    return lines;
}

/*
 * What was asked for and is not there. Said as a fact about the photograph
 * rather than as a failure, because it is one: a scan has no shutter time and
 * no place, and neither has the program done anything wrong.
 */
function describeAbsence(settings, invalid) {
    const missing = [
        settings.dateFormat === "none" ? "" : "when",
        settings.coordinateFormat === "none" ? "" : "where"
    ].filter(Boolean);
    // A photograph whose date reads 0000:00:00 does say when it was taken --
    // wrongly. Telling its owner it says nothing sends them looking for a tag
    // that is there.
    const unreadable = invalid.length > 0 ? ` (its ${invalid.join(" and ")} ${invalid.length === 1 ? "is" : "are"} recorded but not valid)` : "";

    return `it does not say ${missing.join(" or ")} it was taken${unreadable}, ` +
        "and there is no text of your own to put on it";
}

/*
 * Present but unusable is not absent: a tag that is there and cannot be read
 * as a date or a place on the globe.
 */
function isRecorded(value) {
    return value !== undefined && value !== null && String(value).trim() !== "";
}

// Asked only of what was requested and is missing: what was not requested is not read.
const RECORDED = {
    "date/time": (facts) => MOMENT_TAGS.some((tag) => isRecorded(facts[tag])),
    "GPS coordinates": (facts) => isRecorded(facts.GPSLatitude) || isRecorded(facts.GPSLongitude)
};

function invalidOf(facts, missing) {
    return missing.filter((field) => RECORDED[field](facts));
}

/*
 * Whether anything in the request is a question for the photograph. A caption
 * of your own is not, and a run that asks anyway is a run that can fail on a
 * metadata reader it never needed.
 */
function wantsMetadata(settings) {
    return settings.dateFormat !== "none" || settings.coordinateFormat !== "none";
}

/*
 * Every line is drawn as its own bidirectional isolate. All lines reach the
 * renderer as one paragraph layout, and measured with vips 8.18 a Hebrew or
 * Arabic caption set the direction of the neutral lines above it: the stamp
 * read "18:42 2021-07-14" and "24.1052 ,56.9496" -- the place apparently
 * swapped and its comma moved. Date and place are written left to right
 * (LRI ... PDI), whatever else is on the photograph; a caption takes its own
 * direction from its first strong character (FSI ... PDI), and an override
 * typed into one caption line cannot reach past that line.
 */
const LEFT_TO_RIGHT = ["\u2066", "\u2069"];
const OWN_DIRECTION = ["\u2068", "\u2069"];

function isolated(line, [open, close]) {
    return `${open}${line}${close}`;
}

/*
 * The lines, in the order they are read: when the photograph was taken, where
 * it was taken, and then whatever was added by hand. `lines` is what the stamp
 * says; `text` is the same lines as the renderer is to draw them.
 */
function inscriptionFor(facts, settings) {
    const date = wrote(facts, settings.dateFormat, captureMoment, MOMENT_WRITERS);
    const place = wrote(facts, settings.coordinateFormat, coordinates, PLACE_WRITERS);
    const missing = [
        settings.dateFormat !== "none" && !date ? "date/time" : "",
        settings.coordinateFormat !== "none" && !place ? "GPS coordinates" : ""
    ].filter(Boolean);
    const written = [date, place].filter(Boolean);
    const custom = customLines(settings.customText);
    const lines = [...written, ...custom];
    const text = [
        ...written.map((line) => isolated(line, LEFT_TO_RIGHT)),
        ...custom.map((line) => isolated(line, OWN_DIRECTION))
    ].join("\n");

    const invalid = invalidOf(facts, missing);
    const omissions = {
        ...missing.length > 0 ? { missing } : {},
        ...invalid.length > 0 ? { invalid } : {}
    };

    return lines.length > 0
        ? { lines, text, ...omissions }
        : { nothing: describeAbsence(settings, invalid), ...omissions };
}

module.exports = { inscriptionFor, wantsMetadata };
