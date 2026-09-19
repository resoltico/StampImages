"use strict";

/*
 * What is in a file, as far as anything that compares two of them can tell.
 *
 * The fake has no bytes, so each file carries a token instead: two files hold
 * the same contents when they hold the same token. A copy carries its
 * source's token along, which is what makes a byte comparison after a copy
 * answer yes -- and what makes a copy that was damaged, which a test arranges
 * by writing something else to the destination, answer no.
 *
 * Drawing is where tokens come from, and a drawing's token is the face it was
 * made with -- so two photographs that say the same thing in the same face
 * hold the same picture, which is what the stamp cache is about.
 */

function tokenFor(state, path) {
    return state.contents.get(path) ?? `file:${path}`;
}

function setContents(state, path, token) {
    state.contents.set(path, token);
}

function carryContents(state, source, destination) {
    setContents(state, destination, tokenFor(state, source));
}

function sameContents(state, one, other) {
    return tokenFor(state, one) === tokenFor(state, other);
}

/*
 * The face a drawing came out in.
 */
function drawingToken(font) {
    return `font:${font}`;
}

module.exports = {
    tokenFor,
    setContents,
    carryContents,
    sameContents,
    drawingToken
};
