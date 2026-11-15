"use strict";
const { OperationError } = require("../core/errors.js");
const { INTERPRETATION_BANDS } = require("../core/source-policy.js");

const { buildSizeArgv } = require("../backend/queries.js");
const { positiveIntegerFrom } = require("../core/numbers.js");
const { errorMessage, isUserCanceled } = require("../core/errors.js");
const { runArgv } = require("./shell.js");
const { buildHeaderArgv } = require("../backend/headers.js");
const { readMetadata } = require("../backend/metadata.js");
const { issuesOf, ISSUE } = require("../core/outcomes.js");

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
 * Check source color interpretation and page count before decoding. vipsheader
 * can answer both directly for every supported format. Refusing unsupported
 * content at this boundary avoids creating a full-size intermediate before
 * readPhotograph can transfer ownership of its decoded file to the caller.
 */
function normalizedKind(kind) { return kind.toLowerCase().replace(/_/gu, "-"); }

function refuseUnfaithful(job, source) {
    const kind = kindOf(job, source);

    if (!Object.hasOwn(INTERPRETATION_BANDS, normalizedKind(kind))) {
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

function colorFactsFrom(job, path, measured) {
    const bands = measured?.bands || bandsOf(job, path);
    const known = measured?.interpretation;
    const interpretation = Object.hasOwn(INTERPRETATION_BANDS, known ?? "") ? known : normalizedKind(kindOf(job, path));
    if (!Object.hasOwn(INTERPRETATION_BANDS, interpretation) || !INTERPRETATION_BANDS[interpretation].includes(bands)) {
        throw new OperationError("The image's color representation could not be confirmed as supported RGB or grayscale.");
    }
    return { bands, interpretation, hasAlpha: ALPHA_BANDS.includes(bands) };
}

// The initial structural fields belong to vips, before arbitrary image metadata.
// Unknown structure, duplicates or multiline ambiguity opt out of the faster read.
const HEADER_PREFIX_FIELDS = ["width", "height", "bands", "format", "coding", "interpretation"];
const HEADER_LINE = /^(?<name>[\w.[\]-]+):[ \t]/u;
function qualifiedDump(text, path) {
    const normalized = String(text).replace(/\r\n?/gu, "\n");
    const prefix = `${path}: `;
    if (!normalized.startsWith(prefix) || !/^\d+x\d+[ \t]/u.test(normalized.slice(prefix.length))) { return false; }
    const body = normalized.slice(normalized.indexOf("\n", prefix.length) + 1).split("\n");
    if (!HEADER_PREFIX_FIELDS.every((field, index) => body[index]?.startsWith(`${field}: `))) { return false; }
    const fields = new Set();
    for (const line of body.filter((entry) => entry !== "")) {
        const match = HEADER_LINE.exec(line);
        if (!match || fields.has(match.groups.name)) { return false; }
        fields.add(match.groups.name);
    }
    return true;
}
function measuredHeader(job, path, label) {
    if (/[\r\n]/u.test(path)) { return null; }
    try {
        const text = runArgv(job.app, buildHeaderArgv(job.tools.vipsheader, [path]), label);
        if (!qualifiedDump(text, path)) { return null; }
        const { width, height, bands, interpretation } = readMetadata(text, path).raw;
        return { width, height, bands, interpretation };
    } catch (error) {
        if (isUserCanceled(error) || issuesOf(error, "stamping").some((issue) => ![ISSUE.operation, "damaged"].includes(issue.code))) { throw error; }
        return null;
    }
}
function dimensionsFrom(job, path, measured) {
    const width = measured?.width || positiveHeaderField(job, path, "width", "measuring the stamp");
    const height = measured?.height || positiveHeaderField(job, path, "height", "measuring the stamp");
    return { width, height };
}
function dimensionsOf(job, path) {
    return dimensionsFrom(job, path, measuredHeader(job, path, "measuring the stamp"));
}
function colorFacts(job, path) {
    return colorFactsFrom(job, path, measuredHeader(job, path, "measuring the image"));
}
function imageFacts(job, path, expected) {
    const measured = measuredHeader(job, path, "measuring the stamp");
    const size = dimensionsFrom(job, path, measured);
    if (expected && (size.width !== expected.width || size.height !== expected.height)) {
        throw new OperationError(`The stamped copy is ${size.width} by ${size.height} pixels where ${expected.width} by ${expected.height} were expected:\n\n${path}`);
    }
    return { size, ...colorFactsFrom(job, path, measured) };
}
module.exports = { refuseUnfaithful, colorFacts, bandsOf, kindOf, pagesIn, dimensionsOf, imageFacts };
