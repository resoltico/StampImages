"use strict";

/*
 * Path string manipulation.
 *
 * These operate on POSIX path strings rather than touching the filesystem, so
 * they stay pure and testable.
 */

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
    { name: "HEIC", extensions: ["heic", "heif"] },
    { name: "TIFF", extensions: ["tif", "tiff"] },
    { name: "WebP", extensions: ["webp"] },
    { name: "AVIF", extensions: ["avif"] }
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

function basename(path) {
    const normalized = String(path).replace(/\/+$/u, "");
    const index = normalized.lastIndexOf("/");

    return index >= 0 ? normalized.slice(index + 1) : normalized;
}

function dirname(path) {
    const text = String(path);
    const index = text.lastIndexOf("/");

    return index >= 0 ? text.slice(0, index + 1) : "";
}

function fileStem(filename) {
    const value = String(filename);
    const index = value.lastIndexOf(".");

    return index > 0 ? value.slice(0, index) : value;
}

/*
 * Reduces a name to something safe to create on disk while preserving
 * Unicode. Separators and control characters become underscores; the result
 * never starts or ends with whitespace, a dot, or an underscore.
 */
function sanitizeFilename(filename) {
    const safe = String(filename)
        // Control characters are matched on purpose: they must not reach a filename.
        // eslint-disable-next-line no-control-regex
        .replace(/[\x00-\x1f\x7f/:]/gu, "_")
        .replace(/_+/gu, "_")
        .replace(/^\.+|\.+$/gu, "")
        .replace(/^[\s_]+|[\s_]+$/gu, "");

    return safe.length > 0 ? safe : "image";
}

module.exports = {
    SUPPORTED_FORMATS,
    supportedFormatList,
    isSupportedImage,
    basename,
    dirname,
    fileStem,
    sanitizeFilename
};
