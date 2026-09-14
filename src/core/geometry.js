"use strict";

const { plural } = require("./numbers.js");

/*
 * Where the block of text goes on the photograph.
 *
 * In pixels of the image itself, measured from the edge the position names.
 * A margin given as a fraction of the picture would put the stamp in a
 * different place on every photograph of a batch, which is the opposite of
 * what stamping a batch is for.
 *
 * Two different things used to be clamped here and only one of them should
 * have been. A margin larger than the room there is asks for a place outside
 * the picture, and the edge is the honest answer: the whole stamp is still
 * visible and a margin is a request rather than a promise. A stamp larger
 * than the photograph is not that. Measured: vips crops an overlay to the
 * image beneath it, so a caption 26 characters long at 90 points on a
 * 120-pixel photograph was published as the letters "A v" and reported as a
 * success. That is refused now, with both sizes in the message, because
 * nothing this program can do to it would be what was asked for.
 */

const CENTRE_HALVES = 2;

function clamp(value, limit) {
    return Math.max(0, Math.min(Math.round(value), limit));
}

const HORIZONTAL = {
    left: (room, margin) => margin,
    right: (room, margin) => room - margin,
    centre: (room) => room / CENTRE_HALVES
};

const VERTICAL = {
    top: (room, margin) => margin,
    bottom: (room, margin) => room - margin
};

/*
 * "bottom-right" is one word for two decisions, so it is read as two.
 */
function edgesOf(position) {
    const [vertical, horizontal] = String(position).split("-");

    return { vertical, horizontal };
}

function describeSize(size) {
    return `${size.width} by ${size.height} pixels`;
}

function refuseSize(image, stamp) {
    return new Error(
        `The stamp does not fit on this photograph.\n\nThe text is ` +
            `${describeSize(stamp)} and the photograph is ${describeSize(image)}. ` +
            "Choose a smaller text size, or write less."
    );
}

/*
 * Where the stamp goes, and whether that is where it was asked to go.
 *
 * Both come out of the same arithmetic, which is the only way they can agree.
 * Asking a second time whether the margin fitted was a second rule, and it
 * was wrong: it required room for the margin on both sides of both edges,
 * when a margin is measured from the two edges the position names. An
 * eighty-pixel stamp fifteen pixels in from the corner of a hundred-pixel
 * photograph was reported as sitting against the edge.
 */
function placeStamp(image, stamp, settings) {
    if (stamp.width > image.width || stamp.height > image.height) {
        throw refuseSize(image, stamp);
    }

    const { vertical, horizontal } = edgesOf(settings.position);
    const acrossRoom = image.width - stamp.width;
    const downRoom = image.height - stamp.height;
    const asked = {
        left: HORIZONTAL[horizontal](acrossRoom, settings.margin),
        top: VERTICAL[vertical](downRoom, settings.margin)
    };
    const at = {
        left: clamp(asked.left, acrossRoom),
        top: clamp(asked.top, downRoom)
    };

    return {
        ...at,
        // A stamp pushed to the edge by a margin too large for the room is
        // still wholly visible, and a margin is a request rather than a
        // promise -- but a run that quietly did something else should say so.
        crowded: at.left !== Math.round(asked.left) ||
            at.top !== Math.round(asked.top)
    };
}

function describeCrowding(count) {
    return `${plural(count, "photograph")} had too little room for the ` +
        "margin, so the stamp sits against the edge.";
}

module.exports = { placeStamp, edgesOf, describeCrowding };
