"use strict";

const { MONTHS, captureMoment, coordinates } = require("./metadata.js");
const { decimalPlace, sexagesimalPlace } = require("./place.js");

/*
 * What this run will write on one photograph -- or the reason it will write
 * nothing on it.
 *
 * Built once, before anything is drawn, and the whole of what the drawing
 * needs. Nothing downstream of here may decide not to draw something: if
 * there is an inscription it is drawable, and if there is not, the photograph
 * was one the request did not apply to and the report says so in the
 * product's words.
 *
 * That rule is why this exists. The lines used to be assembled where they
 * were rendered, and a photograph that knew nothing about itself produced an
 * empty drawing -- which vips refused, in its own words, so somebody who had
 * asked for the date on a folder of scans was shown "text: no text to render"
 * and the command that failed.
 *
 * The formats are a closed list rather than a pattern language. A date can be
 * written a handful of sensible ways; letting somebody invent a format is a
 * second product, and one that fails at the moment of stamping rather than at
 * the moment of asking.
 */

function isoDate(moment) {
    return `${moment.year}-${moment.month}-${moment.day}`;
}

const MOMENT_WRITERS = {
    "iso-minutes": (moment) => `${isoDate(moment)} ${moment.hour}:${moment.minute}`,
    "iso-date": isoDate,
    "long-date": (moment) =>
        `${Number(moment.day)} ${MONTHS[Number(moment.month) - 1]} ${moment.year}`
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
 * Custom text keeps the line breaks and the spacing it was given. It is the
 * one part a person wrote, so it is not tidied into something they did not
 * write -- the trimming that used to happen here was really about the blank
 * line an absent date left behind, and that is now solved by not putting the
 * line there in the first place.
 *
 * Blank lines at the end are the exception: a trailing newline is an accident
 * of typing, and honouring it would stamp a photograph with an inch of empty
 * space under the caption.
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
function describeAbsence(settings) {
    const missing = [
        settings.dateFormat === "none" ? "" : "when",
        settings.coordinateFormat === "none" ? "" : "where"
    ].filter(Boolean);

    return `it does not say ${missing.join(" or ")} it was taken, ` +
        "and there is no text of your own to put on it";
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
 * The lines, in the order they are read: when the photograph was taken, where
 * it was taken, and then whatever was added by hand.
 */
function inscriptionFor(facts, settings) {
    const known = [
        wrote(facts, settings.dateFormat, captureMoment, MOMENT_WRITERS),
        wrote(facts, settings.coordinateFormat, coordinates, PLACE_WRITERS)
    ].filter((line) => line.length > 0);
    const lines = [...known, ...customLines(settings.customText)];

    return lines.length > 0
        ? { lines, text: lines.join("\n") }
        : { nothing: describeAbsence(settings) };
}

module.exports = { inscriptionFor, wantsMetadata, customLines, describeAbsence };
