"use strict";
const { plural } = require("../../core/formatting.js");

/*
 * Describe the selection, destination and unchanged originals before creating
 * any stamped copies.
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
 * Summarize image count, stamped-copy count and destination in one line.
 * Name a single folder; count multiple folders and list their paths separately.
 */
function outcomeSummary({ count = 0, folders = [] } = {}) {
    const destination = folders.length === 1
        ? `${folders[0].replace(/\/$/u, "").split("/").pop()}/`
        : plural(folders.length, "folder");

    return `${plural(count, "image")} → ${plural(count, "stamped copy", "stamped copies")}, saved in ${destination}`;
}

const ORIGINALS_NOTE = "The original files are not changed.";

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
    outcomeSummary,
    ORIGINALS_NOTE,
    COPY_NOTE,
    SOURCE_NOTE,
    LOCATION_NOTE
};
