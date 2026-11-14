"use strict";
const { IssueError } = require("./errors.js");

const { splitExtension } = require("./naming.js");

/*
 * Choose output extension and encoder together from confirmed image content.
 * Preserve a matching source extension; otherwise use the content format's
 * canonical extension. Request quality 90 for lossy formats explicitly rather
 * than inheriting backend defaults; PNG and TIFF remain lossless.
 */

const QUALITY = "[Q=90]";
const LOSSLESS = "";
// Retain source color/capture metadata while excluding the stale HDR gain map.
const SDR_JPEG = "[Q=90,keep=exif:icc:xmp:iptc]";

const { SUPPORTED_FORMATS } = require("./formats.js");
function sourceFormat(path) {
    const extension = splitExtension(String(path)).extension.toLowerCase();
    return { extension, format: SUPPORTED_FORMATS.find((item) => item.extensions.includes(extension.slice(1))) };
}
function extensionFor(path, family, compression) {
    const source = sourceFormat(path);
    const format = SUPPORTED_FORMATS.find((item) => (item.family ?? item.name) === family && (!item.compression || item.compression === compression));
    if (!format) { throw new IssueError("The actual image encoding could not be confirmed as a supported format."); }
    return format.extensions.includes(source.extension.slice(1)) ? source.extension : `.${format.extensions[0]}`;
}
function outputFormat(path, gainMap) {
    const { extension, format } = sourceFormat(path);
    if (!format) { throw new IssueError("Unsupported output format."); }
    if (format.name === "JPEG" && gainMap === true) { return { extension, options: SDR_JPEG }; }
    return { extension, options: ["PNG", "TIFF"].includes(format.name) ? LOSSLESS : QUALITY };
}

/*
 * Where vips is told to write, which is the path with the encoder's settings
 * on the end of it. Only ever the argument vips is given: everything that
 * asks whether the file is there asks about the path itself.
 */
function savingPath(targetPath, gainMap) {
    return `${targetPath}${outputFormat(targetPath, gainMap).options}`;
}

module.exports = { outputFormat, savingPath, extensionFor };
