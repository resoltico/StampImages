"use strict";

/*
 * vipsheader answers several different questions here -- the dimensions that
 * decide placement, what the file is stored as, the band count and the page
 * count -- so a matcher keyed on the tool name alone would answer them all
 * with the same number.
 */

/*
 * What the file says it is. vipsheader answers with the enum's own name
 * wrapped in its type, and the runtime reads the name out of it, so a fake
 * that answered a bare word would be answering a question nothing asks.
 */
const INTERPRETATIONS = {
    colour: "sRGB",
    grey: "B_W",
    deep: "RGB16",
    print: "CMYK"
};

function interpretationOf(host) {
    const kind = INTERPRETATIONS[host.stored ?? "colour"] ?? host.stored;

    return `((VipsInterpretation) VIPS_INTERPRETATION_${kind})`;
}

/*
 * How many images are in the file. vipsheader has no answer at all for a
 * single-page one -- the field is absent and the command fails -- and the
 * runtime reads that failure as "one", so the fake has to fail too.
 */
function pagesOf(host) {
    if (host.pages === undefined) {
        throw new Error('vips_image_get: field "n-pages" not found');
    }

    return String(host.pages);
}

/*
 * A stamp is a small image and a photograph is a large one, and the code
 * between them is all about that difference -- whether the stamp fits, where
 * it sits, whether the margin had room. A fake that answered one size for
 * every file would make every stamp exactly as large as its photograph.
 */
/*
 * And the finished copy is a third kind of file. It is measured once, by the
 * check that exists to catch a copy that is not the photograph it came from,
 * and a fake answering the photograph's own size for it could never fail that
 * check in a whole run. It answers the photograph's size unless a test says
 * otherwise, because that is what a copy is.
 */
const DIMENSIONS = [["'width'", "width", 600], ["'height'", "height", 400]];
const STAMP_DIMENSIONS = [["'width'", "stampWidth", 200], ["'height'", "stampHeight", 60]];
const SAVED_DIMENSIONS = [["'width'", "savedWidth"], ["'height'", "savedHeight"]];

function isStamp(command) {
    return command.includes("/stamp-") || command.includes("/font-");
}

function measuredBy(command) {
    if (isStamp(command)) {
        return STAMP_DIMENSIONS;
    }

    return command.includes("/staged-") ? SAVED_DIMENSIONS : DIMENSIONS;
}

/*
 * A knob a test set, then this kind of file's own default, then the
 * photograph's -- which is how the finished copy answers the photograph's size
 * without every test having to say so.
 */
function sizeOf(host, [named, knob, fallback]) {
    const photograph = DIMENSIONS.find(([field]) => field === named);

    return String(host[knob] ?? fallback ?? host[photograph[1]] ?? photograph[2]);
}

function headerField(host, command) {
    if (command.includes("'interpretation'")) {
        return interpretationOf(host);
    }

    if (command.includes("n-pages")) {
        return pagesOf(host);
    }

    if (command.includes("'orientation'")) {
        return String(host.orientation ?? 1);
    }

    const dimension = measuredBy(command)
        .find(([named]) => command.includes(named));

    return dimension ? sizeOf(host, dimension) : String(host.bands);
}

module.exports = { headerField };
