"use strict";

const { buildSizeArgv } = require("../core/queries.js");
const { runArgv, tryArgv } = require("./shell.js");

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
    )).trim();
}

function bandsOf(job, path) {
    return Number(headerField(job, path, "bands", "measuring the photograph"));
}

function kindOf(job, path) {
    return INTERPRETATION.exec(
        headerField(job, path, "interpretation", "measuring the photograph")
    )?.groups.kind ?? "";
}

/*
 * How many images are in the file.
 *
 * vipsheader has no answer at all for a single-page one -- the field is
 * absent and the question fails -- so the failure is the answer. Which means
 * a file it could not read at all answers the same way, and would be taken
 * for one image: the interpretation is asked first, and that one has to
 * succeed for any readable file, so a missing page count after it is a
 * missing field rather than a missing answer.
 */
function pagesIn(job, path) {
    const answer = Number(tryArgv(
        job.app,
        buildSizeArgv(job.tools.vipsheader, path, "n-pages")
    ));

    return answer > 1 ? answer : 1;
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

module.exports = { refuseUnfaithful, hasAlpha, bandsOf, kindOf, pagesIn };
