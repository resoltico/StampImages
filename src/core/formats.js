"use strict";

/*
 * The formats vips reads that behave like a photograph: one still image, of
 * known orientation, that a stamp can be composited onto and saved back as
 * the same kind of thing.
 *
 * Deliberately excluded, though vips can read them: GIF and animated WebP
 * (only the first frame would be taken, so the copy would not be the picture
 * that was stamped), SVG (vector, where a stamp measured in pixels has no
 * fixed size to be measured against), document formats (a page is not a
 * photograph), and camera RAW (slow, huge, and a stamped RAW is not a RAW any
 * application would still develop).
 *
 * The pattern and the list shown to the user are both derived from this table,
 * so a dialog cannot promise a format the filter would reject.
 */
const SUPPORTED_FORMATS = [
    { name: "JPEG", extensions: ["jpg", "jpeg"] },
    { name: "PNG", extensions: ["png"] },
    { name: "HEIC", family: "HEIF", compression: "hevc", extensions: ["heic", "heif"] },
    { name: "TIFF", extensions: ["tif", "tiff"] },
    { name: "WebP", extensions: ["webp"] },
    { name: "AVIF", family: "HEIF", compression: "av1", extensions: ["avif"] }
];

const SUPPORTED_EXTENSIONS = SUPPORTED_FORMATS.flatMap(
    (format) => format.extensions
);

const SUPPORTED_PATTERN = new RegExp(
    `\\.(?:${SUPPORTED_EXTENSIONS.join("|")})$`,
    "iu"
);

function isSupportedImage(path) {
    return SUPPORTED_PATTERN.test(String(path));
}

/*
 * "JPEG, PNG, HEIC, TIFF, WebP or AVIF". Worth spelling out to the user,
 * because the action refuses things people reasonably try, such as GIF and
 * RAW, and "no images selected" alone would not explain why.
 */
function supportedFormatList() {
    const names = SUPPORTED_FORMATS.map((format) => format.name);

    return `${names.slice(0, -1).join(", ")} or ${names.at(-1)}`;
}

module.exports = { SUPPORTED_FORMATS, supportedFormatList, isSupportedImage };
