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
 * Drawing is where tokens come from. A font probe draws twice and compares
 * the two files, so a drawing's token is the face it resolved to: a name this
 * machine does not have draws the same picture as the impossible name.
 */

const FALLBACK = "font:fallback";

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
 * The face a drawing came out in: the family asked for when this machine
 * draws with it, and the fallback when it does not. Left unsaid, every
 * candidate draws, which is a Mac with all of them installed.
 */
function drawingToken(state, font) {
    const known = state.fonts === undefined || state.fonts.includes(font);

    return known ? `font:${font}` : FALLBACK;
}

module.exports = {
    FALLBACK,
    tokenFor,
    setContents,
    carryContents,
    sameContents,
    drawingToken
};
