"use strict";
const { basename } = require("../core/paths.js");
const { isSupportedImage } = require("../core/formats.js");
const { SPECIAL_FILE } = require("./reasons.js");
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
const UNREADABLE = "This item could not be read.";
const UNEXAMINABLE = "This item could not be examined.";
const ALREADY_STAMPED = "This is already a stamped copy, so it was left alone.";

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
 * Distinguish unrelated files from copies this action made. Skip unrelated
 * files silently; report stamped copies as exclusions so the user sees why they
 * were left alone. Exclusions do not turn a repeated folder run into a failure.
 */
function passedOver(path, entry) {
    if (entry.kind === "other") { return { reason: SPECIAL_FILE, excluded: false }; }
    if (entry.kind === "unreadable") { return { reason: UNREADABLE, excluded: false }; }
    if (["missing", "unexaminable"].includes(entry.kind)) {
        return { reason: UNEXAMINABLE, excluded: false };
    }

    if (entry.kind !== "file" || !isSupportedImage(path)) {
        return null;
    }

    if (looksStamped(basename(path))) { return { reason: ALREADY_STAMPED, excluded: true }; }
    return entry.identity ? null : { reason: UNEXAMINABLE, excluded: false };
}

module.exports = {
    UNREADABLE,
    UNEXAMINABLE,
    ALREADY_STAMPED,
    isHidden,
    childrenOf,
    passedOver
};
