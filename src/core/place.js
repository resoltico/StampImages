"use strict";

/*
 * Round the whole coordinate to the smallest displayed unit before splitting
 * it into degrees, minutes and seconds. This carries rounded seconds into the
 * next minute and prevents impossible values such as 12°59'60.0"N. Normalize
 * a rounded zero so decimal output never displays -0.0000.
 */

const DEGREE_DECIMALS = 4;
const SECOND_DECIMALS = 1;

const MINUTES_PER_DEGREE = 60;
const SECONDS_PER_ARC_MINUTE = 60;
const TENTHS_PER_SECOND = 10;
const TENTHS_PER_MINUTE = SECONDS_PER_ARC_MINUTE * TENTHS_PER_SECOND;
const TENTHS_PER_DEGREE = MINUTES_PER_DEGREE * TENTHS_PER_MINUTE;

/*
 * Choose the hemisphere from the coordinate's sign and round its magnitude
 * separately. Rounding a signed half-unit can produce negative zero, which
 * would assign the wrong hemisphere. Only a magnitude that displays as zero
 * uses the positive hemisphere letter.
 */
function hemisphere(value, displayed, positive, negative) {
    return value < 0 && displayed !== 0 ? negative : positive;
}

/*
 * Decimal degrees keep their sign, because that is how decimal degrees are
 * written everywhere they are read. Only the zero is touched: rounding a
 * coordinate just south of the equator gives negative zero, which prints its
 * sign back out as "-0.0000" -- a minus in front of nothing.
 */
function decimalDegrees(value) {
    const rounded = Number(value.toFixed(DEGREE_DECIMALS));

    return (rounded === 0 ? 0 : rounded).toFixed(DEGREE_DECIMALS);
}

function sexagesimal(value, positive, negative) {
    const tenths = Math.round(Math.abs(value) * TENTHS_PER_DEGREE);
    const degrees = Math.floor(tenths / TENTHS_PER_DEGREE);
    const withinDegree = tenths % TENTHS_PER_DEGREE;
    const minutes = Math.floor(withinDegree / TENTHS_PER_MINUTE);
    const seconds = (withinDegree % TENTHS_PER_MINUTE) / TENTHS_PER_SECOND;
    const letter = hemisphere(value, tenths, positive, negative);

    return `${degrees}°${minutes}'${seconds.toFixed(SECOND_DECIMALS)}"${letter}`;
}

function decimalPlace(place) {
    return `${decimalDegrees(place.latitude)}, ${decimalDegrees(place.longitude)}`;
}

function sexagesimalPlace(place) {
    return `${sexagesimal(place.latitude, "N", "S")} ` +
        `${sexagesimal(place.longitude, "E", "W")}`;
}

module.exports = { decimalPlace, sexagesimalPlace, sexagesimal, decimalDegrees };
