"use strict";
const { inputItemToPosixPath } = require("./input.js");
const { describeUnresolved } = require("./reasons.js");

/*
 * Normalize each requested spelling and inspect it through the same native
 * tree used for folder walking. Carry file identity without using it to drop
 * requests: two hard links can have different admission results.
 *
 * Visit folders first in path order, so ancestors precede descendants. Assess
 * explicit requests after walking, including hidden items and entries the walk
 * passes over. Admission deduplicates accepted images by identity, not merely
 * by path spelling or containment.
 */

/*
 * Ask the injected tree for kind and identity. Without one, return no native
 * facts; the composition root owns the requirement for a native capability.
 */
function inspect(tree, path) {
    return tree ? tree.inspect(path) : { kind: null, identity: "" };
}

function reportUnresolved(item, rejected) {
    const unresolved = describeUnresolved(item);

    if (unresolved) {
        rejected.push(unresolved);
    }
}

/*
 * Standardized, so that /Trip, /Trip/ and /Trip/Berlin/.. are one request
 * rather than three. The same spelling twice is the same question twice, and
 * asking the tree is asking Foundation; two spellings are asked about
 * separately, which is how they turn out to be one file.
 */
function remember(found, tree, path) {
    const standardized = tree ? tree.standardize(path) : path;

    if (found.roots.has(standardized)) {
        return;
    }

    const entry = inspect(tree, standardized);

    found.roots.set(standardized, {
        path: standardized,
        kind: entry.kind,
        identity: entry.identity
    });
}

function resolve(tree, items, rejected) {
    const found = { roots: new Map() };

    for (const item of items) {
        const path = inputItemToPosixPath(item);

        if (path) {
            remember(found, tree, path);
        } else {
            reportUnresolved(item, rejected);
        }
    }

    return [...found.roots.values()];
}

function isFolder(root) {
    return root.kind === "directory";
}

/*
 * Path order, which puts an ancestor before anything inside it: a folder's
 * path is a proper prefix of every path under it, and a prefix sorts first.
 * So the images in an overlap belong to the outermost folder that was
 * selected, whichever order the selection arrived in. Identities are unique
 * by now, so there is no third case.
 */
function byPath(left, right) {
    return left.path < right.path ? -1 : 1;
}

function selectedItems(tree, items, rejected) {
    const roots = resolve(tree, items, rejected);

    return [
        ...roots.filter(isFolder).sort(byPath),
        ...roots.filter((root) => !isFolder(root))
    ];
}

module.exports = { selectedItems };
