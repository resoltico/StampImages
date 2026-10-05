"use strict";

const { buildSizeArgv } = require("../core/queries.js");
const { positiveIntegerFrom } = require("../core/numbers.js");
const { errorMessage, isUserCancelled } = require("../core/errors.js");
const { runArgv } = require("./shell.js");

/*
 * What this program will and will not copy, asked of the file rather than
 * assumed about it.
 *
 * A stamped copy is a copy: the same picture, in the same colours, with one
 * block of text on it. A file this cannot say that about is refused with the
 * reason, which is a better outcome than a copy that is quietly something
 * else.
 */

/*
 * What this can copy faithfully, asked rather than assumed.
 *
 * Colour photographs and grey ones, at either depth. Anything else is
 * refused: the four bands of a CMYK photograph are not three colours and an
 * alpha, and compositing onto them would produce a copy in different colours
 * from the original -- which is not a stamped copy of it. Measured, because
 * the band count alone cannot tell them apart: a CMYK JPEG and a PNG with
 * transparency both report four.
 */
const FAITHFUL = ["sRGB", "RGB", "RGB16", "B_W", "GREY16"];
const INTERPRETATION = /VIPS_INTERPRETATION_(?<kind>\w+)/u;

/*
 * Grey and an alpha, or colour and an alpha. Once the interpretations above
 * are the only ones left, an even band count is the alpha and nothing else.
 */
const GREY_ALPHA = 2;
const COLOUR_ALPHA = 4;
const ALPHA_BANDS = [GREY_ALPHA, COLOUR_ALPHA];

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
        throw new Error(`The image's ${field} is not a readable positive whole number.`);
    }

    return value;
}

function bandsOf(job, path) {
    return positiveHeaderField(job, path, "bands", "measuring the photograph");
}

function kindOf(job, path) {
    return INTERPRETATION.exec(
        headerField(job, path, "interpretation", "measuring the photograph")
    )?.groups.kind ?? "";
}

/* Only the explicit missing-field diagnostic means a single-image file. */
function pagesIn(job, path) {
    try {
        return positiveHeaderField(job, path, "n-pages", "counting the images");
    } catch (error) {
        if (!isUserCancelled(error) &&
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
        throw new Error(
            "This photograph is not stored as colour or grey, so a stamped " +
                `copy of it would not be the colours it is (${kind || "unreadable"}).`
        );
    }

    const pages = pagesIn(job, source);

    if (pages > 1) {
        throw new Error(
            `This file holds ${pages} images, and a stamped copy of it would ` +
                "hold only the first."
        );
    }
}

function hasAlpha(job, path) {
    return ALPHA_BANDS.includes(bandsOf(job, path));
}

module.exports = { refuseUnfaithful, hasAlpha, bandsOf, kindOf, pagesIn, positiveHeaderField };
