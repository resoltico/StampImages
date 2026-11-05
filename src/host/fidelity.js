"use strict";
const { OperationError } = require("../core/errors.js");

const { buildSizeArgv } = require("../backend/queries.js");
const { positiveIntegerFrom } = require("../core/numbers.js");
const { errorMessage, isUserCanceled } = require("../core/errors.js");
const { runArgv } = require("./shell.js");

/*
 * What this program will and will not copy, asked of the file rather than
 * assumed about it.
 *
 * A stamped copy is a copy: the same picture, in the same colors, with one
 * block of text on it. A file this cannot say that about is refused with the
 * reason, which is a better outcome than a copy that is quietly something
 * else.
 */

/*
 * What this can copy faithfully, asked rather than assumed.
 *
 * Color photographs and gray ones, at either depth. Anything else is
 * refused: the four bands of a CMYK photograph are not three colors and an
 * alpha, and compositing onto them would produce a copy in different colors
 * from the original -- which is not a stamped copy of it. Measured, because
 * the band count alone cannot tell them apart: a CMYK JPEG and a PNG with
 * transparency both report four.
 */
const FAITHFUL = ["sRGB", "RGB", "RGB16", "B_W", "GRAY16"];
const INTERPRETATION = /VIPS_INTERPRETATION_(?<kind>\w+)/u;

/*
 * Gray and an alpha, or color and an alpha. Once the interpretations above
 * are the only ones left, an even band count is the alpha and nothing else.
 */
const GRAY_ALPHA = 2;
const COLOR_ALPHA = 4;
const ALPHA_BANDS = [GRAY_ALPHA, COLOR_ALPHA];

function headerField(job, path, field, label) {
    return String(runArgv(
        job.app,
        buildSizeArgv(job.tools.vipsheader, path, field),
        label
    ));
}

function positiveHeaderField(job, path, field, label) {
    const value = positiveIntegerFrom(headerField(job, path, field, label));

    if (value === 0) {
        throw new OperationError(`The image's ${field} is not a readable positive whole number.`);
    }

    return value;
}

function bandsOf(job, path) {
    return positiveHeaderField(job, path, "bands", "measuring the image");
}

function kindOf(job, path) {
    return INTERPRETATION.exec(
        headerField(job, path, "interpretation", "measuring the image")
    )?.groups.kind ?? "";
}

/* Only the explicit missing-field diagnostic means a single-image file. */
function pagesIn(job, path) {
    try {
        return positiveHeaderField(job, path, "n-pages", "counting the images");
    } catch (error) {
        if (!isUserCanceled(error) &&
            /^(?:vipsheader: )?vips_image_get: field "n-pages" not found$/u.test(
                errorMessage(error.cause ?? error).trim())) {
            return 1;
        }

        throw error;
    }
}

/*
 * Asked of the file that was selected, before anything decodes it.
 *
 * Measured: vipsheader answers both questions about the source directly, for
 * every format this accepts. Asking after the decode meant a photograph that
 * was about to be refused had already been decoded into the workspace, and
 * the caller only takes ownership of that file once the decode returns -- so
 * every refusal leaked a full-sized intermediate.
 */
function refuseUnfaithful(job, source) {
    const kind = kindOf(job, source);

    if (!FAITHFUL.includes(kind)) {
        throw new OperationError(
            "This image is not stored as color or gray, so a stamped " +
                `copy of it would not be the colors it is (${kind || "unreadable"}).`
        );
    }

    const pages = pagesIn(job, source);

    if (pages > 1) {
        throw new OperationError(
            `This file holds ${pages} images, and a stamped copy of it would ` +
                "hold only the first."
        );
    }
}

function hasAlpha(job, path) {
    return ALPHA_BANDS.includes(bandsOf(job, path));
}

module.exports = { refuseUnfaithful, hasAlpha, bandsOf, kindOf, pagesIn, positiveHeaderField };
