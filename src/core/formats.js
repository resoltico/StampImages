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

const KNOWN = {
    ".jpg": { extension: ".jpg", options: QUALITY },
    ".jpeg": { extension: ".jpeg", options: QUALITY },
    ".png": { extension: ".png", options: LOSSLESS },
    ".heic": { extension: ".heic", options: QUALITY },
    ".heif": { extension: ".heif", options: QUALITY },
    ".tif": { extension: ".tif", options: LOSSLESS },
    ".tiff": { extension: ".tiff", options: LOSSLESS },
    ".webp": { extension: ".webp", options: QUALITY },
    ".avif": { extension: ".avif", options: QUALITY }
};

const FALLBACK = { extension: ".jpg", options: QUALITY };

function outputFormat(sourcePath) {
    const { extension } = splitExtension(String(sourcePath));

    return KNOWN[extension.toLowerCase()] ?? FALLBACK;
}

function outputExtension(sourcePath) {
    return outputFormat(sourcePath).extension;
}

/*
 * Where vips is told to write, which is the path with the encoder's settings
 * on the end of it. Only ever the argument vips is given: everything that
 * asks whether the file is there asks about the path itself.
 */
function savingPath(targetPath) {
    return `${targetPath}${outputFormat(targetPath).options}`;
}

module.exports = { outputFormat, outputExtension, savingPath, FALLBACK };
