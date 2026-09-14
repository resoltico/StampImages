"use strict";

const { isSupportedImage, basename } = require("../core/paths.js");
const { looksStamped } = require("../core/naming.js");

/*
 * What a walk makes of one entry it found, said here so that the walk itself
 * is only the walking.
 *
 * Dot-prefixed entries, packages and links are passed over. A link is not
 * followed because following one is how a walk leaves the folder it was given
 * and how it finds the same file twice.
 */

const HIDDEN = ".";
const UNREADABLE = "could not be read";
const UNEXAMINABLE = "could not be examined";
const ALREADY_STAMPED = "already a stamped copy, so it was left alone";

function isHidden(name) {
    return name.startsWith(HIDDEN);
}

/*
 * Depth is bounded by the length of a path, so the deepest a folder can nest
 * is far shallower than anything a call stack minds.
 */
function childrenOf(tree, folder, names) {
    return names
        .filter((name) => !isHidden(name))
        .map((name) => tree.standardize(`${folder}/${name}`));
}

/*
 * Why this entry is not a photograph to take, or "" when it is one.
 *
 * A copy this program made is named rather than passed over. The other files
 * in a folder are things nobody asked about; a stamped copy is a photograph
 * by every test here, and leaving it out without saying so is the run quietly
 * doing less than it was asked.
 */
/*
 * Two different silences and one word.
 *
 * Nobody asked about the other files in a folder, so a text file is passed
 * over without a word. A copy this program made is a photograph by every test
 * here, so it is named -- but it was never asked for either, and counting it
 * against the request made an ordinary second run over a folder report itself
 * as a failure. It is excluded, which is its own thing.
 */
function passedOver(path, entry) {
    if (entry.kind === "missing") {
        return { reason: UNEXAMINABLE, excluded: false };
    }

    if (entry.kind !== "file" || !isSupportedImage(path)) {
        return null;
    }

    return looksStamped(basename(path))
        ? { reason: ALREADY_STAMPED, excluded: true }
        : null;
}

module.exports = {
    UNREADABLE,
    UNEXAMINABLE,
    ALREADY_STAMPED,
    isHidden,
    childrenOf,
    passedOver
};
