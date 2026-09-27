"use strict";

const { plural } = require("./numbers.js");

/*
 * What will be created, said before anything is.
 *
 * Worded as its sibling action, Image Files to PDF, words the same things:
 * the same sentence for what was selected, the same rule for where output
 * goes, the same promise about the originals.
 */

/*
 * Candidates, not a promise: an image counted here can still turn out to be
 * damaged, or to say nothing the stamp asks for. Whether a folder was
 * selected is carried from admission, never read off a path's spelling.
 */
function selectionSummary({ count = 0, selectedFolders = 0 } = {}) {
    if (count === 0) {
        return "Choose what to stamp and how it should look.";
    }

    return selectedFolders > 0
        ? `Found ${plural(count, "image")} in your selection, including subfolders.`
        : `You have selected ${plural(count, "image")}.`;
}

const COPY_NOTE = "Each image gets a stamped copy, saved in each folder you " +
    "selected or beside each image you selected. The original files are not " +
    "changed.";

/*
 * Two of the rows choose how something is written rather than what it says,
 * and a form whose first control offers "2026-09-09 14:30" reads as though it
 * were asking which date to stamp. The photograph answers that.
 */
const SOURCE_NOTE = "The date and place come from each image's own " +
    "metadata; the formats below are examples. Custom text is the same on " +
    "every copy.";

const LOCATION_NOTE = "Leaving GPS coordinates off does not remove location " +
    "data already in the image.";

module.exports = {
    selectionSummary,
    COPY_NOTE,
    SOURCE_NOTE,
    LOCATION_NOTE
};
