"use strict";

/*
 * Natural ordering, so that photo2 sorts before photo10.
 */

const EQUAL = 0;
const LEFT_FIRST = -1;
const RIGHT_FIRST = 1;

function naturalParts(value) {
    return String(value).toLowerCase().match(/\d+|\D+/gu) || [""];
}

function isNumeric(part) {
    return /^\d+$/u.test(part);
}

/*
 * Compare digit runs as decimal text rather than JavaScript numbers. Number()
 * loses precision beyond 2^53: 9007199254740992 and 9007199254740993 compare as
 * the same number. Long numeric camera/export filenames still need a stable,
 * exact order.
 *
 * Discard leading zeros for value comparison. A longer remaining run is larger;
 * equal-length runs compare lexically. Compare original widths only as a tie.
 */
const LEADING_ZEROS = /^0+(?=\d)/u;

function compareNumeric(leftPart, rightPart) {
    const left = leftPart.replace(LEADING_ZEROS, "");
    const right = rightPart.replace(LEADING_ZEROS, "");

    if (left.length !== right.length) {
        return left.length - right.length;
    }

    if (left !== right) {
        return left < right ? LEFT_FIRST : RIGHT_FIRST;
    }

    // Equal value, different zero padding: the narrower one sorts first.
    return leftPart.length - rightPart.length;
}

/*
 * Compares one segment pair. Returns EQUAL when the caller should move on to
 * the next segment.
 */
function comparePart(leftPart, rightPart) {
    if (leftPart === undefined) {
        return LEFT_FIRST;
    }

    if (rightPart === undefined) {
        return RIGHT_FIRST;
    }

    if (leftPart === rightPart) {
        return EQUAL;
    }

    if (isNumeric(leftPart) && isNumeric(rightPart)) {
        return compareNumeric(leftPart, rightPart);
    }

    return leftPart < rightPart ? LEFT_FIRST : RIGHT_FIRST;
}

function naturalCompare(left, right) {
    const leftParts = naturalParts(left);
    const rightParts = naturalParts(right);
    const length = Math.max(leftParts.length, rightParts.length);

    for (let index = 0; index < length; index += 1) {
        const comparison = comparePart(leftParts[index], rightParts[index]);

        if (comparison !== EQUAL) {
            return comparison;
        }
    }

    return EQUAL;
}

/*
 * Sort by full path so each folder's images stay together, in filename order,
 * before the next folder. Sorting only by basename would interleave images
 * from different numbered folders.
 */
function sortImageRecords(records) {
    return records.slice().sort(
        (left, right) => naturalCompare(left.path, right.path)
    );
}

module.exports = { naturalCompare, sortImageRecords };
