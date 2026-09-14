"use strict";

const { readMoment } = require("./moment.js");

/*
 * What a photograph says about itself, read strictly.
 *
 * exiftool answers in JSON, and every field in it is a claim by whatever
 * wrote the file rather than a fact about the world. A camera clock can be
 * wrong, a coordinate can be absent, and a tag can hold text where a number
 * belongs. So each field is either understood completely or treated as
 * missing: a half-read date stamped onto somebody's photograph is worse than
 * no date, because it looks like a record.
 *
 * Nothing here reaches the filesystem or a process. It takes the answer and
 * says what can be believed of it.
 */

/*
 * Which tag may speak for the capture.
 *
 * DateTimeOriginal is when the shutter opened. CreateDate is when the file
 * was made, which for a camera is the same moment and for an editor is close
 * enough to be worth having when the first is gone.
 *
 * ModifyDate is not on the list, and was. It is when the file was last
 * changed -- and the only time it would ever be reached is when both of the
 * others are absent, which is exactly the case where it is an editor's clock
 * rather than a camera's. A stamp reading "2026-09-12" over a photograph
 * taken in 1998 is not a record of anything.
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

const LATITUDE_LIMIT = 90;
const LONGITUDE_LIMIT = 180;

/*
 * A number, or text that is one, inside the bounds of the globe. Stated as
 * what is accepted rather than as a list of what is not: Number() answers for
 * everything -- true is 1, an empty string is 0, an empty array is 0 -- so a
 * rule written as exclusions is a rule with a gap in it, and the gap put the
 * null island on photographs taken indoors.
 */
function boundedDegrees(value, limit) {
    const text = typeof value === "number" || typeof value === "string"
        ? String(value).trim()
        : "";
    const numeric = Number(text);

    return text !== "" && isFinite(numeric) && Math.abs(numeric) <= limit
        ? numeric
        : null;
}

/*
 * Both halves or neither. A latitude alone is not a place, and stamping one
 * would be stamping half a coordinate as though it were a location.
 *
 * Asked for with -n, so these arrive as signed decimal degrees rather than as
 * "56 deg 56' 58.63\" N". Measured: a photograph tagged 33.8688 S comes back
 * as -33.8688, the sign already applied from the reference. Applying
 * GPSLatitudeRef again here is the mistake this comment exists to prevent --
 * it would put every southern and western coordinate in the wrong hemisphere.
 */
function coordinates(facts) {
    const latitude = boundedDegrees(facts.GPSLatitude, LATITUDE_LIMIT);
    const longitude = boundedDegrees(facts.GPSLongitude, LONGITUDE_LIMIT);

    return latitude === null || longitude === null
        ? null
        : { latitude, longitude };
}

module.exports = { captureMoment, coordinates, MONTHS, MOMENT_TAGS };
