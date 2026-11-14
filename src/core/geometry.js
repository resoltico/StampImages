"use strict";

const { OperationError } = require("./errors.js");

/*
 * Place the stamp in image pixels from the edges named by its position.
 * Clamp an excessive margin to keep the whole stamp visible. Refuse a stamp
 * larger than the image: libvips crops overlays, which would lose caption text.
 */

const CENTER_HALVES = 2;

function clamp(value, limit) {
    return Math.max(0, Math.min(Math.round(value), limit));
}

const HORIZONTAL = {
    left: (room, margin) => margin,
    right: (room, margin) => room - margin,
    center: (room) => room / CENTER_HALVES
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

/*
 * An ordinary refusal of this photograph, not a fault in the program: one
 * small photograph in a batch must not stop the photographs after it.
 */
function refuseSize(image, stamp) {
    return new OperationError(
        `The stamp does not fit on this image.\n\nThe text is ` +
            `${describeSize(stamp)} and the image is ${describeSize(image)}. ` +
            "Choose a smaller text size, or write less."
    );
}

/*
 * Position and crowded-margin status come from the same arithmetic.
 * A margin applies only to the edges named by the selected position.
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

module.exports = { placeStamp, edgesOf };
