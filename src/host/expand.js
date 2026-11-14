"use strict";
const { isSupportedImage } = require("../core/formats.js");
const {
    UNREADABLE,
    isHidden,
    childrenOf,
    passedOver
} = require("./walking.js");

/*
 * Walk selected folders for supported images, skipping unrelated files without
 * turning them into requested-item refusals. Explicitly selected items are
 * assessed separately by admission.js and receive a stated rejection if needed.
 *
 * Report unreadable folders and entries whose attributes cannot be inspected:
 * they may contain requested images. A successful listing does not establish
 * that each listed entry can be inspected, especially without execute permission.
 *
 * Skip dot-prefixed entries, packages and links. Following links could leave
 * the selected folder or include the same file twice. Deduplicate admitted
 * images by native identity, since different path spellings can name one file.
 */

/*
 * One entry that is not a folder: an image to take, something to report, or
 * something nobody asked for.
 */
function consider(path, entry, taken, outcome) {
    const over = passedOver(path, entry);

    if (over) {
        outcome.problems.push({ path, ...over });
    }

    if (over || entry.kind !== "file" || !isSupportedImage(path)) {
        return;
    }

    if (taken.has(entry.identity)) {
        // Another selection already has this file. Noted rather than counted:
        // whether a folder has anything new in it is the only question asked
        // of this, and how many it had is nobody's.
        outcome.alreadyTaken = true;

        return;
    }

    taken.add(entry.identity);
    outcome.found.push(path);
}

function walk(tree, folder, taken, outcome) {
    const names = tree.entries(folder);

    if (!names) {
        outcome.problems.push({ path: folder, reason: UNREADABLE });

        return false;
    }

    for (const path of childrenOf(tree, folder, names)) {
        const entry = tree.inspect(path);

        if (entry.kind === "directory") {
            walk(tree, path, taken, outcome);
        } else {
            consider(path, entry, taken, outcome);
        }
    }

    return true;
}

/*
 * Why there is nothing to take from this folder, or "" when there is. Nothing
 * new is not the same as nothing at all: what is in here may already be in
 * the run because a folder above it was selected too.
 */
const NO_IMAGES = "This folder contains no supported images.";

function emptiness(outcome) {
    return outcome.found.length === 0 && !outcome.alreadyTaken ? NO_IMAGES : "";
}

/*
 * The images inside a selected folder, whatever the walk could not look at,
 * and why there are none to take. The taken set is shared across every folder
 * of one run, and the walk adds to it as it goes.
 */
function imagesInFolder(tree, folder, taken) {
    const outcome = { found: [], problems: [], alreadyTaken: false };

    if (!walk(tree, folder, taken, outcome)) {
        // The folder that was selected, which is reported as itself rather
        // than as something unreadable inside it.
        return { found: [], problems: [], reason: UNREADABLE };
    }

    return {
        found: outcome.found,
        problems: outcome.problems,
        reason: emptiness(outcome)
    };
}

module.exports = { imagesInFolder, isHidden, NO_IMAGES };
