"use strict";

const { readMoment, isRecordedMoment } = require("./moment.js");

/*
 * What a photograph says about itself, read strictly.
 *
 * exiftool answers in JSON, and every field in it is a claim by whatever
 * wrote the file rather than a fact about the world. A camera clock can be
 * wrong, a coordinate can be absent, and a tag can hold text where a number
 * belongs. A field must be understood completely before it is stamped;
 * absent fields and recorded-invalid ones are reported apart. A half-read
 * date looks like a record, so it is worse than leaving that date off.
 *
 * Nothing here reaches the filesystem or a process. It takes the answer and
 * says what can be believed of it.
 */

/*
 * Use DateTimeOriginal for the shutter time and CreateDate as the fallback.
 * Exclude ModifyDate: when capture tags are absent it can describe an editor's
 * change rather than the photograph's capture, so it is not a reliable date
 * for the stamp.
 */
const MOMENT_TAGS = ["DateTimeOriginal", "CreateDate"];

const MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
];

/*
 * The first tag that holds a moment this can read, and which one it was. The
 * tag travels with it because a caller may want to say where the date came
 * from, and because a moment with no provenance is a number.
 */
function captureMoment(facts) {
    for (const tag of MOMENT_TAGS) {
        const read = readMoment(facts[tag]);

        if (read) {
            return { ...read, tag };
        }
    }

    return null;
}

function captureMomentRecorded(facts) {
    return MOMENT_TAGS.some((tag) => isRecordedMoment(facts[tag]));
}

const owns = (record, key) => Object.hasOwn(record, key);
const AXES = ["latitude", "longitude"];
const INTEGER = /^\d+$/u;
const MINUTES_IN_DEGREE = 60;
const SECONDS_IN_DEGREE = 3600;
const DMS_PARTS = 3;
const FRACTION_PARTS = 2;
const LATITUDE = { limit: 90, positive: "N", negative: "S" };
const LONGITUDE = { limit: 180, positive: "E", negative: "W" };

// Keep the selected source's whole pair. Invalid EXIF is not permission to mix
// it with XMP or substitute a different recorded location.
function selectedGPS(facts) {
    const gps = facts.gps || {};

    if (gps.exif && AXES.some((axis) => owns(gps.exif, axis))) {
        return { source: "exif", value: gps.exif };
    }

    return gps.xmp && AXES.some((axis) => owns(gps.xmp, axis))
        ? { source: "xmp", value: gps.xmp }
        : null;
}

function coordinatesRecorded(facts) {
    return selectedGPS(facts) !== null;
}

function signedDMS(parts, reference, { limit, positive, negative }) {
    if (reference !== positive && reference !== negative) {
        return null;
    }

    const [degrees, minutes, seconds] = parts;
    const magnitude = degrees + minutes / MINUTES_IN_DEGREE + seconds / SECONDS_IN_DEGREE;

    return minutes >= MINUTES_IN_DEGREE || seconds >= MINUTES_IN_DEGREE || degrees > limit ||
        (degrees === limit && (minutes !== 0 || seconds !== 0)) || magnitude > limit
        ? null
        : (reference === negative ? -1 : 1) * magnitude;
}

function exifDegrees(components, reference, axis) {
    if (!Array.isArray(components) || components.length !== DMS_PARTS) {
        return null;
    }

    // Validate each original fraction before division; zero denominators and
    // negative components must not become a normalized scalar coordinate.
    const valid = components.every((pair) => Array.isArray(pair) && pair.length === FRACTION_PARTS &&
        pair.every((part) => typeof part === "string" && INTEGER.test(part) &&
            Number.isSafeInteger(Number(part))) && Number(pair[1]) > 0);

    if (!valid) {
        return null;
    }

    return signedDMS(components.map(([numerator, denominator]) =>
        Number(numerator) / Number(denominator)), reference, axis);
}

function xmpDegrees(value, axis) {
    if (typeof value !== "string") {
        return null;
    }

    // XMP embeds its own reference: DDD,MM.mmk or DDD,MM,SSk. Accept spaces
    // around commas, not sign guessing, unknown reference letters or suffixes.
    const match = /^ *(?<degrees>\d+) *, *(?<minutes>\d+(?:\.\d+)?)(?: *, *(?<seconds>\d+(?:\.\d+)?))?(?<reference>[NSEW]) *$/u.exec(value);

    if (!match || (match.groups.seconds !== undefined && match.groups.minutes.includes("."))) {
        return null;
    }

    const { degrees, minutes, seconds, reference } = match.groups;
    const parts = [Number(degrees), Number(minutes), Number(seconds || 0)];

    return parts.every(Number.isFinite) &&
        !(parts[0] === axis.limit && /[1-9]/u.test(minutes + (seconds || "")))
        ? signedDMS(parts, reference, axis)
        : null;
}

function coordinates(facts) {
    const selected = selectedGPS(facts);

    if (!selected) {
        return null;
    }

    const { source, value } = selected;
    const latitude = source === "exif"
        ? exifDegrees(value.latitude, value.latitudeRef, LATITUDE)
        : xmpDegrees(value.latitude, LATITUDE);
    const longitude = source === "exif"
        ? exifDegrees(value.longitude, value.longitudeRef, LONGITUDE)
        : xmpDegrees(value.longitude, LONGITUDE);

    return latitude === null || longitude === null ? null : { latitude, longitude };
}


module.exports = { captureMoment, captureMomentRecorded, coordinates, coordinatesRecorded, MONTHS, MOMENT_TAGS };
