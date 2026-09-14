"use strict";

/*
 * Writing a place the way a map writes one.
 *
 * Two forms, and both round before they decompose. Rounding afterwards is
 * what produced "12°59'60.0"N" on a photograph: the degrees and the minutes
 * were taken from the unrounded value and the seconds were rounded up into a
 * sixtieth that has to carry, and nothing carried it. The same fault at the
 * other end printed "-0.0000" for a coordinate just south of the equator,
 * which is a minus sign in front of nothing.
 *
 * So each form decides its smallest displayed unit first, rounds the whole
 * coordinate into that unit, and reads the larger units back out of it. What
 * comes out cannot disagree with itself.
 */

const DEGREE_DECIMALS = 4;
const SECOND_DECIMALS = 1;

const MINUTES_PER_DEGREE = 60;
const SECONDS_PER_ARC_MINUTE = 60;
const TENTHS_PER_SECOND = 10;
const TENTHS_PER_MINUTE = SECONDS_PER_ARC_MINUTE * TENTHS_PER_SECOND;
const TENTHS_PER_DEGREE = MINUTES_PER_DEGREE * TENTHS_PER_MINUTE;

/*
 * The hemisphere is a letter rather than a sign: a negative latitude written
 * "-56°56'58.6\"" reads as an arithmetic result, and the letter is what a map
 * says.
 *
 * Which letter is a question about the coordinate, and how large it is is a
 * question about the display -- and rounding the two separately made them
 * disagree. Half of the smallest displayed unit south of the equator rounds
 * to a magnitude of one unit and, rounded again as a signed number, to
 * negative zero: a place shown as a tenth of a second south of the equator,
 * labelled north of it. The sign is read off the value itself, and only a
 * magnitude that displays as nothing takes the positive letter.
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
