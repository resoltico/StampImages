"use strict";

const { operands, sizeOf } = require("./fake-measuring.cjs");
const { carryContents } = require("./fake-contents.cjs");

/*
 * What a new name for a file inherits: how large it is, what is in it, and --
 * when the tool makes another name for the same file rather than a new one --
 * which file it is.
 */
function inherit(state, source, destination, identity) {
    state.sizes.set(destination, sizeOf(state, source));
    carryContents(state, source, destination);
    identity();
}

/*
 * What the tools that change the filesystem do, modelled from the real ones.
 *
 * The distinctions matter to the code under test: ln makes another name for
 * one file and refuses a name that is taken, mv carries a file along and
 * without -n replaces what it finds, cp makes a different file, and the
 * shell's noclobber redirection takes a name only if nothing is there.
 */

/*
 * mv and cp into an existing directory put the file inside it under its own
 * name; they do not fail and they do not replace the directory. Measured on
 * the real filesystem, and it is how a finished PDF ended up inside a folder
 * that had taken the output path.
 */
function resolveDestination(state, source, destination) {
    if (!state.directories.has(destination)) {
        return destination;
    }

    return `${destination}/${source.slice(source.lastIndexOf("/") + 1)}`;
}

function remove(state, rest) {
    operands(rest).forEach((target) => {
        state.files.delete(target);
        state.identities.forget(target);
    });

    return "";
}

// mv -n declines silently when the destination already exists.
function move(state, rest) {
    const [source, target] = operands(rest);
    const destination = resolveDestination(state, source, target);

    // Without -n a rename replaces what is at the destination, which is
    // only ever this run's own reservation.
    const replacing = !rest.includes("-n");

    if ((replacing || !state.files.has(destination)) && state.files.has(source)) {
        state.files.delete(source);
        state.files.add(destination);
        state.sizes.delete(source);
        inherit(state, source, destination, () => state.identities.carry(source, destination));
    }

    return "";
}

/*
 * A copy is a different file with the same contents, and it leaves the source
 * in place. Without -n it overwrites what is at the destination -- which, in
 * this code, is only ever this run's own reservation.
 */
function copy(state, rest) {
    const [source, target] = operands(rest);
    const destination = resolveDestination(state, source, target);

    if (!state.files.has(source)) {
        throw new Error("cp: no such file");
    }

    if (rest.includes("-n") && state.files.has(destination)) {
        throw new Error(`cp: ${destination}: File exists`);
    }

    // A different file with the same contents, which is the whole of what a
    // byte comparison afterwards is asking about.
    state.files.add(destination);
    inherit(state, source, destination, () => state.identities.forget(destination));

    return "";
}

/*
 * ln makes a second name for the same bytes and fails when the name is taken
 * -- measured, and it is what makes claiming the output path exclusive. Like
 * mv and cp it links into a directory rather than replacing it.
 */
function link(state, rest) {
    const [source, target] = operands(rest);
    const destination = resolveDestination(state, source, target);

    if (!state.files.has(source)) {
        throw new Error("ln: no such file");
    }

    /*
     * A dangling link is a name that is taken. -e follows it and finds
     * nothing, so the name reads as free while something is plainly there --
     * and ln refuses it all the same, which is what makes ln the claim.
     */
    if (state.files.has(destination) ||
        state.directories.has(destination) ||
        state.danglingLinks.has(destination)) {
        throw new Error(`ln: ${destination}: File exists`);
    }

    state.files.add(destination);
    inherit(state, source, destination, () => state.identities.share(source, destination));

    return "";
}

module.exports = { move, copy, link, remove };
