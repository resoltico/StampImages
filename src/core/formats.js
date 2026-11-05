"use strict";

const { splitExtension } = require("./naming.js");

/*
 * What a stamped copy is saved as, and how well.
 *
 * The same kind of file it came from, because a copy of a photograph that
 * arrives as something else is a surprise: a folder of JPEGs should not come
 * back as a folder of PNGs, and a file named .heic that is secretly a JPEG is
 * worse still. The name and the encoder are decided together, in one place,
 * because vips chooses the encoder from the extension it is given -- they are
 * not two decisions that have to be kept in agreement, they are one.
 *
 * The quality is stated because the default is not good enough. Measured:
 * vips writes JPEG at quality 75 and HEIF lower still, so every copy this
 * program made was visibly worse than the photograph it came from and nothing
 * said so. A copy somebody keeps should not be the place a default like that
 * takes effect.
 *
 * 90 rather than 100: at 90 vips also stops subsampling the colour channels,
 * which is where visible damage to a stamp's edges would come from, and the
 * difference above it is file size rather than something anybody can see.
 */

const QUALITY = "[Q=90]";
const LOSSLESS = "";

const { SUPPORTED_FORMATS } = require("./paths.js");
function sourceFormat(path) {
    const extension = splitExtension(String(path)).extension.toLowerCase();
    return { extension, format: SUPPORTED_FORMATS.find((item) => item.extensions.includes(extension.slice(1))) };
}
function extensionFor(path, family, compression) {
    const source = sourceFormat(path);
    const format = SUPPORTED_FORMATS.find((item) => (item.family ?? item.name) === family && (!item.compression || item.compression === compression));
    if (!format) { throw new Error("The actual image encoding could not be confirmed as a supported format."); }
    return format.extensions.includes(source.extension.slice(1)) ? source.extension : `.${format.extensions[0]}`;
}
function outputFormat(path) {
    const { extension, format } = sourceFormat(path);
    if (!format) { throw new Error("Unsupported output format."); }
    return { extension, options: ["PNG", "TIFF"].includes(format.name) ? LOSSLESS : QUALITY };
}

/*
 * Where vips is told to write, which is the path with the encoder's settings
 * on the end of it. Only ever the argument vips is given: everything that
 * asks whether the file is there asks about the path itself.
 */
function savingPath(targetPath) {
    return `${targetPath}${outputFormat(targetPath).options}`;
}

module.exports = { outputFormat, savingPath, extensionFor };
