"use strict";
const { basename, dirname } = require("../core/paths.js");
const { sortImageRecords } = require("../core/ordering.js");
const { imagesInFolder, NO_IMAGES } = require("./expand.js");
const { UNREADABLE, UNEXAMINABLE, ALREADY_STAMPED } = require("./walking.js");
const { selectedItems } = require("./selection.js");
const { rejectionReason, FOLDER, UNSUPPORTED, NOT_A_FILE } = require("./reasons.js");

/*
 * Admit supported requests and keep explicit reasons for the others.
 * selection.js normalizes requested spellings; admission decides which
 * accepted requests refer to an image already included in this run.
 */

function record(path, folder) {
    // Copies from a folder selection go into that selected folder, including
    // images discovered below it; directly selected images use their own folder.
    return { path, originalName: basename(path), folder };
}

const KIND_REASONS = {
    package: "This is a package, not a folder of images.",
    link: "This is a link; select the file it points to.",
    other: "This is not a regular file (a pipe, socket or device)."
};

/*
 * A stable code for every reason a selection item is turned away, so a
 * receipt can be read without matching sentences. Keyed by the producers' own
 * reason constants: the wording stays where it is decided.
 */
const SELECTION_CODES = new Map([
    [FOLDER, "folder"], [UNSUPPORTED, "unsupported-format"], [NOT_A_FILE, "not-a-file"],
    [KIND_REASONS.package, "package"], [KIND_REASONS.link, "link"], [KIND_REASONS.other, "special-file"],
    [UNREADABLE, "unreadable"], [UNEXAMINABLE, "unexaminable"], [ALREADY_STAMPED, "already-stamped"],
    [NO_IMAGES, "empty-folder"]
]);

function rejection(path, reason) {
    return { path, name: basename(path), reason, code: SELECTION_CODES.get(reason) ?? "unknown", stage: "selection" };
}

function admitFolder(tree, path, outcome) {
    outcome.selectedFolders += 1;

    const found = imagesInFolder(tree, path, outcome.taken);

    // Reported as themselves: naming the folder or the file the walk could
    // not look at is what lets someone go and see why.
    for (const problem of found.problems) {
        const into = problem.excluded ? outcome.excluded : outcome.rejected;

        into.push(rejection(problem.path, problem.reason));
    }

    if (found.reason) {
        outcome.rejected.push(rejection(path, found.reason));

        return;
    }

    for (const image of found.found) {
        outcome.images.push(record(image, `${path}/`));
    }
}

/*
 * Use native kind facts to refuse explicitly selected packages and links.
 * Packages are directories to the shell, but writing inside an app or photo
 * library would alter its bundle. Following links could leave the requested
 * folder and include the same image twice; test -f alone follows the target.
 */
function reasonFor(app, root) {
    return KIND_REASONS[root.kind] ?? rejectionReason(app, root.path);
}

/*
 * Visit folders before explicit files so the identity ledger includes the walk.
 * Still assess each explicit request independently: hidden entries, packages
 * and links can be skipped by walking without satisfying a request for them.
 *
 * Apply identity deduplication only after admission. Different names for one
 * file can have different admission results; the first name's result must not
 * silence a later request. An already-admitted identity needs no second copy.
 */
function admit(app, tree, root, outcome) {
    // A kind at all means there is a tree: it is the tree that answered.
    if (root.kind === "directory") {
        admitFolder(tree, root.path, outcome);

        return;
    }

    const reason = reasonFor(app, root);

    if (reason) {
        outcome.rejected.push(rejection(root.path, reason));

        return;
    }

    // Which file, not which spelling: a folder walked before this request may
    // have taken the same photograph under the name it is stored as.
    if (!outcome.taken.has(root.identity || root.path)) {
        outcome.taken.add(root.identity || root.path);
        outcome.images.push(record(root.path, dirname(root.path)));
    }
}

/*
 * Folder expansion needs an injected native tree. The production composition
 * root requires that capability before calling admission; the null default
 * keeps isolated adapter tests explicit about missing native facts.
 */
function collectImageFiles(app, inputItems, tree = null) {
    const outcome = {
        images: [],
        selectedFolders: 0,
        rejected: [],
        // Found by a walk and left alone, which is not the same as asked for
        // and refused: only the second is part of what was requested.
        excluded: [],
        taken: new Set()
    };

    for (const root of selectedItems(tree, inputItems, outcome.rejected)) {
        admit(app, tree, root, outcome);
    }

    return {
        images: sortImageRecords(outcome.images),
        selectedFolders: outcome.selectedFolders,
        rejected: outcome.rejected,
        excluded: outcome.excluded
    };
}

module.exports = { collectImageFiles, SELECTION_CODES };
