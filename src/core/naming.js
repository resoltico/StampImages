"use strict";

const { plural, utf8Length, truncateToBytes } = require("./numbers.js");
const { fileStem, sanitizeFilename } = require("./paths.js");

/*
 * Output filename construction and collision avoidance.
 *
 * What the output is called is the product's business; what a filename may be
 * is this one's. Both halves here were learned rather than chosen, and
 * neither is about any particular kind of file.
 */

const FIRST_SUFFIX = 2;
const MAXIMUM_SUFFIX = 10000;

/*
 * What one filename may be, in bytes.
 *
 * A path component is 255 bytes on the filesystems macOS puts a Mac's files
 * on -- HFS Plus documents 255 characters, APFS 255 UTF-8 characters, and
 * bytes is the bound that satisfies both. Nothing truncates a name that is
 * over it: the write fails with a complaint about the length, which is a poor
 * answer to "convert this photograph", and a valid source name can produce
 * one because the output name is longer than the name it came from.
 *
 * The suffix is measured rather than assumed: the mark and the extension are
 * both variable, and .jpeg is a byte longer than .jpg. Room is left for the
 * collision suffix as well, because a name that fits only until it needs _2 is
 * a name that fits until the second run.
 */
const FILENAME_BUDGET_BYTES = 255;
const COLLISION_RESERVE_BYTES = 5;

function boundedStem(stem, suffix) {
    const budget =
        FILENAME_BUDGET_BYTES - utf8Length(suffix) - COLLISION_RESERVE_BYTES;
    const kept = truncateToBytes(stem, Math.max(budget, 0));

    // Cutting can leave the trailing underscore or dot that sanitizing exists
    // to remove, so what is left goes through it again.
    return kept === stem ? stem : sanitizeFilename(kept);
}

/*
 * A name built from a source name, a marker and an extension, cut to fit.
 *
 * The stem is sanitized before it is measured, because sanitizing can change
 * how many bytes it is.
 */
function nameFrom(originalName, suffix) {
    const stem = sanitizeFilename(fileStem(originalName));

    return `${boundedStem(stem, suffix)}${suffix}`;
}

/*
 * The mark a stamped copy carries, and how to recognise one.
 *
 * Recognised only where a folder is being walked. Somebody who selects a file
 * by hand has asked for it, whatever it is called; somebody who selects a
 * folder has asked for the photographs in it, and the copies a previous run
 * left there are not photographs they took. Stamping one again produces a
 * second block of text over the first, in a file called photo_stamped_stamped.
 *
 * A collision number belongs to the same mark, so photo_stamped_2 is one of
 * ours as surely as photo_stamped is.
 */
const STAMPED = "_stamped";
const STAMPED_NAME = /_stamped(?:_\d+)?$/u;

function looksStamped(name) {
    return STAMPED_NAME.test(fileStem(name));
}

/*
 * Said once for the run rather than once per file. A folder stamped a second
 * time holds as many of these as it does photographs, and a report that
 * listed them all would bury everything else underneath.
 */
function describeExcluded(excluded) {
    return "Left alone: " +
        `${plural(excluded.length, "stamped copy", "stamped copies")} ` +
        "from an earlier run.";
}

/*
 * A path split at its extension, read off the end of the last component so
 * the directories cannot join in. A pattern over the whole path made them
 * part of the question: a folder with a newline in its name -- legal, and
 * handled everywhere else here -- stopped the pattern reaching the extension
 * at all, and a second file of the same name could not be given its suffix.
 *
 * A leading dot is a hidden file rather than an extension, so `.profile`
 * keeps its whole name and is numbered after it.
 */
function splitExtension(path) {
    const lastSlash = path.lastIndexOf("/");
    const lastDot = path.lastIndexOf(".");

    return lastDot > lastSlash + 1
        ? { stem: path.slice(0, lastDot), extension: path.slice(lastDot) }
        : { stem: path, extension: "" };
}

/*
 * Never overwrite: append _2, _3 and so on until the path is free. The caller
 * supplies the existence predicate so this stays pure.
 */
function nextUniquePath(initialPath, exists) {
    if (!exists(initialPath)) {
        return initialPath;
    }

    const { stem, extension } = splitExtension(initialPath);

    for (let suffix = FIRST_SUFFIX; suffix < MAXIMUM_SUFFIX; suffix += 1) {
        const candidate = `${stem}_${suffix}${extension}`;

        if (!exists(candidate)) {
            return candidate;
        }
    }

    throw new Error("Could not create a unique output filename.");
}

/*
 * Where a stamped copy is built before it is published.
 *
 * Inside the workspace rather than beside the images, which was measured
 * rather than chosen for tidiness: a Shortcuts helper could neither rename
 * nor even read a file a tool had created in the user's Downloads folder,
 * while a file the shell itself created there could be renamed freely and
 * copying into that folder from the workspace was allowed throughout.
 * Nothing is written into the output folder now except the finished image.
 */
function stagedPath(workspace, token, extension) {
    return `${workspace}/staged-${sanitizeFilename(String(token))}${extension}`;
}

module.exports = {
    STAMPED,
    looksStamped,
    describeExcluded,
    nameFrom,
    splitExtension,
    nextUniquePath,
    stagedPath
};
